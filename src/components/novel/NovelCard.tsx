"use client";

import { useState, useRef, useEffect } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import { useNovelModal } from "@/components/providers/NovelModalProvider";
import NovelTrackerButton from "@/components/novel/NovelTrackerButton";
import { novelCover } from "@/lib/novelImage";

// In-memory cache to prevent re-fetching the same cover across multiple cards
const coverCache = new Map<string, string | null>();

export default function NovelCard({ novel }: { novel: NovelResult }) {
  const { openNovel } = useNovelModal();

  const [isHovered, setIsHovered] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [highResCover, setHighResCover] = useState<string | null | undefined>(coverCache.has(novel.title) ? coverCache.get(novel.title) : undefined);
  const baseCover = novelCover(novel.cover);
  const cover = highResCover || baseCover;

  useEffect(() => {
    if (highResCover !== undefined) return;
    
    // Check if another card already fetched this
    if (coverCache.has(novel.title)) {
      setHighResCover(coverCache.get(novel.title) || null);
      return;
    }

    fetch(`/api/novels/cover?title=${encodeURIComponent(novel.title)}`)
      .then(res => res.json())
      .then(data => {
        if (data.cover) {
          coverCache.set(novel.title, data.cover);
          setHighResCover(data.cover);
        } else {
          coverCache.set(novel.title, null);
        }
      })
      .catch(() => {
        coverCache.set(novel.title, null);
      });
  }, [novel.title, highResCover]);

  const closeHover = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };
  const handleOpen = () => {
    closeHover();
    openNovel(novel);
  };

  // Fine pointers only (no hover pop-out on touch, where there's no mouseleave).
  const handleMouseEnter = () => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      if (rect.left < 60) setTransformOrigin("left center");
      else if (rect.right > vw - 60) setTransformOrigin("right center");
      else setTransformOrigin("center center");
    }
    timeoutRef.current = setTimeout(() => setIsHovered(true), 400);
  };
  const handleMouseLeave = () => closeHover();

  useEffect(() => {
    if (!isHovered) return;
    const dismiss = () => closeHover();
    window.addEventListener("scroll", dismiss, { passive: true });
    return () => window.removeEventListener("scroll", dismiss);
  }, [isHovered]);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return (
    <div
      ref={cardRef}
      className="group relative flex flex-col h-full bg-transparent"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base cover */}
      <button onClick={handleOpen} className="relative w-full aspect-[2/3] overflow-hidden rounded-lg shadow-md block text-left">
        {cover ? (
          <img
            src={cover}
            alt={novel.title}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (highResCover) setHighResCover(null);
            }}
            className="w-full h-full object-cover hq-image"
          />
        ) : (
          <div className="w-full h-full bg-[#151518] flex items-center justify-center text-slate-600">
            <BookOpen className="w-10 h-10" />
          </div>
        )}
      </button>

      {/* Resting info below the cover */}
      <div className="pt-2 flex flex-col flex-1">
        <button onClick={handleOpen} className="text-left w-full">
          <h3 className="font-bold text-[#e2e8f0] text-[13px] leading-tight line-clamp-2 mb-1 hover:text-pink-400 transition-colors">
            {novel.title}
          </h3>
        </button>
        {novel.latestChapter && <p className="text-[11px] font-bold text-slate-500 line-clamp-1">{novel.latestChapter}</p>}
      </div>

      {/* ── Netflix-style hover pop-out over the cover ── */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1.14, zIndex: 50 }}
            exit={{ opacity: 0, scale: 1, zIndex: 50 }}
            transition={{ type: "tween", duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin }}
            onClick={handleOpen}
            className="absolute top-0 left-0 w-full aspect-[2/3] bg-[#141414] rounded-lg overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-white/20 cursor-pointer will-change-transform"
          >
            {cover && <img src={cover} alt={novel.title} className="absolute inset-0 w-full h-full object-cover" />}

            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent flex flex-col justify-end p-2.5">
              <h3 className="font-black text-[13px] text-white leading-tight drop-shadow-md line-clamp-2 mb-2">{novel.title}</h3>

              <div className="flex items-center gap-1.5 mb-2 relative z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpen(); }}
                  className="flex items-center gap-1 bg-pink-500 hover:bg-pink-400 text-white text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
                >
                  <BookOpen className="w-3 h-3" /> Read
                </button>
                <div onClick={(e) => e.stopPropagation()}>
                  <NovelTrackerButton novel={novel} variant="compact" />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpen(); }}
                  className="w-7 h-7 border-2 border-slate-400 text-white flex items-center justify-center rounded-full hover:border-white hover:bg-white/10 transition-colors ml-auto"
                  title="Details"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {novel.latestChapter && (
                <div className="flex items-center gap-1.5 text-[9px] font-bold">
                  <span className="border border-white/20 px-1 py-0.5 rounded text-slate-200 line-clamp-1">{novel.latestChapter}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
