import { pagerTotalPages, type PageTotals } from "@/lib/explorePaging";

const BASE_COM = "https://www.wuxiaworld.com";
const BASE_SITE = "https://wuxiaworld.site";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const RELAY = "https://goodproxy.goodproxy.workers.dev/fetch?url=";

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

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof process !== "undefined" && process.env) {
    if (process.env.WUXIAWORLD_COOKIE) {
      headers["Cookie"] = process.env.WUXIAWORLD_COOKIE;
    }
    if (process.env.WUXIAWORLD_BEARER_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.WUXIAWORLD_BEARER_TOKEN}`;
    }
  }
  return headers;
}

async function fetchJson(url: string): Promise<any> {
  const headers = {
    "User-Agent": UA,
    Accept: "application/json",
    Referer: `${BASE_COM}/`,
    ...getAuthHeaders(),
  };
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (res.ok) return await res.json();
  } catch {}

  try {
    const proxyUrl = `${RELAY}${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (proxyRes.ok) return await proxyRes.json();
  } catch {}

  return null;
}

async function fetchHtml(url: string, init?: RequestInit): Promise<string> {
  const authHeaders = getAuthHeaders();
  const headers = {
    "User-Agent": UA,
    Referer: `${BASE_COM}/`,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...authHeaders,
    ...init?.headers,
  };

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(12000),
    } as any);

    if (res.ok) return await res.text();
  } catch {}

  // Fallback: Worker relay proxy
  try {
    const proxyUrl = `${RELAY}${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl, {
      headers: { "User-Agent": UA, ...authHeaders },
      signal: AbortSignal.timeout(15000),
    });
    if (proxyRes.ok) return await proxyRes.text();
  } catch {}

  throw new Error(`Failed to fetch from Wuxiaworld: ${url}`);
}

function extractReactQueryState(html: string): any {
  const marker = "window.__REACT_QUERY_STATE__";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;
  const slice = html.slice(startIdx + marker.length);
  const equalIdx = slice.indexOf("=");
  if (equalIdx === -1) return null;
  const fromEqual = slice.slice(equalIdx + 1).trim();
  const endIdx = fromEqual.indexOf("window.__");
  let jsonStr = endIdx !== -1 ? fromEqual.slice(0, endIdx).trim() : fromEqual;
  jsonStr = jsonStr.replace(/;\s*$/, "");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (lastBrace !== -1) {
    try {
      return JSON.parse(jsonStr.slice(0, lastBrace + 1));
    } catch {}
  }
  return null;
}

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "object" && v.value !== undefined) return v.value;
  return String(v);
}

function decode(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#([0-9]{1,7});/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .trim();
}

function cleanWuxiaCover(rawUrl: string | undefined | null): string {
  if (!rawUrl || rawUrl.includes("dflazy.jpg")) return "";
  let url = rawUrl.trim();
  url = url.replace(/render_jsfalse.*$/, "");
  if (url.startsWith("//")) url = `https:${url}`;
  else if (url.startsWith("/")) url = `https://wuxiaworld.site${url}`;
  else if (!url.startsWith("http")) url = `https://wuxiaworld.site/${url}`;

  url = url.replace(/-\d+x\d+(\.[a-z]+)?$/i, (match, ext) => ext || "");
  url = url.replace(/-\d+x\d+\.$/, "");
  url = url.replace(/\.$/, "");

  return url;
}

export async function browseNovels(page = 1, list = "trending"): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  // 1. Try wuxiaworld.com JSON API
  try {
    const apiUrl =
      list === "trending" || list === "most-popular-novel"
        ? `${BASE_COM}/api/novels/top?type=weekly`
        : `${BASE_COM}/api/novels?page=${page}&size=20`;

    const json = await fetchJson(apiUrl);
    if (json && (json.items || json.result)) {
      const rawList = (json.items || []).flatMap((g: any) => g.novels || g);
      const results: NovelResult[] = rawList.map((n: any) => ({
        id: `wws:${n.slug}`,
        title: n.name || n.title,
        cover: n.coverUrl || "",
        latestChapter: n.chapterCount ? `Chapter ${n.chapterCount}` : undefined,
      }));

      if (results.length > 0) {
        return {
          results,
          hasNextPage: page < 10,
        };
      }
    }
  } catch {}

  // 2. Fallback to wuxiaworld.site HTML
  try {
    const sort = list === "most-popular-novel" || list === "trending" ? "trending" : "latest";
    const url = `${BASE_SITE}/page/${page}/?s=&post_type=wp-manga&m_orderby=${sort}`;
    const html = await fetchHtml(url);
    const re = /<div class="[^"]*(?:c-tabs-item__content|page-item-detail)[^"]*">[\s\S]*?<a href="https:\/\/wuxiaworld\.site\/novel\/([^/]+)\/"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    const results: NovelResult[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const slug = m[1];
      const block = m[2];
      const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
      const title = decode(titleMatch ? titleMatch[1].trim() : slug);

      const dataSrc = block.match(/data-src="([^"]+)"/i)?.[1];
      const dataSrcset = block.match(/data-srcset="([^",\s]+)/i)?.[1];
      const src = block.match(/src="([^"]+)"/i)?.[1];

      const candidate = [dataSrc, dataSrcset, src].find((u) => u && !u.includes("dflazy.jpg"));
      const cover = cleanWuxiaCover(candidate);

      if (seen.has(slug)) continue;
      seen.add(slug);
      results.push({ id: `wws:${slug}`, title, cover });
    }
    const hasNextPage = new RegExp(`href="[^"]*page/${page + 1}/`).test(html);
    return { results, hasNextPage };
  } catch {
    return { results: [], hasNextPage: false };
  }
}

