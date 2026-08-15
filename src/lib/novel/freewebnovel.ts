import axios from "axios";
import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";
import { ALL_MASTERPIECES } from "./masterpieces";
import { getExactSlug } from "./slugMapping";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE_URL = "https://freewebnovel.com";

// Multi-proxy pool with direct connection priority and fallback cascade
const PROXIES = [
  (url: string) => url,
  (url: string) => `https://goodproxy.goodproxy.workers.dev/fetch?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://proxy.cors.sh/${url}`,
];

// In-memory cache
const infoCache = new Map<string, { data: NovelInfo; timestamp: number }>();
const chapterCache = new Map<string, { data: ChapterContent; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function fetchWithProxyFallback(targetUrl: string): Promise<string | null> {
  for (const proxyBuilder of PROXIES) {
    try {
      const url = proxyBuilder(targetUrl);
      const res = await axios.get(url, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        timeout: 4500
      });
      if (
        res.status === 200 &&
        typeof res.data === "string" &&
        res.data.length > 400 &&
        !res.data.includes("Cloudflare</title>") &&
        !res.data.includes("Error 1015") &&
        !res.data.includes("rate limited") &&
        !res.data.includes("Access denied")
      ) {
        return res.data;
      }
    } catch {}
  }
  return null;
}

/**
 * FreeWebNovel's REAL listing pages — the catalogue behind the shelves.
 *
 * Until now nothing listed FWN at all: browse and every home shelf were slices
 * of the hand-curated ~96-novel masterpieces file, which is why novel mode
 * showed "not many novels" and why shelves overlapped almost completely
 * (koreanMasterpieces and cultivationEpics were both 100% contained in
 * latestUpdates, and lnwTop was literally an alias of lightNovels — measured
 * on the live feed). FWN itself carries thousands of titles behind stable,
 * server-rendered listing URLs (verified live, all 200):
 *
 *   /sort/latest-release/<page>    newest updates, 50+ pages
 *   /sort/most-popular/<page>      popularity ranking
 *   /sort/completed-novel/<page>   finished novels
 *   /genre/<Name>/<page>           per-genre catalogues
 *
 * Every card is a `<div class="li-row">` block carrying the slug, the title,
 * a cover (RELATIVE — /files/article/image/…), a star rating, genre links and
 * the newest chapter with its number. Covers hotlink freely (measured 200 with
 * no Referer and with a foreign one), so absolute URLs are usable as-is.
 */
export type FwnSort = "latest-release" | "most-popular" | "completed-novel";

export interface FwnListing {
  results: NovelResult[];
  hasNextPage: boolean;
  totalPages?: number;
}

