import unzipper from "unzipper";
import * as cheerio from "cheerio";

/**
 * SERVER-SIDE EPUB → HTML, the way lnori.com itself does it.
 *
 * Inspected live: their reader has no epub.js at all — the chapter is plain
 * HTML in an <article>, the contents are ordinary anchor links, and every
 * feature (fonts, alignment, bionic) is trivial DOM work because the book IS
 * the page. Meanwhile we spent a week fighting epub.js: iframes that resist
 * theming, spine lookups that silently miss, frames measured from their own
 * content. Unpacking the archive on the server exits that entire class of
 * problem.
 *
 * This module fetches the EPUB once (small in-process cache), reads the OPF
 * spine and the nav/NCX contents, and serves one SECTION at a time as
 * sanitised HTML with image sources rewritten to the asset route.
 */

const MAX_BYTES = 60 * 1024 * 1024;
const BOOK_CACHE_MAX = 2;

interface TocEntry {
  label: string;
  /** Spine index this entry opens. */
  index: number;
  /** Optional #fragment inside that section. */
  fragment: string;
}

interface ParsedBook {
  /** Zip paths of spine documents, in reading order. */
  spinePaths: string[];
  toc: TocEntry[];
  /** Lazily-read file bodies, keyed by zip path. */
  read: (path: string) => Promise<Buffer | null>;
  /** Case/encoding-tolerant zip path lookup. */
  find: (path: string) => string | null;
}

/**
 * Promise-cached so two concurrent requests for the same book share one
 * download instead of racing two. FIFO cap because a parsed book pins its
 * whole buffer in memory.
 */
const BOOKS = new Map<string, Promise<ParsedBook | null>>();

function normPath(p: string): string {
  let out = String(p || "");
  try {
    out = decodeURIComponent(out);
  } catch {
    /* compare raw */
  }
  return out.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").toLowerCase();
}

