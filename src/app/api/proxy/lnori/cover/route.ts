import { NextRequest } from "next/server";
import { decodeLnoriTarget } from "@/lib/novel/lnoriProxy";
import { extractEpubCover, COVER_HEADERS } from "@/lib/novel/epubCover";

export const runtime = "nodejs";

/**
 * One volume's cover, pulled out of its EPUB. The bounding and caching rules
 * live in lib/novel/epubCover.ts, shared with the series-cover route.
 */
export async function GET(req: NextRequest) {
  const url = decodeLnoriTarget(
    req.nextUrl.searchParams.get("b"),
    req.nextUrl.searchParams.get("url")
  );
  if (!url) return new Response("Invalid URL", { status: 400 });

  const cover = await extractEpubCover(url);
  if (!cover) return new Response("No cover found", { status: 404 });

  return new Response(new Uint8Array(cover.body), {
    headers: { ...COVER_HEADERS, "Content-Type": cover.type },
  });
}
