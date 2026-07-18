import { getAnimeDetails, getAnimeDetailsAniList } from "@/lib/jikan";

import { getAnimeDetailsKitsu } from "@/lib/kitsu";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import AnimeTrackerPanel from "@/components/anime/AnimeTrackerPanel";
import AnimeBackgroundTrailer from "@/components/anime/AnimeBackgroundTrailer";
import AnimeTabs from "@/components/anime/AnimeTabs";
import { getYouTubeId } from "@/lib/jikan";
import PageTransition from "@/components/layout/PageTransition";

export const revalidate = 3600;

export default async function AnimeDetails({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const animeId = parseInt(resolvedParams.id, 10);
  if (isNaN(animeId)) return notFound();

  let anime = null;
  try {
    anime = await getAnimeDetails(animeId);
  } catch (err) {
    console.error("Anime Details API Error:", err);
    try {
      anime = await getAnimeDetailsKitsu(animeId);
    } catch (kitsuErr) {
      console.error("Kitsu fallback also failed:", kitsuErr);
      try {
        anime = await getAnimeDetailsAniList(animeId);
      } catch (aniListErr) {
        console.error("AniList final fallback failed:", aniListErr);
      }
    }
  }

  if (!anime) {
    return <div className="min-h-screen pt-32 text-center text-white">Loading data or API is temporarily unavailable...</div>;
  }

  const title = anime.title_english || anime.title;
  const bannerUrl = anime.trailer?.images?.maximum_image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
  const trailerId = getYouTubeId(anime.trailer);

  return (
    <PageTransition>
      <div className="bg-[#09090b] min-h-screen text-white pt-16">
      {/* Cinematic Banner Area */}
      <div className="relative w-full h-[50vh] md:h-[60vh]">
        {trailerId ? (
          <AnimeBackgroundTrailer trailerId={trailerId} bannerUrl={bannerUrl || ""} />
        ) : (
          <>
            <img src={bannerUrl || ""} alt={title} className="w-full h-full object-cover opacity-50 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
          </>
        )}
          
          <div className="relative md:absolute md:bottom-0 md:left-0 w-full md:translate-y-0">
            <div className="container mx-auto px-4 md:px-12 flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end pb-8 text-center md:text-left">
              <div className="w-32 sm:w-48 md:w-64 flex-shrink-0 rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl translate-y-0 md:translate-y-24 bg-[#141414] z-10 -mt-24 md:mt-0">
                <img src={(anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "") as string} alt={title} className="w-full h-auto" />
              </div>
              
              <div className="flex-1 pb-4 flex flex-col items-center md:items-start w-full z-10">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3 mt-4 md:mt-0">
                  <AnimeStatusBadge status={anime.status || "Unknown"} />
                  {anime.score && <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 text-sm">★ {anime.score}</span>}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-2 drop-shadow-lg leading-tight break-words">{title}</h1>
                <p className="text-slate-400 font-medium mb-6 text-sm md:text-base">{anime.title_japanese}</p>
                
                <div className="flex flex-wrap gap-4 items-center">
                  <AnimeTrackerPanel anime={anime as any} />
                  
                  {anime.url && (
                    <a href={anime.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-300 hover:text-white transition px-4 py-3 bg-white/5 rounded-full border border-white/10 font-medium">
                      <ExternalLink className="w-4 h-4" /> View on {(anime as any)._source === "jikan" ? "MyAnimeList" : "AniList"}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="container mx-auto px-4 md:px-12 pt-8 md:pt-32 pb-20 flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* Main Info */}
          <div className="flex-1 flex flex-col gap-8">
            <AnimeTabs anime={anime as any} />
          </div>

          {/* Sidebar Stats */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 text-white border-b border-white/10 pb-2">Information</h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <span className="text-slate-500 block mb-1">Format</span>
                  <span className="text-slate-200 font-medium">{anime.type || "Unknown"}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Episodes</span>
                  <span className="text-slate-200 font-medium">{anime.episodes || "Unknown"}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Duration</span>
                  <span className="text-slate-200 font-medium">{anime.duration || "Unknown"}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Season</span>
                  <span className="text-slate-200 font-medium capitalize">{anime.season} {anime.year}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Studios</span>
                  <span className="text-slate-200 font-medium">
                    {anime.studios?.map(s => s.name).join(", ") || "Unknown"}
                  </span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 text-white border-b border-white/10 pb-2">Genres</h3>
              <div className="flex flex-wrap gap-2">
                {anime.genres.map((g: any) => (
                  <span key={g.name} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-medium">
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
    );
}
