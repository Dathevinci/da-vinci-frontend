"use client";

import { useState, useEffect } from "react";
import { Anime } from "@tutkli/jikan-ts";
import { useUser } from "./useUser";

// Public anime likes. Independent from the Tracker (an anime can be both).
// When signed in, likes sync to the backend so they show on your public
// profile and across devices. Guests fall back to localStorage.

export interface LikedAnime {
  anime: Anime;
  likedAt: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Global pub/sub store so every button and the profile stay in sync in-session.
let globalLikes: Record<number, LikedAnime> = {};
let loadedForKey: string | null = null;
let fetchInProgress = false;
const listeners = new Set<() => void>();

function guestKey() {
  return "davinci_likes_guest";
}

function emitChange() {
  for (const listener of listeners) listener();
}

// Rebuild a minimal Anime object from a stored like so cards can render it.
function likeToAnime(row: { anilistId: number; title: string; coverImage?: string | null }): Anime {
  return {
    mal_id: row.anilistId,
    title: row.title,
    images: {
      jpg: {
        image_url: row.coverImage || "",
        small_image_url: row.coverImage || "",
        large_image_url: row.coverImage || "",
      },
    },
    status: "UNKNOWN",
    genres: [],
    // Mark the stored MAL id so the popup can fetch full details (trailer,
    // cast, synopsis) from Jikan on demand — the stored record is minimal.
    _source: "jikan",
    _malId: row.anilistId,
  } as any;
}

export function useAnimeLikes() {
  const { user } = useUser();
  const [likes, setLikes] = useState<Record<number, LikedAnime>>(globalLikes);
  const [isLoaded, setIsLoaded] = useState(loadedForKey !== null);

  useEffect(() => {
    const handleStoreChange = () => {
      setLikes({ ...globalLikes });
      setIsLoaded(true);
    };
    listeners.add(handleStoreChange);

    const key = user?.id || "guest";

    const load = async () => {
      if (fetchInProgress) return;
      fetchInProgress = true;

      if (user) {
        try {
          // One-time migration: likes made while signed out (or before likes
          // were backed by the server) live only in this browser. Push them to
          // the backend on sign-in so they persist and become public, then
          // clear the guest copy.
          const guestRaw = localStorage.getItem(guestKey());
          if (guestRaw) {
            try {
              const guestLikes: Record<number, LikedAnime> = JSON.parse(guestRaw);
              for (const entry of Object.values(guestLikes)) {
                const a = entry.anime;
                await fetch(`${API_URL}/api/likes`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    anilistId: a.mal_id,
                    title: a.title_english || a.title || "Unknown Title",
                    coverImage: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
                  }),
                }).catch(() => {});
              }
              localStorage.removeItem(guestKey());
            } catch { /* ignore malformed guest data */ }
          }

          // Always use the username endpoint to adhere to backend rules
          if (!user.username) {
            console.warn("Username is missing, delaying fetch");
            fetchInProgress = false;
            return;
          }
          const res = await fetch(`${API_URL}/api/users/username/${user.username}`);
          const data = await res.json();
          // The API could return likes in data.data.likes or data.data might be the array itself
          const likesArray = data.data?.likes || (Array.isArray(data.data) ? data.data : []);
          if (data.success && likesArray) {
            const map: Record<number, LikedAnime> = {};
            likesArray.forEach((row: any) => {
              map[row.anilistId] = {
                anime: likeToAnime(row),
                likedAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
              };
            });
            globalLikes = map;
          }
        } catch (e) {
          console.error("Failed to fetch likes", e);
        }
      } else {
        try {
          const raw = localStorage.getItem(guestKey());
          globalLikes = raw ? JSON.parse(raw) : {};
        } catch {
          globalLikes = {};
        }
      }

      loadedForKey = key;
      fetchInProgress = false;
      emitChange();
    };

    if (loadedForKey !== key) {
      load();
    } else {
      setIsLoaded(true);
    }

    return () => { listeners.delete(handleStoreChange); };
  }, [user?.id, user?.username]);

  const isLiked = (animeId: number) => !!likes[animeId];

  const toggleLike = (anime: Anime) => {
    const id = anime.mal_id;
    const wasLiked = !!globalLikes[id];

    // Optimistic update
    if (wasLiked) {
      delete globalLikes[id];
    } else {
      globalLikes[id] = { anime, likedAt: Date.now() };
    }
    emitChange();

    if (user) {
      // Sync to backend
      if (wasLiked) {
        fetch(`${API_URL}/api/likes/${user.id}/${id}`, { method: "DELETE" }).catch((e) =>
          console.error("Failed to remove like", e)
        );
      } else {
        fetch(`${API_URL}/api/likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            anilistId: id,
            title: anime.title_english || anime.title || "Unknown Title",
            coverImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
          }),
        }).catch((e) => console.error("Failed to add like", e));
      }
    } else {
      localStorage.setItem(guestKey(), JSON.stringify(globalLikes));
    }
  };

  const getLikedList = (): LikedAnime[] =>
    Object.values(likes).sort((a, b) => b.likedAt - a.likedAt);

  return { likes, isLiked, toggleLike, getLikedList, isLoaded };
}
