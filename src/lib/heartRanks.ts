/**
 * Heart Cultivation — the path of the open heart. Ten Openings, one per level
 * (Rank I at level 1 … Rank X at max level), worn as a title BESIDE the level
 * title and any shop-bought title: titles stack, they never override each
 * other.
 *
 * The full lore of each Opening (heart stage + ability gained) travels with
 * the badge as its hover tooltip.
 */

export interface HeartRank {
  numeral: string; // I … X
  name: string; // "The Tender"
  opening: string; // "First Opening"
  hanzi: string; // 初開
  emoji: string;
  stage: string; // ❤ Heart stage
  gained: string; // ✦ Gained
  badgeClass: string; // colour theme of the badge chip
}

export const HEART_RANKS: Record<number, HeartRank> = {
  1: {
    numeral: "I",
    name: "The Tender",
    opening: "First Opening",
    hanzi: "初開",
    emoji: "🌱",
    stage: "First crack, empathy awakens",
    gained: "Sense the emotional state of those nearby",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  },
  2: {
    numeral: "II",
    name: "The Witness",
    opening: "Second Opening",
    hanzi: "見苦",
    emoji: "🕯️",
    stage: "Stillness in the face of grief",
    gained: "Passive healing aura, accelerates recovery in those nearby",
    badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  },
  3: {
    numeral: "III",
    name: "The Devoted",
    opening: "Third Opening",
    hanzi: "誓心",
    emoji: "🤝",
    stage: "Devotion forges unbreakable will",
    gained: "Unbreakable resolve, immune to spiritual pressure and fear",
    badgeClass: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  },
  4: {
    numeral: "IV",
    name: "The Burdened",
    opening: "Fourth Opening",
    hanzi: "承重",
    emoji: "⚖️",
    stage: "The heart learns to carry what it cannot fix",
    gained: "Sorrow Transfer, absorb and neutralize others' spiritual wounds",
    badgeClass: "bg-stone-500/20 text-stone-300 border border-stone-400/30",
  },
  5: {
    numeral: "V",
    name: "The Burning",
    opening: "Fifth Opening",
    hanzi: "心火",
    emoji: "🔥",
    stage: "Compassion becomes a weapon",
    gained: "Heart's Flame, golden fire that harms only those with cruel intent",
    badgeClass: "bg-orange-500/15 text-orange-300 border border-orange-500/35",
  },
  6: {
    numeral: "VI",
    name: "The Vast",
    opening: "Sixth Opening",
    hanzi: "廣心",
    emoji: "🌊",
    stage: "The heart expands beyond the personal",
    gained: "Resonant Wave, project calm or courage across entire regions",
    badgeClass: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/35",
  },
  7: {
    numeral: "VII",
    name: "The Mirror",
    opening: "Seventh Opening",
    hanzi: "映心",
    emoji: "🪞",
    stage: "The self becomes transparent, and so does all else",
    gained: "True Sight of the Heart, perceive the innermost truth of any being",
    badgeClass: "bg-violet-500/15 text-violet-300 border border-violet-500/35",
  },
  8: {
    numeral: "VIII",
    name: "The Undying Compassion",
    opening: "Eighth Opening",
    hanzi: "不滅悲",
    emoji: "🌸",
    stage: "Compassion survives every loss and returns stronger",
    gained: "Will Resurrection, reignite the Qi root of the spiritually broken",
    badgeClass: "bg-pink-500/15 text-pink-300 border border-pink-500/35",
  },
  9: {
    numeral: "IX",
    name: "The Living Sanctuary",
    opening: "Ninth Opening",
    hanzi: "活聖域",
    emoji: "💠",
    stage: "The self becomes a sacred space",
    gained: "Sacred Presence, reality itself softens within the cultivator's field",
    badgeClass:
      "bg-gradient-to-r from-teal-500/20 to-cyan-500/15 text-teal-200 border border-teal-400/40 shadow-[0_0_10px_rgba(45,212,191,0.25)]",
  },
  10: {
    numeral: "X",
    name: "The All-Bearing",
    opening: "The Final Opening",
    hanzi: "萬心歸",
    emoji: "❤️",
    stage: "Merges with the collective suffering and joy of all life",
    gained: "Is the emotional truth of all living things, simultaneously, forever",
    badgeClass:
      "bg-gradient-to-r from-rose-500/25 via-fuchsia-500/20 to-indigo-500/25 text-rose-100 border border-rose-300/50 shadow-[0_0_14px_rgba(244,63,94,0.4)]",
  },
};

export function getHeartRank(level: number): HeartRank {
  const L = Math.max(1, Math.min(10, Math.round(level || 1)));
  return HEART_RANKS[L];
}

// The hover tooltip: the Opening's full lore in miniature.
export function heartRankTooltip(rank: HeartRank): string {
  return `${rank.opening} · ${rank.hanzi}\n❤ ${rank.stage}\n✦ ${rank.gained}`;
}
