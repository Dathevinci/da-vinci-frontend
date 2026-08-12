/**
 * LightNovelWorld source — lightnovelworld.org
 *
 * Conforms to the same contract as ReadNovelFull/NovelFull so it can be merged
 * into sources.ts without anything downstream changing.
 *
 * Structure confirmed against live pages:
 *   browse   /genre-all/?page=N        .recommendation-card
 *   search   /search/?keyword=X        same card markup
 *   detail   /novel/<slug>/            .novel-author, .status-badge, .genre-tag
 *   chapter  /novel/<slug>/chapter/<n>/  h1.chapter-title, div.chapter-content
 *
 * Two things this site does that matter:
 *   · Cover srcs are RELATIVE ("/media/covers/…"), so they need the base
 *     prefixed or every image 404s.
 *   · Chapters are plain sequential numbers and the detail page does NOT list
 *     them — it only exposes a total. So the list is generated 1..N rather than
 *     scraped, which is both cheaper and complete.
 */

export interface NovelResult {
  id: string;
  title: string;
  cover: string;
  latestChapter?: string;
}

export interface NovelChapter {
  id: string;
  title: string;
  number: number;
}

export interface NovelInfo {
  id: string;
  novelId: string;
  title: string;
  cover: string;
  author: string;
  status: string;
  genres: string[];
  synopsis: string;
  chapters: NovelChapter[];
  alternativeServers?: { source: string; id: string; name: string }[];
}

export interface ChapterContent {
  title: string;
  content: string[];
  prev: string | null;
  next: string | null;
}

import { pagerTotalPages, pagesForItems, type PageTotals } from "@/lib/explorePaging";

const BASE = "https://lightnovelworld.org";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

/**
 * This site bot-gates datacenter IPs with a SOFT block: HTTP 200 plus a slim
 * landing page instead of the page asked for — og:title "Light Novel World -
 * Discover Epic Stories", og-default.png, zero cards. From Vercel that meant
 * every shelf parsed to 0 rows (no error anywhere) and detail pages returned
 * the landing page's own og tags as the "novel". Status checks can't see it;
 * only the content can. The full og:title meta is the fingerprint — it has to
 * be the EXACT tag, because "Discover Epic Stories" alone also appears in the
 * twitter:title default on every real page (verified across home, browse,
 * detail, chapter and search: their og:titles all name their own content).
 */
const looksBotGated = (html: string) =>
  html.includes('property="og:title" content="Light Novel World - Discover Epic Stories"');

// Same Cloudflare-Worker relay NovelFull/ReadNovelFull fall back to. Verified
// live: direct-from-datacenter gets the gate page, the relay gets the real
// 24-card listing.
const RELAY = "https://goodproxy.goodproxy.workers.dev/fetch?url=";

async function fetchHtml(path: string, revalidate = 300): Promise<string> {
  const url = `${BASE}${path}`;
  const headers = {
    "User-Agent": UA,
    Referer: `${BASE}/`,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  let direct: Error | null = null;
  try {
    const res = await fetch(url, { headers, next: { revalidate }, signal: AbortSignal.timeout(15000) } as any);
    if (res.ok) {
      const html = await res.text();
      if (!looksBotGated(html)) return html;
      direct = new Error(`LightNovelWorld bot-gated for ${path}`);
    } else {
      direct = new Error(`LightNovelWorld ${res.status} for ${path}`);
    }
  } catch (err: any) {
    direct = err;
  }

  const proxyRes = await fetch(`${RELAY}${encodeURIComponent(url)}`, {
    headers: { "User-Agent": UA },
    next: { revalidate },
    signal: AbortSignal.timeout(15000),
  } as any).catch(() => null);
  if (proxyRes && proxyRes.ok) {
    const html = await proxyRes.text();
    if (!looksBotGated(html)) return html;
  }
  throw direct;
}

const decode = (s: string) =>
  s
    // Hex entities FIRST — this site emits &#x27; for apostrophes, which the
    // decimal rule below can't see, so titles rendered as "King&#x27;s Bride".
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();

/**
 * Absolute-ise a cover path. This site serves them relative ("/media/covers/…"),
 * and a relative src resolves against OUR domain, so it 404s.
 *
 * Return the plain absolute URL and nothing more. Proxying happens later, in
 * novelCover() (lib/novelImage.ts), which wraps every non-AniList URL in
 * /api/novel-image. Proxying here as well double-wrapped it — the proxy then
 * received its own relative path as the `url` parameter, couldn't parse it, and
 * rejected every cover.
 */
const absCover = (src: string) => {
  if (!src) return "";
  return src.startsWith("http") ? src : `${BASE}${src.startsWith("/") ? "" : "/"}${src}`;
};

/** Internal shape — rating is carried so shelves can rank on it, but it isn't
 *  part of the shared NovelResult contract. */
type Card = NovelResult & { rating: number };

/** Both browse and search render the same card, so one parser covers both. */
function parseCards(html: string): Card[] {
  const out: Card[] = [];
  const seen = new Set<string>();

  // Each card opens with the cover link, then the <img> carrying src + alt, and
  // (usually) a .card-rating badge shortly after.
  // The tail is a plain bounded window — NO lookahead. A lazy group anchored on
  // "the next card link" fails outright whenever the next card is further away
  // than the bound, and that silently emptied every shelf rather than just
  // dropping the rating.
  const re =
    /<a\s+href="\/novel\/([a-z0-9-]+)\/"\s+class="card-cover-link"[\s\S]{0,400}?<img\s+src="([^"]+)"\s+alt="([^"]*)"([\s\S]{0,300})/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, slug, cover, title, tail] = m;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const rating = Number(tail?.match(/class="card-rating"[^>]*>[^0-9]*([0-9.]+)/)?.[1] || 0);
    // Prefixed here, the same way NovelFull tags its own ids, so resolveSource
    // can route a result back to this source without guessing.
    out.push({ id: `lnw:${slug}`, title: decode(title) || slug, cover: absCover(cover), rating });
  }
  return out;
}

