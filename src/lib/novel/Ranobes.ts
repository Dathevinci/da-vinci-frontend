import { pagerTotalPages, type PageTotals } from "@/lib/explorePaging";

const BASE = "https://ranobes.top";
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

async function fetchHtml(path: string, init?: RequestInit): Promise<string> {
  const url = `${BASE}${path}`;
  const headers = {
    "User-Agent": UA,
    Referer: path.includes("/novels/") ? `${BASE}/ranking/` : `${BASE}/`,
    ...init?.headers
  };
  let res = await fetch(url, { ...init, headers } as any);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetch(url, { ...init, headers } as any);
  }
  if (!res.ok) throw new Error(`Ranobes HTTP ${res.status}`);
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

const absUrl = (src: string) => src ? (src.startsWith("http") ? src : `${BASE}${src}`) : "";

function parseCards(html: string): NovelResult[] {
  const out: NovelResult[] = [];
  const seen = new Set<string>();
  
  const re = /<h2 class="title"><a href="[^"]*\/novels\/(\d+)[^"]*">([^<]+)<\/a>[\s\S]*?<figure class="cover"[^>]*background-image:\s*url\(([^)]+)\)/gi;
  
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    const title = decode(m[2]);
    const cover = absUrl(m[3].replace(/['"]/g, ''));
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ id: `rnb:${slug}`, title, cover });
  }
  return out;
}

export async function browseNovels(page = 1, list = "rating"): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const sort = list === "most-popular-novel" || list === "rating" ? "rating" : "date";
  const path = page > 1 ? `/novels/page/${page}/?news_name=&news_author=&sort=${sort}&order=desc` : `/novels/?news_name=&news_author=&sort=${sort}&order=desc`;
  const html = await fetchHtml(path);
  const results = parseCards(html);
  const hasNextPage = html.includes(`page/${page + 1}/`);
  return { results, hasNextPage };
}

export async function searchNovels(query: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const q = encodeURIComponent(query.replace(/\s+/g, "+"));
  const path = page > 1 ? `/index.php?do=search&subaction=search&search_start=${page}&full_search=0&story=${q}` : `/index.php?do=search&subaction=search&story=${q}`;
  
  // Ranobes search requires POST for page > 1 or even page 1 sometimes, but GET works for page 1.
  const res = await fetch(`${BASE}/index.php?do=search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Referer: `${BASE}/`
    },
    body: `do=search&subaction=search&search_start=${page}&full_search=0&result_from=${(page - 1) * 10 + 1}&story=${q}`
  });
  
  if (!res.ok) throw new Error(`Ranobes Search HTTP ${res.status}`);
  const html = await res.text();
  const results = parseCards(html);
  
  const hasNextPage = html.includes(`search_start=${page + 1}`);
  return { results, hasNextPage };
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  let html = await fetchHtml(`/novels/${slug}-.html`);
  
  const rawTitle = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  const title = decode(rawTitle.replace(/<[^>]+>/g, " ").trim()) || slug;
  const coverMatch = html.match(/<div class="poster">[\s\S]*?<img[^>]*src="([^"]+)"/i);
  const cover = absUrl(coverMatch?.[1] || "");
  
  const authorMatch = html.match(/id="mc-fs-author"[^>]*>([^<]+)<\//i) || html.match(/Author:[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const author = authorMatch ? decode(authorMatch[1]) : "Unknown";
  
  const statusMatch = html.match(/Status:[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const status = statusMatch ? decode(statusMatch[1]).trim() : "Unknown";
  
  const genres: string[] = [];
  const genreMatch = html.match(/id="mc-fs-genre"[^>]*>([\s\S]*?)<\/div>/i);
  if (genreMatch) {
    const raw = decode(genreMatch[1].replace(/<[^>]+>/g, "").trim());
    genres.push(...raw.split(",").map(s => s.trim()).filter(Boolean));
  }

  const synopsisMatch = html.match(/<div class="moreless"[^>]*>([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decode(synopsisMatch[1].replace(/<[^>]+>/g, "\n")).replace(/\n+/g, "\n").trim() : "No synopsis.";

  const chapters: NovelChapter[] = [];
  
  const chHtml = await fetchHtml(`/chapters/${slug}/page/1/`);
  const dataMatch = chHtml.match(/window\.__DATA__\s*=\s*(\{.*?\});/);
  if (dataMatch) {
    try {
      const data = JSON.parse(dataMatch[1]);
      const count = data.count_all || 0;
      for (let i = 1; i <= count; i++) {
        chapters.push({
          id: String(i),
          title: `Chapter ${i}`,
          number: i
        });
      }
    } catch(e) {}
  }
  
  return { id: `rnb:${slug}`, novelId: slug, title, cover, author, status, genres, synopsis, chapters };
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  const num = parseInt(chapterId, 10) || 1;
  let chHtml = await fetchHtml(`/chapters/${slug}/page/1/`);
  let dataMatch = chHtml.match(/window\.__DATA__\s*=\s*(\{.*?\});/);
  
  if (!dataMatch) throw new Error("Could not load Ranobes chapters data");
  let data = JSON.parse(dataMatch[1]);
  
  const count_all = data.count_all || 0;
  const limit = data.limit || 25;
  
  const indexFromNewest = count_all - num;
  const targetPage = Math.floor(indexFromNewest / limit) + 1;
  const indexOnPage = indexFromNewest % limit;
  
  if (targetPage !== 1) {
    chHtml = await fetchHtml(`/chapters/${slug}/page/${targetPage}/`);
    dataMatch = chHtml.match(/window\.__DATA__\s*=\s*(\{.*?\});/);
    if (dataMatch) data = JSON.parse(dataMatch[1]);
  }
  
  const chapterNode = data.chapters[indexOnPage];
  if (!chapterNode || !chapterNode.link) throw new Error(`Chapter ${num} not found`);
  
  const html = await fetchHtml(chapterNode.link.replace(BASE, ""));
  
  const title = decode(html.match(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || chapterNode.title);
  
  const contentMatch = html.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>\s*<div class="category"/i) || html.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>\s*<div class="read_nav"/i);
  let content: string[] = [];
  if (contentMatch) {
    const raw = contentMatch[1].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<div class="gn_.*?<\/div>/gi, "");
    content = Array.from(raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map(m => decode(m[1].replace(/<[^>]+>/g, "").trim())).filter(p => p.length > 0);
  }
  
  if (content.length === 0) content.push("Failed to parse chapter content.");
  
  const prevNum = num > 1 ? String(num - 1) : null;
  const nextNum = num < count_all ? String(num + 1) : null;
  
  return { title, content, prev: prevNum, next: nextNum };
}
