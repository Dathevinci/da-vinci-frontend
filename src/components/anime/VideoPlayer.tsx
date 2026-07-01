"use client";

import { useState } from "react";
import { Play } from "lucide-react";

interface VideoPlayerProps {
  animeTitle: string;
  animeImage?: string;
  episode?: number;
}

export default function VideoPlayer({ animeTitle, animeImage, episode = 1 }: VideoPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  const startStream = () => {
    // Generate a URL slug from the title (e.g., "One Piece" -> "one-piece")
    // This removes special characters and converts spaces to dashes for the iframe provider
    const slug = animeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // We use a direct frontend iframe to bypass Vercel server Cloudflare blocks entirely!
    // The user's browser will load this streaming source natively.
    const url = `https://anime-world.in/player/${slug}-episode-${episode}`;
    
    setIframeSrc(url);
    setHasStarted(true);
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
        {iframeSrc && (
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
