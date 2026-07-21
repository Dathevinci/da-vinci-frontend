/**
 * NovelFull scraper — SERVER-SIDE ONLY. Source: https://novelfull.net (the
 * classic NovelFull template; plain HTML, no Cloudflare wall). A much larger,
 * cleaner (non-MTL) library than readnovelfull/fanmtl — it carries the licensed
 * titles the others lacked: Overlord (LN), Tensei Shitara Slime Datta Ken,
 * Omniscient Reader's Viewpoint, "Got Dropped into a Ghost Story", etc.
 *
 * Verified:
 *   browse:   /<list>?page=N            (hot-novel | most-popular | latest-release-novel | completed-novel)
 *   search:   /search?keyword=Q&page=N
 *   detail:   /<slug>.html              → title/cover/author/status/genres/desc
 *   chapters: /<slug>.html?page=N       → <ul class="list-chapter"> <a href="/<slug>/<ch>.html">  (25/page, ascending)
 *   content:  /<slug>/<chapterId>.html  → #chapter-content
 *
 * ids are prefixed "nf:" so the multi-source router (sources.ts) can dispatch.
 */

import type { NovelResult, NovelChapter, NovelInfo, ChapterContent } from "./ReadNovelFull";

const BASE = "https://novelfull.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Max detail pages (25 chapters each) to walk for the chapter list. 30 → 750
// chapters; anything longer still reads fine via in-chapter prev/next.
const MAX_CHAPTER_PAGES = 30;

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
    headers: {
      "User-Agent": UA,
      Referer: `${BASE}/`,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NovelFull ${res.status} for ${path}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function absCover(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

// The list tabs use readnovelfull-style names; map them to NovelFull's lists.
const LIST_MAP: Record<string, string> = {
  "most-popular-novel": "most-popular",
  "most-popular": "most-popular",
  "hot-novel": "hot-novel",
  "latest-release-novel": "latest-release-novel",
  "completed-novel": "completed-novel",
};

// ── list rows (browse + search share the list-truyen markup) ───────────────────
function parseListRows(html: string): NovelResult[] {
  // Scope to the results container so the genre-filter dropdown at the top of the
  // page (which also holds /genre/ links) can't pollute the results.
  const startIdx = html.indexOf("list-truyen");
  const scoped = startIdx >= 0 ? html.slice(startIdx) : html;
  const out: NovelResult[] = [];
  const seen = new Set<string>();
  const rows = scoped.split(/<div class="row"/);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const slug = row.match(/<h3 class="truyen-title">\s*<a[^>]*href="\/([a-z0-9][a-z0-9-]*)\.html"/i)?.[1];
    if (!slug || seen.has(slug)) continue;
    const title =
      row.match(/<h3 class="truyen-title">\s*<a[^>]*title="([^"]*)"/i)?.[1] ||
      row.match(/<h3 class="truyen-title">\s*<a[^>]*>([^<]+)</i)?.[1] ||
      slug;
    const cover =
      row.match(/(?:data-src|data-cfsrc|src)="([^"]*\/uploads\/[^"]*)"/i)?.[1] ||
      row.match(/(?:data-src|src)="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)?.[1] ||
      "";
    const latest =
      row.match(/class="[^"]*chapter-title[^"]*"[^>]*>([^<]+)/i)?.[1] ||
      row.match(/href="\/[a-z0-9-]+\/[^"]+\.html"[^>]*title="([^"]*chapter[^"]*)"/i)?.[1];
    seen.add(slug);
    out.push({
      id: `nf:${slug}`,
      title: decodeEntities(title),
      cover: absCover(cover),
      latestChapter: latest ? decodeEntities(latest) : undefined,
    });
  }
  return out;
}

function maxPageOf(html: string, current: number): number {
  const pages = Array.from(html.matchAll(/[?&]page=(\d+)/g)).map((m) => Number(m[1]));
  return pages.length ? Math.max(current, ...pages) : current;
}

export async function browseNovels(page = 1, list = "most-popular"): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const nfList = LIST_MAP[list] || "most-popular";
  const html = await fetchHtml(`/${nfList}?page=${Math.max(1, page)}`);
  const results = parseListRows(html);
  const maxPage = maxPageOf(html, page);
  return { results, hasNextPage: page < maxPage && results.length > 0 };
}

export async function searchNovels(keyword: string, page = 1): Promise<{ results: NovelResult[]; hasNextPage: boolean }> {
  const html = await fetchHtml(`/search?keyword=${encodeURIComponent(keyword)}&page=${Math.max(1, page)}`);
  const results = parseListRows(html);
  const maxPage = maxPageOf(html, page);
  return { results, hasNextPage: page < maxPage && results.length > 0 };
}