/**
 * This site states its catalogue size in words, above the grid: "1-24 of
 * 11041". That is the single best totals signal of any scraped source here —
 * an actual item count, not a page count to be divided out — and it agrees
 * exactly with its own pager (11041 items at 24/page is 461 pages, and the
 * pager's last link is 461).
 *
 * Both are read, and both must agree before either is reported. They come from
 * different parts of the markup, so if a template change breaks one, the
 * disagreement is the signal that the parse is stale — better to fall back to
 * the numberless pager than to publish whichever half still parses.
 */
function browseTotals(html: string, page: number, perPage: number, resultCount: number): PageTotals {
  const totalPages = pagerTotalPages(html, page, resultCount);
  const stated = Number(html.match(/\b\d+\s*-\s*\d+\s+of\s+([\d,]+)/i)?.[1]?.replace(/,/g, "") || 0);
  const totalItems = Number.isFinite(stated) && stated > 0 ? stated : undefined;

  if (totalPages !== undefined && totalItems !== undefined) {
    const implied = pagesForItems(totalItems, perPage);
    // One page of slack: the count is live and the pager can lag it by a row.
    if (implied !== undefined && Math.abs(implied - totalPages) <= 1) return { totalPages, totalItems };
    return { totalPages };
  }
  if (totalPages !== undefined) return { totalPages };
  return {};
}

export async function browseNovels(
  page = 1,
  _list = "popular"
): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const html = await fetchHtml(`/genre-all/${page > 1 ? `?page=${page}` : ""}`);
  const results = parseCards(html);
  // Pagination is ?page=N; a link to the next page existing is the honest test.
  const hasNextPage = new RegExp(`href="\\?page=${page + 1}"`).test(html);
  return { results, hasNextPage, ...browseTotals(html, page, 24, results.length) };
}

/**
 * Top Rated shelf.
 *
 * The site's own ?sort= params are ignored (verified: ?sort=popular and
 * ?sort=latest both return the same first title as the unsorted list), so a
 * "popular" list can't be requested — it has to be derived. Each card carries a
 * rating badge, so several pages are pulled and ranked by it.
 *
 * Pages are fetched in parallel and a failure is tolerated: three pages is a
 * wide enough sample that losing one still yields a sensible ranking, and a
 * shelf should degrade rather than disappear.
 */
/**
 * This source ignores its own sort params, so "top rated" is derived here: pull
 * N pages, sort by the rating on each card, keep the best `limit`.
 *
 * Both knobs are caller-set because the two callers want different things — the
 * home shelf wants a fast row (3 pages), the browse grid wants a page worth of
 * results and can afford the extra parallel fetches.
 */
export async function browseTopRated(
  pages = 3,
  limit = 24
): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const settled = await Promise.allSettled(
    Array.from({ length: pages }, (_, i) => fetchHtml(`/genre-all/${i > 0 ? `?page=${i + 1}` : ""}`, 900))
  );

  const seen = new Set<string>();
  const all: Card[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const c of parseCards(s.value)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      all.push(c);
    }
  }

  all.sort((a, b) => b.rating - a.rating);
  // Exactly one page BY CONSTRUCTION: this shelf is the best `limit` of a fixed
  // sample, so there is no page 2 to offer and never was — hasNextPage has
  // always said so. Stating it as a total lets the pager render "1" honestly
  // instead of falling back to "we don't know".
  return { results: all.slice(0, limit), hasNextPage: false, totalPages: 1 };
}

