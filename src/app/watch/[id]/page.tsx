"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Info, Loader2,
  Search, Star, Check, ExternalLink, EyeOff,
} from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";
import WatchOverlay from "@/components/anime/WatchOverlay";
import LoadingScreen from "@/components/ui/LoadingScreen";
import AnimeCard from "@/components/anime/AnimeCard";
import CommunityFeed from "@/components/community/CommunityFeed";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { getAnimeDetails, getAnimeRecommendations, getAnimeRelations, type AnimeRelation } from "@/lib/jikan";
import { getAnimeDetailsKitsu } from "@/lib/kitsu";
import { resolveEpisodes, type ResolvedEpisodes } from "@/lib/animeEpisodes";
import type { AnikotoEpisode } from "@/lib/anikoto";

/**
 * THE WATCH PAGE — where clicking an episode lands: the reference layout
 * with the player on the left and the episode world on the right (season
 * progress, spoiler-guarded synopsis, prev/next, series card, searchable
 * episode ranges), then episode info + playback settings, Recommended,
 * and the series discussion.
 *
 * The player is the SAME WatchOverlay that fed Continue Watching all
 * along, rendered inline and keyed by episode so every switch is a clean
 * mount. URL stays shareable: /watch/[malId]?ep=N (&t=seconds to resume).
 */

const RANGE = 100;

type WatchPrefs = { autoNext: boolean };
const PREFS_KEY = "davinci_watch_prefs";
const watchedKey = (malId: number) => `davinci_watched_${malId}`;

function loadPrefs(): WatchPrefs {
  try {
    return { autoNext: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch { return { autoNext: false }; }
}
function loadWatched(malId: number): number[] {
  try { return JSON.parse(localStorage.getItem(watchedKey(malId)) || "[]"); } catch { return []; }
}

export default function WatchPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Preparing player" />}>
      <WatchInner />
    </Suspense>
  );
}

