import axios from "axios";
import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";
import { ALL_MASTERPIECES } from "./masterpieces";
import { getExactSlug } from "./slugMapping";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE_URL = "https://freewebnovel.com";

// Multi-proxy parallel pool with direct-first priority and fast Promise.any racing
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
  try {
    const promises = PROXIES.map(async (proxyBuilder) => {
      const url = proxyBuilder(targetUrl);
      const res = await axios.get(url, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        timeout: 5500
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
      throw new Error("Invalid response");
    });
    return await Promise.any(promises);
  } catch {
    return null;
  }
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
