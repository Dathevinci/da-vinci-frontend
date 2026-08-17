// Manhwa source router — dispatches by id prefix, mirroring the novels'
// src/lib/novel/sources.ts. AsuraScans ids stay BARE (back-compat with every
// existing bookmark / reading-progress key), and any other source carries a
// three-letter prefix. The frontend treats ids as opaque.
//
// FIVE SOURCES ARE LIVE: AsuraScans (bare ids) plus WeebCentral (wbc:),
// VortexScans (vtx:), Manganato (mna:) and Mangasee (mse:). All four prefixes
// are registered in ADAPTERS below, and every fan-out — searchManhwa, the
// corpus fetchers (fillCorpus/growCorpus), browseManhwa's per-source branches
// and manhwaHome — queries all five. None of this is dead code: the merge
// machinery (corpus, dedupe, per-source paging) is load-bearing for every
// prefixed source, and "simplifying" a merge path away ships broken under
// ignoreBuildErrors.
//
// The roster has churned before, which is why adapters come and go by
// registration rather than by rebuilding browse/search/rails. FlameComics,
// RizzComics, MangaPill and the MangaRead rescue parser were removed at the
// owner's request on 2026-08-13. Each had earned its way off:
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
// THE ID SHAPES, which are persisted and therefore frozen:
//   <slug>                  AsuraScans      chapters "<slug>|<number>"
//   wbc:<rest>              WeebCentral     remainder owned by the adapter
//   vtx:<rest>              VortexScans     remainder owned by the adapter
//   mna:<rest>              Manganato       remainder owned by the adapter
//   mse:<rest>              Mangasee        remainder owned by the adapter
//
// Bookmarks and reading-progress keys embed these verbatim
// (`dv-progress:<owner>:manhwa:<id>`), so a change of SHAPE orphans existing
// rows. Add sources by adding a prefix; never by re-shaping an existing one.
//
// Rows saved under a REMOVED prefix (flc:, rzc:, mpl:, mrd:) still exist
// in people's libraries. adapterFor throws a named error for them, which the
// API surfaces as a readable sentence rather than a bare "Series Not Found" —
// see the note there.

import { AsuraScans } from "@/lib/asura";
import { IMangaResult, IMangaInfo, IMangaChapter, IMangaChapterPage, ISearch } from "@/lib/asura/models";
import { manhwaSourceLabel } from "./ids";
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

// ── locked-chapter rescue ────────────────────────────────────────────────────

export interface ChapterPagesResult {
  pages: IMangaChapterPage[];
  /** Label of the donor source the pages actually came from. */
  rescuedFrom?: string;
  /** Label of the source the chapter is locked on — set whenever the lock is
   *  proven, so the reader's wall can name it even when no donor came through. */
  lockedOn?: string;
  /** The moment the primary reopens the chapter, when it says (Asura does). */
  unlockTime?: string;
  /** True only when at least one donor ANSWERED (a timed-out probe is not an
   *  answer) — the wall's "we checked our other sources" may only cite this. */
  donorsChecked?: boolean;
}

/**
 * A RESCUE SOURCE, ADDED BACK — paying the fence's price of entry above.
 *
 * Asura and Vortex both sell early access: the newest chapter of a running
 * series is coin-locked for hours or days while the aggregators often already
 * carry it. The reader used to click a listed chapter and hit a wall that
 * said, truthfully, "locked" — while the same chapter sat readable one source
 * over. This asks the donors before showing the wall.
 *
 * Guard #1 — NEVER RESCUE A TRANSIENT FAILURE. A rescue happens only when the
 * lock is PROVEN: either the primary's pages endpoint said so itself (Asura's
 * decorated error), or the primary's own chapter list flags the chapter
 * locked. Anything else — network error, empty answer, unknown series — is
 * rethrown or returned exactly as before; a scraper hiccup must read as a
 * hiccup, not silently serve another site's bytes.
 *
 * Guard #2 — NEVER ACCEPT A STRANGER. Donor series are accepted on normalised
 * EXACT title equality only, verified on the donor's own detail answer even
 * when a slug guess landed (Manganato mirrors Asura/Vortex kebab slugs for
 * most series — probed 7/8 — but a colliding slug must not pass; Manganato's
 * info fetch even has a fuzzy first-result search fallback inside it, which
 * this equality check is what defuses). The old fuzzy rescue served a
 * different series' chapters as though they were this one; exact-or-nothing
 * is the lesson.
 *
 * Chapters match by NUMBER, dashed sub-chapters normalised ("chapter-188-5"
 * is 188.5 — plain chapterNumberFromId truncates it to 188, which would pair
 * a sub-chapter with its parent). Donor answers are cached ten minutes per
 * series so a locked chapter binge doesn't re-search the donor every click.
 *
 * Survey at build time (Asura front page): 5 series had a locked newest
 * chapter; Manganato already carried 1 of them (verified to real image
 * bytes). That is the honest expectation — the rescue is opportunistic, and
 * the wall stays for the rest. Manganato itself locks nothing, so it never
 * rescues, only donates.
 */
