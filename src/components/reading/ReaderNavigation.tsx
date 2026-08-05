"use client";

import { ChevronLeft, ChevronRight, ArrowLeft, Settings, RefreshCw, Pin, Plus, Check, Camera, List } from "lucide-react";
import Link from "next/link";
import { IMangaInfo } from "@/lib/asura/models";

export default function ReaderNavigation({
  manhwa,
  chapterId,
  prevChapterId,
  nextChapterId,
  currentPageIndex,
  totalPages,
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
  onOpenSettings: () => void;
  onOpenChapterSelector: () => void;
  onCapture: () => void;
}) {
  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);
  const title = manhwa?.title || 'Details';
  const chapterNumMatch = currentChapter?.title.match(/(\d+(\.\d+)?)/);
  const shortTitle = chapterNumMatch ? `Ch. ${chapterNumMatch[1]}` : 'Ch.';

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Top Floating Pill */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center h-12 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-2xl text-white/80 overflow-hidden pointer-events-auto">
        <Link 
          href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
          className="flex items-center justify-center w-12 h-full hover:bg-white/10 hover:text-white transition"
          title={`Back to ${title}`}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        
        <div className="flex items-center h-full px-3 text-sm font-bold border-l border-white/10 cursor-default">
          {currentPageIndex} <span className="text-white/40 mx-1">/</span> {totalPages}
        </div>

        <button className="flex items-center justify-center w-10 h-full border-l border-white/10 hover:bg-white/10 hover:text-white transition" title="Add to Library">
          <Plus className="w-4 h-4" />
        </button>
        
        <button className="flex items-center justify-center w-10 h-full border-l border-white/10 hover:bg-white/10 hover:text-white transition" title="Mark as Read">
          <Check className="w-4 h-4" />
        </button>

        <button 
          onClick={onCapture}
          className="flex items-center justify-center w-10 h-full border-l border-white/10 hover:bg-white/10 hover:text-white transition bg-white/10 group relative" 
          title="Capture visible panels for comment"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button className="flex items-center justify-center w-10 h-full border-l border-white/10 hover:bg-white/10 hover:text-white transition" title="Pin Toolbar">
          <Pin className="w-4 h-4" />
        </button>

        <button onClick={handleRefresh} className="flex items-center justify-center w-10 h-full border-l border-white/10 hover:bg-white/10 hover:text-white transition" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <button 
          onClick={onOpenSettings}
          className="flex items-center justify-center w-12 h-full border-l border-white/10 hover:bg-white/10 hover:text-white transition" 
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Pill */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center h-12 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-2xl text-white/80 pointer-events-auto">
        {prevChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(prevChapterId)}`}
            className="flex items-center justify-center px-4 h-full hover:bg-white/10 hover:text-white transition rounded-l-full gap-2 font-bold text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </Link>
        ) : (
          <div className="flex items-center justify-center px-4 h-full opacity-30 cursor-not-allowed rounded-l-full gap-2 font-bold text-sm">
            <ChevronLeft className="w-4 h-4" />
          </div>
        )}

        <button 
          onClick={onOpenChapterSelector}
          className="flex items-center justify-center px-6 h-full border-x border-white/10 hover:bg-white/10 hover:text-white transition gap-2 font-black text-sm"
        >
          <List className="w-4 h-4 text-white/50" />
          {shortTitle}
        </button>

        {nextChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(nextChapterId)}`}
            className="flex items-center justify-center px-4 h-full hover:bg-white/10 hover:text-white transition rounded-r-full gap-2 font-bold text-sm"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
            className="flex items-center justify-center px-4 h-full hover:bg-white/10 hover:text-white transition rounded-r-full gap-2 font-bold text-sm"
          >
            Done
          </Link>
        )}
      </div>
    </>
  );
}
