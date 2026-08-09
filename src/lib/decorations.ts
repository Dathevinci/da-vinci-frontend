/**
 * Decoration catalog names — id → display name for avatar frames and profile
 * effects, so surfaces outside the shop (the settings picker) can label what a
 * user owns without importing the whole shop page.
 *
 * Names are copied from the shop catalog (src/app/shop/page.tsx); keep them in
 * step when items are added there. Unknown ids fall back to a prettified form
 * of the id, so a missing entry mislabels rather than breaks.
 */

export const DECOR_NAMES: Record<string, string> = {
  // ---- Avatar frames (spinning rings) ----
  frame_amethyst: "Amethyst Halo",
  frame_gold: "Golden Aureole",
  frame_ember: "Ember Crown",
  frame_frost: "Frost Sigil",
  frame_verdant: "Verdant Ring",

  // ---- Profile effects ----
  effect_sparkles: "Astral Dust",
  effect_aura: "Ethereal Aura",
  effect_snow: "Winter's Veil",
  effect_embers: "Cinder Storm",
  effect_froggie: "Froggie Frenzy",
  effect_canopy: "Heart of the Forest",
  effect_hollow: "Hollow Technique: Purple",
  effect_himalaya: "The Silent Himalayas",
  effect_ritual: "With This Treasure…",
  effect_void: "Domain Expansion: Infinite Void",
  effect_unblinking: "The Unblinking",
  effect_webslinger: "The Web-Slinger",
  effect_jungle: "The Ancient Jungle",
  effect_mango: "Mango Loco",
  effect_lotus: "The Sacred Lotus Pond",
  effect_samurai: "The Ghost Samurai",
  effect_mahoraga: "Wheel of Adaptation",
  effect_tempest: "Monarch's Tempest",
  effect_blackhole: "Event Horizon",
  effect_fool: "Fog of History",
  effect_evernight: "Evernight's Blessing",
  effect_ascension: "Voltaic Ascension",
  effect_gateway: "The Gate & The Key",
  effect_dejavu: "Dejavu: Temporal Echo",
  effect_outergod: "Outer God: Abyssal Gaze",
  effect_portal: "Dimension C-137",
};

// The full catalogs, for staff (who may equip anything) and future listings.
export const ALL_FRAME_IDS = Object.keys(DECOR_NAMES).filter((id) => id.startsWith("frame_"));
export const ALL_EFFECT_IDS = Object.keys(DECOR_NAMES).filter((id) => id.startsWith("effect_"));

export function decorName(id: string | null | undefined): string {
  if (!id) return "None";
  return (
    DECOR_NAMES[id] ||
    id.replace(/^(frame|effect)_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
