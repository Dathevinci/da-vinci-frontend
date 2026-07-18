/**
 * AniKoto streaming library
 * Deployed API: https://anikoto-api-lemon.vercel.app
 * Source:       https://github.com/milkaunmutilated455/AniKotoAPI
 *
 * Verified endpoint flow (from live testing):
 *   1. GET /api/search?keyword=<q>
 *        → { results: { data: [{ animeId, slug, title, poster, sub, dub, type }] } }
 *        Note: slug format is "<base-slug>/ep-1" — strip the /ep-N suffix to get base slug
 *
 *   2. GET /api/episodes-ajax/<animeId>
 *        → { results: { episodes: [{ id, episode_no, title, has_sub, has_dub, server_ids }] } }
 *        Note: server_ids is a base64-encoded encrypted string per episode
 *
 *   3. GET /api/servers?ids=<server_ids>
 *        → { results: [{ type, ep_id, link_id, name }] }
 *        type = "sub" | "dub" | "raw"
 *
 *   4. GET /api/stream?id=<link_id>
 *        → { results: { linkId, url, skipData } }
 */

export const ANIKOTO_API =
  process.env.ANIKOTO_API_URL || "https://anikoto-api-lemon.vercel.app";

export interface AnikotoEpisode {
  id: string; 
  number: number;
  title: string | null;
  isFiller?: boolean;
  image?: string | null;
  description?: string | null;
  createdAt?: string;
}

export interface AnikotoStream {
  url: string;
  quality: string;
  isM3U8: boolean;
  isEmbed?: boolean;
}

export interface AnikotoStreamResult {
  sources: AnikotoStream[];
  subtitles?: { url: string; lang: string }[];
  headers?: Record<string, string>;
}

// ─── Client-side Stream Cache ─────────────────────────────────────────────────
// Caches resolved stream URLs in memory so switching back to an already-played
// episode is instant instead of making 3 API round-trips again.
const _streamCache = new Map<string, { result: AnikotoStreamResult; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedStream(key: string): AnikotoStreamResult | null {
  const entry = _streamCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _streamCache.delete(key); return null; }
  return entry.result;
}
function setCachedStream(key: string, result: AnikotoStreamResult) {
  _streamCache.set(key, { result, ts: Date.now() });
}

// Sørensen-Dice similarity coefficient
function getSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  if (s1 === s2) return 1;
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  const set1 = getBigrams(s1);
  const set2 = getBigrams(s2);
  let intersection = 0;
  for (const bigram of Array.from(set1)) {
    if (set2.has(bigram)) intersection++;
  }
  return (2.0 * intersection) / (set1.size + set2.size);
}

