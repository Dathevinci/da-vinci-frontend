// Manhwa source router — dispatches by id prefix, mirroring the novels'
// src/lib/novel/sources.ts. AsuraScans ids stay BARE (back-compat with every
// existing bookmark / reading-progress key); MangaDex ids are "mdx:<uuid>".
// Browse/search/home MERGE both sources (via allSettled, so one being down —
// Asura is flaky — still returns the other). The frontend treats ids as opaque.

import { AsuraScans } from "@/lib/asura";
import { IMangaResult, IMangaInfo, IMangaChapterPage, ISearch } from "@/lib/asura/models";
import * as MDX from "./MangaDex";

const asura = () => new AsuraScans();

// ── single-item lookups: route by prefix ────────────────────────────────────

export async function getManhwaInfo(id: string): Promise<IMangaInfo> {
  if (MDX.isMdx(id)) return MDX.fetchInfo(id);
  return asura().fetchMangaInfo(id);
}

export async function getChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
  if (MDX.isMdx(chapterId)) return MDX.fetchPages(chapterId);
  return asura().fetchChapterPages(chapterId);
}

// ── merge helpers ────────────────────────────────────────────────────────────

const settled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback;

const normTitle = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Interleave two result lists (a, b, a, b, …) and drop cross-source duplicates
// by normalised title, so the same series from both sources shows once.
function interleave(a: IMangaResult[], b: IMangaResult[]): IMangaResult[] {
  const seen = new Set<string>();
  const out: IMangaResult[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    for (const r of [a[i], b[i]]) {
      if (!r) continue;
      const k = normTitle(r.title);
      if (k && seen.has(k)) continue;
      if (k) seen.add(k);
      out.push(r);
    }
  }
  return out;
}

// ── browse / search / home: merge Asura + MangaDex ──────────────────────────

export async function searchManhwa(query: string, page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const [a, m] = await Promise.allSettled([asura().search(query, page, filters), MDX.search(query, page)]);
  const av = settled(a, { currentPage: page, hasNextPage: false, results: [] });
  const mv = settled(m, { currentPage: page, hasNextPage: false, results: [] });
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mv.hasNextPage,
    results: interleave(av.results, mv.results),
  };
}

export async function browseManhwa(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const [a, m] = await Promise.allSettled([asura().getSeries(page, filters), MDX.latest(page)]);
  const av = settled(a, { currentPage: page, hasNextPage: false, results: [] });
  const mv = settled(m, [] as IMangaResult[]);
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mv.length > 0,
    results: interleave(av.results, mv),
  };
}

export async function manhwaHome(): Promise<{ trending: IMangaResult[]; latestUpdates: IMangaResult[] }> {
  const [ap, al, mp, ml] = await Promise.allSettled([
    asura().getPopularToday(),
    asura().getLatestUpdates(1),
    MDX.popular(),
    MDX.latest(1),
  ]);
  const emptySearch = { currentPage: 1, hasNextPage: false, results: [] as IMangaResult[] };
  return {
    trending: interleave(settled(ap, emptySearch).results, settled(mp, [] as IMangaResult[])),
    latestUpdates: interleave(settled(al, emptySearch).results, settled(ml, [] as IMangaResult[])),
  };
}
