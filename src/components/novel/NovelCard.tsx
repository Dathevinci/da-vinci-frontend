"use client";

import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import { MediaHoverPreview } from "@/components/anime/HoverPreview";

import { useNovelCover } from "@/lib/novel/useNovelCover";

/**
 * ONE NOVEL CARD. Hover summons the follower dossier (same as anime);
 * click goes straight to the novel page — the quick-view popup and the
 * old in-place pop-out are both retired.
 */
export default function NovelCard({ novel }: { novel: NovelResult }) {
  const router = useRouter();
  const { cover, onError: onCoverError } = useNovelCover(novel.title, novel.cover);

  const sourceName = novel.id.startsWith("nf:")
    ? "NovelFull"
    : novel.id.startsWith("lnw:")
    ? "LightNovelWorld"
    : novel.id.startsWith("fmtl:")
    ? "FanMTL"
    : "ReadNovelFull";

  const open = () => router.push(`/novel/${encodeURIComponent(novel.id)}`);

  return (
    <MediaHoverPreview
      title={novel.title}
      image={cover || null}
      chips={[
        sourceName,
        ...(novel.latestChapter ? [novel.latestChapter] : []),
      ]}
      stats={[
        ["Source", sourceName],
        ["Latest", novel.latestChapter || "—"],
      ]}
    >
      <div className="group relative flex h-full flex-col bg-transparent">
        <button onClick={open} className="relative block w-full overflow-hidden rounded-lg text-left shadow-md transition-transform duration-300 hover:scale-[1.03] aspect-[2/3]">
          <span className="absolute top-2 left-2 z-10 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-black text-pink-400 backdrop-blur-md border border-pink-500/20 uppercase tracking-wider shadow-lg">
            {sourceName}
          </span>
          {cover ? (
            <img
              src={cover}
              alt={novel.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={onCoverError}
              className="hq-image h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#151518] text-slate-600">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
        </button>

        <div className="flex flex-1 flex-col pt-2">
          <button onClick={open} className="w-full text-left">
            <h3 className="mb-1 line-clamp-2 text-[13px] font-bold leading-tight text-[#e2e8f0] transition-colors hover:text-pink-400">
              {novel.title}
            </h3>
          </button>
          {novel.latestChapter && <p className="line-clamp-1 text-[11px] font-bold text-slate-500">{novel.latestChapter}</p>}
        </div>
      </div>
    </MediaHoverPreview>
  );
}
