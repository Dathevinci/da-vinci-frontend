import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. End-to-end check of the two remaining candidate sources.
 *
 * Reachability alone is not enough — Comick proved that. Its catalogue is
 * excellent and its chapter lists work, but md_images comes back EMPTY on every
 * chapter sampled, so it can only ever list titles a reader cannot open. So
 * this walks the WHOLE chain each source has to support, and the one that
 * matters most is the last link: PAGE IMAGES.
 *
 *   browse -> pick a series -> chapter list -> resolve page image URLs
 *
 * Run from production because both candidates behave differently by IP:
 * NatoManga answered 200 from Vercel and 403 from a home connection, which is
 * the exact inverse of Flame and a reminder that neither vantage point alone
 * can be trusted.
 *
 * Targets hardcoded; nothing read from the caller. Delete once a source is
 * chosen. Do not rename the folder with a leading underscore — that makes it a
 * private folder and it silently never registers as a route.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function get(url: string, headers: Record<string, string> = {}) {
  const r = await axios.get(url, {
    timeout: 12_000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [(d) => d],
    maxRedirects: 3,
  });
  const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? '');
  const challenged = r.status === 403 || Boolean(r.headers?.['cf-mitigated']) || /Just a moment/i.test(body.slice(0, 3000));
  return { status: r.status, body, challenged, bytes: body.length };
}

/** MangaDex: documented API, not behind Cloudflare, and it hosts its own pages. */
async function mangadex() {
  const steps: Record<string, any> = {};
  try {
    const list = await get(
      'https://api.mangadex.org/manga?limit=5&order%5BlatestUploadedChapter%5D=desc' +
        '&availableTranslatedLanguage%5B%5D=en&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive' +
        '&originalLanguage%5B%5D=ko&includes%5B%5D=cover_art'
    );
    steps.browse = { status: list.status, bytes: list.bytes, challenged: list.challenged };
    if (list.challenged || list.status !== 200) return steps;

    const j = JSON.parse(list.body);
    const first = (j.data || [])[0];
    steps.browse.korean_titles = (j.data || []).length;
    steps.browse.total = j.total;
    if (!first) return steps;
    const title = first.attributes?.title?.en || Object.values(first.attributes?.title || {})[0];
    steps.browse.sample = title;
    steps.browse.hasCoverRelation = (first.relationships || []).some((r: any) => r.type === 'cover_art');

    const feed = await get(
      `https://api.mangadex.org/manga/${first.id}/feed?translatedLanguage%5B%5D=en&limit=5&order%5Bchapter%5D=desc`
    );
    steps.chapters = { status: feed.status, bytes: feed.bytes, challenged: feed.challenged };
    if (feed.status !== 200) return steps;
    const fj = JSON.parse(feed.body);
    steps.chapters.count = fj.total;
    const ch = (fj.data || [])[0];
    if (!ch) {
      // A manga with zero English chapters is the LICENSED case: listed, unreadable.
      steps.chapters.note = 'ZERO english chapters for this title (licensed/external?)';
      return steps;
    }
    steps.chapters.sample = ch.attributes?.chapter;

    const home = await get(`https://api.mangadex.org/at-home/server/${ch.id}`);
    steps.pages = { status: home.status, bytes: home.bytes, challenged: home.challenged };
    if (home.status !== 200) return steps;
    const hj = JSON.parse(home.body);
    const files = hj.chapter?.data || [];
    steps.pages.imageCount = files.length;
    steps.pages.host = hj.baseUrl ? new URL(hj.baseUrl).hostname : null;
    steps.pages.sampleUrl = files[0] ? `${hj.baseUrl}/data/${hj.chapter.hash}/${files[0]}` : null;
    // The decisive bit: can the image actually be fetched from here?
    if (steps.pages.sampleUrl) {
      const img = await get(steps.pages.sampleUrl);
      steps.pages.imageFetch = { status: img.status, bytes: img.bytes };
    }
  } catch (e: any) {
    steps.error = String(e?.message ?? e).slice(0, 200);
  }
  return steps;
}

/** NatoManga: a reader site, so it serves its own pages — if it lets us in. */
async function natomanga() {
  const steps: Record<string, any> = {};
  try {
    const list = await get('https://www.natomanga.com/manga-list/hot-manga');
    steps.browse = { status: list.status, bytes: list.bytes, challenged: list.challenged };
    if (list.challenged || list.status !== 200) return steps;

    const links = [...list.body.matchAll(/href="(https?:\/\/[^"]*\/manga\/[^"]+)"/g)].map((m) => m[1]);
    const series = [...new Set(links)][0];
    steps.browse.seriesLinks = new Set(links).size;
    steps.browse.sample = series ?? null;
    if (!series) return steps;

    const sp = await get(series, { Referer: 'https://www.natomanga.com/' });
    steps.chapters = { status: sp.status, bytes: sp.bytes, challenged: sp.challenged };
    if (sp.status !== 200) return steps;
    const chLinks = [...new Set([...sp.body.matchAll(/href="(https?:\/\/[^"]*chapter[^"]*)"/gi)].map((m) => m[1]))];
    steps.chapters.count = chLinks.length;
    // Does the listing carry an update time? A "Recently Updated" shelf needs one.
    steps.chapters.hasUpdateTime = /updated|ago<|\d{2}-\d{2}-\d{4}/i.test(sp.body);
    const chapter = chLinks[0];
    steps.chapters.sample = chapter ?? null;
    if (!chapter) return steps;

    const cp = await get(chapter, { Referer: series });
    steps.pages = { status: cp.status, bytes: cp.bytes, challenged: cp.challenged };
    if (cp.status !== 200) return steps;
    const hosts: Record<string, number> = {};
    for (const m of cp.body.matchAll(/https?:\/\/([a-z0-9.-]+)\/[^"'\\ )]*\.(?:webp|jpe?g|png)/gi)) {
      hosts[m[1]] = (hosts[m[1]] || 0) + 1;
    }
    steps.pages.imageHosts = hosts;
    const firstImg = cp.body.match(/https?:\/\/[a-z0-9.-]+\/[^"'\\ )]*\.(?:webp|jpe?g|png)/i)?.[0];
    steps.pages.sampleUrl = firstImg ?? null;
    if (firstImg) {
      // Image hosts on these sites often require a Referer; report both.
      const bare = await get(firstImg);
      const withRef = await get(firstImg, { Referer: 'https://www.natomanga.com/' });
      steps.pages.imageFetch = { bare: bare.status, withReferer: withRef.status, bytes: withRef.bytes };
    }
  } catch (e: any) {
    steps.error = String(e?.message ?? e).slice(0, 200);
  }
  return steps;
}

export async function GET() {
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    mangadex: await mangadex(),
    natomanga: await natomanga(),
  });
}
