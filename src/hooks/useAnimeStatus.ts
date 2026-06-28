"use client";

import { useState, useEffect } from "react";
import { AniListAnime } from "@/lib/anilist";
import { useUser } from "./useUser";

export type AnimeUserStatus = "Interested" | "Watching" | "Waiting" | "Finished" | "Dropped" | "None";

export interface TrackedAnime {
  backendId?: string; // The UUID from the backend database
  status: AnimeUserStatus;
  anime: AniListAnime;
  updatedAt: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function useAnimeStatus() {
  const [tracked, setTracked] = useState<Record<number, TrackedAnime>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useUser();

  // Load from local storage or backend
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        // Fetch from backend if logged in
        try {
          const res = await fetch(`${API_URL}/api/watchlist/${user.id}`);
          const data = await res.json();
          if (data.success) {
            const backendMap: Record<number, TrackedAnime> = {};
            data.data.forEach((item: any) => {
              backendMap[item.anilistId] = {
                backendId: item.id,
                status: (item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()) as AnimeUserStatus,
                updatedAt: new Date(item.updatedAt).getTime(),
                anime: {
                  id: item.anilistId,
                  title: { romaji: item.title, userPreferred: item.title },
                  coverImage: { extraLarge: item.coverImage, large: item.coverImage },
                  status: "UNKNOWN",
                  genres: [],
                } as any // Mocking the rest of the object for the tracker list
              };
            });
            setTracked(backendMap);
          }
        } catch (e) {
          console.error("Failed to fetch backend watchlist", e);
        }
      } else {
        // Fallback to local storage if guest
        const data = localStorage.getItem("davinci_status");
        if (data) {
          try {
            setTracked(JSON.parse(data));
          } catch (e) {
            console.error("Failed to parse local anime status", e);
          }
        }
      }
      setIsLoaded(true);
    };

    loadData();
  }, [user]);

  const setStatus = async (anime: AniListAnime, status: AnimeUserStatus) => {
    // 1. Optimistic UI update
    const currentTracked = tracked[anime.id];
    let newBackendId = currentTracked?.backendId;

    setTracked((prev) => {
      const updated = { ...prev };
      if (status === "None") {
        delete updated[anime.id];
      } else {
        updated[anime.id] = {
          backendId: newBackendId,
          status,
          anime,
          updatedAt: Date.now(),
        };
      }
      if (!user) localStorage.setItem("davinci_status", JSON.stringify(updated));
      return updated;
    });

    // 2. Sync to Backend if logged in
    if (user) {
      try {
        if (status === "None") {
          // DELETE
          if (newBackendId) {
            await fetch(`${API_URL}/api/watchlist/${newBackendId}`, { method: "DELETE" });
          }
        } else if (newBackendId) {
          // PATCH
          await fetch(`${API_URL}/api/watchlist/${newBackendId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status.toUpperCase() })
          });
        } else {
          // POST
          const title = anime.title.english || anime.title.romaji || anime.title.userPreferred;
          const res = await fetch(`${API_URL}/api/watchlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              anilistId: anime.id,
              title,
              coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
              status: status.toUpperCase()
            })
          });
          const data = await res.json();
          if (data.success) {
            // Update the state with the newly created backend UUID so we can delete/patch it later
            setTracked(prev => ({
              ...prev,
              [anime.id]: { ...prev[anime.id], backendId: data.data.id }
            }));
          }
        }
      } catch (e) {
        console.error("Failed to sync status to backend", e);
      }
    }
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
