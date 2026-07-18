"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface VideoPlayerProps {
  streamUrl: string | null;
  loading?: boolean;
  error?: string | null;
}

export default function VideoPlayer({ streamUrl, loading, error }: VideoPlayerProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div className="w-full relative bg-black aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl group">
      {(loading || (!iframeLoaded && streamUrl)) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-indigo-400">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="font-bold tracking-widest text-sm uppercase">Loading Stream...</p>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 p-8 text-center border border-red-500/20">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Stream Unavailable</h3>
          <p className="text-slate-400 max-w-md">{error}</p>
        </div>
      )}

      {streamUrl && !error && (
        <iframe
          src={streamUrl}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoaded(true)}
        />
      )}

      {!streamUrl && !loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-slate-500">
          <p className="text-lg font-bold">Select a server to start watching</p>
        </div>
      )}

      {iframeLoaded && streamUrl && !error && (
        <div className="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-white tracking-wider uppercase">Streaming</span>
          </div>
        </div>
      )}
    </div>
  );
}
