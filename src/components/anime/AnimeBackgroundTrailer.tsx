"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";

interface Props {
  trailerId: string;
  bannerUrl: string;
}

export default function AnimeBackgroundTrailer({ trailerId, bannerUrl }: Props) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // When the component mounts, the iframe starts loading
    // We add a slight delay to fade it in
    const timer = setTimeout(() => setIsLoaded(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const sendCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    }
  };

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

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#09090b]">
      {/* Fallback Banner */}
      <img 
        src={bannerUrl} 
        alt="Banner" 
        className={`absolute inset-0 w-full h-full object-cover mix-blend-screen transition-opacity duration-1000 ${isLoaded ? 'opacity-0' : 'opacity-50'}`} 
      />

      {/* YouTube IFrame */}
      <div className={`absolute inset-0 w-[150vw] h-[150vh] -top-[25vh] -left-[25vw] pointer-events-none transition-opacity duration-1000 ${isLoaded ? 'opacity-50 mix-blend-screen' : 'opacity-0'}`}>
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerId}&enablejsapi=1`}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          title="Anime Trailer"
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />

      {/* Controls Overlay */}
      {isLoaded && (
        <div className="absolute top-24 right-4 md:right-12 z-20 flex flex-col gap-2">
          <button 
            onClick={toggleMute}
            className="bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 text-white p-3 rounded-full transition"
            title={isMuted ? "Unmute Trailer" : "Mute Trailer"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button 
            onClick={togglePlay}
            className="bg-black/40 hover:bg-black/60 backdrop-blur border border-white/10 text-white p-3 rounded-full transition"
            title={isPlaying ? "Pause Trailer" : "Play Trailer"}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
        </div>
      )}
    </div>
  );
}
