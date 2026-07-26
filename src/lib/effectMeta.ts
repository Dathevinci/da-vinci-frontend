/**
 * Display identity for profile effects — name, gradient swatch and rarity tier.
 *
 * Why this file exists: SHOP_ITEMS in src/app/shop/page.tsx is a page-local
 * `const` (not exported), and its entries carry lucide component references.
 * The navbar needs to name and colour an equipped effect on every page, and
 * importing the shop page for that would drag ~30 icon imports into the header
 * bundle. So the display fields are mirrored here — no React, no lucide.
 *
 * `name` and `gradient` are copied VERBATIM from SHOP_ITEMS (shop/page.tsx:30-70).
 * If you add an effect to the shop, add it here too. Forgetting is not fatal:
 * getEffectMeta() falls back to a readable prettified name and a neutral swatch,
 * and the effect stays fully equippable.
 */

export type EffectTier = "sss" | "rare" | "unique" | "common" | "exclusive";

export type EffectMeta = {
  name: string;
  gradient: string;
  tier: EffectTier;
  limited?: boolean;
};

export const EFFECT_META: Record<string, EffectMeta> = {
  // ── SSS ──────────────────────────────────────────────────────────────────
  effect_dejavu: { name: "Dejavu: Temporal Echo", gradient: "from-slate-100 via-red-900 to-cyan-500", tier: "sss", limited: true },
  effect_hollow: { name: "Hollow Technique: Purple", gradient: "from-blue-500 via-purple-600 to-red-500", tier: "sss" },
  effect_himalaya: { name: "The Silent Himalayas", gradient: "from-slate-200 via-sky-400 to-slate-800", tier: "sss" },
  effect_ritual: { name: "With This Treasure…", gradient: "from-slate-100 via-slate-500 to-black", tier: "sss" },
  effect_void: { name: "Domain Expansion: Infinite Void", gradient: "from-white via-cyan-400 to-indigo-950", tier: "sss" },
  effect_unblinking: { name: "The Unblinking", gradient: "from-neutral-200 via-neutral-600 to-red-950", tier: "sss" },

  // ── Rare ─────────────────────────────────────────────────────────────────
  effect_jungle: { name: "The Ancient Jungle", gradient: "from-emerald-500 via-green-700 to-yellow-700", tier: "rare" },
  effect_mango: { name: "Mango Loco", gradient: "from-orange-400 via-pink-500 to-lime-500", tier: "rare" },
  effect_lotus: { name: "The Sacred Lotus Pond", gradient: "from-pink-300 via-emerald-500 to-teal-800", tier: "rare" },
  effect_samurai: { name: "The Ghost Samurai", gradient: "from-slate-300 via-red-600 to-stone-950", tier: "rare" },
  effect_mahoraga: { name: "Wheel of Adaptation", gradient: "from-amber-300 via-yellow-600 to-stone-900", tier: "rare" },
  effect_tempest: { name: "Monarch's Tempest", gradient: "from-sky-400 via-purple-600 to-slate-800", tier: "rare" },
  effect_blackhole: { name: "Event Horizon", gradient: "from-orange-500 via-purple-500 to-black", tier: "rare" },
  effect_fool: { name: "Fog of History", gradient: "from-slate-400 via-slate-600 to-amber-700", tier: "rare" },
  effect_evernight: { name: "Evernight's Blessing", gradient: "from-rose-400 via-rose-800 to-slate-900", tier: "rare" },
  effect_ascension: { name: "Voltaic Ascension", gradient: "from-fuchsia-500 via-purple-500 to-purple-700", tier: "rare" },

  // ── Unique ───────────────────────────────────────────────────────────────
  effect_canopy: { name: "Heart of the Forest", gradient: "from-emerald-300 via-green-600 to-amber-900", tier: "unique" },
  effect_froggie: { name: "Froggie Frenzy", gradient: "from-emerald-400 to-lime-500", tier: "unique" },

  // ── Common ───────────────────────────────────────────────────────────────
  effect_aura: { name: "Ethereal Aura", gradient: "from-fuchsia-400 to-purple-600", tier: "common" },
  effect_sparkles: { name: "Astral Dust", gradient: "from-yellow-300 to-yellow-600", tier: "common" },
  effect_snow: { name: "Winter's Veil", gradient: "from-sky-300 to-blue-500", tier: "common" },
  effect_embers: { name: "Cinder Storm", gradient: "from-orange-400 to-red-600", tier: "common" },

  // Not in SHOP_ITEMS by design — un-buyable, granted to the chosen only.
  // Building any effect list by intersecting with the shop catalog would make
  // this silently vanish for the one user who owns it.
  effect_crimson: { name: "The Visceral Crimson Realm", gradient: "from-red-500 via-red-800 to-black", tier: "exclusive" },
};

/** Display order: rarest first. Ids missing from this list are appended, never dropped. */
export const EFFECT_ORDER: string[] = [
  "effect_dejavu", "effect_hollow", "effect_himalaya", "effect_ritual", "effect_void", "effect_unblinking",
  "effect_jungle", "effect_mango", "effect_lotus", "effect_samurai", "effect_mahoraga",
  "effect_tempest", "effect_blackhole", "effect_fool", "effect_evernight", "effect_ascension",
  "effect_canopy", "effect_froggie",
  "effect_aura", "effect_sparkles", "effect_snow", "effect_embers",
];

/** "effect_ghost_samurai" -> "Ghost Samurai" */
function prettify(id: string): string {
  return id
    .replace(/^effect_/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Never returns a broken shape for a known-good id, and never throws for an
 * unknown one — an effect shipped to the shop before this file is updated still
 * renders a readable name and a neutral swatch.
 */
export function getEffectMeta(id?: string | null): EffectMeta | null {
  if (!id) return null;
  return EFFECT_META[id] || { name: prettify(id), gradient: "from-slate-500 to-slate-700", tier: "common" };
}

/** Rarity chip styling — panel plate only. `common` intentionally has no chip. */
export const TIER_CHIP: Record<EffectTier, string> = {
  sss: "bg-white/10 text-slate-100 border-white/20",
  rare: "bg-purple-500/15 text-purple-300 border-purple-400/20",
  unique: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  exclusive: "bg-red-500/15 text-red-300 border-red-400/25",
  common: "",
};