const RESCUE_TTL_MS = 10 * 60 * 1000;
/**
 * Wall-clock ceiling for the whole donor phase — the corpus fill carries a
 * budget for the same reason: these adapters retry through proxies for up to
 * a minute EACH, and a reader staring at a spinner is worse than a wall. A
 * donor that cannot answer inside the budget is treated as unknown, not "no".
 */
const RESCUE_DONOR_BUDGET_MS = 12_000;
const donorInfoCache = new Map<string, { at: number; info: IMangaInfo | null }>();
/** Single-flight per donor:series — N readers clicking the same locked
 *  chapter must share one probe, not run N outage-priced ones. */
const donorInfoInflight = new Map<string, Promise<IMangaInfo | null>>();

/** TTL sweep + hard cap on write, same reasoning as evictCorpora: these
 *  processes live long (paid tiers, no cold starts) and every entry holds a
 *  full chapter list. Insertion order stands in for age. */
function rememberDonorInfo(key: string, info: IMangaInfo | null) {
  const now = Date.now();
  for (const [k, v] of donorInfoCache) {
    if (now - v.at > RESCUE_TTL_MS) donorInfoCache.delete(k);
  }
  while (donorInfoCache.size >= 300) {
    const oldest = donorInfoCache.keys().next().value;
    if (oldest == null) break;
    donorInfoCache.delete(oldest);
  }
  donorInfoCache.set(key, { at: now, info });
}

/**
 * "chapter-188-5" → 188.5, "slug|62.5" → 62.5, "Chapter 62" → 62.
 * Only the segment AFTER the pipe is read on piped ids — a series slug that
 * itself contains "chapter-3" must never outvote the chapter's own segment.
 */
function chapterNumberForMatch(raw: string | null | undefined): number | null {
  const s = String(raw || "");
  const target = (s.includes("|") ? s.split("|")[1] : s).trim();
  const direct = /^(\d+)(?:\.(\d+))?$/.exec(target);
  if (direct) return Number(direct[2] != null ? `${direct[1]}.${direct[2]}` : direct[1]);
  const named = /chapter[-_\s]*(\d+)(?:[-.](\d+))?/i.exec(target);
  if (named) return Number(named[2] != null ? `${named[1]}.${named[2]}` : named[1]);
  return null;
}

function chapterNumberOf(c: IMangaChapter): number | null {
  // Manganato writes 0 as its "couldn't parse" sentinel, so 0 falls through
  // to id/title parsing (where a real chapter-0 prologue still resolves).
  const n = (c as any).chapterNumber;
  if (Number.isFinite(n) && n > 0) return n;
  return chapterNumberForMatch(c.id) ?? chapterNumberForMatch(c.title);
}

type RescuePrimary = { src: "asura" | "vtx"; seriesId: string; slug: string };

/** The sources with a lock economy. Every other prefix passes through. */
function rescuePrimaryOf(chapterId: string): RescuePrimary | null {
  const raw = String(chapterId || "");
  if (raw.startsWith("vtx:")) {
    const slug = raw.slice(4).split("|")[0];
    return slug ? { src: "vtx", seriesId: `vtx:${slug}`, slug } : null;
  }
  if (PREFIX_RE.test(raw)) return null;
  const slug = raw.split("|")[0];
  return slug ? { src: "asura", seriesId: slug, slug } : null;
}

async function donorSeriesInfo(
  donor: "mna" | "asura" | "vtx",
  primary: RescuePrimary,
  title: string
): Promise<IMangaInfo | null> {
  const key = `${donor}:${primary.src}:${primary.slug}`;
  const hit = donorInfoCache.get(key);
  if (hit && Date.now() - hit.at < RESCUE_TTL_MS) return hit.info;
  const running = donorInfoInflight.get(key);
  if (running) return running;

  const work = (async () => {
    let info: IMangaInfo | null = null;
    try {
      const want = normTitle(title);
      if (want) {
        if (donor === "mna") {
          const guess = await mna().fetchMangaInfo(`mna:${primary.slug}`);
          /**
           * Guard #2 needs donor-AUTHORED evidence. Manganato's info fetch
           * falls back to spacing out the slug when its <h1> parse misses —
           * and since the primary slug IS the kebab of the primary title,
           * comparing that fallback to the title passes BY CONSTRUCTION,
           * verifying nothing. titleFromPage certifies the string was read
           * off Manganato's own page; without it the slug guess is unproven
           * and the donor is declined.
           */
          if (
            (guess as any)?.titleFromPage === true &&
            guess?.title && normTitle(guess.title) === want &&
            (guess.chapters?.length || 0) > 0
          ) {
            info = guess;
          }
        } else {
          const make = donor === "asura" ? asura : vtx;
          const found = await make().search(title);
          const row = (found?.results || []).find((r: any) => normTitle(r.title) === want);
          if (row) {
            const full = await make().fetchMangaInfo(row.id);
            if (full?.title && normTitle(full.title) === want) info = full;
          }
        }
      }
    } catch {
      info = null;
    }
    rememberDonorInfo(key, info);
    return info;
  })();

  donorInfoInflight.set(key, work);
  try {
    return await work;
  } finally {
    donorInfoInflight.delete(key);
  }
}

