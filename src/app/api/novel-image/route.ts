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

  if (parsed.hostname !== "img.readnovelfull.com" && !parsed.hostname.endsWith(".readnovelfull.com")) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        Referer: "https://readnovelfull.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return new NextResponse(`Upstream error ${res.status}`, { status: res.status });
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
