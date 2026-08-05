"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { IMangaChapterPage, IMangaInfo } from "@/lib/asura/models";
import CommunityFeed from "@/components/community/CommunityFeed";
import { useUser } from "@/hooks/useUser";
import { earnPoints } from "@/lib/earn";
import { recordReading } from "@/lib/readingHistory";

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

  // New UI State
  const [prefs, setPrefs] = useState<ManhwaReaderPrefs | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  // Refs for tracking elements
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

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

  // Intersection Observer for Current Page tracking
  useEffect(() => {
    if (pages.length === 0) return;

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
        rootMargin: "-45% 0px -45% 0px", // Detect when image crosses middle of screen
        threshold: 0,
      }
    );

    imageRefs.current.forEach((img) => {
      if (img) observer.observe(img);
    });

    return () => observer.disconnect();
  }, [pages.length]);

  // Handle capturing the currently visible panel
  const handleCapture = async () => {
    const currentImg = imageRefs.current[currentPageIndex - 1];
    if (!currentImg) return;

    try {
      // Create an invisible canvas to draw the image natively
      const canvas = document.createElement("canvas");
      canvas.width = currentImg.naturalWidth;
      canvas.height = currentImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      ctx.drawImage(currentImg, 0, 0);
      
      // Download it
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${manhwa?.title || 'manga'}_ch${chapterId}_page${currentPageIndex}.png`;
      a.click();
    } catch (e) {
      console.error("Capture failed:", e);
      alert("Failed to capture panel. (CORS restriction on proxy image)");
    }
  };

  // Remember where you're up to
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
    } catch { /* private mode / storage disabled */ }
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
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [zoom, applyZoom]);

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
  const gapPx = prefs.pageGap;

  return (
    <div 
      className="min-h-screen transition-colors duration-300" 
      style={{ backgroundColor: activeTheme.bg, color: activeTheme.text }}
    >
      {/* Floating Navigation Controls */}
      <div className={`transition-opacity duration-300 ${uiVisible && !showSettings && !showChapterSelector ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <ReaderNavigation
          manhwa={manhwa}
          chapterId={chapterId}
          prevChapterId={prevChapterId}
          nextChapterId={nextChapterId}
          currentPageIndex={currentPageIndex}
          totalPages={pages.length}
          onOpenSettings={() => setShowSettings(true)}
          onOpenChapterSelector={() => setShowChapterSelector(true)}
          onCapture={handleCapture}
        />
      </div>

      {/* Reader Area */}
      <div className="w-full overflow-x-auto" ref={containerRef}>
        <div
          style={{ 
            width: `calc(min(100%, ${BASE_READER_WIDTH}px) * ${zoom / 100})`, 
            maxWidth: "none",
            gap: `${gapPx}px`,
          }}
          className={`mx-auto flex flex-col items-center select-none cursor-pointer transition-all ${uiVisible ? 'pt-24 pb-24' : 'pt-0 pb-0'}`}
          onClick={(e) => {
            // Don't toggle UI if clicking on a button inside the reader
            if ((e.target as HTMLElement).closest('button, a')) return;
            setUiVisible(!uiVisible);
          }}
        >
          {pages.map((page, index) => (
            <img
              key={page.page || index}
              ref={(el) => { imageRefs.current[index] = el; }}
              data-index={index + 1}
              // The API `/api/manhwa-image` proxies the image natively.
              // To allow canvas capture, we MUST add crossOrigin="anonymous" 
              // AND the proxy MUST set Access-Control-Allow-Origin: *
              crossOrigin="anonymous"
              src={`/api/manhwa-image?url=${encodeURIComponent(page.img)}`}
              alt={`Page ${page.page}`}
              loading="lazy"
              decoding="async"
              onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
              className="reader-page w-full h-auto object-contain"
              style={{ backgroundColor: activeTheme.panel }}
            />
          ))}
        </div>
      </div>

      {/* Zoom Controls (Bottom Right) */}
      <div
        className={`fixed bottom-5 right-4 z-[40] flex items-center gap-1 rounded-full border border-white/10 bg-[#09090b]/90 p-1.5 shadow-2xl backdrop-blur-xl transition-opacity duration-300 ${uiVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <button onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button onClick={() => applyZoom(100)} className="min-w-[54px] rounded-full px-2 py-1.5 text-center text-xs font-black tabular-nums text-slate-200 hover:bg-white/10 hover:text-white">
          {zoom}%
        </button>
        <button onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-white/10" />
        <button onClick={() => setUiVisible(!uiVisible)} className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Chapter Comments (Side Chat / Below) */}
      {!prefs.plainView && (
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
      {showSettings && (
        <ManhwaReaderSettings
          prefs={prefs}
          update={updatePrefs}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showChapterSelector && manhwa?.chapters && (
        <ChapterSelectorModal
          mangaId={id}
          chapters={manhwa.chapters}
          currentChapterId={chapterId}
          onClose={() => setShowChapterSelector(false)}
        />
      )}
    </div>
  );
}
