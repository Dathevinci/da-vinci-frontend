"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";

import TrackerButton from "@/components/anime/TrackerButton";
import { useToast } from "@/components/ui/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { getAnimeDetails, getAnimeCharacters, getAnimeRecommendations, getYouTubeId } from "@/lib/jikan";
import { getAnimeDetailsKitsu } from "@/lib/kitsu";
import EpisodeList from "@/components/anime/EpisodeList";
import CommunityFeed from "@/components/community/CommunityFeed";
import { AnimeModalOptions } from "@/components/providers/AnimeModalProvider";

interface QuickViewModalProps {
  anime: Anime | null;
  options?: AnimeModalOptions;
  onClose: () => void;
  onPlayTrailer: (youtubeId?: string | null) => void;
}

export default function QuickViewModal({ anime, options, onClose, onPlayTrailer }: QuickViewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [cast, setCast] = useState<string[]>([]);
  const [fullAnime, setFullAnime] = useState<Anime | null>(anime);
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [activeTab, setActiveTab] = useState<"episodes" | "discussions">(options?.startTab === "discussions" ? "discussions" : "episodes");
  const [isExpanded, setIsExpanded] = useState(false);

  const { openAnime } = useAnimeModal();
  const { toast } = useToast();

  useLockBodyScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch full anime if trailer/synopsis is missing (e.g. from Tracker local state).
  useEffect(() => {
    if (!anime) return;
    let isMounted = true;

    const loadFull = async () => {
      if (anime.trailer && anime.synopsis) {
        setFullAnime(anime);
        return;
      }

      try {
        const full = await getAnimeDetails(anime.mal_id);
        if (isMounted) setFullAnime(full);
      } catch (err) {
        console.error("Failed to load full anime details via AniList:", err);
        try {
          const kitsuFull = await getAnimeDetailsKitsu(anime.mal_id);
          if (isMounted) setFullAnime(kitsuFull);
        } catch (kitsuErr) {
          console.error("Kitsu fallback also failed:", kitsuErr);
        }
      }
    };

    loadFull();
    return () => { isMounted = false; };
  }, [anime]);

  // Fetch cast — AniList first, Jikan characters as backup
  useEffect(() => {
    if (!anime) return;
    let isMounted = true;

    const fetchCast = async () => {
      try {
        const characters = await getAnimeCharacters(anime.mal_id);
        if (isMounted) setCast(characters);
      } catch (err) {
        console.error("Failed to fetch characters via AniList:", err);
      }
    };

    fetchCast();
    return () => { isMounted = false; };
  }, [anime]);

  // Fetch "More Like This" recommendations
  useEffect(() => {
    if (!anime) return;
    let isMounted = true;

    const fetchRecommendationsAsync = async () => {
      try {
        const recs = await getAnimeRecommendations(anime.mal_id);
        if (isMounted) setRecommendations(recs);
      } catch (err) {
        console.error("Failed to load recommendations via AniList:", err);
      }
    };

    fetchRecommendationsAsync();
    return () => { isMounted = false; };
  }, [anime]);

  if (!mounted) return null;

  const displayAnime = fullAnime || anime;



  const title = displayAnime?.title_english || displayAnime?.title || "";
  const bannerUrl = displayAnime?.trailer?.images?.maximum_image_url || displayAnime?.images?.jpg?.large_image_url || displayAnime?.images?.jpg?.image_url;
  const youtubeId = displayAnime ? getYouTubeId(displayAnime.trailer) : null;

  return createPortal(
    <AnimatePresence>
      {displayAnime && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative w-full max-w-4xl bg-[#181818] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-[#404040] z-10 my-8 mx-4 overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/10 shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>

            {/* ═══ BANNER: trailer playing in the background, info overlaid ═══ */}
            <div className="relative w-full h-[300px] sm:h-[400px] md:h-[480px] shrink-0 bg-[#181818] overflow-hidden">
              {/* Blurred high-res backdrop so portrait / letterboxed art still
                  fills the frame richly instead of showing bars or stretching. */}
              {bannerUrl && (
                <img
                  src={bannerUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50"
                />
              )}
              {youtubeId ? (
                <div className="absolute inset-0 w-full h-[150%] -top-[35%] pointer-events-none">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&loop=1&playlist=${youtubeId}&vq=hd1080&hd=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                </div>
              ) : (
                <img
                  src={bannerUrl}
                  alt={title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {/* Netflix-style gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/50 to-transparent pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/80 via-transparent to-transparent pointer-events-none"></div>

              {/* Title + controls + synopsis overlaid on the playing trailer */}
              <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8 md:p-12 pb-6">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="text-3xl md:text-5xl font-black text-white mb-4 drop-shadow-lg max-w-2xl line-clamp-2"
                >
                  {title}
                </motion.h2>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="flex items-center gap-3 mb-4"
                >
                  <button
                    onClick={() => {
                      if (!youtubeId) {
                        toast("No trailer available for this anime.", "error");
                        return;
                      }
                      onClose();
                      onPlayTrailer(youtubeId);
                    }}
                    className="flex items-center gap-2 bg-white text-black px-6 md:px-8 py-2 md:py-2.5 rounded hover:bg-white/80 transition-colors font-bold text-lg"
                  >
                    <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                    Play
                  </button>

                  {displayAnime && <TrackerButton anime={displayAnime} variant="full" />}


                </motion.div>


              </div>
            </div>

            {/* ═══ META + DETAILS ═══ */}
            <div className="p-6 sm:p-8 md:p-12 pt-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-white">
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm md:text-base font-semibold">
                  <span className="text-green-500">{displayAnime.score ? `${(displayAnime.score * 10).toFixed(0)}% Match` : "New"}</span>
                  <span className="text-slate-300">{displayAnime.year || "N/A"}</span>
                  <span className="border border-white/40 text-slate-300 px-1.5 py-0.5 text-xs rounded">
                    {displayAnime.rating ? displayAnime.rating.split('-')[0].trim() : "13+"}
                  </span>
                  <span className="text-slate-300">{displayAnime.episodes ? `${displayAnime.episodes} Episodes` : "Ongoing"}</span>
                  <span className="border border-white/40 text-slate-300 px-1.5 py-0.5 text-xs rounded">HD</span>
                </div>

                {/* Full synopsis for extended reading */}
                <div className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                  {displayAnime?.synopsis ? (
                    <div>
                      <p className={`transition-all ${isExpanded ? "" : "line-clamp-4"}`}>{displayAnime.synopsis}</p>
                      <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-indigo-400 hover:text-indigo-300 font-bold text-sm mt-1 transition-colors"
                      >
                        {isExpanded ? "Show Less" : "See More"}
                      </button>
                    </div>
                  ) : (
                    <p className="italic text-slate-500">No synopsis available.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="text-slate-400">
                  <span className="text-slate-500">Cast: </span>
                  {cast.length > 0 ? (
                    <span className="text-slate-300">{cast.join(", ")}<span className="italic">, more</span></span>
                  ) : (
                    <span className="text-slate-500 italic">Unavailable</span>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  <span className="text-slate-500 w-16">Genres:</span>
                  <span className="text-slate-300">
                    {displayAnime.genres?.map(g => g.name).join(", ") || "Unknown"}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <span className="text-slate-500 w-16">Type:</span>
                  <span className="text-slate-300">
                    {displayAnime.type || "Unknown"}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <span className="text-slate-500 w-16">Studios:</span>
                  <span className="text-slate-300">
                    {displayAnime.studios?.map(s => s.name).join(", ") || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ EPISODES / DISCUSSIONS TABS ═══ */}
            <div className="px-6 sm:px-8 md:px-12 pb-8 border-t border-[#404040]/50 pt-6">
              <div className="flex gap-6 border-b border-white/10 mb-6">
                <button
                  onClick={() => setActiveTab("episodes")}
                  className={`pb-3 font-bold text-base md:text-lg transition-colors border-b-2 -mb-px ${
                    activeTab === "episodes" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Episodes
                </button>
                <button
                  onClick={() => setActiveTab("discussions")}
                  className={`pb-3 font-bold text-base md:text-lg transition-colors border-b-2 -mb-px ${
                    activeTab === "discussions" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Discussions
                </button>
              </div>

              {activeTab === "episodes" ? (
                <EpisodeList 
                  anime={displayAnime} 
                  autoPlayProp={options?.autoPlay} 
                  autoPlayEpProp={options?.startEpisode} 
                />
              ) : (
                <CommunityFeed
                  animeId={displayAnime.mal_id}
                  animeTitle={displayAnime.title_english || displayAnime.title}
                />
              )}
            </div>

            {/* ═══ MORE LIKE THIS ═══ */}
            {recommendations.length > 0 && (
              <div className="px-6 sm:px-8 md:px-12 pb-12 border-t border-[#404040]/50 pt-8">
                <h3 className="text-2xl font-black text-white mb-6">More Like This</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {recommendations.map((rec) => (
                    <button
                      key={rec.mal_id}
                      type="button"
                      onClick={() => openAnime(rec)}
                      className="group bg-[#2f2f2f] rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-colors flex flex-col text-left"
                    >
                      <div className="relative aspect-video overflow-hidden bg-[#1a1a1a]">
                        <img
                          src={(rec.trailer?.images?.maximum_image_url || rec.images?.jpg?.large_image_url || rec.images?.jpg?.image_url || "") as string}
                          alt={rec.title_english || rec.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <div className="w-11 h-11 rounded-full border-2 border-white flex items-center justify-center bg-black/60">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 flex-1 flex flex-col gap-1.5">
                        <h4 className="text-white font-bold text-sm line-clamp-1">{rec.title_english || rec.title}</h4>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {rec.score && <span className="text-green-500">★ {rec.score}</span>}
                          {rec.year && <span className="text-slate-400">{rec.year}</span>}
                          {rec.episodes && <span className="text-slate-400">{rec.episodes} EPS</span>}
                        </div>
                        {rec.synopsis && (
                          <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed">{rec.synopsis}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
