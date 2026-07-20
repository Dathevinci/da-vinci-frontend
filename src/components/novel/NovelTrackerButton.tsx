"use client";

import { useNovelStatus, NovelUserStatus } from "@/hooks/useNovelStatus";
import { Plus, Check, ChevronDown, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface NovelTrackerButtonProps {
  novel: { id: string; title: string; cover?: string | null; coverImage?: string | null };
  variant?: "default" | "compact";
  className?: string;
}

const STATUS_COLORS: Record<Exclude<NovelUserStatus, "None">, string> = {
  Interested: "bg-pink-500 hover:bg-pink-600",
  Reading: "bg-green-500 hover:bg-green-600",
  Waiting: "bg-yellow-500 hover:bg-yellow-600",
  Finished: "bg-red-500 hover:bg-red-600",
  Dropped: "bg-red-500 hover:bg-red-600",
};

export default function NovelTrackerButton({ novel, variant = "default", className = "" }: NovelTrackerButtonProps) {
  const { setStatus, getStatus, isLoaded } = useNovelStatus();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const novelId = novel.id;
  const currentStatus = getStatus(novelId);
  const isTracked = currentStatus !== "None";

  const title = novel.title || "Unknown Title";
  const cover = novel.cover || novel.coverImage || undefined;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSetStatus = async (status: NovelUserStatus) => {
    setIsOpen(false);
    await setStatus(novelId, title, cover ?? undefined, status);
  };

  if (!isLoaded) {
    return <div className={`h-10 w-32 bg-white/10 animate-pulse rounded-xl ${className}`} />;
  }

  const bgColorClass = isTracked ? STATUS_COLORS[currentStatus as Exclude<NovelUserStatus, "None">] : "bg-white/10 hover:bg-white/20";

  if (variant === "compact") {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsOpen(!isOpen); }}
          className={`px-2.5 py-1 text-xs font-bold rounded shadow-md border border-white/10 transition-colors flex items-center gap-1.5 text-white ${bgColorClass} ${className}`}
        >
          {isTracked ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isTracked ? currentStatus : "Add"}
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-32 bg-[#151518] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden text-xs">
            {Object.entries(STATUS_COLORS).map(([status, colorClass]) => (
              <button
                key={status}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSetStatus(status as NovelUserStatus); }}
                className={`w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 ${currentStatus === status ? "text-white font-bold" : "text-slate-400"}`}
              >
                <div className={`w-2 h-2 rounded-full ${colorClass.split(" ")[0]}`} />
                {status}
              </button>
            ))}
            {isTracked && (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSetStatus("None"); }}
                className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 border-t border-white/5 flex items-center gap-2 mt-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-12 px-4 font-bold rounded-xl shadow-lg border border-white/10 transition-all flex items-center justify-between text-white ${bgColorClass}`}
      >
        <div className="flex items-center gap-2">
          {isTracked ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{isTracked ? currentStatus : "Add to Library"}</span>
        </div>
        <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#151518] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-1">
            {Object.entries(STATUS_COLORS).map(([status, colorClass]) => (
              <button
                key={status}
                onClick={() => handleSetStatus(status as NovelUserStatus)}
                className={`w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 flex items-center gap-3 transition-colors ${currentStatus === status ? "bg-white/5 text-white font-bold" : "text-slate-400"}`}
              >
                <div className={`w-3 h-3 rounded-full shadow-sm ${colorClass.split(" ")[0]}`} />
                {status}
              </button>
            ))}
          </div>
          {isTracked && (
            <div className="p-1 bg-black/20 border-t border-white/5">
              <button
                onClick={() => handleSetStatus("None")}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 flex items-center gap-2 transition-colors font-medium"
              >
                <Trash2 className="w-4 h-4" /> Remove from Library
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
