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
  
  $("#files li a.epub").each((i, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const name = $el.text().replace(".epub", "").trim();
    chapters.push({
      id: `${BASE}${href}`,
      title: name,
      number: i + 1,
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

export async function getChapterContent(slug: string, chapterId: string): Promise<ChapterContent> {
  return {
    title: "EPUB File",
    content: ["This is an EPUB file. It should be handled by the frontend reader."],
    prev: null,
    next: null,
  };
}
