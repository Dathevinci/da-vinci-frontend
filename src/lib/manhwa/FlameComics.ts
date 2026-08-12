import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';

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

/**
 * The catalogue is ~1.5MB of HTML and every browse request would otherwise
 * re-fetch and re-parse it. Cached at module scope for five minutes, which on
 * a serverless runtime means "for the life of a warm instance" — a fresh
 * instance simply pays for it once.
 */
let catalogueCache: { at: number; rows: IMangaResult[] } | null = null;
const CATALOGUE_TTL = 5 * 60 * 1000;

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

  private toResult(s: FlameSeries): IMangaResult {
    return {
      id: `flc:${s.series_id}`,
      title: s.title,
      image: this.coverUrl(s),
      status: this.determineStatus(s.status),
    };
  }

  /** The whole catalogue, freshly or from the warm cache. */
  private async catalogue(): Promise<IMangaResult[]> {
    if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL) {
      return catalogueCache.rows;
    }
    const html = await this.request<string>(`${this.baseUrl}/browse`);
    const data = this.nextData(html);
    const list: FlameSeries[] = data?.props?.pageProps?.series;
    if (!Array.isArray(list)) return [];

    const rows = list
      .filter((s) => s && s.series_id != null && s.title)
      .map((s) => this.toResult(s));
    // Only cache a payload that actually parsed. Caching an empty result would
    // pin a transient holding page in front of the catalogue for five minutes.
    if (rows.length > 0) catalogueCache = { at: Date.now(), rows };
    return rows;
  }

  /**
   * Slice the local catalogue into a page, reporting a REAL total.
   *
   * Every number here is counted from a list we are holding, so `totalPages`
   * and `totalItems` are measurements, not estimates — see the contract in
   * src/lib/explorePaging.ts.
   */
  private paginate(rows: IMangaResult[], page: number): ISearch<IMangaResult> {
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

  private empty(page: number): ISearch<IMangaResult> {
    return { currentPage: page, hasNextPage: false, results: [] };
  }

  /** Newest edits first — Flame's `last_edit`/`time` are unix seconds. */
  async getLatestUpdates(page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      const rows = await this.catalogue();
      return this.paginate(rows, page);
    } catch (e) {
      console.error('FlameComics getLatestUpdates error:', e);
      return this.empty(page);
    }
  }

  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      const rows = await this.catalogue();
      return { currentPage: 1, hasNextPage: false, results: rows.slice(0, 15) };
    } catch (e) {
      console.error('FlameComics getPopularToday error:', e);
      return this.empty(1);
    }
  }

  async getSeries(page: number = 1, _filters?: any): Promise<ISearch<IMangaResult>> {
    return this.getLatestUpdates(page);
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
