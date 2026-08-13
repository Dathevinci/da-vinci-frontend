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
import { pagerTotalPages, type PageTotals } from "@/lib/explorePaging";

const BASE = "https://novelfull.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Max detail pages (25 chapters each) to walk for the chapter list. 30 → 750
// chapters; anything longer still reads fine via in-chapter prev/next.
const MAX_CHAPTER_PAGES = 30;

async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = {
    "User-Agent": UA,
    Referer: `${BASE}/`,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (res.ok) return res.text();
    throw new Error(`NovelFull ${res.status} for ${path}`);
  } catch (err: any) {
    const proxyUrl = `https://goodproxy.goodproxy.workers.dev/fetch?url=${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!proxyRes.ok) throw err;
    return proxyRes.text();
  }
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

// ── list rows (browse + search share the list markup) ───────────────────
function parseListRows(html: string): NovelResult[] {
  const out: NovelResult[] = [];
  const seen = new Set<string>();

  // 1. Try modern NovelFull markup (<div class="li-row"> or <div class="li">)
  const blocks = html.split(/class="li-row"|class="li"/);
  if (blocks.length > 1) {
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const slug = block.match(/href="\/([a-z0-9-]+)\.html"/)?.[1];
      if (!slug || slug === "novel-list" || seen.has(slug)) continue;
      seen.add(slug);

      const titleMatch = block.match(/<h3 class="tit">\s*<a[^>]*>([^<]+)<\/a>/i) || block.match(/title="([^"]+)"/i);
      const title = titleMatch ? titleMatch[1].trim() : slug;

      const coverMatch = block.match(/<img[^>]*(?:data-src|src)="([^"]+)"/i);
      const cover = coverMatch ? absCover(coverMatch[1]) : "";

      const chapMatch = block.match(/<a class="chapter"[^>]*>([\s\S]*?)<\/a>/i);
      const latestChapter = chapMatch ? chapMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined;

      out.push({
        id: `nf:${slug}`,
        title: decodeEntities(title),
        cover: absCover(cover),
        latestChapter: latestChapter ? decodeEntities(latestChapter) : undefined,
      });
    }
    if (out.length > 0) return out;
  }

  // 2. Fallback to classic NovelFull markup (<div class="row"> + <h3 class="truyen-title">)
  const startIdx = html.indexOf("list-truyen");
  const scoped = startIdx >= 0 ? html.slice(startIdx) : html;
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

export async function browseNovels(
  page = 1,
  list = "most-popular"
): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const nfList = LIST_MAP[list] || (list.startsWith("genre/") ? list : "most-popular");
  const html = await fetchHtml(`/${nfList}?page=${Math.max(1, page)}`);
  const results = parseListRows(html);
  const maxPage = maxPageOf(html, page);
  const totalPages = pagerTotalPages(html, page, results.length);
  return {
    results,
    hasNextPage: page < maxPage && results.length > 0,
    ...(totalPages === undefined ? {} : { totalPages }),
  };
}

export async function searchNovels(
  keyword: string,
  page = 1
): Promise<{ results: NovelResult[]; hasNextPage: boolean } & PageTotals> {
  const html = await fetchHtml(`/search?keyword=${encodeURIComponent(keyword)}&page=${Math.max(1, page)}`);
  const results = parseListRows(html);
  const maxPage = maxPageOf(html, page);
  const totalPages = pagerTotalPages(html, page, results.length);
  return {
    results,
    hasNextPage: page < maxPage && results.length > 0,
    ...(totalPages === undefined ? {} : { totalPages }),
  };
}

// ── detail + chapters ──────────────────────────────────────────────────────────
function parseChapterOptions(html: string): NovelChapter[] {
  const out: NovelChapter[] = [];
  const re = /<option[^>]*value="\/[a-z0-9-]+\/([^"/]+?)\.html"[^>]*>([^<]*)/gi;
  for (const m of html.matchAll(re)) {
    out.push({ id: m[1], title: decodeEntities(m[2] || m[1]), number: out.length + 1 });
  }
  return out;
}

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

  const title = decodeEntities(
    html.match(/<h1 class="tit">([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ||
    html.match(/<h3 class="title"[^>]*>([^<]+)<\/h3>/i)?.[1] ||
    slug
  );

  const cover = absCover(
    html.match(/<div class="pic"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i)?.[1] ||
    html.match(/<div class="book">\s*<img[^>]*(?:data-src|src)="([^"]+)"/i)?.[1] ||
    html.match(/(?:data-src|src)="([^"]*\/uploads\/[^"]*)"/i)?.[1] ||
    ""
  );

  const author = decodeEntities(
    html.match(/glyphicon-user[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1] ||
    html.match(/Author:[\s\S]{0,60}?<a[^>]*>([^<]+)<\/a>/i)?.[1] ||
    "Unknown"
  );

  const status = decodeEntities(
    html.match(/glyphicon-info-sign[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1] ||
    html.match(/Status:[\s\S]{0,80}?<a[^>]*>([^<]+)<\/a>/i)?.[1] ||
    "Unknown"
  );

  const genreMatches = Array.from(html.matchAll(/href="\/genre[s]?\/[^"]*"[^>]*>([^<]+)<\/a>/gi));
  const genres = Array.from(new Set(genreMatches.map((m) => decodeEntities(m[1])))).filter(Boolean).slice(0, 8);

  const synopsisMatch =
    html.match(/id="novel-summary-inner"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/class="desc-text"[^>]*>([\s\S]*?)<\/div>/i);
  const synopsis = decodeEntities(
    synopsisMatch ? synopsisMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ") : "No synopsis available."
  );

  const novelId = html.match(/data-novel-id="(\d+)"/i)?.[1] || "";

  // The full chapter list (all chapters) comes from ajax
  let chapters: NovelChapter[] = [];
  if (novelId) {
    try {
      const ajaxHtml = await fetchHtml(`/ajax/chapter-archive?novelId=${novelId}`);
      chapters = parseChapterOptions(ajaxHtml);
    } catch {}
  }

  // Fallback: parse whatever chapters are inlined on the detail page
  if (chapters.length === 0) {
    chapters = parseChapters(html);
  }

  return { id: `nf:${slug}`, novelId, title, cover, author, status, genres, synopsis, chapters };
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
    /**
     * Cut only at markers that genuinely FOLLOW the chapter.
     *
     * `class="ads` used to be in this list, and that silently truncated
     * chapters mid-way: this site injects ad blocks INSIDE the chapter body, so
     * the first inline ad ended the capture and every paragraph after it was
     * thrown away. The reader showed a chapter that just stopped.
     *
     * Inline ads never needed handling here — htmlToParagraphs below already
     * strips <script>, <style>, <ins> and ad/banner/adsbygoogle divs out of the
     * captured block. Removing them is right; cutting the chapter short at them
     * is not.
     */
    const cut = rest.search(/id="chapter-nav|class="[^"]*chapter-nav|id="comment|class="[^"]*comment|<footer/i);
    block = cut > 0 ? rest.slice(0, cut) : rest;
  }
  const content = htmlToParagraphs(block);

  const prevTag = html.match(/<a\b[^>]*\bid="prev_chap"[^>]*>/i)?.[0] || "";
  const nextTag = html.match(/<a\b[^>]*\bid="next_chap"[^>]*>/i)?.[0] || "";
  const prev = prevTag.match(/href="\/[a-z0-9-]+\/([^"/]+?)\.html"/i)?.[1] || null;
  const next = nextTag.match(/href="\/[a-z0-9-]+\/([^"/]+?)\.html"/i)?.[1] || null;

  return { title, content, prev, next };
}
