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
    // Disable hover popups on touch devices (Android Web / iOS) for a fluid UI
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      timeoutRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 400); // 400ms delay to prevent chaotic popping
    }
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
      */}
      <div className="absolute inset-0 rounded-xl overflow-hidden shadow-lg border border-white/5 bg-[#141414] cursor-pointer">
        <img src={imageUrl} alt={title} className="object-cover w-full h-full" />
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
          <AnimeStatusBadge status={anime.status} />
          {anime.averageScore && (
            <span className="bg-indigo-600/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md backdrop-blur-sm">
              ★ {anime.averageScore}
            </span>
          )}
        </div>
      </div>

      {/* 
        NETFLIX POP-OUT CARD 
        Overlays exactly on top of the base card and scales slightly.
      */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1.15, zIndex: 50 }}
            exit={{ opacity: 0, scale: 0.95, zIndex: 50 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 bg-[#18181b] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/20 flex flex-col cursor-pointer"
            style={{ transformOrigin: 'center center' }}
          >
            <Link href={`/anime/${anime.id}`} className="block w-full h-full relative">
              <img 
                src={imageUrl} 
                alt={title} 
                className="absolute inset-0 object-cover w-full h-full"
              />
              
              {/* Inner Badges */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
                <AnimeStatusBadge status={anime.status} />
              </div>

              {/* Gradient Overlay for Content */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent flex flex-col justify-end p-3 pb-4">
                
                <h3 className="font-black text-sm md:text-base text-white leading-tight drop-shadow-md line-clamp-2 mb-2">
                  {title}
                </h3>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 mb-2">
                   <button className="w-7 h-7 md:w-8 md:h-8 bg-white text-black flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
                     <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current ml-0.5" />
                   </button>
                   <button className="w-7 h-7 md:w-8 md:h-8 border-2 border-slate-400 text-white flex items-center justify-center rounded-full hover:border-white hover:bg-white/10 transition-colors">
                     <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                   </button>
                   <button className="w-7 h-7 md:w-8 md:h-8 border-2 border-slate-400 text-white flex items-center justify-center rounded-full hover:border-white hover:bg-white/10 transition-colors">
                     <ThumbsUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                   </button>
                   <button className="w-7 h-7 md:w-8 md:h-8 border-2 border-slate-400 text-white flex items-center justify-center rounded-full hover:border-white hover:bg-white/10 transition-colors ml-auto">
                     <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                   </button>
                </div>
                
                {/* Metadata */}
                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold mb-1.5">
                  {anime.averageScore && <span className="text-green-400">{anime.averageScore}% Match</span>}
                  <span className="border border-white/20 px-1 py-0.5 rounded text-slate-200">{anime.format || "TV"}</span>
                  <span className="text-slate-200">{anime.episodes ? `${anime.episodes} EPS` : "Ongoing"}</span>
                </div>

                {/* Genres */}
                <div className="flex flex-wrap items-center gap-1">
                  {anime.genres.slice(0, 3).map((g, i) => (
                    <div key={g} className="flex items-center gap-1">
                      <span className="text-[9px] md:text-[10px] text-slate-300 font-medium">{g}</span>
                      {i < Math.min(anime.genres.length, 3) - 1 && <span className="text-slate-600 text-[8px]">●</span>}
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
