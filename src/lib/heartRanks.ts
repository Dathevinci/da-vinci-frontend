/**
 * Heart Cultivation — the path of the open heart, worn as a title BESIDE the
 * level title and any shop-bought title: titles stack, they never override
 * each other.
 *
 * TEN OPENINGS, ONE PER LEVEL, up to level 10 (Rank I … Rank X). Those ten are
 * the original ladder and are frozen — users already wear them, so renaming or
 * recolouring one would take a title off somebody's profile.
 *
 * ABOVE LEVEL 10 the ladder continues in BANDS OF TEN (see HEART_BANDS), one
 * Opening per band, because the level cap moved from 10 to 100 when the XP
 * curve stopped being exponential (see lib/levels.ts). Nine bands cover
 * 11-100, so a level 11 and a level 20 are both "The Kindled · XI".
 *
 * The full lore of each Opening (heart stage + ability gained) travels with
 * the badge as its hover tooltip.
 */

import { MAX_LEVEL } from "./levels";

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

/**
 * THE BANDS — levels 11-100, ten levels per Opening.
 *
 * A band is just a HeartRank with the level window it covers, so every consumer
 * that already renders a HeartRank (name, numeral, emoji, hanzi, badgeClass,
 * tooltip) renders a band for free. Written as nine rows rather than ninety:
 * `min`/`max` are inclusive and getHeartRank does the lookup.
 *
 * The colours continue the climb rather than restarting it. The first ten
 * Openings run cool -> cosmic and finish at rose/fuchsia; from there the bands
 * heat into ember and gold (11-50), bleach to white light (51-70), then break
 * into prism and void for The Infinite.
 */
export interface HeartBand extends HeartRank {
  min: number; // inclusive
  max: number; // inclusive
}

export const HEART_BANDS: HeartBand[] = [
  {
    min: 11,
    max: 20,
    numeral: "XI",
    name: "The Kindled",
    opening: "Eleventh Opening",
    hanzi: "燃心",
    emoji: "🪔",
    stage: "The flame is carried, not merely survived",
    gained: "Lend the heart's fire to another without losing your own",
    badgeClass: "bg-orange-500/15 text-orange-200 border border-orange-400/40",
  },
  {
    min: 21,
    max: 30,
    numeral: "XII",
    name: "The Unwavering",
    opening: "Twelfth Opening",
    hanzi: "不動",
    emoji: "🛡️",
    stage: "Grief arrives and the stance does not change",
    gained: "Anchor Presence, those who stand near you cannot be shaken",
    badgeClass: "bg-amber-600/15 text-amber-200 border border-amber-500/40",
  },
  {
    min: 31,
    max: 40,
    numeral: "XIII",
    name: "The Wanderer",
    opening: "Thirteenth Opening",
    hanzi: "遠行",
    emoji: "🧭",
    stage: "The heart leaves home and keeps its bearing",
    gained: "Read the ache of any place the moment you enter it",
    badgeClass: "bg-yellow-500/15 text-yellow-200 border border-yellow-400/40",
  },
  {
    min: 41,
    max: 50,
    numeral: "XIV",
    name: "The Keeper",
    opening: "Fourteenth Opening",
    hanzi: "守心",
    emoji: "🗝️",
    stage: "What was carried is now kept for others",
    gained: "Hold a memory or a vow intact against time itself",
    badgeClass:
      "bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-100 border border-amber-300/45 shadow-[0_0_10px_rgba(251,191,36,0.28)]",
  },
  {
    min: 51,
    max: 60,
    numeral: "XV",
    name: "The Lucid",
    opening: "Fifteenth Opening",
    hanzi: "明覺",
    emoji: "🔮",
    stage: "Feeling and clarity stop being opposites",
    gained: "See the shape of a sorrow before it is spoken",
    badgeClass:
      "bg-gradient-to-r from-yellow-200/15 to-white/10 text-amber-50 border border-amber-100/45 shadow-[0_0_12px_rgba(254,243,199,0.3)]",
  },
  {
    min: 61,
    max: 70,
    numeral: "XVI",
    name: "The Radiant",
    opening: "Sixteenth Opening",
    hanzi: "光耀",
    emoji: "☀️",
    stage: "The heart gives off light without being asked",
    gained: "Warmth as a field, despair thins wherever you walk",
    badgeClass:
      "bg-gradient-to-r from-white/15 via-amber-100/15 to-white/10 text-white border border-white/50 shadow-[0_0_14px_rgba(255,255,255,0.35)]",
  },
  {
    min: 71,
    max: 80,
    numeral: "XVII",
    name: "The Sovereign",
    opening: "Seventeenth Opening",
    hanzi: "至尊",
    emoji: "👑",
    stage: "Compassion becomes command, and asks nothing back",
    gained: "Speak once and the cruel are unable to continue",
    badgeClass:
      "bg-gradient-to-r from-white/15 via-violet-300/20 to-white/10 text-violet-50 border border-violet-200/50 shadow-[0_0_16px_rgba(196,181,253,0.4)]",
  },
  {
    min: 81,
    max: 90,
    numeral: "XVIII",
    name: "The Eternal",
    opening: "Eighteenth Opening",
    hanzi: "永恆",
    emoji: "🌠",
    stage: "The heart outlives every life it has held",
    gained: "Persist beyond the body as a feeling others still meet",
    badgeClass:
      "bg-gradient-to-r from-sky-200/15 via-indigo-300/20 to-violet-300/15 text-sky-50 border border-indigo-200/50 shadow-[0_0_18px_rgba(165,180,252,0.45)]",
  },
  {
    min: 91,
    max: 100,
    numeral: "XIX",
    name: "The Infinite",
    opening: "The Boundless Opening",
    hanzi: "無極",
    emoji: "♾️",
    stage: "No edge remains between the self and everything felt",
    gained: "Is every heart at once, in every direction, without end",
    badgeClass:
      "bg-[linear-gradient(90deg,rgba(244,114,182,0.28),rgba(56,189,248,0.28),rgba(253,224,71,0.28),rgba(167,139,250,0.28))] text-white border border-white/60 shadow-[0_0_22px_rgba(255,255,255,0.4)]",
  },
];

