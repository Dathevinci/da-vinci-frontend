"use client";

import { motion } from "framer-motion";
import { FroggieAvatarPond } from "@/components/profile/FroggiePond";
import { TempestAvatarStorm } from "@/components/profile/StormOverlay";
import { FoolAvatarAura } from "@/components/profile/FoolMist";
import { EvernightAvatarAura } from "@/components/profile/EvernightVeil";
import { CrimsonAvatarMark } from "@/components/profile/CrimsonRealm";
import { MahoragaAvatarWheel } from "@/components/profile/MahoragaWheel";
import { MahoragaRitualMark } from "@/components/profile/MahoragaRitual";
import { CanopyAvatarVines } from "@/components/profile/VerdantCanopy";
import { SamuraiAvatarAura } from "@/components/profile/GhostSamurai";
import { SnowAvatarFrost } from "@/components/profile/HimalayanSnow";
import { LotusAvatarPond } from "@/components/profile/LotusPond";
import { MangoLocoAvatarMarigold } from "@/components/profile/MangoLoco";
import { JungleAvatarFronds } from "@/components/profile/JungleDepths";
import { UnblinkingAvatarMark } from "@/components/profile/UnblinkingGaze";
import { VoidAvatarMark } from "@/components/profile/InfiniteVoid";

/**
 * Discord-style avatar decorations that overlay an avatar.
 *
 * Drop <AvatarDecoration frame={...} effect={...} /> inside any `relative`
 * avatar wrapper whose <img> sits at z-10. The frame renders as a rotating
 * gradient ring BEHIND the avatar (z-0, only its edge shows), and effects
 * render as particles/glow layered around it. Purely additive — it renders
 * nothing when no cosmetic is active, so existing avatars are untouched.
 */

// Rotating conic-gradient rings. The avatar (opaque, z-10) covers the center,
// so only the outer ring shows — a glowing, slowly spinning border.
export const FRAMES: Record<string, { ring: string; glow: string; speed: number }> = {
  frame_amethyst: { ring: "conic-gradient(from 0deg, #f5d0fe, #a855f7, #d946ef, #7c3aed, #c084fc, #a855f7, #f5d0fe)", glow: "rgba(168,85,247,0.55)", speed: 6 },
  frame_gold:     { ring: "conic-gradient(from 0deg, #fef3c7, #f59e0b, #fbbf24, #b45309, #fde68a, #f59e0b, #fef3c7)", glow: "rgba(245,158,11,0.55)", speed: 6 },
  frame_ember:    { ring: "conic-gradient(from 0deg, #fde68a, #fb923c, #ef4444, #b91c1c, #f97316, #fb923c, #fde68a)", glow: "rgba(239,68,68,0.55)", speed: 5 },
  frame_frost:    { ring: "conic-gradient(from 0deg, #cffafe, #22d3ee, #3b82f6, #6366f1, #38bdf8, #22d3ee, #cffafe)", glow: "rgba(56,189,248,0.55)", speed: 7 },
  frame_verdant:  { ring: "conic-gradient(from 0deg, #d9f99d, #4ade80, #10b981, #047857, #34d399, #4ade80, #d9f99d)", glow: "rgba(16,185,129,0.55)", speed: 7 },
};

// Effects rendered by this component. effect_sparkles is intentionally excluded —
// it has its own legacy inline rendering elsewhere, so we don't double it up.
export const DECOR_EFFECTS = new Set(["effect_snow", "effect_embers", "effect_aura", "effect_ascension", "effect_froggie", "effect_tempest", "effect_blackhole", "effect_fool", "effect_evernight", "effect_crimson", "effect_mahoraga", "effect_ritual", "effect_canopy", "effect_samurai", "effect_himalaya", "effect_lotus", "effect_mango", "effect_jungle", "effect_unblinking", "effect_void"]);

// The extreme-rare "Voltaic Ascension" gives its own crackling electric ring,
// shown even when no frame is equipped — so the storm follows the avatar everywhere.
const ASCENSION_RING = {
  ring: "conic-gradient(from 0deg, #faf5ff, #a855f7, #ede9fe, #7c3aed, #f5d0fe, #6d28d9, #faf5ff)",
  glow: "rgba(168,85,247,0.85)",
  speed: 3,
};

export function isFrame(id?: string | null) {
  return !!id && id in FRAMES;
}

// True when the avatar shows a decorative RING (a bought frame, or the Voltaic
// Ascension ring). Callers use this to drop the rank/role border + glow so the
// shop-bought frame isn't overridden by it.
export function hasFrameRing(frame?: string | null, effect?: string | null) {
  return isFrame(frame) || effect === "effect_ascension";
}

