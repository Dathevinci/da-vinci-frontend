"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/authToken";

/**
 * GUILD CUSTOM EMOJI — one catalog fetch per guild, per session.
 *
 * Discord-style `:shortcode:` emoji belonging to ONE guild and resolved only
 * inside it. They exist for GUILD CHAT, a members-only room, which is also why
 * the catalog read is members-only: an outsider has nowhere to type them.
 *
 * WHY A MODULE CACHE. A chat room paints hundreds of messages and every one of
 * them wants the same answer: "what does :name: look like in THIS guild?".
 * Asking per message — or even per component — would be one request per mount,
 * so the answer lives in a module-level Map for the rest of the session and an
 * in-flight Promise Map collapses the stampede: ten components mounting in the
 * same tick share ONE request.
 *
 * Same idiom as `guildTags.ts`: a module cache, a listener set for the
 * cross-component repaint, and a hook that MUST drop its listener on unmount.
 * A leaked listener here would pin one closure per rendered message for the
 * life of the tab, which is exactly the leak that used to make this site crawl.
 *
 * FAILURE IS SILENCE. A network error caches nothing and renders nothing — the
 * chat simply looks like it did before custom emoji existed (`:name:` stays
 * readable literal text, which is the whole point of the shortcode format) and
 * the next mount is free to try again.
 *
 * The one deliberate exception is 403: "you are not a member of this guild" is
 * a real, stable answer, so it caches an empty catalog instead of re-asking on
 * every mount. 401 does NOT cache — that resolves the moment you sign in.
 *
 * Uploads and deletes must call `invalidateGuildEmojis(guildId)`; nothing here
 * polls, so a new emoji is otherwise invisible until a reload.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type GuildEmoji = {
  id: string;
  name: string;
  url: string;
  animated: boolean;
};

/** used/total, straight from the server — `total` is derived from guild level. */
export type GuildEmojiSlots = { used: number; total: number };

export type GuildEmojiCatalog = {
  emojis: GuildEmoji[];
  /**
   * name -> emoji, for the render path.
   *
   * Structurally this is already what `<EmojiText emojis={...} />` wants
   * (`{ url: string; animated?: boolean }`), so it can be handed over
   * directly — no adapter, and no second copy of the catalog to drift.
   */
  byName: Record<string, GuildEmoji>;
  slots: GuildEmojiSlots;
};

// ── The slot curve, mirrored from the server ────────────────────────────────
// A LEVEL REWARD, not a purchase: no new currency, nothing to buy. The SERVER
// is the wall — it recomputes this on every upload and refuses past it. These
// copies exist so the UI can draw "7 / 10" and say "level up for more" without
// a round trip, never to decide whether an upload is allowed.
//
//   emojiSlots(level) = min(25, 5 + floor(level / 5))
//   L1 = 5 · L25 = 10 · L50 = 15 · L100 = 25 (and 25 is the ceiling)

export const EMOJI_SLOTS_BASE = 5;
export const EMOJI_SLOTS_MAX = 25;
export const EMOJI_LEVELS_PER_SLOT = 5;

export function emojiSlots(level: number): number {
  const lv = Number(level);
  const safe = Number.isFinite(lv) ? Math.max(1, Math.floor(lv)) : 1;
  return Math.min(EMOJI_SLOTS_MAX, EMOJI_SLOTS_BASE + Math.floor(safe / EMOJI_LEVELS_PER_SLOT));
}

// ── Shortcode rules, mirrored from the server ───────────────────────────────
// `[a-z0-9_]{2,24}`, lowercased on write, unique per guild. Written and read as
// `:name:` so the plain-text fallback is always legible.

export const EMOJI_NAME_RE = /^[a-z0-9_]{2,24}$/;
export const EMOJI_NAME_MIN = 2;
export const EMOJI_NAME_MAX = 24;

/** Trim + lowercase, exactly as the server does BEFORE it tests the name. */
export function normalizeEmojiName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isValidEmojiName(raw: unknown): boolean {
  return EMOJI_NAME_RE.test(normalizeEmojiName(raw));
}

