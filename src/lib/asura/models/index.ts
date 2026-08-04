import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export enum MediaStatus {
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  UNKNOWN = 'Unknown'
}

export interface ILatestChapter {
  id: number;
  number: number;
  published_at: string;
  is_premium: boolean;
}

export interface IMangaResult {
  id: string;
  title: string;
  image?: string;
  status?: MediaStatus;
  latestChapter?: string;
  rating?: string;
  latest_chapters?: ILatestChapter[];
}

export interface IMangaChapter {
  id: string;
  title: string;
  releaseDate?: string;
  isLocked?: boolean;
  earlyAccessUntil?: string;
}

export interface IMangaChapterPage {
  page: number;
  img: string;
}

export interface IMangaInfo {
  id: string;
  title: string;
  image?: string;
  status?: MediaStatus;
  rating?: string;
  description?: string;
  authors?: string[];
  artist?: string;
  genres?: string[];
  updatedOn?: string;
  chapters?: IMangaChapter[];
  recommendations?: IMangaResult[];
}

export interface ISearch<T> {
  currentPage: number;
  hasNextPage: boolean;
  results: T[];
}

export abstract class MangaParser {
  protected abstract readonly baseUrl: string;
  protected abstract readonly logo: string;
  protected abstract readonly classPath: string;
  abstract readonly name: string;

  /**
   * A TIMEOUT, because axios defaults to 0 — wait forever.
   *
   * With no ceiling, a single hung upstream request could outlive the whole
   * serverless invocation. That is the worst possible failure here: the
   * function is killed, so nothing is returned, nothing is logged, and the
   * reader shows a generic error for what was really one slow socket.
   *
   * 12s is chosen against the retry budget rather than picked at random. The
   * loop below sleeps 1s + 2s + 3s between attempts, and fetchMangaInfo makes
   * two sequential calls that can each fall back to a proxy — so the ceiling
   * has to leave room for that whole chain inside the platform's limit.
   */
  protected client: AxiosInstance = axios.create({ timeout: 12_000 });

  /**
   * Makes a request with automatic retries for transient errors
   * @param url The URL to request
   * @param config Optional axios config
   * @param maxRetries Maximum number of retries (default: 3)
   * @param retryDelay Delay between retries in ms (default: 1000)
   */
  protected async request<T = any>(
    url: string, 
    config?: AxiosRequestConfig,
    maxRetries = 3,
    retryDelay = 1000
  ): Promise<T> {
    let retries = 0;
    
    while (true) {
      try {
        const response = await this.client.request<T>({
          url,
          ...config
        });
        return response.data;
      } catch (error: any) {
        if (
          retries < maxRetries && 
          (
            error.code === 'ECONNRESET' || 
            error.code === 'ETIMEDOUT' || 
            error.code === 'ERR_NETWORK' ||
            (error.response && (error.response.status === 429 || error.response.status >= 500))
          )
        ) {
          retries++;
          console.log(`Request failed, retrying (${retries}/${maxRetries}): ${url}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
          continue;
        }
        throw error;
      }
    }
  }

  abstract search(query: string, page?: number): Promise<ISearch<IMangaResult>>;
  abstract fetchMangaInfo(mangaId: string): Promise<IMangaInfo>;
  abstract fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]>;
} 