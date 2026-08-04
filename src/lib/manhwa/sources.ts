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

/**
 * Pages for one chapter — with a MangaDex rescue when Asura has it locked.
 *
 * AsuraScans paywalls its newest chapter for a window and then releases it.
 * While it is locked the reader had nothing to show. MangaDex usually carries
 * the same chapter already, so we borrow it for the duration.
 *
 * THE RETURN TO ASURA IS AUTOMATIC, and that is the part worth being careful
 * about. Nothing here is persisted and nothing on this path is cached — the
 * lock is re-checked on every single request, so the moment Asura stops
 * answering "locked" the very next read comes from Asura again. There is no
 * flag to clear, no TTL to wait out, and no state that can get stuck pointing
 * at the wrong source. (Asura clears is_premium and is_locked together at
 * unlock, so the signal itself is not sticky either.)
 *
 * The fallback is strictly BEST EFFORT. If MangaDex does not carry the series,
 * or carries it under a title that doesn't match, or lacks that exact chapter
 * number, the original lock error is rethrown untouched and the reader shows
 * the lock — which is the honest outcome. Serving the wrong chapter would be
 * far worse than serving none, because nothing downstream could detect it.
 */
export async function getChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
  if (MDX.isMdx(chapterId)) return MDX.fetchPages(chapterId);
  try {
    return await asura().fetchChapterPages(chapterId);
  } catch (err: any) {
    if (!err?.isLocked) throw err;

    const slug: string | undefined = err.seriesSlug;
    const num: string | undefined = err.chapterNumber;
    if (!slug || !num) throw err;

    const found = await MDX.findChapterBySlugAndNumber(slug, num).catch(() => null);
    if (!found) throw err;

    const pages = await MDX.fetchPages(found.chapterId).catch(() => [] as IMangaChapterPage[]);
    if (pages.length === 0) throw err;

    console.log(
      `[manhwa] ${slug} ch ${num} is locked on Asura` +
        (err.unlockTime ? ` until ${err.unlockTime}` : "") +
        ` — serving ${pages.length} pages from MangaDex ("${found.mangaTitle}")`
    );
    return pages;
  }
}

// ── merge helpers ────────────────────────────────────────────────────────────

const settled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback;

const normTitle = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * A MangaDex row with nothing to read behind it. Since `ja` was added to the
 * language set, search returns a long tail of one-shots, doujin and stalled
 * uploads that match a word in the query — they look like series until you
 * open one and find a chapter or two. `latestChapter` comes straight from the
 * source's own last-chapter marker, so its absence is the honest signal that
 * there is nothing there.
 */
function isStub(r: IMangaResult): boolean {
  if (!String(r.id).startsWith("mdx:")) return false;
  const last = String(r.latestChapter || "").trim();
  if (!last) return true;
  const n = parseFloat(last.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n < 3;
}

/**
 * Merge two sources, dropping cross-source duplicates by normalised title.
 *
 * AsuraScans LEADS and MangaDex follows, rather than the two alternating.
 * One-for-one interleaving gave MangaDex half of every list, and once `ja`
 * joined the language set that half filled with loosely-matching manga — so
 * searching a manhwa returned a page where the actual series was buried
 * under near-miss Japanese titles with a couple of chapters each.
 *
 * The curated source people come here for goes first; MangaDex extends the
 * catalogue at the tail instead of displacing it.
 */
function merge(primary: IMangaResult[], secondary: IMangaResult[]): IMangaResult[] {
  const seen = new Set<string>();
  const out: IMangaResult[] = [];
  for (const r of [...primary, ...secondary.filter((x) => !isStub(x))]) {
    if (!r) continue;
    const k = normTitle(r.title);
    if (k && seen.has(k)) continue;
    if (k) seen.add(k);
    out.push(r);
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
    results: merge(av.results, mv.results),
  };
}

export async function browseManhwa(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const [a, m] = await Promise.allSettled([asura().getSeries(page, filters), MDX.latest(page)]);
  const av = settled(a, { currentPage: page, hasNextPage: false, results: [] });
  const mv = settled(m, [] as IMangaResult[]);
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mv.length > 0,
    results: merge(av.results, mv),
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
    trending: merge(settled(ap, emptySearch).results, settled(mp, [] as IMangaResult[])),
    latestUpdates: merge(settled(al, emptySearch).results, settled(ml, [] as IMangaResult[])),
  };
}
