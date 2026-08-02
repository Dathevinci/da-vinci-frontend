"use client";

import { useEffect, useMemo, useState } from "react";
import { arenaEffect } from "@/data/arenaEffects";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARENA BACKDROPS — the board dressing for a duel.
 *
 * TWO LAYERS, and the split matters:
 *   <ArenaBackdrop />  sits BELOW the cards — ambience, weather, ground light.
 *   <ArenaOverlay />   sits ABOVE the cards — grading, vignette, flashes.
 * Noir has to drain the colour out of the CARDS, not just the floor, so it
 * needs a layer over them; the ambient effects would bury the board if they
 * were up there. Hence both.
 *
 * PERFORMANCE. This paints underneath an already-animated duel board, so:
 *   - every animation is a CSS keyframe on transform or opacity only, which
 *     the compositor runs without touching React or the JS thread
 *   - particles are tiled gradients translated by a whole number of tiles,
 *     which loops seamlessly without a particle system
 *   - nothing here uses backdrop-filter, which would re-blur the whole board
 *     every time a card moved above it
 *   - Reduced Motion drops every animation and keeps the still image
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Keyframes can't live in inline styles, so they come in as one static block.
//
// EVERY vertical loop travels 240px, and every tile height below divides it.
// That is the whole trick: land the loop on an exact tile boundary and the
// restart is invisible. Change one number and you have to change the other.
const TRAVEL = 240;

const KEYFRAMES = `
@keyframes av-fall     { from { transform: translate3d(0,0,0); } to { transform: translate3d(0,${TRAVEL}px,0); } }
@keyframes av-rise     { from { transform: translate3d(0,0,0); } to { transform: translate3d(0,-${TRAVEL}px,0); } }
@keyframes av-breathe  { 0%,100% { opacity:.45; transform: scale3d(1,1,1); } 50% { opacity:1; transform: scale3d(1.08,1.14,1); } }
@keyframes av-sweep    { 0% { transform: translate3d(-40%,0,0); } 100% { transform: translate3d(140%,0,0); } }
/* Long dark gaps with a double-tap strike - a storm you notice, not a strobe. */
@keyframes av-strike   { 0%,86%,100% { opacity:0 } 87% { opacity:.85 } 89% { opacity:.1 } 91% { opacity:.6 } 94% { opacity:0 } }
@keyframes av-shimmer  { 0%,100% { opacity:.35 } 50% { opacity:.7 } }
@media (prefers-reduced-motion: reduce) {
  .av-layer { animation: none !important; }
}
`;

function Keyframes() {
  return <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />;
}

/**
 * A tiled particle field.
 *
 * TWO offset grids, not one - a single repeating dot reads as graph paper the
 * moment you look at it. Both tile heights (120 and 80) divide TRAVEL.
 */
function particles(color: string, size: number, gap: number) {
  const dot = (c: string, r: number) =>
    `radial-gradient(circle at 50% 50%, ${c} 0, ${c} ${r}px, transparent ${r + 0.6}px)`;
  return {
    backgroundImage: `${dot(color, size)}, ${dot(color, size * 0.65)}`,
    backgroundSize: `${gap}px 120px, ${Math.round(gap * 0.61)}px 80px`,
    backgroundPosition: `0 0, ${Math.round(gap * 0.37)}px 23px`,
  } as const;
}

/** Elongated droplets - rain, on the same exact-tile rule as particles(). */
function streaks(color: string, w: number, h: number, gap: number) {
  return {
    backgroundImage: `radial-gradient(ellipse ${w}px ${h}px at 50% 50%, ${color} 0, ${color} 55%, transparent 100%)`,
    backgroundSize: `${gap}px 120px`,
  } as const;
}

// Moving layers are oversized well past TRAVEL on the axis they move along,
// or the loop would drag a bare edge into view before it restarted.
const TALL = "absolute -inset-x-10 -inset-y-64";     // 256px > TRAVEL
const TILTED = "absolute -inset-[320px]";            // clears TRAVEL + rotation

type LayerProps = { effectId?: string | null; className?: string };

/* ── UNDER THE BOARD ─────────────────────────────────────────────────────── */

