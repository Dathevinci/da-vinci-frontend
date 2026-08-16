// Manhwa source router — dispatches by id prefix, mirroring the novels'
// src/lib/novel/sources.ts. AsuraScans ids stay BARE (back-compat with every
// existing bookmark / reading-progress key), and any other source carries a
// three-letter prefix. The frontend treats ids as opaque.
//
// ASURASCANS IS CURRENTLY THE ONLY SOURCE. FlameComics, RizzComics, MangaPill
// and the MangaRead rescue parser were all removed at the owner's request on
// 2026-08-13. Each had earned its way off:
//
//   FlameComics  Cloudflare answers Vercel with 403 + cf-mitigated=challenge,
//                so it returned ZERO rows in production while working fine
//                from a home connection. Unfixable without defeating a bot
//                challenge.
//   RizzComics   roughly a year stale — its newest chapter predated the live
//                server date by about that much.
//   MangaPill    contributed nothing to explore (it serves one page, which
//                then deduped against Asura) and only filler to the rails.
//   MangaRead    a rescue parser that twice substituted a DIFFERENT series'
//                shorter chapter list for a real one.
//
// THE MERGE MACHINERY IS DELIBERATELY LEFT IN PLACE even though one source
// cannot merge with anything. It is what makes adding a source a matter of
// registering it rather than rebuilding browse, search and the rails — and
// VortexScans has already been verified end-to-end from production (browse,
// chapter list, and a real 2MB page image all served to Vercel), so a second
// source is a live possibility rather than a hypothetical.
//
// THE ID SHAPES, which are persisted and therefore frozen:
//   <slug>                  AsuraScans      chapters "<slug>|<number>"
//
// Bookmarks and reading-progress keys embed these verbatim
// (`dv-progress:<owner>:manhwa:<id>`), so a change of SHAPE orphans existing
// rows. Add sources by adding a prefix; never by re-shaping an existing one.
//
// Rows saved under a REMOVED prefix (flc:, rzc:, mpl:, mrd:, mna:) still exist
// in people's libraries. adapterFor throws a named error for them, which the
// API surfaces as a readable sentence rather than a bare "Series Not Found" —
// see the note there.

import { AsuraScans } from "@/lib/asura";
import { IMangaResult, IMangaInfo, IMangaChapterPage, ISearch } from "@/lib/asura/models";
import { ManhwaRow, recencyOf, sortByRecency } from "./recency";
import VortexScans from "./VortexScans";
import Manganato from "./Manganato";
import Mangasee from "./Mangasee";
import WeebCentral from "./WeebCentral";

const asura = () => new AsuraScans();
const wbc = () => new WeebCentral();
const vtx = () => new VortexScans();
const mna = () => new Manganato();
const mse = () => new Mangasee();

// ── single-item lookups: route by prefix ────────────────────────────────────

/**
 * Every prefix this app can resolve, and the adapter that owns it.
 */
const ADAPTERS: Record<string, () => any> = {
  "wbc:": wbc,
  "vtx:": vtx,
  "mna:": mna,
  "mse:": mse,
};

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

import { getManhwaBanner } from "@/lib/anilist";

export async function getManhwaInfo(id: string): Promise<IMangaInfo> {
  const make = adapterFor(id);
  const info: IMangaInfo = make ? await make().fetchMangaInfo(id) : await asura().fetchMangaInfo(id);
  if (info && info.title && !info.bannerImage) {
    try {
      const banner = await getManhwaBanner(info.title);
      if (banner) info.bannerImage = banner;
    } catch {}
  }
  return info;
}

/**
 * Pages for one chapter.
 */
export async function getChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
  const make = adapterFor(chapterId);
  if (make) return make().fetchChapterPages(chapterId);
  return asura().fetchChapterPages(chapterId);
}

/*
 * THE TWO RESCUE PATHS THAT USED TO LIVE HERE ARE GONE WITH THEIR SOURCES.
 *
 * One refilled an empty chapter list from MangaRead; the other served a
 * paywalled Asura chapter from MangaPill. Both are unreachable now that
 * neither source ships, and both were historically dangerous in the same way:
 * a fuzzy search on a title the source does not host returns a loosely-related
 * STRANGER, and each rescue had already been caught serving a different
 * series' chapters as though they were this one.
 *
 * If a rescue source is ever added back, the two guards those paths ended up
 * with are the price of entry: never rescue a TRANSIENT failure (an empty list
 * because one request failed is not an empty list), and never accept a match
 * that is not a normalised exact/prefix title match.
 */

