import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";
import { pagerTotalPages } from "@/lib/explorePaging";

/**
 * ReadNovelFull — the novel mode's source, chosen 2026-08-13 by measurement.
 *
 * Three candidates survived home-IP screening and were walked end-to-end FROM
 * PRODUCTION (listing → detail → chapter list → chapter TEXT). NovelFull — the
 * previous era's pick — answered Vercel with 403 + a challenge, the exact
 * FlameComics failure that ended two manhwa sources. ReadNovelFull passed
 * every step: 3,816 chapters for one novel in a single archive call, and a
 * 13k-character chapter of real prose. RoyalRoad also passed and remains the
 * measured backup (original English fiction) if a second source is ever wanted.
 *
 * NO-MTL: this is the classic human-translation aggregation — the same family
 * the project once chose novelfull from for exactly that reason.
 *
 * THE CHAPTER-SLUG GOTCHA, learned the hard way in the first era and preserved
 * here: a novel's PAGE slug can carry a version suffix ("world-defying-dan-
 * god-v1") while its chapters live under the bare slug ("/world-defying-dan-
 * god/chapter-001…"). So chapter ids are NEVER derived from the novel slug —
 * the archive returns every chapter's real path and those paths are stored
 * verbatim, encoded as "<parent>|<file>" because a path with a slash cannot
 * survive as one Next.js route segment.
 */

const BASE = "https://readnovelfull.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Referer: BASE + "/" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`ReadNovelFull HTTP ${r.status} for ${url}`);
  return r.text();
}

