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

export default class Manganato extends MangaParser {
  override readonly name = "Manganato";
  protected override readonly baseUrl = "https://www.manganato.gg";
  protected override readonly logo = "https://www.manganato.gg/favicon.ico";
  protected override readonly classPath = "MANGA.Manganato";

  private unescapeHtml(raw: string): string {
    return (raw || "")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  private async fetchHtml(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Referer: "https://www.manganato.gg/",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return await res.text();
    } catch {}

    // Fallback to worker proxy
    const pRes = await fetch(PROXY + encodeURIComponent(url), {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!pRes.ok) throw new Error(`Manganato fetch failed with HTTP ${pRes.status}`);
    return await pRes.text();
  }

  /**
   * Home Feed: Trending / Hot Manga
   */
  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      const html = await this.fetchHtml("https://www.manganato.gg/manga-list/hot-manga?page=1");
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      const linkMatches = Array.from(
        html.matchAll(
          /<a[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"[^>]*title="([^"]+)"/gi
        )
      ).concat(
        Array.from(
          html.matchAll(
            /<a[^>]*title="([^"]+)"[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"/gi
          )
        ).map((m) => [m[0], m[2], m[1]])
      );

      for (const m of linkMatches) {
        const slug = m[1];
        const rawTitle = m[2];
        if (!slug || !rawTitle) continue;
        const id = `mna:${slug}`;
        if (seen.has(id)) continue;
        seen.add(id);

        results.push({
          id,
          title: this.unescapeHtml(rawTitle.trim()),
          image: `https://img-r2.2xstorage.com/thumb/${slug}.webp`,
          status: MediaStatus.ONGOING,
        });
      }

      return {
        currentPage: 1,
        hasNextPage: false,
        results,
      };
    } catch (e: any) {
      console.warn("[Manganato.getPopularToday] Failed:", e.message);
      return { currentPage: 1, hasNextPage: false, results: [] };
    }
  }

