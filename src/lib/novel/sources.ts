/**
 * Multi-source router for novels. Ids carry a source prefix so the frontend can
 * treat them as opaque and round-trip them through the routes:
 *   "nf:<slug>"   → novelfull.net   (PRIMARY — big, clean, non-MTL library)
 *   "lnw:<slug>"  → lightnovelworld.org (Top rated & trending)
 *   "fmtl:<slug>" → fanmtl.com       (LEGACY — retained for backward compat)
 *   "<slug>"      → readnovelfull    (secondary — supplements search)
 */

import * as NovelFull from "./NovelFull";
import * as ReadNovelFull from "./ReadNovelFull";
import * as FanMTL from "./FanMTL";
import * as LightNovelWorld from "./LightNovelWorld";
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";
import { combineTotals, type PageTotals, type SourcePaging } from "@/lib/explorePaging";
import { getNovelCover } from '../anilist';
import { getKitsuNovelCover } from '../kitsu';

export function resolveSource(id: string) {
  if (id.startsWith("nf:")) return { source: NovelFull, slug: id.replace("nf:", "") };
  if (id.startsWith("rnf:")) return { source: ReadNovelFull, slug: id.replace("rnf:", "") };
  if (id.startsWith("fmtl:")) return { source: FanMTL, slug: id.replace("fmtl:", "") };
  if (id.startsWith("lnw:")) return { source: LightNovelWorld, slug: id.replace("lnw:", "") };
  // Graceful fallback for legacy removed sources (rnb, wws, lnori)
  if (id.startsWith("rnb:") || id.startsWith("wws:") || id.startsWith("ww:") || id.startsWith("lnori:")) {
    const rawSlug = id.replace(/^(rnb|wws|ww|lnori):/, "");
    return { source: NovelFull, slug: rawSlug };
  }
  return { source: ReadNovelFull, slug: id };
}

export function getSourceName(id: string): string {
  if (id.startsWith("nf:")) return "NovelFull";
  if (id.startsWith("lnw:")) return "LightNovelWorld";
  if (id.startsWith("fmtl:")) return "FanMTL";
  if (id.startsWith("rnb:") || id.startsWith("wws:") || id.startsWith("lnori:")) return "Archived Source";
  return "ReadNovelFull";
}

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  
  try {
    const info = await source.getNovelInfo(slug);

    // Run alternative search & anilist cover fetch in parallel
    const [searchRes, anilistCover] = await Promise.allSettled([
      searchAll(info.title, 1),
      getNovelCover(info.title)
    ]);

    if (anilistCover.status === "fulfilled" && anilistCover.value) {
      info.cover = anilistCover.value;
    }

    if (!info.cover) {
      const kitsu = await getKitsuNovelCover(info.title).catch(() => null);
      if (kitsu) info.cover = kitsu;
    }

    const alternatives: { source: string; id: string; name: string }[] = [];
    
    alternatives.push({
      source: "current",
      id,
      name: getSourceName(id)
    });

    if (searchRes.status === "fulfilled") {
      for (const res of searchRes.value.results) {
        if (res.id !== id && !alternatives.find(a => a.id === res.id)) {
          const clean = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (clean(res.title) === clean(info.title)) {
            alternatives.push({
              source: "alternative",
              id: res.id,
              name: getSourceName(res.id)
            });
          }
        }
      }
    }

    info.alternativeServers = alternatives;
    return info;
  } catch (err) {
    console.error(`Error fetching info for novel ${id}:`, err);
    return {
      id,
      novelId: slug,
      title: slug.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      cover: "",
      author: "Unknown",
      status: "Unknown",
      genres: [],
      synopsis: "Details currently unavailable for this title. Please try another source or novel.",
      chapters: [],
      alternativeServers: [{ source: "current", id, name: "Current Source" }]
    };
  }
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { source, slug } = resolveSource(id);
  try {
    return await source.getChapterContent(slug, chapterId);
  } catch (err) {
    return {
      title: "Chapter",
      content: ["This chapter is no longer available from the requested provider."],
      prev: null,
      next: null
    };
  }
}

export async function searchAll(query: string, page = 1) {
  const sources = [
    LightNovelWorld.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    NovelFull.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    ReadNovelFull.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
  ];
  
  const results = await Promise.all(sources);
  const merged: NovelResult[] = [];
  const seen = new Set<string>();

  for (const res of results) {
    for (const item of res.results) {
      const key = item.title.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
  }

  return { results: merged, hasNextPage: results.some(r => r.hasNextPage) };
}

export async function browseNovels(page = 1, list = "trending") {
  if (list === "lnw-top") return LightNovelWorld.browseTopRated(3, 24);
  if (list === "nf-popular") return NovelFull.browseNovels(page, "most-popular");
  if (list.startsWith("genre/")) return NovelFull.browseNovels(page, list);
  // Fallback for removed legacy lists
  if (list === "ranobes-rating" || list === "wws-trending" || list === "lnori") {
    return NovelFull.browseNovels(page, "most-popular");
  }
  return ReadNovelFull.browseNovels(page, list);
}

export async function homeShelves() {
  const [
    trending,
    latest,
    completed,
    lnwTop,
    nfTop,
  ] = await Promise.allSettled([
    ReadNovelFull.browseNovels(1, "most-popular-novel"),
    ReadNovelFull.browseNovels(1, "latest-release-novel"),
    ReadNovelFull.browseNovels(1, "completed-novel"),
    LightNovelWorld.browseTopRated(3, 10),
    NovelFull.browseNovels(1, "most-popular"),
  ]);

  return {
    trending: trending.status === "fulfilled" ? trending.value.results : [],
    latestUpdates: latest.status === "fulfilled" ? latest.value.results : [],
    completed: completed.status === "fulfilled" ? completed.value.results : [],
    lnwTop: lnwTop.status === "fulfilled" ? lnwTop.value.results : [],
    nfTop: nfTop.status === "fulfilled" ? nfTop.value.results : [],
  };
}
