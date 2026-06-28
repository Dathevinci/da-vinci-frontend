import { getAnimeDetails } from "@/lib/anilist";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, Calendar as CalendarIcon, Hash } from "lucide-react";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import AnimeTrackerPanel from "@/components/anime/AnimeTrackerPanel";

export const revalidate = 3600;

export default async function AnimeDetails({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const animeId = parseInt(resolvedParams.id, 10);
  if (isNaN(animeId)) return notFound();

  try {
    const anime = await getAnimeDetails(animeId);
    if (!anime) return notFound();

    const title = anime.title.english || anime.title.romaji || anime.title.userPreferred;
    const bannerUrl = anime.bannerImage || anime.coverImage.extraLarge;
    const nextEp = anime.nextAiringEpisode;

    return (
      <div className="bg-[#09090b] min-h-screen text-white pt-16">
        {/* Cinematic Banner Area */}
        <div className="relative w-full h-[50vh] md:h-[60vh]">
          <img src={bannerUrl} alt={title} className="w-full h-full object-cover opacity-50 mix-blend-screen" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
          
          <div className="absolute bottom-0 left-0 w-full">
            <div className="container mx-auto px-4 md:px-12 flex flex-col md:flex-row gap-8 items-end pb-8">
              <div className="w-48 md:w-64 flex-shrink-0 rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl translate-y-12 md:translate-y-24 bg-[#141414]">
                <img src={anime.coverImage.extraLarge} alt={title} className="w-full h-auto" />
              </div>
              
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <AnimeStatusBadge status={anime.status} />
                  {anime.averageScore && <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 text-sm">★ {anime.averageScore}%</span>}
                </div>
                <h1 className="text-3xl md:text-5xl font-black mb-2 drop-shadow-lg">{title}</h1>
                <p className="text-slate-400 font-medium mb-6">{anime.title.native}</p>
                
                <div className="flex flex-wrap gap-4 items-center">
                  <AnimeTrackerPanel anime={anime} />
                  
                  {anime.siteUrl && (
                    <a href={anime.siteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-300 hover:text-white transition px-4 py-3 bg-white/5 rounded-full border border-white/10 font-medium">
                      <ExternalLink className="w-4 h-4" /> View on AniList
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="container mx-auto px-4 md:px-12 pt-24 md:pt-32 pb-20 flex flex-col lg:flex-row gap-12">
          
          {/* Main Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">Synopsis</h2>
            <div className="text-slate-300 leading-relaxed text-lg bg-white/5 p-6 rounded-2xl border border-white/5" dangerouslySetInnerHTML={{ __html: anime.description || "No synopsis available." }} />
            
            {nextEp && (
              <div className="mt-8 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-6 flex items-center gap-6">
                <Clock className="w-10 h-10 text-indigo-400" />
                <div>
                  <h3 className="text-xl font-bold text-indigo-100 mb-1">Episode {nextEp.episode} Airing Soon</h3>
                  <p className="text-indigo-300">
                    {Math.floor(nextEp.timeUntilAiring / 86400)} days, {Math.floor((nextEp.timeUntilAiring % 86400) / 3600)} hours, and {Math.floor((nextEp.timeUntilAiring % 3600) / 60)} minutes
                  </p>
                </div>
              </div>
            )}
            
            {/* Official External Links */}
            {anime.externalLinks && anime.externalLinks.length > 0 && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold mb-4">Official Info Links</h2>
                <div className="flex flex-wrap gap-3">
                  {anime.externalLinks.filter(l => l.type === "INFO" || l.type === "SOCIAL").map((link, idx) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition text-slate-300">
                      <ExternalLink className="w-4 h-4" /> {link.site}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Stats */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 text-white border-b border-white/10 pb-2">Information</h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <span className="text-slate-500 block mb-1">Format</span>
                  <span className="text-slate-200 font-medium">{anime.format || "Unknown"}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Episodes</span>
                  <span className="text-slate-200 font-medium">{anime.episodes || "Unknown"}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Duration</span>
                  <span className="text-slate-200 font-medium">{anime.duration ? `${anime.duration} mins` : "Unknown"}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Season</span>
                  <span className="text-slate-200 font-medium capitalize">{anime.season?.toLowerCase()} {anime.seasonYear}</span>
                </li>
                <li>
                  <span className="text-slate-500 block mb-1">Studios</span>
                  <span className="text-slate-200 font-medium">
                    {anime.studios?.nodes.map(s => s.name).join(", ") || "Unknown"}
                  </span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 text-white border-b border-white/10 pb-2">Genres</h3>
              <div className="flex flex-wrap gap-2">
                {anime.genres.map(g => (
                  <span key={g} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-medium">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  } catch (error) {
    return notFound();
  }
}
