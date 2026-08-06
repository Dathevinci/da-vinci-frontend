import { NextRequest } from "next/server";
import unzipper from "unzipper";
import { Readable } from "stream";
import { decodeLnoriTarget } from "@/lib/novel/lnoriProxy";

export const runtime = "nodejs";

/**
 * VOLUME COVER EXTRACTION — BOUNDED.
 *
 * This pulls the cover image out of an EPUB, which means reaching into a zip
 * that lives on someone else's server. The first version fetched the WHOLE
 * file to do it, and a volume card renders one of these per volume — so
 * opening a 15-volume series started fifteen complete EPUB downloads at once,
 * every single time anyone loaded the page. That is the "it downloads
 * everything" behaviour, and it was the server doing it, not the browser.
 *
 * Three things bound it now:
 *
 *  - A Range request for the first few MB only. EPUBs put the cover near the
 *    front often enough for this to work, and when it doesn't we simply say so
 *    and the card falls back to the series cover. A missing thumbnail is worth
 *    far less than a 20MB download.
 *  - A hard bail when the host ignores Range and answers with a full-size 200,
 *    so a server that doesn't support partial requests can't drag the whole
 *    file through anyway.
 *  - A small in-process cache, because the same volumes are requested on every
 *    visit to a series and the bytes never change.
 *
 * `export const revalidate` used to sit here and did nothing at all: this route
 * reads searchParams, which makes it dynamic, so Next never cached it.
 */

const MAX_BYTES = 4 * 1024 * 1024;

/** Per-instance memo. Serverless gives each instance its own; that is fine. */
const CACHE = new Map<string, { body: Buffer; type: string }>();
const CACHE_MAX = 64;

function remember(key: string, value: { body: Buffer; type: string }) {
  // Cheap FIFO eviction — covers are ~100KB and this only needs to survive a
  // browsing session, not be clever.
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, value);
}

const IMAGE_HEADERS = {
  "Cache-Control": "public, max-age=2592000, immutable",
  "Access-Control-Allow-Origin": "*",
};

export async function GET(req: NextRequest) {
  const url = decodeLnoriTarget(
    req.nextUrl.searchParams.get("b"),
    req.nextUrl.searchParams.get("url")
  );

  if (!url) {
    return new Response("Invalid URL", { status: 400 });
  }

  const hit = CACHE.get(url);
  if (hit) {
    return new Response(new Uint8Array(hit.body), {
      headers: { ...IMAGE_HEADERS, "Content-Type": hit.type },
    });
  }

  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${MAX_BYTES - 1}` },
    });

    if (!response.ok || !response.body) {
      return new Response("Upstream error", { status: 502 });
    }

    // 206 means the Range was honoured. A 200 means it wasn't, and the body is
    // the entire book — refuse it rather than stream a whole novel for a
    // thumbnail.
    if (response.status === 200) {
      const len = Number(response.headers.get("content-length") || 0);
      if (!len || len > MAX_BYTES) {
        return new Response("Cover not extractable", { status: 404 });
      }
    }

    const nodeStream = Readable.fromWeb(response.body as any);

    return await new Promise<Response>((resolve) => {
      let settled = false;
      const done = (r: Response) => {
        if (settled) return;
        settled = true;
        nodeStream.destroy();
        resolve(r);
      };

      nodeStream
        .pipe(unzipper.Parse())
        .on("entry", async (entry: any) => {
          const fileName = String(entry.path).toLowerCase();
          const isImage =
            fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");
          const looksLikeCover =
            isImage && (fileName.includes("cover") || fileName.includes("images/"));

          if (settled || !looksLikeCover) {
            entry.autodrain();
            return;
          }

          try {
            const buffer = await entry.buffer();
            const type = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
            remember(url, { body: buffer, type });
            done(
              new Response(new Uint8Array(buffer), {
                headers: { ...IMAGE_HEADERS, "Content-Type": type },
              })
            );
          } catch {
            entry.autodrain();
          }
        })
        .on("close", () => done(new Response("No cover found", { status: 404 })))
        // A truncated zip is the EXPECTED outcome when the cover sits past our
        // Range window, so this is a normal 404 and not a server error.
        .on("error", () => done(new Response("No cover found", { status: 404 })));
    });
  } catch {
    return new Response("Cover extraction failed", { status: 500 });
  }
}
