"use client";

import { useState, useEffect } from "react";
import { useUser } from "./useUser";
import { earnPoints } from "@/lib/earn";
import { reconcileProgress } from "@/lib/readingProgress";
import { mergeServerReading } from "@/lib/readingHistory";

// Single-source status enum for tracked novels (mirrors useManhwaStatus).
export type NovelUserStatus = "Interested" | "Reading" | "Waiting" | "Finished" | "Dropped" | "None";

export interface TrackedNovel {
  id: string; // Backend UUID
  novelId: string; // source slug ("fmtl:<slug>" or a bare ReadNovelFull slug)
  title: string;
  coverImage?: string; // raw source cover URL (proxy client-side via /api/novel-image)
  status: string; // raw backend string ("READING", "FINISHED", …)
  updatedAt: number;
  // Cross-device reading progress (see lib/readingProgress).
  lastChapterId?: string;
  lastReadAt?: number;
  /**
   * When the reader DELIBERATELY added this to their library, if they ever did.
   *
   * A bookmark row is no longer proof of that: POST /progress upserts a row for
   * any novel you open a chapter of, so row existence now means "has been read
   * at least once", not "has been tracked". This is the only field that still
   * answers the tracking question — see isNewAdd in setStatus.
   */
  trackedAt?: number;
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
              const lastReadAt = item.lastReadAt ? Date.parse(item.lastReadAt) : NaN;
              const trackedAt = item.trackedAt ? Date.parse(item.trackedAt) : NaN;
              backendMap[item.novelId] = {
                id: item.id,
                novelId: item.novelId,
                title: item.title,
                coverImage: item.coverImage,
                status: item.status,
                updatedAt: new Date(item.updatedAt).getTime(),
                lastChapterId: item.lastChapterId || undefined,
                lastReadAt: Number.isFinite(lastReadAt) ? lastReadAt : undefined,
                // Carried exactly like lastChapterId/lastReadAt. Absent on a row
                // the reader never explicitly added — which is the whole signal.
                trackedAt: Number.isFinite(trackedAt) ? trackedAt : undefined,
              };
            });
            globalTracked = backendMap;

            /**
             * Reconcile the account's progress against this device's cache —
             * the moment cross-device sync actually happens. Newer side wins
             * per title (see lib/readingProgress); a locally-newer chapter is
             * pushed back UP rather than being overwritten, so an offline read
             * survives opening the novel on another device.
             */
            data.data.forEach((item: any) => {
              reconcileProgress(
                "novel",
                item.novelId,
                item.lastChapterId,
                item.lastReadAt,
                true,
                { title: item.title, coverImage: item.coverImage }
              );
            });

            // Keep the home "Continue Reading" rail in step with the account.
            mergeServerReading(
              "novel",
              data.data.map((item: any) => ({
                id: item.novelId,
                title: item.title,
                cover: item.coverImage,
                chapterId: item.lastChapterId,
                at: item.lastReadAt ? Date.parse(item.lastReadAt) : undefined,
              }))
            );
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
    /**
     * FIRST DELIBERATE ADD — keyed on trackedAt, NOT on the row existing.
     *
     * This used to read `!currentTracked`, i.e. "there is no bookmark row yet".
     * That stopped being the same question the moment POST /progress began
     * upserting a row for any novel you open a chapter of: by the time a reader
     * taps Add to library they have almost always read something, so the row is
     * already there, `isNewAdd` was false, and the track bonus was never even
     * REQUESTED. Server-side dedup cannot rescue a request that is not made.
     *
     * trackedAt is stamped only by an explicit add, so "not previously TRACKED"
     * is what this now asks. Still awarded at most once per title: the server
     * dedups the earn key, and the optimistic stamp below closes the same
     * session.
     */
    const isNewAdd = status !== "None" && !currentTracked?.trackedAt;

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
        // Carry progress across a status change — this object is REBUILT, not
        // patched, so omitting these would drop the reader's place from the
        // in-memory store the instant they touched the tracker dropdown.
        lastChapterId: currentTracked?.lastChapterId,
        lastReadAt: currentTracked?.lastReadAt,
        // Stamped here because THIS is the deliberate add. Carried when it
        // already exists, so a later Reading→Finished is not a second add and
        // does not re-request the bonus.
        trackedAt: currentTracked?.trackedAt ?? Date.now(),
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
            // Prefer the server's stamp over the optimistic one, so the value
            // in memory is the same one the next bookmark GET will return.
            const serverTrackedAt = data.data.trackedAt ? Date.parse(data.data.trackedAt) : NaN;
            if (Number.isFinite(serverTrackedAt)) globalTracked[novelId].trackedAt = serverTrackedAt;
            emitChange();
          }
        }
      } catch (e) {
        console.error("Failed to sync novel status", e);
      }
    }
  };

  /**
   * MEMBERSHIP IS `trackedAt`, NEVER ROW EXISTENCE — see the twin note in
   * useManhwaStatus. POST /progress upserts a row for any title a chapter is
   * opened on, so a row proves "this was read", not "this is in my library".
   * Reading existence instead turned the Add-to-Library toggle into a delete
   * for anything merely opened, taking the server-side progress with it.
   */
  const getStatus = (novelId: string): NovelUserStatus => {
    const entry = tracked[novelId];
    if (!entry?.trackedAt) return "None";
    const raw = entry.status;
    if (!raw) return "None";
    return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as NovelUserStatus;
  };

  const isTracked = (novelId: string): boolean => !!tracked[novelId]?.trackedAt;

  const toggleTracked = (novelId: string, title: string, coverImage: string | undefined) => {
    setStatus(novelId, title, coverImage, isTracked(novelId) ? "None" : "Reading");
  };

  const getTrackedList = (): TrackedNovel[] => {
    // Library shelves only — a title merely read has a row but no trackedAt.
    return Object.values(tracked)
      .filter((e) => !!e.trackedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  };

  /**
   * Empty the library in one action — see useManhwaStatus.clearAllTracking for
   * the reasoning; this is the same operation over novel bookmarks.
   *
   * Only rows with `trackedAt` go: a row without one is reading history left
   * by opening a chapter, not library membership, and wiping it would empty
   * Continue Reading for titles the reader never added. Deletion goes through
   * the existing per-row endpoint rather than a new bulk route, because these
   * routes carry no auth or ownership check.
   */
  const clearAllTracking = async (): Promise<{ removed: number; failed: number }> => {
    const rows = Object.values(globalTracked).filter((e) => !!e.trackedAt);
    if (rows.length === 0) return { removed: 0, failed: 0 };

    const keep: Record<string, TrackedNovel> = {};
    for (const [key, value] of Object.entries(globalTracked)) {
      if (!value?.trackedAt) keep[key] = value;
    }
    globalTracked = keep;
    if (!user) localStorage.setItem("davinci_novel_status", JSON.stringify(globalTracked));
    emitChange();

    if (!user) return { removed: rows.length, failed: 0 };

    let failed = 0;
    for (const row of rows) {
      if (!row.id) continue;
      const res = await fetch(`${API_URL}/api/novel-bookmarks/${row.id}`, { method: "DELETE" }).catch(() => null);
      if (!res || !res.ok) failed++;
    }
    return { removed: rows.length - failed, failed };
  };

  return { tracked, setStatus, getStatus, isTracked, toggleTracked, getTrackedList, clearAllTracking, isLoaded };
}
