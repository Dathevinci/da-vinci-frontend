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
    host === "www.fanmtl.com" || host.endsWith(".fanmtl.com");
  if (!allowed) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const referer = host.includes("novelfull") ? "https://novelfull.net/" : host.includes("fanmtl") ? "https://www.fanmtl.com/" : "https://readnovelfull.com/";

  // novelfull.net only serves small (~200px) thumbnails, which look mushy blown
  // up to card size. Upscale + sharpen them to a crisp 480x720 webp via
  // images.weserv.nl (its covers aren't referer-gated, so weserv can fetch them).
  // Fall back to the raw cover if weserv is unavailable. readnovelfull/fanmtl
  // already serve larger covers and are referer-gated, so those stay direct.
  async function upstream(): Promise<Response | null> {
    if (host.includes("novelfull")) {
      const bare = url.replace(/^https?:\/\//, "");
      // Source covers are only ~220px, so upscaling alone stays soft — `sharp`
      // (unsharp mask) restores edge definition and makes them look crisp.
      const weserv = `https://images.weserv.nl/?url=${encodeURIComponent(bare)}&w=480&h=720&fit=cover&output=webp&q=85&sharp=3`;
      const r = await fetch(weserv, { headers: { "User-Agent": UA } }).catch(() => null);
      if (r && r.ok) return r;
    }
    return fetch(url, { headers: { Referer: referer, "User-Agent": UA } }).catch(() => null);
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
