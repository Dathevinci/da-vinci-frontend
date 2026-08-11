"use client";

import { calculateLevel, MAX_LEVEL } from "@/lib/levels";

interface LevelBadgeProps {
  xp: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function LevelBadge({ xp, className = "", size = "sm" }: LevelBadgeProps) {
  const isInfinity = xp === Infinity;
  const numLevel = calculateLevel(xp);
  const displayLevel = isInfinity ? "∞" : numLevel;

  /**
   * Tiers follow the BANDS of the 1..100 ladder (see lib/heartRanks.ts), not a
   * hand-picked set of small numbers. The thresholds used to be 10/8/5/3 back
   * when 10 was the cap; left alone after the cap moved to 100 they would have
   * painted every account from level 10 up in the same legendary gradient —
   * the badge would stop meaning anything at exactly the point the ladder
   * starts. Only a genuinely maxed account gets the top treatment.
   */
  const getBadgeStyle = () => {
    if (isInfinity || numLevel >= MAX_LEVEL) return "bg-gradient-to-r from-yellow-300 via-red-400 to-purple-600 text-white border-white/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]"; // Max — legendary
    if (numLevel >= 81) return "bg-gradient-to-r from-sky-200 via-indigo-300 to-violet-400 text-black border-white/30 shadow-[0_0_15px_rgba(165,180,252,0.55)]";
    if (numLevel >= 61) return "bg-gradient-to-r from-white via-amber-100 to-violet-200 text-black border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.5)]";
    if (numLevel >= 41) return "bg-gradient-to-r from-amber-300 to-yellow-500 text-black border-white/20 shadow-[0_0_12px_rgba(252,211,77,0.5)]";
    if (numLevel >= 21) return "bg-gradient-to-r from-orange-500 to-amber-600 text-white border-white/20 shadow-[0_0_12px_rgba(251,146,60,0.5)]";
    if (numLevel >= 11) return "bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-white/20 shadow-[0_0_15px_rgba(192,38,211,0.5)]";
    if (numLevel >= 8) return "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-white/20 shadow-[0_0_12px_rgba(139,92,246,0.45)]";
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-black tracking-widest whitespace-nowrap ${getBadgeStyle()} ${getSizeStyle()} ${className}`}
      title={`${isInfinity ? '∞' : xp.toLocaleString()} XP`}
    >
      LVL {displayLevel}
    </div>
  );
}
