"use client";

import { useEffect, useState } from "react";

/**
 * GUILD TAGS — one batched lookup for every username on the screen.
 *
 * A comment feed can paint 50 authors at once, and each of them wants the same
 * question answered: "which guild is this person in?". Asking per-author would
 * mean 50 requests for one screen, so every `useGuildTag` call instead drops
 * its id into a pending set and the module fires ONE
 * `POST /api/guilds/tags { userIds }` for everything gathered in a ~60ms
 * window (or immediately once 100 ids have piled up, which is the server's
 * per-batch ceiling).
 *
 * Answers live in a module-level Map for the rest of the session. A `null`
 * entry is a real answer — "this user has no guild" — so a second render of
 * the same person never re-asks. That means a guild joined mid-session won't
 * show until a reload; polling every comment author to catch that is not a
 * trade worth making. `clearGuildTagCache()` exists for the day it is.
 *
 * FAILURE IS SILENCE. A network error caches nothing and renders nothing —
 * no spinner, no error chip. The row simply looks like it did before guild
 * tags existed, and the next mount is free to try again.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type GuildTagInfo = { id: string; name: string; tag: string };

/** userId -> guild, or null for "asked, and they have no guild". */
const cache = new Map<string, GuildTagInfo | null>();
/** Ids already handed to a request that hasn't come back yet. */
const inflight = new Set<string>();
/** Ids waiting for the next flush. */
const pending = new Set<string>();

let timer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_MS = 60;
const MAX_BATCH = 100; // the server rejects more than this in one body

/**
 * Cross-component broadcast, same shape `useUser` uses for its user blob:
 * a set of listeners, every subscriber re-reads the shared store when one
 * fires. Every `useGuildTag` MUST drop its listener on unmount — a leaked
 * listener here would pin one closure per rendered comment for the life of
 * the tab, which is exactly the leak that used to make this site crawl.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

function broadcast() {
  // Snapshot: a listener may unsubscribe during the walk.
  for (const l of Array.from(listeners)) {
    try { l(); } catch { /* one bad subscriber must not stop the rest */ }
  }
}

export function subscribeGuildTags(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The cached answer, or `undefined` when nobody has asked yet. */
export function getCachedGuildTag(userId: string): GuildTagInfo | null | undefined {
  return cache.get(userId);
}

/** Drop every answer so the next render re-asks. Called nowhere, for now. */
export function clearGuildTagCache() {
  cache.clear();
}

function scheduleFlush() {
  if (timer !== null) return;
  timer = setTimeout(() => { void flush(); }, FLUSH_MS);
}

async function flush() {
  timer = null;
  if (pending.size === 0) return;

  const ids = Array.from(pending).slice(0, MAX_BATCH);
  for (const id of ids) {
    pending.delete(id);
    inflight.add(id);
  }
  // More than one batch's worth arrived in the window — the rest go next tick.
  if (pending.size > 0) scheduleFlush();

  let answered = false;
  try {
    const res = await fetch(`${API_URL}/api/guilds/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: ids }),
    });
    const data = await res.json();
    if (res.ok && data?.success && data.data && typeof data.data === "object") {
      const map = data.data as Record<string, any>;
      for (const id of ids) {
        const g = map[id];
        // Guildless users are ABSENT from the map, not null entries — either
        // way the answer we record is the same: null, "asked, no guild".
        if (g && g.id && g.tag) {
          cache.set(id, { id: String(g.id), name: String(g.name ?? ""), tag: String(g.tag) });
        } else {
          cache.set(id, null);
        }
      }
      answered = true;
    }
  } catch {
    /* offline or malformed — cache nothing, render nothing */
  } finally {
    for (const id of ids) inflight.delete(id);
  }

  // Nothing changed on a failure, so there is nothing to repaint.
  if (answered) broadcast();
}

/** Queue a lookup for `userId` unless it is already answered or in the air. */
export function requestGuildTag(userId: string) {
  if (!userId) return;
  if (cache.has(userId) || inflight.has(userId) || pending.has(userId)) return;
  pending.add(userId);
  if (pending.size >= MAX_BATCH) {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    void flush();
  } else {
    scheduleFlush();
  }
}

/**
 * The guild this user belongs to, or null while unknown / guildless.
 *
 * Lazy-initialised from the cache so a re-mount (scrolling a virtualised list,
 * reopening a modal) paints the chip immediately instead of flashing empty.
 * That is hydration-safe because nothing ever writes the cache on the server —
 * `requestGuildTag` only ever runs from the effect below.
 */
export function useGuildTag(userId?: string | null): GuildTagInfo | null {
  const [guild, setGuild] = useState<GuildTagInfo | null>(() =>
    userId ? cache.get(userId) ?? null : null
  );

  useEffect(() => {
    if (!userId) {
      setGuild(null);
      return;
    }

    // The cached object is stored by reference, so re-setting an unchanged
    // answer is a no-op re-render React bails out of on identity.
    const sync = () => { setGuild(cache.get(userId) ?? null); };

    sync();
    requestGuildTag(userId);

    const unsubscribe = subscribeGuildTags(sync);
    return unsubscribe;
  }, [userId]);

  return guild;
}
