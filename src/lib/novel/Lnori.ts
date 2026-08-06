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

export async function browseNovels(page = 1): Promise<{ results: NovelResult[]; totalPages: number }> {
  const catalog = await getCatalog();
  const PAGE_SIZE = 24;
  const totalPages = Math.ceil(catalog.length / PAGE_SIZE);
  const slice = catalog.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  
  const results: NovelResult[] = await Promise.all(slice.map(async (item) => {
    let cover = "";
    try {
      let aniCover = await getNovelCover(item.title);
      if (!aniCover) {
        const cleanTitle = item.title
          .replace(/- Year \d+/i, "")
          .replace(/\[.*?\]/g, "")
          .replace(/\(.*?\)/g, "")
          .trim();
        if (cleanTitle !== item.title) {
          aniCover = await getNovelCover(cleanTitle);
        }
      }
      cover = aniCover || `https://placehold.co/400x600/101018/e2e8f0?text=${encodeURIComponent(item.title.substring(0, 15))}`;
    } catch {}
    return {
      id: item.id,
      title: item.title,
      cover,
    };
  }));

  return { results, totalPages };
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