function parseListingCards(html: string): NovelResult[] {
  const rows: NovelResult[] = [];
  const seen = new Set<string>();

  for (const block of html.split('<div class="li-row">').slice(1)) {
    const anchor = /<h3 class="tit"><a href="\/novel\/([a-z0-9-]+)"[^>]*title="([^"]+)"/i.exec(block);
    if (!anchor) continue;
    const [, slug, rawTitle] = anchor;
    const id = `fwn:${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // The cover is relative; the plain <img src> is the small stable variant.
    const img = /<img[^>]+src="(\/[^"]+\.(?:jpg|jpeg|png|webp))"/i.exec(block);
    // "Chapter 348: Fate Severed" — the anchor's title attribute carries it.
    const chapter = /<a href="\/novel\/[a-z0-9-]+\/chapter-[^"]*"[^>]*title="(Chapter[^"]+)"/i.exec(block);
    const genre = /<a href="\/genre\/([A-Za-z0-9+-]+)"/i.exec(block);

    rows.push({
      id,
      title: rawTitle.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&#039;/g, "'").trim(),
      cover: img ? `${BASE_URL}${img[1]}` : "",
      latestChapter: chapter ? chapter[1].replace(/&amp;/g, "&").trim() : undefined,
      tag: genre ? genre[1].replace(/\+/g, " ") : "Web Novel",
    });
  }
  return rows;
}

/** Max page number the listing's own pagination links to, or undefined. */
function parseTotalPages(html: string, pathPrefix: string): number | undefined {
  let max = 0;
  const re = new RegExp(pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\/(\\d+)", "g");
  for (const m of html.matchAll(re)) max = Math.max(max, Number(m[1]));
  return max > 0 ? max : undefined;
}

/**
 * LISTINGS ARE CACHED WITH SINGLE-FLIGHT, because FWN rate-limits bursts.
 *
 * Measured live: the same genre request succeeded once and fell back to the
 * curated pool twice in three tries. FWN sits behind Cloudflare rate limiting
 * (the fetch helper's own "Error 1015" check exists for it), and every home
 * feed hit was firing three listing fetches uncached — from a shared serverless
 * IP, that burst is exactly what trips the limit, and the trip is what made
 * shelves flap between live and curated content request-to-request.
 *
 * One fetch per listing page per TTL, shared by concurrent callers through an
 * in-flight promise so a cold cache cannot stampede. Failures are NOT cached:
 * a null result returns empty for this request (the caller falls back to the
 * curated pool) but leaves the next request free to try again — caching a
 * failure would pin the fallback in place for the whole TTL, which is the
 * mistake the Flame catalogue cache made once already.
 */
const LISTING_TTL = 10 * 60 * 1000;
const listingCache = new Map<string, { at: number; data: FwnListing }>();
const listingInflight = new Map<string, Promise<FwnListing>>();

async function fetchListing(path: string, page: number): Promise<FwnListing> {
  const key = `${path}/${page}`;
  const hit = listingCache.get(key);
  if (hit && Date.now() - hit.at < LISTING_TTL) return hit.data;

  const running = listingInflight.get(key);
  if (running) return running;

  const run = (async (): Promise<FwnListing> => {
    const html = await fetchWithProxyFallback(`${BASE_URL}${path}/${page}`);
    if (!html) return { results: [], hasNextPage: false };
    const results = parseListingCards(html);
    const totalPages = parseTotalPages(html, path);
    const data: FwnListing = {
      results,
      hasNextPage: totalPages ? page < totalPages : results.length >= 20,
      totalPages,
    };
    if (results.length > 0) listingCache.set(key, { at: Date.now(), data });
    return data;
  })().finally(() => {
    listingInflight.delete(key);
  });

  listingInflight.set(key, run);
  return run;
}

export async function listFreeWebNovel(sort: FwnSort, page = 1): Promise<FwnListing> {
  return fetchListing(`/sort/${sort}`, Math.max(1, page));
}

export async function listFreeWebNovelGenre(genre: string, page = 1): Promise<FwnListing> {
  // FWN capitalises genre slugs ("Fantasy", "Martial+Arts"); build that shape
  // from whatever the caller sends.
  const slug = genre
    .trim()
    .split(/[\s+]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("+");
  return fetchListing(`/genre/${slug}`, Math.max(1, page));
}

export async function searchFreeWebNovel(query: string): Promise<NovelResult[]> {
  try {
    const rawUrl = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;
    const html = await fetchWithProxyFallback(rawUrl);
    if (!html) return [];

    const matches = Array.from(html.matchAll(/<h3 class="tit"><a href="\/([^"]+)" title="([^"]+)">/gi));
    return matches.map((m: any) => ({
      id: `fwn:${m[1].replace(/^novel\//, '').replace(/\.html$/, '').replace(/^\//, '')}`,
      title: m[2].replace(/&amp;/g, '&').replace(/&apos;/g, "'").trim(),
      cover: "",
      tag: "Web Novel",
    }));
  } catch {
    return [];
  }
}

