"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

function FiltersInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [query, setQuery] = useState(sp.get("q") || "");
  const [status, setStatus] = useState(sp.get("status") || "");
  const [sort, setSort] = useState(sp.get("sort") || "followedCount");
  const [open, setOpen] = useState(false);

  const apply = () => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (status) p.set("status", status);
    if (sort && sort !== "followedCount") p.set("sort", sort);
    p.set("page", "1");
    router.push(`/manhwa?${p.toString()}`);
  };

  const clear = () => {
    setQuery(""); setStatus(""); setSort("followedCount");
    router.push("/manhwa?page=1");
  };

  return (
    <div className="w-full">
      <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search manhwa..."
          className="w-full bg-[#151518] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-colors text-white placeholder:text-slate-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
      </form>

      <button
        onClick={() => setOpen(!open)}
        className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {open ? "Hide Filters" : "Show Filters"}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#151518] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-red-500/50"
            >
              <option value="">All</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="hiatus">Hiatus</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Sort By</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full bg-[#151518] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-red-500/50"
            >
              <option value="followedCount">Most Popular</option>
              <option value="latestUploadedChapter">Latest Updated</option>
              <option value="rating">Highest Rated</option>
              <option value="year">Newest</option>
            </select>
          </div>

          <div className="flex gap-2 mt-1">
            <button onClick={apply} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition">
              Apply
            </button>
            <button onClick={clear} className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition border border-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManhwaFilters() {
  return (
    <Suspense fallback={<div className="w-full h-12 bg-white/5 rounded-xl animate-pulse" />}>
      <FiltersInner />
    </Suspense>
  );
}
