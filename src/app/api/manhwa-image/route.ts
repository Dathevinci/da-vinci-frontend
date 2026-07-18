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
  ];
  const isAllowed =
    allowedHosts.includes(parsed.hostname) ||
    parsed.hostname.endsWith(".mangadex.network") ||
    parsed.hostname === "uploads.mangadex.org";

  if (!isAllowed) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        // MangaDex requires this Referer to serve cover images
        Referer: "https://mangadex.org/",
        "User-Agent":
          "Mozilla/5.0 (compatible; DaVinci/1.0; +https://davinci.app)",
      },
    });

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
