import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  // Validate URL and only allow MangaDex domains
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const allowedHosts = [
    "uploads.mangadex.org",
    "cmdxd98sb0x3yprd.mangadex.network",
    "cdn.asurascans.com",
  ];
  const isAllowed =
    allowedHosts.includes(parsed.hostname) ||
    parsed.hostname.endsWith(".mangadex.network") ||
    parsed.hostname === "uploads.mangadex.org" ||
    parsed.hostname.includes("manganato.com") ||
    parsed.hostname.includes("mkklcdn") ||
    parsed.hostname.includes("mangaread.org");

  if (!isAllowed) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  try {
    const isAsura = parsed.hostname === "cdn.asurascans.com";
    const isManganato = parsed.hostname.includes("manganato") || parsed.hostname.includes("mkklcdn");
    const isMangaRead = parsed.hostname.includes("mangaread.org");

    let referer = "https://mangadex.org/";
    if (isAsura) referer = "https://asuracomic.net/";
    if (isManganato) referer = "https://manganato.com/";
    if (isMangaRead) referer = "https://www.mangaread.org/";

    const UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    const direct = () => fetch(url, { headers: { Referer: referer, "User-Agent": UA } });

    /**
     * COVERS GET RESIZED. READER PAGES ASK FOR `full=1` AND DO NOT.
     *
     * Every manhwa cover in the app came through here at its ORIGINAL
     * resolution — a source-sized JPEG per card, buffered whole into memory by
     * this function and then handed to the browser to shrink into a 160px
     * slot. A grid of them is tens of megabytes and one serverless invocation
     * each, which is why the manhwa side dragged while anime (straight off the
     * MAL/AniList CDN, no proxy at all) and novels (already routed through
     * wsrv.nl at 480x720) did not. next.config sets images.unoptimized, so
     * nothing else in the pipeline was going to shrink these either.
     *
     * Resizing is the DEFAULT and full size is the opt-out, which is the way
     * round that fails safe: there are a dozen cover call sites and only two
     * reader ones, so a site that forgets to say anything gets a fast thumbnail
     * rather than silently staying slow. The reader passes `full=1` because
     * shrinking the art someone is trying to read would be the wrong kind of
     * fast.
     *
     * Falls back to the direct fetch when wsrv is unavailable or refuses the
     * host, so a cover never fails to load because the resizer had a bad day.
     */
    const wantsFull = req.nextUrl.searchParams.get("full") === "1";
    const w = Number(req.nextUrl.searchParams.get("w")) || 480;
    const h = Number(req.nextUrl.searchParams.get("h")) || 720;

    let res: Response;
    if (wantsFull) {
      res = await direct();
    } else {
      const bare = url.replace(/^https?:\/\//, "");
      const weserv = `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=${w}&h=${h}&fit=cover&output=webp&q=82`;
      const r = await fetch(weserv, { headers: { "User-Agent": UA } }).catch(() => null);
      res = r && r.ok ? r : await direct();
    }

    if (!res.ok) {
      console.error(`Proxy upstream error: ${res.status} for ${url}`);
      return new NextResponse(`Upstream error ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache aggressively in the browser — covers don't change often
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("Image proxy fetch error:", e);
    return new NextResponse("Proxy error", { status: 502 });
  }
}
