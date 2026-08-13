"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Flame, Clock, CheckCircle2, BookMarked, Star } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import HeroSearchBar from "@/components/ui/HeroSearchBar";
import DiscoverRail from "@/components/media/DiscoverRail";
import RecentMediaComments from "@/components/media/RecentMediaComments";
import HiddenGems from "@/components/media/HiddenGems";
import { novelCover } from "@/lib/novelImage";
import NovelCard from "@/components/novel/NovelCard";
import NovelCarousel from "@/components/novel/NovelCarousel";
import NovelHeroCarousel from "@/components/novel/NovelHeroCarousel";
import ContinueReading from "@/components/reading/ContinueReading";
import { motion, AnimatePresence } from "framer-motion";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";

const LISTS = [
  { key: "most-popular-novel", label: "Popular", icon: Flame },
  { key: "lnw-top", label: "LightNovelWorld Top", icon: Star },
  { key: "nf-popular", label: "NovelFull Hits", icon: BookOpen },
  { key: "latest-release-novel", label: "Latest", icon: Clock },
  { key: "completed-novel", label: "Completed", icon: CheckCircle2 },
];

export default function NovelBrowsePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading library" />}>
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
  const [lnwTop, setLnwTop] = useState<NovelResult[]>([]);
  const [nfTop, setNfTop] = useState<NovelResult[]>([]);
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
          setLnwTop(res.lnwTop || []);
          setNfTop(res.nfTop || []);
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
  }, [sp.toString(), isHome]);

  const toDiscover = (arr: NovelResult[]) =>
    (arr || []).filter((n) => n && n.id).map((n) => ({
      id: n.id,
      title: n.title,
      image: novelCover(n.cover) || null,
      meta: n.latestChapter || null,
      href: `/novel/${encodeURIComponent(n.id)}`,
    }));

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
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoadingScreen fullscreen={false} message="Loading novels" />
          </motion.div>
        ) : isHome ? (
          <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full">
            <NovelHeroCarousel items={trending.slice(0, 10)} />

            <HeroSearchBar
              mode="novel"
              initialValue={query}
              filtersHref="/novel/explore"
              className="relative z-30 mx-auto w-full max-w-[960px] px-4 pt-6 pb-2"
            />

            <div className="relative z-20 space-y-2 max-w-[1600px] mx-auto">
              <ContinueReading kind="novel" />
              <NovelCarousel title="Trending Now" icon={<Flame className="w-6 h-6 text-orange-500" />} items={trending} seeAllLink="/novel/explore?list=most-popular-novel" />
              <NovelCarousel title="Top Rated on LightNovelWorld" icon={<Star className="w-6 h-6 text-yellow-400" />} items={lnwTop} seeAllLink="/novel/explore?list=lnw-top" />
              <NovelCarousel title="Popular on NovelFull" icon={<BookOpen className="w-6 h-6 text-pink-400" />} items={nfTop} seeAllLink="/novel/explore?list=nf-popular" />
              <NovelCarousel title="Recently Updated" icon={<Clock className="w-6 h-6 text-pink-400" />} items={latest} seeAllLink="/novel/explore?list=latest-release-novel" />
              <NovelCarousel title="Completed" icon={<CheckCircle2 className="w-6 h-6 text-green-500" />} items={completed} seeAllLink="/novel/explore?list=completed-novel" />

              <div className="pt-6">
                <DiscoverRail
                  title="Discover Novels"
                  subtitle="Trending shelves, reader favourites, and top rated picks"
                  accent="#ec4899"
                  tabs={[
                    { key: "trending", label: "ReadNovelFull", icon: "trending", items: toDiscover(trending) },
                    { key: "lnw", label: "LightNovelWorld", icon: "top", items: toDiscover(lnwTop) },
                    { key: "nf", label: "NovelFull", icon: "popular", items: toDiscover(nfTop) },
                  ]}
                />
              </div>

              <div className="pt-6">
                <HiddenGems source="novel" accent="#ec4899" />
              </div>

              <div className="pt-6">
                <RecentMediaComments
                  source="novel"
                  title="Recent Novel Comments"
                  accent="#ec4899"
                  chipLabel="Novel"
                />
              </div>

              <div className="flex justify-center pt-4 pb-2 pl-4 md:pl-12">
                <button
                  onClick={() => router.push("/novel/explore")}
                  className="flex items-center gap-2 px-8 py-3 bg-pink-500 hover:bg-pink-400 text-white font-bold rounded-full shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-colors"
                >
                  <BookMarked className="w-5 h-5" /> Browse All Novels
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="browse" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-[1500px] mx-auto px-4 md:px-8">
            <div className="flex items-center gap-3 mb-8 pt-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Light Novels</h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">ReadNovelFull &middot; LightNovelWorld &middot; NovelFull</p>
              </div>
            </div>

            <HeroSearchBar
              key={query}
              mode="novel"
              initialValue={query}
              className="mx-auto mb-8 w-full max-w-[960px]"
            />

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
