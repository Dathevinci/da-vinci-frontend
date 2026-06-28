"use client";

import { useAnimeStatus, AnimeUserStatus } from "@/hooks/useAnimeStatus";
import AnimeCard from "@/components/anime/AnimeCard";
import { Compass, Eye, Heart, Clock, Check, ListFilter } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function ProfileTrackerPage() {
  const { getTrackedList, isLoaded } = useAnimeStatus();
  const [filter, setFilter] = useState<AnimeUserStatus | "All">("All");

  if (!isLoaded) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading Tracker...</div>;

  const allTracked = getTrackedList();
  const filteredList = filter === "All" ? allTracked : getTrackedList(filter as AnimeUserStatus);

  const filterTabs = [
    { id: "All", icon: ListFilter },
    { id: "Watching", icon: Eye },
    { id: "Interested", icon: Heart },
    { id: "Waiting", icon: Clock },
    { id: "Finished", icon: Check },
  ];

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 flex items-center gap-3 text-indigo-400">
              <Compass className="w-10 h-10" /> My Tracker
            </h1>
            <p className="text-slate-400">Locally saved anime statuses. (Uses localStorage, strictly private)</p>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-1 rounded-lg flex overflow-x-auto max-w-full hide-scrollbar">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${filter === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <tab.icon className="w-4 h-4" /> {tab.id}
              </button>
            ))}
          </div>
        </div>

        {allTracked.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <Compass className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-300 mb-2">Your Tracker is Empty</h2>
            <p className="text-slate-500 mb-6">Explore the dashboard and start tracking your favorite anime!</p>
            <Link href="/">
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full font-bold transition shadow-lg">
                Discover Anime
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredList.map(item => (
              <div key={item.anime.id} className="relative group">
                <AnimeCard anime={item.anime} />
                <div className="absolute -top-3 -right-3 z-50 bg-[#141414] border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-indigo-300 shadow-xl">
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {allTracked.length > 0 && filteredList.length === 0 && (
          <div className="text-center py-20 text-slate-500 font-medium">
            No anime found in the "{filter}" category.
          </div>
        )}
      </div>
    </div>
  );
}
