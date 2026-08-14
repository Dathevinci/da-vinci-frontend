import axios from "axios";
import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PROXY = "https://goodproxy.goodproxy.workers.dev/fetch?url=";
const BASE_URL = "https://freewebnovel.com";

export async function searchFreeWebNovel(query: string): Promise<NovelResult[]> {
  try {
    const rawUrl = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;
    const url = `${PROXY}${encodeURIComponent(rawUrl)}`;
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 10000 });

    const matches = Array.from(res.data.matchAll(/<h3 class="tit"><a href="\/([^"]+)" title="([^"]+)">/gi));
    return matches.map((m: any) => ({
      id: `fwn:${m[1].replace(/^\//, '')}`,
      title: m[2].replace(/&amp;/g, '&').replace(/&apos;/g, "'").trim(),
      cover: "",
      tag: "Web Novel",
    }));
  } catch (err) {
    return [];
  }
}

export async function getFreeWebNovelInfo(slug: string): Promise<NovelInfo> {
  const cleanSlug = slug.replace(/^novel\//, '').replace(/\.html$/, '');
  const rawUrl = `${BASE_URL}/novel/${cleanSlug}`;
  const url = `${PROXY}${encodeURIComponent(rawUrl)}`;
  const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 10000 });

  const titleMatch = res.data.match(/<h1 class="tit"[^>]*>([\s\S]*?)<\/h1>/i);
  const descMatch = res.data.match(/<div class="inner"[^>]*>([\s\S]*?)<\/div>/i);
  const coverMatch = res.data.match(/<div class="pic"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);

  const chapMatches = Array.from(res.data.matchAll(/href="(\/[^"]+chapter-[^"]+)" title="([^"]+)"/gi));
  
  let chapters: NovelChapter[] = [];
  if (chapMatches.length > 0) {
    // Find the highest chapter number from scraped links
    let maxChapNum = 1;
    chapMatches.forEach((c: any) => {
      const numMatch = c[1].match(/chapter-(\d+)/i);
      if (numMatch) {
        const n = parseInt(numMatch[1]);
        if (n > maxChapNum) maxChapNum = n;
      }
    });

    // If there are more than 40 chapters, generate the full sequential chapter index
    if (maxChapNum > 40) {
      for (let i = 1; i <= maxChapNum; i++) {
        chapters.push({
          id: `novel/${cleanSlug}/chapter-${i}`,
          number: i,
          title: `Chapter ${i}`
        });
      }
    } else {
      // Use parsed links in ascending order
      const parsed = chapMatches.map((c: any) => {
        const numMatch = c[1].match(/chapter-(\d+)/i);
        const num = numMatch ? parseInt(numMatch[1]) : 1;
        return {
          id: c[1].replace(/^\//, ''),
          number: num,
          title: c[2].replace(/&amp;/g, '&').replace(/&apos;/g, "'").trim(),
        };
      });
      parsed.sort((a, b) => a.number - b.number);
      chapters = parsed;
    }
  }

  // Fallback: If no chapters found, provide at least chapters 1-50
  if (chapters.length === 0) {
    for (let i = 1; i <= 50; i++) {
      chapters.push({
        id: `novel/${cleanSlug}/chapter-${i}`,
        number: i,
        title: `Chapter ${i}`
      });
    }
  }

  return {
    id: `fwn:${cleanSlug}`,
    novelId: cleanSlug,
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : cleanSlug,
    cover: coverMatch ? `${BASE_URL}${coverMatch[1]}` : "",
    author: "Official Author",
    status: "Ongoing",
    genres: ["Fantasy", "Action", "Adventure"],
    synopsis: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "Synopsis coming soon.",
    chapters,
    alternativeServers: [{ source: "freewebnovel", id: `fwn:${cleanSlug}`, name: "FreeWebNovel (Human Translation)" }]
  };
}

export async function getFreeWebNovelChapter(chapterPath: string): Promise<ChapterContent> {
  const cleanPath = chapterPath.replace(/^\//, '');
  const rawUrl = `${BASE_URL}/${cleanPath}`;
  const url = `${PROXY}${encodeURIComponent(rawUrl)}`;
  const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 10000 });

  const titleMatch = res.data.match(/<h1 class="tit"[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<span class="view_title"[^>]*>([\s\S]*?)<\/span>/i);
  const contentMatch = res.data.match(/<div class="txt"[^>]*>([\s\S]*?)<\/div>/i) || res.data.match(/<div id="article"[^>]*>([\s\S]*?)<\/div>/i);

  // Extract current chapter number for reliable prev/next calculation
  const numMatch = cleanPath.match(/chapter-(\d+)/i);
  const currentNum = numMatch ? parseInt(numMatch[1]) : 1;
  const basePath = cleanPath.replace(/chapter-\d+.*$/, 'chapter-');

  const prev = currentNum > 1 ? `${basePath}${currentNum - 1}` : null;
  const next = `${basePath}${currentNum + 1}`;

  const content = contentMatch
    ? contentMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "\n")
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 20 && !p.includes("freewebnovel") && !p.includes("report chapter"))
    : ["Chapter text is loading or unavailable."];

  return {
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : `Chapter ${currentNum}`,
    content,
    prev,
    next,
  };
}
