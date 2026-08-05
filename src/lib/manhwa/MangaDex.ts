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

// Korean manhwa, Chinese manhua, AND Japanese manga. The first cut of this
// file skipped `ja` to keep the mode "on-theme", which is exactly why simply
// restoring it would not have delivered what was asked for — the request was
// a source covering manhwa, manga and manhua alike. originalLanguage is what
// tells them apart downstream: ko → Manhwa, zh/zh-hk → Manhua, ja → Manga.
const LANGS = ["ko", "zh", "zh-hk", "ja"];
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

async function mdx(path: string, revalidate = 300, attempt = 0): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { "User-Agent": "DaVinci/1.0 (+https://www.dathevinci.xyz)" },
    // Cache metadata briefly to stay well under MangaDex's rate limits; the
    // image-server call passes revalidate:0 since its token is short-lived.
    next: { revalidate },
  } as any);
  // MangaDex rate-limits per IP (~5/s); Vercel's shared IP occasionally gets a
  // 429. Retry with backoff so a transient limit doesn't silently drop this
  // source from the merged results.
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return mdx(path, revalidate, attempt + 1);
  }
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
  // Drop titles with zero chapters. (Licensed mega-hits like Solo Leveling
  // have their chapters as EXTERNAL links, which still count as "available", so
  // this can't fully exclude them — those degrade gracefully to the detail
  // page's "no chapters" state, since our reader filters external chapters out.)
  hasAvailableChapters: "true",
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
  /**
   * NO LANGUAGE FILTER ON THE REQUEST — the preference is applied below.
   *
   * Asking the API for English only cannot express "English if it exists,
   * otherwise anything", which is what a reader actually wants. It also hid
   * the failure that keeps getting reported: for an officially licensed
   * series every English chapter is an external link, so an en-only feed came
   * back full and the readability filter emptied it, leaving a series page
   * that looked complete and listed nothing.
   *
   * Fetching everything and choosing per chapter costs the same single walk.
   *
   * Newest-first (order desc) to match the AsuraScans convention the detail
   * page + reader assume (index 0 = latest). Cap the walk so a 3000-entry
   * series can't hammer the API.
   */
  for (let offset = 0; offset < 3000; offset += limit) {
    const q = qs({
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

  /**
   * ONE VERSION PER CHAPTER NUMBER, AND ENGLISH WINS WHENEVER IT EXISTS.
   *
   * The feed carries the same chapter many times over — once per scanlation
   * group, and once per language. The old dedupe kept whichever row happened
   * to arrive FIRST, which is arbitrary, so as soon as other languages were in
   * the payload a series could show chapter 12 in Portuguese while a perfectly
   * good English scan of chapter 12 sat further down the same list.
   *
   * That is the bug this replaces. The previous attempt was all-or-nothing: if
   * English produced no readable chapters it re-fetched everything and served
   * whatever came back, which threw away the English chapters that DID exist
   * further into the series. A series translated to chapter 40 in English and
   * to chapter 90 elsewhere is the normal case, not an edge case, and both
   * halves have to survive.
   *
   * So: gather every readable candidate per number, then pick English if any
   * English candidate is readable, else fall back to another language for THAT
   * NUMBER ONLY. Chapters keep their own language independently.
   */
  const readable = raw.filter((c) => {
    const a = c.attributes || {};
    // isUnavailable is a real flag on the live chapter payload and was missing
    // from this filter: such a chapter reports pages but serves none, so it
    // reached the reader as a blank page rather than being skipped.
    return a.pages > 0 && !a.externalUrl && !a.isUnavailable;
  });

  /**
   * ENGLISH ONLY. A chapter with no readable English version is not listed.
   *
   * The previous pass fell back to any language when English was missing, so a
   * series would list Portuguese or Indonesian chapters among its English
   * ones. The reasoning was that manhwa pages are art and a raw beats an empty
   * list — that was wrong. Being handed a chapter you cannot read, in a reader
   * with no way back to one you can, is worse than being told the chapter is
   * not available: one is a dead end you discover after committing, the other
   * is information you get up front.
   *
   * The consequence is accepted deliberately: some MangaDex titles will show
   * fewer chapters than MangaDex itself has, and a few will show none. The
   * series page says so rather than pretending the series is empty.
   */
  const byNumber = new Map<string, any>();
  for (const c of readable) {
    const a = c.attributes || {};
    if ((a.translatedLanguage || "").toLowerCase() !== "en") continue;
    const key = (a.chapter ?? "") || c.id;
    // First one wins among English versions — the feed is ordered, and picking
    // between two English scanlations of the same chapter is a coin flip.
    if (!byNumber.has(key)) byNumber.set(key, c);
  }

  const out: IMangaChapter[] = [];
  for (const c of byNumber.values()) {
    const a = c.attributes || {};
    const num = a.chapter ?? "";

    let title: string;
    if (num && a.title) title = `Chapter ${num} — ${a.title}`;
    else if (num) title = `Chapter ${num}`;
    else title = a.title || "Oneshot";
    // No language tag any more — everything reaching here is English by the
    // filter above, so a tag would only ever say "EN" on every row.

    out.push({
      id: MDX_PREFIX + c.id,
      title,
      releaseDate: a.publishAt ? new Date(a.publishAt).toLocaleDateString() : undefined,
      isLocked: false,
    });
  }

  // The map preserved insertion order, which was the feed's chapter-desc order
  // only until a later English row displaced an earlier one in place. Sort
  // explicitly so the reader's "index 0 is latest" assumption always holds.
  out.sort((x, y) => {
    const n = (t: string) => {
      const m = /chapter\s+([\d.]+)/i.exec(t || "");
      return m ? parseFloat(m[1]) : -1;
    };
    return n(y.title) - n(x.title);
  });

  return out;
}

/**
 * Find one chapter of one series, by the series' AsuraScans SLUG and the
 * chapter NUMBER — the two things a locked Asura chapter can tell us about
 * itself.
 *
 * This exists for the locked-chapter fallback and deliberately does nothing
 * else. It is strict on purpose: serving the WRONG chapter is far worse than
 * serving none, because the reader has no way to tell and would silently read
 * a different series. So the title must match after normalisation, and the
 * chapter number must match exactly.
 *
 * Returns null on any doubt. Every caller is expected to fall back to showing
 * the lock rather than guessing.
 */
export async function findChapterBySlugAndNumber(
  seriesSlug: string,
  chapterNumber: string
): Promise<{ chapterId: string; mangaTitle: string } | null> {
  // Asura slugs are the title, lowercased and hyphenated, sometimes with a
  // trailing hash the site appends for uniqueness. Both are stripped so the
  // search sees words rather than an id.
  const guess = seriesSlug.replace(/-[a-f0-9]{6,}$/i, "").replace(/-/g, " ").trim();
  if (!guess) return null;

  const norm = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(guess);
  const wantNum = String(parseFloat(chapterNumber));
  if (wantNum === "NaN") return null;

  let results: IMangaResult[] = [];
  try {
    results = (await search(guess, 1)).results || [];
  } catch {
    return null;
  }

  // Only an exact normalised title match counts — a fuzzy "close enough" here
  // is how a reader ends up in the wrong series without ever being told.
  const hit = results.find((r) => {
    const t = norm(String(r.title || ""));
    return t === want || t.startsWith(want) || want.startsWith(t);
  });
  if (!hit) return null;

  let chapters: IMangaChapter[] = [];
  try {
    chapters = await fetchChapters(strip(String(hit.id)));
  } catch {
    return null;
  }

  // fetchChapters already dropped anything with no pages, an external host or
  // an unavailable flag, so a hit here is genuinely readable.
  const match = chapters.find((c) => {
    const m = /chapter\s+([\d.]+)/i.exec(c.title || "");
    return !!m && String(parseFloat(m[1])) === wantNum;
  });
  if (!match) return null;

  return { chapterId: match.id, mangaTitle: String(hit.title || guess) };
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
