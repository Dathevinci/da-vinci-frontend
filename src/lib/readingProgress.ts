"use client";

import { authHeaders } from "./authToken";

/**
 * CROSS-DEVICE READING PROGRESS for manhwa + novels.
 *
 * Anime already followed the reader between devices because WatchlistItem holds
 * the episode server-side. Manhwa and novels did not: which chapter you were on
 * lived ONLY in one browser's localStorage, so the laptop had no idea what the
 * phone had read.
 *
 * ── The storage layout: ONE CACHE PER ACCOUNT ───────────────────────────────
 *   `dv-progress:<owner>:<kind>:<id>`     → the bare chapterId (a plain string)
 *   `dv-progress-at:<owner>:<kind>:<id>`  → ms timestamp of that read
 *
 * `<owner>` is `u:<userId>` for a signed-in account and the literal `guest`
 * when signed out. THE OWNER SEGMENT IS THE WHOLE POINT.
 *
 * The keys used to be `<kind>-progress:<id>` with no account in them, and
 * signing in is a state update rather than a page load — so on a shared browser
 * account B would inherit account A's cached chapters and, because a locally-
 * newer read is PUSHED UP (see the reconciliation rule below), would then
 * upload A's reading into B's library. Reading someone else's place is bad;
 * writing it into their account is worse, and it is not recoverable from the
 * client. Namespacing means B simply never sees A's entries: there is no
 * cross-account read to turn into a cross-account write.
 *
 * ── Migration (runs once, lazily) ───────────────────────────────────────────
 * Every pre-existing unprefixed `<kind>-progress[-at]:<id>` key is MOVED into
 * the `guest` namespace and the old key removed, guarded by `dv-progress-
 * migrated`. Guest — not the signed-in account — because an unprefixed key
 * carries no evidence of who wrote it, and attributing it to whoever happens to
 * be signed in now is exactly the bug this is fixing. Nobody loses what they
 * have: signed-out readers keep their place outright, and a signed-in reader's
 * server row is authoritative anyway.
 *
 * The old prefix (`manhwa-progress:`) and the new one (`dv-progress:`) cannot
 * be confused with each other, so the migration is unambiguous and idempotent
 * even if the flag is lost.
 *
 * Guest progress is deliberately NOT promoted into an account on sign-in. On a
 * shared browser the guest namespace is a pile of reads by unknown people; the
 * conservative rule throughout this module is that when ownership is uncertain
 * we do NOT upload. A signed-out read stays visible locally and on the home
 * "Continue Reading" shelf — it just never claims to be yours.
 *
 * ── RECONCILIATION RULE: last-write-wins by timestamp ───────────────────────
 * On load we hold two candidates, the signed-in account's local cache and its
 * server bookmark row:
 *   · server has no progress            → LOCAL wins, and is pushed up
 *   · local has none                    → SERVER wins
 *   · otherwise                         → the NEWER lastReadAt wins outright;
 *                                         if that is local, it is pushed up
 *
 * The push-up branch is the point of the whole thing. Someone who reads two
 * chapters on a phone with no signal must not have that erased the moment they
 * reopen the title on a laptop against a stale server row — so local being
 * newer is a reason to CORRECT the server, not to defer to it. Silently
 * preferring the server would be simpler and would quietly eat real reading.
 *
 * A migrated entry (no `-at` key) is timestamp 0, so any server row beats it.
 *
 * ── Offline-first, never blocking ──────────────────────────────────────────
 * localStorage stays the source of truth for the first paint: it is instant and
 * correct on a slow connection and when signed out. The network write is
 * strictly fire-and-forget — nothing here is ever awaited on the reading path,
 * so a page turn never waits on a request.
 */

export type ReadingKind = "manhwa" | "novel";

