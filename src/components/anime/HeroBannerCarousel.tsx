"use client";

import { useState, useEffect } from "react";
import { Anime } from "@tutkli/jikan-ts";
import { Info, PlayCircle } from "lucide-react";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  animes: Anime[];
}

export default function HeroBannerCarousel({ animes }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { openAnime } = useAnimeModal();

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
  const bannerImg = (heroAnime.trailer?.images?.maximum_image_url ||
    heroAnime.images?.jpg?.large_image_url ||
    heroAnime.images?.jpg?.image_url ||
    "") as string;

  return (
    <div className="relative w-full h-[75vh] md:h-[85vh] overflow-hidden bg-[#09090b] mb-10">

      {/* Cinematic key-art background — a clean opacity crossfade with a slow,
          GPU-friendly zoom. No embedded player, so no stray controls and no lag. */}
      <AnimatePresence initial={false}>
        <motion.img
          key={currentIndex}
          src={bannerImg}
          alt="Banner"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 0.45, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.1, ease: "easeInOut" },
            scale: { duration: 7, ease: "easeOut" },
          }}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={{ willChange: "opacity, transform" }}
        />
      </AnimatePresence>

      {/* Static gradient overlays — outside the animated layer so they never
          re-composite on a slide change. */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-20 container mx-auto h-full max-w-4xl">
        <AnimatePresence>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col justify-center px-4 md:px-12 mt-10 md:mt-16"
          >
            {/* Deliberately sparse: title, one line of meta, two actions. The
                synopsis and the full detail set live behind More Info — a hero
                that tries to say everything ends up reading as a wall of text
                over the artwork. */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 md:mb-4 text-white drop-shadow-2xl tracking-tight leading-[1.05] pb-1 line-clamp-3">
              {heroTitle}
            </h1>

            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs md:text-sm font-bold text-slate-300 drop-shadow">
              <span className="text-purple-400">#{currentIndex + 1} Trending</span>
              <span className="text-white/25">•</span>
              <span>{heroAnime.type || "TV"}</span>
              {heroAnime.year && (
                <>
                  <span className="text-white/25">•</span>
                  <span>{heroAnime.year}</span>
                </>
              )}
              {heroAnime.episodes ? (
                <>
                  <span className="text-white/25">•</span>
                  <span>{heroAnime.episodes} Episodes</span>
                </>
              ) : null}
              {heroAnime.score ? (
                <>
                  <span className="text-white/25">•</span>
                  <span className="text-emerald-400">★ {heroAnime.score}</span>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => openAnime(heroAnime, { autoPlay: true })}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-black text-black transition hover:bg-white/90 md:px-9"
              >
                <PlayCircle className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                Play
              </button>
              <button
                onClick={() => openAnime(heroAnime)}
                className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/20 md:px-7"
              >
                <Info className="h-5 w-5" />
                More Info
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-2">
        {animes.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === currentIndex ? "w-8 bg-purple-500" : "w-2 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
