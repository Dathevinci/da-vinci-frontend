export interface RankTheme {
  title: string | null;
  textGradient: string;
  badgeClass: string;
  badgeIcon: any; // string name; mapped to a Lucide icon in the component
  borderClass: string;
  glowClass: string;
  bgCardClass: string;
  tabUnderlineClass: string;
  textColorClass: string;
}

import { isAdmin, isLeadDev } from "./admin";
import { calculateLevel } from "./levels";

/**
 * Titles STACK — they never override each other. A profile wears, side by
 * side: the staff badge (Lead Dev / Admin) or the level title, the Heart
 * Cultivation rank (see lib/heartRanks.ts), and any shop-bought role/tag the
 * user has equipped. The THEME (colours/glow) still comes from this file:
 * staff themes for staff, otherwise the theme of the level reached.
 *
 * The 10 level titles (Watcher … Delusion Entity) each carry their own colour
 * theme so the whole profile escalates as you climb.
 */
export const LEVEL_TITLES: Record<number, string> = {
  1: "Watcher",
  2: "Overseer",
  3: "Sleepless",
  4: "Peak Seeker",
  5: "Maniac",
  6: "Conqueror",
  7: "Eye of Calamity",
  8: "High Dimensional Overseer",
  9: "Will of Eternity",
  10: "Delusion Entity",
};

export function getLevelTitle(level: number): string {
  const L = Math.max(1, Math.min(10, Math.round(level || 1)));
  return LEVEL_TITLES[L];
}

// Per-level theme. Colours climb from a cool cyan watcher up to a cosmic,
// void-touched Delusion Entity at max level.
const LEVEL_THEMES: Record<number, RankTheme> = {
  1: {
    title: LEVEL_TITLES[1],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]",
    badgeClass: "bg-gradient-to-r from-slate-900 to-black border border-cyan-500/50 shadow-lg shadow-cyan-500/20 text-cyan-400",
    badgeIcon: "Eye",
    borderClass: "border-cyan-500/40",
    glowClass: "shadow-[0_0_20px_rgba(56,189,248,0.35)]",
    bgCardClass: "bg-black/40 backdrop-blur-xl border-cyan-500/20",
    tabUnderlineClass: "bg-cyan-500",
    textColorClass: "text-cyan-400",
  },
  2: {
    title: LEVEL_TITLES[2],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-500 drop-shadow-[0_0_10px_rgba(20,184,166,0.6)]",
    badgeClass: "bg-gradient-to-r from-slate-900 to-black border border-teal-500/50 shadow-lg shadow-teal-500/20 text-teal-300",
    badgeIcon: "Compass",
    borderClass: "border-teal-500/40",
    glowClass: "shadow-[0_0_22px_rgba(20,184,166,0.4)]",
    bgCardClass: "bg-black/40 backdrop-blur-xl border-teal-500/20",
    tabUnderlineClass: "bg-teal-500",
    textColorClass: "text-teal-300",
  },
  3: {
    title: LEVEL_TITLES[3],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-blue-400 to-violet-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.6)]",
    badgeClass: "bg-gradient-to-r from-slate-900 to-black border border-indigo-500/50 shadow-lg shadow-indigo-500/25 text-indigo-300",
    badgeIcon: "Feather",
    borderClass: "border-indigo-500/40",
    glowClass: "shadow-[0_0_22px_rgba(99,102,241,0.45)]",
    bgCardClass: "bg-black/40 backdrop-blur-xl border-indigo-500/25",
    tabUnderlineClass: "bg-indigo-500",
    textColorClass: "text-indigo-300",
  },
  4: {
    title: LEVEL_TITLES[4],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-emerald-400 to-green-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]",
    badgeClass: "bg-gradient-to-r from-emerald-600 to-green-700 border border-emerald-400 shadow-lg shadow-emerald-500/30 text-white",
    badgeIcon: "ArrowUpRight",
    borderClass: "border-emerald-500",
    glowClass: "shadow-[0_0_26px_rgba(16,185,129,0.5)]",
    bgCardClass: "bg-black/40 backdrop-blur-xl border-emerald-500/30",
    tabUnderlineClass: "bg-emerald-500",
    textColorClass: "text-emerald-400",
  },
  5: {
    title: LEVEL_TITLES[5],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.7)]",
    badgeClass: "bg-gradient-to-r from-orange-500 to-red-600 border border-orange-400 shadow-lg shadow-orange-500/30 text-white",
    badgeIcon: "Flame",
    borderClass: "border-orange-500",
    glowClass: "shadow-[0_0_28px_rgba(249,115,22,0.55)]",
    bgCardClass: "bg-black/50 backdrop-blur-xl border-orange-500/30",
    tabUnderlineClass: "bg-orange-500",
    textColorClass: "text-orange-400",
  },
  6: {
    title: LEVEL_TITLES[6],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-red-500 to-rose-700 drop-shadow-[0_0_12px_rgba(244,63,94,0.7)]",
    badgeClass: "bg-gradient-to-r from-rose-600 to-red-800 border border-rose-400 shadow-lg shadow-rose-500/40 text-white",
    badgeIcon: "Crown",
    borderClass: "border-rose-500",
    glowClass: "shadow-[0_0_30px_rgba(244,63,94,0.55)]",
    bgCardClass: "bg-black/50 backdrop-blur-xl border-rose-500/35",
    tabUnderlineClass: "bg-rose-500",
    textColorClass: "text-rose-400",
  },
  7: {
    title: LEVEL_TITLES[7],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-500 to-violet-600 drop-shadow-[0_0_14px_rgba(217,70,239,0.75)]",
    badgeClass: "bg-gradient-to-r from-fuchsia-600 to-purple-800 border border-fuchsia-400 shadow-lg shadow-fuchsia-500/40 text-white",
    badgeIcon: "Eye",
    borderClass: "border-fuchsia-500",
    glowClass: "shadow-[0_0_32px_rgba(217,70,239,0.6)]",
    bgCardClass: "bg-black/55 backdrop-blur-xl border-fuchsia-500/35",
    tabUnderlineClass: "bg-fuchsia-500",
    textColorClass: "text-fuchsia-400",
  },
  8: {
    title: LEVEL_TITLES[8],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-indigo-400 to-blue-500 drop-shadow-[0_0_14px_rgba(129,140,248,0.8)]",
    badgeClass: "bg-gradient-to-r from-indigo-600 to-violet-800 border border-violet-400 shadow-lg shadow-violet-500/40 text-white",
    badgeIcon: "Sparkles",
    borderClass: "border-violet-500",
    glowClass: "shadow-[0_0_34px_rgba(139,92,246,0.6)]",
    bgCardClass: "bg-black/55 backdrop-blur-xl border-violet-500/35",
    tabUnderlineClass: "bg-violet-500",
    textColorClass: "text-violet-300",
  },
  9: {
    title: LEVEL_TITLES[9],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-[0_0_16px_rgba(253,224,71,0.85)]",
    badgeClass: "bg-gradient-to-r from-amber-400 to-yellow-600 border border-amber-300 shadow-lg shadow-amber-400/50 text-black",
    badgeIcon: "Zap",
    borderClass: "border-amber-400",
    glowClass: "shadow-[0_0_36px_rgba(253,224,71,0.65)]",
    bgCardClass: "bg-black/60 backdrop-blur-xl border-amber-400/40",
    tabUnderlineClass: "bg-amber-400",
    textColorClass: "text-amber-300",
  },
  10: {
    title: LEVEL_TITLES[10],
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 drop-shadow-[0_0_18px_rgba(217,70,239,0.9)]",
    badgeClass: "bg-gradient-to-r from-fuchsia-600 via-purple-700 to-indigo-800 border border-fuchsia-400 shadow-lg shadow-fuchsia-500/60 text-white",
    badgeIcon: "Sparkles",
    borderClass: "border-fuchsia-500",
    glowClass: "shadow-[0_0_40px_rgba(217,70,239,0.7)]",
    bgCardClass: "bg-black/65 backdrop-blur-xl border-fuchsia-500/40",
    tabUnderlineClass: "bg-fuchsia-500",
    textColorClass: "text-fuchsia-400",
  },
};