export interface LocalProgress {
  chapterId: string;
  at: number; // ms; 0 for a migrated entry written before timestamps existed
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const GUEST = "guest";
const ownerToken = (userId?: string | null) => (userId ? `u:${userId}` : GUEST);

const KEY = (owner: string, kind: ReadingKind, id: string) => `dv-progress:${owner}:${kind}:${id}`;
const AT_KEY = (owner: string, kind: ReadingKind, id: string) => `dv-progress-at:${owner}:${kind}:${id}`;

const MIGRATED_FLAG = "dv-progress-migrated";

/** Fired when a reconcile actually CHANGES the locally cached chapter. */
export const PROGRESS_EVENT = "davinci_progress_updated";

function emitProgressChange() {
  try {
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    /* SSR / no window */
  }
}

/**
 * Which namespace this browser is currently reading and writing.
 *
 * Derived FRESH from the cached account on every call rather than captured
 * once: signing in and out are state updates, not reloads, so a module-level
 * snapshot would go stale exactly when it matters and hand the next account the
 * previous one's namespace.
 */
export function currentOwner(): string {
  if (typeof window === "undefined") return GUEST;
  try {
    const raw = localStorage.getItem("davinci_user");
    if (!raw) return GUEST;
    const id = JSON.parse(raw)?.id;
    return typeof id === "string" && id ? ownerToken(id) : GUEST;
  } catch {
    return GUEST;
  }
}

/**
 * The namespace we are allowed to UPLOAD from, or null when ownership is
 * uncertain.
 *
 * `signedIn` comes from React state and the owner comes from the cached user
 * blob; they normally agree, and the one case where they don't — state says
 * signed in but there is no cached account to attribute a read to — is a case
 * where we must do nothing at all rather than guess. Guessing here means
 * uploading unattributed local progress into whichever account the token
 * belongs to, which is the shared-browser bug in a different costume.
 */
function uploadOwner(signedIn: boolean): string | null {
  if (!signedIn) return null;
  const owner = currentOwner();
  return owner === GUEST ? null : owner;
}

/**
 * Move any pre-namespace keys into the guest namespace, once per browser.
 *
 * Keys are snapshotted BEFORE anything is removed: localStorage.key(i) is
 * index-based and removing during the walk reindexes what is left, silently
 * skipping half the entries.
 */
let migrationChecked = false;
function ensureMigrated(): void {
  if (migrationChecked || typeof window === "undefined") return;
  migrationChecked = true;
  try {
    if (localStorage.getItem(MIGRATED_FLAG) === "1") return;

    const moves: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const kind of ["manhwa", "novel"] as ReadingKind[]) {
        const atPrefix = `${kind}-progress-at:`;
        const idPrefix = `${kind}-progress:`;
        if (key.startsWith(atPrefix)) {
          moves.push([key, AT_KEY(GUEST, kind, key.slice(atPrefix.length))]);
        } else if (key.startsWith(idPrefix)) {
          moves.push([key, KEY(GUEST, kind, key.slice(idPrefix.length))]);
        }
      }
    }

    for (const [from, to] of moves) {
      const value = localStorage.getItem(from);
      // Never clobber a namespaced value that already exists — it was written
      // by this module and is therefore newer than the legacy one.
      if (value !== null && localStorage.getItem(to) === null) localStorage.setItem(to, value);
      localStorage.removeItem(from);
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    /* private mode / quota — reading must still work */
  }
}

// ── owner-explicit primitives ───────────────────────────────────────────────
// Everything public resolves the owner and delegates here. In-flight callbacks
// use these directly with the owner captured at request time, so a response
// that lands after an account switch can never be filed under the new account.

function readFor(owner: string, kind: ReadingKind, id: string): LocalProgress | null {
  try {
    const chapterId = localStorage.getItem(KEY(owner, kind, id));
    if (!chapterId) return null;
    const rawAt = parseInt(localStorage.getItem(AT_KEY(owner, kind, id)) || "", 10);
    return { chapterId, at: Number.isFinite(rawAt) && rawAt > 0 ? rawAt : 0 };
  } catch {
    return null;
  }
}

function writeFor(owner: string, kind: ReadingKind, id: string, chapterId: string, at: number): void {
  try {
    localStorage.setItem(KEY(owner, kind, id), chapterId);
    localStorage.setItem(AT_KEY(owner, kind, id), String(at));
  } catch {
    /* private mode / quota — reading must still work */
  }
}

/**
 * Refresh only the timestamp, quietly. Used after a successful push so the
 * local clock matches the SERVER's clock for anything already synced, which
 * keeps later comparisons on one clock and confines device skew to writes that
 * genuinely happened offline. Deliberately silent: the chapter did not change,
 * so re-rendering every "continue" line would be noise.
 */
