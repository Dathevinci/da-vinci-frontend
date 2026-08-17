/**
 * Leveling — Max Level 100, QUADRATIC XP so the ladder is climbable.
 *
 * XP to go from level L -> L+1 : 100 + (L-1)*80        (100, 180, 260, …)
 * Cumulative XP to REACH level L: 100*(L-1) + 80*(L-1)*(L-2)/2
 *                                 = 40L² - 20L - 20  (the closed form used below)
 *
 *   Lv1: 0        Lv10: 3,780     Lv50:  99,000
 *   Lv2: 100      Lv18: 12,580    Lv64:  162,540
 *   Lv5: 880      Lv42: 69,700    Lv98:  382,180
 *                                 Lv100: 397,980  (max)
 *
 * WHY THIS REPLACED THE EXPONENTIAL CURVE
 * The old curve was 1000 * 2^(L-1): level 10 alone cost 511,000 XP while the
 * actions that grant XP hand out 5-25 at a time. Against the LIVE data (59
 * users: median 20 XP, 22 accounts at zero, p25 1,084) progression was dead for
 * everyone outside the top four — the owner's "the xp system doesn't work".
 * Quadratic fixes both ends: level 2 costs 100 XP (about an hour of watching at
 * 1.5 XP/min, or ~17 comments), and 100 levels still take 397,980, so the top of
 * the ladder stays a real climb instead of an unreachable wall.
 *
 * CALIBRATION AGAINST LIVE ACCOUNTS (this is the regression test):
 *   Riv333            384,307 XP -> L98      Dejavuh      12,779 -> L18
 *   Underworld_Daoist 164,930 XP -> L64      p25 account   1,084 -> L5
 *   Natsuki_Subaru_    90,106 XP -> L47      median            20 -> L1, 20% bar
 *   speyvenerable      71,254 XP -> L42
 * Nobody is stranded at 1; nobody is force-capped at 100.
 *
 * XP drives the level; Arise Points are a separate currency.
 */

export const USER_MAX_LEVEL = 100;
export const MAX_LEVEL = USER_MAX_LEVEL;

const BASE_COST = 100; // level 1 -> 2
const COST_STEP = 80; // each level costs this much more than the last

/** A finite, non-negative XP number. NaN/undefined read as 0; Infinity stays. */
function safeXp(xp: number = 0): number {
  if (typeof xp !== "number" || Number.isNaN(xp)) return 0;
  if (xp < 0) return 0;
  return xp;
}

function clampLevel(level: number): number {
  const L = Math.round(Number(level) || 1);
  return Math.max(1, Math.min(MAX_LEVEL, L));
}

/** XP required to go from `level` to `level + 1`. 0 at max level. */
export function levelCost(level: number): number {
  const L = clampLevel(level);
  if (L >= MAX_LEVEL) return 0;
  return BASE_COST + (L - 1) * COST_STEP;
}

/** Cumulative XP required to REACH a given level (level 1 = 0). */
export function xpForCurrentLevel(level: number): number {
  const L = clampLevel(level);
  return BASE_COST * (L - 1) + (COST_STEP * (L - 1) * (L - 2)) / 2;
}

/** Cumulative XP required to reach the NEXT level (caps at max). */
export function xpForNextLevel(currentLevel: number): number {
  const L = clampLevel(currentLevel);
  if (L >= MAX_LEVEL) return xpForCurrentLevel(MAX_LEVEL);
  return xpForCurrentLevel(L + 1);
}

/** Total XP a maxed account has banked — 397,980. */
export const MAX_LEVEL_XP = xpForCurrentLevel(MAX_LEVEL);

export function calculateLevel(xp: number = 0): number {
  if (!Number.isFinite(xp)) {
    // Infinity is the "staff / unlimited" sentinel some badges pass; NaN and
    // undefined are treated as a fresh account by safeXp below.
    return Number.isNaN(xp as number) ? 1 : MAX_LEVEL;
  }
  const x = safeXp(xp);

  // Invert 40L² - 20L - 20 <= x. Solved directly instead of looped so the
  // maths cannot drift from xpForCurrentLevel, then nudged for float safety.
  let level = Math.floor((20 + Math.sqrt(400 + 160 * (x + 20))) / 80);
  if (!Number.isFinite(level)) level = 1;
  while (level > 1 && xpForCurrentLevel(level) > x) level--;
  while (level < MAX_LEVEL && xpForCurrentLevel(level + 1) <= x) level++;
  return clampLevel(level);
}

/** XP earned since reaching the current level (0 at a fresh level-up). */
export function xpIntoLevel(xp: number = 0): number {
  if (!Number.isFinite(xp)) return 0;
  const x = safeXp(xp);
  const level = calculateLevel(x);
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, x - xpForCurrentLevel(level));
}

/** XP still needed for the next level (0 at max). */
export function xpToNextLevel(xp: number = 0): number {
  if (!Number.isFinite(xp)) return 0;
  const x = safeXp(xp);
  const level = calculateLevel(x);
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, xpForNextLevel(level) - x);
}

export function calculateProgressPercent(xp: number = 0): number {
  if (!Number.isFinite(xp)) return Number.isNaN(xp as number) ? 0 : 100;
  const x = safeXp(xp);
  const level = calculateLevel(x);
  if (level >= MAX_LEVEL) return 100;

  const base = xpForCurrentLevel(level);
  const next = xpForNextLevel(level);
  const span = next - base;
  if (span <= 0) return 100;

  return Math.min(100, Math.max(0, ((x - base) / span) * 100));
}
