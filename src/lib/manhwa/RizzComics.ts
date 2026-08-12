import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import * as cheerio from 'cheerio';

export default class RizzComics extends MangaParser {
  override readonly name = 'RizzComics';
  protected override readonly baseUrl = 'https://rizzfables.com';
  protected override readonly logo = 'https://rizzfables.com/wp-content/uploads/2023/11/Rizz-Fables-Logo.png';
  protected override readonly classPath = 'MANGA.RizzComics';

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  }

  private extractSlug(url: string | undefined): string {
    if (!url) return '';
    const match = /\/series\/([^/]+)/.exec(url);
    return match ? match[1] : '';
  }

  async getLatestUpdates(page: number = 1): Promise<ISearch<IMangaResult>> { return this.search('', page); }
  async getPopularToday(): Promise<ISearch<IMangaResult>> { return this.search('', 1); }
  async getSeries(page: number = 1, filters?: any): Promise<ISearch<IMangaResult>> { return this.search('', page); }

  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`;
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      const results: IMangaResult[] = [];

      $('.bsx').each((_, el) => {
        const $el = $(el);
        const title = $el.find('.tt').text().trim() || $el.find('a').attr('title')?.trim();
        const href = $el.find('a').attr('href');
        const image = $el.find('img').attr('src');
        const latestChapter = $el.find('.epxs').text().trim();
        
        const slug = this.extractSlug(href);
        if (slug && title) {
          results.push({
            id: `rzc:${slug}`,
            title,
            image,
            latestChapter,
          });
        }
      });

      const hasNextPage = $('.pagination .next').length > 0;
      return { currentPage: page, hasNextPage, results };
    } catch (e) {
      console.error('RizzComics search error:', e);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const slug = mangaId.replace('rzc:', '');
    const url = `${this.baseUrl}/series/${slug}/`;
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);

      const title = $('.entry-title').text().trim();
      const image = $('.thumb img').attr('src');
      const description = $('.entry-content p').text().trim() || $('.entry-content').text().trim();
      
      let status = MediaStatus.UNKNOWN;
      const statusText = $('.imptdt:contains("Status") i').text().trim().toLowerCase();
      if (statusText.includes('ongoing')) status = MediaStatus.ONGOING;
      else if (statusText.includes('completed')) status = MediaStatus.COMPLETED;
      else if (statusText.includes('dropped')) status = MediaStatus.CANCELLED;
      else if (statusText.includes('hiatus')) status = MediaStatus.HIATUS;

      const chapters: IMangaChapter[] = [];
      $('#chapterlist li').each((_, el) => {
        const $el = $(el);
        const cTitle = $el.find('.chapternum').text().trim();
        const cDate = $el.find('.chapterdate').text().trim();
        const cHref = $el.find('a').attr('href');
        
        if (cHref) {
          const cSlugMatch = /\/series\/[^/]+\/([^/]+)/.exec(cHref);
          if (cSlugMatch) {
            chapters.push({
              id: `rzc:${slug}|${cSlugMatch[1]}`,
              title: cTitle,
              releaseDate: cDate,
            });
          }
        }
      });

      return {
        id: mangaId,
        title,
        image,
        description,
        status,
        chapters,
      };
    } catch (e) {
      console.error(`RizzComics fetchMangaInfo error for ${slug}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace('rzc:', '');
    const parts = rawId.split('|');
    if (parts.length !== 2) throw new Error('Invalid RizzComics chapter ID');
    
    const [seriesSlug, chapterSlug] = parts;
    const url = `${this.baseUrl}/series/${seriesSlug}/${chapterSlug}/`;

    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      const pages: IMangaChapterPage[] = [];
      
      $('#readerarea img').each((index, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src) {
          pages.push({
            page: index + 1,
            img: src.trim(),
          });
        }
      });

      return pages;
    } catch (e) {
      console.error(`RizzComics fetchChapterPages error for ${rawId}:`, e);
      throw e;
    }
  }
}
