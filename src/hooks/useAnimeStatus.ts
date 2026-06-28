"use client";

import { useState, useEffect } from "react";
import { AniListAnime } from "@/lib/anilist";

export type AnimeUserStatus = "Interested" | "Watching" | "Waiting" | "Finished" | "Dropped" | "None";

export interface TrackedAnime {
  status: AnimeUserStatus;
  anime: AniListAnime;
  updatedAt: number;
}

export function useAnimeStatus() {
  const [tracked, setTracked] = useState<Record<number, TrackedAnime>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem("anipulse_status");
    if (data) {
      try {
        setTracked(JSON.parse(data));
      } catch (e) {
        console.error("Failed to parse anime status", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const setStatus = (anime: AniListAnime, status: AnimeUserStatus) => {
    setTracked((prev) => {
      const updated = { ...prev };
      if (status === "None") {
        delete updated[anime.id];
      } else {
        updated[anime.id] = {
          status,
          anime,
          updatedAt: Date.now(),
        };
      }
      localStorage.setItem("anipulse_status", JSON.stringify(updated));
      return updated;
    });
  };

  const getStatus = (animeId: number): AnimeUserStatus => {
    return tracked[animeId]?.status || "None";
  };

  const getTrackedList = (filterStatus?: AnimeUserStatus): TrackedAnime[] => {
    const list = Object.values(tracked).sort((a, b) => b.updatedAt - a.updatedAt);
    if (filterStatus) {
      return list.filter(item => item.status === filterStatus);
    }
    return list;
  };

  return { tracked, setStatus, getStatus, getTrackedList, isLoaded };
}