/**
 * The SAME host wall `checkGuildImage` applies on the server, applied again
 * here — on both the write path and the read path.
 *
 * These images render in every member's browser, so an arbitrary host is never
 * acceptable. Re-checking what we read back is defence in depth: a row written
 * before the wall existed, or by any path that skipped it, is dropped from the
 * catalog rather than pointed at from a hundred chat lines.
 */
const EMOJI_IMAGE_HOSTS = new Set(["res.cloudinary.com"]);

export function isAllowedEmojiUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  return url.protocol === "https:" && EMOJI_IMAGE_HOSTS.has(url.hostname.toLowerCase());
}

// ── The cache ───────────────────────────────────────────────────────────────

/** A stable identity for "nothing here". Returning the SAME object every time
 *  means a re-set of an unchanged answer is a re-render React bails out of. */
export const EMPTY_EMOJI_CATALOG: GuildEmojiCatalog = {
  emojis: [],
  byName: {},
  slots: { used: 0, total: EMOJI_SLOTS_BASE },
};

/** guildId -> catalog. */
const cache = new Map<string, GuildEmojiCatalog>();
/** guildId -> the request already in the air, so N callers share ONE fetch. */
const inflight = new Map<string, Promise<GuildEmojiCatalog | null>>();

type Listener = () => void;
const listeners = new Set<Listener>();

function broadcast() {
  // Snapshot: a listener may unsubscribe during the walk.
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      /* one bad subscriber must not stop the rest */
    }
  }
}

