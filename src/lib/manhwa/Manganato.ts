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

  /**
   * ONE PARSER FOR EVERY LISTING PAGE — and it reads the REAL cover.
   *
   * All three listing methods used to match title anchors alone and then
   * INVENT the cover as `img-r2.2xstorage.com/thumb/<slug>.webp`. The CDN host
   * is per-title and cannot be guessed: one hot-manga page serves covers from
   * img-r1, img-r2, imgs-2 AND storage.waitst.com, and the img-r2 guess for a
   * title living on img-r1 is a plain 404 — which is the wall of broken
   * thumbnails the owner reported, twice.
   *
   * The listing markup already carries the answer. Every card is a
   * `<div class="item">` block holding the real `<img>` (lazy ones keep the
   * URL in data-src), the title anchor and a latest-chapter link — verified
   * 20/20 blocks on both listing pages, with the img's filename slug equal to
   * the anchor's slug in all 40, so a block's image provably belongs to that
   * block's series. Parsing per-block also fixes the "Chapter ?" cards: the
   * chapter link was simply never read.
   */
  private parseCards(html: string): ManhwaRow[] {
    const rows: ManhwaRow[] = [];
    const seen = new Set<string>();

    for (const block of html.split('<div class="item">').slice(1)) {
      const anchor = /<a[^>]*href="https:\/\/www\.manganato\.gg\/manga\/([a-zA-Z0-9_-]+)"[^>]*title="([^"]+)"/i.exec(block);
      if (!anchor) continue;
      const [, slug, rawTitle] = anchor;
      const id = `mna:${slug}`;
      if (seen.has(id) || !rawTitle) continue;
      seen.add(id);

      // data-src before src: on a lazy image, src is a placeholder.
      const img =
        /<img[^>]+data-src="(https?:\/\/[a-z0-9.-]*(?:2xstorage|waitst)[a-z0-9.-]*\/[^"]+)"/i.exec(block) ||
        /<img[^>]+src="(https?:\/\/[a-z0-9.-]*(?:2xstorage|waitst)[a-z0-9.-]*\/[^"]+)"/i.exec(block);

      const chapter = /\/chapter-[\d.-]+"[^>]*title="(Chapter[^"]+)"/i.exec(block);

      rows.push({
        id,
        title: this.unescapeHtml(rawTitle.trim()),
        image: img ? img[1] : undefined,
        latestChapter: chapter ? this.unescapeHtml(chapter[1].trim()) : undefined,
        status: MediaStatus.ONGOING,
      });
    }
    return rows;
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
      return {
        currentPage: 1,
        hasNextPage: false,
        results: this.parseCards(html),
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
    if (page > 1) {
      return { currentPage: page, hasNextPage: false, results: [] };
    }
    try {
      const html = await this.fetchHtml(`https://www.manganato.gg/manga-list/latest-manga?page=${page}`);
      const results = this.parseCards(html);
      return {
        currentPage: page,
        hasNextPage: false,
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
      const q = query.toLowerCase();
      const results = this.parseCards(html).filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.id.replace(/^mna:/, "").toLowerCase().includes(searchWord)
      );

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

    /**
     * THE COVER COMES FROM og:image — THE HOST CANNOT BE GUESSED.
     *
     * The old extraction looked for a `story-info-left` container that this
     * template does not have, so every title fell through to a HAND-BUILT
     * `img-r2.2xstorage.com/thumb/<slug>.webp` — and the CDN host genuinely
     * varies per title. Measured across three series pages: kimetsu-no-yaiba
     * lives on imgs-2, the-beginning-after-the-endd on img-r1, and
     * the-heavenly-demons-otherworld-livestream on img-r2. Guessing img-r2
     * returned 503 for the first of those, which is the broken thumbnail the
     * owner reported. og:image carries the right host every time (verified on
     * all three, and the URL answers 200 with the site Referer).
     */
    const ogImage = detailHtml.match(/<meta property="og:image" content="([^"]+)"/i);
    const image = ogImage ? ogImage[1] : `https://img-r2.2xstorage.com/thumb/${slug}.webp`;

    /**
     * NEVER READ `class="description"` — IT IS THE SITE'S ANNOUNCEMENT BANNER.
     *
     * The first div with that class on every series page is a site-wide notice
     * ("New Feature: Save Reading History for Guests!"), which is exactly what
     * was being shown as the synopsis for every title. The real synopsis sits
     * in an inline-styled container anchored by a "<title> summary:" heading —
     * verified present on all three series pages measured. The meta
     * description is generic boilerplate ("Read X manga online for free…"),
     * so when the anchor is missing the honest answer is NO description
     * rather than either of the wrong ones.
     */
    // Strip tags AFTER unescaping as well as before: the site double-escapes
    // markup inside the synopsis (&lt;br&gt;), so a single pre-unescape strip
    // leaves literal "<br>" text in the description.
    const summaryMatch = detailHtml.match(/summary:\s*<\/p>\s*<\/h2>([\s\S]*?)<\/div>/i);
    const description = summaryMatch
      ? this.unescapeHtml(summaryMatch[1].replace(/<[^>]+>/g, " "))
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
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
