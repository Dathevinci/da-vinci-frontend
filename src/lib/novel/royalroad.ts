import type { NovelResult, NovelInfo, NovelChapter, ChapterContent } from "./types";

/**
 * RoyalRoad — novel source #2, added 2026-08-13.
 *
 * It is the only candidate besides ReadNovelFull that passed the full
 * production chain, and it passed twice: once in the three-way probe that
 * eliminated NovelFull, and again when ranobes was tried in its place and lost
 * both its domains (a hard Cloudflare block on .top, a datacenter-targeted
 * browser_check interstitial on .net that would have to be forged to get past).
 *
 * NO-MTL BY CONSTRUCTION, which is stronger than by policy: RoyalRoad hosts
 * ORIGINAL ENGLISH FICTION submitted by its authors. There is no source
 * language, so there is nothing to machine-translate. Where ReadNovelFull is a
 * translation aggregator that must be trusted to curate, this one cannot carry
 * MTL even in principle.
 *
 * It also barely overlaps: RNF's catalogue is translated CN/KR web novels,
 * RoyalRoad's is Western web serials, so the merge adds titles instead of
 * feeding the dedupe.
 *
 * IDS ARE NUMERIC AND SLUG-FREE, which the URL rules allow and which makes
 * every stored bookmark immune to a title being renamed:
 *   novel    "rr:<fictionId>"   — /fiction/<id> canonicalises on its own
 *   chapter  "<chapterId>"      — plain numeric, one clean route segment
 * Measured: both slug segments in a chapter URL are DECORATIVE (a wrong
 * fiction slug and a wrong chapter slug both still serve 200), but their
 * SHAPE is required — dropping a slug segment 404s. So URLs are built with a
 * placeholder in each slug position.
 */

const BASE = "https://www.royalroad.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Referer: BASE + "/" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`RoyalRoad HTTP ${r.status} for ${url}`);
  return r.text();
}

const unescapeHtml = (raw: string) =>
  (raw || "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const stripTags = (html: string) => unescapeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** The listings RoyalRoad publishes, mapped to the shelves that want them. */
export const RR_LISTS: Record<string, string> = {
  "best-rated": "best-rated",
  "weekly-popular": "weekly-popular",
  "latest-updates": "latest-updates",
  complete: "complete",
  trending: "trending",
};

/**
 * TOLERANT ROW SELECTOR — anchored on the class NAME, not the class ATTRIBUTE.
 *
 * Listing pages emit `class="fiction-list-item"` while search emits
 * `class="row fiction-list-item"`, so a selector matching the attribute's
 * start parses 20 rows on a listing and ZERO on search. That is precisely how
 * a search feature ships looking fine and returning nothing.
 */
function parseRows(html: string): NovelResult[] {
  const rows: NovelResult[] = [];
  const seen = new Set<string>();
  for (const block of html.split(/<div class="[^"]*fiction-list-item[^"]*"/i).slice(1)) {
    const link = /href="\/fiction\/(\d+)\/[^"]*"/i.exec(block);
    if (!link) continue;
    const id = `rr:${link[1]}`;
    if (seen.has(id)) continue;

    /**
     * TITLE AND COVER ARE MATCHED SEPARATELY, because a fiction with no
     * uploaded cover still has a title. RoyalRoad points those at its own
     * relative placeholder (/dist/img/nocover-new-min.png) — measured on 6 of
     * 20 search rows, all fan-fiction entries — and a single regex demanding
     * `alt` and an https `src` together fails on them entirely, losing the
     * title as well. An absent cover is honest; an absent title is a bug.
     */
    const alt = /<img[^>]+alt="([^"]*)"/i.exec(block)?.[1];
    const heading = /<a[^>]*href="\/fiction\/\d+\/[^"]*"[^>]*>([^<]{2,120})<\/a>/i.exec(block)?.[1];
    const title = unescapeHtml((alt || heading || "").trim());
    if (!title) continue;

    // Only a real absolute cover counts; the placeholder resolves to none, so
    // the UI shows its own empty state rather than RoyalRoad's grey box.
    const src = /<img[^>]+src="(https?:\/\/[^"]+)"/i.exec(block)?.[1];
    const cover = src && !/nocover/i.test(src) ? src : "";

    seen.add(id);
    rows.push({ id, title, cover });
  }
  return rows;
}

export interface RrPage {
  results: NovelResult[];
  hasNextPage: boolean;
  totalPages?: number;
}

/** Largest page number the pager links to; the "last" link makes it real. */
function pagerTotal(html: string): number | undefined {
  const nums = [...html.replace(/&amp;/gi, "&").matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1]));
  const max = nums.length ? Math.max(...nums) : 0;
  return max > 0 ? max : undefined;
}

export async function listFictions(list: string, page = 1): Promise<RrPage> {
  const slug = RR_LISTS[list] || "best-rated";
  const p = Math.max(1, page);
  const html = await fetchHtml(`${BASE}/fictions/${slug}?page=${p}`);
  const results = parseRows(html);
  const totalPages = pagerTotal(html);
  return {
    results,
    hasNextPage: totalPages ? p < totalPages : results.length >= 20,
    totalPages,
  };
}