export async function searchNovels(
  keyword: string,
  page = 1
): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const q = encodeURIComponent(keyword.trim());
  const html = await fetchHtml(`/search/?keyword=${q}${page > 1 ? `&page=${page}` : ""}`, 120);
  const results = parseCards(html);
  const hasNextPage = new RegExp(`href="[^"]*page=${page + 1}"`).test(html);
  // Search renders no pager here (verified live: not one page= link on the
  // results page), which for this template means the matches fit one page.
  const totalPages = pagerTotalPages(html, page, results.length);
  return { results, hasNextPage, ...(totalPages === undefined ? {} : { totalPages }) };
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  const html = await fetchHtml(`/novel/${slug}/`);

  const title =
    decode(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1]?.replace(/\s+by\s+.*$/i, "") || "") || slug;

  const cover = absCover(
    html.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1] ||
      html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ||
      ""
  );

  const author = decode(html.match(/class="author-link"[^>]*>([^<]+)</)?.[1] || "Unknown");
  const status = decode(html.match(/class="status-badge[^"]*"[^>]*>([^<]+)</)?.[1] || "Ongoing");

  const genres = Array.from(html.matchAll(/class="genre-tag[^"]*"[^>]*>([^<]+)</g))
    .map((g) => decode(g[1]))
    .filter(Boolean)
    .slice(0, 10);

  // The stat block renders the number, then the "Chapters" label.
  const total = Number(
    html.match(/class="stat-value"[^>]*>\s*(\d+)\s*<\/span>\s*<span class="stat-label">\s*Chapters/i)?.[1] ||
      html.match(/Read\s+(\d+)\s+Chapters/i)?.[1] ||
      0
  );

  const synopsisBlock = html.match(/class="summary-section"[\s\S]*?<\/div>/)?.[0] || "";
  const synopsis =
    decode(
      synopsisBlock
        .replace(/<h2[\s\S]*?<\/h2>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
    ) || "No synopsis available.";

  /**
   * Chapters are sequential and the page never lists them, so they're built
   * from the total.
   *
   * ASCENDING (1..N). They were emitted newest-first, and the reader paginates
   * by slicing this array — so the "1 - 100" tab was showing chapters 274 down
   * to 175, and opening a novel started you at the ending rather than chapter 1.
   */
  const chapters: NovelChapter[] = [];
  for (let n = 1; n <= total; n++) {
    chapters.push({ id: String(n), title: `Chapter ${n}`, number: n });
  }

  return { id: `lnw:${slug}`, novelId: slug, title, cover, author, status, genres, synopsis, chapters };
}

/**
 * Chapter body -> paragraphs.
 *
 * Ad blocks are STRIPPED, never treated as an end-of-chapter marker. Cutting the
 * capture at the first ad is exactly the bug that was silently truncating
 * chapters on another source — this site injects .chapter-ad-container inline,
 * so doing that here would lose everything after the first ad break.
 */
function htmlToParagraphs(block: string): string[] {
  const cleaned = block
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<ins[\s\S]*?<\/ins>/gi, "")
    .replace(/<div class="chapter-ad-container"[\s\S]*?<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");

  // Pull the <p> blocks out directly rather than splitting on every closing tag —
  // the region contains surrounding page chrome, and splitting blindly dragged
  // nav labels and script remnants in alongside the prose.
  const paras = Array.from(cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => m[1]);
  const source = paras.length ? paras : cleaned.split(/\n/);

  return source
    .map((p) => decode(p.replace(/<[^>]+>/g, "")))
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 1);
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  const n = String(chapterId).replace(/[^0-9]/g, "") || "1";
  const html = await fetchHtml(`/novel/${slug}/chapter/${n}/`, 600);

  const title = decode(html.match(/<h1 class="chapter-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") || `Chapter ${n}`);

  /**
   * The prose lives in #chapterText, nested inside .chapter-content.
   *
   * The previous attempt captured between .chapter-content and .chapter-nav,
   * which matched nothing — the nav block is rendered BEFORE the text in the
   * document, so that range ran backwards. Anchoring on #chapterText and
   * pulling the <p> blocks out of it avoids depending on sibling order or on
   * balancing nested divs with a regex.
   */
  const start = html.indexOf('id="chapterText"');
  const region = start >= 0 ? html.slice(start) : html;
  const content = htmlToParagraphs(region);

  const prevMatch = html.match(/href="\/novel\/[a-z0-9-]+\/chapter\/(\d+)\/"[^>]*class="[^"]*prev-btn/);
  const nextMatch = html.match(/href="\/novel\/[a-z0-9-]+\/chapter\/(\d+)\/"[^>]*class="[^"]*next-btn/);

  return {
    title,
    content: content.length ? content : ["This chapter could not be loaded."],
    prev: prevMatch?.[1] || null,
    next: nextMatch?.[1] || null,
  };
}
