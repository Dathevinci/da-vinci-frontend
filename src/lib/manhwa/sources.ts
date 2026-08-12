// Manhwa source router — dispatches by id prefix, mirroring the novels'
// src/lib/novel/sources.ts. AsuraScans ids stay BARE (back-compat with every
// existing bookmark / reading-progress key); MangaDex ids are "mdx:<uuid>".
// Browse/search/home MERGE both sources (via allSettled, so one being down —
// Asura is flaky — still returns the other). The frontend treats ids as opaque.

import { AsuraScans } from "@/lib/asura";
import { IMangaResult, IMangaInfo, IMangaChapterPage, ISearch } from "@/lib/asura/models";
import { combineTotals } from "@/lib/explorePaging";
import * as MDX from "./MangaDex";
import MangaRead, { TITLE_ALIASES } from "./parsers/MangaRead";

const asura = () => new AsuraScans();
const mrd = () => new MangaRead();

// ── single-item lookups: route by prefix ────────────────────────────────────

export async function getManhwaInfo(id: string): Promise<IMangaInfo> {
  let info: IMangaInfo;
  if (id.startsWith("mrd:")) info = await mrd().fetchMangaInfo(id);
  else if (id.startsWith("mna:")) info = await mrd().fetchMangaInfo(id); // fallback for any bookmark
  else if (MDX.isMdx(id)) info = await MDX.fetchInfo(id);
  else info = await asura().fetchMangaInfo(id);

  // Rescue: If a title (like MangaDex DMCA'd licensed titles) returns 0 chapters, rescue chapters from MangaRead!
  //
  // TWO GUARDS, both born of the same owner report — "some series show fewer
  // chapters than they really have":
  //
  // 1. NEVER rescue a TRANSIENT failure. `chaptersFailed` means Asura HAS the
  //    chapters and one request didn't land (the flag exists so the UI can say
  //    so and offer a retry). Substituting MangaRead here replaced a complete
  //    list with one that lags Asura — or, worse, with a different series (see
  //    guard 2) — intermittently, since the very next reload showed the full
  //    list again. The rescue is for lists that are GENUINELY empty.
  //
  // 2. VERIFY THE MATCH. `results[0]` of a WordPress fuzzy search is not "this
  //    series on MangaRead" — for any title MangaRead doesn't host, it is some
  //    loosely-related series with its own, usually far shorter, chapter list
  //    (verified live: a 126-chapter series rescued a 26-chapter stranger).
  //    Same philosophy as findChapterBySlugAndNumber: the wrong series is far
  //    worse than none, so only a normalised exact/prefix title match counts.
  if ((!info.chapters || info.chapters.length === 0) && !(info as any).chaptersFailed) {
    try {
      const searchRes = await mrd().search(info.title);
      const hit = pickByTitle(searchRes.results, info.title);
      if (hit) {
        const rescueInfo = await mrd().fetchMangaInfo(hit.id);
        if (rescueInfo.chapters && rescueInfo.chapters.length > 0) {
          info.chapters = rescueInfo.chapters;
          console.log(`[manhwa] Rescued ${rescueInfo.chapters.length} chapters from MangaRead ("${hit.title}") for "${info.title}"`);
        }
      }
    } catch (e) {
      console.error(`[manhwa] Failed MangaRead rescue for "${info.title}":`, e);
    }
  }

  // LICENSED-STUB rescue (MangaDex): licensed hits keep only a handful of
  // publisher-link rows on MDX while the manga metadata declares the real
  // span — Jujutsu Kaisen shows 3 rows under lastChapter 271. When the list
  // is that kind of stub, borrow the full run from MangaRead — same
  // title-verified pick, and only adopted when it is actually LONGER than
  // what we have. Chapter ids in the adopted list carry the mrd: prefix,
  // which the chapter-pages router already dispatches on.
  if (MDX.isMdx(id) && (info.chapters?.length || 0) > 0) {
    const declared = info.lastChapter || 0;
    const have = info.chapters!.length;
    const isStub = declared > 10 && have < declared * 0.5 && declared - have > 10;
    if (isStub) {
      try {
        const searchRes = await mrd().search(info.title);
        const hit = pickByTitle(searchRes.results, info.title);
        if (hit) {
          const rescueInfo = await mrd().fetchMangaInfo(hit.id);
          if ((rescueInfo.chapters?.length || 0) > have) {
            info.chapters = rescueInfo.chapters;
            console.log(`[manhwa] Stub-rescued ${rescueInfo.chapters!.length} chapters (had ${have}/${declared}) from MangaRead ("${hit.title}") for "${info.title}"`);
          }
        }
      } catch (e) {
        console.error(`[manhwa] Failed stub rescue for "${info.title}":`, e);
      }
    }
  }

  return info;
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
  if (chapterId.startsWith("mrd:")) return mrd().fetchChapterPages(chapterId);
  if (chapterId.startsWith("mna:")) return mrd().fetchChapterPages(chapterId);
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
 * Pick the MangaRead search result that VERIFIABLY is this series — shared by
 * both rescue paths (zero-chapter and licensed-stub). WordPress fuzzy search
 * returns loosely-related strangers for any title MangaRead doesn't host, and
 * the wrong series is far worse than none.
 *
 * Accepts a normalised exact or prefix match, and honours TITLE_ALIASES — a
 * hand-built alias means MangaRead hosts the series under ANOTHER name
 * (search() already rewrites the query with it), so the verification must
 * accept that name too or the alias rescue can never fire. The
 * want-startsWith-got direction carries a length floor so a stray short
 * result ("solo") can't claim any long title it happens to prefix.
 */
function pickByTitle<T extends { title: string | undefined }>(results: T[], wantTitle: string): T | undefined {
  const lower = (wantTitle || "").toLowerCase();
  const alias = TITLE_ALIASES.find((a) => a.phrases.some((p) => lower.includes(p)));
  const wants = [normTitle(wantTitle), alias ? normTitle(alias.target) : ""].filter(Boolean);
  if (!wants.length) return undefined;
  return results.find((r) => {
    const got = normTitle(String(r.title || ""));
    if (!got) return false;
    return wants.some(
      (w) => got === w || got.startsWith(w) || (w.startsWith(got) && got.length >= Math.min(w.length, 8))
    );
  });
}

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
function merge(primary: IMangaResult[], ...secondaries: IMangaResult[][]): IMangaResult[] {
  const seen = new Map<string, { result: IMangaResult; index: number }>();
  const out: IMangaResult[] = [];
  
  const allSecondary = secondaries.flat().filter((x) => !isStub(x));
  
  for (const r of [...primary, ...allSecondary]) {
    if (!r) continue;
    const k = normTitle(r.title);
    if (k) {
      const existing = seen.get(k);
      if (existing) {
        // If the existing one is a MangaDex licensed stub, but the new one is not,
        // replace the existing one with the new one!
        const existingIsStub = String(existing.result.id).startsWith("mdx:") && !!existing.result.officialUrl;
        const newIsStub = String(r.id).startsWith("mdx:") && !!r.officialUrl;
        if (existingIsStub && !newIsStub) {
          const mergedResult: IMangaResult = {
            ...r,
            image: existing.result.image || r.image
          };
          out[existing.index] = mergedResult;
          seen.set(k, { result: mergedResult, index: existing.index });
        }
        continue;
      }
      seen.set(k, { result: r, index: out.length });
    }
    out.push(r);
  }
  return out;
}

// ── browse / search / home: merge Asura + MangaDex ──────────────────────────

/**
 * Only Asura understands the filters. When any is active, the other sources
 * are SKIPPED rather than merged: their rows can't honour the filter, so
 * mixing them in showed Ongoing titles under a Completed filter and would
 * have shown romance under Action. A filter that only some results obey is
 * worse than no filter.
 */
const filtersActive = (f?: any) => !!(f && (f.status || f.sort || f.genre));

/**
 * WHY MANHWA REPORTS A PAGE COUNT BUT NEVER AN ITEM COUNT.
 *
 * Both upstreams publish a real total — Asura's meta.total (339 browsing, 317
 * under genres=action) and MangaDex's envelope total (51977 on the latest
 * feed). Neither is the number of titles the reader will actually see, because
 * this router MERGES them and then throws rows away: `merge` drops cross-source
 * title duplicates and `isStub` drops MangaDex rows with no real chapters. A
 * 44-row raw window routinely survives as a handful. So any item count we
 * printed would be an upstream figure describing a list nobody is looking at —
 * exactly the "exact-looking number that is wrong" this must not ship.
 * `totalItems` is therefore OMITTED for manhwa. Always.
 *
 * The PAGE count survives that objection, and this is the whole distinction the
 * decision rests on. Our page N is literally their page N — browse asks Asura
 * for page N and MangaDex for page N and merges the two answers — so the last
 * page a reader can address is just the deepest last page any source has. That
 * is arithmetic over published numbers, not an estimate, and filtering cannot
 * change it: dropping rows changes how FULL a page is, never how MANY pages the
 * sources will answer.
 *
 * It still ships marked `totalsApproximate`, for one honest reason: our own
 * filters can empty a page in the tail completely (past Asura's 17 pages the
 * grid is MangaDex alone, and page 26 has been observed returning zero rows
 * while page 40 still had results). So the count is a truthful bound on the
 * paging space, not a promise that every page in it has something on it, and
 * the client is told which of those two it is holding.
 *
 * When a blind source is in the mix, combineTotals drops the whole thing rather
 * than understating it — MangaRead publishes no count at all, so if IT still
 * has pages the space is genuinely unbounded and the degraded pager is correct.
 */
const MANHWA_TOTALS = { approximate: true } as const;

export async function searchManhwa(query: string, page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const asuraOnly = filtersActive(filters);
  const [a, m, mr] = await Promise.allSettled([
    asura().search(query, page, filters),
    asuraOnly ? Promise.resolve({ currentPage: page, hasNextPage: false, results: [] as IMangaResult[] }) : MDX.search(query, page),
    asuraOnly ? Promise.resolve({ currentPage: page, hasNextPage: false, results: [] as IMangaResult[] }) : mrd().search(query, page)
  ]);
  const av = settled(a, { currentPage: page, hasNextPage: false, results: [] });
  const mv = settled(m, { currentPage: page, hasNextPage: false, results: [] });
  const mrv = settled(mr, { currentPage: page, hasNextPage: false, results: [] });
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mv.hasNextPage || mrv.hasNextPage,
    results: merge(av.results, mv.results, mrv.results),
    // MangaRead is the blind source here: it reports only "a next link exists".
    // combineTotals therefore withholds the count whenever MangaRead still has
    // pages, rather than publishing a total that only covers the other two.
    ...combineTotals([av, mv, mrv], page, MANHWA_TOTALS),
  };
}

