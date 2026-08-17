"use client";

import { swrRawJson, readSwrCache } from "@/lib/swrCache";
import { lastNavWasPop } from "@/lib/navType";
import { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Star, Sparkles, Flame, Clock, CheckCircle2, BookMarked, Compass } from "lucide-react";
import type { NovelResult } from "@/lib/novel/types";
import { novelCover } from "@/lib/novelImage";
import NovelCarousel from "@/components/novel/NovelCarousel";
import NovelHeroCarousel from "@/components/novel/NovelHeroCarousel";
import HeroSearchBar from "@/components/ui/HeroSearchBar";
import ContinueReading from "@/components/reading/ContinueReading";
import MustReadSpotlight from "@/components/novel/MustReadSpotlight";
import DiscoverRail from "@/components/media/DiscoverRail";
import HiddenGems from "@/components/media/HiddenGems";
import RecentMediaComments from "@/components/media/RecentMediaComments";
import LoadingScreen from "@/components/ui/LoadingScreen";

function NovelInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const page = parseInt(sp.get("page") || "1");
  const query = sp.get("q") || "";
  const list = sp.get("list") || "light-novels";

  const isHome = !query && page === 1 && sp.get("view") !== "all";

  const [data, setData] = useState<NovelResult[]>([]);
  const [featuredHero, setFeaturedHero] = useState<NovelResult[]>([]);
  // Shelves are named for what the sources actually hold: ReadNovelFull is
  // translated Asian web novels, RoyalRoad is original English fiction. The
  // old curated-era names described a catalogue that no longer exists.
  const [translatedNovels, setTranslatedNovels] = useState<NovelResult[]>([]);
  const [originalFiction, setOriginalFiction] = useState<NovelResult[]>([]);
  const [latestUpdates, setLatestUpdates] = useState<NovelResult[]>([]);
  const [trending, setTrending] = useState<NovelResult[]>([]);
  const [completed, setCompleted] = useState<NovelResult[]>([]);
  const [loading, setLoading] = useState(true);
  const restored = useRef(false);
  // Same guards as the manhwa page — see the comments there.
  const servedQs = useRef("");
  const browseSeq = useRef(0);

  /**
   * PRE-PAINT RESTORE. useEffect fires after the browser has painted, so a
   * cached feed served there still flashed the loading screen and played the
   * route transition — pressing X looked like a full reload even with the
   * data in hand. A layout effect runs before paint: when a session copy
   * exists, the shelves are on screen in the FIRST frame and the loader never
   * becomes visible. The network refresh below still runs and corrects.
   */
  useLayoutEffect(() => {
    if (isHome) {
      const cached = readSwrCache("dv-novel-home");
      if (!cached) return;
      restored.current = true;
      setFeaturedHero(cached.featuredHero || []);
      setTranslatedNovels(cached.translatedNovels || []);
      setOriginalFiction(cached.originalFiction || []);
      setLatestUpdates(cached.latestUpdates || []);
      setTrending(cached.trending || []);
      setCompleted(cached.completed || []);
      setLoading(false);
      return;
    }
    // The browse grid restores too — same treatment and same guards as the
    // manhwa page (owner-reported there): history returns only, exact query
    // string match, snapshot written with the rows it labels.
    try {
      if (!lastNavWasPop()) return;
      const raw = sessionStorage.getItem("dv-browse-novel");
      if (!raw) return;
      const c = JSON.parse(raw);
      if (!c || c.qs !== sp.toString() || !Array.isArray(c.data) || c.data.length === 0) return;
      restored.current = true;
      servedQs.current = c.qs;
      setData(c.data);
      setLoading(false);
    } catch {
      /* snapshot is best-effort — worst case is the old cold reload */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome]);

  useEffect(() => {
    if (isHome || loading || data.length === 0) return;
    try {
      if (servedQs.current !== sp.toString()) return;
      sessionStorage.setItem("dv-browse-novel", JSON.stringify({ qs: servedQs.current, data }));
    } catch {
      /* quota or privacy mode — browse just reloads cold next time */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome, loading, data]);

  useEffect(() => {
    const wasRestored = restored.current;
    restored.current = false;
    if (!wasRestored) setLoading(true);
    if (isHome) {
      // Cached-then-refresh: closing a novel's X remounts this page, and
      // without the session copy the whole feed visibly reloaded on every
      // return. May apply twice (cache, then network) — setters are idempotent.
      swrRawJson(
        "dv-novel-home",
        "/api/novels/home",
        (res) => {
          setFeaturedHero(res.featuredHero || []);
          setTranslatedNovels(res.translatedNovels || []);
          setOriginalFiction(res.originalFiction || []);
          setLatestUpdates(res.latestUpdates || []);
          setTrending(res.trending || []);
          setCompleted(res.completed || []);
          setLoading(false);
        },
        () => setLoading(false)
      );
    } else {
      let url = `/api/novels?page=${page}`;
      if (query) url += `&q=${encodeURIComponent(query)}`;
      else url += `&list=${encodeURIComponent(list)}`;
      const id = ++browseSeq.current;
      const qsAtCall = sp.toString();
      fetch(url)
        .then((r) => r.json())
        .then((res) => {
          if (id !== browseSeq.current) return;
          servedQs.current = qsAtCall;
          setData(res.results || []);
          setLoading(false);
        })
        .catch(() => {
          if (id !== browseSeq.current) return;
          setLoading(false);
        });
    }
  }, [sp.toString(), isHome, query, page, list]);

  const toDiscover = (arr: NovelResult[]) =>
    (arr || []).filter((n) => n && n.id).map((n) => ({
      id: n.id,
      title: n.title,
      image: novelCover(n.cover) || null,
      meta: n.latestChapter || null,
      href: `/novel/${encodeURIComponent(n.id)}`,
    }));

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-16 pb-16 text-white selection:bg-pink-500/30">
      <AnimatePresence mode="wait">
        {loading ? (
          // Zero-duration exit: when the pre-paint restore flips `loading`
          // before the first frame, mode="wait" must not hold the feed hostage
          // to a loader fade the reader was never supposed to see.
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0 } }}>
            <LoadingScreen fullscreen={false} message="Loading light novels" />
          </motion.div>
        ) : isHome ? (
          <motion.div
            key="home"
            // A restored feed must LOOK restored — animating it in reads as a
            // reload, which is the exact report this exists to fix.
            initial={restored.current ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <NovelHeroCarousel items={featuredHero.length > 0 ? featuredHero : trending.slice(0, 6)} />

            <HeroSearchBar
              mode="novel"
              initialValue={query}
              filtersHref="/novel/explore"
              className="relative z-30 mx-auto w-full max-w-[960px] px-4 pt-6 pb-2"
            />

            <div className="relative z-20 space-y-2 max-w-[1600px] mx-auto">
              <ContinueReading kind="novel" />

              {/* Owner's editorial pin — its own shelf, above the listings. */}
              <MustReadSpotlight />
              
              {trending.length > 0 && (
                <NovelCarousel
                  title="Trending Now"
                  icon={<Flame className="w-6 h-6 text-rose-500" />}
                  items={trending}
                  seeAllLink="/novel/explore?list=popular"
                />
              )}

              {latestUpdates.length > 0 && (
                <NovelCarousel
                  title="Latest Updates"
                  icon={<Sparkles className="w-6 h-6 text-purple-400" />}
                  items={latestUpdates}
                  seeAllLink="/novel/explore?list=latest"
                />
              )}

              {translatedNovels.length > 0 && (
                <NovelCarousel
                  title="Translated Web Novels"
                  icon={<Star className="w-6 h-6 text-amber-400" />}
                  items={translatedNovels}
                  seeAllLink="/novel/explore?list=popular"
                />
              )}

              {originalFiction.length > 0 && (
                <NovelCarousel
                  title="Original English Fiction"
                  icon={<Star className="w-6 h-6 text-sky-400" />}
                  items={originalFiction}
                  seeAllLink="/novel/explore?list=original"
                />
              )}

              {completed.length > 0 && (
                <NovelCarousel
                  title="Completed"
                  icon={<CheckCircle2 className="w-6 h-6 text-emerald-400" />}
                  items={completed}
                  seeAllLink="/novel/explore?list=completed"
                />
              )}

              <div className="pt-6">
                <DiscoverRail
                  title="Discover Novels"
                  subtitle="Human-translated web novels and original English fiction"
                  accent="#ec4899"
                  tabs={[
                    { key: "translated", label: "Translated", icon: "top", items: toDiscover(translatedNovels) },
                    { key: "original", label: "Original English", icon: "popular", items: toDiscover(originalFiction) },
                    { key: "completed", label: "Completed", icon: "trending", items: toDiscover(completed) },
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
                  <BookMarked className="w-5 h-5" /> Browse All Light Novels
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="browse" initial={restored.current ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="max-w-[1500px] mx-auto px-4 md:px-8">
            <div className="flex items-center gap-3 mb-8 pt-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Light Novels & Web Masterpieces</h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Official Kadokawa & Yen Press Art &middot; Human Translations</p>
              </div>
            </div>

            <HeroSearchBar
              key={query}
              mode="novel"
              initialValue={query}
              className="mx-auto mb-8 w-full max-w-[960px]"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.map((n) => (
                <div key={n.id} className="aspect-[2/3]">
                  <a href={`/novel/${encodeURIComponent(n.id)}`} className="block w-full h-full group relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/10 hover:border-pink-500/40 transition-all">
                    {n.cover && (
                      <img src={novelCover(n.cover) || n.cover} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-3">
                      <span className="text-[10px] font-mono font-bold text-pink-400 uppercase tracking-wider">{n.tag || "Light Novel"}</span>
                      <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight mt-0.5">{n.title}</h3>
                      {n.latestChapter && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{n.latestChapter}</p>}
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NovelPage() {
  return (
    <Suspense fallback={<LoadingScreen fullscreen={false} message="Loading light novels" />}>
      <NovelInner />
    </Suspense>
  );
}
