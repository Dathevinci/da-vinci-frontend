import { NextRequest, NextResponse } from "next/server";
import { decodeLnoriTarget } from "@/lib/novel/lnoriProxy";
import { getSection, SourceUnreachableError } from "@/lib/novel/epubExtract";

export const runtime = "nodejs";

/**
 * One spine section of an EPUB as sanitised HTML, plus the contents list.
 * The reader renders this into its own DOM — no epub.js, no iframe — which is
 * how lnori.com's own reader works and why theirs never fought the problems
 * ours did.
 */
export async function GET(req: NextRequest) {
  const url = decodeLnoriTarget(req.nextUrl.searchParams.get("b"), null);
  if (!url) return new NextResponse("Invalid URL", { status: 400 });

  const index = Number(req.nextUrl.searchParams.get("sec")) || 0;
  const b = req.nextUrl.searchParams.get("b") as string;

  let section;
  try {
    section = await getSection(url, index, (zipPath) => {
      return "/api/proxy/lnori/asset?b=" + encodeURIComponent(b) + "&p=" + encodeURIComponent(zipPath);
    });
  } catch (e) {
    // 503, not 422: the source is unreachable (Lnori is behind a Cloudflare
    // challenge as of 2026-08-09). Uncached, and the reader shows "temporarily
    // unavailable" instead of a fallback that would hit the same dead source.
    if (e instanceof SourceUnreachableError) {
      return new NextResponse("Source unreachable", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    throw e;
  }

  // 422 = downloaded but could not be parsed. The reader falls back to epub.js
  // for these, which can sometimes open a book the extractor cannot.
  if (!section) return new NextResponse("Extraction failed", { status: 422 });

  return NextResponse.json(section, {
    headers: {
      // The archive is immutable, so a section extracted from it is too.
      "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable",
    },
  });
}
