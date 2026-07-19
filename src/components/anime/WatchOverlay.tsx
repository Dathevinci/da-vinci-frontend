"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getAnikotoStreamUrl, getAnikotoStreamUrlFast, AnikotoEpisode, AnikotoStreamResult } from "@/lib/anikoto";
import { X, ChevronLeft, ChevronRight, Loader2, AlertCircle, Server, PlayCircle, List, ChevronDown, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv, ArrowLeft, Flag, RotateCcw, RotateCw } from "lucide-react";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { useAnimeStatus } from "@/hooks/useAnimeStatus";

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
  allEpisodes: AnikotoEpisode[];
  onClose: () => void;
}

export default function WatchOverlay({
  anime,
  consumetAnimeId,
  initialEpisodeId,
  initialEpisodeNo,
  allEpisodes,
  onClose,
}: WatchOverlayProps) {
  const { addXpForWatching } = useUser();
  const { isTracked, setStatus } = useAnimeStatus();
  // Current state
  const [activeEpisode, setActiveEpisode] = useState<AnikotoEpisode | null>(null);
  const [activeEpisodeNo, setActiveEpisodeNo] = useState(initialEpisodeNo);
  const [streamData, setStreamData] = useState<AnikotoStreamResult | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeQuality, setActiveQuality] = useState<string>("default");
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

  // Playback state (for the custom Netflix-style controls)
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Lock body scroll
  useEffect(() => {
    if (!isBrowser) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isBrowser]);

  // Auto-track and auto-save progress
  // (Auto-track as "Watching" has been disabled per user request)
  const lastStorageUpdateRef = useRef(0);
  
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
      } catch (e) {}
    }
  }, [hasStarted, currentTime, duration, activeEpisode, activeEpisodeNo, anime.mal_id]);

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
      if (e.key === "Escape") {
        if (showEpisodePanel) setShowEpisodePanel(false);
        else if (showServerPanel) setShowServerPanel(false);
        else onClose();
      } else if (e.code === "Space" && !showEpisodePanel && !showServerPanel) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, showEpisodePanel, showServerPanel, togglePlay]);

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

      const data = serverIds
        ? await getAnikotoStreamUrlFast(consumetAnimeId, episodeNo, serverIds, typeToUse, server)
        : await getAnikotoStreamUrl(consumetAnimeId, episodeNo, typeToUse, server);
      if (!data || !data.sources || data.sources.length === 0) {
        setStreamError(`No stream found for Episode ${episodeNo}. Try switching Sub/Dub or selecting a different episode.`);
        return;
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
        setActiveQuality(source.quality);
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
          video.play().catch(() => {});
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
        video.play().catch(() => {});
      } else {
        // Direct MP4 or other
        video.src = url;
        video.play().catch(() => {});
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

  const switchQuality = useCallback((quality: string) => {
    if (!streamData) return;
    const source = streamData.sources.find(s => s.quality === quality);
    if (source) {
      setActiveQuality(quality);
      playSource(source.url, source.isM3U8, streamData.headers, (source as any).isEmbed);
    }
  }, [streamData, playSource]);

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
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allEpisodes.length - 1;

  if (!isBrowser) return null;

  return createPortal(
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[99999] bg-black flex flex-col"
      style={{ cursor: controlsVisible || !isPlaying ? 'default' : 'none' }}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* ═══ TOP BAR ═══ */}
      <div className={`${activeSourceObj?.isEmbed ? 'relative' : 'absolute top-0'} left-0 right-0 z-50 transition-all duration-500 ${controlsVisible || activeSourceObj?.isEmbed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"}`}>
        <div className="px-4 sm:px-8 py-6 flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition group">
            <ArrowLeft className="w-8 h-8 text-white group-hover:-translate-x-1 transition-transform" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition" title="Report Issue">
            <Flag className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN VIDEO AREA ═══ */}
      <div
        className="flex-1 relative flex items-center justify-center bg-black"
        onClick={() => { if (!activeSourceObj?.isEmbed && !loadingStream && !streamError) togglePlay(); }}
      >
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
              crossOrigin="anonymous"
              onPlay={() => { setIsPlaying(true); setHasStarted(true); }}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => { 
                if (!isSeeking) {
                  const now = Date.now();
                  if (now - lastTimeUpdateRef.current > 500) {
                    setCurrentTime(e.currentTarget.currentTime);
                    lastTimeUpdateRef.current = now;
                  }
                }
              }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
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
          {/* ═══ NETFLIX-STYLE PAUSE SCREEN ═══ */}
          {!activeSourceObj?.isEmbed && !loadingStream && !streamError && !isPlaying && (
            <div className="absolute inset-0 z-20 bg-black/80 pointer-events-none flex flex-col justify-center">
              {/* Left-aligned episode info block */}
              <div className="absolute left-8 sm:left-16 md:left-24 lg:left-32 top-1/2 -translate-y-1/2 max-w-3xl pr-8">
                <p className="text-slate-300 text-base sm:text-lg mb-1">
                  You're watching
                </p>
                <h2 className="text-white text-5xl sm:text-6xl md:text-7xl font-black mb-3 leading-tight tracking-tight">
                  {anime.title_english || anime.title}
                </h2>
                <p className="text-white text-xl sm:text-2xl font-bold mb-8">
                  Season {activeSeason + 1}
                </p>
                <p className="text-white text-lg sm:text-xl font-bold mt-4 mb-2">
                  {activeEpisode?.title || `Episode ${activeEpisodeNo}`}
                </p>
                {activeEpisode?.description && (
                  <p className="text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed line-clamp-4 md:line-clamp-none max-w-2xl">
                    {activeEpisode.description}
                  </p>
                )}
              </div>

              {/* Paused indicator, bottom right */}
              <span className="absolute bottom-24 right-8 sm:bottom-32 sm:right-16 text-slate-300 text-base sm:text-lg font-medium tracking-wide">
                Paused
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BOTTOM BAR ═══ */}
      <div
        className={`${activeSourceObj?.isEmbed ? 'relative bg-black' : 'absolute bottom-0'} left-0 right-0 z-50 transition-all duration-500 ${controlsVisible || activeSourceObj?.isEmbed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-12 pb-6 flex flex-col">
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
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {/* Remaining Time overlay */}
              <div className="absolute right-0 bottom-full mb-2 mr-4 text-white text-sm font-medium tabular-nums drop-shadow-md">
                {duration ? formatTime(duration - currentTime) : "0:00"}
              </div>
            </div>
          )}

          <div className="px-4 sm:px-8 mt-4 flex items-center justify-between gap-4">
            {/* Left Controls */}
            <div className="flex items-center gap-4 sm:gap-6">
              {!activeSourceObj?.isEmbed ? (
                <>
                  {/* Play / Pause */}
                  <button onClick={togglePlay} className="text-white hover:text-slate-300 transition flex-shrink-0">
                    {isPlaying ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8" fill="currentColor" />}
                  </button>

                  {/* Skip Back 10s */}
                  <button onClick={() => skipTime(-10)} className="text-white hover:text-slate-300 transition flex-shrink-0" title="Skip back 10s">
                    <RotateCcw className="w-7 h-7" />
                  </button>

                  {/* Skip Forward 10s */}
                  <button onClick={() => skipTime(10)} className="text-white hover:text-slate-300 transition flex-shrink-0" title="Skip forward 10s">
                    <RotateCw className="w-7 h-7" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/volume">
                    <button onClick={toggleMute} className="text-white hover:text-slate-300 transition flex-shrink-0" title="Toggle Mute">
                      {isMuted || volume === 0 ? <VolumeX className="w-6 h-6 sm:w-7 sm:h-7" /> : <Volume2 className="w-6 h-6 sm:w-7 sm:h-7" />}
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

              <button
                disabled={!hasNext}
                onClick={() => goToEpisode("next")}
                title="Next Episode"
                className="text-white hover:text-slate-300 disabled:opacity-30 transition flex-shrink-0"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

                <button
                  onClick={() => { setShowServerPanel(v => !v); setShowEpisodePanel(false); }}
                  className={`transition ${showServerPanel ? "text-purple-400" : "text-white hover:text-slate-300"}`}
                  title="Servers — switch if the video won't load"
                >
                  <Server className="w-6 h-6" />
                </button>

                <button
                  onClick={() => { setShowEpisodePanel(v => !v); setShowServerPanel(false); }}
                  className={`transition ${showEpisodePanel ? "text-red-500" : "text-white hover:text-slate-300"}`}
                  title="Episodes"
                >
                  <List className="w-7 h-7" />
                </button>

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

      {/* ═══ SERVER PANEL — switch embed host if the current one is blocked ═══ */}
      {showServerPanel && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setShowServerPanel(false)} />
          <div className="absolute top-16 right-4 z-[70] w-72 bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" /> Servers
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">Video won&apos;t load? Try another server.</p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto custom-scrollbar">
              {(streamData?.servers && streamData.servers.length > 0
                ? streamData.servers
                : (activeServer ? [{ name: activeServer, type: streamType }] : [])
              ).map((s, i) => (
                <button
                  key={s.name + i}
                  onClick={() => {
                    if (activeEpisode) loadStream(activeEpisode.id, activeEpisodeNo, streamType, s.name);
                    setShowServerPanel(false);
                  }}
                  className={`px-4 py-2.5 rounded-lg text-sm font-bold text-left transition flex items-center justify-between ${activeServer === s.name
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="text-xs opacity-60 uppercase">{s.type}</span>
                </button>
              ))}
              {(!streamData?.servers || streamData.servers.length === 0) && !activeServer && (
                <p className="text-xs text-slate-500 px-2 py-1">No alternate servers found.</p>
              )}
            </div>
          </div>
        </>
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm transition ${isActive ? "bg-indigo- text-white" : "bg-white/10 text-slate-400 group-hover:bg-white/20"}`}>
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
    </div>,
    document.body
  );
}
