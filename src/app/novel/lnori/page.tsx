"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import LnoriCard from "@/components/novel/LnoriCard";
import RosePetals from "@/components/novel/RosePetals";

/**
 * The whole Lnori catalogue, which the home shelf only ever showed one page of.
 *
 * Its own route rather than a mode of /novel/explore: that screen browses the
 * ranked lists the scraping sources expose ("most popular", "latest release"),
 * and Lnori has none of those — it is a flat directory of official volumes.
 * Bolting it in would have meant a source that ignores every control on the
 * page.
 */
export default function LnoriExplorePage() {
  const [items, setItems] = useState<NovelResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  /**
   * Search is debounced because every result resolves a cover, so firing on
   * each keystroke would queue a page of lookups per letter typed.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const qs = debounced ? `&q=${encodeURIComponent(debounced)}` : "";
    fetch(`/api/novels?source=lnori&page=${page}${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setItems(data?.results || []);
        setTotalPages(data?.totalPages || 1);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, debounced]);

  return (
    <div className="min-h-screen bg-[#070709] px-4 pb-24 pt-24 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="relative flex items-center gap-3">
            <RosePetals />
            <div className="relative z-10 rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 p-2 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="relative z-10">
              <h1 className="bg-gradient-to-r from-amber-200 to-pink-300 bg-clip-text font-mono text-2xl font-black uppercase tracking-widest text-transparent sm:text-3xl">
                Da Vinci Official EPUBs
              </h1>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-amber-200/60">
                {debounced ? `Results for “${debounced}”` : "Complete volumes"} · page {page} of {totalPages}
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300/50" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search EPUBs..."
              // 16px so iOS Safari does not zoom the page on focus and leave it
              // zoomed.
              className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 py-2.5 pl-10 pr-9 font-mono text-[16px] text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none sm:text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-amber-300"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-32 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-32 text-center font-mono text-sm text-slate-500">
            {debounced ? `Nothing matched “${debounced}”.` : "Nothing here right now — the source may be unreachable."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <LnoriCard key={item.id} novel={item} />
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-30"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
