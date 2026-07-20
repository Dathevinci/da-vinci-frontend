/**
 * ReadNovelFull scraper — SERVER-SIDE ONLY (used by the /api/novels routes).
 * Source: https://readnovelfull.com (plain HTML, no Cloudflare wall).
 *
 * Verified flow:
 *   browse:   /novel-list/<list>?page=N        → rows of /slug.html + cover + latest chapter
 *   search:   /ajax/search-novel?keyword=Q     → <a href="/slug.html" title="Title">
 *   detail:   /<slug>.html                     → title, data-novel-id, cover, author, status, genres, desc
 *   chapters: /ajax/chapter-archive?novelId=ID → <a href="/slug/chapter-...html">
 *   content:  /<slug>/<chapterId>.html         → #chr-content text
 */

const BASE = "https://readnovelfull.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface NovelResult {
  id: string; // slug, no .html
  title: string;
  cover: string;
  latestChapter?: string;
}

export interface NovelChapter {
  id: string; // chapter path segment, e.g. "chapter-1-nightmare-begins"
  title: string;
  number: number;
}

export interface NovelInfo {
  id: string;
  novelId: string; // readnovelfull numeric id (for chapter-archive)
  title: string;
  cover: string;
  author: string;
  status: string;
  genres: string[];
  synopsis: string;
  chapters: NovelChapter[];
}

export interface ChapterContent {
  title: string;
  content: string[]; // paragraphs
  prev: string | null; // previous chapter id
  next: string | null; // next chapter id
}

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "User-Agent": UA,
      Referer: `${BASE}/`,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`ReadNovelFull ${res.status} for ${path}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// readnovelfull serves resized covers via /thumb/t-WxH/ — request a portrait crop.
function portraitCover(url: string): string {
  if (!url) return "";
  const u = url.startsWith("http") ? url : `https:${url.replace(/^\/\//, "")}`;
  return u.replace(/\/thumb\/t-\d+x\d+\//, "/thumb/t-300x439/");
}

// ── list rows (browse) ────────────────────────────────────────────────────────
function parseListRows(html: string): NovelResult[] {
  // Scope to the main novel list container to avoid sidebar widgets.
  const startIdx = html.indexOf('class="list list-novel');
  const scoped = startIdx >= 0 ? html.slice(startIdx) : html;
  const out: NovelResult[] = [];
  const seen = new Set<string>();
  const rows = scoped.split(/<div class="row"/);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const slug = row.match(/href="\/([a-z0-9][a-z0-9-]*)\.html"/)?.[1];
    if (!slug || slug === "novel-list" || seen.has(slug)) continue;
    const title =
      row.match(/href="\/[a-z0-9-]+\.html"[^>]*title="([^"]*)"/)?.[1] ||
      row.match(/href="\/[a-z0-9-]+\.html"[^>]*>\s*([^<]+?)\s*</)?.[1] ||
      slug;
    const cover = row.match(/(?:data-src|src)="([^"]*img\.readnovelfull\.com[^"]*)"/)?.[1] || "";
    const latest = row.match(/href="\/[a-z0-9-]+\/chapter-[^"]*"[^>]*>(?:\s*<[^>]+>\s*)*([^<]+)/)?.[1];
    seen.add(slug);
    out.push({
      id: slug,
      title: decodeEntities(title),
      cover: portraitCover(cover),
      latestChapter: latest ? decodeEntities(latest) : undefined,
    });
  }
  return out;
}

export async function browseNovels(
  page = 1,
  list = "most-popular-novel"
): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const safeList = /^[a-z0-9-]+$/.test(list) ? list : "most-popular-novel";
  const html = await fetchHtml(`/novel-list/${safeList}?page=${Math.max(1, page)}`);
  const results = parseListRows(html);
  const pages = Array.from(html.matchAll(/[?&]page=(\d+)/g)).map((m) => Number(m[1]));
  const maxPage = pages.length ? Math.max(...pages) : page;
  return { results, hasNextPage: page < maxPage && results.length > 0 };
}

// ── search ────────────────────────────────────────────────────────────────────
export async function searchNovels(keyword: string): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const html = await fetchHtml(`/ajax/search-novel?keyword=${encodeURIComponent(keyword)}`);
  const out: NovelResult[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="\/([a-z0-9-]+)\.html"[^>]*title="([^"]*)"/g)) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ id: slug, title: decodeEntities(m[2]), cover: "" });
  }
  return { results: out, hasNextPage: false };
}

