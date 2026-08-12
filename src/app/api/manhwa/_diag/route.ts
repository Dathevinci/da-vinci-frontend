import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. Why FlameComics returns zero rows in production and works locally.
 *
 * The symptom is silent: every explore page and both home shelves carry asura /
 * rzc / mpl ids and no `flc:` id at all, while from a home connection the same
 * upstream answers 200 with all 166 series, the __NEXT_DATA__ regex matches,
 * and the 1.5MB payload lands in 0.3s. getSeries swallows whatever goes wrong
 * (console.error + an empty page), so the only way to see the real failure is
 * to run the fetch from the same egress the app runs on and report it verbatim.
 *
 * TARGETS ARE HARDCODED. Nothing here takes a URL from the caller, so it cannot
 * be used as an open proxy. Delete once the cause is fixed and confirmed.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const TARGETS = [
  { label: 'browse (what the catalogue uses)', url: 'https://flamecomics.xyz/browse' },
  { label: 'home (what the rails use)', url: 'https://flamecomics.xyz/' },
];

async function probe(url: string, headers: Record<string, string>) {
  const started = Date.now();
  try {
    const r = await axios.get(url, {
      timeout: 12_000,
      headers,
      // Take the body whatever the status, so a challenge page is visible
      // rather than collapsing into an exception with no content.
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? '');
    const strict = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(body);
    let series: number | string = 'n/a';
    if (strict) {
      try {
        series = JSON.parse(strict[1])?.props?.pageProps?.series?.length ?? 'no series key';
      } catch {
        series = 'unparseable json';
      }
    }
    return {
      ms: Date.now() - started,
      status: r.status,
      bytes: body.length,
      server: r.headers?.['server'] ?? null,
      cfRay: r.headers?.['cf-ray'] ?? null,
      cfMitigated: r.headers?.['cf-mitigated'] ?? null,
      contentType: r.headers?.['content-type'] ?? null,
      hasNextData: Boolean(strict),
      series,
      // Enough to recognise a challenge/interstitial without dumping the page.
      head: body.slice(0, 220).replace(/\s+/g, ' '),
    };
  } catch (e: any) {
    return {
      ms: Date.now() - started,
      error: true,
      code: e?.code ?? null,
      message: String(e?.message ?? e).slice(0, 300),
      status: e?.response?.status ?? null,
    };
  }
}

export async function GET() {
  const out: Record<string, any> = {
    region: process.env.VERCEL_REGION ?? null,
    node: process.version,
  };

  for (const t of TARGETS) {
    out[t.label] = {
      withBrowserUA: await probe(t.url, {
        'User-Agent': UA,
        // The header set a real Chrome sends. If a bot filter is keying on the
        // absence of these rather than on the IP, this is what tells us.
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      }),
      uaOnly: await probe(t.url, { 'User-Agent': UA }),
    };
  }

  return NextResponse.json(out);
}
