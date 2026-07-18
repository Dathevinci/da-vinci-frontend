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

// Minutes per episode — the backend prices the finish payout (and your Hours
// Watched stat) off this, so it has to survive every source's format:
//   AniList / Kitsu -> "24 min per ep"
//   Jikan (raw, used by the anime detail page) -> "1 hr 52 min" / "2 hr"
// Read hours and minutes SEPARATELY: grabbing the first integer would turn a
// 112-minute movie into 1 minute.
function epMinutes(a: any): number | undefined {
  const raw = a?.duration;
  if (typeof raw === "number" && raw > 0) return raw;
  const s = String(raw ?? "");
  const h = s.match(/(\d+)\s*hr/i);
  const m = s.match(/(\d+)\s*min/i);
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  const bare = s.match(/^\s*(\d+)\s*$/);
  return bare ? Number(bare[1]) : undefined;
}

// Global state for pub/sub to sync across all components
let globalTracked: Record<number, TrackedAnime> = {};
let globalIsLoaded = false;
let lastUserId: string | null = null;
let fetchInProgress = false;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function useAnimeStatus() {
  const [tracked, setTracked] = useState<Record<number, TrackedAnime>>(globalTracked);
  const [isLoaded, setIsLoaded] = useState(globalIsLoaded);
  const { user } = useUser();

  // Load from local storage or backend
  useEffect(() => {
    const handleStoreChange = () => {
      setTracked({ ...globalTracked });
      setIsLoaded(globalIsLoaded);
    };
    
    listeners.add(handleStoreChange);

    const loadData = async () => {
      if (fetchInProgress) return;
      fetchInProgress = true;
      
      if (user) {
        // Fetch from backend if logged in
        try {
          // One-time migration: tracker items added while signed out live only
          // in this browser. Push them to the backend on sign-in so they
          // persist and show on the public profile, then clear the guest copy.
          const guestRaw = localStorage.getItem("davinci_status");
          if (guestRaw) {
            try {
              const guestTracked: Record<number, TrackedAnime> = JSON.parse(guestRaw);
              for (const entry of Object.values(guestTracked)) {
                const a = entry.anime;
                if (!a?.mal_id) continue;
                await fetch(`${API_URL}/api/watchlist`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    anilistId: a.mal_id,
                    title: a.title_english || a.title,
                    coverImage: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
                    genre: (a.genres && a.genres.length > 0) ? (typeof a.genres[0] === 'string' ? a.genres[0] : a.genres[0].name) : "Other",
                    status: (entry.status && entry.status !== "None" ? entry.status : "Watching").toUpperCase(),
                    // Migrated guest entries can arrive already FINISHED — send the
                    // runtime so the finish payout is priced correctly, not floored.
                    episodes: (a as any).episodes, duration: epMinutes(a),
                  }),
                }).catch(() => {});
              }
              localStorage.removeItem("davinci_status");
            } catch { /* ignore malformed guest data */ }
          }

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
                  genres: [{ name: item.genre || "Other" }],
                  // Mark the stored MAL id so the popup can fetch full details
                  // (trailer, cast, synopsis) from Jikan on demand.
                  _source: "jikan",
                  _malId: item.anilistId,
                } as any // Mocking the rest of the object for the tracker list
              };
            });
            globalTracked = backendMap;
          }
        } catch (e) {
          console.error("Failed to fetch backend watchlist", e);
        }
      } else {
        // Fallback to local storage if guest
        const data = localStorage.getItem("davinci_status");
        if (data) {
          try {
            globalTracked = JSON.parse(data);
          } catch (e) {
            console.error("Failed to parse local anime status", e);
          }
        }
      }
      globalIsLoaded = true;
      lastUserId = user?.id || null;
      fetchInProgress = false;
      emitChange();
    };

    if (!globalIsLoaded || lastUserId !== (user?.id || null)) {
      loadData();
    }

    return () => {
      listeners.delete(handleStoreChange);
    };
  }, [user]);

  const setStatus = async (anime: Anime, status: AnimeUserStatus) => {
    // 1. Optimistic UI update
    const currentTracked = globalTracked[anime.mal_id];
    let newBackendId = currentTracked?.backendId;

    if (status === "None") {
      delete globalTracked[anime.mal_id];
    } else {
      globalTracked[anime.mal_id] = {
        backendId: newBackendId,
        status,
        anime,
        updatedAt: Date.now(),
      };
    }
    
    if (!user) localStorage.setItem("davinci_status", JSON.stringify(globalTracked));
    emitChange();

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
            body: JSON.stringify({ status: status.toUpperCase(), episodes: (anime as any).episodes, duration: epMinutes(anime) })
          });
        } else {
          // POST
          const title = anime.title_english || anime.title || "Unknown Title";
          const res = await fetch(`${API_URL}/api/watchlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              anilistId: anime.mal_id, // we keep the field name anilistId on backend for now to avoid breaking it
              title,
              coverImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
              status: status.toUpperCase(),
              episodes: (anime as any).episodes, duration: epMinutes(anime)
            })
          });
          const data = await res.json();
          if (data.success) {
            // Update the state with the newly created backend UUID so we can delete/patch it later
            if (globalTracked[anime.mal_id]) {
              globalTracked[anime.mal_id].backendId = data.data.id;
              emitChange();
            }
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

  // ── Simplified single-state Tracker API ──
  // The old multi-status model (Interested/Watching/Waiting/Finished/Dropped)
  // is collapsed to one "in my tracker" state. Everything tracked is stored as
  // "Watching" so it still maps cleanly to the existing backend status enum,
  // but the UI now only exposes a single Add-to-Tracker toggle.
  const isTracked = (animeId: number): boolean => (tracked[animeId]?.status || "None") !== "None";

  const toggleTracked = (anime: Anime) => {
    setStatus(anime, isTracked(anime.mal_id) ? "None" : "Watching");
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
      globalTracked = {};
      localStorage.removeItem("davinci_status");
      emitChange();
      return;
    }
    
    const backendIds = Object.values(globalTracked).map(t => t.backendId).filter(Boolean);
    globalTracked = {};
    emitChange();
    
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
    entries.forEach(({ anime, status }) => {
      if (status === "None") {
        delete globalTracked[anime.mal_id];
      } else {
        globalTracked[anime.mal_id] = {
          backendId: globalTracked[anime.mal_id]?.backendId,
          status,
          anime,
          updatedAt: Date.now(),
        };
      }
    });
    
    if (!user) localStorage.setItem("davinci_status", JSON.stringify(globalTracked));
    emitChange();

    if (!user) return;

    // 2. Sync sequentially to avoid blasting the backend
    for (const { anime, status } of entries) {
      const syncSingle = async () => {
        const currentTracked = globalTracked[anime.mal_id];
        const newBackendId = currentTracked?.backendId;
        try {
          if (status === "None") {
            if (newBackendId) await fetch(`${API_URL}/api/watchlist/${newBackendId}`, { method: "DELETE" });
          } else if (newBackendId) {
            await fetch(`${API_URL}/api/watchlist/${newBackendId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: status.toUpperCase(), episodes: (anime as any).episodes, duration: epMinutes(anime) })
            });
          } else {
            const res = await fetch(`${API_URL}/api/watchlist`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user.id,
                anilistId: anime.mal_id,
                title: anime.title_english || anime.title,
                coverImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
                genre: (anime.genres && anime.genres.length > 0) ? (typeof anime.genres[0] === 'string' ? anime.genres[0] : anime.genres[0].name) : "Other",
                status: status.toUpperCase(),
                episodes: (anime as any).episodes, duration: epMinutes(anime)
              })
            });
            const data = await res.json();
            if (data.success) {
              if (globalTracked[anime.mal_id]) {
                globalTracked[anime.mal_id].backendId = data.data.id;
                emitChange();
              }
            }
          }
        } catch (e) {
          console.error(`Failed to sync anime ${anime.mal_id}`, e);
        }
      };
      await syncSingle();
    }
  };

  return { tracked, setStatus, getStatus, isTracked, toggleTracked, getTrackedList, wipeWatchlist, batchSetStatus, isLoaded };
}
