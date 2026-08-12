"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, Clock, ListFilter, Library } from "lucide-react";
import ManhwaCard from "@/components/manhwa/ManhwaCard";
import NovelCard from "@/components/novel/NovelCard";
import LoadingScreen, { LoadingDot } from "@/components/ui/LoadingScreen";

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
  { key: "most-popular-novel", label: "Most Popular" },
  { key: "latest-release-novel", label: "Latest Release" },
  { key: "completed-novel", label: "Completed" },
  { key: "lightnovelworld", label: "LightNovelWorld" },
  { key: "lightnovelworld-top", label: "LNW Top Rated" },
];

const CFG = {
  manhwa: { path: "/api/manhwa", heading: "Discover Comics", noun: "comics" },
  novel: { path: "/api/novels", heading: "Discover Novels", noun: "novels" },
} as const;

/**
 * How many consecutive all-filtered-out pages to walk before calling it a day.
 *
 * The deep tail of manhwa browse is MangaDex rows that our own dedupe and stub
 * filters can empty completely, so a barren page has to be skipped rather than
 * obeyed. Four is the compromise: enough to cross the gaps that actually occur
 * (observed runs are one or two pages), few enough that a genuinely exhausted
 * source costs four quiet round-trips before the grid says so.
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

  const [items, setItems] = useState<any[]>([]);
  /** The deepest page that has LANDED. The next request is always this + 1. */
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
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
   * Manhwa browse genuinely produces these: past AsuraScans' 339 series the
   * grid is MangaDex alone, thinned by title-dedupe and the stub filter, so a
   * 24-row window can survive as zero — while real results still sit on the
   * pages after it. An empty page is therefore skipped, not treated as the end.
   * The counter is what stops that skipping from running forever.
   */
  const emptyRun = useRef(0);

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
      // A skipped (empty) page must not hand back a fresh array — that would
      // re-render every card in the grid for nothing.
      setItems((prev) => (append ? (rows.length ? [...prev, ...rows] : prev) : rows));
      setPage(p);
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
    const t = setTimeout(() => load(1, false), 350);
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
   */
  useEffect(() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (mode === "manhwa") {
      if (filters.status) u.set("status", filters.status);
      if (filters.sort) u.set("sort", filters.sort);
      if (filters.genre) u.set("genre", filters.genre);
    } else if (filters.list !== "most-popular-novel") {
      u.set("list", filters.list);
    }
    const qs = u.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
  }, [q, filters, mode, router]);

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
  }, [hasNext, loading, more, error, page, load]);

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

        {loading ? (
          <LoadingScreen fullscreen={false} message={`Searching ${cfg.noun}`} />
        ) : items.length === 0 && error ? (
          /* An empty grid after a FAILED request is not an empty catalogue.
             "Nothing matched that" here blamed the reader's search for a dead
             scraper and offered clearing filters, which fixes nothing. */
          <div className="px-2 py-24 text-center">
            <p className="font-mono text-sm text-rose-300/90">Couldn&rsquo;t reach the {cfg.noun} source.</p>
            <p className="mx-auto mt-1.5 max-w-sm break-words font-mono text-[11px] text-slate-600">{error}</p>
            <button
              onClick={() => load(1, false)}
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
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((it, i) =>
                mode === "manhwa"
                  ? <ManhwaCard key={`${it.id}-${i}`} manhwa={it} />
                  : <NovelCard key={`${it.id}-${i}`} novel={it} />
              )}
            </div>

            {/* The trip wire sits ABOVE the status strip, so the strip's own
                height never changes how far the reader must scroll to arm it. */}
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
      </div>
    </div>
  );
}
