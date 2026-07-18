"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Heart of the Forest" — a lush, overgrown magical forest (unique tier).
 * Deep emeralds, vibrant limes, woody browns, soft golden sunlight.
 *
 * - CanopyCardForest (profile-level, portaled to <body>, mix-blend NORMAL so
 *   the woodland shade can genuinely tint the page):
 *   · Volumetric God Rays — 4 diagonal beams of golden light, pre-rendered
 *     ONCE to an offscreen canvas with a real blur (so the per-frame cost is a
 *     single drawImage), shimmering slowly like dusty sunlight.
 *   · The Falling Canopy — ~110 procedurally drawn leaves (pointed tip,
 *     quadratic-curve lobes, centre vein — no circles, no images) in three
 *     palettes, each with its own fall speed, rotation, and sine flutter.
 *     Periodic WIND GUSTS sweep every leaf sideways on a smooth envelope.
 *     Leaves nearing the avatar swirl around its rim instead of falling
 *     through it.
 *   · The Overgrown Avatar — knotted wooden branches and green vines drawn as
 *     organic béziers hugging the avatar's rim (live rect), with tiny glowing
 *     teal/white woodland flowers pulsing at the branch tips.
 *   · Floating Spores — golden-green pollen motes drift UP from the bottom,
 *     against the falling leaves.
 *
 * - CanopyAvatarVines (avatar-level): emerald aura + leafy ring + teal blooms
 *   for small surfaces/shop preview, plus the rim anchor registration.
 *
 * Pure code, dt-based physics, DPR capped, off-screen recycling, cleanup on
 * unmount.
 */

const CANOPY_ANCHORS = new Set<HTMLElement>();

// ── engine ───────────────────────────────────────────────────────────────────

type Vec = { x: number; y: number; r: number };
type Leaf = { x: number; y: number; vy: number; vx: number; rot: number; vr: number; sway: number; phase: number; size: number; sprite: number };
type Spore = { x: number; y: number; vy: number; phase: number; size: number; gold: boolean };
type Branch = { a0: number; span: number; wob1: number; wob2: number; w: number; green: boolean; phase: number };

const LEAF_PALETTES = [
  ["#34d399", "#065f46"], // emerald
  ["#a3e635", "#3f6212"], // lime
  ["#d4a24c", "#7c4a12"], // autumn gold-brown
];

function makeLeafSprite(light: string, dark: string, size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const m = size / 2;
  const grad = g.createLinearGradient(0, 2, 0, size - 2);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  // leaf body: pointed tip, two quadratic lobes, rounded base
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(m, 2);
  g.quadraticCurveTo(size - 3, m * 0.85, m, size - 4);
  g.quadraticCurveTo(3, m * 0.85, m, 2);
  g.closePath();
  g.fill();
  // centre vein
  g.strokeStyle = dark;
  g.globalAlpha = 0.55;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(m, 3);
  g.lineTo(m, size - 4);
  g.stroke();
  // stem
  g.beginPath();
  g.moveTo(m, size - 4);
  g.lineTo(m - 2, size - 1);
  g.stroke();
  g.globalAlpha = 1;
  return c;
}

// God rays pre-rendered once (real blur, zero per-frame filter cost).
function makeGodRays(W: number, H: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, W);
  c.height = Math.max(1, H);
  const g = c.getContext("2d")!;
  g.filter = "blur(20px)";
  const rays = [
    { x: W * 0.08, w: W * 0.09, lean: W * 0.3 },
    { x: W * 0.26, w: W * 0.14, lean: W * 0.34 },
    { x: W * 0.52, w: W * 0.07, lean: W * 0.28 },
    { x: W * 0.72, w: W * 0.12, lean: W * 0.36 },
  ];
  for (const r of rays) {
    const grad = g.createLinearGradient(r.x, 0, r.x + r.lean, H);
    grad.addColorStop(0, "rgba(255,235,180,0.16)");
    grad.addColorStop(0.55, "rgba(255,225,160,0.07)");
    grad.addColorStop(1, "rgba(255,235,180,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(r.x, -40);
    g.lineTo(r.x + r.w, -40);
    g.lineTo(r.x + r.w + r.lean, H + 40);
    g.lineTo(r.x + r.lean - r.w * 0.4, H + 40);
    g.closePath();
    g.fill();
  }
  g.filter = "none";
  return c;
}

function useCanopyCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let rays: HTMLCanvasElement | null = null;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the whole forest stays locked to the
      // profile (Discord-style) instead of floating over the viewport.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      rays = makeGodRays(W, H);
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking so the forest always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // leaf sprites: 3 palettes × pre-rendered once
    const sprites = LEAF_PALETTES.map(([l, d]) => makeLeafSprite(l, d, 30));
    const leaves: Leaf[] = Array.from({ length: 110 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vy: 40 + Math.random() * 50,
      vx: 0,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 3,
      sway: 14 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
      size: 14 + Math.random() * 14,
      sprite: Math.floor(Math.random() * 3),
    }));

    const spores: Spore[] = Array.from({ length: 30 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vy: 10 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
      size: 1.4 + Math.random() * 1.6,
      gold: Math.random() < 0.5,
    }));

    // knotted branches + vines around the avatar rim, generated once
    const branches: Branch[] = [];
    for (let i = 0; i < 9; i++) {
      branches.push({
        a0: Math.random() * Math.PI * 2,
        span: 0.5 + Math.random() * 0.65,
        wob1: (Math.random() - 0.4) * 0.16,
        wob2: (Math.random() - 0.4) * 0.16,
        w: 0.05 + Math.random() * 0.03,
        green: false,
        phase: Math.random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 12; i++) {
      branches.push({
        a0: Math.random() * Math.PI * 2,
        span: 0.7 + Math.random() * 0.9,
        wob1: (Math.random() - 0.35) * 0.22,
        wob2: (Math.random() - 0.35) * 0.22,
        w: 0.018 + Math.random() * 0.014,
        green: true,
        phase: Math.random() * Math.PI * 2,
      });
    }
    const flowers = Array.from({ length: 8 }, () => ({
      ang: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      teal: Math.random() < 0.6,
    }));

    // wind gusts
    let wind = 0;
    let gustT = 0;
    let gustDur = 0;
    let gustAmp = 0;
    let nextGust = performance.now() + 4000 + Math.random() * 5000;

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // deep woodland shade at the edges (normal blend can darken)
      const vign = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
      vign.addColorStop(0, "rgba(8,24,14,0.1)");
      vign.addColorStop(1, "rgba(5,18,10,0.5)");
      ctx.fillStyle = vign;
      ctx.fillRect(0, 0, W, H);

      // god rays — pre-blurred, shimmering like dusty light
      if (rays) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.4);
        ctx.drawImage(rays, Math.sin(t * 0.12) * 14, 0);
        ctx.globalAlpha = 1;
      }

      // ── wind gusts ──
      if (now >= nextGust && gustDur === 0) {
        gustDur = 1.5 + Math.random();
        gustT = 0;
        gustAmp = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 60);
      }
      if (gustDur > 0) {
        gustT += dt;
        wind = gustAmp * Math.sin(Math.PI * Math.min(1, gustT / gustDur));
        if (gustT >= gustDur) {
          gustDur = 0;
          wind = 0;
          nextGust = now + 5000 + Math.random() * 6000;
        }
      }

      // ── the vessel, in canvas-LOCAL coordinates ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Both the canvas and the
      // avatar live in the same scrolling card, so these stay constant while
      // scrolling — the vines are pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: Vec | null = null;
      let best = 0;
      CANOPY_ANCHORS.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > best) {
          best = rect.width;
          target = { x: rect.left - cRect.left + rect.width / 2, y: rect.top - cRect.top + rect.height / 2, r: rect.width / 2 };
        }
      });
      const grove = target as Vec | null;

      // ── floating spores (upward, against the leaves) ──
      for (const s of spores) {
        s.y -= (s.vy * dt) / H;
        s.x += (Math.sin(t * 0.7 + s.phase) * 8 * dt) / W;
        if (s.y < -0.04) {
          s.y = 1.04;
          s.x = Math.random();
        }
        ctx.globalAlpha = 0.35 + 0.4 * Math.sin(t * 1.3 + s.phase);
        ctx.fillStyle = s.gold ? "#fcd34d" : "#a3e635";
        ctx.shadowColor = s.gold ? "rgba(252,211,77,0.9)" : "rgba(163,230,53,0.9)";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // ── the falling canopy ──
      for (const lf of leaves) {
        // flutter + wind + gentle swirl around the avatar
        let ax = Math.sin(t * 1.1 + lf.phase) * lf.sway + wind - lf.vx * 0.9;
        let ay = 0;
        if (grove) {
          const px = lf.x * W;
          const py = lf.y * H;
          const dx = px - grove.x;
          const dy = py - grove.y;
          const d = Math.hypot(dx, dy);
          const zone = grove.r * 1.7;
          if (d < zone && d > 1) {
            const s = 1 - d / zone;
            // tangential swirl + soft radial push: leaves arc around the rim
            ax += ((dx / d) * 220 - (dy / d) * 260) * s;
            ay += ((dy / d) * 220 + (dx / d) * 260) * s - 40 * s;
          }
        }
        lf.vx += ax * dt;
        lf.vx = Math.max(-140, Math.min(140, lf.vx));
        lf.x += (lf.vx * dt) / W;
        lf.y += ((lf.vy + ay) * dt) / H;
        lf.rot += lf.vr * dt + Math.sin(t * 2 + lf.phase) * 0.6 * dt;
        // recycle off-screen leaves back to the top
        if (lf.y > 1.05) {
          lf.y = -0.05;
          lf.x = Math.random();
          lf.vx = 0;
        }
        if (lf.x < -0.08) lf.x = 1.06;
        if (lf.x > 1.08) lf.x = -0.06;
        const sp = sprites[lf.sprite];
        ctx.save();
        ctx.translate(lf.x * W, lf.y * H);
        ctx.rotate(lf.rot);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sp, -lf.size / 2, -lf.size / 2, lf.size, lf.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // ── the overgrown avatar: knotted branches, vines, blooms ──
      if (grove) {
        const { x: cx, y: cy, r } = grove;
        ctx.lineCap = "round";
        for (const b of branches) {
          const sway = Math.sin(t * 0.6 + b.phase) * 0.012;
          const rad0 = r * 1.04;
          const a1 = b.a0;
          const a2 = b.a0 + b.span;
          const p0x = cx + Math.cos(a1) * rad0;
          const p0y = cy + Math.sin(a1) * rad0;
          const p3x = cx + Math.cos(a2) * rad0;
          const p3y = cy + Math.sin(a2) * rad0;
          const c1r = r * (1.04 + b.wob1 + sway);
          const c2r = r * (1.04 + b.wob2 - sway);
          const c1x = cx + Math.cos(a1 + b.span / 3) * c1r;
          const c1y = cy + Math.sin(a1 + b.span / 3) * c1r;
          const c2x = cx + Math.cos(a1 + (2 * b.span) / 3) * c2r;
          const c2y = cy + Math.sin(a1 + (2 * b.span) / 3) * c2r;
          ctx.strokeStyle = b.green ? "rgba(52,160,90,0.9)" : "rgba(92,58,30,0.95)";
          ctx.lineWidth = r * b.w;
          ctx.beginPath();
          ctx.moveTo(p0x, p0y);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p3x, p3y);
          ctx.stroke();
          // woody highlight / knot
          if (!b.green) {
            ctx.strokeStyle = "rgba(140,95,50,0.5)";
            ctx.lineWidth = r * b.w * 0.4;
            ctx.stroke();
            ctx.fillStyle = "rgba(70,44,22,0.95)";
            ctx.beginPath();
            ctx.arc(p3x, p3y, r * 0.024, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // blooming accents: tiny glowing teal/white woodland flowers
        for (const f of flowers) {
          const fx = cx + Math.cos(f.ang) * r * 1.06;
          const fy = cy + Math.sin(f.ang) * r * 1.06;
          const pulse = 0.45 + 0.5 * Math.sin(t * 1.6 + f.phase);
          const col = f.teal ? "94,234,212" : "255,255,255";
          ctx.shadowColor = `rgba(${col},0.95)`;
          ctx.shadowBlur = 7;
          ctx.fillStyle = `rgba(${col},${pulse.toFixed(3)})`;
          for (let p = 0; p < 4; p++) {
            const pa = f.phase + (p * Math.PI) / 2;
            ctx.beginPath();
            ctx.arc(fx + Math.cos(pa) * r * 0.018, fy + Math.sin(pa) * r * 0.018, r * 0.016, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
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

// ── Profile-level: the forest, anchored INSIDE the card ─────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function CanopyCardForest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanopyCanvas(canvasRef);

  // Forest ambience — plays ONCE when the profile opens, then falls silent.
  // (It used to loop, which turned a nice touch into a nuisance.) Browsers may
  // refuse autoplay without a user gesture; then the first pointer/key
  // interaction starts it instead. Always silenced on unmount.
  useEffect(() => {
    const audio = new Audio("/sounds/forest-heart.mp3");
    audio.loop = false;
    audio.volume = 0.5;
    let disposed = false;
    const retry = () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      if (!disposed) audio.play().catch(() => {});
    };
    audio.play().catch(() => {
      if (disposed) return;
      window.addEventListener("pointerdown", retry);
      window.addEventListener("keydown", retry);
    });
    return () => {
      disposed = true;
      audio.pause();
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, []);

  return (
    <>
      {/* the living forest — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. Sits above the card
          content so branches crown the avatar and leaves drift over the surface. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
      />

      {/* deep shaded-woodland wash over the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 20%, rgba(15,30,20,0.68), rgba(10,24,14,0.4) 50%, transparent 80%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.92] }}
        transition={{ duration: 1.8, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 100%, rgba(255,235,180,0.1), transparent 60%)" }}
        animate={{ opacity: [0.45, 0.85, 0.45] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot: golden sunlight blooms through the canopy on open */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(75% 65% at 40% 25%, rgba(255,235,180,0.8), rgba(163,230,53,0.25) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 2, ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the grove's mark ───────────────────────────────────────────

export function CanopyAvatarVines() {
  // Register so the vines, leaf-swirl and blooms wrap this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    CANOPY_ANCHORS.add(el);
    return () => {
      CANOPY_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* deep forest aura */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 4px rgba(6,20,12,0.9), 0 0 26px 8px rgba(16,185,129,0.4)",
            "0 0 16px 6px rgba(6,20,12,0.95), 0 0 42px 13px rgba(163,230,53,0.55)",
            "0 0 12px 4px rgba(6,20,12,0.9), 0 0 26px 8px rgba(16,185,129,0.4)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* leafy overgrowth ring — greens twined with wood-brown */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[6%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(16,185,129,0), rgba(52,211,153,0.85), rgba(92,58,30,0.6), rgba(163,230,53,0.8), rgba(16,185,129,0), rgba(21,128,61,0.75), rgba(92,58,30,0.55), rgba(16,185,129,0))",
          filter: "blur(1.5px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
          maskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* pulsing teal blooms */}
      {[
        { ang: -60, delay: 0 },
        { ang: 70, delay: 1.1 },
        { ang: 180, delay: 2.3 },
      ].map((f, i) => {
        const rad = (f.ang * Math.PI) / 180;
        return (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute z-20 rounded-full"
            style={{
              left: `${50 + Math.cos(rad) * 52}%`,
              top: `${50 + Math.sin(rad) * 52}%`,
              width: 5,
              height: 5,
              marginLeft: -2.5,
              marginTop: -2.5,
              background: "radial-gradient(circle, #ffffff, #5eead4 60%, rgba(94,234,212,0.3))",
              boxShadow: "0 0 8px 2px rgba(94,234,212,0.8)",
            }}
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 2.4 + i * 0.6, repeat: Infinity, ease: "easeInOut", delay: f.delay }}
          />
        );
      })}
    </>
  );
}
