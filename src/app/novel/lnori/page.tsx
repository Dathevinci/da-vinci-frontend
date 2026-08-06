"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import { novelCover } from "@/lib/novelImage";

/**
 * The whole Lnori catalogue, which the home shelf only ever showed the first
 * page of.
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

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/novels?source=lnori&page=${page}`)
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
  }, [page]);

  return (
    <div className="min-h-screen bg-[#070709] px-4 pb-24 pt-24 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 p-2 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-amber-200 to-pink-300 bg-clip-text font-mono text-2xl font-black uppercase tracking-widest text-transparent sm:text-3xl">
              Lnori Official EPUBs
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-amber-200/60">
              Complete volumes · page {page} of {totalPages}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-32 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-32 text-center font-mono text-sm text-slate-500">
            Nothing here right now — the source may be unreachable.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <Link key={item.id} href={`/novel/${encodeURIComponent(item.id)}`} className="group block">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-amber-500/20 bg-[#101018] transition-all duration-300 group-hover:border-amber-400/50 group-hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]">
                  <img
                    src={novelCover(item.cover)}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <h3 className="mt-2 line-clamp-2 font-mono text-sm font-bold leading-snug text-slate-200 transition-colors group-hover:text-amber-300">
                  {item.title}
                </h3>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
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
