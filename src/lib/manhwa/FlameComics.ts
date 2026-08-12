import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import { ManhwaRow, isoFromEpochSeconds, sortByRecency } from './recency';

/**
 * FLAMECOMICS — a Next.js app, NOT the WordPress theme this adapter was
 * originally written against.
 *
 * This was rewritten because the original selectors matched NOTHING. Verified
 * live against the real pages:
 *
 *   · flamecomics.com 302s to flamecomics.xyz. The baseUrl is the .xyz so
 *     every request skips the redirect hop.
 *   · `.bsx`, `#chapterlist` and `#readerarea` — the Themesia/WordPress
 *     selectors the old code used — occur ZERO times on the home page, the
 *     browse page and a series page. So `search()` returned an empty array on
 *     every single call, which is why FlameComics never appeared anywhere.
 *   · The real data is a plain `__NEXT_DATA__` JSON blob. /browse carries
 *     `props.pageProps.series` — the WHOLE catalogue (166 rows, statically
 *     generated), and a series page carries `props.pageProps.series` plus
 *     `props.pageProps.chapters`.
 *
 * Ids are `flc:<series_id>` (a NUMBER, e.g. `flc:1` for Solo Leveling), and
 * chapters are `flc:<series_id>|<token>` — the token is the opaque per-chapter
 * key Flame puts in its own URLs (/series/1/385fe46707bd150c).
 *
 * THE CATALOGUE ARRIVES IN ONE PIECE, WHICH IS WHY THIS PAGES LOCALLY.
 * Flame publishes no paged listing endpoint at all — /browse is one payload of
 * everything. Slicing it here means our page N is a real, countable page, and
 * `totalPages` below is MEASURED (ceil(catalogue / PER_PAGE)) rather than
 * guessed. That is the one thing the paging contract in
 * src/lib/explorePaging.ts insists on.
 */

const CDN = 'https://cdn.flamecomics.xyz';

/** One row of `pageProps.series`, with only the fields observed on the wire. */
interface FlameSeries {
  series_id: number;
  title: string;
  description?: string;
  status?: string;
  cover?: string;
  last_edit?: number;
  time?: number;
  popularityRank?: number;
  categories?: string[];
  author?: string[];
  artist?: string[];
  year?: number;
  type?: string;
}

interface FlameChapter {
  chapter_id: number;
  chapter?: string;
  title?: string;
  token?: string;
  release_date?: number;
}

/** A row of the home page's `latestEntries` block: a series WITH its newest chapters. */
interface FlameLatestSeries extends FlameSeries {
  chapters?: FlameChapter[];
}

/**
 * The catalogue is ~1.5MB of HTML and every browse request would otherwise
 * re-fetch and re-parse it. Cached at module scope for five minutes, which on
 * a serverless runtime means "for the life of a warm instance" — a fresh
 * instance simply pays for it once.
 */
let catalogueCache: { at: number; rows: ManhwaRow[]; ranked: ManhwaRow[] } | null = null;
const CATALOGUE_TTL = 5 * 60 * 1000;

/**
 * The HOME payload, which serves BOTH home rails from ONE request.
 *
 * Separate from the catalogue cache above because it is a different, much
 * cheaper document: /browse is ~1.5MB and /latest ~1.6MB, while / is ~460KB and
 * carries a `popularEntries` block AND a `latestEntries` block with per-series
 * chapters. getPopularToday and getLatestUpdates are both called on every home
 * render, so without this they would fetch the same page twice.
 */
let homeCache: { at: number; popular: ManhwaRow[]; latest: ManhwaRow[] } | null = null;
const HOME_TTL = 60 * 1000;

/**
 * THE IN-FLIGHT REQUEST, WITHOUT WHICH THE CACHE ABOVE NEVER FIRES.
 *
 * manhwaHome calls getPopularToday and getLatestUpdates inside one
 * Promise.allSettled, so they run CONCURRENTLY. Both consult the cache before
 * either has finished filling it, both miss, and both fetch — measured: two
 * hits on flamecomics.xyz/ per render. A results-only cache cannot help,
 * because there is no moment between the two lookups at which a result exists.
 *
 * Caching the PROMISE closes that window: the second caller joins the first
 * one's request instead of starting its own. (The same stampede was already
 * happening on /browse before this change, at 1.5MB a copy, which is how it
 * went unnoticed.)
 */
let homeInflight: Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> | null = null;

