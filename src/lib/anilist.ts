const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface AniListAnime {
  id: number;
  idMal?: number;
  siteUrl: string;
  title: {
    romaji: string;
    english?: string;
    native?: string;
    userPreferred: string;
  };
  description?: string;
  coverImage: {
    extraLarge?: string;
    large?: string;
    color?: string;
  };
  bannerImage?: string;
  format?: string;
  status: string;
  episodes?: number;
  duration?: number;
  season?: string;
  seasonYear?: number;
  genres: string[];
  averageScore?: number;
  popularity?: number;
  trending?: number;
  nextAiringEpisode?: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  };
  studios?: {
    nodes: { id: number; name: string }[];
  };
  externalLinks?: {
    site: string;
    url: string;
    type: string;
  }[];
  trailer?: {
    id: string;
    site: string;
    thumbnail: string;
  };
  characters?: {
    edges: {
      role: string;
      node: {
        id: number;
        name: { full: string };
        image: { large: string };
      };
      voiceActors: {
        id: number;
        name: { full: string };
        image: { large: string };
      }[];
    }[];
  };
  relations?: {
    edges: {
      relationType: string;
      node: {
        id: number;
        type: string;
        format: string;
        status: string;
        title: { romaji: string; english?: string };
        coverImage: { large: string };
      };
    }[];
  };
}

async function fetchFromBackend<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    // Next.js caching is handled on the backend now, so we can use default or short cache
    next: { revalidate: 60 }, // 1 min frontend cache, backend handles the real cache
  });

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || "Failed to fetch from backend");
  }
  return json.data;
}

export async function getDashboardData() {
  return fetchFromBackend<{
    trending: { media: AniListAnime[] };
    airingNow: { media: AniListAnime[] };
    upcoming: { media: AniListAnime[] };
    thisSeason: { media: AniListAnime[] };
    nextSeason: { media: AniListAnime[] };
    finished: { media: AniListAnime[] };
  }>("/api/dashboard");
}

export async function getAnimeDetails(id: number) {
  return fetchFromBackend<AniListAnime>(`/api/anime/${id}`);
}

export async function searchAnime(variables: any) {
  const params = new URLSearchParams();
  if (variables.search) params.append("q", variables.search);
  if (variables.status) params.append("status", variables.status);
  if (variables.season) params.append("season", variables.season);
  if (variables.seasonYear) params.append("year", variables.seasonYear.toString());
  if (variables.page) params.append("page", variables.page.toString());
  if (variables.genre_in) params.append("genre", Array.isArray(variables.genre_in) ? variables.genre_in.join(",") : variables.genre_in);
  if (variables.sort) params.append("sort", Array.isArray(variables.sort) ? variables.sort[0] : variables.sort);
  if (variables.format) params.append("format", variables.format);

  return fetchFromBackend<{ Page: { media: AniListAnime[], pageInfo: any } }>(`/api/search?${params.toString()}`);
}

export async function getCalendarData() {
  return fetchFromBackend<{ Page: { airingSchedules: any[] } }>("/api/calendar");
}

