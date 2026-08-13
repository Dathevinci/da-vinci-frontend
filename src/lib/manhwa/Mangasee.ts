import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  MediaStatus,
  IMangaChapterPage,
  IMangaChapter,
} from "@/lib/asura/models";
import { ManhwaRow } from "./recency";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export default class Mangasee extends MangaParser {
  override readonly name = "Mangasee";
  protected override readonly baseUrl = "https://weebcentral.com";
  protected override readonly logo = "https://weebcentral.com/favicon.ico";
  protected override readonly classPath = "MANGA.Mangasee";

  private unescapeHtml(raw: string): string {
    return (raw || "")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://weebcentral.com/",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`WeebCentral responded with HTTP ${res.status}`);
    return await res.text();
  }

  /**
   * Home Feed: Trending Series
   */
  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      const html = await this.fetchHtml("https://weebcentral.com/");
      const articles = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi));
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      for (const a of articles) {
        const block = a[0];
        const linkMatch =
          block.match(/href="https:\/\/weebcentral\.com\/series\/([^"/]+)\/([^"]+)"/i) ||
          block.match(/href="\/series\/([^"/]+)\/([^"]+)"/i);
        const titleMatch =
          block.match(/alt="([^"]+)"/i) ||
          block.match(/<a[^>]*class="[^"]*font-bold[^"]*"[^>]*>([^<]+)<\/a>/i);
        const imgMatch =
          block.match(/src="([^"]+)"/i) || block.match(/srcset="([^"\s,]+)/i);

        if (linkMatch && titleMatch) {
          const rawId = linkMatch[1];
          const id = `mse:${rawId}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = this.unescapeHtml(titleMatch[1].replace(/\s*cover$/i, "").trim());
          const image = imgMatch
            ? imgMatch[1]
            : `https://temp.compsci88.com/cover/fallback/${rawId}.jpg`;

          results.push({
            id,
            title,
            image,
            status: MediaStatus.ONGOING,
          });
        }
      }

      return {
        currentPage: 1,
        hasNextPage: false,
        results,
      };
    } catch (e: any) {
      console.warn("[Mangasee.getPopularToday] Failed:", e.message);
      return { currentPage: 1, hasNextPage: false, results: [] };
    }
  }

  /**
   * Home Feed: Latest Chapter Updates
   */
  async getLatestUpdates(page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const html = await this.fetchHtml(
        `https://weebcentral.com/search/data?sort=Latest%20Updates&order=Descending&page=${page}`
      );
      const articles = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi));
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      for (const a of articles) {
        const block = a[0];
        const linkMatch =
          block.match(/href="https:\/\/weebcentral\.com\/series\/([^"/]+)\/([^"]+)"/i) ||
          block.match(/href="\/series\/([^"/]+)\/([^"]+)"/i);
        const titleMatch =
          block.match(/alt="([^"]+)"/i) ||
          block.match(/<a[^>]*class="[^"]*link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const imgMatch =
          block.match(/src="([^"]+)"/i) || block.match(/srcset="([^"\s,]+)/i);
        const chapMatch = block.match(/<span[^>]*>(Chapter\s+[^<]+)<\/span>/i);

        if (linkMatch) {
          const rawId = linkMatch[1];
          const id = `mse:${rawId}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = titleMatch
            ? this.unescapeHtml(titleMatch[1].replace(/\s*cover$/i, "").trim())
            : linkMatch[2].replace(/-/g, " ");
          const image = imgMatch
            ? imgMatch[1]
            : `https://temp.compsci88.com/cover/fallback/${rawId}.jpg`;

          results.push({
            id,
            title,
            image,
            latestChapter: chapMatch ? chapMatch[1].trim() : undefined,
            status: MediaStatus.ONGOING,
          });
        }
      }

      return {
        currentPage: page,
        hasNextPage: results.length >= 24,
        results,
      };
    } catch (e: any) {
      console.warn("[Mangasee.getLatestUpdates] Failed:", e.message);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Search
   */
  async search(query: string, page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const q = encodeURIComponent(query.trim());
      const html = await this.fetchHtml(`https://weebcentral.com/search/data?text=${q}&page=${page}`);
      const articles = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi));
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      for (const a of articles) {
        const block = a[0];
        const linkMatch =
          block.match(/href="https:\/\/weebcentral\.com\/series\/([^"/]+)\/([^"]+)"/i) ||
          block.match(/href="\/series\/([^"/]+)\/([^"]+)"/i);
        const titleMatch =
          block.match(/alt="([^"]+)"/i) ||
          block.match(/<a[^>]*class="[^"]*link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const imgMatch =
          block.match(/src="([^"]+)"/i) || block.match(/srcset="([^"\s,]+)/i);

        if (linkMatch) {
          const rawId = linkMatch[1];
          const id = `mse:${rawId}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = titleMatch
            ? this.unescapeHtml(titleMatch[1].replace(/\s*cover$/i, "").trim())
            : linkMatch[2].replace(/-/g, " ");
          const image = imgMatch
            ? imgMatch[1]
            : `https://temp.compsci88.com/cover/fallback/${rawId}.jpg`;

          results.push({
            id,
            title,
            image,
            status: MediaStatus.ONGOING,
          });
        }
      }

      return {
        currentPage: page,
        hasNextPage: results.length >= 24,
        results,
      };
    } catch (e: any) {
      console.warn("[Mangasee.search] Failed:", e.message);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Series Info & Chapter List
   */
  async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const rawId = mangaId.replace(/^mse:/, "").split("|")[0];
    const [infoHtml, chapHtml] = await Promise.all([
      this.fetchHtml(`https://weebcentral.com/series/${rawId}`).catch(() => ""),
      this.fetchHtml(`https://weebcentral.com/series/${rawId}/full-chapter-list`),
    ]);

    const titleMatch =
      infoHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      infoHtml.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch
      ? this.unescapeHtml(titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s*\|\s*Weeb Central/i, "").trim())
      : rawId;

    const imgMatch =
      infoHtml.match(/<img[^>]*alt="[^"]*cover"[^>]*src="([^"]+)"/i) ||
      infoHtml.match(/<picture>[\s\S]*?<img[^>]*src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : `https://temp.compsci88.com/cover/fallback/${rawId}.jpg`;

    const descMatch = infoHtml.match(/<p class="[^"]*description[^"]*">([\s\S]*?)<\/p>/i) ||
                      infoHtml.match(/<meta name="description" content="([^"]+)"/i);
    const description = descMatch ? this.unescapeHtml(descMatch[1].replace(/<[^>]+>/g, "").trim()) : undefined;

    const chapMatches = Array.from(
      chapHtml.matchAll(
        /href="(?:https:\/\/weebcentral\.com)?\/chapters\/([^"]+)"[\s\S]*?<span[^>]*>(Chapter\s+[^<]+)<\/span>(?:[\s\S]*?<time[^>]*datetime="([^"]+)")?/gi
      )
    );

    const chapters: IMangaChapter[] = chapMatches.map((m) => ({
      id: `mse:${rawId}|${m[1]}`,
      title: this.unescapeHtml(m[2].trim()),
      releaseDate: m[3] || undefined,
    }));

    return {
      id: `mse:${rawId}`,
      title,
      image,
      description,
      status: MediaStatus.ONGOING,
      chapters,
    };
  }

  /**
   * Chapter Reader (High-Res Page Images)
   */
  async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const parts = chapterId.replace(/^mse:/, "").split("|");
    const rawChapId = parts.length > 1 ? parts[1] : parts[0];

    const imgHtml = await this.fetchHtml(`https://weebcentral.com/chapters/${rawChapId}/images`);
    const pageImgs = Array.from(imgHtml.matchAll(/<img[^>]*src="([^"]+)"/gi)).map((m, idx) => ({
      page: idx + 1,
      img: m[1],
    }));

    if (pageImgs.length === 0) {
      throw new Error(`No images found for chapter "${chapterId}"`);
    }

    return pageImgs;
  }
}
