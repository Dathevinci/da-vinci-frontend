"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, Clock, ListFilter, Library } from "lucide-react";
import ManhwaCard from "@/components/manhwa/ManhwaCard";
import NovelCard from "@/components/novel/NovelCard";
import LoadingScreen, { LoadingDot } from "@/components/ui/LoadingScreen";
import { ExplorePager, PagingModeToggle } from "@/components/media/ExplorePaging";
import {
  parsePageParam,
  scrollExploreToTop,
  sliceLoadedPage,
  totalPagesFrom,
  totalsApproximateFrom,
  usePagingMode,
} from "@/lib/pagingMode";

/**
 * EXPLORE for comics and novels — the same page anime has, which these modes
 * never had: their only browse surface was the home page's "view=all" grid
 * with a filter box bolted onto a header card.
 *
 * Deliberately mirrors src/app/explore/page.tsx: the same sticky control bar,
 * the same floating filter panel with staged changes behind an Apply button,
 * the same heading and count, the same infinite grid. Someone who knows the
 * anime page should not have to learn this one.
 *
 * WHAT DIFFERS, AND WHY IT MUST: anime is backed by AniList, which publishes
 * genre, year, season and format. AsuraScans publishes status and a sort
 * order and nothing else, and the novel sources publish neither — a source
 * list is the only filter they have. So each mode offers exactly what its API
 * honours. A year picker over a scraper that never returns a year is a
 * control that lies.
 *
 * useSearchParams lives here, inside a component the route wraps in Suspense.
 * At page level without a boundary it fails `next build`, and Vercel then
 * keeps serving the last good deploy, so the wrong code looks live.
 */

type Mode = "manhwa" | "novel";

type Filters = { status: string; sort: string; list: string; genre: string };

/**
 * NovelFull's genre pages, slugs VERIFIED against the hrefs their own homepage
 * emits (the plus signs and casing are literal — "/genre/Martial+Arts").
 * `sources.ts` already routes any list starting with "genre/" to NovelFull, so
 * these were reachable end-to-end the whole time; no UI ever offered them.
 * Curated: their explicit categories and the truncated artifacts in their
 * markup ("Martial", "Traged", "Supernatur") are left out.
 */
const NOVEL_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Eastern", "Fantasy", "Game",
  "Gender+Bender", "Harem", "Historical", "Horror", "Isekai", "Josei", "Magic",
  "Magical+Realism", "Martial+Arts", "Mature", "Mecha", "Mystery",
  "Psychological", "Reincarnation", "Romance", "School+Life", "Sci-fi",
  "Seinen", "Shoujo", "Shounen", "Slice+of+Life", "Sports", "Supernatural",
  "System", "Tragedy", "Urban", "Video+Games", "Wuxia", "Xianxia", "Xuanhuan",
].map((slug) => ({ key: "genre/" + slug, label: slug.replace(/\+/g, " ") }));

/**
 * Asura's genre taxonomy is fetched from their API (it drifts with their
 * catalog) and memoised at module level so reopening the panel costs nothing.
 */
let asuraGenreCache: { name: string; slug: string }[] | null = null;

const MANHWA_SORTS = [
  { key: "", label: "Latest" },
  { key: "popular", label: "Most Popular" },
  { key: "rating", label: "Highest Rated" },
  { key: "title", label: "A–Z" },
];