export async function getFreeWebNovelInfo(slug: string): Promise<NovelInfo> {
  const cleanSlug = getExactSlug(slug.replace(/^novel\//, '').replace(/\.html$/, ''));
  const cacheKey = cleanSlug;

  const cached = infoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Check if we have pre-verified masterpiece metadata
  const masterpiece = ALL_MASTERPIECES.find(m => m.id === `fwn:${cleanSlug}` || m.id.endsWith(cleanSlug) || cleanSlug.endsWith(m.id.replace(/^fwn:/, '')));

  // FreeWebNovel novel URL variations
  const url1 = `${BASE_URL}/novel/${cleanSlug}`;
  const url2 = `${BASE_URL}/${cleanSlug}.html`;
  const url3 = `${BASE_URL}/novel/${cleanSlug}/`;
  const url4 = `${BASE_URL}/novel/${cleanSlug}.html`;

  let html: string | null = null;
  for (const u of [url1, url2, url3, url4]) {
    const raw = await fetchWithProxyFallback(u);
    if (raw && !raw.includes("<title>Novels online") && !raw.includes("<h1 class=\"tit\">Novels online</h1>") && !raw.includes("HX is going to get some good stuff")) {
      html = raw;
      break;
    }
  }

  let title = masterpiece?.title || cleanSlug.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  let cover = masterpiece?.cover || "";
  let synopsis = masterpiece?.synopsis || "Synopsis currently loading.";
  let maxChapter = 0;
  const chapters: NovelChapter[] = [];

  // Parse known chapter count from masterpiece
  if (masterpiece?.latestChapter) {
    const num = parseInt(masterpiece.latestChapter.replace(/[^0-9]/g, ''));
    if (!isNaN(num) && num > maxChapter) {
      maxChapter = num;
    }
  }

  if (html) {
    const titleMatch = html.match(/<h1 class="tit"[^>]*>([\s\S]*?)<\/h1>/i);
    const descMatch = html.match(/<div class="inner"[^>]*>([\s\S]*?)<\/div>/i);
    const coverMatch = html.match(/<div class="pic"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);

    if (titleMatch && !masterpiece) title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (descMatch && (!masterpiece || masterpiece.synopsis.length < 100)) synopsis = descMatch[1].replace(/<[^>]+>/g, '').trim();
    if (coverMatch && !cover) cover = coverMatch[1].startsWith("http") ? coverMatch[1] : `${BASE_URL}${coverMatch[1]}`;

    // Extract all live chapter links from the novel page
    const chapMatches = Array.from(html.matchAll(/href="(\/[^"]*chapter-?(\d+)[^"]*)"/gi));
    for (const cm of chapMatches) {
      const num = parseInt(cm[2]);
      if (num && num > maxChapter) {
        maxChapter = num;
      }
    }
  }

  // Fallback default chapter count
  if (maxChapter < 50) {
    maxChapter = 100;
  }

  for (let i = 1; i <= maxChapter; i++) {
    chapters.push({
      id: String(i),
      number: i,
      title: `Chapter ${i}`
    });
  }

  const result: NovelInfo = {
    id: `fwn:${cleanSlug}`,
    novelId: cleanSlug,
    title,
    cover,
    author: masterpiece?.author || "Official Translation",
    status: masterpiece?.status || (maxChapter > 1000 ? "Ongoing" : "Completed"),
    genres: masterpiece?.genres || ["Fantasy", "Action", "Adventure"],
    synopsis,
    chapters,
    alternativeServers: [{ source: "freewebnovel", id: `fwn:${cleanSlug}`, name: "FreeWebNovel (Global Fast Server)" }]
  };

  infoCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function getFreeWebNovelChapter(slug: string, chapterId: string): Promise<ChapterContent> {
  const cleanSlug = getExactSlug(slug.replace(/^novel\//, '').replace(/\.html$/, ''));
  const cleanNum = chapterId.replace(/[^0-9]/g, '') || "1";
  const num = parseInt(cleanNum);
  const cacheKey = `${cleanSlug}::${num}`;

  const cached = chapterCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // FreeWebNovel chapter URL variations
  const urls = [
    `${BASE_URL}/${cleanSlug}/chapter-${num}.html`,
    `${BASE_URL}/novel/${cleanSlug}/chapter-${num}`,
    `${BASE_URL}/novel/${cleanSlug}/chapter-${num}.html`,
    `${BASE_URL}/${cleanSlug}/chapter-${num}`,
    `${BASE_URL}/novel/${cleanSlug}/chapter-0${num}`,
    `${BASE_URL}/${cleanSlug}/chapter-0${num}.html`
  ];

  let html: string | null = null;

  for (const u of urls) {
    const raw = await fetchWithProxyFallback(u);
    if (!raw) continue;

    // Reject redirect/fallback indicators
    if (
      raw.includes("<title>Novels online") ||
      raw.includes("HX is going to get some good stuff") ||
      raw.includes("More people who want to die") ||
      raw.includes("Wasn’t she at 109 temptation") ||
      raw.includes("Wasn't she at 109 temptation") ||
      raw.includes("Man i wish klein")
    ) {
      continue;
    }

    const hasText = raw.includes('class="txt"') || raw.includes('id="article"') || raw.includes('chapter-content') || raw.includes('view_title');
    if (hasText) {
      const titleMatch = raw.match(/<h1 class="tit"[^>]*>([\s\S]*?)<\/h1>/i) ||
                         raw.match(/<span class="view_title"[^>]*>([\s\S]*?)<\/span>/i) ||
                         raw.match(/<div class="chapter-title"[^>]*>([\s\S]*?)<\/div>/i);
      const titleText = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().toLowerCase() : "";
      if (titleText.includes("novels online")) {
        continue;
      }

      html = raw;
      break;
    }
  }

  const prev = num > 1 ? String(num - 1) : null;
  const next = String(num + 1);

  if (!html) {
    throw new Error(`Failed to retrieve Chapter ${num} for ${cleanSlug} from translation server`);
  }

  const titleMatch = html.match(/<h1 class="tit"[^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/<span class="view_title"[^>]*>([\s\S]*?)<\/span>/i) ||
                     html.match(/<div class="chapter-title"[^>]*>([\s\S]*?)<\/div>/i);

  const contentMatch = html.match(/<div class="txt"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div id="article"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div class="chapter-content"[^>]*>([\s\S]*?)<\/div>/i);

  const rawText = contentMatch ? contentMatch[1] : "";
  const cleanedParagraphs = rawText
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<div class="ads[\s\S]*?<\/div>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map(p => p.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
    .filter(p => p.length > 20 && !p.toLowerCase().includes("freewebnovel") && !p.toLowerCase().includes("report chapter") && !p.toLowerCase().includes("read latest chapters"));

  if (cleanedParagraphs.length === 0) {
    throw new Error(`Chapter ${num} content was empty or protected`);
  }

  const finalContent: ChapterContent = {
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : `Chapter ${num}`,
    content: cleanedParagraphs,
    prev,
    next
  };

  chapterCache.set(cacheKey, { data: finalContent, timestamp: Date.now() });
  return finalContent;
}