export function AvatarDecoration({
  frame,
  effect,
  size = "sm",
}: {
  frame?: string | null;
  effect?: string | null;
  // "lg" = full-fidelity heavy effects (the big profile avatar + the shop
  // preview, which shows one distinct effect per card). "sm" = dense surfaces
  // (comments, directory, lists, nav) where heavy effects collapse to a cheap
  // glow so a page full of avatars stays smooth.
  size?: "sm" | "lg";
}) {
  // Voltaic Ascension brings its own electric ring; otherwise use the frame's ring.
  const ring = effect === "effect_ascension" ? ASCENSION_RING : frame ? FRAMES[frame] : null;
  const showEffect = !!effect && DECOR_EFFECTS.has(effect);
  if (!ring && !showEffect) return null;

  return (
    <>
      {ring && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-full z-0"
          style={{ background: ring.ring, filter: `drop-shadow(0 0 6px ${ring.glow})` }}
          animate={{ rotate: 360 }}
          transition={{ duration: ring.speed, repeat: Infinity, ease: "linear" }}
        />
      )}
      {showEffect && <EffectLayer effect={effect!} size={size} />}
    </>
  );
}

// Effects whose full form is a <canvas>, blur filters, or dense particle fields.
// Rendered at full fidelity only on the large profile avatar; a cheap glow stands
// in everywhere else so lists of avatars don't melt the page.
const HEAVY_EFFECTS = new Set([
  "effect_blackhole",
  "effect_froggie",
  "effect_tempest",
  "effect_fool",
  "effect_evernight",
  "effect_crimson",
  "effect_mahoraga",
  "effect_ritual",
  "effect_canopy",
  "effect_samurai",
  "effect_himalaya",
  "effect_lotus",
  "effect_mango",
  "effect_jungle",
  "effect_unblinking",
  "effect_void",
]);

const LITE_GLOW: Record<string, string[]> = {
  effect_blackhole: ["0 0 8px 1px rgba(251,146,60,0.5)", "0 0 18px 5px rgba(168,85,247,0.6)", "0 0 8px 1px rgba(251,146,60,0.5)"],
  effect_froggie: ["0 0 8px 1px rgba(52,211,153,0.45)", "0 0 18px 5px rgba(163,230,53,0.6)", "0 0 8px 1px rgba(52,211,153,0.45)"],
  effect_tempest: ["0 0 8px 1px rgba(56,189,248,0.45)", "0 0 18px 5px rgba(99,102,241,0.6)", "0 0 8px 1px rgba(56,189,248,0.45)"],
  effect_fool: ["0 0 8px 1px rgba(148,163,184,0.45)", "0 0 18px 5px rgba(245,158,11,0.5)", "0 0 8px 1px rgba(148,163,184,0.45)"],
  effect_evernight: ["0 0 8px 1px rgba(244,63,94,0.45)", "0 0 18px 5px rgba(203,213,225,0.55)", "0 0 8px 1px rgba(244,63,94,0.45)"],
  effect_crimson: ["0 0 8px 1px rgba(220,38,38,0.5)", "0 0 18px 5px rgba(255,0,0,0.6)", "0 0 8px 1px rgba(220,38,38,0.5)"],
  effect_mahoraga: ["0 0 8px 1px rgba(184,134,11,0.5)", "0 0 18px 5px rgba(255,215,0,0.6)", "0 0 8px 1px rgba(184,134,11,0.5)"],
  effect_ritual: ["0 0 8px 1px rgba(160,160,175,0.5)", "0 0 18px 5px rgba(255,255,255,0.65)", "0 0 8px 1px rgba(160,160,175,0.5)"],
  effect_canopy: ["0 0 8px 1px rgba(16,185,129,0.5)", "0 0 18px 5px rgba(163,230,53,0.6)", "0 0 8px 1px rgba(16,185,129,0.5)"],
  effect_samurai: ["0 0 8px 1px rgba(220,38,38,0.5)", "0 0 18px 5px rgba(226,232,240,0.55)", "0 0 8px 1px rgba(220,38,38,0.5)"],
  effect_himalaya: ["0 0 8px 1px rgba(191,219,254,0.45)", "0 0 18px 5px rgba(226,236,255,0.6)", "0 0 8px 1px rgba(191,219,254,0.45)"],
  effect_lotus: ["0 0 8px 1px rgba(16,185,129,0.45)", "0 0 18px 5px rgba(52,211,153,0.6)", "0 0 8px 1px rgba(251,191,36,0.4)"],
  effect_mango: ["0 0 8px 1px rgba(255,140,0,0.5)", "0 0 18px 5px rgba(50,205,50,0.6)", "0 0 8px 1px rgba(255,20,147,0.5)"],
  effect_jungle: ["0 0 8px 1px rgba(31,107,56,0.5)", "0 0 18px 5px rgba(63,174,90,0.6)", "0 0 8px 1px rgba(255,220,120,0.4)"],
  effect_unblinking: ["0 0 8px 1px rgba(10,10,12,0.6)", "0 0 18px 5px rgba(139,0,0,0.5)", "0 0 8px 1px rgba(242,234,216,0.25)"],
  effect_void: ["0 0 8px 1px rgba(34,211,238,0.5)", "0 0 18px 5px rgba(224,242,254,0.6)", "0 0 8px 1px rgba(99,102,241,0.5)"],
};

import { BlackHoleEffect } from "./BlackHoleEffect";

