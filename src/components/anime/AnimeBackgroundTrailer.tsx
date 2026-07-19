"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";

interface Props {
  trailerId: string;
  bannerUrl?: string;
}

export default function AnimeBackgroundTrailer({ trailerId, bannerUrl }: Props) {
  const { preferences } = usePreferences();
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(preferences.autoplayTrailers);
  const [isLoaded, setIsLoaded] = useState(false);
  const [volume, setVolume] = useState(50);
  const [actualPlaying, setActualPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    }
  };

  useEffect(() => {
    // When the component mounts, the iframe starts loading
    // We add a slight delay to fade it in
    const timer = setTimeout(() => {
      setIsLoaded(true);
      sendCommand('addEventListener', ['onStateChange']);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://www.youtube.com') return;
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'onStateChange') {
          if (data.info === 1) setActualPlaying(true);
          else setActualPlaying(false);
        }
      } catch (err) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);



  const toggleMute = () => {
    if (isMuted) {
      sendCommand('unMute');
      setIsMuted(false);
    } else {
      sendCommand('mute');
      setIsMuted(true);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      sendCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      sendCommand('playVideo');
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    sendCommand('setVolume', [newVolume]);
    if (isMuted && newVolume > 0) {
      sendCommand('unMute');
      setIsMuted(false);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#09090b]">
      {/* Fallback Banner */}
      <img 
        src={bannerUrl} 
        alt="Banner" 
        className={`absolute inset-0 w-full h-full object-cover mix-blend-screen transition-opacity duration-1000 ${(isLoaded && actualPlaying) ? 'opacity-0' : 'opacity-50'}`} 
      />

      {/* YouTube IFrame */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto aspect-video pointer-events-none transition-opacity duration-1000 ${(isLoaded && actualPlaying) ? 'opacity-50 mix-blend-screen' : 'opacity-0'}`}>
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${trailerId}?autoplay=${preferences.autoplayTrailers ? '1' : '0'}&mute=1&controls=0&showinfo=0&rel=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1`}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          title="Anime Trailer"
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />

      {/* Controls Overlay */}
      {isLoaded && (
        <div className="absolute bottom-24 md:bottom-auto md:top-24 right-4 md:right-12 z-20 flex flex-col gap-2 items-end">
          <button 
            onClick={togglePlay}
            className="bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 text-white p-3 rounded-full transition"
            title={isPlaying ? "Pause Trailer" : "Play Trailer"}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <div className="group flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 rounded-full p-2 pr-4 transition-all">
            <button 
              onClick={toggleMute}
              className="text-white p-1 rounded-full transition"
              title={isMuted ? "Unmute Trailer" : "Mute Trailer"}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-0 opacity-0 group-hover:w-24 group-hover:opacity-100 transition-all duration-300 cursor-pointer accent-purple-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
