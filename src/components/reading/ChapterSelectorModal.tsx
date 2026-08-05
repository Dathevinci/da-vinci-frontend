"use client";

import { useState } from "react";
import { Search, ArrowDownUp, X } from "lucide-react";
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
  const readCount = chapters.length - (currentIndex >= 0 ? currentIndex : 0);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        className="fixed inset-x-4 top-24 bottom-24 sm:inset-y-auto sm:top-[15vh] sm:bottom-[15vh] sm:left-1/2 sm:-translate-x-1/2 z-[70] w-auto sm:w-[400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: "#09090b", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="p-5 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-black flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center">📑</span>
              All Chapters ({chapters.length})
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-sm font-medium text-white/40 mb-4">
            {readCount} of {chapters.length} read
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#18181b] border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-white/30 text-white placeholder:text-white/30"
              />
            </div>
            <button 
              onClick={() => setSortNewest(!sortNewest)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#18181b] border border-white/10 hover:bg-white/10 rounded-lg text-sm font-bold transition"
            >
              <ArrowDownUp className="w-4 h-4 text-white/50" />
              {sortNewest ? "New" : "Old"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">No chapters found.</div>
          ) : (
            <div className="flex flex-col">
              {filtered.map((chap, i) => {
                const isActive = chap.id === currentChapterId;
                // Try to extract a chapter number for the badge
                const match = chap.title.match(/(\d+(\.\d+)?)/);
                const badgeNum = match ? match[1] : (chapters.length - i);
                
                return (
                  <Link
                    key={chap.id}
                    href={`/manhwa/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chap.id)}`}
                    onClick={onClose}
                    className={`flex items-center gap-4 p-3 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  >
                    <div className="w-10 h-10 shrink-0 bg-white/5 rounded-lg flex items-center justify-center text-xs font-black text-white/70">
                      {badgeNum}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                        {chap.title}
                      </div>
                      {chap.releaseDate && (
                        <div className="text-xs text-white/40 mt-0.5">
                          {chap.releaseDate}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