const unescapeHtml = (raw: string) =>
  (raw || "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const stripTags = (html: string) => unescapeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * Listing thumbnails come as 200x89 LANDSCAPE strips; the same CDN serves a
 * real portrait at t-300x439 (measured: 43KB of actual portrait art, not an
 * upscale). Only the known thumb pattern is rewritten — an unknown URL passes
 * through untouched rather than being "fixed" into a 404.
 */
const portraitCover = (url: string | undefined) =>
  url ? url.replace(/\/thumb\/t-\d+x\d+\//, "/thumb/t-300x439/") : "";

/** The lists the site actually publishes. */
export const RNF_LISTS: Record<string, string> = {
  "most-popular-novel": "most-popular-novel",
  "latest-release-novel": "latest-release-novel",
  "completed-novel": "completed-novel",
  "hot-novel": "hot-novel",
};

/**
 * One page of a listing (or of search — same template).
 *
 * SPLIT ON THE ROW CONTAINER, NEVER ON THE TITLE HEADING. The template puts
 * each row's <img> BEFORE its <h3 class="novel-title"> inside one
 * <div class="row">, so a split on the heading hands every row the NEXT row's
 * image — all twenty covers looked present and every one belonged to the
 * novel below it. The mirror test caught it as "19/20 covers" (the last row
 * had nobody to steal from), which is the visible tip of a fully shifted list.
 * Splitting on the row container keeps each image with its own novel.
 */
function parseRows(html: string): NovelResult[] {
  const rows: NovelResult[] = [];
  const seen = new Set<string>();
  for (const block of html.split(/<div class="row">/i).slice(1)) {
    const a = /<h3 class="novel-title">\s*<a href="\/([a-z0-9-]+)\.html"[^>]*title="([^"]+)"/i.exec(block);
    if (!a) continue;
    const [, slug, title] = a;
    const id = `rnf:${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const img = /<img[^>]+(?:data-src|src)="(https?:\/\/img\.readnovelfull\.com\/[^"]+)"/i.exec(block);
    rows.push({
      id,
      title: unescapeHtml(title.trim()),
      cover: portraitCover(img?.[1]),
    });
  }
  return rows;
}

export interface RnfPage {
  results: NovelResult[];
  hasNextPage: boolean;
  totalPages?: number;
}

export async function listNovels(list: string, page = 1): Promise<RnfPage> {
  const slug = RNF_LISTS[list] || "most-popular-novel";
  const p = Math.max(1, page);
  const html = await fetchHtml(`${BASE}/novel-list/${slug}?page=${p}`);
  const results = parseRows(html);
  // pagerTotalPages was written against THIS template family — it reads the
  // "Last" link and data-page attributes, both verified live on this site.
  const totalPages = pagerTotalPages(html, p, results.length);
  return {
    results,
    hasNextPage: totalPages ? p < totalPages : results.length >= 20,
    totalPages,
  };
}

export async function searchNovels(query: string, page = 1): Promise<RnfPage> {
  const q = String(query || "").trim();
  if (!q) return { results: [], hasNextPage: false };
  const p = Math.max(1, page);
  // The FULL search page, not /ajax/search-novel — the ajax one is a tiny
  // autocomplete with no covers, the first era's documented wrong turn.
  const html = await fetchHtml(`${BASE}/novel-list/search?keyword=${encodeURIComponent(q)}&page=${p}`);
  const results = parseRows(html);
  const totalPages = pagerTotalPages(html, p, results.length);
  return {
    results,
    hasNextPage: totalPages ? p < totalPages : results.length >= 20,
    totalPages,
  };
}

/** "<parent>|<file>" — see the chapter-slug gotcha in the header. */
const chapterIdFromPath = (path: string): string | null => {
  const m = /^\/([a-z0-9-]+)\/([a-zA-Z0-9-]+\.html)$/i.exec(String(path || "").trim());
  return m ? `${m[1]}|${m[2]}` : null;
};

/** "Chapter 12.5" → 12.5; falls back to the row's position when absent. */
const chapterNumberOf = (title: string, indexFromEnd: number, total: number) => {
  const m = /chapter\s*([\d.]+)/i.exec(title);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : total - indexFromEnd;
};

export async function getInfo(slug: string): Promise<NovelInfo> {
  const html = await fetchHtml(`${BASE}/${slug}.html`);

  const title =
    stripTags(/<h3 class="title"[^>]*>([\s\S]*?)<\/h3>/i.exec(html)?.[1] || "") || slug.replace(/-/g, " ");
  const coverRaw = /<div class="book">[\s\S]*?<img[^>]+(?:data-src|src)="(https?:\/\/[^"]+)"/i.exec(html)?.[1];
  const synopsis = stripTags(/<div class="desc-text"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] || "");
  const author = stripTags(/<h3>Author:<\/h3>([\s\S]*?)<\/li>/i.exec(html)?.[1] || "") || "Unknown";
  const genres = [
    ...new Set(
      [...html.matchAll(/href="\/novel-list\/genre\/[^"]*"[^>]*>([^<]+)</gi)]
        .map((m) => unescapeHtml(m[1].trim()))
        .filter(Boolean)
    ),
  ];
  const statusText = stripTags(/<h3>Status:<\/h3>([\s\S]*?)<\/li>/i.exec(html)?.[1] || "");

  const novelId = /data-novel-id="(\d+)"/.exec(html)?.[1] || "";
  let chapters: NovelChapter[] = [];
  if (novelId) {
    // The ENTIRE chapter list in one call — measured returning 3,816 rows for
    // one novel from production. Never the paginated walk: the first era's
    // paginated version silently capped long novels at 750 chapters.
    const archive = await fetchHtml(`${BASE}/ajax/chapter-archive?novelId=${novelId}`);
    const raw = [...archive.matchAll(/<a href="([^"]+\.html)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
    chapters = raw
      .map((m, i) => {
        const id = chapterIdFromPath(m[1]);
        if (!id) return null;
        const label =
          unescapeHtml((m[2] || "").trim()) ||
          stripTags(m[3]) ||
          id.split("|")[1].replace(/\.html$/, "").replace(/-/g, " ");
        return { id, title: label, number: chapterNumberOf(label, raw.length - 1 - i, raw.length) };
      })
      .filter((c): c is NovelChapter => c !== null);
  }

  return {
    id: `rnf:${slug}`,
    novelId,
    title,
    cover: portraitCover(coverRaw) || coverRaw || "",
    author,
    status: /ongoing/i.test(statusText) ? "Ongoing" : /completed/i.test(statusText) ? "Completed" : statusText || "Unknown",
    genres,
    synopsis,
    chapters,
  };
}

export async function getChapter(chapterId: string): Promise<ChapterContent> {
  const [parent, file] = String(chapterId || "").split("|");
  if (!parent || !file) throw new Error("Invalid ReadNovelFull chapter id");
  const html = await fetchHtml(`${BASE}/${parent}/${file}`);

  const body = /<div[^>]*id="chr-content"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] || "";
  // The reader renders a PARAGRAPH ARRAY, so paragraphs are extracted rather
  // than the raw HTML being handed over — which also drops scripts and ad
  // blocks without needing to enumerate them.
  const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 0);
  // Some chapters are bare text with <br> instead of <p>.
  const content = paragraphs.length
    ? paragraphs
    : stripTags(body.replace(/<br\s*\/?>/gi, "\n"))
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean);
  if (content.join("").length < 50) throw new Error("ReadNovelFull returned no chapter text");

  const title =
    stripTags(/<a[^>]*class="chr-title"[^>]*>([\s\S]*?)<\/a>/i.exec(html)?.[1] || "") ||
    file.replace(/\.html$/, "").replace(/-/g, " ");
  // The href comes BEFORE the id in these anchors, and the tag spans several
  // lines — [^>]* crosses newlines, but attribute ORDER had to match reality.
  // A disabled prev/next (chapter 1, latest chapter) carries no href at all
  // and correctly yields null.
  const prev = /<a[^>]*href="([^"]+\.html)"[^>]*id="prev_chap"/i.exec(html)?.[1];
  const next = /<a[^>]*href="([^"]+\.html)"[^>]*id="next_chap"/i.exec(html)?.[1];

  return {
    title,
    content,
    prev: prev ? chapterIdFromPath(prev) : null,
    next: next ? chapterIdFromPath(next) : null,
  };
}
