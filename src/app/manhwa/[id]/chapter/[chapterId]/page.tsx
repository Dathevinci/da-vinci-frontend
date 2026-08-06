"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, MessageSquare, X } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { IMangaChapterPage, IMangaInfo } from "@/lib/asura/models";
import CommunityFeed from "@/components/community/CommunityFeed";
import { useUser } from "@/hooks/useUser";
import { earnPoints } from "@/lib/earn";
import { recordReading } from "@/lib/readingHistory";

import { useManhwaStatus } from "@/hooks/useManhwaStatus";
import { useToast } from "@/components/ui/Toast";
import ReaderNavigation from "@/components/reading/ReaderNavigation";
import ChapterSelectorModal from "@/components/reading/ChapterSelectorModal";
import ManhwaReaderSettings from "@/components/reading/ManhwaReaderSettings";
import { loadManhwaPrefs, saveManhwaPrefs, themeById, ManhwaReaderPrefs } from "@/lib/manhwa/readerPrefs";

export default function ManhwaChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const id = decodeURIComponent(resolvedParams.id);
  const chapterId = decodeURIComponent(resolvedParams.chapterId);

  const [pages, setPages] = useState<IMangaChapterPage[]>([]);
  const [manhwa, setManhwa] = useState<IMangaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const { setStatus, isTracked } = useManhwaStatus();
  const { toast } = useToast();

  // UI State
  const [prefs, setPrefs] = useState<ManhwaReaderPrefs | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [showSideChat, setShowSideChat] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  // Refs for tracking elements
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | HTMLCanvasElement | null)[]>([]);

  // Load preferences
  useEffect(() => {
    setPrefs(loadManhwaPrefs());
  }, []);

  const updatePrefs = useCallback((patch: Partial<ManhwaReaderPrefs>) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveManhwaPrefs(next);
      return next;
    });
  }, []);

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

  // Intersection Observer for Vertical Page tracking
  useEffect(() => {
    if (pages.length === 0 || !prefs || prefs.onePageView || prefs.readingDirection !== "vertical") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) setCurrentPageIndex(index);
          }
        });
      },
      {
        root: null,
        rootMargin: "-45% 0px -45% 0px",
        threshold: 0,
      }
    );

    imageRefs.current.forEach((img) => {
      if (img) observer.observe(img);
    });

    return () => observer.disconnect();
  }, [pages.length, prefs?.onePageView, prefs?.readingDirection]);

  // Auto scroll feature
  useEffect(() => {
    if (!prefs?.autoScroll) return;
    const interval = setInterval(() => {
      window.scrollBy({ top: 2, behavior: "smooth" });
    }, 30);
    return () => clearInterval(interval);
  }, [prefs?.autoScroll]);

  // Auto Next Chapter on bottom scroll
  useEffect(() => {
    if (!prefs?.autoNextChapter || !nextChapterId) return;

    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        window.removeEventListener("scroll", handleScroll);
        window.location.href = `/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(nextChapterId)}`;
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prefs?.autoNextChapter, nextChapterId, id]);

  // Handle Canvas Rendering toggle
  useEffect(() => {
    if (!prefs?.canvasRendering || pages.length === 0) return;

    pages.forEach((page, index) => {
      const canvas = imageRefs.current[index] as HTMLCanvasElement | null;
      if (canvas && canvas.tagName === "CANVAS") {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `/api/manhwa-image?url=${encodeURIComponent(page.img)}`;
        img.onload = () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
        };
      }
    });
  }, [prefs?.canvasRendering, pages]);

  // Handle capture panel
  const handleCapture = async () => {
    const el = imageRefs.current[currentPageIndex - 1];
    if (!el) return;

    try {
      if (el.tagName === "CANVAS") {
        const dataUrl = (el as HTMLCanvasElement).toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${manhwa?.title || 'manga'}_ch${chapterId}_page${currentPageIndex}.png`;
        a.click();
      } else {
        const imgEl = el as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(imgEl, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${manhwa?.title || 'manga'}_ch${chapterId}_page${currentPageIndex}.png`;
        a.click();
      }
    } catch (e) {
      console.error("Capture failed:", e);
      alert("Failed to capture panel. (CORS restriction on proxy image)");
    }
  };

  // Remember progress
  useEffect(() => {
    if (loading || pages.length === 0) return;
    const cc = manhwa?.chapters?.find((c) => c.id === chapterId);
    if ((cc as any)?.isLocked) return;
    try {
      localStorage.setItem(`manhwa-progress:${id}`, chapterId);
    } catch { /* ignore */ }
    if (manhwa?.title) {
      recordReading("manhwa", { id, title: manhwa.title, cover: manhwa.image, chapterId, chapterTitle: cc?.title });
    }
  }, [loading, pages.length, manhwa, id, chapterId]);

  // Reward reading
  useEffect(() => {
    if (!user || loading || pages.length === 0) return;
    const cc = manhwa?.chapters?.find((c) => c.id === chapterId);
    if ((cc as any)?.isLocked) return;
    const t = setTimeout(() => {
      earnPoints(user.id, "read", `manhwa:${id}:${chapterId}`);
    }, 3500);
    return () => clearTimeout(t);
  }, [user, loading, pages.length, manhwa, id, chapterId]);

  // Zoom logic
  const BASE_READER_WIDTH = 800;
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 300;
  const ZOOM_STEP = 10;
  const ZOOM_KEY = "davinci_reader_zoom";

  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(ZOOM_KEY) || "", 10);
      if (Number.isFinite(saved) && saved >= ZOOM_MIN && saved <= ZOOM_MAX) setZoom(saved);
    } catch { /* ignore */ }
  }, []);

  const applyZoom = useCallback((next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next)));
    setZoom(clamped);
    try {
      localStorage.setItem(ZOOM_KEY, String(clamped));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      applyZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); applyZoom(zoom + ZOOM_STEP); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); applyZoom(zoom - ZOOM_STEP); }
      else if (e.key === "0") { e.preventDefault(); applyZoom(100); }
      else if (e.key === "ArrowLeft") {
        if (prefs?.readingDirection === "rtl") setCurrentPageIndex(p => Math.min(pages.length, p + 1));
        else setCurrentPageIndex(p => Math.max(1, p - 1));
      }
      else if (e.key === "ArrowRight") {
        if (prefs?.readingDirection === "rtl") setCurrentPageIndex(p => Math.max(1, p - 1));
        else setCurrentPageIndex(p => Math.min(pages.length, p + 1));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [zoom, applyZoom, pages.length, prefs?.readingDirection]);

  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);

  if (currentChapter?.isLocked && !loading && pages.length === 0) {
    return (
      <div className="bg-[#09090b] min-h-screen flex items-center justify-center text-white flex-col gap-6 px-4 text-center">
        <Lock className="w-16 h-16 text-red-500 mb-2" />
        <h1 className="text-3xl font-black">Chapter Locked</h1>
        <p className="text-slate-400 max-w-md text-lg">
          This chapter is currently locked or in early access.
        </p>
        <Link href={`/manhwa/${encodeURIComponent(id)}`} className="mt-4 px-6 py-3 bg-[#1e1e24] hover:bg-[#2a2a32] rounded-lg font-bold transition-colors border border-[#2a2a32] flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to details
        </Link>
      </div>
    );
  }

  if (loading || !prefs) {
    return <LoadingScreen message="Loading pages from Asura" />;
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

  const activeTheme = themeById(prefs.theme);
  const isSinglePage = prefs.onePageView || prefs.readingDirection === "ltr" || prefs.readingDirection === "rtl";
  const displayedPages = isSinglePage ? [pages[currentPageIndex - 1] || pages[0]] : pages;

  const navVisible = isPinned || (uiVisible && !showSettings && !showChapterSelector);

  return (
    <div 
      className="min-h-screen transition-colors duration-300 relative overflow-x-hidden" 
      style={{ backgroundColor: activeTheme.bg, color: activeTheme.text }}
    >
      {/* Floating Navigation Controls */}
      <ReaderNavigation
        manhwa={manhwa}
        chapterId={chapterId}
        prevChapterId={prevChapterId}
        nextChapterId={nextChapterId}
        currentPageIndex={currentPageIndex}
        totalPages={pages.length}
        isChapterSelectorOpen={showChapterSelector}
        isVisible={navVisible}
        isPinned={isPinned}
        onTogglePin={() => setIsPinned(p => !p)}
        /**
         * These two were `alert("Added to Library!")` and
         * `alert("Marked as Read!")` — they claimed to save and saved nothing,
         * while the real implementations sat unused in useManhwaStatus.
         *
         * Both now call setStatus, which persists locally, syncs to the
         * backend, and awards Arise Points for tracking. Feedback goes through
         * the app's toast rather than a browser alert, like every other action.
         */
        onLibraryAdd={async () => {
          if (!manhwa) return;
          const on = isTracked(id);
          await setStatus(id, manhwa.title, manhwa.image, on ? "None" : "Reading");
          toast(on ? "Removed from your library." : `${manhwa.title} added to your library.`, "success");
        }}
        onMarkRead={async () => {
          if (!manhwa) return;
          // Marking read implies you have it — track it if you don't, so the
          // status has somewhere to live.
          await setStatus(id, manhwa.title, manhwa.image, "Completed");
          toast("Marked as read.", "success");
        }}
        onOpenSettings={() => setShowSettings(true)}
        onOpenChapterSelector={() => setShowChapterSelector(v => !v)}
        onCapture={handleCapture}
      />

      {/* Reader Area */}
      <div className="w-full overflow-x-auto min-h-screen flex flex-col justify-center" ref={containerRef}>
        <div
          style={{ 
            width: `calc(min(100%, ${BASE_READER_WIDTH}px) * ${zoom / 100})`, 
            maxWidth: "none",
            gap: `${prefs.pageGap}px`,
          }}
          className={`mx-auto flex flex-col items-center select-none cursor-pointer transition-all ${uiVisible ? 'pt-24 pb-24' : 'pt-0 pb-0'}`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, a')) return;
            setUiVisible(!uiVisible);
          }}
        >
          {displayedPages.map((page, index) => {
            const actualIndex = isSinglePage ? currentPageIndex : index + 1;
            
            return prefs.canvasRendering ? (
              <canvas
                key={page.page || actualIndex}
                ref={(el) => { imageRefs.current[actualIndex - 1] = el; }}
                data-index={actualIndex}
                className="reader-page w-full h-auto object-contain"
                style={{ 
                  backgroundColor: activeTheme.panel,
                  filter: `brightness(${prefs.brightness}%)`
                }}
              />
            ) : (
              <img
                key={page.page || actualIndex}
                ref={(el) => { imageRefs.current[actualIndex - 1] = el; }}
                data-index={actualIndex}
                crossOrigin="anonymous"
                src={`/api/manhwa-image?url=${encodeURIComponent(page.img)}`}
                alt={`Page ${page.page}`}
                loading="lazy"
                decoding="async"
                onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
                className="reader-page w-full h-auto object-contain"
                style={{ 
                  backgroundColor: activeTheme.panel,
                  filter: `brightness(${prefs.brightness}%)`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Single Page Navigation Arrows */}
      {isSinglePage && (
        <>
          <button
            onClick={() => {
              if (prefs.readingDirection === "rtl") setCurrentPageIndex(p => Math.min(pages.length, p + 1));
              else setCurrentPageIndex(p => Math.max(1, p - 1));
            }}
            disabled={prefs.readingDirection === "rtl" ? currentPageIndex >= pages.length : currentPageIndex <= 1}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              if (prefs.readingDirection === "rtl") setCurrentPageIndex(p => Math.max(1, p - 1));
              else setCurrentPageIndex(p => Math.min(pages.length, p + 1));
            }}
            disabled={prefs.readingDirection === "rtl" ? currentPageIndex <= 1 : currentPageIndex >= pages.length}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Side Chat Trigger Button */}
      {prefs.sideChat && !showSideChat && (
        <button
          onClick={() => setShowSideChat(true)}
          className="fixed bottom-20 right-4 z-40 p-3 rounded-full bg-pink-600 text-white shadow-xl hover:bg-pink-500 transition flex items-center gap-2 font-bold text-sm"
        >
          <MessageSquare className="w-5 h-5" />
          Comments
        </button>
      )}

      {/* Side Chat Drawer */}
      {prefs.sideChat && showSideChat && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-[#09090b] border-l border-white/10 shadow-2xl flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-pink-500" />
              Chapter Comments
            </h3>
            <button onClick={() => setShowSideChat(false)} className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CommunityFeed
              mangaId={id}
              mangaTitle={manhwa?.title}
              chapterId={chapterId}
              chapterTitle={currentChapter?.title || `Chapter`}
            />
          </div>
        </div>
      )}

      {/* Zoom Controls (Bottom Right) */}
      {prefs.allowZoomInOut && (
        <div
          className={`fixed bottom-5 right-[84px] z-[40] flex items-center h-12 rounded-[24px] border border-white/5 bg-[#131313] px-2 shadow-2xl transform transition-all duration-300 ease-in-out ${navVisible ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-16 opacity-0 pointer-events-none'}`}
        >
          <button onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition">
            <ZoomOut className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => applyZoom(100)} className="w-[60px] h-10 flex items-center justify-center rounded-full text-center text-[13px] font-black font-mono tabular-nums text-white hover:bg-white/10 transition">
            {zoom}%
          </button>
          <button onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition">
            <ZoomIn className="h-[18px] w-[18px]" />
          </button>
          <span className="mx-1 h-5 w-[1px] bg-white/10" />
          <button onClick={() => setUiVisible(!uiVisible)} className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition">
            <Maximize2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      {/* Chapter Comments (Below) */}
      {!prefs.plainView && !prefs.sideChat && (
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

      {/* Modals */}
      <ManhwaReaderSettings
        prefs={prefs}
        update={updatePrefs}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {manhwa?.chapters && (
        <ChapterSelectorModal
          mangaId={id}
          chapters={manhwa.chapters}
          currentChapterId={chapterId}
          isOpen={showChapterSelector}
          onClose={() => setShowChapterSelector(false)}
        />
      )}
    </div>
  );
}
