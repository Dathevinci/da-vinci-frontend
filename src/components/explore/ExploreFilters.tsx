"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, Filter, X } from "lucide-react";
import { useState } from "react";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror",
  "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const SORTS = [
  { label: "Popularity", value: "popularity" },
  { label: "Highest Rated", value: "score" },
  { label: "Newest First", value: "newest" },
  { label: "Oldest First", value: "oldest" },
];

const FORMATS = [
  { label: "TV Show", value: "tv" },
  { label: "Movie", value: "movie" },
  { label: "Special", value: "special" },
  { label: "OVA", value: "ova" },
  { label: "ONA", value: "ona" },
];

const STATUSES = [
  { label: "Airing Now", value: "airing" },
  { label: "Finished", value: "complete" },
  { label: "Upcoming", value: "upcoming" },
];

export default function ExploreFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const currentQuery = searchParams.get("q") || "";
  const currentGenres = searchParams.get("genre")?.split(",") || [];
  const currentSort = searchParams.get("sort") || "popularity";
  const currentFormat = searchParams.get("format") || "";
  const currentStatus = searchParams.get("status") || "";

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // reset page on filter change
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    router.push(`/explore?${params.toString()}`);
  };

  const toggleGenre = (genre: string) => {
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre];
    updateFilters({ genre: newGenres.length > 0 ? newGenres.join(",") : null });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateFilters({ q: formData.get("q") as string });
  };

  return (
    <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-6">
      {/* Mobile Toggle */}
      <button 
        className="lg:hidden w-full flex items-center justify-center gap-2 bg-indigo- hover:bg-purple-500 text-white py-3 rounded-xl font-bold transition"
        onClick={() => setIsMobileFiltersOpen(true)}
      >
        <Filter className="w-5 h-5" /> Filters & Search
      </button>

      <div className={`fixed inset-0 z-50 bg-[#09090b] lg:bg-transparent lg:static lg:block p-6 lg:p-0 overflow-y-auto lg:overflow-visible transition-transform ${isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex justify-between items-center mb-6 lg:hidden">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Filter className="w-5 h-5" /> Filters</h2>
          <button onClick={() => setIsMobileFiltersOpen(false)} className="text-slate-400 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="relative w-full">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              name="q"
              defaultValue={currentQuery}
              placeholder="Search anime..." 
              className="w-full bg-white/5 border border-white/10 text-white py-3 pl-12 pr-4 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white/10 transition shadow-inner"
            />
          </form>
        </div>

        {/* Sort */}
        <div className="mb-6 bg-white/5 border border-white/10 p-5 rounded-xl">
          <h3 className="font-bold text-white mb-3 text-sm tracking-wider uppercase">Sort By</h3>
          <div className="flex flex-col gap-2">
            {SORTS.map(sort => (
              <label key={sort.value} className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="sort" 
                  checked={currentSort === sort.value}
                  onChange={() => updateFilters({ sort: sort.value })}
                  className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 focus:ring-purple-500 focus:ring-offset-[#09090b]" 
                />
                <span className={`text-sm transition-colors ${currentSort === sort.value ? 'text-purple-400 font-bold' : 'text-slate-400 group-hover:text-slate-300'}`}>
                  {sort.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div className="mb-6 bg-white/5 border border-white/10 p-5 rounded-xl">
          <h3 className="font-bold text-white mb-3 text-sm tracking-wider uppercase flex justify-between items-center">
            Genres
            {currentGenres.length > 0 && (
              <button onClick={() => updateFilters({ genre: null })} className="text-xs text-purple-400 hover:text-purple-300 normal-case">Clear</button>
            )}
          </h3>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(genre => {
              const isSelected = currentGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    isSelected 
                      ? 'bg-indigo- text-white' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Format & Status */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl">
            <h3 className="font-bold text-white mb-3 text-sm tracking-wider uppercase">Format</h3>
            <select 
              value={currentFormat} 
              onChange={(e) => updateFilters({ format: e.target.value })}
              className="w-full bg-[#141414] border border-white/10 text-slate-300 rounded-lg p-2 focus:outline-none focus:border-purple-500"
            >
              <option value="">Any Format</option>
              {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-xl">
            <h3 className="font-bold text-white mb-3 text-sm tracking-wider uppercase">Status</h3>
            <select 
              value={currentStatus} 
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="w-full bg-[#141414] border border-white/10 text-slate-300 rounded-lg p-2 focus:outline-none focus:border-purple-500"
            >
              <option value="">Any Status</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
