import { getDashboardData } from "@/lib/jikan";

import { getDashboardKitsu } from "@/lib/kitsu";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import HeroBannerCarousel from "@/components/anime/HeroBannerCarousel";
import { Info, Clock, PlayCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import PageTransition from "@/components/layout/PageTransition";
import ContinueWatchingCarousel from "@/components/anime/ContinueWatchingCarousel";

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
  const heroAnimes = shuffledTrending.slice(0, 5);

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
