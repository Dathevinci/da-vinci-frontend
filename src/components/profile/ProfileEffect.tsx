"use client";

import { motion } from "framer-motion";
import { FroggieCardPond } from "@/components/profile/FroggiePond";
import { TempestCardStorm } from "@/components/profile/StormOverlay";
import { FoolCardMist } from "@/components/profile/FoolMist";
import { EvernightCardNight } from "@/components/profile/EvernightVeil";
import { CrimsonCardRealm } from "@/components/profile/CrimsonRealm";
import { BlackHoleCardRealm } from "@/components/profile/BlackHoleEffect";
import { MahoragaCardRitual } from "@/components/profile/MahoragaWheel";
import { MahoragaRitualCard } from "@/components/profile/MahoragaRitual";
import { CanopyCardForest } from "@/components/profile/VerdantCanopy";
import { SamuraiCardRealm } from "@/components/profile/GhostSamurai";
import { SnowCardRealm } from "@/components/profile/HimalayanSnow";
import { LotusCardRealm } from "@/components/profile/LotusPond";
import { MangoLocoCardRealm } from "@/components/profile/MangoLoco";
import { JungleCardRealm } from "@/components/profile/JungleDepths";
import { UnblinkingCardRealm } from "@/components/profile/UnblinkingGaze";
import { VoidCardDomain } from "@/components/profile/InfiniteVoid";
import { DejavuCardEcho } from "@/components/profile/DejavuEcho";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Discord-style "Profile Effect" — a full-card animated overlay that plays when
 * a profile is opened. Driven by the viewed user's equipped effect, so buying an
 * effect now decorates BOTH the avatar (AvatarDecoration) and the whole profile.
 *
 * Drop <ProfileEffect effect={user.activeEffect} /> as a child of the profile
 * header card (which is `relative overflow-hidden`). Renders nothing when no
 * effect is equipped, so profiles without one are untouched.
 */

// Deterministic pseudo-random so server and client render identically (no
// hydration mismatch) — same seed always yields the same layout.
function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const FIELD = {
  effect_snow: { color: "#e0f2fe", count: 26, rise: false, min: 2, max: 5, glow: 6, ease: "easeInOut" as const },
  effect_embers: { color: "#fb923c", count: 24, rise: true, min: 2, max: 4, glow: 7, ease: "linear" as const },
  effect_sparkles: { color: "#fde047", count: 22, rise: true, min: 2, max: 4, glow: 8, ease: "linear" as const },
};

