"use client";

import { useEffect, useState } from "react";

/**
 * HOW THE READER LIKES TO BROWSE — one preference, every explore surface.
 *
 * Anime explore (src/app/explore/page.tsx) and the shared comics/novels explore
 * (src/components/media/MediaExplore.tsx) are two implementations of the same
 * design, so the choice between infinite scroll and numbered pages is stored
 * ONCE, not once per mode. Someone who wants pages wants pages everywhere —
 * it is a statement about how they read, not about what they are reading.
 *
 * The broadcast is the idiom already used by useUser / usePreferences: write
 * localStorage, fire a window Event, and every mounted listener re-reads the
 * store. `storage` is listened to as well so a second TAB follows along. Both
 * listeners are NAMED and both are removed on unmount — the useUser scar was an
 * inline arrow passed to addEventListener and a different function passed to
 * removeEventListener, which matched nothing and leaked a listener per mount.
 *
 * The stored value is never trusted blindly: anything that is not the literal
 * string "pages" reads back as the default. A hand-edited localStorage entry
 * therefore degrades to infinite scroll rather than to a broken third state.
 */

export type PagingMode = "infinite" | "pages";

const STORAGE_KEY = "davinci_paging_mode";
const EVENT = "davinci_paging_mode_updated";

/** Infinite scroll is what these surfaces already did, so it stays the default. */
export const DEFAULT_PAGING_MODE: PagingMode = "infinite";

function normalise(value: unknown): PagingMode {
  return value === "pages" ? "pages" : DEFAULT_PAGING_MODE;
}

export function readPagingMode(): PagingMode {
  if (typeof window === "undefined") return DEFAULT_PAGING_MODE;
  try {
    return normalise(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private mode / blocked storage — the preference simply does not persist.
    return DEFAULT_PAGING_MODE;
  }
}

export function setPagingMode(mode: PagingMode) {
  if (typeof window === "undefined") return;
  const next = normalise(mode);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* still broadcast: this session should honour the choice even unsaved */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The current paging mode, kept in step with every other mounted surface.
 *
 * `ready` is false for the first render and true once localStorage has been
 * read. It exists because the stored value CANNOT be read during the initial
 * render: these are client components but Next still renders them on the
 * server, and seeding state from localStorage in a useState initialiser is a
 * hydration mismatch. Callers that would otherwise act on a not-yet-known mode
 * (the URL writer below, most of all) wait for `ready` instead of acting on the
 * default and then correcting themselves a tick later.
 */
export function usePagingMode(): { mode: PagingMode; setMode: (m: PagingMode) => void; ready: boolean } {
  const [mode, setModeState] = useState<PagingMode>(DEFAULT_PAGING_MODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setModeState(readPagingMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };

    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { mode, setMode: setPagingMode, ready };
}

// ── page numbers ───────────────────────────────────────────────────────────

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 ? i : null;
}

/**
 * A page number taken from the URL, or 1.
 *
 * Capped, because `?page=999999999` is a request we would faithfully forward to
 * a scraper. 500 is comfortably past every real ceiling we know of (AniList
 * lastPage tops out at 250, AsuraScans holds 17 pages, MangaDex's own offset
 * window ends around 416).
 */
export function parsePageParam(raw: string | null | undefined): number {
  const n = toPositiveInt(raw);
  if (!n) return 1;
  return Math.min(n, 500);
}

/**
 * The number of pages a response CLAIMS, or null for "it didn't say".
 *
 * NULL AND ZERO ARE DIFFERENT ANSWERS and this is the whole reason this helper
 * exists. "The source reports no total" must reach the pager as an absence, so
 * the pager can say so, rather than as a 0 that would round into a fabricated
 * "1 page" or an invented "50".
 *
 * Only the documented contract fields are read: `totalPages` when the backend
 * sends one, or `totalItems` + `perPage` when it sends the pair, which is
 * division rather than invention. Anything else — an items count with no page
 * size, an upstream envelope we would have to guess the shape of — is an
 * absence, and absence is a perfectly good thing to render.
 */
export function totalPagesFrom(payload: any): number | null {
  if (!payload || typeof payload !== "object") return null;
  const direct = toPositiveInt(payload.totalPages);
  if (direct) return direct;
  const items = toPositiveInt(payload.totalItems);
  const per = toPositiveInt(payload.perPage);
  if (items && per) return Math.max(1, Math.ceil(items / per));
  return null;
}

/**
 * Is that total an UPPER BOUND rather than a count?
 *
 * Manhwa browse merges AsuraScans with MangaDex and then drops licensed stubs
 * and cross-source duplicates, so the reachable-page figure overstates what a
 * reader will actually be shown — the tail is sparse and some pages filter down
 * to nothing. The data layer already marks those payloads; without reading the
 * mark here the UI printed "Page 1 of 416" as if it were counted, which is the
 * one thing this feature was not allowed to do.
 */
export function totalsApproximateFrom(payload: any): boolean {
  return !!(payload && typeof payload === "object" && payload.totalsApproximate);
}

export type PagerBounds = {
  /** The highest page number the UI is allowed to NAME. */
  knownMax: number;
  /** True only when a real reported total covers everything we have seen. */
  endKnown: boolean;
};

/**
 * How far the pager may count, and whether that ceiling is the real end.
 *
 * Two honest cases, and a third that quietly protects the first:
 *
 *  1. A REAL TOTAL, and everything we have seen fits inside it → count to it,
 *     and the last page is a page number like any other.
 *  2. NO TOTAL → count only as far as we can prove. Every page already loaded
 *     exists; and when the source says `hasNextPage`, the page after the
 *     current one exists too. Nothing beyond that is named, because nothing
 *     beyond that is known.
 *  3. A total that reality has already overrun — the source claimed 17 pages
 *     and still reports a next page on 17, which is exactly what a MERGED,
 *     then-filtered result set does to an upstream count. The claim is dropped
 *     and case 2 takes over. A pager that offers page 18 while insisting there
 *     are 17 is worse than one that admits it does not know.
 */
export function resolvePagerBounds(opts: {
  page: number;
  hasNext: boolean;
  totalPages: number | null | undefined;
  /** Deepest page loaded so far for this query — pages we have literally seen. */
  deepest?: number;
}): PagerBounds {
  const page = Math.max(1, Math.floor(opts.page) || 1);
  const deepest = Math.max(1, Math.floor(opts.deepest || 1) || 1);
  const reach = Math.max(page, deepest, page + (opts.hasNext ? 1 : 0));
  const total = toPositiveInt(opts.totalPages);
  if (total && reach <= total) return { knownMax: total, endKnown: true };
  return { knownMax: reach, endKnown: false };
}

export type PagerItem =
  | { kind: "page"; page: number }
  | { kind: "gap"; after: number }
  /** The tail of an unknown-length list: "there is more, we can't say how much". */
  | { kind: "more" };

/**
 * First page, a window around the current one, the last page when it is known.
 *
 * `radius` is how many pages flank the current one; the caller narrows it on a
 * phone so the strip stays one row at 360px instead of wrapping into three.
 *
 * An ellipsis that hides EXACTLY ONE page is replaced by that page — "1 … 3" is
 * a worse control than "1 2 3", and it is the same width.
 */
export function buildPagerItems(opts: {
  current: number;
  knownMax: number;
  radius: number;
  endKnown: boolean;
  hasNext: boolean;
}): PagerItem[] {
  const knownMax = Math.max(1, Math.floor(opts.knownMax) || 1);
  const current = Math.min(knownMax, Math.max(1, Math.floor(opts.current) || 1));
  const radius = Math.max(0, Math.floor(opts.radius) || 0);

  const pages = new Set<number>([1, knownMax]);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p >= 1 && p <= knownMax) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: PagerItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      if (p - prev === 2) out.push({ kind: "page", page: p - 1 });
      else if (p - prev > 2) out.push({ kind: "gap", after: prev });
    }
    out.push({ kind: "page", page: p });
  }

  // Only when the end is genuinely unknown does the strip trail off. With a
  // real total the last item IS the last page and a trailing "…" would lie.
  if (!opts.endKnown && opts.hasNext) out.push({ kind: "more" });
  return out;
}

