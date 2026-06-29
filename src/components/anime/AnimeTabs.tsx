"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import CommunityFeed from "../community/CommunityFeed";

export default function AnimeTabs({ anime }: { anime: any }) {
  const [activeTab, setActiveTab] = useState("overview");
  const nextEp = anime.nextAiringEpisode;

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
              <div className="text-slate-300 leading-relaxed text-lg bg-white/5 p-6 rounded-2xl border border-white/5" dangerouslySetInnerHTML={{ __html: anime.description || "No synopsis available." }} />
            </div>
            
            {/* Characters & Cast */}
            {anime.characters && anime.characters.edges.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Characters & Cast</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {anime.characters.edges.map((edge: any, idx: number) => {
                    const character = edge.node;
                    const va = edge.voiceActors?.[0]; // Get the main Japanese VA
                    return (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex justify-between h-24">
                        {/* Character Side */}
                        <div className="flex flex-1 min-w-0">
                          <img src={character.image.large} alt={character.name.full} className="w-16 h-full object-cover" />
                          <div className="p-3 flex flex-col justify-center min-w-0">
                            <span className="font-bold text-sm truncate block text-white">{character.name.full}</span>
                            <span className="text-xs text-indigo-400 capitalize">{edge.role.toLowerCase()}</span>
                          </div>
                        </div>
                        
                        {/* Voice Actor Side */}
                        {va && (
                          <div className="flex flex-1 min-w-0 flex-row-reverse text-right bg-black/20">
                            <img src={va.image.large} alt={va.name.full} className="w-16 h-full object-cover" />
                            <div className="p-3 flex flex-col justify-center min-w-0">
                              <span className="font-bold text-sm truncate block text-white">{va.name.full}</span>
                              <span className="text-xs text-slate-500">Japanese</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Related Media */}
            {anime.relations && anime.relations.edges.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Related Media</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {anime.relations.edges.map((edge: any, idx: number) => {
                    const relation = edge.node;
                    // Format relation type (e.g., "SIDE_STORY" -> "Side Story")
                    const typeLabel = edge.relationType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                    
                    return (
                      <Link href={relation.type === 'ANIME' ? `/anime/${relation.id}` : '#'} key={idx}>
                        <div className="bg-white/5 border border-white/10 hover:border-indigo-500/50 rounded-xl overflow-hidden transition group h-full flex flex-col">
                          <div className="aspect-[2/3] w-full relative bg-slate-800">
                            <img src={relation.coverImage.large} alt={relation.title.english || relation.title.romaji} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase">
                              {typeLabel}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur text-slate-300 text-[10px] font-bold px-2 py-1 rounded">
                              {relation.format}
                            </div>
                          </div>
                          <div className="p-3 flex-1 flex flex-col justify-center">
                            <span className="font-bold text-sm line-clamp-2 text-slate-200 group-hover:text-indigo-300 transition">
                              {relation.title.english || relation.title.romaji}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {nextEp && (
              <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-6 flex items-center gap-6">
                <Clock className="w-10 h-10 text-indigo-400" />
                <div>
                  <h3 className="text-xl font-bold text-indigo-100 mb-1">Episode {nextEp.episode} Airing Soon</h3>
                  <p className="text-indigo-300">
                    {Math.floor(nextEp.timeUntilAiring / 86400)} days, {Math.floor((nextEp.timeUntilAiring % 86400) / 3600)} hours, and {Math.floor((nextEp.timeUntilAiring % 3600) / 60)} minutes
                  </p>
                </div>
              </div>
            )}
            
            {/* Official External Links */}
            {anime.externalLinks && anime.externalLinks.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Official Info Links</h2>
                <div className="flex flex-wrap gap-3">
                  {anime.externalLinks.filter((l: any) => l.type === "INFO" || l.type === "SOCIAL").map((link: any, idx: number) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition text-slate-300">
                      <ExternalLink className="w-4 h-4" /> {link.site}
                    </a>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {activeTab === "discussions" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CommunityFeed animeId={anime.id} />
        </div>
      )}
    </div>
  );
}