export function subscribeGuildEmojis(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The cached catalog, or `undefined` when nobody has asked yet. */
export function getCachedGuildEmojis(guildId: string): GuildEmojiCatalog | undefined {
  return cache.get(guildId);
}

/**
 * Drop a guild's catalog so the next read re-asks. Call after an upload or a
 * delete — nothing polls, so this is the only thing that makes a new emoji
 * appear without a reload. No argument clears every guild.
 */
export function invalidateGuildEmojis(guildId?: string) {
  if (guildId) cache.delete(guildId);
  else cache.clear();
  // Drop anything in FLIGHT too. A request that left before an upload is
  // carrying pre-upload data, and its .then would re-seed the cache we just
  // cleared — hiding the emoji that was the whole reason for invalidating.
  if (guildId) inflight.delete(guildId);
  else inflight.clear();
  broadcast();
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

/** One wire row -> a `GuildEmoji`, or null when it fails the same rules the
 *  server enforces on write (bad name, non-Cloudinary url). */
function normalizeEmoji(raw: any): GuildEmoji | null {
  const name = normalizeEmojiName(raw?.name);
  if (!EMOJI_NAME_RE.test(name)) return null;
  const url = typeof raw?.url === "string" ? raw.url.trim() : "";
  if (!isAllowedEmojiUrl(url)) return null;
  return {
    id: String(raw?.id ?? name),
    name,
    url,
    // Strict `=== true`, matching the server: a hint about whether to play it,
    // never something to coerce out of a truthy string.
    animated: raw?.animated === true,
  };
}

function buildCatalog(rawEmojis: unknown, rawSlots: any): GuildEmojiCatalog {
  const emojis: GuildEmoji[] = [];
  // Object.create(null), NOT {} — the server's shortcode rule ([a-z0-9_]{2,24})
  // happily allows `constructor` and `__proto__`, and on a normal object the
  // dedupe check below reads those off Object.prototype as truthy and skips a
  // perfectly valid emoji. A null-prototype map has no inherited keys to hit.
  const byName: Record<string, GuildEmoji> = Object.create(null);
  if (Array.isArray(rawEmojis)) {
    for (const row of rawEmojis) {
      const e = normalizeEmoji(row);
      if (!e) continue;
      // Names are unique per guild server-side; first writer wins if they
      // somehow aren't, so the list and the map can never disagree.
      if (byName[e.name]) continue;
      byName[e.name] = e;
      emojis.push(e);
    }
  }
  return {
    emojis,
    byName,
    slots: {
      used: num(rawSlots?.used, emojis.length),
      total: num(rawSlots?.total, EMOJI_SLOTS_BASE),
    },
  };
}

/**
 * This guild's emoji catalog — from cache when it is known, otherwise ONE
 * request shared by every simultaneous caller.
 *
 * Resolves to null when the answer isn't knowable (offline, signed out,
 * garbled). Nothing is cached in that case, so the next mount retries.
 */
export function fetchGuildEmojis(guildId: string): Promise<GuildEmojiCatalog | null> {
  if (!guildId) return Promise.resolve(null);

  const cached = cache.get(guildId);
  if (cached) return Promise.resolve(cached);

  const already = inflight.get(guildId);
  if (already) return already;

  const request = (async (): Promise<GuildEmojiCatalog | null> => {
    try {
      const res = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guildId)}/emojis`, {
        headers: authHeaders(),
      });

      // 403 is a REAL answer — "not a member of this guild" — and it does not
      // change while the tab is open, so it caches as an empty catalog rather
      // than re-asking on every mount. 401 is deliberately NOT cached: that
      // one resolves the moment the viewer signs in.
      if (res.status === 403) {
        cache.set(guildId, EMPTY_EMOJI_CATALOG);
        return EMPTY_EMOJI_CATALOG;
      }
      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.success || !data.data) return null;

      const catalog = buildCatalog(data.data.emojis, data.data.slots);
      cache.set(guildId, catalog);
      return catalog;
    } catch {
      /* offline or malformed — cache nothing, render nothing */
      return null;
    } finally {
      inflight.delete(guildId);
    }
  })();

  inflight.set(guildId, request);
  // Nothing repaints on a failure, so only a real answer broadcasts.
  void request.then((c) => {
    if (c) broadcast();
  });
  return request;
}

/**
 * `:name:` -> the emoji, or null.
 *
 * Takes either a whole catalog or a bare `byName` map, and lowercases the
 * lookup so a stray `:Sparkle:` still resolves — the shortcode is
 * case-insensitive by construction, which is what makes "one :sparkle: per
 * guild" true rather than one per capitalisation.
 */
export function lookupGuildEmoji(
  source: GuildEmojiCatalog | Record<string, GuildEmoji> | null | undefined,
  name: string
): GuildEmoji | null {
  if (!source) return null;
  const key = normalizeEmojiName(name);
  if (!key) return null;
  const map = (source as GuildEmojiCatalog).byName ?? (source as Record<string, GuildEmoji>);
  const found = map?.[key];
  return found ?? null;
}

/**
 * This guild's catalog, kept in step with the module cache.
 *
 * Lazy-initialised from the cache so a re-mount (reopening the chat dock,
 * scrolling a virtualised list) paints emoji immediately instead of flashing
 * shortcodes. Hydration-safe because nothing ever writes the cache on the
 * server — the fetch only ever runs from the effect below.
 */
export function useGuildEmojis(guildId?: string | null): GuildEmojiCatalog {
  const [catalog, setCatalog] = useState<GuildEmojiCatalog>(() =>
    guildId ? cache.get(guildId) ?? EMPTY_EMOJI_CATALOG : EMPTY_EMOJI_CATALOG
  );

  useEffect(() => {
    if (!guildId) {
      setCatalog(EMPTY_EMOJI_CATALOG);
      return;
    }

    // Cached catalogs are stored by reference, so re-setting an unchanged
    // answer is a no-op re-render React bails out of on identity.
    const sync = () => {
      setCatalog(cache.get(guildId) ?? EMPTY_EMOJI_CATALOG);
    };

    sync();
    void fetchGuildEmojis(guildId);

    const unsubscribe = subscribeGuildEmojis(sync);
    return unsubscribe;
  }, [guildId]);

  return catalog;
}
