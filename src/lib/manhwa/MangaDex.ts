// MangaDex source for the "Manhwa" mode — the official api.mangadex.org (a real
// JSON API: no HTML scraping, no Cloudflare wall, original-quality images). It
// complements AsuraScans with a huge library incl. the licensed titles Asura
// lacks. All ids are prefixed "mdx:" so the source router (sources.ts) can
// dispatch; chapter ids are "mdx:<uuid>". We only surface titles that actually
// have readable English chapters.
//
// Returns the SAME shapes as the AsuraScans scraper (IMangaResult / IMangaInfo /
// IMangaChapter / IMangaChapterPage / ISearch) so the rest of the app is source-
// agnostic.

import {
  IMangaResult,
  IMangaInfo,
  IMangaChapter,
  IMangaChapterPage,
  ISearch,
  MediaStatus,
} from "@/lib/asura/models";

const API = "https://api.mangadex.org";
const UPLOADS = "https://uploads.mangadex.org";

// Korean manhwa + Chinese manhua (the webtoon side); we deliberately skip
// Japanese manga (ja) so the "Manhwa" mode stays on-theme.
const LANGS = ["ko", "zh", "zh-hk"];
// Exclude only "pornographic"; the app's Safe-Browse toggle handles the rest.
const RATINGS = ["safe", "suggestive", "erotica"];

export const MDX_PREFIX = "mdx:";
export const isMdx = (id?: string | null): boolean => !!id && id.startsWith(MDX_PREFIX);
const strip = (id: string) => id.slice(MDX_PREFIX.length);

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else if (v !== undefined && v !== null) p.append(k, String(v));
  }
  return p.toString();
}

async function mdx(path: string, revalidate = 300): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { "User-Agent": "DaVinci/1.0 (+https://www.dathevinci.xyz)" },
    // Cache metadata briefly to stay well under MangaDex's rate limits; the
    // image-server call passes revalidate:0 since its token is short-lived.
    next: { revalidate },
  } as any);
  if (!res.ok) throw new Error(`MangaDex ${res.status} for ${path}`);
  return res.json();
}

const STATUS: Record<string, MediaStatus> = {
  ongoing: MediaStatus.ONGOING,
  completed: MediaStatus.COMPLETED,
  cancelled: MediaStatus.CANCELLED,
  hiatus: MediaStatus.UNKNOWN,
};

function pickTitle(at: any): string {
  if (at?.title?.en) return at.title.en;
  const altEn = (at?.altTitles || []).find((t: any) => t.en)?.en;
  if (altEn) return altEn;
  const first = at?.title ? Object.values(at.title)[0] : null;
  return (first as string) || "Untitled";
}

function coverUrl(mangaId: string, rels: any[], size: 256 | 512 = 512): string | undefined {
  const c = (rels || []).find((r) => r.type === "cover_art" && r.attributes?.fileName);
  if (!c) return undefined;
  // MangaDex cover thumbnails: /covers/<id>/<file>.<size>.jpg (file already ends .jpg)
  return `${UPLOADS}/covers/${mangaId}/${c.attributes.fileName}.${size}.jpg`;
}

function mapResult(m: any): IMangaResult {
  const at = m.attributes || {};
  return {
    id: MDX_PREFIX + m.id,
    title: pickTitle(at),
    image: coverUrl(m.id, m.relationships || [], 512),
    status: STATUS[at.status] || MediaStatus.UNKNOWN,
    latestChapter: at.lastChapter ? `Chapter ${at.lastChapter}` : undefined,
    // Deliberately NO latest_chapters: the browse card only synthesises an
    // Asura-style "<slug>|<number>" deep link when that's present, so omitting
    // it makes MangaDex cards fall back to the series page (their chapter ids
    // are UUIDs, not numbers).
  };
}

const BASE_SEARCH = {
  "originalLanguage[]": LANGS,
  "availableTranslatedLanguage[]": ["en"],
  "contentRating[]": RATINGS,
  "includes[]": ["cover_art"],
};

export async function search(query: string, page = 1): Promise<ISearch<IMangaResult>> {
  const limit = 24;
  const q = qs({ ...BASE_SEARCH, title: query, limit, offset: (page - 1) * limit, "order[relevance]": "desc" });
  const d = await mdx(`/manga?${q}`);
  return {
    currentPage: page,
    hasNextPage: (d.offset || 0) + (d.limit || 0) < (d.total || 0),
    results: (d.data || []).map(mapResult),
  };
}

