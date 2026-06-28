"use client";

import { useRef } from 'react';
import { PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AMVSection() {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const amvs = [
    { id: "O6q5ITceSPA", title: "Jujutsu Kaisen S2 Official Trailer" },
    { id: "VQGCKyvzIG4", title: "Demon Slayer Official Trailer" },
    { id: "SlNpRThS9t8", title: "Attack on Titan Final Season" },
    { id: "cXeb9cb6k0I", title: "Naruto Shippuden Op 16" },
    { id: "mhnjEIf3dIQ", title: "One Piece Gear 5 Trailer" },
    { id: "e8YBescmvVU", title: "Bleach TYBW Trailer" },
    { id: "OAYs6r1x9U0", title: "Spy x Family Trailer" },
    { id: "q15CRdE5Bv0", title: "Chainsaw Man Trailer" },
    { id: "e-oVbJ7s5z4", title: "Solo Leveling Trailer" },
    { id: "qQxJkYl2IEM", title: "Frieren Trailer" },
  ];

  return (
    <div className="mb-8 md:mb-16 relative group pl-4 md:pl-12 z-30">
      <div className="flex items-center gap-3 mb-2 md:mb-4 px-2">
        <PlayCircle className="w-6 h-6 md:w-8 md:h-8 text-secondary animate-pulse" />
        <h2 className="text-xl md:text-2xl font-bold text-[#e5e5e5]">Epic AMVs & Trailers</h2>
      </div>
      
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
          className="flex gap-4 overflow-x-auto hide-scrollbar scroll-smooth px-2 pb-10 pt-4 snap-x snap-mandatory"
        >
          {amvs.map((amv) => (
            <div 
              key={amv.id} 
              style={{ willChange: "transform" }}
              className="relative flex-shrink-0 w-[280px] md:w-[400px] rounded-xl overflow-hidden shadow-xl border border-white/5 bg-[#141414] aspect-video transition-transform duration-300 hover:scale-105 hover:z-50 snap-start"
            >
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${amv.id}?controls=1&rel=0`}
                title={amv.title}
                frameBorder="0"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ))}

          {/* See All Button */}
          <Link href="https://www.youtube.com/results?search_query=epic+anime+amv" target="_blank" rel="noopener noreferrer" className="snap-start">
            <div className="relative w-[280px] md:w-[400px] aspect-video rounded-xl flex-shrink-0 flex items-center justify-center bg-[#141414]/30 border border-white/5 hover:bg-[#141414]/80 transition-colors cursor-pointer group/card hover:scale-105 duration-300 hover:shadow-[0_0_30px_rgba(229,9,20,0.2)] hover:border-secondary/30">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full border-2 border-white/10 flex items-center justify-center group-hover/card:border-secondary transition-colors bg-black/40 shadow-lg">
                  <ChevronRight className="w-8 h-8 text-white group-hover/card:translate-x-1 group-hover/card:text-secondary transition-all" />
                </div>
                <span className="text-slate-400 font-bold tracking-widest uppercase text-xs md:text-sm group-hover/card:text-white transition-colors">See All AMVs</span>
              </div>
            </div>
          </Link>
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
