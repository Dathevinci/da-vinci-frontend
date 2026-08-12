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
  throw new Error(`Unknown source for id: ${id}`);
}

import { getNovelCover } from '../anilist';
import { getKitsuNovelCover } from '../kitsu';

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  
  const info = await source.getNovelInfo(slug);

  // Run alternative search & anilist cover fetch in parallel
  const [searchRes, anilistCover] = await Promise.allSettled([
    searchAll(info.title, 1),
    getNovelCover(info.title)
  ]);

  if (anilistCover.status === "fulfilled" && anilistCover.value) {
    info.cover = anilistCover.value;
  }

  // Still nothing? The source page had no parseable cover AND AniList doesn't
  // know the title (it excludes English-original webnovels like The Beginning
  // After the End). Kitsu indexes those, so ask it before shipping a blank
  // detail hero. Only runs on the doubly-missed case, so it costs nothing on
  // the normal path.
  if (!info.cover) {
    const kitsu = await getKitsuNovelCover(info.title).catch(() => null);
    if (kitsu) info.cover = kitsu;
  }

  const alternatives: { source: string; id: string; name: string }[] = [];
  
  // Add current source as an option
  alternatives.push({
    source: "current",
    id,
    name: "Current Source"
  });

  if (searchRes.status === "fulfilled") {
    // Add alternatives found in search (deduped by source)
    for (const res of searchRes.value.results) {
      if (res.id !== id && !alternatives.find(a => a.id === res.id)) {
        // Only add if title is very similar (ignoring punctuation and spacing)
        const clean = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (clean(res.title) === clean(info.title)) {
          alternatives.push({
            source: "alternative",
            id: res.id,
            name: "Alternative"
          });
        }
      }
    }
  }

  info.alternativeServers = alternatives;
  return info;
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
  const sources = [
    LightNovelWorld.browseNovels(page, list).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    NovelFull.browseNovels(page, list).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    ReadNovelFull.browseNovels(page, list).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    Ranobes.browseNovels(page, list).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 })),
    WuxiaWorldSite.browseNovels(page, list).catch(() => ({ results: [], hasNextPage: false, totalPages: 1 }))
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

export async function homeShelves() {
  const [
    lnwPopular,
    nfLatest,
    rnfHot,
    rnbPopular,
    wwsHot
  ] = await Promise.all([
    LightNovelWorld.browseNovels(1, "trending").catch(() => ({ results: [] })),
    NovelFull.browseNovels(1, "latest").catch(() => ({ results: [] })),
    ReadNovelFull.browseNovels(1, "most-popular-novel").catch(() => ({ results: [] })),
    Ranobes.browseNovels(1, "rating").catch(() => ({ results: [] })),
    WuxiaWorldSite.browseNovels(1, "trending").catch(() => ({ results: [] }))
  ]);

  return [
    { title: "Light Novel World Top", results: lnwPopular.results.slice(0, 10) },
    { title: "Ranobes Highest Rated", results: rnbPopular.results.slice(0, 10) },
    { title: "WuxiaWorld Trending", results: wwsHot.results.slice(0, 10) },
    { title: "NovelFull Latest", results: nfLatest.results.slice(0, 10) },
    { title: "ReadNovelFull Hot", results: rnfHot.results.slice(0, 10) },
  ];
}
