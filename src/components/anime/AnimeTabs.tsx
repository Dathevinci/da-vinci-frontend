"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ExternalLink, PlayCircle } from "lucide-react";
import CommunityFeed from "../community/CommunityFeed";
import EpisodeList from "./EpisodeList";
import { Anime } from "@tutkli/jikan-ts";
import { getYouTubeId } from "@/lib/jikan";

import { useSearchParams } from 'next/navigation';

export default function AnimeTabs({ anime }: { anime: Anime }) {
  // Status may be AniList-shaped ("NOT_YET_RELEASED") or MAL/Jikan-shaped ("Not yet aired")
  const rawStatus = String((anime as any)._anilistStatus || anime.status || "").toLowerCase();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  
  // Extra safety: Check if the airing date is in the future
  let isFutureDate = false;
  if (anime.aired?.from) {
    const airedDate = new Date(anime.aired.from).getTime();
    if (airedDate > Date.now()) {
      isFutureDate = true;
    }
  }

  const isUnreleased = isFutureDate || rawStatus.includes("not_yet") || rawStatus.includes("not yet") || rawStatus.includes("upcoming") || rawStatus.includes("tba");
  const [activeTab, setActiveTab] = useState("overview");

  // Allow linking directly to a specific tab
  useEffect(() => {
    if (tabParam === "watch" && !isUnreleased) {
      setActiveTab("watch");
    } else if (tabParam === "discussions") {
      setActiveTab("discussions");
    }
  }, [tabParam, isUnreleased]);

  return (
    <div className="w-full">
      <div className="flex border-b border-white/10 mb-8 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab("overview")}
          className={`px-6 py-4 font-bold text-lg transition-colors border-b-2 whitespace-nowrap ${activeTab === "overview" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"}`}
        >
          Overview
        </button>
        {/* Only show Watch tab for anime that have or will have episodes */}
        {!isUnreleased && (
          <button 
            onClick={() => setActiveTab("watch")}
            className={`px-6 py-4 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === "watch" ? "border-pink-500 text-pink-400" : "border-transparent text-slate-400 hover:text-white"}`}
          >
            <PlayCircle className="w-5 h-5" /> Watch
          </button>
        )}
        <button 
          onClick={() => setActiveTab("discussions")}
          className={`px-6 py-4 font-bold text-lg transition-colors border-b-2 whitespace-nowrap ${activeTab === "discussions" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"}`}
        >
          Discussions
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold mb-4">Synopsis</h2>
              <div className="text-slate-300 leading-relaxed text-lg bg-white/5 p-6 rounded-2xl border border-white/5 whitespace-pre-wrap">
                {anime.synopsis || "No synopsis available."}
              </div>
            </div>

            {anime.background && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Background</h2>
                <div className="text-slate-300 leading-relaxed text-lg bg-white/5 p-6 rounded-2xl border border-white/5 whitespace-pre-wrap">
                  {anime.background}
                </div>
              </div>
            )}
            
            {/* Official External Links */}
            {anime.url && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Official Links</h2>
                <div className="flex flex-wrap gap-3">
                  <a href={anime.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition text-slate-300">
                    <ExternalLink className="w-4 h-4" /> {(anime as any)._source === "jikan" ? "MyAnimeList" : "AniList"}
                  </a>
                  {getYouTubeId(anime.trailer) && (
                    <a href={`https://youtube.com/watch?v=${getYouTubeId(anime.trailer)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition text-slate-300">
                      <ExternalLink className="w-4 h-4" /> YouTube Trailer
                    </a>
                  )}
                </div>
              </div>
            )}
        </div>
      )}

      {activeTab === "watch" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <EpisodeList anime={anime} />
        </div>
      )}

      {activeTab === "discussions" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CommunityFeed 
            animeId={anime.mal_id} 
            animeTitle={anime.title_english || anime.title} 
          />
        </div>
      )}
    </div>
  );
}
