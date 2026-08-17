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
import * as RR from "./royalroad";
import type { NovelResult, NovelInfo, ChapterContent } from "./types";

const SOURCE_LABELS: Record<string, string> = {
  "rnf:": "ReadNovelFull", // live — translated CN/KR web novels
  "rr:": "RoyalRoad", // live — original English fiction
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

const GONE = () =>
  new Error("This title came from a removed source — it will return if its site joins the new line-up.");

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  if (source === "rnf") return RNF.getInfo(slug);
  if (source === "rr") return RR.getInfo(slug);
  throw GONE();
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { source, slug } = resolveSource(id);
  if (source === "rnf") return RNF.getChapter(chapterId);
  // RoyalRoad chapter URLs need the FICTION id as well as the chapter id, so
  // the novel id is passed through rather than the chapter id alone.
  if (source === "rr") return RR.getChapter(slug, chapterId);
  throw GONE();
}

/**
 * Both sources searched together, each fault-tolerant. ReadNovelFull leads so
 * its row wins a title collision — but the catalogues barely intersect
 * (translated CN/KR web novels versus original English serials), so the merge
 * mostly ADDS rather than dedupes.
 */
export async function searchAll(
  query: string,
  page = 1
): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const [a, b] = await Promise.allSettled([RNF.searchNovels(query, page), RR.searchFictions(query, page)]);
  const rows = (r: PromiseSettledResult<{ results: NovelResult[]; hasNextPage: boolean }>) =>
    r.status === "fulfilled" ? r.value : { results: [] as NovelResult[], hasNextPage: false };
  const av = rows(a);
  const bv = rows(b);
  if (a.status === "rejected") console.error("[novel] rnf search failed:", a.reason);
  if (b.status === "rejected") console.error("[novel] rr search failed:", b.reason);
  return { results: mergeByTitle(av.results, bv.results), hasNextPage: av.hasNextPage || bv.hasNextPage };
}

