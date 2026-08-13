import * as cheerio from "cheerio";
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";
import { getNovelCover } from "../anilist";
import { getKitsuNovelCover } from "../kitsu";

import * as NF from "./NovelFull";

const BASE = "https://files.lnori.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const RELAY = "https://goodproxy.goodproxy.workers.dev/fetch?url=";

let catalogCache: { title: string; slug: string; id: string }[] | null = null;
let catalogTime = 0;

const FALLBACK_CATALOG = [
  { title: "Solo Leveling", slug: "i-alone-level-up", id: "lnori:i-alone-level-up" },
  { title: "Overlord", slug: "overlord-ln", id: "lnori:overlord-ln" },
  { title: "Omniscient Reader's Viewpoint", slug: "omniscient-readers-viewpoint", id: "lnori:omniscient-readers-viewpoint" },
  { title: "The Beginning After the End", slug: "the-beginning-after-the-end", id: "lnori:the-beginning-after-the-end" },
  { title: "Lord of the Mysteries", slug: "lord-of-the-mysteries", id: "lnori:lord-of-the-mysteries" },
  { title: "Re:Zero - Starting Life in Another World", slug: "rezero-kara-hajimeru-isekai-seikatsu", id: "lnori:rezero-kara-hajimeru-isekai-seikatsu" },
  { title: "Classroom of the Elite", slug: "youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e", id: "lnori:youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e" },
  { title: "Mushoku Tensei: Jobless Reincarnation", slug: "mushoku-tensei-isekai-ittara-honki-dasu-ln", id: "lnori:mushoku-tensei-isekai-ittara-honki-dasu-ln" },
  { title: "That Time I Got Reincarnated as a Slime", slug: "tensei-shitara-slime-datta-ken-ln", id: "lnori:tensei-shitara-slime-datta-ken-ln" },
  { title: "No Game No Life", slug: "no-game-no-life", id: "lnori:no-game-no-life" },
];

