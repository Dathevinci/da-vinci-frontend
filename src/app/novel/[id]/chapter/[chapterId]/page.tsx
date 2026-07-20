"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, List, ArrowLeft, Minus, Plus, X, Type } from "lucide-react";
import type { NovelInfo, ChapterContent } from "@/lib/novel/ReadNovelFull";

export default function NovelReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const chapterId = decodeURIComponent(String(params.chapterId));

  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [showChapters, setShowChapters] = useState(false);

  // Restore / persist font preference.
  useEffect(() => {
    try {
      const f = Number(localStorage.getItem("novel-font"));
      if (f >= 14 && f <= 28) setFontSize(f);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("novel-font", String(fontSize));
    } catch {
      /* ignore */
    }
  }, [fontSize]);

  // Fetch the chapter + save reading progress.
  useEffect(() => {
    setLoading(true);
    setChapter(null);
    fetch(`/api/novels/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
      .then((r) => r.json())
      .then((data) => {
        setChapter(data && data.error ? null : data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    try {
      localStorage.setItem(`novel-progress:${id}`, chapterId);
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [id, chapterId]);

  // Fetch the novel once for the chapter list + reliable prev/next.
  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setNovel(data && data.error ? null : data))
      .catch(() => {});
  }, [id]);

  const chapters = novel?.chapters || [];
  const idx = chapters.findIndex((c) => c.id === chapterId);
  const prevId = (idx > 0 ? chapters[idx - 1]?.id : null) || chapter?.prev || null;
  const nextId = (idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1]?.id : null) || chapter?.next || null;

  // Window the drawer list around the current chapter to keep the DOM light.
  const drawerChapters = idx >= 0 ? chapters.slice(Math.max(0, idx - 150), idx + 150) : chapters.slice(0, 300);

  const go = (cid: string | null) => {
    if (cid) router.push(`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(cid)}`);
  };

  return (
    <div className="bg-[#0f0e0c] min-h-screen text-slate-200 selection:bg-pink-500/30">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#0f0e0c]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href={`/novel/${encodeURIComponent(id)}`} className="flex items-center gap-2 text-slate-400 hover:text-pink-400 transition text-sm font-bold min-w-0">
            <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline line-clamp-1">{novel?.title || "Back"}</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={() => setFontSize((f) => Math.max(14, f - 1))} className="p-2 rounded-lg hover:bg-white/10 text-slate-400" title="Smaller text">
              <Minus className="w-4 h-4" />
            </button>
            <Type className="w-4 h-4 text-slate-500" />
            <button onClick={() => setFontSize((f) => Math.min(28, f + 1))} className="p-2 rounded-lg hover:bg-white/10 text-slate-400" title="Larger text">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setShowChapters(true)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 ml-1" title="Chapters">
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-40 flex justify-center">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
        </div>
      ) : !chapter || !chapter.content?.length ? (
        <div className="py-40 text-center text-slate-400">
          Failed to load this chapter.{" "}
          <button onClick={() => go(chapterId)} className="text-pink-400 underline">
            Retry
          </button>
        </div>
      ) : (
        <article className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
          <h1 className="text-2xl font-black text-white mb-8 text-center">{chapter.title}</h1>
          <div className="space-y-5" style={{ fontSize, lineHeight: 1.85 }}>
            {chapter.content.map((p, i) => (
              <p key={i} className="font-garamond text-slate-300/90">
                {p}
              </p>
            ))}
          </div>

          {/* Bottom nav */}
          <div className="mt-14 flex items-center justify-between gap-3">
            <button
              onClick={() => go(prevId)}
              disabled={!prevId}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a1814] border border-white/10 disabled:opacity-30 hover:border-pink-500/40 transition font-bold text-sm"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            <button onClick={() => setShowChapters(true)} className="p-3 rounded-xl bg-[#1a1814] border border-white/10 hover:border-pink-500/40 transition" title="Chapters">
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => go(nextId)}
              disabled={!nextId}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-500 text-black disabled:opacity-30 hover:bg-pink-400 transition font-bold text-sm"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </article>
      )}

      {/* Chapter drawer */}
      {showChapters && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowChapters(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[380px] bg-[#141210] border-l border-white/10 flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-black text-white">Chapters</h3>
                <p className="text-slate-500 text-xs mt-0.5">{chapters.length} total</p>
              </div>
              <button onClick={() => setShowChapters(false)} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {drawerChapters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setShowChapters(false);
                    go(c.id);
                  }}
                  className={`w-full text-left px-5 py-3 border-b border-white/5 text-sm transition ${
                    c.id === chapterId ? "bg-pink-500/15 text-pink-300 font-bold" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {c.title}
                </button>
              ))}
              <Link
                href={`/novel/${encodeURIComponent(id)}`}
                onClick={() => setShowChapters(false)}
                className="block text-center text-pink-400 text-xs font-bold py-4 hover:underline"
              >
                View all chapters →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
