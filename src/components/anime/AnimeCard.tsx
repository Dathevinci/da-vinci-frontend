"use client";


import Link from 'next/link';
import { Info, Clock } from 'lucide-react';
import { AniListAnime } from '@/lib/anilist';
import AnimeStatusBadge from './AnimeStatusBadge';

interface AnimeCardProps {
  anime: AniListAnime;
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const title = anime.title.english || anime.title.romaji || anime.title.userPreferred;
  const imageUrl = anime.coverImage.extraLarge || anime.coverImage.large || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80";

  const nextEp = anime.nextAiringEpisode;
  const daysUntil = nextEp ? Math.floor(nextEp.timeUntilAiring / 86400) : null;
  const hoursUntil = nextEp ? Math.floor((nextEp.timeUntilAiring % 86400) / 3600) : null;

  return (
    <Link href={`/anime/${anime.id}`}>
      <div 
        style={{ willChange: "transform" }}
        className="relative group w-[160px] md:w-[220px] aspect-[2/3] rounded-xl overflow-hidden cursor-pointer flex-shrink-0 transition-transform duration-300 hover:scale-105 hover:z-50 shadow-xl border border-white/5 bg-[#141414] snap-start"
      >
        <img 
          src={imageUrl} 
          alt={title} 
          className="object-cover w-full h-full"
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1">
          <AnimeStatusBadge status={anime.status} />
          {anime.averageScore && (
            <span className="bg-indigo-600/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md backdrop-blur-sm">
              ★ {anime.averageScore}
            </span>
          )}
        </div>

        {/* Hover Card Details */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <h3 className="font-bold text-white leading-tight drop-shadow-md mb-2 line-clamp-2">{title}</h3>
          
          {nextEp && (
            <div className="flex items-center gap-1 text-xs text-indigo-300 font-medium mb-3 bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
              <Clock className="w-3 h-3" />
              <span>Ep {nextEp.episode} in {daysUntil! > 0 ? `${daysUntil}d ` : ''}{hoursUntil}h</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1 mb-3">
            {anime.genres.slice(0, 3).map(g => (
              <span key={g} className="text-[9px] uppercase tracking-wider bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
                {g}
              </span>
            ))}
          </div>

          <button className="w-full py-2 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm font-semibold transition">
            <Info className="w-4 h-4" />
            Details
          </button>
        </div>
      </div>
    </Link>
  );
}
