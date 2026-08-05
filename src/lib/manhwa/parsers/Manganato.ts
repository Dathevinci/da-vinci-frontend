import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';

export default class Manganato extends MangaParser {
  override readonly name = 'Manganato';
  protected override readonly baseUrl = 'https://manganato.com';
  protected readonly readerUrl = 'https://chapmanganato.to'; 
  protected override readonly logo = 'https://manganato.com/favicon.ico';
  protected override readonly classPath = 'MANGA.Manganato';

  constructor() {
    super();
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
      const results: IMangaResult[] = [];
      
      const itemRegex = /<div class="search-story-item">([\s\S]*?)<\/div>(?=\s*<div class="search-story-item"|\s*<div class="panel-page-number)/g;
      let match;
      
      while ((match = itemRegex.exec(html)) !== null) {
        const itemHtml = match[1];
        
        const titleMatch = /<a[^>]*class="item-title"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i.exec(itemHtml);
        const imgMatch = /<img[^>]*src="([^"]+)"/i.exec(itemHtml);
        const chapterMatch = /<a[^>]*class="item-chapter"[^>]*>([^<]+)<\/a>/i.exec(itemHtml);
        
        if (titleMatch) {
          const href = titleMatch[1];
          const title = titleMatch[2].trim();
          const id = this.extractMangaId(href);
          const image = imgMatch ? imgMatch[1] : undefined;
          const latestChapter = chapterMatch ? chapterMatch[1].trim() : undefined;
          
          if (id) {
            results.push({
              id: `mna:${id}`,
              title,
              image,
              latestChapter
            });
          }
        }
      }
      
      const hasNextPage = html.includes('page-blue page-last') || html.includes('>NEXT<');

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
      
      const titleMatch = /<div class="story-info-right">[\s\S]*?<h1>([^<]+)<\/h1>/i.exec(html);
      const title = titleMatch ? titleMatch[1].trim() : id;
      
      const imgMatch = /<span class="info-image">[\s\S]*?<img[^>]*src="([^"]+)"/i.exec(html);
      const image = imgMatch ? imgMatch[1] : undefined;
      
      const descMatch = /<div id="panel-story-info-description"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
      let description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      description = description.replace(/^Description\s*:\s*/i, '').trim();
      
      let status = MediaStatus.UNKNOWN;
      if (html.includes('Ongoing</a>')) status = MediaStatus.ONGOING;
      else if (html.includes('Completed</a>')) status = MediaStatus.COMPLETED;
      
      const chapters: IMangaChapter[] = [];
      const chapListRegex = /<li class="a-h">([\s\S]*?)<\/li>/g;
      let chapMatch;
      
      while ((chapMatch = chapListRegex.exec(html)) !== null) {
        const itemHtml = chapMatch[1];
        const aMatch = /<a[^>]*href="([^"]+)"[^>]*class="chapter-name[^"]*"[^>]*>([^<]+)<\/a>/i.exec(itemHtml);
        const timeMatch = /<span class="chapter-time[^"]*"[^>]*>([^<]+)<\/span>/i.exec(itemHtml);
        
        if (aMatch) {
          const cHref = aMatch[1];
          const cTitle = aMatch[2].trim();
          const cId = this.extractChapterId(cHref);
          const date = timeMatch ? timeMatch[1].trim() : undefined;
          
          if (cId) {
            chapters.push({
              id: `mna:${cId}`,
              title: cTitle,
              releaseDate: date
            });
          }
        }
      }
      
      return {
        id: mangaId,
        title,
        image,
        description,
        status,
        chapters
      };
    } catch (e) {
      console.error(`Manganato fetchMangaInfo error for ${id}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace('mna:', ''); 
    const url = `${this.readerUrl}/${rawId}`;
    
    try {
      const html = await this.request<string>(url);
      
      const pages: IMangaChapterPage[] = [];
      
      const containerMatch = /<div class="container-chapter-reader">([\s\S]*?)<\/div>/i.exec(html);
      if (containerMatch) {
        const containerHtml = containerMatch[1];
        const imgRegex = /<img[^>]*src="([^"]+)"/gi;
        let imgMatch;
        let index = 1;
        
        while ((imgMatch = imgRegex.exec(containerHtml)) !== null) {
          pages.push({
            page: index++,
            img: imgMatch[1]
          });
        }
      }
      
      return pages;
    } catch (e) {
      console.error(`Manganato fetchChapterPages error for ${rawId}:`, e);
      throw e;
    }
  }
}
