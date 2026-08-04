"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowLeft, Lock, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { IMangaChapterPage, IMangaInfo } from "@/lib/asura/models";
import CommunityFeed from "@/components/community/CommunityFeed";
import { useUser } from "@/hooks/useUser";
import { earnPoints } from "@/lib/earn";
import { recordReading } from "@/lib/readingHistory";

export default function ManhwaChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const id = decodeURIComponent(resolvedParams.id);
  const chapterId = decodeURIComponent(resolvedParams.chapterId);

  const [pages, setPages] = useState<IMangaChapterPage[]>([]);
  const [manhwa, setManhwa] = useState<IMangaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  // Fetch manhwa info for navigation
  useEffect(() => {
    fetch(`/api/manhwa/${encodeURIComponent(id)}`)
      .then(res => res.json())
      .then((data: any) => {
        if (data.error) console.error(data.error);
        else setManhwa(data);
      })
      .catch(console.error);
  }, [id]);

  // Fetch chapter images
  useEffect(() => {
    setLoading(true);
    fetch(`/api/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
      .then(res => res.json())
      .then((data: any) => {
        if (data.error) {
          console.error(data.error);
          setPages([]);
        } else {
          setPages(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id, chapterId]);

  // Remember where you're up to, so the detail page + quick-view + the home
  // "Continue Reading" shelf can jump straight back to this chapter. Only saved
  // once the chapter has actually loaded and isn't locked.
  useEffect(() => {
    if (loading || pages.length === 0) return;
    const cc = manhwa?.chapters?.find((c) => c.id === chapterId);
    if ((cc as any)?.isLocked) return;
    try {
      localStorage.setItem(`manhwa-progress:${id}`, chapterId);
    } catch {
      /* ignore */
    }
    if (manhwa?.title) {
      recordReading("manhwa", { id, title: manhwa.title, cover: manhwa.image, chapterId, chapterTitle: cc?.title });
    }
  }, [loading, pages.length, manhwa, id, chapterId]);

  // Reward reading: once the pages are up and you've dwelled a few seconds,
  // grant Arise Points. Deduped server-side per chapter, so re-reads never
  // re-award. Skipped for locked chapters (you can't read those).
  useEffect(() => {
    if (!user || loading || pages.length === 0) return;
    const cc = manhwa?.chapters?.find((c) => c.id === chapterId);
    if ((cc as any)?.isLocked) return;
    const t = setTimeout(() => {
      earnPoints(user.id, "read", `manhwa:${id}:${chapterId}`);
    }, 3500);
    return () => clearTimeout(t);
  }, [user, loading, pages.length, manhwa, id, chapterId]);

  // Figure out prev/next chapter
  let prevChapterId: string | null = null;
  let nextChapterId: string | null = null;

  if (manhwa && manhwa.chapters) {
    const currentIndex = manhwa.chapters.findIndex((c) => c.id === chapterId);
    if (currentIndex > 0) {
      nextChapterId = manhwa.chapters[currentIndex - 1].id;
    }
    if (currentIndex !== -1 && currentIndex < manhwa.chapters.length - 1) {
      prevChapterId = manhwa.chapters[currentIndex + 1].id;
    }
  }

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('hide-navbar-footer');
    } else {
      document.body.classList.remove('hide-navbar-footer');
    }
    return () => document.body.classList.remove('hide-navbar-footer');
  }, [isFullscreen]);

  /**
   * Page zoom.
   *
   * Implemented as reader WIDTH, not a CSS transform. For a vertical-scroll
   * manhwa reader that's the correct model: pages stay in normal document flow,
   * so vertical scrolling, lazy loading and scroll position all keep working, and
   * zooming past the viewport simply produces horizontal panning. A
   * `transform: scale()` would scale the whole column including the gaps, break
   * scroll height, and fight the native scrollbar.
   *
   * BASE_READER_WIDTH mirrors the max-w-[800px] the reader has always used, so
   * 100% is pixel-identical to the old layout — zoom is purely additive.
   */
  const BASE_READER_WIDTH = 800;
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 300;
  const ZOOM_STEP = 10;
  const ZOOM_KEY = "davinci_reader_zoom";

  // Starts at 100 so the server render and the first client render agree; the
  // stored value is applied in the effect below. Reading localStorage during the
  // initial render would be a hydration mismatch.
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(ZOOM_KEY) || "", 10);
      if (Number.isFinite(saved) && saved >= ZOOM_MIN && saved <= ZOOM_MAX) setZoom(saved);
    } catch { /* private mode / storage disabled */ }
  }, []);

  const applyZoom = useCallback((next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next)));
    setZoom(clamped);
    try {
      localStorage.setItem(ZOOM_KEY, String(clamped));
    } catch { /* ignore */ }
  }, []);

  // Ctrl/Cmd + wheel and +/-/0 keys, the gestures people already expect.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // Must be non-passive to preventDefault, or the browser zooms the whole page.
      e.preventDefault();
      applyZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Never hijack typing in the chapter comments.
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); applyZoom(zoom + ZOOM_STEP); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); applyZoom(zoom - ZOOM_STEP); }
      else if (e.key === "0") { e.preventDefault(); applyZoom(100); }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [zoom, applyZoom]);

  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);

  if (currentChapter?.isLocked) {
    return (
      <div className="bg-[#09090b] min-h-screen flex items-center justify-center text-white flex-col gap-6 px-4 text-center">
        <Lock className="w-16 h-16 text-red-500 mb-2" />
        <h1 className="text-3xl font-black">Chapter Locked</h1>
        <p className="text-slate-400 max-w-md text-lg">
          This chapter is currently locked or in early access. It will be available to read once it is officially released for free.
        </p>
        {(currentChapter as any).earlyAccessUntil && (
          <p className="text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
            Unlocks on: {new Date((currentChapter as any).earlyAccessUntil).toLocaleString()}
          </p>
        )}
        <Link href={`/manhwa/${encodeURIComponent(id)}`} className="mt-4 px-6 py-3 bg-[#1e1e24] hover:bg-[#2a2a32] rounded-lg font-bold transition-colors border border-[#2a2a32] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to details
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingScreen message="Loading pages from Asura" />
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="bg-[#09090b] min-h-screen flex items-center justify-center text-white flex-col gap-4">
        <p className="text-xl font-bold">Failed to load chapter</p>
        <Link href={`/manhwa/${encodeURIComponent(id)}`} className="text-red-400 hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to details
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#09090b] min-h-screen text-white pb-24">
      {/* Top Navigation Bar */}
      {!isFullscreen && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4 md:px-8">
          <Link 
            href={`/manhwa/${encodeURIComponent(id)}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back to {manhwa?.title || 'Details'}</span>
          </Link>

          <div className="font-bold text-center absolute left-1/2 -translate-x-1/2">
            {currentChapter?.title || `Chapter ${chapterId}`}
          </div>

          <div className="flex items-center gap-2">
            {prevChapterId ? (
              <Link 
                href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(prevChapterId)}`}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                title="Previous Chapter"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
            ) : (
              <div className="p-2 opacity-30 cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></div>
            )}
            {nextChapterId ? (
              <Link 
                href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(nextChapterId)}`}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                title="Next Chapter"
              >
                <ChevronRight className="w-5 h-5" />
              </Link>
            ) : (
              <div className="p-2 opacity-30 cursor-not-allowed"><ChevronRight className="w-5 h-5" /></div>
            )}
          </div>
        </div>
      )}
      {/* Reader area. The outer wrapper scrolls horizontally once zoom takes the
          column past the viewport — that panning IS the zoom-in experience. */}
      <div className="w-full overflow-x-auto">
        <div
          /**
           * width = min(100%, 800px) * zoom
           *
           * The min() is load-bearing. A plain `800px * zoom` would be 800px wide
           * at 100% on a 375px phone — horizontal panning at DEFAULT zoom, where
           * the old max-w-[800px] correctly gave full-width-and-no-scroll. This
           * keeps 100% pixel-identical to the previous layout on every screen,
           * and only grows past the viewport when the reader actually zooms in.
           */
          style={{ width: `calc(min(100%, ${BASE_READER_WIDTH}px) * ${zoom / 100})`, maxWidth: "none" }}
          className={`mx-auto flex flex-col items-center select-none bg-[#09090b] cursor-pointer ${isFullscreen ? 'pt-0' : 'pt-16'}`}
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {pages.map((page, index) => (
            <img
              key={page.page || index}
              src={`/api/manhwa-image?url=${encodeURIComponent(page.img)}`}
              alt={`Page ${page.page}`}
              loading="lazy"
              decoding="async"
              // Gentle fade the moment the page finishes decoding — a cheap
              // opacity-only transition (no transform), so scrolling stays smooth.
              onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
              className="reader-page w-full h-auto object-contain bg-[#111]"
            />
          ))}
        </div>
      </div>

      {/* Zoom controls — fixed, so they stay reachable in fullscreen where the top
          bar is hidden. stopPropagation on every one of them: the reader column
          toggles fullscreen on click, and without it every zoom tap would also
          flip fullscreen. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-5 right-4 z-[60] flex items-center gap-1 rounded-full border border-white/10 bg-[#09090b]/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      >
        <button
          onClick={(e) => { e.stopPropagation(); applyZoom(zoom - ZOOM_STEP); }}
          disabled={zoom <= ZOOM_MIN}
          title="Zoom out (−)"
          aria-label="Zoom out"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); applyZoom(100); }}
          title="Reset zoom (0)"
          aria-label="Reset zoom to 100%"
          className="min-w-[54px] rounded-full px-2 py-1.5 text-center text-xs font-black tabular-nums text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
          {zoom}%
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); applyZoom(zoom + ZOOM_STEP); }}
          disabled={zoom >= ZOOM_MAX}
          title="Zoom in (+)"
          aria-label="Zoom in"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <span className="mx-0.5 h-5 w-px bg-white/10" />

        <button
          onClick={(e) => { e.stopPropagation(); setIsFullscreen(v => !v); }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Navigation */}
      {!isFullscreen && (
        <div className="max-w-[800px] mx-auto p-8 flex items-center justify-between mt-8 border-t border-white/5">
          {prevChapterId ? (
            <Link 
              href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(prevChapterId)}`}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
            >
              <ChevronLeft className="w-5 h-5" /> Previous Chapter
            </Link>
          ) : (
            <div />
          )}
          
          {nextChapterId ? (
            <Link 
              href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(nextChapterId)}`}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl transition shadow-lg font-bold"
            >
              Next Chapter <ChevronRight className="w-5 h-5" />
            </Link>
          ) : (
            <Link 
              href={`/manhwa/${encodeURIComponent(id)}`}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition font-bold"
            >
              Finished <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
            </Link>
          )}
        </div>
      )}

      {/* Chapter Comments */}
      {!isFullscreen && (
        {/* Its own dark surface: the reader's page tint sits behind this, and
            the comment chrome is built for dark. Pinning the background here
            keeps it readable whatever the reader is set to. */}
        <div className="mt-4 border-t border-white/5 bg-[#09090b] text-white">
          <div className="max-w-[1000px] mx-auto p-4 sm:p-8">
          <CommunityFeed
            mangaId={id}
            mangaTitle={manhwa?.title}
            chapterId={chapterId}
            chapterTitle={currentChapter?.title || `Chapter`}
          />
          </div>
        </div>
      )}
    </div>
  );
}