export async function popular(): Promise<IMangaResult[]> {
  const q = qs({ ...BASE_SEARCH, limit: 15, "order[followedCount]": "desc" });
  const d = await mdx(`/manga?${q}`);
  return (d.data || []).map(mapResult);
}

export async function latest(page = 1): Promise<IMangaResult[]> {
  const limit = 24;
  const q = qs({ ...BASE_SEARCH, limit, offset: (page - 1) * limit, "order[latestUploadedChapter]": "desc" });
  const d = await mdx(`/manga?${q}`);
  return (d.data || []).map(mapResult);
}

export async function fetchInfo(id: string): Promise<IMangaInfo> {
  const mid = strip(id);
  const d = await mdx(`/manga/${mid}?${qs({ "includes[]": ["cover_art", "author", "artist"] })}`);
  const m = d.data;
  const at = m.attributes || {};
  const rels = m.relationships || [];

  const authors = rels.filter((r: any) => r.type === "author").map((r: any) => r.attributes?.name).filter(Boolean);
  const artist = rels.find((r: any) => r.type === "artist")?.attributes?.name;
  const genres = (at.tags || [])
    .filter((t: any) => ["genre", "theme"].includes(t.attributes?.group))
    .map((t: any) => t.attributes?.name?.en)
    .filter(Boolean)
    .slice(0, 14);

  const description = String(at.description?.en || "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links → their text
    .replace(/\r/g, "")
    .trim();

  return {
    id: MDX_PREFIX + mid,
    title: pickTitle(at),
    image: coverUrl(mid, rels, 512),
    status: STATUS[at.status] || MediaStatus.UNKNOWN,
    description: description || undefined,
    authors: authors.length ? authors : undefined,
    artist,
    genres,
    updatedOn: at.updatedAt,
    chapters: await fetchChapters(mid),
  };
}

async function fetchChapters(mid: string): Promise<IMangaChapter[]> {
  const limit = 500;
  const raw: any[] = [];
  // Newest-first (order desc) to match the AsuraScans convention the detail
  // page + reader assume (index 0 = latest). Cap the walk so a 3000-entry
  // series can't hammer the API.
  for (let offset = 0; offset < 3000; offset += limit) {
    const q = qs({
      "translatedLanguage[]": ["en"],
      "contentRating[]": RATINGS,
      "order[chapter]": "desc",
      "includes[]": ["scanlation_group"],
      limit,
      offset,
    });
    const d = await mdx(`/manga/${mid}/feed?${q}`);
    raw.push(...(d.data || []));
    if (offset + limit >= (d.total || 0)) break;
  }

  // Keep one readable version per chapter number (feeds carry duplicates across
  // scanlation groups). Skip chapters with no pages or an external host.
  const seen = new Set<string>();
  const out: IMangaChapter[] = [];
  for (const c of raw) {
    const a = c.attributes || {};
    if (!(a.pages > 0) || a.externalUrl) continue;
    const num = a.chapter ?? "";
    const key = num || c.id;
    if (seen.has(key)) continue;
    seen.add(key);

    let title: string;
    if (num && a.title) title = `Chapter ${num} — ${a.title}`;
    else if (num) title = `Chapter ${num}`;
    else title = a.title || "Oneshot";

    out.push({
      id: MDX_PREFIX + c.id,
      title,
      releaseDate: a.publishAt ? new Date(a.publishAt).toLocaleDateString() : undefined,
      isLocked: false,
    });
  }
  return out;
}

export async function fetchPages(chapterId: string): Promise<IMangaChapterPage[]> {
  const cid = strip(chapterId);
  const d = await mdx(`/at-home/server/${cid}`, 0); // token is short-lived → no cache
  const base = d.baseUrl;
  const hash = d.chapter?.hash;
  const data: string[] = d.chapter?.data || [];
  // Original-quality pages ("data"); the reader wraps each in /api/manhwa-image
  // (which already allowlists *.mangadex.network).
  return data.map((fn, i) => ({ page: i + 1, img: `${base}/data/${hash}/${fn}` }));
}
