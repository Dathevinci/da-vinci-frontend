"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import ReactPlayer from 'react-player';

interface VideoPlayerProps {
  animeTitle: string;
  animeImage?: string;
  episode?: number;
  animeId?: number;
  animeStatus?: string;
}

export default function VideoPlayer({ animeTitle, animeImage, episode = 1, animeId, animeStatus }: VideoPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);

  const startStream = async () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);
    setVideoSrc(null);

    try {
      // Hit our own backend API to scrape Hianime
      const res = await fetch(`/api/stream/hianime?title=${encodeURIComponent(animeTitle)}&episode=${episode}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch stream");
      }

      const data = json.data;
      if (!data || !data.sources || data.sources.length === 0) {
        throw new Error("No video sources found");
      }

      // Find the highest quality source or default to first (usually auto/1080p)
      const defaultSource = data.sources.find((s: any) => s.isM3U8) || data.sources[0];
      setVideoSrc(defaultSource.url);

      if (data.tracks && data.tracks.length > 0) {
        const formattedTracks = data.tracks
          .filter((t: any) => t.kind === 'captions')
          .map((t: any) => ({
            kind: 'subtitles',
            src: t.file,
            srcLang: t.label.toLowerCase().slice(0, 2),
            label: t.label,
            default: t.default || false,
          }));
        setTracks(formattedTracks);
      }

    } catch (err: any) {
      console.error("Stream Error:", err);
      // Detailed error if it might be Cloudflare
      if (err.message.includes("522") || err.message.includes("timeout")) {
         setError("Cloudflare blocked the streaming server. Hianime is currently unreachable.");
      } else {
         setError(err.message || "Failed to load stream. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hasStarted) {
    if (animeStatus === "NOT_YET_RELEASED") {
      return (
        <div className="w-full aspect-video bg-[#0a0a0c] border border-white/10 rounded-2xl flex flex-col items-center justify-center relative shadow-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Not Yet Released</h3>
          <p className="text-slate-400 max-w-md">
            This anime has not aired yet. Video episodes will become available here once the season officially begins broadcasting.
          </p>
        </div>
      );
    }

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
    <div className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
      <div className="w-full aspect-video relative bg-black flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-4 text-indigo-400">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-semibold animate-pulse">Scraping Hianime API...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-red-400 px-6 text-center max-w-md">
            <AlertCircle className="w-10 h-10" />
            <p className="font-bold">Stream Error</p>
            <p className="text-sm opacity-80">{error}</p>
            <button onClick={startStream} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-full transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry Hianime
            </button>
          </div>
        )}

        {!loading && !error && videoSrc && (
          <div className="w-full h-full absolute inset-0 player-wrapper">
             <ReactPlayer 
               url={videoSrc}
               controls
               width="100%"
               height="100%"
               playing
               config={{
                 file: {
                   attributes: {
                     crossOrigin: 'anonymous'
                   },
                   tracks: tracks
                 }
               }}
             />
          </div>
        )}
      </div>
    </div>
  );
}
