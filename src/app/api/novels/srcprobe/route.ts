import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * TEMPORARY. Which high-quality novel source works FROM PRODUCTION?
 *
 * Home-IP screening already eliminated scribblehub (challenges even
 * residential), novelbin (dead DNS), lightnovelworld (soft bot-gate landing
 * page) and wuxiaworld (paywalled SPA). The three survivors are probed here
 * end-to-end — listing → a real novel → its detail → an actual CHAPTER TEXT —
 * because reachability alone lies: Comick was reachable everywhere and served
 * no images; the equivalent failure here is a source that lists novels whose
 * chapters come back empty.
 *
 * NO-MTL note per candidate: novelfull/readnovelfull carry the classic
 * human-translation canon (this project used novelfull before FOR that
 * reason); royalroad is original English fiction, where MTL cannot exist.
 *
 * Targets hardcoded; delete after the decision. Folder name has no leading
 * underscore — that would make it a private folder that never routes.
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
  return {
    status: r.status,
    body,
    bytes: body.length,
    ms: Date.now() - started,
    challenged:
      r.status === 403 || Boolean(r.headers?.['cf-mitigated']) || /Just a moment/i.test(body.slice(0, 3000)),
  };
}

const textOf = (html: string, sel: RegExp) => {
  const m = sel.exec(html);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

/** novelfull.net — listing, detail, the full-chapter-list ajax, one chapter's text. */
async function novelfull() {
  const out: Record<string, any> = {};
  try {
    const list = await get('https://novelfull.net/index.php/most-popular');
    out.listing = { status: list.status, bytes: list.bytes, ms: list.ms, challenged: list.challenged };
    if (list.challenged || list.status !== 200) return out;
    const slugs = [...new Set([...list.body.matchAll(/href="\/(?:index\.php\/)?([a-z0-9-]+)\.html"/g)].map((m) => m[1]))]
      .filter((s) => !/^(most-popular|latest-release|completed|hot|index|search|genre|sort)/.test(s));
    out.listing.novels = slugs.length;
    out.listing.sample = slugs.slice(0, 3);
    if (!slugs[0]) return out;

    const detail = await get(`https://novelfull.net/${slugs[0]}.html`);
    out.detail = { status: detail.status, bytes: detail.bytes, challenged: detail.challenged };
    const novelId = /data-novel-id="(\d+)"/.exec(detail.body)?.[1] ?? null;
    out.detail.novelId = novelId;
    out.detail.title = textOf(detail.body, /<h3 class="title"[^>]*>([\s\S]*?)<\/h3>/i);

    if (novelId) {
      const ajax = await get(`https://novelfull.net/ajax-chapter-option?novelId=${novelId}`, `https://novelfull.net/${slugs[0]}.html`);
      const chapters = [...ajax.body.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
      out.chapters = { status: ajax.status, count: chapters.length, first: chapters[0] ?? null };
      if (chapters[0]) {
        const ch = await get(`https://novelfull.net${chapters[0]}`);
        const text = textOf(ch.body, /<div[^>]*id="chapter-content"[^>]*>([\s\S]*?)<\/div>\s*<div/i) || '';
        out.chapterText = { status: ch.status, challenged: ch.challenged, textChars: text.length, sample: text.slice(0, 140) };
      }
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 200);
  }
  return out;
}

/** readnovelfull.com — same template family, different domain. */
async function readnovelfull() {
  const out: Record<string, any> = {};
  try {
    const list = await get('https://readnovelfull.com/novel-list/most-popular-novel');
    out.listing = { status: list.status, bytes: list.bytes, ms: list.ms, challenged: list.challenged };
    if (list.challenged || list.status !== 200) return out;
    const slugs = [...new Set([...list.body.matchAll(/href="\/([a-z0-9-]+)\.html"/g)].map((m) => m[1]))];
    out.listing.novels = slugs.length;
    if (!slugs[0]) return out;

    const detail = await get(`https://readnovelfull.com/${slugs[0]}.html`);
    out.detail = { status: detail.status, bytes: detail.bytes, challenged: detail.challenged };
    const novelId = /data-novel-id="(\d+)"/.exec(detail.body)?.[1] ?? null;
    out.detail.novelId = novelId;

    if (novelId) {
      const ajax = await get(`https://readnovelfull.com/ajax/chapter-archive?novelId=${novelId}`, `https://readnovelfull.com/${slugs[0]}.html`);
      const chapters = [...ajax.body.matchAll(/href="(\/[^"]+\.html)"/g)].map((m) => m[1]);
      out.chapters = { status: ajax.status, count: chapters.length, first: chapters[0] ?? null };
      if (chapters[0]) {
        const ch = await get(`https://readnovelfull.com${chapters[0]}`);
        const text = textOf(ch.body, /<div[^>]*id="chr-content"[^>]*>([\s\S]*?)<\/div>/i) || '';
        out.chapterText = { status: ch.status, challenged: ch.challenged, textChars: text.length, sample: text.slice(0, 140) };
      }
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 200);
  }
  return out;
}

/** royalroad.com — original English fiction; MTL cannot exist here. */
async function royalroad() {
  const out: Record<string, any> = {};
  try {
    const list = await get('https://www.royalroad.com/fictions/best-rated');
    out.listing = { status: list.status, bytes: list.bytes, ms: list.ms, challenged: list.challenged };
    if (list.challenged || list.status !== 200) return out;
    const fictions = [...new Set([...list.body.matchAll(/href="(\/fiction\/\d+\/[^"]+)"/g)].map((m) => m[1]))];
    out.listing.novels = fictions.length;
    out.listing.sample = fictions.slice(0, 2);
    if (!fictions[0]) return out;

    const detail = await get(`https://www.royalroad.com${fictions[0]}`);
    out.detail = { status: detail.status, bytes: detail.bytes, challenged: detail.challenged };
    const chapters = [...new Set([...detail.body.matchAll(/href="(\/fiction\/\d+\/[^"]+\/chapter\/\d+\/[^"]+)"/g)].map((m) => m[1]))];
    out.chapters = { count: chapters.length, first: chapters[0] ?? null };
    if (chapters[0]) {
      const ch = await get(`https://www.royalroad.com${chapters[0]}`);
      const text = textOf(ch.body, /<div[^>]*class="[^"]*chapter-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || '';
      out.chapterText = { status: ch.status, challenged: ch.challenged, textChars: text.length, sample: text.slice(0, 140) };
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 200);
  }
  return out;
}

export async function GET() {
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    novelfull: await novelfull(),
    readnovelfull: await readnovelfull(),
    royalroad: await royalroad(),
  });
}
