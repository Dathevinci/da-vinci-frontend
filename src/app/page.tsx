import { getDashboardData } from "@/lib/anilist";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import AnnouncementBanner from "@/components/ui/AnnouncementBanner";
import { Info, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";

// Revalidate dashboard every hour
export const revalidate = 3600;

export default async function Home() {
  const data = await getDashboardData();
  const heroAnime = data.trending.media[0];
  
  const heroTitle = heroAnime?.title.english || heroAnime?.title.romaji || heroAnime?.title.userPreferred;
  const heroBanner = heroAnime?.bannerImage || heroAnime?.coverImage.extraLarge;
  const nextEp = heroAnime?.nextAiringEpisode;

  return (
    <div className="pb-20 min-h-screen bg-black/40 backdrop-blur-sm">
      {/* Cinematic Dashboard Hero */}
      {heroAnime && (
        <div className="relative w-full h-[75vh] flex items-center mb-10">
          <div className="absolute inset-0 z-0">
            <img 
              src={heroBanner} 
              alt={heroTitle} 
              className="w-full h-full object-cover opacity-60 mix-blend-screen"
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
          </div>

          <div className="relative z-10 container mx-auto px-4 md:px-12 mt-20 max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <AnimeStatusBadge status={heroAnime.status} />
              <span className="text-indigo-400 font-bold uppercase tracking-widest text-sm flex items-center gap-1">
                <PlayCircle className="w-4 h-4" /> #1 Trending
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black mb-4 text-white drop-shadow-2xl tracking-tight leading-tight line-clamp-2">
              {heroTitle}
            </h1>
            
            <div className="flex items-center gap-4 text-sm font-bold text-white mb-6 drop-shadow">
              {heroAnime.averageScore && <span className="text-green-400 text-lg">★ {heroAnime.averageScore}% Score</span>}
              <span className="text-slate-300">{heroAnime.season} {heroAnime.seasonYear}</span>
              <span className="border border-white/20 bg-white/10 px-2 rounded text-xs">{heroAnime.format || "TV"}</span>
              <span className="text-slate-400">{heroAnime.episodes ? `${heroAnime.episodes} Episodes` : "Unknown Episodes"}</span>
            </div>

            {nextEp && (
              <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 p-4 rounded-lg inline-flex items-center gap-4 mb-6 shadow-lg backdrop-blur-md">
                <Clock className="w-6 h-6 text-indigo-400" />
                <div>
                  <div className="text-xs text-indigo-300 uppercase font-bold tracking-wider">Next Episode {nextEp.episode}</div>
                  <div className="text-lg font-bold">Airs in {Math.floor(nextEp.timeUntilAiring / 86400)}d {Math.floor((nextEp.timeUntilAiring % 86400) / 3600)}h</div>
                </div>
              </div>
            )}

            <p className="text-lg text-slate-300 mb-8 line-clamp-3 leading-relaxed max-w-2xl font-medium" dangerouslySetInnerHTML={{ __html: heroAnime.description || "" }} />

            <div className="flex items-center gap-4">
              <Link href={`/anime/${heroAnime.id}`}>
                <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full text-lg font-bold transition shadow-xl shadow-indigo-600/20">
                  <Info className="w-5 h-5" />
                  View Details
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <AnnouncementBanner />

      {/* Carousels */}
      <div className="relative z-20 space-y-4">
        <AnimeCarousel title="Currently Airing" animes={data.airingNow.media} />
        <AnimeCarousel title="Upcoming Next Season" animes={data.nextSeason.media} />
        <AnimeCarousel title="Trending This Season" animes={data.thisSeason.media} />
        <AnimeCarousel title="Highly Anticipated" animes={data.upcoming.media} />
        <AnimeCarousel title="Recently Finished" animes={data.finished.media} />
      </div>
    </div>
  );
}
