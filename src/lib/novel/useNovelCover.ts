"use client";

import { useState, useEffect } from "react";
import { novelCover } from "@/lib/novelImage";

// In-memory cache to prevent re-fetching the same cover across multiple components
const coverCache = new Map<string, string | null>();

export function useNovelCover(title: string | undefined, baseCoverUrl: string | undefined) {
  const baseCover = novelCover(baseCoverUrl);
  const [highResCover, setHighResCover] = useState<string | null | undefined>(
    title && coverCache.has(title) ? coverCache.get(title) : undefined
  );

  useEffect(() => {
    if (!title || highResCover !== undefined) return;
    
    if (coverCache.has(title)) {
      setHighResCover(coverCache.get(title) || null);
      return;
    }

    fetch(`/api/novels/cover?title=${encodeURIComponent(title)}`)
      .then(res => res.json())
      .then(data => {
        if (data.cover) {
          coverCache.set(title, data.cover);
          setHighResCover(data.cover);
        } else {
          coverCache.set(title, null);
          setHighResCover(null);
        }
      })
      .catch(() => {
        coverCache.set(title, null);
        setHighResCover(null);
      });
  }, [title, highResCover]);

  const cover = highResCover || baseCover;

  const onError = () => {
    if (highResCover) setHighResCover(null);
  };

  return { cover, onError };
}
