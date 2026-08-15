import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxies readnovelfull cover images (their CDN can referer-gate hotlinks).
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url param", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const host = parsed.hostname;
  const allowed =
    host === "novelfull.net" || host.endsWith(".novelfull.net") ||
    host === "img.readnovelfull.com" || host.endsWith(".readnovelfull.com") ||
    host === "www.fanmtl.com" || host.endsWith(".fanmtl.com") ||
    host === "lightnovelworld.org" || host.endsWith(".lightnovelworld.org") ||
    host === "allnovelupdates.com" || host.endsWith(".allnovelupdates.com") ||
    host === "freewebnovel.com" || host.endsWith(".freewebnovel.com") ||
    // RoyalRoad serves every cover from its own CDN. Without this the proxy
    // answered 403 "Domain not allowed" for the entire source — which is what
    // a wall of broken novel thumbnails looks like from the outside.
    host === "royalroadcdn.com" || host.endsWith(".royalroadcdn.com") ||
    host === "royalroad.com" || host.endsWith(".royalroad.com") ||
    // DOT BOUNDARIES matter on suffix checks: a bare endsWith("kitsu.app")
    // also matches "evilkitsu.app" — any attacker-registered domain ending in
    // the string would ride the proxy.
    host === "anilist.co" || host.endsWith(".anilist.co") ||
    host === "kitsu.io" || host.endsWith(".kitsu.io") ||
    // Kitsu's current image CDN — posters moved off media.kitsu.io.
    host === "kitsu.app" || host.endsWith(".kitsu.app");
  if (!allowed) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const referer = host.includes("royalroad")
    ? "https://www.royalroad.com/"
    : host.includes("novelfull")
    ? "https://novelfull.net/"
    : host.includes("fanmtl")
    ? "https://www.fanmtl.com/"
    : host.includes("lightnovelworld")
    ? "https://lightnovelworld.org/"
    : host.includes("allnovelupdates")
    ? "https://allnovelupdates.com/"
    : "https://readnovelfull.com/";

  // Every source serves low-res covers (novelfull ~180-220px, readnovelfull
  // ~266px), so upscale + sharpen them ALL to a consistent crisp 480x720 webp
  // via images.weserv.nl (it can fetch all our sources server-side). `sharp`
  // (unsharp mask) restores edge definition the plain upscale would leave soft.
  // Fall back to a direct fetch (with the source's referer) if weserv is
  // unavailable, so covers never break.
  const targetUrl: string = url;
  async function upstream(): Promise<Response | null> {
    const bare = targetUrl.replace(/^https?:\/\//, "");
    const weserv = `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=480&h=720&fit=cover&output=webp&q=85&sharp=3`;
    const r = await fetch(weserv, { headers: { "User-Agent": UA } }).catch(() => null);
    if (r && r.ok) return r;
    return fetch(targetUrl, { headers: { Referer: referer, "User-Agent": UA } }).catch(() => null);
  }

  try {
    const res = await upstream();
    if (!res || !res.ok) return new NextResponse(`Upstream error ${res?.status ?? 502}`, { status: res?.status ?? 502 });
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("Novel image proxy error:", e);
    return new NextResponse("Proxy error", { status: 502 });
  }
}
