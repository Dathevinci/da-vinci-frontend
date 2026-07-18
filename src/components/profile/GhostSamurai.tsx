"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "The Ghost Samurai" — extreme-rare katana / sakura-storm effect.
 *
 * Follows the same two-piece architecture as the other realm effects:
 *
 * - SamuraiCardRealm (profile-level, portaled to <body>): a full-viewport
 *   canvas draws a procedurally-built katana that hovers across the avatar
 *   (tracked live via getBoundingClientRect), and every 6 seconds performs a
 *   lightning-fast easeOutExpo iaijutsu slash around it — leaving a fading
 *   crimson crescent trail. A field of sakura petals (quadratic-curve petal
 *   shapes with a notched tip — never circles — sine sway, 3D-ish tumble)
 *   falls across the whole screen and gusts sideways whenever the blade cuts.
 *   The card itself gets a dark cinematic rgba(10,10,12,0.85) + blur backdrop.
 *
 * - SamuraiAvatarAura (avatar-level): the parts that live ON the avatar — a
 *   crimson-steel aura, drifting petal motes, and the anchor the katana tracks.
 *
 * No external assets — every shape is bezier/quadratic curves. Physics is
 * dt-normalized (frame-rate independent), DPR capped, cleaned up on unmount.
 */

const SAMURAI_ANCHORS = new Set<HTMLElement>();

// ── math helpers ─────────────────────────────────────────────────────────────

const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ── procedural drawing ───────────────────────────────────────────────────────

// Notched sakura petal — pure quadratic curves, never a circle.
function tracePetal(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s, -s * 0.3, s * 0.35, s * 0.55);
  ctx.quadraticCurveTo(s * 0.15, s * 0.92, 0, s * 0.55);
  ctx.quadraticCurveTo(-s * 0.15, s * 0.92, -s * 0.35, s * 0.55);
  ctx.quadraticCurveTo(-s, -s * 0.3, 0, -s);
  ctx.closePath();
}

