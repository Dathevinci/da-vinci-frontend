"use client";

import { useState, useEffect } from "react";
import { useUser } from "./useUser";
import { earnPoints } from "@/lib/earn";

export type ManhwaUserStatus = "Interested" | "Reading" | "Waiting" | "Finished" | "Dropped" | "None";

export interface TrackedManhwa {
  id: string; // Backend UUID
  mangaId: string; // AsuraScans slug
  title: string;
  coverImage?: string;
  status: string; // The raw backend string
  updatedAt: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

let globalTracked: Record<string, TrackedManhwa> = {};
let globalIsLoaded = false;
let lastUserId: string | null = null;
let fetchInProgress = false;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function useManhwaStatus() {
  const [tracked, setTracked] = useState<Record<string, TrackedManhwa>>(globalTracked);
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
          const res = await fetch(`${API_URL}/api/manhwa-bookmarks/${user.id}`);
          const data = await res.json();
          if (data.success) {
            const backendMap: Record<string, TrackedManhwa> = {};
            data.data.forEach((item: any) => {
              backendMap[item.mangaId] = {
                id: item.id,
                mangaId: item.mangaId,
                title: item.title,
                coverImage: item.coverImage,
                status: item.status,
                updatedAt: new Date(item.updatedAt).getTime()
              };
            });
            globalTracked = backendMap;
          }
        } catch (e) {
          console.error("Failed to fetch backend manhwa bookmarks", e);
        }
      } else {
        const data = localStorage.getItem("davinci_manhwa_status");
        if (data) {
          try {
            globalTracked = JSON.parse(data);
          } catch (e) {
            console.error("Failed to parse local manhwa status", e);
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

  const setStatus = async (mangaId: string, title: string, coverImage: string | undefined, status: ManhwaUserStatus) => {
    const currentTracked = globalTracked[mangaId];
    const backendId = currentTracked?.id;
    // Adding a manhwa to your library the first time earns Arise Points (server
    // dedups per title, so remove→re-add never double-pays).
    const isNewAdd = status !== "None" && !currentTracked;

    if (status === "None") {
      delete globalTracked[mangaId];
    } else {
      globalTracked[mangaId] = {
        id: backendId || "", 
        mangaId,
        title,
        coverImage,
        status: status.toUpperCase(),
        updatedAt: Date.now(),
      };
    }
    
    if (!user) {
      localStorage.setItem("davinci_manhwa_status", JSON.stringify(globalTracked));
    }
    emitChange();

    if (user && isNewAdd) {
      earnPoints(user.id, "track", `manhwa:${mangaId}`);
    }

    if (user) {
      try {
        if (status === "None") {
          if (backendId) {
            await fetch(`${API_URL}/api/manhwa-bookmarks/${backendId}`, { method: "DELETE" });
          }
        } else if (backendId) {
          await fetch(`${API_URL}/api/manhwa-bookmarks/${backendId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status.toUpperCase() })
          });
        } else {
          const res = await fetch(`${API_URL}/api/manhwa-bookmarks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              mangaId,
              title,
              coverImage,
              status: status.toUpperCase()
            })
          });
          const data = await res.json();
          if (data.success && globalTracked[mangaId]) {
            globalTracked[mangaId].id = data.data.id;
            emitChange();
          }
        }
      } catch (e) {
        console.error("Failed to sync manhwa status", e);
      }
    }
  };

  const getStatus = (mangaId: string): ManhwaUserStatus => {
    const raw = tracked[mangaId]?.status;
    if (!raw) return "None";
    return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as ManhwaUserStatus;
  };

  const isTracked = (mangaId: string): boolean => !!tracked[mangaId];

  const toggleTracked = (mangaId: string, title: string, coverImage: string | undefined) => {
    setStatus(mangaId, title, coverImage, isTracked(mangaId) ? "None" : "Reading");
  };

  const getTrackedList = (): TrackedManhwa[] => {
    return Object.values(tracked).sort((a, b) => b.updatedAt - a.updatedAt);
  };

  return { tracked, setStatus, getStatus, isTracked, toggleTracked, getTrackedList, isLoaded };
}
