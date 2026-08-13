import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. Is manganato.gg usable FROM PRODUCTION?
 *
 * Everything below already passed from a home connection. That proves nothing
 * on its own — FlameComics serves a laptop its entire catalogue and answers
 * Vercel with 403 + cf-mitigated=challenge, which is exactly how it came to be
 * removed, and NatoManga does the same intermittently. So this asks from the
 * egress the app actually runs on, and walks the whole chain rather than just
 * knocking on the front door:
 *
 *   series page -> chapters API -> chapter page -> FETCH A REAL PAGE IMAGE
 *
 * The last step is the one that matters most. Comick had a perfect catalogue
 * and perfect chapter lists and served no page images at all, so anything
 * short of fetching actual bytes can pass while the source is still useless.
 *
 * Measured from home first, for comparison with whatever this returns:
 *   series page      200, chapter list NOT in the HTML (2 links of 308)
 *   chapters API     200 JSON, 50 rows/page, pagination.total = 308
 *   chapter page     200, 176 image URLs (~88 pages across 2 CDN mirrors)
 *   page image       403 bare / 200 with Referer https://www.manganato.gg/
 *
 * Targets hardcoded; nothing read from the caller. Delete once decided. Never
 * name the folder with a leading underscore — that makes it a private folder
 * and it silently never registers as a route.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE = 'https://www.manganato.gg';
const SLUG = 'the-beginning-after-the-endd';

async function get(url: string, headers: Record<string, string> = {}) {
  const started = Date.now();
  const r = await axios.get(url, {
    timeout: 12_000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [(d) => d],
    maxRedirects: 3,
  });
  const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? '');
  return {
    status: r.status,
    body,
    bytes: body.length,
    ms: Date.now() - started,
    server: r.headers?.['server'] ?? null,
    cfMitigated: r.headers?.['cf-mitigated'] ?? null,
    challenged:
      r.status === 403 || Boolean(r.headers?.['cf-mitigated']) || /Just a moment/i.test(body.slice(0, 3000)),
  };
}

export async function GET() {
  const out: Record<string, any> = { region: process.env.VERCEL_REGION ?? null };

  try {
    // 1. The gate every rejected candidate failed at.
    const series = await get(`${BASE}/manga/${SLUG}`);
    out.seriesPage = {
      status: series.status,
      bytes: series.bytes,
      ms: series.ms,
      server: series.server,
      cfMitigated: series.cfMitigated,
      challenged: series.challenged,
    };
    if (series.challenged || series.status !== 200) {
      out.verdict = 'BLOCKED FROM PRODUCTION — same failure mode as FlameComics';
      return NextResponse.json(out);
    }

    // 2. The chapter list lives behind an API, not in the page.
    const api = await get(`${BASE}/api/manga/${SLUG}/chapters?limit=50&offset=0`, {
      Referer: `${BASE}/manga/${SLUG}`,
      'X-Requested-With': 'XMLHttpRequest',
    });
    out.chaptersApi = { status: api.status, bytes: api.bytes, ms: api.ms, challenged: api.challenged };
    if (api.status === 200 && !api.challenged) {
      try {
        const j = JSON.parse(api.body);
        const rows = j?.data?.chapters ?? [];
        out.chaptersApi.rows = rows.length;
        out.chaptersApi.total = j?.data?.pagination?.total ?? null;
        out.chaptersApi.hasMore = j?.data?.pagination?.has_more ?? null;
        out.chaptersApi.newest = rows[0]?.chapter_name ?? null;
        out.chaptersApi.carriesDates = Boolean(rows[0]?.updated_at);
      } catch {
        out.chaptersApi.note = 'reachable but did not parse as JSON';
      }
    }

    // 3. A chapter page, for its image URLs.
    const chapter = await get(`${BASE}/manga/${SLUG}/chapter-1`, { Referer: `${BASE}/manga/${SLUG}` });
    out.chapterPage = { status: chapter.status, bytes: chapter.bytes, challenged: chapter.challenged };
    const imgs = [
      ...new Set(
        [
          ...chapter.body.matchAll(
            /https?:\/\/[a-z0-9.-]*(?:2xstorage|waitst)[a-z0-9.-]*\/[^"'\\ )]*\.(?:jpe?g|png|webp)/gi
          ),
        ].map((m) => m[0])
      ),
    ].filter((u) => !/\/thumb\//i.test(u));
    out.chapterPage.pageImages = imgs.length;
    out.chapterPage.sample = imgs[0] ?? null;

    // 4. FETCH ONE. Hotlink protection is confirmed from home (403 bare,
    //    200 with the Referer), so both are tried — a source whose images
    //    our egress cannot pull is a reader full of broken tiles.
    if (imgs[0]) {
      const bare = await get(imgs[0]);
      const withRef = await get(imgs[0], { Referer: `${BASE}/` });
      out.image = {
        bare: bare.status,
        withReferer: withRef.status,
        bytes: withRef.bytes,
      };
      out.verdict =
        withRef.status === 200 && withRef.bytes > 1000
          ? 'USABLE from production — series, chapters API, chapter page and page images all work'
          : 'pages listed but the image host refused this egress';
    } else {
      out.verdict = 'chapter page reachable but no page image URLs parsed';
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 300);
  }

  return NextResponse.json(out);
}
