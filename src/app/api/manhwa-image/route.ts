import { NextRequest, NextResponse } from "next/server";
import {
  isProxyableManhwaHost,
  manhwaSourceReferer,
  canResizeViaWsrv,
  photonResizeUrl,
} from "@/lib/manhwa/coverProxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  // Validate the URL and check it against the allowlist.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  // Only http(s) — the URL parser happily accepts file:, data: and friends,
  // and this handler turns whatever it is handed into a fetch.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  /**
   * The allowlist lives in lib/manhwa/coverProxy alongside the wrapper that
   * decides which covers get sent here. They used to keep separate copies and
   * had already drifted; a host this route accepts but the wrapper skips is an
   * unproxied hotlink, and the reverse is a 403 from our own proxy.
   */
  if (!isProxyableManhwaHost(parsed.hostname)) {
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

    /**
     * The newly added sources bring their own Referer requirements, keyed by
     * the CDN host rather than the site's domain because they rarely match.
     * MangaPill's CDN is the one that genuinely enforces it — it 403s both a
     * missing Referer and a foreign one — so a page from it is blank without
     * this line. Flame's and Rizz's hosts do not currently check, and get the
     * right value anyway.
     */
    const sourceReferer = manhwaSourceReferer(parsed.hostname);
    if (sourceReferer) referer = sourceReferer;

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
    } else if (!canResizeViaWsrv(parsed.hostname)) {
      /**
       * wsrv refuses this host, so resize it through Photon instead of giving
       * up and shipping the original.
       *
       * Skipping the resize entirely is what made manhwa mode lag: these
       * covers average close to a megabyte against AsuraScans' 63KB, and a
       * deep explore page is mostly them. Photon takes the hosts wsrv blocks
       * and brings them back to roughly 67KB. See photonResizeUrl for the
       * measurements and for why nothing else worked.
       *
       * Still falls back to the direct fetch if Photon is unavailable or
       * unhappy, so a cover never fails to load because a resizer had a bad
       * day — the same rule the wsrv path follows.
       */
      const photon = photonResizeUrl(url, w, h);
      const r = photon ? await fetch(photon, { headers: { "User-Agent": UA } }).catch(() => null) : null;
      res = r && r.ok ? r : await direct();
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
