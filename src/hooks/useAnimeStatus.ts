"use client";

import { useState, useEffect } from "react";
import { Anime } from "@tutkli/jikan-ts";
import { useUser } from "./useUser";

export type AnimeUserStatus = "Interested" | "Watching" | "Waiting" | "Finished" | "Dropped" | "None";

export interface TrackedAnime {
  backendId?: string; // The UUID from the backend database
  status: AnimeUserStatus;
  anime: Anime;
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
                  mal_id: item.anilistId,
                  title: item.title,
                  images: {
                    jpg: { image_url: item.coverImage, small_image_url: item.coverImage, large_image_url: item.coverImage }
                  },
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

  const setStatus = async (anime: Anime, status: AnimeUserStatus) => {
    // 1. Optimistic UI update
    const currentTracked = tracked[anime.mal_id];
    let newBackendId = currentTracked?.backendId;

    setTracked((prev) => {
      const updated = { ...prev };
      if (status === "None") {
        delete updated[anime.mal_id];
      } else {
        updated[anime.mal_id] = {
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
          const title = anime.title_english || anime.title;
          const res = await fetch(`${API_URL}/api/watchlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              anilistId: anime.mal_id, // we keep the field name anilistId on backend for now to avoid breaking it
              title,
              coverImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
              status: status.toUpperCase()
            })
          });
          const data = await res.json();
          if (data.success) {
            // Update the state with the newly created backend UUID so we can delete/patch it later
            setTracked(prev => ({
              ...prev,
              [anime.mal_id]: { ...prev[anime.mal_id], backendId: data.data.id }
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

  const wipeWatchlist = async () => {
    if (!user) {
      setTracked({});
      localStorage.removeItem("davinci_status");
      return;
    }
    
    const backendIds = Object.values(tracked).map(t => t.backendId).filter(Boolean);
    setTracked({});
    
    try {
      for (const id of backendIds) {
        await fetch(`${API_URL}/api/watchlist/${id}`, { method: "DELETE" });
      }
    } catch (e) {
      console.error("Failed to wipe backend watchlist", e);
    }
  };

  const batchSetStatus = async (entries: { anime: Anime, status: AnimeUserStatus }[]) => {
    // 1. Optimistic UI update
    setTracked((prev) => {
      const updated = { ...prev };
      entries.forEach(({ anime, status }) => {
        if (status === "None") {
          delete updated[anime.mal_id];
        } else {
          updated[anime.mal_id] = {
            backendId: updated[anime.mal_id]?.backendId,
            status,
            anime,
            updatedAt: Date.now(),
          };
        }
      });
      if (!user) localStorage.setItem("davinci_status", JSON.stringify(updated));
      return updated;
    });

    if (!user) return;

    // 2. Sync sequentially to avoid blasting the backend
    for (const { anime, status } of entries) {
      setTracked((currentTrackedState) => {
         const syncSingle = async () => {
            const currentTracked = currentTrackedState[anime.mal_id];
            const newBackendId = currentTracked?.backendId;
            try {
              if (status === "None") {
                if (newBackendId) await fetch(`${API_URL}/api/watchlist/${newBackendId}`, { method: "DELETE" });
              } else if (newBackendId) {
                await fetch(`${API_URL}/api/watchlist/${newBackendId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: status.toUpperCase() })
                });
              } else {
                const title = anime.title_english || anime.title;
                const res = await fetch(`${API_URL}/api/watchlist`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    anilistId: anime.mal_id, // keep naming for backend compatibility
                    title,
                    coverImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
                    status: status.toUpperCase()
                  })
                });
                const data = await res.json();
                if (data.success) {
                  setTracked(p => {
                    if (!p[anime.mal_id]) return p;
                    return { ...p, [anime.mal_id]: { ...p[anime.mal_id], backendId: data.data.id } };
                  });
                }
              }
            } catch (e) {
              console.error(`Failed to sync anime ${anime.mal_id}`, e);
            }
         };
         syncSingle();
         return currentTrackedState;
      });
    }
  };

  return { tracked, setStatus, getStatus, getTrackedList, wipeWatchlist, batchSetStatus, isLoaded };
}
