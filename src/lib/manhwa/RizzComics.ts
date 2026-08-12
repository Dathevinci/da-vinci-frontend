import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import * as cheerio from 'cheerio';
import { ManhwaRow, isoFromEpochSeconds, sortByRecency } from './recency';

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

/**
 * Collapse the theme's source-formatting whitespace inside a text node.
 *
 * Rizz's templates put labels and values on separate indented lines, so the
 * extracted text carries newlines and tab runs INTERNALLY, where `.trim()`
 * cannot reach them.
 */
const squash = (s: string | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

let catalogueCache: { at: number; rows: ManhwaRow[] } | null = null;
const CATALOGUE_TTL = 5 * 60 * 1000;

/** The home page, which carries BOTH shelves — see homeShelves(). */
let homeCache: { at: number; popular: ManhwaRow[]; latest: ManhwaRow[] } | null = null;
const HOME_TTL = 60 * 1000;

/**
 * The in-flight fetch, so the two concurrent rail calls share ONE request.
 * getPopularToday and getLatestUpdates are issued together inside manhwaHome's
 * Promise.allSettled, so they both miss a results-only cache and both fetch —
 * measured at two hits on rizzfables.com/ per render before this was added.
 * See the fuller note on the same field in FlameComics.
 */
let homeInflight: Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> | null = null;

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
   * `.bsx` — THE POPULAR / CATALOGUE CARD. Verified against the live markup.
   *
   * THE `.bsx` vs `.utao` QUESTION, SETTLED WITH EVIDENCE. A previous fix
   * widened this one parser to `.bsx, .utao` to fill the trending rail, on the
   * reasoning that both carry the same title/href/img shape. They do — but they
   * are two DIFFERENT SHELVES, and merging them fed the wrong one to trending.
   * What the live pages actually contain:
   *
   *   rizzfables.com/         8 × `.bsx`  inside `<h2>Popular Today</h2>`
   *                          30 × `.utao` inside `<h2>Latest Update</h2>`
   *   rizzfables.com/series/ 88 × `.bsx`, ZERO `.utao`, zero timestamps
   *
   * So on the Themesia theme Rizz uses, `.bsx` is the popular/series grid and
   * `.utao` is the latest-updates listing — the conventional split, confirmed
   * rather than assumed. `$('.bsx, .utao')` returns document order, so
   * getPopularToday's `.slice(0, 15)` was taking 8 genuinely-popular rows
   * followed by 7 rows that were merely the most recently updated. The mirror
   * image of the catalogue-in-the-latest-shelf bug, in the other rail.
   *
   * The two shelves are now parsed by two methods and routed to the two rails
   * they belong to. `.bsx` carries no date of any kind, which is the other half
   * of the evidence: a card with a chapter label and no timestamp is a
   * popularity card, and it is why these rows carry no `updatedAt`.
   */
  private parsePopularCards(html: string): ManhwaRow[] {
    const $ = cheerio.load(html);
    const results: ManhwaRow[] = [];
    const seen = new Set<string>();

    $('.bsx').each((_, el) => {
      const $el = $(el);
      const title = squash($el.find('.tt').text()) || squash($el.find('a').attr('title'));
      const href = $el.find('a').attr('href');
      const image = this.absolutise($el.find('img').attr('src'));
      // `.epxs` is emitted as "Chapter\n\t\t\t\t\t53" — the label and the number
      // sit on separate source lines. trim() alone leaves the run of tabs in the
      // MIDDLE of the string, so the rail rendered a chapter label with a line
      // break through it.
      const latestChapter = squash($el.find('.epxs').text()) || undefined;

      const slug = this.extractSlug(href);
      if (!slug || !title || seen.has(slug)) return;
      seen.add(slug);
      results.push({ id: `rzc:${slug}`, title, image, latestChapter });
    });

    return results;
  }

  /**
   * `.utao` — THE LATEST-UPDATE CARD, and the only Rizz markup carrying a date.
   *
   * Its shape is genuinely different from `.bsx` and needs its own selectors:
   * there is no `.tt` and no `.epxs`. A card is
   *
   *   .utao > .uta > .imgu > a.series[href][title] > img
   *                > .luf  > a.series > h4          (the title)
   *                        > ul > li × 5            (the five newest chapters)
   *
   * and each `li` holds the chapter link plus `<span id="relativeTime_<epoch>">`
   * — an EMPTY span that the site's own inline script fills in client-side from
   * a matching `chapterTimestamp` in milliseconds. Reading the epoch out of the
   * id is why this needs no relative-time parsing at all: "12 August" or "2
   * hours ago" is the site RENDERING this number, and the number itself is
   * exact, timezone-free and already sortable. Measured live: 30 cards × 5
   * chapters = 150 such ids on the home page.
   *
   * The FIRST `li` is the newest, but this takes the max across the card's
   * chapters so a reordered list cannot date a series by its oldest release.
   */
  private parseLatestCards(html: string): ManhwaRow[] {
    const $ = cheerio.load(html);
    const results: ManhwaRow[] = [];
    const seen = new Set<string>();

    $('.utao .uta').each((_, el) => {
      const $el = $(el);
      const $link = $el.find('a.series').first();
      const href = $link.attr('href');
      const slug = this.extractSlug(href);
      if (!slug || seen.has(slug)) return;

      const title = squash($el.find('.luf h4').first().text()) || squash($link.attr('title'));
      if (!title) return;

      const image = this.absolutise($el.find('img').attr('src'));

      let newest = 0;
      let newestLabel: string | undefined;
      $el.find('.luf ul li').each((__, li) => {
        const $li = $(li);
        const id = $li.find('span[id^="relativeTime_"]').first().attr('id') || '';
        const epoch = Number(/relativeTime_(\d+)/.exec(id)?.[1] || 0);
        if (epoch > newest) {
          newest = epoch;
          newestLabel = squash($li.find('a').first().text()) || undefined;
        }
      });

      seen.add(slug);
      results.push({
        id: `rzc:${slug}`,
        title,
        image,
        latestChapter: newestLabel,
        updatedAt: isoFromEpochSeconds(newest),
      });
    });

    return results;
  }

  private async catalogue(): Promise<ManhwaRow[]> {
    if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL) {
      return catalogueCache.rows;
    }
    // `/series/` is 88 `.bsx` cards and nothing else — no `.utao`, no dates.
    const html = await this.request<string>(`${this.baseUrl}/series/`);
    const rows = this.parsePopularCards(html);
    if (rows.length > 0) catalogueCache = { at: Date.now(), rows };
    return rows;
  }

  /**
   * The home page's two shelves, from ONE request.
   *
   * getPopularToday and getLatestUpdates are both called on every home render
   * and both need this same document. Without the cache the fix would have
   * doubled Rizz's request count; with it, Rizz now costs ONE fetch per render
   * where it previously cost two (`/` for popular and `/series/` for latest).
   */
  private async homeShelves(): Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> {
    if (homeCache && Date.now() - homeCache.at < HOME_TTL) {
      return { popular: homeCache.popular, latest: homeCache.latest };
    }
    if (homeInflight) return homeInflight;
    homeInflight = this.loadHomeShelves().finally(() => { homeInflight = null; });
    return homeInflight;
  }

  private async loadHomeShelves(): Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> {
    const html = await this.request<string>(`${this.baseUrl}/`);
    const popular = this.parsePopularCards(html);
    const latest = sortByRecency(this.parseLatestCards(html));
    if (popular.length > 0 || latest.length > 0) {
      homeCache = { at: Date.now(), popular, latest };
    }
    return { popular, latest };
  }

  private paginate(rows: ManhwaRow[], page: number): ISearch<ManhwaRow> {
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

  private empty(page: number): ISearch<ManhwaRow> {
    return { currentPage: page, hasNextPage: false, results: [] };
  }

  /**
   * The site's own "Latest Update" shelf, newest chapter first.
   *
   * THIS USED TO RETURN THE CATALOGUE — all 88 series in `/series/` order,
   * paged, straight into a shelf labelled Recently Updated. That is the bug the
   * owner reported: the shelf was showing Rizz's back catalogue, not its
   * updates.
   *
   * Page 1 only. The Latest Update block is a fixed 30-card board with no
   * pager, so there is genuinely no page 2 to serve, and inventing one out of
   * the catalogue is exactly the substitution that caused this.
   *
   * NO CATALOGUE FALLBACK, deliberately. If the home page fails to parse, this
   * returns EMPTY and the merged rail is built from the other three sources.
   * Padding a recency shelf with undated back-catalogue rows is worse than
   * contributing nothing to it — the shelf's promise has to stay true.
   */
  async getLatestUpdates(page: number = 1): Promise<ISearch<ManhwaRow>> {
    if (page > 1) return this.empty(page);
    try {
      const { latest } = await this.homeShelves();
      return { currentPage: 1, hasNextPage: false, results: latest };
    } catch (e) {
      console.error('RizzComics getLatestUpdates error:', e);
      return this.empty(page);
    }
  }

  /**
   * The site's own "Popular Today" shelf — the `.bsx` block ONLY.
   *
   * The catalogue fallback is fine HERE, unlike in getLatestUpdates: `/series/`
   * is a list of series with no ordering claim attached, and a trending rail
   * degrading to "some series" is a weaker statement than a recency rail
   * degrading to "some old series presented as new".
   */
  async getPopularToday(): Promise<ISearch<ManhwaRow>> {
    try {
      const { popular } = await this.homeShelves();
      if (popular.length > 0) return { currentPage: 1, hasNextPage: false, results: popular.slice(0, 15) };
      return { currentPage: 1, hasNextPage: false, results: (await this.catalogue()).slice(0, 15) };
    } catch (e) {
      console.error('RizzComics getPopularToday error:', e);
      return this.empty(1);
    }
  }

  /**
   * Browse keeps the full catalogue. This used to delegate to
   * getLatestUpdates, so narrowing that to a 30-card board would have cut
   * browse down to a single page — see the same note in FlameComics.
   */
  async getSeries(page: number = 1, _filters?: any): Promise<ISearch<IMangaResult>> {
    try {
      return this.paginate(await this.catalogue(), page);
    } catch (e) {
      console.error('RizzComics getSeries error:', e);
      return this.empty(page);
    }
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
