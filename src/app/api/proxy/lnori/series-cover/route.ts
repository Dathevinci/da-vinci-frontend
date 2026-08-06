import { NextRequest } from "next/server";
import { firstVolumeFile } from "@/lib/novel/Lnori";
import { extractEpubCover, COVER_HEADERS } from "@/lib/novel/epubCover";

export const runtime = "nodejs";

/**
 * A series thumbnail, borrowed from volume one's own cover.
 *
 * The catalogue listing has no artwork of its own — it is a folder index — so
 * the browse grid had nothing to show for any title AniList could not match,
 * which was most of them. Reaching into the first volume gives the real
 * published cover, which is better than the AniList match would have been
 * anyway.
 *
 * Two requests deep (series page, then a few MB of the book) and both are
 * cached, so this stays cheap once warm. Cards request it lazily, so only the
 * rows someone actually scrolls to pay for it.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || slug.includes("/") || slug.includes("..")) {
    return new Response("Invalid slug", { status: 400 });
  }

  const file = await firstVolumeFile(slug);
  if (!file) return new Response("No volumes", { status: 404 });

  const cover = await extractEpubCover(file);
  if (!cover) return new Response("No cover found", { status: 404 });

  return new Response(new Uint8Array(cover.body), {
    headers: { ...COVER_HEADERS, "Content-Type": cover.type },
  });
}
