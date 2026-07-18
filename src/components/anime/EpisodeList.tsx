+"use client";

import { useEffect, useState } from "react";
import { searchAnikotoAnime, getAnikotoEpisodes, AnikotoEpisode } from "@/lib/anikoto";
import { Loader2, PlayCircle, Tv, AlertCircle, Play, ChevronDown, Clock, Sparkles } from "lucide-react";
import WatchOverlay from "./WatchOverlay";
import AnikotoPlayer from "./AnikotoPlayer";
import { Anime } from "@tutkli/jikan-ts";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams } from 'next/navigation';

const EPISODES_PER_SEASON = 12;

export default function EpisodeList({ 
  anime, 
  autoPlayProp, 
  autoPlayEpProp 
}: { 
  anime: Anime;
  autoPlayProp?: boolean;
  autoPlayEpProp?: number | null;
}) {
  const [episodes, setEpisodes] = useState<AnikotoEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consumetId, setConsumetId] = useState<string | null>(null);
  const [isStreamable, setIsStreamable] = useState(false);

  // Overlay state
  const [watchEpisodeId, setWatchEpisodeId] = useState<string | null>(null);
  const [watchEpisodeNo, setWatchEpisodeNo] = useState<number | null>(null);
  // Toggle between legacy WatchOverlay and new AnikotoPlayer
  const [useCustomPlayer, setUseCustomPlayer] = useState(false);
  const searchParams = useSearchParams();
  
  const autoPlay = autoPlayProp || searchParams?.get("play") === "true";
  const epParam = searchParams?.get("ep");
  const autoPlayEp = autoPlayEpProp || (epParam ? parseInt(epParam, 10) : null);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);

  useEffect(() => {
    if (autoPlay && episodes.length > 0 && !watchEpisodeId && !hasAutoPlayed) {
      const targetEp = autoPlayEp ? episodes.find(e => e.number === autoPlayEp) : null;
      const epToPlay = targetEp || episodes[0];
      setWatchEpisodeId(epToPlay.id);
      setWatchEpisodeNo(epToPlay.number || 1);
      setHasAutoPlayed(true);
    }
  }, [autoPlay, autoPlayEp, episodes, watchEpisodeId, hasAutoPlayed]);
  // Season/group selector
  const [activeSeason, setActiveSeason] = useState(0);

  // Check if anime is unreleased. Status arrives in AniList form ("NOT_YET_RELEASED")
  // or MAL/Jikan form ("Not yet aired") depending on which data source served it —
  // missing either one lets an upcoming anime through to the title search below,
  // which then fuzzy-matches a *different* anime and shows its episodes.
  const rawStatus = String((anime as any)._anilistStatus || anime.status || "").toLowerCase();

  // Extra safety: Check if the airing date is in the future
  let isFutureDate = false;
  if (anime.aired?.from) {
    const airedDate = new Date(anime.aired.from).getTime();
    if (airedDate > Date.now()) {
      isFutureDate = true;
    }
  }

  const isUnreleased = isFutureDate || rawStatus.includes("not_yet") || rawStatus.includes("not yet") || rawStatus.includes("upcoming") || rawStatus.includes("tba");

  // Fetch episodes on mount
  useEffect(() => {
    if (isUnreleased) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchEpisodes = async () => {
      setLoading(true);
      setError(null);

      try {
        const title = anime.title_english || anime.title;
        
        // Prevent false positive matches on standard streaming sites for adult content
        const isHentai = anime.rating?.toLowerCase().includes("hentai") || 
                         anime.rating?.toLowerCase().includes("rx") || 
                         anime.genres?.some((g: any) => g.name.toLowerCase() === "hentai" || g.name.toLowerCase() === "erotica" || g.name.toLowerCase() === "adult cast") || false;

        let searchResults: any[] = [];
        
        if (!isHentai) {
          searchResults = await searchAnikotoAnime(title || "", anime.title || undefined, anime.title_english || undefined);

          if (!isMounted) return;

          // Fallback 1: swap primary / English title
          if ((!searchResults || searchResults.length === 0) && anime.title_english && anime.title && anime.title !== anime.title_english) {
            searchResults = await searchAnikotoAnime(anime.title, anime.title, anime.title_english);
          }

          // Fallback 2: Japanese title
          if ((!searchResults || searchResults.length === 0) && anime.title_japanese) {
            searchResults = await searchAnikotoAnime(anime.title_japanese || "", anime.title || undefined, anime.title_english || undefined);
          }

          // Fallback 3: synonyms from MAL data
          if ((!searchResults || searchResults.length === 0) && (anime as any).title_synonyms?.length) {
            for (const syn of (anime as any).title_synonyms as string[]) {
              if (!isMounted) return;
              const r = await searchAnikotoAnime(syn, anime.title || undefined, anime.title_english || undefined);
              if (r && r.length > 0) { searchResults = r; break; }
            }
          }
        }

        let match = searchResults && searchResults.length > 0 ? searchResults[0] : null;

        // Title heuristic for seasons — prevent wrong-season matching
        if (match && searchResults.length > 1) {
          const qLower = (title || "").toLowerCase();
          const mLower = match.title?.toLowerCase() || "";

          // Extract season/part number from a title string
          const getSeasonNum = (str: string): number | null => {
            // "Season 4", "Season 2"
            let m = str.match(/season\s+(\d+)/i);
            if (m) return parseInt(m[1]);
            // "4th Season", "2nd Season", "3rd Season"
            m = str.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
            if (m) return parseInt(m[1]);
            // "Part 2", "Part 3"
            m = str.match(/part\s+(\d+)/i);
            if (m) return parseInt(m[1]);
            // Roman numerals at end: " II", " III", " IV"
            if (/\biv\b/i.test(str)) return 4;
            if (/\biii\b/i.test(str)) return 3;
            if (/\bii\b/i.test(str)) return 2;
            return null;
          };

          const qSeason = getSeasonNum(qLower);
          const mSeason = getSeasonNum(mLower);

          if (qSeason !== null && mSeason !== qSeason) {
            // The top result is the wrong season — try to find the right one
            const betterMatch = searchResults.find((r: any) => {
              const rSeason = getSeasonNum((r.title || "").toLowerCase());
              return rSeason === qSeason;
            });
            match = betterMatch || null;
          } else if (qSeason === null && mSeason !== null) {
            // We're looking for season 1 (no season in title) but matched a sequel
            const betterMatch = searchResults.find((r: any) => {
              const rSeason = getSeasonNum((r.title || "").toLowerCase());
              return rSeason === null;
            });
            if (betterMatch) match = betterMatch;
          }
        }

        let eps: AnikotoEpisode[] = [];
        if (match) {
          setConsumetId(match.id);
          setIsStreamable(true);
          eps = await getAnikotoEpisodes(match.id);
          // If the matched entry has no episodes, try the next results
          if (eps.length === 0 && searchResults && searchResults.length > 1) {
            for (let si = 1; si < Math.min(searchResults.length, 4); si++) {
              if (!isMounted) return;
              const altEps = await getAnikotoEpisodes(searchResults[si].id);
              if (altEps.length > 0) {
                eps = altEps;
                setConsumetId(searchResults[si].id);
                break;
              }
            }
          }
        }
        if (!isMounted) return;

        // Fallback to Jikan API if no valid episodes found from streaming provider
        let jikanTitles: Record<number, string> = {};
        try {
          const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}/episodes`);
          if (jikanRes.ok) {
            const jikanData = await jikanRes.json();
            if (jikanData.data) {
              if (eps.length === 0) {
                // Populate eps purely from Jikan — mark as non-streamable
                setIsStreamable(false);
                eps = jikanData.data.map((je: any) => ({
                  id: `jikan-${je.mal_id}`,
                  number: je.mal_id,
                  title: je.title,
                  isFiller: je.filler,
                  createdAt: je.aired
                }));
              }
              jikanData.data.forEach((je: any) => {
                if (je.mal_id && je.title) {
                  jikanTitles[je.mal_id] = je.title;
                }
              });
            }
          }
        } catch (e) {
          console.error("Jikan fallback failed", e);
        }

        if (!eps || eps.length === 0) {
          setError("No episodes were found for this anime.");
          setLoading(false);
          return;
        }

        if (eps && eps.length > 0) {
          // Extract thumbnails from AniList streamingEpisodes if available
          const streamingEpisodes = (anime as any)._streamingEpisodes || [];
          const episodeThumbnails: Record<number, { image: string, title: string }> = {};

          streamingEpisodes.forEach((sep: any) => {
            const match = sep.title?.match(/Episode\s+(\d+)/i);
            if (match) {
              const epNum = parseInt(match[1]);
              let cleanTitle = sep.title;
              const splitMatch = sep.title?.match(/Episode\s+\d+\s+-\s+(.+)/i);
              if (splitMatch) {
                cleanTitle = splitMatch[1];
              }
              episodeThumbnails[epNum] = {
                image: sep.thumbnail,
                title: cleanTitle
              };
            }
          });

          // Hydrate with thumbnails
          const hydratedEps = eps.map((ep) => {
            const metadata = episodeThumbnails[ep.number];
            const isGenericTitle = !ep.title || ep.title.toLowerCase().startsWith('episode');
            const fallbackImage = anime.trailer?.images?.maximum_image_url || anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;

            let finalTitle = ep.title;
            if (isGenericTitle) {
              if (jikanTitles[ep.number] && !jikanTitles[ep.number].toLowerCase().startsWith('episode')) {
                finalTitle = jikanTitles[ep.number];
              } else if (metadata?.title) {
                finalTitle = metadata.title;
              }
            }

            return {
              ...ep,
              image: metadata?.image || fallbackImage,
              title: finalTitle,
            };
          });

          setEpisodes(hydratedEps);
        } else {
          setEpisodes([]);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load episodes.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEpisodes();
    return () => { isMounted = false; };
  }, [anime.title, anime.title_english, anime.title_japanese, anime.mal_id, anime.type, anime.images, anime.trailer, isUnreleased]);

  // Group episodes into chunks (avoiding confusing "Season" labels if the anime is already a specific season)
  const seasons: { label: string; episodes: AnikotoEpisode[] }[] = [];
  for (let i = 0; i < episodes.length; i += EPISODES_PER_SEASON) {
    const chunk = episodes.slice(i, i + EPISODES_PER_SEASON);
    seasons.push({
      label: episodes.length <= EPISODES_PER_SEASON
        ? "All Episodes"
        : `Episodes ${i + 1}-${Math.min(i + EPISODES_PER_SEASON, episodes.length)}`,
      episodes: chunk,
    });
  }

  const currentSeasonEpisodes = seasons[activeSeason]?.episodes || [];

  // ── Unreleased anime ──
  if (isUnreleased) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-b from-blue-500/5 to-transparent rounded-2xl border border-blue-500/10">
        <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-2xl font-black text-white mb-2">Coming Soon</h3>
        <p className="text-slate-400 text-center max-w-md leading-relaxed">
          This anime hasn't aired yet. Episodes will be available once it starts broadcasting.
        </p>
        {anime.season && anime.year && (
          <div className="mt-4 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20">
            <span className="text-blue-400 font-bold text-sm capitalize">
              Expected: {anime.season} {anime.year}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold tracking-widest text-sm uppercase">Loading Episodes...</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/5">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Could Not Load Episodes</h3>
        <p className="text-slate-400 text-center max-w-md">{error}</p>
      </div>
    );
  }

  // ── No episodes ──
  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/5">
        <Tv className="w-16 h-16 text-slate-500 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Episodes Available</h3>
        <p className="text-slate-400 text-center max-w-md">
          Episodes are not yet available for streaming. Check back later.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-0 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ── Non-streamable notice ── */}
        {!isStreamable && (
          <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold text-sm">Streaming Not Available</p>
              <p className="text-amber-200/60 text-xs mt-0.5 leading-relaxed">
                This anime isn&apos;t in our streaming library yet. Episode info is shown for reference only.
              </p>
            </div>
          </div>
        )}

        {/* ── Header: Title + Season Selector ── */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-white">Episodes</h3>

          <div className="flex items-center gap-3">
            {/* Player toggle */}
            <button
              onClick={() => setUseCustomPlayer(v => !v)}
              title={useCustomPlayer ? "Switch to classic player" : "Switch to new player (beta)"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                useCustomPlayer
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {useCustomPlayer ? "New Player ON" : "New Player"}
            </button>

            {seasons.length > 1 && (
              <div className="relative">
                <select
                  value={activeSeason}
                  onChange={(e) => setActiveSeason(Number(e.target.value))}
                  className="appearance-none bg-[#141414] border border-white/20 text-white rounded-md px-4 py-2.5 pr-10 font-bold text-sm focus:outline-none focus:border-white/40 cursor-pointer hover:bg-[#1a1a1a] transition"
                >
                  {seasons.map((s, i) => (
                    <option key={i} value={i} className="bg-[#141414] text-white">
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* ── Content rating & season info ── */}
        <div className="flex items-center gap-3 mb-6 text-sm text-slate-400">
          <span className="font-bold text-white">{seasons[activeSeason]?.label}:</span>
          <span>{currentSeasonEpisodes.length} Episodes</span>
        </div>

        {/* ── Netflix-style Episode List ── */}
        <div className="flex flex-col divide-y divide-white/5">
          {currentSeasonEpisodes.map((ep, idx) => {
            const epNumber = ep.number || idx + 1 + activeSeason * EPISODES_PER_SEASON;

            return (
              <button
                key={ep.id || idx}
                onClick={() => {
                  if (!isStreamable) return;
                  setWatchEpisodeId(ep.id);
                  setWatchEpisodeNo(epNumber);
                }}
                disabled={!isStreamable}
                title={!isStreamable ? "Stream not available for this anime" : undefined}
                className={`group flex items-start gap-4 md:gap-6 py-5 px-2 md:px-4 text-left transition-colors rounded-lg ${isStreamable ? 'hover:bg-white/[0.03] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              >
                {/* Episode number */}
                <div className="w-6 md:w-8 text-center flex-shrink-0 pt-2">
                  <span className="text-slate-500 text-lg md:text-2xl font-medium">
                    {epNumber}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="relative w-28 md:w-40 aspect-video flex-shrink-0 rounded-md overflow-hidden bg-[#1a1a1a]">
                  {ep.image ? (
                    <img
                      src={ep.image}
                      alt={ep.title || `Episode ${epNumber}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]">
                      <Tv className="w-8 h-8 text-slate-700" />
                    </div>
                  )}
                  {/* Play overlay on hover */}
                  {isStreamable ? (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center bg-black/60">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider text-center leading-tight px-1">Not Available</span>
                    </div>
                  )}
                </div>

                {/* Episode Info */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-white font-bold text-sm md:text-base truncate pr-4">
                      {ep.title || `Episode ${epNumber}`}
                    </h4>
                    {anime.duration && (
                      <span className="text-slate-500 text-xs md:text-sm flex-shrink-0 font-medium">
                        {String(anime.duration).replace(" per ep", "")}
                      </span>
                    )}
                  </div>
                  {ep.description && (
                    <p className="text-slate-500 text-xs md:text-sm line-clamp-2 leading-relaxed mt-1">
                      {ep.description}
                    </p>
                  )}
                  {ep.createdAt && (
                    <p className="text-indigo-400/80 text-xs font-medium mt-1.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Arrived {formatDistanceToNow(new Date(ep.createdAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Watch Overlay (legacy) */}
      {watchEpisodeId !== null && !useCustomPlayer && (
        <WatchOverlay
          anime={anime as any}
          consumetAnimeId={consumetId}
          initialEpisodeId={watchEpisodeId}
          initialEpisodeNo={watchEpisodeNo || 1}
          allEpisodes={episodes}
          onClose={() => { setWatchEpisodeId(null); setWatchEpisodeNo(null); }}
        />
      )}

      {/* New AnikotoPlayer */}
      {watchEpisodeId !== null && useCustomPlayer && consumetId && (
        <AnikotoPlayer
          animeId={consumetId}
          title={anime.title_english || anime.title || ""}
          startEp={watchEpisodeNo || 1}
          episodes={episodes}
          posterUrl={anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url}
          onClose={() => { setWatchEpisodeId(null); setWatchEpisodeNo(null); }}
        />
      )}
    </>
  );
}
