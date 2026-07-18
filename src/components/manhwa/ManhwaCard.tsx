"use client";

import Link from "next/link";
import { IMangaResult } from "@/lib/asura/models";
import { useManhwaModal } from "@/components/providers/ManhwaModalProvider";

export default function ManhwaCard({ manhwa }: { manhwa: IMangaResult }) {
  const { openManhwa } = useManhwaModal();
  const ratingNum = Number(manhwa.rating);
  const displayRating = !isNaN(ratingNum) && ratingNum > 0 ? ratingNum.toFixed(1) : "N/A";
  
  const isOngoing = manhwa.status?.toString().toUpperCase() === "ONGOING";

  const chapterHref = manhwa.latest_chapters?.[0] 
    ? `/manhwa/${encodeURIComponent(manhwa.id)}/chapter/${encodeURIComponent(`${manhwa.id}|${manhwa.latest_chapters[0].number}`)}`
    : `/manhwa/${encodeURIComponent(manhwa.id)}`;

  return (
    <div className="group flex flex-col h-full bg-transparent overflow-hidden">
      <button 
        onClick={() => openManhwa(manhwa)} 
        className="relative w-full aspect-[2/3] overflow-hidden rounded-lg shadow-md block text-left"
      >
        {manhwa.image ? (
          <img
            src={`/api/manhwa-image?url=${encodeURIComponent(manhwa.image)}`}
            alt={manhwa.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ imageRendering: 'high-quality' }}
          />
        ) : (
          <div className="w-full h-full bg-[#151518] flex items-center justify-center text-slate-600">
            No Image
          </div>
        )}
        {/* Top-right Status Badge */}
        {isOngoing && (
          <div className="absolute top-1 right-1 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm tracking-wide">
            ONGOING
          </div>
        )}
        {/* Top-left Rating Badge (Asura style) */}
        {!isNaN(ratingNum) && ratingNum > 0 && (
          <div className="absolute top-1 left-1 bg-black/80 border border-[#2a2a32] text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-md">
            ★ {displayRating}
          </div>
        )}
      </button>

      <div className="pt-2 flex flex-col flex-1 bg-[#0b0b0c]">
        <button onClick={() => openManhwa(manhwa)} className="text-left w-full">
          <h3 className="font-bold text-[#e2e8f0] text-[13px] leading-tight line-clamp-2 mb-1 hover:text-[#8a2be2] transition-colors">
            {manhwa.title}
          </h3>
        </button>
        <Link href={chapterHref} className="text-[11px] font-bold text-[#a3a3a3] mb-1 hover:text-[#8a2be2] transition-colors w-fit">
          {manhwa.latestChapter || (manhwa.latest_chapters?.[0] ? `Chapter ${manhwa.latest_chapters[0].number}` : "Chapter ?")}
        </Link>
        <div className="flex items-center gap-1 mt-auto pointer-events-none">
          <div className="flex text-yellow-500 text-[10px]">
            ★★★★★
          </div>
          <span className="text-[10px] font-bold text-slate-400 ml-1">{manhwa.rating || "N/A"}</span>
        </div>
      </div>
    </div>
  );
}
