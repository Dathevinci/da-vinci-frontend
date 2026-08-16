"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { useToast } from "@/components/ui/Toast";
import { MountainSnow, ShoppingBag, Sparkles, Check, Diamond, Aperture, CircleDot, Orbit, Snowflake, Flame, Sun, Zap, Leaf, Search, X, LayoutGrid, CloudLightning, CloudFog, Moon, Cog, Target, Trees, Gift, Swords, Flower2, Skull, Sprout, Eye, ArrowRight, Infinity as InfinityIcon, History, Hourglass, Atom, Shell, Tag, Key, Network, Gavel, Layers, Radiation } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import GiftModal from "@/components/shop/GiftModal";
import BuyPointsModal from "@/components/shop/BuyPointsModal";
import { authHeaders } from "@/lib/authToken";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { isCrimsonChosen, isCrimsonActive, CRIMSON_OFF } from "@/components/profile/CrimsonRealm";

import { motion } from "framer-motion";

// The shop is now focused on avatar decorations: animated Frames (rings) and
// Effects (particles around your avatar + a matching flourish across your profile).

// ── LIMITED DROP window ─────────────────────────────────────────────────────
// Dejavu: Temporal Echo vanishes from sale at this instant. MUST match the
// backend's availableUntil for effect_dejavu in shopCatalog.ts — the server is
// the real wall (purchases AND gifts are rejected after this); this constant
// only drives the countdown UI. Owners keep the effect forever.
const DEJAVU_ENDS_AT = Date.parse("2026-07-24T23:59:59Z");

