import * as cheerio from 'cheerio';
import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '../models';

export default class Manganato extends MangaParser {
  override readonly name = 'Manganato';
  protected override readonly baseUrl = 'https://manganato.com';
  // Most series and all chapters are on chapmanganato
  protected readonly readerUrl = 'https://chapmanganato.to'; 
  protected override readonly logo = 'https://manganato.com/favicon.ico';
  protected override readonly classPath = 'MANGA.Manganato';

  constructor() {
    super();
    // Real headers to avoid cloaking/blocks
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    this.client.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    this.client.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.9';
    this.client.defaults.headers.common['Referer'] = 'https://manganato.com/';
  }

  private extractMangaId(url: string | undefined): string {
    if (!url) return '';
    const parts = url.split('/');
    return parts.pop() || '';
  }

  private extractChapterId(url: string | undefined): string {
    if (!url) return '';
    // Given https://chapmanganato.to/manga-xx123/chapter-1
    // We want to return "manga-xx123/chapter-1"
    const parts = url.split('/');
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return parts.pop() || '';
  }

  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    const formattedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const url = `${this.baseUrl}/search/story/${formattedQuery}?page=${page}`;
    
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      
      const results: IMangaResult[] = [];
      
      $('.search-story-item').each((_, el) => {
        const titleEl = $(el).find('.item-title');
        const title = titleEl.text().trim();
        const href = titleEl.attr('href');
        const id = this.extractMangaId(href);
        const image = $(el).find('.item-img img').attr('src');
        const latestChapter = $(el).find('.item-chapter a').first().text().trim();
        
        if (id && title) {
          results.push({
            id: `mna:${id}`,
            title,
            image,
            latestChapter
          });
        }
      });
      
      // If there's a next page link
      const hasNextPage = $('.group-page a.page-blue').last().text().includes('LAST') || 
                          $('.group-page a.page-blue').last().text().includes('NEXT');

      return {
        currentPage: page,
        hasNextPage,
        results
      };
    } catch (e) {
      console.error('Manganato search error:', e);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const id = mangaId.replace('mna:', '');
    const url = `${this.readerUrl}/${id}`;
    
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      
      const title = $('.story-info-right h1').text().trim();
      const image = $('.info-image img').attr('src');
      
      let description = $('#panel-story-info-description').text().trim();
      description = description.replace(/^Description\s*:\s*/i, '');
      
      const genres: string[] = [];
      let status = MediaStatus.UNKNOWN;
      let authors: string[] = [];
      
      $('.story-info-right table.variations-tableInfo tbody tr').each((_, el) => {
        const label = $(el).find('.info-alternative').text().trim().toLowerCase();
        if (label.includes('author')) {
          $(el).find('.table-value a').each((_, aEl) => {
            authors.push($(aEl).text().trim());
          });
        } else if (label.includes('status')) {
          const statText = $(el).find('.table-value').text().trim().toLowerCase();
          if (statText.includes('ongoing')) status = MediaStatus.ONGOING;
          else if (statText.includes('completed')) status = MediaStatus.COMPLETED;
        } else if (label.includes('genres')) {
          $(el).find('.table-value a').each((_, aEl) => {
            genres.push($(aEl).text().trim());
          });
        }
      });
      
      const chapters: IMangaChapter[] = [];
      $('.panel-story-chapter-list ul li').each((_, el) => {
        const aEl = $(el).find('a.chapter-name');
        const cTitle = aEl.text().trim();
        const cHref = aEl.attr('href');
        const cId = this.extractChapterId(cHref);
        const date = $(el).find('.chapter-time').text().trim();
        
        if (cId) {
          chapters.push({
            id: `mna:${cId}`,
            title: cTitle,
            releaseDate: date
          });
        }
      });
      
      return {
        id: mangaId,
        title,
        image,
        description,
        status,
        authors: authors.length ? authors : undefined,
        genres: genres.length ? genres : undefined,
        chapters
      };
    } catch (e) {
      console.error(`Manganato fetchMangaInfo error for ${id}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace('mna:', ''); // e.g. manga-xx123/chapter-1
    const url = `${this.readerUrl}/${rawId}`;
    
    try {
      const html = await this.request<string>(url);
      const $ = cheerio.load(html);
      
      const pages: IMangaChapterPage[] = [];
      
      $('.container-chapter-reader img').each((index, el) => {
        const src = $(el).attr('src');
        if (src) {
          pages.push({
            page: index + 1,
            img: src
          });
        }
      });
      
      return pages;
    } catch (e) {
      console.error(`Manganato fetchChapterPages error for ${rawId}:`, e);
      throw e;
    }
  }
}
