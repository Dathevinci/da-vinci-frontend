"use client";

import { useState, useEffect, Suspense } from "react";
import ManhwaCard from "@/components/manhwa/ManhwaCard";
import ManhwaFilters from "@/components/manhwa/ManhwaFilters";
import ManhwaHeroCarousel from "@/components/manhwa/ManhwaHeroCarousel";
import ManhwaCarousel from "@/components/manhwa/ManhwaCarousel";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BookMarked, Loader2, Flame, Clock, Star } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { IMangaResult, ISearch } from "@/lib/asura/models";
import { motion, AnimatePresence } from "framer-motion";

// useSearchParams() must sit inside a Suspense boundary or `next build`
// fails to prerender /manhwa (same pattern as ManhwaFilters / ManhwaModalProvider).
export default function ManhwaPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#0b0b0c] min-h-screen pt-16 flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          <p className="text-[#a3a3a3] text-sm font-bold uppercase tracking-widest">Loading AsuraScans...</p>
        </div>
      }
    >
      <ManhwaPageInner />
    </Suspense>
  );
}

function ManhwaPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const query = sp.get("q") || "";

  const [data, setData] = useState<IMangaResult[]>([]);
  const [trending, setTrending] = useState<IMangaResult[]>([]);
  const [latestUpdates, setLatestUpdates] = useState<IMangaResult[]>([]);
  
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const isHome = !query && page === 1 && sp.get("view") !== "all";

  useEffect(() => {
    setLoading(true);
    
    if (isHome) {
      // Fetch home layout data (Trending & Latest)
      fetch('/api/manhwa/home')
        .then((res) => res.json())
        .then((res) => {
          setTrending(res.trending || []);
          setLatestUpdates(res.latestUpdates || []);
          setHasNext(true); // Assuming home always has a next page
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else {
      // Fetch regular search/pagination data
      let url = `/api/manhwa?page=${page}`;
      if (query) {
        url += `&q=${encodeURIComponent(query)}`;
      }
      fetch(url)
        .then((res) => res.json())
        .then((res: ISearch<IMangaResult>) => {
          setData(res.results || []);
          setHasNext(res.hasNextPage || false);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setData([]);
          setHasNext(false);
          setLoading(false);
        });
    }
  }, [sp.toString(), isHome]);

  const buildUrl = (p: number) => {
    const u = new URLSearchParams(sp.toString());
    u.set("page", String(p));
    if (!isHome && !query) u.set("view", "all");
    return `/manhwa?${u.toString()}`;
  };

  // Highest-rated across everything we have, deduped by id — the "Top Rated" shelf.
  const dedupeById = (arr: IMangaResult[]) => {
    const seen = new Set<string>();
    return arr.filter((m) => m && m.id && !seen.has(m.id) && (seen.add(m.id), true));
  };
  const topRated = dedupeById([...trending, ...latestUpdates])
    .filter((m) => m.rating)
    .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
    .slice(0, 18);

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-16 pb-16 text-white font-sans selection:bg-red-500/30">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            <p className="text-[#a3a3a3] text-sm font-bold uppercase tracking-widest">Loading AsuraScans...</p>
          </motion.div>
        ) : isHome ? (
          <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full">
            {/* Top Hero Carousel */}
            <ManhwaHeroCarousel items={trending.slice(0, 10)} />
            
            {/* Netflix-style horizontal shelves — same feel as anime mode */}
            <div className="relative z-20 space-y-2 pt-6 max-w-[1600px] mx-auto">
              <ManhwaCarousel title="Trending Now" icon={<Flame className="w-6 h-6 text-orange-500" />} items={trending} />
              <ManhwaCarousel title="Recently Added" icon={<Clock className="w-6 h-6 text-[#dc2626]" />} items={latestUpdates} />
              {topRated.length > 0 && (
                <ManhwaCarousel title="Top Rated" icon={<Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />} items={topRated} />
              )}

              {/* Browse-all CTA */}
              <div className="flex justify-center pt-4 pb-2 pl-4 md:pl-12">
                <button
                  onClick={() => router.push("/manhwa?view=all&page=1")}
                  className="flex items-center gap-2 px-8 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-white font-bold rounded-full shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-colors"
                >
                  <BookMarked className="w-5 h-5" /> Browse All Comics
                </button>
              </div>
            </div>
          </motion.div>
        ) : data.length > 0 ? (
          <motion.div key="grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-[1400px] mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 bg-[#151518] border border-[#2a2a32] p-6 rounded-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#dc2626] to-red-600"></div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-[#dc2626]/10 flex items-center justify-center text-[#dc2626] border border-[#dc2626]/20">
                    <BookMarked className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm">Manhwa</h1>
                    <p className="text-[#a3a3a3] text-xs font-bold uppercase tracking-widest mt-1">
                      Powered by AsuraScans
                    </p>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-auto md:min-w-[320px]">
                <ManhwaFilters />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-6 border-b border-[#2a2a32] pb-3">
              <BookMarked className="w-5 h-5 text-[#dc2626]" />
              <h2 className="text-xl font-black uppercase tracking-wider text-white">
                {query ? `Search: ${query}` : `Browse Series`}
              </h2>
            </div>

            <motion.div 
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }} 
              initial="hidden" animate="show" 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
            >
              {data.map((manhwa) => (
                <motion.div key={manhwa.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                  <ManhwaCard manhwa={manhwa} />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-[1400px] mx-auto px-4 md:px-8">
            <div className="py-32 text-center flex flex-col items-center bg-[#151518] rounded-2xl border border-[#2a2a32] shadow-xl">
              <span className="text-6xl mb-4 opacity-50">📖</span>
              <h3 className="text-2xl font-black text-white mb-2">No Series Found</h3>
              <p className="text-[#a3a3a3] text-sm font-medium max-w-md">Try adjusting your search query.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination — only on the browse/search grid, not the carousel home */}
      {!loading && !isHome && data.length > 0 && (
        <div className="mt-16 flex justify-center items-center gap-4 text-xs font-bold uppercase tracking-widest">
          {page > 1 ? (
            <Link href={buildUrl(page - 1)} className="px-6 py-3 bg-[#151518] hover:bg-[#1e1e24] border border-[#2a2a32] rounded-lg transition flex items-center gap-2 shadow-md text-white">
              <ChevronLeft className="w-4 h-4" /> Prev
            </Link>
          ) : (
            <span className="px-6 py-3 bg-[#151518]/50 border border-[#2a2a32]/50 rounded-lg opacity-40 cursor-not-allowed flex items-center gap-2 text-[#737373]">
              <ChevronLeft className="w-4 h-4" /> Prev
            </span>
          )}
          
          <span className="px-6 py-3 bg-[#0b0b0c] border border-[#2a2a32] rounded-lg text-[#a3a3a3] shadow-inner">
            Page {page}
          </span>
          
          {hasNext ? (
            <Link href={buildUrl(page + 1)} className="px-6 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-white border border-[#dc2626]/50 rounded-lg transition shadow-[0_0_15px_rgba(220,38,38,0.2)] flex items-center gap-2">
              Next <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <span className="px-6 py-3 bg-[#151518]/50 border border-[#2a2a32]/50 rounded-lg opacity-40 cursor-not-allowed flex items-center gap-2 text-[#737373]">
              Next <ChevronRight className="w-4 h-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
