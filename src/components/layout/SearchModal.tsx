"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, Compass } from "lucide-react";
import { useRouter } from "next/navigation";
import { searchAnime } from "@/lib/jikan";
import Link from "next/link";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { Anime } from "@tutkli/jikan-ts";

interface SearchModalProps {
  onClose: () => void;
}

export default function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  
  useLockBodyScroll();

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await searchAnime({ search: query, page: 1 });
        // Only take the top 5 results for the quick preview
        setResults(res.Page.media.slice(0, 5));
      } catch (error) {
        console.error("Search failed", error);
      } finally {
        setIsLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/explore?q=${encodeURIComponent(query)}`);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
        {/* Blurred Background Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#09090b]/60 backdrop-blur-md"
        />

        {/* Modal Body */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Search Input Area */}
          <form onSubmit={handleSubmit} className="relative border-b border-white/10">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="w-full bg-transparent text-white text-xl py-6 pl-16 pr-12 focus:outline-none placeholder:text-slate-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </form>

          {/* Results Area */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 flex justify-center items-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : results.length > 0 ? (
              <div className="p-2">
                {results.map((anime) => (
                  <Link
                    href={`/anime/${anime.mal_id}`}
                    key={anime.mal_id}
                    onClick={onClose}
                    className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition cursor-pointer"
                  >
                    <img
                      src={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url}
                      alt={anime.title_english || anime.title}
                      className="w-12 h-16 object-cover rounded-md"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold truncate">
                        {anime.title_english || anime.title}
                      </h3>
                      <p className="text-sm text-slate-400 truncate">
                        {anime.type} • {anime.year || "?"}
                      </p>
                    </div>
                  </Link>
                ))}
                
                <button
                  onClick={handleSubmit}
                  className="w-full mt-2 p-4 text-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition font-bold flex items-center justify-center gap-2"
                >
                  <Compass className="w-4 h-4" /> View all results for "{query}"
                </button>
              </div>
            ) : query.trim() ? (
              <div className="p-8 text-center text-slate-400">
                No results found for "{query}".
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                Type something to search the Jikan database.
              </div>
            )}
          </div>
          
          <div className="bg-[#141414]/50 border-t border-white/10 p-3 flex justify-between items-center text-xs text-slate-500">
            <div className="flex gap-4">
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded mr-1">↑↓</kbd> to navigate</span>
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded mr-1">Enter</kbd> to select</span>
            </div>
            <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded mr-1">Esc</kbd> to close</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
