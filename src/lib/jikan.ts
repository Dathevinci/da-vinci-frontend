import type { Anime } from '@tutkli/jikan-ts';

// ═══════════════════════════════════════════════════════════
// HYBRID DATA FETCHING: Jikan for Data, AniList for HD Images
// ═══════════════════════════════════════════════════════════
const ANILIST_API = "https://graphql.anilist.co";

// Delay to avoid hitting Jikan rate limits (3/sec)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function anilistQuery(query: string, variables: Record<string, any> = {}, revalidate = 86400): Promise<any> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      // Identify the app. AniList's WAF/rate-limiter can reject requests with
      // no User-Agent from shared cloud IPs (e.g. Vercel functions), which
      // silently emptied the dashboard even while AniList itself was healthy.
      "User-Agent": "DaVinciTracker/1.0 (+https://dathevinci.vercel.app)",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AniList API error: ${res.status} — ${text}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`AniList GraphQL error: ${json.errors[0]?.message}`);
  return json.data;
}

/**
 * Takes a list of Jikan Anime objects, extracts their MAL IDs, and queries
 * AniList in a single batch to retrieve HD cover and banner images.
 */
export async function enhanceWithAniListImages(animeList: Anime[]): Promise<Anime[]> {
  if (!animeList || animeList.length === 0) return [];
  
  // Safely map and filter out undefined/null items before accessing mal_id
  const malIds = animeList.filter(a => a != null).map(a => a.mal_id).filter(Boolean);
  if (malIds.length === 0) return animeList;

  const query = `
    query ($malIds: [Int]) {
      Page(page: 1, perPage: 100) {
        media(idMal_in: $malIds, type: ANIME) {
          idMal
          status
          coverImage { extraLarge large medium }
          bannerImage
          nextAiringEpisode { airingAt timeUntilAiring episode }
          streamingEpisodes { title thumbnail url site }
        }
      }
    }
  `;

  try {
    const data = await anilistQuery(query, { malIds });
    const anilistMedia = data?.Page?.media || [];
    
    // Map of mal_id -> AniList Media Object
    const mediaMap = new Map();
    for (const media of anilistMedia) {
      if (media.idMal) mediaMap.set(media.idMal, media);
    }

    // Enhance original list
    return animeList.map(anime => {
      if (!anime) return anime;
      const match = mediaMap.get(anime.mal_id);
      if (match) {
        // Create deep copy to avoid mutating cache incorrectly
        const enhanced = JSON.parse(JSON.stringify(anime)) as Anime;
        
        // Ensure image objects exist
        if (!enhanced.images) {
          enhanced.images = { jpg: { image_url: "", small_image_url: "", large_image_url: "" }, webp: { image_url: "", small_image_url: "", large_image_url: "" } };
        }
        if (!enhanced.images.jpg) {
          enhanced.images.jpg = { image_url: "", small_image_url: "", large_image_url: "" };
        }
        if (!enhanced.images.webp) {
          enhanced.images.webp = { image_url: "", small_image_url: "", large_image_url: "" };
        }

        // Enhance main cover image
        if (match.coverImage) {
          enhanced.images.jpg.large_image_url = match.coverImage.extraLarge || match.coverImage.large || enhanced.images.jpg.large_image_url;
          enhanced.images.webp.large_image_url = match.coverImage.extraLarge || match.coverImage.large || enhanced.images.webp.large_image_url;
        }
        
        // Enhance banner image (Jikan stores this in trailer.images.maximum_image_url via our previous mapping, or we just put it there)
        if (match.bannerImage) {
          if (!enhanced.trailer) {
            enhanced.trailer = { youtube_id: "", url: "", embed_url: "", images: { image_url: "", small_image_url: undefined, medium_image_url: undefined, large_image_url: undefined, maximum_image_url: undefined } };
          }
          if (!enhanced.trailer.images) {
            enhanced.trailer.images = { image_url: "", small_image_url: undefined, medium_image_url: undefined, large_image_url: undefined, maximum_image_url: undefined };
          }
          enhanced.trailer.images.maximum_image_url = match.bannerImage;
          enhanced.trailer.images.large_image_url = match.bannerImage;
        }
        
        if (match.status) (enhanced as any)._anilistStatus = match.status;
        if (match.nextAiringEpisode) (enhanced as any)._nextAiringEpisode = match.nextAiringEpisode;
        if (match.streamingEpisodes) (enhanced as any)._streamingEpisodes = match.streamingEpisodes;

        return enhanced;
      }
      return anime;
    });
  } catch (err) {
    console.warn("Failed to fetch HD thumbnails from AniList, falling back to standard Jikan images:", err);
    return animeList; // Fallback to unenhanced list
  }
}

