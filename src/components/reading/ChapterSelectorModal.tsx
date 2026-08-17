"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Book, ArrowUpDown, BookOpen } from "lucide-react";
import Link from "next/link";
import { IMangaChapter } from "@/lib/asura/models";
import { chapterNumberFromId } from "@/lib/manhwa/ids";

/**
 * THE CHAPTER NUMBER LIVES IN THE ID, NOT THE TITLE.
 *
 * AsuraScans chapter ids are "<series-slug>|<number>" — that is the format the
 * reader itself splits on to fetch pages. Reading the number from the TITLE
 * only worked for chapters actually named "Chapter 271"; anything with a real
 * name ("A Saintess' Duty", "Kraken (3)") had no number in its title and so
 * showed none, even though its number was sitting in its own id the whole time.
 *
 * Order matters. The id is authoritative, so it goes first. "Kraken (3)" is
 * exactly why the title is only a fallback: that 3 is part of the name, not a
 * chapter number, and trusting the title would file it under chapter 3.
 *
 * Which parts of an id may be read as a number is decided in one place, by
 * chapterNumberFromId — Rizz and MangaPill spell "chapter-<n>" out inside
 * theirs, while a FlameComics id ends in a hex token that must never be read
 * as one. Anything it declines falls through to the title, and a chapter with
 * genuinely no number shows a dash rather than an invented figure.
 */
export function chapterNo(chap: IMangaChapter): string | null {
  const fromId = chapterNumberFromId(chap.id);
  if (fromId) return fromId;
  const m = (chap.title || "").match(/chapter\s*(\d+(?:\.\d+)?)/i);
  return m ? m[1] : null;
}

export default function ChapterSelectorModal({
  mangaId,
  chapters,
  currentChapterId,
  isOpen,
  onClose,
}: {
  mangaId: string;
  chapters: IMangaChapter[];
  currentChapterId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  /**
   * Search matches the title OR the chapter number.
   *
   * Title-only matching meant typing "270" found nothing on a source whose
   * titles read "Chapter 270" only when they happen to — and the number is the
   * first thing anyone types in a list of 272 chapters.
   */
  const q = search.trim().toLowerCase();
  let filtered = q
    ? chapters.filter((c) => {
        if (c.title.toLowerCase().includes(q)) return true;
        const n = chapterNo(c);
        return !!n && n.startsWith(q);
      })
    : chapters;
  if (!sortNewest) {
    filtered = [...filtered].reverse();
  }

  const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
  const readCount = currentIndex >= 0 ? (chapters.length - currentIndex) : 1;

  /**
   * THE LIST OPENS ON WHERE YOU ARE. The current row's only marker was a
   * whisper of background (bg-white/10 — indistinguishable from hover), and
   * on a 300-chapter series it could sit far outside the initial viewport —
   * "it should show which chapter we're on", as reported. The row now
   * announces itself, and the list scrolls it into view on open.
   */
  const activeRowRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    // After the 300ms open transition, so the scroll targets settled layout.
    const t = setTimeout(() => {
      activeRowRef.current?.scrollIntoView({ block: "center" });
    }, 320);
    return () => clearTimeout(t);
  }, [isOpen, currentChapterId]);

  return (
    <>
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} aria-hidden />

      <div
        role="dialog"
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] w-[90vw] sm:w-[380px] h-[480px] rounded-[20px] bg-[#0b0c0e] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-white font-mono transform transition-all duration-300 ease-out ${isOpen ? 'scale-100 opacity-100 pointer-events-auto translate-y-0' : 'scale-95 opacity-0 pointer-events-none translate-y-4'}`}
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
              /* Position-based read state, consistent with the header's
                 "N of M read": the list is newest-first, so everything at or
                 below the current chapter's index has been passed through. */
              const chapIndex = chapters.indexOf(chap);
              const isRead = currentIndex >= 0 && chapIndex > currentIndex;
              /**
               * NUMBER AND TITLE ARE DIFFERENT THINGS.
               *
               * This took the first digits anywhere in the title and, failing
               * that, fell back to the WHOLE TITLE as the "number" — so a
               * chapter called "A Saintess' Duty" rendered its entire name
               * inside a 36px badge and again as "Ch. A Saintess' Duty".
               *
               * Anchored on "Chapter N" first so a title like "The 100th Day"
               * cannot be mistaken for chapter 100, with a bare leading number
               * as the fallback. When there is genuinely no number — some
               * sources title specials and side stories only — the badge shows
               * a dash instead of pretending, and the title carries the row.
               */
              const numStr = chapterNo(chap);
              // Whatever the title says once the "Chapter N" prefix is removed.
              // Empty for a plain "Chapter 271", which is the common case.
              const label = chap.title
                .replace(/chapter\s*\d+(?:\.\d+)?\s*[-–—:]?\s*/i, "")
                .trim();

              return (
                <Link
                  key={chap.id}
                  ref={isActive ? activeRowRef : undefined}
                  href={`/manhwa/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(chap.id)}`}
                  onClick={onClose}
                  className={`flex items-start gap-4 p-3 rounded-xl transition ${
                    isActive
                      ? 'bg-pink-500/10 ring-1 ring-pink-500/50'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[13px] font-bold font-mono mt-0.5 border ${
                    isActive
                      ? 'bg-pink-500/20 border-pink-500/40 text-pink-200'
                      : isRead
                        ? 'bg-[#14161a] border-emerald-500/20 text-emerald-400/60'
                        : 'bg-[#1a1c20] border-white/5 text-white/80'
                  }`}>
                    {numStr ?? "–"}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {/* Number on top, title under it — and `truncate` so a long
                        title takes one line instead of wrapping around the
                        badge and pushing the next row off its own baseline. */}
                    <div className={`flex items-center gap-2 text-[14px] font-bold font-mono tracking-tight`}>
                      <span className={`truncate ${isActive ? 'text-pink-100' : isRead ? 'text-white/50' : 'text-white'}`}>
                        {numStr ? `Ch. ${numStr}` : label || chap.title}
                      </span>
                      {isActive && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-pink-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-pink-300">
                          <BookOpen className="h-2.5 w-2.5" /> Reading
                        </span>
                      )}
                    </div>
                    {numStr && label && (
                      <div className={`mt-0.5 truncate text-[12px] font-medium ${isRead && !isActive ? 'text-white/30' : 'text-white/45'}`}>
                        {label}
                      </div>
                    )}
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
