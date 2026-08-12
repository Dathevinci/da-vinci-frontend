import { pagerTotalPages, type PageTotals } from "@/lib/explorePaging";

const BASE = "https://wuxiaworld.site";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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

async function fetchHtml(url: string, init?: RequestInit): Promise<string> {
  // Use node global fetch which should be undici. 
  // Disable TLS checks only for this hostname using an agent or just depend on Next.js fetch.
  // Next.js fetch doesn't support custom agent easily without undici dispatcher.
  // Using global fetch with dispatcher for self-signed cert bypassing.
  
  // Actually, we can just use regular fetch with an undici dispatcher
  const { Agent } = require("undici");
  const agent = new Agent({
    connect: { rejectUnauthorized: false }
  });
  
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Referer: `${BASE}/`, ...init?.headers },
    dispatcher: agent,
  } as any);
  if (!res.ok) throw new Error(`WuxiaWorldSite HTTP ${res.status}`);
  return res.text();
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

function parseCards(html: string): NovelResult[] {
  const out: NovelResult[] = [];
  const seen = new Set<string>();
  
  const re = /<div class="(?:c-tabs-item__content|page-item-detail[^"]*)">[\s\S]*?<a href="https:\/\/wuxiaworld\.site\/novel\/([^/]+)\/"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
  
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let slug = m[1];
    let cover = m[2];
    let title = decode(m[3]);
    
    const dataSrcMatch = html.substring(m.index, m.index + 500).match(/data-src="([^"]+)"/);
    if (dataSrcMatch) cover = dataSrcMatch[1];
    cover = cover.replace(/render_jsfalse$/, "");
    
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ id: `wws:${slug}`, title, cover });
  }
  return out;
}

export async function browseNovels(page = 1, list = "trending"): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const sort = list === "most-popular-novel" || list === "trending" ? "trending" : "latest";
  const url = `${BASE}/page/${page}/?s=&post_type=wp-manga&m_orderby=${sort}`;
  const html = await fetchHtml(url);
  const results = parseCards(html);
  const hasNextPage = new RegExp(`href="[^"]*page/${page + 1}/`).test(html);
  return { results, hasNextPage };
}

export async function searchNovels(query: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const q = encodeURIComponent(query);
  const url = `${BASE}/page/${page}/?s=${q}&post_type=wp-manga`;
  const html = await fetchHtml(url);
  const results = parseCards(html);
  const hasNextPage = new RegExp(`href="[^"]*page/${page + 1}/`).test(html);
  return { results, hasNextPage };
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  const html = await fetchHtml(`${BASE}/novel/${slug}/`);
  
  const titleMatch = html.match(/<div class="post-title">[\s\S]*?<h1>(.*?)<\/h1>/i) || html.match(/<title>(.*?)- WuxiaWorld/i);
  const title = titleMatch ? decode(titleMatch[1].replace(/<[^>]+>/g, "")) : slug;
  
  const coverMatch = html.match(/<div class="summary_image">[\s\S]*?src="([^"]+)"/i);
  let cover = coverMatch ? coverMatch[1] : "";
  cover = cover.replace(/render_jsfalse$/, "");
  
  const authorMatch = html.match(/<div class="author-content">[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const author = authorMatch ? decode(authorMatch[1]) : "Unknown";
  
  const statusMatch = html.match(/<div class="post-status">[\s\S]*?<div class="summary-content">([^<]+)<\/div>/i);
  const status = statusMatch ? decode(statusMatch[1]).trim() : "Unknown";
  
  const genres: string[] = [];
  const genreRe = /<div class="genres-content">([\s\S]*?)<\/div>/i;
  const genreHtml = html.match(genreRe);
  if (genreHtml) {
    const genreMatches = Array.from(genreHtml[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi));
    genres.push(...genreMatches.map(m => decode(m[1])));
  }

  const synopsisMatch = html.match(/<div class="summary__content[^"]*">([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decode(synopsisMatch[1].replace(/<[^>]+>/g, "\n")).replace(/\n+/g, "\n").trim() : "No synopsis.";

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
        number: 0
      });
    }
  }

  chapters.reverse();
  for (let i = 0; i < chapters.length; i++) {
    chapters[i].number = i + 1;
  }
  
  if (chapters.length === 0) {
    try {
      const idMatch = html.match(/data-id="(\d+)"/i) || html.match(/id="manga-chapters-holder"\s*data-id="(\d+)"/i);
      if (idMatch) {
        const mangaId = idMatch[1];
        const ajaxRes = await fetch(`${BASE}/wp-admin/admin-ajax.php`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, Referer: `${BASE}/novel/${slug}/` },
          body: `action=manga_get_chapters&manga=${mangaId}`,
          dispatcher: new (require("undici").Agent)({ connect: { rejectUnauthorized: false } })
        } as any);
        const ajaxHtml = await ajaxRes.text();
        for (const m of Array.from(ajaxHtml.matchAll(chapRe))) {
          const link = m[1];
          const chapTitle = decode(m[2].replace(/<[^>]+>/g, "").trim());
          const chapMatch = link.match(/\/novel\/[^/]+\/([^/]+)\/?$/);
          if (chapMatch) {
            chapters.push({ id: chapMatch[1], title: chapTitle, number: 0 });
          }
        }
        chapters.reverse();
        for (let i = 0; i < chapters.length; i++) {
          chapters[i].number = i + 1;
        }
      }
    } catch(e) {}
  }

  return { id: `wws:${slug}`, novelId: slug, title, cover, author, status, genres, synopsis, chapters };
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  const url = `${BASE}/novel/${slug}/${chapterId}/`;
  const html = await fetchHtml(url);
  
  const titleMatch = html.match(/<li class="active">([^<]+)<\/li>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? decode(titleMatch[1].trim()) : "Chapter";
  
  const contentMatch = html.match(/<div class="text-left">([\s\S]*?)<\/div>\s*<div class="cha-tit">/i) || html.match(/<div class="text-left">([\s\S]*?)<\/div>\s*<\/div>/i);
  let content: string[] = [];
  if (contentMatch) {
    const raw = contentMatch[1].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
    content = Array.from(raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map(m => decode(m[1].replace(/<[^>]+>/g, "").trim())).filter(p => p.length > 0);
  }
  
  if (content.length === 0) content.push("Failed to parse chapter content.");
  
  const prevMatch = html.match(/<a href="([^"]+)" class="btn prev_page"/i);
  let prev = prevMatch ? prevMatch[1].match(/\/novel\/[^/]+\/([^/]+)\/?$/)?.[1] || null : null;
  const nextMatch = html.match(/<a href="([^"]+)" class="btn next_page"/i);
  let next = nextMatch ? nextMatch[1].match(/\/novel\/[^/]+\/([^/]+)\/?$/)?.[1] || null : null;
  
  return { title, content, prev, next };
}
