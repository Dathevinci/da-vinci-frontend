"use client";

import type { FeaturedPalette } from "@/lib/novel/featured";

/**
 * The featured-novel aura — keyframes plus the layered effects, shared by the
 * Must Read spotlight and the novel detail page so the dress cannot drift
 * between surfaces. Every layer takes its colours from a FeaturedPalette, so
 * one novel burns violet and another sunset-amber from the same machinery.
 *
 * PURE CSS ON TRANSFORM/OPACITY ONLY: no canvas, no framer, no per-frame JS.
 * The aura is compositor work, not a render loop, and prefers-reduced-motion
 * stills every animation. Class names are prefixed `sps-` because the style
 * tag is global — styled-jsx is deliberately not used, since its template
 * literal silently terminates on a backtick in a comment, a trap this repo has
 * already paid for twice.
 */

const PURPLE: FeaturedPalette = {
  bright: "rgba(240,215,255,1)",
  mid: "rgba(168,85,247,1)",
  deep: "rgba(88,28,135,1)",
  rgb: "168,85,247",
};

/** rgba() from an "r,g,b" triple. */
const tint = (rgb: string, a: number) => `rgba(${rgb},${a})`;

export function PurpleAuraStyles() {
  return (
    <style>{`
      @keyframes sps-aura {
        0%, 100% { transform: scale(1); opacity: 0.55; }
        50% { transform: scale(1.12); opacity: 0.9; }
      }
      @keyframes sps-ring {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes sps-ember {
        0% { transform: translateY(0) scale(1); opacity: 0; }
        12% { opacity: 0.9; }
        100% { transform: translateY(-90px) scale(0.4); opacity: 0; }
      }
      @keyframes sps-flicker {
        0%, 86%, 92%, 100% { opacity: 0; }
        88%, 90% { opacity: 0.5; }
      }
      @keyframes sps-sheen {
        0%, 55%, 100% { transform: translateX(-130%) skewX(-18deg); }
        70%, 85% { transform: translateX(230%) skewX(-18deg); }
      }
      .sps-aura { animation: sps-aura 4.5s ease-in-out infinite; }
      .sps-aura2 { animation: sps-aura 6s ease-in-out infinite reverse; }
      .sps-ring { animation: sps-ring 9s linear infinite; }
      .sps-ember { animation: sps-ember 5s ease-out infinite; }
      .sps-flicker { animation: sps-flicker 7s linear infinite; }
      .sps-sheen { animation: sps-sheen 8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .sps-aura, .sps-aura2, .sps-ring, .sps-ember, .sps-flicker, .sps-sheen { animation: none; }
      }
    `}</style>
  );
}

/** The two breathing plumes that sit BEHIND the cover. */
export function AuraPlumes({ p = PURPLE }: { p?: FeaturedPalette }) {
  return (
    <>
      <div
        className="sps-aura pointer-events-none absolute -inset-8 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(closest-side, ${tint(p.rgb, 0.55)}, ${tint(p.rgb, 0.25)} 55%, transparent 75%)`,
        }}
      />
      <div
        className="sps-aura2 pointer-events-none absolute -inset-12 rounded-full blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${tint(p.rgb, 0.28)}, transparent 70%)` }}
      />
    </>
  );
}

/** The rotating conic neon rim; wrap around the cover frame. */
export function AuraRing({ p = PURPLE }: { p?: FeaturedPalette }) {
  return (
    <div className="pointer-events-none absolute -inset-[3px] overflow-hidden rounded-2xl">
      <div
        className="sps-ring absolute -inset-16"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${tint(p.rgb, 0.9)} 12%, transparent 28%, transparent 55%, ${tint(p.rgb, 0.8)} 68%, transparent 82%)`,
        }}
      />
    </div>
  );
}

/** Lightning wash + sheen; place INSIDE the cover's overflow-hidden frame. */
export function AuraOverlays({ p = PURPLE }: { p?: FeaturedPalette }) {
  return (
    <>
      <div
        className="sps-flicker pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          background: `linear-gradient(115deg, transparent 30%, ${tint(p.rgb, 0.55)} 48%, ${tint(p.rgb, 0.35)} 52%, transparent 70%)`,
        }}
      />
      <div className="sps-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent mix-blend-screen" />
    </>
  );
}

const EMBERS: Array<[string, string, string]> = [
  ["8%", "0s", "4px"],
  ["24%", "1.4s", "3px"],
  ["78%", "0.6s", "5px"],
  ["90%", "2.2s", "3px"],
  ["50%", "3.1s", "4px"],
];

/** Embers drifting up; position relative to the cover's wrapper. */
export function AuraEmbers({ p = PURPLE }: { p?: FeaturedPalette }) {
  return (
    <>
      {EMBERS.map(([left, delay, size], i) => (
        <span
          key={i}
          className="sps-ember pointer-events-none absolute bottom-2 rounded-full"
          style={{
            left,
            width: size,
            height: size,
            animationDelay: delay,
            background: p.bright,
            boxShadow: `0 0 8px ${tint(p.rgb, 0.9)}`,
          }}
        />
      ))}
    </>
  );
}

/** The cover frame's glow, composed from the palette. */
export function coverGlow(p: FeaturedPalette): string {
  return `0 0 0 1px ${tint(p.rgb, 0.45)}, 0 0 34px ${tint(p.rgb, 0.6)}, 0 0 90px ${p.deep.replace("1)", "0.4)")}, 0 30px 80px rgba(0,0,0,.8)`;
}

/** Gradient-text + glow treatment for the featured title. */
export function titleStyle(p: FeaturedPalette, font: string): React.CSSProperties {
  return {
    fontFamily: font,
    backgroundImage: `linear-gradient(to bottom, ${p.bright}, ${p.mid}, ${p.deep})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    filter: `drop-shadow(0 0 14px ${tint(p.rgb, 0.55)}) drop-shadow(0 0 42px ${p.deep.replace("1)", "0.35)")}) drop-shadow(0 2px 2px rgba(0,0,0,0.9))`,
  };
}
