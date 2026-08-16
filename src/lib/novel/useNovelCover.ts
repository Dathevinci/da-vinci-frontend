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

  /**
   * A COVER THE SOURCE PROVIDED IS NEVER OVERRIDDEN. The title-search
   * enrichment below is a CURATED-ERA rescue: it asks an external database to
   * find art BY NAME. For anything those databases don't hold — every original
   * RoyalRoad serial, plenty of translated titles — the fuzzy match returns a
   * DIFFERENT novel's art, and this hook was preferring that guess over the
   * correct cover already in hand. That is how "God-Kin" wore Tomb Raider
   * King's cover while the API served the right image the whole time.
   *
   * So: source cover present → use it, ask nobody. The lookup now runs only
   * for rows with NO art at all, where a fuzzy guess beats an empty tile.
   */
  useEffect(() => {
    if (baseCoverUrl) return;
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

  // Source art wins outright; the fetched guess only fills a void.
  const cover = baseCover || highResCover;

  const onError = () => {
    if (highResCover) setHighResCover(null);
  };

  return { cover, onError };
}
