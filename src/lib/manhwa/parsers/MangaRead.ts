import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';

export default class MangaRead extends MangaParser {
  override readonly name = 'MangaRead';
  protected override readonly baseUrl = 'https://www.mangaread.org';
  protected override readonly logo = 'https://www.mangaread.org/wp-content/uploads/2017/10/log1.png';
  protected override readonly classPath = 'MANGA.MangaRead';

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    this.client.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
  }

  private extractMangaSlug(url: string | undefined): string {
    if (!url) return '';
    // https://www.mangaread.org/manga/blinded-by-the-setting-sun/
    const match = /\/manga\/([^/]+)/.exec(url);
    return match ? match[1] : '';
  }

  private extractChapterSlug(url: string | undefined): string {
    if (!url) return '';
    // https://www.mangaread.org/manga/blinded-by-the-setting-sun/chapter-229-5/
    const match = /\/manga\/([^/]+\/[^/]+)/.exec(url);
    return match ? match[1] : '';
  }

  override async search(query: string, page: number = 1): Promise<ISearch<IMangaResult>> {
    const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    
    try {
      const html = await this.request<string>(url);
      const results: IMangaResult[] = [];
      
      const blocks = html.split('class="row c-tabs-item__content"');
      
      for (let i = 1; i < blocks.length; i++) {
        const itemHtml = blocks[i];
        
        const titleMatch = /<h3[^>]*class="h4"[^>]*>\s*<a href="([^"]+)">([^<]+)<\/a>/i.exec(itemHtml);
        const imgMatch = /<img[^>]+src="([^"]+)"/i.exec(itemHtml);
        const chapMatch = /<span class="font-meta chapter[^"]*">\s*<a[^>]*>([^<]+)<\/a>/i.exec(itemHtml);
        
        if (titleMatch) {
          const href = titleMatch[1];
          const title = titleMatch[2].trim();
          const slug = this.extractMangaSlug(href);
          const image = imgMatch ? imgMatch[1].trim() : undefined;
          const latestChapter = chapMatch ? chapMatch[1].trim() : undefined;
          
          if (slug) {
            results.push({
              id: `mrd:${slug}`,
              title,
              image,
              latestChapter
            });
          }
        }
      }
      
      const hasNextPage = html.includes('nav-previous') || html.includes('class="next page-numbers"');

      return {
        currentPage: page,
        hasNextPage,
        results
      };
    } catch (e) {
      console.error('MangaRead search error:', e);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const slug = mangaId.replace('mrd:', '');
    const url = `${this.baseUrl}/manga/${slug}/`;
    
    try {
      const html = await this.request<string>(url);
      
      const titleMatch = /<div class="post-title">\s*<h1>\s*(.*?)\s*<\/h1>/i.exec(html);
      const title = titleMatch ? titleMatch[1].trim() : slug;
      
      const imgMatch = /<div class="summary_image">[\s\S]*?<img[^>]+src="([^"]+)"/i.exec(html);
      const image = imgMatch ? imgMatch[1].trim() : undefined;
      
      const descMatch = /class="description-summary">[\s\S]*?<div class="summary__content[^"]*">([\s\S]*?)<\/div>/i.exec(html);
      let description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      let status = MediaStatus.UNKNOWN;
      if (html.includes('Completed')) status = MediaStatus.COMPLETED;
      else if (html.includes('OnGoing') || html.includes('Ongoing')) status = MediaStatus.ONGOING;
      
      const chapters: IMangaChapter[] = [];
      const chapRegex = /<li[^>]*class="wp-manga-chapter[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let chapMatch;
      
      while ((chapMatch = chapRegex.exec(html)) !== null) {
        const cHref = chapMatch[1];
        const cTitle = chapMatch[2].trim();
        const cSlug = this.extractChapterSlug(cHref);
        
        if (cSlug) {
          chapters.push({
            id: `mrd:${cSlug}`,
            title: cTitle
          });
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
      console.error(`MangaRead fetchMangaInfo error for ${slug}:`, e);
      throw e;
    }
  }

  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawSlug = chapterId.replace('mrd:', ''); // e.g. blinded-by-the-setting-sun/chapter-229-5
    const url = `${this.baseUrl}/manga/${rawSlug}/`;
    
    try {
      const html = await this.request<string>(url);
      const pages: IMangaChapterPage[] = [];
      
      const imgRegex = /<img[^>]+id="image-\d+"[^>]+src="\s*([^"\s]+)\s*"/gi;
      let imgMatch;
      let index = 1;
      
      while ((imgMatch = imgRegex.exec(html)) !== null) {
        pages.push({
          page: index++,
          img: imgMatch[1].trim()
        });
      }
      
      return pages;
    } catch (e) {
      console.error(`MangaRead fetchChapterPages error for ${rawSlug}:`, e);
      throw e;
    }
  }
}
