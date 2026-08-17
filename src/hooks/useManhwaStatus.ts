"use client";

import { useState, useEffect } from "react";
import { useUser } from "./useUser";
import { earnPoints } from "@/lib/earn";
import { reconcileProgress } from "@/lib/readingProgress";
import { mergeServerReading } from "@/lib/readingHistory";

export type ManhwaUserStatus = "Interested" | "Reading" | "Waiting" | "On-Hold" | "Finished" | "Dropped" | "None";

function normalizeManhwaStatus(raw?: string): ManhwaUserStatus {
  if (!raw) return "None";
  const s = raw.toUpperCase().replace(/_/g, "-");
  if (s === "ON-HOLD" || s === "ONHOLD" || s === "PAUSED" || s === "HOLD") return "On-Hold";
  if (s === "READING") return "Reading";
  if (s === "INTERESTED" || s === "PLAN-TO-READ" || s === "PLANTOREAD") return "Interested";
  if (s === "WAITING") return "Waiting";
  if (s === "FINISHED" || s === "COMPLETED") return "Finished";
  if (s === "DROPPED") return "Dropped";
  return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as ManhwaUserStatus;
}

export interface TrackedManhwa {
  id: string; // Backend UUID
  mangaId: string; // AsuraScans slug
  title: string;
  coverImage?: string;
  status: string; // The raw backend string
  updatedAt: number;
  // Cross-device reading progress (see lib/readingProgress).
  lastChapterId?: string;
  lastReadAt?: number;
  /**
   * When the reader DELIBERATELY added this to their library, if they ever did.
   *
   * A bookmark row is no longer proof of that: POST /progress upserts a row for
   * any title you open a chapter of, so row existence now means "has been read
   * at least once", not "has been tracked". This is the only field that still
   * answers the tracking question — see isNewAdd in setStatus.
   */
  trackedAt?: number;
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
              const lastReadAt = item.lastReadAt ? Date.parse(item.lastReadAt) : NaN;
              const trackedAt = item.trackedAt ? Date.parse(item.trackedAt) : NaN;
              backendMap[item.mangaId] = {
                id: item.id,
                mangaId: item.mangaId,
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
             * survives opening the title on another device.
             */
            data.data.forEach((item: any) => {
              reconcileProgress(
                "manhwa",
                item.mangaId,
                item.lastChapterId,
                item.lastReadAt,
                true,
                { title: item.title, coverImage: item.coverImage }
              );
            });

            // Keep the home "Continue Reading" rail in step with the account.
            mergeServerReading(
              "manhwa",
              data.data.map((item: any) => ({
                id: item.mangaId,
                title: item.title,
                cover: item.coverImage,
                chapterId: item.lastChapterId,
                at: item.lastReadAt ? Date.parse(item.lastReadAt) : undefined,
              }))
            );
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
    /**
     * FIRST DELIBERATE ADD — keyed on trackedAt, NOT on the row existing.
     *
     * This used to read `!currentTracked`, i.e. "there is no bookmark row yet".
     * That stopped being the same question the moment POST /progress began
     * upserting a row for any title you open a chapter of: by the time a reader
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
      delete globalTracked[mangaId];
    } else {
      globalTracked[mangaId] = {
        id: backendId || "",
        mangaId,
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
            // Prefer the server's stamp over the optimistic one, so the value
            // in memory is the same one the next bookmark GET will return.
            const serverTrackedAt = data.data.trackedAt ? Date.parse(data.data.trackedAt) : NaN;
            if (Number.isFinite(serverTrackedAt)) globalTracked[mangaId].trackedAt = serverTrackedAt;
            emitChange();
          }
        }
      } catch (e) {
        console.error("Failed to sync manhwa status", e);
      }
    }
  };

  /**
   * MEMBERSHIP IS `trackedAt`, NEVER ROW EXISTENCE.
   *
   * POST /progress upserts a row for any title a chapter is opened on, so a row
   * now proves only "this was read", not "this is in my library". Every
   * predicate below therefore asks the same question isNewAdd asks.
   *
   * Reading existence instead was actively destructive: the reader's
   * Add-to-Library button is a TOGGLE keyed on isTracked, so a progress-only
   * row made it read as already-added and the next tap sent status "None" —
   * deleting the row, wiping the server-side lastChapterId/lastReadAt, and
   * toasting "Removed from your library" for something never in it.
   */
  const getStatus = (mangaId: string): ManhwaUserStatus => {
    const entry = tracked[mangaId];
    if (!entry?.trackedAt) return "None";
    return normalizeManhwaStatus(entry.status);
  };

  const isTracked = (mangaId: string): boolean => !!tracked[mangaId]?.trackedAt;

  const toggleTracked = (mangaId: string, title: string, coverImage: string | undefined) => {
    setStatus(mangaId, title, coverImage, isTracked(mangaId) ? "None" : "Reading");
  };

  const getTrackedList = (): TrackedManhwa[] => {
    // Library shelves only — a title merely read has a row but no trackedAt.
    return Object.values(tracked)
      .filter((e) => !!e.trackedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  };

  /**
   * Empty the library in one action — the same thing as untracking every title
   * by hand, done once.
   *
   * ONLY ROWS THE READER ACTUALLY TRACKED. A bookmark row is not proof of
   * tracking: POST /progress upserts one for any title whose chapter is
   * opened, so a `trackedAt`-less row is reading history, not library
   * membership. Wiping those too would silently empty Continue Reading for
   * titles the reader never put in their library and never asked to forget.
   *
   * DELETION IS PER-ROW, THROUGH THE ENDPOINT THE UI ALREADY USES. A bulk
   * "delete everything for user X" route would be a far more attractive
   * target than this, because the bookmark routes carry no auth and no
   * ownership check — one unauthenticated call could empty a stranger's
   * library. This adds no such primitive.
   *
   * The local store is cleared FIRST so the shelf empties instantly, and each
   * delete is settled independently so one failure cannot abort the rest. The
   * count of failures is returned rather than swallowed, so the caller can
   * tell the reader the truth.
   */
  const clearAllTracking = async (): Promise<{ removed: number; failed: number }> => {
    const rows = Object.values(globalTracked).filter((e) => !!e.trackedAt);
    if (rows.length === 0) return { removed: 0, failed: 0 };

    const keep: Record<string, TrackedManhwa> = {};
    for (const [key, value] of Object.entries(globalTracked)) {
      if (!value?.trackedAt) keep[key] = value;
    }
    globalTracked = keep;
    if (!user) localStorage.setItem("davinci_manhwa_status", JSON.stringify(globalTracked));
    emitChange();

    if (!user) return { removed: rows.length, failed: 0 };

    let failed = 0;
    for (const row of rows) {
      if (!row.id) continue;
      const res = await fetch(`${API_URL}/api/manhwa-bookmarks/${row.id}`, { method: "DELETE" }).catch(() => null);
      if (!res || !res.ok) failed++;
    }
    return { removed: rows.length - failed, failed };
  };

  return { tracked, setStatus, getStatus, isTracked, toggleTracked, getTrackedList, clearAllTracking, isLoaded };
}
