import { getDashboardData } from "@/lib/anilist";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
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

      {/* Announcement Banner */}
      <div className="relative z-30 container mx-auto px-4 md:px-12 mt-8 mb-8">
        <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(168,85,247,0.25)] flex flex-col md:flex-row items-center gap-6 justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 via-purple-500 to-fuchsia-500 animate-pulse" />
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-black text-white mb-2 flex items-center gap-3">
              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded tracking-widest uppercase shadow-lg shadow-purple-500/50">Announcement</span>
              Message from Lead Dev <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]">dejavuh</span>
            </h2>
            <p className="text-indigo-100 font-medium text-sm md:text-base">
              Welcome to Da Vinci! I've just introduced the <strong>Arise Points</strong> system. Follow my profile to earn your first <span className="text-purple-300 font-bold">10 ✧ Arise Points</span> and experience the new Hollow Purple animation!
            </p>
          </div>
          <Link href="/user/dejavuh">
            <button className="whitespace-nowrap bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-3 rounded-full font-bold shadow-xl shadow-purple-600/30 transition hover:scale-105 active:scale-95">
              Visit Profile
            </button>
          </Link>
        </div>
      </div>

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
