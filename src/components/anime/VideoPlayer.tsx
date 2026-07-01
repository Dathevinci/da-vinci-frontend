"use client";

import { useState } from "react";
import { Play, Loader2, AlertCircle } from "lucide-react";

interface VideoPlayerProps {
  animeTitle: string;
  animeImage?: string;
  episode?: number;
}

export default function VideoPlayer({ animeTitle, animeImage, episode = 1 }: VideoPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  const startStream = async () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch MAL ID from Jikan (MyAnimeList API)
      const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeTitle)}&limit=1`);
      const jikanData = await jikanRes.json();
      
      if (!jikanData.data || jikanData.data.length === 0) {
        throw new Error("Could not find Anime ID for streaming.");
      }

      const malId = jikanData.data[0].mal_id;
      
      // 2. Generate vidlink.pro iframe URL using MAL ID
      // This provider is extremely stable and doesn't get DNS blocked as easily
      const url = `https://vidlink.pro/anime/${malId}/${episode}/sub?primaryColor=4f46e5&autoplay=true`;
      
      setIframeSrc(url);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load stream. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasStarted) {
    return (
      <div 
        className="w-full aspect-video bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center group cursor-pointer overflow-hidden relative shadow-2xl" 
        onClick={startStream}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex flex-col items-center gap-4 z-10 transform group-hover:scale-105 transition-transform">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.5)] group-hover:shadow-[0_0_60px_rgba(79,70,229,0.8)] transition-shadow">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
          <p className="text-white font-bold tracking-wider">WATCH NOW</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <div className="w-full aspect-video relative bg-black flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-4 text-indigo-400">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-semibold animate-pulse">Finding stream source...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-red-400 px-6 text-center max-w-md">
            <AlertCircle className="w-10 h-10" />
            <p className="font-bold">Stream Error</p>
            <p className="text-sm opacity-80">{error}</p>
            <button onClick={startStream} className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-colors">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && iframeSrc && (
          <iframe 
            src={iframeSrc} 
            allowFullScreen 
            allow="autoplay; fullscreen"
            className="w-full h-full border-none absolute top-0 left-0"
          />
        )}
      </div>
    </div>
  );
}