/** Drop cross-source duplicate titles; the first list wins. */
function mergeByTitle(...lists: NovelResult[][]): NovelResult[] {
  const seen = new Set<string>();
  const out: NovelResult[] = [];
  for (const row of lists.flat()) {
    const key = (row?.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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
  popular: "most-popular-novel",
  completed: "completed-novel",
  "completed-novel": "completed-novel",
  latest: "latest-release-novel",
  "latest-release-novel": "latest-release-novel",
  hot: "hot-novel",
  "hot-novel": "hot-novel",
  // Retired curated-era list names still arriving from old links/bookmarks.
  "light-novels": "most-popular-novel",
  "korean-masterpieces": "most-popular-novel",
  "chinese-xianxia": "most-popular-novel",
};

/**
 * Lists that mean ONE source, because their shelf makes a claim about origin.
 * "Original English Fiction" must not return translated novels, and vice
 * versa — that is the whole point of splitting the shelves by kind.
 */
const SOURCE_ONLY: Record<string, "rnf" | "rr"> = {
  original: "rr",
  "original-fiction": "rr",
  translated: "rnf",
  "translated-novels": "rnf",
};

export async function browseNovels(
  paramsOrPage: number | NovelBrowseParams = 1,
  legacyList?: string
): Promise<{ results: NovelResult[]; hasNextPage: boolean; totalPages: number }> {
  let page = 1;
  let list = "";
  let status = "";
  let genre = "";
  if (typeof paramsOrPage === "number") {
    page = paramsOrPage;
    list = legacyList || "";
  } else if (paramsOrPage && typeof paramsOrPage === "object") {
    page = Number(paramsOrPage.page) || 1;
    list = paramsOrPage.list || "";
    status = paramsOrPage.status || "";
    genre = paramsOrPage.genre || "";
  }

  // A genre filter takes priority — route to genre-filtered queries on RNF and RR
  if (genre.trim()) {
    const [a, b] = await Promise.allSettled([
      RNF.listNovels(genre.trim(), page, true),
      RR.listFictionsByGenre(genre.trim(), page),
    ]);
    if (a.status === "rejected") console.error("[novel] rnf genre browse failed:", a.reason);
    if (b.status === "rejected") console.error("[novel] rr genre browse failed:", b.reason);
    const av = a.status === "fulfilled" ? a.value : { results: [] as NovelResult[], hasNextPage: false, totalPages: 0 };
    const bv = b.status === "fulfilled" ? b.value : { results: [] as NovelResult[], hasNextPage: false, totalPages: 0 };

    const merged: NovelResult[] = [];
    for (let i = 0; i < Math.max(av.results.length, bv.results.length); i++) {
      if (av.results[i]) merged.push(av.results[i]);
      if (bv.results[i]) merged.push(bv.results[i]);
    }

    return {
      results: mergeByTitle(merged),
      hasNextPage: av.hasNextPage || bv.hasNextPage,
      totalPages: Math.max(av.totalPages || 0, bv.totalPages || 0),
    };
  }

  const key = list.toLowerCase();
  const completedWanted = status.toLowerCase() === "completed" || key.startsWith("completed");
  const target = completedWanted ? "completed-novel" : LIST_MAP[key] || "most-popular-novel";
  const rrTarget = completedWanted
    ? "complete"
    : target === "latest-release-novel"
      ? "latest-updates"
      : "best-rated";

  // A list that claims an origin is served by that source alone.
  const only = SOURCE_ONLY[key];
  if (only === "rr") {
    try {
      const r = await RR.listFictions(rrTarget, page);
      return { results: r.results, hasNextPage: r.hasNextPage, totalPages: r.totalPages ?? 0 };
    } catch (e) {
      console.error("[novel] rr browse failed:", e);
      return { results: [], hasNextPage: false, totalPages: 0 };
    }
  }
  if (only === "rnf") {
    try {
      const r = await RNF.listNovels(target, page);
      return { results: r.results, hasNextPage: r.hasNextPage, totalPages: r.totalPages ?? 0 };
    } catch (e) {
      console.error("[novel] rnf browse failed:", e);
      return { results: [], hasNextPage: false, totalPages: 0 };
    }
  }

  /**
   * BOTH SOURCES PER BROWSE PAGE, interleaved. Page N means page N of each,
   * merged — so the catalogue depth is the DEEPER of the two (RoyalRoad's
   * pager reaches into the thousands) and a page is never half-empty because
   * one source ran out. hasNextPage is true while EITHER has more, and the
   * total is deliberately omitted: the two paginate independently, so any
   * combined count would be invented — the rule in explorePaging.ts.
   */
  const [a, b] = await Promise.allSettled([RNF.listNovels(target, page), RR.listFictions(rrTarget, page)]);
  if (a.status === "rejected") console.error("[novel] rnf browse failed:", a.reason);
  if (b.status === "rejected") console.error("[novel] rr browse failed:", b.reason);
  const av = a.status === "fulfilled" ? a.value : { results: [] as NovelResult[], hasNextPage: false };
  const bv = b.status === "fulfilled" ? b.value : { results: [] as NovelResult[], hasNextPage: false };

  const merged: NovelResult[] = [];
  for (let i = 0; i < Math.max(av.results.length, bv.results.length); i++) {
    if (av.results[i]) merged.push(av.results[i]);
    if (bv.results[i]) merged.push(bv.results[i]);
  }

  return {
    results: mergeByTitle(merged),
    hasNextPage: av.hasNextPage || bv.hasNextPage,
    totalPages: 0,
  };
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
  const [pop, latest, done, hot, rrPop, rrLatest, rrDone] = await Promise.allSettled([
    RNF.listNovels("most-popular-novel", 1),
    RNF.listNovels("latest-release-novel", 1),
    RNF.listNovels("completed-novel", 1),
    RNF.listNovels("hot-novel", 1),
    RR.listFictions("best-rated", 1),
    RR.listFictions("latest-updates", 1),
    RR.listFictions("complete", 1),
  ]);
  const rows = (r: PromiseSettledResult<{ results: NovelResult[] }>) =>
    r.status === "fulfilled" ? r.value.results : [];

  /**
   * SHELVES NOW DESCRIBE WHAT THE SOURCES ACTUALLY ARE.
   *
   * The old keys came from the deleted curated era and had become labels that
   * lie: "Official Japanese Light Novels" was being filled with RoyalRoad's
   * ORIGINAL ENGLISH serials, while "Korean Masterpieces" and "Chinese Xianxia"
   * sat permanently empty because nothing left could honestly fill them. A
   * shelf whose title contradicts its contents is worse than no shelf.
   *
   * The two sources split cleanly by KIND, so the shelves split the same way:
   * translated Asian web novels (ReadNovelFull) and original English fiction
   * (RoyalRoad). The mixed shelves — trending, latest, completed — interleave
   * rather than concatenate, because appending would bury every RoyalRoad row
   * below twenty ReadNovelFull rows on a horizontally-scrolling shelf.
   *
   * The legacy keys are still emitted, empty, so an older cached client cannot
   * crash on a missing field; the page hides an empty shelf.
   */
  const interleave = (a: NovelResult[], b: NovelResult[]) => {
    const out: NovelResult[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return mergeByTitle(out);
  };

  return {
    featuredHero: interleave(rows(hot), rows(rrPop)).slice(0, 8),

    // Honest, source-shaped shelves.
    translatedNovels: mergeByTitle(rows(pop)).slice(0, 20),
    originalFiction: mergeByTitle(rows(rrPop)).slice(0, 20),
    trending: interleave(rows(pop), rows(rrPop)),
    latestUpdates: interleave(rows(latest), rows(rrLatest)),
    completed: interleave(rows(done), rows(rrDone)),

    // Retired curated-era keys — emitted empty for back-compat only.
    lightNovels: [] as NovelResult[],
    koreanMasterpieces: [] as NovelResult[],
    cultivationEpics: [] as NovelResult[],
  };
}
