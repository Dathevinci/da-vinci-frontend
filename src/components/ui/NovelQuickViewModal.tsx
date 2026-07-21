"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, BookOpen, User as UserIcon, List, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { NovelInfo, NovelResult } from "@/lib/novel/ReadNovelFull";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import NovelTrackerButton from "@/components/novel/NovelTrackerButton";
import { novelCover } from "@/lib/novelImage";

const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: "easeOut" as const },
});

export default function NovelQuickViewModal({
  novel,
  onClose,
}: {
  novel: NovelResult | { id: string };
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [full, setFull] = useState<NovelInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastRead, setLastRead] = useState<string | null>(null);

  useLockBodyScroll();
  useEffect(() => setMounted(true), []);

  // Animate OUT, then AnimatePresence's onExitComplete unmounts via onClose.
  const handleClose = () => setVisible(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!novel) return;
    let alive = true;
    fetch(`/api/novels/${encodeURIComponent(novel.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setFull(d && d.error ? null : d);
      })
      .catch(() => {});
    try {
      setLastRead(localStorage.getItem(`novel-progress:${novel.id}`));
    } catch {
      /* ignore */
    }
    return () => {
      alive = false;
    };
  }, [novel]);

  if (!mounted || !novel) return null;

  const display = full || (novel as any);
  const title = display.title || "Loading…";
  const cover = novelCover(display.cover);
  const chapters = full?.chapters || [];
  const firstCh = chapters[0];
  const detailHref = `/novel/${encodeURIComponent(novel.id)}`;
  const chapterHref = (cid: string) => `/novel/${encodeURIComponent(novel.id)}/chapter/${encodeURIComponent(cid)}`;

  return createPortal(
    <AnimatePresence onExitComplete={onClose}>
      {visible && (
        <motion.div
          key="nv-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[200] flex items-center justify-center pt-[5vh] sm:pt-[10vh] px-0 sm:px-4 pb-0 sm:pb-12"
        >
          <div onClick={handleClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16, transition: { duration: 0.2 } }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative w-full max-w-3xl bg-[#0b0b0c] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full sm:max-h-[90vh]"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-50 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/10 shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="relative flex flex-col md:flex-row p-6 sm:p-8 gap-6 border-b border-[#2a2a32] bg-gradient-to-b from-[#151518] to-[#0b0b0c]">
                {cover && (
                  <img src={cover} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-20 pointer-events-none" />
                )}
                <motion.div {...reveal(0.05)} className="relative w-[150px] md:w-[190px] shrink-0 mx-auto md:mx-0 z-10">
                  <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10">
                    {cover ? (
                      <img src={cover} alt={title} className="w-full h-full object-cover hq-image" />
                    ) : (
                      <div className="w-full h-full bg-[#151518] flex items-center justify-center text-slate-600">
                        <BookOpen className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                </motion.div>

                <div className="flex-1 flex flex-col min-w-0 z-10 pt-1">
                  <motion.h2 {...reveal(0.1)} className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight drop-shadow-md">
                    {title}
                  </motion.h2>
                  <motion.div {...reveal(0.18)} className="flex flex-wrap items-center gap-3 text-sm font-semibold mb-4">
                    {display.author && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <UserIcon className="w-4 h-4 text-pink-400" /> {display.author}
                      </span>
                    )}
                    {display.status && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider border ${
                          String(display.status).toLowerCase().includes("complet")
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-pink-500/10 text-pink-400 border-pink-500/20"
                        }`}
                      >
                        {display.status}
                      </span>
                    )}
                    {chapters.length > 0 && <span className="text-slate-500 text-xs">{chapters.length} chapters</span>}
                  </motion.div>

                  {full?.genres && full.genres.length > 0 && (
                    <motion.div {...reveal(0.26)} className="flex flex-wrap gap-2 mb-5">
                      {full.genres.map((g) => (
                        <span key={g} className="text-xs font-bold text-[#a3a3a3] bg-[#1e1e24] px-2 py-1 rounded border border-[#2a2a32]">
                          {g}
                        </span>
                      ))}
                    </motion.div>
                  )}

                  <motion.div {...reveal(0.32)} className="flex flex-wrap items-center gap-3 mt-auto">
                    {firstCh ? (
                      <>
                        <Link
                          href={chapterHref(firstCh.id)}
                          onClick={onClose}
                          className="flex items-center gap-2 bg-pink-500 hover:bg-pink-400 text-white px-6 py-2.5 rounded shadow-lg shadow-pink-500/20 transition-colors font-bold"
                        >
                          <Play className="w-5 h-5 fill-current" /> Start Reading
                        </Link>
                        {lastRead && (
                          <Link
                            href={chapterHref(lastRead)}
                            onClick={onClose}
                            className="flex items-center gap-2 bg-[#1e1e24] border border-[#2a2a32] hover:bg-[#2a2a32] text-white px-6 py-2.5 rounded transition-colors font-bold"
                          >
                            Continue
                          </Link>
                        )}
                      </>
                    ) : full ? (
                      <span className="text-slate-400 font-medium">No chapters available</span>
                    ) : (
                      <div className="animate-pulse flex gap-3">
                        <div className="h-11 w-40 bg-[#1e1e24] rounded"></div>
                        <div className="h-11 w-28 bg-[#1e1e24] rounded"></div>
                      </div>
                    )}
                    <div className="w-44">
                      <NovelTrackerButton novel={{ id: novel.id, title, cover: display.cover }} />
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 sm:p-8 space-y-8">
                <div>
                  <h3 className="text-lg font-black text-white mb-3">Synopsis</h3>
                  {full?.synopsis ? (
                    <div>
                      <p className={`text-slate-300 leading-relaxed text-sm md:text-base ${isExpanded ? "" : "line-clamp-4"}`}>{full.synopsis}</p>
                      {full.synopsis.length > 240 && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="text-pink-400 hover:text-pink-300 font-bold text-sm mt-2 transition-colors">
                          {isExpanded ? "Show Less" : "Read More"}
                        </button>
                      )}
                    </div>
                  ) : full ? (
                    <p className="text-slate-500 italic">No synopsis available.</p>
                  ) : (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-[#1e1e24] rounded w-full"></div>
                      <div className="h-4 bg-[#1e1e24] rounded w-[90%]"></div>
                      <div className="h-4 bg-[#1e1e24] rounded w-[95%]"></div>
                    </div>
                  )}
                </div>

                {chapters.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <List className="w-5 h-5 text-pink-400" /> Recent Chapters
                      </h3>
                      <Link href={detailHref} onClick={onClose} className="text-sm font-bold text-pink-400 hover:underline">
                        View All
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {chapters.slice(0, 8).map((ch) => (
                        <Link
                          key={ch.id}
                          href={chapterHref(ch.id)}
                          onClick={onClose}
                          className="flex items-center justify-between p-3 rounded-lg border bg-[#1e1e24] border-[#2a2a32] hover:border-pink-500/50 hover:bg-pink-500/5 transition-colors group"
                        >
                          <span className="font-bold text-sm text-[#e2e8f0] group-hover:text-pink-400 transition-colors line-clamp-1">{ch.title}</span>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-pink-400 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-center">
                  <Link
                    href={detailHref}
                    onClick={onClose}
                    className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2 border border-[#2a2a32] px-6 py-2 rounded-full hover:bg-[#1e1e24]"
                  >
                    View Full Details Page
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
