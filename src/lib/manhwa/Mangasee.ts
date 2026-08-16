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
const PROXY = "https://goodproxy.goodproxy.workers.dev/fetch?url=";

export default class Mangasee extends MangaParser {
  override readonly name = "Mangasee";
  protected override readonly baseUrl = "https://weebcentral.com";
  protected override readonly logo = "https://weebcentral.com/favicon.ico";
  protected override readonly classPath = "MANGA.Mangasee";

  private unescapeHtml(raw: string): string {
    return (raw || "")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  /**
   * Mangasee 6-digit chapter string decoder (e.g. "100125" -> Chapter 12.5)
   */
  public static decodeChapter(raw: string): { chapterNum: number; displayTitle: string; urlSlug: string } {
    const s = String(raw || "").trim();
    if (/^\d{6}$/.test(s)) {
      const mainNum = parseInt(s.slice(1, 5), 10);
      const dec = s.slice(5);
      const chapterNum = dec === "0" ? mainNum : parseFloat(`${mainNum}.${dec}`);
      const displayTitle = `Chapter ${chapterNum}`;
      const urlSlug = dec === "0" ? String(mainNum) : `${mainNum}.${dec}`;
      return { chapterNum, displayTitle, urlSlug };
    }

    const specificMatch = s.match(/(?:chapter|episode|stage|act|ch\.?|ep\.?)\s*([0-9.]+)/i);
    if (specificMatch) {
      const chapterNum = parseFloat(specificMatch[1]) || 0;
      return { chapterNum, displayTitle: s, urlSlug: String(chapterNum) };
    }

    const numMatch = s.match(/([0-9.]+)/);
    const chapterNum = numMatch ? parseFloat(numMatch[1]) : 0;
    return { chapterNum, displayTitle: s || `Chapter ${chapterNum}`, urlSlug: String(chapterNum) };
  }

  /**
   * Normalizes relative cover paths or missing covers
   */
  public static normalizeCover(rawUrl?: string | null, idOrIndex?: string): string {
    if (!rawUrl && idOrIndex) {
      return `https://temp.compsci88.com/cover/fallback/${idOrIndex}.jpg`;
    }
    if (rawUrl?.startsWith("/")) {
      return `https://temp.mangasee123.com${rawUrl}`;
    }
    return rawUrl || (idOrIndex ? `https://temp.compsci88.com/cover/fallback/${idOrIndex}.jpg` : "");
  }

  private async fetchHtml(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Referer: "https://weebcentral.com/",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const text = await res.text();
        if (!text.includes("cf-mitigated")) return text;
      }
    } catch {}

