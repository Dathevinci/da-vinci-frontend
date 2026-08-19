"use client";

import { currentOwner, type ReadingKind } from "@/lib/readingProgress";

/**
 * WHERE YOU STOPPED *INSIDE* A CHAPTER.
 *
 * readingProgress.ts already remembers WHICH chapter someone is on. This is the
 * other half: how far into that chapter they had read when they closed it, so
 * reopening can offer to put them back rather than dropping them at the top of
 * a 60-image chapter they were two thirds through.
 *
 * ── Local only, deliberately ───────────────────────────────────────────────
 * This never touches the network. A scroll position changes constantly, the
 * backend answers in 300-600ms, and a reading position is a per-device thing
 * anyway — the phone you fell asleep holding should not fight the desktop you
 * opened afterwards. readingProgress keeps syncing the CHAPTER across devices;
 * only the offset within it stays here.
 *
 * ── A percentage, not a pixel offset ───────────────────────────────────────
 * Pixels are meaningless across a rotation, a zoom change, or a phone-to-laptop
 * move — the same chapter is a different height on every one. A fraction of the
 * scrollable range survives all of that.
 *
 * ── Namespaced per account ─────────────────────────────────────────────────
 * Same owner token as readingProgress (`u:<id>` or `guest`), so two accounts
 * sharing a browser never inherit each other's positions.
 */

export interface ResumePoint {
  /** 0-1 fraction of the scrollable range. */
  pct: number;
  /** ms epoch, so stale points can be aged out and the UI can say "yesterday". */
  at: number;
}

const KEY = (owner: string, kind: ReadingKind, seriesId: string, chapterId: string) =>
  `dv-resume:${owner}:${kind}:${seriesId}:${chapterId}`;

const PREFIX = "dv-resume:";

/**
 * THE DEAD ZONES. Below MIN there is nothing worth returning to — the reader
 * opens at the top anyway, and offering to "resume" 2% in is noise. Above MAX
 * the chapter is effectively finished, and the useful next action is the next
 * chapter, not a jump to the last screen of this one.
 */
const MIN_PCT = 0.04;
const MAX_PCT = 0.93;

/** Points older than this are not offered — a month-old scroll offset is a
 *  guess about a chapter someone has almost certainly re-read or abandoned. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** localStorage is finite and this writes one key per chapter opened. */
const MAX_ENTRIES = 300;

export function saveResume(
  kind: ReadingKind,
  seriesId: string,
  chapterId: string,
  pct: number
): void {
  if (typeof window === "undefined") return;
  if (!seriesId || !chapterId) return;
  if (!Number.isFinite(pct)) return;

  try {
    const key = KEY(currentOwner(), kind, seriesId, chapterId);
    if (pct < MIN_PCT || pct > MAX_PCT) {
      // Scrolling back to the top, or reaching the end, RETIRES the point.
      // Leaving a stale one behind would offer to resume a chapter the reader
      // has already finished with.
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({ pct: Math.round(pct * 1000) / 1000, at: Date.now() }));
  } catch {
    /* private mode / quota — a lost reading position is never worth throwing */
  }
}

export function readResume(
  kind: ReadingKind,
  seriesId: string,
  chapterId: string
): ResumePoint | null {
  if (typeof window === "undefined") return null;
  if (!seriesId || !chapterId) return null;
  try {
    const raw = localStorage.getItem(KEY(currentOwner(), kind, seriesId, chapterId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    const pct = Number(v?.pct);
    const at = Number(v?.at);
    if (!Number.isFinite(pct) || pct < MIN_PCT || pct > MAX_PCT) return null;
    if (!Number.isFinite(at) || Date.now() - at > MAX_AGE_MS) return null;
    return { pct, at };
  } catch {
    return null;
  }
}

export function clearResume(kind: ReadingKind, seriesId: string, chapterId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY(currentOwner(), kind, seriesId, chapterId));
  } catch {
    /* nothing to do */
  }
}

/**
 * Drop the oldest points once the store grows past MAX_ENTRIES, and any point
 * past MAX_AGE_MS. Runs on reader mount, where it costs nothing next to the
 * chapter fetch, and keeps a heavy reader's localStorage from creeping upward
 * forever. Only this module's own keys are ever touched.
 */
export function pruneResumes(): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const mine: { key: string; at: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      let at = 0;
      try {
        at = Number(JSON.parse(localStorage.getItem(key) || "{}")?.at) || 0;
      } catch {
        at = 0; // unparseable — treat as ancient so it is collected first
      }
      mine.push({ key, at });
    }

    const doomed = mine
      .filter((e) => now - e.at > MAX_AGE_MS)
      .map((e) => e.key);

    if (mine.length - doomed.length > MAX_ENTRIES) {
      const survivors = mine
        .filter((e) => !doomed.includes(e.key))
        .sort((a, b) => a.at - b.at); // oldest first
      const excess = survivors.length - MAX_ENTRIES;
      for (let i = 0; i < excess; i++) doomed.push(survivors[i].key);
    }

    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* pruning is housekeeping; never let it break a reader */
  }
}

/** "2 hours ago" / "yesterday" — the prompt says WHEN, so a stale offer is
 *  obviously stale rather than mysteriously wrong. */
export function agoLabel(at: number): string {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? "an hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return "a while ago";
}
