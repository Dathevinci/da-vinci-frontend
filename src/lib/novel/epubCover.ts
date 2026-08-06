import unzipper from "unzipper";
import { Readable } from "stream";

/**
 * Pull the cover image out of an EPUB without downloading the EPUB.
 *
 * Server only. Shared by the per-volume cover route and the series-cover route
 * so the bounding rules below live in exactly one place.
 *
 * A volume card renders one of these per volume, so an unbounded version means
 * a 15-volume series starts fifteen complete book downloads the moment the page
 * opens. Three things stop that:
 *
 *  - a Range request for the first few MB only, since EPUBs put the cover near
 *    the front often enough for it to work;
 *  - a hard refusal when the host ignores Range and answers with a full-size
 *    200, so a server without partial support cannot drag the whole file
 *    through anyway;
 *  - a small in-process memo, because the same volumes are requested on every
 *    visit and the bytes never change.
 *
 * When the cover sits past the window we return null and the caller falls back
 * to the series art. A missing thumbnail is worth far less than a 20MB
 * download.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const CACHE_MAX = 128;

export interface EpubCover {
  body: Buffer;
  type: string;
}

const CACHE = new Map<string, EpubCover | null>();

function remember(key: string, value: EpubCover | null) {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, value);
}

export function cachedCover(url: string): EpubCover | null | undefined {
  return CACHE.get(url);
}

export async function extractEpubCover(url: string): Promise<EpubCover | null> {
  const hit = CACHE.get(url);
  if (hit !== undefined) return hit;

  try {
    const response = await fetch(url, { headers: { Range: `bytes=0-${MAX_BYTES - 1}` } });
    if (!response.ok || !response.body) {
      remember(url, null);
      return null;
    }

    // 206 means the Range was honoured. A plain 200 is the whole book.
    if (response.status === 200) {
      const len = Number(response.headers.get("content-length") || 0);
      if (!len || len > MAX_BYTES) {
        remember(url, null);
        return null;
      }
    }

    const nodeStream = Readable.fromWeb(response.body as any);

    const found = await new Promise<EpubCover | null>((resolve) => {
      let settled = false;
      const done = (v: EpubCover | null) => {
        if (settled) return;
        settled = true;
        nodeStream.destroy();
        resolve(v);
      };

      nodeStream
        .pipe(unzipper.Parse())
        .on("entry", async (entry: any) => {
          const name = String(entry.path).toLowerCase();
          const isImage = /\.(jpe?g|png)$/.test(name);
          const looksLikeCover = isImage && (name.includes("cover") || name.includes("images/"));

          if (settled || !looksLikeCover) {
            entry.autodrain();
            return;
          }
          try {
            const body = await entry.buffer();
            done({ body, type: name.endsWith(".png") ? "image/png" : "image/jpeg" });
          } catch {
            entry.autodrain();
          }
        })
        .on("close", () => done(null))
        // A truncated zip is the EXPECTED outcome when the cover sits past our
        // Range window, so this is a normal miss and not a server error.
        .on("error", () => done(null));
    });

    remember(url, found);
    return found;
  } catch {
    remember(url, null);
    return null;
  }
}

export const COVER_HEADERS = {
  "Cache-Control": "public, max-age=2592000, immutable",
  "Access-Control-Allow-Origin": "*",
};
