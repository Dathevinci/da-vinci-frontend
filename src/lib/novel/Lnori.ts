import * as cheerio from "cheerio";
import type { NovelResult, NovelInfo, ChapterContent } from "./ReadNovelFull";
import { getNovelCover } from "../anilist";

const BASE = "https://files.lnori.com";

let catalogCache: { title: string; slug: string; id: string }[] | null = null;
let catalogTime = 0;

export async function getCatalog() {
  if (catalogCache && Date.now() - catalogTime < 1000 * 60 * 60) return catalogCache;
  const res = await fetch(`${BASE}/`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch Lnori catalog");
  const html = await res.text();
  const $ = cheerio.load(html);
  const items: { title: string; slug: string; id: string }[] = [];
  $("#files li a.folder").each((_, el) => {
    const $el = $(el);
    const title = $el.text().replace(/\/$/, "");
    const href = $el.attr("href") || "";
    const slug = href.replace(".html", "");
    items.push({ title, slug, id: `lnori:${slug}` });
  });
  catalogCache = items;
  catalogTime = Date.now();
  return items;
}

const PAGE_SIZE = 24;

/**
 * AniList art if this title exists there, otherwise NOTHING — and nothing is
 * deliberate.
 *
 * This used to fall back to a placehold.co URL, which the app then wrapped in
 * /api/novel-image. That proxy has an allowlist, placehold.co is not on it, and
 * so every title AniList could not match came back 403: one row of real covers
 * and a whole page of broken images. An empty cover lets the card fall through
 * to the volume's own artwork instead, which is the better picture anyway.
 */
async function coverFor(title: string): Promise<string> {
  try {
    let cover = await getNovelCover(title);
    if (!cover) {
      // Publisher and edition tags ("[Yen Press]", "- Year 2") are not part of
      // the name AniList knows the series by.
      const clean = title
        .replace(/- Year \d+/i, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\(.*?\)/g, "")
        .trim();
      if (clean && clean !== title) cover = await getNovelCover(clean);
    }
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

/**
 * Search is a filter over the cached catalogue rather than a request.
 *
 * The whole listing is one page on their end and we already hold it for an
 * hour, so matching locally is instant and costs the source nothing. Tokenised
 * so "bookworm ascendance" finds "Ascendance of a Bookworm" — the titles here
 * carry volume and publisher tags that break a plain substring match.
 */
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

/**
 * The first volume's file, used to borrow its cover for the series as a whole.
 * Volume one's art is the one most people recognise a light novel by.
 */
export async function firstVolumeFile(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/${slug}.html`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const href = $("#files li a.epub").first().attr("href");
    return href ? `${BASE}${href}` : null;
  } catch {
    return null;
  }
}

export async function getNovelInfo(slug: string): Promise<NovelInfo> {
  const res = await fetch(`${BASE}/${slug}.html`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch novel info");
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const title = $("h1").text().trim();
  const chapters: any[] = [];
  
  /**
   * THE ID IS A VOLUME NUMBER, NOT THE FILE URL.
   *
   * These ids used to be the absolute `.epub` address, which meant every link
   * in the app was a route path ending in `.epub` with an encoded `https://`
   * buried in it. That is how a browser ends up being handed a file to save
   * instead of a page to render, and it made the app's own URLs fragile for no
   * benefit. The address now travels in `file`, where nothing navigates to it,
   * and the reader asks the proxy for it by volume.
   */
  $("#files li a.epub").each((i, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const name = $el.text().replace(".epub", "").trim();
    chapters.push({
      id: `vol-${i + 1}`,
      title: name,
      number: i + 1,
      file: `${BASE}${href}`,
    });
  });

  return {
    id: `lnori:${slug}`,
    novelId: slug,
    title,
    cover: "", // Will be filled by sources.ts getNovelCover
    author: "Various",
    status: "Completed",
    genres: ["Official EPUB"],
    synopsis: "Official Light Novel EPUBs provided by Lnori.",
    chapters,
  };
}

/**
 * There is no chapter text to fetch — the volume IS the file, and the reader
 * swaps itself for the EPUB view. What this still owes the caller is a NAME.
 *
 * It used to answer "EPUB File", and since the reader picks
 * `chapter?.title || novel?.title`, that placeholder won every time: every
 * volume of every series was titled "EPUB File" in the reader header. The
 * filename is right there in the id, so use it.
 */
export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  let title = "EPUB Volume";

  const volNo = chapterId.match(/^vol-(\d+)$/i);
  if (volNo) {
    title = `Volume ${volNo[1]}`;
  } else {
    // An older bookmark, from when the id was the file URL itself.
    try {
      const file = decodeURIComponent(new URL(chapterId).pathname.split("/").pop() || "");
      const name = file.replace(/\.epub$/i, "").replace(/[_+]/g, " ").trim();
      if (name) title = name;
    } catch {
      const name = chapterId.replace(/\.epub$/i, "").trim();
      if (name) title = name;
    }
  }

  return {
    title,
    content: ["This volume opens in the EPUB reader."],
    prev: null,
    next: null,
  };
}
