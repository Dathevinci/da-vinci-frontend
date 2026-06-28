"use client";

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnimeCard from './AnimeCard';
import { AniListAnime } from '@/lib/anilist';

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
    <div className="mb-8 md:mb-12 relative group pl-4 md:pl-12">
      <h2 className="text-xl md:text-2xl font-bold text-[#e5e5e5] mb-2 md:mb-4 px-2">{title}</h2>
      
      <div className="relative">
        <button 
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
        >
          <ChevronLeft className="w-8 h-8 text-white scale-150 transition-transform hover:scale-[2]" />
        </button>

        <div 
          ref={rowRef}
          style={{ willChange: "scroll-position, transform" }}
          className="flex gap-2 md:gap-4 overflow-x-auto hide-scrollbar scroll-smooth px-2 pb-8 pt-4 snap-x snap-mandatory"
        >
          {animes.map(a => <AnimeCard key={a.id} anime={a} />)}
        </div>

        <button 
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
        >
          <ChevronRight className="w-8 h-8 text-white scale-150 transition-transform hover:scale-[2]" />
        </button>
      </div>
    </div>
  );
}
