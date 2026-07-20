/**
 * Multi-source router for novels. readnovelfull ids are bare slugs (default);
 * fanmtl ids are prefixed "fmtl:". Detail/chapter fetches route by that prefix;
 * search queries both sources and merges. Frontend treats ids as opaque, so no
 * UI changes are needed to add a source.
 */

import * as RNF from "./ReadNovelFull";
import * as FMTL from "./FanMTL";
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";

export function resolveSource(id: string): { source: "fmtl" | "rnf"; slug: string } {
  if (id.startsWith("fmtl:")) return { source: "fmtl", slug: id.slice(5) };
  return { source: "rnf", slug: id.replace(/^rnf:/, "") };
}

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  const { source, slug } = resolveSource(id);
  return source === "fmtl" ? FMTL.getNovelInfo(slug) : RNF.getNovelInfo(slug);
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  const { source, slug } = resolveSource(id);
  return source === "fmtl" ? FMTL.getChapterContent(slug, chapterId) : RNF.getChapterContent(slug, chapterId);
}

// Search BOTH sources and interleave, deduped by title. A source that fails is
// skipped, so search still works if one is down.
export async function searchAll(query: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const [rnf, fmtl] = await Promise.allSettled([RNF.searchNovels(query, page), FMTL.searchNovels(query)]);
  const a = rnf.status === "fulfilled" ? rnf.value.results : [];
  const b = fmtl.status === "fulfilled" ? fmtl.value.results : [];

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
  const hasNextPage = rnf.status === "fulfilled" ? rnf.value.hasNextPage : false;
  return { results: merged, hasNextPage };
}

// Browse the readnovelfull catalog (the list tabs are readnovelfull lists).
export async function browseNovels(page = 1, list = "most-popular-novel") {
  return RNF.browseNovels(page, list);
}

// Home shelves — readnovelfull lists + a fanmtl shelf for extra reach.
export async function homeShelves() {
  const [trending, latest, completed, fanmtl] = await Promise.allSettled([
    RNF.browseNovels(1, "most-popular-novel"),
    RNF.browseNovels(1, "latest-release-novel"),
    RNF.browseNovels(1, "completed-novel"),
    FMTL.browseNovels(1),
  ]);
  return {
    trending: trending.status === "fulfilled" ? trending.value.results : [],
    latestUpdates: latest.status === "fulfilled" ? latest.value.results : [],
    completed: completed.status === "fulfilled" ? completed.value.results : [],
    fanmtl: fanmtl.status === "fulfilled" ? fanmtl.value.results : [],
  };
}
