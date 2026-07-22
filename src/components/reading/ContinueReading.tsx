"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Play, History } from "lucide-react";
import { getContinue, removeContinue, CONTINUE_EVENT, type ReadingEntry, type ReadingKind } from "@/lib/readingHistory";
import { novelCover } from "@/lib/novelImage";

/**
 * "Continue Reading" home-feed shelf — one-tap resume to the exact chapter the
 * reader left off at, for either manhwa or novels. Purely client-side
 * (localStorage): renders nothing on the server / first paint, then fills in on
 * mount, so there's no hydration mismatch and no cost when the list is empty.
 */
export default function ContinueReading({ kind }: { kind: ReadingKind }) {
  const [items, setItems] = useState<ReadingEntry[]>([]);

  useEffect(() => {
    const load = () => setItems(getContinue(kind));
    load();
    // Update live if a chapter is read/removed in another tab or component.
    window.addEventListener(CONTINUE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CONTINUE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [kind]);

  if (items.length === 0) return null;

  const isNovel = kind === "novel";
  const accentText = isNovel ? "text-pink-400" : "text-red-400";
  const accentLabel = isNovel ? "text-pink-300" : "text-red-300";

  const coverSrc = (raw?: string) => {
    if (!raw) return "";
    return isNovel ? novelCover(raw) : `/api/manhwa-image?url=${encodeURIComponent(raw)}`;
  };

  return (
    <section className="pt-4 pl-4 md:pl-12 pr-4">
      <div className="flex items-center gap-2 mb-3">
        <History className={`w-6 h-6 ${accentText}`} />
        <h2 className="text-xl md:text-2xl font-black text-white">Continue Reading</h2>
      </div>

      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 hide-scrollbar">
        {items.map((e) => {
          const href = `/${kind}/${encodeURIComponent(e.id)}/chapter/${encodeURIComponent(e.chapterId)}`;
          const src = coverSrc(e.cover);
          return (
            <div key={e.id} className="group relative shrink-0 w-[128px] sm:w-[148px]">
              <Link href={href} className="block">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-[#151518] shadow-lg transition-transform group-hover:-translate-y-1">
                  {src ? (
                    <img src={src} alt={e.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-bold">No cover</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-2">
                    <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${accentLabel} mb-0.5`}>
                      <Play className="w-3 h-3 fill-current" /> Continue
                    </div>
                    <p className="text-[11px] text-slate-100 font-bold line-clamp-1">{e.chapterTitle || "Resume"}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[13px] font-bold text-slate-200 line-clamp-2 leading-tight">{e.title}</p>
              </Link>

              <button
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  removeContinue(kind, e.id);
                }}
                title="Remove from Continue Reading"
                aria-label="Remove"
                className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/60 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