// Curved katana: bezier blade with a jagged hamon, gold tsuba, wrapped tsuka.
// (x,y) is the visual center, ang the direction the tip points, L the length.
function drawKatana(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, L: number, glow: number) {
  const bladeL = L * 0.68;
  const handleL = L * 0.26;
  const sag = bladeL * 0.1; // sori — the upward curve of the spine
  const wB = Math.max(2.6, L * 0.024);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.translate(-(bladeL - handleL) / 2, 0); // origin at the tsuba, blade +x

  if (glow > 0) {
    ctx.shadowColor = `rgba(220,38,38,${(0.85 * glow).toFixed(3)})`;
    ctx.shadowBlur = 16 * glow;
  }

  // blade silhouette — spine curves up to the tip, edge sweeps back to base
  const steel = ctx.createLinearGradient(0, 0, bladeL, -sag);
  steel.addColorStop(0, "#cbd5e1");
  steel.addColorStop(0.55, "#e2e8f0");
  steel.addColorStop(0.9, "#f8fafc");
  steel.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.moveTo(0, -wB * 0.6);
  ctx.bezierCurveTo(bladeL * 0.4, -wB * 0.6 - sag * 0.1, bladeL * 0.72, -sag * 0.55 - wB * 0.4, bladeL, -sag);
  ctx.bezierCurveTo(bladeL * 0.8, -sag * 0.5 + wB * 0.6, bladeL * 0.4, wB * 0.85, 0, wB * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // hamon — the jagged temper line shadowing the cutting edge
  ctx.strokeStyle = "rgba(248,250,252,0.8)";
  ctx.lineWidth = Math.max(0.7, wB * 0.16);
  ctx.beginPath();
  const N = 15;
  for (let i = 0; i <= N; i++) {
    const fx = 0.03 + (i / N) * 0.85;
    const jag = (i % 2 === 0 ? -0.5 : 0.5) + Math.sin(i * 1.9) * 0.3;
    const hx = fx * bladeL;
    const hy = -sag * fx * fx + wB * (0.8 - fx * 0.55) + jag * wB * 0.24;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.stroke();

  // habaki — bronze collar at the blade base
  ctx.fillStyle = "#b45309";
  ctx.fillRect(0, -wB * 0.62, L * 0.028, wB * 1.55);

  // tsuba — the gold guard
  const gold = ctx.createLinearGradient(0, -wB * 2.5, 0, wB * 2.5);
  gold.addColorStop(0, "#fde68a");
  gold.addColorStop(0.5, "#d4af37");
  gold.addColorStop(1, "#92400e");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.ellipse(0, 0, L * 0.016, wB * 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,236,170,0.85)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // tsuka — dark wrapped handle with a gold diamond cross-wrap + kashira cap
  const hw = wB * 0.82;
  ctx.fillStyle = "#12100e";
  ctx.beginPath();
  ctx.moveTo(-L * 0.016, -hw);
  ctx.lineTo(-handleL + 3, -hw);
  ctx.quadraticCurveTo(-handleL, -hw, -handleL, 0);
  ctx.quadraticCurveTo(-handleL, hw, -handleL + 3, hw);
  ctx.lineTo(-L * 0.016, hw);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(212,175,55,0.85)";
  ctx.lineWidth = Math.max(0.7, wB * 0.14);
  const wraps = 6;
  const step = (handleL - L * 0.016) / wraps;
  for (let i = 0; i < wraps; i++) {
    const x0 = -L * 0.016 - i * step;
    ctx.beginPath();
    ctx.moveTo(x0, -hw);
    ctx.lineTo(x0 - step, hw);
    ctx.moveTo(x0, hw);
    ctx.lineTo(x0 - step, -hw);
    ctx.stroke();
  }
  ctx.fillStyle = "#d4af37";
  ctx.beginPath();
  ctx.ellipse(-handleL, 0, L * 0.012, hw, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── engine ───────────────────────────────────────────────────────────────────

type Petal = {
  x: number;
  y: number;
  size: number;
  rot: number;
  rotSpeed: number;
  fall: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  tumbleFreq: number;
  gustBias: number;
  color: string;
  alpha: number;
};
type TrailPoint = { ang: number; born: number };

const PETAL_COLORS = ["#fecdd3", "#fda4af", "#fb7185", "#f9a8d4", "#dc2626"];

const SLASH_PERIOD = 6; // s between slashes
const SLASH_DUR = 0.55; // the cut itself — fast
const SETTLE_DUR = 0.9; // easing back to the idle hover
const TRAIL_LIFE = 0.75; // how long the crimson crescent lingers

function useSamuraiCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const petals: Petal[] = [];

    const spawnPetal = (anywhere: boolean): Petal => ({
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -24,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3,
      fall: 42 + Math.random() * 55,
      swayAmp: 18 + Math.random() * 40,
      swayFreq: 0.5 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      tumbleFreq: 0.6 + Math.random() * 1.2,
      gustBias: 0.5 + Math.random() * 0.8,
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      alpha: 0.55 + Math.random() * 0.35,
    });

    const targetCount = () => Math.round(Math.min(90, Math.max(40, (W * H) / 22000)));

    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the ghost samurai stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      while (petals.length < targetCount()) petals.push(spawnPetal(true));
      if (petals.length > targetCount()) petals.length = targetCount();
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the effect always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // slash state
    let nextSlash = 1.1; // first draw shortly after the profile opens
    let slashAge = Infinity; // time since the current slash began
    let slashA0 = 0;
    let slashSweep = 0;
    let slashDir = 1;
    let slashIndex = 0;
    let prevArcAng: number | null = null;
    let gustVX = 0;
    const trail: TrailPoint[] = [];

    let raf = 0;
    let last = performance.now();
    let t = 0; // scene clock (s)

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      ctx.clearRect(0, 0, W, H);

      // center everything on the largest registered avatar, in canvas-LOCAL
      // coordinates. Subtracting the canvas's own rect converts the avatar's
      // viewport position into coordinates inside the card. Because both the
      // canvas and the avatar live in the same scrolling card, these stay
      // constant while scrolling — so the katana is pixel-locked to the pfp.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      SAMURAI_ANCHORS.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > best) {
          best = rect.width;
          target = { x: rect.left - cRect.left + rect.width / 2, y: rect.top - cRect.top + rect.height / 2, r: rect.width / 2 };
        }
      });

      // slash timing
      slashAge += dt;
      nextSlash -= dt;
      if (nextSlash <= 0) {
        if (target) {
          slashIndex++;
          slashDir = slashIndex % 2 === 0 ? 1 : -1;
          slashA0 = (slashDir === 1 ? -Math.PI * 1.15 : Math.PI * 0.15) + (Math.random() - 0.5) * 0.5;
          slashSweep = slashDir * Math.PI * 1.55;
          slashAge = 0;
          prevArcAng = null;
          trail.length = 0;
          gustVX = slashDir * (520 + Math.random() * 280); // the wind of the cut
          nextSlash = SLASH_PERIOD;
        } else {
          nextSlash = 0.5; // avatar off-screen — try again shortly
        }
      }
      gustVX *= Math.pow(0.18, dt);

      // sakura petals — full-screen, always falling
      for (const p of petals) {
        const gust = gustVX * p.gustBias;
        p.rot += p.rotSpeed * (1 + Math.abs(gust) / 260) * dt;
        p.x += (Math.sin(t * p.swayFreq + p.phase) * p.swayAmp + gust) * dt;
        p.y += (p.fall - Math.abs(gust) * 0.16) * dt;
        if (p.y > H + 24) {
          p.y = -24;
          p.x = Math.random() * W;
        }
        if (p.x > W + 40) p.x = -40;
        if (p.x < -40) p.x = W + 40;

        // fold on a varied sine — reads as a petal tumbling in 3D
        const fold = 0.4 + 0.6 * Math.abs(Math.sin(t * p.tumbleFreq + p.phase));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(fold, 1);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        tracePetal(ctx, p.size);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (!target) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const { x: cx, y: cy, r } = target;
      const R = Math.max(40, r);
      const L = R * 2.7;
      const arcRad = R * 1.5;

      // katana pose — idle hover, or flying along the slash arc
      const idle = {
        x: cx - R * 0.1 + Math.sin(t * 0.9) * R * 0.05,
        y: cy + R * 0.42 + Math.sin(t * 1.15) * R * 0.07,
        ang: -0.62 + Math.sin(t * 0.7) * 0.05,
      };
      let pose = idle;
      let glow = 0.18 + Math.sin(t * 2) * 0.08;

      if (slashAge < SLASH_DUR) {
        const p = easeOutExpo(slashAge / SLASH_DUR);
        const ang = slashA0 + slashSweep * p;
        // subsample so the (very fast) early sweep leaves a continuous trail
        if (prevArcAng !== null) {
          const steps = Math.min(48, Math.max(1, Math.ceil(Math.abs(ang - prevArcAng) / 0.06)));
          for (let i = 1; i <= steps; i++) {
            trail.push({ ang: prevArcAng + ((ang - prevArcAng) * i) / steps, born: t - dt * (1 - i / steps) });
          }
        } else {
          trail.push({ ang, born: t });
        }
        prevArcAng = ang;
        pose = {
          x: cx + Math.cos(ang) * arcRad,
          y: cy + Math.sin(ang) * arcRad,
          ang: ang + (slashDir > 0 ? Math.PI / 2 : -Math.PI / 2),
        };
        glow = 1;
      } else if (slashAge < SLASH_DUR + SETTLE_DUR) {
        // settle back to the hover without a jolt
        const q = easeInOutCubic((slashAge - SLASH_DUR) / SETTLE_DUR);
        const endAng = slashA0 + slashSweep;
        const end = {
          x: cx + Math.cos(endAng) * arcRad,
          y: cy + Math.sin(endAng) * arcRad,
          ang: endAng + (slashDir > 0 ? Math.PI / 2 : -Math.PI / 2),
        };
        pose = { x: lerp(end.x, idle.x, q), y: lerp(end.y, idle.y, q), ang: lerpAngle(end.ang, idle.ang, q) };
        glow = 1 - q * 0.8;
      }

      // the fading crimson crescent — wide glow, hot mid, white core
      for (let i = trail.length - 1; i >= 0; i--) {
        if (t - trail[i].born > TRAIL_LIFE) trail.splice(i, 1);
      }
      ctx.globalCompositeOperation = "lighter";
      if (trail.length > 1) {
        ctx.lineCap = "round";
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 1; i < trail.length; i++) {
            const a = Math.pow(1 - (t - trail[i].born) / TRAIL_LIFE, 2);
            if (a <= 0.01) continue;
            const p0 = trail[i - 1];
            const p1 = trail[i];
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(p0.ang) * arcRad, cy + Math.sin(p0.ang) * arcRad);
            ctx.lineTo(cx + Math.cos(p1.ang) * arcRad, cy + Math.sin(p1.ang) * arcRad);
            if (pass === 0) {
              ctx.strokeStyle = `rgba(220,38,38,${(a * 0.4).toFixed(3)})`;
              ctx.lineWidth = (10 * a + 3) * (R / 64);
            } else if (pass === 1) {
              ctx.strokeStyle = `rgba(248,113,113,${(a * 0.7).toFixed(3)})`;
              ctx.lineWidth = (4.5 * a + 1.2) * (R / 64);
            } else {
              ctx.strokeStyle = `rgba(255,241,242,${(a * 0.9).toFixed(3)})`;
              ctx.lineWidth = (1.6 * a + 0.4) * (R / 64);
            }
            ctx.stroke();
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      drawKatana(ctx, pose.x, pose.y, pose.ang, L, glow);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, [canvasRef]);
}

