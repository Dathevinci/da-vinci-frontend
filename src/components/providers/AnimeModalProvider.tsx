"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Anime } from "@tutkli/jikan-ts";
import QuickViewModal from "@/components/ui/QuickViewModal";
import TrailerModal from "@/components/ui/TrailerModal";
import { getYouTubeId, getAnimeDetailsAniList } from "@/lib/jikan";

// A single app-wide Netflix-style popup. Any anime click anywhere in the app
// (cards, search results, "More Like This") calls openAnime() to open it in
// place, instead of navigating to the standalone /anime/[id] page. That page
// still exists for direct URLs, but in-app browsing never leaves the feed.
export interface AnimeModalOptions {
  startEpisode?: number;
  autoPlay?: boolean;
  startTab?: "episodes" | "discussions";
}

interface AnimeModalContextValue {
  openAnime: (anime: Anime, options?: AnimeModalOptions) => void;
  closeAnime: () => void;
}

const AnimeModalContext = createContext<AnimeModalContextValue>({
  openAnime: () => {},
  closeAnime: () => {},
});

export const useAnimeModal = () => useContext(AnimeModalContext);

// Opens the popup from a URL like ?view=<animeId>&tab=discussions — e.g. when a
// user clicks a "liked your comment" notification. It fetches the anime, opens
// the modal (on the Discussions tab), then strips the params so closing it
// leaves a clean URL and never re-opens.
function AnimeModalUrlWatcher({ onOpen }: { onOpen: (a: Anime, opts?: AnimeModalOptions) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const view = searchParams.get("view");
    if (!view) {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === view) return;
    handledRef.current = view;

    const tab = searchParams.get("tab");
    (async () => {
      try {
        const anime = await getAnimeDetailsAniList(Number(view));
        if (anime) onOpen(anime, { startTab: tab === "discussions" ? "discussions" : undefined });
      } catch (e) {
        /* ignore — a bad id just leaves the current page */
      }
      // Strip the trigger params so the URL is clean and closing the modal
      // doesn't re-open it.
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.delete("view");
      sp.delete("tab");
      const qs = sp.toString();
      router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
    })();
  }, [searchParams, onOpen, router, pathname]);

  return null;
}

export default function AnimeModalProvider({ children }: { children: React.ReactNode }) {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [options, setOptions] = useState<AnimeModalOptions | undefined>();
  const [trailerId, setTrailerId] = useState<string | null>(null);

  const openAnime = useCallback((a: Anime, opts?: AnimeModalOptions) => {
    setAnime(a);
    setOptions(opts);
  }, []);
  const closeAnime = useCallback(() => {
    setAnime(null);
    setOptions(undefined);
  }, []);

  return (
    <AnimeModalContext.Provider value={{ openAnime, closeAnime }}>
      {children}

      <Suspense fallback={null}>
        <AnimeModalUrlWatcher onOpen={openAnime} />
      </Suspense>

      {anime && (
        // Keyed by id so swapping to a recommendation fully remounts with fresh
        // data and scroll position rather than showing stale content.
        <QuickViewModal
          key={anime.mal_id}
          anime={anime}
          options={options}
          onClose={closeAnime}
          // The modal fetches full details (the card's anime may be a minimal
          // record from the Tracker/Liked list with no trailer), so it passes
          // back the resolved trailer id. Fall back to the card's own trailer.
          onPlayTrailer={(youtubeId) => setTrailerId(youtubeId ?? getYouTubeId(anime.trailer))}
        />
      )}

      <TrailerModal videoId={trailerId} onClose={() => setTrailerId(null)} />
    </AnimeModalContext.Provider>
  );
}