export default class FlameComics extends MangaParser {
  override readonly name = 'FlameComics';
  protected override readonly baseUrl = 'https://flamecomics.xyz';
  protected override readonly logo = 'https://flamecomics.xyz/icon.png';
  protected override readonly classPath = 'MANGA.FlameComics';

  /** Matches Asura's page size so our page N lines up across sources. */
  private static readonly PER_PAGE = 20;

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  }

  /**
   * Pull the `__NEXT_DATA__` payload out of a page.
   *
   * Returns null rather than throwing on anything unexpected — Flame serves a
   * plain "We'll be right back" holding page under load, which is HTTP 200
   * with no payload in it, and that must degrade to "no rows" rather than to
   * an exception that takes the whole merged browse down with it.
   */
  private nextData(html: string): any | null {
    if (!html || typeof html !== 'string') return null;
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }

  private determineStatus(status?: string): MediaStatus {
    switch ((status || '').toLowerCase().trim()) {
      case 'ongoing': return MediaStatus.ONGOING;
      case 'completed': return MediaStatus.COMPLETED;
      case 'dropped':
      case 'cancelled': return MediaStatus.CANCELLED;
      default: return MediaStatus.UNKNOWN;
    }
  }

  /**
   * Cover URL. Verified against the browse page's own <img> tags:
   * https://cdn.flamecomics.xyz/uploads/images/series/<id>/<cover>?<last_edit>
   * The query string is Flame's cache-buster and is kept so an updated cover
   * is not served stale from a CDN edge.
   */
  private coverUrl(s: FlameSeries): string | undefined {
    if (!s.cover) return undefined;
    const bust = s.last_edit ? `?${s.last_edit}` : '';
    return `${CDN}/uploads/images/series/${s.series_id}/${s.cover}${bust}`;
  }

  private toResult(s: FlameSeries): ManhwaRow {
    return {
      id: `flc:${s.series_id}`,
      title: s.title,
      image: this.coverUrl(s),
      status: this.determineStatus(s.status),
    };
  }

  /**
   * The whole catalogue, freshly or from the warm cache.
   *
   * Builds BOTH orderings from the one fetch: `rows` in the payload's own
   * order (which browse pages through, so it must stay stable) and `ranked` by
   * `popularityRank`. Deriving the ranked list here rather than in a second
   * method keeps it free — it is the same document, sorted twice.
   */
  private async loadCatalogue(): Promise<{ rows: ManhwaRow[]; ranked: ManhwaRow[] }> {
    if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL) {
      return { rows: catalogueCache.rows, ranked: catalogueCache.ranked };
    }
    const html = await this.request<string>(`${this.baseUrl}/browse`);
    const data = this.nextData(html);
    const list: FlameSeries[] = data?.props?.pageProps?.series;
    if (!Array.isArray(list)) return { rows: [], ranked: [] };

    // `series_id != null` also drops the 13 light-novel rows, which carry a
    // `novel_id` instead and would otherwise mint the id `flc:undefined`.
    const kept = list.filter((s) => s && s.series_id != null && s.title);
    const rows = kept.map((s) => this.toResult(s));
    const ranked = [...kept]
      .sort((a, b) => (a.popularityRank ?? Number.MAX_SAFE_INTEGER) - (b.popularityRank ?? Number.MAX_SAFE_INTEGER))
      .map((s) => this.toResult(s));

    // Only cache a payload that actually parsed. Caching an empty result would
    // pin a transient holding page in front of the catalogue for five minutes.
    if (rows.length > 0) catalogueCache = { at: Date.now(), rows, ranked };
    return { rows, ranked };
  }

  private async catalogue(): Promise<ManhwaRow[]> {
    return (await this.loadCatalogue()).rows;
  }

  /** The catalogue ordered by Flame's own popularity rank (1 = most popular). */
  private async catalogueRanked(): Promise<ManhwaRow[]> {
    return (await this.loadCatalogue()).ranked;
  }

  /**
   * Slice the local catalogue into a page, reporting a REAL total.
   *
   * Every number here is counted from a list we are holding, so `totalPages`
   * and `totalItems` are measurements, not estimates — see the contract in
   * src/lib/explorePaging.ts.
   */
  private paginate(rows: ManhwaRow[], page: number): ISearch<ManhwaRow> {
    const per = FlameComics.PER_PAGE;
    const p = Math.max(1, page);
    const start = (p - 1) * per;
    const slice = rows.slice(start, start + per);
    return {
      currentPage: p,
      hasNextPage: start + per < rows.length,
      results: slice,
      totalPages: Math.max(1, Math.ceil(rows.length / per)),
      totalItems: rows.length,
    };
  }

  private empty(page: number): ISearch<ManhwaRow> {
    return { currentPage: page, hasNextPage: false, results: [] };
  }

  /**
   * THE HOME PAGE, WHICH IS WHERE FLAME'S REAL RECENCY SIGNAL LIVES.
   *
   * The previous getLatestUpdates returned `catalogue()` — all 166 series in
   * /browse's own alphabetical order — straight into a shelf labelled Recently
   * Updated. That is the reported bug in its purest form: the source was
   * answering "here is everything I host" to the question "what changed today".
   *
   * WHAT WAS ACTUALLY AVAILABLE, measured against the live payloads:
   *
   *   /browse  → pageProps.series      166 rows. Carries `last_edit`, `time`
   *              and `popularityRank`. NO chapter data of any kind.
   *   /latest  → pageProps.allSeries   166 rows, each with a nested `chapters`
   *              array (up to 3) carrying a real `release_date`. ~1.6MB.
   *   /        → pageProps.latestEntries.blocks[0].series  24 rows, the SAME
   *              shape with nested chapters, plus popularEntries. ~460KB.
   *
   * So a recency signal does exist, and this uses the cheapest document that
   * carries it. The home block's 24 rows are more than a rail of ~20 needs, and
   * taking it from `/` means popular and latest share one fetch instead of
   * costing two — the request budget goes DOWN, not up, versus the /browse call
   * this replaces.
   *
   * `last_edit` IS NOT THAT SIGNAL, despite being the obvious-looking field and
   * the one the old comment on getLatestUpdates claimed to sort by (it sorted
   * by nothing at all). It tracks metadata edits: "The Former Supreme" reported
   * last_edit 2026-07-29 with its newest chapter released 2026-08-12, and "The
   * Ancient Sovereign of Eternity" reported 2024-08-07 while sitting fifth in
   * Flame's own latest feed. Only `chapters[].release_date` is the release.
   *
   * NOVEL ROWS ARE DROPPED. 13 of the 166 catalogue rows carry `novel_id` and
   * no `series_id`; they are light novels, not manhwa, and without a series_id
   * they would mint the id `flc:undefined` and open to nothing.
   */
  private async home(): Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> {
    if (homeCache && Date.now() - homeCache.at < HOME_TTL) {
      return { popular: homeCache.popular, latest: homeCache.latest };
    }
    if (homeInflight) return homeInflight;
    homeInflight = this.loadHome().finally(() => { homeInflight = null; });
    return homeInflight;
  }

  private async loadHome(): Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> {
    const html = await this.request<string>(`${this.baseUrl}/`);
    const pp = this.nextData(html)?.props?.pageProps;

    const blockSeries = (entries: any): any[] => {
      const blocks = entries?.blocks;
      if (!Array.isArray(blocks)) return [];
      return blocks.flatMap((b: any) => (Array.isArray(b?.series) ? b.series : []));
    };

    const popular: ManhwaRow[] = blockSeries(pp?.popularEntries)
      .filter((s: FlameSeries) => s && s.series_id != null && s.title)
      .map((s: FlameSeries) => this.toResult(s));

    const latest: ManhwaRow[] = blockSeries(pp?.latestEntries)
      .filter((s: FlameLatestSeries) => s && s.series_id != null && s.title)
      .map((s: FlameLatestSeries): ManhwaRow => {
        const chapters = Array.isArray(s.chapters) ? s.chapters : [];
        // The block is ALREADY ordered newest-first per series, but this takes
        // the max rather than [0] so a reordered payload cannot quietly date a
        // row by its oldest chapter instead of its newest.
        let newest = 0;
        let newestChapter: FlameChapter | undefined;
        for (const c of chapters) {
          const t = Number(c?.release_date) || 0;
          if (t > newest) { newest = t; newestChapter = c; }
        }
        const num = newestChapter?.chapter ? String(Number(newestChapter.chapter)) : '';
        return {
          ...this.toResult(s),
          latestChapter: num ? `Chapter ${num}` : undefined,
          updatedAt: isoFromEpochSeconds(newest),
        };
      })
      // A row with no chapter payload has no release date, so it cannot be
      // placed in a shelf that is sorted by release date. Dropping it here is
      // the whole point of the fix — it is exactly the catalogue filler the
      // owner was seeing.
      .filter((r) => !!r.updatedAt);

    const out = { popular, latest: sortByRecency(latest) };
    // Only cache a payload that parsed. Flame serves a 200 "We'll be right
    // back" holding page under load, and caching that would pin an empty home
    // rail in front of a working site.
    if (popular.length > 0 || out.latest.length > 0) {
      homeCache = { at: Date.now(), popular: out.popular, latest: out.latest };
    }
    return out;
  }

  /**
   * Flame's own Latest block, newest chapter first.
   *
   * Page 1 only, and EMPTY beyond it — the block is a fixed-size board, not a
   * paged listing. Returning the catalogue for page 2 is what put old series in
   * this shelf in the first place; a source that cannot answer the question
   * contributes nothing rather than padding the answer.
   */
  async getLatestUpdates(page: number = 1): Promise<ISearch<ManhwaRow>> {
    if (page > 1) return this.empty(page);
    try {
      const { latest } = await this.home();
      return { currentPage: 1, hasNextPage: false, results: latest };
    } catch (e) {
      console.error('FlameComics getLatestUpdates error:', e);
      return this.empty(page);
    }
  }

  /**
   * Flame's own Popular block.
   *
   * The fallback is sorted by `popularityRank`, which /browse publishes as a
   * real 1..166 ordering (rank 1 is Omniscient Reader's Viewpoint, 9 is Solo
   * Leveling — it is a genuine popularity list). The old code sliced the first
   * 15 rows of the catalogue in its native order, which is ALPHABETICAL: the
   * trending rail led with "30 Years Have Passed Since the Prologue" and "48
   * Hours a Day" because their titles start with digits, not because anyone was
   * reading them.
   */
  async getPopularToday(): Promise<ISearch<ManhwaRow>> {
    try {
      const { popular } = await this.home();
      if (popular.length > 0) return { currentPage: 1, hasNextPage: false, results: popular.slice(0, 15) };
    } catch (e) {
      console.error('FlameComics getPopularToday error:', e);
    }
    try {
      const rows = await this.catalogueRanked();
      return { currentPage: 1, hasNextPage: false, results: rows.slice(0, 15) };
    } catch (e) {
      console.error('FlameComics getPopularToday fallback error:', e);
      return this.empty(1);
    }
  }

  /**
   * BROWSE KEEPS THE CATALOGUE, deliberately.
   *
   * This used to delegate to getLatestUpdates, so narrowing that method to a
   * 24-row board would have amputated browse down to one page. Browse wants
   * every series in a stable order; the home rail wants the few that changed
   * today. They are different questions and now have different implementations.
   */
  async getSeries(page: number = 1, _filters?: any): Promise<ISearch<IMangaResult>> {
    try {
      return this.paginate(await this.catalogue(), page);
    } catch (e) {
      console.error('FlameComics getSeries error:', e);
      return this.empty(page);
    }
  }

  /**
   * Search runs over the local catalogue, because Flame has no search endpoint
   * we can address server-side. A substring match on the title is honest about
   * what it is: the catalogue is only ~166 titles, so this is a complete search
   * of everything Flame hosts rather than a sample of it.
   */
  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      const rows = await this.catalogue();
      const q = (query || '').trim().toLowerCase();
      const hits = q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
      return this.paginate(hits, page);
    } catch (e) {
      console.error('FlameComics search error:', e);
      return this.empty(page);
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const seriesId = mangaId.replace(/^flc:/, '');
    const url = `${this.baseUrl}/series/${seriesId}`;
    try {
      const html = await this.request<string>(url);
      const data = this.nextData(html);
      const s: FlameSeries | undefined = data?.props?.pageProps?.series;
      if (!s) throw new Error(`FlameComics returned no series payload for "${seriesId}"`);

      const rawChapters: FlameChapter[] = Array.isArray(data?.props?.pageProps?.chapters)
        ? data.props.pageProps.chapters
        : [];

      /**
       * Newest first, to match every other source's chapter ordering — the
       * detail page treats chapters[0] as the latest and the LAST entry as
       * chapter one, and a list in the other order silently inverts both the
       * "First"/"Latest" buttons and the displayed chapter numbers.
       */
      const chapters: IMangaChapter[] = rawChapters
        .filter((c) => c && c.token)
        .map((c): IMangaChapter => {
          const num = c.chapter ? String(Number(c.chapter)) : '';
          const name = (c.title || '').trim();
          return {
            id: `flc:${seriesId}|${c.token}`,
            title: name ? `Chapter ${num} - ${name}` : `Chapter ${num}`,
            releaseDate: c.release_date ? new Date(c.release_date * 1000).toISOString() : undefined,
          };
        })
        .sort((a, b) => {
          const an = Number(a.title.match(/chapter\s*([\d.]+)/i)?.[1] ?? 0);
          const bn = Number(b.title.match(/chapter\s*([\d.]+)/i)?.[1] ?? 0);
          return bn - an;
        });

      return {
        id: mangaId,
        title: s.title,
        image: this.coverUrl(s),
        description: s.description,
        status: this.determineStatus(s.status),
        authors: Array.isArray(s.author) ? s.author : undefined,
        artist: Array.isArray(s.artist) ? s.artist.join(', ') : undefined,
        genres: Array.isArray(s.categories) ? s.categories : undefined,
        chapters,
      };
    } catch (e) {
      console.error(`FlameComics fetchMangaInfo error for ${seriesId}:`, e);
      throw e;
    }
  }

  /**
   * READER PAGES — read from the chapter payload, keyed on the CHAPTER TOKEN.
   *
   * Now verified live (the reader answers a plain server-side fetch fine; the
   * earlier "We'll be right back" was transient). A chapter page carries
   * `props.pageProps.chapter.images`: an object keyed "0", "1", "2"… whose
   * values hold a `name` — the bare filename. The URL is the series cover path
   * with the CHAPTER TOKEN inserted as an extra segment:
   *
   *   /uploads/images/series/<series_id>/<token>/<name>
   *
   * THAT SHARED PREFIX IS WHY THE PREVIOUS ATTEMPT RETURNED THE WRONG IMAGES.
   * It harvested every cdn.flamecomics.xyz URL on the page and then dropped
   * everything under `/uploads/images/series/` on the grounds that those are
   * covers. Chapter art lives under that same prefix, so the filter threw away
   * all 19 real pages and kept the 8 `/assets/read/read_on_flame_N.webp`
   * house-ad banners — a chapter that "loaded" as eight adverts. Verified on
   * flc:165|f0bd5160a5b8f0f5 (19 pages) and flc:1|385fe46707bd150c (18).
   *
   * The distinguishing part is the token segment, not the prefix, so both
   * paths below anchor on `<series_id>/<token>/`. The regex fallback keeps the
   * cache-busting query string when the markup carries one.
   */
  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace(/^flc:/, '');
    const parts = rawId.split('|');
    if (parts.length !== 2) throw new Error('Invalid FlameComics chapter ID');

    const [seriesId, token] = parts;
    const url = `${this.baseUrl}/series/${seriesId}/${token}`;
    const dir = `/uploads/images/series/${seriesId}/${token}/`;

    try {
      const html = await this.request<string>(url);
      const data = this.nextData(html);

      // Preferred: the chapter's own image manifest, in its own order.
      const images = data?.props?.pageProps?.chapter?.images;
      if (images && typeof images === 'object') {
        const pages: IMangaChapterPage[] = [];
        for (const key of Object.keys(images).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b))) {
          const name = images[key]?.name;
          if (!name) continue;
          pages.push({ page: pages.length + 1, img: `${CDN}${dir}${encodeURIComponent(String(name))}` });
        }
        if (pages.length > 0) return pages;
      }

      // Fallback: harvest the markup, restricted to THIS chapter's directory.
      // Both plain and JSON-escaped forms, since the payload may be embedded
      // inside a JSON string where the slashes are escaped.
      const source = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
      const re = /https?:\/\/cdn\.flamecomics\.xyz\/[^\s"'\\<>)]+\.(?:webp|jpe?g|png|avif|gif)(?:\?[^\s"'\\<>)]*)?/gi;
      const seen = new Set<string>();
      const pages: IMangaChapterPage[] = [];

      for (const m of source.matchAll(re)) {
        const src = m[0];
        // Anything outside this chapter's own directory is the series cover,
        // the carousel, or a house ad — never a page of this chapter.
        if (!src.includes(dir)) continue;
        if (seen.has(src)) continue;
        seen.add(src);
        pages.push({ page: pages.length + 1, img: src });
      }

      return pages;
    } catch (e) {
      console.error(`FlameComics fetchChapterPages error for ${rawId}:`, e);
      throw e;
    }
  }
}
