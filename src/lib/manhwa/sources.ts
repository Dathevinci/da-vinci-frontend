// Manhwa source router — dispatches by id prefix, mirroring the novels'
// src/lib/novel/sources.ts. AsuraScans ids stay BARE (back-compat with every
// existing bookmark / reading-progress key), and every other source carries a
// three-letter prefix. Browse/search/home MERGE the sources (via allSettled,
// so one being down — Asura is flaky — still returns the others). The frontend
// treats ids as opaque.
//
// THE ID SHAPES, which are persisted and therefore frozen:
//   <slug>                  AsuraScans      chapters "<slug>|<number>"
//   flc:<series-id>         FlameComics     chapters "flc:<series-id>|<token>"
//   rzc:<series-slug>       RizzComics      chapters "rzc:<chapter-slug>"
//   mpl:<id>/<slug>         MangaPill       chapters "mpl:<id>-<n>/<slug>"
//   mrd:… / mna:…           MangaRead       the rescue parser
//
// Bookmarks and reading-progress keys embed these verbatim
// (`dv-progress:<owner>:manhwa:<id>`), so a change of SHAPE orphans existing
// rows. Add sources by adding a prefix; never by re-shaping an existing one.

import { AsuraScans } from "@/lib/asura";
import { IMangaResult, IMangaInfo, IMangaChapterPage, ISearch } from "@/lib/asura/models";
import { combineTotals } from "@/lib/explorePaging";
import MangaRead, { TITLE_ALIASES } from "./parsers/MangaRead";
import MangaPill from "./MangaPill";
import FlameComics from "./FlameComics";
import RizzComics from "./RizzComics";

const asura = () => new AsuraScans();
const mrd = () => new MangaRead();
const mpl = () => new MangaPill();
const flc = () => new FlameComics();
const rzc = () => new RizzComics();

// ── single-item lookups: route by prefix ────────────────────────────────────

/**
 * Every prefix this app can resolve, and the adapter that owns it.
 *
 * A TABLE rather than an if-chain so the two lookups below cannot drift out of
 * step — the previous pair had to be edited twice for every source, and a
 * prefix present in one but not the other is a series that opens and then
 * cannot be read.
 */
const ADAPTERS = {
  "mrd:": mrd,
  "mna:": mrd, // legacy Manganato bookmarks, served by the MangaRead parser
  "mpl:": mpl,
  "flc:": flc,
  "rzc:": rzc,
} as const;

/**
 * Anything shaped like a prefix. Asura slugs are plain kebab-case and never
 * contain a colon, so this cleanly separates "bare Asura id" from "id belonging
 * to some source" WITHOUT having to enumerate Asura's slugs.
 */
const PREFIX_RE = /^([a-z]{2,5}):/;

/**
 * Resolve an id to its adapter, or null for a bare (AsuraScans) id.
 *
 * Throws for a prefix nobody owns. That is the graceful failure, not a
 * shortcoming: an unknown prefix handed to Asura is requested as though it
 * were a slug, which 404s deep inside the parser and surfaces as a generic
 * "Series Not Found" that says nothing about what went wrong. A named error
 * reaches the API route, which returns it as `{ error }`, and the reader shows
 * that sentence. This is also what a REMOVED source degrades to — someone who
 * bookmarked a title under a prefix we no longer ship gets told so.
 */
function adapterFor(id: string): (() => any) | null {
  const raw = String(id || "");
  for (const [prefix, make] of Object.entries(ADAPTERS)) {
    if (raw.startsWith(prefix)) return make;
  }
  const m = PREFIX_RE.exec(raw);
  if (m) throw new Error(`Unknown manhwa source "${m[1]}" for id "${raw}"`);
  return null;
}

export async function getManhwaInfo(id: string): Promise<IMangaInfo> {
  const make = adapterFor(id);
  const info: IMangaInfo = make ? await make().fetchMangaInfo(id) : await asura().fetchMangaInfo(id);

  // Rescue: if a series resolves but its chapter list comes back EMPTY, try to
  // rescue the chapters from MangaRead.
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



  return info;
}

