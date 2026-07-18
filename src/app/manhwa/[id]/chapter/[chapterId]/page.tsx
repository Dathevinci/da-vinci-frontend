"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { IMangaChapterPage, IMangaInfo } from "@/lib/asura/models";
import CommunityFeed from "@/components/community/CommunityFeed";

export default function ManhwaChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const id = decodeURIComponent(resolvedParams.id);
  const chapterId = decodeURIComponent(resolvedParams.chapterId);

  const [pages, setPages] = useState<IMangaChapterPage[]>([]);
  const [manhwa, setManhwa] = useState<IMangaInfo | null>(null);
  const [loading, setLoading] = useState(true);

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

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('hide-navbar-footer');
    } else {
      document.body.classList.remove('hide-navbar-footer');
    }
    return () => document.body.classList.remove('hide-navbar-footer');
  }, [isFullscreen]);

  const currentChapter = manhwa?.chapters?.find(c => c.id === chapterId);

  if (loading) {
    return (
      <div className="bg-[#09090b] min-h-screen flex items-center justify-center text-white flex-col gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-slate-400">Loading chapter pages from Asura...</p>
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="bg-[#09090b] min-h-screen flex items-center justify-center text-white flex-col gap-4">
        <p className="text-xl font-bold">Failed to load chapter</p>
        <Link href={`/manhwa/${encodeURIComponent(id)}`} className="text-indigo-400 hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to details
        </Link>
      </div>
    );
  }

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('hide-navbar-footer');
    } else {
      document.body.classList.remove('hide-navbar-footer');
    }
    return () => document.body.classList.remove('hide-navbar-footer');
  }, [isFullscreen]);

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

      {/* Reader area */}
      <div 
        className={`max-w-[800px] mx-auto flex flex-col items-center select-none bg-[#09090b] cursor-pointer ${isFullscreen ? 'pt-0' : 'pt-16'}`}
        onClick={() => setIsFullscreen(!isFullscreen)}
      >
        {pages.map((page, index) => (
          <img 
            key={page.page || index}
            src={`/api/manhwa-image?url=${encodeURIComponent(page.img)}`} 
            alt={`Page ${page.page}`}
            className="w-full h-auto object-contain bg-[#111]"
            loading="lazy"
          />
        ))}
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
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-lg font-bold"
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
        <div className="max-w-[1000px] mx-auto p-4 sm:p-8 mt-4 border-t border-white/5">
          <CommunityFeed 
            mangaId={id} 
            mangaTitle={manhwa?.title} 
            chapterId={chapterId} 
            chapterTitle={currentChapter?.title || `Chapter`} 
          />
        </div>
      )}
    </div>
  );
}
