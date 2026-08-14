export async function getNovelCover(title: string): Promise<string | null> {
  const data = await getNovelHydration(title);
  return data.cover;
}

export interface NovelHydration {
  cover: string | null;
  banner: string | null;
  score: number | null;
  genres: string[];
}

export async function getNovelHydration(title: string): Promise<NovelHydration> {
  if (!title) return { cover: null, banner: null, score: null, genres: [] };

  const cleanTitle = title
    .replace(/\s*\(?(?:volume|vol|v|season|s)\s*\d+.*?\)?/gi, "")
    .replace(/\s*\(ln\)/gi, "")
    .replace(/\s*\(wn\)/gi, "")
    .trim();

  const query = `
    query ($search: String) {
      novel: Media(search: $search, type: MANGA, format: NOVEL) {
        coverImage {
          extraLarge
        }
        bannerImage
        averageScore
        genres
      }
      manga: Media(search: $search, type: MANGA) {
        coverImage {
          extraLarge
        }
        bannerImage
        averageScore
        genres
      }
    }
  `;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search: cleanTitle },
      }),
      next: { revalidate: 86400 },
    });

    const json = await res.json();
    const media = json.data?.novel || json.data?.manga;
    if (media) {
      return {
        cover: media.coverImage?.extraLarge || null,
        banner: media.bannerImage || null,
        score: media.averageScore || null,
        genres: media.genres || [],
      };
    }
    return { cover: null, banner: null, score: null, genres: [] };
  } catch (error) {
    return { cover: null, banner: null, score: null, genres: [] };
  }
}

export async function getManhwaBanner(title: string): Promise<string | null> {
  if (!title) return null;
  // Clean up title (strip season tags, brackets, and extra noise)
  const cleanTitle = title
    .replace(/\s*\(?(?:season|s)\s*\d+\)?/gi, "")
    .replace(/\s*-\s*season\s*\d+/gi, "")
    .trim();

  const query = `
    query ($search: String) {
      Media(search: $search, type: MANGA) {
        bannerImage
        coverImage {
          extraLarge
        }
      }
    }
  `;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search: cleanTitle },
      }),
      next: { revalidate: 86400 },
    });

    const json = await res.json();
    return json.data?.Media?.bannerImage || null;
  } catch (error) {
    console.error("Anilist manhwa banner fetch error for", title, error);
    return null;
  }
}

