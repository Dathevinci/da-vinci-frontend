import axios from "axios";
import * as cheerio from "cheerio";
import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  MediaStatus,
  IMangaChapterPage,
  IMangaChapter
} from "@/lib/asura/models";
import { ManhwaRow } from "./recency";

const BASE_URL = "https://weebcentral.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export default class WeebCentral extends MangaParser {
  override readonly name = "WeebCentral";
  protected override readonly baseUrl = BASE_URL;
  protected override readonly logo = "https://weebcentral.com/favicon.ico";
  protected override readonly classPath = "MANGA.WeebCentral";

  private async fetchHtml(url: string): Promise<string> {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://weebcentral.com/"
      },
      timeout: 8000
    });
    return res.data;
  }

  /**
   * Search WeebCentral library
   */
  override async search(query: string, page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const url = `${BASE_URL}/search/data?text=${encodeURIComponent(query)}&page=${page}&sort=Best+Match&order=Ascending&display_mode=Full+Display`;
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);

      const results: ManhwaRow[] = [];
      $("article").each((_, el) => {
        const link = $(el).find("a[href*='/series/']").first().attr("href");
        if (!link) return;

        const match = link.match(/\/series\/([A-Z0-9]+)/);
        if (!match) return;

        const rawId = match[1];
        const id = `wbc:${rawId}`;
        const rawTitle = $(el).find("a[href*='/series/']").first().text().trim() || $(el).find("h2, .font-bold").first().text().trim();
        const title = rawTitle.replace(/^Official\s*/i, '').replace(/\s+/g, ' ').trim();
        const image = $(el).find("img").first().attr("src");
        const description = $(el).find(".line-clamp-3, p").first().text().trim();

        if (title && !title.toLowerCase().includes("hentai")) {
          results.push({
            id,
            title,
            image: image || undefined,
            description: description || undefined,
            type: "Manhwa",
            status: MediaStatus.ONGOING
          });
        }
      });

      return {
        currentPage: page,
        hasNextPage: results.length >= 24,
        results
      };
    } catch {
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Browse latest updates
   */
  async fetchLatestUpdates(page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const url = `${BASE_URL}/search/data?page=${page}&sort=Latest+Updates&order=Descending&display_mode=Full+Display`;
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);

      const results: ManhwaRow[] = [];
      $("article").each((_, el) => {
        const link = $(el).find("a[href*='/series/']").first().attr("href");
        if (!link) return;

        const match = link.match(/\/series\/([A-Z0-9]+)/);
        if (!match) return;

        const rawId = match[1];
        const id = `wbc:${rawId}`;
        const rawTitle = $(el).find("a[href*='/series/']").first().text().trim() || $(el).find("h2, .font-bold").first().text().trim();
        const title = rawTitle.replace(/^Official\s*/i, '').replace(/\s+/g, ' ').trim();
        const image = $(el).find("img").first().attr("src");
        const description = $(el).find(".line-clamp-3, p").first().text().trim();

        if (title && !title.toLowerCase().includes("hentai")) {
          results.push({
            id,
            title,
            image: image || undefined,
            description: description || undefined,
            type: "Manhwa",
            status: MediaStatus.ONGOING
          });
        }
      });

      return {
        currentPage: page,
        hasNextPage: results.length >= 24,
        results
      };
    } catch {
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Fetch manga details and chapters
   */
  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const rawId = mangaId.replace(/^wbc:/, "");
    const url = `${BASE_URL}/series/${rawId}`;
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    const title = $("h1").first().text().trim() || $("title").text().split("|")[0].trim();
    const image = $("picture img").first().attr("src") || $("img").first().attr("src");
    const description = $("section p").text().trim();

    const genres: string[] = [];
    $("a[href*='/search?tag='], a[href*='tag=']").each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    });

    // Fetch chapters list
    const chUrl = `${BASE_URL}/series/${rawId}/full-chapter-list`;
    const chHtml = await this.fetchHtml(chUrl);
    const $c = cheerio.load(chHtml);

    const chapters: IMangaChapter[] = [];
    $c("a[href*='/chapters/']").each((_, el) => {
      const href = $c(el).attr("href") || "";
      const match = href.match(/\/chapters\/([A-Z0-9]+)/);
      if (!match) return;

      const rawChId = match[1];
      const chId = `wbc:${rawChId}`;
      const rawText = $c(el).find("span").first().text().trim() || $c(el).text().trim();
      // Extract clean chapter title (e.g. "Chapter 200")
      const titleMatch = rawText.match(/(Chapter\s*\d+(\.\d+)?([^\n]*))/i);
      const chTitle = titleMatch ? titleMatch[1].trim() : rawText.split("Last Read")[0].trim() || `Chapter ${rawChId}`;

      chapters.push({
        id: chId,
        title: chTitle,
        releaseDate: undefined
      });
    });

    return {
      id: `wbc:${rawId}`,
      title,
      image: image || undefined,
      description: description || undefined,
      genres,
      status: MediaStatus.ONGOING,
      chapters
    };
  }

  /**
   * Fetch chapter pages
   */
  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const rawChId = chapterId.replace(/^wbc:/, "");
    const imagesUrl = `${BASE_URL}/chapters/${rawChId}/images?is_prev=False&current_page=1&reading_style=long_strip`;
    const html = await this.fetchHtml(imagesUrl);
    const $ = cheerio.load(html);

    const pages: IMangaChapterPage[] = [];
    $("img").each((idx, el) => {
      const imgUrl = $(el).attr("src") || $(el).attr("data-src");
      if (imgUrl && !imgUrl.includes("logo") && !imgUrl.includes("banner")) {
        pages.push({
          page: idx + 1,
          img: imgUrl
        });
      }
    });

    return pages;
  }
}
