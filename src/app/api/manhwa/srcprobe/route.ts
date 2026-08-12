import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. Which candidate manhwa sources are reachable FROM PRODUCTION.
 *
 * FlameComics taught the lesson this exists to apply: it answers 200 with the
 * full catalogue from a home connection and 403 + cf-mitigated=challenge from
 * Vercel, because the block keys on the IP. So a candidate that looks healthy
 * from a laptop tells us nothing, and the only way to choose a replacement is
 * to ask each one from the egress the app actually runs on.
 *
 * Targets are hardcoded; nothing is read from the caller. Delete after use, and
 * do not name the folder with a leading underscore — that makes it a PRIVATE
 * folder in the App Router and it silently never registers as a route.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CANDIDATES: { name: string; url: string; note: string }[] = [
  { name: 'mangadex-api', url: 'https://api.mangadex.org/manga?limit=2', note: 'official API, NOT behind Cloudflare' },
  { name: 'weebcentral', url: 'https://weebcentral.com/', note: 'cloudflare' },
  { name: 'toonily', url: 'https://toonily.com/', note: 'cloudflare, manhwa-only' },
  { name: 'manhuaplus', url: 'https://manhuaplus.com/', note: 'cloudflare' },
  { name: 'natomanga', url: 'https://www.natomanga.com/', note: 'cloudflare' },
  { name: 'mangafire', url: 'https://mangafire.to/', note: 'cloudflare' },
  { name: 'comick', url: 'https://comick.fun/', note: 'cloudflare' },
  { name: 'mangapark', url: 'https://mangapark.net/', note: 'cloudflare' },
  // The incumbents, as controls: two known-good and one known-blocked. Without
  // these a probe that fails everywhere is unreadable — it could just be egress.
  { name: 'CONTROL-asura', url: 'https://gg.asuracomic.net/api/series?page=1', note: 'control: works today' },
  { name: 'CONTROL-mangapill', url: 'https://mangapill.com/', note: 'control: works today' },
  { name: 'CONTROL-flame', url: 'https://flamecomics.xyz/browse', note: 'control: known blocked' },
];

async function probe(url: string) {
  const started = Date.now();
  try {
    const r = await axios.get(url, {
      timeout: 12_000,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
      maxRedirects: 3,
    });
    const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? '');
    const challenged =
      r.status === 403 ||
      Boolean(r.headers?.['cf-mitigated']) ||
      /Just a moment|cf-browser-verification|Checking your browser/i.test(body.slice(0, 4000));
    return {
      ok: r.status >= 200 && r.status < 400 && !challenged,
      status: r.status,
      challenged,
      bytes: body.length,
      ms: Date.now() - started,
      server: r.headers?.['server'] ?? null,
      cfMitigated: r.headers?.['cf-mitigated'] ?? null,
    };
  } catch (e: any) {
    return { ok: false, error: true, code: e?.code ?? null, message: String(e?.message ?? e).slice(0, 160), ms: Date.now() - started };
  }
}

export async function GET() {
  const results: Record<string, any> = {};
  // Sequential on purpose: a dozen concurrent outbound requests from one
  // invocation is itself the kind of traffic that trips rate limiting, which
  // would poison the very measurement this is here to make.
  for (const c of CANDIDATES) {
    results[c.name] = { note: c.note, ...(await probe(c.url)) };
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, results });
}
