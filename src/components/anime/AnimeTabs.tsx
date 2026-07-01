"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import CommunityFeed from "../community/CommunityFeed";
import { Anime } from "@tutkli/jikan-ts";

export default function AnimeTabs({ anime }: { anime: Anime }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="w-full">
      <div className="flex border-b border-white/10 mb-8">
        <button 
          onClick={() => setActiveTab("overview")}
          className={`px-6 py-4 font-bold text-lg transition-colors border-b-2 ${activeTab === "overview" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab("discussions")}
          className={`px-6 py-4 font-bold text-lg transition-colors border-b-2 ${activeTab === "discussions" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-white"}`}
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
                    <ExternalLink className="w-4 h-4" /> MyAnimeList
                  </a>
                  {anime.trailer?.url && (
                    <a href={anime.trailer.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition text-slate-300">
                      <ExternalLink className="w-4 h-4" /> YouTube Trailer
                    </a>
                  )}
                </div>
              </div>
            )}
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
