"use client";

import { useState } from "react";
import { Search, ArrowUpDown, Bookmark, ChevronDown } from "lucide-react";
import Link from "next/link";
import { IMangaChapter } from "@/lib/asura/models";

export default function ChapterSelectorModal({
  mangaId,
  chapters,
  currentChapterId,
  onClose,
}: {
  mangaId: string;
  chapters: IMangaChapter[];
  currentChapterId: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  // Filter and sort chapters
  let filtered = chapters.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  if (!sortNewest) {
    filtered = [...filtered].reverse();
  }

  const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
  const readCount = currentIndex >= 0 ? (chapters.length - currentIndex) : 1;

  return (
    <>
      {/* Invisible backdrop to dismiss */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden />

      {/* Floating Modal positioned above the bottom control bar */}
      <div
        role="dialog"
        className="fixed bottom-18 left-1/2 -translate-x-1/2 z-[70] w-[90vw] sm:w-[420px] h-[520px] rounded-2xl bg-[#0b0d10] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-white font-mono"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5 text-lg font-black tracking-tight text-white mb-1">
            <Bookmark className="w-5 h-5 fill-white text-white" />
            <span>All Chapters ({chapters.length})</span>
          </div>
          <div className="text-xs text-white/40 font-medium ml-7">
            {readCount} of {chapters.length} read
          </div>

          {/* Search and Sort row */}
          <div className="flex items-center gap-2 mt-5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#14171d] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm font-sans text-white focus:outline-none focus:border-white/30 placeholder:text-white/30"
              />
            </div>
            <button 
              onClick={() => setSortNewest(!sortNewest)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#14171d] border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold font-sans transition text-white/90"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-white/60" />
              <span>{sortNewest ? "New" : "Old"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>
        </div>

        {/* Scrollable Chapter List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 font-sans">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-white/40 text-sm font-mono">No chapters found.</div>
          ) : (
            filtered.map((chap) => {
              const isActive = chap.id === currentChapterId;
              
              // Extract numeric chapter string (e.g., "Ch. 25")
              const match = chap.title.match(/(\d+(\.\d+)?)/);
              const numStr = match ? match[1] : chap.title.replace(/chapter/i, '').trim();

              return (
                <Link
                  key={chap.id}
                  href={`/manhwa/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chap.id)}`}
                  onClick={onClose}
                  className={`flex items-center gap-4 p-3 rounded-xl transition ${isActive ? 'bg-white/15' : 'hover:bg-white/5'}`}
                >
                  {/* Badge Icon */}
                  <div className="w-11 h-11 shrink-0 bg-[#161a22] rounded-xl flex items-center justify-center text-xs font-black font-mono text-white/80 border border-white/5">
                    {numStr}
                  </div>

                  {/* Title & Flag */}
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-extrabold font-mono text-white tracking-tight">
                      Ch. {numStr}
                    </div>
                    {/* Flag badge matching Screenshot 2 */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs">🇬🇧</span>
                      {chap.releaseDate && (
                        <span className="text-[11px] text-white/40 font-mono">
                          {chap.releaseDate}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