// ── switching modes without refetching ─────────────────────────────────────

/**
 * The rows belonging to `page` inside an infinitely-appended list, or null.
 *
 * Infinite scroll accumulates pages 1..N into one array; numbered pages show
 * one page at a time. Switching from the first to the second therefore has to
 * pick page N back out of the pile — and it can, because every append records
 * the index it started at. No request is made, nothing is re-fetched, and
 * nothing can arrive twice.
 *
 * Null means "cannot be sliced": the page was never recorded, or it was one of
 * the empty pages infinite scroll SKIPS (it contributed no rows, so its slice
 * is genuinely empty). The caller falls back to fetching that page.
 */
export function sliceLoadedPage<T>(items: T[], starts: Map<number, number>, page: number): T[] | null {
  const start = starts.get(page);
  if (start === undefined || start < 0 || start > items.length) return null;
  const slice = items.slice(start);
  return slice.length > 0 ? slice : null;
}

/**
 * Back to the top of the grid after a page change — the one place a numbered
 * pager has to move the reader, since page 7 arriving underneath a scroll
 * position from page 6 reads as "the button did nothing".
 *
 * Honours prefers-reduced-motion: a smooth scroll across several screens is
 * exactly the kind of motion that setting exists to stop.
 */
export function scrollExploreToTop(smooth = true) {
  if (typeof window === "undefined") return;
  let behavior: ScrollBehavior = smooth ? "smooth" : "auto";
  try {
    if (smooth && window.matchMedia("(prefers-reduced-motion: reduce)").matches) behavior = "auto";
  } catch {
    /* no matchMedia — the default behaviour is fine */
  }
  try {
    window.scrollTo({ top: 0, behavior });
  } catch {
    window.scrollTo(0, 0);
  }
}
