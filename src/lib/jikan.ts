import { JikanClient, Anime } from '@tutkli/jikan-ts';

const client = new JikanClient();

// Add artificial delay to avoid hitting Jikan rate limits (3/sec)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface DashboardData {
  trending: { media: Anime[] };
  airingNow: { media: Anime[] };
  upcoming: { media: Anime[] };
  thisSeason: { media: Anime[] };
  nextSeason: { media: Anime[] };
  finished: { media: Anime[] };
}

export async function getDashboardData(): Promise<DashboardData> {
  // Top Anime (Airing = Trending/Airing Now)
  const airingReq = await client.top.getTopAnime({ filter: 'airing', limit: 12 });
  await delay(350);
  
  // Top Anime (Upcoming)
  const upcomingReq = await client.top.getTopAnime({ filter: 'upcoming', limit: 12 });
  await delay(350);

  // Most Popular (Bypassing this season logic for now, using Most Popular)
  const popularReq = await client.top.getTopAnime({ filter: 'bypopularity', limit: 12 });
  await delay(350);

  return {
    trending: { media: airingReq.data },
    airingNow: { media: airingReq.data },
    upcoming: { media: upcomingReq.data },
    thisSeason: { media: popularReq.data },
    nextSeason: { media: upcomingReq.data }, // Temporary fallback
    finished: { media: popularReq.data }, // Temporary fallback
  };
}

export async function getAnimeDetails(id: number): Promise<Anime> {
  const res = await client.anime.getAnimeById(id);
  return res.data;
}

export async function searchAnime(variables: any) {
  const reqArgs: any = {
    q: variables.search,
    status: variables.status,
    page: variables.page,
    limit: 20,
    type: variables.format,
  };

  if (variables.sort) {
    if (variables.sort === 'score') {
      reqArgs.order_by = 'score';
      reqArgs.sort = 'desc';
    } else if (variables.sort === 'popularity') {
      reqArgs.order_by = 'popularity';
      reqArgs.sort = 'desc';
    } else if (variables.sort === 'newest') {
      reqArgs.order_by = 'start_date';
      reqArgs.sort = 'desc';
    } else if (variables.sort === 'oldest') {
      reqArgs.order_by = 'start_date';
      reqArgs.sort = 'asc';
    }
  }

  if (variables.genre_in) {
    // Note: Jikan expects comma-separated genre IDs, but for simplicity we'll just omit mapping all names to IDs here
    // In a real app we'd fetch genres and map them. Since this is an MVP pivot, we'll leave it out or map known ones.
  }

  const res = await client.anime.getAnimeSearch(reqArgs);
  
  return {
    Page: {
      media: res.data,
      pageInfo: {
        total: res.pagination?.items?.total || 0,
        perPage: res.pagination?.items?.per_page || 20,
        currentPage: res.pagination?.current_page || 1,
        lastPage: res.pagination?.last_visible_page || 1,
        hasNextPage: res.pagination?.has_next_page || false,
      }
    }
  };
}

export async function getCalendarData() {
  const res = await client.schedules.getSchedules();
  return res.data;
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
