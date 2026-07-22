"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, BookOpen, ChevronLeft, ChevronRight, Flame, Clock, CheckCircle2, BookMarked } from "lucide-react";
import NovelCard from "@/components/novel/NovelCard";
import NovelCarousel from "@/components/novel/NovelCarousel";
import NovelHeroCarousel from "@/components/novel/NovelHeroCarousel";
import { motion, AnimatePresence } from "framer-motion";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";

const LISTS = [
  { key: "most-popular-novel", label: "Popular", icon: Flame },
  { key: "latest-release-novel", label: "Latest", icon: Clock },
  { key: "korean", label: "Korean", icon: BookOpen },
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
      <NovelInner />
    </Suspense>
  );
}

function NovelInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const query = sp.get("q") || "";
  const list = sp.get("list") || "most-popular-novel";

  const isHome = !query && page === 1 && sp.get("view") !== "all";

  const [data, setData] = useState<NovelResult[]>([]);
  const [trending, setTrending] = useState<NovelResult[]>([]);
  const [latest, setLatest] = useState<NovelResult[]>([]);
  const [completed, setCompleted] = useState<NovelResult[]>([]);
  const [fanmtl, setFanmtl] = useState<NovelResult[]>([]);
  const [korean, setKorean] = useState<NovelResult[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (isHome) {
      fetch("/api/novels/home")
        .then((r) => r.json())
        .then((res) => {
          setTrending(res.trending || []);
          setLatest(res.latestUpdates || []);
          setCompleted(res.completed || []);
          setKorean(res.korean || []);
          setFanmtl(res.fanmtl || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      let url = `/api/novels?page=${page}`;
      if (query) url += `&q=${encodeURIComponent(query)}`;
      else url += `&list=${encodeURIComponent(list)}`;
      fetch(url)
        .then((r) => r.json())
        .then((res) => {
          setData(res.results || []);
          setHasNext(res.hasNextPage || false);
          setLoading(false);
        })
        .catch(() => {
          setData([]);
          setLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString(), isHome]);

  const buildUrl = (p: number) => {
    const u = new URLSearchParams(sp.toString());
    u.set("page", String(p));
    if (!isHome && !query) u.set("view", "all");
    return `/novel?${u.toString()}`;
  };

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-16 pb-16 text-white selection:bg-pink-500/30">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Loading novels…</p>
          </motion.div>
        ) : isHome ? (
          <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full">
            <NovelHeroCarousel items={trending.slice(0, 10)} />

            <div className="relative z-20 space-y-2 max-w-[1600px] mx-auto">
              <NovelCarousel title="Trending Now" icon={<Flame className="w-6 h-6 text-orange-500" />} items={trending} seeAllLink="/novel?view=all&list=most-popular-novel" />
              <NovelCarousel title="Recently Updated" icon={<Clock className="w-6 h-6 text-pink-400" />} items={latest} seeAllLink="/novel?view=all&list=latest-release-novel" />
              <NovelCarousel title="Korean Novels" icon={<BookOpen className="w-6 h-6 text-blue-400" />} items={korean} seeAllLink="/novel?view=all&list=korean" />
              <NovelCarousel title="Completed" icon={<CheckCircle2 className="w-6 h-6 text-green-500" />} items={completed} seeAllLink="/novel?view=all&list=completed-novel" />
              <NovelCarousel title="More Novels" icon={<BookOpen className="w-6 h-6 text-pink-400" />} items={fanmtl} seeAllLink="/novel?view=all" />

              <div className="flex justify-center pt-4 pb-2 pl-4 md:pl-12">
                <button
                  onClick={() => router.push("/novel?view=all&page=1")}
                  className="flex items-center gap-2 px-8 py-3 bg-pink-500 hover:bg-pink-400 text-white font-bold rounded-full shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-colors"
                >
                  <BookMarked className="w-5 h-5" /> Browse All Novels
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="browse" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-[1500px] mx-auto px-4 md:px-8">
            {/* Header (search lives in the navbar) */}
            <div className="flex items-center gap-3 mb-8 pt-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Light Novels</h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">NovelFull &middot; ReadNovelFull</p>
              </div>
            </div>

            {/* List tabs (hidden during search) */}
            {!query && (
              <div className="flex gap-2 mb-8 flex-wrap">
                {LISTS.map(({ key, label, icon: Icon }) => (
                  <Link
                    key={key}
                    href={`/novel?view=all&list=${key}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition ${
                      list === key ? "bg-pink-500 text-white" : "bg-[#151518] text-slate-300 hover:bg-[#1e1e24] border border-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </Link>
                ))}
              </div>
            )}
            {query && <h2 className="text-lg font-bold mb-6 text-slate-300">Search results for &ldquo;{query}&rdquo;</h2>}

            {/* Grid */}
            {data.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                {data.map((n) => (
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination (browse grid only) */}
      {!loading && !isHome && data.length > 0 && (
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
            <Link href={buildUrl(page + 1)} className="px-6 py-3 bg-pink-500 hover:bg-pink-400 text-white rounded-lg flex items-center gap-2">
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
  );
}
