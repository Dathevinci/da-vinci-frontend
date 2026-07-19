"use client";

import { calculateLevel } from "@/lib/levels";

interface LevelBadgeProps {
  xp: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function LevelBadge({ xp, className = "", size = "sm" }: LevelBadgeProps) {
  const isInfinity = xp === Infinity;
  const numLevel = calculateLevel(xp);
  const displayLevel = isInfinity ? "∞" : numLevel;

  // Tiers scaled for the Max Level 10 system.
  const getBadgeStyle = () => {
    if (isInfinity) return "bg-gradient-to-r from-yellow-300 via-red-400 to-purple-600 text-white border-white/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]";
    if (numLevel >= 10) return "bg-gradient-to-r from-yellow-300 via-red-400 to-purple-600 text-white border-white/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]"; // Max — legendary
    if (numLevel >= 8) return "bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-white/20 shadow-[0_0_15px_rgba(192,38,211,0.5)]";
    if (numLevel >= 5) return "bg-gradient-to-r from-purple-500 to-cyan-400 text-white border-white/20 shadow-[0_0_10px_rgba(99,102,241,0.5)]";
    if (numLevel >= 3) return "bg-gradient-to-r from-amber-500 to-orange-400 text-white border-white/10";
    return "bg-white/10 text-slate-300 border-white/5"; // Levels 1-2
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm": return "px-2.5 py-0.5 text-[10px] md:text-xs";
      case "md": return "px-3 py-1 text-xs md:text-sm";
      case "lg": return "px-4 py-1.5 text-sm md:text-base border-2";
      case "xl": return "px-6 py-2 text-xl md:text-2xl border-2";
      default: return "px-2.5 py-0.5 text-xs";
    }
  };

  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full border font-black tracking-widest whitespace-nowrap ${getBadgeStyle()} ${getSizeStyle()} ${className}`}
      title={`${isInfinity ? '∞' : xp.toLocaleString()} XP`}
    >
      LVL {displayLevel}
    </div>
  );
}