/**
 * Pages for one chapter.
 */
export async function getChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
  const make = adapterFor(chapterId);
  if (make) return make().fetchChapterPages(chapterId);

  try {
    return await asura().fetchChapterPages(chapterId);
  } catch (err: any) {
    if (!err?.isLocked) throw err;

    const slug: string | undefined = err.seriesSlug;
    if (!slug) throw err;

    /**
     * LOCK RESCUE — Asura has this chapter paywalled, so try MangaPill.
     *
     * VERIFY THE SERIES, exactly as the zero-chapter rescue above does. This
     * used to take `results[0]` with the comment "simplistic assumption", and
     * that assumption is the one this file has already been burned by: a fuzzy
     * search for a title the source does not host returns a loosely-related
     * stranger, and `title.includes(chapterNumber)` will then happily match
     * chapter 12 OF THE WRONG SERIES and serve it as though it were this one.
     * Silently reading someone else's comic is far worse than a lock screen.
     *
     * The slug is dash-separated and pickByTitle normalises punctuation away,
     * so "solo-leveling" matches "Solo Leveling" without any extra massaging.
     */
    const foundRes = await mpl().search(slug.replace(/-/g, " "));
    const found = pickByTitle(foundRes.results, slug.replace(/-/g, " "));
    if (!found) throw err;

    const rescueInfo = await mpl().fetchMangaInfo(found.id);
    /**
     * Match the chapter NUMBER as a number, not as a substring. `includes("2")`
     * matches "Chapter 12", "Chapter 20" and "Chapter 271" — so the old test
     * could rescue a completely different chapter of the right series.
     */
    const want = String(err.chapterNumber ?? "").trim();
    const rescueChapter = want
      ? rescueInfo.chapters?.find((c) => {
          const n = /chapter\s*([\d.]+)/i.exec(c.title || "")?.[1];
          return !!n && Number(n) === Number(want);
        })
      : undefined;
    if (!rescueChapter) throw err;

    const pages = await mpl().fetchChapterPages(rescueChapter.id).catch(() => [] as IMangaChapterPage[]);
    if (pages.length === 0) throw err;

    console.log(`[manhwa] Rescued locked chapter ${slug} ch ${want} from MangaPill`);
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
 * Merge multiple sources, dropping cross-source duplicates by normalised title.
 *
 * AsuraScans LEADS and the others follow, so the row that survives is the one
 * from the source with the richest metadata (Asura publishes a rating, a
 * status and a real `latest_chapters` feed; the scrapers mostly do not).
 *
 * THE DUPLICATE RATE WENT UP WITH FOUR SOURCES. The same popular series is on
 * Flame, Rizz and Pill simultaneously, so first-wins is doing considerably more
 * work than it was when there were two — and it is still the right rule,
 * because "first" is deliberately ordered best-first by the callers below.
 *
 * TWO REFINEMENTS the three-source world needs:
 *
 *  · A DUPLICATE CAN STILL CONTRIBUTE. When the winner has no cover and the
 *    duplicate does, the cover is adopted. Dropping the row wholesale threw
 *    away the only image we had for that series and left a "No Image" tile
 *    next to three sources that all had art for it. Nothing else is merged —
 *    mixing metadata across sources is how a row starts describing two
 *    different releases.
 *
 *  · UNTITLED ROWS ARE DROPPED, not passed through. A row whose title
 *    normalises to nothing cannot be de-duplicated, cannot be searched, and
 *    renders as a nameless tile; it used to bypass the `seen` check entirely
 *    and accumulate one copy per source per page.
 */
function merge(primary: IMangaResult[], ...secondaries: IMangaResult[][]): IMangaResult[] {
  const seen = new Map<string, IMangaResult>();
  const out: IMangaResult[] = [];

  for (const r of [primary, ...secondaries].flat()) {
    if (!r) continue;
    const k = normTitle(r.title);
    if (!k) continue;

    const kept = seen.get(k);
    if (kept) {
      if (!kept.image && r.image) kept.image = r.image;
      continue;
    }
    seen.set(k, r);
    out.push(r);
  }
  return out;
}

// ── browse / search / home: merge Asura + the three added sources ───────────

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
 * WHAT EACH SOURCE ACTUALLY PUBLISHES — all four measured against the live
 * sites, because this decision is only worth anything if the inputs are real:
 *
 *   AsuraScans   a genuine `meta.total` + `per_page` (339 / 20 browsing, and
 *                it TRACKS the filter — 317 under genres=action). A real total.
 *   FlameComics  no paged listing endpoint at all: /browse is one statically
 *                generated payload of the WHOLE catalogue (166 series). The
 *                adapter slices it locally, so its total is COUNTED from a list
 *                we are holding. A real total.
 *   RizzComics   the same shape — /series/ lists all 87 titles at once and
 *                ignores ?page=. Also counted locally. A real total.
 *   MangaPill    the only one with real server-side paging, and it publishes
 *                NO count: its pager renders a lone "Next" link and no last
 *                page. BLIND, in the sense combineTotals uses.
 *
 * So the answer to "does anything new report a usable total" is: the two that
 * hand over their whole catalogue do, by being counted rather than reported,
 * and the one that genuinely pages does not.
 *
 * `totalItems` is OMITTED regardless. Every source's count describes ITS list,
 * and this router merges them and then throws rows away — `merge` drops
 * cross-source title duplicates, and with four sources carrying many of the
 * same popular series that overlap is now the RULE rather than the exception.
 * Summing them would double-count exactly the titles most likely to be
 * duplicated. An exact-looking number that is wrong is the one thing this must
 * not ship.
 *
 * The PAGE count survives that objection. Our page N is literally each
 * source's page N, so the last page a reader can address is the deepest last
 * page any contributing source has — arithmetic over counted numbers, not an
 * estimate. Filtering cannot change it: dropping rows changes how FULL a page
 * is, never how MANY pages the sources will answer.
 *
 * It ships marked `totalsApproximate` because merging and de-duplicating can
 * leave a page in the tail thin or empty, so the figure is a truthful bound on
 * the paging space rather than a promise that every page in it has something
 * on it — and the client is told which of the two it is holding.
 *
 * WHEN MANGAPILL IS IN THE MIX AND SAYS IT HAS MORE, combineTotals drops the
 * total entirely rather than understating it. That is correct and deliberate:
 * a blind source with more pages means the space is genuinely unbounded as far
 * as we know, and the degraded "pages I can prove" pager is the honest UI.
 * This is why SEARCH usually shows no total while BROWSE does — MangaPill
 * pages on search and contributes only page 1 to browse.
 */
const MANHWA_TOTALS = { approximate: true } as const;

export async function searchManhwa(query: string, page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const asuraOnly = filtersActive(filters);
  const [a, mr, mp, fc, rc] = await Promise.allSettled([
    asura().search(query, page, filters),
    asuraOnly ? Promise.resolve({ currentPage: page, hasNextPage: false, results: [] as IMangaResult[] }) : mrd().search(query, page),
    asuraOnly ? Promise.resolve({ currentPage: page, hasNextPage: false, results: [] as IMangaResult[] }) : mpl().search(query, page),
    asuraOnly ? Promise.resolve({ currentPage: page, hasNextPage: false, results: [] as IMangaResult[] }) : flc().search(query, page),
    asuraOnly ? Promise.resolve({ currentPage: page, hasNextPage: false, results: [] as IMangaResult[] }) : rzc().search(query, page)
  ]);
  const av = settled(a, { currentPage: page, hasNextPage: false, results: [] });
  const mrv = settled(mr, { currentPage: page, hasNextPage: false, results: [] });
  const mpv = settled(mp, { currentPage: page, hasNextPage: false, results: [] });
  const fcv = settled(fc, { currentPage: page, hasNextPage: false, results: [] });
  const rcv = settled(rc, { currentPage: page, hasNextPage: false, results: [] });
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mrv.hasNextPage || mpv.hasNextPage || fcv.hasNextPage || rcv.hasNextPage,
    results: merge(av.results, fcv.results, rcv.results, mpv.results, mrv.results), // Ordered by quality
    ...combineTotals([av, mrv, mpv, fcv, rcv], page, MANHWA_TOTALS),
  };
}

