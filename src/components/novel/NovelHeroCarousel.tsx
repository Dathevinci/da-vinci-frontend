"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, PlayCircle } from "lucide-react";
import { useNovelModal } from "@/components/providers/NovelModalProvider";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import { useNovelCover } from "@/lib/novel/useNovelCover";

/**
 * Full-bleed hero for Novel mode.
 *
 * Replaces the old 3D card carousel. Identical layout to the anime and manhwa
 * heroes and deliberately sparse: title, one dot-separated meta line, two
 * actions. The synopsis and chapter list live behind More Info.
 *
 * Accent is pink here — anime is purple, manhwa crimson — so each mode keeps
 * its identity while the shape stays the same.
 */
export default function NovelHeroCarousel({ items }: { items: NovelResult[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { openNovel } = useNovelModal();

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [items.length]);

  const hero = items && items.length > 0 ? items[currentIndex] : null;
  // Hook order must stay stable, so this runs before any early return.
  const { cover } = useNovelCover(hero?.title || "", hero?.cover);

  if (!hero) return null;

  return (
    <div className="relative mb-10 h-[75vh] w-full overflow-hidden bg-[#09090b] md:h-[85vh]">
      <AnimatePresence initial={false}>
        <motion.img
          key={currentIndex}
          src={cover || ""}
          alt=""
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 0.4, scale: 1 }}
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
              <span className="text-pink-400">#{currentIndex + 1} Trending</span>
              <span className="text-white/25">•</span>
              <span>Light Novel</span>
              {hero.latestChapter ? (
                <>
                  <span className="text-white/25">•</span>
                  <span className="line-clamp-1">{hero.latestChapter}</span>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => openNovel(hero)}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-black text-black transition hover:bg-white/90 md:px-9"
              >
                <PlayCircle className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                Read
              </button>
              <button
                onClick={() => openNovel(hero)}
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
              idx === currentIndex ? "w-8 bg-pink-500" : "w-2 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
