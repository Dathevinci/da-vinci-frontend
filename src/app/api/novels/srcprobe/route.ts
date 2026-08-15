import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. Can ranobes be served FROM PRODUCTION?
 *
 * Ranobes is the chosen candidate for novel source #2 (the owner excluded
 * RoyalRoad): human fan translations with quality curation — the no-MTL
 * requirement — and a Japanese-LN catalogue that barely overlaps
 * ReadNovelFull's CN-heavy canon, so it adds rather than duplicates.
 *
 * Everything below already passed from a home IP: listing 24 novels, detail
 * with og:image cover (hotlink-free), the chapter list as window.__DATA__
 * JSON (25/page, pages_count present), and a chapter serving ~15k chars once
 * the container is read to </article> rather than the first nested close.
 * Home-IP results have been wrong about production FIVE times this session,
 * so this walks the whole chain from the real egress, on both domains —
 * the old integration era noted ranobes domain failover (.top/.net).
 *
 * Targets hardcoded; delete after the decision.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function get(url: string, referer?: string) {
  const started = Date.now();
  const r = await axios.get(url, {
    timeout: 12_000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...(referer ? { Referer: referer } : {}) },
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [(d: any) => d],
    maxRedirects: 3,
  });
  const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? '');
  // Say WHICH signal fired, not just that one did: a 200 with a stray phrase
  // match is a different animal from a 403, and the first run conflated them.
  const signals = {
    s403: r.status === 403,
    cfMitigated: Boolean(r.headers?.['cf-mitigated']),
    phrase: /Just a moment/i.test(body.slice(0, 3000)),
    ddosGuard: /ddos-guard|checking your browser/i.test(body.slice(0, 3000)),
  };
  return {
    status: r.status,
    body,
    bytes: body.length,
    ms: Date.now() - started,
    challenged: signals.s403 || signals.cfMitigated || signals.phrase || signals.ddosGuard,
    signals,
    head: body.slice(0, 160).replace(/\s+/g, ' '),
  };
}

async function probeDomain(base: string) {
  const out: Record<string, any> = {};
  try {
    const list = await get(`${base}/novels/`);
    out.listing = {
      status: list.status,
      bytes: list.bytes,
      ms: list.ms,
      challenged: list.challenged,
      signals: list.signals,
      head: list.head,
    };
    // Continue on ANY 200 — the flag alone stopped the first run on a page
    // whose actual content was never examined. If the links parse, it was a
    // false alarm; if they don't, the head tells us what the page really is.
    if (list.status !== 200) return out;

    const links = [
      ...new Set([...list.body.matchAll(/href="(https?:\/\/[a-z.]+\/novels\/[^"]+\.html)"/g)].map((m) => m[1])),
    ];
    out.listing.novels = links.length;
    if (!links[0]) return out;
    out.listing.sample = links[0];

    const detail = await get(links[0], base + '/');
    out.detail = { status: detail.status, bytes: detail.bytes, challenged: detail.challenged };
    const bookId = /\/chapters\/(\d+)/.exec(detail.body)?.[1] ?? null;
    out.detail.bookId = bookId;
    out.detail.cover = /<meta property="og:image" content="([^"]+)"/.exec(detail.body)?.[1] ?? null;
    if (!bookId) return out;

    const chl = await get(`${base}/chapters/${bookId}/`, links[0]);
    out.chapters = { status: chl.status, bytes: chl.bytes, challenged: chl.challenged };
    const dm = /window\.__DATA__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(chl.body);
    if (dm) {
      try {
        const j = JSON.parse(dm[1]);
        out.chapters.rows = (j.chapters || []).length;
        out.chapters.pages = j.pages_count ?? null;
        out.chapters.total = j.count_all ?? null;
        const link = j.chapters?.[0]?.link;
        if (link) {
          const ch = await get(link, `${base}/chapters/${bookId}/`);
          const i = ch.body.indexOf('id="arrticle"');
          const end = ch.body.indexOf('</article>', i);
          const seg = i >= 0 ? ch.body.slice(i, end > 0 ? end : i + 90_000) : '';
          const text = seg
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          out.chapterText = { status: ch.status, challenged: ch.challenged, textChars: text.length, sample: text.slice(0, 120) };
        }
      } catch {
        out.chapters.note = '__DATA__ present but unparseable';
      }
    } else {
      out.chapters.note = 'no window.__DATA__';
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 200);
  }
  return out;
}

export async function GET() {
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    'ranobes.top': await probeDomain('https://ranobes.top'),
    'ranobes.net': await probeDomain('https://ranobes.net'),
  });
}
