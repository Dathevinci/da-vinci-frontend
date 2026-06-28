export const ANILIST_API_URL = "https://graphql.anilist.co";

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
  startDate?: { year?: number; month?: number; day?: number };
  endDate?: { year?: number; month?: number; day?: number };
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
}

const AnimeCardFragment = `
  fragment AnimeCard on Media {
    id
    idMal
    siteUrl
    title {
      romaji
      english
      native
      userPreferred
    }
    description(asHtml: false)
    coverImage {
      extraLarge
      large
      color
    }
    bannerImage
    format
    status(version: 2)
    episodes
    duration
    season
    seasonYear
    startDate { year month day }
    endDate { year month day }
    genres
    averageScore
    popularity
    trending
    nextAiringEpisode {
      airingAt
      timeUntilAiring
      episode
    }
    studios(isMain: true) {
      nodes { id name }
    }
    externalLinks { site url type }
  }
`;

export async function fetchAniList<T>(query: string, variables: any = {}): Promise<T> {
  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  const json = await response.json();
  if (json.errors) {
    console.error("AniList API Error:", json.errors);
    throw new Error("Failed to fetch from AniList");
  }
  return json.data;
}

export async function getDashboardData() {
  const query = `
    query AnimeDashboard($season: MediaSeason, $seasonYear: Int, $nextSeason: MediaSeason, $nextSeasonYear: Int) {
      airingNow: Page(page: 1, perPage: 20) {
        media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
      trending: Page(page: 1, perPage: 20) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
      thisSeason: Page(page: 1, perPage: 20) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
      nextSeason: Page(page: 1, perPage: 20) {
        media(type: ANIME, season: $nextSeason, seasonYear: $nextSeasonYear, sort: POPULARITY_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
      upcoming: Page(page: 1, perPage: 20) {
        media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
      finished: Page(page: 1, perPage: 20) {
        media(type: ANIME, status: FINISHED, sort: POPULARITY_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
    }
    ${AnimeCardFragment}
  `;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  let season = "WINTER";
  if (month >= 3 && month <= 5) season = "SPRING";
  else if (month >= 6 && month <= 8) season = "SUMMER";
  else if (month >= 9 && month <= 11) season = "FALL";

  let nextSeason = "SPRING";
  let nextSeasonYear = year;
  if (season === "WINTER") nextSeason = "SPRING";
  if (season === "SPRING") nextSeason = "SUMMER";
  if (season === "SUMMER") nextSeason = "FALL";
  if (season === "FALL") { nextSeason = "WINTER"; nextSeasonYear += 1; }

  return fetchAniList<{
    airingNow: { media: AniListAnime[] };
    trending: { media: AniListAnime[] };
    thisSeason: { media: AniListAnime[] };
    nextSeason: { media: AniListAnime[] };
    upcoming: { media: AniListAnime[] };
    finished: { media: AniListAnime[] };
  }>(query, { season, seasonYear: year, nextSeason, nextSeasonYear });
}

export async function getAnimeDetails(id: number) {
  const query = `
    query AnimeDetails($id: Int) {
      Media(id: $id, type: ANIME) {
        ...AnimeCard
      }
    }
    ${AnimeCardFragment}
  `;
  const res = await fetchAniList<{ Media: AniListAnime }>(query, { id });
  return res.Media;
}

export async function searchAnime(variables: any) {
  const query = `
    query SearchAnime($page: Int, $search: String, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $format: MediaFormat) {
      Page(page: $page, perPage: 30) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, search: $search, status: $status, season: $season, seasonYear: $seasonYear, format: $format, sort: POPULARITY_DESC, isAdult: false) {
          ...AnimeCard
        }
      }
    }
    ${AnimeCardFragment}
  `;
  return fetchAniList<{ Page: { media: AniListAnime[], pageInfo: any } }>(query, variables);
}
