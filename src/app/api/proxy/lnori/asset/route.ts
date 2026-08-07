import { NextRequest, NextResponse } from "next/server";
import { decodeLnoriTarget } from "@/lib/novel/lnoriProxy";
import { getAsset } from "@/lib/novel/epubExtract";

export const runtime = "nodejs";

/** An image (or font) pulled out of the EPUB for the HTML reader. */
export async function GET(req: NextRequest) {
  const url = decodeLnoriTarget(req.nextUrl.searchParams.get("b"), null);
  if (!url) return new NextResponse("Invalid URL", { status: 400 });

  const zipPath = req.nextUrl.searchParams.get("p") || "";
  // The extractor resolves paths against the zip's own directory listing, but
  // refuse anything that even looks like a traversal attempt.
  if (!zipPath || zipPath.includes("..")) return new NextResponse("Invalid path", { status: 400 });

  const asset = await getAsset(url, zipPath);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(asset.body), {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "public, max-age=2592000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
