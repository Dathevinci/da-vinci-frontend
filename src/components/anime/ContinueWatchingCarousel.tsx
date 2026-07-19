"use client";

import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ContinueWatchingCard from './ContinueWatchingCard';
import { useAnimeStatus } from '@/hooks/useAnimeStatus';
import { useUser } from '@/hooks/useUser';

export default function ContinueWatchingCarousel() {
  const rowRef = useRef<HTMLDivElement>(null);
  const { getTrackedList, isLoaded: statusLoaded } = useAnimeStatus();
  const { user, isLoaded: userLoaded } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  // Only render on client to avoid hydration mismatch
  if (!mounted || !statusLoaded || !userLoaded) return null;

  // We show it for tracked anime with status "Watching", excluding unreleased ones
  const rawWatchingList = getTrackedList("Watching");
  const watchingList = rawWatchingList.filter(item => {
    const rawStatus = String((item.anime as any)._anilistStatus || item.anime.status || "").toLowerCase();
    let isFutureDate = false;
    if (item.anime.aired?.from) {
      const airedDate = new Date(item.anime.aired.from).getTime();
      if (airedDate > Date.now()) {
        isFutureDate = true;
      }
    }
    const isUnreleased = isFutureDate || rawStatus.includes("not_yet") || rawStatus.includes("not yet") || rawStatus.includes("upcoming") || rawStatus.includes("tba");
    return !isUnreleased;
  });

  // If user has no watching list, don't show the section
  if (!watchingList || watchingList.length === 0) return null;

  // Use the username if available, else a generic title
  const title = user ? `Continue watching for ${user.username}` : "Continue watching";

  return (
    <div className="mb-8 md:mb-12 relative group pl-4 md:pl-12 hover:z-50 z-10 transition-all duration-300">
      <h2 className="text-xl md:text-2xl font-bold text-[#e5e5e5] mb-2 md:mb-4 px-2 tracking-wide">
        {title}
      </h2>
      
      <div className="relative">
        <button 
          onClick={() => handleScroll('left')}
          className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 z-[60] w-10 h-10 md:w-12 md:h-12 bg-black/60 border border-white/10 rounded-full flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/80 hover:scale-110 hover:border-purple-500/50 transition-all backdrop-blur-md shadow-2xl"
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white transition-transform hover:text-purple-400" />
        </button>

        <div
          ref={rowRef}
          style={{ overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
          className="flex gap-4 overflow-x-auto hide-scrollbar scroll-smooth px-2 pt-4 pb-8 -mt-4 -mb-4 snap-x snap-mandatory"
        >
          {watchingList.map(item => (
            <ContinueWatchingCard key={item.anime.mal_id} anime={item.anime} />
          ))}
        </div>

        <button 
          onClick={() => handleScroll('right')}
          className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 z-[60] w-10 h-10 md:w-12 md:h-12 bg-black/60 border border-white/10 rounded-full flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/80 hover:scale-110 hover:border-purple-500/50 transition-all backdrop-blur-md shadow-2xl"
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white transition-transform hover:text-purple-400" />
        </button>
      </div>
    </div>
  );
}
