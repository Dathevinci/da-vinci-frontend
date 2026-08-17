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
const PROXY = "https://goodproxy.goodproxy.workers.dev/fetch?url=";

function normalizeWeebTag(raw: string): string {
  if (!raw) return "";
  const s = raw.toLowerCase().trim().replace(/_/g, "-");
  const map: Record<string, string> = {
    "action": "Action",
    "adventure": "Adventure",
    "comedy": "Comedy",
    "dark-fantasy": "Fantasy",
    "demon": "Supernatural",
    "drama": "Drama",
    "dungeons": "Fantasy",
    "fantasy": "Fantasy",
    "game": "Fantasy",
    "genius-mc": "Action",
    "crazy-mc": "Action",
    "isekai": "Isekai",
    "magic": "Fantasy",
    "martial-arts": "Martial Arts",
    "murim": "Martial Arts",
    "mystery": "Mystery",
    "necromancer": "Fantasy",
    "overpowered": "Action",
    "psychological": "Psychological",
    "regression": "Fantasy",
    "reincarnation": "Isekai",
    "revenge": "Action",
    "romance": "Romance",
    "school-life": "School Life",
    "sci-fi": "Sci-fi",
    "scifi": "Sci-fi",
    "slice-of-life": "Slice of Life",
    "supernatural": "Supernatural",
    "sports": "Sports",
    "tragedy": "Tragedy",
    "villain": "Action",
    "shounen": "Shounen",
    "shoujo": "Shoujo",
    "seinen": "Seinen",
    "josei": "Josei",
    "historical": "Historical",
    "horror": "Horror",
    "harem": "Harem",
    "ecchi": "Ecchi",
    "shounen-ai": "Shounen Ai",
    "shoujo-ai": "Shoujo Ai",
    "gender-bender": "Gender Bender",
  };
  if (map[s]) return map[s];
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default class WeebCentral extends MangaParser {
  override readonly name = "WeebCentral";
  protected override readonly baseUrl = BASE_URL;
  protected override readonly logo = "https://weebcentral.com/favicon.ico";
  protected override readonly classPath = "MANGA.WeebCentral";

  private async fetchHtml(url: string): Promise<string> {
    // Attempt 1: Direct fetch
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://weebcentral.com/",
        },
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) return await res.text();
    } catch {}

    // Attempt 2: Axios direct
    try {
      const aRes = await axios.get(url, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://weebcentral.com/",
        },
        timeout: 7000,
      });
      if (aRes.data) return typeof aRes.data === "string" ? aRes.data : JSON.stringify(aRes.data);
    } catch {}

    // Attempt 3: Worker proxy fallback
    try {
      const pRes = await fetch(PROXY + encodeURIComponent(url), {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (pRes.ok) return await pRes.text();
    } catch {}

    throw new Error(`WeebCentral failed to fetch "${url}" across direct and proxy channels`);
  }

  private parseArticleList($: cheerio.CheerioAPI): ManhwaRow[] {
    const results: ManhwaRow[] = [];
    const seen = new Set<string>();

    $("article").each((_, el) => {
      const link = $(el).find("a[href*='/series/']").first().attr("href");
      if (!link) return;

      const match = link.match(/\/series\/([A-Z0-9]+)/);
      if (!match) return;

      const rawId = match[1];
      const id = `wbc:${rawId}`;
      if (seen.has(id)) return;
      seen.add(id);

      // Extract title cleanly from link or heading
      const titleLink = $(el).find("a[href*='/series/']").last();
      let title = titleLink.text().trim() || $(el).find("h2, .font-bold").first().text().trim();
      title = title.replace(/^Official\s*/i, "").replace(/\s+/g, " ").trim();

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

    return results;
  }

  /**
   * Search WeebCentral library
   */
  override async search(query: string, page = 1): Promise<ISearch<IMangaResult>> {
    try {
      const offset = (Math.max(1, page) - 1) * 32;
      const url = `${BASE_URL}/search/data?text=${encodeURIComponent(query)}&limit=32&offset=${offset}&sort=Best+Match&order=Ascending&display_mode=Full+Display`;
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);
      const results = this.parseArticleList($);

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
   * Filtered browse / explore for WeebCentral
   */
  async getSeries(page = 1, filters?: any): Promise<ISearch<IMangaResult>> {
    try {
      const offset = (Math.max(1, page) - 1) * 32;
      const params = new URLSearchParams();
      params.set("limit", "32");
      params.set("offset", String(offset));
      params.set("display_mode", "Full Display");

      if (filters?.sort === "popular") {
        params.set("sort", "Popularity");
        params.set("order", "Descending");
      } else if (filters?.sort === "rating") {
        params.set("sort", "Subscribers");
        params.set("order", "Descending");
      } else if (filters?.sort === "title") {
        params.set("sort", "Alphabet");
        params.set("order", "Ascending");
      } else {
        params.set("sort", "Latest Updates");
        params.set("order", "Descending");
      }

      if (filters?.status === "ongoing") {
        params.set("status", "Ongoing");
      } else if (filters?.status === "completed") {
        params.set("status", "Complete");
      } else if (filters?.status === "hiatus") {
        params.set("status", "Hiatus");
      } else if (filters?.status === "dropped" || filters?.status === "canceled") {
        params.set("status", "Canceled");
      }

      if (filters?.genre) {
        const normalized = normalizeWeebTag(filters.genre);
        if (normalized) {
          params.set("included_tag", normalized);
        }
      }

      const url = `${BASE_URL}/search/data?${params.toString()}`;
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);
      const results = this.parseArticleList($);

      return {
        currentPage: page,
        hasNextPage: results.length >= 24,
        results
      };
    } catch (e: any) {
      console.error("[WeebCentral.getSeries] Error:", e.message);
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  }

  /**
   * Latest updates for the home rail. getSeries' DEFAULT sort is already
   * "Latest Updates", so this is pure delegation — but the method itself is
   * LOAD-BEARING: manhwaHome calls it, a refactor dropped it once, and with
   * ignoreBuildErrors the missing method shipped and threw synchronously
   * inside manhwaHome's Promise.allSettled array — which took the ENTIRE
   * manhwa home feed to a 500, every source included, until this was
   * restored. Do not remove without checking manhwaHome's call list.
   */
  async getLatestUpdates(page = 1): Promise<ISearch<IMangaResult>> {
    return this.getSeries(page);
  }

  /**
   * Top popular manhwa for the home carousel / trending shelf
   */
  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    return this.getSeries(1, { sort: "popular" });
  }

  /**
   * Browse latest updates
   */
  async fetchLatestUpdates(page = 1): Promise<ISearch<IMangaResult>> {
    return this.getSeries(page, { sort: "latest" });
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
    $("a[href*='/search?tag='], a[href*='tag='], a[href*='included_tag=']").each((_, el) => {
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
   * The newest chapter's label, from ONE request. WeebCentral's listing
   * markup carries no chapter information at all (verified live: zero
   * "chapter" mentions across a whole Full Display page), so every listing
   * card rendered "Chapter ?" — this is the cheapest true answer, used by the
   * home feed's enrichment pass. Same anchor/title extraction as
   * fetchMangaInfo, without paying for the series page too.
   */
  async fetchLatestChapterLabel(mangaId: string): Promise<string | undefined> {
    const rawId = String(mangaId).replace(/^wbc:/, "");
    const chHtml = await this.fetchHtml(`${BASE_URL}/series/${rawId}/full-chapter-list`);
    const $c = cheerio.load(chHtml);
    const el = $c("a[href*='/chapters/']").first();
    if (!el.length) return undefined;
    const rawText = el.find("span").first().text().trim() || el.text().trim();
    const titleMatch = rawText.match(/(Chapter\s*\d+(\.\d+)?([^\n]*))/i);
    const label = titleMatch ? titleMatch[1].trim() : rawText.split("Last Read")[0].trim();
    return label || undefined;
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
