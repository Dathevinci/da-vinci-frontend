/**
 * NOVEL SOURCE ROUTER — CURRENTLY EMPTY, ON PURPOSE.
 *
 * Every novel source was removed at the owner's request on 2026-08-13 to start
 * the mode fresh. This file KEEPS the full routing surface — same exports, same
 * signatures — so the pages, API routes and search all compile and degrade to
 * their empty states instead of crashing, and so the next source line-up is a
 * registration here rather than a rebuild of everything that imports this.
 *
 * The line-ups that came and went, so nobody re-learns them the hard way:
 *
 *   readnovelfull/novelfull era   original scrapers; replaced wholesale.
 *   Lnori/Wuxiaworld/Ranobes/LNW  a five-source era, removed by a parallel
 *                                 session ("safely remove … with legacy
 *                                 fallbacks") before this reset.
 *   fwn: freewebnovel.com         the last primary. Real catalogue (50+ pages
 *                                 per listing) but rate-limits bursts via
 *                                 Cloudflare ("Error 1015"), so its listings
 *                                 lived behind a TTL cache + single-flight.
 *                                 Its fetch path also cascaded through FOUR
 *                                 third-party proxies (goodproxy workers /
 *                                 allorigins / corsproxy.io / proxy.cors.sh)
 *                                 of unknown ownership — flagged repeatedly.
 *   masterpieces.ts               a ~96-title hand-curated catalogue with
 *                                 AniList/Kitsu covers that fed the curated
 *                                 shelves and every fallback.
 *
 * WHAT THE CONSUMERS TOLERATE (measured, which is why the stub is safe):
 * the novel home guards every shelf with `|| []`; browse reads
 * `res.results || []`; the detail and chapter API routes catch and return
 * `{ error }`, which the reader surfaces as a readable sentence.
 *
 * Reading progress, bookmarks and Continue Reading live in localStorage and
 * the backend keyed by these SOURCE-PREFIXED ids (`fwn:<slug>` etc.), so a
 * future source that reuses a prefix inherits those rows — reuse a prefix
 * only for the SAME site, never for a different one.
 */

import type { NovelResult, NovelInfo, ChapterContent } from "./types";

/** Prefixes that have existed. Kept so old rows can still say where they came from. */
const SOURCE_LABELS: Record<string, string> = {
  "fwn:": "FreeWebNovel",
  "rnb:": "Ranobes",
  "nf:": "NovelFull",
  "rnf:": "ReadNovelFull",
  "fmtl:": "FanMTL",
  "lnw:": "LightNovelWorld",
};

export function resolveSource(id: string) {
  const raw = String(id || "");
  for (const prefix of Object.keys(SOURCE_LABELS)) {
    if (raw.startsWith(prefix)) return { source: prefix.slice(0, -1), slug: raw.slice(prefix.length) };
  }
  return { source: "none", slug: raw };
}

export function getSourceName(id: string): string {
  const raw = String(id || "");
  for (const [prefix, label] of Object.entries(SOURCE_LABELS)) {
    if (raw.startsWith(prefix)) return label;
  }
  return "Unknown";
}

/**
 * The one sentence a reader sees when opening anything saved from the old
 * line-up. A named error rather than a generic failure: the API routes catch
 * it and return `{ error }`, and the detail page prints that sentence.
 */
const NO_SOURCE = () =>
  new Error("Novel sources are being rebuilt — this title will return when the new line-up ships.");

export async function getNovelInfo(_id: string): Promise<NovelInfo> {
  throw NO_SOURCE();
}

export async function getChapterContent(_id: string, _chapterId: string): Promise<ChapterContent> {
  throw NO_SOURCE();
}

export async function searchAll(
  _query: string,
  _page = 1
): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  return { results: [], hasNextPage: false };
}

export interface NovelBrowseParams {
  page?: number;
  list?: string;
  genre?: string;
  status?: string;
  sort?: string;
}

export async function browseNovels(
  _paramsOrPage: number | NovelBrowseParams = 1,
  _legacyList?: string
): Promise<{ results: NovelResult[]; hasNextPage: boolean; totalPages: number }> {
  // totalPages 0, not 1: "there are no pages" is true, "there is one page" is
  // not, and the pager treats 0/absent as nothing-to-paginate.
  return { results: [], hasNextPage: false, totalPages: 0 };
}

/**
 * Every shelf key the novel home reads, all empty. The keys must stay even
 * while empty — the page destructures them by name (`res.featuredHero || []`),
 * and dropping one would be invisible today but a landmine for the rebuild.
 */
export async function homeShelves() {
  return {
    featuredHero: [] as NovelResult[],
    lightNovels: [] as NovelResult[],
    koreanMasterpieces: [] as NovelResult[],
    cultivationEpics: [] as NovelResult[],
    trending: [] as NovelResult[],
    latestUpdates: [] as NovelResult[],
    completed: [] as NovelResult[],
  };
}