/**
 * BROWSE PAGES CAN COME BACK EMPTY WITHOUT THE CATALOGUE BEING OVER, and this
 * function has to report those two states separately.
 *
 * The four catalogues are different sizes, so they run out at different
 * depths: MangaPill contributes only page 1 (it has no addressable browse
 * listing), Rizz runs out after 87 titles and Flame after 166, while Asura's
 * own `meta.total` carries it to page 17. Past the shallowest, a page is made
 * of fewer and fewer sources, and `merge` then drops cross-source title
 * duplicates on top of that — so a page can arrive thin, or empty, while real
 * results still sit on the pages after it.
 *
 * `hasNextPage` is therefore taken ONLY from the sources' own pagination
 * metadata, never from how many rows survived our merge. An empty page is a
 * page to SKIP, not a wall — the caller is free to ask for the next one, and
 * only `hasNextPage: false` ends the list. (Conflating the two is what
 * produced the old "explore stops around page 25" report.)
 *
 * ONE SOURCE FAILING MUST NOT EMPTY THE PAGE. Every call goes through
 * `Promise.allSettled` and `settled()`, so a rejection becomes an empty
 * envelope for that source and the merge proceeds with whatever the others
 * returned. The adapters back this up by catching their own network errors and
 * returning empty rather than throwing — resilience is the entire point of
 * running four sources, and it only works if a bad one degrades to silence.
 */
