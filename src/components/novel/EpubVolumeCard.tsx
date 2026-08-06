"use client";

import React, { useState } from "react";
import Link from "next/link";
import { lnoriCoverUrl } from "@/lib/novel/lnoriProxy";

interface EpubVolumeCardProps {
  /** Short opaque id ("vol-3") — what the route actually navigates to. */
  chapterId: string;
  /** The real .epub address, used only to ask the proxy for a cover. */
  file: string;
  title: string;
  novelId: string;
  /**
   * The series cover, used when this volume's own art can't be pulled out of
   * the EPUB. Better than a placeholder service: it is already loaded, it is
   * the right book, and it needs no network call of its own.
   */
  fallbackCover?: string | null;
}

export default function EpubVolumeCard({ chapterId, file, title, novelId, fallbackCover }: EpubVolumeCardProps) {
  const [failed, setFailed] = useState(false);
  const src = failed ? fallbackCover : lnoriCoverUrl(file);

  // Extract volume number for badge
  const volumeMatch = title.match(/Volume\s*(\d+(\.\d+)?)/i) || title.match(/Vol\s*\.?\s*(\d+(\.\d+)?)/i);
  const volumeNumber = volumeMatch ? volumeMatch[1] : null;

  return (
    <Link
      href={`/novel/${encodeURIComponent(novelId)}/chapter/${encodeURIComponent(chapterId)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#12121c] transition hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10"
    >
      <div className="relative aspect-[2/3] w-full bg-black/40">
        {src ? (
          <img
            src={src}
            alt={title}
            /**
             * `lazy` is doing real work here, not decoration. Each of these
             * costs a partial EPUB download on the server, so requesting the
             * ones nobody has scrolled to yet was most of the cost of opening
             * a long series.
             */
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center font-mono text-[10px] uppercase tracking-widest text-white/30">
            {volumeNumber ? `Vol ${volumeNumber}` : "EPUB"}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

        {volumeNumber && (
          <div className="absolute bottom-3 left-3 rounded-md bg-pink-500/90 px-2 py-1 font-mono text-xs font-bold text-white shadow-md backdrop-blur-sm">
            VOL {volumeNumber}
          </div>
        )}
      </div>

      <div className="flex flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-white/90 group-hover:text-pink-400">
          {title}
        </h3>
        <span className="mt-1 font-mono text-[10px] text-white/40 uppercase">Official EPUB</span>
      </div>
    </Link>
  );
}
