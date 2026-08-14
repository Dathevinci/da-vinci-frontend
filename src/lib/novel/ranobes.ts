import axios from "axios";
import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE_URL = "https://ranobes.top";

export async function searchRanobes(query: string): Promise<NovelResult[]> {
  try {
    const url = `${BASE_URL}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 8000 });
    
    const matches = Array.from(res.data.matchAll(/<h2 class="title"><a href="https:\/\/ranobes\.top\/novels\/([^"]+)\.html"[^>]*>([^<]+)<\/a><\/h2>/gi));
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
  const cleanSlug = slug.replace(/^novels\//, '').replace(/\.html$/, '');
  const url = `${BASE_URL}/novels/${cleanSlug}.html`;
  const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 8000 });

  const titleMatch = res.data.match(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const descMatch = res.data.match(/<div class="moreless__full"[^>]*>([\s\S]*?)<\/div>/i) || res.data.match(/<div class="showcontent"[^>]*>([\s\S]*?)<\/div>/i);
  const coverMatch = res.data.match(/<div class="poster"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);

  const idMatch = cleanSlug.match(/(\d+)/);
  const seriesNum = idMatch ? idMatch[1] : "";

  const chapters: NovelChapter[] = [];
  if (seriesNum) {
    try {
      const chapListUrl = `${BASE_URL}/chapters/${seriesNum}/`;
      const cRes = await axios.get(chapListUrl, { headers: { "User-Agent": UA }, timeout: 8000 });
      
      const start = cRes.data.indexOf("window.__DATA__ = ");
      if (start !== -1) {
        const end = cRes.data.indexOf("</script>", start);
        const rawJson = cRes.data.slice(start + "window.__DATA__ = ".length, end).trim().replace(/;$/, '').trim();
        const data = JSON.parse(rawJson);
        
        if (Array.isArray(data.chapters) && data.chapters.length > 0) {
          const reversed = [...data.chapters].reverse();
          reversed.forEach((c: any, index: number) => {
            const chapId = c.id || String(index + 1);
            chapters.push({
              id: chapId,
              number: index + 1,
              title: c.title || `Chapter ${index + 1}`,
              releaseDate: c.showDate || c.date
            });
          });
        }
      }
    } catch {}
  }

  // Fallback: If no chapters found from JSON, parse direct HTML links
  if (chapters.length === 0) {
    const htmlLinks = Array.from(res.data.matchAll(/href="https:\/\/ranobes\.top\/[^"]*\/(\d+)\.html"/gi));
    htmlLinks.forEach((c: any, index: number) => {
      chapters.push({
        id: c[1],
        number: index + 1,
        title: `Chapter ${index + 1}`,
      });
    });
  }

  return {
    id: `rnb:${cleanSlug}`,
    novelId: cleanSlug,
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : cleanSlug,
    cover: coverMatch ? `${BASE_URL}${coverMatch[1]}` : "",
    author: "Official Japanese Light Novel",
    status: "Completed",
    genres: ["Light Novel", "Fantasy", "Action"],
    synopsis: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "Synopsis coming soon.",
    chapters,
    alternativeServers: [{ source: "ranobes", id: `rnb:${cleanSlug}`, name: "Ranobes (Human Translation)" }]
  };
}

export async function getRanobesChapter(slug: string, chapterId: string): Promise<ChapterContent> {
  const cleanSlug = slug.replace(/^novels\//, '').replace(/\.html$/, '');
  const cleanChapId = chapterId.replace(/\.html$/, '');

  const url = `${BASE_URL}/${cleanSlug}/${cleanChapId}.html`;
  const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 8000 });

  const titleMatch = res.data.match(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const textMatch = res.data.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/i) || res.data.match(/<div id="arrticle"[^>]*>([\s\S]*?)<\/div>/i);

  const prevMatch = res.data.match(/href="https:\/\/ranobes\.top\/[^"]*\/(\d+)\.html"[^>]*id="prev"/i);
  const nextMatch = res.data.match(/href="https:\/\/ranobes\.top\/[^"]*\/(\d+)\.html"[^>]*id="next"/i);

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
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : `Chapter ${cleanChapId}`,
    content,
    prev: prevMatch ? prevMatch[1] : null,
    next: nextMatch ? nextMatch[1] : null,
  };
}
