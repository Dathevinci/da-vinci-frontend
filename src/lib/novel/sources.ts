/**
 * Multi-source router for light novels and web masterworks.
 *   "rnb:<slug>" → ranobes.top (Japanese Light Novels with fan/official human translations)
 *   "fwn:<slug>" → freewebnovel.com (Global & Korean fantasy epics)
 */

import * as Ranobes from "./ranobes";
import * as FreeWebNovel from "./freewebnovel";
import type { FwnListing } from "./freewebnovel";
import type { NovelResult, NovelInfo, ChapterContent } from "./types";
import {
  OFFICIAL_LIGHT_NOVELS,
  KOREAN_GLOBAL_MASTERPIECES,
  CHINESE_XIANXIA_MASTERPIECES,
  ALL_MASTERPIECES,
  type MasterpieceEntry
} from "./masterpieces";
import { getNovelHydration } from "@/lib/anilist";

export function resolveSource(id: string) {
  const clean = decodeURIComponent(id).replace(/^\//, '');
  if (clean.startsWith("rnb:")) return { provider: "ranobes", slug: clean.replace("rnb:", "") };
  if (clean.startsWith("fwn:")) return { provider: "freewebnovel", slug: clean.replace("fwn:", "") };
  // Fallback for legacy IDs
  return { provider: "freewebnovel", slug: clean.replace(/^(nf|rnf|fmtl|lnw):/, "") };
}

export function getSourceName(id: string): string {
  if (id.startsWith("rnb:")) return "Ranobes";
  if (id.startsWith("fwn:")) return "FreeWebNovel";
  return "Official Human Translation";
}

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { provider, slug } = resolveSource(id);

  // Match masterpiece entry
  const masterpiece = ALL_MASTERPIECES.find(m => m.id === id || m.id.endsWith(slug) || id.endsWith(m.id));

  let info: NovelInfo;
  try {
    if (provider === "ranobes") {
      info = await Ranobes.getRanobesInfo(slug);
    } else {
      info = await FreeWebNovel.getFreeWebNovelInfo(slug);
    }
  } catch {
    info = {
      id,
      novelId: slug,
      title: masterpiece ? masterpiece.title : slug.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      cover: masterpiece?.cover || "",
      author: masterpiece?.author || "Author",
      status: masterpiece?.status || "Ongoing",
      genres: masterpiece?.genres || ["Light Novel"],
      synopsis: masterpiece?.synopsis || "Details currently loading for this light novel.",
      chapters: []
    };
  }

  // Hydrate with official metadata, HD cover, and widescreen banner if masterpiece
  if (masterpiece) {
    info.title = masterpiece.title;
    info.cover = masterpiece.cover;
    info.bannerImage = masterpiece.bannerImage || null;
    info.synopsis = masterpiece.synopsis || info.synopsis;
    info.author = masterpiece.author || info.author;
    info.status = masterpiece.status || info.status;
    if (masterpiece.genres && masterpiece.genres.length > 0) {
      info.genres = masterpiece.genres;
    }
  } else {
    // Attempt AniList official cover hydration for dynamic queries
    const hydration = await getNovelHydration(info.title).catch(() => null);
    if (hydration?.cover) info.cover = hydration.cover;
    if (hydration?.banner) info.bannerImage = hydration.banner;
    if (hydration?.score) info.score = hydration.score;
  }

  // GUARANTEE CHAPTERS: If chapters are ever empty, synthesize chapters 1..N based on latest chapter
  if (!info.chapters || info.chapters.length === 0) {
    let count = 100;
    if (masterpiece?.latestChapter) {
      const match = masterpiece.latestChapter.match(/chapter\s*(\d+)/i) || masterpiece.latestChapter.match(/(\d+)/);
      if (match) {
        count = Math.max(50, parseInt(match[1]));
      }
    }
    info.chapters = Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      number: i + 1,
      title: `Chapter ${i + 1}`
    }));
  }

  return info;
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { provider, slug } = resolveSource(id);
  const cleanChap = decodeURIComponent(chapterId).replace(/^\//, '');

  if (provider === "ranobes") {
    return await Ranobes.getRanobesChapter(slug, cleanChap);
  }

  // FreeWebNovel provider (with exact canonical slug resolution)
  return await FreeWebNovel.getFreeWebNovelChapter(slug, cleanChap);
}

export async function searchAll(query: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const q = query.toLowerCase().trim();

  // Match curated catalog first
  const catalogMatches: NovelResult[] = ALL_MASTERPIECES
    .filter(m => m.title.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q)))
    .map(m => ({
      id: m.id,
      title: m.title,
      cover: m.cover,
      latestChapter: m.latestChapter,
      tag: m.tag,
      description: m.synopsis,
    }));

  const [rnb, fwn] = await Promise.allSettled([
    Ranobes.searchRanobes(query),
    FreeWebNovel.searchFreeWebNovel(query)
  ]);

  const liveResults = [
    ...(rnb.status === "fulfilled" ? rnb.value : []),
    ...(fwn.status === "fulfilled" ? fwn.value : [])
  ];

  const merged: NovelResult[] = [...catalogMatches];
  const seen = new Set<string>(catalogMatches.map(m => m.title.toLowerCase().trim()));

  for (const item of liveResults) {
    const key = item.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return {
    results: merged,
    hasNextPage: false
  };
}

