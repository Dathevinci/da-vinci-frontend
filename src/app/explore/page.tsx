"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Filter, EyeOff, Eye, Star, Loader2,
  Clock, Calendar, Tag,
} from "lucide-react";
import { searchAnime } from "@/lib/jikan";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import HoverPreview from "@/components/anime/HoverPreview";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { ExplorePager, PagingModeToggle } from "@/components/media/ExplorePaging";
import {
  parsePageParam,
  scrollExploreToTop,
  sliceLoadedPage,
  usePagingMode,
} from "@/lib/pagingMode";
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

/**
 * ANILIST CLAMPS ITS OWN TOTALS, so its lastPage is only sometimes a fact.
 *
 * Verified live: a BROAD query (the unfiltered browse) hits the ceiling and
 * reports `total: 5000 / lastPage: 250` — that is "at least 5000", not a count.
 * NARROW queries are genuinely exact, measured the same day: search "frieren"
 * came back total 6 / lastPage 1, and WINTER 2024 + Mecha came back total 4.
 * So the clamp is a property of the QUERY, not of AniList generally — which is
 * why the test below is a runtime one against the value rather than a blanket
 * refusal to trust it. At the clamp we report NO total and the pager counts
 * only what it can prove; below it the number is real and gets used as one.
 */
const ANILIST_TOTAL_CLAMP = 5000;

