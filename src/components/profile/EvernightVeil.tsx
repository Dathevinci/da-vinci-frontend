"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Evernight's Blessing" — the Evernight Goddess effect (Lord of the Mysteries,
 * Darkness pathway). Tranquil, concealed, watched over by the Crimson Moon.
 *
 * - EvernightCardNight (profile-level, portaled to <body> to escape every
 *   stacking context): a full-viewport canvas (`mix-blend-mode: screen`):
 *   · The Crimson Moon — a massive pre-rendered radial glow hanging in the
 *     upper sky, breathing slowly, washing the page in deep red-violet.
 *   · The River of Eternal Darkness — three overlapping sine-wave bands of
 *     twilight water undulating along the bottom, each with a glowing silver
 *     crest, flowing at different speeds and phases.
 *   · Night-Vanilla Flowers — delicate four-petaled silver blossoms (one
 *     pre-rendered sprite) drift down like snow on a gentle breeze — and are
 *     softly repelled into orbit when they near the avatar.
 *   · The Aura of Concealment — intertwined twilight-silver and crimson arc
 *     rings sweep and pulse around the avatar's LIVE coordinates
 *     (getBoundingClientRect per frame), like a divine halo.
 *
 * - EvernightAvatarAura (avatar-level): crimson/silver breathing halo, a slow
 *   conic moon-ring, and tiny silver satellites. Registers the avatar so the
 *   canvas rings + flower physics bind to it.
 *
 * Pure code — no images. dt-based physics, DPR capped, cleaned up on unmount.
 */

// Avatars register here; the night engine binds to the largest visible one.
const EVERNIGHT_ANCHORS = new Set<HTMLElement>();

// ── sprite builders ──────────────────────────────────────────────────────────

function makeMoonSprite(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const half = size / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,228,230,0.95)");
  grad.addColorStop(0.14, "rgba(253,164,175,0.9)");
  grad.addColorStop(0.28, "rgba(225,29,72,0.6)");
  grad.addColorStop(0.5, "rgba(159,18,57,0.28)");
  grad.addColorStop(1, "rgba(136,19,55,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeFlowerSprite(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const half = size / 2;
  g.translate(half, half);
  g.shadowColor = "rgba(226,232,240,0.9)";
  g.shadowBlur = size * 0.18;
  // four soft petals
  g.fillStyle = "rgba(248,250,252,0.92)";
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(0, -half * 0.42, half * 0.2, half * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.rotate(Math.PI / 2);
  }
  // slumbering golden heart
  g.shadowBlur = size * 0.1;
  g.fillStyle = "rgba(254,240,138,0.95)";
  g.beginPath();
  g.arc(0, 0, half * 0.14, 0, Math.PI * 2);
  g.fill();
  return c;
}

// ── engine ───────────────────────────────────────────────────────────────────

type Flower = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; phase: number };

const RIVER_BANDS = [
  { yAt: 0.8, amp: 12, amp2: 5, k: 1.9, k2: 4.3, speed: 0.5, speed2: 0.9, fill: "rgba(100,116,139,0.28)", crest: "rgba(226,232,240,0.4)" },
  { yAt: 0.86, amp: 15, amp2: 6, k: 1.4, k2: 3.1, speed: -0.35, speed2: 0.7, fill: "rgba(71,85,105,0.3)", crest: "rgba(203,213,225,0.32)" },
  { yAt: 0.92, amp: 10, amp2: 4, k: 2.3, k2: 5.1, speed: 0.65, speed2: -1.1, fill: "rgba(51,65,85,0.38)", crest: "rgba(226,232,240,0.25)" },
];

function useEvernightCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let skyGrad: CanvasGradient | null = null;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the tranquil night stays locked to the
      // profile (Discord-style) instead of covering the whole viewport.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      skyGrad.addColorStop(0, "rgba(76,5,25,0.30)");
      skyGrad.addColorStop(0.5, "rgba(49,20,66,0.16)");
      skyGrad.addColorStop(1, "rgba(30,27,75,0)");
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the night always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    const moon = makeMoonSprite(512);
    const flowerSprite = makeFlowerSprite(36);
    const flowers: Flower[] = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: 0,
      vy: 18 + Math.random() * 26,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.8,
      size: 12 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // ── deep red-violet night wash ──
      if (skyGrad) {
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H * 0.7);
      }

      // ── the Crimson Moon, breathing in the upper sky ──
      const moonD = Math.min(W, H) * 0.62;
      const pulse = 0.86 + 0.14 * Math.sin(t * 0.35);
      ctx.globalAlpha = pulse;
      ctx.drawImage(moon, W * 0.72 - moonD / 2, H * 0.16 - moonD / 2, moonD, moonD);
      ctx.globalAlpha = 1;

      // ── the avatar: Aura of Concealment target + flower physics ──
      // Subtract the canvas's own rect so the avatar's viewport position becomes
      // coordinates inside the card. Both the canvas and the avatar live in the
      // same scrolling card, so these stay constant while scrolling — the halo
      // and flower orbits are pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      EVERNIGHT_ANCHORS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          target = { x: r.left - cRect.left + r.width / 2, y: r.top - cRect.top + r.height / 2, r: r.width / 2 };
        }
      });

      // ── Night-Vanilla flowers: drifting snowfall, deflected around the avatar ──
      const wind = Math.sin(t * 0.4) * 12;
      for (const f of flowers) {
        // breeze + gentle personal sway
        let ax = wind + Math.sin(t * 0.8 + f.phase) * 8 - f.vx * 0.8;
        let ay = 0;
        if (target) {
          const { x: cx, y: cy, r } = target;
          const px = f.x * W;
          const py = f.y * H;
          const dx = px - cx;
          const dy = py - cy;
          const d = Math.hypot(dx, dy);
          const zone = r + 85;
          if (d < zone && d > 1) {
            // soft radial repulsion + tangential push → satellites, not collisions
            const s = 1 - d / zone;
            ax += (dx / d) * 320 * s - (dy / d) * 150 * s;
            ay += (dy / d) * 320 * s + (dx / d) * 150 * s - 60 * s;
          }
        }
        f.vx += ax * dt;
        f.vy += ay * dt;
        f.vy = Math.min(Math.max(f.vy, 10), 70); // always sinking, never rocketing
        f.vx = Math.min(Math.max(f.vx, -70), 70);
        f.x += (f.vx * dt) / W;
        f.y += (f.vy * dt) / H;
        f.rot += f.vr * dt;
        if (f.y > 1.04) {
          f.y = -0.05;
          f.x = Math.random();
          f.vx = 0;
          f.vy = 18 + Math.random() * 26;
        }
        if (f.x < -0.06) f.x = 1.05;
        if (f.x > 1.06) f.x = -0.05;
        const alpha = 0.5 + 0.4 * Math.sin(t * 0.9 + f.phase);
        ctx.save();
        ctx.translate(f.x * W, f.y * H);
        ctx.rotate(f.rot);
        ctx.globalAlpha = Math.max(0.2, alpha);
        ctx.drawImage(flowerSprite, -f.size / 2, -f.size / 2, f.size, f.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // ── the Aura of Concealment: intertwined silver + crimson sweeping arcs ──
      if (target) {
        const { x: cx, y: cy, r } = target;
        const R = r * 1.32 * (1 + 0.05 * Math.sin(t * 1.4));
        ctx.save();
        ctx.lineCap = "round";
        // twilight-silver ring (tilted ellipse, sweeping arc)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.55);
        ctx.scale(1, 0.36);
        ctx.strokeStyle = "rgba(226,232,240,0.55)";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "rgba(226,232,240,0.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, R, t * 1.1, t * 1.1 + Math.PI * 1.55);
        ctx.stroke();
        ctx.restore();
        // crimson ring, counter-rotating
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 0.42 + 1.2);
        ctx.scale(1, 0.5);
        ctx.strokeStyle = "rgba(244,63,94,0.5)";
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "rgba(244,63,94,0.9)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.12, -t * 0.9, -t * 0.9 + Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
        ctx.restore();
      }

      // ── the River of Eternal Darkness: undulating twilight bands + crests ──
      const STEP = 14;
      for (const b of RIVER_BANDS) {
        const baseY = H * b.yAt;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W + STEP; x += STEP) {
          const y =
            baseY +
            Math.sin((x / W) * Math.PI * b.k + t * b.speed * Math.PI) * b.amp +
            Math.sin((x / W) * Math.PI * b.k2 + t * b.speed2 * Math.PI) * b.amp2;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = b.fill;
        ctx.fill();
        // glowing silver crest along the wave top
        ctx.beginPath();
        for (let x = 0; x <= W + STEP; x += STEP) {
          const y =
            baseY +
            Math.sin((x / W) * Math.PI * b.k + t * b.speed * Math.PI) * b.amp +
            Math.sin((x / W) * Math.PI * b.k2 + t * b.speed2 * Math.PI) * b.amp2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = b.crest;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

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

// ── Profile-level: the tranquil night, anchored INSIDE the card ─────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function EvernightCardNight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEvernightCanvas(canvasRef);

  return (
    <>
      {/* the tranquil night — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. `screen` blend keeps the
          moon + river reading "through" the card surface. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* tranquil night wash over the card so the cosmos reads "through" it */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 72% 0%, rgba(76,5,25,0.5), rgba(30,27,75,0.22) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.85] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 100%, rgba(148,163,184,0.1), transparent 60%)" }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot: night falls when the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(80% 70% at 70% 20%, rgba(253,164,175,0.75), rgba(159,18,57,0.3) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0] }}
        transition={{ duration: 2, ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: concealed beneath Her night ────────────────────────────────

export function EvernightAvatarAura() {
  // Register so the canvas halo + flower physics bind to this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    EVERNIGHT_ANCHORS.add(el);
    return () => {
      EVERNIGHT_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* breathing crimson-night halo */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 14px 4px rgba(15,10,25,0.85), 0 0 26px 8px rgba(225,29,72,0.35)",
            "0 0 18px 6px rgba(15,10,25,0.9), 0 0 42px 13px rgba(244,63,94,0.55)",
            "0 0 14px 4px rgba(15,10,25,0.85), 0 0 30px 9px rgba(203,213,225,0.4)",
            "0 0 14px 4px rgba(15,10,25,0.85), 0 0 26px 8px rgba(225,29,72,0.35)",
          ],
        }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* slow-turning twilight ring — silver into crimson */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[5%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(226,232,240,0), rgba(226,232,240,0.65), rgba(226,232,240,0), rgba(244,63,94,0.55), rgba(226,232,240,0), rgba(159,18,57,0.5), rgba(226,232,240,0))",
          filter: "blur(2px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
          maskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
      />

      {/* tiny silver satellites — night-vanilla blossoms in orbit */}
      {[
        { dur: 10, delay: 0, size: 5 },
        { dur: 13.5, delay: 3.1, size: 4 },
        { dur: 17, delay: 6.4, size: 6 },
      ].map((m, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          animate={{ rotate: i % 2 === 0 ? -360 : 360 }}
          transition={{ duration: m.dur, repeat: Infinity, ease: "linear", delay: -m.delay }}
        >
          <motion.span
            className="absolute rounded-full"
            style={{
              left: "50%",
              top: "-5%",
              width: m.size,
              height: m.size,
              marginLeft: -m.size / 2,
              background: "radial-gradient(circle, #ffffff, #cbd5e1 60%, rgba(148,163,184,0.4))",
              boxShadow: "0 0 8px 2px rgba(226,232,240,0.8)",
            }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.2, 0.85] }}
            transition={{ duration: 2.6 + i * 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.span>
      ))}
    </>
  );
}