async function fetchHtml(url: string): Promise<string> {
  const headers = {
    "User-Agent": UA,
    Referer: "https://files.lnori.com/",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (res.ok) return await res.text();
  } catch {}

  try {
    const proxyRes = await fetch(`${RELAY}${encodeURIComponent(url)}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (proxyRes.ok) return await proxyRes.text();
  } catch {}

  throw new Error(`Failed to reach Lnori at ${url}`);
}

export async function getCatalog() {
  if (catalogCache && Date.now() - catalogTime < 1000 * 60 * 60) return catalogCache;
  try {
    const html = await fetchHtml(`${BASE}/`);
    const $ = cheerio.load(html);
    const items: { title: string; slug: string; id: string }[] = [];
    const seen = new Set<string>();

    // Support both standard #files list and newer DOM structures
    $("#files li a.folder, .folder-link, a.folder, a[href$='.html']").each((_, el) => {
      const $el = $(el);
      const title = $el.text().replace(/\/$/, "").trim();
      const href = $el.attr("href") || "";
      const slug = href.replace(/^\//, "").replace(".html", "").trim();
      if (slug && !seen.has(slug) && slug !== "index") {
        seen.add(slug);
        items.push({ title, slug, id: `lnori:${slug}` });
      }
    });

    if (items.length > 0) {
      catalogCache = items;
      catalogTime = Date.now();
      return items;
    }
  } catch (e) {}

  catalogCache = FALLBACK_CATALOG;
  catalogTime = Date.now();
  return catalogCache;
}

const PAGE_SIZE = 24;

async function coverFor(title: string): Promise<string> {
  try {
    let cover = await getNovelCover(title);
    if (!cover) {
      const clean = title
        .replace(/- Year \d+/i, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\(.*?\)/g, "")
        .trim();
      if (clean && clean !== title) cover = await getNovelCover(clean);
    }
    if (!cover) cover = (await getKitsuNovelCover(title)) || "";
    return cover || "";
  } catch {
    return "";
  }
}

async function toResults(slice: { title: string; id: string }[]): Promise<NovelResult[]> {
  return Promise.all(
    slice.map(async (item) => ({
      id: item.id,
      title: item.title,
      cover: await coverFor(item.title),
    }))
  );
}

export async function browseNovels(page = 1): Promise<{ results: NovelResult[]; totalPages: number }> {
  const catalog = await getCatalog();
  const totalPages = Math.max(1, Math.ceil(catalog.length / PAGE_SIZE));
  const slice = catalog.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { results: await toResults(slice), totalPages };
}

export async function searchNovels(
  query: string,
  page = 1
): Promise<{ results: NovelResult[]; totalPages: number }> {
  const catalog = await getCatalog();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length
    ? catalog.filter((c) => {
        const hay = c.title.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
    : catalog;

  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const slice = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { results: await toResults(slice), totalPages };
}

export async function firstVolumeFile(slug: string): Promise<string | null> {
  try {
    const html = await fetchHtml(`${BASE}/${slug}.html`);
    const $ = cheerio.load(html);
    const href = $("#files li a.epub, a[href$='.epub'], a.epub-link").first().attr("href");
    return href ? (href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? "" : "/"}${href}`) : null;
  } catch {
    return null;
  }
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  try {
    const html = await fetchHtml(`${BASE}/${slug}.html`);
    const $ = cheerio.load(html);
    const title = $("h1, .novel-title, .title").first().text().trim() || slug;
    const chapters: any[] = [];

    // Support both #files li a.epub and flexible selectors
    $("#files li a.epub, a[href$='.epub'], .file-entry a, .epub-download").each((i, el) => {
      const $el = $(el);
      const href = $el.attr("href") || "";
      const name = $el.text().replace(".epub", "").trim();
      const fileUrl = href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? "" : "/"}${href}`;
      chapters.push({
        id: `vol-${i + 1}`,
        title: name || `Volume ${i + 1}`,
        number: i + 1,
        file: fileUrl,
      });
    });

    if (chapters.length > 0) {
      return {
        id: `lnori:${slug}`,
        novelId: slug,
        title,
        cover: (await coverFor(title)) || "",
        author: "Various",
        status: "Completed",
        genres: ["Official EPUB"],
        synopsis: "Official Light Novel EPUB collection provided by Lnori.",
        chapters,
      };
    }
  } catch (e) {}

  const nfInfo = await NF.getNovelInfo(slug).catch(() => null);
  if (nfInfo) {
    return {
      ...nfInfo,
      id: `lnori:${slug}`,
      genres: ["Official EPUB", ...(nfInfo.genres || [])],
    };
  }

  return {
    id: `lnori:${slug}`,
    novelId: slug,
    title: slug.replace(/-/g, " ").toUpperCase(),
    cover: "",
    author: "Various",
    status: "Completed",
    genres: ["Official EPUB"],
    synopsis: "Light Novel EPUB collection.",
    chapters: Array.from({ length: 10 }, (_, i) => ({
      id: `chapter-${i + 1}`,
      title: `Chapter ${i + 1}`,
      number: i + 1,
    })),
  };
}

import * as ReadNovelFull from "./ReadNovelFull";

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  let targetChapterId = chapterId;
  if (chapterId.startsWith("vol-")) {
    const volNum = parseInt(chapterId.replace("vol-", ""), 10) || 1;
    targetChapterId = `chapter-${volNum}`;
  }

  const nfContent = await NF.getChapterContent(slug, targetChapterId).catch(() => null);
  if (nfContent) return nfContent;

  const rnfContent = await ReadNovelFull.getChapterContent(slug, targetChapterId).catch(() => null);
  if (rnfContent) return rnfContent;

  let title = "Volume";
  const volNo = chapterId.match(/^(?:vol|chapter)-(\d+)$/i);
  if (volNo) title = `Chapter ${volNo[1]}`;

  return {
    title,
    content: ["Content loading or temporarily unavailable. Please try another chapter."],
    prev: null,
    next: null,
  };
}
