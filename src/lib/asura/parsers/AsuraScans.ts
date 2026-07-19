import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  MediaStatus,
  IMangaChapterPage,
  IMangaChapter,
} from '../models';

class AsuraScans extends MangaParser {
  override readonly name = 'AsuraScans';
  protected override baseUrl = 'https://api.asurascans.com/api';
  private readonly fallbackProxies = [
    'https://goodproxy.goodproxy.workers.dev/fetch?url='
  ];
  private currentProxyIndex = -1; // Start with direct access (no proxy)
  protected override logo = 'https://asuracomic.net/images/logo.png';
  protected override classPath = 'MANGA.AsuraScans';

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    this.client.defaults.headers.common['Accept'] = 'application/json, text/plain, */*';
    this.client.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.9';
    this.client.defaults.headers.common['Referer'] = 'https://asuracomic.net/';
    this.client.defaults.headers.common['Origin'] = 'https://asuracomic.net';
  }

  private getProxiedUrl(path: string): string {
    const url = `${this.baseUrl}/${path}`;
    if (this.currentProxyIndex < 0) {
      return url;
    }
    const proxy = this.fallbackProxies[this.currentProxyIndex % this.fallbackProxies.length];
    return `${proxy}${encodeURIComponent(url)}`;
  }

  protected async requestWithFallback<T = any>(path: string): Promise<T> {
    try {
      this.currentProxyIndex = -1;
      return await this.request<T>(this.getProxiedUrl(path));
    } catch (error: any) {
      console.log(`Direct access failed, trying proxy: ${error.message}`);
      if (
        !error.response || 
        error.response.status === 403 || 
        error.response.status === 429 ||
        error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ERR_NETWORK'
      ) {
        try {
          this.currentProxyIndex = 0;
          return await this.request<T>(this.getProxiedUrl(path));
        } catch (proxyError: any) {
          throw proxyError;
        }
      } else {
        throw error;
      }
    }
  }

  private determineMediaState(state: string): MediaStatus {
    switch (state?.toLowerCase().trim()) {
      case 'completed':
        return MediaStatus.COMPLETED;
      case 'ongoing':
        return MediaStatus.ONGOING;
      case 'dropped':
        return MediaStatus.CANCELLED;
      case 'hiatus':
        return MediaStatus.HIATUS;
      default:
        return MediaStatus.UNKNOWN;
    }
  }

  private mapMangaResult(item: any): IMangaResult {
    return {
      id: item.slug || item.id.toString(), // Use slug as ID since we need it for chapters
      title: item.title,
      image: item.cover || item.cover_url,
      status: this.determineMediaState(item.status),
      rating: item.rating ? item.rating.toString() : '',
      latestChapter: item.chapter_count ? `Chapter ${item.chapter_count}` : undefined,
      latest_chapters: item.latest_chapters,
    };
  }

  // AsuraScans' API pages by ?per_page. Both browse and search share the size.
  private static readonly PER_PAGE = 20;

  async getLatestUpdates(page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      // The API IGNORES ?page= (every page returns the same first 20 series) —
      // it paginates by ?offset= instead. Convert the 1-based page to an offset.
      const per = AsuraScans.PER_PAGE;
      const offset = (Math.max(1, page) - 1) * per;
      const data = await this.requestWithFallback<any>(`series?offset=${offset}`);
      const items = data.data || [];
      const total = Number(data.meta?.total) || 0;
      return {
        currentPage: page,
        // Trust the API's own has_more; fall back to an offset/total check.
        hasNextPage: data.meta?.has_more === true || (total > 0 && offset + items.length < total),
        results: items.map((i: any) => this.mapMangaResult(i)),
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      // We fetch page 1 and sort them by popularity rank locally since the API doesn't seem to have a strict order param documented
      // Wait, we can try `series?page=1` and sort by popularity_rank or view_count
      const data = await this.requestWithFallback<any>(`series?page=1`);
      let items = data.data || [];
      items = items.sort((a: any, b: any) => (a.popularity_rank || 9999) - (b.popularity_rank || 9999));
      
      return {
        currentPage: 1,
        hasNextPage: false,
        results: items.slice(0, 15).map((i: any) => this.mapMangaResult(i)),
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  async getSeries(page: number = 1): Promise<ISearch<IMangaResult>> {
    return this.getLatestUpdates(page);
  }

  override search = async (query: string, page: number = 1): Promise<ISearch<IMangaResult>> => {
    try {
      // Same offset-based pagination as browse (?page= is ignored upstream).
      const per = AsuraScans.PER_PAGE;
      const offset = (Math.max(1, page) - 1) * per;
      const formattedQuery = encodeURIComponent(query);
      const data = await this.requestWithFallback<any>(`series?offset=${offset}&name=${formattedQuery}`);
      const items = data.data || [];
      const total = Number(data.meta?.total) || 0;

      return {
        currentPage: page,
        hasNextPage: data.meta?.has_more === true || (total > 0 && offset + items.length < total),
        results: items.map((i: any) => this.mapMangaResult(i)),
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchMangaInfo = async (mangaId: string): Promise<IMangaInfo> => {
    try {
      // mangaId is the slug
      const data = await this.requestWithFallback<any>(`series/${mangaId}`);
      const series = data.series || data.data; // Depending on exact API structure

      if (!series) {
        throw new Error('Series not found');
      }

      const info: IMangaInfo = {
        id: mangaId,
        title: series.title,
        image: series.cover || series.cover_url,
        rating: series.rating ? series.rating.toString() : '',
        status: this.determineMediaState(series.status),
        description: series.description,
        authors: series.author ? series.author.split(',') : [],
        artist: series.artist,
        updatedOn: series.updated_at,
        genres: series.genres ? series.genres.map((g: any) => g.name || g.title) : [],
        recommendations: (data.recommended_series || []).map((i: any) => this.mapMangaResult(i)),
      };

      // Fetch chapters
      try {
        const chaptersData = await this.requestWithFallback<any>(`series/${mangaId}/chapters`);
        const chaptersList = chaptersData.data || [];
        info.chapters = chaptersList.map((chap: any): IMangaChapter => {
          // A chapter might be locked if is_locked is true, is_premium is true, or early_access_until is in the future
          const isEarlyAccess = chap.early_access_until ? new Date(chap.early_access_until) > new Date() : false;
          const isLocked = chap.is_locked || chap.is_premium || isEarlyAccess;
          
          return {
            id: `${mangaId}|${chap.number}`, // We embed slug and chapter number
            title: chap.title || `Chapter ${chap.number}`,
            releaseDate: chap.published_at,
            isLocked: !!isLocked,
            earlyAccessUntil: chap.early_access_until,
          };
        });
      } catch (e) {
        console.error('Failed to fetch chapters:', e);
        info.chapters = [];
      }

      return info;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchChapterPages = async (chapterId: string): Promise<IMangaChapterPage[]> => {
    try {
      // chapterId is in the format "slug|number"
      const parts = chapterId.split('|');
      if (parts.length !== 2) {
        throw new Error('Invalid chapter ID format');
      }
      const [seriesSlug, chapterNumber] = parts;
      
      const data = await this.requestWithFallback<any>(`series/${seriesSlug}/chapters/${chapterNumber}`);
      
      const chapterData = data.data?.chapter || {};
      
      if (chapterData.is_premium && !chapterData.pages) {
        throw new Error('Premium chapter is locked');
      }

      const pages: { url: string }[] = chapterData.pages || [];
      
      if (pages.length === 0) {
        throw new Error('No pages found');
      }

      return pages.map((page, index): IMangaChapterPage => ({
        page: index + 1,
        img: page.url,
      }));
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };
}

export default AsuraScans;