// ── detail + chapters ──────────────────────────────────────────────────────────
// Chapters live on the paginated detail page inside <ul class="list-chapter">.
function parseChapters(html: string): NovelChapter[] {
  const m = html.match(/<ul class="list-chapter">([\s\S]*?)<\/ul>/i);
  const block = m ? m[1] : "";
  const out: NovelChapter[] = [];
  const re = /href="\/[a-z0-9-]+\/([^"/]+?)\.html"[^>]*(?:title="([^"]*)")?[^>]*>(?:\s*<[^>]+>\s*)*([^<]*)/gi;
  for (const mm of block.matchAll(re)) {
    out.push({ id: mm[1], title: decodeEntities(mm[2] || mm[3] || mm[1]), number: out.length + 1 });
  }
  return out;
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  const html = await fetchHtml(`/${slug}.html`);

  const title = decodeEntities(html.match(/<h3 class="title"[^>]*>([^<]+)<\/h3>/i)?.[1] || slug);
  const cover = absCover(
    html.match(/<div class="book">\s*<img[^>]*(?:data-src|src)="([^"]+)"/i)?.[1] ||
      html.match(/(?:data-src|src)="([^"]*\/uploads\/[^"]*)"/i)?.[1] ||
      ""
  );

  // The <div class="info"> block holds Author / Genre / Status; scope to it so the
  // page-wide genre-filter dropdown doesn't leak in.
  const infoStart = html.indexOf('<div class="info">');
  const descIdx = html.indexOf("desc-text");
  const info = infoStart >= 0 ? html.slice(infoStart, descIdx > infoStart ? descIdx : infoStart + 3000) : "";
  const author = decodeEntities(info.match(/Author:[\s\S]{0,60}?<a[^>]*>([^<]+)<\/a>/i)?.[1] || "Unknown");
  const status = decodeEntities(info.match(/Status:[\s\S]{0,80}?<a[^>]*>([^<]+)<\/a>/i)?.[1] || "Unknown");
  const genres = Array.from(info.matchAll(/href="\/genre[s]?\/[^"]*"[^>]*>([^<]+)<\/a>/gi))
    .map((m) => decodeEntities(m[1]))
    .filter(Boolean)
    .slice(0, 8);

  const descBlock = html.match(/<div class="desc-text"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const synopsis = decodeEntities(descBlock.replace(/<[^>]+>/g, " "));

  // Walk the paginated chapter list.
  let chapters = parseChapters(html);
  const maxPage = Math.min(maxPageOf(html, 1), MAX_CHAPTER_PAGES);
  if (maxPage > 1) {
    const rest = await Promise.allSettled(
      Array.from({ length: maxPage - 1 }, (_, i) => fetchHtml(`/${slug}.html?page=${i + 2}`))
    );
    const seen = new Set(chapters.map((c) => c.id));
    for (const r of rest) {
      if (r.status !== "fulfilled") continue;
      for (const ch of parseChapters(r.value)) {
        if (seen.has(ch.id)) continue;
        seen.add(ch.id);
        chapters.push({ ...ch, number: chapters.length + 1 });
      }
    }
  }

  return { id: `nf:${slug}`, novelId: slug, title, cover, author, status, genres, synopsis, chapters };
}

// ── chapter content ─────────────────────────────────────────────────────────────
function htmlToParagraphs(raw: string): string[] {
  let s = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<ins[\s\S]*?<\/ins>/gi, "")
    .replace(/<div[^>]*(?:class|id)="[^"]*(?:ad|banner|pub_|unit|adsbygoogle)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  s = s.replace(/<\/p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  return s.split(/\n+/).map((p) => decodeEntities(p)).filter((p) => p.length > 1);
}

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  const html = await fetchHtml(`/${slug}/${chapterId}.html`);

  const title = decodeEntities(
    html.match(/<a[^>]*class="chapter-title"[^>]*title="([^"]+)"/i)?.[1] ||
      html.match(/<span class="chapter-text">([^<]+)<\/span>/i)?.[1] ||
      html.match(/<h2[^>]*>(?:\s*<[^>]+>\s*)*([^<]{1,120})/i)?.[1] ||
      `Chapter`
  );

  // Capture #chapter-content up to the nav / comments / footer that follow it.
  let block = "";
  const startM = html.match(/id="chapter-content"[^>]*>/i);
  if (startM && startM.index != null) {
    let rest = html.slice(startM.index + startM[0].length);
    const cut = rest.search(/id="chapter-nav|class="[^"]*chapter-nav|id="comment|class="[^"]*comment|<footer|class="ads/i);
    block = cut > 0 ? rest.slice(0, cut) : rest;
  }
  const content = htmlToParagraphs(block);

  const prevTag = html.match(/<a\b[^>]*\bid="prev_chap"[^>]*>/i)?.[0] || "";
  const nextTag = html.match(/<a\b[^>]*\bid="next_chap"[^>]*>/i)?.[0] || "";
  const prev = prevTag.match(/href="\/[a-z0-9-]+\/([^"/]+?)\.html"/i)?.[1] || null;
  const next = nextTag.match(/href="\/[a-z0-9-]+\/([^"/]+?)\.html"/i)?.[1] || null;

  return { title, content, prev, next };
}
