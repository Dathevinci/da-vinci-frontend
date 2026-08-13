/**
 * Multi-source router for novels. Ids carry a source prefix so the frontend can
 * treat them as opaque and round-trip them through the routes:
 *   "nf:<slug>"   → novelfull.net   (PRIMARY — big, clean, non-MTL library)
 *   "fmtl:<slug>" → fanmtl.com       (LEGACY — retained only so old bookmarks
 *                                     still open; no longer searched/browsed)
 *   "<slug>"      → readnovelfull    (secondary — supplements search)
 *
 * novelfull.net replaced fanmtl as the main source: it carries the licensed
 * titles the MTL sources lacked (Overlord LN, Tensura, Omniscient Reader's
 * Viewpoint, …) and reads far cleaner.
 */

import * as NovelFull from "./NovelFull";
import * as ReadNovelFull from "./ReadNovelFull";
import * as FanMTL from "./FanMTL";
import * as LightNovelWorld from "./LightNovelWorld";
import * as Ranobes from "./Ranobes";
import * as WuxiaWorldSite from "./WuxiaWorldSite";
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";
import { combineTotals, type PageTotals, type SourcePaging } from "@/lib/explorePaging";

export function resolveSource(id: string) {
  if (id.startsWith("nf:")) return { source: NovelFull, slug: id.replace("nf:", "") };
  if (id.startsWith("rnf:")) return { source: ReadNovelFull, slug: id.replace("rnf:", "") };
  if (id.startsWith("fmtl:")) return { source: FanMTL, slug: id.replace("fmtl:", "") };
  if (id.startsWith("lnw:")) return { source: LightNovelWorld, slug: id.replace("lnw:", "") };
  if (id.startsWith("rnb:")) return { source: Ranobes, slug: id.replace("rnb:", "") };
  if (id.startsWith("wws:")) return { source: WuxiaWorldSite, slug: id.replace("wws:", "") };
  return { source: ReadNovelFull, slug: id };
}

import { getNovelCover } from '../anilist';
import { getKitsuNovelCover } from '../kitsu';

export function getSourceName(id: string): string {
  if (id.startsWith("rnb:")) return "Ranobes";
  if (id.startsWith("wws:")) return "WuxiaWorld";
  if (id.startsWith("nf:")) return "NovelFull";
  if (id.startsWith("lnw:")) return "LightNovelWorld";
  if (id.startsWith("fmtl:")) return "FanMTL";
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
      synopsis: "Details currently unavailable due to source server limits. Please try refreshing in a moment.",
      chapters: [],
      alternativeServers: [{ source: "current", id, name: "Current Source" }]
    };
  }
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { source, slug } = resolveSource(id);
  return source.getChapterContent(slug, chapterId);
}

export async function searchAll(query: string, page = 1) {
  const sources = [
    LightNovelWorld.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    NovelFull.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    ReadNovelFull.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    Ranobes.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    WuxiaWorldSite.searchNovels(query, page).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 }))
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

const TITLE_ALIASES: [RegExp, string][] = [
  [/that time i got reincarnated as a slime|^\s*tensura\s*$/i, "tensei shitara slime datta ken"],
];

export async function browseNovels(page = 1, list = "trending") {
  if (list === "ranobes-rating") return Ranobes.browseNovels(page, "rating");
  if (list === "wws-trending") return WuxiaWorldSite.browseNovels(page, "trending");
  if (list === "lnw-top") return LightNovelWorld.browseTopRated(3, 24);
  if (list.startsWith("genre/")) return NovelFull.browseNovels(page, list);
  return ReadNovelFull.browseNovels(page, list);
}

import * as Lnori from "./Lnori";

export async function homeShelves() {
  const [
    trending,
    latest,
    completed,
    rnbTop,
    wwsTop,
    lnwTop,
    lnori
  ] = await Promise.allSettled([
    ReadNovelFull.browseNovels(1, "most-popular-novel"),
    ReadNovelFull.browseNovels(1, "latest-release-novel"),
    ReadNovelFull.browseNovels(1, "completed-novel"),
    Ranobes.browseNovels(1, "rating"),
    WuxiaWorldSite.browseNovels(1, "trending"),
    LightNovelWorld.browseTopRated(3, 10),
    Lnori.browseNovels(1),
  ]);

  return {
    trending: trending.status === "fulfilled" ? trending.value.results : [],
    latestUpdates: latest.status === "fulfilled" ? latest.value.results : [],
    completed: completed.status === "fulfilled" ? completed.value.results : [],
    rnbTop: rnbTop.status === "fulfilled" ? rnbTop.value.results : [],
    wwsTop: wwsTop.status === "fulfilled" ? wwsTop.value.results : [],
    lnwTop: lnwTop.status === "fulfilled" ? lnwTop.value.results : [],
    lnori: lnori.status === "fulfilled" ? lnori.value.results : [],
  };
}
