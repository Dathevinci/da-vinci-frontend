import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import * as cheerio from 'cheerio';

/**
 * RIZZFABLES — a WordPress/Themesia site, so the `.bsx` card markup the
 * original adapter targeted IS correct. Three other things were not, and each
 * one on its own reduced this source to zero rows.
 *
 * All verified live:
 *
 *  1. THE LISTING URL WAS AN AD REDIRECT. `/page/<n>/?s=<q>` — what the old
 *     search() built — answers 302 to a third-party ad domain, for every page
 *     and every query including the empty one. So every call parsed an
 *     advertiser's HTML and found no series. `/series/` and `/?s=<q>` both
 *     answer 200 with real cards, and are what this uses now.
 *
 *  2. COVERS ARE RELATIVE. Cards carry `src="/assets/images/<file>.webp"`,
 *     which resolves against OUR origin once it reaches the browser and 404s
 *     every time. They are absolutised here, at the only place that knows
 *     which site they came from. (The series page's own cover is already
 *     absolute; absolutise() leaves those alone.)
 *
 *  3. CHAPTER LINKS ARE NOT NESTED UNDER THE SERIES. The old regex wanted
 *     `/series/<slug>/<chapter>`; the site emits `/chapter/<slug>-chapter-N`
 *     as a TOP-LEVEL path. 251 chapter links on the page I checked, zero
 *     matches — so every Rizz series opened with an empty chapter list.
 *
 * Ids are `rzc:<series-slug>` and `rzc:<chapter-slug>`. The chapter slug is
 * self-contained (it already embeds the series), which is why chapters here do
 * not use the `<series>|<chapter>` pipe shape the other sources need.
 *
 * THE CATALOGUE IS ONE PAGE. `/series/` lists all 87 titles at once and
 * ignores `?page=`, so this pages locally and reports a MEASURED total, same
 * as FlameComics — see src/lib/explorePaging.ts for why a counted number is
 * the only kind that may be reported.
 */

let catalogueCache: { at: number; rows: IMangaResult[] } | null = null;
const CATALOGUE_TTL = 5 * 60 * 1000;

export default class RizzComics extends MangaParser {
  override readonly name = 'RizzComics';
  protected override readonly baseUrl = 'https://rizzfables.com';
  protected override readonly logo = 'https://rizzfables.com/assets/images/logo.png';
  protected override readonly classPath = 'MANGA.RizzComics';

