"use client";

import { useState, useEffect } from "react";
import { Anime } from "@tutkli/jikan-ts";
import { Info, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";
import AnimeStatusBadge from "./AnimeStatusBadge";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  animes: Anime[];
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
  const heroTitle = heroAnime.title_english || heroAnime.title;

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
            src={(heroAnime.trailer?.images?.maximum_image_url || heroAnime.images?.jpg?.large_image_url || heroAnime.images?.jpg?.image_url || "") as string} 
            alt="Banner" 
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          
          {/* YouTube Trailer Video Background */}
          {heroAnime.trailer?.youtube_id && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <iframe
                src={`https://www.youtube.com/embed/${heroAnime.trailer.youtube_id}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&loop=1&modestbranding=1&playsinline=1&color=white&iv_load_policy=3&playlist=${heroAnime.trailer.youtube_id}`}
                allow="autoplay; encrypted-media"
                className="absolute top-1/2 left-1/2 w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] -translate-x-1/2 -translate-y-1/2 opacity-80"
              />
            </div>
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent" />
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
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
              <AnimeStatusBadge status={heroAnime.status || "Unknown"} />
              <span className="text-indigo-400 font-bold uppercase tracking-widest text-sm flex items-center gap-1">
                <PlayCircle className="w-4 h-4" /> #{currentIndex + 1} Trending
              </span>
            </div>
            <h1 className="text-4xl md:text-7xl font-black mb-2 md:mb-4 text-white drop-shadow-2xl tracking-tight leading-snug pb-2">
              {heroTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-white mb-4 md:mb-6 drop-shadow">
              {heroAnime.score && <span className="text-green-400 text-base md:text-lg">★ {heroAnime.score}</span>}
              <span className="text-slate-300">{heroAnime.season} {heroAnime.year}</span>
              <span className="border border-white/20 bg-white/10 px-2 rounded">{heroAnime.type || "TV"}</span>
              <span className="text-slate-400">{heroAnime.episodes ? `${heroAnime.episodes} Eps` : "Unknown Eps"}</span>
            </div>

            <p className="text-sm md:text-lg text-slate-300 mb-6 md:mb-8 line-clamp-3 leading-relaxed font-medium">
              {heroAnime.synopsis || "No synopsis available."}
            </p>

            <div className="flex items-center gap-4">
              <Link href={`/anime/${heroAnime.mal_id}`}>
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
