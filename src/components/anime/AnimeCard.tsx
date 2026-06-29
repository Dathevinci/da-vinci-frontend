"use client";

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Info, Clock, Play, Plus, ThumbsUp, ChevronDown } from 'lucide-react';
import { AniListAnime } from '@/lib/anilist';
import AnimeStatusBadge from './AnimeStatusBadge';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimeCardProps {
  anime: AniListAnime;
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 400); // 400ms delay to prevent chaotic popping
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };

  const title = anime.title.english || anime.title.romaji || anime.title.userPreferred;
  const imageUrl = anime.coverImage.extraLarge || anime.coverImage.large || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80";
  const nextEp = anime.nextAiringEpisode;

  return (
    <div 
      className="relative w-[160px] md:w-[220px] aspect-[2/3] flex-shrink-0 snap-start"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 
        BASE CARD 
        Always visible, sits at z-0. 
        When the popout appears, it covers this base card perfectly before scaling. 
      */}
      <div className="absolute inset-0 rounded-xl overflow-hidden shadow-lg border border-white/5 bg-[#141414] cursor-pointer">
        <Link href={`/anime/${anime.id}`} className="block w-full h-full">
          <img 
            src={imageUrl} 
            alt={title} 
            className="object-cover w-full h-full"
          />
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
            <AnimeStatusBadge status={anime.status} />
            {anime.averageScore && (
              <span className="bg-indigo-600/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md backdrop-blur-sm">
                ★ {anime.averageScore}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* 
        NETFLIX POP-OUT CARD 
        Appears strictly on hover, scales up, and overflows its bounds. 
      */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1.15, zIndex: 50, y: -10 }}
            exit={{ opacity: 0, scale: 0.95, zIndex: 50 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute top-0 left-0 w-full bg-[#18181b] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col cursor-pointer"
            style={{ transformOrigin: 'center center' }}
          >
            <Link href={`/anime/${anime.id}`} className="block w-full">
              {/* Top Half: Image */}
              <div className="relative aspect-[2/3] w-full bg-[#141414]">
                 <img 
                   src={imageUrl} 
                   alt={title} 
                   className="object-cover w-full h-full"
                 />
                 
                 {/* Inner Badges duplicated so they don't disappear on scale */}
                 <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
                   <AnimeStatusBadge status={anime.status} />
                 </div>

                 {/* Gradient Overlay for Title */}
                 <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/60 to-transparent h-[40%] flex items-end p-4 pb-2">
                    <h3 className="font-black text-sm md:text-base text-white leading-tight drop-shadow-md line-clamp-2">
                      {title}
                    </h3>
                 </div>
              </div>
              
              {/* Bottom Half: Control Panel */}
              <div className="p-4 flex flex-col gap-3">
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                   <button className="w-8 h-8 md:w-9 md:h-9 bg-white text-black flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
                     <Play className="w-4 h-4 md:w-4 md:h-4 fill-current ml-0.5" />
                   </button>
                   <button className="w-8 h-8 md:w-9 md:h-9 border-2 border-slate-500 text-slate-300 flex items-center justify-center rounded-full hover:border-white hover:text-white hover:bg-white/10 transition-colors">
                     <Plus className="w-4 h-4 md:w-4 md:h-4" />
                   </button>
                   <button className="w-8 h-8 md:w-9 md:h-9 border-2 border-slate-500 text-slate-300 flex items-center justify-center rounded-full hover:border-white hover:text-white hover:bg-white/10 transition-colors">
                     <ThumbsUp className="w-4 h-4 md:w-4 md:h-4" />
                   </button>
                   <button className="w-8 h-8 md:w-9 md:h-9 border-2 border-slate-500 text-slate-300 flex items-center justify-center rounded-full hover:border-white hover:text-white hover:bg-white/10 transition-colors ml-auto">
                     <ChevronDown className="w-4 h-4 md:w-4 md:h-4" />
                   </button>
                </div>
                
                {/* Metadata */}
                <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold mt-1">
                  {anime.averageScore && <span className="text-green-400">{anime.averageScore}% Match</span>}
                  <span className="border border-slate-600 px-1.5 py-0.5 rounded text-slate-300">{anime.format || "TV"}</span>
                  <span className="text-slate-300">{anime.episodes ? `${anime.episodes} EPS` : "Ongoing"}</span>
                </div>

                {/* Next Episode Box */}
                {nextEp && (
                  <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-indigo-300 font-bold bg-indigo-500/10 px-2 py-1.5 rounded w-fit border border-indigo-500/20">
                    <Clock className="w-3 h-3" />
                    Ep {nextEp.episode} in {Math.floor(nextEp.timeUntilAiring / 86400)}d
                  </div>
                )}

                {/* Netflix-style dotted genres */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {anime.genres.slice(0, 3).map((g, i) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <span className="text-[10px] md:text-[11px] text-slate-100 font-medium">{g}</span>
                      {i < Math.min(anime.genres.length, 3) - 1 && <span className="text-slate-600 text-[10px]">●</span>}
                    </div>
                  ))}
                </div>

              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