export async function searchAnikotoAnime(
  query: string,
  animeTitle?: string,
  animeEnglishTitle?: string
): Promise<any[]> {
  try {
    const url = `${ANIKOTO_API}/api/search?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`AniKotoAPI search failed: ${res.status}`);
    const data = await res.json();

    // Real response: { success, results: { totalPages, data: [{ animeId, slug, title, poster, sub, dub, type }] } }
    // slug format: "<base-slug>/ep-1" — strip the episode suffix to get the base slug
    let items: any[] = [];
    if (data?.results?.data && Array.isArray(data.results.data)) {
      items = data.results.data;
    } else if (Array.isArray(data?.results)) {
      items = data.results;
    }

    if (items.length === 0) return [];

    // Exact-match then similarity sort
    if (animeTitle || animeEnglishTitle) {
      const at = animeTitle?.toLowerCase() ?? "";
      const aet = animeEnglishTitle?.toLowerCase() ?? "";

      const exactMatch = items.find((r) => {
        const rt = (r.title ?? r.name ?? "").toLowerCase();
        return rt && (rt === at || rt === aet);
      });

      if (exactMatch) {
        items = [exactMatch, ...items.filter((r) => r !== exactMatch)];
      } else {
        items = items.sort((a, b) => {
          const nameA = a.title ?? a.name ?? "";
          const nameB = b.title ?? b.name ?? "";
          const scoreA = Math.max(
            getSimilarity(nameA, animeTitle ?? ""),
            getSimilarity(nameA, animeEnglishTitle ?? "")
          );
          const scoreB = Math.max(
            getSimilarity(nameB, animeTitle ?? ""),
            getSimilarity(nameB, animeEnglishTitle ?? "")
          );
          return scoreB - scoreA;
        });
      }
    }

    // Normalise result — id = animeId (numeric), baseSlug = slug without /ep-N suffix
    return items.map((item) => {
      const rawSlug: string = item.slug ?? "";
      const baseSlug = rawSlug.includes("/ep-") ? rawSlug.split("/ep-")[0] : rawSlug;
      return {
        id: String(item.animeId ?? item.id ?? ""),
        slug: baseSlug,
        title: item.title ?? item.name ?? "",
        image: item.poster ?? item.image ?? "",
        type: item.type ?? "UNKNOWN",
        subCount: item.sub ?? null,
        dubCount: item.dub ?? null,
      };
    });
  } catch (err) {
    console.error("AniKotoAPI search error:", err);
    return [];
  }
}

/**
 * Fetch episodes for an anime by its numeric animeId.
 * Uses /api/episodes-ajax/:animeId which returns the real episode list with server_ids.
 */
export async function getAnikotoEpisodes(
  animeId: string
): Promise<AnikotoEpisode[]> {
  try {
    const url = `${ANIKOTO_API}/api/episodes-ajax/${encodeURIComponent(animeId)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`AniKotoAPI episodes-ajax failed: ${res.status}`);
    const data = await res.json();

    // Real response: { success, results: { animeId, totalEpisodes, episodes: [{ id, episode_no, title, has_sub, has_dub, server_ids }] } }
    let eps: any[] = [];
    if (data?.results?.episodes && Array.isArray(data.results.episodes)) {
      eps = data.results.episodes;
    } else if (Array.isArray(data?.results)) {
      eps = data.results;
    }

    return eps.map((ep: any) => ({
      id: String(ep.id ?? ep.episodeId ?? ep.episode_no),   // numeric episode row id
      number: ep.episode_no ?? ep.number ?? ep.episodeNo ?? 1,
      title: ep.title ?? ep.name ?? null,
      isFiller: ep.isFiller ?? false,
      image: ep.thumbnail ?? ep.image ?? null,
      description: ep.description ?? null,
      createdAt: ep.timestamp ? new Date(Number(ep.timestamp) * 1000).toISOString() : undefined,
      // Extra field needed for stream resolution:
      serverIds: ep.server_ids ?? null,
      hasSub: ep.has_sub ?? true,
      hasDub: ep.has_dub ?? false,
    }));
  } catch (err) {
    console.error("AniKotoAPI episodes error:", err);
    return [];
  }
}

/**
 * Resolve a streamable URL for a given episode.
 *
 * Flow (verified against live API):
 *   1. getAnikotoEpisodes(animeId)           → find the episode row, get server_ids
 *   2. GET /api/servers?ids=<server_ids>     → list of {type, link_id, name} per server
 *   3. Filter to requested type (sub/dub), pick HD-1 > any
 *   4. GET /api/stream?id=<link_id>          → { results: { url } }
 *
 * @param animeId  - numeric animeId from search result (e.g. "2095")
 * @param episodeNo - 1-based episode number
 * @param type      - "sub" (default) or "dub"
 */
