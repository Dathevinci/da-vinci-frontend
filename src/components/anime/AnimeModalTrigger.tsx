"use client";

import { Anime } from "@tutkli/jikan-ts";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";

// A thin client wrapper so server components (calendar, etc.) can make an
// anime item open the global popup instead of navigating to /anime/[id].
export default function AnimeModalTrigger({
  anime,
  className,
  children,
}: {
  anime: Anime;
  className?: string;
  children: React.ReactNode;
}) {
  const { openAnime } = useAnimeModal();
  return (
    <button type="button" onClick={() => openAnime(anime)} className={className}>
      {children}
    </button>
  );
}
