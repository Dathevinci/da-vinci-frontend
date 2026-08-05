"use client";

import { useState } from "react";
import { Search, Book, ArrowUpDown } from "lucide-react";
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

  let filtered = chapters.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  if (!sortNewest) {
    filtered = [...filtered].reverse();
  }

  const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
  const readCount = currentIndex >= 0 ? (chapters.length - currentIndex) : 1;

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] w-[90vw] sm:w-[380px] h-[480px] rounded-[20px] bg-[#0b0c0e] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-white font-mono"
      >
        <div className="p-5 pb-3 border-b border-white/5 shrink-0 bg-[#0b0c0e]">
          <div className="flex items-center gap-2.5 text-[15px] font-bold text-white mb-0.5">
            <Book className="w-4 h-4 fill-transparent stroke-white stroke-2" />
            <span>All Chapters ({chapters.length})</span>
          </div>
          <div className="text-[11px] text-white/40 font-mono ml-6 mb-4 tracking-wide">
            {readCount} of {chapters.length} read
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0b0c0e] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[13px] font-mono text-white focus:outline-none focus:border-white/30 placeholder:text-white/40"
              />
            </div>
            <button 
              onClick={() => setSortNewest(!sortNewest)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0b0c0e] border border-white/10 hover:bg-white/5 rounded-xl text-[13px] font-mono transition text-white/90"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-white/60" />
              <span>{sortNewest ? "New" : "Old"}</span>
              <span className="text-[10px] text-white/40 ml-0.5">∨</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#101215] p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-white/40 text-sm font-mono">No chapters found.</div>
          ) : (
            filtered.map((chap) => {
              const isActive = chap.id === currentChapterId;
              const match = chap.title.match(/(\d+(\.\d+)?)/);
              const numStr = match ? match[1] : chap.title.replace(/chapter/i, '').trim();

              return (
                <Link
                  key={chap.id}
                  href={`/manhwa/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chap.id)}`}
                  onClick={onClose}
                  className={`flex items-start gap-4 p-3 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <div className="w-9 h-9 shrink-0 bg-[#1a1c20] rounded-xl flex items-center justify-center text-[13px] font-bold font-mono text-white/80 border border-white/5 mt-0.5">
                    {numStr}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-[14px] font-bold font-mono text-white tracking-tight">
                      Ch. {numStr}
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-sm leading-none" title="Source Language">🇮🇩</span>
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
