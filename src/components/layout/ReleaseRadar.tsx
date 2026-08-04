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
 * NEW EPISODES — what's fresh across everything the user tracks.
 *
 *  · Anime (Watching/Waiting): one AniList batch via the existing
 *    enhanceWithAniListImages, which returns _nextAiringEpisode. A show
 *    whose next episode is close gets "airs in…"; otherwise, if it's
 *    mid-run, the latest episode is called out as out now.
 *  · Manhwa: tracked slugs intersected with the AsuraScans home feed's
 *    latest_chapters (real published_at timestamps).
 *  · Novels: tracked ids intersected with the library's latest-updates
 *    shelf (chapter label only — the sources carry no timestamp).
 *
 * Computed on open, not polled — this tab IS the poll.
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

// Opening the tab is the poll — but not more than once per five minutes.
// The build costs an AniList batch plus two scraper home feeds; airing
// schedules don't move faster than this.
let radarCache: { at: number; rows: Row[] } | null = null;

export default function ReleaseRadar({ onClose }: { onClose: () => void }) {
  const { getTrackedList, isLoaded: animeLoaded } = useAnimeStatus();
  const { getTrackedList: getManhwaList, isLoaded: manhwaLoaded } = useManhwaStatus();
  const { getTrackedList: getNovelList, isLoaded: novelLoaded } = useNovelStatus();
  const { openAnime } = useAnimeModal();

  const [rows, setRows] = useState<Row[] | null>(null);
  const ready = animeLoaded && manhwaLoaded && novelLoaded;

  useEffect(() => {
    if (!ready) return;
    if (radarCache && Date.now() - radarCache.at < 5 * 60 * 1000) {
      setRows(radarCache.rows);
      return;
    }
    let live = true;

    const build = async () => {
      const out: Row[] = [];

      // ── anime ──
      try {
        const tracked = getTrackedList().filter((e) => e.status === "Watching" || e.status === "Waiting");
        if (tracked.length > 0) {
          const enhanced = await enhanceWithAniListImages(tracked.slice(0, 50).map((e) => e.anime));
          for (let i = 0; i < enhanced.length; i++) {
            const a = enhanced[i] as any;
            const nx = a._nextAiringEpisode as { airingAt: number; episode: number } | undefined;
            if (!nx) continue;
            const entry = tracked[i];
            const title = (a.title_english || a.title || entry.anime.title) as string;
            const cover = (a.images?.jpg?.image_url || a.images?.jpg?.large_image_url || null) as string | null;
            const untilMs = nx.airingAt * 1000 - Date.now();
            if (untilMs > 0 && untilMs < 48 * 3600 * 1000) {
              out.push({
                key: `a-${a.mal_id}`,
                kind: "anime", title, cover,
                line: `Episode ${nx.episode} airs ${formatDistanceToNow(nx.airingAt * 1000, { addSuffix: true })}`,
                when: nx.airingAt * 1000,
                onClick: () => { onClose(); openAnime(entry.anime); },
              });
            } else if (nx.episode > 1) {
              // weekly cadence estimate for "how fresh is the last episode"
              const prevAiredAt = nx.airingAt * 1000 - WEEK;
              if (Date.now() - prevAiredAt < WEEK) {
                out.push({
                  key: `a-${a.mal_id}`,
                  kind: "anime", title, cover,
                  line: `Episode ${nx.episode - 1} is out now`,
                  when: prevAiredAt,
                  onClick: () => { onClose(); openAnime(entry.anime); },
                });
              }
            }
          }
        }
      } catch { /* the section just stays empty */ }

      // ── manhwa ──
      try {
        const tracked = getManhwaList();
        if (tracked.length > 0) {
          const res = await fetch("/api/manhwa/home");
          const home = await res.json();
          const latest: Record<string, any> = {};
          for (const item of [...(home.latestUpdates || []), ...(home.trending || [])]) {
            if (!latest[item.id]) latest[item.id] = item;
          }
          for (const m of tracked) {
            const item = latest[m.mangaId];
            const lc = item?.latest_chapters?.[0];
            if (!lc?.published_at) continue;
            const at = new Date(lc.published_at).getTime();
            if (Date.now() - at > 2 * WEEK) continue;
            out.push({
              key: `m-${m.mangaId}`,
              kind: "manhwa",
              title: m.title,
              cover: item?.image ? `/api/manhwa-image?url=${encodeURIComponent(item.image)}` : null,
              line: `Chapter ${lc.number} dropped ${formatDistanceToNow(at, { addSuffix: true })}`,
              when: at,
              href: `/manhwa/${encodeURIComponent(m.mangaId)}`,
            });
          }
        }
      } catch { /* ignore */ }

      // ── novels ──
      try {
        const tracked = getNovelList();
        if (tracked.length > 0) {
          const res = await fetch("/api/novels/home");
          const home = await res.json();
          const latest: Record<string, any> = {};
          for (const item of [...(home.latestUpdates || []), ...(home.fanmtl || [])]) {
            if (!latest[item.id]) latest[item.id] = item;
          }
          for (const n of tracked) {
            const item = latest[n.novelId];
            if (!item?.latestChapter) continue;
            out.push({
              key: `n-${n.novelId}`,
              kind: "novel",
              title: n.title,
              cover: novelCover(item.cover) || null,
              line: `${item.latestChapter} is out`,
              when: null,
              href: `/novel/${encodeURIComponent(n.novelId)}`,
            });
          }
        }
      } catch { /* ignore */ }

      out.sort((a, b) => (b.when ?? 0) - (a.when ?? 0));
      radarCache = { at: Date.now(), rows: out };
      if (live) setRows(out);
    };

    build();
    return () => { live = false; };
  }, [ready]);

  if (!ready || rows === null) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 font-mono text-xs font-bold">Checking your tracked titles…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <PlayCircle className="h-6 w-6 text-white/20" />
        </div>
        <p className="font-mono text-sm font-medium text-slate-400">Nothing new right now</p>
        <p className="mt-1 font-mono text-xs text-slate-500">New drops for your tracked titles appear here.</p>
      </div>
    );
  }

  const KindIcon = { anime: Tv, manhwa: BookOpen, novel: Feather };

  return (
    <div className="divide-y divide-white/5">
      {rows.map((r) => {
        const Icon = KindIcon[r.kind];
        const inner = (
          <>
            <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white/5">
              {r.cover
                ? <img src={r.cover} alt="" className="h-full w-full object-cover" />
                : <span className="grid h-full w-full place-items-center"><Icon className="h-4 w-4 text-slate-600" /></span>}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-bold text-white">{r.title}</span>
              <span className="mt-0.5 block font-mono text-xs text-slate-400">{r.line}</span>
            </span>
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          </>
        );
        const cls = "flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.05]";
        return r.href ? (
          <Link key={r.key} href={r.href} onClick={onClose} className={cls}>{inner}</Link>
        ) : (
          <button key={r.key} type="button" onClick={r.onClick} className={cls}>{inner}</button>
        );
      })}
    </div>
  );
}
