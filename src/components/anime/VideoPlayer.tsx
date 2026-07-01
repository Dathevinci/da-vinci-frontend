"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, AlertCircle, X, Maximize, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoPlayerProps {
  animeTitle: string;
}

export default function VideoPlayer({ animeTitle }: VideoPlayerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoLinks, setVideoLinks] = useState<string[]>([]);
  const [currentLink, setCurrentLink] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const extractVideoLinks = (items: any[]): string[] => {
    const links: string[] = [];
    const stringified = JSON.stringify(items);
    
    // Fallback regex to catch common video extensions and embed URLs
    const urlRegex = /(https?:\/\/[^\s"',]+(\.mp4|\.m3u8|\/embed\/|\/iframe\/)[^\s"',]*)/gi;
    const matches = stringified.match(urlRegex);
    if (matches) {
       links.push(...matches);
    }

    // Deep traverse to find keys that sound like video URLs or raw HTML iframes
    const traverse = (obj: any) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.includes('<iframe') && obj.includes('src=')) {
          const srcMatch = obj.match(/src="([^"]+)"/);
          if (srcMatch) links.push(srcMatch[1]);
        }
      }
      if (typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          const k = key.toLowerCase();
          if ((k.includes('url') || k.includes('video') || k.includes('link') || k.includes('stream')) && value.startsWith('http')) {
            // Filter out obvious image links
            if (!value.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              links.push(value);
            }
          }
        } else if (typeof value === 'object') {
          traverse(value);
        }
      }
    };
    
    items.forEach(item => traverse(item));
    return Array.from(new Set(links)); // Deduplicate
  };

  const fetchStream = async () => {
    if (!animeTitle) return;
    setLoading(true);
    setError(null);
    setHasStarted(true);

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: animeTitle })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch stream.");
      }

      const links = extractVideoLinks(data.results);
      if (links.length > 0) {
        setVideoLinks(links);
        setCurrentLink(links[0]);
      } else {
        throw new Error("No playable video sources found in the dataset.");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="w-full aspect-video bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center group cursor-pointer overflow-hidden relative" onClick={fetchStream}>
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex flex-col items-center gap-4 z-10 transform group-hover:scale-105 transition-transform">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.5)] group-hover:shadow-[0_0_60px_rgba(79,70,229,0.8)] transition-shadow">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
          <p className="text-white font-bold tracking-wider">WATCH NOW</p>
          <p className="text-white/50 text-xs">Powered by Apify</p>
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
            <p className="text-sm font-semibold animate-pulse">Scraping stream data... This may take up to 20 seconds.</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-red-400 px-6 text-center max-w-md">
            <AlertCircle className="w-10 h-10" />
            <p className="font-bold">Stream Error</p>
            <p className="text-sm opacity-80">{error}</p>
            <button onClick={fetchStream} className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-colors">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && currentLink && (
          currentLink.endsWith('.mp4') || currentLink.endsWith('.webm') ? (
            <video src={currentLink} controls autoPlay className="w-full h-full outline-none" />
          ) : (
            <iframe 
              src={currentLink} 
              allowFullScreen 
              allow="autoplay; fullscreen"
              className="w-full h-full border-none"
            />
          )
        )}
      </div>

      {/* Server/Source Selection */}
      {!loading && !error && videoLinks.length > 1 && (
        <div className="p-4 bg-white/5 border-t border-white/10">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Available Sources</p>
          <div className="flex flex-wrap gap-2">
            {videoLinks.map((link, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentLink(link)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  currentLink === link 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                Server {idx + 1}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
