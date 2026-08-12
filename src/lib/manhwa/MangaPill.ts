import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import * as cheerio from 'cheerio';

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
    const match = /\/manga\/([^/]+\/[^/]+)/.exec(url) || /\/manga\/([^/]+)/.exec(url);
    return match ? match[1] : '';
  }

  async getLatestUpdates(page: number = 1): Promise<ISearch<IMangaResult>> { return this.search('', page); }
  async getPopularToday(): Promise<ISearch<IMangaResult>> { return this.search('', 1); }
  async getSeries(page: number = 1, filters?: any): Promise<ISearch<IMangaResult>> { return this.search('', page); }

  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    // MangaPill search doesn't explicitly use page numbers in standard URL unless it's like ?page=2
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      const results: IMangaResult[] = [];

      // Grid items usually contain the manga links
      $('a[href^="/manga/"]').each((_, el) => {
        const $el = $(el);
        const parent = $el.parent(); // usually a div wrapping the card
        
        const title = $el.find('.font-bold').text().trim() || $el.text().trim();
        const href = $el.attr('href');
        const image = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        
        // Find latest chapter if possible
        let latestChapter = undefined;
        parent.find('a[href^="/chapters/"]').each((i, chapEl) => {
           if (i === 0) latestChapter = $(chapEl).text().trim();
        });

        const slug = this.extractSlug(href);
        if (slug && title && image) {
          // Avoid duplicates (sometimes there are multiple links to the same manga)
          if (!results.find(r => r.id === `mpl:${slug}`)) {
            results.push({
              id: `mpl:${slug}`,
              title,
              image,
              latestChapter,
            });
          }
        }
      });

      // Simple next page check
      const hasNextPage = $('a:contains("Next")').length > 0;
      return { currentPage: page, hasNextPage, results };
    } catch (e) {
      console.error('MangaPill search error:', e);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const slug = mangaId.replace('mpl:', '');
    const url = `${this.baseUrl}/manga/${slug}`;
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim();
      const image = $('img').first().attr('data-src') || $('img').first().attr('src');
      const description = $('.text-sm.text-ts-2').text().trim();
      
      let status = MediaStatus.UNKNOWN;
      const htmlLower = html.toLowerCase();
      if (htmlLower.includes('publishing')) status = MediaStatus.ONGOING;
      else if (htmlLower.includes('finished')) status = MediaStatus.COMPLETED;
      else if (htmlLower.includes('on hiatus')) status = MediaStatus.HIATUS;

      const chapters: IMangaChapter[] = [];
      $('#chapters a[href^="/chapters/"]').each((_, el) => {
        const $el = $(el);
        const cTitle = $el.text().trim();
        const cHref = $el.attr('href');
        
        if (cHref) {
          // /chapters/8136-20203000/solo-leveling-novel-chapter-203
          const cSlugMatch = /\/chapters\/([^/]+\/[^/]+)/.exec(cHref) || /\/chapters\/([^/]+)/.exec(cHref);
          if (cSlugMatch) {
            chapters.push({
              id: `mpl:${cSlugMatch[1]}`,
              title: cTitle,
            });
          }
        }
      });

      // Chapters are usually descending or ascending, sort to make sure descending
      // We rely on standard display, usually they are listed ascending on MangaPill, let's reverse them
      chapters.reverse();

      return {
        id: mangaId,
        title,
        image,
        description,
        status,
        chapters,
      };
    } catch (e) {
      console.error(`MangaPill fetchMangaInfo error for ${slug}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace('mpl:', '');
    const url = `${this.baseUrl}/chapters/${rawId}`;

    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      const pages: IMangaChapterPage[] = [];
      
      $('picture img').each((index, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src');
        if (src) {
          pages.push({
            page: index + 1,
            img: src.trim(),
          });
        }
      });

      return pages;
    } catch (e) {
      console.error(`MangaPill fetchChapterPages error for ${rawId}:`, e);
      throw e;
    }
  }
}
