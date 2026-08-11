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
 * Levels 1-10 each carry their own colour theme; 11-100 carry one theme per
 * BAND of ten (heartRanks.ts owns the same banding for the chip), so the whole
 * profile keeps escalating all the way to the new level cap.
 */
// Safe to import: heartRanks.ts imports only levels.ts, which imports nothing,
// so this chain cannot cycle.
import { HEART_BANDS, getHeartRank } from "./heartRanks";
import { MAX_LEVEL } from "./levels";

/**
 * Level titles now come from the Heart Cultivation ranks (lib/heartRanks.ts).
 *
 * There used to be a SECOND, separate set of level titles defined here, so a
 * profile displayed two different names for the same level — the old list next
 * to the heart rank. That system is gone; heart ranks are the one source of a
 * level's name, everywhere.
 *
 * Covers the FULL 1..100 ladder: the ten per-level Openings, then the band name
 * for every level above 10, built by asking heartRanks rather than by keeping a
 * second table that could disagree with it.
 */
export const LEVEL_TITLES: Record<number, string> = Object.fromEntries(
  Array.from({ length: MAX_LEVEL }, (_, i) => [i + 1, getHeartRank(i + 1).name])
) as Record<number, string>;

// Per-level theme, levels 1-10 (the original ladder — frozen, users wear these).
// Colours climb from a cool cyan watcher to a cosmic rose/fuchsia at 10, and
// BAND_THEMES below carries that climb on to the level-100 cap.
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
 * BAND THEMES — levels 11-100, one per band of ten, in HEART_BANDS order.
 *
 * The per-level themes above stop at the cosmic rose/fuchsia of level 10; these
 * carry on from there rather than restarting the palette: ember and brass
 * (11-30), road and deep gold (31-50), gold bleaching to white light (51-70),
 * then white shot with violet, starlight, and finally the full prism over void
 * for The Infinite. Nine rows, not ninety — getLevelTheme does the lookup.
 *
 * badgeIcon must stay inside the ICON_MAP / RankIcons dictionaries the
 * consumers keep (Code2, ShieldAlert, Sparkles, Crown, Flame, Zap, Compass,
 * Leaf, ArrowUpRight, Feather, Eye); an unknown name renders no icon at all.
 */