export async function getChapterPagesRescued(chapterId: string): Promise<ChapterPagesResult> {
  let primaryErr: unknown = null;
  try {
    const pages = await getChapterPages(chapterId);
    if (pages.length > 0) return { pages };
  } catch (e) {
    primaryErr = e;
  }

  const primary = rescuePrimaryOf(chapterId);
  if (!primary) {
    if (primaryErr) throw primaryErr;
    return { pages: [] };
  }

  // Prove the lock (guard #1). The primary's own chapter list is the referee;
  // Asura's decorated pages error corroborates and brings unlock_time.
  let info: IMangaInfo | null = null;
  try {
    const make = adapterFor(primary.seriesId);
    info = make ? await make().fetchMangaInfo(primary.seriesId) : await asura().fetchMangaInfo(primary.seriesId);
  } catch {
    info = null;
  }
  const chap = info?.chapters?.find((c) => c.id === chapterId);
  const errSaysLocked = !!(primaryErr as any)?.isLocked;
  if (!chap?.isLocked && !errSaysLocked) {
    if (primaryErr) throw primaryErr;
    return { pages: [] };
  }

  const lockedOn = manhwaSourceLabel(chapterId);
  const unlockTime = (primaryErr as any)?.unlockTime || chap?.earlyAccessUntil || undefined;
  const num = chapterNumberForMatch(chapterId) ?? (chap ? chapterNumberOf(chap) : null);
  const title = info?.title || "";
  if (num == null || !title) return { pages: [], lockedOn, unlockTime };

  const donors: Array<"mna" | "asura" | "vtx"> = primary.src === "asura" ? ["mna", "vtx"] : ["mna", "asura"];
  const deadline = Date.now() + RESCUE_DONOR_BUDGET_MS;
  const timedOut = { timedOut: true } as const;
  let donorsChecked = false;
  for (const donor of donors) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const attempt = (async () => {
        const donorInfo = await donorSeriesInfo(donor, primary, title);
        const dChap = donorInfo?.chapters?.find((c) => !c.isLocked && chapterNumberOf(c) === num);
        if (!dChap) return null;
        const pages = await getChapterPages(dChap.id);
        return pages.length > 0 ? { pages, label: manhwaSourceLabel(dChap.id) } : null;
      })();
      const won = await Promise.race([
        attempt,
        new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), remaining)),
      ]);
      // A timeout is NOT an answer — the wall must not claim this donor was
      // checked. The probe keeps running behind the single-flight map, so its
      // eventual result still lands in the cache for the next click.
      if (won === timedOut) break;
      donorsChecked = true;
      if (won) {
        return { pages: won.pages, rescuedFrom: won.label, lockedOn, unlockTime, donorsChecked: true };
      }
    } catch {
      /* a failing donor must never take down the wall */
    }
  }
  return { pages: [], lockedOn, unlockTime, donorsChecked };
}

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
  const src = (filters?.source || "").toLowerCase().trim();
  if (src === "wbc" || src === "weebcentral") {
    return wbc().search(query, page);
  }
  if (src === "vtx" || src === "vortex" || src === "vortexscans") {
    return vtx().search(query, page);
  }
  if (src === "asura" || src === "asurascans") {
    return asura().search(query, page, filters);
  }
  if (src === "mse" || src === "mangasee") {
    return mse().search(query, page);
  }
  if (src === "mna" || src === "manganato") {
    return mna().search(query, page);
  }

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
      () => wbc().getSeries(dispatched[1], filters),
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
      const anyBatchHasRows = batches.some((b) => b && b.length > 0);
      if (!anyBatchHasRows) {
        for (let i = 0; i < state.status.length; i++) if (state.status[i] === "live") state.status[i] = "spent";
        break;
      }
    }
  }

  return state;
}

