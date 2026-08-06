import { NextRequest } from "next/server";
import { decodeLnoriTarget } from "@/lib/novel/lnoriProxy";

export const runtime = "nodejs";

/**
 * Takes the file address base64'd as `b` (see lib/novel/lnoriProxy.ts) so no
 * URL the browser handles ever ends in `.epub` — download managers hook that
 * extension and were popping a save dialog for every volume link on the page.
 */
export async function GET(req: NextRequest) {
  const url = decodeLnoriTarget(
    req.nextUrl.searchParams.get("b"),
    req.nextUrl.searchParams.get("url")
  );
  if (!url) return new Response("Invalid URL", { status: 400 });

  const asDownload = req.nextUrl.searchParams.get("dl") === "1";

  try {
    const headers = new Headers();
    const range = req.headers.get("range");
    if (range) headers.set("Range", range);

    const response = await fetch(url, { headers });

    const proxyHeaders = new Headers();
    proxyHeaders.set("Access-Control-Allow-Origin", "*");
    proxyHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    proxyHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");

    for (const h of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
      const v = response.headers.get(h);
      if (v) proxyHeaders.set(h, v);
    }

    /**
     * `inline` unless the reader's own button asked for a save. epub.js reads
     * this over XHR and never wants a download; only the explicit EPUB button
     * does, and that one names the file properly instead of leaving the
     * browser to invent one from the URL.
     */
    if (asDownload) {
      const name = decodeURIComponent(url.split("/").pop() || "volume.epub").replace(/"/g, "");
      proxyHeaders.set("Content-Disposition", `attachment; filename="${name}"`);
    } else {
      proxyHeaders.set("Content-Disposition", "inline");
    }

    return new Response(response.body, {
      status: response.status,
      headers: proxyHeaders,
    });
  } catch {
    return new Response("Proxy Error", { status: 500 });
  }
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
  return new Response(null, { status: 204, headers });
}
