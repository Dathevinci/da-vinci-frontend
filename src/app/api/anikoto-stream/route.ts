import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/anikoto-stream
 *
 * Server-side aggregator: collapses the 2-step AniKotoAPI flow
 * (servers → stream) into a single browser round-trip.
 *
 * This eliminates Vercel cold-start chaining — instead of:
 *   Browser → cold Vercel (servers) → Browser → cold Vercel (stream) → Browser
 * we do:
 *   Browser → Next.js edge/server → Vercel (servers + stream, server-to-server) → Browser
 *
 * Query params:
 *   serverIds  - base64 server_ids token from the episode object
 *   animeId    - numeric anime ID (for cache key)
 *   ep         - episode number (for cache key)
 *   type       - "sub" | "dub" (default: "sub")
 */

const ANIKOTO_API =
  process.env.ANIKOTO_API_URL || "https://anikoto-api-lemon.vercel.app";

// Simple server-side in-memory cache (survives across requests in same instance)
const cache = new Map<string, { url: string; isM3U8: boolean; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const serverIds = searchParams.get("serverIds");
  const animeId = searchParams.get("animeId") || "unknown";
  const ep = searchParams.get("ep") || "1";
  const type = (searchParams.get("type") || "sub") as "sub" | "dub";

  if (!serverIds) {
    return NextResponse.json({ error: "serverIds is required" }, { status: 400 });
  }

  // Check cache first
  const cacheKey = `${animeId}:${ep}:${type}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ url: cached.url, isM3U8: cached.isM3U8, cached: true });
  }

  try {
    // Step 1: Get servers (server-to-server — no browser cold start penalty)
    const serversRes = await fetch(
      `${ANIKOTO_API}/api/servers?ids=${encodeURIComponent(serverIds)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!serversRes.ok) {
      return NextResponse.json({ error: `Servers fetch failed: ${serversRes.status}` }, { status: 502 });
    }
    const serversData = await serversRes.json();
    const allServers: any[] = Array.isArray(serversData?.results) ? serversData.results : [];

    if (allServers.length === 0) {
      return NextResponse.json({ error: "No servers available for this episode" }, { status: 404 });
    }

    // Filter by type, fall back gracefully
    let matched = allServers.filter((s) => s.type === type);
    if (!matched.length) matched = allServers.filter((s) => s.type === (type === "sub" ? "dub" : "sub"));
    if (!matched.length) matched = allServers;

    const server =
      matched.find((s) => s.name === "HD-1") ??
      matched.find((s) => s.name === "HD-2") ??
      matched.find((s) => s.name?.startsWith("Vidstream")) ??
      matched[0];

    if (!server?.link_id) {
      return NextResponse.json({ error: "No usable server found" }, { status: 404 });
    }

    // Step 2: Resolve stream URL (chained immediately — no browser round-trip in between)
    const streamRes = await fetch(
      `${ANIKOTO_API}/api/stream?id=${encodeURIComponent(server.link_id)}`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (!streamRes.ok) {
      return NextResponse.json({ error: `Stream resolve failed: ${streamRes.status}` }, { status: 502 });
    }
    const streamData = await streamRes.json();
    const resolvedUrl: string | undefined = streamData?.results?.url ?? streamData?.results?.link;

    if (!resolvedUrl) {
      return NextResponse.json({ error: "Stream URL could not be resolved" }, { status: 404 });
    }

    const isM3U8 = resolvedUrl.includes(".m3u8") || resolvedUrl.includes("/hls/");

    // Cache the result
    cache.set(cacheKey, { url: resolvedUrl, isM3U8, ts: Date.now() });

    return NextResponse.json({
      url: resolvedUrl,
      isM3U8,
      serverName: server.name,
      serverType: server.type,
      cached: false,
    });
  } catch (err: any) {
    console.error("[anikoto-stream]", err.message);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
