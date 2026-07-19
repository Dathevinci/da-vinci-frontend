"use client";

import { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown, PlayCircle } from 'lucide-react';
import { Anime } from '@tutkli/jikan-ts';
import AnimeStatusBadge from './AnimeStatusBadge';
import { motion, AnimatePresence } from 'framer-motion';
import TrackerButton from '@/components/anime/TrackerButton';
import { useAnimeModal } from '@/components/providers/AnimeModalProvider';
import { usePreferences } from '@/hooks/usePreferences';

interface ContinueWatchingCardProps {
  anime: Anime;
}

export default function ContinueWatchingCard({ anime }: ContinueWatchingCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { openAnime } = useAnimeModal();
  const { preferences } = usePreferences();

  const title = anime.title_english || anime.title || "Unknown Anime";
  const image = anime.trailer?.images?.maximum_image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;

  const [progressPercent, setProgressPercent] = useState(0);
  const [savedEpisodeNo, setSavedEpisodeNo] = useState<number | null>(null);

  useEffect(() => {
    const data = localStorage.getItem(`davinci_progress_${anime.mal_id}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.duration > 0 && parsed.currentTime > 0) {
          setProgressPercent(Math.min(100, (parsed.currentTime / parsed.duration) * 100));
        }
        if (parsed.episodeNo) {
          setSavedEpisodeNo(parsed.episodeNo);
        }
      } catch(e) {}
    }
  }, [anime.mal_id]);

  const closeHover = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };

  const handleOpen = () => {
    closeHover();
    openAnime(anime);
  };

  const handlePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    closeHover();
    openAnime(anime, { 
      startEpisode: savedEpisodeNo || undefined, 
      autoPlay: true 
    });
  };

  useEffect(() => {
    if (!isHovered) return;
    const dismiss = () => closeHover();
    window.addEventListener("scroll", dismiss, { passive: true });
    return () => window.removeEventListener("scroll", dismiss);
  }, [isHovered]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleMouseEnter = () => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      if (rect.left < 60) setTransformOrigin("left center");
      else if (rect.right > viewportWidth - 60) setTransformOrigin("right center");
      else setTransformOrigin("center center");
    }

    timeoutRef.current = setTimeout(() => setIsHovered(true), 400);
  };

  const handleMouseLeave = () => closeHover();

  const isSensitive = preferences.blurSensitiveContent && 
    (anime.rating?.includes("Rx") || anime.rating?.includes("R+ ") || anime.genres?.some(g => g.name === 'Hentai' || g.name === 'Ecchi' || g.name === 'Erotica') || anime.title.toLowerCase().includes('hentai'));

  return (
    <div 
      ref={cardRef}
      className="relative w-[280px] md:w-[340px] aspect-video flex-shrink-0 snap-start"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Card */}
      <button
        type="button"
        onClick={() => handlePlay()}
        className="absolute inset-0 rounded-xl overflow-hidden bg-[#141414] border border-white/5 transition-all duration-300 group cursor-pointer block text-left outline-none"
      >
        <img
          src={image}
          alt={title}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isSensitive ? 'blur-2xl scale-125 brightness-50' : ''}`}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300"></div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-90 group-hover:scale-100">
          <PlayCircle className="w-14 h-14 text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] fill-purple-500/20" strokeWidth={1.5} />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 pb-5">
          <h3 className="text-white font-bold text-sm md:text-base line-clamp-1 drop-shadow-md mb-2">
            {title}
          </h3>
          <div className="flex items-center justify-between gap-2">
            <span className="bg-purple-600 text-white text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded shadow-[0_0_10px_rgba(147,51,234,0.5)]">
              {savedEpisodeNo ? `Ep ${savedEpisodeNo}` : 'Continue'}
            </span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
          <div 
            className="h-full bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.8)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </button>

      {/* Netflix Pop-Out Card */}
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
            <div onClick={() => handlePlay()} className="block w-full h-full relative cursor-pointer">
              <img
                src={image}
                alt={title}
                className={`absolute inset-0 object-cover w-full h-full transition-all duration-300 ${isSensitive ? 'blur-2xl scale-125 brightness-50' : ''}`}
              />
              
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-1 z-10">
                <span className="bg-purple-600 text-white text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded shadow-[0_0_10px_rgba(147,51,234,0.5)]">
                  {savedEpisodeNo ? `Ep ${savedEpisodeNo}` : 'Continue'}
                </span>
                <AnimeStatusBadge status={anime.status || "Unknown"} />
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent flex flex-col justify-end p-4">
                <h3 className="font-black text-sm md:text-base text-white leading-tight drop-shadow-md line-clamp-1 mb-2">
                  {title}
                </h3>
                
                <div className="flex items-center gap-1.5 mb-2 relative z-50">
                   <button
                     onClick={handlePlay}
                     className="w-7 h-7 md:w-8 md:h-8 bg-white text-black flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
                     title="Resume Episode"
                   >
                     <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current ml-0.5" />
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
                
                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold mb-1.5">
                  {anime.score && <span className="text-green-400">{anime.score} Score</span>}
                  <span className="border border-white/20 px-1 py-0.5 rounded text-slate-200">{anime.type || "TV"}</span>
                  <span className="text-slate-200">{anime.episodes ? `${anime.episodes} EPS` : 'Ongoing'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {(anime.genres || []).slice(0, 3).map((g: any, i: number) => (
                    <div key={g.name} className="flex items-center gap-1">
                      <span className="text-[9px] md:text-[10px] text-slate-300 font-medium">{g.name}</span>
                      {i < Math.min((anime.genres || []).length, 3) - 1 && <span className="text-slate-600 text-[8px]">●</span>}
                    </div>
                  ))}
                </div>

                {/* Progress bar inside popup */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.8)]" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