/**
 * BROWSE PAGES CAN COME BACK EMPTY WITHOUT THE CATALOGUE BEING OVER, and this
 * function has to report those two states separately.
 *
 * AsuraScans holds 339 series (its own `meta.total`, per_page 20), so it is
 * exhausted after page 17 and every deeper page is MangaDex alone. What reaches
 * the grid from MangaDex is then thinned twice — `merge` drops cross-source
 * title duplicates, and `isStub` drops rows whose last-chapter marker is
 * missing or under 3 — so a 24-row MangaDex window routinely survives as 2-11
 * rows, and occasionally as ZERO.
 *
 * The old `hasNextPage: av.hasNextPage || mv.length > 0` measured the RAW
 * MangaDex array, before those filters. Live, page 26 answered
 * `{ hasNextPage: true, results: [] }` — 24 rows fetched, 24 rows filtered out
 * — while page 40 still had real results behind it. The explore grid read that
 * empty page as the end of the catalogue and stopped, which is the "explore
 * stops around page 25" report.
 *
 * Both halves now come from the sources' own pagination metadata, so
 * `hasNextPage` means "the SOURCE has another page" and never doubles as a
 * claim about how many rows survived our own filtering. An empty page is
 * therefore a page to skip, not a wall — the caller is free to ask for the next
 * one, and only `hasNextPage: false` ends the list.
 */
export async function browseManhwa(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const asuraOnly = filtersActive(filters);
  const empty = { currentPage: page, hasNextPage: false, results: [] as IMangaResult[] };
  const [a, m] = await Promise.allSettled([
    asura().getSeries(page, filters),
    asuraOnly ? Promise.resolve(empty) : MDX.latestPage(page),
  ]);
  const av = settled(a, empty);
  const mv = settled(m, empty);
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mv.hasNextPage,
    results: merge(av.results, mv.results),
    // Both browse sources publish a total, so this one normally resolves: the
    // deeper of Asura's 17 pages and MangaDex's reachable 416. With filters
    // active MangaDex is skipped entirely and the answer is Asura's alone,
    // which is the correct result — the reader is only being shown Asura rows.
    ...combineTotals([av, mv], page, MANHWA_TOTALS),
  };
}

/** The Asura genre taxonomy, for the explore filter panel. */
export async function asuraGenres(): Promise<{ id: number; name: string; slug: string }[]> {
  return asura().getGenres();
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
