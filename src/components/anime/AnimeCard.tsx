"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Info, Clock, PlayCircle, Plus } from 'lucide-react';
import { AniListAnime } from '@/lib/anilist';
import AnimeStatusBadge from './AnimeStatusBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface AnimeCardProps {
  anime: AniListAnime;
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleMouseEnter = () => {
    if (cardRef.current) {
      setRect(cardRef.current.getBoundingClientRect());
    }
    hoverTimeout.current = setTimeout(() => setIsHovered(true), 400); // Netflix 400ms delay
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsHovered(false);
  };

  const title = anime.title.english || anime.title.romaji || anime.title.userPreferred;
  const imageUrl = anime.coverImage.extraLarge || anime.coverImage.large || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80";
  const bannerUrl = anime.bannerImage || imageUrl;
  const nextEp = anime.nextAiringEpisode;

  return (
    <div 
      className="relative group w-[160px] md:w-[220px] aspect-[2/3] flex-shrink-0 snap-start"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Card */}
      <Link href={`/anime/${anime.id}`} className="block w-full h-full">
        <div 
          ref={cardRef}
          className="relative w-full h-full cursor-pointer rounded-xl overflow-hidden shadow-xl border border-white/5 bg-[#141414]"
        >
          <img 
            src={imageUrl} 
            alt={title} 
            className="object-cover w-full h-full"
          />
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1">
            <AnimeStatusBadge status={anime.status} />
            {anime.averageScore && (
              <span className="bg-indigo-600/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md backdrop-blur-sm">
                ★ {anime.averageScore}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Pop-Out Hover Card (Netflix Style via Portal) */}
      {/* Because this Portal is a React child of the wrapping div, React's synthetic onMouseLeave 
          won't fire when the mouse moves from the base card into the Portal! */}
      {mounted && createPortal(
        <AnimatePresence>
          {isHovered && rect && (
            <div 
              className="fixed inset-0 z-[100] pointer-events-none" 
              style={{ pointerEvents: isHovered ? 'auto' : 'none' }}
            >
              {/* Global Backdrop Blur */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                onMouseEnter={handleMouseLeave}
              />
              
              {/* The Expanded Card */}
              <motion.div 
                initial={{ opacity: 0, scale: 1, y: 0 }}
                animate={{ opacity: 1, scale: 1.25, y: -10 }}
                exit={{ opacity: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="absolute bg-[#18181b] rounded-xl shadow-2xl overflow-hidden border border-white/10"
                style={{ 
                  top: rect.top, 
                  left: rect.left, 
                  width: rect.width, 
                  height: rect.height,
                  originY: 0.5, 
                  originX: 0.5,
                  transformOrigin: "center center"
                }}
              >
                {/* Banner/Video Area */}
                <Link href={`/anime/${anime.id}`}>
                  <div className="relative w-full aspect-[16/10] bg-black cursor-pointer group/banner">
                    <img src={bannerUrl} alt={title} className="w-full h-full object-cover opacity-80 transition group-hover/banner:opacity-100" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/20 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                      <h3 className="font-black text-sm md:text-base text-white leading-tight drop-shadow-md line-clamp-2 w-3/4">{title}</h3>
                      <button className="bg-white text-black p-1.5 rounded-full hover:bg-slate-200 transition shadow-lg shrink-0">
                        <PlayCircle className="w-5 h-5 fill-black" />
                      </button>
                    </div>
                  </div>
                </Link>

                {/* Info Area */}
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-300">
                    <span className="text-green-400">{anime.averageScore ? `${anime.averageScore}% Match` : 'New'}</span>
                    <span className="border border-white/20 px-1 rounded">{anime.format || "TV"}</span>
                    <span>{anime.episodes ? `${anime.episodes} EPS` : "Ongoing"}</span>
                  </div>
                  
                  {nextEp && (
                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-bold bg-indigo-500/10 p-1.5 rounded">
                      <Clock className="w-3 h-3" />
                      Ep {nextEp.episode} airs in {Math.floor(nextEp.timeUntilAiring / 86400)}d
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {anime.genres.slice(0, 3).map(g => (
                      <span key={g} className="text-[9px] uppercase tracking-wider text-slate-400">
                        {g} •
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Link href={`/anime/${anime.id}`} className="block">
                      <button className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold transition cursor-pointer">
                        <Info className="w-3.5 h-3.5" /> Details
                      </button>
                    </Link>
                    <button className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded text-[10px] font-bold transition cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> List
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
