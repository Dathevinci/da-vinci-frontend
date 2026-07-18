import type { Anime } from "@tutkli/jikan-ts";
import { getCurrentSeason, type DashboardData } from "./jikan";

// ═══════════════════════════════════════════════════════════
// Kitsu — third-tier data source. AniList is the primary API and
// Jikan (MyAnimeList) the backup, but Jikan proxies MAL live, so
// when MAL refuses connections both go down together. Kitsu runs
// its own database and stays up independently.
//
// Every Kitsu result is mapped back to its MAL id (via Kitsu's
// mappings) so the rest of the app keeps a single resolvable id
// space while on backup; items with no MAL mapping are dropped.
// Plain fetch only — safe for both server pages and client code.
// ═══════════════════════════════════════════════════════════

const KITSU_API = "https://kitsu.io/api/edge";
const KITSU_HEADERS = { Accept: "application/vnd.api+json" };
const MAPPING_PARAMS = "include=mappings&fields[mappings]=externalSite,externalId";

async function kitsuFetch(pathAndQuery: string): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${KITSU_API}${pathAndQuery}`, {
        headers: KITSU_HEADERS,
        next: { revalidate: 300 },
      });
      if (!res.ok) throw new Error(`Kitsu error: ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

function mapKitsuStatus(status: string | null): string {
  switch (status) {
    case "current": return "Currently Airing";
    case "finished": return "Finished Airing";
    case "upcoming":
    case "unreleased":
    case "tba": return "Not yet aired";
    default: return status || "Unknown";
  }
}

function kitsuToAnime(item: any, malId: number): Anime {
  const attrs = item.attributes || {};
  const poster = attrs.posterImage || {};
  const youtubeId = attrs.youtubeVideoId || null;
  const year = attrs.startDate ? parseInt(attrs.startDate.slice(0, 4), 10) : undefined;

  return {
    mal_id: malId,
    url: `https://myanimelist.net/anime/${malId}`,
    images: {
      jpg: {
        image_url: poster.medium || poster.large || "",
        large_image_url: poster.original || poster.large || "",
        small_image_url: poster.small || "",
      },
      webp: { image_url: "", large_image_url: "", small_image_url: "" },
    },
    trailer: {
      youtube_id: youtubeId,
      url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
      embed_url: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null,
      images: {
        maximum_image_url: attrs.coverImage?.original || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : ""),
        image_url: "",
        small_image_url: "",
        medium_image_url: "",
        large_image_url: attrs.coverImage?.large || "",
      },
    },
    title: attrs.canonicalTitle || "Unknown",
    title_english: attrs.titles?.en || attrs.titles?.en_us,
    title_japanese: attrs.titles?.ja_jp,
    type: (attrs.subtype || "TV").toUpperCase() === "TV" ? "TV" : attrs.subtype,
    episodes: attrs.episodeCount,
    status: mapKitsuStatus(attrs.status),
    duration: attrs.episodeLength ? `${attrs.episodeLength} min per ep` : "Unknown",
    score: attrs.averageRating ? parseFloat(attrs.averageRating) / 10 : null,
    synopsis: attrs.synopsis || attrs.description || "",
    year,
    aired: {
      from: attrs.startDate ? new Date(attrs.startDate).toISOString() : null,
      to: attrs.endDate ? new Date(attrs.endDate).toISOString() : null,
    },
    genres: [],
    studios: [],
    _source: "jikan", // marks mal_id as a real MAL id for downstream routing
  } as unknown as Anime;
}

// Join each anime in `data` to its MAL id via the sideloaded mapping records.
// Anime without a MAL mapping are dropped — their links couldn't resolve.
function extractAnimeWithMalIds(json: any): Anime[] {
  const malIdByMappingId = new Map<string, number>();
  for (const inc of json.included || []) {
    if (inc.type === "mappings" && inc.attributes?.externalSite === "myanimelist/anime") {
      const malId = parseInt(inc.attributes.externalId, 10);
      if (!isNaN(malId)) malIdByMappingId.set(inc.id, malId);
    }
  }

  const result: Anime[] = [];
  for (const item of json.data || []) {
    const refs = item.relationships?.mappings?.data || [];
    const malId = refs.map((r: any) => malIdByMappingId.get(r.id)).find((id: number | undefined) => id !== undefined);
    if (malId !== undefined) result.push(kitsuToAnime(item, malId));
  }
  return result;
}