export async function browseManhwa(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
  const src = (filters?.source || "").toLowerCase().trim();
  if (src === "wbc" || src === "weebcentral") {
    return wbc().getSeries(page, filters);
  }
  if (src === "vtx" || src === "vortex" || src === "vortexscans") {
    return vtx().getSeries(page, filters);
  }
  if (src === "asura" || src === "asurascans") {
    return asura().getSeries(page, filters);
  }
  if (src === "mse" || src === "mangasee") {
    return mse().getLatestUpdates(page);
  }
  if (src === "mna" || src === "manganato") {
    return mna().getLatestUpdates(page);
  }

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
/**
 * LATEST-CHAPTER LABELS FOR WEEBCENTRAL ROWS. Its listing markup carries no
 * chapter information at all, so every wbc card on the home rails printed
 * "Chapter ?" — which reads as breakage, and was reported as such. The label
 * costs one request per series (full-chapter-list), so the pass is bounded on
 * every axis: cache first (30-min TTL, capped), at most 16 fetches per pass,
 * four in flight, and a wall-clock budget — a slow WeebCentral must delay the
 * home feed by seconds at most, and a row that misses simply keeps its honest
 * card ("View series", not "Chapter ?"). Failures cache as unknown so a down
 * source is not re-probed on every home load.
 */
const WBC_LATEST_TTL_MS = 30 * 60 * 1000;
const WBC_LATEST_BUDGET_MS = 4000;
const wbcLatestCache = new Map<string, { at: number; label?: string }>();

async function enrichWbcLatest(rows: ManhwaRow[]): Promise<void> {
  const now = Date.now();
  for (const [k, v] of wbcLatestCache) {
    if (now - v.at > WBC_LATEST_TTL_MS) wbcLatestCache.delete(k);
  }
  while (wbcLatestCache.size >= 500) {
    const oldest = wbcLatestCache.keys().next().value;
    if (oldest == null) break;
    wbcLatestCache.delete(oldest);
  }

  const pending: ManhwaRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.id.startsWith("wbc:") || row.latestChapter) continue;
    const hit = wbcLatestCache.get(row.id);
    if (hit && now - hit.at < WBC_LATEST_TTL_MS) {
      if (hit.label) row.latestChapter = hit.label;
      continue;
    }
    if (!seen.has(row.id)) {
      seen.add(row.id);
      pending.push(row);
    }
  }

  const targets = pending.slice(0, 16);
  if (targets.length === 0) return;
  const deadline = Date.now() + WBC_LATEST_BUDGET_MS;
  let idx = 0;

  const worker = async () => {
    while (idx < targets.length && Date.now() < deadline) {
      const row = targets[idx++];
      try {
        const label = await wbc().fetchLatestChapterLabel(row.id);
        wbcLatestCache.set(row.id, { at: Date.now(), label });
        if (label) {
          // Every duplicate of this series gets the label — the rails can
          // hold the same row in both trending and latest.
          for (const r of rows) if (r.id === row.id && !r.latestChapter) r.latestChapter = label;
        }
      } catch {
        wbcLatestCache.set(row.id, { at: Date.now() });
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

/**
 * A SYNC THROW MUST COST ONE SOURCE, NOT THE FEED. Promise.allSettled only
 * absorbs rejected PROMISES — an adapter whose method is missing (which
 * ignoreBuildErrors will happily ship; it has) throws synchronously while the
 * array literal is still being built, and the whole home feed 500s with every
 * healthy source in it. Each call is fenced so any failure, sync or async,
 * settles as that one source's rejection.
 */
const settledCall = <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return fn();
  } catch (e) {
    return Promise.reject(e);
  }
};

export async function manhwaHome(): Promise<{ trending: ManhwaRow[]; latestUpdates: ManhwaRow[] }> {
  const [ap, al, wp, wl, vp, vl, sp, sl, mp, ml] = await Promise.allSettled([
    settledCall(() => asura().getPopularToday()),
    settledCall(() => asura().getLatestUpdates(1)),
    settledCall(() => wbc().getPopularToday()),
    settledCall(() => wbc().getLatestUpdates(1)),
    settledCall(() => vtx().getPopularToday()),
    settledCall(() => vtx().getLatestUpdates(1)),
    settledCall(() => mse().getPopularToday()),
    settledCall(() => mse().getLatestUpdates(1)),
    settledCall(() => mna().getPopularToday()),
    settledCall(() => mna().getLatestUpdates(1)),
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

  const trending = merge(asuraPop, weebPop, vtxPop, seePop, natoPop);
  const latestUpdates = mergeLatest(
    withAsuraRecency(asuraLat),
    weebLat,
    vtxLat,
    seeLat,
    natoLat
  );
  // After the merges, so only rows that actually made the rails pay for a
  // label fetch.
  await enrichWbcLatest([...trending, ...latestUpdates]);
  return { trending, latestUpdates };
}
