"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import DavinciPlayer from "./DavinciPlayer";
import { getAnikotoStreamUrl, getAnikotoStreamUrlFast, AnikotoEpisode, AnikotoStreamResult } from "@/lib/anikoto";
import { X, ChevronLeft, ChevronRight, Loader2, AlertCircle, Server, PlayCircle, List, ChevronDown, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv, ArrowLeft, Flag, RotateCcw, RotateCw } from "lucide-react";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { useAnimeStatus } from "@/hooks/useAnimeStatus";
import { authHeaders } from "@/lib/authToken";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const EPISODES_PER_SEASON = 12;

interface WatchOverlayProps {
  anime: { mal_id: number; title: string; title_english?: string; images?: any };
  consumetAnimeId: string | null;
  initialEpisodeId: string;
  initialEpisodeNo: number;
  /** Seconds to resume this episode from. Null/0 starts at the beginning. */
  initialSeconds?: number | null;
  allEpisodes: AnikotoEpisode[];
  onClose: () => void;
  /**
   * Inline mode: render as a normal aspect-video block inside a page (the
   * /watch route) instead of a fullscreen portal. Skips the body-scroll
   * lock and the Escape-closes-everything behaviour; the fullscreen button
   * still works because containerRef stays on the wrapper.
   */
  inline?: boolean;
  /** Fires when the native video reaches its end (auto-next lives upstairs). */
  onEnded?: () => void;
}

