"use client";

import { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown } from 'lucide-react';
import { Anime } from '@tutkli/jikan-ts';
import AnimeStatusBadge from './AnimeStatusBadge';
import { motion, AnimatePresence } from 'framer-motion';
import TrackerButton from '@/components/anime/TrackerButton';
import { useToast } from '@/components/ui/Toast';
import { useAnimeModal } from '@/components/providers/AnimeModalProvider';
import TrailerModal from '../ui/TrailerModal';
import { getYouTubeId, getAnimeTrailer } from '@/lib/jikan';
import { usePreferences } from '@/hooks/usePreferences';

interface AnimeCardProps {
  anime: Anime;
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [trailerVideoId, setTrailerVideoId] = useState<string | null>(null);
  const [resolvingTrailer, setResolvingTrailer] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { openAnime } = useAnimeModal();
  const { toast } = useToast();
  const { preferences } = usePreferences();

  const closeHover = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };

  // The pop-out is a hover-only affordance. When a fullscreen modal or the
  // player mounts over the card, the pointer never fires mouseleave on the
  // card, so the pop-out would stay stuck open on return — force it closed
  // whenever the trailer is open. Also close it on scroll (Netflix behaviour)
  // so it can't linger over the wrong card, and clear any pending open timer
  // on unmount.
  useEffect(() => {
    if (trailerVideoId) closeHover();
  }, [trailerVideoId]);

  const handleOpen = () => {
    closeHover();
    openAnime(anime);
  };

  // Play the trailer. Cards coming from the Tracker/Liked lists are minimal
  // records with no trailer data, so if none is present locally we fetch the
  // full details (Jikan by MAL id) to resolve the YouTube id on demand — this
  // is why the trailer worked on the home feed but not on the profile.
  const playTrailer = async () => {
    const localId = getYouTubeId(anime.trailer);
    if (localId) {
      setTrailerVideoId(localId);
      return;
    }
    setResolvingTrailer(true);
    try {
      const resolved = await getAnimeTrailer(anime.mal_id);
      if (resolved) {
        setTrailerVideoId(resolved);
      } else {
        toast("No trailer available for this anime.", "error");
      }
    } catch {
      toast("No trailer available for this anime.", "error");
    } finally {
      setResolvingTrailer(false);
    }
  };

  useEffect(() => {
    if (!isHovered) return;
    const dismiss = () => closeHover();
    window.addEventListener("scroll", dismiss, { passive: true });
    return () => window.removeEventListener("scroll", dismiss);
  }, [isHovered]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleMouseEnter = () => {
    // Only fine pointers (mouse/trackpad) get the hover pop-out. On touch
    // devices there is no mouseleave, which is exactly how it got stuck open.
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      // Prevent screen bleeding by dynamically shifting the popout origin
      if (rect.left < 60) {
        setTransformOrigin("left center");
      } else if (rect.right > viewportWidth - 60) {
        setTransformOrigin("right center");
      } else {
        setTransformOrigin("center center");
      }
    }

    timeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 400); // 400ms delay to prevent chaotic popping on fast swipes
  };

  const handleMouseLeave = () => {
    closeHover();
  };

  const title = anime.title_english || anime.title;
  const imageUrl: string = (anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80") as string;
  const isSensitive = preferences.blurSensitiveContent && 
    (anime.rating?.includes("Rx") || anime.rating?.includes("R+ ") || anime.genres?.some(g => g.name === 'Hentai' || g.name === 'Ecchi' || g.name === 'Erotica') || anime.title.toLowerCase().includes('hentai'));

  return (
    <div 
      ref={cardRef}
      className="relative w-[160px] md:w-[220px] aspect-[2/3] flex-shrink-0 snap-start"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/*
        BASE CARD — tapping opens the Netflix-style popup in place (works on
        touch devices, which no longer get the hover pop-out). No backdrop-blur:
        the opaque cover image sits on top of it, so the blur did nothing but
        cost paint time per card while scrolling.
      */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`View ${title}`}
        className="absolute inset-0 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-white/5 cursor-pointer block text-left"
      >
        <img src={imageUrl} alt={title} loading="lazy" referrerPolicy="no-referrer" className={`object-cover w-full h-full transition-all duration-300 ${isSensitive ? 'blur-2xl scale-110 brightness-50' : ''}`} />
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
          <AnimeStatusBadge status={anime.status || "Unknown"} />
          {anime.score && (
            <span className="bg-indigo-/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md">
              ★ {anime.score}
            </span>
          )}
        </div>
      </button>

      {/* 
        NETFLIX POP-OUT CARD 
      */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1.15, zIndex: 50 }}
            exit={{ opacity: 0, scale: 1, zIndex: 50 }}
            transition={{ type: "tween", duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-[#141414] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-white/20 flex flex-col cursor-pointer will-change-transform"
            style={{ transformOrigin }}
          >
            <div onClick={handleOpen} className="block w-full h-full relative cursor-pointer">
              <img
                src={imageUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className={`absolute inset-0 object-cover w-full h-full transition-all duration-300 ${isSensitive ? 'blur-2xl scale-110 brightness-50' : ''}`}
              />
              
              {/* Inner Badges */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
                <AnimeStatusBadge status={anime.status || "Unknown"} />
              </div>

              {/* Gradient Overlay for Content */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent flex flex-col justify-end p-3 pb-4">
                
                <h3 className="font-black text-sm md:text-base text-white leading-tight drop-shadow-md line-clamp-2 mb-2">
                  {title}
                </h3>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 mb-2 relative z-50">
                   {/* Play Trailer Button */}
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       playTrailer();
                     }}
                     disabled={resolvingTrailer}
                     className="w-7 h-7 md:w-8 md:h-8 bg-white text-black flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors disabled:opacity-60"
                     title="Play Trailer"
                   >
                     {resolvingTrailer
                       ? <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                       : <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current ml-0.5" />}
                   </button>

                   <TrackerButton anime={anime} variant="icon" />



                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       handleOpen();
                     }}
                     className="w-7 h-7 md:w-8 md:h-8 border-2 border-slate-400 text-white flex items-center justify-center rounded-full hover:border-white hover:bg-white/10 transition-colors ml-auto"
                     title="More Info"
                   >
                     <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                   </button>
                </div>
                
                {/* Metadata */}
                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold mb-1.5">
                  {anime.score && <span className="text-green-400">{anime.score} Score</span>}
                  <span className="border border-white/20 px-1 py-0.5 rounded text-slate-200">{anime.type || "TV"}</span>
                  <span className="text-slate-200">{anime.episodes ? `${anime.episodes} EPS` : (anime.status?.toLowerCase() === 'upcoming' || anime.status?.toLowerCase() === 'not_yet_released' ? 'Upcoming' : 'Ongoing')}</span>
                </div>

                {/* Genres */}
                <div className="flex flex-wrap items-center gap-1">
                  {(anime.genres || []).slice(0, 3).map((g: any, i: number) => (
                    <div key={g.name} className="flex items-center gap-1">
                      <span className="text-[9px] md:text-[10px] text-slate-300 font-medium">{g.name}</span>
                      {i < Math.min((anime.genres || []).length, 3) - 1 && <span className="text-slate-600 text-[8px]">●</span>}
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trailer modal — only mounted while a trailer is actually playing, so
          the home feed doesn't carry ~150 idle portals (one per card). */}
      {trailerVideoId && (
        <TrailerModal
          videoId={trailerVideoId}
          onClose={() => setTrailerVideoId(null)}
        />
      )}
    </div>
  );
}
