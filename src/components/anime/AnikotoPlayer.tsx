"use client";

/**
 * AnikotoPlayer — premium standalone video player.
 *
 * BUG FIX notes vs v1:
 * - <video> is always in the DOM (was conditionally rendered → videoRef.current was null
 *   when HLS tried to attach, so nothing played)
 * - HLS loading moved to a dedicated useEffect that runs AFTER React commits the DOM
 *   (replaces the unreliable setTimeout hack)
 * - loadEpisode now only fetches the URL; DOM attachment is handled separately
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, SkipBack, List, X, ChevronLeft, ChevronRight,
  Loader2, AlertCircle,
} from "lucide-react";
import {
  getAnikotoStreamUrlFast,
  getAnikotoStreamUrl,
  AnikotoEpisode,
  AnikotoStreamResult,
} from "@/lib/anikoto";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

// ─── types ────────────────────────────────────────────────────────────────────
export interface AnikotoPlayerProps {
  animeId: string;
  title: string;
  startEp?: number;
  episodes: AnikotoEpisode[];
  onClose?: () => void;
  posterUrl?: string;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function AnikotoPlayer({
  animeId,
  title,
  startEp = 1,
  episodes,
  onClose,
  posterUrl,
}: AnikotoPlayerProps) {
  // Stream / episode state
  const [streamResult, setStreamResult] = useState<AnikotoStreamResult | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEpNo, setActiveEpNo] = useState(startEp);
  const [streamType, setStreamType] = useState<"sub" | "dub">("sub");

  /**
   * pendingSource: set by loadEpisode after the URL is resolved.
   * A useEffect watches this and attaches it to the <video> element AFTER
   * React has committed the DOM — fixing the "videoRef is null" race condition.
   */
  const [pendingSource, setPendingSource] = useState<{
    url: string;
    isM3U8: boolean;
    isEmbed: boolean;
    headers?: Record<string, string>;
  } | null>(null);

  // The source that is currently playing (drives the iframe / video switch)
  const [activeSource, setActiveSource] = useState<{
    url: string;
    isM3U8: boolean;
    isEmbed: boolean;
  } | null>(null);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // For React Portal
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── STEP 1: fetch the stream URL ───────────────────────────────────────────
  const loadEpisode = useCallback(async (epNo: number, type: "sub" | "dub") => {
    if (!mountedRef.current) return;

    // Reset all state
    setLoading(true);
    setStreamError(null);
    setStreamResult(null);
    setPendingSource(null);
    setActiveSource(null);
    setActiveEpNo(epNo);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setPlaying(false);

    // Destroy existing HLS instance immediately
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    // Also clear the video element src
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
    }

    const ep = episodes.find(e => e.number === epNo) ?? episodes[epNo - 1];
    const serverIds = (ep as any)?.serverIds as string | undefined;

    try {
      const data = serverIds
        ? await getAnikotoStreamUrlFast(animeId, epNo, serverIds, type)
        : await getAnikotoStreamUrl(animeId, epNo, type);

      if (!mountedRef.current) return;

      if (!data || !data.sources.length) {
        setStreamError(`No stream found for Episode ${epNo}. Try switching Sub/Dub.`);
        setLoading(false);
        return;
      }

      setStreamResult(data);

      const src = data.sources.find(s => s.quality === "auto") ?? data.sources[0];
      if (!src) {
        setStreamError("No playable source found.");
        setLoading(false);
        return;
      }

      const isEmbed = !!(src as any).isEmbed;

      // Queue the source — the useEffect below will attach it after React renders
      setPendingSource({
        url: src.url,
        isM3U8: src.isM3U8,
        isEmbed,
        headers: data.headers,
      });
    } catch (e: any) {
      if (mountedRef.current) {
        setStreamError(e.message || "Failed to load stream.");
        setLoading(false);
      }
    }
  }, [animeId, episodes]);

  // ── STEP 2: attach source to DOM after React renders ──────────────────────
  // This runs AFTER the <video> element is guaranteed to be in the DOM.
  useEffect(() => {
    if (!pendingSource) return;

    // Update what the render shows (drives iframe vs video)
    setActiveSource({
      url: pendingSource.url,
      isM3U8: pendingSource.isM3U8,
      isEmbed: pendingSource.isEmbed,
    });

    if (pendingSource.isEmbed) {
      // Iframe embed — nothing more to do
      setLoading(false);
      return;
    }

    // At this point React has committed; the <video> element is in the DOM
    const video = videoRef.current;
    if (!video) {
      setStreamError("Video element not found. Please reload.");
      setLoading(false);
      return;
    }

    // Destroy any existing HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (pendingSource.isM3U8 && Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          if (pendingSource.headers) {
            Object.entries(pendingSource.headers).forEach(([k, v]) => {
              try { xhr.setRequestHeader(k, v); } catch {}
            });
          }
        },
      });
      hls.loadSource(pendingSource.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamError("Playback error. Try a different episode or Sub/Dub.");
          setLoading(false);
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = pendingSource.url;
      video.play().catch(() => {});
      setLoading(false);
    } else {
      video.src = pendingSource.url;
      video.play().catch(() => {});
      setLoading(false);
    }

    // Clear pending so this effect doesn't re-run on unrelated renders
    setPendingSource(null);
  }, [pendingSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup HLS on unmount
  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  // Initial load
  useEffect(() => {
    loadEpisode(startEp, "sub");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video DOM events ───────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(video.currentTime);
    const onDur = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0)
        setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onVol = () => { setVolume(video.volume); setMuted(video.muted); };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVol);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVol);
    };
  }, []); // attach once — the video element never unmounts now

  // Fullscreen sync
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (playing && !showEpisodePanel) {
      controlsTimer.current = setTimeout(() => setControlsVisible(false), 3500);
    }
  }, [playing, showEpisodePanel]);

  useEffect(() => { resetControlsTimer(); return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }; }, [resetControlsTimer]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (e.key === "Escape") { showEpisodePanel ? setShowEpisodePanel(false) : onClose?.(); }
      if (!video || loading) return;
      if (e.code === "Space") { e.preventDefault(); video.paused ? video.play() : video.pause(); }
      if (e.key === "ArrowRight") video.currentTime += 10;
      if (e.key === "ArrowLeft") video.currentTime -= 10;
      if (e.key === "ArrowUp") { e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); }
      if (e.key === "ArrowDown") { e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); }
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "m" || e.key === "M") { if (video) video.muted = !video.muted; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showEpisodePanel, onClose, loading]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || loading || streamError) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const handleSeek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const skip = (amount: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + amount));
  };

  const goToEpisode = (dir: "prev" | "next") => {
    const next = dir === "next" ? activeEpNo + 1 : activeEpNo - 1;
    if (!episodes.find(e => e.number === next)) return;
    loadEpisode(next, streamType);
  };

  const switchType = (t: "sub" | "dub") => {
    setStreamType(t);
    loadEpisode(activeEpNo, t);
  };

  const hasPrev = episodes.some(e => e.number === activeEpNo - 1);
  const hasNext = episodes.some(e => e.number === activeEpNo + 1);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isBrowser) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] bg-black flex flex-col"
      style={{ cursor: controlsVisible || loading || streamError ? "default" : "none" }}
    >
      {/* ── Media area ─────────────────────────────────────────────────────── */}
      <div
        className="relative flex-1 overflow-hidden"
        onMouseMove={resetControlsTimer}
        onClick={togglePlay}
      >
        {/* Poster (background while loading) */}
        {posterUrl && (loading || !activeSource) && (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
          />
        )}

        {/*
          The <video> element is ALWAYS rendered so videoRef.current is never null.
          We hide it via opacity when showing an iframe or during initial load.
        */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          style={{
            opacity: activeSource && !activeSource.isEmbed ? 1 : 0,
            pointerEvents: "none",
          }}
        />

        {/* Iframe embed */}
        {activeSource?.isEmbed && (
          <iframe
            key={activeSource.url}
            src={activeSource.url}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media"
          />
        )}

        {/* Custom Da Vinci Watermark Overlay (Covers up original source watermark) */}
        <div className="absolute top-4 right-4 md:top-6 md:right-8 z-40 pointer-events-none select-none flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/5 shadow-2xl">
          <img src="/logo.png" alt="Da Vinci" className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
          <span className="font-fell font-bold tracking-widest text-white/80 text-xs md:text-sm uppercase">Da Vinci</span>
        </div>

        {/* ── Loading spinner ──────────────────────────────────────────────── */}

        <AnimatePresence>
          {loading && (
            <motion.div
              key="spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
            >
              <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Loading Episode {activeEpNo}…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error state ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {streamError && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center"
              onClick={e => e.stopPropagation()}
            >
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-white font-black text-lg">Stream unavailable</p>
              <p className="text-slate-400 text-sm max-w-sm">{streamError}</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => switchType(streamType === "sub" ? "dub" : "sub")}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition"
                >
                  Try {streamType === "sub" ? "Dub" : "Sub"}
                </button>
                <button
                  onClick={() => loadEpisode(activeEpNo, streamType)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Top Bar (Always available, even for embeds) ────────────────────── */}
        <AnimatePresence>
          {(controlsVisible || !playing || activeSource?.isEmbed) && !streamError && (
            <motion.div
              key="top-bar"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 z-50 flex items-center gap-3 px-5 pt-5 pb-16 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none"
            >
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition flex-shrink-0 pointer-events-auto"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base md:text-lg truncate">{title}</p>
                <p className="text-slate-400 text-xs font-medium">Episode {activeEpNo}</p>
              </div>
              {/* Sub / Dub pill */}
              <div className="flex gap-1 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full p-1 flex-shrink-0 pointer-events-auto">
                {(["sub", "dub"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => switchType(t)}
                    disabled={loading}
                    className={`px-4 py-1 rounded-full text-xs font-black uppercase transition ${
                      streamType === t
                        ? "bg-purple-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Center & Bottom Controls (Native HLS only) ────────────────────── */}
        <AnimatePresence>
          {(controlsVisible || !playing) && !streamError && !activeSource?.isEmbed && (
            <motion.div
              key="controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex flex-col justify-between pointer-events-none"
            >
              {/* Spacer for top bar */}
              <div className="pt-24" />

              {/* Centre: prev / big play / next */}
              <div className="absolute inset-0 flex items-center justify-between px-8 md:px-16 pointer-events-none">
                <button
                  onClick={() => goToEpisode("prev")}
                  disabled={!hasPrev || loading}
                  className="pointer-events-auto p-3 rounded-full bg-black/30 hover:bg-black/60 disabled:opacity-20 transition backdrop-blur-sm"
                >
                  <ChevronLeft className="w-7 h-7 text-white" />
                </button>

                <button
                  onClick={togglePlay}
                  disabled={loading}
                  className="pointer-events-auto w-20 h-20 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 flex items-center justify-center transition disabled:opacity-40"
                >
                  {loading
                    ? <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : playing
                    ? <Pause className="w-8 h-8 text-white fill-white" />
                    : <Play className="w-8 h-8 text-white fill-white ml-1" />
                  }
                </button>

                <button
                  onClick={() => goToEpisode("next")}
                  disabled={!hasNext || loading}
                  className="pointer-events-auto p-3 rounded-full bg-black/30 hover:bg-black/60 disabled:opacity-20 transition backdrop-blur-sm"
                >
                  <ChevronRight className="w-7 h-7 text-white" />
                </button>
              </div>

              {/* Bottom controls */}
              <div className="px-5 pb-5 pt-16 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-auto">
                {/* Progress bar */}
                <div
                  className="relative h-1.5 group mb-5 cursor-pointer"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleSeek((e.clientX - rect.left) / rect.width);
                  }}
                >
                  <div className="absolute inset-0 rounded-full bg-white/20" />
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-white/30"
                    style={{ width: `${bufferedPct}%` }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 transition-[width]"
                    style={{ width: `${progressPct}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg scale-0 group-hover:scale-100 transition-transform"
                    style={{ left: `calc(${progressPct}% - 8px)` }}
                  />
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Play/Pause */}
                  <button onClick={togglePlay} disabled={loading} className="text-white hover:text-purple-300 transition">
                    {playing
                      ? <Pause className="w-7 h-7" />
                      : <Play className="w-7 h-7 fill-white" />
                    }
                  </button>

                  {/* Skip -10 */}
                  <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition hidden sm:block">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  {/* Skip +10 */}
                  <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition hidden sm:block">
                    <SkipForward className="w-5 h-5" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/vol">
                    <button
                      onClick={() => { const v = videoRef.current; if (v) v.muted = !v.muted; }}
                      className="text-white hover:text-purple-300 transition"
                    >
                      {muted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <input
                      type="range" min={0} max={1} step={0.02}
                      value={muted ? 0 : volume}
                      onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-300 accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Time */}
                  <span className="text-slate-300 text-sm font-mono select-none whitespace-nowrap">
                    {fmt(currentTime)} / {fmt(duration)}
                  </span>

                  <div className="flex-1" />

                  {/* Episodes */}
                  <button
                    onClick={e => { e.stopPropagation(); setShowEpisodePanel(v => !v); }}
                    className={`transition ${showEpisodePanel ? "text-purple-400" : "text-white hover:text-purple-300"}`}
                    title="Episodes"
                  >
                    <List className="w-6 h-6" />
                  </button>

                  {/* Fullscreen */}
                  <button onClick={toggleFullscreen} className="text-white hover:text-purple-300 transition">
                    {fullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Episode panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEpisodePanel && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9100] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowEpisodePanel(false)}
            />
            <motion.div
              key="panel"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed top-0 right-0 bottom-0 z-[9200] w-full sm:w-[380px] bg-[#0d0d0d] border-l border-white/10 flex flex-col"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-black text-white">Episodes</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{episodes.length} total</p>
                </div>
                <button onClick={() => setShowEpisodePanel(false)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
                {episodes.map(ep => {
                  const isActive = ep.number === activeEpNo;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => { loadEpisode(ep.number, streamType); setShowEpisodePanel(false); }}
                      className={`w-full text-left flex items-center gap-4 px-5 py-4 border-b border-white/5 transition-colors group ${
                        isActive
                          ? "bg-purple-600/15 border-l-2 border-l-purple-500 pl-[18px]"
                          : "hover:bg-white/5 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm transition ${
                        isActive ? "bg-purple-600 text-white" : "bg-white/10 text-slate-400 group-hover:bg-white/20"
                      }`}>
                        {ep.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isActive ? "text-purple-300" : "text-white"}`}>
                          {ep.title || `Episode ${ep.number}`}
                        </p>
                        {(ep as any).hasDub && (
                          <p className="text-slate-500 text-xs mt-0.5">Sub &amp; Dub available</p>
                        )}
                      </div>
                      {isActive && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