export function ArenaBackdrop({ effectId, className = "" }: LayerProps) {
  const fx = arenaEffect(effectId);
  const { preferences } = usePreferences();
  const still = preferences.reducedMotion;
  if (!fx) return null;

  const k = fx.intensity;            // 0-1, straight from the grade
  const anim = (a: string) => (still ? undefined : a);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ contain: "strict" }}
    >
      <Keyframes />

      {/* Base wash - every effect gets one, tinted to its own hue. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 100%, hsla(${fx.hue},70%,45%,${0.22 * k}) 0%, transparent 70%)`,
        }}
      />

      {fx.id === "arena_noir" && (
        <>
          {/* One hard key light raking across an otherwise empty floor. */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#000 0%,#08080a 55%,#000 100%)", opacity: 0.92 * k }} />
          <div
            className="av-layer absolute inset-y-0 w-1/3"
            style={{
              background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.09),transparent)",
              animation: anim("av-sweep 14s ease-in-out infinite alternate"),
              willChange: "transform",
            }}
          />
        </>
      )}

      {fx.id === "arena_voidrift" && (
        <>
          {/* The tear itself, breathing under the board. */}
          <div
            className="av-layer absolute bottom-[-14%] left-1/2 h-[46%] w-[78%] -translate-x-1/2 rounded-[50%]"
            style={{
              background: "radial-gradient(closest-side, rgba(196,132,252,0.55), rgba(88,28,135,0.35) 55%, transparent 78%)",
              opacity: k,
              animation: anim("av-breathe 7s ease-in-out infinite"),
              willChange: "transform, opacity",
            }}
          />
          <div
            className={`av-layer ${TALL}`}
            style={{
              ...particles("rgba(216,180,254,0.5)", 1.2, 78),
              opacity: 0.6 * k,
              animation: anim("av-rise 11s linear infinite"),
              willChange: "transform",
            }}
          />
        </>
      )}

      {fx.id === "arena_stormfront" && (
        <>
          {/* Rain falls straight down and the WRAPPER is tilted. A gradient
              angled in place would repeat along its own axis rather than
              along Y, so the loop would no longer land on a tile boundary
              and the whole sheet would visibly jump every restart. */}
          <div className={TILTED} style={{ transform: "rotate(11deg)" }}>
            <div
              className="av-layer absolute inset-0"
              style={{
                ...streaks("rgba(191,219,254,0.55)", 1.1, 11, 34),
                opacity: 0.55 * k,
                animation: anim("av-fall 0.85s linear infinite"),
                willChange: "transform",
              }}
            />
            {/* A second, slower and fainter sheet gives the rain depth. */}
            <div
              className="av-layer absolute inset-0"
              style={{
                ...streaks("rgba(148,190,240,0.32)", 0.9, 16, 57),
                opacity: 0.5 * k,
                animation: anim("av-fall 1.5s linear infinite"),
                willChange: "transform",
              }}
            />
          </div>
          {/* Wet floor shine. */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{ background: "linear-gradient(0deg, rgba(56,189,248,0.16), transparent)", opacity: k }}
          />
        </>
      )}

      {fx.id === "arena_emberfall" && (
        <>
          <div
            className="absolute inset-x-0 bottom-0 h-2/5"
            style={{ background: "linear-gradient(0deg, rgba(234,88,12,0.34), transparent)", opacity: k }}
          />
          <div
            className={`av-layer ${TALL}`}
            style={{
              ...particles("rgba(253,186,116,0.55)", 1.4, 92),
              opacity: 0.75 * k,
              animation: anim("av-rise 9s linear infinite"),
              willChange: "transform",
            }}
          />
          {/* Ash goes the other way, slower - the two directions sell it. */}
          <div
            className={`av-layer ${TALL}`}
            style={{
              ...particles("rgba(148,163,184,0.32)", 1, 64),
              opacity: 0.6 * k,
              animation: anim("av-fall 17s linear infinite"),
              willChange: "transform",
            }}
          />
        </>
      )}

      {fx.id === "arena_tidewash" && (
        // Same tilted-wrapper trick as the rain, for the same reason: the
        // caustic bands repeat every 120px straight down, and TRAVEL is
        // exactly two of them.
        <div className={TILTED} style={{ transform: "rotate(-14deg)" }}>
          <div
            className="av-layer absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent 0 62px, rgba(103,232,249,0.16) 78px, transparent 96px 120px)",
              opacity: k,
              animation: anim("av-fall 13s linear infinite"),
              willChange: "transform",
            }}
          />
        </div>
      )}

      {fx.id === "arena_goldenhour" && (
        <>
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(102deg, rgba(251,191,36,0.26), transparent 62%)", opacity: k }}
          />
          <div
            className={`av-layer ${TALL}`}
            style={{
              ...particles("rgba(254,240,138,0.45)", 1, 88),
              opacity: 0.55 * k,
              animation: anim("av-rise 21s linear infinite"),
              willChange: "transform",
            }}
          />
        </>
      )}
    </div>
  );
}

/* ── OVER THE BOARD ──────────────────────────────────────────────────────── */