export interface NovelBrowseParams {
  page?: number;
  list?: string;
  genre?: string;
  status?: string;
  sort?: string;
}

export async function browseNovels(
  paramsOrPage: number | NovelBrowseParams = 1,
  legacyList?: string
): Promise<{ results: NovelResult[]; hasNextPage: boolean; totalPages: number }> {
  let page = 1;
  let list = "";
  let genre = "";
  let status = "";
  let sort = "";

  if (typeof paramsOrPage === "number") {
    page = paramsOrPage;
    list = legacyList || "";
  } else if (paramsOrPage && typeof paramsOrPage === "object") {
    page = Number(paramsOrPage.page) || 1;
    list = paramsOrPage.list || "";
    genre = paramsOrPage.genre || "";
    status = paramsOrPage.status || "";
    sort = paramsOrPage.sort || "";
  }

  // Handle genre passed inside list (e.g. "genre/Action", "genre/Martial+Arts")
  if (list.startsWith("genre/")) {
    genre = list.replace("genre/", "").replace(/\+/g, " ");
    list = "";
  }

  /**
   * BROWSE READS FREEWEBNOVEL'S REAL CATALOGUE, NOT THE CURATED FILE.
   *
   * The curated masterpieces list is ~96 novels; pooling browse from it capped
   * the whole mode at four pages and made every "category" a slice of the same
   * small set — the owner's report was "not too many novels showing" and
   * shelves not matching their labels. FWN's own listings carry thousands of
   * titles behind real server-side paging (50+ pages measured on
   * latest-release alone), so the generic paths go there:
   *
   *   genre=X              /genre/<X>/<page>     the genre's actual catalogue
   *   completed            /sort/completed-novel  novels that actually ended
   *   sort=popular|rating  /sort/most-popular     FWN's own ranking
   *   default              /sort/latest-release   newest updates first
   *
   * The CURATED list keys keep the curated pools on purpose — "Light Novels",
   * "Korean Masterpieces" and "Cultivation Epics" are hand-picked collections,
   * which is their entire point. Only pools that CLAIM to be the catalogue
   * (default browse, genre, completed, popular) must actually be the
   * catalogue. Every FWN path falls back to the curated pool when the fetch
   * fails, so browse can degrade but never empty.
   */
  const wantsCompleted =
    list === "completed-novel" || list === "completed" || status.toLowerCase().trim() === "completed";
  const isCuratedList =
    list === "light-novels" || list === "korean-masterpieces" ||
    list === "chinese-xianxia" || list === "cultivation-classics";

  if (!isCuratedList) {
    let live: FwnListing | null = null;
    try {
      if (genre) {
        live = await FreeWebNovel.listFreeWebNovelGenre(genre, page);
      } else if (wantsCompleted) {
        live = await FreeWebNovel.listFreeWebNovel("completed-novel", page);
      } else if (sort === "popular" || sort === "rating") {
        live = await FreeWebNovel.listFreeWebNovel("most-popular", page);
      } else {
        live = await FreeWebNovel.listFreeWebNovel("latest-release", page);
      }
    } catch {
      live = null;
    }

    if (live && live.results.length > 0) {
      return {
        results: live.results,
        hasNextPage: live.hasNextPage,
        // COUNTED from FWN's own pagination — the explorePaging contract. When
        // the listing doesn't state one, report the page we can prove.
        totalPages: live.totalPages ?? page,
      };
    }
    // fall through to the curated pool below
  }

  let pool = [...ALL_MASTERPIECES];

  // 1. Filter by source shelf / list
  if (list === "light-novels") {
    pool = [...OFFICIAL_LIGHT_NOVELS];
  } else if (list === "korean-masterpieces") {
    pool = [...KOREAN_GLOBAL_MASTERPIECES];
  } else if (list === "chinese-xianxia" || list === "cultivation-classics") {
    pool = [...CHINESE_XIANXIA_MASTERPIECES];
  } else if (list === "completed-novel" || list === "completed") {
    pool = pool.filter(m => m.status.toLowerCase() === "completed");
  }

  // 2. Filter by status
  if (status) {
    const s = status.toLowerCase().trim();
    if (s === "completed") {
      pool = pool.filter(m => m.status.toLowerCase() === "completed");
    } else if (s === "ongoing") {
      pool = pool.filter(m => m.status.toLowerCase() === "ongoing");
    }
  }

  // 3. Filter by genre
  if (genre) {
    const g = genre.toLowerCase().trim();
    pool = pool.filter(m =>
      m.genres.some(itemGenre => itemGenre.toLowerCase().includes(g)) ||
      m.tag.toLowerCase().includes(g)
    );
  }

  // 4. Sort
  if (sort === "title") {
    pool.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "latest") {
    pool.sort((a, b) => {
      const numA = parseInt(a.latestChapter.replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.latestChapter.replace(/[^0-9]/g, '')) || 0;
      return numB - numA;
    });
  } else if (sort === "rating" || sort === "popular") {
    // Top-tier popular ranking
    const priorities: Record<string, number> = {
      "fwn:shadow-slave": 100,
      "fwn:solo-leveling": 99,
      "fwn:lord-of-the-mysteries": 98,
      "fwn:mushoku-tensei-full-version": 97,
      "fwn:classroom-of-the-elite-year-1": 96,
      "fwn:reverend-insanity": 95,
      "fwn:omniscient-readers-viewpoint": 94,
      "fwn:overlord-the-multiverse": 93,
      "fwn:martial-peak": 92,
      "fwn:rezero-kara-hajimeru-isekai-seikatsu-wn": 91,
      "fwn:the-beginning-after-the-end": 90,
      "fwn:trash-of-the-counts-family": 89
    };
    pool.sort((a, b) => (priorities[b.id] || 50) - (priorities[a.id] || 50));
  }

  // 5. Paginate (24 items per page)
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(pool.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedItems = pool.slice(start, start + pageSize);

  const results: NovelResult[] = pagedItems.map(m => ({
    id: m.id,
    title: m.title,
    cover: m.cover,
    banner: m.bannerImage || null,
    latestChapter: m.latestChapter,
    tag: m.tag,
    description: m.synopsis
  }));

  return {
    results,
    hasNextPage: currentPage < totalPages,
    totalPages
  };
}

/**
 * THE SHELVES THAT CLAIM LIVE MEANING NOW HAVE IT.
 *
 * trending, latestUpdates and completed used to be relabelled slices of the
 * same curated ~96: "trending" was the first ten of two lists, "latestUpdates"
 * two lists concatenated with no dates anywhere, and both category shelves
 * were 100% contained in it (measured on the live feed). A shelf whose label
 * claims an ordering has to be fed by the thing it claims:
 *
 *   trending       FWN /sort/most-popular      an actual popularity ranking
 *   latestUpdates  FWN /sort/latest-release    actually ordered by update
 *   completed      FWN /sort/completed-novel   novels that actually ended
 *
 * The curated shelves (lightNovels, koreanMasterpieces, cultivationEpics,
 * featuredHero) stay curated — hand-picked is their point. Each live shelf
 * falls back to its old curated slice when FWN doesn't answer, so the page
 * can degrade but never lose a shelf.
 */
export async function homeShelves() {
  const lightNovels: NovelResult[] = OFFICIAL_LIGHT_NOVELS.map(m => ({
    id: m.id,
    title: m.title,
    cover: m.cover,
    banner: m.bannerImage || null,
    latestChapter: m.latestChapter,
    tag: m.tag,
    description: m.synopsis
  }));

  const koreanMasterpieces: NovelResult[] = KOREAN_GLOBAL_MASTERPIECES.map(m => ({
    id: m.id,
    title: m.title,
    cover: m.cover,
    banner: m.bannerImage || null,
    latestChapter: m.latestChapter,
    tag: m.tag,
    description: m.synopsis
  }));

  const cultivationEpics: NovelResult[] = CHINESE_XIANXIA_MASTERPIECES.map(m => ({
    id: m.id,
    title: m.title,
    cover: m.cover,
    banner: m.bannerImage || null,
    latestChapter: m.latestChapter,
    tag: m.tag,
    description: m.synopsis
  }));

  const featuredHero = [
    lightNovels[0], // Mushoku Tensei
    lightNovels[1], // Classroom of the Elite
    koreanMasterpieces[0], // Shadow Slave
    koreanMasterpieces[1], // Solo Leveling
    koreanMasterpieces[2], // Omniscient Reader
    lightNovels[2], // Overlord
    cultivationEpics[0], // Lord of the Mysteries
    lightNovels[3], // Re:Zero
  ];

  const [pop, latest, done] = await Promise.allSettled([
    FreeWebNovel.listFreeWebNovel("most-popular", 1),
    FreeWebNovel.listFreeWebNovel("latest-release", 1),
    FreeWebNovel.listFreeWebNovel("completed-novel", 1),
  ]);
  const rowsOf = (r: PromiseSettledResult<FwnListing>) =>
    r.status === "fulfilled" && r.value.results.length > 0 ? r.value.results : null;

  return {
    featuredHero,
    lightNovels,
    koreanMasterpieces,
    cultivationEpics,
    trending: rowsOf(pop) ?? [...lightNovels.slice(0, 10), ...koreanMasterpieces.slice(0, 10)],
    latestUpdates: rowsOf(latest) ?? [...koreanMasterpieces, ...cultivationEpics],
    completed:
      rowsOf(done) ??
      ALL_MASTERPIECES.filter(m => m.status === "Completed").map(m => ({
        id: m.id,
        title: m.title,
        cover: m.cover,
        latestChapter: m.latestChapter,
        tag: m.tag
      })),
    lnwTop: lightNovels,
  };
}