  /**
   * Home Feed: Latest Chapter Updates
   */
  async getLatestUpdates(page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const html = await this.fetchHtml(`https://www.manganato.gg/manga-list/latest-manga?page=${page}`);
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      const linkMatches = Array.from(
        html.matchAll(
          /<a[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"[^>]*title="([^"]+)"/gi
        )
      ).concat(
        Array.from(
          html.matchAll(
            /<a[^>]*title="([^"]+)"[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"/gi
          )
        ).map((m) => [m[0], m[2], m[1]])
      );

      for (const m of linkMatches) {
        const slug = m[1];
        const rawTitle = m[2];
        if (!slug || !rawTitle) continue;
        const id = `mna:${slug}`;
        if (seen.has(id)) continue;
        seen.add(id);

        results.push({
          id,
          title: this.unescapeHtml(rawTitle.trim()),
          image: `https://img-r2.2xstorage.com/thumb/${slug}.webp`,
          status: MediaStatus.ONGOING,
        });
      }

      return {
        currentPage: page,
        hasNextPage: results.length >= 24,
        results,
      };
    } catch (e: any) {
      console.warn("[Manganato.getLatestUpdates] Failed:", e.message);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Search
   */
  async search(query: string, page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const searchWord = query
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

      const html = await this.fetchHtml(
        `https://www.manganato.gg/manga-list/latest-manga?page=${page}`
      );
      const results: ManhwaRow[] = [];
      const seen = new Set<string>();

      const linkMatches = Array.from(
        html.matchAll(
          /<a[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"[^>]*title="([^"]+)"/gi
        )
      ).concat(
        Array.from(
          html.matchAll(
            /<a[^>]*title="([^"]+)"[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"/gi
          )
        ).map((m) => [m[0], m[2], m[1]])
      );

      const q = query.toLowerCase();
      for (const m of linkMatches) {
        const slug = m[1];
        const rawTitle = m[2];
        if (!slug || !rawTitle) continue;
        if (!rawTitle.toLowerCase().includes(q) && !slug.toLowerCase().includes(searchWord)) continue;

        const id = `mna:${slug}`;
        if (seen.has(id)) continue;
        seen.add(id);

        results.push({
          id,
          title: this.unescapeHtml(rawTitle.trim()),
          image: `https://img-r2.2xstorage.com/thumb/${slug}.webp`,
          status: MediaStatus.ONGOING,
        });
      }

      return {
        currentPage: page,
        hasNextPage: false,
        results,
      };
    } catch (e: any) {
      console.warn("[Manganato.search] Failed:", e.message);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Series Info & Chapter List
   */
  async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    let slug = mangaId.replace(/^mna:/, "").split("|")[0];
    let detailHtml = "";

    try {
      detailHtml = await this.fetchHtml(`https://www.manganato.gg/manga/${slug}`);
    } catch {
      // Direct fetch 404 or network issue — attempt search fallback
      try {
        const searchRes = await this.search(slug.replace(/[-_]/g, " "));
        if (searchRes.results.length > 0) {
          slug = searchRes.results[0].id.replace(/^mna:/, "");
          detailHtml = await this.fetchHtml(`https://www.manganato.gg/manga/${slug}`);
        }
      } catch {}
    }

    if (!detailHtml) {
      try {
        const searchRes = await this.search(slug.replace(/[-_]/g, " "));
        if (searchRes.results.length > 0) {
          slug = searchRes.results[0].id.replace(/^mna:/, "");
          detailHtml = await this.fetchHtml(`https://www.manganato.gg/manga/${slug}`);
        }
      } catch {}
    }

    const titleMatch =
      detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      detailHtml.match(/<div class="[^"]*story-info-right[^"]*"[\s\S]*?<h1>([^<]+)<\/h1>/i);
    const title = titleMatch
      ? this.unescapeHtml(titleMatch[1].replace(/<[^>]+>/g, "").trim())
      : slug.replace(/-/g, " ");

    const coverMatch = detailHtml.match(/<div class="[^"]*story-info-left[^"]*"[\s\S]*?<img[^>]*src="([^"]+)"/i);
    const image = coverMatch ? coverMatch[1] : `https://img-r2.2xstorage.com/thumb/${slug}.webp`;

    const descMatch =
      detailHtml.match(/<div class="[^"]*description[^"]*">([\s\S]*?)<\/div>/i) ||
      detailHtml.match(/<meta name="description" content="([^"]+)"/i);
    const description = descMatch
      ? this.unescapeHtml(descMatch[1].replace(/<[^>]+>/g, "").trim())
      : undefined;

    const chapterMatches = Array.from(
      detailHtml.matchAll(
        /href="[^"]*(?:\/manga\/[^\/]+\/chapter-|\/chapter-[a-zA-Z0-9_-]+\/chapter-)([0-9.]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
      )
    ).concat(
      Array.from(
        detailHtml.matchAll(
          /<a[^>]*class="chapter-name[^"]*"[^>]*href="[^"]*\/chapter-([0-9.]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
        )
      )
    );

    const seenChaps = new Set<string>();
    const chapters: IMangaChapter[] = [];

    for (const m of chapterMatches) {
      const numStr = m[1];
      const chapId = `mna:${slug}|chapter-${numStr}`;
      if (seenChaps.has(chapId)) continue;
      seenChaps.add(chapId);

      const rawTitle = m[2] ? m[2].replace(/<[^>]+>/g, "").trim() : `Chapter ${numStr}`;
      chapters.push({
        id: chapId,
        title: this.unescapeHtml(rawTitle.replace(/\s+/g, " ") || `Chapter ${numStr}`),
      });
    }

    return {
      id: `mna:${slug}`,
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
    const parts = chapterId.replace(/^mna:/, "").split("|");
    const slug = parts[0];
    const chapSlug = parts.length > 1 ? parts[1] : parts[0];

    const chapUrl = `https://www.manganato.gg/manga/${slug}/${chapSlug.startsWith("chapter-") ? chapSlug : `chapter-${chapSlug}`}`;
    const chapHtml = await this.fetchHtml(chapUrl);

    const cdnMatch = chapHtml.match(/var\s+cdns\s*=\s*(\[[^\]]+\]);/);
    const chapImgsMatch = chapHtml.match(/var\s+chapterImages\s*=\s*(\[[^\]]+\]);/);

    if (cdnMatch && chapImgsMatch) {
      const cdnBase = JSON.parse(cdnMatch[1])[0].replace(/\\\//g, "/");
      const rawImgs: string[] = JSON.parse(chapImgsMatch[1]);
      return rawImgs.map((imgPath, idx) => ({
        page: idx + 1,
        img: `${cdnBase.replace(/\/$/, "")}/${imgPath.replace(/^\//, "").replace(/\\\//g, "/")}`,
      }));
    }

    // Fallback if rendered as standard img tags
    const readerBlock = chapHtml.match(/<div class="[^"]*container-chapter-reader[^"]*"[\s\S]*?<\/div>/i)?.[0];
    if (readerBlock) {
      const imgs = Array.from(readerBlock.matchAll(/<img[^>]*src="([^"]+)"/gi)).map((m, idx) => ({
        page: idx + 1,
        img: m[1],
      }));
      if (imgs.length > 0) return imgs;
    }

    throw new Error(`No chapter images found for Manganato chapter "${chapterId}"`);
  }
}