export function ProfileEffect({ effect }: { effect?: string | null }) {
  // Performance Mode turns off the heavy card-filling canvas domains entirely —
  // this is the single biggest cost on a profile, so it's what "reduces 3D
  // effects" actually means. The avatar/name styling stays; only the animated
  // overlay is dropped.
  const { preferences } = usePreferences();
  if (!effect || preferences.reducedMotion) return null;
  if (effect === "effect_ascension") return <StormField />;
  if (effect === "effect_tempest") return <TempestCardStorm />;
  if (effect === "effect_fool") return <FoolCardMist />;
  if (effect === "effect_evernight") return <EvernightCardNight />;
  if (effect === "effect_crimson") return <CrimsonCardRealm />;
  if (effect === "effect_blackhole") return <BlackHoleCardRealm />;
  if (effect === "effect_mahoraga") return <MahoragaCardRitual />;
  if (effect === "effect_ritual") return <MahoragaRitualCard />;
  if (effect === "effect_canopy") return <CanopyCardForest />;
  if (effect === "effect_samurai") return <SamuraiCardRealm />;
  if (effect === "effect_himalaya") return <SnowCardRealm />;
  if (effect === "effect_lotus") return <LotusCardRealm />;
  if (effect === "effect_mango") return <MangoLocoCardRealm />;
  if (effect === "effect_jungle") return <JungleCardRealm />;
  if (effect === "effect_unblinking") return <UnblinkingCardRealm />;
  if (effect === "effect_void") return <VoidCardDomain />;
  if (effect === "effect_dejavu") return <DejavuCardEcho />;
  if (effect === "effect_froggie") return <FroggieCardPond />;
  if (effect === "effect_aura") return <AuraField />;
  const cfg = FIELD[effect as keyof typeof FIELD];
  if (!cfg) return null;

  const from = cfg.rise ? "108%" : "-8%";
  const to = cfg.rise ? "-8%" : "108%";

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      {/* One-shot intro glow sweep — the "it plays when you open the profile" moment. */}
      <motion.span
        className="absolute inset-0"
        style={{
          background: `radial-gradient(130% 90% at 50% ${cfg.rise ? "100%" : "0%"}, ${cfg.color}33, transparent 62%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.7, ease: "easeOut" }}
      />
      {Array.from({ length: cfg.count }).map((_, i) => {
        const left = seeded(i, 1) * 100;
        const size = cfg.min + seeded(i, 2) * (cfg.max - cfg.min);
        const dur = 4 + seeded(i, 3) * 4;
        const delay = seeded(i, 4) * 5;
        const drift = (seeded(i, 5) - 0.5) * 7;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: cfg.color,
              boxShadow: `0 0 ${cfg.glow}px ${cfg.color}`,
            }}
            initial={{ top: from, opacity: 0 }}
            animate={{ top: [from, to], opacity: [0, 1, 1, 0], x: [0, drift, -drift, 0] }}
            transition={{ duration: dur, repeat: Infinity, delay, ease: cfg.ease }}
          />
        );
      })}
    </span>
  );
}

// Violet energy that ripples outward across the card, behind the content so text
// stays readable.
function AuraField() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
      <motion.span
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 100% at 50% 50%, rgba(168,85,247,0.18), transparent 65%)" }}
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full border border-fuchsia-400/40"
          style={{ width: 140, height: 140, marginLeft: -70, marginTop: -70 }}
          initial={{ scale: 0.3, opacity: 0.55 }}
          animate={{ scale: [0.3, 3.4], opacity: [0.55, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, delay: i * 1.4, ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

// The extreme-rare "Voltaic Ascension": a cinematic storm — violet smoke pours up
// the card, amethyst lightning cracks around it, and reality tears open in a warp
// of light the moment the profile is viewed. (The avatar's electric ring is drawn
// separately by AvatarDecoration.)
function StormField() {
  const smoke = [
    { x: 10, s: 150, d: 0.0, dur: 6.5 },
    { x: 28, s: 200, d: 1.6, dur: 7.5 },
    { x: 48, s: 170, d: 0.7, dur: 6.8 },
    { x: 68, s: 210, d: 2.2, dur: 8 },
    { x: 88, s: 150, d: 1.1, dur: 6.4 },
  ];
  const bolts = [
    { d: "M22,6 L38,42 L24,50 L44,104", left: "9%", top: "4%", period: 2.4, delay: 0.2 },
    { d: "M58,6 L42,40 L56,48 L36,104", left: "80%", top: "2%", period: 3.0, delay: 1.2 },
    { d: "M8,44 L44,56 L28,66 L64,80", left: "1%", top: "42%", period: 3.4, delay: 0.7 },
    { d: "M72,46 L36,58 L52,68 L18,84", left: "82%", top: "46%", period: 2.7, delay: 1.9 },
  ];
  return (
    <>
      {/* Backdrop — purple wash + violet smoke rising up the card (behind the text). */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
        <motion.span
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 120% at 50% 100%, rgba(88,28,135,0.42), rgba(76,29,149,0.14) 44%, transparent 72%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.82] }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        <motion.span
          className="absolute inset-0"
          style={{ background: "radial-gradient(85% 70% at 50% 55%, rgba(168,85,247,0.16), transparent 60%)" }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        {smoke.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: 0,
              width: p.s,
              height: p.s,
              marginLeft: -p.s / 2,
              background: "radial-gradient(circle, rgba(196,181,253,0.5), rgba(139,92,246,0.14) 55%, transparent 72%)",
              filter: "blur(10px)",
            }}
            initial={{ y: 50, opacity: 0, scale: 0.6 }}
            animate={{ y: [50, -200], opacity: [0, 0.72, 0], scale: [0.6, 1.4], x: [0, 12, -10, 6] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.d, ease: "easeOut" }}
          />
        ))}
      </span>

      {/* Lightning bolts that crack over the card, flickering. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[16] overflow-hidden">
        {bolts.map((b, i) => (
          <motion.span
            key={i}
            className="absolute"
            style={{ left: b.left, top: b.top }}
            animate={{ opacity: [0, 0, 1, 0.25, 1, 0] }}
            transition={{ duration: b.period, repeat: Infinity, delay: b.delay, times: [0, 0.5, 0.55, 0.6, 0.66, 0.78], ease: "linear" }}
          >
            <svg width="82" height="112" viewBox="0 0 82 112" style={{ filter: "drop-shadow(0 0 6px rgba(216,180,254,0.95))" }}>
              <path d={b.d} fill="none" stroke="#c084fc" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
              <path d={b.d} fill="none" stroke="#faf5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        ))}
      </span>

      {/* One-shot WARP — reality tears open when the profile is viewed, then clears. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[20] overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => {
          const ang = (i / 22) * 360;
          const c = i % 3 === 0 ? "#e879f9" : i % 3 === 1 ? "#38bdf8" : "#c084fc";
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 origin-left"
              style={{ height: 2, width: "62%", background: `linear-gradient(90deg, transparent, ${c})`, rotate: `${ang}deg` }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1.2, 0], opacity: [0, 0.9, 0] }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 + (i % 5) * 0.03 }}
            />
          );
        })}
        <motion.span
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: 120, height: 120, marginLeft: -60, marginTop: -60, background: "radial-gradient(circle, rgba(255,255,255,0.95), rgba(216,180,254,0.5) 40%, transparent 70%)" }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 2.4, 3.2], opacity: [0, 1, 0] }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </span>
    </>
  );
}
