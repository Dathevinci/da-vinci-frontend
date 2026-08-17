"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PlayCircle, Tv, BookOpen, Feather } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAnimeStatus } from "@/hooks/useAnimeStatus";
import { useManhwaStatus } from "@/hooks/useManhwaStatus";
import { useNovelStatus } from "@/hooks/useNovelStatus";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { enhanceWithAniListImages } from "@/lib/jikan";
import { novelCover } from "@/lib/novelImage";

/**
 * RELEASES & RADAR — what's fresh across all tracked Anime, Manhwa, and Novels.
 *
 *  · Anime (Watching/Waiting/Interested/On-Hold): checks AniList airing schedules
 *    for upcoming countdowns and episodes released in the past 14 days.
 *  · Manhwa: tracked library series matched against latest updates across all
 *    sources (AsuraScans, WeebCentral, VortexScans, etc.) with real timestamps.
 *  · Novels: tracked library titles matched against ReadNovelFull + RoyalRoad
 *    latest release drops.
 */

type Row = {
  key: string;
  kind: "anime" | "manhwa" | "novel";
  title: string;
  cover: string | null;
  line: string;
  when: number | null;
  onClick?: () => void;
  href?: string;
};

const WEEK = 7 * 86400 * 1000;

function normTitle(s?: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bareSlug(id?: string): string {
  return (id || "").toLowerCase().replace(/^[a-z]{2,5}:/, "").trim();
}

let radarCache: { at: number; rows: Row[] } | null = null;

export default function ReleaseRadar({
  onClose,
  onCountChange,
}: {
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  const { getTrackedList: getAnimeList, isLoaded: animeLoaded } = useAnimeStatus();
  const { getTrackedList: getManhwaList, isLoaded: manhwaLoaded } = useManhwaStatus();
  const { getTrackedList: getNovelList, isLoaded: novelLoaded } = useNovelStatus();
  const { openAnime } = useAnimeModal();

  const [rows, setRows] = useState<Row[] | null>(null);
  const ready = animeLoaded && manhwaLoaded && novelLoaded;

  useEffect(() => {
    if (!ready) return;
    if (radarCache && Date.now() - radarCache.at < 3 * 60 * 1000) {
      setRows(radarCache.rows);
      onCountChange?.(radarCache.rows.length);
      return;
    }
    let live = true;

    const build = async () => {
      const out: Row[] = [];
      const seenKeys = new Set<string>();

      // ── 1. Anime Releases ──
      try {
        const trackedAnime = getAnimeList().filter((e) => {
          const s = String(e.status || "").toLowerCase();
          return s !== "finished" && s !== "dropped" && s !== "none";
        });

        if (trackedAnime.length > 0) {
          const enhanced = await enhanceWithAniListImages(trackedAnime.slice(0, 50).map((e) => e.anime));
          for (let i = 0; i < enhanced.length; i++) {
            const a = enhanced[i] as any;
            const entry = trackedAnime[i];
            const title = (a?.title_english || a?.title || entry?.anime?.title || "Anime") as string;
            const cover = (a?.images?.jpg?.image_url || a?.images?.jpg?.large_image_url || null) as string | null;
            const malId = a?.mal_id || entry?.anime?.mal_id;
            const rowKey = `a-${malId}`;

            const nx = a?._nextAiringEpisode as { airingAt: number; episode: number } | undefined;
            if (nx?.airingAt) {
              const untilMs = nx.airingAt * 1000 - Date.now();
              if (untilMs > 0 && untilMs < 7 * 24 * 3600 * 1000) {
                if (!seenKeys.has(rowKey)) {
                  seenKeys.add(rowKey);
                  out.push({
                    key: rowKey,
                    kind: "anime",
                    title,
                    cover,
                    line: `Episode ${nx.episode} airs ${formatDistanceToNow(nx.airingAt * 1000, { addSuffix: true })}`,
                    when: nx.airingAt * 1000,
                    onClick: () => {
                      onClose();
                      openAnime(entry.anime);
                    },
                  });
                }
              } else if (nx.episode > 1) {
                const prevAiredAt = nx.airingAt * 1000 - WEEK;
                if (Date.now() - prevAiredAt < 2 * WEEK) {
                  if (!seenKeys.has(rowKey)) {
                    seenKeys.add(rowKey);
                    out.push({
                      key: rowKey,
                      kind: "anime",
                      title,
                      cover,
                      line: `Episode ${nx.episode - 1} is out now`,
                      when: prevAiredAt,
                      onClick: () => {
                        onClose();
                        openAnime(entry.anime);
                      },
                    });
                  }
                }
              }
            } else if (entry?.anime?.status === "Currently Airing" && entry.anime.episodes) {
              if (!seenKeys.has(rowKey)) {
                seenKeys.add(rowKey);
                out.push({
                  key: rowKey,
                  kind: "anime",
                  title,
                  cover,
                  line: `Currently airing — ${entry.anime.episodes} episodes`,
                  when: entry.updatedAt || null,
                  onClick: () => {
                    onClose();
                    openAnime(entry.anime);
                  },
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("ReleaseRadar anime error:", e);
      }

      // ── 2. Manhwa Releases ──
      try {
        const trackedManhwa = getManhwaList();
        if (trackedManhwa.length > 0) {
          const res = await fetch("/api/manhwa/home");
          if (res.ok) {
            const home = await res.json();
            const latestPool: any[] = [...(home.latestUpdates || []), ...(home.trending || [])];

            const byId = new Map<string, any>();
            const byBare = new Map<string, any>();
            const byTitle = new Map<string, any>();

            for (const item of latestPool) {
              if (!item) continue;
              if (item.id) {
                byId.set(String(item.id).toLowerCase(), item);
                byBare.set(bareSlug(item.id), item);
              }
              if (item.title) {
                byTitle.set(normTitle(item.title), item);
              }
            }

            for (const m of trackedManhwa) {
              const mId = String(m.mangaId || "").toLowerCase();
              const mBare = bareSlug(m.mangaId);
              const mNorm = normTitle(m.title);

              const hit = byId.get(mId) || byBare.get(mBare) || byTitle.get(mNorm);
              if (!hit) continue;

              const rowKey = `m-${m.mangaId}`;
              if (seenKeys.has(rowKey)) continue;
              seenKeys.add(rowKey);

              const chLabel = hit.latestChapter || (hit.latest_chapters?.[0]?.number ? `Chapter ${hit.latest_chapters[0].number}` : "New chapter");
              let timestamp: number | null = null;
              if (hit.updatedAt) {
                const parsed = new Date(hit.updatedAt).getTime();
                if (Number.isFinite(parsed)) timestamp = parsed;
              } else if (hit.latest_chapters?.[0]?.published_at) {
                const parsed = new Date(hit.latest_chapters[0].published_at).getTime();
                if (Number.isFinite(parsed)) timestamp = parsed;
              }

              const line = timestamp && Date.now() - timestamp < 30 * 86400 * 1000
                ? `${chLabel} dropped ${formatDistanceToNow(timestamp, { addSuffix: true })}`
                : `${chLabel} is out now`;

              const coverUrl = hit.image || m.coverImage;
              out.push({
                key: rowKey,
                kind: "manhwa",
                title: m.title || hit.title || "Manhwa",
                cover: coverUrl ? `/api/manhwa-image?url=${encodeURIComponent(coverUrl)}` : null,
                line,
                when: timestamp,
                href: `/manhwa/${encodeURIComponent(m.mangaId)}`,
              });
            }
          }
        }
      } catch (e) {
        console.error("ReleaseRadar manhwa error:", e);
      }

      // ── 3. Novel Releases ──
      try {
        const trackedNovels = getNovelList();
        if (trackedNovels.length > 0) {
          const res = await fetch("/api/novels/home");
          if (res.ok) {
            const home = await res.json();
            const pool: any[] = [
              ...(home.latestUpdates || []),
              ...(home.trending || []),
              ...(home.featuredHero || []),
              ...(home.translatedNovels || []),
              ...(home.originalFiction || []),
              ...(home.completed || []),
            ];

            const byId = new Map<string, any>();
            const byBare = new Map<string, any>();
            const byTitle = new Map<string, any>();

            for (const item of pool) {
              if (!item) continue;
              if (item.id) {
                byId.set(String(item.id).toLowerCase(), item);
                byBare.set(bareSlug(item.id), item);
              }
              if (item.title) {
                byTitle.set(normTitle(item.title), item);
              }
            }

            for (const n of trackedNovels) {
              const nId = String(n.novelId || "").toLowerCase();
              const nBare = bareSlug(n.novelId);
              const nNorm = normTitle(n.title);

              const hit = byId.get(nId) || byBare.get(nBare) || byTitle.get(nNorm);
              if (!hit) continue;

              const rowKey = `n-${n.novelId}`;
              if (seenKeys.has(rowKey)) continue;
              seenKeys.add(rowKey);

              const chLabel = hit.latestChapter || "New chapter";
              const line = `${chLabel} is out now`;
              const coverUrl = novelCover(hit.cover || n.coverImage) || null;

              out.push({
                key: rowKey,
                kind: "novel",
                title: n.title || hit.title || "Novel",
                cover: coverUrl,
                line,
                when: n.updatedAt || null,
                href: `/novel/${encodeURIComponent(n.novelId)}`,
              });
            }
          }
        }
      } catch (e) {
        console.error("ReleaseRadar novel error:", e);
      }

      out.sort((a, b) => (b.when ?? 0) - (a.when ?? 0));
      radarCache = { at: Date.now(), rows: out };
      if (live) {
        setRows(out);
        onCountChange?.(out.length);
      }
    };

    build();
    return () => {
      live = false;
    };
  }, [ready, onCountChange]);

  if (!ready || rows === null) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        <p className="mt-3 font-mono text-xs font-bold text-slate-400">Checking your tracked titles…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <PlayCircle className="h-6 w-6 text-white/20" />
        </div>
        <p className="font-mono text-sm font-medium text-slate-400">No new releases right now</p>
        <p className="mt-1 font-mono text-xs text-slate-500">New chapters & episodes for your tracked titles will appear here.</p>
      </div>
    );
  }

  const KindIcon = { anime: Tv, manhwa: BookOpen, novel: Feather };
  const KindLabel = { anime: "Anime", manhwa: "Manhwa", novel: "Novel" };
  const KindColor = {
    anime: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    manhwa: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    novel: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };

  return (
    <div className="divide-y divide-white/5">
      {rows.map((r) => {
        const Icon = KindIcon[r.kind];
        const inner = (
          <>
            <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5 shadow border border-white/10">
              {r.cover ? (
                <img src={r.cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-white/5">
                  <Icon className="h-4 w-4 text-slate-500" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase border ${KindColor[r.kind]}`}>
                  <Icon className="h-2.5 w-2.5" />
                  {KindLabel[r.kind]}
                </span>
                <span className="truncate text-xs sm:text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  {r.title}
                </span>
              </div>
              <span className="mt-1 block font-mono text-xs text-slate-300">
                {r.line}
              </span>
            </span>
          </>
        );

        const cls = "group flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.06] active:bg-white/[0.09]";
        return r.href ? (
          <Link key={r.key} href={r.href} onClick={onClose} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={r.key} type="button" onClick={r.onClick} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
