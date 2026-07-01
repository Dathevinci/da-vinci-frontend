"use client";

import { useState, useEffect } from "react";
import { AniListAnime } from "@/lib/anilist";
import { Info, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";
import AnimeStatusBadge from "./AnimeStatusBadge";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  animes: AniListAnime[];
}

export default function HeroBannerCarousel({ animes }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (animes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % animes.length);
    }, 7000); // 7 seconds per slide

    return () => clearInterval(interval);
  }, [animes.length]);

  if (!animes || animes.length === 0) return null;

  const heroAnime = animes[currentIndex];
  const heroTitle = heroAnime.title.english || heroAnime.title.romaji || heroAnime.title.userPreferred;
  const nextEp = heroAnime.nextAiringEpisode;

  return (
    <div className="relative w-full h-[75vh] md:h-[85vh] overflow-hidden bg-[#09090b] mb-10">
      
      {/* Background Images with AnimatePresence for smooth crossfade */}
      <AnimatePresence initial={false}>
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={heroAnime.bannerImage || heroAnime.coverImage.extraLarge} 
            alt="Banner" 
            className="w-full h-full object-cover opacity-60 mix-blend-screen"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 container mx-auto h-full max-w-4xl">
        <AnimatePresence>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col justify-center px-4 md:px-12 mt-10 md:mt-16"
          >
            <div className="mb-4 flex items-center gap-3">
              <AnimeStatusBadge status={heroAnime.status} />
              <span className="text-indigo-400 font-bold uppercase tracking-widest text-sm flex items-center gap-1">
                <PlayCircle className="w-4 h-4" /> #{currentIndex + 1} Trending
              </span>
            </div>
            <h1 className="text-4xl md:text-7xl font-black mb-2 md:mb-4 text-white drop-shadow-2xl tracking-tight leading-snug pb-2 line-clamp-2 sm:line-clamp-3">
              {heroTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-white mb-4 md:mb-6 drop-shadow">
              {heroAnime.averageScore && <span className="text-green-400 text-base md:text-lg">★ {heroAnime.averageScore}%</span>}
              <span className="text-slate-300">{heroAnime.season} {heroAnime.seasonYear}</span>
              <span className="border border-white/20 bg-white/10 px-2 rounded">{heroAnime.format || "TV"}</span>
              <span className="text-slate-400">{heroAnime.episodes ? `${heroAnime.episodes} Eps` : "Unknown Eps"}</span>
            </div>

            {nextEp && (
              <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 p-3 md:p-4 rounded-lg inline-flex items-center gap-3 md:gap-4 mb-4 md:mb-6 shadow-lg backdrop-blur-md">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                <div>
                  <div className="text-[10px] md:text-xs text-indigo-300 uppercase font-bold tracking-wider">Next Ep {nextEp.episode}</div>
                  <div className="text-base md:text-lg font-bold">In {Math.floor(nextEp.timeUntilAiring / 86400)}d {Math.floor((nextEp.timeUntilAiring % 86400) / 3600)}h</div>
                </div>
              </div>
            )}

            <p className="text-sm md:text-lg text-slate-300 mb-6 md:mb-8 line-clamp-3 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: heroAnime.description || "" }} />

            <div className="flex items-center gap-4">
              <Link href={`/anime/${heroAnime.id}`}>
                <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 md:px-8 md:py-3 rounded-full text-base md:text-lg font-bold transition shadow-xl shadow-indigo-600/20">
                  <Info className="w-4 h-4 md:w-5 md:h-5" />
                  View Details
                </button>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-2">
        {animes.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === currentIndex ? 'w-8 bg-indigo-500' : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
