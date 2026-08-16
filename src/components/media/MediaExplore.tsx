"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { lastNavWasPop } from "@/lib/navType";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, Clock, ListFilter, Library } from "lucide-react";
import ManhwaCard from "@/components/manhwa/ManhwaCard";
import NovelCard from "@/components/novel/NovelCard";
import LoadingScreen, { LoadingDot } from "@/components/ui/LoadingScreen";
import { ExplorePager, PagingModeToggle } from "@/components/media/ExplorePaging";
import {
  parsePageParam,
  readPagingMode,
  scrollExploreToTop,
  sliceLoadedPage,
  totalPagesFrom,
  totalsApproximateFrom,
  usePagingMode,
} from "@/lib/pagingMode";

/**
 * The Asura genre list, fetched once per session and shared by every filter
 * panel this module mounts. MODULE-LEVEL ON PURPOSE — the panel unmounts on
 * every close, so component state would refetch on every open.
 *
 * This declaration is load-bearing in a way the build will not tell you about:
 * the panel below reads and assigns `asuraGenreCache`, and with
 * `ignoreBuildErrors: true` a missing declaration still SHIPS — it then throws
 * "asuraGenreCache is not defined" at runtime the moment the Filters button is
 * clicked, taking the whole explore page down to the error screen. That is not
 * hypothetical: a refactor dropped this line once and exactly that happened.
 */
let asuraGenreCache: { name: string; slug: string }[] | null = null;

/**
 * The manhwa filter panel's option lists. LOAD-BEARING in the same invisible
 * way as the cache above: the panel maps over these on open, and with
 * `ignoreBuildErrors: true` a missing declaration still ships and only throws
 * — "MANHWA_SORTS is not defined", the whole explore page down — when the
 * Filters button is clicked. The refactor that lost the cache declaration
 * lost BOTH of these too, and each was found one production crash at a time.
 * Keys must stay what /api/manhwa's filter parsing accepts.
 */
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

const MANHWA_SOURCES = [
  { key: "", label: "All Sources (Unified)" },
  { key: "wbc", label: "WeebCentral (40,000+ Titles)" },
  { key: "asura", label: "AsuraScans" },
  { key: "vtx", label: "VortexScans" },
  { key: "mna", label: "Manganato" },
  { key: "mse", label: "Mangasee" },
];

type Mode = "manhwa" | "novel";

type Filters = { status: string; sort: string; list: string; genre: string; source?: string };

/**
 * NovelFull's genre pages, slugs VERIFIED against the hrefs their own homepage
 * emits (the plus signs and casing are literal — "/genre/Martial+Arts").
 * `sources.ts` already routes any list starting with "genre/" to NovelFull, so
 * these were reachable end-to-end the whole time; no UI ever offered them.
 * Curated: their explicit categories and the truncated artifacts in their
 * markup ("Martial", "Traged", "Supernatur") are left out.
 */
const NOVEL_GENRES = [
  "Action", "Adventure", "Comedy", "Dark Fantasy", "Drama", "Fantasy", "Isekai", "Magic",
  "Martial Arts", "Murim", "Mystery", "Psychological", "Reincarnation", "Romance", "School Life",
  "Sci-Fi", "Slice of Life", "Supernatural", "System", "Urban", "Xianxia", "Xuanhuan"
].map((g) => ({ key: g.toLowerCase(), label: g }));

const NOVEL_SORTS = [
  { key: "", label: "Most Popular" },
  { key: "rating", label: "Highest Rated" },
  { key: "latest", label: "Latest Chapters" },
  { key: "title", label: "A–Z" },
];

