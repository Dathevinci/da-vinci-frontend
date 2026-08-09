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
  startTab?: "episodes" | "discussions" | "morelike";
  /** Seconds to resume from — the Netflix-style "pick up where you left off". */
  startSeconds?: number;
  /** When true, auto-select the davinci torrent server for 4K playback. */
}

interface AnimeModalContextValue {
  openAnime: (anime: Anime, options?: AnimeModalOptions) => void;
  closeAnime: () => void;
  /** Step back to the anime this one was opened FROM, if any. */
  backAnime: () => void;
  canGoBack: boolean;
}

const AnimeModalContext = createContext<AnimeModalContextValue>({
  openAnime: () => {},
  closeAnime: () => {},
  backAnime: () => {},
  canGoBack: false,
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
    if (!view || isNaN(Number(view))) {
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
  /**
   * THE TRAIL OF HOW YOU GOT HERE.
   *
   * The modal used to be a single slot: opening a show from "More Like This"
   * REPLACED the one you were browsing, so closing dumped you back at the feed
   * and re-checking that list meant re-finding the first show and starting
   * over. Each in-modal hop now pushes the current show here, and the back
   * arrow pops it — restored onto its More Like This tab, because a hop is
   * the only way an in-modal open happens, so that tab is where you were.
   *
   * Capped so a long wander can't grow it forever; losing the far end of a
   * ten-hop trail is nothing.
   */
  const [stack, setStack] = useState<{ anime: Anime; options?: AnimeModalOptions }[]>([]);
  const routePath = usePathname();

  // openAnime stays identity-stable (deps: []), so the current show is read
  // through refs rather than closure.
  const animeRef = useRef<Anime | null>(null);
  const optionsRef = useRef<AnimeModalOptions | undefined>(undefined);
  animeRef.current = anime;
  optionsRef.current = options;

  const openAnime = useCallback((a: Anime, opts?: AnimeModalOptions) => {
    const prev = animeRef.current;
    if (prev && prev.mal_id !== a.mal_id) {
      setStack((s) =>
        [...s, { anime: prev, options: { ...optionsRef.current, startTab: "morelike" as const } }].slice(-10)
      );
    }
    setAnime(a);
    setOptions(opts);
  }, []);
  const closeAnime = useCallback(() => {
    setAnime(null);
    setOptions(undefined);
    setStack([]);
  }, []);
  const backAnime = useCallback(() => {
    setStack((s) => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      setAnime(last.anime);
      setOptions(last.options);
      return s.slice(0, -1);
    });
  }, []);

  /**
   * NAVIGATING AWAY CLOSES IT.
   *
   * The detail screen sits below the Dock now, so its navigation is
   * reachable while the screen is open — and nothing was dismissing the
   * screen on a route change, leaving an opaque full-page overlay
   * stranded on top of wherever you just went. Skipped on the very first
   * render so a deep link (?view=…) still opens.
   */
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return; }
    setAnime(null);
    setOptions(undefined);
    setTrailerId(null);
    setStack([]);
  }, [routePath]);

  return (
    <AnimeModalContext.Provider value={{ openAnime, closeAnime, backAnime, canGoBack: stack.length > 0 }}>
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
          onBack={stack.length > 0 ? backAnime : undefined}
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