/**
 * `flashKey` is any value that changes when a blow lands. Noir promises the
 * strikes bring the colour back, so a change here briefly lifts the grading.
 */
export function ArenaOverlay({ effectId, flashKey, className = "" }: LayerProps & { flashKey?: number }) {
  const fx = arenaEffect(effectId);
  const { preferences } = usePreferences();
  const still = preferences.reducedMotion;
  const [lit, setLit] = useState(false);

  // Skips the mount pass so the board doesn't flash the instant it opens.
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready || flashKey === undefined) return;
    setLit(true);
    const t = setTimeout(() => setLit(false), 420);
    return () => clearTimeout(t);
  }, [flashKey, ready]);

  const k = fx?.intensity ?? 0;
  // How grey Noir holds the board - eased off while a hit is still ringing.
  const drain = useMemo(() => (lit ? 0.25 * k : k), [lit, k]);

  if (!fx) return null;
  const anim = (a: string) => (still ? undefined : a);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <Keyframes />

      {fx.id === "arena_noir" && (
        <>
          {/* THE effect. `saturation` blending against solid black keeps every
              card's brightness and shape and takes only its colour. A
              filter:grayscale() would cost a repaint to do the same, and it
              would also trap any fixed-position child of the board. */}
          <div
            className="absolute inset-0"
            style={{
              background: "#000",
              mixBlendMode: "saturation",
              opacity: drain,
              transition: "opacity 380ms ease-out",
            }}
          />
          {/* Hard falloff into black at the edges - the arena stops existing. */}
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(110% 78% at 50% 50%, transparent 42%, rgba(0,0,0,0.86) 100%)", opacity: k }}
          />
        </>
      )}

      {fx.id === "arena_voidrift" && (
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 80% at 50% 60%, transparent 45%, rgba(30,10,60,0.72) 100%)", opacity: 0.9 * k }}
        />
      )}

      {fx.id === "arena_stormfront" && (
        <>
          <div
            className="av-layer absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(219,234,254,0.9), rgba(147,197,253,0.25) 40%, transparent)",
              opacity: 0,
              animation: anim("av-strike 9s ease-out infinite"),
              willChange: "opacity",
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 50%, rgba(2,6,23,0.6) 100%)", opacity: k }}
          />
        </>
      )}

      {fx.id === "arena_emberfall" && (
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 85% at 50% 100%, rgba(251,146,60,0.14) 0%, transparent 45%, rgba(12,6,3,0.62) 100%)", opacity: k }}
        />
      )}

      {fx.id === "arena_tidewash" && (
        <div
          className="av-layer absolute inset-0"
          style={{
            background: "radial-gradient(120% 85% at 50% 30%, transparent 45%, rgba(8,47,73,0.7) 100%)",
            opacity: k,
            animation: anim("av-shimmer 6s ease-in-out infinite"),
          }}
        />
      )}

      {fx.id === "arena_goldenhour" && (
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 85% at 18% 20%, rgba(255,214,120,0.16) 0%, transparent 50%, rgba(28,18,4,0.5) 100%)", opacity: k }}
        />
      )}
    </div>
  );
}

/**
 * A small self-contained board used by the shop to show an effect running,
 * so nobody spends 14,000 AP on a paragraph.
 */
export function ArenaPreview({ effectId, className = "" }: LayerProps) {
  return (
    <div
      // No rounding or border here on purpose: callers set their own, and a
      // base `rounded-2xl` would fight a caller's `rounded-lg` on a coin-toss
      // (Tailwind resolves conflicts by stylesheet order, not class order).
      className={`relative overflow-hidden bg-[#0b0b12] ${className}`}
      // The saturation blend must not reach past the preview into the page.
      style={{ isolation: "isolate" }}
    >
      <ArenaBackdrop effectId={effectId} />
      {/* Two mock fighters, coloured so a drain to grey is obvious. Sized in
          percentages so the same component works as a 40px thumbnail beside a
          checkbox and as a full-width card on the shop grid. */}
      <div className="relative z-10 flex h-full w-full items-center justify-center gap-[7%]">
        {[
          "linear-gradient(160deg,#38bdf8,#1d4ed8)",
          "linear-gradient(160deg,#fb7185,#be123c)",
        ].map((g, i) => (
          <div key={i} className="flex w-[19%] flex-col items-center gap-[8%]">
            <div className="w-full rounded-[12%] border border-white/20 shadow-lg" style={{ background: g, aspectRatio: "3 / 4" }} />
            <div className="h-[3px] w-full rounded-full" style={{ background: i === 0 ? "#22d3ee" : "#fb7185" }} />
          </div>
        ))}
      </div>
      <ArenaOverlay effectId={effectId} />
    </div>
  );
}