const BAND_THEMES: RankTheme[] = [
  {
    // 11-20 The Kindled
    title: HEART_BANDS[0].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-400 to-orange-600 drop-shadow-[0_0_14px_rgba(251,146,60,0.7)]",
    badgeClass: "bg-gradient-to-r from-orange-500 to-amber-600 border border-orange-300 shadow-lg shadow-orange-500/40 text-white",
    badgeIcon: "Flame",
    borderClass: "border-orange-400",
    glowClass: "shadow-[0_0_30px_rgba(251,146,60,0.5)]",
    bgCardClass: "bg-black/55 backdrop-blur-xl border-orange-400/35",
    tabUnderlineClass: "bg-orange-400",
    textColorClass: "text-orange-300",
  },
  {
    // 21-30 The Unwavering
    title: HEART_BANDS[1].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-700 drop-shadow-[0_0_14px_rgba(245,158,11,0.7)]",
    badgeClass: "bg-gradient-to-r from-amber-500 to-yellow-700 border border-amber-300 shadow-lg shadow-amber-500/40 text-white",
    badgeIcon: "ShieldAlert",
    borderClass: "border-amber-400",
    glowClass: "shadow-[0_0_32px_rgba(245,158,11,0.5)]",
    bgCardClass: "bg-black/55 backdrop-blur-xl border-amber-400/35",
    tabUnderlineClass: "bg-amber-400",
    textColorClass: "text-amber-300",
  },
  {
    // 31-40 The Wanderer
    title: HEART_BANDS[2].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-600 drop-shadow-[0_0_15px_rgba(234,179,8,0.7)]",
    badgeClass: "bg-gradient-to-r from-yellow-500 to-amber-600 border border-yellow-300 shadow-lg shadow-yellow-500/40 text-black",
    badgeIcon: "Compass",
    borderClass: "border-yellow-400",
    glowClass: "shadow-[0_0_34px_rgba(234,179,8,0.55)]",
    bgCardClass: "bg-black/55 backdrop-blur-xl border-yellow-400/35",
    tabUnderlineClass: "bg-yellow-400",
    textColorClass: "text-yellow-300",
  },
  {
    // 41-50 The Keeper
    title: HEART_BANDS[3].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-600 drop-shadow-[0_0_16px_rgba(252,211,77,0.75)]",
    badgeClass: "bg-gradient-to-r from-amber-300 to-yellow-500 border border-amber-200 shadow-lg shadow-amber-300/50 text-black",
    badgeIcon: "Leaf",
    borderClass: "border-amber-300",
    glowClass: "shadow-[0_0_36px_rgba(252,211,77,0.6)]",
    bgCardClass: "bg-black/60 backdrop-blur-xl border-amber-300/40",
    tabUnderlineClass: "bg-amber-300",
    textColorClass: "text-amber-200",
  },
  {
    // 51-60 The Lucid
    title: HEART_BANDS[4].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-amber-50 via-yellow-200 to-amber-400 drop-shadow-[0_0_18px_rgba(254,243,199,0.8)]",
    badgeClass: "bg-gradient-to-r from-amber-100 to-yellow-300 border border-amber-50 shadow-lg shadow-amber-200/50 text-black",
    badgeIcon: "Eye",
    borderClass: "border-amber-200",
    glowClass: "shadow-[0_0_38px_rgba(254,243,199,0.6)]",
    bgCardClass: "bg-black/60 backdrop-blur-xl border-amber-200/40",
    tabUnderlineClass: "bg-amber-200",
    textColorClass: "text-amber-100",
  },
  {
    // 61-70 The Radiant
    title: HEART_BANDS[5].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-white drop-shadow-[0_0_20px_rgba(255,255,255,0.85)]",
    badgeClass: "bg-gradient-to-r from-white to-amber-100 border border-white shadow-lg shadow-white/50 text-black",
    badgeIcon: "Zap",
    borderClass: "border-white/70",
    glowClass: "shadow-[0_0_40px_rgba(255,255,255,0.6)]",
    bgCardClass: "bg-black/65 backdrop-blur-xl border-white/25",
    tabUnderlineClass: "bg-white",
    textColorClass: "text-amber-50",
  },
  {
    // 71-80 The Sovereign
    title: HEART_BANDS[6].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-violet-400 drop-shadow-[0_0_20px_rgba(196,181,253,0.85)]",
    badgeClass: "bg-gradient-to-r from-violet-200 via-white to-violet-300 border border-violet-100 shadow-lg shadow-violet-300/50 text-black",
    badgeIcon: "Crown",
    borderClass: "border-violet-200",
    glowClass: "shadow-[0_0_42px_rgba(196,181,253,0.6)]",
    bgCardClass: "bg-black/65 backdrop-blur-xl border-violet-200/30",
    tabUnderlineClass: "bg-violet-300",
    textColorClass: "text-violet-100",
  },
  {
    // 81-90 The Eternal
    title: HEART_BANDS[7].name,
    textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-sky-100 via-indigo-300 to-violet-400 drop-shadow-[0_0_22px_rgba(165,180,252,0.9)]",
    badgeClass: "bg-gradient-to-r from-sky-200 via-indigo-300 to-violet-400 border border-indigo-100 shadow-lg shadow-indigo-300/50 text-black",
    badgeIcon: "Feather",
    borderClass: "border-indigo-200",
    glowClass: "shadow-[0_0_44px_rgba(165,180,252,0.65)]",
    bgCardClass: "bg-black/70 backdrop-blur-xl border-indigo-200/30",
    tabUnderlineClass: "bg-indigo-300",
    textColorClass: "text-indigo-100",
  },
  {
    // 91-100 The Infinite — prism over void, the end of the ladder
    title: HEART_BANDS[8].name,
    textGradient: "text-transparent bg-clip-text bg-[linear-gradient(90deg,#f9a8d4,#67e8f9,#fde047,#c4b5fd,#f9a8d4)] drop-shadow-[0_0_24px_rgba(255,255,255,0.6)]",
    badgeClass: "bg-[linear-gradient(90deg,#db2777,#0ea5e9,#eab308,#7c3aed)] border border-white/70 shadow-lg shadow-white/30 text-white",
    badgeIcon: "Sparkles",
    borderClass: "border-white/70",
    glowClass: "shadow-[0_0_48px_rgba(255,255,255,0.5)]",
    bgCardClass: "bg-black/75 backdrop-blur-xl border-white/30",
    tabUnderlineClass: "bg-[linear-gradient(90deg,#db2777,#0ea5e9,#eab308,#7c3aed)]",
    textColorClass: "text-fuchsia-200",
  },
];

/**
 * Theme for ANY level on the 1..100 ladder.
 *
 * This used to be `LEVEL_THEMES[Math.min(10, level)]` inlined in getRankTheme,
 * which was correct only while 10 was the cap — after it moved to 100 the same
 * expression would have frozen every player above 10 on the level-10 theme.
 */
export function getLevelTheme(level: number): RankTheme {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.round(Number(level) || 1)));
  if (L <= 10) return LEVEL_THEMES[L];
  const i = HEART_BANDS.findIndex((b) => L >= b.min && L <= b.max);
  return BAND_THEMES[i >= 0 ? i : BAND_THEMES.length - 1];
}

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

  // 2. Everyone else: the title/theme of the level they've reached — anywhere
  //    on the 1..100 ladder, per-level below 11 and per-band above it.
  return getLevelTheme(calculateLevel(xp));
}
