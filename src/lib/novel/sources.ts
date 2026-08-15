/**
 * NOVEL SOURCE ROUTER — fresh line-up, started 2026-08-13.
 *
 *   "rnf:<slug>" → readnovelfull.com   (the only live source; see rnf.ts for
 *                                       how it was chosen and what it survived)
 *
 * The previous line-ups (readnovelfull/novelfull first era; the five-source
 * era; the fwn:/curated era) were removed the same day to start clean. Their
 * prefixes keep labels below so an old bookmark still says where it came from,
 * and opening one gets a NAMED error the reader shows verbatim rather than a
 * mystery failure.
 *
 * PREFIX REUSE RULE: reading progress and bookmarks are keyed by these ids
 * (`rnf:<slug>`), so a prefix may be reused ONLY for the same site. rnf: was
 * readnovelfull in the first era and is readnovelfull again now — same site,
 * so surviving first-era rows come back to life instead of breaking, which is
 * the reuse rule working as intended.
 *
 * NO-MTL is a line-up requirement from the owner: candidates that aggregate
 * machine translation (fanmtl, lnmtl) are out of consideration entirely.
 */

import * as RNF from "./rnf";
import type { NovelResult, NovelInfo, ChapterContent } from "./types";

const SOURCE_LABELS: Record<string, string> = {
  "rnf:": "ReadNovelFull", // live
  "fwn:": "FreeWebNovel",
  "rnb:": "Ranobes",
  "nf:": "NovelFull",
  "fmtl:": "FanMTL",
  "lnw:": "LightNovelWorld",
};

export function resolveSource(id: string) {
  const raw = String(id || "");
  for (const prefix of Object.keys(SOURCE_LABELS)) {
    if (raw.startsWith(prefix)) return { source: prefix.slice(0, -1), slug: raw.slice(prefix.length) };
  }
  // First-era readnovelfull ids were BARE slugs; treat them as rnf so ancient
  // bookmarks resolve instead of erroring.
  return { source: "rnf", slug: raw };
}

export function getSourceName(id: string): string {
  const raw = String(id || "");
  for (const [prefix, label] of Object.entries(SOURCE_LABELS)) {
    if (raw.startsWith(prefix)) return label;
  }
  return "ReadNovelFull";
}

const GONE = () =>
  new Error("This title came from a removed source — it will return if its site joins the new line-up.");

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  if (source === "rnf") return RNF.getInfo(slug);
  throw GONE();
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { source } = resolveSource(id);
  if (source === "rnf") return RNF.getChapter(chapterId);
  throw GONE();
}

export async function searchAll(
  query: string,
  page = 1
): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  try {
    const r = await RNF.searchNovels(query, page);
    return { results: r.results, hasNextPage: r.hasNextPage };
  } catch (e) {
    console.error("[novel] search failed:", e);
    return { results: [], hasNextPage: false };
  }
}

export interface NovelBrowseParams {
  page?: number;
  list?: string;
  genre?: string;
  status?: string;
  sort?: string;
}

/**
 * The UI's list names predate this line-up (light-novels, korean-masterpieces,
 * chinese-xianxia came from the curated era), so they are mapped to the lists
 * the site actually publishes rather than 404ing or silently ignoring them.
 * "completed" is the only one with a true equivalent; the rest land on the
 * closest honest thing — the popularity listing — instead of pretending a
 * curation exists.
 */
const LIST_MAP: Record<string, string> = {
  completed: "completed-novel",
  "completed-novel": "completed-novel",
  latest: "latest-release-novel",
  "latest-release-novel": "latest-release-novel",
  hot: "hot-novel",
  "hot-novel": "hot-novel",
  "light-novels": "most-popular-novel",
  "korean-masterpieces": "most-popular-novel",
  "chinese-xianxia": "most-popular-novel",
};

export async function browseNovels(
  paramsOrPage: number | NovelBrowseParams = 1,
  legacyList?: string
): Promise<{ results: NovelResult[]; hasNextPage: boolean; totalPages: number }> {
  let page = 1;
  let list = "";
  let status = "";
  if (typeof paramsOrPage === "number") {
    page = paramsOrPage;
    list = legacyList || "";
  } else if (paramsOrPage && typeof paramsOrPage === "object") {
    page = Number(paramsOrPage.page) || 1;
    list = paramsOrPage.list || "";
    status = paramsOrPage.status || "";
  }

  const target =
    status.toLowerCase() === "completed"
      ? "completed-novel"
      : LIST_MAP[list.toLowerCase()] || "most-popular-novel";

  try {
    const r = await RNF.listNovels(target, page);
    return { results: r.results, hasNextPage: r.hasNextPage, totalPages: r.totalPages ?? 0 };
  } catch (e) {
    console.error("[novel] browse failed:", e);
    return { results: [], hasNextPage: false, totalPages: 0 };
  }
}

/**
 * Every shelf key the novel home reads. The three curated-era shelves stay
 * EMPTY — the page hides an empty shelf (`length > 0 &&`, verified), and
 * filling "Korean Masterpieces" with a generic popularity list would be a
 * shelf whose label lies. The four honest shelves map to the site's real
 * listings, fetched concurrently and individually fault-tolerant: one listing
 * failing empties that shelf, not the page.
 */
export async function homeShelves() {
  const [pop, latest, done, hot] = await Promise.allSettled([
    RNF.listNovels("most-popular-novel", 1),
    RNF.listNovels("latest-release-novel", 1),
    RNF.listNovels("completed-novel", 1),
    RNF.listNovels("hot-novel", 1),
  ]);
  const rows = (r: PromiseSettledResult<RNF.RnfPage>) => (r.status === "fulfilled" ? r.value.results : []);

  const trending = rows(pop);
  return {
    featuredHero: rows(hot).slice(0, 6),
    lightNovels: [] as NovelResult[],
    koreanMasterpieces: [] as NovelResult[],
    cultivationEpics: [] as NovelResult[],
    trending,
    latestUpdates: rows(latest),
    completed: rows(done),
  };
}
