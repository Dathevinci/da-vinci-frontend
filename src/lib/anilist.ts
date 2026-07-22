export async function getNovelCover(title: string): Promise<string | null> {
  const query = `
    query ($search: String) {
      Media(search: $search, type: MANGA, format: NOVEL) {
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
        variables: { search: title },
      }),
      // Cache covers heavily since they rarely change
      next: { revalidate: 86400 },
    });

    const json = await res.json();
    if (json.data?.Media?.coverImage?.extraLarge) {
      return json.data.Media.coverImage.extraLarge;
    }
    
    // Fallback: If no strict format=NOVEL match, try just type=MANGA for ambiguous titles
    const fallbackQuery = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          coverImage {
            extraLarge
          }
        }
      }
    `;
    const fallbackRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: fallbackQuery,
        variables: { search: title },
      }),
      next: { revalidate: 86400 },
    });
    const fallbackJson = await fallbackRes.json();
    if (fallbackJson.data?.Media?.coverImage?.extraLarge) {
      return fallbackJson.data.Media.coverImage.extraLarge;
    }

    return null;
  } catch (error) {
    console.error("Anilist cover fetch error for", title, error);
    return null;
  }
}
