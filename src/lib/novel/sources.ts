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

import * as RNF from "./ReadNovelFull";
import * as NF from "./NovelFull";
import * as FMTL from "./FanMTL";
import * as LNW from "./LightNovelWorld";
import * as Lnori from "./Lnori";
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";

export function resolveSource(id: string): { source: "nf" | "fmtl" | "rnf" | "lnw" | "lnori"; slug: string } {
  if (id.startsWith("nf:")) return { source: "nf", slug: id.slice(3) };
  if (id.startsWith("fmtl:")) return { source: "fmtl", slug: id.slice(5) };
  if (id.startsWith("lnw:")) return { source: "lnw", slug: id.slice(4) };
  if (id.startsWith("lnori:")) return { source: "lnori", slug: id.slice(6) };
  return { source: "rnf", slug: id.replace(/^rnf:/, "") };
}

import { getNovelCover } from '../anilist';

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  
  let infoPromise: Promise<NovelInfo>;
  if (source === "nf") infoPromise = NF.getNovelInfo(slug);
  else if (source === "fmtl") infoPromise = FMTL.getNovelInfo(slug);
  else if (source === "lnw") infoPromise = LNW.getNovelInfo(slug);
  else if (source === "lnori") infoPromise = Lnori.getNovelInfo(slug);
  else infoPromise = RNF.getNovelInfo(slug);

  const info = await infoPromise;

  // Run alternative search & anilist cover fetch in parallel
  const [searchRes, anilistCover] = await Promise.allSettled([
    searchAll(info.title, 1),
    getNovelCover(info.title)
  ]);

  if (anilistCover.status === "fulfilled" && anilistCover.value) {
    info.cover = anilistCover.value;
  }

  const alternatives: { source: string; id: string; name: string }[] = [];
  
  // Add current source as an option
  alternatives.push({
    source,
    id,
    name: source === "nf" ? "NovelFull" : source === "fmtl" ? "FanMTL" : "ReadNovelFull"
  });

  if (searchRes.status === "fulfilled") {
    // Add alternatives found in search (deduped by source)
    for (const res of searchRes.value.results) {
      const altSrc = resolveSource(res.id).source;
      if (altSrc !== source && !alternatives.find(a => a.source === altSrc)) {
        // Only add if title is very similar (ignoring punctuation and spacing)
        const clean = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (clean(res.title) === clean(info.title)) {
          alternatives.push({
            source: altSrc,
            id: res.id,
            name: altSrc === "nf" ? "NovelFull" : altSrc === "fmtl" ? "FanMTL" : "ReadNovelFull"
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
  if (source === "nf") return NF.getChapterContent(slug, chapterId);
  if (source === "fmtl") return FMTL.getChapterContent(slug, chapterId);
  if (source === "lnw") return LNW.getChapterContent(slug, chapterId);
  if (source === "lnori") return Lnori.getChapterContent(slug, chapterId);
  return RNF.getChapterContent(slug, chapterId);
}

// Query novelfull + readnovelfull for one term and interleave (novelfull first,
// since it's the richer source), deduped by title. A source that fails is
// skipped, so search still works if one is down.
async function runSearch(query: string, page: number): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const [nf, rnf, lnw] = await Promise.allSettled([
    NF.searchNovels(query, page),
    RNF.searchNovels(query, page),
    LNW.searchNovels(query, page),
  ]);
  const a = nf.status === "fulfilled" ? nf.value.results : [];
  const b = rnf.status === "fulfilled" ? rnf.value.results : [];
  const c = lnw.status === "fulfilled" ? lnw.value.results : [];

  const merged: NovelResult[] = [];
  const seen = new Set<string>();
  const max = Math.max(a.length, b.length, c.length);
  for (let i = 0; i < max; i++) {
    for (const item of [a[i], b[i], c[i]]) {
      if (!item) continue;
      const key = item.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  const hasNextPage = (nf.status === "fulfilled" && nf.value.hasNextPage) || (rnf.status === "fulfilled" && rnf.value.hasNextPage);
  return { results: merged, hasNextPage };
}

// Famous titles some sources only index under a different (romaji) name, so the
// obvious English search would miss them. When the query matches, we ALSO search
// the alias and merge. Keep this short — it's for well-known aliases only.
const TITLE_ALIASES: [RegExp, string][] = [
  [/that time i got reincarnated as a slime|^\s*tensura\s*$/i, "tensei shitara slime datta ken"],
];

export async function searchAll(query: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const q = query.trim();
  let result = await runSearch(q, page);
  // The sources do a contiguous substring match, so a full title with
  // punctuation (e.g. the curly apostrophe in "Omniscient Reader's Viewpoint")
  // can match nothing. On an empty first page, retry with the first 2 clean words.
  if (result.results.length === 0 && page <= 1) {
    const words = q.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
    const short = words.slice(0, 2).join(" ");
    if (short && short !== q.toLowerCase()) {
      result = await runSearch(short, page);
    }
  }
  // Merge in any aliased title (e.g. English name → romaji), deduped by title.
  if (page <= 1) {
    const alias = TITLE_ALIASES.find(([re]) => re.test(q))?.[1];
    if (alias) {
      const extra = await runSearch(alias, page);
      const seen = new Set(result.results.map((r) => r.title.toLowerCase().trim()));
      for (const item of extra.results) {
        const k = item.title.toLowerCase().trim();
        if (!seen.has(k)) { seen.add(k); result.results.push(item); }
      }
    }
  }
  return result;
}

// Browse + home shelves use READNOVELFULL, whose list pages carry proper
// portrait covers (~266x399). novelfull.net's list/browse/home pages only serve
// tiny 180x80 thumbnails — its good 221x324 covers live ONLY on detail pages, so
// pulling them for every shelf item would mean ~40 detail fetches per home load.
// So novelfull stays the SEARCH + reading source (where its unique licensed
// titles + full chapter lists matter) and readnovelfull powers the crisp shelves.
/**
 * FanMTL is no longer surfaced ANYWHERE you can browse or search.
 *
 * It is machine translation, which is why those titles read badly and often sit
 * stale — the "Korean" shelf was FanMTL, so dropping that shelf and dropping the
 * MTL source are the same change. Everything discoverable now comes from
 * readnovelfull/novelfull, which carry human translations.
 *
 * FMTL is still imported on purpose: getNovelInfo and getChapterContent keep
 * working so anyone with an existing `fmtl:` bookmark can still open what they
 * were reading instead of hitting a dead link. Nothing NEW routes there.
 */
export async function browseNovels(page = 1, list = "most-popular-novel") {
  // "See all" on the LightNovelWorld shelf browses THAT source, rather than
  // dropping you into a readnovelfull list that shares none of the titles you
  // just clicked from.
  if (list === "lightnovelworld") return LNW.browseNovels(page);
  // Deeper than the home shelf: 6 pages scanned, best 48 kept. The shelf's 24
  // was a dead end as a browse destination — clicking through to "see all" and
  // landing on the same row you just left is worse than not offering the link.
  if (list === "lightnovelworld-top") return LNW.browseTopRated(6, 48);
  if (list.startsWith("genre/")) return NF.browseNovels(page, list);
  return RNF.browseNovels(page, list);
}

/**
 * Shelf sourcing is split deliberately.
 *
 * readnovelfull is the only source with genuinely DISTINCT lists — popular,
 * latest-release and completed each return different novels. lightnovelworld
 * ignores its sort params (verified: ?sort=latest and ?sort=popular return the
 * same first title as the unsorted list), so driving several shelves from it
 * would render the same books three times.
 *
 * What it IS good for is fresh titles the other source doesn't carry. So it
 * takes over the last shelf, which used to be readnovelfull page 2 — i.e. more
 * of what was already above it.
 */
export async function homeShelves() {
  const [trending, latest, completed, more, lnwTop, lnori] = await Promise.allSettled([
    RNF.browseNovels(1, "most-popular-novel"),
    RNF.browseNovels(1, "latest-release-novel"),
    RNF.browseNovels(1, "completed-novel"),
    LNW.browseNovels(1),
    LNW.browseTopRated(),
    Lnori.browseNovels(1),
  ]);
  return {
    trending: trending.status === "fulfilled" ? trending.value.results : [],
    latestUpdates: latest.status === "fulfilled" ? latest.value.results : [],
    completed: completed.status === "fulfilled" ? completed.value.results : [],
    // Kept in the shape so consumers reading this key don't break — the MTL
    // source that fed it is gone.
    korean: [],
    fanmtl: more.status === "fulfilled" ? more.value.results : [],
    // Ranked by rating rather than requested as "popular", since this source
    // ignores its own sort params.
    lnwTop: lnwTop.status === "fulfilled" ? lnwTop.value.results : [],
    lnori: lnori.status === "fulfilled" ? lnori.value.results : [],
  };
}
