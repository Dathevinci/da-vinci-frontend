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
    steps.browse.korean_titles_sampled = (j.data || []).length;
    steps.browse.total_korean_with_english = j.total;

    /**
     * SAMPLE SEVERAL TITLES, NOT ONE. The first title checked came back with
     * zero English chapters, which is either the licensed case (listed but
     * unreadable — the trap that just disqualified Comick) or an artifact of
     * this query. One sample cannot tell those apart, and the difference
     * decides whether this source is usable at all, so count across a handful
     * and report the RATIO of readable titles.
     */
    const perTitle: any[] = [];
    let readable = 0;
    let firstPlayable: any = null;

    for (const m of (j.data || []).slice(0, 5)) {
      const title = m.attributes?.title?.en || Object.values(m.attributes?.title || {})[0];
      const feed = await get(
        `https://api.mangadex.org/manga/${m.id}/feed?translatedLanguage%5B%5D=en&limit=3` +
          `&order%5Bchapter%5D=desc&includeExternalUrl=0` +
          `&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica`
      );
      if (feed.status !== 200) {
        perTitle.push({ title, feedStatus: feed.status });
        continue;
      }
      const fj = JSON.parse(feed.body);
      const ch = (fj.data || [])[0];
      const row: any = { title, englishChapters: fj.total };
      if (ch) {
        readable++;
        row.sampleChapter = ch.attributes?.chapter;
        row.pages = ch.attributes?.pages;
        if (!firstPlayable) firstPlayable = ch;
      }
      perTitle.push(row);
    }

    steps.chapters = { perTitle, readableTitles: readable + '/' + perTitle.length };

    if (!firstPlayable) {
      steps.chapters.note = 'NO sampled title had readable English chapters';
      return steps;
    }

    const home = await get(`https://api.mangadex.org/at-home/server/${firstPlayable.id}`);
    steps.pages = { status: home.status, bytes: home.bytes, challenged: home.challenged };
    if (home.status !== 200) return steps;
    const hj = JSON.parse(home.body);
    const files = hj.chapter?.data || [];
    steps.pages.imageCount = files.length;
    steps.pages.host = hj.baseUrl ? new URL(hj.baseUrl).hostname : null;
    const sampleUrl = files[0] ? `${hj.baseUrl}/data/${hj.chapter.hash}/${files[0]}` : null;
    steps.pages.sampleUrl = sampleUrl;
    // The decisive bit: the image has to actually come back, from HERE.
    if (sampleUrl) {
      const img = await get(sampleUrl);
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
