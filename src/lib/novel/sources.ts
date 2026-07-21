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
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";

export function resolveSource(id: string): { source: "nf" | "fmtl" | "rnf"; slug: string } {
  if (id.startsWith("nf:")) return { source: "nf", slug: id.slice(3) };
  if (id.startsWith("fmtl:")) return { source: "fmtl", slug: id.slice(5) };
  return { source: "rnf", slug: id.replace(/^rnf:/, "") };
}

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  if (source === "nf") return NF.getNovelInfo(slug);
  if (source === "fmtl") return FMTL.getNovelInfo(slug);
  return RNF.getNovelInfo(slug);
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { source, slug } = resolveSource(id);
  if (source === "nf") return NF.getChapterContent(slug, chapterId);
  if (source === "fmtl") return FMTL.getChapterContent(slug, chapterId);
  return RNF.getChapterContent(slug, chapterId);
}

// Query novelfull + readnovelfull for one term and interleave (novelfull first,
// since it's the richer source), deduped by title. A source that fails is
// skipped, so search still works if one is down.
async function runSearch(query: string, page: number): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const [nf, rnf] = await Promise.allSettled([NF.searchNovels(query, page), RNF.searchNovels(query, page)]);
  const a = nf.status === "fulfilled" ? nf.value.results : [];
  const b = rnf.status === "fulfilled" ? rnf.value.results : [];

  const merged: NovelResult[] = [];
  const seen = new Set<string>();
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    for (const item of [a[i], b[i]]) {
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

// Browse the catalog (the list tabs) — novelfull.net.
export async function browseNovels(page = 1, list = "most-popular-novel") {
  return NF.browseNovels(page, list);
}

// Home shelves — all from novelfull.net's lists. (The `fanmtl` key is retained
// for frontend compatibility but now carries a novelfull "hot" shelf.)
export async function homeShelves() {
  const [trending, latest, completed, hot] = await Promise.allSettled([
    NF.browseNovels(1, "most-popular"),
    NF.browseNovels(1, "latest-release-novel"),
    NF.browseNovels(1, "completed-novel"),
    NF.browseNovels(1, "hot-novel"),
  ]);
  return {
    trending: trending.status === "fulfilled" ? trending.value.results : [],
    latestUpdates: latest.status === "fulfilled" ? latest.value.results : [],
    completed: completed.status === "fulfilled" ? completed.value.results : [],
    fanmtl: hot.status === "fulfilled" ? hot.value.results : [],
  };
}
