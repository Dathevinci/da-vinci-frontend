"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Filter, X } from "lucide-react";
import ManhwaCard from "@/components/manhwa/ManhwaCard";
import NovelCard from "@/components/novel/NovelCard";
import LoadingScreen, { LoadingDot } from "@/components/ui/LoadingScreen";

/**
 * EXPLORE for comics and novels — the counterpart to the anime one, which
 * these modes never had: their only browse surface was the home page's
 * "view=all" grid with a filter box bolted to a header card.
 *
 * Same shape as anime explore: a sticky control bar, live search, filters that
 * apply immediately, and an infinite-scrolling grid. The filters differ per
 * mode because the sources differ — comics can filter status and sort order,
 * novels can only pick a source list — so each mode offers exactly what its
 * API actually honours rather than a shared set of half-working controls.
 *
 * useSearchParams lives here, inside a component the route wraps in Suspense.
 * At page level without a boundary it fails `next build`, and Vercel then
 * keeps serving the last good deploy, so the wrong code looks live.
 */

type Mode = "manhwa" | "novel";

const STATUS = [
  { v: "", label: "Any status" },
  { v: "ongoing", label: "Ongoing" },
  { v: "completed", label: "Completed" },
  { v: "hiatus", label: "Hiatus" },
  { v: "dropped", label: "Dropped" },
];

const SORT = [
  { v: "", label: "Latest" },
  { v: "popular", label: "Most Popular" },
  { v: "rating", label: "Highest Rated" },
  { v: "title", label: "A–Z" },
];

const NOVEL_LISTS = [
  { v: "most-popular-novel", label: "Most Popular" },
  { v: "latest-release-novel", label: "Latest Release" },
  { v: "completed-novel", label: "Completed" },
  { v: "lightnovelworld", label: "LightNovelWorld" },
  { v: "lightnovelworld-top", label: "LNW Top Rated" },
];

const CFG = {
  manhwa: { path: "/api/manhwa", accent: "#dc2626", title: "Discover Comics", blurb: "Search every series across AsuraScans and MangaDex" },
  novel: { path: "/api/novels", accent: "#ec4899", title: "Discover Novels", blurb: "Search every novel across all three sources" },
} as const;

export default function MediaExplore({ mode }: { mode: Mode }) {
  // Params seed the initial state only; filtering after that is local, so the
  // URL never changes and there is nothing to push.
  const sp = useSearchParams();
  const cfg = CFG[mode];

  const [q, setQ] = useState(sp.get("q") || "");
  const [status, setStatus] = useState(sp.get("status") || "");
  const [sort, setSort] = useState(sp.get("sort") || "");
  const [list, setList] = useState(sp.get("list") || "most-popular-novel");
  const [openFilters, setOpenFilters] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  // Only the newest request may render. Search is a scrape on both sources, so
  // an earlier slow reply landing last would otherwise replace newer results.
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const buildUrl = useCallback((p: number) => {
    const u = new URLSearchParams();
    u.set("page", String(p));
    if (q.trim()) u.set("q", q.trim());
    if (mode === "manhwa") {
      if (status) u.set("status", status);
      if (sort) u.set("sort", sort);
    } else if (!q.trim()) {
      // The novel API treats `list` and `q` as mutually exclusive.
      u.set("list", list);
    }
    return `${cfg.path}?${u.toString()}`;
  }, [q, status, sort, list, mode, cfg.path]);

  const load = useCallback(async (p: number, append: boolean) => {
    const id = ++seq.current;
    append ? setMore(true) : setLoading(true);
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

  // Debounced reload whenever the query or a filter changes.
  useEffect(() => {
    const t = setTimeout(() => load(1, false), 350);
    return () => clearTimeout(t);
  }, [load]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNext || loading || more) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) load(page + 1, true);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, loading, more, page, load]);

  const clear = () => { setQ(""); setStatus(""); setSort(""); };
  const activeFilters = (mode === "manhwa" ? [status, sort] : []).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#070709] pb-24 pt-16 text-white">
      {/* control bar */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070709]/95 px-4 py-3">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={mode === "novel" ? "Search for novels…" : "Search for comics…"}
              aria-label="Search"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-10 font-mono text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-white/25"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpenFilters((v) => !v)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 font-mono text-xs font-black leading-5 transition ${
              openFilters ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && (
              <span className="rounded-full px-1.5 text-[10px]" style={{ background: cfg.accent, color: "#fff" }}>
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {openFilters && (
          <div className="mx-auto mt-3 flex max-w-[1500px] flex-wrap items-center gap-2">
            {mode === "manhwa" ? (
              <>
                {STATUS.map((s) => (
                  <button key={s.v || "any"} type="button" onClick={() => setStatus(s.v)}
                    className="rounded-lg border px-3 py-1.5 font-mono text-[11px] font-black transition"
                    style={status === s.v
                      ? { borderColor: cfg.accent, background: `${cfg.accent}22`, color: cfg.accent }
                      : { borderColor: "rgba(255,255,255,.1)", color: "#94a3b8" }}>
                    {s.label}
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-white/10" />
                {SORT.map((s) => (
                  <button key={s.v || "latest"} type="button" onClick={() => setSort(s.v)}
                    className="rounded-lg border px-3 py-1.5 font-mono text-[11px] font-black transition"
                    style={sort === s.v
                      ? { borderColor: cfg.accent, background: `${cfg.accent}22`, color: cfg.accent }
                      : { borderColor: "rgba(255,255,255,.1)", color: "#94a3b8" }}>
                    {s.label}
                  </button>
                ))}
                {activeFilters > 0 && (
                  <button type="button" onClick={clear}
                    className="ml-auto font-mono text-[11px] font-black text-slate-500 hover:text-white">
                    Clear
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Novel sources ignore status and sort entirely; a list IS the
                    filter, and it only applies when not searching. */}
                {NOVEL_LISTS.map((l) => (
                  <button key={l.v} type="button" onClick={() => setList(l.v)} disabled={!!q.trim()}
                    title={q.trim() ? "Clear the search to browse a list" : undefined}
                    className="rounded-lg border px-3 py-1.5 font-mono text-[11px] font-black transition disabled:opacity-35"
                    style={list === l.v && !q.trim()
                      ? { borderColor: cfg.accent, background: `${cfg.accent}22`, color: cfg.accent }
                      : { borderColor: "rgba(255,255,255,.1)", color: "#94a3b8" }}>
                    {l.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* heading + grid */}
      <div className="mx-auto max-w-[1500px] px-4 pt-8">
        <h1 className="font-mono text-3xl font-black">{cfg.title}</h1>
        <p className="mt-1.5 font-mono text-sm text-slate-500">
          {loading ? cfg.blurb : `${items.length} shown${q.trim() ? ` for “${q.trim()}”` : ""}`}
        </p>

        {loading ? (
          <LoadingScreen fullscreen={false} message={mode === "novel" ? "Searching novels" : "Searching comics"} />
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-sm text-slate-500">Nothing matched that.</p>
            {(q || activeFilters > 0) && (
              <button type="button" onClick={clear}
                className="mt-3 font-mono text-xs font-black" style={{ color: cfg.accent }}>
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
