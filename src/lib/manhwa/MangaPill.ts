import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import * as cheerio from 'cheerio';
import { ManhwaRow, isoFromDateString } from './recency';

/**
 * MANGAPILL — the one new source with real server-side paging, and the one
 * that publishes no total at all.
 *
 * Its search endpoint was already correct and is left alone in shape: ids stay
 * `mpl:<numeric-id>/<slug>` for series and `mpl:<id>-<n>/<slug>` for chapters,
 * because search DID work and those ids may already be sitting in someone's
 * bookmarks and reading-progress rows.
 *
 * WHAT WAS BROKEN: every listing call went through `search('')`, and a search
 * with an EMPTY QUERY returns zero rows (verified — `/search?q=&page=1` parses
 * to nothing). `getSeries`, `getPopularToday` and `getLatestUpdates` all did
 * exactly that, so MangaPill contributed nothing to browse and nothing to the
 * home rails. Those three now read real listing pages instead.
 *
 * THE CARD MARKUP DIFFERS BETWEEN THE TWO, which is the other half of the same
 * bug. On a SEARCH page the `/manga/` anchor wraps the cover image. On the
 * `/chapters` and home listings it does not — the image lives in a SIBLING
 * anchor, and the old parser required an image inside the anchor before it
 * would keep a row. `findImage` walks outward from the link instead, so both
 * shapes parse.
 *
 * NO TOTAL, EVER. Its pager renders a single "Next" link and no last-page
 * number, so this source is BLIND in the sense src/lib/explorePaging.ts uses:
 * it can say another page exists but never how many. That is exactly why the
 * merged search total degrades — see combineTotals' blind-source rule. Nothing
 * here may invent a count to paper over it.
 */
