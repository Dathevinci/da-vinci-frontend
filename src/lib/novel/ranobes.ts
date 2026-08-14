import axios from "axios";
import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE_URL = "https://ranobes.top";

export async function searchRanobes(query: string): Promise<NovelResult[]> {
  try {
    const url = `${BASE_URL}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 8000 });
    
    const matches = Array.from(res.data.matchAll(/<h2 class="title"><a href="https:\/\/ranobes\.top\/([^"]+)\.html"[^>]*>([^<]+)<\/a><\/h2>/gi));
    return matches.map((m: any) => ({
      id: `rnb:${m[1]}`,
      title: m[2].trim(),
      cover: "",
      tag: "Light Novel",
    }));
  } catch (err) {
    return [];
  }
}

export async function getRanobesInfo(slug: string): Promise<NovelInfo> {
  const url = `${BASE_URL}/${slug}.html`;
  const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 8000 });

  const titleMatch = res.data.match(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const descMatch = res.data.match(/<div class="moreless__full"[^>]*>([\s\S]*?)<\/div>/i) || res.data.match(/<div class="showcontent"[^>]*>([\s\S]*?)<\/div>/i);
  const coverMatch = res.data.match(/<div class="poster"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);

  // Extract series ID number from slug or page to fetch chapter list
  const idMatch = slug.match(/(\d+)/);
  const seriesNum = idMatch ? idMatch[1] : "";

  const chapters: NovelChapter[] = [];
  if (seriesNum) {
    try {
      const chapListUrl = `${BASE_URL}/chapters/${seriesNum}/`;
      const cRes = await axios.get(chapListUrl, { headers: { "User-Agent": UA }, timeout: 8000 });
      const chapLinks = Array.from(cRes.data.matchAll(/href="https:\/\/ranobes\.top\/([^"]+\/\d+\.html)"[^>]*title="([^"]+)"/gi))
        .concat(Array.from(cRes.data.matchAll(/href="\/([^"]+\/\d+\.html)"[^>]*title="([^"]+)"/gi)));

      chapLinks.forEach((c: any, index: number) => {
        const rawHref = c[1].replace(/^\//, '').replace(/\.html$/, '');
        chapters.push({
          id: rawHref,
          number: index + 1,
          title: c[2].replace(/<[^>]+>/g, '').trim(),
        });
      });
    } catch {}
  }

  return {
    id: `rnb:${slug}`,
    novelId: slug,
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : slug,
    cover: coverMatch ? `${BASE_URL}${coverMatch[1]}` : "",
    author: "Official Japanese Author",
    status: "Completed",
    genres: ["Light Novel", "Fantasy", "Action"],
    synopsis: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "Synopsis coming soon.",
    chapters,
    alternativeServers: [{ source: "ranobes", id: `rnb:${slug}`, name: "Ranobes (Human Translation)" }]
  };
}

export async function getRanobesChapter(chapterPath: string): Promise<ChapterContent> {
  const url = `${BASE_URL}/${chapterPath}.html`;
  const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 8000 });

  const titleMatch = res.data.match(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const textMatch = res.data.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/i) || res.data.match(/<div id="arrticle"[^>]*>([\s\S]*?)<\/div>/i);

  const prevMatch = res.data.match(/href="https:\/\/ranobes\.top\/([^"]+\/\d+\.html)"[^>]*id="prev"/i) || res.data.match(/href="\/([^"]+\/\d+\.html)"[^>]*id="prev"/i);
  const nextMatch = res.data.match(/href="https:\/\/ranobes\.top\/([^"]+\/\d+\.html)"[^>]*id="next"/i) || res.data.match(/href="\/([^"]+\/\d+\.html)"[^>]*id="next"/i);

  const content = textMatch
    ? textMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "\n")
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 20 && !p.includes("ranobes") && !p.includes("copyright"))
    : ["Chapter text is loading or unavailable."];

  return {
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Chapter",
    content,
    prev: prevMatch ? prevMatch[1].replace(/^\//, '').replace(/\.html$/, '') : null,
    next: nextMatch ? nextMatch[1].replace(/^\//, '').replace(/\.html$/, '') : null,
  };
}