function anilistTotalPages(info: any): number | null {
  const last = Number(info?.lastPage);
  const total = Number(info?.total);
  if (!Number.isFinite(last) || last < 1) return null;
  if (!Number.isFinite(total) || total < 1) return null;
  if (total >= ANILIST_TOTAL_CLAMP) return null;
  return Math.floor(last);
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading discover" />}>
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
  /**
   * Infinite scroll or numbered pages. This used to be page-local state behind
   * an ∞ icon; it is now the shared reader preference, so choosing pages here
   * chooses pages on the comics and novels explore too, and a surface already
   * open in another tab follows along without a reload.
   */
  const { mode: paging, setMode: setPaging, ready: pagingReady } = usePagingMode();
  const infinite = paging === "infinite";
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Shared with the panel's outside-click test — the Filters button must
  // count as inside, or its mousedown closes the panel and the click
  // reopens it and staged edits are lost to the remount.
  const filtersWrapRef = useRef<HTMLDivElement>(null);

  const [media, setMedia] = useState<Anime[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(() => parsePageParam(sp.get("page")));
  /** AniList's lastPage when it is a real count, null at the clamp. */
  const [totalPages, setTotalPages] = useState<number | null>(null);
  /** Deepest page reached for this query, so paging back keeps them nameable. */
  const [deepest, setDeepest] = useState(1);
  const [loading, setLoading] = useState(true);
  /** Set only when a load FAILED. Parks infinite scroll until Retry clears it. */
  const [error, setError] = useState<string | null>(null);
  // Requests SUPERSEDE, never drop: each load takes a fresh sequence
  // number and a stale response throws itself away. The old busy-flag
  // version silently discarded a new search typed during an infinite-
  // scroll append, leaving the grid showing the previous query forever.
  const seqRef = useRef(0);
  const inFlightRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  /**
   * The deepest page a request has been ISSUED for.
   *
   * `inFlightRef` alone answers "is something running", which is not the same
   * question as "has page N already been asked for". Two observer callbacks in
   * one frame, or a re-observe immediately after an append lands, could both
   * pass the in-flight test for the SAME page. This ref is claimed
   * synchronously, so the second caller sees it and stands down.
   */
  const requestedRef = useRef(1);
  /** Consecutive pages that arrived with nothing to show. */
  const emptyRunRef = useRef(0);
  /**
   * Whether the request in flight is an APPEND.
   *
   * `inFlightRef` says something is running; this says what kind. Switching to
   * numbered pages may discard an append (it only fetches more, which pages
   * mode does not want) but must never discard a fresh query the reader just
   * typed.
   */
  const appendInFlightRef = useRef(false);
  /**
   * Where each appended page's rows START inside `media`, so switching to pages
   * can lift the current page back out without asking AniList for it again.
   */
  const pageStartsRef = useRef<Map<number, number>>(new Map());
  const loadedCountRef = useRef(0);
  /** `media` readable outside render — used by the mode switch. */
  const mediaRef = useRef<Anime[]>([]);
  /** The page a failed request was for, so "Try again" retries THAT page. */
  const failedPageRef = useRef(1);
  /** A ?page deep link seeds the FIRST load only; later queries start at 1. */
  const seededPageRef = useRef(parsePageParam(sp.get("page")));
  /** The last URL written, so infinite scroll doesn't replace() every append. */
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

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
    appendInFlightRef.current = append;
    if (append) requestedRef.current = Math.max(requestedRef.current, p);
    else { requestedRef.current = p; emptyRunRef.current = 0; }
    setError(null);
    setLoading(true);
    try {
      const res: any = await searchAnime(buildVars(p));
      if (seqRef.current !== seq) return; // a newer request took over
      /**
       * `failed` MEANS THE REQUEST DIED, NOT THAT THE LIST ENDED.
       *
       * searchAnime swallows its own failures and returns an empty page whose
       * pageInfo reads `hasNextPage: false` — byte-identical to reaching the
       * final page. Infinite scroll obeyed that and retired itself, silently
       * and permanently, so a single AniList 429 (they allow 30 requests per
       * minute, which continuous scrolling reaches in the mid-twenties) looked
       * exactly like "that's the whole catalogue".
       */
      if (res?.failed) throw new Error("Anime sources are not responding");
      const list: Anime[] = res?.Page?.media || [];
      const info = res?.Page?.pageInfo || { total: 0, hasNextPage: false };
      emptyRunRef.current = list.length > 0 ? 0 : emptyRunRef.current + 1;
      // Where this page's rows begin, recorded before the list grows, so a
      // switch to numbered pages can show page p alone without re-fetching it.
      // Empty (skipped) pages own no rows and so are never recorded.
      if (append) {
        if (list.length) {
          pageStartsRef.current.set(p, loadedCountRef.current);
          loadedCountRef.current += list.length;
        }
      } else {
        pageStartsRef.current = new Map([[p, 0]]);
        loadedCountRef.current = list.length;
      }
      setMedia((m) => (append ? (list.length ? [...m, ...list] : m) : list));
      setTotal(info.total || 0);
      setTotalPages(anilistTotalPages(info));
      setDeepest((seen) => Math.max(seen, p));
      /**
       * AniList CLAMPS pageInfo.total TO 5000 (verified live: every sort and
       * filter reports total 5000 / lastPage 250), so hasNextPage stays true
       * past the real end of a filtered result set and the pages just come back
       * empty. Two barren pages in a row is the honest end marker — AniList's
       * paging is dense, and the only thinning we do downstream is the safety
       * filter, which never empties a whole page twice running.
       */
      setHasNext(!!info.hasNextPage && emptyRunRef.current < 2);
      setPage(p);
    } catch (e: any) {
      if (seqRef.current !== seq) return;
      const msg = e?.message ? String(e.message) : "Request failed";
      failedPageRef.current = p;
      if (append) {
        // Give the page back so Retry can ask for it again.
        requestedRef.current = Math.max(1, p - 1);
      } else {
        setMedia([]); setTotal(0); setHasNext(false);
      }
      setError(msg);
    } finally {
      if (seqRef.current === seq) {
        inFlightRef.current = false;
        appendInFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  // Debounced search + filters → a fresh result set, which always starts at
  // page 1. The URL used to be written from in here as well; it now has its own
  // effect below, because the page number belongs in it too and this one must
  // NOT re-run when the page changes — it would fight the pager for control.
  useEffect(() => {
    const t = setTimeout(() => {
      // A ?page deep link seeds the first load only.
      const first = seededPageRef.current;
      seededPageRef.current = 1;
      setDeepest(1);
      load(first, false);
    }, q ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters]);

  /**
   * The URL mirrors the query so it survives a refresh or a share.
   *
   * `page` joins it ONLY in pages mode — there it is a place the reader chose;
   * in infinite mode it is just how far they have scrolled, and writing it
   * would rewrite the URL on every appended page and hand out links that start
   * someone mid-list with the top missing. Held until the paging preference has
   * actually been read, so the first render's default can't strip a ?page the
   * reader arrived with.
   */
  useEffect(() => {
    if (!pagingReady) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filters.sort !== "popularity") params.set("sort", filters.sort);
    if (filters.year) params.set("year", String(filters.year));
    if (filters.season) params.set("season", filters.season);
    if (filters.genres.length) params.set("genre", filters.genres.join(","));
    if (filters.status) params.set("status", filters.status);
    if (filters.format) params.set("format", filters.format);
    if (sp.get("title")) params.set("title", sp.get("title")!);
    if (paging === "pages" && page > 1) params.set("page", String(page));
    const qs = params.toString();
    const next = qs ? `/explore?${qs}` : "/explore";
    // An identical replace() is still a navigation the router processes.
    if (lastUrlRef.current === next) return;
    lastUrlRef.current = next;
    router.replace(next, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters, page, paging, pagingReady]);

  /**
   * INFINITE SCROLL — one observer, disconnected on every re-arm and on unmount.
   *
   * `error` had to become both a dependency and a bail-out. Without it a thrown
   * append changed NOTHING this effect watches — same page, same media.length,
   * same hasNext — so the effect never re-ran, and the observer it left behind
   * was watching a sentinel that was already intersecting. IntersectionObserver
   * only fires on a threshold CROSSING, and that crossing had already happened,
   * so the callback could never fire again: scrolling was dead from that moment
   * on, with nothing on screen to say why. Now the failure re-arms the effect,
   * the effect declines to auto-fire, and the reader gets a Retry button.
   *
   * rootMargin is a viewport-and-a-half rather than 600px so a phone, where a
   * grid page is about two screens tall, starts the next fetch well before the
   * reader arrives at the bottom.
   */
  useEffect(() => {
    // In pages mode there is no observer AND no sentinel in the tree, so
    // nothing can keep loading in the background behind the pager. Merely
    // hiding the sentinel would have left it intersecting and firing.
    if (!infinite || !hasNext || error) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (inFlightRef.current) return;
      const next = page + 1;
      if (next <= requestedRef.current) return; // already claimed
      load(next, true);
    }, { rootMargin: "1200px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infinite, hasNext, error, page, media.length]);

  /**
   * SWITCHING MODES KEEPS THE READER WHERE THEY ARE.
   *
   * Infinite → pages: the grid collapses to the one page they are standing on,
   * sliced out of the rows already in memory — no request, so nothing is
   * re-fetched and nothing can arrive twice — and the pager opens on that page
   * instead of dropping them back at page 1. Only a page that cannot be sliced
   * (one of the skipped empty ones, or nothing recorded yet) is fetched.
   *
   * Pages → infinite: nothing happens. What is on screen stays, and since
   * `requestedRef` already holds the current page, the observer's first fetch
   * is page+1 — the existing twice-fire guard does the work.
   *
   * An append caught in flight is discarded (bumping the sequence makes its
   * reply stale on arrival) since it only fetches MORE; `requestedRef` is
   * rolled back with it, or switching back to infinite would treat the
   * cancelled page as claimed and never scroll again. A fresh, non-append load
   * is left alone — that one is the reader's query, and it lands as exactly one
   * page, which is already the shape pages mode wants.
   */
  const prevPagingRef = useRef(paging);
  useEffect(() => {
    const from = prevPagingRef.current;
    if (from === paging) return;
    prevPagingRef.current = paging;
    if (paging !== "pages") return;
    if (mediaRef.current.length === 0) return;

    if (inFlightRef.current) {
      if (!appendInFlightRef.current) return;
      seqRef.current++;
      inFlightRef.current = false;
      appendInFlightRef.current = false;
      setLoading(false);
      setError(null);
    }
    requestedRef.current = page;

    const slice = sliceLoadedPage(mediaRef.current, pageStartsRef.current, page);
    if (slice) {
      setMedia(slice);
      pageStartsRef.current = new Map([[page, 0]]);
      loadedCountRef.current = slice.length;
    } else {
      load(page, false);
    }
    // Instant, not smooth: several pages of content just left the document, and
    // animating a scroll through the hole they leave is worse than being there.
    scrollExploreToTop(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paging, page]);

  const goToPage = (p: number) => {
    if (p === page || p < 1 || inFlightRef.current) return;
    load(p, false);
    scrollExploreToTop();
  };

  // The library already strips outright adult content; the veil here
  // additionally hides the suggestive tier until deliberately lifted.
  const shownMedia = nsfw ? media : media.filter((a) => !a.genres?.some((g) => g.name === "Ecchi"));

  return (
    <div className="min-h-screen bg-[#070709] pb-24 text-white">
      {/* ── control bar ── */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070709] px-4 py-3">
        {/* WRAPS ON A PHONE. Four things shared one row — the input and three
            shrink-0 buttons — so the buttons took their full width and the
            search got whatever was left, which on a narrow screen was a sliver
            barely wide enough for a word.
            The input now claims a whole row of its own and the buttons wrap
            underneath; from sm up it goes back to the single row it was. */}
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2.5">
          <div className="relative order-first w-full min-w-0 sm:w-auto sm:flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for anime..."
              /* 16px on mobile, not 14. Safari on iOS ZOOMS THE PAGE when a
                 focused input is under 16px, and it does not zoom back out —
                 so tapping search left the whole page enlarged and scrolled
                 sideways. sm:text-sm keeps the tighter desktop size. */
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 font-mono text-base text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none sm:text-sm"
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

          {/* Was a bare ∞ button whose meaning lived in a tooltip — invisible on
              every touch device. Both choices are now written out. */}
          <PagingModeToggle mode={paging} onChange={setPaging} />

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
        ) : media.length === 0 && error ? (
          /* A dead source is not an empty result set. Telling someone to
             "try different filters" when AniList and Kitsu are both refusing
             sends them rearranging controls that cannot possibly help. */
          <div className="px-2 py-24 text-center">
            <p className="font-mono text-sm text-rose-300/90">Couldn&rsquo;t reach the anime sources.</p>
            <p className="mx-auto mt-1.5 max-w-sm break-words font-mono text-[11px] text-slate-600">{error}</p>
            <button
              /* The page that FAILED, not page 1 — in pages mode the reader was
                 on their way to page 9 and "try again" has to mean that page. */
              onClick={() => load(failedPageRef.current, false)}
              className="mt-4 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 font-mono text-xs font-black text-white transition hover:bg-white/10"
            >
              Try again
            </button>
          </div>
        ) : shownMedia.length === 0 ? (
          <div className="py-24 text-center font-mono text-sm text-slate-500">
            Nothing found — try different filters.
          </div>
        ) : (
          /* In pages mode the outgoing page dims in place while the next one
             loads, so the pager below never jumps out from under the tap that
             just used it. Infinite scroll never dims — it appends. */
          <div
            aria-busy={loading}
            className={`mt-7 grid grid-cols-2 gap-x-5 gap-y-8 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${
              !infinite && loading ? "opacity-40" : ""
            }`}
          >
            {shownMedia.map((a, i) => (
              <HoverPreview key={`${a.mal_id}-${i}`} anime={a}>
              <button
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
              </HoverPreview>
            ))}
          </div>
        )}

        {/*
          ── more: sentinel when infinite, a numbered pager when not ──

          ONE LOADER PER PAGE, chosen by the segmented control in the bar, and
          they are never both live: the sentinel exists only while infinite is
          on, the pager only while it is off. That was already the design and it
          stays, because the toggle is the reader's own answer to "which one do
          I want" — a pager underneath a live sentinel would race it for the
          same page.

          The infinite branch used to be a bare div that showed a spinner and
          nothing else: no end state, no error state. Reaching the last page
          looked identical to the page being broken.

          The pager replaces a Prev / "Page 7" / Next trio that could never say
          how far the list went, even for AniList, which reports it.
        */}
        {infinite ? (
          <>
            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            {/* Fixed-height strip: swapping between these four states must not
                resize the box, or the sentinel shifts by the strip's own height
                and can re-cross the root margin into a duplicate fetch. */}
            <div
              aria-live="polite"
              className="flex min-h-[88px] w-full flex-col items-center justify-center gap-2 px-2 py-6 text-center"
            >
              {loading && media.length > 0 ? (
                <p className="flex items-center justify-center gap-2.5 font-mono text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading more anime…
                </p>
              ) : error && media.length > 0 ? (
                <>
                  <p className="max-w-full break-words font-mono text-xs text-rose-300/90">
                    Couldn&rsquo;t load more anime.
                  </p>
                  <button
                    onClick={() => load(page + 1, true)}
                    className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 font-mono text-xs font-black text-white transition hover:bg-white/10"
                  >
                    Try again
                  </button>
                </>
              ) : hasNext ? (
                <p className="font-mono text-xs text-slate-700">Scroll for more</p>
              ) : media.length > 0 ? (
                <p className="font-mono text-xs text-slate-600">
                  That&rsquo;s everything &mdash; {shownMedia.length} anime.
                </p>
              ) : null}
            </div>
          </>
        ) : (media.length > 0 || page > 1) ? (
          /* Rendered even when the grid came back empty or broken — a page the
             reader cannot navigate away from is a dead end. */
          <ExplorePager
            page={page}
            hasNext={hasNext}
            totalPages={totalPages}
            deepest={deepest}
            loading={loading}
            failed={!!error}
            onGo={goToPage}
          />
        ) : null}
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Viewport coordinates for the dropdown form; null = bottom-sheet form. */
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  /**
   * PORTALED TO <body>, POSITIONED FROM THE ANCHOR'S RECT.
   *
   * Two failed generations taught this panel its shape. Anchored absolute to
   * the Filters button, it hung leftward off a phone screen and sliced the
   * first characters from every label. Rewritten as position:fixed IN PLACE it
   * broke differently: the control bar it lives in is sticky with
   * backdrop-blur, and a backdrop-filter establishes a containing block — so
   * "fixed" pinned the sheet to the blurred BAR, not the viewport, and it
   * rendered as a broken band scrolling with the page.
   *
   * In a portal, no ancestor styling can reach it. From sm up it is placed at
   * the button's rect (recomputed on scroll and resize); below sm it is a
   * bottom sheet with a backdrop.
   */
  useEffect(() => {
    const place = () => {
      if (window.innerWidth < 640) {
        setDropdownPos(null);
        return;
      }
      const r = anchorRef.current?.getBoundingClientRect();
      // Bail on unchanged positions: scroll fires this per event (capture
      // catches the panel's own inner scroller too), and a fresh {top,right}
      // object every time re-rendered the whole multi-section panel even when
      // the bar hadn't moved a pixel.
      if (r) {
        const top = r.bottom + 8;
        const right = Math.max(8, window.innerWidth - r.right);
        setDropdownPos((prev) => (prev && prev.top === top && prev.right === right ? prev : { top, right }));
      }
    };
    // rAF-coalesced (HoverPreview's cancel/schedule pattern) so a scroll burst
    // costs one layout read per frame. The first call stays synchronous —
    // dropdownPos starts null, and a deferred initial placement would flash
    // the desktop panel as a bottom sheet for a frame.
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // The panel is portaled, so it is NOT inside the anchor's DOM subtree —
      // it needs its own inside-check or every tap in it closes it.
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, anchorRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop, mobile only: on a phone the sheet covers the page anyway,
          and a visible scrim makes "tap outside to dismiss" discoverable. */}
      <div className="fixed inset-0 z-[95] bg-black/60 sm:hidden" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        style={dropdownPos ? { top: dropdownPos.top, right: dropdownPos.right } : undefined}
        className={
          dropdownPos
            ? "fixed z-[96] flex max-h-[min(70vh,640px)] w-[360px] flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b0b11] p-3 shadow-2xl"
            : "fixed inset-x-3 bottom-3 z-[96] flex max-h-[72vh] flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b0b11] p-3 shadow-2xl"
        }
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
    </>,
    document.body
  );
}
