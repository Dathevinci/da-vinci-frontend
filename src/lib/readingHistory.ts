// Client-side "Continue Reading" history for manhwa + novels. The readers already
// save a bare `<kind>-progress:<id>` = chapterId (used by detail-page/quick-view
// "Continue" buttons); THIS adds a richer, ordered list (title + cover + chapter)
// so the home feeds can render resume cards. Kept separate + additive so the
// existing per-title keys keep working.

import { currentOwner } from "@/lib/readingProgress";

export type ReadingKind = "manhwa" | "novel";

export interface ReadingEntry {
  id: string;            // series / novel source id (opaque — used verbatim in the URL)
  title: string;
  cover?: string;        // RAW source cover url; proxied per-kind at render time
  chapterId: string;     // the exact chapter to resume
  chapterTitle?: string;
  at: number;            // last-read timestamp (ms) — list is newest-first
}

/**
 * NAMESPACED PER ACCOUNT, like the progress cache it now mirrors.
 *
 * This store used to accumulate only what THIS device read, which made an
 * unowned key merely untidy. It is now seeded from the signed-in account's
 * entire server-side progress set — so on a shared browser an unowned key
 * would show account A's whole reading list to account B, and tapping Resume
 * would write A's chapter into B's account. The owner comes from the same
 * helper the progress cache uses, resolved fresh on every call because signing
 * in is a state update rather than a reload.
 */
const KEY = (k: ReadingKind) => `davinci_continue:${currentOwner()}:${k}`;

/** The pre-namespace key, moved into the guest namespace once. */
const LEGACY_KEY = (k: ReadingKind) => `davinci_continue_${k}`;
const CONTINUE_MIGRATED = "davinci_continue_migrated";
let continueMigrated = false;

function ensureContinueMigrated(): void {
  if (continueMigrated || typeof window === "undefined") return;
  continueMigrated = true;
  try {
    if (localStorage.getItem(CONTINUE_MIGRATED) === "1") return;
    for (const kind of ["manhwa", "novel"] as ReadingKind[]) {
      const legacy = localStorage.getItem(LEGACY_KEY(kind));
      if (legacy === null) continue;
      // Whatever is on this device today belongs to nobody in particular, so
      // it lands in the guest namespace rather than being handed to whichever
      // account happens to be signed in when this first runs.
      const target = `davinci_continue:guest:${kind}`;
      if (localStorage.getItem(target) === null) localStorage.setItem(target, legacy);
      localStorage.removeItem(LEGACY_KEY(kind));
    }
    localStorage.setItem(CONTINUE_MIGRATED, "1");
  } catch {
    /* private mode / quota — the rail must still render */
  }
}
const CAP = 24;
const EVT = "davinci_continue_updated";

/**
 * A READABLE LABEL FROM A BARE SOURCE ID, for rows that never got a real title.
 *
 * The raw id is the worst possible thing to print — "rzc:r2311170-a-bad-person"
 * tells the reader nothing and looks broken. The id is a slug underneath, so
 * most of a real title is recoverable: drop the source prefix, drop the opaque
 * numeric key some sources staple to the front, and un-slugify the rest.
 *
 * The digit rule is deliberately narrow. Stripping any leading number would eat
 * titles that legitimately start with one, so it only removes a letter followed
 * by four or more digits (the "r2311170" shape) or a run of six or more digits.
 * A "1000-year-old" style slug keeps its number.
 *
 * This is a fallback, not a fix: the real repair is that push now sends the
 * title (see pushProgress). It exists because rows already written without one
 * would otherwise stay ugly forever.
 */
const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

export function titleFromId(id: string): string {
  let s = String(id || "");
  s = s.replace(/^[a-z]{2,4}:/i, "");
  s = s.replace(/^(?:[a-z]\d{4,}|\d{6,})-/i, "");
  s = s.replace(/[-_]+/g, " ").trim();
  if (!s) return id;
  return s
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

/**
 * What to print on the card. A stored title equal to the id IS the old
 * id-as-title fallback, so it gets humanised at render — otherwise every shelf
 * written before the push fix would need a migration to look right.
 */
export function displayTitle(entry: Pick<ReadingEntry, "id" | "title">): string {
  const t = (entry.title || "").trim();
  return !t || t === entry.id ? titleFromId(entry.id) : t;
}

export function getContinue(kind: ReadingKind): ReadingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    ensureContinueMigrated();
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

/**
 * Fold the account's server-side progress rows into this device's shelf, so the
 * "Continue Reading" rail shows what you read on your phone when you open the
 * laptop. Same last-write-wins rule as lib/readingProgress: for each title the
 * NEWER of (local entry, server row) is kept.
 *
 * chapterTitle is intentionally not synced — the bookmark row stores the
 * chapter ID, not its name, and the card already falls back to "Resume". A
 * server-only entry therefore resumes to exactly the right chapter with a
 * slightly plainer label, which beats not showing the title at all.
 */
export function mergeServerReading(
  kind: ReadingKind,
  rows: Array<{ id: string; title?: string | null; cover?: string | null; chapterId?: string | null; at?: number }>
): void {
  if (typeof window === "undefined" || !Array.isArray(rows) || rows.length === 0) return;
  try {
    const byId = new Map<string, ReadingEntry>();
    for (const e of getContinue(kind)) byId.set(e.id, e);

    let changed = false;
    for (const row of rows) {
      if (!row?.id || !row.chapterId || !row.at) continue;
      const existing = byId.get(row.id);
      if (existing && existing.at >= row.at) continue; // local is newer — keep it
      byId.set(row.id, {
        id: row.id,
        // Never store the raw id as a title — see titleFromId. A server row
        // with no title now yields something readable instead of a slug.
        title: row.title || existing?.title || titleFromId(row.id),
        cover: row.cover || existing?.cover,
        chapterId: row.chapterId,
        chapterTitle: existing?.chapterId === row.chapterId ? existing.chapterTitle : undefined,
        at: row.at,
      });
      changed = true;
    }
    if (!changed) return;

    const merged = Array.from(byId.values()).sort((a, b) => b.at - a.at);
    localStorage.setItem(KEY(kind), JSON.stringify(merged.slice(0, CAP)));
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