function touchFor(owner: string, kind: ReadingKind, id: string, at: number): void {
  if (!Number.isFinite(at)) return;
  try {
    localStorage.setItem(AT_KEY(owner, kind, id), String(at));
  } catch {
    /* ignore */
  }
}

export function readLocalProgress(kind: ReadingKind, id: string): LocalProgress | null {
  if (typeof window === "undefined" || !id) return null;
  ensureMigrated();
  return readFor(currentOwner(), kind, id);
}

/**
 * Cache progress locally, under the CURRENT account. Called the instant a
 * chapter is genuinely opened — after it has loaded, never before — and
 * independently of any network work.
 */
export function writeLocalProgress(
  kind: ReadingKind,
  id: string,
  chapterId: string,
  at: number = Date.now()
): void {
  if (typeof window === "undefined" || !id || !chapterId) return;
  ensureMigrated();
  writeFor(currentOwner(), kind, id, chapterId, at);
}

/**
 * Last chapter pushed per account+title, so one read costs at most one request.
 *
 * The readers' progress effects legitimately re-run several times for a single
 * chapter: they depend on the fetched series object, and on `user` — which
 * changes identity the moment the reading reward lands and rewrites the cached
 * balance. Without this, one chapter could fire a handful of identical POSTs.
 * They would all be idempotent upserts, but they are still requests made on a
 * phone's data on the reading path.
 *
 * The OWNER is part of the key: two accounts using one browser must not have
 * one's push suppress the other's.
 *
 * Cleared on failure so a genuine retry is still possible, and module-level so
 * a reload starts fresh.
 */
const pushed = new Map<string, string>();

/**
 * Forget one account's cached progress on THIS browser. Called on logout, so a
 * shared machine does not keep the previous reader's places lying around for
 * the next person.
 *
 * Only ever wipes a real account's namespace — the guest namespace belongs to
 * whoever is at the keyboard next, and a signed-out reader who never had an
 * account must not lose their place because someone else logged out. Anything
 * read while signed in was already pushed to the server, so the account keeps
 * it; only a read made offline and never reconciled before logging out is
 * genuinely dropped, which is the right side to err on when the alternative is
 * leaving one person's reading on another person's screen.
 */
export function clearAccountProgress(userId?: string | null): void {
  if (typeof window === "undefined") return;
  const owner = userId ? ownerToken(userId) : currentOwner();
  if (owner === GUEST) return;

  try {
    // The continue-reading rail is a SECOND store of the same private data —
    // it now carries the account's whole server-side history, not just what
    // this device read — so logout has to take it too, or the next person at
    // the keyboard gets the previous account's shelf on the home page.
    const prefixes = [
      `dv-progress:${owner}:`,
      `dv-progress-at:${owner}:`,
      `davinci_continue:${owner}:`,
    ];
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }

  // Drop this account's push-dedupe entries too, or signing back in inside the
  // same page session would find the cache gone but the pushes suppressed.
  for (const key of Array.from(pushed.keys())) {
    if (key.startsWith(`${owner}:`)) pushed.delete(key);
  }

  emitProgressChange();
}

interface PushMeta {
  title?: string;
  coverImage?: string;
  at?: number;
}

/**
 * FIRE-AND-FORGET upload of progress. Never awaited by a caller on the reading
 * path, never throws, and returns immediately for a signed-out reader (who
 * keeps working exactly as before, purely locally).
 */