const MANHWA_STATUS = [
  { key: "", label: "Any" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
  { key: "hiatus", label: "Hiatus" },
  { key: "dropped", label: "Dropped" },
];

const NOVEL_LISTS = [
  { key: "most-popular-novel", label: "Most Popular (ReadNovelFull)" },
  { key: "latest-release-novel", label: "Latest Release (ReadNovelFull)" },
  { key: "completed-novel", label: "Completed Novels" },
  { key: "ranobes-rating", label: "Ranobes Top Rated" },
  { key: "wws-trending", label: "WuxiaWorld Trending" },
  { key: "lnw-top", label: "LightNovelWorld Top Rated" },
];

const CFG = {
  manhwa: { path: "/api/manhwa", heading: "Discover Comics", noun: "comics" },
  novel: { path: "/api/novels", heading: "Discover Novels", noun: "novels" },
} as const;

/**
 * How many consecutive all-filtered-out pages to walk before calling it a day.
 *
 * The deep tail of manhwa browse is served by fewer and fewer sources as the
 * smaller catalogues run out, and our own cross-source dedupe can empty what
 * is left, so a barren page has to be skipped rather than obeyed. Four is the
 * compromise: enough to cross the gaps that actually occur (observed runs are
 * one or two pages), few enough that a genuinely exhausted source costs four
 * quiet round-trips before the grid says so.
 */
const EMPTY_RUN_LIMIT = 4;

/** Matches the anime page's grouped block, so both panels read identically. */
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

function Choice({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-left font-mono text-xs font-bold transition ${
        on ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function FiltersPanel({
  mode,
  value,
  anchorRef,
  onApply,
  onClose,
}: {
  mode: Mode;
  value: Filters;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [staged, setStaged] = useState<Filters>(value);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Viewport coordinates for the dropdown form; null = bottom-sheet form. */
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  const [asuraGenres, setAsuraGenres] = useState<{ name: string; slug: string }[]>(asuraGenreCache || []);
  useEffect(() => {
    if (mode !== "manhwa" || asuraGenreCache) return;
    let alive = true;
    fetch("/api/manhwa/genres")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !Array.isArray(d?.genres)) return;
        asuraGenreCache = d.genres;
        setAsuraGenres(d.genres);
      })
      .catch(() => {
        /* no list, no section — better than a section that cannot filter */
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  /**
   * PORTALED TO <body> — the twin of the anime explore panel, same scars.
   * Anchored absolute to the button it hung off a phone screen and sliced
   * every label; rewritten as fixed IN PLACE it pinned itself to the sticky
   * backdrop-blur control bar instead of the viewport, because backdrop-filter
   * establishes a containing block for fixed descendants. A portal is the only
   * placement no ancestor styling can reach.
   */
  useEffect(() => {
    const place = () => {
      if (window.innerWidth < 640) {
        setDropdownPos(null);
        return;
      }
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setDropdownPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // Portaled, so the panel is NOT inside the anchor's subtree — it needs
      // its own inside-check or every tap in it closes it. The toggle button
      // stays an inside too, else mousedown closes and the click reopens,
      // losing every staged change to the remount.
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
      {/* Backdrop, mobile only — the scrim makes tap-to-dismiss discoverable. */}
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
      {mode === "manhwa" ? (
        <>
          <Section Icon={Clock} label="Sort By">
            <div className="flex flex-col">
              {MANHWA_SORTS.map((s) => (
                <Choice key={s.key || "latest"} on={staged.sort === s.key} label={s.label}
                  onClick={() => setStaged({ ...staged, sort: s.key })} />
              ))}
            </div>
          </Section>

          <Section Icon={ListFilter} label="Status">
            <div className="flex flex-col">
              {MANHWA_STATUS.map((s) => (
                <Choice key={s.key || "any"} on={staged.status === s.key} label={s.label}
                  onClick={() => setStaged({ ...staged, status: s.key })} />
              ))}
            </div>
          </Section>

          {/* Only rendered once the taxonomy has arrived — an empty genre
              section is a promise the panel can't keep. */}
          {asuraGenres.length > 0 && (
            <Section Icon={Library} label="Genre">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setStaged({ ...staged, genre: "" })}
                  className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold transition ${
                    staged.genre === ""
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
                  }`}
                >
                  Any
                </button>
                {asuraGenres.map((g) => (
                  <button
                    key={g.slug}
                    onClick={() => setStaged({ ...staged, genre: g.slug })}
                    className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold transition ${
                      staged.genre === g.slug
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <>
          <Section Icon={Library} label="Source List">
            <div className="flex flex-col">
              {NOVEL_LISTS.map((l) => (
                <Choice key={l.key} on={staged.list === l.key} label={l.label}
                  onClick={() => setStaged({ ...staged, list: l.key })} />
              ))}
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-slate-600">
              The novel sources don&rsquo;t publish a status or a sort order, so a list is
              the filter. It applies when you aren&rsquo;t searching.
            </p>
          </Section>

          {/* Genres share the `list` slot with the source lists, so picking one
              naturally deselects the other — a genre IS a list on NovelFull's
              side, which is also why these run on NovelFull specifically. */}
          <Section Icon={ListFilter} label="Genre">
            <div className="grid grid-cols-3 gap-1.5">
              {NOVEL_GENRES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setStaged({ ...staged, list: g.key })}
                  className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold transition ${
                    staged.list === g.key
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-slate-600">
              Genre browsing runs on the NovelFull library.
            </p>
          </Section>
        </>
      )}

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

export default function MediaExplore({ mode }: { mode: Mode }) {
  // Params seed the initial state only; filtering after that is local.
  const sp = useSearchParams();
  const router = useRouter();
  const cfg = CFG[mode];

  const [q, setQ] = useState(sp.get("q") || "");
  const [filters, setFilters] = useState<Filters>({
    status: sp.get("status") || "",
    sort: sp.get("sort") || "",
    list: sp.get("list") || "most-popular-novel",
    genre: sp.get("genre") || "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Shared with the panel's outside-click test — see the note in there.
  const filtersWrapRef = useRef<HTMLDivElement>(null);

  /**
   * Infinite scroll or numbered pages — the reader's own setting, shared with
   * the anime explore and every other tab. `ready` is false until localStorage
   * has been read, which the URL writer below waits for.
   */
  const { mode: paging, setMode: setPaging, ready: pagingReady } = usePagingMode();

  const [items, setItems] = useState<any[]>([]);
  /** The page currently ON SCREEN: the deepest appended, or the one paged to. */
  const [page, setPage] = useState(() => parsePageParam(sp.get("page")));
  const [hasNext, setHasNext] = useState(false);
  /**
   * How many pages this query has, WHEN THE SOURCE SAYS SO — null when it does
   * not, which is most of the time here. Read straight off each response rather
   * than remembered, so it never outlives the answer that produced it.
   */
  const [totalPages, setTotalPages] = useState<number | null>(null);
  // Whether that total is a counted figure or an upper bound (manhwa merges two
  // sources and then filters, so its tail is sparse). Set from the SAME
  // response as totalPages so the two can never describe different payloads.
  const [totalsApprox, setTotalsApprox] = useState(false);
  /** Deepest page reached for this query, so paging back keeps them nameable. */
  const [deepest, setDeepest] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  /** Set only when an append FAILED. Parks the observer until it is cleared. */
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may render. Both sources are scrapes, so a slow
  // earlier reply landing last would otherwise replace newer results.
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  /**
   * The deepest page a request has been ISSUED for — the twice-fire guard.
   *
   * A state flag cannot do this job. `more` only becomes true after React
   * commits the update, and IntersectionObserver callbacks run before that
   * commit, so two callbacks in the same frame both read the old value and both
   * fetch the same page. A ref is written synchronously inside load(), so the
   * second caller sees the claim immediately.
   */
  const requested = useRef(1);
  /**
   * How many pages in a row have come back with nothing usable.
   *
   * Manhwa browse genuinely produces these: the four sources hold catalogues
   * of very different sizes, so past the shallowest ones a page is built from
   * fewer sources and then thinned again by title-dedupe — a full window can
   * survive as zero while real results still sit on the pages after it. An
   * empty page is therefore skipped, not treated as the end. The counter is
   * what stops that skipping from running forever.
   */
  const emptyRun = useRef(0);
  /**
   * Where each appended page's rows START inside `items`, and the running
   * length that feeds it.
   *
   * This is what lets a switch to numbered pages show the page the reader is on
   * WITHOUT asking the scraper for it again — the rows are already here, they
   * just have to be found. Rebuilt from scratch on every fresh (non-append)
   * load, so it can never describe a list that no longer exists.
   */
  const pageStarts = useRef<Map<number, number>>(new Map());
  const loadedCount = useRef(0);
  /** `items` readable outside the render/updater — used by the mode switch. */
  const itemsRef = useRef<any[]>([]);
  /** The page a failed request was for, so "Try again" retries THAT page. */
  const failedPage = useRef(1);
  /** A ?page deep link seeds the FIRST load only; later queries start at 1. */
  const seededPage = useRef(parsePageParam(sp.get("page")));
  /** The last URL written, so infinite scroll doesn't replace() every append. */
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const buildUrl = useCallback((p: number) => {
    const u = new URLSearchParams();
    u.set("page", String(p));
    if (q.trim()) u.set("q", q.trim());
    if (mode === "manhwa") {
      if (filters.status) u.set("status", filters.status);
      if (filters.sort) u.set("sort", filters.sort);
      if (filters.genre) u.set("genre", filters.genre);
    } else if (!q.trim()) {
      // The novel API treats `list` and `q` as mutually exclusive.
      u.set("list", filters.list);
    }
    return `${cfg.path}?${u.toString()}`;
  }, [q, filters, mode, cfg.path]);

  const load = useCallback(async (p: number, append: boolean) => {
    const id = ++seq.current;
    if (append) {
      setMore(true);
      requested.current = Math.max(requested.current, p);
    } else {
      setLoading(true);
      requested.current = p;
      emptyRun.current = 0;
    }
    setError(null);
    try {
      const r = await fetch(buildUrl(p));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (id !== seq.current) return;
      // Both routes answer 200 with `{ error }` when the scrape blew up, so an
      // ok status is not on its own proof of a usable payload.
      if (d?.error) throw new Error(String(d.error));
      const rows: any[] = Array.isArray(d?.results) ? d.results : [];
      emptyRun.current = rows.length > 0 ? 0 : emptyRun.current + 1;
      // Record where this page landed BEFORE the list grows, so a later switch
      // to numbered pages can slice it back out. An empty (skipped) page is not
      // recorded at all — it owns no rows, and pretending otherwise would hand
      // the pager an empty grid.
      if (append) {
        if (rows.length) {
          pageStarts.current.set(p, loadedCount.current);
          loadedCount.current += rows.length;
        }
      } else {
        pageStarts.current = new Map([[p, 0]]);
        loadedCount.current = rows.length;
      }
      // A skipped (empty) page must not hand back a fresh array — that would
      // re-render every card in the grid for nothing.
      setItems((prev) => (append ? (rows.length ? [...prev, ...rows] : prev) : rows));
      setPage(p);
      // ABSENT IS NOT ZERO: `null` here means the source reported no total, and
      // the pager renders a different (honest) shape for it. Never derived,
      // never remembered from an earlier response — only what this one said.
      setTotalPages(totalPagesFrom(d));
      setTotalsApprox(totalsApproximateFrom(d));
      setDeepest((seen) => Math.max(seen, p));
      /**
       * "NO ROWS ON THIS PAGE" IS NOT "NO MORE PAGES" — that conflation is the
       * bug this whole block exists to kill. It used to read
       * `!!d?.hasNextPage && rows.length > 0`, so the first sparse page ended
       * the catalogue: /api/manhwa answered `{ hasNextPage: true, results: [] }`
       * around page 26 while page 40 still had series behind it, and the grid
       * printed "That's everything" on top of a few hundred unshown titles.
       *
       * The source's own hasNextPage is now the only end signal. The empty-run
       * counter is the safety rail: several barren pages in a row means the
       * useful tail really is spent, and we say so rather than paging into the
       * void forever.
       */
      setHasNext(!!d?.hasNextPage && emptyRun.current < EMPTY_RUN_LIMIT);
    } catch (e: any) {
      if (id !== seq.current) return;
      failedPage.current = p;
      if (append) {
        // Hand the page back so Retry — and the observer, once the error is
        // cleared — can ask for it again instead of skipping past it.
        requested.current = Math.max(1, p - 1);
        setError(e?.message ? String(e.message) : "Request failed");
      } else {
        setItems([]);
        setHasNext(false);
        setError(e?.message ? String(e.message) : "Request failed");
      }
    } finally {
      if (id === seq.current) { setLoading(false); setMore(false); }
    }
  }, [buildUrl]);

  useEffect(() => {
    const t = setTimeout(() => {
      // The seeded page is spent on the first load; a changed search or filter
      // is a new result set, and a new result set starts at page 1.
      const first = seededPage.current;
      seededPage.current = 1;
      setDeepest(1);
      load(first, false);
    }, 350);
    return () => clearTimeout(t);
  }, [load]);

  /**
   * Mirror the active search + filters into the URL (replace, so browsing
   * doesn't pile history entries). Params used to seed initial state only,
   * which meant the URL always showed the bare grid: refreshing lost your
   * filters, the URL wasn't shareable, and the readers' Home button — which
   * remembers the last browse URL — returned you to explore with your genre
   * filter wiped. The anime explore page has always done this; this brings
   * the shared manhwa/novel page level with it.
   *
   * `page` joins them ONLY in pages mode. There it is a place the reader chose
   * and can share or refresh back into. In infinite mode it is just how far
   * they have scrolled — writing it would churn the URL on every append and
   * hand out links that drop someone into the middle of a list with the top of
   * it missing. Held until `pagingReady`, so the first render's default mode
   * can't strip a ?page the reader arrived with.
   */
  useEffect(() => {
    if (!pagingReady) return;
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (mode === "manhwa") {
      if (filters.status) u.set("status", filters.status);
      if (filters.sort) u.set("sort", filters.sort);
      if (filters.genre) u.set("genre", filters.genre);
    } else if (filters.list !== "most-popular-novel") {
      u.set("list", filters.list);
    }
    if (paging === "pages" && page > 1) u.set("page", String(page));
    const qs = u.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    // An identical replace() is a navigation the router still processes, and in
    // infinite mode this effect fires on every appended page.
    if (lastUrl.current === next) return;
    lastUrl.current = next;
    router.replace(next, { scroll: false });
  }, [q, filters, mode, router, paging, page, pagingReady]);

  /**
   * INFINITE SCROLL. One observer, one sentinel, torn down on every change of
   * the conditions it depends on and on unmount.
   *
   * `error` is a dependency AND a bail-out, and that pairing matters: without
   * it a failed append re-ran this effect (because `more` flipped back to
   * false), re-observed a sentinel that was STILL inside the root margin, and
   * fired again at once — a hot retry loop against a scraper that can take 12
   * seconds to fail, with nothing on screen to say so. Parking on the error and
   * waiting for Retry is what makes the failure legible instead of frantic.
   *
   * rootMargin is deliberately large. On a phone a grid page is barely two
   * screens tall, so a 600px lead time means the reader hits the bottom and
   * waits; a full viewport-and-a-half of lead means the next page is usually
   * already in the DOM by the time they get there.
   */
  useEffect(() => {
    // PAGES MODE HAS NO OBSERVER AT ALL. The sentinel isn't rendered and this
    // effect refuses to build one, so nothing can keep quietly loading pages
    // underneath a reader who asked for a pager. Hiding the sentinel would have
    // left it intersecting and firing.
    if (paging !== "infinite") return;
    const el = sentinel.current;
    if (!el || !hasNext || loading || more || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const next = page + 1;
        // Already claimed by an in-flight (or just-issued) request.
        if (next <= requested.current) return;
        load(next, true);
      },
      { rootMargin: "1200px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [paging, hasNext, loading, more, error, page, load]);

  /**
   * SWITCHING MODES KEEPS THE READER WHERE THEY ARE.
   *
   * Infinite → pages: the grid collapses to the single page they are standing
   * on, sliced out of the rows already in memory. No request, so nothing is
   * re-fetched and nothing can arrive twice; the pager then opens on that page
   * rather than dumping them back at page 1. Only if that page can't be sliced
   * — it was one of the skipped empty pages, or nothing was recorded — is it
   * fetched.
   *
   * Pages → infinite: nothing happens at all. What is on screen stays on
   * screen, and because `requested` already holds the current page, the
   * observer's first fetch is page+1 — the twice-fire guard does the work.
   *
   * An append caught mid-flight is dropped (bumping `seq` makes its reply stale
   * on arrival) because it is only fetching MORE, which pages mode does not
   * want. `requested` is rolled back with it, or a later switch back to
   * infinite would see the cancelled page as claimed and stall forever. A fresh
   * page-1 load is NOT cancelled — that one is the reader's actual query, and
   * it lands as exactly one page, which is already the right shape.
   */
  const prevPaging = useRef(paging);
  useEffect(() => {
    const from = prevPaging.current;
    if (from === paging) return;
    prevPaging.current = paging;
    if (paging !== "pages") return;
    if (itemsRef.current.length === 0) return;

    if (more) {
      seq.current++;
      setMore(false);
      setError(null);
    } else if (loading) {
      return;
    }
    requested.current = page;

    const slice = sliceLoadedPage(itemsRef.current, pageStarts.current, page);
    if (slice) {
      setItems(slice);
      pageStarts.current = new Map([[page, 0]]);
      loadedCount.current = slice.length;
    } else {
      load(page, false);
    }
    // Instant, not smooth: the content under the reader just shrank by several
    // pages, and animating a scroll through the gap is worse than being there.
    scrollExploreToTop(false);
  }, [paging, page, more, loading, load]);

  const goToPage = useCallback((p: number) => {
    if (p === page || p < 1 || loading || more) return;
    load(p, false);
    scrollExploreToTop();
  }, [page, loading, more, load]);

  const activeCount = mode === "manhwa"
    ? [filters.status, filters.sort, filters.genre].filter(Boolean).length
    : (filters.list !== "most-popular-novel" ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#070709] pb-24 text-white">
      {/* ── control bar ── */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070709]/95 px-4 py-3 backdrop-blur">
        {/* Same wrap as the anime explore bar: the search takes a full row on a
            phone rather than splitting one with the buttons beside it. This
            page has fewer controls than anime, so it was less cramped — but
            "less cramped" is still cramped on a 360px screen. */}
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2.5">
          <div className="relative order-first w-full min-w-0 sm:w-auto sm:flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={mode === "novel" ? "Search for novels..." : "Search for comics..."}
              aria-label="Search"
              /* 16px on mobile so iOS Safari does not zoom the page on focus
                 and leave it that way. sm:text-sm keeps the desktop size. */
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 font-mono text-base text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none sm:text-sm"
            />
          </div>

          <PagingModeToggle mode={paging} onChange={setPaging} />

          <div className="relative shrink-0" ref={filtersWrapRef}>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 font-mono text-xs font-black transition ${
                filtersOpen ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
              }`}
            >
              <Filter className="h-4 w-4" /> Filters
              {activeCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{activeCount}</span>
              )}
            </button>
            {filtersOpen && (
              <FiltersPanel
                mode={mode}
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
        <h1 className="font-mono text-3xl font-black text-white">{cfg.heading}</h1>
        <p className="mt-1.5 font-mono text-sm text-slate-500">
          {loading ? `Searching ${cfg.noun}…` : `${items.length} ${cfg.noun} shown${q.trim() ? ` for “${q.trim()}”` : ""}`}
        </p>

        {/*
          In PAGES mode a page change replaces the grid, and swapping the whole
          screen for a loading panel each time makes the pager feel like it is
          re-entering the site. With rows already up, the outgoing page is dimmed
          in place instead and the pager stays put. The full loading panel is
          still what a first load and infinite scroll get.
        */}
        {loading && (paging === "infinite" || items.length === 0) ? (
          <LoadingScreen fullscreen={false} message={`Searching ${cfg.noun}`} />
        ) : items.length === 0 && error ? (
          /* An empty grid after a FAILED request is not an empty catalogue.
             "Nothing matched that" here blamed the reader's search for a dead
             scraper and offered clearing filters, which fixes nothing. */
          <div className="px-2 py-24 text-center">
            <p className="font-mono text-sm text-rose-300/90">Couldn&rsquo;t reach the {cfg.noun} source.</p>
            <p className="mx-auto mt-1.5 max-w-sm break-words font-mono text-[11px] text-slate-600">{error}</p>
            <button
              /* The page that FAILED, not page 1 — in pages mode the reader was
                 on their way to page 9 and "try again" has to mean that page. */
              onClick={() => load(failedPage.current, false)}
              className="mt-4 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 font-mono text-xs font-black text-white transition hover:bg-white/10"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-sm text-slate-500">Nothing matched that.</p>
            {(q || activeCount > 0) && (
              <button
                onClick={() => { setQ(""); setFilters({ status: "", sort: "", list: "most-popular-novel", genre: "" }); }}
                className="mt-3 font-mono text-xs font-black text-violet-300 hover:text-violet-200"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              aria-busy={loading}
              className={`mt-6 grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${
                loading ? "opacity-40" : ""
              }`}
            >
              {items.map((it, i) =>
                mode === "manhwa"
                  ? <ManhwaCard key={`${it.id}-${i}`} manhwa={it} />
                  : <NovelCard key={`${it.id}-${i}`} novel={it} />
              )}
            </div>

            {paging === "infinite" && (
              <>
                {/* The trip wire sits ABOVE the status strip, so the strip's own
                    height never changes how far the reader must scroll to arm it.
                    In pages mode it is not rendered at all — see the observer. */}
                <div ref={sentinel} aria-hidden className="h-px w-full" />

                {/*
                  ONE STATUS STRIP, ONE FIXED HEIGHT, FOUR STATES.

                  Loading / error / end / idle all render into the same 88px box, so
                  the strip swaps its contents without ever resizing. That is not
                  cosmetic: a row that appears and disappears moves the sentinel in
                  and out of the root margin by its own height, which on a phone is
                  enough to re-trigger the observer and double-fetch.
                */}
                <div
                  aria-live="polite"
                  className="flex min-h-[88px] w-full flex-col items-center justify-center gap-2 px-2 py-6 text-center"
                >
                  {more ? (
                    <p className="flex items-center justify-center gap-3 font-mono text-xs text-slate-500">
                      <LoadingDot /> Loading more {cfg.noun}…
                    </p>
                  ) : error ? (
                    <>
                      <p className="max-w-full break-words font-mono text-xs text-rose-300/90">
                        Couldn&rsquo;t load more {cfg.noun}.
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
                  ) : (
                    <p className="font-mono text-xs text-slate-600">
                      That&rsquo;s everything &mdash; {items.length} {cfg.noun}.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* The pager sits OUTSIDE the grid branches on purpose: a page that came
            back empty or broken still needs a way back to one that didn't. */}
        {paging === "pages" && (items.length > 0 || page > 1) && (
          <ExplorePager
            page={page}
            hasNext={hasNext}
            totalPages={totalPages}
            approximate={totalsApprox}
            deepest={deepest}
            loading={loading}
            failed={!!error}
            onGo={goToPage}
          />
        )}
      </div>
    </div>
  );
}