/**
 * Level -> Opening, for the whole 1..100 ladder.
 *
 * 1-10 keep their own per-level entry; 11+ resolve to the band that contains
 * them, so 11 and 20 are both The Kindled. Anything above the cap falls to the
 * last band rather than to slate — a maxed account should read The Infinite.
 */
export function getHeartRank(level: number): HeartRank {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.round(level || 1)));
  if (L <= 10) return HEART_RANKS[L];
  return (
    HEART_BANDS.find((b) => L >= b.min && L <= b.max) ||
    HEART_BANDS[HEART_BANDS.length - 1]
  );
}

// The hover tooltip: the Opening's full lore in miniature.
export function heartRankTooltip(rank: HeartRank): string {
  return `${rank.opening} · ${rank.hanzi}\n❤ ${rank.stage}\n✦ ${rank.gained}`;
}

/**
 * ONE COLOUR PER OPENING, for the icon-only badges that have no room for a
 * gradient chip (see UserBadgesCompact). It mirrors the badgeClass above and
 * lives here rather than in the component so a new band cannot ship with a
 * title and no tint — which is exactly what a level-47 user hit when the map
 * only had keys 1-10 and everything above fell through to slate grey.
 */
const HEART_TINTS: Record<number, string> = {
  1: "#94a3b8", 2: "#7dd3fc", 3: "#38bdf8", 4: "#34d399", 5: "#a3e635",
  6: "#facc15", 7: "#fb923c", 8: "#f87171", 9: "#2dd4bf", 10: "#fb7185",
};

const BAND_TINTS: string[] = [
  "#fb923c", // XI   The Kindled — ember
  "#f59e0b", // XII  The Unwavering — brass
  "#eab308", // XIII The Wanderer — road gold
  "#fcd34d", // XIV  The Keeper — deep gold
  "#fef3c7", // XV   The Lucid — pale gold
  "#ffffff", // XVI  The Radiant — white light
  "#c4b5fd", // XVII The Sovereign — regal violet
  "#a5b4fc", // XVIII The Eternal — starlight indigo
  "#e879f9", // XIX  The Infinite — prism
];

export function heartRankTint(level: number): string {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.round(level || 1)));
  if (L <= 10) return HEART_TINTS[L] || "#94a3b8";
  const i = HEART_BANDS.findIndex((b) => L >= b.min && L <= b.max);
  return BAND_TINTS[i >= 0 ? i : BAND_TINTS.length - 1];
}

// Every Opening name on the ladder — the ten per-level ones AND the nine bands.
// Missing the bands here would print "THE KEEPER" twice on a level-47 profile:
// once as the level title, once as the heart chip.
const HEART_RANK_NAMES = new Set(
  [...Object.values(HEART_RANKS), ...HEART_BANDS].map((r) => r.name.toLowerCase())
);

/**
 * Is this title just an Opening name under another name?
 *
 * LEVEL_TITLES in lib/ranks.ts is DERIVED from this file, so for every
 * non-staff user `rankTheme.title` and the heart rank are guaranteed to be the
 * same words — which is why a profile showed "THE DEVOTED" and
 * "🤝 THE DEVOTED · III" side by side. Only the staff titles (LEAD DEV, ADMIN)
 * are genuinely separate names, and those are the only ones worth a second chip.
 *
 * Asks "is this a rank name?" rather than "does this equal the rank for level
 * N?" because the two are not the same question when a user's level is computed
 * differently by different callers: isAdmin() reads the role column while
 * getRankTheme() only reads the username, so a role-column admin gets level 10
 * from one and their XP level from the other. An equality check passes there and
 * prints a stale, lower title next to the correct one. A set membership test
 * cannot: any Opening name is the heart badge's job, whichever level produced it.
 */
export function isHeartRankName(title: string | null | undefined): boolean {
  return !!title && HEART_RANK_NAMES.has(title.trim().toLowerCase());
}