export function pushProgress(
  kind: ReadingKind,
  id: string,
  chapterId: string,
  signedIn: boolean,
  meta: PushMeta = {}
): void {
  if (typeof window === "undefined" || !signedIn || !id || !chapterId) return;
  ensureMigrated();

  // Uncertain ownership uploads nothing. See uploadOwner.
  const owner = uploadOwner(signedIn);
  if (!owner) return;

  const dedupeKey = `${owner}:${kind}:${id}`;
  if (pushed.get(dedupeKey) === chapterId) return; // already recorded this read
  pushed.set(dedupeKey, chapterId);

  const endpoint = kind === "manhwa" ? "manhwa-bookmarks" : "novel-bookmarks";
  const body: Record<string, unknown> = {
    // The server takes the actor from the token; the id of the TITLE is all we
    // send. No userId in the body — it would not be trusted anyway.
    [kind === "manhwa" ? "mangaId" : "novelId"]: id,
    chapterId,
    readAt: meta.at ?? Date.now(),
  };
  if (meta.title) body.title = meta.title;
  if (meta.coverImage) body.coverImage = meta.coverImage;

  fetch(`${API_URL}/api/${endpoint}/progress`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data?.success) {
        pushed.delete(dedupeKey); // let a later attempt retry
        return;
      }
      const row = data.data || {};
      const at = row.lastReadAt ? Date.parse(row.lastReadAt) : NaN;
      if (!Number.isFinite(at)) return;

      /**
       * `applied: false` means the server already held a NEWER read than the
       * one we just sent — another device got there first. Adopt its chapter
       * as well as its clock.
       *
       * Taking only the timestamp here would be actively harmful: it would
       * pair our OLD chapterId with the server's NEW clock, and that forgery
       * would then win the next reconcile and push the old chapter back up,
       * dragging the reader backwards on every device.
       *
       * Filed under the owner captured when the request went out, never
       * `currentOwner()`: this response describes THAT account's shelf, and an
       * account switch while it was in flight must not redirect it.
       */
      if (data.applied === false && row.lastChapterId && row.lastChapterId !== chapterId) {
        writeFor(owner, kind, id, row.lastChapterId, at);
        pushed.set(dedupeKey, row.lastChapterId);
        emitProgressChange();
        return;
      }
      // Our write stuck — adopt the server's clock (see touchFor), but only
      // while the cache still holds the chapter we actually sent. The reader
      // may have turned the page while this was in flight, and stamping THAT
      // newer chapter with THIS older response's clock would misdate it.
      if (readFor(owner, kind, id)?.chapterId === chapterId) {
        touchFor(owner, kind, id, at);
      }
    })
    .catch(() => {
      /* progress sync is best-effort — an offline read stays cached locally and
         is pushed up by the reconcile on the next load that has a network */
      pushed.delete(dedupeKey);
    });
}

/**
 * Apply the reconciliation rule for ONE title against its server bookmark row.
 * Safe to call for every row in a bookmark list. Returns the winning chapterId.
 *
 * Reads and writes the SIGNED-IN account's namespace only, so the local side of
 * the comparison is by construction progress this account wrote on this device.
 */
export function reconcileProgress(
  kind: ReadingKind,
  id: string,
  serverChapterId: string | null | undefined,
  serverLastReadAt: string | null | undefined,
  signedIn: boolean,
  meta: PushMeta = {}
): string | null {
  if (typeof window === "undefined" || !id) return null;
  ensureMigrated();

  const owner = uploadOwner(signedIn);
  if (!owner) {
    // Nobody to attribute this device's cache to — report what is on screen and
    // change nothing, in either direction.
    return readFor(currentOwner(), kind, id)?.chapterId ?? null;
  }

  const local = readFor(owner, kind, id);
  const parsed = serverLastReadAt ? Date.parse(serverLastReadAt) : NaN;
  const serverAt = Number.isFinite(parsed) ? parsed : 0;
  const hasServer = !!serverChapterId;

  // Server knows nothing: local is the only truth, so teach the server.
  if (!hasServer) {
    if (local) pushProgress(kind, id, local.chapterId, signedIn, { ...meta, at: local.at || undefined });
    return local?.chapterId ?? null;
  }

  // Nothing local, or the server read is newer: adopt the server's chapter.
  if (!local || serverAt > local.at) {
    if (!local || local.chapterId !== serverChapterId) {
      writeFor(owner, kind, id, serverChapterId as string, serverAt || Date.now());
      emitProgressChange();
    } else {
      touchFor(owner, kind, id, serverAt || Date.now());
    }
    return serverChapterId as string;
  }

  // Local is strictly newer — the offline-phone case. Correct the server.
  if (local.at > serverAt) {
    pushProgress(kind, id, local.chapterId, signedIn, { ...meta, at: local.at });
  }
  return local.chapterId;
}