/**
 * Resolve the rank theme for a user.
 *
 * @param xp        the user's XP (drives their LEVEL and therefore their title)
 * @param username  used only to detect Lead Dev / Admin staff overrides
 */
export function getRankTheme(xp: number = 0, username: string = ""): RankTheme {
  const name = username?.toLowerCase() || "";

  // 1. Ultimate Override: LEAD DEV (a bought shop role can still override this
  //    at render time — the badge checks activeRole/activeTag first).
  if (isLeadDev(name)) {
    return {
      title: "LEAD DEV",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-indigo-400 drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]",
      badgeClass: "bg-gradient-to-r from-indigo-500 to-purple-600 border border-indigo-400 shadow-lg shadow-indigo-500/20 text-white",
      badgeIcon: "Code2",
      borderClass: "border-purple-500",
      glowClass: "shadow-[0_0_30px_rgba(168,85,247,0.6)]",
      bgCardClass: "bg-black/40 backdrop-blur-xl border-purple-500/30",
      tabUnderlineClass: "bg-purple-500",
      textColorClass: "text-purple-400",
    };
  }

  // 1.5 Ultimate Override: ADMIN
  if (isAdmin(name) && !isLeadDev(name)) {
    return {
      title: "ADMIN",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-rose-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]",
      badgeClass: "bg-gradient-to-r from-red-600 to-rose-900 border border-red-500 shadow-lg shadow-red-500/40 text-white",
      badgeIcon: "ShieldAlert",
      borderClass: "border-red-500",
      glowClass: "shadow-[0_0_30px_rgba(239,68,68,0.7)]",
      bgCardClass: "bg-black/40 backdrop-blur-xl border-red-500/40",
      tabUnderlineClass: "bg-red-500",
      textColorClass: "text-red-500",
    };
  }

  // 2. Everyone else: the title/theme of the level they've reached.
  const level = calculateLevel(xp);
  return LEVEL_THEMES[Math.max(1, Math.min(10, level))];
}
