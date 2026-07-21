"use client";

import { useState, useEffect } from "react";
import { useUser } from "./useUser";
import { earnPoints } from "@/lib/earn";

// Single-source status enum for tracked novels (mirrors useManhwaStatus).
export type NovelUserStatus = "Interested" | "Reading" | "Waiting" | "Finished" | "Dropped" | "None";

export interface TrackedNovel {
  id: string; // Backend UUID
  novelId: string; // source slug ("fmtl:<slug>" or a bare ReadNovelFull slug)
  title: string;
  coverImage?: string; // raw source cover URL (proxy client-side via /api/novel-image)
  status: string; // raw backend string ("READING", "FINISHED", …)
  updatedAt: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Global in-memory store + pub/sub so every tracker button and the profile stay
// in sync (same pattern as useManhwaStatus / useAnimeStatus).
let globalTracked: Record<string, TrackedNovel> = {};
let globalIsLoaded = false;
let lastUserId: string | null = null;
let fetchInProgress = false;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

export function useNovelStatus() {
  const [tracked, setTracked] = useState<Record<string, TrackedNovel>>(globalTracked);
  const [isLoaded, setIsLoaded] = useState(globalIsLoaded);
  const { user } = useUser();

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
        try {
          const res = await fetch(`${API_URL}/api/novel-bookmarks/${user.id}`);
          const data = await res.json();
          if (data.success) {
            const backendMap: Record<string, TrackedNovel> = {};
            data.data.forEach((item: any) => {
              backendMap[item.novelId] = {
                id: item.id,
                novelId: item.novelId,
                title: item.title,
                coverImage: item.coverImage,
                status: item.status,
                updatedAt: new Date(item.updatedAt).getTime(),
              };
            });
            globalTracked = backendMap;
          }
        } catch (e) {
          console.error("Failed to fetch backend novel bookmarks", e);
        }
      } else {
        const data = localStorage.getItem("davinci_novel_status");
        if (data) {
          try {
            globalTracked = JSON.parse(data);
          } catch (e) {
            console.error("Failed to parse local novel status", e);
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

  const setStatus = async (
    novelId: string,
    title: string,
    coverImage: string | undefined,
    status: NovelUserStatus
  ) => {
    const currentTracked = globalTracked[novelId];
    const backendId = currentTracked?.id;
    // Adding a novel to your library the first time earns Arise Points (server
    // dedups per title, so remove→re-add never double-pays).
    const isNewAdd = status !== "None" && !currentTracked;

    if (status === "None") {
      delete globalTracked[novelId];
    } else {
      globalTracked[novelId] = {
        id: backendId || "",
        novelId,
        title,
        coverImage,
        status: status.toUpperCase(),
        updatedAt: Date.now(),
      };
    }

    if (!user) {
      localStorage.setItem("davinci_novel_status", JSON.stringify(globalTracked));
    }
    emitChange();

    if (user && isNewAdd) {
      earnPoints(user.id, "track", `novel:${novelId}`);
    }

    if (user) {
      try {
        if (status === "None") {
          if (backendId) {
            await fetch(`${API_URL}/api/novel-bookmarks/${backendId}`, { method: "DELETE" });
          }
        } else if (backendId) {
          await fetch(`${API_URL}/api/novel-bookmarks/${backendId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status.toUpperCase() }),
          });
        } else {
          const res = await fetch(`${API_URL}/api/novel-bookmarks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              novelId,
              title,
              coverImage,
              status: status.toUpperCase(),
            }),
          });
          const data = await res.json();
          if (data.success && globalTracked[novelId]) {
            globalTracked[novelId].id = data.data.id;
            emitChange();
          }
        }
      } catch (e) {
        console.error("Failed to sync novel status", e);
      }
    }
  };

  const getStatus = (novelId: string): NovelUserStatus => {
    const raw = tracked[novelId]?.status;
    if (!raw) return "None";
    return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as NovelUserStatus;
  };

  const isTracked = (novelId: string): boolean => !!tracked[novelId];

  const toggleTracked = (novelId: string, title: string, coverImage: string | undefined) => {
    setStatus(novelId, title, coverImage, isTracked(novelId) ? "None" : "Reading");
  };

  const getTrackedList = (): TrackedNovel[] => {
    return Object.values(tracked).sort((a, b) => b.updatedAt - a.updatedAt);
  };

  return { tracked, setStatus, getStatus, isTracked, toggleTracked, getTrackedList, isLoaded };
}