  /** Matches Asura's page size so our page N lines up across sources. */
  private static readonly PER_PAGE = 20;

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  }

  /** `/assets/images/x.webp` → `https://rizzfables.com/assets/images/x.webp`. */
  private absolutise(src: string | undefined): string | undefined {
    const s = (src || '').trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return `https:${s}`;
    return `${this.baseUrl}${s.startsWith('/') ? '' : '/'}${s}`;
  }

  private extractSlug(url: string | undefined): string {
    if (!url) return '';
    const match = /\/series\/([^/?#]+)/.exec(url);
    return match ? match[1] : '';
  }

  private determineStatus(text: string): MediaStatus {
    const t = (text || '').toLowerCase();
    if (t.includes('ongoing')) return MediaStatus.ONGOING;
    if (t.includes('completed')) return MediaStatus.COMPLETED;
    if (t.includes('dropped')) return MediaStatus.CANCELLED;
    return MediaStatus.UNKNOWN;
  }

  /**
   * Parse the listing cards out of any Rizz page.
   *
   * BOTH card shapes, deliberately. The series listing is all `.bsx`, but the
   * HOME page renders 7 `.bsx` plus 30 `.utao` — and matching only `.bsx` there
   * returned 7 rows into a rail sized for 15. It failed quietly rather than
   * loudly: the caller's catalogue fallback only fires on an EMPTY result, so a
   * seventh-full rail counted as success. `.utao` carries the same `.tt` /
   * `href` / `img` shape, so one selector covers both and the dedupe below
   * handles a page that renders a series in each.
   */
  private parseCards(html: string): IMangaResult[] {
    const $ = cheerio.load(html);
    const results: IMangaResult[] = [];
    const seen = new Set<string>();

    $('.bsx, .utao').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.tt').text().trim() || $el.find('a').attr('title')?.trim();
      const href = $el.find('a').attr('href');
      const image = this.absolutise($el.find('img').attr('src'));
      const latestChapter = $el.find('.epxs').text().trim() || undefined;

      const slug = this.extractSlug(href);
      if (!slug || !title || seen.has(slug)) return;
      seen.add(slug);
      results.push({ id: `rzc:${slug}`, title, image, latestChapter });
    });

    return results;
  }

  private async catalogue(): Promise<IMangaResult[]> {
    if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL) {
      return catalogueCache.rows;
    }
    const html = await this.request<string>(`${this.baseUrl}/series/`);
    const rows = this.parseCards(html);
    if (rows.length > 0) catalogueCache = { at: Date.now(), rows };
    return rows;
  }

  private paginate(rows: IMangaResult[], page: number): ISearch<IMangaResult> {
    const per = RizzComics.PER_PAGE;
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

  async getLatestUpdates(page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      return this.paginate(await this.catalogue(), page);
    } catch (e) {
      console.error('RizzComics getLatestUpdates error:', e);
      return this.empty(page);
    }
  }

  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      // The home page's own shelves, which are ordered by the site itself —
      // the flat /series/ list carries no popularity signal to sort on.
      const html = await this.request<string>(`${this.baseUrl}/`);
      const rows = this.parseCards(html);
      if (rows.length > 0) return { currentPage: 1, hasNextPage: false, results: rows.slice(0, 15) };
      return { currentPage: 1, hasNextPage: false, results: (await this.catalogue()).slice(0, 15) };
    } catch (e) {
      console.error('RizzComics getPopularToday error:', e);
      return this.empty(1);
    }
  }

  async getSeries(page: number = 1, _filters?: any): Promise<ISearch<IMangaResult>> {
    return this.getLatestUpdates(page);
  }

  /**
   * `/?s=<query>` answers 200 (unlike the `/page/N/?s=` route), but it was
   * observed returning the unfiltered home shelves rather than a filtered
   * result set. So the query is applied HERE, against the catalogue, and the
   * remote search is not trusted to have honoured it — a source that silently
   * ignores the query would otherwise pour unrelated series into every search.
   */
  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      const rows = await this.catalogue();
      const q = (query || '').trim().toLowerCase();
      const hits = q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
      return this.paginate(hits, page);
    } catch (e) {
      console.error('RizzComics search error:', e);
      return this.empty(page);
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const slug = mangaId.replace(/^rzc:/, '');
    const url = `${this.baseUrl}/series/${slug}`;
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);

      const title = $('.entry-title').first().text().trim();
      const image = this.absolutise($('.thumb img').first().attr('src'));
      const description = $('.entry-content p').text().trim() || $('.entry-content').text().trim();
      const status = this.determineStatus($('.imptdt:contains("Status") i').first().text());

      const genres: string[] = [];
      $('.mgen a').each((_, el) => {
        const g = $(el).text().trim();
        if (g) genres.push(g);
      });

      const chapters: IMangaChapter[] = [];
      const seen = new Set<string>();
      $('#chapterlist li').each((_, el) => {
        const $el = $(el);
        const cTitle = $el.find('.chapternum').text().trim();
        const cDate = $el.find('.chapterdate').text().trim();
        const cHref = $el.find('a').attr('href');
        if (!cHref) return;

        // Top-level `/chapter/<slug>`, NOT nested under /series/. This is the
        // shape the site actually emits — see the header note.
        const m = /\/chapter\/([^/?#]+)/.exec(cHref);
        if (!m) return;
        const cSlug = m[1];
        if (seen.has(cSlug)) return;
        seen.add(cSlug);

        chapters.push({
          id: `rzc:${cSlug}`,
          title: cTitle || cSlug.replace(/-/g, ' '),
          releaseDate: cDate || undefined,
        });
      });

      return {
        id: mangaId,
        title,
        image,
        description,
        status,
        genres: genres.length ? genres : undefined,
        chapters,
      };
    } catch (e) {
      console.error(`RizzComics fetchMangaInfo error for ${slug}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const slug = chapterId.replace(/^rzc:/, '');
    if (!slug) throw new Error('Invalid RizzComics chapter ID');
    const url = `${this.baseUrl}/chapter/${slug}`;

    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      const pages: IMangaChapterPage[] = [];
      const seen = new Set<string>();

      $('#readerarea img').each((_, el) => {
        // Lazy-loaded readers put the real URL in data-src and a placeholder
        // in src, so data-src is preferred wherever it exists.
        const raw = $(el).attr('data-src') || $(el).attr('src');
        const src = this.absolutise(raw);
        if (!src || seen.has(src)) return;
        seen.add(src);
        pages.push({ page: pages.length + 1, img: src });
      });

      return pages;
    } catch (e) {
      console.error(`RizzComics fetchChapterPages error for ${slug}:`, e);
      throw e;
    }
  }
}
