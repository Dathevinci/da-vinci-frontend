"use client";

import Link from 'next/link';
import { Info, Clock, PlayCircle, Plus } from 'lucide-react';
import { AniListAnime } from '@/lib/anilist';
import AnimeStatusBadge from './AnimeStatusBadge';
import { motion } from 'framer-motion';

interface AnimeCardProps {
  anime: AniListAnime;
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const title = anime.title.english || anime.title.romaji || anime.title.userPreferred;
  const imageUrl = anime.coverImage.extraLarge || anime.coverImage.large || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80";
  const nextEp = anime.nextAiringEpisode;

  return (
    <div className="relative group w-[160px] md:w-[220px] aspect-[2/3] flex-shrink-0 snap-start rounded-xl overflow-hidden shadow-lg border border-white/5 bg-[#141414] cursor-pointer">
      <Link href={`/anime/${anime.id}`} className="block w-full h-full">
        {/* Background Image with Scale on Hover */}
        <div className="w-full h-full overflow-hidden relative">
          <img 
            src={imageUrl} 
            alt={title} 
            className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-110"
          />
          
          {/* Top Badges (Always visible but fade slightly on hover) */}
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10 transition-opacity duration-300 group-hover:opacity-0">
            <AnimeStatusBadge status={anime.status} />
            {anime.averageScore && (
              <span className="bg-indigo-600/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md backdrop-blur-sm">
                ★ {anime.averageScore}
              </span>
            )}
          </div>

          {/* Hover Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 md:p-4 z-20">
            
            {/* Play Button Center (Slides down slightly) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
              <PlayCircle className="w-12 h-12 text-white/80 hover:text-white drop-shadow-xl" />
            </div>

            {/* Bottom Info Content (Slides up) */}
            <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-out">
              <h3 className="font-black text-sm md:text-base text-white leading-tight drop-shadow-md line-clamp-2 mb-1.5">
                {title}
              </h3>
              
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 mb-2">
                {anime.averageScore && <span className="text-green-400">{anime.averageScore}% Match</span>}
                <span className="border border-white/20 px-1 rounded">{anime.format || "TV"}</span>
                <span>{anime.episodes ? `${anime.episodes} EPS` : "Ongoing"}</span>
              </div>

              {nextEp && (
                <div className="flex items-center gap-1.5 text-[9px] text-indigo-300 font-bold bg-indigo-500/10 p-1 rounded w-fit mb-2 border border-indigo-500/20">
                  <Clock className="w-3 h-3" />
                  Ep {nextEp.episode} in {Math.floor(nextEp.timeUntilAiring / 86400)}d
                </div>
              )}

              <div className="flex flex-wrap gap-1 mb-3">
                {anime.genres.slice(0, 3).map(g => (
                  <span key={g} className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
                    {g}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="w-full py-1.5 flex items-center justify-center gap-1 bg-white hover:bg-slate-200 text-black rounded text-[10px] font-bold transition">
                  <Info className="w-3.5 h-3.5" /> Details
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); /* TODO: Add to list */ }}
                  className="w-full py-1.5 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold transition backdrop-blur-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> List
                </button>
              </div>
            </div>

          </div>
        </div>
      </Link>
    </div>
  );
}
