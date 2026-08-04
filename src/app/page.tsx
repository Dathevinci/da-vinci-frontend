import { getDashboardData } from "@/lib/jikan";

import { getDashboardKitsu } from "@/lib/kitsu";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import HeroBannerCarousel from "@/components/anime/HeroBannerCarousel";
import { Info, Clock, PlayCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import PageTransition from "@/components/layout/PageTransition";
import ContinueWatchingCarousel from "@/components/anime/ContinueWatchingCarousel";
import HeroSearchBar from "@/components/ui/HeroSearchBar";

// Revalidate the dashboard frequently so a transient API outage can't leave a
// stale "empty feed" cached for long — it recovers within ~1 minute.
export const revalidate = 60;

export default async function Home() {
  let data = null;
  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("Dashboard API Error:", err);
    try {
      data = await getDashboardKitsu();
    } catch (kitsuErr) {
      console.error("Kitsu fallback also failed:", kitsuErr);
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen pt-40 pb-20 px-4 flex flex-col items-center justify-center bg-[#09090b] text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-black text-white mb-4">Database Offline</h1>
        <p className="text-slate-400 max-w-md mx-auto text-lg">
          The primary AniList API is currently experiencing severe stability issues and has been disabled by its developers.
        </p>
        <p className="text-slate-500 max-w-md mx-auto mt-4">
          We are actively monitoring the situation and your service will automatically resume the moment their servers are back online. Thank you for your patience!
        </p>
      </div>
    );
  }

  // Shuffle the trending anime for the hero banner so it changes every time
  const shuffledTrending = [...data.trending.media].sort(() => 0.5 - Math.random());
  // Ten seats in the featured deck — enough that the circular fan reads as a
  // wheel, and the count the FEATURED / NN counter was designed around.
  const heroAnimes = shuffledTrending.slice(0, 10);

  return (
    <PageTransition>
      <div className="pb-20 min-h-screen bg-black/40">
      {data.isFallback && (
        <div className="relative z-30 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs sm:text-sm font-medium text-center py-2 px-4">
          AniList is currently unavailable — showing backup data from MyAnimeList.
        </div>
      )}
      {/* Cinematic Dashboard Hero */}
      <HeroBannerCarousel animes={heroAnimes} />

      {/* Carousels */}
      <div className="relative z-20 space-y-4 pt-2">
        {/* Search sits directly under the hero, above everything else — it's
            the first thing you reach for when you arrived knowing what you
            wanted. Submitting hands off to /explore, which owns the anime
            results grid and the real filter panel. */}
        {/* z-[60], not the z-30 manhwa and novel use: there the row is a
            sibling placed BEFORE the shelf container, so 30 beats its 20.
            Here it sits INSIDE that container alongside carousel rows that
            lift to z-50 on hover, and would otherwise be painted over. */}
        <HeroSearchBar mode="anime" filtersHref="/explore" className="relative z-[60] mx-auto w-full max-w-[960px] px-4 pb-2" />

        {/* Daily Quests used to sit here. Removed — it's reachable from the nav
            (More -> Daily Quests, or /quests), and two entry points meant the
            dashboard opened with a block of UI before any actual content. */}
        <ContinueWatchingCarousel />
        
        {(() => {
          const seen = new Set<number>();
          
          const filterUnique = (animes: any[]) => {
            return animes.filter(a => {
              if (seen.has(a.mal_id)) return false;
              seen.add(a.mal_id);
              return true;
            });
          };

          const recentlyUpdated = filterUnique(data.recentlyUpdated.media);
          const airingNow = filterUnique(data.airingNow.media);
          const nextSeason = filterUnique(data.nextSeason.media);
          const thisSeason = filterUnique(data.thisSeason.media);
          const upcoming = filterUnique(data.upcoming.media);
          const finished = filterUnique(data.finished.media);

          return (
            <>
              {recentlyUpdated.length > 0 && <AnimeCarousel title="Recently Updated" animes={recentlyUpdated} seeAllLink="/explore?status=releasing&sort=updated&title=Recently+Updated" />}
              {airingNow.length > 0 && <AnimeCarousel title="Currently Airing" animes={airingNow} seeAllLink="/explore?status=releasing&title=Currently+Airing" />}
              {nextSeason.length > 0 && <AnimeCarousel title="Upcoming Next Season" animes={nextSeason} seeAllLink="/explore?status=upcoming&title=Upcoming+Next+Season" />}
              {thisSeason.length > 0 && <AnimeCarousel title="Trending This Season" animes={thisSeason} seeAllLink="/explore?sort=trending&title=Trending+This+Season" />}
              {upcoming.length > 0 && <AnimeCarousel title="Highly Anticipated" animes={upcoming} seeAllLink="/explore?status=upcoming&title=Highly+Anticipated" />}
              {finished.length > 0 && <AnimeCarousel title="Recently Finished" animes={finished} seeAllLink="/explore?status=finished&title=Recently+Finished" />}
            </>
          );
        })()}
      </div>
    </div>
    </PageTransition>
  );
}
