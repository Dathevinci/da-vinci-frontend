"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, BookOpen } from "lucide-react";
import Link from "next/link";
import { IMangaInfo, IMangaResult } from "@/lib/asura/models";

import ManhwaTrackerButton from "@/components/manhwa/ManhwaTrackerButton";
import { useToast } from "@/components/ui/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useManhwaModal, ManhwaModalOptions } from "@/components/providers/ManhwaModalProvider";

interface ManhwaQuickViewModalProps {
  manhwa: IMangaResult | { id: string } | null;
  options?: ManhwaModalOptions;
  onClose: () => void;
}

export default function ManhwaQuickViewModal({ manhwa, options, onClose }: ManhwaQuickViewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [fullManhwa, setFullManhwa] = useState<IMangaInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { openManhwa } = useManhwaModal();
  const { toast } = useToast();

  useLockBodyScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch full details
  useEffect(() => {
    if (!manhwa) return;
    let isMounted = true;

    const loadFull = async () => {
      // If it already has description, we might not need to fetch.
      // But usually we just have IMangaResult or { id }, so we fetch IMangaInfo.
      try {
        const res = await fetch(`/api/manhwa/${encodeURIComponent(manhwa.id)}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (isMounted) {
          setFullManhwa(data);
        }
      } catch (e) {
        console.error("Failed to load full manhwa details", e);
      }
    };

    loadFull();

    return () => {
      isMounted = false;
    };
  }, [manhwa]);

  if (!mounted || !manhwa) return null;

  // Use the basic data until the full fetch completes, to show a skeleton/preview immediately.
  const displayManhwa = fullManhwa || (manhwa as any);
  const title = displayManhwa.title || "Loading...";
  const bannerUrl = displayManhwa.image ? `/api/manhwa-image?url=${encodeURIComponent(displayManhwa.image)}` : null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center pt-[5vh] sm:pt-[10vh] px-0 sm:px-4 pb-0 sm:pb-12">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl bg-[#0b0b0c] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full sm:max-h-[90vh]"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/10 shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Banner & Cover Area */}
          <div className="relative flex flex-col md:flex-row p-6 sm:p-8 md:p-10 gap-6 md:gap-10 border-b border-[#2a2a32] bg-gradient-to-b from-[#151518] to-[#0b0b0c] shrink-0">
            {/* Background blurred cover */}
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-20 pointer-events-none"
              />
            )}
            
            {/* Cover Image */}
            <div className="relative w-[160px] md:w-[220px] shrink-0 mx-auto md:mx-0 z-10">
              <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: 'high-quality' }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#151518] flex items-center justify-center text-slate-600">
                    <BookOpen className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col min-w-0 z-10 pt-2">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight drop-shadow-md"
              >
                {title}
              </motion.h2>

              <div className="flex flex-wrap items-center gap-3 text-sm md:text-base font-semibold mb-6">
                {displayManhwa.status && (
                  <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider border ${
                    displayManhwa.status.toLowerCase() === 'ongoing' 
                      ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {displayManhwa.status}
                  </span>
                )}
                {displayManhwa.rating && (
                  <span className="text-yellow-500 flex items-center gap-1">
                    ★ {Number(displayManhwa.rating).toFixed(1)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {fullManhwa?.chapters && fullManhwa.chapters.length > 0 ? (() => {
                  const firstChapter = fullManhwa.chapters[fullManhwa.chapters.length - 1];
                  const latestUnlockedChapter = fullManhwa.chapters.find((c: any) => !c.isLocked) || fullManhwa.chapters[0];
                  return (
                    <>
                      <Link
                        href={`/manhwa/${encodeURIComponent(manhwa.id)}/chapter/${encodeURIComponent(firstChapter.id)}`}
                        onClick={onClose}
                        className="flex items-center gap-2 bg-[#8a2be2] hover:bg-[#9a3bf2] text-white px-6 py-2.5 rounded shadow-lg shadow-[#8a2be2]/20 transition-colors font-bold"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Read First Chapter
                      </Link>
                      {latestUnlockedChapter && !latestUnlockedChapter.isLocked && (
                        <Link
                          href={`/manhwa/${encodeURIComponent(manhwa.id)}/chapter/${encodeURIComponent(latestUnlockedChapter.id)}`}
                          onClick={onClose}
                          className="flex items-center gap-2 bg-[#1e1e24] border border-[#2a2a32] hover:bg-[#2a2a32] text-white px-6 py-2.5 rounded transition-colors font-bold"
                        >
                          Latest Chapter
                        </Link>
                      )}
                    </>
                  );
                })() : fullManhwa ? (
                  <span className="text-slate-400 font-medium">No chapters available</span>
                ) : (
                  <div className="animate-pulse flex gap-3">
                    <div className="h-11 w-48 bg-[#1e1e24] rounded border border-[#2a2a32]"></div>
                    <div className="h-11 w-40 bg-[#1e1e24] rounded border border-[#2a2a32]"></div>
                  </div>
                )}
                
                <ManhwaTrackerButton manhwa={displayManhwa} />
              </div>

              {/* Genres */}
              {fullManhwa?.genres && fullManhwa.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-auto">
                  {fullManhwa.genres.map((g: string, i: number) => (
                    <span key={i} className="text-xs font-bold text-[#a3a3a3] bg-[#1e1e24] px-2 py-1 rounded border border-[#2a2a32]">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 md:p-10 space-y-8">
            
            {/* Synopsis */}
            <div>
              <h3 className="text-lg font-black text-white mb-3 tracking-wide">Synopsis</h3>
              {fullManhwa?.description ? (
                <div>
                  <p className={`text-slate-300 leading-relaxed text-sm md:text-base ${isExpanded ? "" : "line-clamp-4"}`}>
                    {fullManhwa.description}
                  </p>
                  {fullManhwa.description.length > 200 && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-[#8a2be2] hover:text-[#9a3bf2] font-bold text-sm mt-2 transition-colors"
                    >
                      {isExpanded ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>
              ) : fullManhwa ? (
                <p className="text-slate-500 italic">No synopsis available.</p>
              ) : (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-[#1e1e24] rounded w-full"></div>
                  <div className="h-4 bg-[#1e1e24] rounded w-[90%]"></div>
                  <div className="h-4 bg-[#1e1e24] rounded w-[95%]"></div>
                  <div className="h-4 bg-[#1e1e24] rounded w-[80%]"></div>
                </div>
              )}
            </div>

            {/* Chapters List (Simple Preview) */}
            {fullManhwa?.chapters && fullManhwa.chapters.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-white tracking-wide">Recent Chapters</h3>
                  <Link 
                    href={`/manhwa/${encodeURIComponent(manhwa.id)}`} 
                    onClick={onClose}
                    className="text-sm font-bold text-[#8a2be2] hover:underline"
                  >
                    View All
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fullManhwa.chapters.slice(0, 10).map((chapter: any) => (
                    <Link
                      key={chapter.id}
                      href={chapter.isLocked ? '#' : `/manhwa/${encodeURIComponent(manhwa.id)}/chapter/${encodeURIComponent(chapter.id)}`}
                      onClick={(e) => {
                        if (chapter.isLocked) {
                          e.preventDefault();
                          toast("This chapter is locked on AsuraScans.", "error");
                        } else {
                          onClose();
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        chapter.isLocked 
                          ? 'bg-[#151518] border-[#2a2a32] opacity-60 cursor-not-allowed' 
                          : 'bg-[#1e1e24] border-[#2a2a32] hover:border-[#8a2be2]/50 hover:bg-[#8a2be2]/5 transition-colors group'
                      }`}
                    >
                      <div className="font-bold text-sm text-[#e2e8f0] group-hover:text-[#8a2be2] transition-colors">
                        Chapter {chapter.number}
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                        {chapter.date}
                        {chapter.isLocked && <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">Locked</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-4 flex justify-center">
               <Link 
                  href={`/manhwa/${encodeURIComponent(manhwa.id)}`} 
                  onClick={onClose}
                  className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2 border border-[#2a2a32] px-6 py-2 rounded-full hover:bg-[#1e1e24]"
                >
                  View Full Details Page
                </Link>
            </div>
            
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
