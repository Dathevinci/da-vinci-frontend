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
  isVisible,
  isPinned,
  onTogglePin,
  onLibraryAdd,
  onMarkRead,
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
  isVisible: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onLibraryAdd?: () => void;
  onMarkRead?: () => void;
  onOpenSettings: () => void;
  onOpenChapterSelector: () => void;
  onCapture: () => void;
}) {
  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);
  const title = manhwa?.title || 'Details';
  const chapterNumMatch = currentChapter?.title.match(/(\d+(\.\d+)?)/);
  const shortTitle = chapterNumMatch ? `Ch. ${chapterNumMatch[1]}` : 'Ch. 1';

  const currentIndex = manhwa?.chapters?.findIndex(c => c.id === chapterId) ?? -1;
  const totalChapters = manhwa?.chapters?.length || 0;
  
  const prevChapterNum = currentIndex < totalChapters - 1 ? (totalChapters - 1 - (currentIndex + 1)) : 0;
  const nextChapterNum = currentIndex > 0 ? (totalChapters - currentIndex) : (totalChapters + 1);

  return (
    <>
      {/* Top Floating Pill - iOS Glass Style */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center h-[42px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full text-white text-[13px] font-bold select-none overflow-hidden shadow-2xl transform transition-all duration-300 ease-in-out ${isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-16 opacity-0 pointer-events-none'}`}>
        <Link 
          href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
          className="flex items-center justify-center px-4 h-full hover:bg-white/20 transition"
          title={`Back to ${title}`}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <span className="h-5 w-[1px] bg-white/20 my-auto" />
        
        <div className="flex items-center px-4 h-full font-bold tabular-nums">
          {currentPageIndex} / {totalPages}
        </div>

        <span className="h-5 w-[1px] bg-white/20 my-auto" />

        <button onClick={onLibraryAdd} className="flex items-center justify-center px-3.5 h-full hover:bg-white/20 transition" title="Add to Library">
          <Plus className="w-4 h-4" />
        </button>
        
        <button onClick={onMarkRead} className="flex items-center justify-center px-3.5 h-full hover:bg-white/20 transition" title="Mark as Read">
          <Check className="w-4 h-4" />
        </button>

        {/* Camera icon gets full height background on hover, matching Screenshot 2 */}
        <button 
          onClick={onCapture}
          className="flex items-center justify-center px-4 h-full bg-white/10 hover:bg-white/20 transition text-white group relative" 
          title="Capture visible panels for comment"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button onClick={onTogglePin} className={`flex items-center justify-center px-3.5 h-full transition ${isPinned ? 'bg-white/20' : 'hover:bg-white/20'}`} title={isPinned ? "Unpin Toolbar" : "Pin Toolbar"}>
          <Pin className={`w-4 h-4 ${isPinned ? 'fill-white' : ''}`} />
        </button>

        <button onClick={() => window.location.reload()} className="flex items-center justify-center px-3.5 h-full hover:bg-white/20 transition" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <span className="h-5 w-[1px] bg-white/20 my-auto" />

        <button 
          onClick={onOpenSettings}
          className="flex items-center justify-center px-4 h-full hover:bg-white/20 transition" 
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Pill - iOS Glass Style */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center h-[42px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full text-white text-[13px] font-bold select-none overflow-hidden shadow-2xl transform transition-all duration-300 ease-in-out ${isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-16 opacity-0 pointer-events-none'}`}>
        {prevChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(prevChapterId)}`}
            className="flex items-center gap-1.5 px-4 h-full hover:bg-white/20 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="tabular-nums">{prevChapterNum}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 px-4 h-full opacity-40 cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
            <span>0</span>
          </div>
        )}

        <span className="h-5 w-[1px] bg-white/20 my-auto" />

        <button 
          onClick={onOpenChapterSelector}
          className="flex items-center gap-2 px-5 h-full hover:bg-white/20 transition font-bold"
        >
          <List className="w-4 h-4" />
          <span>{shortTitle}</span>
          {isChapterSelectorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="h-5 w-[1px] bg-white/20 my-auto" />

        {nextChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(nextChapterId)}`}
            className="flex items-center gap-1.5 px-4 h-full hover:bg-white/20 transition"
          >
            <span className="tabular-nums">{nextChapterNum}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
            className="flex items-center gap-1.5 px-4 h-full hover:bg-white/20 transition"
          >
            <span>Done</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Stacked Scroll Buttons on Bottom-Right as seen in Screenshot 1 */}
      <div className={`fixed bottom-5 right-5 z-40 flex flex-col items-center bg-[#131313] rounded-[24px] border border-white/5 text-white shadow-2xl overflow-hidden transform transition-all duration-300 ease-in-out ${isVisible ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-16 opacity-0 pointer-events-none'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition" 
          title="Scroll to Top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <span className="w-full h-[1px] bg-white/10" />
        <button 
          onClick={(e) => { e.stopPropagation(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }}
          className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition" 
          title="Scroll to Comments"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}
