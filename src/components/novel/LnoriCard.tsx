"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import { MediaHoverPreview } from "@/components/anime/HoverPreview";
import { novelCover } from "@/lib/novelImage";

/**
 * ONE LNORI SERIES. Hover summons the same dossier as anime, manhwa and the
 * other novel sources; click opens the volume list.
 *
 * The cover falls through three stages, because no single source has art for
 * every title:
 *
 *   1. AniList, when the series is on there under a name we can match.
 *   2. Volume one's own cover, extracted from its EPUB. This is the real
 *      published artwork and is arguably the better picture — it just costs a
 *      request, so it is second.
 *   3. A drawn placeholder carrying the title.
 *
 * Stage 3 used to be a placehold.co URL, which the app wrapped in
 * /api/novel-image; that proxy has an allowlist, placehold.co is not on it, and
 * every unmatched title came back 403. A page of broken images is worse than a
 * plain box.
 */
export default function LnoriCard({ novel }: { novel: NovelResult }) {
  const router = useRouter();
  const slug = String(novel.id).replace(/^lnori:/, "");

  // Start at whichever stage has something to try.
  const [stage, setStage] = useState<0 | 1 | 2>(novel.cover ? 0 : 1);

  const src =
    stage === 0
      ? novelCover(novel.cover)
      : stage === 1
      ? `/api/proxy/lnori/series-cover?slug=${encodeURIComponent(slug)}`
      : null;

  const open = () => router.push(`/novel/${encodeURIComponent(novel.id)}`);

  return (
    <MediaHoverPreview
      title={novel.title}
      image={src}
      chips={["Light Novel", "Official EPUB"]}
      stats={[
        ["Format", "Light Novel"],
        ["Edition", "Official EPUB"],
        ["Source", "Lnori"],
      ]}
    >
      <div className="group relative flex h-full flex-col bg-transparent">
        <button
          onClick={open}
          className="relative block aspect-[2/3] w-full overflow-hidden rounded-lg border border-amber-500/20 bg-[#101018] text-left shadow-md transition-transform duration-300 hover:scale-[1.03]"
        >
          {src ? (
            <img
              src={src}
              alt={novel.title}
              // Each miss costs a partial EPUB read on the server, so the rows
              // nobody scrolls to must not ask for one.
              loading="lazy"
              decoding="async"
              onError={() => setStage((s) => (s === 0 ? 1 : 2))}
              className="hq-image h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center">
              <BookOpen className="h-8 w-8 text-amber-300/40" />
              <span className="line-clamp-3 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {novel.title}
              </span>
            </div>
          )}
        </button>

        <div className="flex flex-1 flex-col pt-2">
          <button onClick={open} className="w-full text-left">
            <h3 className="mb-1 line-clamp-2 text-[13px] font-bold leading-tight text-[#e2e8f0] transition-colors hover:text-amber-300">
              {novel.title}
            </h3>
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300/50">
            Official EPUB
          </span>
        </div>
      </div>
    </MediaHoverPreview>
  );
}
