import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, 
  Camera, PictureInPicture, ChevronRight, ChevronLeft
} from "lucide-react";
import Hls from "hls.js";

// We'll use standard Lucide icons and some custom SVGs for the specific skip buttons
const SkipBack10 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <text x="12" y="16" fontSize="8" fill="currentColor" strokeWidth="0" textAnchor="middle">10</text>
  </svg>
);

const SkipForward10 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <text x="12" y="16" fontSize="8" fill="currentColor" strokeWidth="0" textAnchor="middle">10</text>
  </svg>
);

const SkipIntro85 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <text x="12" y="16" fontSize="8" fill="currentColor" strokeWidth="0" textAnchor="middle">85</text>
  </svg>
);

interface DavinciPlayerProps {
  url: string;
}

export default function DavinciPlayer({ url }: DavinciPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState("main");
  
  const [isLoading, setIsLoading] = useState(true);

  let controlsTimeout: NodeJS.Timeout;

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (isPlaying) setShowControls(false);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, []);

  // Initialize Source
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setIsLoading(true);
    video.src = url;
    video.load();
    
    // Auto-play muted so it works without interaction blocks
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => {});
    });

  }, [url]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const skip = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += time;
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    videoRef.current.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const takeScreenshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataURI = canvas.toDataURL("image/jpeg");
    const a = document.createElement("a");
    a.href = dataURI;
    a.download = `anikoto-davinci-${Math.floor(videoRef.current.currentTime)}.jpg`;
    a.click();
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        playsInline
        crossOrigin="anonymous"
        preload="auto"
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/50 backdrop-blur-sm z-20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#E5FF00] rounded-full animate-spin mb-4" />
          <p className="font-mono text-xs font-bold text-[#E5FF00] tracking-widest uppercase shadow-black drop-shadow-md">
            Buffering Torrent...
          </p>
        </div>
      )}

      {/* Big Center Play Button (only when paused and not loading) */}
      <AnimatePresence>
        {!isPlaying && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white pl-2">
              <Play size={40} fill="currentColor" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 right-4 flex flex-col"
          >
            {/* Control Panel Container */}
            <div className="bg-[#1A1D24]/90 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl relative">
              
              {/* Progress Bar (at the top edge of the control panel) */}
              <div 
                className="relative w-full h-1.5 bg-white/20 cursor-pointer group/progress shrink-0"
                ref={progressRef}
                onClick={handleProgressClick}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-[#E5FF00] pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#E5FF00] rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
                  style={{ left: `calc(${progressPercent}% - 7px)` }}
                />
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between px-5 py-3">
              
              {/* Left Side */}
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-[#E5FF00] transition-colors">
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>

                <div className="flex items-center gap-2 group/volume">
                  <button onClick={toggleMute} className="text-white hover:text-[#E5FF00] transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 transition-all duration-300 accent-[#E5FF00]"
                  />
                </div>

                <div className="text-white/80 text-xs font-medium tracking-wide">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-4 relative">
                <button onClick={() => skip(-10)} className="text-white hover:text-[#E5FF00] transition-colors">
                  <SkipBack10 />
                </button>
                <button onClick={() => skip(10)} className="text-white hover:text-[#E5FF00] transition-colors">
                  <SkipForward10 />
                </button>
                <button onClick={() => skip(85)} className="text-white hover:text-[#E5FF00] transition-colors" title="Skip Intro (+85s)">
                  <SkipIntro85 />
                </button>
                <button onClick={takeScreenshot} className="text-white hover:text-[#E5FF00] transition-colors" title="Screenshot">
                  <Camera size={20} />
                </button>

                <button 
                  onClick={() => { setSettingsOpen(!settingsOpen); setSettingsMenu("main"); }} 
                  className={`transition-colors ${settingsOpen ? 'text-[#E5FF00]' : 'text-white hover:text-[#E5FF00]'}`}
                >
                  <Settings size={20} className={settingsOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
                </button>

                <button onClick={togglePiP} className="text-white hover:text-[#E5FF00] transition-colors">
                  <PictureInPicture size={20} />
                </button>

                <button onClick={toggleFullscreen} className="text-white hover:text-[#E5FF00] transition-colors">
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>

                {/* Settings Popover */}
                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-full right-16 mb-4 w-64 bg-[#1A1D24] text-white/90 rounded-2xl shadow-2xl overflow-hidden border border-white/5 z-50"
                    >
                      <AnimatePresence mode="wait">
                        {settingsMenu === "main" && (
                          <motion.div
                            key="main"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="flex flex-col py-2"
                          >
                            <SettingsRow label="Play Speed" value="Normal" onClick={() => setSettingsMenu("speed")} />
                            <SettingsRow label="Subtitles" value="English" onClick={() => setSettingsMenu("subtitles")} />
                            <SettingsRow label="Subtitle Size" value="100%" onClick={() => setSettingsMenu("subSize")} />
                            <SettingsRow label="Subtitle Quality" value="Auto" onClick={() => setSettingsMenu("subQuality")} />
                            <SettingsRow label="Volume Boost" value="Off" onClick={() => setSettingsMenu("volBoost")} />
                            <SettingsRow label="Audio Tracks" value="Native" onClick={() => setSettingsMenu("audio")} />
                          </motion.div>
                        )}

                        {settingsMenu === "subQuality" && (
                          <motion.div
                            key="subQuality"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            className="flex flex-col py-2"
                          >
                            <button 
                              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors font-medium border-b border-white/5"
                              onClick={() => setSettingsMenu("main")}
                            >
                              <ChevronLeft size={16} /> Subtitle Quality
                            </button>
                            <div className="px-4 py-2 text-xs text-white/50 border-b border-white/5">
                              Lower is smoother on slow devices
                            </div>
                            <div className="flex flex-col py-2">
                              <RadioOption label="Auto" active />
                              <RadioOption label="High (Source)" />
                              <RadioOption label="Medium (720p)" />
                              <RadioOption label="Low (480p)" />
                              <RadioOption label="Minimal (480p, no effects)" />
                            </div>
                          </motion.div>
                        )}

                        {/* Dummy states for others to allow returning to main */}
                        {["speed", "subtitles", "subSize", "volBoost", "audio"].includes(settingsMenu) && (
                          <motion.div
                            key="dummy"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            className="flex flex-col py-2"
                          >
                            <button 
                              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors font-medium border-b border-white/5"
                              onClick={() => setSettingsMenu("main")}
                            >
                              <ChevronLeft size={16} /> Back
                            </button>
                            <div className="px-4 py-4 text-sm text-center text-white/50">
                              Option coming soon
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
             </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsRow({ label, value, onClick }: { label: string, value: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between w-full px-5 py-3 hover:bg-white/5 transition-colors text-sm"
    >
      <span className="font-medium text-white/90">{label}</span>
      <div className="flex items-center gap-2 text-white/50">
        <span>{value}</span>
        <ChevronRight size={16} />
      </div>
    </button>
  );
}

function RadioOption({ label, active }: { label: string, active?: boolean }) {
  return (
    <button className="flex items-center gap-3 w-full px-5 py-3 hover:bg-white/5 transition-colors text-sm text-left">
      <div className={`w-0.5 h-4 rounded-full ${active ? 'bg-white' : 'bg-transparent'}`} />
      <span className={active ? "text-white font-medium" : "text-white/70"}>{label}</span>
    </button>
  );
}