const SHOP_ITEMS = [
  // ---- SSS GRADE ----
  { id: "effect_outergod", type: "effect", sss: true, discountPercent: 10, name: "Outer God: Abyssal Gaze", description: "「 It has noticed you. 」 A tear in reality rips open behind your avatar — a jagged black wound rimmed in sickly bioluminescent teal, breathing. Colossal appendages writhe out of it, dreadfully slow, lined with pale suckers — and some grow eyes that follow the viewer's cursor. A spiral of glowing deep-sea mist is dragged inward, ignoring gravity entirely. Then, every ten to fifteen seconds, the abyss LOOKS BACK: the card darkens and immense mutated-magenta eyes crack open in the deep, their pupils snapping to the viewer's every movement — while reality buckles. Colours split apart, the card tears sideways, sanity drains. The eyes seal shut. It does not leave. SSS grade. Launch sale — 10% off.", price: 6000, icon: Shell, color: "text-teal-300", glow: "shadow-[0_0_26px_rgba(13,148,136,0.75)]", gradient: "from-teal-400 via-purple-900 to-fuchsia-600" },

  { id: "effect_dejavu", type: "effect", sss: true, limited: true, endsAt: DEJAVU_ENDS_AT, name: "Dejavu: Temporal Echo", description: "「 …you have read this before, haven't you? 」 LIMITED — 3 days, then it vanishes forever. The card plunges into a psychological void of pitch black and ash grey. A volatile quantum field orbits your avatar, never certain of its own position — and every few seconds the moment REPEATS: translucent, glitching afterimages of your avatar split away, drift, and snap back like a memory refusing to stay in the past. Three colossal time-dilation rings turn slowly behind you, inscribed with faintly glowing runes and relativity equations. Then reality itself TEARS — the whole card rips horizontally for a fifth of a second and jagged blood-red threads crack out from your avatar like corrupted nerves — while grey ash falls upward through a frozen moment in time. Time does not pass here. It circles. SSS grade. Limited.", price: 6000, icon: History, color: "text-slate-200", glow: "shadow-[0_0_26px_rgba(139,0,0,0.7)]", gradient: "from-slate-100 via-red-900 to-cyan-500" },

  { id: "effect_hollow", type: "effect", sss: true, name: "Hollow Technique: Purple", description: "「 Nine Ropes, Polarized Light, Crow and Declaration… 」 The collision of opposites. A cobalt sphere rushes in from the left, IMPLODING — light and debris spiral helplessly into it. A crimson sphere erupts from the right, EXPLODING with jagged repulsion arcs. They slam together above your profile and give birth to an imaginary mass: a violent violet-magenta singularity with a blinding white core. Concentric shockwaves ripple across the card, a hexagonal cursed-energy lattice fractures over the orb's surface, void-black lightning crackles at its rim — and twice a cycle, two pale slits of Six-Eyes light pulse in the dark, almost subliminal. Wisps of purple smoke curl around your avatar, but the singularity never touches it. It re-collides. Forever. SSS grade.", price: 6500, icon: Atom, color: "text-purple-300", glow: "shadow-[0_0_26px_rgba(167,36,240,0.75)]", gradient: "from-blue-500 via-purple-600 to-red-500" },

  { id: "effect_himalaya", type: "effect", sss: true, name: "The Silent Himalayas", description: "Night falls on the roof of the world. Three ranges of moonlit Himalayan peaks rise across the viewer's ENTIRE screen — deep twilight blue in the distance, icy silver up front — while heavy, weightless snow drifts down in three layers of depth, fluttering without a breath of wind. Freezing mountain mist rolls along the ridges, and the snow QUIETLY PILES: soft rolling drifts bury the bottom of the screen and settle in a gentle cap on the crown of your avatar and the top of your profile. Sagarmāthā's silence. SSS grade.", price: 8500, icon: MountainSnow, color: "text-sky-200", glow: "shadow-[0_0_26px_rgba(191,219,254,0.7)]", gradient: "from-slate-200 via-sky-400 to-slate-800" },

  { id: "effect_ritual", type: "effect", sss: true, name: "With This Treasure…", description: "「 With this treasure, I summon— 」 The complete ritual. The world drowns in boiling black shadows; jagged tendrils lash out of the dark and seize your avatar while a blinding divine core burns through them. Above it hangs the bone-white Eight-Handled Wheel — impossibly still, until it shudders… and SNAPS 45 degrees with a spray of white sparks that shakes the viewer's entire screen. The Ten Shadows' final trump card — and it speaks: the summoning chant plays aloud when the profile opens. SSS grade. One exists.", price: 8500, icon: Target, color: "text-slate-100", glow: "shadow-[0_0_26px_rgba(255,255,255,0.75)]", gradient: "from-slate-100 via-slate-500 to-black" },

  { id: "effect_void", type: "effect", sss: true, name: "Domain Expansion: Infinite Void", description: "「 Throughout Heaven and Earth, I alone am the honored one. 」 The world drops black as a barrier of blinding starlight erupts from your avatar and seals the viewer inside the domain. Behind you, a colossal COSMIC EYE opens — a blinding white singularity ringed by a slowly-turning iris of deep indigo and cyan. Then the flood: hundreds of motes of pure information erupt outward in perfect golden-angle fractal spirals… and FREEZE. Time collapses by 95% — the whole storm hangs suspended mid-air, drifting microscopically, while the eye pulses with a terrifying, calm glow. Within the Void you perceive everything, and can do nothing. SSS grade.", price: 7500, icon: InfinityIcon, color: "text-cyan-300", glow: "shadow-[0_0_26px_rgba(103,232,249,0.7)]", gradient: "from-white via-cyan-400 to-indigo-950" },

  { id: "effect_unblinking", type: "effect", sss: true, name: "The Unblinking", description: "It noticed you. Your profile becomes a page torn from a cursed manuscript — every line hand-inked and BOILING, redrawn each frame like a frantic sketch that refuses to sit still. A colossal hand-drawn EYE follows the viewer's cursor, blinking, its slit pupil dilating as they draw near — and sometimes it stops chasing and stares STRAIGHT AT THEM. Small eyes open in the dark to watch, a skeletal hand rises from the bottom of the page to reach for your avatar, a many-legged thing skitters across the card, and the darkness clenches like a heartbeat while ink drips and slash marks tear the page. The page watches back. SSS grade.", price: 7000, icon: Eye, color: "text-neutral-200", glow: "shadow-[0_0_26px_rgba(139,0,0,0.7)]", gradient: "from-neutral-200 via-neutral-600 to-red-950" },

  { id: "effect_portal", type: "effect", sss: true, name: "Dimension C-137", description: "「 Twenty minutes of adventure, in and out. 」 An interdimensional portal tears open behind your avatar — not a flat circle, a boiling SINGULARITY: three spiral arms of churning acid fluid swirl around the event horizon while the rim bubbles and spits in blinding toxic green. Slime drops are flung out with real ballistics, arcing under gravity and stretching into teardrops as they drip off your profile. The garbage of the multiverse tumbles out with them — magenta triangles, jagged cyan space rocks, glowing red squiggles spinning in zero-G. And every few seconds, reality itself GLITCHES: your whole profile slices into bands, shoves sideways like a broken signal, colours split, and the card shakes before snapping back like nothing happened. Your name drips acid for as long as it's equipped. SSS grade.", price: 8000, icon: Radiation, color: "text-lime-300", glow: "shadow-[0_0_26px_rgba(57,255,20,0.7)]", gradient: "from-lime-300 via-green-500 to-fuchsia-500" },
  { id: "effect_bankai", type: "effect", sss: true, name: "Bankai: Senbonzakura Kageyoshi", description: "「 Scatter. 」 A full release, forever looping over your profile. Out of total darkness a lone katana falls dead-vertical and stabs the ground beneath your avatar — the card SHAKES, a shockwave with a ring of pure void racing inside it tears across the profile, and a colossal pillar of white-pink reiatsu erupts through your avatar while the floor ripples like liquid. Six monolithic ghost-blades rise from the water to tower around you… hang in half a second of dead silence… then shatter AS ONE into hundreds of glowing sakura petals that tornado around your avatar before settling into a drifting pink domain across the whole card. And when the storm has said its piece, every petal spirals back into the ground and the dark goes quiet — until the sword falls again. Your name scatters light for as long as it's equipped. SSS grade.", price: 16000, icon: Swords, color: "text-pink-300", glow: "shadow-[0_0_26px_rgba(255,20,147,0.7)]", gradient: "from-slate-200 via-pink-400 to-fuchsia-600" },
  { id: "effect_webslinger", type: "effect", sss: true, name: "The Web-Slinger", description: "「 You know exactly whose profile this is. 」 High-tension web mechanics, anchored on you. A chaotic tangle of stark titanium-white threads wraps your avatar's rim in a glowing cyan haze, while six thick strands of spun silk shoot out and anchor themselves to the corners of your profile — sagging under their own weight like real webbing. And they're ALIVE: drag your cursor across any strand and it stretches toward you… let go, and it snaps back with a violent, decaying twang you can almost hear. Crimson and blue embers drift through the dark, every few seconds a spidey-sense ring pulses out from behind your avatar — and your NAME wears the silk too, light running through the letters for as long as it's equipped. Something tingles. SSS grade.", price: 7000, icon: Network, color: "text-cyan-200", glow: "shadow-[0_0_24px_rgba(34,211,238,0.7)]", gradient: "from-slate-100 via-cyan-500 to-red-600" },
  // ---- EXTREME RARE ----
  { id: "effect_jungle", type: "effect", rare: true, name: "The Ancient Jungle", description: "Something ancient has swallowed your profile. The viewer's ENTIRE screen becomes a dark, humid jungle floor: blurred fern silhouettes loom in the deep background while three shafts of warm golden sunlight pierce the canopy through drifting spores and darting cyan-and-gold fireflies. Giant procedural Monstera leaves — heart-shaped, slit with deep fenestrations — fan out from behind your avatar as thick woody vines drop from the top of the screen and coil around its rim. Huge leaves creep in from every corner, swaying on a heavy, humid breeze, while canopy leaves tumble slowly down. The jungle remembers.", price: 3800, icon: Sprout, color: "text-emerald-400", glow: "shadow-[0_0_24px_rgba(31,107,56,0.8)]", gradient: "from-emerald-500 via-green-700 to-yellow-700" },
  { id: "effect_mango", type: "effect", rare: true, name: "Mango Loco", description: "Completely unhinged. Your profile becomes a Día de los Muertos fiesta on the deep cobalt blue of a Mango Loco can: a rotating wreath of ruffled marigolds rings your avatar while three glowing sugar skulls — cyan, pink and lime eyes blazing — orbit around it. Every few seconds a Monster claw of toxic-lime tears down the viewer's ENTIRE screen and erupts a violent splatter of thick mango-orange and hot-pink juice that arcs out and drips down the glass, all through a chaotic storm of white-and-cyan carbonation fizz and falling fiesta confetti. Loud. Tropical. Loco.", price: 3800, icon: Skull, color: "text-orange-400", glow: "shadow-[0_0_24px_rgba(255,140,0,0.8)]", gradient: "from-orange-400 via-pink-500 to-lime-500" },
  { id: "effect_lotus", type: "effect", rare: true, name: "The Sacred Lotus Pond", description: "Stillness itself. A sacred lotus pond blooms across the viewer's ENTIRE screen — clear crystal water rippling with every gentle drop, and stirring into fresh waves as they move their mouse or scroll. Forty golden fireflies hover and dance over the surface while a cluster of giant green lily pads drifts around your avatar. Beside you, a pink Lotus and a pristine white Water Lily breathe slowly open and closed, their golden stamens shedding faint pollen into the air. The calm at the eye of the storm.", price: 3600, icon: Flower2, color: "text-emerald-300", glow: "shadow-[0_0_24px_rgba(52,211,153,0.7)]", gradient: "from-pink-300 via-emerald-500 to-teal-800" },
  { id: "effect_samurai", type: "effect", rare: true, name: "The Ghost Samurai", description: "The blade remembers. A spectral katana — hamon glinting along its tempered edge — floats across your avatar and, every six seconds, draws in a flash: a lightning-fast iaijutsu slash that carves a glowing crimson crescent around you and sends a gust through the storm of sakura petals falling across the viewer's ENTIRE screen, while your avatar rests in an aura of crimson and pale steel. The Ghost does not miss.", price: 3600, icon: Swords, color: "text-red-400", glow: "shadow-[0_0_24px_rgba(220,38,38,0.8)]", gradient: "from-slate-300 via-red-600 to-stone-950" },
  { id: "effect_mahoraga", type: "effect", rare: true, name: "Wheel of Adaptation", description: "The Divine General's Eight-Handled Wheel manifests behind your avatar in heavy metallic gold and bronze — idling with a slow, ominous turn until it violently SNAPS 45 degrees, hurling a blinding divine shockwave across the viewer's ENTIRE screen while cursed ink drifts through the dark. It adapts. Every four seconds. Forever.", price: 2600, icon: Cog, color: "text-amber-300", glow: "shadow-[0_0_24px_rgba(255,215,0,0.8)]", gradient: "from-amber-300 via-yellow-600 to-stone-900" },
  { id: "effect_tempest", type: "effect", rare: true, name: "Monarch's Tempest", description: "The apex artifact. A cel-shaded thundercloud crowns your avatar with lightning flickering inside it while electric arcs snap around the rim — and when anyone opens your profile, a cinematic storm engulfs their ENTIRE screen: pouring parallax rain, branched lightning strikes, and thunder-flash lighting. Dark-fantasy anime, made real.", price: 2400, icon: CloudLightning, color: "text-sky-300", glow: "shadow-[0_0_24px_rgba(56,189,248,0.8)]", gradient: "from-sky-400 via-purple-600 to-slate-800" },
  { id: "effect_blackhole", type: "effect", rare: true, name: "Event Horizon", description: "A highly detailed Black Hole / Deep Space Galaxy avatar effect. Your avatar becomes the center of an accretion disk while a spiral galaxy orbits around it, consuming doomed stars.", price: 2400, icon: Orbit, color: "text-orange-400", glow: "shadow-[0_0_24px_rgba(255,100,0,0.8)]", gradient: "from-orange-500 via-purple-500 to-black" },
  { id: "effect_fool", type: "effect", rare: true, name: "Fog of History", description: "Above the Grey Fog, at the bronze table. When anyone opens your profile, the endless Grey Fog rolls across their ENTIRE screen — crimson stars of the Tarot Club pulse deep within it, and silver spirit threads snake out of the mist to bind themselves to your avatar, crowned in an abyssal-black and cosmic-gold aura. He is watching.", price: 2000, icon: CloudFog, color: "text-slate-300", glow: "shadow-[0_0_24px_rgba(203,213,225,0.7)]", gradient: "from-slate-400 via-slate-600 to-amber-700" },
  { id: "effect_evernight", type: "effect", rare: true, name: "Evernight's Blessing", description: "The night belongs to Her. When anyone opens your profile, a massive Crimson Moon rises over their ENTIRE screen while the River of Eternal Darkness undulates below — and night-vanilla blossoms drift down like snow, swirling into orbit around your avatar, which rests inside an intertwined silver-and-crimson Aura of Concealment. Sleep. Tranquility. Concealment.", price: 2200, icon: Moon, color: "text-rose-300", glow: "shadow-[0_0_24px_rgba(244,63,94,0.7)]", gradient: "from-rose-400 via-rose-800 to-slate-900" },
  { id: "effect_ascension", type: "effect", rare: true, name: "Voltaic Ascension", description: "The single rarest power in Da Vinci. A storm of amethyst lightning crackles around your avatar while violet smoke pours across your profile — then reality tears open in a warp of light the moment your profile is viewed. Turns your whole profile purple. For the very few.", price: 1600, icon: Zap, color: "text-purple-300", glow: "shadow-[0_0_24px_rgba(168,85,247,0.8)]", gradient: "from-fuchsia-500 via-purple-500 to-purple-700" },

  // ---- Avatar Frames: an animated ring that spins around your avatar everywhere ----
  { id: "frame_amethyst", type: "frame", name: "Amethyst Halo", description: "A violet-and-magenta ring that slowly spins around your avatar. Shows on your profile, your comments, and the nav bar.", price: 90, icon: Aperture, color: "text-purple-400", glow: "shadow-[0_0_15px_rgba(192,132,252,0.5)]", gradient: "from-purple-500 to-fuchsia-600" },
  { id: "frame_gold", type: "frame", name: "Golden Aureole", description: "A ring of molten gold that rotates around your avatar wherever it appears. Pure prestige.", price: 110, icon: CircleDot, color: "text-amber-400", glow: "shadow-[0_0_15px_rgba(251,191,36,0.5)]", gradient: "from-amber-400 to-orange-600" },
  { id: "frame_ember", type: "frame", name: "Ember Crown", description: "A slowly spinning ring of fire — gold, orange and crimson — that wraps your avatar.", price: 100, icon: Flame, color: "text-red-500", glow: "shadow-[0_0_15px_rgba(239,68,68,0.5)]", gradient: "from-orange-500 to-red-600" },
  { id: "frame_frost", type: "frame", name: "Frost Sigil", description: "A rotating ring of icy cyan and sapphire light that circles your avatar.", price: 100, icon: Snowflake, color: "text-cyan-400", glow: "shadow-[0_0_15px_rgba(34,211,238,0.5)]", gradient: "from-cyan-400 to-blue-600" },
  { id: "frame_verdant", type: "frame", name: "Verdant Ring", description: "A spinning ring of emerald and jade that blooms around your avatar.", price: 90, icon: Orbit, color: "text-emerald-400", glow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]", gradient: "from-emerald-400 to-teal-600" },

  // ---- Avatar Effects: particles around your avatar + a flourish across your profile ----
  { id: "effect_gateway", type: "effect", unique: true, badge: "🗝️", name: "The Gate & The Key", description: "「 It knows the gate. It IS the gate. 」 Sacred geometry gone wrong. Behind your avatar, a wireframe TESSERACT — a true four-dimensional hypercube, projected down into our poor three — turns slowly inside a counter-rotating dodecahedron of corrupted gold, both drawn in solid burning light. Around them drifts a cluster of conjoined iridescent spheres, breathing and phasing through one another like boiling cosmic bubbles — each one carrying a single lidless golden iris that always faces the gateway. Hundreds of gold and ultraviolet motes orbit through three impossible spiral arms that never repeat. And every twelve to eighteen seconds, the viewer's mind briefly UNDERSTANDS what it is looking at: reality inverts to a hard alien negative while corrupted EKG waveforms tear across the geometry — then snaps back to serene, glowing calm as if nothing happened. Nothing happened. One geometry. Unique.", price: 4500, icon: Key, color: "text-violet-300", glow: "shadow-[0_0_26px_rgba(138,43,226,0.75)]", gradient: "from-violet-400 via-purple-900 to-amber-400" },
  { id: "effect_canopy", type: "effect", unique: true, badge: "🌿", name: "Heart of the Forest", description: "The forest claims you. Knotted wooden branches and living vines coil around your avatar, blooming with glowing teal woodland flowers — while the viewer's ENTIRE screen becomes a shaded grove: golden god rays slanting through the dark, hundreds of hand-drawn leaves fluttering down (and swirling around you instead of falling through), pollen spores drifting up, and sudden gusts of wind sweeping the canopy sideways — all wrapped in the soft, living ambience of the forest itself.", price: 3200, icon: Trees, color: "text-emerald-300", glow: "shadow-[0_0_22px_rgba(16,185,129,0.7)]", gradient: "from-emerald-300 via-green-600 to-amber-900" },
  { id: "effect_froggie", type: "effect", unique: true, name: "Froggie Frenzy", description: "The cutest thing money can buy. A tiny froggie hops around your avatar everywhere you go — and sprints across your profile going 'ribbit ribbit', with lily pads and pond bubbles. 100% serious. 100% ribbit.", price: 400, icon: Leaf, color: "text-emerald-300", glow: "shadow-[0_0_18px_rgba(52,211,153,0.6)]", gradient: "from-emerald-400 to-lime-500" },
  { id: "effect_aura", type: "effect", name: "Ethereal Aura", description: "A pulsing violet glow breathes around your avatar — and energy ripples across your whole profile when someone opens it.", price: 110, icon: Sun, color: "text-fuchsia-400", glow: "shadow-[0_0_15px_rgba(217,70,239,0.5)]", gradient: "from-fuchsia-400 to-purple-600" },
  { id: "effect_sparkles", type: "effect", name: "Astral Dust", description: "Golden sparkles drift and twinkle around your avatar — and shimmer across your whole profile when someone opens it.", price: 100, icon: Sparkles, color: "text-yellow-300", glow: "shadow-[0_0_15px_rgba(253,224,71,0.5)]", gradient: "from-yellow-300 to-yellow-600" },
  { id: "effect_snow", type: "effect", name: "Winter's Veil", description: "Snowflakes fall gently around your avatar — and drift across your whole profile when someone opens it.", price: 90, icon: Snowflake, color: "text-sky-300", glow: "shadow-[0_0_15px_rgba(125,211,252,0.5)]", gradient: "from-sky-300 to-blue-500" },
  { id: "effect_embers", type: "effect", name: "Cinder Storm", description: "Glowing embers rise around your avatar — and float up across your whole profile when someone opens it.", price: 90, icon: Flame, color: "text-orange-400", glow: "shadow-[0_0_15px_rgba(251,146,60,0.5)]", gradient: "from-orange-400 to-red-600" },
];

