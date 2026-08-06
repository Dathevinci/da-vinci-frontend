"use client";

import React from "react";
import Link from "next/link";

interface EpubVolumeCardProps {
  url: string;
  title: string;
  novelId: string;
}

export default function EpubVolumeCard({ url, title, novelId }: EpubVolumeCardProps) {
  const coverUrl = `/api/proxy/lnori/cover?url=${encodeURIComponent(url)}`;
  
  // Extract volume number for badge
  const volumeMatch = title.match(/Volume\s*(\d+(\.\d+)?)/i) || title.match(/Vol\s*\.?\s*(\d+(\.\d+)?)/i);
  const volumeNumber = volumeMatch ? volumeMatch[1] : null;

  return (
    <Link
      href={`/novel/${encodeURIComponent(novelId)}/chapter/${encodeURIComponent(url)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#12121c] transition hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10"
    >
      <div className="relative aspect-[2/3] w-full bg-black/40">
        <img 
          src={coverUrl} 
          alt={title} 
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/400x600/1a1a24/ffffff?text=${encodeURIComponent('No Cover')}`;
          }}
        />

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