/** Resolve `rel` against the directory of `fromPath`, collapsing ../ and ./ */
function joinPath(fromPath: string, rel: string): string {
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const parts = (dir ? dir + "/" + rel : rel).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/** Same nav-href-to-spine matching the client resolver used, proven live. */
function spineIndexFor(spinePaths: string[], href: string): number {
  const want = normPath(href);
  if (!want) return -1;
  const wantBase = want.split("/").pop() || "";
  let idx = spinePaths.findIndex((p) => {
    const h = normPath(p);
    return h === want || h.endsWith("/" + want) || want.endsWith("/" + h);
  });
  if (idx < 0 && wantBase) {
    const matches = spinePaths
      .map((p, i) => ({ p, i }))
      .filter((x) => (normPath(x.p).split("/").pop() || "") === wantBase);
    if (matches.length === 1) idx = matches[0].i;
  }
  return idx;
}

/** Thrown when the SOURCE could not be reached at all — distinct from a book
 *  that downloaded fine but could not be parsed. The source going behind a
 *  Cloudflare challenge (as Lnori did) is transient and must not be cached, and
 *  the reader shows "temporarily unavailable" rather than a doomed fallback. */
export class SourceUnreachableError extends Error {
  constructor() {
    super("SOURCE_UNREACHABLE");
    this.name = "SourceUnreachableError";
  }
}

async function parseBook(url: string): Promise<ParsedBook | null> {
  const res = await fetch(url).catch(() => null);
  // A non-OK response is the SOURCE refusing us (403 Cloudflare challenge, 5xx,
  // a rename): unreachable, not unparseable. Throw so it is neither cached nor
  // mistaken for a book epub.js could open if only we tried harder.
  if (!res || !res.ok) throw new SourceUnreachableError();
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return null;

  const dir = await unzipper.Open.buffer(buf);
  const byPath = new Map<string, any>();
  for (const f of dir.files) byPath.set(normPath(f.path), f);

  const bodies = new Map<string, Buffer>();
  const find = (path: string) => (byPath.has(normPath(path)) ? normPath(path) : null);
  const read = async (path: string): Promise<Buffer | null> => {
    const key = find(path);
    if (!key) return null;
    const hit = bodies.get(key);
    if (hit) return hit;
    try {
      const body: Buffer = await byPath.get(key).buffer();
      bodies.set(key, body);
      return body;
    } catch {
      return null;
    }
  };

  // container.xml names the OPF; the OPF names everything else.
  const containerXml = await read("META-INF/container.xml");
  if (!containerXml) return null;
  const $c = cheerio.load(containerXml.toString("utf8"), { xmlMode: true });
  const opfPath = $c("rootfile").first().attr("full-path") || "";
  const opfXml = await read(opfPath);
  if (!opfXml) return null;

  const $o = cheerio.load(opfXml.toString("utf8"), { xmlMode: true });
  const manifest = new Map<string, { href: string; type: string; props: string }>();
  $o("manifest > item").each((_, el) => {
    const $el = $o(el);
    manifest.set($el.attr("id") || "", {
      href: $el.attr("href") || "",
      type: $el.attr("media-type") || "",
      props: $el.attr("properties") || "",
    });
  });

  const spinePaths: string[] = [];
  $o("spine > itemref").each((_, el) => {
    const item = manifest.get($o(el).attr("idref") || "");
    if (item?.href) spinePaths.push(joinPath(opfPath, item.href));
  });
  if (!spinePaths.length) return null;

  // Contents: EPUB3 nav document first, NCX as the fallback.
  const toc: TocEntry[] = [];
  const pushEntry = (label: string, rawHref: string, fromDoc: string) => {
    const clean = (label || "").replace(/\s+/g, " ").trim();
    if (!clean || !rawHref) return;
    const hashAt = rawHref.indexOf("#");
    const fragment = hashAt >= 0 ? rawHref.slice(hashAt + 1) : "";
    const pathPart = hashAt >= 0 ? rawHref.slice(0, hashAt) : rawHref;
    const target = pathPart ? joinPath(fromDoc, pathPart) : fromDoc;
    const index = spineIndexFor(spinePaths, target);
    if (index >= 0) toc.push({ label: clean, index, fragment });
  };

  const navEntry = [...manifest.values()].find((m) => m.props.split(/\s+/).includes("nav"));
  if (navEntry) {
    const navPath = joinPath(opfPath, navEntry.href);
    const navHtml = await read(navPath);
    if (navHtml) {
      const $n = cheerio.load(navHtml.toString("utf8"));
      let $nav = $n("nav").filter((_, el) => $n(el).attr("epub:type") === "toc").first();
      if (!$nav.length) $nav = $n("nav").first();
      $nav.find("a[href]").each((_, a) => pushEntry($n(a).text(), $n(a).attr("href") || "", navPath));
    }
  }
  if (!toc.length) {
    const ncxEntry = [...manifest.values()].find((m) => m.type.includes("dtbncx"));
    if (ncxEntry) {
      const ncxPath = joinPath(opfPath, ncxEntry.href);
      const ncxXml = await read(ncxPath);
      if (ncxXml) {
        const $x = cheerio.load(ncxXml.toString("utf8"), { xmlMode: true });
        $x("navPoint").each((_, np) => {
          const label = $x(np).find("navLabel > text").first().text();
          const src = $x(np).find("content").first().attr("src") || "";
          pushEntry(label, src, ncxPath);
        });
      }
    }
  }

  return { spinePaths, toc, read, find };
}

export async function loadBook(url: string): Promise<ParsedBook | null> {
  let p = BOOKS.get(url);
  if (!p) {
    if (BOOKS.size >= BOOK_CACHE_MAX) {
      const oldest = BOOKS.keys().next().value;
      if (oldest) BOOKS.delete(oldest);
    }
    p = parseBook(url);
    BOOKS.set(url, p);
    // Neither a parse failure (null) nor a source-unreachable REJECTION may
    // poison the cache — a transient 403 must retry on the next visit, not
    // stick for the life of the process. The rejection is re-observed here so
    // it does not become an unhandledRejection, then rethrown to callers below.
    p.then(
      (v) => {
        if (!v) BOOKS.delete(url);
      },
      () => {
        BOOKS.delete(url);
      }
    );
  }
  return p;
}

export interface SectionPayload {
  index: number;
  count: number;
  html: string;
  toc: TocEntry[];
}

/**
 * One spine section as sanitised HTML.
 *
 * Sanitising matters: this HTML goes into OUR page via innerHTML, so scripts,
 * event handlers and javascript: URLs are stripped, publisher stylesheets are
 * dropped (our themes own the page now), and images are rewritten to the asset
 * route. Internal chapter links become data attributes the reader intercepts —
 * left as hrefs they would navigate the whole app to a zip path.
 */
export async function getSection(
  url: string,
  index: number,
  assetHref: (zipPath: string) => string
): Promise<SectionPayload | null> {
  const book = await loadBook(url);
  if (!book) return null;
  const clamped = Math.max(0, Math.min(book.spinePaths.length - 1, index));
  const secPath = book.spinePaths[clamped];
  const body = await book.read(secPath);
  if (!body) return null;

  const $ = cheerio.load(body.toString("utf8"));
  $("script, style, link, meta, iframe, object, embed, base").remove();

  $("*").each((_, el) => {
    const attribs = (el as any).attribs || {};
    for (const name of Object.keys(attribs)) {
      if (/^on/i.test(name)) $(el).removeAttr(name);
      else if (/^(href|src)$/i.test(name) && /^\s*javascript:/i.test(attribs[name])) $(el).removeAttr(name);
      /**
       * INLINE styles go too, not just <style> blocks. Fixed-layout sections
       * carry inline position/overflow/height declarations, and an element
       * whose positioning escapes the reader's scroll container breaks TOUCH
       * scrolling specifically: a pan scrolls the nearest scrollable ancestor
       * of the element under the finger, and for a position:fixed element that
       * chain bypasses the reader's column entirely — while wheel scrolling,
       * resolved by hover position, keeps working. They also fight the themes
       * (inline color/background outranks every stylesheet we own).
       */
      else if (/^style$/i.test(name)) $(el).removeAttr(name);
      // Image ghost-drag on touch: a drag that starts a native image drag
      // never becomes a scroll.
      else if (/^draggable$/i.test(name)) $(el).removeAttr(name);
    }
  });

  const rewrite = (el: any, attr: string) => {
    const raw = $(el).attr(attr);
    if (!raw || /^(https?:|data:)/i.test(raw)) return;
    const resolved = joinPath(secPath, raw.split("#")[0]);
    if (book.find(resolved)) $(el).attr(attr, assetHref(resolved));
  };
  $("img").each((_, el) => {
    rewrite(el, "src");
    $(el).attr("loading", "lazy");
    $(el).attr("decoding", "async");
  });
  $("image").each((_, el) => {
    rewrite(el, "href");
    rewrite(el, "xlink:href");
  });

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") || "";
    if (/^(https?:|mailto:)/i.test(raw)) {
      $(el).attr("target", "_blank");
      $(el).attr("rel", "noopener noreferrer");
      return;
    }
    if (raw.startsWith("#")) return; // same-section anchor, works as-is
    const hashAt = raw.indexOf("#");
    const pathPart = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const fragment = hashAt >= 0 ? raw.slice(hashAt + 1) : "";
    const target = spineIndexFor(book.spinePaths, joinPath(secPath, pathPart));
    $(el).removeAttr("href");
    if (target >= 0) {
      $(el).attr("data-epub-sec", String(target));
      if (fragment) $(el).attr("data-epub-frag", fragment);
    }
  });

  return {
    index: clamped,
    count: book.spinePaths.length,
    html: $("body").html() || "",
    toc: book.toc,
  };
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  css: "text/css",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

export async function getAsset(
  url: string,
  zipPath: string
): Promise<{ body: Buffer; type: string } | null> {
  const book = await loadBook(url);
  if (!book) return null;
  const body = await book.read(zipPath);
  if (!body) return null;
  const ext = (zipPath.split(".").pop() || "").toLowerCase();
  return { body, type: MIME[ext] || "application/octet-stream" };
}
