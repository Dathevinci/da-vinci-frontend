"use client";

import { ChevronLeft, ChevronRight, ArrowLeft, Settings, RefreshCw, Pin, Plus, Check, Camera, List, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { IMangaInfo } from "@/lib/asura/models";

export default function ReaderNavigation({
  manhwa,
  chapterId,
  prevChapterId,
  nextChapterId,
  currentPageIndex,
  totalPages,
  isChapterSelectorOpen,
  onOpenSettings,
  onOpenChapterSelector,
  onCapture,
}: {
  manhwa: IMangaInfo | null;
  chapterId: string;
  prevChapterId: string | null;
  nextChapterId: string | null;
  currentPageIndex: number;
  totalPages: number;
  isChapterSelectorOpen?: boolean;
  onOpenSettings: () => void;
  onOpenChapterSelector: () => void;
  onCapture: () => void;
}) {
  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);
  const title = manhwa?.title || 'Details';
  const chapterNumMatch = currentChapter?.title.match(/(\d+(\.\d+)?)/);
  const shortTitle = chapterNumMatch ? `Ch. ${chapterNumMatch[1]}` : 'Ch. 1';

  // Calculate chapter numbers for prev/next buttons
  const currentIndex = manhwa?.chapters?.findIndex(c => c.id === chapterId) ?? -1;
  const totalChapters = manhwa?.chapters?.length || 0;
  
  // In Asura/MangaRead arrays, index 0 is newest, higher index is older (e.g. index 0 = Ch. 229, index 228 = Ch. 1)
  const prevChapterNum = currentIndex < totalChapters - 1 ? (totalChapters - 1 - (currentIndex + 1)) : 0;
  const nextChapterNum = currentIndex > 0 ? (totalChapters - currentIndex) : (totalChapters + 1);

  return (
    <>
      {/* Top Floating Pill - Slate Blue translucent styling as seen in screenshot */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center h-10 px-1 bg-[#4b6b88]/70 backdrop-blur-xl rounded-full border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] text-white text-xs font-semibold select-none pointer-events-auto">
        <Link 
          href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
          className="flex items-center justify-center px-3 h-full hover:bg-white/10 rounded-l-full transition"
          title={`Back to ${title}`}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <span className="h-4 w-px bg-white/20 my-auto" />
        
        <div className="flex items-center px-3 h-full font-bold tabular-nums">
          {currentPageIndex} / {totalPages}
        </div>

        <span className="h-4 w-px bg-white/20 my-auto" />

        <button className="flex items-center justify-center px-2.5 h-full hover:bg-white/10 transition" title="Add to Library">
          <Plus className="w-4 h-4" />
        </button>
        
        <button className="flex items-center justify-center px-2.5 h-full hover:bg-white/10 transition" title="Mark as Read">
          <Check className="w-4 h-4" />
        </button>

        {/* Camera icon highlighted rounded square when active/hovered as in Screenshot 3 */}
        <button 
          onClick={onCapture}
          className="flex items-center justify-center w-8 h-8 mx-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition text-white" 
          title="Capture visible panels for comment"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button className="flex items-center justify-center px-2.5 h-full hover:bg-white/10 transition" title="Pin Toolbar">
          <Pin className="w-4 h-4" />
        </button>

        <button onClick={() => window.location.reload()} className="flex items-center justify-center px-2.5 h-full hover:bg-white/10 transition" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <button 
          onClick={onOpenSettings}
          className="flex items-center justify-center px-3 h-full hover:bg-white/10 rounded-r-full transition" 
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Pill - Slate Blue matching Screenshot 1 & 2 */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center h-10 bg-[#4b6b88]/70 backdrop-blur-xl rounded-full border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] text-white text-xs font-bold select-none pointer-events-auto">
        {prevChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(prevChapterId)}`}
            className="flex items-center gap-1.5 px-3.5 h-full hover:bg-white/10 rounded-l-full transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="tabular-nums">{prevChapterNum}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 px-3.5 h-full opacity-40 cursor-not-allowed rounded-l-full">
            <ChevronLeft className="w-4 h-4" />
            <span>0</span>
          </div>
        )}

        <span className="h-4 w-px bg-white/20 my-auto" />

        <button 
          onClick={onOpenChapterSelector}
          className="flex items-center gap-2 px-4 h-full hover:bg-white/10 transition font-bold"
        >
          <List className="w-4 h-4" />
          <span>{shortTitle}</span>
          {isChapterSelectorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="h-4 w-px bg-white/20 my-auto" />

        {nextChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(nextChapterId)}`}
            className="flex items-center gap-1.5 px-3.5 h-full hover:bg-white/10 rounded-r-full transition"
          >
            <span className="tabular-nums">{nextChapterNum}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
            className="flex items-center gap-1.5 px-3.5 h-full hover:bg-white/10 rounded-r-full transition"
          >
            <span>Done</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Stacked Scroll Buttons on Bottom-Right as seen in Screenshot 1 */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-1 bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/10 text-white shadow-xl">
        <button 
          onClick={() => window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' })}
          className="p-1.5 hover:bg-white/20 rounded-full transition" 
          title="Scroll Up"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button 
          onClick={() => window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' })}
          className="p-1.5 hover:bg-white/20 rounded-full transition" 
          title="Scroll Down"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
