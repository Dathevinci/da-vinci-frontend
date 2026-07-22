/**
 * FanMTL scraper — SERVER-SIDE ONLY. A large machine-translation aggregator
 * (adds titles readnovelfull lacks, e.g. Omniscient Reader's Viewpoint).
 * Source: https://www.fanmtl.com (no Cloudflare wall).
 *
 * Verified:
 *   browse:   /list/all/all-onclick-<page>.html      → <li class="novel-item">
 *   search:   POST /e/search/index.php (keyboard=..) → result page, same items
 *   detail:   /novel/<slug>.html                     → title/cover/author/status/genres
 *   chapters: /e/extend/fy.php?page=<p>&wjm=<slug>   → /novel/<slug>_<num>.html
 *   content:  /novel/<slug>_<num>.html               → .chapter-content <p>…
 */

import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./ReadNovelFull";

const BASE = "https://www.fanmtl.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchHtml(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
    ...init,
    headers: {
      "User-Agent": UA,
      Referer: `${BASE}/`,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(init?.headers || {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`FanMTL ${res.status} for ${path}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

function absCover(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ── list items (browse + search share <li class="novel-item">) ────────────────
function parseItems(html: string): NovelResult[] {
  const out: NovelResult[] = [];
  const seen = new Set<string>();
  const items = html.split('class="novel-item');
  for (let i = 1; i < items.length; i++) {
    const it = items[i];
    const slug = it.match(/href="\/novel\/([^"/]+?)\.html"/)?.[1];
    if (!slug || seen.has(slug)) continue;
    const title = it.match(/title="([^"]+)"/)?.[1] || slug;
    // Covers are lazy-loaded: prefer data-src, ignore the placeholder in src.
    const cover = it.match(/data-src="([^"]+)"/)?.[1] || "";
    seen.add(slug);
    out.push({ id: `fmtl:${slug}`, title: decodeEntities(title), cover: absCover(cover) });
  }
  return out;
}

export async function browseNovels(page = 1, category = "all"): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const html = await fetchHtml(`/list/${category}/all-onclick-${Math.max(1, page)}.html`);
  const results = parseItems(html);
  return { results, hasNextPage: results.length > 0 };
}

export async function searchNovels(keyword: string): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  try {
    const body = new URLSearchParams({ keyboard: keyword, show: "title", tempid: "1", tbname: "news", Submit: "" });
    const html = await fetchHtml(`/e/search/index.php`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return { results: parseItems(html), hasNextPage: false };
  } catch {
    return { results: [], hasNextPage: false };
  }
}

// ── detail ────────────────────────────────────────────────────────────────────
async function fetchChapters(slug: string): Promise<NovelChapter[]> {
  const map = new Map<number, NovelChapter>();
  for (let page = 0; page < 40; page++) {
    let html = "";
    try {
      html = await fetchHtml(`/e/extend/fy.php?page=${page}&wjm=${encodeURIComponent(slug)}`);
    } catch {
      break;
    }
    const before = map.size;
    const re = new RegExp(`href="\\/novel\\/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d+)\\.html"[^>]*(?:title="([^"]*)")?[^>]*>(?:\\s*<[^>]+>\\s*)*([^<]*)`, "g");
    for (const m of html.matchAll(re)) {
      const num = Number(m[1]);
      if (map.has(num)) continue;
      map.set(num, { id: String(num), title: decodeEntities(m[2] || m[3] || `Chapter ${num}`), number: num });
    }
    if (map.size === before) break; // no new chapters on this page
  }
  return Array.from(map.values()).sort((a, b) => a.number - b.number);
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  const html = await fetchHtml(`/novel/${slug}.html`);
  const flat = html.replace(/\n/g, " ");
  const title = decodeEntities(flat.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/)?.[1] || flat.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] || slug);
  const cover = absCover(flat.match(/<figure class="novel-cover"[^>]*>[\s\S]*?(?:data-src|src)="([^"]+)"/)?.[1] || flat.match(/data-src="([^"]+)"/)?.[1] || "");
  const author = decodeEntities(flat.match(/itemprop="author"[^>]*>([^<]+)</)?.[1] || flat.match(/authorname[^>]*>([^<]+)</)?.[1] || "Unknown");
  const status = decodeEntities(flat.match(/>\s*(Completed|Ongoing|Hiatus|Dropped)\s*</i)?.[1] || "Unknown");
  const genres = Array.from(flat.matchAll(/href="\/genre[^"]*"[^>]*>([^<]{1,30})</g)).map((m) => decodeEntities(m[1])).filter(Boolean).slice(0, 8);
  const descBlock = flat.match(/class="summary"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || flat.match(/<div class="content"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const synopsis = decodeEntities(descBlock.replace(/<[^>]+>/g, " ")) || "";

  let chapters: NovelChapter[] = [];
  try {
    chapters = await fetchChapters(slug);
  } catch {
    /* chapters optional */
  }
  return { id: `fmtl:${slug}`, novelId: slug, title, cover, author, status, genres, synopsis, chapters };
}

// ── chapter content ───────────────────────────────────────────────────────────
function htmlToParagraphs(raw: string): string[] {
  let s = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<ins[\s\S]*?<\/ins>/gi, "")
    .replace(/<div[^>]*align="center"[^>]*>[\s\S]*?<\/div>/gi, "");
  s = s.replace(/<\/p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  return s.split(/\n+/).map((p) => decodeEntities(p)).filter((p) => p.length > 1);
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  const num = Number(chapterId);
  const html = await fetchHtml(`/novel/${slug}_${chapterId}.html`);
  const flat = html.replace(/\n/g, " ");
  const title = decodeEntities(
    flat.match(/<h2[^>]*>([^<]{1,80})<\/h2>/)?.[1] ||
      flat.match(/class="chapter-title"[^>]*>([^<]+)/)?.[1] ||
      `Chapter ${chapterId}`
  );
  // Capture .chapter-content up to </article>. A non-greedy </div> match would
  // stop at the leading ad <div align="center">…</div> and yield no text.
  let block = "";
  const cm = flat.match(/class="chapter-content"[^>]*>/);
  if (cm && cm.index != null) {
    let rest = flat.slice(cm.index + cm[0].length);
    const end = rest.search(/<\/article>|class="chapter-nav|id="comment|class="footer/i);
    block = end > 0 ? rest.slice(0, end) : rest;
  }
  const content = htmlToParagraphs(block);
  const prev = Number.isFinite(num) && num > 1 ? String(num - 1) : null;
  const next = Number.isFinite(num) ? String(num + 1) : null;
  return { title, content, prev, next };
}
