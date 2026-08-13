import { pagerTotalPages, type PageTotals } from "@/lib/explorePaging";

const BASES = ["https://ranobes.top", "https://ranobes.net"];
let activeBase = BASES[0];
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

async function fetchHtml(path: string, init?: RequestInit): Promise<string> {
  const domains = [activeBase, ...BASES.filter((b) => b !== activeBase)];
  let lastError: any = null;

  for (const base of domains) {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    const headers = {
      "User-Agent": UA,
      Referer: path.includes("/novels/") ? `${base}/ranking/` : `${base}/`,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...init?.headers,
    };

    try {
      let res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(10000) } as any);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
        res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(10000) } as any);
      }
      if (res.ok) {
        activeBase = base;
        return await res.text();
      }
      lastError = new Error(`Ranobes HTTP ${res.status} on ${base}`);
    } catch (e: any) {
      lastError = e;
    }
  }

  // Fallback: try worker relay proxy
  try {
    const primaryUrl = `${activeBase}${path}`;
    const proxyUrl = `${RELAY}${encodeURIComponent(primaryUrl)}`;
    const proxyRes = await fetch(proxyUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (proxyRes.ok) return await proxyRes.text();
  } catch {}

  throw lastError || new Error("Ranobes unavailable");
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

const absUrl = (src: string) => (src ? (src.startsWith("http") ? src : `${activeBase}${src}`) : "");

function parseCards(html: string): NovelResult[] {
  const out: NovelResult[] = [];
  const seen = new Set<string>();

  // Extract each novel article block
  const cardMatches = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi));
  for (let i = 0; i < cardMatches.length; i++) {
    const block = cardMatches[i][0];
    const slugMatch = block.match(/href="[^"]*\/novels\/(\d+)[^"]*"/i);
    const slug = slugMatch ? slugMatch[1] : `novel-${i}`;

    // Multi-source title resolution: img alt > <h2 class="title"> a > title attribute
    const imgAlt = block.match(/<img[^>]*alt="([^"]+)"/i)?.[1];
    const h2Text = block.match(/<h2 class="title"><a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const titleAttr = block.match(/title="Start reading:\s*([^"]+)"/i)?.[1] || block.match(/title="([^"]+)"/i)?.[1];
    const title = decode(imgAlt || h2Text || titleAttr || slug).trim();

    const coverMatch =
      block.match(/background-image:\s*url\(([^)]+)\)/i) ||
      block.match(/<img[^>]*(?:data-src|src)="([^"]+)"/i);
    let rawCover = coverMatch ? (coverMatch[1] || coverMatch[2]).replace(/['"]/g, "") : "";
    const cover = absUrl(rawCover);

    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ id: `rnb:${slug}`, title, cover });
  }

  // Fallback: regex scan if article blocks were not found
  if (out.length === 0) {
    const re = /<h2 class="title"><a href="[^"]*\/novels\/(\d+)[^"]*">([^<]+)<\/a>[\s\S]*?(?:background-image:\s*url\(([^)]+)\)|src="([^"]+)")/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const slug = m[1];
      const title = decode(m[2]);
      const rawCover = m[3] || m[4] || "";
      const cover = absUrl(rawCover.replace(/['"]/g, ""));
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ id: `rnb:${slug}`, title, cover });
    }
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

  try {
    const res = await fetch(`${activeBase}/index.php?do=search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
        Referer: `${activeBase}/`,
      },
      body: `do=search&subaction=search&search_start=${page}&full_search=0&result_from=${(page - 1) * 10 + 1}&story=${q}`,
    });

    if (res.ok) {
      const html = await res.text();
      const results = parseCards(html);
      const hasNextPage = html.includes(`search_start=${page + 1}`);
      return { results, hasNextPage };
    }
  } catch {}

  // Fallback to GET search
  const path = page > 1 ? `/index.php?do=search&subaction=search&search_start=${page}&full_search=0&story=${q}` : `/index.php?do=search&subaction=search&story=${q}`;
  const html = await fetchHtml(path);
  const results = parseCards(html);
  const hasNextPage = html.includes(`search_start=${page + 1}`);
  return { results, hasNextPage };
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  let html = await fetchHtml(`/novels/${slug}-.html`);

  const rawTitle = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  const title = decode(rawTitle.replace(/<[^>]+>/g, " ").trim()) || slug;
  const coverMatch = html.match(/<div class="poster">[\s\S]*?<img[^>]*src="([^"]+)"/i) || html.match(/<img[^>]*class="[^"]*poster[^"]*"[^>]*src="([^"]+)"/i);
  const cover = absUrl(coverMatch?.[1] || "");

  const authorMatch = html.match(/id="mc-fs-author"[^>]*>([^<]+)<\//i) || html.match(/Author:[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const author = authorMatch ? decode(authorMatch[1]) : "Unknown";

  const statusMatch = html.match(/Status:[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const status = statusMatch ? decode(statusMatch[1]).trim() : "Unknown";

  const genres: string[] = [];
  const genreMatch = html.match(/id="mc-fs-genre"[^>]*>([\s\S]*?)<\/div>/i);
  if (genreMatch) {
    const raw = decode(genreMatch[1].replace(/<[^>]+>/g, "").trim());
    genres.push(...raw.split(",").map((s) => s.trim()).filter(Boolean));
  }

  const synopsisMatch = html.match(/<div class="moreless"[^>]*>([\s\S]*?)<\/div>/i) || html.match(/<div id="fs-info"[^>]*>([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decode(synopsisMatch[1].replace(/<[^>]+>/g, "\n")).replace(/\n+/g, "\n").trim() : "No synopsis available.";

  const chapters: NovelChapter[] = [];

  try {
    const chHtml = await fetchHtml(`/chapters/${slug}/page/1/`);
    const dataMatch = chHtml.match(/window\.__DATA__\s*=\s*(\{.*?\});/);
    if (dataMatch) {
      const data = JSON.parse(dataMatch[1]);
      const count = data.count_all || 0;
      for (let i = 1; i <= count; i++) {
        chapters.push({
          id: String(i),
          title: `Chapter ${i}`,
          number: i,
        });
      }
    }
  } catch (e) {}

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

  const chapterNode = data.chapters?.[indexOnPage];
  if (!chapterNode || !chapterNode.link) throw new Error(`Chapter ${num} not found`);

  const relLink = chapterNode.link.replace(/^https?:\/\/[^/]+/, "");
  const html = await fetchHtml(relLink);

  const title = decode(html.match(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || chapterNode.title || `Chapter ${num}`);

  const contentMatch =
    html.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>\s*<div class="category"/i) ||
    html.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>\s*<div class="read_nav"/i) ||
    html.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<div id="arrticle"[^>]*>([\s\S]*?)<\/div>/i);

  let content: string[] = [];
  if (contentMatch) {
    const raw = contentMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div class="gn_.*?<\/div>/gi, "")
      .replace(/<div class="read_nav.*?<\/div>/gi, "");
    content = Array.from(raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => decode(m[1].replace(/<[^>]+>/g, "").trim()))
      .filter((p) => p.length > 0);
  }

  if (content.length === 0) content.push("Failed to parse chapter content or chapter is locked.");

  const prevNum = num > 1 ? String(num - 1) : null;
  const nextNum = num < count_all ? String(num + 1) : null;

  return { title, content, prev: prevNum, next: nextNum };
}