export async function searchFictions(query: string, page = 1): Promise<RrPage> {
  const q = String(query || "").trim();
  if (!q) return { results: [], hasNextPage: false };
  const p = Math.max(1, page);
  const html = await fetchHtml(`${BASE}/fictions/search?title=${encodeURIComponent(q)}&page=${p}`);
  const results = parseRows(html);
  const totalPages = pagerTotal(html);
  return {
    results,
    hasNextPage: totalPages ? p < totalPages : results.length >= 20,
    totalPages,
  };
}

export async function getInfo(fictionId: string): Promise<NovelInfo> {
  const id = String(fictionId).replace(/\D/g, "");
  if (!id) throw new Error("Invalid RoyalRoad fiction id");
  const html = await fetchHtml(`${BASE}/fiction/${id}`);

  const title = unescapeHtml((/<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] || "").trim());
  const cover =
    /<meta property="og:image" content="([^"]+)"/i.exec(html)?.[1] ||
    /<img[^>]+class="[^"]*thumbnail[^"]*"[^>]+src="([^"]+)"/i.exec(html)?.[1] ||
    "";
  const author = unescapeHtml(
    (/<meta property="books:author" content="([^"]+)"/i.exec(html)?.[1] || "").trim()
  ) || "Unknown";
  const synopsis = stripTags(/<div class="description">([\s\S]*?)<\/div>\s*<\/div>/i.exec(html)?.[1] || "");
  const genres = [
    ...new Set(
      [...html.matchAll(/class="[^"]*fiction-tag[^"]*"[^>]*>([^<]+)</g)].map((m) => unescapeHtml(m[1].trim()))
    ),
  ].filter(Boolean);
  const status = /COMPLETED/.test(html) ? "Completed" : /HIATUS/.test(html) ? "Hiatus" : "Ongoing";

  /**
   * THE WHOLE CHAPTER LIST IS ALREADY ON THE PAGE as `window.chapters` JSON —
   * no second request, no pagination to walk, and every row carries a real
   * date. `isUnlocked === false` marks RoyalRoad's paid early access; those
   * are kept in the list (the reader should see they exist) but flagged, so a
   * locked chapter is not presented as readable and then opened to a wall.
   */
  let chapters: NovelChapter[] = [];
  const m = /window\.chapters\s*=\s*(\[[\s\S]*?\]);/.exec(html);
  if (m) {
    try {
      const raw = JSON.parse(m[1]) as any[];
      chapters = raw
        .filter((c) => c && c.id)
        .map((c, i) => ({
          id: String(c.id),
          number: Number.isFinite(Number(c.order)) ? Number(c.order) + 1 : i + 1,
          title: unescapeHtml(String(c.title || `Chapter ${i + 1}`).trim()),
          releaseDate: c.date ? new Date(c.date).toISOString() : undefined,
          ...(c.isUnlocked === false ? { isLocked: true } : {}),
        })) as NovelChapter[];
    } catch {
      /* fall through to an empty list rather than a broken page */
    }
  }

  return {
    id: `rr:${id}`,
    novelId: id,
    title: title || `Fiction ${id}`,
    cover,
    author,
    status,
    genres,
    synopsis,
    chapters,
  };
}

export async function getChapter(fictionId: string, chapterId: string): Promise<ChapterContent> {
  const fid = String(fictionId).replace(/\D/g, "");
  const cid = String(chapterId).replace(/\D/g, "");
  if (!fid || !cid) throw new Error("Invalid RoyalRoad chapter id");

  // Both slug segments are decorative but structurally required — see header.
  const html = await fetchHtml(`${BASE}/fiction/${fid}/_/chapter/${cid}/_`);

  const body = /<div class="chapter-inner chapter-content">([\s\S]*?)<\/div>/i.exec(html)?.[1] || "";
  const content = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((x) => stripTags(x[1]))
    .filter((t) => t.length > 0);
  if (content.join("").length < 50) throw new Error("RoyalRoad returned no chapter text");

  const title = unescapeHtml((/<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] || "").trim());

  /**
   * Nav links are identified by their LABEL rather than by position, so a
   * layout change cannot silently swap previous and next.
   *
   * The text window is generous because the anchor wraps its label in icon
   * markup: at 80 characters the lazy match never reached "Next Chapter" and
   * every chapter reported no next, which reads as "the novel ends here" on
   * chapter one. An absent link is still legitimately null — chapter one has
   * no previous and the latest has no next.
   */
  const navLink = (label: RegExp) => {
    for (const a of html.matchAll(
      /<a[^>]+href="(\/fiction\/\d+\/[^"]*\/chapter\/(\d+)\/[^"]*)"[^>]*>([\s\S]{0,400}?)<\/a>/gi
    )) {
      if (label.test(stripTags(a[3]))) return a[2];
    }
    return null;
  };

  return {
    title,
    content,
    prev: navLink(/previous/i),
    next: navLink(/next/i),
  };
}