// ── merge helpers ────────────────────────────────────────────────────────────

const settled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback;

const normTitle = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");




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


export async function searchManhwa(query: string, page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const [a, w, v, s, m] = await Promise.allSettled([
    asura().search(query, page, filters),
    wbc().search(query, page),
    vtx().search(query, page),
    mse().search(query, page),
    mna().search(query, page),
  ]);
  const emptyRes = { currentPage: page, hasNextPage: false, results: [] as ManhwaRow[] };
  const av = settled(a, emptyRes as any);
  const wv = settled(w, emptyRes);
  const vv = settled(v, emptyRes);
  const sv = settled(s, emptyRes);
  const mv = settled(m, emptyRes);

  return {
    currentPage: page,
    hasNextPage: av.hasNextPage || wv.hasNextPage || vv.hasNextPage || sv.hasNextPage || mv.hasNextPage,
    // Asura leads, followed by WeebCentral, Vortex, Mangasee, and Manganato
    results: merge(av.results as ManhwaRow[], wv.results, vv.results, sv.results, mv.results),
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
async function fillCorpus(key: string, need: number, filters: any): Promise<CorpusState> {
  for (let hop = 0; hop < 4; hop++) {
    const running = corpusFills.get(key);
    if (!running) break;
    const state = await running.catch(() => undefined);
    if (!state) break;
    if (state.rows.length >= need || !state.status.includes("live")) return state;
  }

  const run = growCorpus(key, need, filters);
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
async function growCorpus(key: string, need: number, filters: any): Promise<CorpusState> {
  const now = Date.now();
  evictCorpora(now);

  let cached = corpusCache.get(key);
  if (!cached || now - cached.at > CORPUS_TTL) {
    cached = {
      at: now,
      rows: [],
      // ONE ENTRY PER SOURCE, and the arrays must stay the same length as the
      // fetcher list below — they are indexed together. Adding a source means
      // adding a cursor, a status, and a fetcher, in step.
      cursors: [1, 1, 1, 1, 1],
      status: ["live", "live", "live", "live", "live"],
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
      () => wbc().fetchLatestUpdates(dispatched[1]),
      () => vtx().getSeries(dispatched[2], filters),
      () => mse().getLatestUpdates(dispatched[3]),
      () => mna().getLatestUpdates(dispatched[4]),
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
    state.rows = merge(state.rows, batches[0] || [], batches[1] || [], batches[2] || [], batches[3] || [], batches[4] || []);
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
  // Keyed by the filters alone. The key used to carry an "is this a
  // filtered, Asura-only browse" flag as well, because filters switched the
  // other sources off — with one source that distinction no longer exists,
  // and leaving it in would imply a difference that cannot occur.
  const key = JSON.stringify(filters || {});
  const start = (Math.max(1, page) - 1) * MANHWA_PAGE_SIZE;
  const end = start + MANHWA_PAGE_SIZE;

  const state = await fillCorpus(key, end + 1, filters);
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
  const [ap, al, wp, wl, vp, vl, sp, sl, mp, ml] = await Promise.allSettled([
    asura().getPopularToday(),
    asura().getLatestUpdates(1),
    wbc().fetchLatestUpdates(1),
    wbc().fetchLatestUpdates(1),
    vtx().getPopularToday(),
    vtx().getLatestUpdates(1),
    mse().getPopularToday(),
    mse().getLatestUpdates(1),
    mna().getPopularToday(),
    mna().getLatestUpdates(1),
  ]);
  const emptySearch = { currentPage: 1, hasNextPage: false, results: [] as ManhwaRow[] };

  const asuraPop = settled(ap, emptySearch).results;
  const asuraLat = settled(al, emptySearch).results;
  const weebPop = settled(wp, emptySearch).results;
  const weebLat = settled(wl, emptySearch).results;
  const vtxPop = settled(vp, emptySearch).results;
  const vtxLat = settled(vl, emptySearch).results;
  const seePop = settled(sp, emptySearch).results;
  const seeLat = settled(sl, emptySearch).results;
  const natoPop = settled(mp, emptySearch).results;
  const natoLat = settled(ml, emptySearch).results;

  return {
    trending: merge(asuraPop, weebPop, vtxPop, seePop, natoPop),
    latestUpdates: mergeLatest(
      withAsuraRecency(asuraLat),
      weebLat,
      vtxLat,
      seeLat,
      natoLat
    ),
  };
}
