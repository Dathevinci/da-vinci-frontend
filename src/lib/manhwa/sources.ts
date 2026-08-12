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
import { ManhwaRow, recencyOf, sortByRecency } from "./recency";
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
function merge(primary: ManhwaRow[], ...secondaries: ManhwaRow[][]): ManhwaRow[] {
  const seen = new Map<string, ManhwaRow>();
  const out: ManhwaRow[] = [];

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

/**
 * The LATEST rail: merge exactly as above, then order NEWEST-FIRST ACROSS
 * SOURCES rather than source-block by source-block.
 *
 * `merge` alone produces Asura's rows, then Flame's, then Rizz's, then Pill's.
 * Even once every source is internally sorted by recency — which, before this
 * fix, two of them were not — the rail still reads as four separate shelves
 * stapled together, so a series Rizz updated last year sat above one Asura
 * published an hour ago simply because Rizz's block came first. The sort is
 * what makes the shelf's label true.
 *
 * SORTING AFTER THE MERGE, NOT BEFORE, IS DELIBERATE. The dedupe rule is
 * "first wins", and the argument order encodes best-metadata-first (Asura
 * leads because it publishes rating, status and a real chapter feed). Sorting
 * first would let whichever source happened to be a second newer decide which
 * copy of a duplicated series survives, and the rail would silently lose
 * Asura's richer rows to a scraper's thinner ones. So: dedupe on quality,
 * order on recency — the two rules stay independent.
 *
 * Cross-source TIMESTAMPS ARE NOT ADOPTED between duplicates, though covers
 * are. A cover is the same picture whichever source served it; a release date
 * is a claim about THAT source's copy, and the sources genuinely disagree —
 * Rizz's newest release is about a year behind Asura's and Flame's. Copying a
 * fresh date onto a stale row, or the reverse, would manufacture a fact
 * neither source stated.
 */
function mergeLatest(primary: ManhwaRow[], ...secondaries: ManhwaRow[][]): ManhwaRow[] {
  return sortByRecency(merge(primary, ...secondaries));
}

/**
 * Give AsuraScans' rows the same `updatedAt` the other three now carry.
 *
 * Asura already ships the answer on every row — `latest_chapters[].published_at`
 * — and `src/lib/asura` is intentionally left untouched by this fix, so the
 * derivation lives here. Verified live that the newest `published_at` equals
 * the API's own `last_chapter_at` on all 20 rows of page 1, and that
 * `series?offset=0` is already ordered by it, so this reads Asura's own sort
 * key rather than inventing a competing one.
 *
 * Rows are mutated in place; they are built fresh per request by the parser.
 */
function withAsuraRecency(rows: ManhwaRow[]): ManhwaRow[] {
  for (const r of rows) {
    if (!r || r.updatedAt) continue;
    const ms = recencyOf(r);
    if (ms > 0) r.updatedAt = new Date(ms).toISOString();
  }
  return rows;
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
/**
 * BROWSE PAGES THE WHOLE LIBRARY, NOT EACH SOURCE IN LOCKSTEP.
 *
 * The old shape asked every source for ITS page N and merged the four answers.
 * Two things fell out of that, both reported:
 *
 *  1. IT STOPPED AT 17. The sources have wildly different depths — Asura 17
 *     pages, Flame ~8, Rizz ~5 — so once the deepest one ran out, everything
 *     ran out. Page 18 was empty even though hundreds of series had never been
 *     shown. (Measured live: page 17 returned 19 rows, all Asura; page 18, none.)
 *  2. THE PAGES SLID. Page 1 carried ~106 rows (four sources answering) and
 *     page 17 carried 19 (one source left), because "a page" meant "whatever
 *     four independent catalogues happened to hand back".
 *
 * So the four catalogues are treated as ONE corpus, consumed round-robin and
 * cut into fixed-size pages. Deeper pages simply keep pulling from whichever
 * sources still have rows, and the corpus is reachable to its end.
 *
 * IT FILLS LAZILY. Serving page 1 pulls one round; page 20 pulls until it has
 * 20 pages' worth, and everything fetched is cached — so the common case stays
 * as cheap as it was and only deep paging pays. The cursor cache is keyed by
 * the active filters, because a filtered browse is a different corpus.
 */
const MANHWA_PAGE_SIZE = 24;
const CORPUS_TTL = 5 * 60 * 1000;
/**
 * Wall-clock ceiling on ONE fill. A cold corpus asked for a deep page walks the
 * catalogues a round at a time, and rounds are sequential — without a clock the
 * only brake is the round guard, which is 60 rounds of upstream scraping and
 * comfortably longer than the platform will let the request live. Stopping
 * early is safe: the state is cached, so the next request resumes the walk.
 */
const CORPUS_FILL_BUDGET_MS = 8_000;
/**
 * How many distinct filter corpora to hold. The cache is keyed by the caller's
 * filters, which come from query params, so the key space is as wide as the
 * filter panel (and anything else that can be typed into the URL). Each entry
 * can hold hundreds of fully-hydrated rows and module state outlives the
 * request, so it needs a ceiling as well as a TTL.
 */
const CORPUS_MAX_KEYS = 24;

/**
 * WHY A SOURCE STOPPED — the distinction the page count depends on.
 *
 * "It ran out" and "it broke" are different facts, and collapsing them into one
 * boolean is what lets a timeout be published as a library size. Only `spent`
 * means the catalogue actually ended; `failed` is a source we should ask again
 * on the next request, and must never be counted as evidence of the end.
 */
type SourceStatus = "live" | "spent" | "failed";

type CorpusState = {
  at: number;
  rows: ManhwaRow[];
  /** Next page to ask each source for; frozen once that source is not live. */
  cursors: number[];
  status: SourceStatus[];
};

const corpusCache = new Map<string, CorpusState>();
/**
 * The fill currently running for a key, so concurrent readers SHARE it.
 *
 * Without this, two requests for the same key interleave inside one mutable
 * CorpusState: both read the same cursors, both fetch the same upstream page,
 * and both then advance the cursor — so the cursor moves twice for one page
 * consumed and the pages in between are never fetched by anyone. Those series
 * are missing from every page of the browse until the TTL rebuilds the corpus.
 * The loser of the race also breaks out on the no-growth check (its whole round
 * was duplicates), returning a corpus shorter than asked for, which serves an
 * empty grid on a page that has rows.
 */
const corpusFills = new Map<string, Promise<CorpusState>>();

/** Drop expired corpora, then the oldest ones, so the Map cannot grow forever. */
function evictCorpora(now: number): void {
  for (const [k, v] of corpusCache) if (now - v.at > CORPUS_TTL) corpusCache.delete(k);
  while (corpusCache.size > CORPUS_MAX_KEYS) {
    let oldest: string | undefined;
    let oldestAt = Infinity;
    for (const [k, v] of corpusCache) if (v.at < oldestAt) [oldestAt, oldest] = [v.at, k];
    if (!oldest) break;
    corpusCache.delete(oldest);
  }
}

/**
 * Grow the merged corpus until it holds `need` rows or every source is spent.
 *
 * ONE FILL PER KEY AT A TIME. A caller that arrives while a fill is running
 * waits for it instead of racing it, and only starts its own if that fill
 * stopped short of what this caller needs. The hop limit bounds the wait: after
 * a few handoffs we do the work ourselves rather than queue behind strangers.
 */
async function fillCorpus(key: string, need: number, filters: any, asuraOnly: boolean): Promise<CorpusState> {
  for (let hop = 0; hop < 4; hop++) {
    const running = corpusFills.get(key);
    if (!running) break;
    const state = await running.catch(() => undefined);
    if (!state) break;
    if (state.rows.length >= need || !state.status.includes("live")) return state;
  }

  const run = growCorpus(key, need, filters, asuraOnly);
  corpusFills.set(key, run);
  try {
    return await run;
  } finally {
    if (corpusFills.get(key) === run) corpusFills.delete(key);
  }
}

/**
 * The actual walk. Only ever called with the single-flight guard above held.
 *
 * Round-robin rather than source-by-source so early pages stay MIXED — reading
 * one catalogue to its end before starting the next would make page 1 pure
 * Asura and bury the new sources a dozen pages deep.
 */
async function growCorpus(key: string, need: number, filters: any, asuraOnly: boolean): Promise<CorpusState> {
  const now = Date.now();
  evictCorpora(now);

  let cached = corpusCache.get(key);
  if (!cached || now - cached.at > CORPUS_TTL) {
    cached = {
      at: now,
      rows: [],
      cursors: [1, 1, 1, 1],
      status: ["live", asuraOnly ? "spent" : "live", asuraOnly ? "spent" : "live", asuraOnly ? "spent" : "live"],
    };
    corpusCache.set(key, cached);
  }
  const state = cached;

  // A NEW REQUEST IS A NEW CHANCE for a source that merely broke. Within one
  // fill a failure retires the source, so we don't hammer a dead scraper round
  // after round; across requests it gets asked again, so one timeout can't
  // remove a whole catalogue for the rest of the TTL.
  for (let i = 0; i < state.status.length; i++) if (state.status[i] === "failed") state.status[i] = "live";

  const deadline = now + CORPUS_FILL_BUDGET_MS;
  const empty = { currentPage: 0, hasNextPage: false, results: [] as ManhwaRow[] };

  // Hard stop on rounds as well as on rows: a source that keeps promising a
  // next page forever must not spin this loop.
  for (let guard = 0; guard < 60 && state.rows.length < need && state.status.includes("live"); guard++) {
    if (Date.now() > deadline) break;

    // The pages we are about to consume. The cursor is advanced FROM THIS
    // SNAPSHOT rather than by incrementing whatever it holds when the round
    // resolves, so the write can never count a page nobody read.
    const dispatched = state.cursors.slice();
    const fetchers = [
      () => asura().getSeries(dispatched[0], filters),
      () => mpl().getSeries(dispatched[1], filters),
      () => flc().getSeries(dispatched[2], filters),
      () => rzc().getSeries(dispatched[3], filters),
    ];
    const settledRounds = await Promise.allSettled(
      fetchers.map((f, i) => (state.status[i] === "live" ? f() : Promise.resolve(empty)))
    );

    const batches: ManhwaRow[][] = [];
    settledRounds.forEach((r, i) => {
      if (state.status[i] !== "live") return;
      if (r.status === "rejected") {
        state.status[i] = "failed";
        return;
      }
      const v = settled(r, empty);
      batches[i] = v.results || [];

      if (batches[i].length === 0) {
        // Nothing came back. If the source ALSO says there is more, it
        // contradicted itself — a rate limit or a shape change, not an ending.
        state.status[i] = v.hasNextPage ? "failed" : "spent";
        return;
      }
      // Rows arrived, so keep them either way; a source on its true last page
      // contributes that page and then retires.
      if (!v.hasNextPage) state.status[i] = "spent";
      else state.cursors[i] = dispatched[i] + 1;
    });

    const before = state.rows.length;
    state.rows = merge(state.rows, batches[0] || [], batches[2] || [], batches[3] || [], batches[1] || []);
    if (state.rows.length === before) {
      // Nothing new survived the cross-source dedupe. Every source still in
      // play is repeating what we already hold, so the corpus cannot grow —
      // that IS exhaustion, and recording it as such is what stops the caller
      // from asking again forever.
      for (let i = 0; i < state.status.length; i++) if (state.status[i] === "live") state.status[i] = "spent";
      break;
    }
  }

  return state;
}

export async function browseManhwa(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const asuraOnly = filtersActive(filters);
  const key = `${asuraOnly ? "asura" : "all"}:${JSON.stringify(filters || {})}`;
  const start = (Math.max(1, page) - 1) * MANHWA_PAGE_SIZE;
  const end = start + MANHWA_PAGE_SIZE;

  const state = await fillCorpus(key, end + 1, filters, asuraOnly);
  const results = state.rows.slice(start, end);

  /**
   * A COUNT ONLY ONCE EVERY CATALOGUE IS SPENT — never while filling.
   *
   * The corpus grows lazily, so `rows.length` early on measures HOW MUCH WE
   * HAVE FETCHED, not how much exists. Dividing it by the page size and calling
   * that a total published "4 pages" on page 1 of a library that ends at 20 —
   * a tighter false ceiling than the 17-page one this rewrite set out to remove,
   * and it would have shrunk the further back the reader started.
   *
   * It is also the exact pair `explorePaging.ts` forbids: a stated total next to
   * hasNextPage true makes the pager and the scroller contradict each other, and
   * the pager believes the total (see resolvePagerBounds) — so Next would have
   * gone dead at 4 while rows kept coming.
   *
   * So while any source can still grow the corpus we report NO total and let the
   * pager say the end isn't known yet. When they are all spent the corpus IS the
   * library: the count is then exact — deduping happened before the slicing, so
   * every page but the last is full — and needs no approximate hedge.
   *
   * COMPLETE MEANS EVERY SOURCE *ENDED*, NOT MERELY STOPPED. A source that threw
   * is `failed`, never `spent`, so it cannot make the corpus look finished. That
   * distinction is the whole point: treating a timeout as an ending would print
   * an exact page count over a library missing a catalogue — and cache it for
   * the TTL. In the worst case, one bad first round would have published
   * "Page 1 of 1" over an empty grid and stood by it for five minutes.
   */
  const complete = state.status.every((s) => s === "spent");
  const more = state.rows.length > end || !complete;

  return {
    currentPage: page,
    hasNextPage: more,
    results,
    ...(complete
      ? { totalPages: Math.max(1, Math.ceil(state.rows.length / MANHWA_PAGE_SIZE)) }
      : {}),
  } as ISearch<IMangaResult>;
}

/** The Asura genre taxonomy, for the explore filter panel. */
export async function asuraGenres(): Promise<{ id: number; name: string; slug: string }[]> {
  return asura().getGenres();
}

/**
 * THE TWO HOME RAILS, and the two questions they are NOT allowed to confuse.
 *
 * TRENDING asks "what is popular", LATEST asks "what changed recently". The
 * owner's report — old series showing up in Recently Updated — was three
 * separate versions of one source answering the wrong question:
 *
 *  1. FlameComics.getLatestUpdates returned `catalogue()`: all 166 series in
 *     /browse's ALPHABETICAL order. It now reads the home page's own Latest
 *     block, which carries a per-series `chapters[].release_date`.
 *  2. RizzComics.getLatestUpdates returned `catalogue()` too: 88 series from
 *     /series/. It now reads the home page's `.utao` "Latest Update" shelf,
 *     which carries a per-chapter epoch timestamp.
 *  3. RizzComics.parseCards matched `.bsx, .utao` together, so TRENDING was
 *     served 8 popular cards followed by 7 latest-update ones. `.bsx` is the
 *     popular grid and `.utao` the latest listing — verified, not assumed —
 *     and they are now parsed separately and routed to the rail each belongs
 *     to.
 *
 * AND THEN THE RAIL IS SORTED. Even with all four sources internally correct,
 * `merge` concatenates them, so the shelf was Asura-then-Flame-then-Rizz-then-
 * Pill. `mergeLatest` orders it newest-first across every source.
 *
 * THE REQUEST BUDGET DID NOT GROW. Both new sources serve BOTH of their rails
 * from a single cached fetch of their home page, so per render: Asura 2 (its
 * popular and browse endpoints differ), MangaPill 2 (`/` and `/chapters`),
 * Flame 1 (`/`, down from `/browse` and ~3x smaller), Rizz 1 (`/`, DOWN from
 * two — it used to fetch `/` for popular and `/series/` for latest). Nothing is
 * fetched per card.
 *
 * ONE SOURCE FAILING STILL CANNOT EMPTY EITHER RAIL: every call goes through
 * allSettled and `settled()`, and the adapters catch their own network errors
 * and return empty. A source that returns nothing now contributes nothing —
 * which is the point. It no longer contributes its back catalogue instead.
 */
export async function manhwaHome(): Promise<{ trending: ManhwaRow[]; latestUpdates: ManhwaRow[] }> {
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
  const emptySearch = { currentPage: 1, hasNextPage: false, results: [] as ManhwaRow[] };
  return {
    trending: merge(settled(ap, emptySearch).results, settled(fcp, emptySearch).results, settled(rcp, emptySearch).results, settled(mpp, emptySearch).results),
    latestUpdates: mergeLatest(
      withAsuraRecency(settled(al, emptySearch).results),
      settled(fcl, emptySearch).results,
      settled(rcl, emptySearch).results,
      settled(mpll, emptySearch).results
    ),
  };
}