export async function browseManhwa(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const empty = { currentPage: page, hasNextPage: false, results: [] as IMangaResult[] };
  const asuraOnly = filtersActive(filters);
  const [a, mp, fc, rc] = await Promise.allSettled([
    asura().getSeries(page, filters),
    asuraOnly ? Promise.resolve(empty) : mpl().getSeries(page, filters),
    asuraOnly ? Promise.resolve(empty) : flc().getSeries(page, filters),
    asuraOnly ? Promise.resolve(empty) : rzc().getSeries(page, filters),
  ]);
  const av = settled(a, empty);
  const mpv = settled(mp, empty);
  const fcv = settled(fc, empty);
  const rcv = settled(rc, empty);
  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || mpv.hasNextPage || fcv.hasNextPage || rcv.hasNextPage,
    results: merge(av.results, fcv.results, rcv.results, mpv.results),
    ...combineTotals([av, mpv, fcv, rcv], page, MANHWA_TOTALS),
  };
}

/** The Asura genre taxonomy, for the explore filter panel. */
export async function asuraGenres(): Promise<{ id: number; name: string; slug: string }[]> {
  return asura().getGenres();
}

export async function manhwaHome(): Promise<{ trending: IMangaResult[]; latestUpdates: IMangaResult[] }> {
  const [ap, al, mpp, mpll, fcp, fcl, rcp, rcl] = await Promise.allSettled([
    asura().getPopularToday(),
    asura().getLatestUpdates(1),
    mpl().getPopularToday(),
    mpl().getLatestUpdates(1),
    flc().getPopularToday(),
    flc().getLatestUpdates(1),
    rzc().getPopularToday(),
    rzc().getLatestUpdates(1),
  ]);
  const emptySearch = { currentPage: 1, hasNextPage: false, results: [] as IMangaResult[] };
  return {
    trending: merge(settled(ap, emptySearch).results, settled(fcp, emptySearch).results, settled(rcp, emptySearch).results, settled(mpp, emptySearch).results),
    latestUpdates: merge(settled(al, emptySearch).results, settled(fcl, emptySearch).results, settled(rcl, emptySearch).results, settled(mpll, emptySearch).results),
  };
}
