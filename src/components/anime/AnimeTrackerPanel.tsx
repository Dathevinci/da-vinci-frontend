"use client";

import { useAnimeStatus, AnimeUserStatus } from "@/hooks/useAnimeStatus";
import { Anime } from '@tutkli/jikan-ts';
import { Check, Clock, Eye, Heart, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

export default function AnimeTrackerPanel({ anime }: { anime: Anime }) {
  const { getStatus, setStatus, isLoaded } = useAnimeStatus();
  const [isOpen, setIsOpen] = useState(false);
  
  if (!isLoaded) return <div className="h-12 w-48 bg-white/5 animate-pulse rounded-full" />;

  const currentStatus = getStatus(anime.mal_id);

  const statusConfig: Record<AnimeUserStatus, { icon: any, label: string, color: string }> = {
    Watching: { icon: Eye, label: "Watching", color: "text-green-400 bg-green-500/10 border-green-500/50" },
    Interested: { icon: Heart, label: "Interested", color: "text-pink-400 bg-pink-500/10 border-pink-500/50" },
    Waiting: { icon: Clock, label: "Waiting", color: "text-blue-400 bg-blue-500/10 border-blue-500/50" },
    Finished: { icon: Check, label: "Finished", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/50" },
    Dropped: { icon: X, label: "Dropped", color: "text-red-400 bg-red-500/10 border-red-500/50" },
    None: { icon: ChevronDown, label: "Add to Tracker", color: "text-white bg-white/10 border-white/20 hover:bg-white/20" }
  };

  const currentConfig = statusConfig[currentStatus];
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-2 px-6 py-3 rounded-full font-bold transition border backdrop-blur-md shadow-lg",
          currentConfig.color
        )}
      >
        <CurrentIcon className="w-5 h-5" />
        {currentConfig.label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          {(Object.keys(statusConfig) as AnimeUserStatus[]).map(status => {
            const Config = statusConfig[status];
            const Icon = Config.icon;
            return (
              <button
                key={status}
                onClick={() => { setStatus(anime, status); setIsOpen(false); }}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 text-sm font-semibold transition hover:bg-white/10",
                  currentStatus === status ? "bg-indigo-500/20 text-indigo-400" : "text-slate-300"
                )}
              >
                <Icon className="w-4 h-4" />
                {Config.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