    // Fallback via Edge proxy if blocked by Cloudflare on datacenter IPs
    const proxyRes = await fetch(`${PROXY}${encodeURIComponent(url)}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!proxyRes.ok) throw new Error(`WeebCentral request failed with status ${proxyRes.status}`);
    return await proxyRes.text();
  }

  /**
   * Home Feed: Trending / Popular Series
   */
  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      const html = await this.fetchHtml(
        "https://weebcentral.com/search/data?sort=Popularity&order=Descending&page=1"
      );
      const blocks = html.split('<article class="bg-base-300').slice(1);
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      for (const block of blocks) {
        const linkMatch = block.match(/href="https:\/\/weebcentral\.com\/series\/([^"/]+)\/([^"]+)"/i);
        const titleMatch =
          block.match(/alt="([^"]+)"/i) || block.match(/<a[^>]*class="[^"]*link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const imgMatch = block.match(/<img[^>]*src="([^"]+)"/i) || block.match(/srcset="([^"\s,]+)/i);

        if (linkMatch) {
          const rawId = linkMatch[1];
          const id = `mse:${rawId}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = titleMatch
            ? this.unescapeHtml(titleMatch[1].replace(/\s*cover$/i, "").trim())
            : linkMatch[2].replace(/-/g, " ");
          const image = Mangasee.normalizeCover(imgMatch ? imgMatch[1] : null, rawId);

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
  /**
   * Home Feed: Latest Chapter Updates
   */
  async getLatestUpdates(page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const offset = (Math.max(1, page) - 1) * 32;
      const html = await this.fetchHtml(
        `https://weebcentral.com/search/data?limit=32&offset=${offset}&sort=Latest%20Updates&order=Descending&display_mode=Full%20Display`
      );
      const blocks = html.split('<article class="bg-base-300').slice(1);
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      for (const block of blocks) {
        const linkMatch = block.match(/href="https:\/\/weebcentral\.com\/series\/([^"/]+)\/([^"]+)"/i);
        const titleMatch =
          block.match(/alt="([^"]+)"/i) || block.match(/<a[^>]*class="[^"]*link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const imgMatch = block.match(/<img[^>]*src="([^"]+)"/i) || block.match(/srcset="([^"\s,]+)/i);
        const chapMatch =
          block.match(/href="https:\/\/weebcentral\.com\/chapters\/[^"]*"[\s\S]*?<span[^>]*>(Chapter\s+[^<]+)<\/span>/i) ||
          block.match(/<span[^>]*>(Chapter\s+[^<]+)<\/span>/i);

        if (linkMatch) {
          const rawId = linkMatch[1];
          const id = `mse:${rawId}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = titleMatch
            ? this.unescapeHtml(titleMatch[1].replace(/\s*cover$/i, "").trim())
            : linkMatch[2].replace(/-/g, " ");
          const image = Mangasee.normalizeCover(imgMatch ? imgMatch[1] : null, rawId);

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
   * Search across Manga, Manhwa, and Manhua
   */
  async search(query: string, page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const q = encodeURIComponent(query.trim());
      const offset = (Math.max(1, page) - 1) * 32;
      const html = await this.fetchHtml(`https://weebcentral.com/search/data?text=${q}&limit=32&offset=${offset}&display_mode=Full%20Display`);
      const blocks = html.split('<article class="bg-base-300').slice(1);
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      for (const block of blocks) {
        const linkMatch = block.match(/href="https:\/\/weebcentral\.com\/series\/([^"/]+)\/([^"]+)"/i);
        const titleMatch =
          block.match(/alt="([^"]+)"/i) || block.match(/<a[^>]*class="[^"]*link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const imgMatch = block.match(/<img[^>]*src="([^"]+)"/i) || block.match(/srcset="([^"\s,]+)/i);

        if (linkMatch) {
          const rawId = linkMatch[1];
          const id = `mse:${rawId}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const title = titleMatch
            ? this.unescapeHtml(titleMatch[1].replace(/\s*cover$/i, "").trim())
            : linkMatch[2].replace(/-/g, " ");
          const image = Mangasee.normalizeCover(imgMatch ? imgMatch[1] : null, rawId);

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
   * Series Info, Rich Synopsis & Complete Chapter List
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
    const image = Mangasee.normalizeCover(imgMatch ? imgMatch[1] : null, rawId);

    const descMatch =
      infoHtml.match(/<strong>Description<\/strong>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
      infoHtml.match(/<p class="[^"]*whitespace-pre-wrap[^"]*">([\s\S]*?)<\/p>/i) ||
      infoHtml.match(/<p class="[^"]*description[^"]*">([\s\S]*?)<\/p>/i) ||
      infoHtml.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const description = descMatch ? this.unescapeHtml(descMatch[1].replace(/<[^>]+>/g, "").trim()) : undefined;

    const statusMatch = infoHtml.match(/<strong>Status<\/strong>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    const status = statusMatch && /complete/i.test(statusMatch[1]) ? MediaStatus.COMPLETED : MediaStatus.ONGOING;

    const genres = Array.from(infoHtml.matchAll(/href="https:\/\/weebcentral\.com\/search\/data\?genre=([^"&]+)"/gi))
      .map((m) => decodeURIComponent(m[1].replace(/\+/g, " ")));

    const chapMatches = Array.from(
      chapHtml.matchAll(
        /href="(?:https:\/\/weebcentral\.com)?\/chapters\/([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>(?:[\s\S]*?<time[^>]*datetime="([^"]+)")?/gi
      )
    );

    const chapters: IMangaChapter[] = chapMatches.map((m) => {
      const decoded = Mangasee.decodeChapter(m[2]);
      return {
        id: `mse:${rawId}|${m[1]}`,
        title: decoded.displayTitle,
        chapterNumber: decoded.chapterNum,
        url: `https://weebcentral.com/chapters/${m[1]}`,
        releaseDate: m[3] || undefined,
      };
    });

    // Strict numerical descending sort (newest chapters first)
    chapters.sort((a, b) => (b.chapterNumber ?? 0) - (a.chapterNumber ?? 0));

    return {
      id: `mse:${rawId}`,
      title,
      image,
      description,
      status,
      genres: genres.length > 0 ? genres : undefined,
      chapters,
    };
  }

  /**
   * Chapter Reader (High-Res Page Images)
   */
  async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawId = chapterId.replace(/^mse:/, "").split("|")[1] || chapterId.replace(/^mse:/, "");
    const html = await this.fetchHtml(`https://weebcentral.com/chapters/${rawId}/images`);
    const imgMatches = Array.from(html.matchAll(/<img[^>]*src="([^"]+)"/gi));

    if (imgMatches.length === 0) {
      throw new Error(`No chapter images found for Mangasee chapter "${chapterId}"`);
    }

    return imgMatches.map((m, idx) => ({
      page: idx + 1,
      img: m[1],
    }));
  }
}
