// Client-side "Continue Reading" history for manhwa + novels. The readers already
// save a bare `<kind>-progress:<id>` = chapterId (used by detail-page/quick-view
// "Continue" buttons); THIS adds a richer, ordered list (title + cover + chapter)
// so the home feeds can render resume cards. Kept separate + additive so the
// existing per-title keys keep working.

export type ReadingKind = "manhwa" | "novel";

export interface ReadingEntry {
  id: string;            // series / novel source id (opaque — used verbatim in the URL)
  title: string;
  cover?: string;        // RAW source cover url; proxied per-kind at render time
  chapterId: string;     // the exact chapter to resume
  chapterTitle?: string;
  at: number;            // last-read timestamp (ms) — list is newest-first
}

const KEY = (k: ReadingKind) => `davinci_continue_${k}`;
const CAP = 24;
const EVT = "davinci_continue_updated";

export function getContinue(kind: ReadingKind): ReadingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(kind));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as ReadingEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordReading(kind: ReadingKind, entry: Omit<ReadingEntry, "at">): void {
  if (typeof window === "undefined" || !entry?.id || !entry?.chapterId) return;
  try {
    const list = getContinue(kind).filter((e) => e.id !== entry.id); // move-to-front (dedupe by title id)
    list.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(KEY(kind), JSON.stringify(list.slice(0, CAP)));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore */
  }
}

export function removeContinue(kind: ReadingKind, id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(kind), JSON.stringify(getContinue(kind).filter((e) => e.id !== id)));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore */
  }
}

export const CONTINUE_EVENT = EVT;