// ── Profile-level: the realm, anchored INSIDE the card ───────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function SamuraiCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useSamuraiCanvas(canvasRef);

  return (
    <>
      {/* the katana + sakura storm — sized to and clipped by the card, so it
          scrolls locked to the profile like a Discord effect. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
      />

      {/* cinematic obsidian backdrop over the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "rgba(10,10,12,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      {/* breathing crimson battlefield glow */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 30%, rgba(127,29,29,0.28), transparent 60%)" }}
        animate={{ opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* one-shot iaijutsu flash the moment the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[7]"
        style={{
          background: "linear-gradient(115deg, transparent 42%, rgba(254,226,226,0.55) 50%, transparent 58%)",
          backgroundSize: "250% 100%",
        }}
        initial={{ backgroundPosition: "130% 0%", opacity: 0 }}
        animate={{ backgroundPosition: ["130% 0%", "-130% 0%"], opacity: [0, 1, 0] }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
      />
    </>
  );
}

// ── Avatar-level: the parts that live ON the avatar ─────────────────────────

export function SamuraiAvatarAura() {
  // Register so the katana and its slash center on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    SAMURAI_ANCHORS.add(el);
    return () => {
      SAMURAI_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* crimson-steel aura */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 10px 2px rgba(220,38,38,0.45)",
            "0 0 24px 7px rgba(226,232,240,0.5)",
            "0 0 14px 3px rgba(220,38,38,0.55)",
            "0 0 10px 2px rgba(220,38,38,0.45)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* drifting petal motes around the avatar */}
      <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
        {[8, 30, 55, 76, 90, 42].map((left, i) => (
          <motion.span
            key={i}
            className="absolute"
            style={{
              left: `${left}%`,
              width: 5,
              height: 4,
              borderRadius: "70% 30% 65% 35%",
              background: i % 3 === 2 ? "#dc2626" : "#fda4af",
              boxShadow: "0 0 4px rgba(251,113,133,0.8)",
            }}
            initial={{ top: "-12%", opacity: 0, rotate: 0 }}
            animate={{ top: ["-12%", "112%"], opacity: [0, 1, 1, 0], x: [0, 4, -4, 0], rotate: 220 }}
            transition={{ duration: 3 + (i % 3) * 0.8, repeat: Infinity, delay: i * 0.45, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}