export default function WatchOverlay({
  anime,
  consumetAnimeId,
  initialEpisodeId,
  initialEpisodeNo,
  initialSeconds = null,
  allEpisodes,
  onClose,
  inline = false,
  onEnded,
}: WatchOverlayProps) {
  const { addXpForWatching, user } = useUser();
  const { isTracked, setStatus } = useAnimeStatus();
  // Current state
  const [activeEpisode, setActiveEpisode] = useState<AnikotoEpisode | null>(null);
  const [activeEpisodeNo, setActiveEpisodeNo] = useState(initialEpisodeNo);
  const [streamData, setStreamData] = useState<AnikotoStreamResult | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeSourceObj, setActiveSourceObj] = useState<{ url: string; isM3U8: boolean; isEmbed?: boolean } | null>(null);
  const [streamType, setStreamType] = useState<"sub" | "dub">("sub");
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [isBrowser, setIsBrowser] = useState(false);

  // UI state
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);
  const [showServerPanel, setShowServerPanel] = useState(false);
  const [activeSeason, setActiveSeason] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Throttle refs for high-frequency video events to save CPU
  const lastTimeUpdateRef = useRef(0);
  const lastProgressUpdateRef = useRef(0);
  // Inline mode: is the pointer over the player? Gates the Space shortcut.
  const hoverRef = useRef(false);

  // Playback state (for the custom Netflix-style controls).
  // Starts FALSE: a blocked autoplay fires no `pause` event, so seeding
  // this true left the UI insisting it was playing — pause overlay never
  // shown, a Pause icon on a stopped video, and the controls auto-hiding
  // after 4s into a black rectangle.
  const [isPlaying, setIsPlaying] = useState(false);
  /** Autoplay only survived by muting — offer one tap to get sound back. */
  const [needsUnmute, setNeedsUnmute] = useState(false);
  /** Even muted autoplay was refused: only a real tap will start it. */
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  /**
   * Where to resume the CURRENT episode from.
   *
   * Prefers the value passed in from Continue Watching, but falls back to the
   * locally saved position — so reopening an episode any other way (the episode
   * list, a direct link) also picks up where you left off, which is what makes
   * this feel like Netflix rather than a one-off shortcut.
   *
   * Only ever resumes the episode the position actually belongs to.
   */
  const [resumeTarget, setResumeTarget] = useState<number | null>(
    initialSeconds && initialSeconds > 0 ? initialSeconds : null
  );
  const resumeAppliedRef = useRef(false);

  useEffect(() => {
    // A new episode means the old position is meaningless.
    resumeAppliedRef.current = false;

    if (activeEpisodeNo === initialEpisodeNo && initialSeconds && initialSeconds > 0) {
      setResumeTarget(initialSeconds);
      return;
    }
    try {
      const raw = localStorage.getItem(`davinci_progress_${anime.mal_id}`);
      const saved = raw ? JSON.parse(raw) : null;
      setResumeTarget(
        saved && saved.episodeNo === activeEpisodeNo && saved.currentTime > 0 ? saved.currentTime : null
      );
    } catch {
      setResumeTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEpisodeNo, anime.mal_id]);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Lock body scroll — only as a fullscreen overlay; the inline page scrolls.
  useEffect(() => {
    if (!isBrowser || inline) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isBrowser, inline]);

  const lastStorageUpdateRef = useRef(0);
  const serversListRef = useRef<any[]>([]);

  /**
   * Auto-add to the tracker once you've genuinely started an episode, so
   * "Continue watching" picks up anything you left partway through without
   * needing to tap Add to Tracker first.
   *
   * This was previously disabled because it fired on OPEN — merely clicking an
   * anime dumped it into your tracker, so browsing polluted the list. The fix
   * isn't to leave it off, it's to require real playback: AUTO_TRACK_AFTER
   * seconds of actual watching separates "I'm watching this" from "I clicked it
   * and bounced".
   *
   * Only ever ADDS. If the anime is already tracked we leave it completely alone,
   * so this can't overwrite a status the user set deliberately.
   */
  // 15s: long enough to ignore a misclick, short enough that anything you
  // genuinely sat down to watch lands on the home feed. 60s was too strict —
  // Netflix shows a title in Continue Watching almost immediately.
  const AUTO_TRACK_AFTER = 15; // seconds of playback
  const autoTrackedRef = useRef(false);

  const track = useCallback(() => {
    if (autoTrackedRef.current) return;
    // Latch before the async work so repeated triggers can't queue several
    // identical writes.
    autoTrackedRef.current = true;
    if (isTracked(anime.mal_id)) return;
    setStatus(anime, "Watching");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime.mal_id]);

  // Native <video>: track once real playback passes the threshold.
  useEffect(() => {
    if (!hasStarted || currentTime < AUTO_TRACK_AFTER) return;
    track();
  }, [hasStarted, currentTime, track]);

  /**
   * Embedded sources: track on a timer instead.
   *
   * Many sources play inside an <iframe> (see the isEmbed branch in the player
   * below), and an iframe fires NO onPlay and NO onTimeUpdate — so hasStarted
   * stays false and currentTime stays 0 no matter how long you watch. The
   * playback-based rule above could never fire for them, which is why anime
   * watched on an embed never appeared in Continue Watching at all.
   *
   * We genuinely cannot see inside the iframe, so this uses the best signal
   * available: the episode has been open for a while. Longer than the playback
   * threshold precisely because it's a weaker signal — it should not fire for
   * someone who opened an episode and immediately closed it.
   */
  const EMBED_TRACK_AFTER_MS = 45_000;

  useEffect(() => {
    if (!activeSourceObj?.isEmbed) return;
    const t = setTimeout(track, EMBED_TRACK_AFTER_MS);
    return () => clearTimeout(t);
  }, [activeSourceObj?.isEmbed, track]);

  /**
   * WHICH episode you're on is written immediately and unthrottled.
   *
   * This used to share the throttled effect below, so switching episodes within
   * 5s of the last write silently dropped the new episode number and Continue
   * Watching kept showing the previous one. Worse, that effect spread
   * `...existingObj` forward, so the old episode's currentTime/duration were
   * re-attributed to the new episode and the progress bar was wrong too.
   *
   * Position is throttled because it fires on every timeupdate; episode identity
   * is a rare, important event and must never be dropped.
   */
  useEffect(() => {
    if (activeEpisodeNo == null) return;
    try {
      const existing = localStorage.getItem(`davinci_progress_${anime.mal_id}`);
      const existingObj = existing ? JSON.parse(existing) : {};

      // Only carry the saved position forward when it belongs to THIS episode.
      const sameEpisode = existingObj.episodeNo === activeEpisodeNo;

      localStorage.setItem(
        `davinci_progress_${anime.mal_id}`,
        JSON.stringify({
          episodeId: activeEpisode?.id,
          episodeNo: activeEpisodeNo,
          currentTime: sameEpisode ? existingObj.currentTime : 0,
          duration: sameEpisode ? existingObj.duration : 0,
          timestamp: Date.now(),
        })
      );
      // Continue Watching cards read localStorage once on mount, and closing this
      // overlay doesn't remount them — without this they'd stay stale until a
      // full page load.
      window.dispatchEvent(new CustomEvent("davinci:progress", { detail: { malId: anime.mal_id } }));
    } catch (e) {}

    // Mirror the episode to the server so the resume point survives this browser.
    // Fire-and-forget: a failed save must never interrupt playback.
    if (user?.id) {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API}/api/watchlist/progress`, {
        method: "POST",
        headers: authHeaders(),
        // anilistId is the column name but it stores the MAL id — see
        // useAnimeStatus.ts. Sending mal_id is correct, not a bug.
        body: JSON.stringify({ userId: user.id, anilistId: anime.mal_id, episode: activeEpisodeNo }),
      }).catch(() => {});
    }
  }, [activeEpisode, activeEpisodeNo, anime.mal_id, user?.id]);

  useEffect(() => {
    const now = Date.now();
    if (hasStarted && now - lastStorageUpdateRef.current > 5000) {
      try {
        const existing = localStorage.getItem(`davinci_progress_${anime.mal_id}`);
        const existingObj = existing ? JSON.parse(existing) : {};

        const progressObj = {
          ...existingObj,
          episodeId: activeEpisode?.id,
          episodeNo: activeEpisodeNo,
          timestamp: now
        };

        if (currentTime > 0 && duration > 0) {
          progressObj.currentTime = currentTime;
          progressObj.duration = duration;
        }

        localStorage.setItem(`davinci_progress_${anime.mal_id}`, JSON.stringify(progressObj));
        lastStorageUpdateRef.current = now;
        window.dispatchEvent(new CustomEvent("davinci:progress", { detail: { malId: anime.mal_id } }));

        // Mirror the position too, on the same 5s throttle, so the % bar survives
        // this browser. Fire-and-forget — never block playback on a network call.
        if (user?.id && currentTime > 0 && duration > 0) {
          const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          fetch(`${API}/api/watchlist/progress`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              userId: user.id,
              anilistId: anime.mal_id,
              episode: activeEpisodeNo,
              seconds: Math.floor(currentTime),
              duration: Math.floor(duration),
            }),
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }, [hasStarted, currentTime, duration, activeEpisode, activeEpisodeNo, anime.mal_id, user?.id]);

  // Toggle play/pause on the underlying video element
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const skipTime = useCallback((amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + amount));
  }, []);

  // Escape key to close, Space to play/pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Never hijack typing — the inline page has search inputs and the
      // comment composer; a global Space here was eating every space
      // character AND toggling playback.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") {
        if (showEpisodePanel) setShowEpisodePanel(false);
        else if (showServerPanel) setShowServerPanel(false);
        else if (!inline) onClose(); // inline: Escape closing panels, never the page
      } else if (e.code === "Space" && !showEpisodePanel && !showServerPanel) {
        // Inline: Space belongs to the player only while the pointer is
        // over it — elsewhere the page keeps Space-to-scroll.
        if (inline && !hoverRef.current) return;
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, showEpisodePanel, showServerPanel, togglePlay, inline]);

  // Auto-hide controls — but always stay visible while paused, like Netflix
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (!isPlaying) return;
    controlsTimerRef.current = setTimeout(() => {
      if (!showEpisodePanel && !showServerPanel) setControlsVisible(false);
    }, 4000);
  }, [showEpisodePanel, showServerPanel, isPlaying]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [resetControlsTimer]);

  // Track native fullscreen state so the toggle button icon stays in sync
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleVolumeChange = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
  }, []);

  const handleSeek = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }, []);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Load stream for an episode
  const loadStream = useCallback(async (episodeId: string, episodeNo: number, overrideType?: "sub" | "dub", server?: string) => {
    const typeToUse = overrideType || streamType;
    setLoadingStream(true);
    setStreamError(null);
    setStreamData(null);
    setActiveEpisodeNo(episodeNo);
    setHasStarted(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);

    // Find the episode object
    const ep = allEpisodes.find(e => e.id === episodeId) || null;
    setActiveEpisode(ep);

    // Calculate season
    setActiveSeason(Math.floor((episodeNo - 1) / EPISODES_PER_SEASON));

    try {
      if (!consumetAnimeId) {
        setStreamError("This anime isn't in our streaming library yet. Try another anime or check back later.");
        return;
      }

      // Use the fast path when the episode object already has serverIds (avoids re-fetching episodes)
      const epObj = allEpisodes.find(e => e.number === episodeNo) ?? allEpisodes[episodeNo - 1];
      const serverIds = (epObj as any)?.serverIds as string | undefined;

      let data;
      if (server === "davinci") {
        // Query the local backend torrent search API
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const titleQuery = anime.title_english || anime.title;
        const res = await fetch(`${API_URL}/api/torrent/search?title=${encodeURIComponent(titleQuery)}&ep=${episodeNo}`);
        const json = await res.json();
        
        if (!json.success || !json.data) {
          setStreamError(`No torrent found for Episode ${episodeNo} on Davinci server.`);
          return;
        }

        let serversToUse = serversListRef.current;
        if (serversToUse.length <= 1) {
          try {
            const baseData = serverIds
              ? await getAnikotoStreamUrlFast(consumetAnimeId, episodeNo, serverIds, typeToUse, "vidstream")
              : await getAnikotoStreamUrl(consumetAnimeId, episodeNo, typeToUse, "vidstream");
            if (baseData?.servers) {
              serversToUse = baseData.servers;
              serversListRef.current = baseData.servers;
            }
          } catch (e) {
            console.warn("Failed to fetch backup servers", e);
          }
        }

        data = {
          sources: [{
            url: `${API_URL}/api/torrent/stream?magnet=${encodeURIComponent(json.data.link)}`,
            quality: "auto",
            isM3U8: false,
            isEmbed: false,
          }],
          serverName: "davinci",
          servers: serversToUse.length > 0 ? serversToUse : [{ name: "davinci", type: "sub" }],
        };
      } else {
        data = serverIds
          ? await getAnikotoStreamUrlFast(consumetAnimeId, episodeNo, serverIds, typeToUse, server)
          : await getAnikotoStreamUrl(consumetAnimeId, episodeNo, typeToUse, server);
      }

      if (!data || !data.sources || data.sources.length === 0) {
        setStreamError(`No stream found for Episode ${episodeNo}. Try switching Sub/Dub or selecting a different episode.`);
        return;
      }
      // Inject davinci into available servers if not present
      if (!data.servers) data.servers = [];
      if (!data.servers.some((s: any) => s.name === "davinci")) {
        data.servers.push({ name: "davinci", type: streamType });
      }

      // Cache the servers list so it survives switching to davinci
      if (data.servers.length > 1) {
        serversListRef.current = data.servers;
      }

      setStreamData(data);
      setActiveServer(data.serverName ?? server ?? null);

      // Find a source to play — prefer "auto", "default" for ABR, then "1080p"
      const source =
        data.sources.find(s => s.quality === "auto") ||
        data.sources.find(s => s.quality === "default") ||
        data.sources.find(s => s.quality === "1080p") ||
        data.sources.find(s => s.quality === "720p") ||
        data.sources[0];

      if (source) {
        playSource(source.url, source.isM3U8, data.headers, (source as any).isEmbed);
        // anime.mal_id holds the anilist id; episodeNo dedups per unique episode.
        addXpForWatching(anime.mal_id, episodeNo).catch(console.error);
      }
    } catch (err: any) {
      setStreamError(err.message || "Failed to load stream");
    } finally {
      setLoadingStream(false);
    }
  }, [allEpisodes, streamType]);

  /**
   * Start playback, surviving the autoplay policy.
   *
   * Phones block UNMUTED autoplay outright — there is no engagement
   * exemption the way desktop Chrome has — so the old bare `play()` was
   * rejected on every mobile load and, because nothing handled the
   * rejection, the player just sat there black. We try with sound first
   * (desktop keeps its behaviour), and on rejection fall back to a muted
   * start and flag that sound needs one tap to switch on.
   */
  const startPlayback = useCallback((video: HTMLVideoElement) => {
    const attempt = video.play();
    if (!attempt || typeof attempt.catch !== "function") return;
    attempt.catch((err: any) => {
      // ONLY NotAllowedError means "the browser blocked autoplay".
      // play() also rejects with AbortError whenever a pending load is
      // interrupted — which happens every time the viewer pauses, taps
      // back, or switches server/sub-dub during the second or two a
      // manifest takes to load. Treating those as a block muted a video
      // nobody muted and force-resumed a deliberate pause.
      if (err?.name !== "NotAllowedError") {
        setIsPlaying(false);
        return;
      }
      video.muted = true;
      setIsMuted(true);
      setNeedsUnmute(true);
      video.play().catch(() => {
        // Even muted autoplay refused — leave it paused and let the
        // centre play button do the work on a real tap.
        setIsPlaying(false);
        setAutoplayBlocked(true);
      });
    });
  }, []);

  // Play a source URL using HLS.js or native video
  const playSource = useCallback((url: string, isM3U8: boolean, headers?: Record<string, string>, isEmbed?: boolean) => {
    setActiveSourceObj({ url, isM3U8, isEmbed });

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isEmbed) {
      setHasStarted(true);
      return;
    }

    // Use a small timeout to ensure the <video> element is mounted if we just switched from an iframe
    setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isM3U8 && Hls.isSupported()) {
        const hls = new Hls({
          xhrSetup: (xhr: XMLHttpRequest) => {
            if (headers) {
              Object.entries(headers).forEach(([key, value]) => {
                try { xhr.setRequestHeader(key, value); } catch { /* noop */ }
              });
            }
          },
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          startPlayback(video);
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setStreamError("Stream playback error. Try a different quality or server.");
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = url;
        startPlayback(video);
      } else {
        // Direct MP4 or other
        video.src = url;
        startPlayback(video);
      }
    }, 0);
  }, []);

  // Auto-load initial episode
  useEffect(() => {
    loadStream(initialEpisodeId, initialEpisodeNo);
  }, [initialEpisodeId, initialEpisodeNo, loadStream]);

  // Navigate episodes
  const goToEpisode = useCallback((direction: "prev" | "next") => {
    const idx = allEpisodes.findIndex(e => e.id === activeEpisode?.id);
    const target = direction === "prev" ? idx - 1 : idx + 1;
    if (target >= 0 && target < allEpisodes.length) {
      const ep = allEpisodes[target];
      loadStream(ep.id, ep.number || target + 1);
    }
  }, [activeEpisode, allEpisodes, loadStream]);

  const switchStreamType = useCallback((newType: "sub" | "dub") => {
    if (newType === streamType) return;
    setStreamType(newType);
    if (activeEpisode) {
      loadStream(activeEpisode.id, activeEpisodeNo, newType);
    }
  }, [streamType, activeEpisode, activeEpisodeNo, loadStream]);

  // Group episodes into chunks
  const seasons: { label: string; episodes: AnikotoEpisode[] }[] = [];
  for (let i = 0; i < allEpisodes.length; i += EPISODES_PER_SEASON) {
    const chunk = allEpisodes.slice(i, i + EPISODES_PER_SEASON);
    seasons.push({
      label: allEpisodes.length <= EPISODES_PER_SEASON
        ? "All Episodes"
        : `Episodes ${i + 1}-${Math.min(i + EPISODES_PER_SEASON, allEpisodes.length)}`,
      episodes: chunk,
    });
  }

  const currentIdx = activeEpisode ? allEpisodes.findIndex(e => e.id === activeEpisode.id) : -1;
  const hasNext = currentIdx < allEpisodes.length - 1;

  if (!isBrowser) return null;

  // An embedded (iframe) source rendered inline: its own player chrome
  // lives inside the frame, so ours must stack around it rather than
  // float on top and bury the embed's controls.
  const inlineEmbed = inline && !!activeSourceObj?.isEmbed;

  const shell = (
    <div
      ref={containerRef}
      className={inline
        // An EMBED stacks: bar / iframe / bar, so the shell grows to fit
        // instead of pinning a 16:9 box. Forcing aspect-video here is what
        // starved the flex-1 iframe area to zero height and made embedded
        // sources render nothing on a phone. Native video still gets the
        // clean 16:9 frame with overlaid controls.
        ? `relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black flex flex-col ${inlineEmbed ? "" : "aspect-video"}`
        : "fixed inset-0 z-[99999] bg-black flex flex-col"}
      style={{ cursor: controlsVisible || !isPlaying ? 'default' : 'none' }}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    >
      {/* ═══ TOP BAR ═══
          INLINE keeps the bars as OVERLAYS even for embeds. Going
          `relative` gave them real layout height, and inside a fixed
          aspect-video box (≈193px on a phone) the two bars' 220px of
          chrome starved the `flex-1` video area down to ZERO — embeds
          rendered nothing at all. Fullscreen keeps the old behaviour,
          where an iframe swallowing mouse events matters more. */}
      <div className={`${activeSourceObj?.isEmbed ? 'relative' : 'absolute top-0'} left-0 right-0 z-50 transition-all duration-500 ${controlsVisible || activeSourceObj?.isEmbed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"}`}>
        <div className="px-3 py-2.5 sm:px-8 sm:py-6 flex items-center justify-between">
          <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition group">
            <ArrowLeft className="w-6 h-6 sm:w-8 sm:h-8 text-white group-hover:-translate-x-1 transition-transform" />
          </button>
          <button className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition" title="Report Issue">
            <Flag className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN VIDEO AREA ═══ */}
      <div
        className={`${inlineEmbed ? "relative aspect-video w-full" : "flex-1 relative"} flex items-center justify-center bg-black`}
        onClick={() => { if (!activeSourceObj?.isEmbed && !loadingStream && !streamError && activeServer !== "davinci") togglePlay(); }}
      >
        {activeServer === "davinci" && streamData?.sources?.[0]?.url ? (
          <div className="absolute inset-0 z-10">
            <DavinciPlayer url={streamData.sources[0].url} />
          </div>
        ) : (
          <>
            {/* Loading */}
        {loadingStream && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <Loader2 className="w-16 h-16 animate-spin text-purple-500 mb-4" />
            <p className="font-bold text-sm text-purple-400 uppercase tracking-widest">Loading Stream...</p>
          </div>
        )}

        {/* Error */}
        {streamError && !loadingStream && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-center p-8">
            <AlertCircle className="w-20 h-20 text-red-500 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Stream Unavailable</h3>
            <p className="text-slate-400 max-w-md">{streamError}</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition"
            >
              Go Back
            </button>
          </div>
        )}

        {/* ── CENTRE PLAY ── the one target that always works.
            When autoplay is refused (every phone, unmuted) the only other
            affordance was a small button in a bar that auto-hides, so the
            player looked broken. Sits above the video, below the bars. */}
        {!isPlaying && !loadingStream && !streamError && !activeSourceObj?.isEmbed && (hasStarted || autoplayBlocked) && (
          <button
            onClick={(e) => { e.stopPropagation(); setNeedsUnmute(false); togglePlay(); }}
            aria-label="Play"
            className="absolute inset-0 z-20 grid place-items-center"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/60 ring-2 ring-white/70 backdrop-blur-sm transition hover:scale-105 sm:h-20 sm:w-20">
              <Play className="ml-1 h-7 w-7 fill-white text-white sm:h-9 sm:w-9" />
            </span>
          </button>
        )}

        {/* Player (Video or Iframe) */}
        <div className="absolute inset-0 z-10">
          {activeSourceObj?.isEmbed ? (
            <iframe
              src={activeSourceObj.url}
              className="w-full h-full border-0 absolute inset-0 z-10"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain absolute inset-0 z-10"
              autoPlay
              playsInline
              // crossOrigin forced every direct-src load (native HLS on iOS,
              // and mp4) into CORS mode, so a CDN without the header simply
              // failed. Nothing here reads pixels, so it bought us nothing.
              onError={() => {
                if (!activeSourceObj?.isEmbed) {
                  setStreamError("This source wouldn't play. Try another server.");
                }
              }}
              onPlay={() => { setIsPlaying(true); setHasStarted(true); }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => onEnded?.()}
              onTimeUpdate={(e) => { 
                if (!isSeeking) {
                  const now = Date.now();
                  if (now - lastTimeUpdateRef.current > 500) {
                    setCurrentTime(e.currentTarget.currentTime);
                    lastTimeUpdateRef.current = now;
                  }
                }
              }}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                setDuration(el.duration || 0);

                // Netflix-style resume. Seeking must happen here, not earlier:
                // before metadata loads the element has no duration and assigning
                // currentTime is discarded.
                if (!resumeAppliedRef.current && resumeTarget != null && resumeTarget > 0) {
                  resumeAppliedRef.current = true;
                  // Don't drop someone 2s from the end of an episode they've
                  // effectively finished — start it over instead.
                  const dur = el.duration || 0;
                  if (!dur || resumeTarget < dur - 15) {
                    try {
                      el.currentTime = resumeTarget;
                      setCurrentTime(resumeTarget);
                    } catch { /* seek can throw on some sources; harmless */ }
                  }
                }
              }}
              onProgress={(e) => {
                const now = Date.now();
                if (now - lastProgressUpdateRef.current > 1000) {
                  const buf = e.currentTarget.buffered;
                  if (buf.length) setBufferedEnd(buf.end(buf.length - 1));
                  lastProgressUpdateRef.current = now;
                }
              }}
              onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setIsMuted(e.currentTarget.muted); }}
            >
              {/* Subtitles */}
              {streamData?.subtitles?.map((sub, i) => (
                <track
                  key={i}
                  kind="subtitles"
                  src={sub.url}
                  srcLang={sub.lang}
                  label={sub.lang}
                  default={sub.lang === "English" || sub.lang === "en"}
                />
              ))}
            </video>
          )}

          {/* Custom Da Vinci Watermark Overlay (Covers up original source watermark) */}
          <div className="absolute top-4 right-4 md:top-6 md:right-8 z-40 pointer-events-none select-none flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/5 shadow-2xl">
            <img src="/logo.png" alt="Da Vinci" className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
            <span className="font-fell font-bold tracking-widest text-white/80 text-xs md:text-sm uppercase">Da Vinci</span>
          </div>
          {/* ═══ NETFLIX-STYLE PAUSE SCREEN ═══
              hasStarted gates it: seeding isPlaying=false (so a blocked
              autoplay is honest) otherwise painted this whole wall of
              text over EVERY episode at load, before playback began.
              Typography scales down too — at 5xl it overflowed the
              inline player on a phone, the very thing the compact
              control bars were fixing. */}
          {!activeSourceObj?.isEmbed && !loadingStream && !streamError && !isPlaying && hasStarted && (
            <div className="absolute inset-0 z-20 bg-black/80 pointer-events-none flex flex-col justify-center">
              {/* Left-aligned episode info block */}
              <div className="absolute left-4 sm:left-16 md:left-24 lg:left-32 top-1/2 -translate-y-1/2 max-w-3xl pr-4 sm:pr-8">
                <p className="hidden sm:block text-slate-300 text-base sm:text-lg mb-1">
                  You&apos;re watching
                </p>
                <h2 className="text-white text-xl sm:text-5xl md:text-7xl font-black mb-1 sm:mb-3 leading-tight tracking-tight line-clamp-2">
                  {anime.title_english || anime.title}
                </h2>
                <p className="text-white text-sm sm:text-2xl font-bold mb-2 sm:mb-8">
                  Season {activeSeason + 1}
                </p>
                <p className="text-white text-sm sm:text-xl font-bold mt-2 sm:mt-4 mb-1 sm:mb-2 line-clamp-1">
                  {activeEpisode?.title || `Episode ${activeEpisodeNo}`}
                </p>
                {activeEpisode?.description && (
                  <p className="hidden sm:block text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed line-clamp-4 md:line-clamp-none max-w-2xl">
                    {activeEpisode.description}
                  </p>
                )}
              </div>

              {/* Paused indicator, bottom right — desktop only; on a phone
                  it landed in the middle of the picture. */}
              <span className="hidden sm:block absolute bottom-24 right-8 sm:bottom-32 sm:right-16 text-slate-300 text-base sm:text-lg font-medium tracking-wide">
                Paused
              </span>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* ═══ INLINE SERVER SELECTION (Styled like Playback Settings) ═══ */}
      {inlineEmbed && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6 w-full shrink-0">
          <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-slate-500">Servers</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(streamData?.servers && streamData.servers.length > 0
              ? streamData.servers
              : (activeServer ? [{ name: activeServer, type: streamType }] : [])
            ).map((s, i) => (
              <button
                key={s.name + i}
                onClick={() => {
                  if (activeEpisode) loadStream(activeEpisode.id, activeEpisodeNo, streamType, s.name);
                }}
                className={`rounded-lg border px-4 py-2 font-mono text-xs font-black transition flex items-center gap-2 ${
                  activeServer === s.name
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-white/15 bg-white/[0.05] text-slate-400 hover:text-white"
                }`}
              >
                {s.name} <span className="opacity-50 text-[10px]">{s.type}</span>
              </button>
            ))}
            {(!streamData?.servers || streamData.servers.length === 0) && !activeServer && (
              <p className="text-xs font-mono text-slate-500 py-2">No servers available.</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ BOTTOM BAR ═══ */}
      {activeServer !== "davinci" && (
        <div
          className={`${activeSourceObj?.isEmbed ? 'relative bg-black' : 'absolute bottom-0'} left-0 right-0 z-50 transition-all duration-500 ${controlsVisible || activeSourceObj?.isEmbed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-5 pb-2.5 sm:pt-12 sm:pb-6 flex flex-col">
          {/* Progress / seek bar (At the very top edge of the bottom bar) */}
          {!activeSourceObj?.isEmbed && (
            <div className="relative w-full h-1 group/seek cursor-pointer hover:h-1.5 transition-all bg-white/20">
              <div
                className="absolute inset-y-0 left-0 bg-white/40"
                style={{ width: `${duration ? (bufferedEnd / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-red-600"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-600 shadow opacity-0 group-hover/seek:opacity-100 transition"
                style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 8px)` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                // Touch equivalents: without these the seeking latch never
                // engaged on a phone, so onTimeUpdate fought every drag.
                onTouchStart={() => setIsSeeking(true)}
                onTouchEnd={() => setIsSeeking(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {/* Remaining Time overlay */}
              <div className="absolute right-0 bottom-full mb-2 mr-4 text-white text-sm font-medium tabular-nums drop-shadow-md">
                {duration ? formatTime(duration - currentTime) : "0:00"}
              </div>
            </div>
          )}

          <div className="px-3 sm:px-8 mt-2 sm:mt-4 flex items-center justify-between gap-3 sm:gap-4">
            {/* Left Controls */}
            <div className="flex items-center gap-3 sm:gap-6">
              {!activeSourceObj?.isEmbed ? (
                <>
                  {/* Play / Pause */}
                  <button onClick={togglePlay} className="text-white hover:text-slate-300 transition flex-shrink-0">
                    {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" />}
                  </button>

                  {/* Skip Back 10s */}
                  <button onClick={() => skipTime(-10)} className="text-white hover:text-slate-300 transition flex-shrink-0" title="Skip back 10s">
                    <RotateCcw className="w-5 h-5 sm:w-7 sm:h-7" />
                  </button>

                  {/* Skip Forward 10s */}
                  <button onClick={() => skipTime(10)} className="text-white hover:text-slate-300 transition flex-shrink-0" title="Skip forward 10s">
                    <RotateCw className="w-5 h-5 sm:w-7 sm:h-7" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/volume">
                    <button
                      onClick={() => { setNeedsUnmute(false); toggleMute(); }}
                      className={`relative text-white hover:text-slate-300 transition flex-shrink-0 ${needsUnmute ? "animate-pulse text-amber-300" : ""}`}
                      title={needsUnmute ? "Tap for sound" : "Toggle Mute"}
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 sm:w-7 sm:h-7" /> : <Volume2 className="w-5 h-5 sm:w-7 sm:h-7" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="hidden sm:block w-0 group-hover/volume:w-20 transition-all duration-300 accent-white cursor-pointer"
                    />
                  </div>
                </>
              ) : (
                <div className="text-white/50 text-sm font-medium px-2 py-1 border border-white/10 rounded-md">
                  External Player
                </div>
              )}
            </div>

              {/* Center: Title */}
              <div className="hidden md:flex flex-1 justify-center px-4">
                <span className="text-white font-bold text-base truncate max-w-lg text-center">
                  {anime.title_english || anime.title} {activeEpisode?.title ? `- ${activeEpisode.title}` : (activeEpisodeNo ? `- Episode ${activeEpisodeNo}` : '')}
                </span>
              </div>

              {/* Right Controls */}
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              
              {/* Sub/Dub Toggle */}
              <button 
                onClick={() => switchStreamType(streamType === "sub" ? "dub" : "sub")}
                className="text-white font-bold text-xs sm:text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 transition rounded-md uppercase tracking-wider"
              >
                {streamType === "sub" ? "Sub" : "Dub"}
              </button>

              {/* Inline mode hides the internal episode navigation — the
                  watch PAGE owns prev/next and the episode list there, and
                  navigating inside the player desynced the page's header,
                  URL, watched-marking and auto-next. */}
              {!inline && (
                <button
                  disabled={!hasNext}
                  onClick={() => goToEpisode("next")}
                  title="Next Episode"
                  className="text-white hover:text-slate-300 disabled:opacity-30 transition flex-shrink-0"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              )}



                {!inline && (
                  <button
                    onClick={() => { setShowEpisodePanel(v => !v); setShowServerPanel(false); }}
                    className={`transition ${showEpisodePanel ? "text-red-500" : "text-white hover:text-slate-300"}`}
                    title="Episodes"
                  >
                    <List className="w-7 h-7" />
                  </button>
                )}

                {!activeSourceObj?.isEmbed && (
                  <button
                    onClick={toggleFullscreen}
                    title="Fullscreen"
                    className="text-white hover:text-slate-300 transition flex-shrink-0"
                  >
                    {isFullscreen ? <Minimize className="w-7 h-7" /> : <Maximize className="w-7 h-7" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ═══ EPISODE PANEL (Netflix-style sidebar) ═══ */}
      {showEpisodePanel && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowEpisodePanel(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-[70] w-full sm:w-[420px] bg-[#141414]/98 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-black text-white">Episodes</h3>
              <button onClick={() => setShowEpisodePanel(false)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Season Selector */}
            {seasons.length > 1 && (
              <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
                <div className="relative">
                  <select
                    value={activeSeason}
                    onChange={(e) => setActiveSeason(Number(e.target.value))}
                    className="w-full appearance-none bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5 pr-10 font-bold text-sm focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {seasons.map((s, i) => (
                      <option key={i} value={i} className="bg-[#141414] text-white">{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Episode List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {seasons[activeSeason]?.episodes.map((ep, idx) => {
                const epNo = ep.number || idx + 1 + activeSeason * EPISODES_PER_SEASON;
                const isActive = activeEpisode?.id === ep.id;
                return (
                  <button
                    key={ep.id || idx}
                    onClick={() => { loadStream(ep.id, epNo); setShowEpisodePanel(false); }}
                    className={`w-full text-left px-5 py-4 flex items-center gap-4 border-b border-white/5 transition-colors group ${isActive ? "bg-purple-600/20 border-l-4 border-l-purple-500" : "hover:bg-white/5 border-l-4 border-l-transparent"}`}
                  >
                    {/* Thumbnail or number */}
                    {ep.image ? (
                      <div className="relative w-24 aspect-video flex-shrink-0 rounded overflow-hidden bg-[#1a1a1a]">
                        <img src={ep.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {isActive && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm transition ${isActive ? "bg-purple-600 text-white" : "bg-white/10 text-slate-400 group-hover:bg-white/20"}`}>
                        {epNo}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${isActive ? "text-purple-300" : "text-white"}`}>
                        {ep.title || `Episode ${epNo}`}
                      </p>
                      {ep.description && (
                        <p className="text-slate-500 text-xs truncate mt-0.5">{ep.description}</p>
                      )}
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-1 text-purple-400 flex-shrink-0">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase">Playing</span>
                      </div>
                    )}
                    {!isActive && (
                      <PlayCircle className="w-5 h-5 text-slate-600 group-hover:text-white transition opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );

  // Fullscreen overlay portals to body; inline renders where it stands.
  return inline ? shell : createPortal(shell, document.body);
}
