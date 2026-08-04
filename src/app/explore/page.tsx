"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Filter, EyeOff, Eye, Infinity as InfinityIcon, Star, Loader2,
  ChevronLeft, ChevronRight, Clock, Calendar, Tag,
} from "lucide-react";
import { searchAnime } from "@/lib/jikan";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { Anime } from "@tutkli/jikan-ts";

/**
 * DISCOVER — the reference explore: one sticky control bar (search, NSFW
 * veil, infinite-scroll toggle, a Filters sheet), then a clean poster grid
 * with a mono meta line per card. Every card opens the detail screen.
 *
 * Deep links from the home carousels (?status=&sort=&title=…) keep
 * working — the page reads them as its initial state and the `title`
 * param still names the heading.
 *
 * The page-level useSearchParams sits under Suspense — without it,
 * `next build` fails the whole route (learned the hard way).
 */

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
  "Mystery", "Psychological", "Mecha", "Music",
];
const SORTS: { key: string; label: string }[] = [
  { key: "popularity", label: "Most Popular" },
  { key: "score", label: "Highest Rated" },
  { key: "trending", label: "Trending" },
  { key: "newest", label: "Newest" },
  { key: "title_az", label: "Title A-Z" },
  { key: "title_za", label: "Title Z-A" },
];
const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const YEARS = Array.from({ length: 18 }, (_, i) => new Date().getFullYear() + 1 - i);

type Filters = {
  sort: string;
  year: number | null;
  season: string | null;
  genres: string[];
  status: string | null;
  format: string | null;
};

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070709]" />}>
      <ExploreInner />
    </Suspense>
  );
}

function ExploreInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { openAnime } = useAnimeModal();

  const heading = sp.get("title") || "Discover Anime";
  const [q, setQ] = useState(sp.get("q") || "");
  const [filters, setFilters] = useState<Filters>({
    sort: sp.get("sort") || "popularity",
    year: sp.get("year") ? Number(sp.get("year")) : null,
    season: sp.get("season"),
    genres: sp.get("genre") ? sp.get("genre")!.split(",") : [],
    status: sp.get("status"),
    format: sp.get("format"),
  });
  const [nsfw, setNsfw] = useState(false);
  const [infinite, setInfinite] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Shared with the panel's outside-click test — the Filters button must
  // count as inside, or its mousedown closes the panel and the click
  // reopens it and staged edits are lost to the remount.
  const filtersWrapRef = useRef<HTMLDivElement>(null);

  const [media, setMedia] = useState<Anime[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // Requests SUPERSEDE, never drop: each load takes a fresh sequence
  // number and a stale response throws itself away. The old busy-flag
  // version silently discarded a new search typed during an infinite-
  // scroll append, leaving the grid showing the previous query forever.
  const seqRef = useRef(0);
  const inFlightRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildVars = (p: number) => {
    const v: any = { page: p };
    // Searching with the default sort defers to AniList's relevance
    // (SEARCH_MATCH) — a hand-picked sort still wins when chosen.
    if (!(q.trim() && filters.sort === "popularity")) v.sort = [filters.sort];
    if (q.trim()) v.search = q.trim();
    if (filters.status) v.status = filters.status;
    if (filters.season) v.season = filters.season.toLowerCase();
    if (filters.year) v.seasonYear = filters.year;
    if (filters.genres.length) v.genre_in = filters.genres;
    if (filters.format) v.format = filters.format;
    return v;
  };

  const load = async (p: number, append: boolean) => {
    const seq = ++seqRef.current;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const res = await searchAnime(buildVars(p));
      if (seqRef.current !== seq) return; // a newer request took over
      const list: Anime[] = res?.Page?.media || [];
      const info = res?.Page?.pageInfo || { total: 0, hasNextPage: false };
      setMedia((m) => (append ? [...m, ...list] : list));
      setTotal(info.total || 0);
      setHasNext(!!info.hasNextPage);
      setPage(p);
    } catch {
      if (seqRef.current === seq && !append) { setMedia([]); setTotal(0); setHasNext(false); }
    } finally {
      if (seqRef.current === seq) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  // Debounced search + filters → fresh page 1, and the URL keeps up so the
  // state survives refresh/share.
  useEffect(() => {
    const t = setTimeout(() => {
      load(1, false);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filters.sort !== "popularity") params.set("sort", filters.sort);
      if (filters.year) params.set("year", String(filters.year));
      if (filters.season) params.set("season", filters.season);
      if (filters.genres.length) params.set("genre", filters.genres.join(","));
      if (filters.status) params.set("status", filters.status);
      if (filters.format) params.set("format", filters.format);
      if (sp.get("title")) params.set("title", sp.get("title")!);
      const qs = params.toString();
      router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
    }, q ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters]);

  // Infinite scroll: the sentinel near the grid's end pulls the next page.
  useEffect(() => {
    if (!infinite || !hasNext) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !inFlightRef.current) load(page + 1, true);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infinite, hasNext, page, media.length]);

  // The library already strips outright adult content; the veil here
  // additionally hides the suggestive tier until deliberately lifted.
  const shownMedia = nsfw ? media : media.filter((a) => !a.genres?.some((g) => g.name === "Ecchi"));

  return (
    <div className="min-h-screen bg-[#070709] pb-24 text-white">
      {/* ── control bar ── */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070709]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for anime..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 font-mono text-sm text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setNsfw((v) => !v)}
            title={nsfw ? "Suggestive content shown" : "Suggestive content hidden"}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 font-mono text-xs font-black transition ${
              nsfw
                ? "border-red-500/50 bg-red-500/15 text-red-300"
                : "border-red-500/25 bg-red-500/[0.06] text-red-400/80 hover:bg-red-500/10"
            }`}
          >
            {nsfw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} NSFW
          </button>

          <button
            onClick={() => setInfinite((v) => !v)}
            title={`Infinite scroll: ${infinite ? "on" : "off"}`}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border font-black transition ${
              infinite
                ? "border-white/25 bg-white text-black"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
            }`}
          >
            <InfinityIcon className="h-5 w-5" />
          </button>

          <div className="relative shrink-0" ref={filtersWrapRef}>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 font-mono text-xs font-black transition ${
                filtersOpen ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
              }`}
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            {filtersOpen && (
              <FiltersPanel
                value={filters}
                anchorRef={filtersWrapRef}
                onApply={(f) => { setFilters(f); setFiltersOpen(false); }}
                onClose={() => setFiltersOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── heading + grid ── */}
      <div className="mx-auto max-w-[1500px] px-4 pt-8">
        <h1 className="font-mono text-3xl font-black text-white">{heading}</h1>
        <p className="mt-1.5 font-mono text-sm text-slate-500">
          {shownMedia.length} anime shown{total ? ` (of ${total.toLocaleString()} found)` : ""}
        </p>

        {/* filters that arrived via deep link but have no home in the
            panel — visible and dismissible, not silently applied */}
        {(filters.status || filters.format) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.status && (
              <button
                onClick={() => setFilters({ ...filters, status: null })}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] font-bold capitalize text-slate-200 transition hover:bg-white/10"
              >
                Status: {filters.status} <span className="text-slate-500">✕</span>
              </button>
            )}
            {filters.format && (
              <button
                onClick={() => setFilters({ ...filters, format: null })}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] font-bold uppercase text-slate-200 transition hover:bg-white/10"
              >
                {filters.format} <span className="text-slate-500">✕</span>
              </button>
            )}
          </div>
        )}

        {loading && media.length === 0 ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-slate-600" />
          </div>
        ) : shownMedia.length === 0 ? (
          <div className="py-24 text-center font-mono text-sm text-slate-500">
            Nothing found — try different filters.
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {shownMedia.map((a, i) => (
              <button
                key={`${a.mal_id}-${i}`}
                onClick={() => openAnime(a)}
                className="group text-left"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[#101018]">
                  <img
                    src={(a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "") as string}
                    alt={a.title_english || a.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2.5 line-clamp-1 font-mono text-sm font-bold text-white">
                  {a.title_english || a.title}
                </p>
                <p className="mt-1 flex items-center gap-2 font-mono text-[11px] font-bold text-slate-500">
                  <span>{a.type || "TV"}</span>
                  {a.year ? <span>{a.year}</span> : null}
                  {a.episodes ? <span>{a.episodes} eps</span> : null}
                  {a.score ? (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Star className="h-3 w-3 fill-current" /> {(a.score * 10).toFixed(0)}%
                    </span>
                  ) : null}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ── more: sentinel when infinite, buttons when not ── */}
        {infinite ? (
          <div ref={sentinelRef} className="flex justify-center py-10">
            {loading && media.length > 0 && <Loader2 className="h-6 w-6 animate-spin text-slate-600" />}
          </div>
        ) : (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => page > 1 && load(page - 1, false)}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="font-mono text-xs font-bold text-slate-500">Page {page}</span>
            <button
              onClick={() => hasNext && load(page + 1, false)}
              disabled={!hasNext || loading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Hoisted so React keeps ONE component identity — defined inline it
 *  remounted the whole panel subtree on every staged click. */
function Section({ Icon, label, children }: { Icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      <p className="mb-3 flex items-center gap-2 font-mono text-xs font-black text-white">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {children}
    </div>
  );
}

function FiltersPanel({
  value,
  anchorRef,
  onApply,
  onClose,
}: {
  value: Filters;
  /** The wrapper holding the toggle button — inside for close purposes. */
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [staged, setStaged] = useState<Filters>(value);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, anchorRef]);

  return (
    <div
      className="absolute right-0 top-full z-40 mt-2 flex max-h-[min(70vh,640px)] w-[320px] flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b0b11] p-3 shadow-2xl sm:w-[360px]"
    >
      <Section Icon={Clock} label="Sort By">
        <div className="flex flex-col">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStaged({ ...staged, sort: s.key })}
              className={`rounded-lg px-3 py-2 text-left font-mono text-xs font-bold transition ${
                staged.sort === s.key ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      <Section Icon={Calendar} label="Year">
        <div className="grid grid-cols-3 gap-1.5">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setStaged({ ...staged, year: staged.year === y ? null : y })}
              className={`rounded-lg border px-2 py-1.5 font-mono text-xs font-bold transition ${
                staged.year === y
                  ? "border-white bg-white text-black"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </Section>

      <Section Icon={Calendar} label="Season">
        <div className="grid grid-cols-2 gap-1.5">
          {SEASONS.map((s) => (
            <button
              key={s}
              onClick={() => setStaged({ ...staged, season: staged.season === s ? null : s })}
              className={`rounded-lg border px-2 py-1.5 font-mono text-xs font-bold transition ${
                staged.season === s
                  ? "border-white bg-white text-black"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section Icon={Tag} label="Genres">
        <div className="grid grid-cols-2 gap-1.5">
          {GENRES.map((g) => {
            const on = staged.genres.includes(g);
            return (
              <button
                key={g}
                onClick={() => setStaged({
                  ...staged,
                  genres: on ? staged.genres.filter((x) => x !== g) : [...staged.genres, g],
                })}
                className={`rounded-lg border px-2 py-1.5 font-mono text-xs font-bold transition ${
                  on
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </Section>

      <button
        onClick={() => onApply(staged)}
        className="sticky bottom-0 w-full rounded-xl bg-white py-3 font-mono text-sm font-black text-black transition hover:bg-white/90"
      >
        Apply Filters
      </button>
    </div>
  );
}