// "2d 13:45:09" (or "04:12:33" inside the last day) — limited-drop countdown.
const fmtLeft = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
};

// Per-item sale: `price` stays the list price (for the strikethrough); this is
// what the buyer actually pays. MUST mirror the backend's priceOf() in
// shopCatalog.ts — the server is the real authority on the charge.
const finalPrice = (item: { price: number } & Record<string, any>) => {
  const off = (item as any).discountPercent as number | undefined;
  return off ? Math.round(item.price * (1 - off / 100)) : item.price;
};

export default function ShopPage() {
  const { user, updateProfile, isLoaded } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<typeof SHOP_ITEMS[0] | null>(null);
  // The item being previewed full-screen (its real effect plays over a mock profile).
  const [previewItem, setPreviewItem] = useState<typeof SHOP_ITEMS[0] | null>(null);
  // Money → Arise Points top-up modal (Ko-fi bundles).
  const [showBuyPoints, setShowBuyPoints] = useState(false);

  // After a successful gift the server has already moved the points; just sync
  // the gifter's cached balance so the navbar/shop show it immediately.
  const applyNewBalance = (newAP: number | null) => {
    if (typeof newAP !== "number") return;
    try {
      const stored = localStorage.getItem("davinci_user");
      if (!stored) return;
      const u = JSON.parse(stored);
      u.arisePoints = newAP;
      localStorage.setItem("davinci_user", JSON.stringify(u));
      window.dispatchEvent(new Event("davinci_user_updated"));
    } catch {}
  };

  // After a server-authoritative purchase, sync the cached user from the server's
  // response (new balance) + add the item to the right inventory array, so the
  // navbar balance and the shop's owned state update instantly.
  const INVENTORY_FIELD: Record<string, string> = {
    role: "purchasedRoles", tag: "purchasedTags", theme: "purchasedThemes",
    color: "purchasedColors", font: "purchasedFonts", effect: "purchasedEffects", frame: "purchasedFrames",
  };
  const applyPurchase = (itemId: string, type: string, newAP: number | null) => {
    try {
      const stored = localStorage.getItem("davinci_user");
      if (!stored) return;
      const u = JSON.parse(stored);
      if (typeof newAP === "number") u.arisePoints = newAP;
      const f = INVENTORY_FIELD[type];
      if (f) u[f] = Array.from(new Set([...(Array.isArray(u[f]) ? u[f] : []), itemId]));
      localStorage.setItem("davinci_user", JSON.stringify(u));
      window.dispatchEvent(new Event("davinci_user_updated"));
    } catch {}
  };
  // Discovery controls — as the catalog grows these keep everything findable.
  const [query, setQuery] = useState("");
  // Widened to string because the themed collection keys join the rarity/type
  // keys here; a fixed union would have to be kept in sync with COLLECTIONS.
  const [category, setCategory] = useState<string>("all");
  // Declared up here with the other state, NOT beside buyBundle further down —
  // this component early-returns while loading and when signed out, so a hook
  // below those would change the hook count between renders and React would
  // throw "rendered fewer hooks than expected".
  const [bundleBusy, setBundleBusy] = useState<string | null>(null);
  const [owned, setOwned] = useState<"all" | "unowned" | "owned">("all");
  // Live clock for limited-drop countdowns. Starts null and is set on mount so
  // the SSR/prerender markup never bakes in a build-time Date.now() (hydration
  // mismatch); ticks once a second only while a live window exists.
  const [nowTs, setNowTs] = useState<number | null>(null);
  useEffect(() => {
    const hasLiveWindow = SHOP_ITEMS.some((it) => (it as any).endsAt && Date.now() <= (it as any).endsAt);
    setNowTs(Date.now());
    if (!hasLiveWindow) return;
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) return <LoadingScreen message="Loading shop" />;
  // Open to every logged-in user — cosmetics are the main Arise Points sink.
  if (!user) return null; // redirect to home is handled by the effect above

  const getInventoryArray = (type: string) => {
    switch(type) {
      case 'role': return user.purchasedRoles || [];
      case 'tag': return user.purchasedTags || [];
      case 'theme': return user.purchasedThemes || [];
      case 'color': return user.purchasedColors || [];
      case 'font': return user.purchasedFonts || [];
      case 'effect': return user.purchasedEffects || [];
      case 'frame': return user.purchasedFrames || [];
      default: return [];
    }
  };

  const getActiveField = (type: string) => {
    switch(type) {
      case 'role': return user.activeRole;
      case 'tag': return user.activeTag;
      case 'theme': return user.activeTheme;
      case 'color': return user.activeColor;
      case 'font': return user.activeFont;
      case 'effect': return user.activeEffect;
      case 'frame': return user.activeFrame;
      default: return null;
    }
  };

  const handlePurchase = async (item: typeof SHOP_ITEMS[0]) => {
    // Limited drops: the server rejects after the window too — this is just the
    // friendly local wall so nobody wastes a click at 00:00:01.
    const endsAt = (item as any).endsAt as number | undefined;
    if (endsAt && Date.now() > endsAt) {
      return toast("This limited item's window has closed — it's gone.", "error");
    }

    // Staff (admins + lead dev) buy freely without spending — their balance is a
    // fixed display (40k for admins, ∞ for the lead dev), so nothing is deducted.
    const isGod = isAdmin(user);

    if (!isGod && (user.arisePoints || 0) < finalPrice(item)) {
      return toast("Not enough Arise Points!", "error");
    }

    setBuyingId(item.id);
    try {
      // Server-authoritative: the backend checks the price + balance and moves
      // the points. The client can no longer set its own AP or inventory.
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/users/purchase`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "Purchase failed", "error");
        return;
      }
      applyPurchase(item.id, item.type, typeof data.arisePoints === "number" ? data.arisePoints : null);
      toast(`Successfully purchased ${item.name}!`, "success");
    } catch (err) {
      toast("Purchase failed", "error");
    } finally {
      setBuyingId(null);
    }
  };

  // Donor-exclusive: the chosen summons or silences her Crimson Realm. Summoning
  // sets activeEffect to the realm; silencing sets an explicit "off" so it does
  // not spring back (an empty slot would default to the realm). Equipping any
  // normal shop effect below sets it aside just the same, and unequipping that
  // effect returns her to the realm — she never loses it.
  const handleCrimsonToggle = async (summon: boolean) => {
    try {
      await updateProfile({ activeEffect: summon ? "effect_crimson" : CRIMSON_OFF });
      toast(summon ? "Summoned The Visceral Crimson Realm" : "Silenced your Crimson Realm", "success");
    } catch (err) {
      toast("Failed to toggle item", "error");
    }
  };

  const handleToggle = async (item: typeof SHOP_ITEMS[0], isEquipping: boolean) => {
    const updatePayload: any = {};
    const val = isEquipping ? item.id : null;
    switch(item.type) {
      case 'role': updatePayload.activeRole = val; break;
      case 'tag': updatePayload.activeTag = val; break;
      case 'theme': updatePayload.activeTheme = val; break;
      case 'color': updatePayload.activeColor = val; break;
      case 'font': updatePayload.activeFont = val; break;
      case 'effect': updatePayload.activeEffect = val; break;
      case 'frame': updatePayload.activeFrame = val; break;
    }

    try {
      await updateProfile(updatePayload);
      toast(`${isEquipping ? 'Equipped' : 'Unequipped'} ${item.name}`, "success");
    } catch (err) {
      toast("Failed to toggle item", "error");
    }
  };

  const renderCard = (item: typeof SHOP_ITEMS[0], i: number) => {
    const hasItem = getInventoryArray(item.type).includes(item.id);
    const isActive = getActiveField(item.type) === item.id;
    // Frames & effects render a live avatar preview so buyers see what they get.
    const isPreviewable = item.type === "frame" || (item.type === "effect" && item.id !== "effect_sparkles");
    const isSSS = !!(item as any).sss;
    const isRare = !isSSS && !!(item as any).rare;
    const isUnique = !!(item as any).unique;
    // Per-item sale: pay the discounted price, show the list price struck out.
    const off = (item as any).discountPercent as number | undefined;
    const salePrice = finalPrice(item);
    const canAfford = isAdmin(user) || (user.arisePoints || 0) >= salePrice;
    // Limited drop: countdown while the window is open, sealed after it closes.
    const isLimited = !!(item as any).limited;
    const endsAt = (item as any).endsAt as number | undefined;
    const msLeft = endsAt && nowTs !== null ? endsAt - nowTs : null;
    const isExpired = msLeft !== null && msLeft <= 0;
    const rarity = isSSS
      ? { label: "SSS", chip: "text-black bg-gradient-to-r from-white via-slate-200 to-slate-400" }
      : isRare
      ? { label: "Extreme Rare", chip: "text-white bg-gradient-to-r from-fuchsia-500 to-purple-600" }
      : isUnique
      ? { label: `${(item as any).badge || "🐸"} Unique`, chip: "text-emerald-950 bg-gradient-to-r from-emerald-300 to-lime-300" }
      : { label: item.type === "frame" ? "Frame" : "Effect", chip: "border border-white/15 bg-black/50 text-slate-200" };

    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.04, 0.3) }}
        key={item.id}
        className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1
          ${isSSS
            ? "border-slate-200/30 bg-gradient-to-b from-slate-200/[0.08] to-black/60 hover:shadow-[0_0_30px_rgba(255,255,255,0.22)]"
            : isRare
            ? "border-purple-500/35 bg-gradient-to-b from-purple-500/[0.09] to-black/40 hover:shadow-[0_0_26px_rgba(168,85,247,0.3)]"
            : isUnique
            ? "border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-black/40 hover:shadow-[0_0_22px_rgba(52,211,153,0.25)]"
            : "border-white/10 bg-[#0b0b11] hover:border-violet-400/40 hover:shadow-[0_10px_30px_rgba(139,92,246,0.15)]"}
          ${isActive ? "ring-1 ring-violet-400/60" : ""}`}
      >
        {/* Preview tile — your avatar wearing the item; tap for the full live preview */}
        <button onClick={() => setPreviewItem(item)} title={`Preview ${item.name}`} className="relative block aspect-[5/4] w-full cursor-pointer overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.16] transition-opacity duration-300 group-hover:opacity-30`} />
          <div className="absolute inset-0 bg-[radial-gradient(85%_65%_at_50%_100%,rgba(0,0,0,0.6),transparent)]" />
          <span className={`absolute left-2 top-2 z-20 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${rarity.chip}`}>
            {rarity.label}
          </span>
          {isLimited && (
            <span className={`absolute left-2 top-8 z-20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
              isExpired
                ? "border-white/15 bg-black/60 text-slate-500"
                : "animate-pulse border-red-700/60 bg-red-950/70 text-red-300"
            }`}>
              <Hourglass className="h-2.5 w-2.5" /> Limited
            </span>
          )}
          {off ? (
            <span className={`absolute left-2 z-20 inline-flex items-center gap-1 rounded-full border border-teal-500/50 bg-teal-950/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-teal-300 ${isLimited ? "top-14" : "top-8"}`}>
              <Tag className="h-2.5 w-2.5" /> −{off}%
            </span>
          ) : null}
          {hasItem && (
            <span className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
              <Check className="h-3 w-3" /> Owned
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-20 w-20">
              <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-violet-700 text-2xl font-black text-white">
                {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : (user.username?.[0]?.toUpperCase() || "?")}
              </div>
              {isPreviewable && (
                // size="sm" ON PURPOSE: at "lg" every SSS/heavy tile ran its
                // full avatar effect — ~25 simultaneous infinite box-shadow
                // animations (box-shadow can't composite; each one repaints
                // every frame). "sm" is the designed cheap-glow path for
                // lists; the full effect plays in the preview modal + hero.
                <AvatarDecoration
                  frame={item.type === "frame" ? item.id : null}
                  effect={item.type === "effect" ? item.id : null}
                  size="sm"
                />
              )}
            </div>
          </div>
        </button>

        {/* Limited-drop strip: a live countdown while the window is open,
            a sealed marker after — the item stays visible as a trophy. */}
        {isLimited && (
          <div className={`flex items-center justify-center gap-1.5 border-y px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
            isExpired
              ? "border-white/10 bg-black/50 text-slate-500"
              : "border-red-800/40 bg-gradient-to-r from-red-950/60 via-red-900/40 to-red-950/60 text-red-300"
          }`}>
            <Hourglass className={`h-3 w-3 ${isExpired ? "" : "animate-pulse"}`} />
            {isExpired ? (
              <span>Window closed — gone forever</span>
            ) : msLeft !== null ? (
              <span>
                Vanishes in <span className="font-mono tabular-nums text-red-200">{fmtLeft(msLeft)}</span>
              </span>
            ) : (
              <span>Limited drop — 3 days only</span>
            )}
          </div>
        )}

        {/* Name + actions — the lore lives inside the preview */}
        <div className="flex flex-1 flex-col gap-2.5 p-3">
          <h3 title={item.name} className={`truncate text-sm font-black tracking-tight ${item.color}`}>{item.name}</h3>
          <div className="mt-auto flex items-center gap-1.5">
            {!hasItem ? (
              isExpired ? (
                <button
                  disabled
                  className="flex h-9 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/40 text-xs font-black text-slate-600"
                >
                  Vanished
                </button>
              ) : canAfford ? (
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={buyingId === item.id}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 text-xs font-black text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
                >
                  {buyingId === item.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      <Diamond className="h-3.5 w-3.5" />
                      {off ? <s className="mr-0.5 text-[10px] font-bold text-violet-200/50">{item.price.toLocaleString()}</s> : null}
                      {salePrice.toLocaleString()}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setShowBuyPoints(true)}
                  title="Not enough Arise Points — top up"
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 text-xs font-black text-amber-200 transition hover:bg-amber-500/20"
                >
                  <Diamond className="h-3.5 w-3.5" /> {salePrice.toLocaleString()} · Top up
                </button>
              )
            ) : (
              <button
                onClick={() => handleToggle(item, !isActive)}
                className={`flex h-9 flex-1 items-center justify-center rounded-xl border text-xs font-black transition ${
                  isActive
                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                }`}
              >
                {isActive ? "Unequip" : "Equip"}
              </button>
            )}
            <button
              onClick={() => !isExpired && setGiftTarget(item)}
              disabled={isExpired}
              title={isExpired ? "The limited window has closed — gifting is off too" : "Gift to a friend"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                isExpired
                  ? "cursor-not-allowed border-white/5 bg-black/30 text-slate-700"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/40 hover:text-white"
              }`}
            >
              <Gift className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  /**
   * Themed collections — a second way to browse, cutting across rarity.
   *
   * Membership is an explicit id list rather than anything inferred from names,
   * so renaming an item can never silently drop it out of its set. An id that
   * isn't in the catalog is simply ignored, so this can't crash if an item is
   * ever removed.
   */
  const COLLECTIONS = [
    {
      key: "jujutsu",
      title: "The Sorcery Collection",
      blurb: "Domains, cursed techniques and the things that answer when you call them.",
      ids: ["effect_void", "effect_hollow", "effect_mahoraga", "effect_ritual"],
    },
    {
      key: "mysteries",
      title: "The Mysteries Collection",
      blurb: "Grey fog, borrowed divinity, and the pathways between them.",
      ids: ["effect_fool", "effect_evernight"],
    },
    {
      key: "nature",
      title: "The Wild Collection",
      blurb: "Mountains, canopies and still water — the quiet end of the catalog.",
      ids: ["effect_himalaya", "effect_jungle", "effect_lotus", "effect_canopy"],
    },
    {
      key: "cosmic",
      title: "The Cosmic Collection",
      blurb: "Gravity, lightning and the dark between stars.",
      ids: ["effect_blackhole", "effect_ascension", "effect_unblinking"],
    },
  ] as const;

  const collectionItems = (key: string) => {
    const set = COLLECTIONS.find((c) => c.key === key);
    if (!set) return [];
    // Preserve the order declared above, not catalog order — a collection reads
    // better curated than alphabetical.
    return set.ids.map((id) => SHOP_ITEMS.find((it) => it.id === id)).filter(Boolean) as typeof SHOP_ITEMS;
  };

  const SECTIONS = [
    { key: "sss", title: "SSS Grade", blurb: "Beyond rarity. One exists — and it costs accordingly." },
    { key: "rare", title: "Extreme Rare", blurb: "The single rarest power on the platform. The whole profile, transformed." },
    { key: "frame", title: "Avatar Frames", blurb: "An animated ring that spins around your avatar — everywhere it appears." },
    { key: "effect", title: "Avatar Effects", blurb: "Floating particles around your avatar, plus a matching flourish across your whole profile." },
    ...COLLECTIONS.map((c) => ({ key: c.key, title: c.title, blurb: c.blurb })),
  ];

  const sectionItems = (key: string) =>
    COLLECTIONS.some((c) => c.key === key)
      ? collectionItems(key)
      : key === "sss"
      ? SHOP_ITEMS.filter((it) => (it as any).sss)
      : key === "rare"
        ? SHOP_ITEMS.filter((it) => (it as any).rare && !(it as any).sss)
        : SHOP_ITEMS.filter((it) => it.type === key && !(it as any).rare && !(it as any).sss);

  const matchesFilters = (item: typeof SHOP_ITEMS[0]) => {
    const q = query.trim().toLowerCase();
    if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
    const has = getInventoryArray(item.type).includes(item.id);
    if (owned === "owned" && !has) return false;
    if (owned === "unowned" && has) return false;
    return true;
  };

  /**
   * On "All", show only the rarity/type sections. Collections are a different
   * VIEW of the same items, not extra items — including them here would render
   * every themed effect twice on the default tab.
   */
  const sectionData = SECTIONS.filter((s) =>
    category === "all" ? !COLLECTIONS.some((c) => c.key === s.key) : s.key === category
  ).map((s) => ({
    ...s,
    items: sectionItems(s.key).filter(matchesFilters),
  }));
  const shownCount = sectionData.reduce((n, s) => n + s.items.length, 0);
  const filtersActive = query.trim() !== "" || owned !== "all" || category !== "all";
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setOwned("all");
  };

  const TABS = [
    { key: "all", label: "All", icon: LayoutGrid, count: SHOP_ITEMS.length },
    { key: "sss", label: "SSS", icon: Target, count: sectionItems("sss").length },
    { key: "rare", label: "Extreme Rare", icon: Zap, count: sectionItems("rare").length },
    { key: "frame", label: "Frames", icon: Aperture, count: sectionItems("frame").length },
    { key: "effect", label: "Effects", icon: Sparkles, count: sectionItems("effect").length },
    // Themed sets, after the rarity/type tabs. Collections with no surviving
    // items are dropped so an empty tab can never render.
    ...COLLECTIONS.map((c) => ({
      key: c.key as string,
      label: c.title.replace(/^The\s+|\s+Collection$/g, ""),
      icon: Gift,
      count: collectionItems(c.key).length,
    })).filter((t) => t.count > 0),
  ];

  /**
   * Bundle pricing for a collection tab.
   *
   * Mirrors the server's rule — you pay only for what you don't already own,
   * minus the discount — purely so the button can show a number before you
   * click. The backend recomputes all of this from your real inventory, so a
   * tampered client just gets a different (correct) charge.
   *
   * Keys map to the server's SHOP_BUNDLES ids.
   */
  const BUNDLE_DISCOUNT = 0.2;
  const BUNDLE_ID_FOR: Record<string, string> = {
    jujutsu: "bundle_jujutsu",
    mysteries: "bundle_mysteries",
    nature: "bundle_nature",
    cosmic: "bundle_cosmic",
  };

  const bundleFor = (sectionKey: string) => {
    const bundleId = BUNDLE_ID_FOR[sectionKey];
    // Only on the collection's own tab — a buy-the-set button next to a rarity
    // heading on "All" would be selling something other than what's listed.
    if (!bundleId || category !== sectionKey) return null;
    const members = collectionItems(sectionKey);
    if (members.length === 0) return null;

    /**
     * Expiry is computed here rather than reusing `isExpired` — that identifier
     * is a local BOOLEAN inside the item-card scope, not a function, so calling
     * it from here threw "isExpired is not a function" and took the whole shop
     * page down the moment a collection tab was opened.
     *
     * Same rule as the cards use: a drop is closed only once we have a clock
     * (nowTs starts null before the mount effect runs) and its window has passed.
     */
    const expired = (it: typeof SHOP_ITEMS[0]) => {
      const endsAt = (it as any).endsAt as number | undefined;
      return !!endsAt && nowTs !== null && endsAt - nowTs <= 0;
    };

    const missing = members.filter(
      (it) => !getInventoryArray(it.type).includes(it.id) && !expired(it)
    );
    const full = missing.reduce((sum, it) => sum + it.price, 0);
    // Staff buy free, mirroring the server — otherwise the button would show a
    // price to someone who will be charged nothing.
    const price = isAdmin(user) ? 0 : Math.round(full * (1 - BUNDLE_DISCOUNT));
    return {
      bundleId,
      name: COLLECTIONS.find((c) => c.key === sectionKey)?.title || "Collection",
      missing,
      full,
      price,
      // Surface affordability as button state. Without this a normal account
      // sees a confident "Buy the set" and gets a red 402 toast for clicking it,
      // which reads as a bug rather than as "you can't afford this yet".
      canAfford: (user?.arisePoints || 0) >= price,
      short: Math.max(0, price - (user?.arisePoints || 0)),
    };
  };

  const buyBundle = async (bundleId: string, name: string) => {
    if (!user || bundleBusy) return;
    setBundleBusy(bundleId);
    try {
      // Declared here, same as handlePurchase does. It was previously read as a
      // free variable with no binding anywhere in this module, so "Buy the set"
      // threw ReferenceError into the error boundary — invisible to the build,
      // and only reachable from a collection tab, which is why it survived.
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/users/purchase-bundle`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, bundleId }),
      });
      const data = await res.json();
      if (!data?.success) {
        toast(data?.message || "Couldn't buy that collection.", "error");
        return;
      }
      const n = data.data?.granted?.length ?? 0;
      toast(
        `${name} unlocked — ${n} item${n === 1 ? "" : "s"} for ${(data.data?.cost ?? 0).toLocaleString()} AP` +
          (data.data?.saved ? ` (saved ${data.data.saved.toLocaleString()})` : ""),
        "success"
      );
      if (data.data?.expiredSkipped) {
        toast(`${data.data.expiredSkipped} item(s) skipped — their limited window has closed.`, "info");
      }
      // Reload to pick up the new inventory and balance. Not updateProfile —
      // that PATCH deliberately refuses client-written arisePoints (it's what
      // stops a browser minting its own points), so sending the balance back
      // would have been a no-op dressed up as a sync.
      if (typeof window !== "undefined") window.location.reload();
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBundleBusy(null);
    }
  };

  // What the user is wearing right now — quick glance + one-tap unequip.
  const equippedItems = SHOP_ITEMS.filter((it) => getActiveField(it.type) === it.id);

  // The donor's exclusive realm — only she sees it, and only she can toggle it.
  const isChosen = isCrimsonChosen(user);
  const crimsonOn = isChosen && isCrimsonActive(user.activeEffect);

  return (
    <PageTransition>
      {/* overflow-clip (not hidden) contains the top glow WITHOUT creating a
          scroll container, so the sticky shop toolbar below keeps working. */}
      <div className="relative min-h-screen overflow-clip bg-[#070709] pt-24 pb-24 font-mono text-white">
        {/* The Lunar top glow — the same single radial wash the hub, updates
            and leaderboard pages use. One flat paint, no filter:blur(). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]"
        />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <h1 className="flex items-center gap-2.5 font-fell text-3xl text-white md:text-5xl">
                <ShoppingBag className="h-7 w-7 text-violet-300 md:h-9 md:w-9" />
                <span>Arise <em className="italic text-violet-300">Shop</em></span>
              </h1>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">Frames &amp; effects that follow you across Da Vinci.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5">
                <Diamond className="h-4 w-4 text-violet-300" />
                <p className="text-sm font-black text-white">
                  {isLeadDev(user) ? <span className="text-violet-300">∞ AP</span> : `${displayArisePoints(user)} AP`}
                </p>
              </div>
              <button
                onClick={() => setShowBuyPoints(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 text-sm font-black text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
              >
                <Diamond className="h-4 w-4" /> Buy Points
              </button>
            </div>
          </motion.div>


          {/* ── FEATURED DROP hero — the newest SSS effect, playing LIVE across
              the banner. ProfileEffect is a child of this panel (card-anchored,
              Discord-style), and the mock avatar registers the anchor the tear
              opens on — the hero IS the demo, not a screenshot of it. ── */}
          {(() => {
            const hero = SHOP_ITEMS.find((it) => it.id === "effect_outergod");
            if (!hero) return null;
            const hOwned = getInventoryArray(hero.type).includes(hero.id);
            const hActive = getActiveField(hero.type) === hero.id;
            const hOff = (hero as any).discountPercent as number | undefined;
            const hPrice = finalPrice(hero);
            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11] bg-gradient-to-br from-[#02110f] via-[#040208] to-[#12030f]"
              >
                <ProfileEffect effect={hero.id} />

                <div className="relative z-40 flex flex-col items-center gap-6 px-6 py-8 md:flex-row md:items-center md:gap-10 md:px-10 md:py-9">
                  {/* the epicenter — the tear opens on this avatar's rim */}
                  <div className="relative h-24 w-24 shrink-0 md:h-28 md:w-28">
                    <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-teal-500/40 bg-gradient-to-br from-teal-900 to-fuchsia-950 text-3xl font-black text-white">
                      {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : (user.username?.[0]?.toUpperCase() || "?")}
                    </div>
                    <AvatarDecoration frame={null} effect={hero.id} size="lg" />
                  </div>

                  <div className="min-w-0 flex-1 text-center md:text-left">
                    <div className="mb-2.5 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                      <span className="rounded-full bg-gradient-to-r from-white via-slate-200 to-slate-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-black">New · SSS</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/50 bg-teal-950/70 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">
                        <Tag className="h-3 w-3" /> −{hOff ?? 0}% Launch Sale
                      </span>
                    </div>
                    <h2 className="truncate font-serif text-2xl font-black uppercase tracking-[0.14em] text-transparent bg-clip-text bg-[linear-gradient(92deg,#2ee6d6_10%,#9db8b2_45%,#d81fb4_90%)] md:text-3xl">
                      {hero.name}
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400 md:mx-0 md:text-sm">
                      A tear in reality opens behind your avatar. Tentacles writhe out. And every few seconds… the abyss looks back.
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-center gap-3 md:items-end">
                    <div className="flex items-baseline gap-2">
                      {hOff ? <s className="text-sm font-bold text-slate-500">{hero.price.toLocaleString()}</s> : null}
                      <span className="text-2xl font-black text-white drop-shadow-[0_0_14px_rgba(13,148,136,0.6)]">{hPrice.toLocaleString()}</span>
                      <span className="text-xs font-bold text-slate-400">AP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewItem(hero)}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white backdrop-blur transition hover:bg-white/[0.08]"
                      >
                        <Eye className="h-4 w-4" /> Preview
                      </button>
                      {hOwned ? (
                        <button
                          onClick={() => handleToggle(hero, !hActive)}
                          className={`inline-flex h-11 items-center gap-1.5 rounded-xl border px-5 text-xs font-black transition ${
                            hActive
                              ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              : "border-teal-500/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                          }`}
                        >
                          {hActive ? "Unequip" : "Equip"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(hero)}
                          disabled={buyingId === hero.id}
                          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-fuchsia-600 px-5 text-xs font-black text-white shadow-[0_0_20px_rgba(13,148,136,0.4)] transition hover:from-teal-500 hover:to-fuchsia-500"
                        >
                          {buyingId === hero.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          ) : (
                            <>
                              <Diamond className="h-4 w-4" /> Claim the Gaze
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* ── Equipped now — what you're wearing, with one-tap unequip ── */}
          {equippedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-5 flex flex-wrap items-center gap-2"
            >
              <span className="font-mono text-[10px] font-black uppercase tracking-wide text-slate-500">Equipped now</span>
              {equippedItems.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white backdrop-blur"
                >
                  <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${it.gradient}`} />
                  {it.name}
                  <button
                    onClick={() => handleToggle(it, false)}
                    title={`Unequip ${it.name}`}
                    className="text-slate-400 transition hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </motion.div>
          )}

          {/* ── Donor Exclusive: The Visceral Crimson Realm — visible only to the
              chosen. She wears it by default, may set it aside for any shop
              effect, and only she can summon or silence it. ── */}
          {isChosen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl p-6 mb-8 border border-red-600/50 bg-gradient-to-b from-red-900/25 to-black/60 shadow-[0_0_38px_rgba(220,38,38,0.28)]"
            >
              {/* static sheen — the old infinitely-animated backgroundPosition
                  shimmer repainted this whole panel on every frame, forever */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(115deg, transparent 40%, rgba(220,38,38,0.12) 52%, transparent 64%)" }}
              />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="relative w-16 h-16 shrink-0">
                  <div className="relative z-10 w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 bg-gradient-to-br from-red-700 to-black">
                    {user.avatar && <img src={user.avatar} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <AvatarDecoration effect="effect_crimson" size="lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 mb-2 w-fit text-[11px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full text-white bg-gradient-to-r from-red-600 to-rose-800 shadow-[0_0_14px_rgba(220,38,38,0.6)]">
                    ♥ Donor Exclusive — Yours Alone
                  </span>
                  <h3 className="text-2xl font-black mb-1 text-red-400">The Visceral Crimson Realm</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Your gift-bound realm: a jagged cosmic halo, a churning red sea, and rising embers. It is yours forever — equip any shop effect to set it aside, and it returns the instant you unequip. Only you can summon or silence it.
                  </p>
                </div>
                <button
                  onClick={() => handleCrimsonToggle(!crimsonOn)}
                  className={`shrink-0 py-3.5 px-8 rounded-xl font-black transition-all duration-300 border hover:scale-[1.02] ${
                    crimsonOn
                      ? "bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20 hover:border-red-400"
                      : "bg-gradient-to-r from-red-600 to-rose-700 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:from-red-500 hover:to-rose-600"
                  }`}
                >
                  {crimsonOn ? "Silence Realm" : "Summon Realm"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Toolbar: search, ownership, category tabs.
              The 72px offset was clearance for the old top navbar. That nav is
              a bottom island now, so nothing occupies those 72px and the bar
              pinned itself a third of the way down the screen — reading as a
              panel floating over the grid, with the row above sliced in half
              behind it. It pins to the top edge instead, and carries a solid
              backdrop so cards pass cleanly underneath. ── */}
          <div className="z-30 mb-6 md:sticky md:top-3">
            <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#0b0b11]/95 backdrop-blur-xl p-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {/* search */}
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search frames, effects…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-9 text-sm transition placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {/* ownership segmented control */}
                <div className="flex items-center gap-1 self-start rounded-xl border border-white/10 bg-white/[0.04] p-1 md:self-auto">
                  {(
                    [
                      { key: "all", label: "Everything" },
                      { key: "unowned", label: "For sale" },
                      { key: "owned", label: "Owned" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => setOwned(o.key)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        owned === o.key
                          ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                          : "border-transparent text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* category tabs */}
              <div className="-mb-0.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((t) => {
                  const TabIcon = t.icon;
                  const active = category === t.key;
                  return (
                    // Count badge only on the ACTIVE tab — eight number chips
                    // in a row read as noise, one reads as information.
                    <button
                      key={t.key}
                      onClick={() => setCategory(t.key)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                        active
                          ? "border-violet-400/40 bg-violet-500/15 text-violet-200 hover:border-violet-400/60 hover:bg-violet-500/25"
                          : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
                      }`}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      {t.label}
                      {active && <span className="rounded-full bg-violet-400/20 px-1.5 py-0.5 text-[10px] font-black text-violet-100">{t.count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* results summary when filtering */}
          {filtersActive && (
            <div className="mb-8 flex items-center gap-3 text-sm text-slate-400">
              <span>
                <b className="text-white">{shownCount}</b> item{shownCount === 1 ? "" : "s"} found
              </span>
              <button
                onClick={resetFilters}
                className="font-bold text-violet-300 underline-offset-2 transition hover:text-white hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}

          {/* ── Nothing matches ── */}
          {shownCount === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
              <Sparkles className="h-10 w-10 text-slate-600" />
              <p className="text-lg font-bold text-slate-300">Nothing matches those filters.</p>
              <p className="max-w-sm text-sm text-slate-500">
                Try a different search, or reset the filters to browse the whole collection.
              </p>
              <button
                onClick={resetFilters}
                className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-6 py-2.5 font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
              >
                Show everything
              </button>
            </div>
          )}

          {sectionData.map((section) => {
            const items = section.items;
            if (items.length === 0) return null;
            const isRare = section.key === "rare";
            const isSSSSection = section.key === "sss";
            return (
              <div key={section.key} className="mb-12">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-1 rounded-full ${isSSSSection ? "bg-gradient-to-b from-white to-slate-500" : isRare ? "bg-gradient-to-b from-violet-300 to-violet-600" : "bg-gradient-to-b from-violet-400 to-violet-600"}`} />
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-fell text-xl leading-tight text-white md:text-2xl">{section.title}</h2>
                      <span className="text-xs font-bold text-slate-500">{items.length}</span>
                    </div>
                  </div>
                  {category === "all" && (
                    <button
                      onClick={() => setCategory(section.key as typeof category)}
                      className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-slate-500 transition hover:text-violet-200 sm:inline-flex"
                    >
                      Shop all <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Buy-the-set, only on a collection's own tab. The price shown
                      is for what you DON'T already own — the server recomputes it
                      from your real inventory, so this is a preview, not the
                      authority. */}
                  {bundleFor(section.key) && (() => {
                    const b = bundleFor(section.key)!;
                    if (b.missing.length === 0) {
                      return (
                        <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300">
                          Collection complete
                        </span>
                      );
                    }
                    if (!b.canAfford) {
                      return (
                        <span
                          title={`You need ${b.short.toLocaleString()} more Arise Points`}
                          className="shrink-0 cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-400"
                        >
                          Set costs {b.price.toLocaleString()} AP · need {b.short.toLocaleString()} more
                        </span>
                      );
                    }
                    return (
                      <button
                        onClick={() => buyBundle(b.bundleId, b.name)}
                        disabled={bundleBusy === b.bundleId}
                        className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-sm font-black text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-50"
                      >
                        {bundleBusy === b.bundleId
                          ? "Buying…"
                          : b.price === 0
                          ? "Claim the set · Free"
                          : `Buy the set · ${b.price.toLocaleString()} AP`}
                        {b.price > 0 && (
                          <span className="ml-1.5 text-[11px] font-bold text-violet-200/60 line-through">
                            {b.full.toLocaleString()}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.1 }}
                  className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                >
                  {items.map((item, i) => renderCard(item, i))}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Full-screen live preview: the item's REAL effect plays over a mock
          profile card, so buyers see exactly what they're buying. ── */}
      {previewItem &&
        createPortal(
          (() => {
            const pv = previewItem;
            const pOwned = getInventoryArray(pv.type).includes(pv.id);
            const pActive = getActiveField(pv.type) === pv.id;
            const pSSS = !!(pv as any).sss;
            const pRare = !pSSS && !!(pv as any).rare;
            const pUnique = !!(pv as any).unique;
            const pChip = pSSS
              ? { label: "SSS Grade", cls: "text-black bg-gradient-to-r from-white via-slate-200 to-slate-400" }
              : pRare
              ? { label: "Extreme Rare", cls: "text-white bg-gradient-to-r from-fuchsia-500 to-purple-600" }
              : pUnique
              ? { label: `${(pv as any).badge || "🐸"} Unique`, cls: "text-emerald-950 bg-gradient-to-r from-emerald-300 to-lime-300" }
              : { label: pv.type === "frame" ? "Frame" : "Effect", cls: "border border-white/10 bg-white/10 text-slate-300" };
            const canBuy = isAdmin(user) || (user.arisePoints || 0) >= finalPrice(pv);
            const pOff = (pv as any).discountPercent as number | undefined;
            const pEndsAt = (pv as any).endsAt as number | undefined;
            const pMsLeft = pEndsAt && nowTs !== null ? pEndsAt - nowTs : null;
            const pExpired = pMsLeft !== null && pMsLeft <= 0;
            return (
              <>
                {/* backdrop — dims the whole shop */}
                <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-sm" onClick={() => setPreviewItem(null)} />

                {/* Discord-style preview: a mock profile with the effect playing
                    across it (left) + the item's details & actions (right).
                    Stacks on mobile; the effect canvas is a child of the profile
                    panel so it stays clipped to that card. */}
                <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", damping: 26, stiffness: 300 }}
                    className="relative flex w-full max-w-4xl max-h-[92dvh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11] shadow-[0_40px_100px_rgba(0,0,0,0.7)] md:h-[560px] md:max-h-[88dvh] md:flex-row"
                  >
                    {/* ── LEFT · the mock profile, effect playing over the card ── */}
                    <div className="relative h-[300px] shrink-0 overflow-hidden bg-gradient-to-b from-[#15151d] to-[#0b0b11] sm:h-[340px] md:h-full md:w-[56%]">
                      {pv.type === "effect" && <ProfileEffect effect={pv.id} />}

                      <div className={`relative z-[2] h-24 bg-gradient-to-br ${pv.gradient} opacity-80`} />

                      <div className="relative z-[10] -mt-12 px-6">
                        <div className="relative h-24 w-24">
                          <div className="relative z-10 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#0b0b11] bg-violet-700 text-3xl font-black text-white">
                            {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : user.username?.[0]?.toUpperCase() || "?"}
                          </div>
                          <AvatarDecoration frame={pv.type === "frame" ? pv.id : null} effect={pv.type === "effect" ? pv.id : null} size="lg" />
                        </div>

                        <div className="mt-3">
                          <div className="text-2xl font-black text-white drop-shadow-md">{user.username || "your name"}</div>
                          <div className="text-sm font-semibold text-slate-400">@{(user.username || "you").toLowerCase()}</div>
                        </div>

                        <div className="mt-4 hidden rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-sm sm:block">
                          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">About me</div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">Previewing <b className="text-white">{pv.name}</b> across the whole profile — exactly how visitors will see it.</p>
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-6 z-[10] flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live preview
                      </div>
                    </div>

                    {/* ── RIGHT · details + actions ── */}
                    <div className="flex min-h-0 flex-1 flex-col bg-[#0b0b11] p-5 sm:p-6">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${pChip.cls}`}>{pChip.label}</span>
                        {(pv as any).limited && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            pExpired
                              ? "border-white/15 bg-black/50 text-slate-500"
                              : "border-red-700/60 bg-red-950/70 text-red-300"
                          }`}>
                            <Hourglass className={`h-3 w-3 ${pExpired ? "" : "animate-pulse"}`} />
                            {pExpired ? "Window closed" : pMsLeft !== null ? <span className="font-mono tabular-nums">{fmtLeft(pMsLeft)}</span> : "Limited"}
                          </span>
                        )}
                        {pOff ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/50 bg-teal-950/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-teal-300">
                            <Tag className="h-3 w-3" /> −{pOff}% Launch Sale
                          </span>
                        ) : null}
                        {pOwned && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                            <Check className="h-3 w-3" /> Owned
                          </span>
                        )}
                      </div>

                      <h3 className={`mb-3 text-2xl font-black ${pv.color}`}>{pv.name}</h3>

                      <div className="custom-scrollbar mb-5 min-h-0 flex-1 overflow-y-auto pr-1">
                        <p className="text-sm leading-relaxed text-slate-300/90">{pv.description}</p>
                      </div>

                      <div className="flex gap-2">
                      {!pOwned ? (
                        pExpired ? (
                          <button
                            disabled
                            className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/40 py-3 font-black text-slate-600"
                          >
                            Vanished — the window has closed
                          </button>
                        ) : !canBuy ? (
                          <button
                            onClick={() => { setPreviewItem(null); setShowBuyPoints(true); }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-bold transition border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                          >
                            <Diamond className="h-4 w-4" /> {finalPrice(pv).toLocaleString()} AP <span className="opacity-50">·</span> Buy Points
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchase(pv)}
                            disabled={buyingId === pv.id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 py-3 font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
                          >
                            {buyingId === pv.id ? (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <>
                                <Diamond className="h-4 w-4" />
                                {pOff ? <s className="text-xs font-bold text-violet-200/50">{pv.price.toLocaleString()}</s> : null}
                                {finalPrice(pv).toLocaleString()} <span className="opacity-50">·</span> Acquire
                              </>
                            )}
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleToggle(pv, !pActive)}
                          className={`flex flex-1 items-center justify-center rounded-xl border py-3 font-black transition ${
                            pActive ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                          }`}
                        >
                          {pActive ? "Unequip" : "Equip"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (pExpired) return;
                          setGiftTarget(pv);
                          setPreviewItem(null);
                        }}
                        disabled={pExpired}
                        title={pExpired ? "The limited window has closed — gifting is off too" : "Gift to a friend"}
                        className={`flex items-center justify-center rounded-xl border px-5 py-3 font-bold transition ${
                          pExpired
                            ? "cursor-not-allowed border-white/5 bg-black/30 text-slate-700"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/40 hover:text-white"
                        }`}
                      >
                        <Gift className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                    {/* close */}
                    <button
                      onClick={() => setPreviewItem(null)}
                      className="absolute right-3 top-3 z-[40] grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition hover:bg-white/15"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </motion.div>
                </div>
              </>
            );
          })(),
          document.body
        )}

      {giftTarget && (
        <GiftModal
          item={{ id: giftTarget.id, name: giftTarget.name, price: finalPrice(giftTarget), gradient: giftTarget.gradient }}
          gifterId={user.id}
          isGod={isLeadDev(user)}
          onClose={() => setGiftTarget(null)}
          onGifted={applyNewBalance}
        />
      )}

      {showBuyPoints && <BuyPointsModal username={user.username} onClose={() => setShowBuyPoints(false)} />}
    </PageTransition>
  );
}
