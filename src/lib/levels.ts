/**
 * Leveling — Max Level 10, exponential XP so the endgame is a real grind.
 *
 * XP to go from level L -> L+1 : 1000 * 2^(L-1)   (1k, 2k, 4k, ... 256k)
 * Cumulative XP to REACH level L: 1000 * (2^(L-1) - 1)
 *
 *   Lv1: 0        Lv6:  31,000
 *   Lv2: 1,000    Lv7:  63,000
 *   Lv3: 3,000    Lv8:  127,000
 *   Lv4: 7,000    Lv9:  255,000
 *   Lv5: 15,000   Lv10: 511,000  (max)
 *
 * XP drives the level; Arise Points are a separate currency.
 */

export const MAX_LEVEL = 10;
const BASE = 1000;
const GROWTH = 2;

// Cumulative XP required to reach a given level.
export function xpForCurrentLevel(level: number): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, level));
  return BASE * (GROWTH ** (L - 1) - 1);
}

// Cumulative XP required to reach the NEXT level (caps at max).
export function xpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return xpForCurrentLevel(MAX_LEVEL);
  return xpForCurrentLevel(currentLevel + 1);
}

export function calculateLevel(xp: number = 0): number {
  if (!isFinite(xp)) return MAX_LEVEL;
  if (xp < 0) xp = 0;
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForCurrentLevel(level + 1)) {
    level++;
  }
  return level;
}

export function calculateProgressPercent(xp: number = 0): number {
  if (!isFinite(xp)) return 100;
  if (xp < 0) xp = 0;
  const level = calculateLevel(xp);
  if (level >= MAX_LEVEL) return 100;

  const base = xpForCurrentLevel(level);
  const next = xpForNextLevel(level);
  const span = next - base;
  if (span <= 0) return 100;

  return Math.min(100, Math.max(0, ((xp - base) / span) * 100));
}
