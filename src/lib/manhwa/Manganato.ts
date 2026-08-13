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

  /**
   * THE CHAPTER LIST IS NOT IN THE SERIES PAGE. IT COMES FROM AN API.
   *
   * Scraping the detail HTML for chapter links cannot work here, and the way it
   * fails is quiet rather than obvious. Measured against a real 308-chapter
   * series (`the-beginning-after-the-endd`):
   *
   *   chapter hrefs in the page   24
   *     belonging to THIS series   4   — chapter-1 and chapter-248, each twice
   *     belonging to OTHER series 20   — a sidebar of unrelated titles
   *
   * The page only ever links its first and newest chapter; everything else on
   * it belongs to other comics. A pattern like `/manga/<any-slug>/chapter-N`
   * matches those too, so the reader ends up with another series' chapters
   * listed under this one — the reported "chapter mismatching", and the same
   * class of bug as the old MangaRead rescue that served a stranger's list.
   *
   * The site loads the real list from /api/manga/<slug>/chapters (the page
   * markup carries a `chapter-list-loading` placeholder and the template URL).
   * It returns clean JSON, newest first, 50 at a time with an offset cursor and
   * a `pagination.has_more` flag — so all 308 arrive in seven requests.
   *
   * USE `chapter_slug` VERBATIM rather than rebuilding a URL from the number.
   * Sub-chapters are dashed, not dotted: chapter 188.5 lives at
   * `chapter-188-5`, and composing `chapter-188.5` from the parsed float gives
   * a URL that does not exist. 26 of the 50 rows on one page were sub-chapters,
   * so this is the common case, not an edge case.
   */
  private async fetchChapterList(slug: string): Promise<IMangaChapter[]> {
    const LIMIT = 50;
    const MAX_REQUESTS = 40; // 2000 chapters; a stop, not an expectation
    const chapters: IMangaChapter[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < MAX_REQUESTS; i++) {
      let payload: any;
      try {
        const raw = await this.fetchHtml(
          `${this.baseUrl}/api/manga/${slug}/chapters?limit=${LIMIT}&offset=${i * LIMIT}`
        );
        payload = JSON.parse(raw);
      } catch {
        // A failed page mid-walk means an INCOMPLETE list, not the end of one.
        // Returning what we have is right — a partial list still reads — but it
        // must not be mistaken for the whole series, hence the log.
        console.error(`[manganato] chapter list for "${slug}" stopped at ${chapters.length} rows`);
        break;
      }

      const rows = payload?.data?.chapters;
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const r of rows) {
        const chapterSlug = String(r?.chapter_slug || "").trim();
        if (!chapterSlug || seen.has(chapterSlug)) continue;
        seen.add(chapterSlug);

        const num = Number(r?.chapter_num);
        chapters.push({
          id: `mna:${slug}|${chapterSlug}`,
          title: String(r?.chapter_name || "").trim() || `Chapter ${Number.isFinite(num) ? num : ""}`.trim(),
          chapterNumber: Number.isFinite(num) ? num : 0,
          url: `${this.baseUrl}/manga/${slug}/${chapterSlug}`,
          releaseDate: r?.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        } as IMangaChapter);
      }

      if (!payload?.data?.pagination?.has_more) break;
    }

    // The API already returns newest-first, but sort explicitly so the order is
    // this function's guarantee rather than an upstream habit.
    chapters.sort((a, b) => ((b as any).chapterNumber ?? 0) - ((a as any).chapterNumber ?? 0));
    return chapters;
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

    // Chapters come from the API, not this HTML — see fetchChapterList for the
    // measurements. Already deduped and sorted newest-first there.
    const chapters = await this.fetchChapterList(slug);

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
