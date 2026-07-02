"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Plus, Check, ThumbsUp } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";

import { useAnimeStatus } from "@/hooks/useAnimeStatus";
import { useToast } from "@/components/ui/Toast";
import { getYouTubeId } from "@/lib/jikan";
import AnimeTabs from "@/components/anime/AnimeTabs";

interface QuickViewModalProps {
  anime: Anime | null;
  onClose: () => void;
  onPlayTrailer: () => void;
}

export default function QuickViewModal({ anime, onClose, onPlayTrailer }: QuickViewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [cast, setCast] = useState<string[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [fullAnime, setFullAnime] = useState<Anime | null>(anime);

  const { getStatus, setStatus } = useAnimeStatus();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch full anime if it's missing trailer data (e.g. from Tracker local state)
  useEffect(() => {
    if (!anime) return;
    let isMounted = true;
    
    // Check if we are missing trailer or synopsis
    if (!anime.trailer || !anime.synopsis) {
      fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}/full`)
        .then(res => res.json())
        .then(data => {
          if (isMounted && data.data) {
            setFullAnime(data.data);
          }
        })
        .catch(err => console.error("Failed to fetch full anime:", err));
    } else {
      setFullAnime(anime);
    }
    
    return () => { isMounted = false; };
  }, [anime]);

  // Fetch cast when anime changes
  useEffect(() => {
    if (!anime) return;
    let isMounted = true;

    async function fetchCast() {
      try {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${anime?.mal_id}/characters`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.data) {
          // Get top 3-4 voice actors/characters
          const castList = data.data
            .slice(0, 4)
            .map((c: any) => c.character.name)
            .filter(Boolean);
          setCast(castList);
        }
      } catch (error) {
        console.error("Failed to fetch cast:", error);
      }
    }

    fetchCast();

    return () => {
      isMounted = false;
    };
  }, [anime]);

  if (!mounted) return null;

  const displayAnime = fullAnime || anime;
  const currentStatus = displayAnime ? getStatus(displayAnime.mal_id) : "None";
  const isInWatchlist = currentStatus !== "None";

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayAnime) return;
    if (isInWatchlist) {
      setStatus(displayAnime, "None");
    } else {
      setStatus(displayAnime, "Watching");
    }
    toast(isInWatchlist ? "Removed from Tracker" : "Added to Tracker", "success");
  };

  const title = displayAnime?.title_english || displayAnime?.title || "";
  const bannerUrl = displayAnime?.trailer?.images?.maximum_image_url || displayAnime?.images?.jpg?.large_image_url || displayAnime?.images?.jpg?.image_url;
  const youtubeId = displayAnime ? getYouTubeId(displayAnime.trailer) : null;

  return createPortal(
    <AnimatePresence>
      {displayAnime && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-12 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] bg-[#181818] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-[#404040] z-10 my-auto overflow-y-auto overflow-x-hidden flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/10 shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Banner Section */}
            <div className="relative w-full h-[300px] sm:h-[400px] md:h-[450px] shrink-0 bg-[#181818] overflow-hidden">
              {youtubeId ? (
                <div className="absolute inset-0 w-full h-[150%] -top-[25%] pointer-events-none">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&loop=1&playlist=${youtubeId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="w-full h-full object-cover opacity-80"
                  />
                </div>
              ) : (
                <img 
                  src={bannerUrl} 
                  alt={title}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Bottom Gradient (Netflix Style) */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/60 to-transparent pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent pointer-events-none"></div>

              {/* Title and Controls positioned at the bottom of the banner */}
              <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 pb-4">
                <h2 className="text-3xl md:text-5xl font-black text-white mb-6 drop-shadow-lg max-w-2xl line-clamp-2">
                  {title}
                </h2>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      onClose();
                      onPlayTrailer();
                    }}
                    className="flex items-center gap-2 bg-white text-black px-6 md:px-8 py-2 md:py-2.5 rounded hover:bg-white/80 transition-colors font-bold text-lg"
                  >
                    <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                    Play
                  </button>
                  
                  <button 
                    onClick={handleToggleWatchlist}
                    className={`w-10 h-10 md:w-11 md:h-11 border-2 flex items-center justify-center rounded-full transition-colors ${
                      isInWatchlist 
                        ? "border-white/50 text-white bg-white/10 hover:border-white hover:bg-white/20" 
                        : "border-white/50 text-white hover:border-white hover:bg-white/10"
                    }`}
                    title="Watchlist"
                  >
                    {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>

                  <button 
                    onClick={() => {
                      setIsLiked(!isLiked);
                      toast(isLiked ? "Removed Like" : "Liked Anime", "success");
                    }}
                    className={`w-10 h-10 md:w-11 md:h-11 border-2 flex items-center justify-center rounded-full transition-colors ${
                      isLiked 
                        ? "border-white text-white bg-white/10" 
                        : "border-white/50 text-white hover:border-white hover:bg-white/10"
                    }`}
                    title="Like"
                  >
                    <ThumbsUp className={`w-4 h-4 md:w-5 md:h-5 ${isLiked ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="p-8 md:p-12 pt-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-white">
              
              {/* Left Column (Meta + Synopsis) */}
              <div className="md:col-span-2 space-y-4">
                
                {/* Meta Info Row */}
                <div className="flex items-center gap-3 text-sm md:text-base font-semibold">
                  <span className="text-green-500">{displayAnime.score ? `${(displayAnime.score * 10).toFixed(0)}% Match` : "New"}</span>
                  <span className="text-slate-300">{displayAnime.year || "N/A"}</span>
                  <span className="border border-white/40 text-slate-300 px-1.5 py-0.5 text-xs rounded">
                    {displayAnime.rating ? displayAnime.rating.split('-')[0].trim() : "13+"}
                  </span>
                  <span className="text-slate-300">{displayAnime.episodes ? `${displayAnime.episodes} Episodes` : "Ongoing"}</span>
                  <span className="border border-white/40 text-slate-300 px-1.5 py-0.5 text-xs rounded">HD</span>
                </div>

                {/* Synopsis */}
                <div className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                  {displayAnime?.synopsis ? (
                    <p className="line-clamp-4">{displayAnime.synopsis}</p>
                  ) : (
                    <p className="italic text-slate-500">No synopsis available.</p>
                  )}
                </div>

              </div>

              {/* Right Column (Cast, Genres, Tags) */}
              <div className="space-y-4 text-sm">
                
                {/* Cast */}
                <div className="text-slate-400">
                  <span className="text-slate-500">Cast: </span>
                  {cast.length > 0 ? (
                    <span className="text-slate-300">{cast.join(", ")}<span className="italic">, more</span></span>
                  ) : (
                    <span className="text-slate-300">Loading...</span>
                  )}
                </div>

                {/* Genres */}
                <div className="flex items-start gap-4">
                  <span className="text-slate-500 w-16">Genres:</span>
                  <span className="text-slate-300">
                    {displayAnime?.genres?.map(g => g.name).join(", ") || "Unknown"}
                  </span>
                </div>
                  
                <div className="flex items-start gap-4">
                  <span className="text-slate-500 w-16">This show is:</span>
                  <span className="text-slate-300">
                    {displayAnime?.demographics?.map(d => d.name).concat(displayAnime?.themes?.map(t => t.name) || []).join(", ") || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Full Details Section Embedded */}
            <div className="px-8 md:px-12 pb-12 pt-4 border-t border-[#404040]/50 mt-4">
              <div className="flex flex-col lg:flex-row gap-12 pt-4">
                {/* Main Info Tabs */}
                <div className="flex-1">
                  <AnimeTabs anime={displayAnime as any} />
                </div>

                {/* Sidebar Stats */}
                <div className="w-full lg:w-80 flex-shrink-0 space-y-6 mt-0 lg:mt-[72px]">
                  <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                    <h3 className="font-bold text-lg mb-4 text-white border-b border-white/10 pb-2">Information</h3>
                    <ul className="space-y-4 text-sm">
                      <li>
                        <span className="text-slate-500 block mb-1">Format</span>
                        <span className="text-slate-200 font-medium">{displayAnime.type || "Unknown"}</span>
                      </li>
                      <li>
                        <span className="text-slate-500 block mb-1">Episodes</span>
                        <span className="text-slate-200 font-medium">{displayAnime.episodes || "Unknown"}</span>
                      </li>
                      <li>
                        <span className="text-slate-500 block mb-1">Duration</span>
                        <span className="text-slate-200 font-medium">{displayAnime.duration || "Unknown"}</span>
                      </li>
                      <li>
                        <span className="text-slate-500 block mb-1">Season</span>
                        <span className="text-slate-200 font-medium capitalize">{displayAnime.season} {displayAnime.year}</span>
                      </li>
                      <li>
                        <span className="text-slate-500 block mb-1">Studios</span>
                        <span className="text-slate-200 font-medium">
                          {displayAnime.studios?.map(s => s.name).join(", ") || "Unknown"}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}