export async function getAnikotoStreamUrl(
  animeId: string,
  episodeNo: number,
  type: "sub" | "dub" = "sub"
): Promise<AnikotoStreamResult | null> {
  try {
    // 1. Get episodes list to find the target episode's server_ids
    const episodes = await getAnikotoEpisodes(animeId);
    if (!episodes || episodes.length === 0) return null;

    const episode =
      episodes.find((e) => e.number === episodeNo) ?? episodes[episodeNo - 1];
    if (!episode) return null;

    const serverIds = (episode as any).serverIds;
    if (!serverIds) return null;

    // 2. Fetch the server list using the episode's server_ids token
    const serversUrl = `${ANIKOTO_API}/api/servers?ids=${encodeURIComponent(serverIds)}`;
    const serversRes = await fetch(serversUrl, { signal: AbortSignal.timeout(10000) });
    if (!serversRes.ok) throw new Error(`AniKotoAPI servers failed: ${serversRes.status}`);
    const serversData = await serversRes.json();

    // Real response: { success, results: [{ type, ep_id, link_id, name }] }
    // type = "sub" | "dub" | "raw"
    const allServers: any[] = Array.isArray(serversData?.results) ? serversData.results : [];
    if (allServers.length === 0) return null;

    // Filter by requested type, fall back to the other type
    let matched = allServers.filter((s) => s.type === type);
    if (matched.length === 0) {
      matched = allServers.filter((s) => s.type === (type === "sub" ? "dub" : "sub"));
    }
    if (matched.length === 0) {
      // Last resort: use any server (e.g. "raw")
      matched = allServers;
    }

    // Prefer HD-1 > HD-2 > Vidstream-2 > first available
    const server =
      matched.find((s) => s.name === "HD-1") ??
      matched.find((s) => s.name === "HD-2") ??
      matched.find((s) => s.name?.startsWith("Vidstream")) ??
      matched[0];

    if (!server?.link_id) return null;

    // 3. Resolve the link_id to an actual stream URL
    const streamUrl = `${ANIKOTO_API}/api/stream?id=${encodeURIComponent(server.link_id)}`;
    const streamRes = await fetch(streamUrl, { signal: AbortSignal.timeout(12000) });
    if (!streamRes.ok) throw new Error(`AniKotoAPI stream failed: ${streamRes.status}`);
    const streamData = await streamRes.json();

    // Real response: { success, results: { linkId, url, skipData } }
    const resolvedUrl: string | undefined =
      streamData?.results?.url ?? streamData?.results?.link;

    if (!resolvedUrl) return null;

    const isM3U8 = resolvedUrl.includes(".m3u8") || resolvedUrl.includes("/hls/");

    return {
      sources: [
        {
          url: resolvedUrl,
          quality: "auto",
          isM3U8,
          isEmbed: !isM3U8,
        },
      ],
      subtitles: [],
      headers: {
        Referer: "https://anikototv.to/",
        Origin: "https://anikototv.to",
      },
    };
  } catch (err) {
    console.error("AniKotoAPI stream error:", err);
    return null;
  }
}

/**
 * FAST stream resolver — calls the local Next.js /api/anikoto-stream proxy.
 *
 * The proxy makes the servers → stream calls server-to-server
 * so the browser only makes ONE round-trip instead of two cold-starting ones.
 *
 * @param animeId   - numeric animeId string (used as cache key)
 * @param episodeNo - 1-based episode number (used as cache key)
 * @param serverIds - the server_ids token from the already-loaded episode object
 * @param type      - "sub" | "dub"
 */
export async function getAnikotoStreamUrlFast(
  animeId: string,
  episodeNo: number,
  serverIds: string,
  type: "sub" | "dub" = "sub"
): Promise<AnikotoStreamResult | null> {
  const cacheKey = `${animeId}:${episodeNo}:${type}`;
  const cached = getCachedStream(cacheKey);
  if (cached) return cached; // instant on replay — zero API calls

  try {
    // Hit the local Next.js proxy — ONE browser round-trip instead of two cold Vercel calls
    const proxyUrl = `/api/anikoto-stream?animeId=${encodeURIComponent(animeId)}&ep=${episodeNo}&type=${type}&serverIds=${encodeURIComponent(serverIds)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });

    if (!res.ok) {
      // Fallback: call the external API directly if proxy fails
      console.warn("Proxy failed, falling back to direct API");
      return getAnikotoStreamUrl(animeId, episodeNo, type);
    }

    const data = await res.json();
    if (!data?.url) return null;

    const result: AnikotoStreamResult = {
      sources: [{ url: data.url, quality: "auto", isM3U8: data.isM3U8 ?? false, isEmbed: !data.isM3U8 }],
      subtitles: [],
      headers: { Referer: "https://anikototv.to/", Origin: "https://anikototv.to" },
    };
    setCachedStream(cacheKey, result);
    return result;
  } catch (err) {
    console.error("AniKotoAPI fast-stream error:", err);
    // Fallback to direct API call
    return getAnikotoStreamUrl(animeId, episodeNo, type);
  }
}
