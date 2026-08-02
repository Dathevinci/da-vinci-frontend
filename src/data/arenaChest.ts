import type { CardDef, CardMotif, CardRarity } from "@/components/cards/CardFace";
import { ARENA_EFFECTS, type ArenaEffectDef, type ArenaGrade } from "@/data/arenaEffects";

// ═══════════════════════════════════════════════════════════════════════════
// THE ARENA CACHE — client mirror.
//
// The top half MUST stay in sync with da-vinci-backend/src/data/arenaChest.ts.
// The server is the authority on the price, the roll and the refund; these
// copies only drive what the shop tile SAYS. The odds table below is derived
// from the live catalog rather than hardcoded, so adding a seventh arena can't
// make the tile quietly lie about its own rates.
// ═══════════════════════════════════════════════════════════════════════════

// ══ MIRROR BLOCK ══

export const GRADE_WEIGHT: Record<ArenaGrade, number> = { A: 44, S: 31, SS: 20, SSS: 5 };
export const DUPE_REFUND: Record<ArenaGrade, number> = { A: 300, S: 550, SS: 900, SSS: 1400 };

export interface ArenaChestDef {
  id: string;
  name: string;
  price: number;
  blurb: string;
  weights: Partial<Record<ArenaGrade, number>>;
  pityAfter: number;
  availableUntil?: string;
}

export const ARENA_CHESTS: Record<string, ArenaChestDef> = {
  chest_arena_small: {
    id: "chest_arena_small",
    name: "Arena Cache",
    price: 2600,
    weights: GRADE_WEIGHT,
    pityAfter: 10,
    blurb: "One arena effect. Which one is up to the Cache.",
  },
};

// ══ END MIRROR BLOCK ══

export const CHEST_LIST: ArenaChestDef[] = Object.values(ARENA_CHESTS);

/** Everything a chest can roll. Scoped to the chest, not to ARENA_EFFECTS. */
export function chestPool(chest: ArenaChestDef): ArenaEffectDef[] {
  return Object.values(ARENA_EFFECTS).filter((fx) => (chest.weights[fx.grade] ?? 0) > 0);
}

/**
 * Per-item odds for the published table.
 *
 * Weight is spent per GRADE and then split evenly among that grade's members —
 * which is why the two SSS effects are 2.5% each rather than 5% each. Derived
 * from the catalog every call, never a hardcoded percentage.
 */
export function itemOdds(chest: ArenaChestDef): { fx: ArenaEffectDef; pct: number }[] {
  const pool = chestPool(chest);
  // How many effects share each grade — the divisor that turns a grade's
  // weight into a per-item chance.
  const members: Partial<Record<ArenaGrade, number>> = {};
  for (const fx of pool) members[fx.grade] = (members[fx.grade] ?? 0) + 1;
  // Summed over the grades actually PRESENT, mirroring the server's recompute.
  const total = (Object.keys(members) as ArenaGrade[])
    .reduce((s, g) => s + (chest.weights[g] ?? 0), 0);
  return pool
    .map((fx) => ({
      fx,
      pct: total > 0 ? ((chest.weights[fx.grade] ?? 0) / (members[fx.grade] ?? 1) / total) * 100 : 0,
    }))
    .sort((a, b) => b.fx.price - a.fx.price);
}

/* ── Arena effect → playing card ─────────────────────────────────────────── */

/**
 * The grade ladder onto the card rarity ladder.
 *
 * This is what makes the reveal escalate without writing a single new
 * animation: PackReveal already gives `legendary` its own hero moment, a
 * standing pillar of light and a longer wait, and gives `epic` a flash. An SSS
 * arena inherits all of it.
 */
export const GRADE_RARITY: Record<ArenaGrade, CardRarity> = {
  A: "common",
  S: "rare",
  SS: "epic",
  SSS: "legendary",
};

const MOTIF_BY_ARENA: Record<string, CardMotif> = {
  arena_noir: "mask",
  arena_voidrift: "trench",
  arena_stormfront: "storm",
  arena_emberfall: "ember",
  arena_tidewash: "sea",
  arena_goldenhour: "dawn",
};

/**
 * Noir's hue is 0 because the BACKDROP uses it for desaturation maths, where
 * the number never becomes a colour. Reused as card art it would paint the one
 * deliberately colourless effect bright crimson, so the card overrides it.
 */
const CARD_HUE_OVERRIDE: Record<string, number> = { arena_noir: 265 };

/**
 * Render an arena effect as a card.
 *
 * Total over anything with {id, name, grade, hue} — which matters because the
 * SERVER's effect object is what gets passed here after a roll. A seventh arena
 * added backend-only still renders (falling back to a storm motif) instead of
 * throwing into the error boundary after the player has already been charged.
 */
export function arenaAsCard(fx: {
  id: string; name: string; grade: ArenaGrade; hue: number;
  tagline?: string; blurb?: string;
}): CardDef & { gradeLabel?: string } {
  return {
    id: fx.id,
    name: fx.name,
    rarity: GRADE_RARITY[fx.grade] ?? "common",
    set: "Arena",
    hue: CARD_HUE_OVERRIDE[fx.id] ?? fx.hue,
    motif: MOTIF_BY_ARENA[fx.id] ?? "storm",
    flavor: fx.tagline ?? fx.blurb ?? "",
    gradeLabel: fx.grade,
  };
}
