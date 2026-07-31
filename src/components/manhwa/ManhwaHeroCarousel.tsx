"use client";

import { useState, useEffect } from "react";
import { IMangaResult } from "@/lib/asura/models";
import { Info, PlayCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useManhwaModal } from "@/components/providers/ManhwaModalProvider";

/**
 * Full-bleed hero for Manhwa mode.
 *
 * Replaces the old 3D card carousel. Same shape as the anime hero and
 * deliberately sparse: title, one dot-separated meta line, two actions.
 * Everything else sits behind More Info — a hero that tries to say everything
 * reads as text pasted over the artwork instead of a poster.
 *
 * Accent is crimson here; anime is purple and novels are pink, so each mode
 * keeps its identity while the layout stays identical.
 */
export default function ManhwaHeroCarousel({ items }: { items: IMangaResult[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { openManhwa } = useManhwaModal();

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!items || items.length === 0) return null;

  const hero = items[currentIndex];
  // Covers are hotlink-protected upstream, so they go through the same proxy
  // the reader uses rather than being hit directly.
  const bannerImg = hero.image ? `/api/manhwa-image?url=${encodeURIComponent(hero.image)}` : "";

  return (
    <div className="relative mb-10 h-[56vh] w-full overflow-hidden bg-[#09090b] md:h-[66vh]">
      <AnimatePresence initial={false}>
        <motion.img
          key={currentIndex}
          src={bannerImg}
          alt=""
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

      {/* Static overlays, outside the animated layer so they never re-composite
          on a slide change. */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />

      <div className="relative z-20 container mx-auto h-full max-w-4xl">
        <AnimatePresence>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 mt-10 flex flex-col justify-center px-4 md:mt-16 md:px-12"
          >
            <h1 className="mb-3 line-clamp-3 pb-1 text-3xl font-black uppercase leading-[1.05] tracking-tight text-white drop-shadow-2xl sm:text-5xl md:mb-4 md:text-6xl lg:text-7xl">
              {hero.title}
            </h1>

            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-slate-300 drop-shadow md:text-sm">
              <span className="text-red-500">#{currentIndex + 1} Trending</span>
              <span className="text-white/25">•</span>
              <span>Manhwa</span>
              {hero.status ? (
                <>
                  <span className="text-white/25">•</span>
                  <span>{hero.status}</span>
                </>
              ) : null}
              {hero.rating ? (
                <>
                  <span className="text-white/25">•</span>
                  <span className="text-emerald-400">★ {hero.rating}</span>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => openManhwa(hero)}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-black text-black transition hover:bg-white/90 md:px-9"
              >
                <PlayCircle className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                Read
              </button>
              <button
                onClick={() => openManhwa(hero)}
                className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/20 md:px-7"
              >
                <Info className="h-5 w-5" />
                More Info
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-2">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === currentIndex ? "w-8 bg-red-600" : "w-2 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
