"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Play, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IMangaResult } from "@/lib/asura/models";
import { useManhwaModal } from "@/components/providers/ManhwaModalProvider";

export default function ManhwaCard({ manhwa }: { manhwa: IMangaResult }) {
  const { openManhwa } = useManhwaModal();

  const [isHovered, setIsHovered] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const ratingNum = Number(manhwa.rating);
  const displayRating = !isNaN(ratingNum) && ratingNum > 0 ? ratingNum.toFixed(1) : "N/A";
  const hasRating = !isNaN(ratingNum) && ratingNum > 0;
  const isOngoing = manhwa.status?.toString().toUpperCase() === "ONGOING";

  const cover = manhwa.image ? `/api/manhwa-image?url=${encodeURIComponent(manhwa.image)}` : null;
  const chapterLabel = manhwa.latestChapter || (manhwa.latest_chapters?.[0] ? `Chapter ${manhwa.latest_chapters[0].number}` : null);
  const chapterHref = manhwa.latest_chapters?.[0]
    ? `/manhwa/${encodeURIComponent(manhwa.id)}/chapter/${encodeURIComponent(`${manhwa.id}|${manhwa.latest_chapters[0].number}`)}`
    : `/manhwa/${encodeURIComponent(manhwa.id)}`;

  const closeHover = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };
  const handleOpen = () => {
    closeHover();
    openManhwa(manhwa);
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

  // Dismiss on scroll so the pop-out can't linger over the wrong card, and
  // clear any pending open timer on unmount.
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
      <button
        onClick={handleOpen}
        className="relative w-full aspect-[2/3] overflow-hidden rounded-lg shadow-md block text-left"
      >
        {cover ? (
          <img
            src={cover}
            alt={manhwa.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover hq-image"
          />
        ) : (
          <div className="w-full h-full bg-[#151518] flex items-center justify-center text-slate-600">No Image</div>
        )}
        {isOngoing && (
          <div className="absolute top-1 right-1 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm tracking-wide">ONGOING</div>
        )}
        {hasRating && (
          <div className="absolute top-1 left-1 bg-black/80 border border-[#2a2a32] text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-md">
            ★ {displayRating}
          </div>
        )}
      </button>

      {/* Resting info below the cover */}
      <div className="pt-2 flex flex-col flex-1 bg-[#0b0b0c]">
        <button onClick={handleOpen} className="text-left w-full">
          <h3 className="font-bold text-[#e2e8f0] text-[13px] leading-tight line-clamp-2 mb-1 hover:text-[#dc2626] transition-colors">
            {manhwa.title}
          </h3>
        </button>
        <Link href={chapterHref} className="text-[11px] font-bold text-[#a3a3a3] mb-1 hover:text-[#dc2626] transition-colors w-fit">
          {chapterLabel || "Chapter ?"}
        </Link>
        <div className="flex items-center gap-1 mt-auto pointer-events-none">
          <div className="flex text-yellow-500 text-[10px]">★★★★★</div>
          <span className="text-[10px] font-bold text-slate-400 ml-1">{displayRating}</span>
        </div>
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
            {cover && <img src={cover} alt={manhwa.title} className="absolute inset-0 w-full h-full object-cover" />}
            {isOngoing && (
              <div className="absolute top-1.5 right-1.5 z-10 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wide">ONGOING</div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent flex flex-col justify-end p-2.5">
              <h3 className="font-black text-[13px] text-white leading-tight drop-shadow-md line-clamp-2 mb-2">{manhwa.title}</h3>

              <div className="flex items-center gap-1.5 mb-2 relative z-10">
                <Link
                  href={chapterHref}
                  onClick={(e) => { e.stopPropagation(); closeHover(); }}
                  className="flex items-center gap-1 bg-[#dc2626] hover:bg-[#ef4444] text-white text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
                  title="Read latest chapter"
                >
                  <Play className="w-3 h-3 fill-current" /> Read
                </Link>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpen(); }}
                  className="w-7 h-7 border-2 border-slate-400 text-white flex items-center justify-center rounded-full hover:border-white hover:bg-white/10 transition-colors ml-auto"
                  title="More info"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[9px] font-bold">
                {hasRating && <span className="text-green-400">★ {displayRating}</span>}
                <span className="text-slate-200">{isOngoing ? "Ongoing" : (manhwa.status || "—")}</span>
                {chapterLabel && <span className="border border-white/20 px-1 py-0.5 rounded text-slate-200 line-clamp-1">{chapterLabel}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
