import { searchAnikotoAnime, getAnikotoEpisodes, AnikotoEpisode } from "@/lib/anikoto";
import { Anime } from "@tutkli/jikan-ts";

/**
 * EPISODE RESOLUTION, extracted from EpisodeList so the /watch page can use
 * the exact same machinery: AniKoto title search with three fallbacks, the
 * wrong-season heuristic, alternate-result retries, the Jikan fallback for
 * non-streamable shows, and thumbnail/title hydration.
 *
 * Faithful port — every heuristic here exists because a real show matched
 * wrongly without it. Change EpisodeList and this together.
 */

export type ResolvedEpisodes = {
  episodes: AnikotoEpisode[];
  consumetId: string | null;
  streamable: boolean;
  error: string | null;
};

export function isUnreleasedAnime(anime: Anime): boolean {
  const rawStatus = String((anime as any)._anilistStatus || anime.status || "").toLowerCase();
  let isFutureDate = false;
  if (anime.aired?.from) {
    const airedDate = new Date(anime.aired.from).getTime();
    if (airedDate > Date.now()) isFutureDate = true;
  }
  return isFutureDate || rawStatus.includes("not_yet") || rawStatus.includes("not yet") || rawStatus.includes("upcoming") || rawStatus.includes("tba");
}

export async function resolveEpisodes(anime: Anime): Promise<ResolvedEpisodes> {
  if (isUnreleasedAnime(anime)) {
    return { episodes: [], consumetId: null, streamable: false, error: null };
  }

  try {
    const title = anime.title_english || anime.title;

    // Never match adult content against the standard streaming index.
    const isHentai = anime.rating?.toLowerCase().includes("hentai") ||
      anime.rating?.toLowerCase().includes("rx") ||
      anime.genres?.some((g: any) => {
        const n = g.name.toLowerCase();
        return n === "hentai" || n === "erotica" || n === "adult cast";
      }) || false;

    let searchResults: any[] = [];
    if (!isHentai) {
      searchResults = await searchAnikotoAnime(title || "", anime.title || undefined, anime.title_english || undefined);
      if ((!searchResults || searchResults.length === 0) && anime.title_english && anime.title && anime.title !== anime.title_english) {
        searchResults = await searchAnikotoAnime(anime.title, anime.title, anime.title_english);
      }
      if ((!searchResults || searchResults.length === 0) && anime.title_japanese) {
        searchResults = await searchAnikotoAnime(anime.title_japanese || "", anime.title || undefined, anime.title_english || undefined);
      }
      if ((!searchResults || searchResults.length === 0) && (anime as any).title_synonyms?.length) {
        for (const syn of (anime as any).title_synonyms as string[]) {
          const r = await searchAnikotoAnime(syn, anime.title || undefined, anime.title_english || undefined);
          if (r && r.length > 0) { searchResults = r; break; }
        }
      }
    }

    let match = searchResults && searchResults.length > 0 ? searchResults[0] : null;

    // Season heuristic — the top fuzzy match is often the wrong season.
    if (match && searchResults.length > 1) {
      const qLower = (title || "").toLowerCase();
      const mLower = match.title?.toLowerCase() || "";
      const getSeasonNum = (str: string): number | null => {
        let m = str.match(/season\s+(\d+)/i);
        if (m) return parseInt(m[1]);
        m = str.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
        if (m) return parseInt(m[1]);
        m = str.match(/part\s+(\d+)/i);
        if (m) return parseInt(m[1]);
        if (/\biv\b/i.test(str)) return 4;
        if (/\biii\b/i.test(str)) return 3;
        if (/\bii\b/i.test(str)) return 2;
        return null;
      };
      const qSeason = getSeasonNum(qLower);
      const mSeason = getSeasonNum(mLower);
      if (qSeason !== null && mSeason !== qSeason) {
        const betterMatch = searchResults.find((r: any) => getSeasonNum((r.title || "").toLowerCase()) === qSeason);
        match = betterMatch || null;
      } else if (qSeason === null && mSeason !== null) {
        const betterMatch = searchResults.find((r: any) => getSeasonNum((r.title || "").toLowerCase()) === null);
        if (betterMatch) match = betterMatch;
      }
    }

    let eps: AnikotoEpisode[] = [];
    let consumetId: string | null = null;
    let streamable = false;

    if (match) {
      consumetId = match.id;
      streamable = true;
      eps = await getAnikotoEpisodes(match.id);
      if (eps.length === 0 && searchResults && searchResults.length > 1) {
        for (let si = 1; si < Math.min(searchResults.length, 4); si++) {
          const altEps = await getAnikotoEpisodes(searchResults[si].id);
          if (altEps.length > 0) {
            eps = altEps;
            consumetId = searchResults[si].id;
            break;
          }
        }
      }
    }

    // Jikan fallback + real episode titles.
    const jikanTitles: Record<number, string> = {};
    try {
      const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}/episodes`);
      if (jikanRes.ok) {
        const jikanData = await jikanRes.json();
        if (jikanData.data) {
          if (eps.length === 0) {
            streamable = false;
            eps = jikanData.data.map((je: any) => ({
              id: `jikan-${je.mal_id}`,
              number: je.mal_id,
              title: je.title,
              isFiller: je.filler,
              createdAt: je.aired,
            }));
          }
          jikanData.data.forEach((je: any) => {
            if (je.mal_id && je.title) jikanTitles[je.mal_id] = je.title;
          });
        }
      }
    } catch (e) {
      console.error("Jikan fallback failed", e);
    }

    if (!eps || eps.length === 0) {
      return { episodes: [], consumetId, streamable, error: "No episodes were found for this anime." };
    }

    // Thumbnail + title hydration from AniList streamingEpisodes.
    const streamingEpisodes = (anime as any)._streamingEpisodes || [];
    const episodeThumbnails: Record<number, { image: string; title: string }> = {};
    streamingEpisodes.forEach((sep: any) => {
      const m = sep.title?.match(/Episode\s+(\d+)/i);
      if (m) {
        const epNum = parseInt(m[1]);
        let cleanTitle = sep.title;
        const splitMatch = sep.title?.match(/Episode\s+\d+\s+-\s+(.+)/i);
        if (splitMatch) cleanTitle = splitMatch[1];
        episodeThumbnails[epNum] = { image: sep.thumbnail, title: cleanTitle };
      }
    });

    const hydrated = eps.map((ep) => {
      const metadata = episodeThumbnails[ep.number];
      const isGenericTitle = !ep.title || ep.title.toLowerCase().startsWith("episode");
      const fallbackImage = anime.trailer?.images?.maximum_image_url || anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
      let finalTitle = ep.title;
      if (isGenericTitle) {
        if (jikanTitles[ep.number] && !jikanTitles[ep.number].toLowerCase().startsWith("episode")) {
          finalTitle = jikanTitles[ep.number];
        } else if (metadata?.title) {
          finalTitle = metadata.title;
        }
      }
      return { ...ep, image: metadata?.image || fallbackImage, title: finalTitle };
    });

    return { episodes: hydrated, consumetId, streamable, error: null };
  } catch (err: any) {
    return { episodes: [], consumetId: null, streamable: false, error: err?.message || "Failed to load episodes." };
  }
}