// ── detail ────────────────────────────────────────────────────────────────────
function parseChapters(html: string, slug: string): NovelChapter[] {
  const out: NovelChapter[] = [];
  const re = new RegExp(`href="\\/${slug}\\/([^"/]+?)\\.html"[^>]*(?:title="([^"]*)")?[^>]*>(?:\\s*<[^>]+>\\s*)*([^<]*)`, "g");
  let n = 0;
  for (const m of html.matchAll(re)) {
    const id = m[1];
    const title = decodeEntities(m[2] || m[3] || id);
    n += 1;
    out.push({ id, title, number: n });
  }
  return out;
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  const html = await fetchHtml(`/${slug}.html`);
  const title = decodeEntities(html.match(/<h3 class="title"[^>]*>([^<]+)<\/h3>/)?.[1] || slug);
  const novelId = html.match(/data-novel-id="(\d+)"/)?.[1] || "";
  const cover = portraitCover(html.match(/(?:data-src|src)="([^"]*img\.readnovelfull\.com[^"]*)"/)?.[1] || "");
  const author = decodeEntities(html.match(/href="\/authors\/[^"]*"[^>]*>([^<]+)<\/a>/)?.[1] || "Unknown");
  const status = decodeEntities(html.match(/Status:<\/h3>\s*<a[^>]*>([^<]+)<\/a>/)?.[1] || "Unknown");
  const genreBlock = html.match(/Genre:<\/h3>([\s\S]*?)<\/li>/)?.[1] || "";
  const genres = Array.from(genreBlock.matchAll(/href="\/genres\/[^"]*"[^>]*>([^<]+)<\/a>/g)).map((m) => decodeEntities(m[1]));
  const descBlock = html.match(/<div class="desc-text"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const synopsis = decodeEntities(descBlock.replace(/<[^>]+>/g, " "));

  let chapters: NovelChapter[] = [];
  if (novelId) {
    try {
      const chHtml = await fetchHtml(`/ajax/chapter-archive?novelId=${novelId}`);
      chapters = parseChapters(chHtml, slug);
    } catch {
      /* chapters optional; detail still returns */
    }
  }
  return { id: slug, novelId, title, cover, author, status, genres, synopsis, chapters };
}

// ── chapter content ───────────────────────────────────────────────────────────
function htmlToParagraphs(raw: string): string[] {
  let s = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<ins[\s\S]*?<\/ins>/gi, "")
    .replace(/<div[^>]*(?:class|id)="[^"]*(?:ad|banner|pub_|unit)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  s = s.replace(/<\/p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  return s
    .split(/\n+/)
    .map((p) => decodeEntities(p))
    .filter((p) => p.length > 1);
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  const html = await fetchHtml(`/${slug}/${chapterId}.html`);
  const title = decodeEntities(
    html.match(/<span class="chr-text">([^<]+)<\/span>/)?.[1] ||
      html.match(/<a class="chr-title"[^>]*>(?:\s*<[^>]+>\s*)*([^<]+)/)?.[1] ||
      ""
  );

  // Capture #chr-content up to the chapter-nav / comments that follow it.
  let block = "";
  const startM = html.match(/id="chr-content"[^>]*>/);
  if (startM && startM.index != null) {
    let rest = html.slice(startM.index + startM[0].length);
    const cut = rest.search(/class="[^"]*chr-nav|id="chapter-comment|class="chapter-nav|<footer/i);
    if (cut > 0) rest = rest.slice(0, cut);
    block = rest;
  }
  const content = htmlToParagraphs(block);

  // Grab the prev/next anchor tags (attribute order varies), then pull the href.
  const prevTag = html.match(/<a\b[^>]*\bid="prev_chap"[^>]*>/i)?.[0] || "";
  const nextTag = html.match(/<a\b[^>]*\bid="next_chap"[^>]*>/i)?.[0] || "";
  const prev = prevTag.match(/href="\/[a-z0-9-]+\/([^"/]+?)\.html"/)?.[1] || null;
  const next = nextTag.match(/href="\/[a-z0-9-]+\/([^"/]+?)\.html"/)?.[1] || null;

  return { title, content, prev, next };
}
