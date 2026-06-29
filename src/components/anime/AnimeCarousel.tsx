"use client";

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnimeCard from './AnimeCard';
import { AniListAnime } from '@/lib/anilist';
import Link from 'next/link';

interface AnimeCarouselProps {
  title: string;
  animes: AniListAnime[];
}

export default function AnimeCarousel({ title, animes }: AnimeCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!animes || animes.length === 0) return null;

  return (
    <div className="mb-8 md:mb-12 relative group pl-4 md:pl-12 hover:z-50 z-10 transition-all duration-300">
      <h2 className="text-xl md:text-2xl font-bold text-[#e5e5e5] mb-2 md:mb-4 px-2">{title}</h2>
      
      <div className="relative">
        <button 
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-16 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-start pl-2 hover:w-20 hover:from-[#141414]"
        >
          <ChevronLeft className="w-8 h-8 text-white transition-transform hover:scale-125 hover:text-indigo-400 drop-shadow-2xl" />
        </button>

        <div 
          ref={rowRef}
          style={{ willChange: "scroll-position, transform" }}
          className="flex gap-2 md:gap-4 overflow-x-auto hide-scrollbar scroll-smooth px-2 pt-28 pb-32 -mt-24 -mb-24 snap-x snap-mandatory"
        >
          {animes.map(a => <AnimeCard key={a.id} anime={a} />)}
          
          {/* See More Card */}
          <Link href="/search" className="snap-start">
            <div className="relative w-[160px] md:w-[220px] aspect-[2/3] rounded-xl flex-shrink-0 flex items-center justify-center bg-[#141414]/30 border border-white/5 hover:bg-[#141414]/80 transition-colors cursor-pointer group/card hover:scale-105 duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:border-indigo-500/30">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full border-2 border-white/10 flex items-center justify-center group-hover/card:border-indigo-400 transition-colors bg-black/40 shadow-lg">
                  <ChevronRight className="w-8 h-8 text-white group-hover/card:translate-x-1 group-hover/card:text-indigo-400 transition-all" />
                </div>
                <span className="text-slate-400 font-bold tracking-widest uppercase text-xs md:text-sm group-hover/card:text-white transition-colors">See All</span>
              </div>
            </div>
          </Link>
        </div>

        <button 
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-16 bg-gradient-to-l from-[#09090b] via-[#09090b]/80 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-end pr-2 hover:w-20 hover:from-[#141414]"
        >
          <ChevronRight className="w-8 h-8 text-white transition-transform hover:scale-125 hover:text-indigo-400 drop-shadow-2xl" />
        </button>
      </div>
    </div>
  );
}