function EffectLayer({ effect, size = "sm" }: { effect: string; size?: "sm" | "lg" }) {
  // On any small/dense surface, a heavy effect becomes a single cheap glow —
  // no canvas, no blur, no per-avatar animation loop.
  if (size !== "lg" && HEAVY_EFFECTS.has(effect)) {
    return (
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{ boxShadow: LITE_GLOW[effect] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  if (effect === "effect_blackhole") {
    return <BlackHoleEffect />;
  }

  if (effect === "effect_ascension") {
    // A crackling electric amethyst aura that flickers around the avatar.
    return (
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 10px 2px rgba(124,58,237,0.5)",
            "0 0 30px 9px rgba(216,180,254,0.85)",
            "0 0 14px 3px rgba(168,85,247,0.6)",
            "0 0 26px 7px rgba(217,70,239,0.8)",
            "0 0 10px 2px rgba(124,58,237,0.5)",
          ],
        }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  if (effect === "effect_froggie") {
    // The full magical pond — lily pads, lotus blooms, fireflies, and the chibi
    // froggie scurrying around the rim. Lives in FroggiePond.tsx.
    return <FroggieAvatarPond />;
  }

  if (effect === "effect_tempest") {
    // Cel-shaded thundercloud + electric arcs + rain. Lives in StormOverlay.tsx.
    return <TempestAvatarStorm />;
  }

  if (effect === "effect_fool") {
    // Grey mist wisp + gold halo + crimson motes. Lives in FoolMist.tsx.
    return <FoolAvatarAura />;
  }

  if (effect === "effect_evernight") {
    // Crimson-night halo + twilight ring + silver satellites. EvernightVeil.tsx.
    return <EvernightAvatarAura />;
  }

  if (effect === "effect_crimson") {
    // Donor-exclusive: blood glow + halo anchor. Lives in CrimsonRealm.tsx.
    return <CrimsonAvatarMark />;
  }

  if (effect === "effect_mahoraga") {
    // Gold aura + bronze ring + eight studs + wheel anchor. MahoragaWheel.tsx.
    return <MahoragaAvatarWheel />;
  }

  if (effect === "effect_ritual") {
    // SSS: white-silver aura + bone ring + ritual anchor. MahoragaRitual.tsx.
    return <MahoragaRitualMark />;
  }

  if (effect === "effect_canopy") {
    // Emerald aura + leafy ring + teal blooms + grove anchor. VerdantCanopy.tsx.
    return <CanopyAvatarVines />;
  }

  if (effect === "effect_samurai") {
    // Crimson-steel aura + petal motes + katana anchor. GhostSamurai.tsx.
    return <SamuraiAvatarAura />;
  }

  if (effect === "effect_himalaya") {
    // SSS: moonlit frost rim + snow cap + drifting flakes. HimalayanSnow.tsx.
    return <SnowAvatarFrost />;
  }

  if (effect === "effect_lotus") {
    // Extreme rare: jade pond aura + drifting pollen. LotusPond.tsx.
    return <LotusAvatarPond />;
  }

  if (effect === "effect_mango") {
    // Extreme rare: mango/lime fiesta aura + confetti. MangoLoco.tsx.
    return <MangoLocoAvatarMarigold />;
  }

  if (effect === "effect_jungle") {
    // Extreme rare: emerald overgrowth aura + spores. JungleDepths.tsx.
    return <JungleAvatarFronds />;
  }

  if (effect === "effect_unblinking") {
    // SSS: ink-black aura + crimson pulse + scratch-ring. UnblinkingGaze.tsx.
    return <UnblinkingAvatarMark />;
  }

  if (effect === "effect_void") {
    // SSS: starlight-cyan void aura + the cosmic-eye anchor. InfiniteVoid.tsx.
    return <VoidAvatarMark />;
  }

  if (effect === "effect_aura") {
    return (
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 10px 2px rgba(168,85,247,0.45)",
            "0 0 22px 6px rgba(217,70,239,0.65)",
            "0 0 10px 2px rgba(168,85,247,0.45)",
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  // Falling snow / rising embers — percentage-based so it scales with any avatar size.
  const isSnow = effect === "effect_snow";
  const color = isSnow ? "#e0f2fe" : "#fb923c";
  const glow = isSnow ? "rgba(224,242,254,0.9)" : "rgba(251,146,60,0.9)";
  const top: [string, string] = isSnow ? ["-14%", "114%"] : ["114%", "-14%"];
  const xs = [12, 30, 48, 66, 84, 22, 58];

  return (
    <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
      {xs.map((x, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            width: isSnow ? 4 : 3,
            height: isSnow ? 4 : 3,
            background: color,
            boxShadow: `0 0 5px ${glow}`,
          }}
          initial={{ top: top[0], opacity: 0 }}
          animate={{
            top,
            opacity: [0, 1, 1, 0],
            x: isSnow ? [0, 3, -3, 0] : [0, -2, 2, 0],
          }}
          transition={{
            duration: 2.6 + (i % 3) * 0.7,
            repeat: Infinity,
            delay: i * 0.35,
            ease: "linear",
          }}
        />
      ))}
    </span>
  );
}
