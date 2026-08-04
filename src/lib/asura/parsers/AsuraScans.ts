import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  MediaStatus,
  IMangaChapterPage,
  IMangaChapter,
} from '../models';

interface MangaFilters {
  status?: string;
  sort?: string;
}

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
      /**
       * WHICH FAILURES ARE WORTH RETRYING THROUGH THE PROXY.
       *
       * 5xx was missing, and that omission is most of why chapters go missing.
       * Asura sits behind Cloudflare, whose characteristic failures — 502, 503,
       * 520, 521, 522, 524 — all land in exactly the band this list excluded,
       * so the single most common upstream failure skipped the proxy entirely
       * and fell straight through to the caller. The proxy is alive and returns
       * correct data; it was simply never being asked.
       *
       * It also contradicted the retry loop in models/index.ts, which has
       * always treated `status >= 500` as transient. Two layers disagreeing
       * about what "transient" means is how this stayed hidden.
       */
      const status = error.response?.status;
      if (
        !error.response ||
        status === 403 ||
        status === 429 ||
        status >= 500 ||
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

  async getLatestUpdates(page: number = 1, filters?: MangaFilters): Promise<ISearch<IMangaResult>> {
    try {
      // The API IGNORES ?page= (every page returns the same first 20 series) —
      // it paginates by ?offset= instead. Convert the 1-based page to an offset.
      const per = AsuraScans.PER_PAGE;
      const offset = (Math.max(1, page) - 1) * per;
      let path = `series?offset=${offset}`;
      if (filters?.status) path += `&status=${encodeURIComponent(filters.status)}`;
      if (filters?.sort) path += `&sort=${encodeURIComponent(filters.sort)}`;
      const data = await this.requestWithFallback<any>(path);
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

  async getSeries(page: number = 1, filters?: MangaFilters): Promise<ISearch<IMangaResult>> {
    return this.getLatestUpdates(page, filters);
  }

  override search = async (query: string, page: number = 1, filters?: MangaFilters): Promise<ISearch<IMangaResult>> => {
    try {
      // AsuraScans filters by ?search= (NOT ?name=, which it silently ignores
      // and returns the full catalog). Paginate with ?offset= like browse.
      const per = AsuraScans.PER_PAGE;
      const offset = (Math.max(1, page) - 1) * per;
      const formattedQuery = encodeURIComponent(query);
      let path = `series?offset=${offset}&search=${formattedQuery}`;
      if (filters?.status) path += `&status=${encodeURIComponent(filters.status)}`;
      if (filters?.sort) path += `&sort=${encodeURIComponent(filters.sort)}`;
      const data = await this.requestWithFallback<any>(path);
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
        /**
         * A NULL PAYLOAD IS A FAILURE, NOT AN EMPTY SERIES.
         *
         * The endpoint answers HTTP 200 with `{"data": null}` for a slug it
         * cannot resolve. `null || []` is `[]` with no exception thrown, so the
         * catch below never fired and there was not even a console line — the
         * series rendered complete, with a cover and a synopsis, and simply had
         * no chapters. That silent path is the reason this looked like a
         * per-series data problem instead of a per-request one.
         *
         * An empty ARRAY is left alone: that genuinely means no chapters.
         */
        if (chaptersData.data == null) {
          throw new Error(`Asura returned no chapter payload for "${mangaId}"`);
        }
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
        /**
         * SAY THAT IT FAILED. Do not pretend the series has no chapters.
         *
         * This catch used to set `chapters = []` and return normally, so the
         * route answered 200 with a perfect-looking series and the reader
         * printed "No chapters available yet. Check back later!" — a sentence
         * that is a lie about a transient network error, and one the owner has
         * reported as a bug more than once because it is indistinguishable
         * from a genuinely empty series.
         *
         * The series info is still returned, because it IS good and throwing
         * would downgrade the page to "Series Not Found" — a worse and equally
         * untrue message. The flag lets the UI tell the truth and offer a
         * retry, which is the one thing that actually works here.
         */
        console.error('Failed to fetch chapters:', e);
        info.chapters = [];
        (info as any).chaptersFailed = true;
        (info as any).chaptersError = (e as Error)?.message || 'unknown error';
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
