// ═══════════════════════════════════════════════════════════════════════════
// ARENA EFFECTS — the client's mirror of the backend catalog.
//
// MUST match da-vinci-backend/src/data/arenaEffects.ts. The server is the real
// authority: it charges the price, checks you own it, and decides which effect
// a duel plays under. Everything here only drives what's drawn.
//
// GRADE DRIVES INTENSITY. `intensity` is the 0-1 strength the backdrop renders
// at, so an A-grade is a wash of colour and an SSS takes the whole board.
// ═══════════════════════════════════════════════════════════════════════════

export type ArenaGrade = "A" | "S" | "SS" | "SSS";

export interface ArenaEffectDef {
  id: string;
  name: string;
  grade: ArenaGrade;
  price: number;
  intensity: number;
  hue: number;
  blurb: string;
  /** One line for the card grid, above the long blurb. */
  tagline: string;
}

export const GRADE_INTENSITY: Record<ArenaGrade, number> = {
  A: 0.35,
  S: 0.55,
  SS: 0.78,
  SSS: 1,
};

/** Grade → the colours the shop card and the grade chip are drawn in. */
export const GRADE_STYLE: Record<ArenaGrade, { label: string; ring: string; chip: string; text: string }> = {
  SSS: {
    label: "SSS",
    ring: "border-fuchsia-500/40 shadow-[0_0_34px_rgba(217,70,239,0.22)]",
    chip: "bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white shadow-[0_0_14px_rgba(217,70,239,0.55)]",
    text: "text-fuchsia-300",
  },
  SS: {
    label: "SS",
    ring: "border-amber-500/35 shadow-[0_0_28px_rgba(245,158,11,0.16)]",
    chip: "bg-gradient-to-r from-amber-500 to-orange-600 text-black",
    text: "text-amber-300",
  },
  S: {
    label: "S",
    ring: "border-sky-500/30 shadow-[0_0_24px_rgba(56,189,248,0.14)]",
    chip: "bg-gradient-to-r from-sky-500 to-cyan-600 text-black",
    text: "text-sky-300",
  },
  A: {
    label: "A",
    ring: "border-emerald-500/25",
    chip: "bg-gradient-to-r from-emerald-500 to-teal-600 text-black",
    text: "text-emerald-300",
  },
};

export const ARENA_EFFECTS: Record<string, ArenaEffectDef> = {
  arena_noir: {
    id: "arena_noir",
    name: "Noir",
    grade: "SSS",
    price: 14000,
    intensity: GRADE_INTENSITY.SSS,
    hue: 0,
    tagline: "The arena drains to black.",
    blurb:
      "Colour leaves the board entirely — the cards, their art, both sides' lights — and only the strikes bring any of it back. A hard white key light falls across the field, long shadows crawl over it, and the edges of the arena disappear into dark. Everything you can see is a shadow of itself until someone lands a hit.",
  },
  arena_voidrift: {
    id: "arena_voidrift",
    name: "Void Rift",
    grade: "SSS",
    price: 12500,
    intensity: GRADE_INTENSITY.SSS,
    hue: 275,
    tagline: "The floor falls away into nothing.",
    blurb:
      "A tear opens under the battlefield and the ground drops into it. The board sits over the gap, lit from below by something that is not light, while violet debris drifts upward past the cards and the rift breathes open and shut behind the clash.",
  },
  arena_stormfront: {
    id: "arena_stormfront",
    name: "Stormfront",
    grade: "SS",
    price: 7200,
    intensity: GRADE_INTENSITY.SS,
    hue: 210,
    tagline: "Every strike lands into thunder.",
    blurb:
      "Rain sheets across the board at an angle and lightning flickers behind the clash, throwing the whole arena white for a fraction of a second. The floor holds a wet shine that catches every flash.",
  },
  arena_emberfall: {
    id: "arena_emberfall",
    name: "Emberfall",
    grade: "SS",
    price: 6800,
    intensity: GRADE_INTENSITY.SS,
    hue: 22,
    tagline: "The last few minutes of somewhere that used to stand.",
    blurb:
      "Ash falls through the arena while embers climb the other way, and a low orange burn sits along the bottom of the board like something out of frame is still alight.",
  },
  arena_tidewash: {
    id: "arena_tidewash",
    name: "Tidewash",
    grade: "S",
    price: 3400,
    intensity: GRADE_INTENSITY.S,
    hue: 190,
    tagline: "As though the duel were happening a long way down.",
    blurb:
      "Cold caustic light moves slowly over the board in bands, the way sun looks from under water, and the far edges fade into deep blue.",
  },
  arena_goldenhour: {
    id: "arena_goldenhour",
    name: "Golden Hour",
    grade: "A",
    price: 1600,
    intensity: GRADE_INTENSITY.A,
    hue: 42,
    tagline: "Low warm sun across the arena.",
    blurb:
      "Long light from one side, dust hanging in it, and a soft warm falloff into the corners. The cheapest way to stop the board looking like a spreadsheet.",
  },
};

export const ARENA_LIST: ArenaEffectDef[] = Object.values(ARENA_EFFECTS).sort((a, b) => b.price - a.price);

export function arenaEffect(id?: string | null): ArenaEffectDef | null {
  return (id && ARENA_EFFECTS[id]) || null;
}

const GRADE_ORDER: ArenaGrade[] = ["A", "S", "SS", "SSS"];

/**
 * Mirror of the backend resolver, used only to PREVIEW what a duel will look
 * like before it starts. The value actually played under is the one the server
 * wrote onto the duel row.
 */
export function resolveArena(
  aOptedIn: boolean, aEffect: string | null | undefined,
  bOptedIn: boolean, bEffect: string | null | undefined
): string | null {
  if (!aOptedIn || !bOptedIn) return null;
  const a = arenaEffect(aEffect);
  const b = arenaEffect(bEffect);
  if (!a) return b?.id ?? null;
  if (!b) return a.id;
  return GRADE_ORDER.indexOf(b.grade) > GRADE_ORDER.indexOf(a.grade) ? b.id : a.id;
}