const NOVEL_STATUS = [
  { key: "", label: "Any" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
];

const NOVEL_LISTS = [
  { key: "", label: "All Masterpieces" },
  { key: "light-novels", label: "Official Japanese Light Novels" },
  { key: "korean-masterpieces", label: "Global & Korean Masterpieces" },
  { key: "chinese-xianxia", label: "Chinese Xianxia & Immortals" },
  { key: "completed-novel", label: "Completed Classics" },
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
          <Section Icon={Library} label="Source">
            <div className="flex flex-col">
              {MANHWA_SOURCES.map((s) => (
                <Choice key={s.key || "all"} on={(staged.source || "") === s.key} label={s.label}
                  onClick={() => setStaged({ ...staged, source: s.key })} />
              ))}
            </div>
          </Section>

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
          <Section Icon={Clock} label="Sort By">
            <div className="flex flex-col">
              {NOVEL_SORTS.map((s) => (
                <Choice key={s.key || "popular"} on={staged.sort === s.key} label={s.label}
                  onClick={() => setStaged({ ...staged, sort: s.key })} />
              ))}
            </div>
          </Section>

          <Section Icon={ListFilter} label="Status">
            <div className="flex flex-col">
              {NOVEL_STATUS.map((s) => (
                <Choice key={s.key || "any"} on={staged.status === s.key} label={s.label}
                  onClick={() => setStaged({ ...staged, status: s.key })} />
              ))}
            </div>
          </Section>

          <Section Icon={Library} label="Source Shelf">
            <div className="flex flex-col">
              {NOVEL_LISTS.map((l) => (
                <Choice key={l.key || "all"} on={staged.list === l.key} label={l.label}
                  onClick={() => setStaged({ ...staged, list: l.key })} />
              ))}
            </div>
          </Section>

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
              {NOVEL_GENRES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setStaged({ ...staged, genre: staged.genre === g.key ? "" : g.key })}
                  className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold transition ${
                    staged.genre === g.key
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
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
    list: sp.get("list") || "",
    genre: sp.get("genre") || "",
    source: sp.get("source") || "",
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
  const requested = useRef(1);
  const emptyRun = useRef(0);
  const pageStarts = useRef<Map<number, number>>(new Map());
  const loadedCount = useRef(0);
  const itemsRef = useRef<any[]>([]);
  const failedPage = useRef(1);
  const seededPage = useRef(parsePageParam(sp.get("page")));
  const lastUrl = useRef<string | null>(null);
  /**
   * The query that PRODUCED the items on screen — recorded by load() when a
   * result lands, not read from live state. Between a keystroke and its
   * debounced fetch the live q/filters describe the NEXT result set while
   * items still hold the previous one; a snapshot labeled from live state in
   * that window pairs the new query with the old grid, and if the new query
   * then returns nothing (items empty, writer bails) the mislabeled entry
   * survives the session and a back-nav restores the wrong grid under the
   * new heading. Labeling from what was actually served makes every snapshot
   * self-consistent by construction.
   */
  const servedQuery = useRef<{ q: string; filters: Filters }>({
    q: (sp.get("q") || "").trim(),
    filters: {
      status: sp.get("status") || "",
      sort: sp.get("sort") || "",
      list: sp.get("list") || "",
      genre: sp.get("genre") || "",
      source: sp.get("source") || "",
    },
  });
  /** Latched when a snapshot write fails or outgrows the cap, so every later
   *  append doesn't re-pay a doomed multi-hundred-KB stringify; a fresh
   *  (smaller) result set un-latches it in load(). */
  const snapshotDead = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  /**
   * THE X MUST RETURN YOU TO THE GRID YOU LEFT. Opening a title from this
   * page and pressing its close button is a history back — and this component
   * held everything in memory, so the return remounted it empty: loader,
   * refetch, position gone. The home feeds already solved this (swrRawJson +
   * pre-paint restore); this is the same move for a page whose state is too
   * entangled for the generic cache — the accumulated pages, the paging
   * bookkeeping refs and the flags all have to come back TOGETHER or the
   * infinite-scroll observer resumes from a lie.
   *
   * Restored in a LAYOUT effect so the grid exists before first paint: that
   * is also what lets the browser's own popstate scroll restoration succeed —
   * it needs the page to already be tall enough when it fires. A plain
   * effect runs after paint and produces a loader flash plus a landing at the
   * top, which is precisely the report this fixes.
   *
   * THE SNAPSHOT ONLY ANSWERS RETURNS. A mount can be a history traversal
   * (the X, the back button) or a fresh push (a nav link, a typed URL), and
   * only popstate tells them apart — restoring on pushes froze the grid for a
   * whole session (every visit resurrected the snapshot and skipped the fetch
   * that would have shown new releases) and let a bare nav-link land a
   * pages-mode reader on the mid-catalog page they left hours ago. An
   * arrival loads fresh; only a return restores.
   *
   * THE URL STAYS AUTHORITATIVE. The snapshot only speaks when it answers the
   * same query the URL asks for (q, all four filter keys, and — for a
   * snapshot written in pages mode — the page itself, whether or not the URL
   * carries one) — a shared or hand-edited link must never show another
   * session's grid. `list` is compared through a normaliser because two
   * spellings of the novel default coexist historically ("" and the legacy
   * "most-popular-novel").
   */
  const exploreCacheKey = `dv-explore-${mode}`;
  const restored = useRef(false);
  useLayoutEffect(() => {
    try {
      // "Last navigation was a traversal" — not a freshness window, which
      // review showed leaks in both directions (a push right after a pop
      // inherited return-treatment; a slow traversal commit lost it).
      if (!lastNavWasPop()) return;
      const raw = sessionStorage.getItem(exploreCacheKey);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (!c || !Array.isArray(c.items) || c.items.length === 0 || !c.filters) return;
      // The reader may have flipped the shared paging preference on another
      // surface since this snapshot was written. Restoring across that flip
      // paints one mode's data under the other mode's chrome — an infinite
      // accumulation under a pager was the confirmed case — and the phantom
      // slice that used to (accidentally) clean it up is gone. The stored
      // preference is readable synchronously here; the snapshot must match
      // it, and a snapshot that never recorded its mode (pre-deploy format)
      // is unknown, not "infinite" — refusing it costs one cold reload,
      // which is the stated worst case anyway.
      if (c.paging !== readPagingMode()) return;
      const seedFilters: Filters = {
        status: sp.get("status") || "",
        sort: sp.get("sort") || "",
        list: sp.get("list") || "",
        genre: sp.get("genre") || "",
        source: sp.get("source") || "",
      };
      const normList = (v: string) => (v === "most-popular-novel" ? "" : v || "");
      if ((c.q || "") !== (sp.get("q") || "")) return;
      if (
        (["status", "sort", "genre", "source"] as const).some((k) => (c.filters[k] || "") !== seedFilters[k]) ||
        normList(c.filters.list) !== normList(seedFilters.list)
      ) return;
      if (sp.get("page") && parsePageParam(sp.get("page")) !== (Number(c.page) || 1)) return;
      if (c.paging === "pages" && parsePageParam(sp.get("page")) !== (Number(c.page) || 1)) return;

      restored.current = true;
      servedQuery.current = { q: c.q || "", filters: { ...c.filters } };
      itemsRef.current = c.items;
      pageStarts.current = new Map(Array.isArray(c.pageStarts) ? c.pageStarts : []);
      loadedCount.current = Number(c.loadedCount) || c.items.length;
      requested.current = Number(c.requested) || Number(c.page) || 1;
      setItems(c.items);
      setPage(Number(c.page) || 1);
      setDeepest(Number(c.deepest) || Number(c.page) || 1);
      setHasNext(!!c.hasNext);
      setTotalPages(typeof c.totalPages === "number" ? c.totalPages : null);
      setTotalsApprox(!!c.totalsApprox);
      setLoading(false);
    } catch {
      /* snapshot is best-effort — worst case is the old cold reload */
    }
    // Mount-only by design: the snapshot seeds the instance once; everything
    // after that is the component's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The snapshot is written whenever a settled result set changes — never
   * mid-load or mid-append (an in-flight append has already bumped
   * `requested` past `page`, and persisting that pair permanently stalls the
   * restored observer behind its own guard), never empty (a zero-hit search
   * must not erase the browsable grid it replaced), and never before
   * `pagingReady` (the paging field would record the hook's default, not the
   * reader's mode). Labels come from servedQuery — see its declaration — so
   * the debounce window between a keystroke and its fetch cannot mislabel
   * the previous grid. A size cap plus the dead-latch keeps a very deep
   * session from paying a doomed multi-MB stringify on every append.
   */
  useEffect(() => {
    if (!pagingReady || loading || more || items.length === 0) return;
    if (snapshotDead.current) return;
    try {
      const body = JSON.stringify({
        q: servedQuery.current.q,
        filters: servedQuery.current.filters,
        paging,
        page, deepest, hasNext, totalPages, totalsApprox, items,
        pageStarts: Array.from(pageStarts.current.entries()),
        loadedCount: loadedCount.current,
        requested: requested.current,
      });
      if (body.length > 2_500_000) {
        snapshotDead.current = true;
        return;
      }
      sessionStorage.setItem(exploreCacheKey, body);
    } catch {
      /* quota or privacy mode — explore just reloads cold next time */
      snapshotDead.current = true;
    }
  }, [items, page, deepest, hasNext, totalPages, totalsApprox, loading, more, paging, pagingReady, exploreCacheKey]);

  const buildUrl = useCallback((p: number) => {
    const u = new URLSearchParams();
    u.set("page", String(p));
    if (q.trim()) u.set("q", q.trim());
    if (filters.status) u.set("status", filters.status);
    if (filters.sort) u.set("sort", filters.sort);
    if (filters.genre) u.set("genre", filters.genre);
    if (filters.list) u.set("list", filters.list);
    if (filters.source) u.set("source", filters.source);
    return `${cfg.path}?${u.toString()}`;
  }, [q, filters, cfg.path]);

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
      // This closure's q/filters are the ones buildUrl sent — record them as
      // the query the on-screen items now answer (see servedQuery).
      servedQuery.current = { q: q.trim(), filters: { ...filters } };
      if (!append) snapshotDead.current = false;
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
    // A pre-paint restore already put the full accumulated result set on
    // screen; the initial fetch would replace those pages with just one.
    // Consumed here — not in the restorer — so exactly the first run skips,
    // and a LATER search or filter change (new `load` identity) fetches
    // normally.
    if (restored.current) {
      restored.current = false;
      seededPage.current = 1;
      return;
    }
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
    // ALL four filter keys are mirrored for BOTH modes. The novel branch used
    // to write only `list`, though its panel offers status/sort/genre too —
    // so those filters vanished from the URL, a refresh or back-nav silently
    // dropped them, and the explore snapshot (which trusts the URL) could
    // never restore a filtered novel grid. "most-popular-novel" is the legacy
    // spelling of the novel default ("" everywhere now) and stays out of the
    // URL like any other default.
    if (filters.status) u.set("status", filters.status);
    if (filters.sort) u.set("sort", filters.sort);
    if (filters.genre) u.set("genre", filters.genre);
    if (filters.source) u.set("source", filters.source);
    if (mode === "novel" && filters.list && filters.list !== "most-popular-novel") {
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
    // Held until pagingReady as well: before the stored preference is read
    // the hook reports its "infinite" default, and a restored grid (loading
    // already false, sentinel possibly in range) would let this attach an
    // observer for a reader who actually asked for numbered pages.
    if (!pagingReady || paging !== "infinite") return;
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
  }, [pagingReady, paging, hasNext, loading, more, error, page, load]);

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
  /**
   * `null` until pagingReady, then baselined to the FIRST ready value: the
   * hook mounts on its "infinite" default and reports the stored preference
   * one commit later, so a pages-mode reader produces a phantom
   * infinite→pages "toggle" on every mount. That was harmless while the grid
   * was guaranteed empty at that moment — the pre-paint snapshot restore
   * broke the guarantee, and the phantom flip re-sliced the restored grid
   * and scrolled a reader who had just been put back mid-catalog straight to
   * the top. Only a change AFTER the baseline is a reader actually toggling.
   */
  const prevPaging = useRef<typeof paging | null>(null);
  useEffect(() => {
    if (!pagingReady) return;
    const from = prevPaging.current;
    if (from === paging) return;
    prevPaging.current = paging;
    if (from === null) return;
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
  }, [pagingReady, paging, page, more, loading, load]);

  const goToPage = useCallback((p: number) => {
    if (p === page || p < 1 || loading || more) return;
    load(p, false);
    scrollExploreToTop();
  }, [page, loading, more, load]);

  // Both modes count their real filters. The old novel arm compared `list`
  // against the legacy default "most-popular-novel" while the seeds default
  // to "" — so the novel Filters badge showed "1" on a pristine page — and
  // ignored status/sort/genre, which the novel panel offers.
  const activeCount =
    [filters.status, filters.sort, filters.genre, filters.source].filter(Boolean).length +
    (mode === "novel" && filters.list && filters.list !== "most-popular-novel" ? 1 : 0);

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
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                setDeepest(1);
                seededPage.current = 1;
              }}
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
                onApply={(f) => {
                  setFilters(f);
                  setPage(1);
                  setDeepest(1);
                  seededPage.current = 1;
                  setFiltersOpen(false);
                }}
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
                onClick={() => {
                  setQ("");
                  setFilters({ status: "", sort: "", list: "", genre: "", source: "" });
                  setPage(1);
                  setDeepest(1);
                  seededPage.current = 1;
                }}
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