export default class MangaPill extends MangaParser {
  override readonly name = 'MangaPill';
  protected override readonly baseUrl = 'https://mangapill.com';
  protected override readonly logo = 'https://mangapill.com/static/favicon/apple-touch-icon.png';
  protected override readonly classPath = 'MANGA.MangaPill';

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  }

  private extractSlug(url: string | undefined): string {
    if (!url) return '';
    // /manga/8136/solo-leveling-novel -> 8136/solo-leveling-novel
    const match = /\/manga\/([^/]+\/[^/?#]+)/.exec(url) || /\/manga\/([^/?#]+)/.exec(url);
    return match ? match[1] : '';
  }

  /**
   * The cover for this card, wherever it happens to sit.
   *
   * Search wraps the <img> inside the /manga/ anchor; the listings put it in a
   * sibling. Walking up a couple of ancestors finds it in both without having
   * to hard-code either layout. `data-src` first — these listings are lazy-
   * loaded and `src` is a placeholder until the browser gets there.
   */
  private findImage($el: cheerio.Cheerio<any>): string | undefined {
    let node: cheerio.Cheerio<any> | undefined = $el;
    for (let depth = 0; depth < 3 && node && node.length; depth++) {
      const img = node.find('img').first();
      const src = img.attr('data-src') || img.attr('src');
      if (src && src.trim()) return src.trim();
      node = node.parent();
    }
    return undefined;
  }

  /** The chapter label on a listing card ("#198"), when the card carries one. */
  private findLatestChapter($el: cheerio.Cheerio<any>): string | undefined {
    let node: cheerio.Cheerio<any> | undefined = $el;
    for (let depth = 0; depth < 3 && node && node.length; depth++) {
      const a = node.find('a[href^="/chapters/"]').first();
      const text = a.text().trim();
      if (text) return text.replace(/^#/, 'Chapter ');
      node = node.parent();
    }
    return undefined;
  }

  /**
   * The release time of the chapter this card is announcing.
   *
   * `/chapters` cards carry `<time-ago datetime="2026-08-12T21:12:21Z">`, a
   * custom element whose text the site rewrites client-side into "3 hours ago".
   * The ATTRIBUTE is the exact instant and needs no relative-time parsing; the
   * text is a rendering of it and would have to be parsed back, badly.
   *
   * It sits in a sibling `div` of the `/manga/` anchor, so this walks outward
   * exactly like findImage and findLatestChapter rather than looking inside the
   * link — the card layout is a flat `div.px-1` with the anchor, the chapter
   * number and the timestamp as peers.
   */
  private findReleaseDate($el: cheerio.Cheerio<any>): string | undefined {
    let node: cheerio.Cheerio<any> | undefined = $el;
    for (let depth = 0; depth < 3 && node && node.length; depth++) {
      const dt = node.find('time-ago[datetime], time[datetime]').first().attr('datetime');
      const iso = isoFromDateString(dt);
      if (iso) return iso;
      node = node.parent();
    }
    return undefined;
  }

  /**
   * Parse every series card on a page. Shared by search and the listings, so
   * one markup change cannot fix one and silently break the other.
   *
   * A missing cover is NOT a reason to drop a row — the grid renders a
   * placeholder, and dropping the row instead loses a real series from the
   * merged page for a cosmetic reason.
   *
   * A missing TIMESTAMP is likewise not a reason to drop a row: only the
   * `/chapters` board carries one, and search and the home shelf legitimately
   * do not. `updatedAt` stays undefined there, which the merged recency sort
   * reads as "this source did not say" rather than as "now".
   */
  private parseCards(html: string): ManhwaRow[] {
    const $ = cheerio.load(html);
    const results: ManhwaRow[] = [];
    const seen = new Set<string>();

    $('a[href^="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const slug = this.extractSlug(href);
      if (!slug || seen.has(slug)) return;

      const title =
        $el.find('.font-bold').first().text().trim() ||
        $el.find('div').first().text().trim() ||
        $el.text().trim();
      if (!title) return;

      seen.add(slug);
      results.push({
        id: `mpl:${slug}`,
        title,
        image: this.findImage($el),
        latestChapter: this.findLatestChapter($el),
        updatedAt: this.findReleaseDate($el),
      });
    });

    return results;
  }

  /**
   * Does the pager offer a page AFTER this one?
   *
   * Read off the pager's own `page=` links rather than the text of a button:
   * the number is unambiguous, and a link to page N+1 is the site itself
   * saying the page exists. `&amp;` is decoded first — the hrefs are HTML
   * escaped, so a bare /page=/ test misses them.
   */
  private hasNextFrom(html: string, page: number): boolean {
    const decoded = (html || '').replace(/&amp;/gi, '&');
    for (const m of decoded.matchAll(/[?&]page=(\d+)/g)) {
      if (Number(m[1]) > page) return true;
    }
    return false;
  }

  private empty(page: number): ISearch<ManhwaRow> {
    return { currentPage: page, hasNextPage: false, results: [] };
  }

  /**
   * Latest releases. `/chapters` is MangaPill's own newest-chapters board, so
   * these rows are genuinely fresh rather than "whatever search returned".
   * One page only — the board is not addressable by page number.
   *
   * RE-VERIFIED against the live board rather than trusted: it announces itself
   * as "120 most recent chapters", renders exactly 120 cards, and their
   * `time-ago` datetimes are strictly descending from now back about two days
   * (2026-08-12T21:12Z → 2026-08-10T12:13Z). So this endpoint was already
   * correct and its ENDPOINT is unchanged; the only addition is reading the
   * timestamp that was on the page all along, so these rows can be interleaved
   * with the other sources instead of being concatenated after them.
   *
   * The board is deduplicated by SERIES, not by chapter, by parseCards' `seen`
   * set — a series that released three chapters today contributes one row,
   * dated by whichever of its cards comes first, which on a descending board is
   * its newest.
   */
  async getLatestUpdates(page: number = 1): Promise<ISearch<ManhwaRow>> {
    if (page > 1) return this.empty(page);
    try {
      const html = await this.request<string>(`${this.baseUrl}/chapters`);
      return { currentPage: 1, hasNextPage: false, results: this.parseCards(html) };
    } catch (e) {
      console.error('MangaPill getLatestUpdates error:', e);
      return this.empty(page);
    }
  }

  async getPopularToday(): Promise<ISearch<ManhwaRow>> {
    try {
      const html = await this.request<string>(`${this.baseUrl}/`);
      /**
       * POPULAR ONLY — the same shelf-mixing bug that was just fixed for Rizz,
       * in the other source. mangapill.com/ renders TWO blocks: 8 popular
       * anchors carrying no <time-ago>, then a latest-chapters block where
       * every anchor carries one. parseCards returns document order, so a bare
       * slice(0, 15) took the 8 real popular rows plus 7 rows whose only claim
       * was being recent.
       *
       * The timestamp IS the discriminator: a card with no date is a
       * popularity card. Filtering on its absence needs no new selector and
       * cannot drift if they reorder the page.
       */
      const rows = this.parseCards(html).filter((r) => !r.updatedAt);
      return { currentPage: 1, hasNextPage: false, results: rows.slice(0, 15) };
    } catch (e) {
      console.error('MangaPill getPopularToday error:', e);
      return this.empty(1);
    }
  }

  /**
   * MangaPill publishes no addressable browse listing — `/mangas` is a 404 —
   * so it contributes its home shelf to browse page 1 and nothing beyond,
   * rather than pretending to page. Returning `hasNextPage: false` here is
   * what keeps it from claiming pages it cannot serve.
   */
  async getSeries(page: number = 1, _filters?: any): Promise<ISearch<IMangaResult>> {
    if (page > 1) return this.empty(page);
    try {
      const html = await this.request<string>(`${this.baseUrl}/`);
      return { currentPage: 1, hasNextPage: false, results: this.parseCards(html) };
    } catch (e) {
      console.error('MangaPill getSeries error:', e);
      return this.empty(page);
    }
  }

  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    // An empty query returns an empty result set here, and the listing methods
    // above no longer route through this path.
    if (!query || !query.trim()) return this.empty(page);

    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
    try {
      const html = await this.request<string>(url);
      return {
        currentPage: page,
        hasNextPage: this.hasNextFrom(html, page),
        results: this.parseCards(html),
        // NO totalPages. The pager only ever links the next page, so the last
        // one is genuinely unknown. See the note at the top of this file.
      };
    } catch (e) {
      console.error('MangaPill search error:', e);
      return this.empty(page);
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const slug = mangaId.replace(/^mpl:/, '');
    const url = `${this.baseUrl}/manga/${slug}`;
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim();
      const image = this.findImage($('img').first());
      const description = $('.text-sm.text-ts-2').text().trim();

      let status = MediaStatus.UNKNOWN;
      const htmlLower = html.toLowerCase();
      if (htmlLower.includes('publishing')) status = MediaStatus.ONGOING;
      else if (htmlLower.includes('finished')) status = MediaStatus.COMPLETED;

      const chapters: IMangaChapter[] = [];
      const seen = new Set<string>();
      $('#chapters a[href^="/chapters/"]').each((_, el) => {
        const $el = $(el);
        const cTitle = $el.text().trim();
        const cHref = $el.attr('href');
        if (!cHref) return;

        // /chapters/8136-20203000/solo-leveling-novel-chapter-203
        const m = /\/chapters\/([^/]+\/[^/?#]+)/.exec(cHref) || /\/chapters\/([^/?#]+)/.exec(cHref);
        if (!m || seen.has(m[1])) return;
        seen.add(m[1]);
        chapters.push({ id: `mpl:${m[1]}`, title: cTitle });
      });

      /**
       * NO REVERSE. MangaPill already lists chapters NEWEST FIRST.
       *
       * The long-standing comment here claimed the opposite ("lists chapters
       * ascending") and flipped the array to compensate. Measured against the
       * live `#chapters` list on three series — dandadan (243→1), kengan-omega
       * (366→0) and kagurabachi (128→1) — the DOM order is DESCENDING in every
       * case, so the flip was inverting a list that was already correct.
       *
       * That inversion is not cosmetic: the detail page reads
       * `chapters[chapters.length - 1]` as "start from chapter one" and
       * `chapters.find(unlocked)` as "latest", so every MangaPill series
       * offered the newest chapter as its starting point and chapter one as
       * its latest. Newest-first also matches what the other three sources
       * hand back (FlameComics sorts descending explicitly; Rizz and Asura
       * publish descending), which is the ordering every consumer assumes.
       */

      return { id: mangaId, title, image, description, status, chapters };
    } catch (e) {
      console.error(`MangaPill fetchMangaInfo error for ${slug}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace(/^mpl:/, '');
    const url = `${this.baseUrl}/chapters/${rawId}`;

    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      const pages: IMangaChapterPage[] = [];
      const seen = new Set<string>();

      $('picture img').each((_, el) => {
        const src = ($(el).attr('data-src') || $(el).attr('src') || '').trim();
        if (!src || seen.has(src)) return;
        seen.add(src);
        pages.push({ page: pages.length + 1, img: src });
      });

      return pages;
    } catch (e) {
      console.error(`MangaPill fetchChapterPages error for ${rawId}:`, e);
      throw e;
    }
  }
}