// ═══════════════════════════════════════
// Dashboard Data (Home Page)
// ═══════════════════════════════════════

export function getCurrentSeason(): { season: string; year: number; nextSeason: string; nextYear: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let season: string;
  let nextSeason: string;
  let nextYear = year;

  if (month >= 1 && month <= 3) {
    season = "WINTER"; nextSeason = "SPRING";
  } else if (month >= 4 && month <= 6) {
    season = "SPRING"; nextSeason = "SUMMER";
  } else if (month >= 7 && month <= 9) {
    season = "SUMMER"; nextSeason = "FALL";
  } else {
    season = "FALL"; nextSeason = "WINTER"; nextYear = year + 1;
  }
  return { season, year, nextSeason, nextYear };
}

export interface DashboardData {
  trending: { media: Anime[] };
  airingNow: { media: Anime[] };
  upcoming: { media: Anime[] };
  thisSeason: { media: Anime[] };
  nextSeason: { media: Anime[] };
  finished: { media: Anime[] };
  recentlyUpdated: { media: Anime[] };
  isFallback?: boolean;
}

const JIKAN_API = "https://api.jikan.moe/v4";

async function jikanFetch(endpoint: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${JIKAN_API}${endpoint}`, { next: { revalidate: 3600 } });
    if (res.status === 429) {
      console.warn(`Jikan API rate limit (429) on ${endpoint}. Retrying in 2000ms...`);
      await delay(2000);
      continue;
    }
    if (!res.ok) throw new Error(`Jikan API Error: ${res.status}`);
    return await res.json();
  }
  throw new Error(`Jikan API Error: 429 after ${retries} retries`);
}

// Fields pulled for each dashboard card. `idMal` is used as the app-wide
// mal_id so detail pages, episode lookups and streaming (all keyed on MAL ids)
// keep working while the dashboard itself is served by AniList.
const DASH_FRAGMENT = `
  id idMal
  title { romaji english native }
  coverImage { extraLarge large medium }
  bannerImage
  description(asHtml: false)
  format episodes duration status season seasonYear
  averageScore genres isAdult
  studios(isMain: true) { nodes { name } }
  trailer { id site thumbnail }
  siteUrl
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

// AniList media -> the Jikan-shaped Anime object the rest of the app expects.
function mapAniListMedia(media: any): Anime {
  if (!media) return media;
  const trailerId = media.trailer?.site === "youtube" ? media.trailer.id : null;
  // Prefer AniList's wide banner, then the trailer's HD (maxres) thumbnail,
  // then the highest-res cover — so the banner area is always sharp.
  const banner =
    media.bannerImage ||
    (trailerId ? `https://img.youtube.com/vi/${trailerId}/maxresdefault.jpg` : "") ||
    media.coverImage?.extraLarge ||
    media.coverImage?.large ||
    "";
  return {
    mal_id: media.idMal || media.id,
    url: media.idMal ? `https://myanimelist.net/anime/${media.idMal}` : (media.siteUrl || ""),
    images: {
      jpg: {
        image_url: media.coverImage?.large || "",
        large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || "",
        small_image_url: media.coverImage?.medium || "",
      },
      webp: { image_url: "", large_image_url: "", small_image_url: "" },
    },
    trailer: {
      youtube_id: trailerId,
      url: trailerId ? `https://www.youtube.com/watch?v=${trailerId}` : null,
      embed_url: trailerId ? `https://www.youtube.com/embed/${trailerId}` : null,
      images: { maximum_image_url: banner, image_url: media.trailer?.thumbnail || "", small_image_url: "", medium_image_url: "", large_image_url: banner },
    },
    title: media.title?.romaji || media.title?.english || "Unknown",
    title_english: media.title?.english,
    title_japanese: media.title?.native,
    type: media.format || "TV",
    episodes: media.episodes,
    status: media.status,
    duration: media.duration ? `${media.duration} min per ep` : "Unknown",
    score: media.averageScore ? media.averageScore / 10 : null,
    synopsis: (media.description || "").replace(/<[^>]*>?/gm, ""),
    season: media.season?.toLowerCase(),
    year: media.seasonYear,
    genres: (media.genres || []).map((g: string) => ({ mal_id: 0, type: "anime", name: g, url: "" })),
    studios: (media.studios?.nodes || []).map((s: any) => ({ mal_id: 0, type: "anime", name: s.name, url: "" })),
    _anilistStatus: media.status,
    _nextAiringEpisode: media.nextAiringEpisode,
    _malId: media.idMal,
  } as unknown as Anime;
}

// SFW filter to hide Hentai/18+ content but keep Ecchi
const isSafeMedia = (media: any): boolean => {
  if (!media) return false;
  if (media.isAdult === true) return false;
  if (media.genres && Array.isArray(media.genres) && media.genres.includes("Hentai")) return false;
  return true;
};

// AniList is the primary dashboard source — it's far more reliable for
// server-side (Vercel) calls than Jikan, which hard-rate-limits shared IPs.
// If AniList is unreachable this throws, and the caller falls back to Kitsu.
export async function getDashboardData(): Promise<DashboardData> {
  const { season, year, nextSeason, nextYear } = getCurrentSeason();
  const now = Math.floor(Date.now() / 1000);
  const threeDaysAgo = now - 3 * 24 * 60 * 60;

  const query = `
    query ($season: MediaSeason, $year: Int, $nextSeason: MediaSeason, $nextYear: Int, $threeDaysAgo: Int, $now: Int) {
      trending: Page(page: 1, perPage: 20) { media(sort: TRENDING_DESC, type: ANIME) { ${DASH_FRAGMENT} } }
      airingNow: Page(page: 1, perPage: 20) { media(status: RELEASING, sort: POPULARITY_DESC, type: ANIME) { ${DASH_FRAGMENT} } }
      thisSeason: Page(page: 1, perPage: 20) { media(season: $season, seasonYear: $year, sort: POPULARITY_DESC, type: ANIME) { ${DASH_FRAGMENT} } }
      nextSeason: Page(page: 1, perPage: 20) { media(season: $nextSeason, seasonYear: $nextYear, sort: POPULARITY_DESC, type: ANIME) { ${DASH_FRAGMENT} } }
      upcoming: Page(page: 1, perPage: 20) { media(status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME) { ${DASH_FRAGMENT} } }
      finished: Page(page: 1, perPage: 20) { media(status: FINISHED, sort: POPULARITY_DESC, type: ANIME, season: $season, seasonYear: $year) { ${DASH_FRAGMENT} } }
      recentlyUpdated: Page(page: 1, perPage: 20) { airingSchedules(airingAt_greater: $threeDaysAgo, airingAt_lesser: $now, sort: TIME_DESC) { media { ${DASH_FRAGMENT} } } }
    }
  `;

  const data = await anilistQuery(query, { season, year, nextSeason, nextYear, threeDaysAgo, now }, 300);
  const map = (arr: any[]) => (arr || []).filter(isSafeMedia).map(mapAniListMedia);

  const trending = map(data.trending?.media);
  const airingNow = map(data.airingNow?.media);
  if (!trending.length && !airingNow.length) {
    throw new Error("AniList dashboard returned no data");
  }

  return {
    trending: { media: trending },
    airingNow: { media: airingNow },
    upcoming: { media: map(data.upcoming?.media) },
    thisSeason: { media: map(data.thisSeason?.media) },
    nextSeason: { media: map(data.nextSeason?.media) },
    finished: { media: map(data.finished?.media) },
    recentlyUpdated: {
      media: (data.recentlyUpdated?.airingSchedules || [])
        .map((s: any) => s.media)
        .filter(isSafeMedia)
        .map(mapAniListMedia)
        .filter((a: Anime) => a && a.mal_id),
    },
    isFallback: false,
  };
}

export async function getAnimeDetails(id: number): Promise<Anime> {
  const res = await jikanFetch(`/anime/${id}`);
  if (!res || !res.data) throw new Error(`Jikan API Error: Missing data for anime ${id}`);
  const enhanced = await enhanceWithAniListImages([res.data]);
  return enhanced[0];
}

export async function getAnimeDetailsAniList(id: number): Promise<Anime> {
  // Try querying by AniList ID first, then by MAL ID
  const queryById = `query ($id: Int) { Media(id: $id, type: ANIME) { ${DASH_FRAGMENT} } }`;
  const queryByMal = `query ($id: Int) { Media(idMal: $id, type: ANIME) { ${DASH_FRAGMENT} } }`;
  
  try {
    const data = await anilistQuery(queryById, { id }, 300);
    if (data?.Media) return mapAniListMedia(data.Media);
  } catch (e) {
    // ignore and try by Mal
  }

  const data = await anilistQuery(queryByMal, { id }, 300);
  if (data?.Media) return mapAniListMedia(data.Media);
  
  throw new Error("Anime not found on AniList");
}

// Placeholder to ensure components don't crash
export async function getAnimeCharacters(id: number): Promise<string[]> {
  try {
    const res = await jikanFetch(`/anime/${id}/characters`);
    return (res.data || []).map((c: any) => c.character.name).slice(0, 4);
  } catch {
    return [];
  }
}

// Placeholder to ensure components don't crash
export async function getAnimeRecommendations(id: number): Promise<Anime[]> {
  return [];
}

export async function getAnimeTrailer(id: number): Promise<string | null> {
  return null;
}

// Search + Explore, served by AniList (same reliable source as the dashboard).
// Maps the app's filter names to AniList enums, and falls back to Kitsu.
export async function searchAnime(variables: any) {
  const gql = `
    query ($page: Int, $search: String, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $genre_in: [String], $sort: [MediaSort]) {
      Page(page: $page, perPage: 20) {
        pageInfo { total perPage currentPage lastPage hasNextPage }
        media(type: ANIME, search: $search, status: $status, season: $season, seasonYear: $seasonYear, format: $format, genre_in: $genre_in, sort: $sort) {
          ${DASH_FRAGMENT}
        }
      }
    }
  `;

  const v: any = { page: variables.page || 1 };
  if (variables.search) v.search = variables.search;

  if (variables.status) {
    const statusMap: Record<string, string> = {
      airing: "RELEASING", releasing: "RELEASING",
      upcoming: "NOT_YET_RELEASED", "not yet released": "NOT_YET_RELEASED",
      finished: "FINISHED", complete: "FINISHED",
      hiatus: "HIATUS", cancelled: "CANCELLED",
    };
    v.status = statusMap[String(variables.status).toLowerCase()] || String(variables.status).toUpperCase();
  }
  if (variables.season) {
    const seasonMap: Record<string, string> = { winter: "WINTER", spring: "SPRING", summer: "SUMMER", fall: "FALL" };
    v.season = seasonMap[String(variables.season).toLowerCase()] || String(variables.season).toUpperCase();
    v.seasonYear = variables.seasonYear || new Date().getFullYear();
  }
  if (variables.format) v.format = String(variables.format).toUpperCase().replace(/\s+/g, "_");
  if (variables.genre_in && variables.genre_in.length > 0) v.genre_in = variables.genre_in;

  const sortMap: Record<string, string> = {
    score: "SCORE_DESC", popularity: "POPULARITY_DESC", trending: "TRENDING_DESC",
    favourites: "FAVOURITES_DESC", favorites: "FAVOURITES_DESC",
    newest: "START_DATE_DESC", oldest: "START_DATE", updated: "UPDATED_AT_DESC",
  };
  v.sort = variables.sort?.length
    ? [sortMap[variables.sort[0]] || "POPULARITY_DESC"]
    : (variables.search ? ["SEARCH_MATCH"] : ["POPULARITY_DESC"]);

  const emptyPage = { media: [], pageInfo: { total: 0, perPage: 20, currentPage: 1, lastPage: 1, hasNextPage: false } };

  try {
    let data = await anilistQuery(gql, v, 300);

    // --- Fuzzy Matching / Spell Check Fallback ---
    // If AniList returns 0 results for a search query, it's likely a misspelling (e.g. "one pice").
    // We hit Kitsu's highly tolerant search engine to get the correct title, then re-query AniList.
    if (variables.search && (!data.Page?.media || data.Page.media.length === 0)) {
      try {
        const kitsuRes = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(variables.search)}&page[limit]=1`);
        if (kitsuRes.ok) {
          const kitsuData = await kitsuRes.json();
          if (kitsuData?.data && kitsuData.data.length > 0) {
            const correctedTitle = kitsuData.data[0].attributes.canonicalTitle;
            const correctedV = { ...v, search: correctedTitle };
            const correctedData = await anilistQuery(gql, correctedV, 300);
            if (correctedData.Page?.media && correctedData.Page.media.length > 0) {
              data = correctedData; // Use the successfully corrected search results
            }
          }
        }
      } catch (spellCheckErr) {
        console.warn("Fuzzy search fallback failed:", spellCheckErr);
      }
    }

    return {
      Page: {
        media: (data.Page?.media || []).filter(isSafeMedia).map(mapAniListMedia),
        pageInfo: data.Page?.pageInfo || emptyPage.pageInfo,
      },
    };
  } catch (err) {
    console.warn("AniList search failed, falling back to Kitsu:", err);
    try {
      const { searchAnimeKitsu } = await import("./kitsu");
      return await searchAnimeKitsu(variables);
    } catch (kitsuErr) {
      console.error("Kitsu search fallback also failed:", kitsuErr);
      return { Page: emptyPage };
    }
  }
}

export async function getCalendarData() {
  try {
    const now = Math.floor(Date.now() / 1000);
    // Fetch 3 days ago to 4 days from now to cover the current week's schedule
    const start = now - (3 * 24 * 60 * 60);
    const end = now + (4 * 24 * 60 * 60);

    const query = `
      query($start: Int, $end: Int) {
        Page(page: 1, perPage: 150) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_DESC) {
            airingAt
            episode
            media {
              ${DASH_FRAGMENT}
            }
          }
        }
      }
    `;

    const data = await anilistQuery(query, { start, end }, 300);
    if (!data || !data.Page || !data.Page.airingSchedules) return [];

    const mapped = data.Page.airingSchedules
      .filter((schedule: any) => isSafeMedia(schedule.media))
      .map((schedule: any) => {
        const anime = mapAniListMedia(schedule.media);
        if (anime) {
          (anime as any)._airingAt = schedule.airingAt;
          (anime as any)._nextAiringEpisode = { episode: schedule.episode, airingAt: schedule.airingAt };
        }
        return anime;
      })
      .filter((a: any) => a && a.mal_id);

    return mapped;
  } catch (err) {
    console.error("AniList API schedules failed:", err);
    return [];
  }
}

export async function fetchUserMAL(username: string) {
  const res = await fetch(`https://api.jikan.moe/v4/users/${username}/animelist`);
  const data = await res.json();
  return data.data;
}

export function getYouTubeId(trailer: any): string | null {
  if (trailer?.youtube_id) return trailer.youtube_id;
  if (trailer?.embed_url) {
    const match = trailer.embed_url.match(/embed\/([^?]+)/);
    if (match) return match[1];
  }
  if (trailer?.url) {
    const match = trailer.url.match(/v=([^&]+)/);
    if (match) return match[1];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// Consumet API — replaces dead local AniKoto streaming backend
// ═══════════════════════════════════════════════════════════

// We use the AniKoto API directly
const ANIKOTO_API = "https://anikototvapi.vercel.app/api";

export interface ConsumetEpisode {
  id: string;
  number: number;
  title: string | null;
  description: string | null;
  image: string | null;
  url?: string;
  createdAt?: string | number | null;
}

export interface ConsumetServer {
  name: string;
  url: string;
}

export interface ConsumetStream {
  url: string;
  quality: string;
  isM3U8: boolean;
  isEmbed?: boolean;
}

export interface ConsumetStreamResult {
  headers?: Record<string, string>;
  sources: ConsumetStream[];
  subtitles?: { url: string; lang: string }[];
}

// Search for anime on AniKoto
export async function searchConsumetAnime(query: string): Promise<any[]> {
  try {
    const res = await fetch(`${ANIKOTO_API}/search?keyword=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("AniKoto search failed");
    const data = await res.json();
    if (data.success && data.results && data.results.data) {
      let results = data.results.data;
      
      // Basic Sorensen-Dice similarity
      const getSimilarity = (s1: string, s2: string) => {
        const getBigrams = (str: string) => {
          const bigrams = [];
          const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (let i = 0; i < s.length - 1; i++) bigrams.push(s.substring(i, i + 2));
          return bigrams;
        };
        const b1 = getBigrams(s1);
        const b2 = getBigrams(s2);
        if (b1.length === 0 && b2.length === 0) return 1;
        if (b1.length === 0 || b2.length === 0) return 0;
        let intersection = 0;
        const b2Copy = [...b2];
        for (const b of b1) {
          const idx = b2Copy.indexOf(b);
          if (idx !== -1) {
            intersection++;
            b2Copy.splice(idx, 1);
          }
        }
        return (2.0 * intersection) / (b1.length + b2.length);
      };

      // Filter out garbage results that don't match the query well enough (> 0.40)
      results = results.filter((item: any) => {
        const sim1 = getSimilarity(query, item.title || "");
        const sim2 = getSimilarity(query, item.japaneseTitle || "");
        return Math.max(sim1, sim2) > 0.4;
      });

      // Try to find an exact title match or a TV show first to avoid picking movies/specials (e.g. One Piece)
      results = results.sort((a: any, b: any) => {
        const aExact = a.title?.toLowerCase() === query.toLowerCase();
        const bExact = b.title?.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        const aTV = a.type === "TV" || a.type === "TV Series";
        const bTV = b.type === "TV" || b.type === "TV Series";
        if (aTV && !bTV) return -1;
        if (!aTV && bTV) return 1;
        
        return 0;
      });

      return results.map((item: any) => ({
        id: item.animeId.toString(),
        title: item.title,
        image: item.images?.jpg || "",
        type: item.type
      }));
    }
    return [];
  } catch (err) {
    console.error("AniKoto search error:", err);
    return [];
  }
}

// Fetch episode list for an anime from AniKoto
export async function getConsumetEpisodes(animeId: string): Promise<ConsumetEpisode[]> {
  try {
    const res = await fetch(`${ANIKOTO_API}/episodes/${encodeURIComponent(animeId)}`);
    if (!res.ok) throw new Error("AniKoto episodes failed");
    const data = await res.json();
    if (data.success && data.results && data.results.episodes) {
      return data.results.episodes.map((ep: any) => ({
        id: ep.server_ids, // Use server_ids as the ID so WatchOverlay can fetch streams
        number: ep.episode_no || ep.number,
        title: ep.title || null,
        description: null,
        image: null,
        url: ep.href,
        createdAt: ep.timestamp ? parseInt(ep.timestamp) * 1000 : null,
      }));
    }
    return [];
  } catch (err) {
    console.error("AniKoto episodes error:", err);
    return [];
  }
}

// Fetch streaming sources for an episode from AniKoto
export async function getConsumetStreamUrl(episodeId: string, type: "sub" | "dub" = "sub"): Promise<ConsumetStreamResult | null> {
  // episodeId here is actually the server_ids string from getConsumetEpisodes
  try {
    // 1. Fetch servers to get the link_id
    const serversRes = await fetch(`${ANIKOTO_API}/servers?ids=${encodeURIComponent(episodeId)}`);
    if (!serversRes.ok) throw new Error("AniKoto servers failed");
    const serversData = await serversRes.json();
    
    if (!serversData.success || !serversData.results || serversData.results.length === 0) {
      return null;
    }
    
    // Prioritize ad-free native M3U8 servers over embed servers
    let targetServer = serversData.results.find((s: any) => 
      s.type === type && s.name && 
      (s.name.toLowerCase().includes("vidstreaming") || 
       s.name.toLowerCase().includes("gogo") || 
       s.name.toLowerCase().includes("hd-1"))
    );
    if (!targetServer) {
      targetServer = serversData.results.find((s: any) => s.type === type);
    }
    if (!targetServer) targetServer = serversData.results[0];
    
    // 2. Fetch the stream using link_id
    const streamRes = await fetch(`${ANIKOTO_API}/stream?id=${encodeURIComponent(targetServer.link_id)}`);
    if (!streamRes.ok) throw new Error("AniKoto stream failed");
    const streamData = await streamRes.json();
    
    if (!streamData.success || !streamData.results) {
      return null;
    }
    const isUrlEmbed = streamData.results.url.includes("vidtube") || streamData.results.url.includes("megaplay") || streamData.results.url.includes("vidwish") || streamData.results.url.includes("embed");
    
    return {
      headers: {},
      sources: [
        {
          url: streamData.results.url,
          quality: "default",
          isM3U8: streamData.results.url.includes(".m3u8"),
          isEmbed: isUrlEmbed
        }
      ],
      subtitles: streamData.results.subtitles || streamData.results.tracks || []
    };
  } catch (err) {
    console.error("AniKoto stream error:", err);
    return null;
  }
}

// Fetch available servers for an episode
export async function getConsumetServers(episodeId: string): Promise<ConsumetServer[]> {
  try {
    const res = await fetch(`${ANIKOTO_API}/servers?ids=${encodeURIComponent(episodeId)}`);
    if (!res.ok) throw new Error("AniKoto servers failed");
    const data = await res.json();
    if (data.success && data.results) {
      return data.results.map((s: any) => ({
        name: s.name || s.type,
        url: s.link_id
      }));
    }
    return [];
  } catch (err) {
    console.error("AniKoto servers error:", err);
    return [];
  }
}

// ═══════════════════════════════════════
// Legacy compatibility wrappers
// These maintain the old function signatures so existing
// components continue to work during the transition
// ═══════════════════════════════════════

export async function getAnimeEpisodes(animeId: number): Promise<{ episodes: any[]; totalEpisodes: number }> {
  return { episodes: [], totalEpisodes: 0 };
}

export async function getEpisodeServers(serverIds: string): Promise<any[]> {
  return [];
}

export async function getStreamUrl(linkId: string): Promise<any> {
  return { linkId, url: null, skipData: null };
}

export async function searchAniKoto(keyword: string) {
  return [];
}

// The old mapKuhiToJikan export
export function mapKuhiToJikan(media: any) {
  return media;
}
