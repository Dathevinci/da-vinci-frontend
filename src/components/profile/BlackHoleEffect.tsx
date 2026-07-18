"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Event Horizon" — the black hole / deep-space galaxy effect.
 *
 * The starfield canvas is a CHILD of the profile card (sized to and clipped by
 * it), so it scrolls locked to the profile like a Discord effect rather than
 * floating as a viewport overlay that lags behind while scrolling:
 *
 * - BlackHoleCardRealm (profile-level, card child): a canvas filling the card
 *   (mix-blend-mode: screen) draws the spiral galaxy CENTERED ON THE AVATAR'S
 *   LIVE CANVAS-LOCAL COORDINATES (getBoundingClientRect per frame, minus the
 *   canvas rect), scaled to the avatar radius. Star trails come from a
 *   destination-out fade instead of a hard clear. A doomed star spirals in,
 *   spaghettifies and redshifts.
 *
 * - BlackHoleEffect (avatar-level): registers the anchor and draws the parts
 *   that belong ON the avatar — the fiery accretion ring and the event-horizon
 *   shadow. No canvas here anymore, so dense pages stay cheap.
 *
 * Physics is dt-normalized (frame-rate independent), DPR capped, cleaned up on
 * unmount.
 */

const BH_ANCHORS = new Set<HTMLElement>();

// ── engine ───────────────────────────────────────────────────────────────────

type Star = { angle: number; distU: number; size: number; speed: number; color: string; alpha: number };

const STAR_COLORS = ["#ffffff", "#fbcfe8", "#e9d5ff", "#fca5a5", "#c4b5fd"];
const MAX_DIST_U = 6; // star field extent, in units of the event-horizon radius

function useBlackHoleCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the galaxy stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow,
    // images loading) so the galaxy always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // spiral-arm galaxy in avatar-radius units, so it scales with any avatar
    const arms = 4;
    const armSpread = 0.8;
    const stars: Star[] = [];
    for (let i = 0; i < 520; i++) {
      const distU = 1 + Math.random() * (MAX_DIST_U - 1);
      const armOffset = (Math.PI * 2 * (i % arms)) / arms;
      stars.push({
        angle: distU * 0.8 + armOffset + (Math.random() - 0.5) * armSpread,
        distU,
        size: Math.random() * 1.5 + 0.3,
        speed: (Math.random() * 0.3 + 0.12) * (5 / distU), // rad/s, faster near the core
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        alpha: Math.random() * 0.8 + 0.2,
      });
    }

    let doomed = {
      distU: MAX_DIST_U,
      angle: Math.random() * Math.PI * 2,
      size: 4,
      speed: 0.12, // rad/s
      fall: 0.75, // units/s
    };
    const resetDoomed = () => {
      doomed = {
        distU: MAX_DIST_U,
        angle: Math.random() * Math.PI * 2,
        size: Math.random() * 2 + 3,
        speed: 0.12 + Math.random() * 0.18,
        fall: 0.7 + Math.random() * 0.7,
      };
    };

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // fade the previous frame instead of clearing — soft star trails
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, 18 * dt)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // center the galaxy on the largest registered avatar, in canvas-LOCAL
      // coordinates. Subtracting the canvas's own rect converts the avatar's
      // viewport position into coordinates inside the card. Because both the
      // canvas and the avatar live in the same scrolling card, these stay
      // constant while scrolling — the galaxy is pixel-locked to the pfp.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      BH_ANCHORS.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > best) {
          best = rect.width;
          target = { x: rect.left - cRect.left + rect.width / 2, y: rect.top - cRect.top + rect.height / 2, r: rect.width / 2 };
        }
      });
      if (!target) {
        ctx.globalCompositeOperation = "source-over";
        raf = requestAnimationFrame(frame);
        return;
      }
      const { x: cx, y: cy, r } = target;
      const sizeScale = Math.max(0.8, r / 64);

      // ambient galactic glow behind everything
      const glow = ctx.createRadialGradient(cx, cy, r, cx, cy, r * MAX_DIST_U);
      glow.addColorStop(0, "rgba(168,85,247,0.10)");
      glow.addColorStop(0.4, "rgba(88,28,135,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r * MAX_DIST_U, cy - r * MAX_DIST_U, r * MAX_DIST_U * 2, r * MAX_DIST_U * 2);

      // spiral starfield
      for (const s of stars) {
        s.angle += s.speed * dt;
        s.distU -= 0.075 * dt; // slow universal infall
        if (s.distU <= 1) s.distU = MAX_DIST_U;
        const px = cx + Math.cos(s.angle) * s.distU * r;
        const py = cy + Math.sin(s.angle) * s.distU * r;
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        const proximity = Math.min(1, ((s.distU - 1) * r) / 20);
        ctx.globalAlpha = s.alpha * proximity;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, s.size * sizeScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // the doomed star — spirals in, stretches, redshifts, is consumed
      doomed.angle += doomed.speed * dt;
      doomed.distU -= doomed.fall * dt * 0.35;
      doomed.speed += 0.35 * dt;
      doomed.fall += 0.9 * dt;
      if (doomed.distU < 0.85) {
        resetDoomed();
      } else {
        const dx = cx + Math.cos(doomed.angle) * doomed.distU * r;
        const dy = cy + Math.sin(doomed.angle) * doomed.distU * r;
        const stretch = Math.max(1, 10 / (doomed.distU + 0.05));
        const redshift = Math.max(0, 1 - (doomed.distU - 1) / 2.5);
        const cr = Math.floor(255 - redshift * 100);
        const cg = Math.floor(255 - redshift * 255);
        const cb = Math.floor(255 - redshift * 150);
        const alpha = Math.max(0, 1 - redshift * 1.15);
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(doomed.angle + Math.PI / 2);
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, doomed.size * stretch * sizeScale, doomed.size * sizeScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = "source-over";
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

// ── Profile-level: the galaxy, anchored INSIDE the card ─────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function BlackHoleCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useBlackHoleCanvas(canvasRef);

  return (
    <>
      {/* the spiral galaxy — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. mix-blend-screen keeps
          the destination-out black star trails transparent over the card. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full mix-blend-screen"
      />

      {/* deep-space wash over the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 30% 40%, rgba(30,10,60,0.5), rgba(10,5,25,0.25) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.85] }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 100%, rgba(255,120,0,0.08), transparent 60%)" }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

// ── Avatar-level: the parts that live ON the avatar ─────────────────────────

export function BlackHoleEffect() {
  // Register so the galaxy centers on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    BH_ANCHORS.add(el);
    return () => {
      BH_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* gravitational lensing — a cheap static darkening ring */}
      <div
        className="pointer-events-none absolute -inset-[30%] rounded-full z-0"
        style={{
          background: "radial-gradient(circle, transparent 38%, rgba(0,0,0,0.55) 66%, transparent 100%)",
        }}
      />

      {/* the accretion disk (fiery orange & violet) */}
      <motion.div
        className="pointer-events-none absolute -inset-[25%] rounded-full z-[15] mix-blend-screen"
        style={{
          background: "radial-gradient(circle, transparent 40%, rgba(255, 120, 0, 0.4) 55%, rgba(138, 43, 226, 0.7) 65%, transparent 75%)",
          boxShadow: "inset 0 0 25px rgba(255, 80, 0, 0.6), 0 0 35px rgba(168, 85, 247, 0.8)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      {/* inner event-horizon shadow — the avatar looks engulfed */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full z-[20]"
        style={{
          boxShadow: "inset 0 0 20px 10px rgba(0,0,0,0.9)",
        }}
      />
    </>
  );
}
