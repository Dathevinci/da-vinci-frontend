/**
 * Multi-source router for light novels and web masterworks.
 *   "rnb:<slug>" → ranobes.top (Japanese Light Novels with fan/official human translations)
 *   "fwn:<slug>" → freewebnovel.com (Global & Korean fantasy epics)
 */

import * as Ranobes from "./ranobes";
import * as FreeWebNovel from "./freewebnovel";
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

  let lastError: any = null;

  // Primary source attempt
  try {
    if (provider === "ranobes") {
      return await Ranobes.getRanobesChapter(slug, cleanChap);
    }
    return await FreeWebNovel.getFreeWebNovelChapter(slug, cleanChap);
  } catch (err) {
    lastError = err;
  }

  // Cross-provider fallback: if primary failed, attempt alternate provider
  try {
    if (provider === "ranobes") {
      return await FreeWebNovel.getFreeWebNovelChapter(slug, cleanChap);
    } else {
      return await Ranobes.getRanobesChapter(slug, cleanChap);
    }
  } catch {}

  throw lastError || new Error("Unable to retrieve chapter content");
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

export async function browseNovels(page = 1, list = "trending") {
  if (list === "light-novels") {
    return {
      results: OFFICIAL_LIGHT_NOVELS.map(m => ({ id: m.id, title: m.title, cover: m.cover, latestChapter: m.latestChapter, tag: m.tag })),
      hasNextPage: false,
      totalPages: 1
    };
  }
  if (list === "korean-masterpieces") {
    return {
      results: KOREAN_GLOBAL_MASTERPIECES.map(m => ({ id: m.id, title: m.title, cover: m.cover, latestChapter: m.latestChapter, tag: m.tag })),
      hasNextPage: false,
      totalPages: 1
    };
  }
  if (list === "chinese-xianxia") {
    return {
      results: CHINESE_XIANXIA_MASTERPIECES.map(m => ({ id: m.id, title: m.title, cover: m.cover, latestChapter: m.latestChapter, tag: m.tag })),
      hasNextPage: false,
      totalPages: 1
    };
  }

  const all = ALL_MASTERPIECES.map(m => ({ id: m.id, title: m.title, cover: m.cover, latestChapter: m.latestChapter, tag: m.tag }));
  return {
    results: all,
    hasNextPage: false,
    totalPages: 1
  };
}

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

  return {
    featuredHero,
    lightNovels,
    koreanMasterpieces,
    cultivationEpics,
    trending: [...lightNovels.slice(0, 10), ...koreanMasterpieces.slice(0, 10)],
    latestUpdates: [...koreanMasterpieces, ...cultivationEpics],
    completed: ALL_MASTERPIECES.filter(m => m.status === "Completed").map(m => ({
      id: m.id,
      title: m.title,
      cover: m.cover,
      latestChapter: m.latestChapter,
      tag: m.tag
    })),
    lnwTop: lightNovels,
  };
}