async function kitsuSection(filters: string): Promise<Anime[]> {
  const json = await kitsuFetch(`/anime?${filters}&page[limit]=20&${MAPPING_PARAMS}`);
  return extractAnimeWithMalIds(json);
}

export async function getDashboardKitsu(): Promise<DashboardData> {
  const { season, year, nextSeason, nextYear } = getCurrentSeason();

  const [trending, airingNow, upcoming, thisSeason, nextSeasonList, finished] = await Promise.all([
    kitsuSection("filter[status]=current&sort=-userCount").catch(() => []),
    kitsuSection("filter[status]=current&sort=-averageRating").catch(() => []),
    kitsuSection("filter[status]=upcoming&sort=-userCount").catch(() => []),
    kitsuSection(`filter[season]=${season.toLowerCase()}&filter[seasonYear]=${year}&sort=-userCount`).catch(() => []),
    kitsuSection(`filter[season]=${nextSeason.toLowerCase()}&filter[seasonYear]=${nextYear}&sort=-userCount`).catch(() => []),
    kitsuSection("filter[status]=finished&sort=-userCount").catch(() => []),
  ]);

  const result: DashboardData = {
    trending: { media: trending },
    airingNow: { media: airingNow },
    upcoming: { media: upcoming },
    thisSeason: { media: thisSeason },
    nextSeason: { media: nextSeasonList },
    finished: { media: finished },
    recentlyUpdated: { media: trending },
    isFallback: true,
  };

  const totalItems = trending.length + airingNow.length + upcoming.length + thisSeason.length + nextSeasonList.length + finished.length;
  if (totalItems === 0) {
    throw new Error("Kitsu fallback returned no data for any dashboard section");
  }
  return result;
}

export async function getAnimeDetailsKitsu(malId: number): Promise<Anime> {
  const json = await kitsuFetch(`/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item`);
  const item = (json.included || []).find((inc: any) => inc.type === "anime");
  if (!item) throw new Error("Anime not found on Kitsu");
  return kitsuToAnime(item, malId);
}

export async function searchAnimeKitsu(variables: any) {
  const params: string[] = [];
  if (variables.search) params.push(`filter[text]=${encodeURIComponent(variables.search)}`);

  const statusMap: Record<string, string> = {
    airing: "current", releasing: "current",
    upcoming: "upcoming", "not yet released": "upcoming",
    finished: "finished", hiatus: "current", cancelled: "finished",
  };
  if (variables.status) {
    const mapped = statusMap[variables.status.toLowerCase()];
    if (mapped) params.push(`filter[status]=${mapped}`);
  }

  // Kitsu ignores sort when a text filter is present (it ranks by relevance)
  const sortMap: Record<string, string> = {
    score: "-averageRating",
    popularity: "-userCount",
    trending: "-userCount",
    favourites: "-favoritesCount",
    newest: "-startDate",
    updated: "-userCount",
  };
  if (!variables.search) {
    params.push(`sort=${sortMap[variables.sort?.[0]] || "-userCount"}`);
  }

  const page = variables.page || 1;
  params.push(`page[limit]=20`, `page[offset]=${(page - 1) * 20}`);

  const json = await kitsuFetch(`/anime?${params.join("&")}&${MAPPING_PARAMS}`);
  const media = extractAnimeWithMalIds(json);
  const total = json.meta?.count || media.length;

  return {
    Page: {
      media,
      pageInfo: {
        total,
        perPage: 20,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(total / 20)),
        hasNextPage: page * 20 < total,
      },
    },
  };
}
