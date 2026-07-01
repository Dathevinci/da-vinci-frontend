"use client";

import { useState } from "react";
import { Play, Loader2, AlertCircle, Server } from "lucide-react";

interface VideoPlayerProps {
  animeTitle: string;
  animeImage?: string;
  episode?: number;
  animeId?: number;
}

export default function VideoPlayer({ animeTitle, animeImage, episode = 1, animeId }: VideoPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // We will store multiple servers here so the user can switch if one is blocked or missing an episode
  const [servers, setServers] = useState<{name: string, url: string}[]>([]);
  const [currentServerIdx, setCurrentServerIdx] = useState(0);

  const startStream = async () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);

    try {
      const availableServers: {name: string, url: string}[] = [];
      const slug = animeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // 1. Fetch MAL ID from Jikan (MyAnimeList API) for Vidlink (Most reliable)
      try {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeTitle)}&limit=1`);
        const jikanData = await jikanRes.json();
        
        if (jikanData.data && jikanData.data.length > 0) {
          const malId = jikanData.data[0].mal_id;
          availableServers.push({
            name: "VidLink (HD)",
            url: `https://vidlink.pro/anime/${malId}/${episode}/sub?primaryColor=4f46e5&autoplay=true`
          });
        }
      } catch (e) {
        console.warn("Could not fetch MAL ID from Jikan");
      }

      // 2. Add AutoEmbed (Uses Anilist ID natively)
      if (animeId) {
        availableServers.push({
          name: "AutoEmbed",
          url: `https://anime.autoembed.cc/embed/anilist/${animeId}-episode-${episode}`
        });
      }

      // 3. Add Anime-World fallback (Uses slug, might be blocked by some ISPs)
      availableServers.push({
        name: "AnimeWorld",
        url: `https://anime-world.in/player/${slug}-episode-${episode}`
      });

      if (availableServers.length === 0) {
        throw new Error("Could not find any stream servers.");
      }

      setServers(availableServers);
      setCurrentServerIdx(0);

    } catch (err: any) {
      console.error(err);
      setError("Failed to load stream servers. Please try again.");
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
      {/* Video Container */}
      <div className="w-full aspect-video relative bg-black flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-4 text-indigo-400">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-semibold animate-pulse">Finding stream sources...</p>
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

        {!loading && !error && servers.length > 0 && (
          <iframe 
            key={servers[currentServerIdx].url}
            src={servers[currentServerIdx].url} 
            allowFullScreen 
            allow="autoplay; fullscreen"
            className="w-full h-full border-none absolute top-0 left-0"
          />
        )}
      </div>

      {/* Server Selector */}
      {!loading && !error && servers.length > 1 && (
        <div className="p-4 bg-white/5 border-t border-white/10 flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider flex-shrink-0">
            <Server className="w-4 h-4" />
            Servers
          </div>
          <div className="flex gap-2">
            {servers.map((server, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentServerIdx(idx)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  currentServerIdx === idx 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' 
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {server.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
