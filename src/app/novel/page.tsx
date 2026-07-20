"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2, BookOpen, ChevronLeft, ChevronRight, Flame, Clock, CheckCircle2 } from "lucide-react";
import NovelCard from "@/components/novel/NovelCard";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";

const LISTS = [
  { key: "most-popular-novel", label: "Popular", icon: Flame },
  { key: "latest-release-novel", label: "Latest", icon: Clock },
  { key: "completed-novel", label: "Completed", icon: CheckCircle2 },
];

// useSearchParams must sit inside a Suspense boundary or `next build` fails to
// prerender /novel (same pattern as the manhwa page).
export default function NovelBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#0b0b0c] min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Loading Library…</p>
        </div>
      }
    >
      <NovelBrowseInner />
    </Suspense>
  );
}

function NovelBrowseInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const query = sp.get("q") || "";
  const list = sp.get("list") || "most-popular-novel";

  const [results, setResults] = useState<NovelResult[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    setLoading(true);
    let url = `/api/novels?page=${page}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    else url += `&list=${encodeURIComponent(list)}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        setResults(res.results || []);
        setHasNext(res.hasNextPage || false);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    router.push(q ? `/novel?q=${encodeURIComponent(q)}` : "/novel");
  };

  const buildUrl = (p: number) => {
    const u = new URLSearchParams(sp.toString());
    u.set("page", String(p));
    return `/novel?${u.toString()}`;
  };

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-20 pb-16 text-white selection:bg-pink-500/30">
      <div className="max-w-[1500px] mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Light Novels</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Powered by ReadNovelFull</p>
            </div>
          </div>
          <form onSubmit={submitSearch} className="relative w-full md:w-80">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search novels…"
              className="w-full bg-[#151518] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-pink-500/50 transition-colors placeholder:text-slate-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          </form>
        </div>

        {/* List tabs (hidden during search) */}
        {!query ? (
          <div className="flex gap-2 mb-8 flex-wrap">
            {LISTS.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={`/novel?list=${key}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition ${
                  list === key ? "bg-pink-500 text-black" : "bg-[#151518] text-slate-300 hover:bg-[#1e1e24] border border-white/10"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </div>
        ) : (
          <h2 className="text-lg font-bold mb-6 text-slate-300">
            Search results for &ldquo;{query}&rdquo;
          </h2>
        )}

        {/* Grid */}
        {loading ? (
          <div className="py-32 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Loading novels…</p>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {results.map((n) => (
              <NovelCard key={n.id} novel={n} />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center">
            <span className="text-6xl mb-4 opacity-40 block">📖</span>
            <h3 className="text-2xl font-black mb-2">No novels found</h3>
            <p className="text-slate-500">Try a different search.</p>
          </div>
        )}

        {/* Pagination (browse only) */}
        {!loading && results.length > 0 && !query && (
          <div className="mt-14 flex justify-center items-center gap-4 text-xs font-bold uppercase tracking-widest">
            {page > 1 ? (
              <Link href={buildUrl(page - 1)} className="px-6 py-3 bg-[#151518] hover:bg-[#1e1e24] border border-white/10 rounded-lg flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Prev
              </Link>
            ) : (
              <span className="px-6 py-3 bg-[#151518]/50 border border-white/5 rounded-lg opacity-40 flex items-center gap-2 text-slate-600">
                <ChevronLeft className="w-4 h-4" /> Prev
              </span>
            )}
            <span className="px-6 py-3 bg-[#0b0b0c] border border-white/10 rounded-lg text-slate-400">Page {page}</span>
            {hasNext ? (
              <Link href={buildUrl(page + 1)} className="px-6 py-3 bg-pink-500 hover:bg-pink-400 text-black rounded-lg flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="px-6 py-3 bg-[#151518]/50 border border-white/5 rounded-lg opacity-40 flex items-center gap-2 text-slate-600">
                Next <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
