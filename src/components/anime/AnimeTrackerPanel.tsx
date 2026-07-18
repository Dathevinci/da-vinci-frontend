"use client";

import { useAnimeLikes } from "@/hooks/useAnimeLikes";
import { Heart } from "lucide-react";
import { clsx } from "clsx";
import { Anime } from "@tutkli/jikan-ts";
import TrackerButton from "./TrackerButton";

export default function AnimeTrackerPanel({ anime }: { anime: Anime }) {
  const { isLiked: isLikedFn, toggleLike } = useAnimeLikes();

  return (
    <div className="flex gap-2">
      {/* Shared status picker — same control used on cards, the QuickView popup,
          and profiles, so the tracker behaves identically everywhere. */}
      <TrackerButton anime={anime} variant="full" />

      {/* Like Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(anime);
        }}
        className={clsx(
          "flex items-center justify-center w-12 h-12 rounded-full font-bold transition border backdrop-blur-md shadow-lg",
          isLikedFn(anime.mal_id)
            ? "bg-pink-500/10 text-pink-400 border-pink-500/50"
            : "bg-white/10 border-white/20 text-white hover:bg-white/20"
        )}
        title={isLikedFn(anime.mal_id) ? "Unlike" : "Like"}
      >
        <Heart className={clsx("w-5 h-5", isLikedFn(anime.mal_id) && "fill-current")} />
      </button>
    </div>
  );
}
