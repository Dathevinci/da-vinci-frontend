"use client";

import { Anime } from '@tutkli/jikan-ts';
import AnimeStatusBadge from './AnimeStatusBadge';
import HoverPreview from './HoverPreview';
import { useAnimeModal } from '@/components/providers/AnimeModalProvider';
import { usePreferences } from '@/hooks/usePreferences';

interface AnimeCardProps {
  anime: Anime;
  is4K?: boolean;
}

/**
 * ONE ANIME CARD. Hovering it summons the floating dossier (HoverPreview —
 * follows the mouse, plays the trailer on a long hover); clicking opens
 * the detail screen. The old in-place Netflix pop-out is retired: two
 * competing hover surfaces on one card fought each other, and the
 * reference design is the follower panel.
 */
export default function AnimeCard({ anime, is4K }: AnimeCardProps) {
  const { openAnime } = useAnimeModal();
  const { preferences } = usePreferences();

  const title = anime.title_english || anime.title;
  const imageUrl: string = (anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80") as string;
  const isSensitive = preferences.blurSensitiveContent &&
    (anime.rating?.includes("Rx") || anime.rating?.includes("R+ ") || anime.genres?.some(g => g.name === 'Hentai' || g.name === 'Ecchi' || g.name === 'Erotica') || anime.title.toLowerCase().includes('hentai'));

  return (
    <HoverPreview anime={anime}>
      <div className="relative w-[160px] md:w-[220px] aspect-[2/3] flex-shrink-0 snap-start">
        <button
          type="button"
          onClick={() => openAnime(anime, is4K ? { preferDavinci: true } : undefined)}
          aria-label={`View ${title}`}
          className="absolute inset-0 block cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left shadow-lg transition-transform duration-300 hover:scale-[1.03]"
        >
          <img src={imageUrl} alt={title} loading="lazy" referrerPolicy="no-referrer" className={`h-full w-full object-cover transition-all duration-300 ${isSensitive ? 'blur-2xl scale-110 brightness-50' : ''}`} />
          <div className="absolute left-2 right-2 top-2 z-10 flex items-start justify-between gap-1">
            <AnimeStatusBadge status={anime.status || "Unknown"} />
            {anime.score && (
              <span className="rounded bg-purple-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                ★ {anime.score}
              </span>
            )}
          </div>
          {is4K && (
            <div className="absolute bottom-2 left-2 z-10 rounded bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-2 py-0.5 text-[9px] font-black uppercase text-slate-950 shadow-lg tracking-wider border border-yellow-200/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
              4K UHD
            </div>
          )}
        </button>
      </div>
    </HoverPreview>
  );
}