export async function searchNovels(query: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  // 1. Try wuxiaworld.com search API
  try {
    const q = encodeURIComponent(query);
    const json = await fetchJson(`${BASE_COM}/api/novels?search=${q}&page=${page}&size=20`);
    if (json && json.items && json.items.length > 0) {
      const results: NovelResult[] = json.items.map((n: any) => ({
        id: `wws:${n.slug}`,
        title: n.name,
        cover: n.coverUrl || "",
        latestChapter: n.chapterCount ? `Chapter ${n.chapterCount}` : undefined,
      }));
      return { results, hasNextPage: false };
    }
  } catch {}

  // 2. Fallback to wuxiaworld.site search
  try {
    const q = encodeURIComponent(query);
    const url = `${BASE_SITE}/page/${page}/?s=${q}&post_type=wp-manga`;
    const html = await fetchHtml(url);
    const re = /<div class="[^"]*(?:c-tabs-item__content|page-item-detail)[^"]*">[\s\S]*?<a href="https:\/\/wuxiaworld\.site\/novel\/([^/]+)\/"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    const results: NovelResult[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const slug = m[1];
      const block = m[2];
      const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
      const title = decode(titleMatch ? titleMatch[1].trim() : slug);

      const dataSrc = block.match(/data-src="([^"]+)"/i)?.[1];
      const dataSrcset = block.match(/data-srcset="([^",\s]+)/i)?.[1];
      const src = block.match(/src="([^"]+)"/i)?.[1];

      const candidate = [dataSrc, dataSrcset, src].find((u) => u && !u.includes("dflazy.jpg"));
      const cover = cleanWuxiaCover(candidate);
      results.push({ id: `wws:${slug}`, title, cover });
    }
    const hasNextPage = new RegExp(`href="[^"]*page/${page + 1}/`).test(html);
    return { results, hasNextPage };
  } catch {
    return { results: [], hasNextPage: false };
  }
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  // 1. Try wuxiaworld.com React Query State extraction
  try {
    const html = await fetchHtml(`${BASE_COM}/novel/${slug}`);
    const state = extractReactQueryState(html);
    const novelItem = state?.queries?.find((q: any) => q.queryKey[0] === "novel")?.state?.data?.item;

    if (novelItem) {
      const chapters: NovelChapter[] = [];
      const groups = novelItem.chapterGroups || [];
      const allChapters = groups.flatMap((g: any) => g.chapterList || []);

      for (let i = 0; i < allChapters.length; i++) {
        const c = allChapters[i];
        chapters.push({
          id: c.slug,
          title: c.name || `Chapter ${i + 1}`,
          number: i + 1,
        });
      }

      return {
        id: `wws:${slug}`,
        novelId: slug,
        title: val(novelItem.name),
        cover: val(novelItem.coverUrl),
        author: val(novelItem.authorName) || "Unknown",
        status: novelItem.status === 1 ? "Ongoing" : "Completed",
        genres: novelItem.genres || [],
        synopsis: val(novelItem.synopsis).replace(/<[^>]+>/g, "").trim(),
        chapters,
      };
    }
  } catch {}

  // 2. Fallback to wuxiaworld.site HTML parser
  const html = await fetchHtml(`${BASE_SITE}/novel/${slug}/`);

  const titleMatch = html.match(/<div class="post-title">[\s\S]*?<h1>(.*?)<\/h1>/i) || html.match(/<title>(.*?)- WuxiaWorld/i);
  const title = titleMatch ? decode(titleMatch[1].replace(/<[^>]+>/g, "")) : slug;

  const summaryImageBlock = html.match(/<div class="summary_image">([\s\S]*?)<\/div>/i)?.[1] || "";
  const dataSrc = summaryImageBlock.match(/data-src="([^"]+)"/i)?.[1];
  const dataSrcset = summaryImageBlock.match(/data-srcset="([^",\s]+)/i)?.[1];
  const src = summaryImageBlock.match(/src="([^"]+)"/i)?.[1];
  const candidateCover = [dataSrc, dataSrcset, src].find((u) => u && !u.includes("dflazy.jpg"));
  const cover = cleanWuxiaCover(candidateCover);

  const authorMatch = html.match(/<div class="author-content">[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const author = authorMatch ? decode(authorMatch[1]) : "Unknown";

  const statusMatch = html.match(/<div class="post-status">[\s\S]*?<div class="summary-content">([^<]+)<\/div>/i);
  const status = statusMatch ? decode(statusMatch[1]).trim() : "Unknown";

  const genres: string[] = [];
  const genreRe = /<div class="genres-content">([\s\S]*?)<\/div>/i;
  const genreHtml = html.match(genreRe);
  if (genreHtml) {
    const genreMatches = Array.from(genreHtml[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi));
    genres.push(...genreMatches.map((m) => decode(m[1])));
  }

  const synopsisMatch = html.match(/<div class="summary__content[^"]*">([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decode(synopsisMatch[1].replace(/<[^>]+>/g, "\n")).replace(/\n+/g, "\n").trim() : "No synopsis available.";

  const chapters: NovelChapter[] = [];
  const chapRe = /<li class="wp-manga-chapter[^"]*">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of Array.from(html.matchAll(chapRe))) {
    const link = m[1];
    const chapTitle = decode(m[2].replace(/<[^>]+>/g, "").trim());
    const chapMatch = link.match(/\/novel\/[^/]+\/([^/]+)\/?$/);
    if (chapMatch) {
      chapters.push({
        id: chapMatch[1],
        title: chapTitle,
        number: 0,
      });
    }
  }

  chapters.reverse();
  for (let i = 0; i < chapters.length; i++) {
    chapters[i].number = i + 1;
  }

  return { id: `wws:${slug}`, novelId: slug, title, cover, author, status, genres, synopsis, chapters };
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  // 1. Try wuxiaworld.com React Query state extraction
  try {
    const html = await fetchHtml(`${BASE_COM}/novel/${slug}/${chapterId}`);
    const state = extractReactQueryState(html);
    const chapItem = state?.queries?.find((q: any) => q.queryKey[0] === "chapter")?.state?.data?.item;

    if (chapItem && chapItem.content) {
      const raw = val(chapItem.content);
      const content = raw
        .replace(/<\/p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<p[^>]*>/gi, "")
        .replace(/<[^>]+>/g, "")
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      return {
        title: chapItem.name || "Chapter",
        content,
        prev: chapItem.relatedChapterInfo?.previousChapter?.slug || null,
        next: chapItem.relatedChapterInfo?.nextChapter?.slug || null,
      };
    }
  } catch {}

  // 2. Fallback to wuxiaworld.site HTML
  const url = `${BASE_SITE}/novel/${slug}/${chapterId}/`;
  const html = await fetchHtml(url);

  const titleMatch = html.match(/<li class="active">([^<]+)<\/li>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? decode(titleMatch[1].trim()) : "Chapter";

  const isLocked =
    html.includes("chapter-locked") ||
    html.includes("vip-content") ||
    html.includes("This chapter is locked") ||
    html.includes("Unlock with Karma");

  const contentMatch =
    html.match(/<div class="text-left">([\s\S]*?)<\/div>\s*<div class="cha-tit">/i) ||
    html.match(/<div class="text-left">([\s\S]*?)<\/div>\s*<\/div>/i) ||
    html.match(/<div class="reading-content">([\s\S]*?)<\/div>/i);

  let content: string[] = [];
  if (contentMatch) {
    const raw = contentMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div class="cha-tit.*?<\/div>/gi, "");
    content = Array.from(raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => decode(m[1].replace(/<[^>]+>/g, "").trim()))
      .filter((p) => p.length > 0);
  }

  if (content.length === 0) {
    if (isLocked) {
      content.push(
        "🔒 This chapter is currently VIP / Karma locked on Wuxiaworld.",
        "To read this chapter, please log in with your VIP credentials or check back once the chapter is publicly released."
      );
    } else {
      content.push("Unable to load chapter content. Please check another chapter or source.");
    }
  }

  const prevMatch = html.match(/<a href="([^"]+)" class="btn prev_page"/i);
  let prev = prevMatch ? prevMatch[1].match(/\/novel\/[^/]+\/([^/]+)\/?$/)?.[1] || null : null;
  const nextMatch = html.match(/<a href="([^"]+)" class="btn next_page"/i);
  let next = nextMatch ? nextMatch[1].match(/\/novel\/[^/]+\/([^/]+)\/?$/)?.[1] || null : null;

  return { title, content, prev, next };
}
