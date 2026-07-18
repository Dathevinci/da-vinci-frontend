"use client";

import { useManhwaStatus, ManhwaUserStatus } from "@/hooks/useManhwaStatus";
import { useUser } from "@/hooks/useUser";
import { Plus, Check, ChevronDown, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { IMangaInfo, IMangaResult } from "@/lib/asura/models";

interface ManhwaTrackerButtonProps {
  manhwa: IMangaInfo | IMangaResult | { id: string, title: string, image?: string };
  variant?: "default" | "compact";
  className?: string;
}

const STATUS_COLORS: Record<Exclude<ManhwaUserStatus, "None">, string> = {
  Interested: "bg-pink-500 hover:bg-pink-600",
  Reading: "bg-green-500 hover:bg-green-600",
  Waiting: "bg-yellow-500 hover:bg-yellow-600",
  Finished: "bg-indigo-500 hover:bg-indigo-600",
  Dropped: "bg-red-500 hover:bg-red-600",
};

export default function ManhwaTrackerButton({ manhwa, variant = "default", className = "" }: ManhwaTrackerButtonProps) {
  const { setStatus, getStatus, isLoaded } = useManhwaStatus();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const mangaId = manhwa.id;
  const currentStatus = getStatus(mangaId);
  const isTracked = currentStatus !== "None";

  // Using optional chaining or defaulting to empty string in case fields are missing from basic result types
  const title = manhwa.title || "Unknown Title";
  const image = (manhwa as any).image || (manhwa as any).coverImage || undefined;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSetStatus = async (status: ManhwaUserStatus) => {
    setIsOpen(false);
    await setStatus(mangaId, title, image, status);
  };

  if (!isLoaded) {
    return <div className={`h-10 w-32 bg-white/10 animate-pulse rounded-xl ${className}`} />;
  }

  const bgColorClass = isTracked ? STATUS_COLORS[currentStatus as Exclude<ManhwaUserStatus, "None">] : "bg-white/10 hover:bg-white/20";
  const textColorClass = isTracked ? "text-white" : "text-white";

  if (variant === "compact") {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className={`px-2.5 py-1 text-xs font-bold rounded shadow-md border border-white/10 transition-colors flex items-center gap-1.5 ${bgColorClass} ${textColorClass} ${className}`}
        >
          {isTracked ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isTracked ? currentStatus : "Add"}
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-32 bg-[#151518] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden text-xs">
            {Object.entries(STATUS_COLORS).map(([status, colorClass]) => (
              <button
                key={status}
                onClick={(e) => { e.stopPropagation(); handleSetStatus(status as ManhwaUserStatus); }}
                className={`w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 ${currentStatus === status ? "text-white font-bold" : "text-slate-400"}`}
              >
                <div className={`w-2 h-2 rounded-full ${colorClass.split(" ")[0]}`} />
                {status}
              </button>
            ))}
            {isTracked && (
              <button
                onClick={(e) => { e.stopPropagation(); handleSetStatus("None"); }}
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
        className={`w-full h-12 px-4 font-bold rounded-xl shadow-lg border border-white/10 transition-all flex items-center justify-between ${bgColorClass} ${textColorClass}`}
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
                onClick={() => handleSetStatus(status as ManhwaUserStatus)}
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
