"use client";

import { ChevronLeft, ChevronRight, ArrowLeft, Home, Settings, RefreshCw, Pin, Plus, Check, Camera, List, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IMangaInfo } from "@/lib/asura/models";
import { chapterNo } from "./ChapterSelectorModal";
import { browseAnchorHref } from "@/lib/browseAnchor";

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
  const router = useRouter();
  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);
  const title = manhwa?.title || 'Details';
  /**
   * Same rule as the chapter list: the number comes from the ID.
   *
   * This read the first digits in the TITLE and fell back to a hardcoded
   * 'Ch. 1' — so a chapter with a real name showed a number that was simply
   * invented, and the button disagreed with the list it opens. A fabricated
   * number is worse than none: "Ch. 1" is a specific, checkable claim, and it
   * was wrong on every titled chapter.
   *
   * Falls back to the word "Chapters" now, which promises nothing.
   */
  const currentNo = currentChapter ? chapterNo(currentChapter) : null;
  const shortTitle = currentNo ? `Ch. ${currentNo}` : 'Chapters';

  const currentIndex = manhwa?.chapters?.findIndex(c => c.id === chapterId) ?? -1;
  const totalChapters = manhwa?.chapters?.length || 0;

  /**
   * The neighbours' numbers are READ OFF THE NEIGHBOURS, not recomputed.
   *
   * These were positional arithmetic — `totalChapters - 1 - (currentIndex + 1)`
   * and similar — which was off by one in both directions, so the "next" badge
   * printed the number of the chapter you were already on. It also could not be
   * right in principle: a positional count is not the chapter number when a
   * series has specials, decimals or gaps.
   *
   * The list is newest-first, so index+1 is the PREVIOUS chapter and index-1 is
   * the next one.
   */
  const prevChapter = currentIndex >= 0 ? manhwa?.chapters?.[currentIndex + 1] : undefined;
  const nextChapter = currentIndex > 0 ? manhwa?.chapters?.[currentIndex - 1] : undefined;
  const prevChapterNum = prevChapter ? chapterNo(prevChapter) : null;
  const nextChapterNum = nextChapter ? chapterNo(nextChapter) : null;

  return (
    <>
      {/* Top Floating Pill - iOS Glass Style */}
      {/* Tighter padding below sm and a scrollable overflow, because this pill
          now carries NINE controls. It is centred with a fixed height and was
          `overflow-hidden`, so on a narrow phone the extra control would have
          been clipped away rather than wrapped — silently unreachable. */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center h-[42px] max-w-[calc(100vw-1rem)] overflow-x-auto hide-scrollbar bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full text-white text-[13px] font-bold select-none shadow-2xl transform transition-all duration-300 ease-in-out ${isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-16 opacity-0 pointer-events-none'}`}>
        {/* THE WAY OUT.
            A reader is a dead end — the mobile nav hides itself on every
            /chapter/ route — so leaving a series you have decided against meant
            tapping back through the chapter, then the series, then wherever
            else you had wandered. This returns to the grid you were browsing,
            filters and all, in one tap. Pushes rather than replaces so a
            misfire is one back press from the page you were reading. */}
        <button
          onClick={() => router.push(browseAnchorHref("/manhwa"))}
          className="flex shrink-0 items-center justify-center px-3 sm:px-4 h-full hover:bg-white/20 transition"
          title="Back to browsing"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* `replace`, not a push. This arrow LOOKS like back but was adding a
            history entry, so the stack became [feed, series, chapter, series]:
            pressing the real back button from here returned you to the chapter
            you had just left, then the series, then the chapter again, with no
            way to escape except holding back. Replacing the chapter entry keeps
            the promise this arrow makes — it always lands on the series — while
            leaving the stack the same height it was. */}
        <Link
          href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}`}
          replace
          className="flex shrink-0 items-center justify-center px-3 sm:px-4 h-full hover:bg-white/20 transition"
          title={`Back to ${title}`}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <span className="h-5 w-[1px] shrink-0 bg-white/20 my-auto" />

        <div className="flex shrink-0 items-center px-3 sm:px-4 h-full font-bold tabular-nums">
          {currentPageIndex} / {totalPages}
        </div>

        <span className="h-5 w-[1px] shrink-0 bg-white/20 my-auto" />

        <button onClick={onLibraryAdd} className="flex shrink-0 items-center justify-center px-2.5 sm:px-3.5 h-full hover:bg-white/20 transition" title="Add to Library">
          <Plus className="w-4 h-4" />
        </button>

        <button onClick={onMarkRead} className="flex shrink-0 items-center justify-center px-2.5 sm:px-3.5 h-full hover:bg-white/20 transition" title="Mark as Read">
          <Check className="w-4 h-4" />
        </button>

        {/* Camera icon gets full height background on hover, matching Screenshot 2 */}
        <button
          onClick={onCapture}
          className="flex shrink-0 items-center justify-center px-3 sm:px-4 h-full bg-white/10 hover:bg-white/20 transition text-white group relative"
          title="Capture visible panels for comment"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button onClick={onTogglePin} className={`flex shrink-0 items-center justify-center px-2.5 sm:px-3.5 h-full transition ${isPinned ? 'bg-white/20' : 'hover:bg-white/20'}`} title={isPinned ? "Unpin Toolbar" : "Pin Toolbar"}>
          <Pin className={`w-4 h-4 ${isPinned ? 'fill-white' : ''}`} />
        </button>

        <button onClick={() => window.location.reload()} className="flex shrink-0 items-center justify-center px-2.5 sm:px-3.5 h-full hover:bg-white/20 transition" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <span className="h-5 w-[1px] shrink-0 bg-white/20 my-auto" />

        <button
          onClick={onOpenSettings}
          className="flex shrink-0 items-center justify-center px-3 sm:px-4 h-full hover:bg-white/20 transition"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Pill - iOS Glass Style */}
      {/* THREE CONTROLS SHARE bottom-5 ON A PHONE and collide there: this
          centred chapter pill, the zoom bar at right-[84px], and the scroll
          arrows at right-5. On a narrow screen the pill runs underneath the
          right-hand pair, which reads as one bar stacked on another rather
          than as three separate controls.
          Lifted to its own row below sm; from sm up there is width for all
          three on one line, so the original layout is unchanged. */}
      <div className={`fixed bottom-24 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center h-[42px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full text-white text-[13px] font-bold select-none overflow-hidden shadow-2xl transform transition-all duration-300 ease-in-out ${isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-16 opacity-0 pointer-events-none'}`}>
        {prevChapterId ? (
          <Link 
            href={`/manhwa/${encodeURIComponent(manhwa?.id || '')}/chapter/${encodeURIComponent(prevChapterId)}`}
            className="flex items-center gap-1.5 px-4 h-full hover:bg-white/20 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="tabular-nums">{prevChapterNum ?? "–"}</span>
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
            <span className="tabular-nums">{nextChapterNum ?? "–"}</span>
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
