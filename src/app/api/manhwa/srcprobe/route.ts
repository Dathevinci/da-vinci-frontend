import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. Can VortexScans be reached from production, and can it be read?
 *
 * Two separate questions, and the first has killed every candidate so far.
 * FlameComics answers 200 with its whole catalogue from a home connection and
 * 403 + cf-mitigated=challenge from Vercel, because the block keys on the IP.
 * NatoManga does the same thing intermittently. So a source that looks healthy
 * from a laptop tells us nothing, and only this vantage point counts.
 *
 * The second question is the one Comick failed: its catalogue and chapter lists
 * work fine, but no chapter exposes page images, so it could only ever list
 * titles a reader cannot open. Hence this walks the WHOLE chain and finishes by
 * FETCHING A PAGE IMAGE rather than trusting that a URL exists.
 *
 *   /series -> a real series -> its chapter list -> page images -> fetch one
 *
 * Targets hardcoded; nothing read from the caller. Delete once decided. Never
 * name the folder with a leading underscore — that makes it a private folder
 * and it silently never registers as a route.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://vortexscans.org';

async function get(url: string, headers: Record<string, string> = {}) {
  const started = Date.now();
  const r = await axios.get(url, {
    timeout: 12_000,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers,
    },
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

const imageHosts = (html: string) => {
  const hosts: Record<string, number> = {};
  for (const m of html.matchAll(/https?:\/\/([a-z0-9.-]+)\/[^"'\\ )]*\.(?:webp|jpe?g|png|avif)/gi)) {
    hosts[m[1]] = (hosts[m[1]] || 0) + 1;
  }
  return hosts;
};

export async function GET() {
  const out: Record<string, any> = { region: process.env.VERCEL_REGION ?? null };

  try {
    // 1. BROWSE — the gate every other candidate failed at.
    const home = await get(`${BASE}/series`);
    out.browse = {
      status: home.status,
      bytes: home.bytes,
      ms: home.ms,
      server: home.server,
      cfMitigated: home.cfMitigated,
      challenged: home.challenged,
    };
    if (home.challenged || home.status !== 200) {
      out.verdict = 'BLOCKED FROM PRODUCTION — same failure mode as FlameComics';
      return NextResponse.json(out);
    }

    const slugs = [...new Set([...home.body.matchAll(/href="(\/series\/[^"?#]+)"/g)].map((m) => m[1]))];
    out.browse.seriesLinks = slugs.length;
    out.browse.sample = slugs.slice(0, 3);
    // Does the listing carry an update time? "Recently Updated" needs a real one.
    out.browse.mentionsTime = /(ago|updated|chapter\s*\d+)/i.test(home.body);
    if (slugs.length === 0) {
      out.verdict = 'reachable, but no series links parsed from /series';
      return NextResponse.json(out);
    }

    // 2. A REAL SERIES — chapter list.
    const seriesUrl = BASE + slugs[0];
    const series = await get(seriesUrl, { Referer: BASE + '/' });
    out.chapters = { url: seriesUrl, status: series.status, bytes: series.bytes, challenged: series.challenged };
    if (series.status !== 200 || series.challenged) {
      out.verdict = 'browse works but the series page is blocked';
      return NextResponse.json(out);
    }
    const chapterLinks = [
      ...new Set([...series.body.matchAll(/href="([^"]*\/series\/[^"]*chapter[^"?#]*)"/gi)].map((m) => m[1])),
    ];
    out.chapters.count = chapterLinks.length;
    out.chapters.sample = chapterLinks.slice(0, 3);
    if (chapterLinks.length === 0) {
      out.verdict = 'series page reachable but no chapter links parsed (client-rendered?)';
      out.chapters.hasNextData = /__NEXT_DATA__|self\.__next_f/.test(series.body);
      return NextResponse.json(out);
    }

    // 3. A CHAPTER — the page images themselves.
    const chapterUrl = chapterLinks[0].startsWith('http') ? chapterLinks[0] : BASE + chapterLinks[0];
    const chapter = await get(chapterUrl, { Referer: seriesUrl });
    out.pages = { url: chapterUrl, status: chapter.status, bytes: chapter.bytes, challenged: chapter.challenged };
    if (chapter.status !== 200 || chapter.challenged) {
      out.verdict = 'chapter page blocked';
      return NextResponse.json(out);
    }
    const hosts = imageHosts(chapter.body);
    out.pages.imageHosts = hosts;

    // 4. FETCH ONE IMAGE. This is the step that would have caught Comick.
    const first = chapter.body.match(
      /https?:\/\/[a-z0-9.-]*vortexscans[a-z0-9.-]*\/[^"'\\ )]*\.(?:webp|jpe?g|png|avif)/i
    )?.[0];
    out.pages.sampleUrl = first ?? null;
    if (first) {
      const bare = await get(first);
      const withRef = await get(first, { Referer: chapterUrl });
      out.pages.imageFetch = { bare: bare.status, withReferer: withRef.status, bytes: withRef.bytes };
      out.verdict =
        withRef.status === 200 && withRef.bytes > 1000
          ? 'USABLE — browse, chapters and page images all work from production'
          : 'pages listed but the image host refused this egress';
    } else {
      out.verdict = 'chapter reachable but no page image URLs found in the HTML';
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 300);
  }

  return NextResponse.json(out);
}
