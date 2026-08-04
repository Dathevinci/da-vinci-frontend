"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IMangaResult } from "@/lib/asura/models";
import { MediaHoverPreview } from "@/components/anime/HoverPreview";

/**
 * ONE MANHWA CARD. Hover summons the follower dossier (same as anime);
 * click goes straight to the series page — the quick-view popup and the
 * old in-place pop-out are both retired.
 */
export default function ManhwaCard({ manhwa }: { manhwa: IMangaResult }) {
  const router = useRouter();

  const ratingNum = Number(manhwa.rating);
  const displayRating = !isNaN(ratingNum) && ratingNum > 0 ? ratingNum.toFixed(1) : "N/A";
  const hasRating = !isNaN(ratingNum) && ratingNum > 0;
  const isOngoing = manhwa.status?.toString().toUpperCase() === "ONGOING";

  const cover = manhwa.image ? `/api/manhwa-image?url=${encodeURIComponent(manhwa.image)}` : null;
  const chapterLabel = manhwa.latestChapter || (manhwa.latest_chapters?.[0] ? `Chapter ${manhwa.latest_chapters[0].number}` : null);
  const chapterHref = manhwa.latest_chapters?.[0]
    ? `/manhwa/${encodeURIComponent(manhwa.id)}/chapter/${encodeURIComponent(`${manhwa.id}|${manhwa.latest_chapters[0].number}`)}`
    : `/manhwa/${encodeURIComponent(manhwa.id)}`;

  const open = () => router.push(`/manhwa/${encodeURIComponent(manhwa.id)}`);

  return (
    <MediaHoverPreview
      title={manhwa.title}
      image={cover}
      chips={[
        ...(hasRating ? [`★ ${displayRating}`] : []),
        "Manhwa",
        ...(manhwa.status ? [String(manhwa.status)] : []),
      ]}
      stats={[
        ["Format", "Manhwa"],
        ["Status", String(manhwa.status || "—")],
        ["Latest", chapterLabel || "—"],
        ["Score", hasRating ? `${displayRating} / 10` : "—"],
      ]}
    >
      <div className="group relative flex h-full flex-col bg-transparent">
        <button
          onClick={open}
          className="relative block w-full overflow-hidden rounded-lg text-left shadow-md transition-transform duration-300 hover:scale-[1.03] aspect-[2/3]"
        >
          {cover ? (
            <img
              src={cover}
              alt={manhwa.title}
              loading="lazy"
              decoding="async"
              className="hq-image h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#151518] text-slate-600">No Image</div>
          )}
          {isOngoing && (
            <div className="absolute right-1 top-1 rounded bg-green-500 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white shadow-sm">ONGOING</div>
          )}
          {hasRating && (
            <div className="absolute left-1 top-1 flex items-center gap-1 rounded border border-[#2a2a32] bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-yellow-500 backdrop-blur-md">
              ★ {displayRating}
            </div>
          )}
        </button>

        <div className="flex flex-1 flex-col bg-[#0b0b0c] pt-2">
          <button onClick={open} className="w-full text-left">
            <h3 className="mb-1 line-clamp-2 text-[13px] font-bold leading-tight text-[#e2e8f0] transition-colors hover:text-[#dc2626]">
              {manhwa.title}
            </h3>
          </button>
          <Link href={chapterHref} className="mb-1 w-fit text-[11px] font-bold text-[#a3a3a3] transition-colors hover:text-[#dc2626]">
            {chapterLabel || "Chapter ?"}
          </Link>
          <div className="pointer-events-none mt-auto flex items-center gap-1">
            <div className="flex text-[10px] text-yellow-500">★★★★★</div>
            <span className="ml-1 text-[10px] font-bold text-slate-400">{displayRating}</span>
          </div>
        </div>
      </div>
    </MediaHoverPreview>
  );
}