function WatchInner() {
  const params = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const { openAnime } = useAnimeModal();

  const malId = Number(params.id);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [resolved, setResolved] = useState<ResolvedEpisodes | null>(null);
  const [relations, setRelations] = useState<AnimeRelation[]>([]);
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [epNo, setEpNo] = useState(() => Math.max(1, parseInt(sp.get("ep") || "1", 10) || 1));
  // The ?t resume belongs to the ?ep it ARRIVED with, frozen at page init —
  // gating on the live URL let a stale timestamp leak into other episodes.
  const [resume] = useState<{ ep: number; seconds: number } | null>(() => {
    const t = parseInt(sp.get("t") || "", 10);
    if (!Number.isFinite(t) || t <= 0) return null;
    return { ep: Math.max(1, parseInt(sp.get("ep") || "1", 10) || 1), seconds: t };
  });
  const [detailsFailed, setDetailsFailed] = useState(false);
  const [watched, setWatched] = useState<number[]>([]);
  const [prefs, setPrefs] = useState<WatchPrefs>({ autoNext: false });
  const [epQuery, setEpQuery] = useState("");
  const [openRange, setOpenRange] = useState(0);
  const [spoilerOpen, setSpoilerOpen] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  // ── data ──
  useEffect(() => {
    if (!malId) return;
    let live = true;
    (async () => {
      let a: Anime | null = null;
      try { a = await getAnimeDetails(malId); }
      catch { try { a = await getAnimeDetailsKitsu(malId); } catch { /* dead id */ } }
      if (!live) return;
      if (!a) { setDetailsFailed(true); return; }
      setAnime(a);
      const r = await resolveEpisodes(a);
      if (live) setResolved(r);
    })();
    getAnimeRelations(malId).then((r) => { if (live) setRelations(r); }).catch(() => {});
    getAnimeRecommendations(malId).then((r) => { if (live) setRecommendations(r); }).catch(() => {});
    return () => { live = false; };
  }, [malId]);

  useEffect(() => {
    setWatched(loadWatched(malId));
    setPrefs(loadPrefs());
  }, [malId]);

  // The URL is the source of truth for the episode — a fresh push to the
  // SAME watch page (modal episode click, sequel link back) must land.
  useEffect(() => {
    const u = Math.max(1, parseInt(sp.get("ep") || "1", 10) || 1);
    setEpNo((cur) => (u !== cur ? u : cur));
  }, [sp]);

  const episodes = resolved?.episodes || [];
  const current: AnikotoEpisode | undefined = useMemo(
    () => episodes.find((e) => e.number === epNo) || episodes[0],
    [episodes, epNo]
  );
  const currentNo = current?.number ?? epNo;
  const idx = current ? episodes.findIndex((e) => e.id === current.id) : -1;
  const prevEp = idx > 0 ? episodes[idx - 1] : null;
  const nextEp = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;
  const title = (anime?.title_english || anime?.title || "") as string;
  const banner = (anime?.trailer?.images?.maximum_image_url || anime?.images?.jpg?.large_image_url || "") as string;

  const goTo = (n: number) => {
    setEpNo(n);
    setSpoilerOpen(false);
    router.replace(`/watch/${malId}?ep=${n}`, { scroll: false });
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const markWatched = (n: number) => {
    setWatched((w) => {
      const nw = w.includes(n) ? w : [...w, n];
      try { localStorage.setItem(watchedKey(malId), JSON.stringify(nw)); } catch { /* full */ }
      return nw;
    });
  };

  const setPref = (patch: Partial<WatchPrefs>) => {
    setPrefs((p) => {
      const np = { ...p, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(np)); } catch { /* full */ }
      return np;
    });
  };

  // ── episode search: number, range ("5", "120") or title text ──
  const filteredEpisodes = useMemo(() => {
    const q = epQuery.trim().toLowerCase();
    if (!q) return null;
    return episodes.filter((e) =>
      String(e.number).includes(q) || (e.title || "").toLowerCase().includes(q)
    );
  }, [episodes, epQuery]);

  const ranges = useMemo(() => {
    const out: { label: string; eps: AnikotoEpisode[]; hasCurrent: boolean }[] = [];
    for (let i = 0; i < episodes.length; i += RANGE) {
      const eps = episodes.slice(i, i + RANGE);
      out.push({
        label: episodes.length <= RANGE ? "All Episodes" : `Episodes ${i + 1}-${Math.min(i + RANGE, episodes.length)}`,
        eps,
        hasCurrent: eps.some((e) => e.id === current?.id),
      });
    }
    return out;
  }, [episodes, current]);

  // Auto-open the range holding the current episode — but only when the
  // EPISODE changes, so a deliberately collapsed list stays collapsed.
  useEffect(() => {
    const ri = ranges.findIndex((r) => r.hasCurrent);
    if (ri >= 0) setOpenRange(ri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Details behind a modal must not keep playing with audio underneath it.
  const pausePlayer = () => {
    try { playerRef.current?.querySelector("video")?.pause(); } catch { /* embed */ }
  };
  const openDetails = () => {
    if (!anime) { router.back(); return; }
    pausePlayer();
    openAnime(anime);
  };

  if (!malId) {
    return <div className="min-h-screen bg-[#070709] pt-32 text-center font-mono text-slate-400">Invalid anime id.</div>;
  }
  if (detailsFailed) {
    return (
      <div className="min-h-screen bg-[#070709] pt-32 text-center">
        <p className="font-mono text-base font-black text-white">Couldn&apos;t load this anime</p>
        <p className="mt-2 font-mono text-xs text-slate-500">The id may be wrong, or the metadata sources are down.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3 font-mono text-sm font-bold text-slate-200 transition hover:bg-white/10">
          Back to home
        </Link>
      </div>
    );
  }

  const loading = !anime || !resolved;
  const pipCount = Math.min(episodes.length || 1, 28);
  const pipFilled = episodes.length ? Math.round((currentNo / episodes.length) * pipCount) : 0;

  return (
    <div className="min-h-screen bg-[#070709] pb-28 text-slate-200">
      {/* ═══ HEADER STRIP ═══ */}
      <div className="relative overflow-hidden">
        {banner && (
          <img src={banner} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-[#070709]" />
        <div className="relative mx-auto max-w-[1500px] px-4 pb-6 pt-8 sm:px-6">
          <button
            onClick={openDetails}
            className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to series
          </button>
          <h1 className="mt-3 font-mono text-3xl font-black uppercase tracking-wider text-white sm:text-4xl">{title || "…"}</h1>
          <p className="mt-2 font-mono text-sm text-slate-400">
            Episode {currentNo}
            {current?.title ? <span className="text-slate-500"> | <em className="italic">{current.title}</em></span> : null}
          </p>
        </div>
      </div>

      {/* ═══ PLAYER + SIDEBAR ═══ */}
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div ref={playerRef} className="min-w-0 scroll-mt-4">
          {loading ? (
            <div className="grid aspect-video w-full place-items-center rounded-2xl border border-white/10 bg-black">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="font-mono text-xs font-bold uppercase tracking-widest">Preparing player…</p>
              </div>
            </div>
          ) : resolved.error || !current ? (
            <div className="grid aspect-video w-full place-items-center rounded-2xl border border-white/10 bg-black px-6 text-center">
              <div>
                <p className="font-mono text-base font-black text-white">Couldn&apos;t load episodes</p>
                <p className="mt-2 font-mono text-xs text-slate-500">{resolved.error || "No episodes found."}</p>
              </div>
            </div>
          ) : !resolved.streamable ? (
            <div className="grid aspect-video w-full place-items-center rounded-2xl border border-white/10 bg-black px-6 text-center">
              <div>
                <EyeOff className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-3 font-mono text-base font-black text-white">Streaming not available</p>
                <p className="mt-2 font-mono text-xs text-slate-500">This anime isn&apos;t in the streaming library yet — episode info only.</p>
              </div>
            </div>
          ) : (
            <WatchOverlay
              key={current.id}
              inline
              anime={anime as any}
              consumetAnimeId={resolved.consumetId}
              initialEpisodeId={current.id}
              initialEpisodeNo={currentNo}
              initialSeconds={resume && currentNo === resume.ep ? resume.seconds : null}
              allEpisodes={episodes}
              onClose={openDetails}
              onEnded={() => {
                markWatched(currentNo);
                if (prefs.autoNext && nextEp) goTo(nextEp.number);
              }}
            />
          )}

          {/* ── EPISODE INFORMATION ── */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-slate-500">Episode Information</p>
            <p className="mt-3 font-mono text-sm text-slate-300">
              <span className="font-black text-white">Title:</span> {current?.title || `Episode ${currentNo}`}
            </p>
            <p className="mt-1 font-mono text-sm text-slate-300">
              <span className="font-black text-white">Language:</span> sub
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                onClick={() => markWatched(currentNo)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs font-black transition ${
                  watched.includes(currentNo)
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-white/15 bg-white/[0.05] text-slate-200 hover:bg-white/10"
                }`}
              >
                <Check className="h-3.5 w-3.5" /> {watched.includes(currentNo) ? "Watched" : "Mark as Watched"}
              </button>
              <button
                onClick={openDetails}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 font-mono text-xs font-black text-slate-200 transition hover:bg-white/10"
              >
                <Info className="h-3.5 w-3.5" /> Details
              </button>
              <a
                href={`https://myanimelist.net/anime/${malId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 font-mono text-xs font-black text-slate-200 transition hover:bg-white/10"
              >
                MAL <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* ── PLAYBACK SETTINGS ── only switches that actually do things */}
            <p className="mt-7 font-mono text-xs font-black uppercase tracking-[0.22em] text-slate-500">Playback Settings</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-slate-300">Auto-redirect to next episode</span>
              <button
                onClick={() => setPref({ autoNext: !prefs.autoNext })}
                className={`rounded-lg border px-3.5 py-1.5 font-mono text-xs font-black transition ${
                  prefs.autoNext
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-white/15 bg-white/[0.05] text-slate-400 hover:text-white"
                }`}
              >
                {prefs.autoNext ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          {/* ── RECOMMENDED ── */}
          {recommendations.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 flex items-center gap-2 font-mono text-lg font-black text-white">
                <Star className="h-4 w-4 text-amber-400" /> Recommended
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3">
                {recommendations.map((rec) => (
                  <AnimeCard key={rec.mal_id} anime={rec} />
                ))}
              </div>
            </div>
          )}

          {/* ── DISCUSSION ── */}
          {anime && (
            <div className="mt-8">
              <CommunityFeed animeId={malId} animeTitle={title} />
            </div>
          )}
        </div>

        {/* ═══ SIDEBAR ═══ */}
        <aside className="min-w-0">
          <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
            <button onClick={openDetails} className="flex items-center gap-2 font-mono text-sm font-black uppercase tracking-wider text-white transition hover:text-violet-300">
              {title || "…"} <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-mono text-[11px] font-black text-slate-300">
                E{currentNo}
              </span>
              <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-[11px] font-black text-black">SUB</span>
            </div>

            {/* season progress */}
            <div className="mt-5">
              <div className="flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <span>Season Progress</span>
                <span className="tabular-nums normal-case tracking-normal">
                  {currentNo}/{episodes.length || "?"} · {watched.length} watched
                </span>
              </div>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: pipCount }).map((_, i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-full ${i < pipFilled ? "bg-white" : "bg-white/10"}`} />
                ))}
              </div>
            </div>

            {current?.title && (
              <p className="mt-5 font-mono text-lg font-black leading-snug text-white">{current.title}</p>
            )}

            {/* spoiler-guarded synopsis */}
            {current?.description && (
              <div
                onMouseEnter={() => setSpoilerOpen(true)}
                onMouseLeave={() => setSpoilerOpen(false)}
                onClick={() => setSpoilerOpen((v) => !v)}
                className="relative mt-3 cursor-pointer"
              >
                <p className={`font-mono text-xs leading-relaxed text-slate-400 transition duration-300 ${spoilerOpen ? "" : "select-none blur-sm"}`}>
                  {current.description}
                </p>
                {!spoilerOpen && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 font-mono text-[10px] font-bold text-slate-300">
                      <EyeOff className="h-3 w-3" /> Hover to reveal · spoiler protected
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* prev / next */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => prevEp && goTo(prevEp.number)}
                disabled={!prevEp}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center gap-1 font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <ChevronLeft className="h-3 w-3" /> Previous
                </span>
                <span className="mt-1 block font-mono text-sm font-bold text-slate-300">Episode</span>
              </button>
              <button
                onClick={() => nextEp && goTo(nextEp.number)}
                disabled={!nextEp}
                className="relative overflow-hidden rounded-xl border border-white/10 p-3 text-right transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nextEp?.image && (
                  <>
                    <img src={nextEp.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                    <span className="absolute inset-0 bg-gradient-to-l from-black/70 to-black/20" />
                  </>
                )}
                <span className="relative flex items-center justify-end gap-1 font-mono text-[10px] font-black uppercase tracking-wider text-slate-300">
                  Next <ChevronRight className="h-3 w-3" />
                </span>
                <span className="relative mt-1 block font-mono text-sm font-black text-white">Episode</span>
              </button>
            </div>
          </div>

          {/* seasons: this series + its sequels/prequels */}
          <div className="mt-6">
            <h2 className="mb-3 font-mono text-lg font-black text-white">Seasons</h2>
            <div className="relative overflow-hidden rounded-2xl border border-white/20">
              {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/30" />
              <div className="relative p-4">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded bg-emerald-400/90 px-2 py-0.5 font-mono text-[10px] font-black text-black">Current Season</span>
                  {anime?.status && (
                    <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[10px] font-black text-white backdrop-blur">
                      {String(anime.status).toLowerCase().includes("airing") ? "Ongoing" : anime.status}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-mono text-base font-black uppercase tracking-wide text-white">{title}</p>
                <p className="mt-1 font-mono text-xs text-slate-300">
                  {episodes.length || anime?.episodes || "?"} Episodes
                  {anime?.score ? <span className="text-amber-300"> ★ {anime.score}</span> : null}
                </p>
                <p className="mt-0.5 font-mono text-[11px] uppercase text-slate-400">
                  {anime?.type || "TV"}{anime?.season ? ` · ${anime.season} ${anime.year || ""}` : anime?.year ? ` · ${anime.year}` : ""}
                </p>
              </div>
            </div>
            {relations.filter((r) => /sequel|prequel/i.test(r.relation)).slice(0, 4).map((r) => (
              <Link
                key={r.mal_id}
                href={`/watch/${r.mal_id}`}
                className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-[#0b0b11] px-4 py-3 transition hover:bg-white/[0.05]"
              >
                <span className="min-w-0 truncate font-mono text-sm font-bold text-slate-200">{r.name}</span>
                <span className="ml-3 shrink-0 rounded border border-white/15 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-slate-400">
                  {r.relation}
                </span>
              </Link>
            ))}
          </div>

          {/* episodes */}
          <div className="mt-6">
            <h2 className="mb-3 font-mono text-lg font-black text-white">Episodes</h2>
            <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  value={epQuery}
                  onChange={(e) => setEpQuery(e.target.value)}
                  placeholder="Episode or range, e.g. 5 or 120"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
                />
              </div>

              {filteredEpisodes ? (
                <div className="custom-scrollbar mt-3 max-h-[420px] space-y-1 overflow-y-auto overscroll-contain">
                  {filteredEpisodes.slice(0, 200).map((e) => (
                    <EpisodeRow key={e.id} ep={e} active={e.id === current?.id} watched={watched.includes(e.number)} onGo={goTo} />
                  ))}
                  {filteredEpisodes.length === 0 && (
                    <p className="py-6 text-center font-mono text-xs text-slate-500">No episodes match.</p>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {ranges.map((r, ri) => (
                    <div key={r.label} className="overflow-hidden rounded-xl border border-white/10">
                      <button
                        onClick={() => setOpenRange(openRange === ri ? -1 : ri)}
                        className="flex w-full items-center justify-between px-4 py-3 font-mono text-sm font-bold text-slate-200 transition hover:bg-white/[0.04]"
                      >
                        <span className="flex items-center gap-2">
                          {r.label}
                          {r.hasCurrent && <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-black text-black">Current</span>}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${openRange === ri ? "rotate-180" : ""}`} />
                      </button>
                      {openRange === ri && (
                        <div className="custom-scrollbar max-h-[380px] space-y-1 overflow-y-auto overscroll-contain border-t border-white/10 p-2">
                          {r.eps.map((e) => (
                            <EpisodeRow key={e.id} ep={e} active={e.id === current?.id} watched={watched.includes(e.number)} onGo={goTo} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EpisodeRow({ ep, active, watched, onGo }: { ep: AnikotoEpisode; active: boolean; watched: boolean; onGo: (n: number) => void }) {
  return (
    <button
      onClick={() => onGo(ep.number)}
      className={`group flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
        active
          ? "border-white/40 bg-white/[0.08]"
          : "border-transparent hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-sm">
        <span className="font-black text-white">Episode {ep.number}</span>
        {ep.title && <span className="text-slate-400"> - {ep.title}</span>}
      </span>
      {watched && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-300" />
    </button>
  );
}
