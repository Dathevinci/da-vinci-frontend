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
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  // Only the newest request may render. Both sources are scrapes, so a slow
  // earlier reply landing last would otherwise replace newer results.
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

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
    if (append) setMore(true); else setLoading(true);
    try {
      const r = await fetch(buildUrl(p));
      const d = await r.json();
      if (id !== seq.current) return;
      const rows = d?.results || [];
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setHasNext(!!d?.hasNextPage && rows.length > 0);
      setPage(p);
    } catch {
      if (id === seq.current && !append) setItems([]);
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

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNext || loading || more) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) load(page + 1, true);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, loading, more, page, load]);

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
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-sm text-slate-500">Nothing matched that.</p>
            {(q || activeCount > 0) && (
              <button
                onClick={() => { setQ(""); setFilters({ status: "", sort: "", list: "most-popular-novel" }); }}
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

            <div ref={sentinel} className="h-10" />
            {more && (
              <p className="flex items-center justify-center gap-3 py-6 font-mono text-xs text-slate-500">
                <LoadingDot /> Loading more
              </p>
            )}
            {!hasNext && items.length > 0 && (
              <p className="py-8 text-center font-mono text-xs text-slate-700">That&rsquo;s everything.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
