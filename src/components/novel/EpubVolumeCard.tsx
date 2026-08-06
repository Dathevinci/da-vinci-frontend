"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ePub from "epubjs";

interface EpubVolumeCardProps {
  url: string;
  proxyUrl: string;
  title: string;
  novelId: string;
}

export default function EpubVolumeCard({ url, proxyUrl, title, novelId }: EpubVolumeCardProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Extract volume number for badge
  const volumeMatch = title.match(/Volume\s*(\d+(\.\d+)?)/i) || title.match(/Vol\s*\.?\s*(\d+(\.\d+)?)/i);
  const volumeNumber = volumeMatch ? volumeMatch[1] : null;

  useEffect(() => {
    let active = true;
    const fetchCover = async () => {
      try {
        const book = ePub(proxyUrl);
        await book.ready;
        const cover = await book.coverUrl();
        if (active && cover) {
          setCoverUrl(cover);
        }
      } catch (e) {
        console.error("Failed to load EPUB cover for", title);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchCover();

    return () => {
      active = false;
    };
  }, [proxyUrl, title]);

  return (
    <Link
      href={`/novel/${encodeURIComponent(novelId)}/chapter/${encodeURIComponent(url)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#12121c] transition hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10"
    >
      <div className="relative aspect-[2/3] w-full bg-black/40">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-pink-500"></div>
          </div>
        ) : coverUrl ? (
          <img src={coverUrl} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#1a1a24] p-4 text-center">
            <span className="font-mono text-xs text-white/50">No Cover Available</span>
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
