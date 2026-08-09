"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";

/**
 * THE GATE & THE KEY — Unique-tier profile effect. Yog-Sothoth as sacred
 * geometry gone wrong, in four continuous systems around the avatar:
 *
 *   THE CORE — a wireframe 4D tesseract (16 vertices, 32 edges, rotating in
 *              the XW and YZ planes with a true 4D→3D→2D projection) turns
 *              inside a golden dodecahedron, both burning like solid light.
 *   THE CONJOINED SPHERES — a breathing cluster of iridescent orbs phasing
 *              through each other around the avatar, each volumetrically
 *              shaded (blinding highlight, ultraviolet shadow) with a
 *              lidless golden iris facing the epicenter.
 *   COSMIC RADIATION — hundreds of gold/ultraviolet motes riding a pure
 *              trig field: three chaotic spiral arms whose radii are nested
 *              sine functions, so no orbit ever repeats or moves linearly.
 *   THE GLIMPSE — every 12-18s the viewer's mind briefly parses what it is
 *              seeing: the whole canvas inverts via a difference fill for
 *              ~0.45s while jagged EKG waveforms tear across the geometry,
 *              then snaps back to serene glow.
 *
 * Rendering: this effect is PURE LIGHT (no dark inks at all), so unlike
 * Outer God it earns Hollow's single-canvas treatment: one z-[30] canvas with
 * mixBlendMode:screen — it can only brighten, so it rides over the card's
 * text at full presence without ever hiding a word. No shadowBlur anywhere:
 * the "burning" look is triple-pass strokes (wide faint → medium → white
 * core) + pre-rendered glow sprites, per the Dejavu lag lesson. Gradients
 * used under a translate are defined AT THE ORIGIN (paint-time user space).
 * Anchors are scoped to the canvas's own card via DOM containment — the
 * lesson from Outer God's hero/modal collision, applied from day one.
 */

// The avatar registers here; the gateway opens on this card's own anchor.
const GATEWAY_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

type V4 = [number, number, number, number];
type V3 = [number, number, number];

// ── 4D hypercube: 16 vertices (±1)⁴, edges join vertices differing in ONE bit
const TESS_VERTS: V4[] = Array.from({ length: 16 }, (_, i) => [
  i & 1 ? 1 : -1,
  i & 2 ? 1 : -1,
  i & 4 ? 1 : -1,
  i & 8 ? 1 : -1,
]);
const TESS_EDGES: [number, number][] = [];
for (let a = 0; a < 16; a++) {
  for (let b = a + 1; b < 16; b++) {
    const x = a ^ b;
    if ((x & (x - 1)) === 0) TESS_EDGES.push([a, b]); // power of two = one axis apart
  }
}

// ── dodecahedron: 20 golden-ratio vertices, 30 edges found by min distance
const DODE_VERTS: V3[] = [];
for (let i = 0; i < 8; i++) DODE_VERTS.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
for (const s1 of [-1, 1]) {
  for (const s2 of [-1, 1]) {
    DODE_VERTS.push([0, (s1 * 1) / PHI, s2 * PHI]);
    DODE_VERTS.push([(s1 * 1) / PHI, s2 * PHI, 0]);
    DODE_VERTS.push([s1 * PHI, 0, (s2 * 1) / PHI]);
  }
}
const DODE_EDGES: [number, number][] = [];
{
  const MIN = 2 / PHI + 0.05; // true edge length is 2/φ
  for (let a = 0; a < DODE_VERTS.length; a++) {
    for (let b = a + 1; b < DODE_VERTS.length; b++) {
      const dx = DODE_VERTS[a][0] - DODE_VERTS[b][0];
      const dy = DODE_VERTS[a][1] - DODE_VERTS[b][1];
      const dz = DODE_VERTS[a][2] - DODE_VERTS[b][2];
      if (Math.hypot(dx, dy, dz) < MIN) DODE_EDGES.push([a, b]);
    }
  }
}

type Sphere = { seed: number };
type Mote = { seed: number; om: number; band: number; size: number; gold: boolean };

function useGatewayCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Frame snapshot used by the glimpse: a difference fill composites plain
    // source-over wherever the backdrop is TRANSPARENT, so an unmasked fill
    // would flood the whole card 92%-white — over the screen blend that means
    // every word under the canvas goes white-on-white. The snapshot's alpha
    // masks the inversion back to just the drawn geometry.
    // Declared BEFORE resize(), which runs immediately and sizes it — putting
    // this below shipped a TDZ crash ("Cannot access before initialization")
    // the moment the effect mounted.
    const snap = document.createElement("canvas");
    const snapCtx = snap.getContext("2d");
    if (!snapCtx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — locked to the card while
      // scrolling, like a Discord profile effect.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      snap.width = canvas.width;
      snap.height = canvas.height;
      snapCtx.setTransform(1, 0, 0, 1, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // pre-rendered radial glow sprites — glow without per-frame shadowBlur
    const makeSprite = (inner: string, mid: string) => {
      const s = 96;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.4, mid);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const goldMote = makeSprite("rgba(255,236,170,0.95)", "rgba(255,215,0,0.4)");
    const uvMote = makeSprite("rgba(226,190,255,0.95)", "rgba(138,43,226,0.4)");
    const uvHalo = makeSprite("rgba(177,74,255,0.8)", "rgba(88,24,180,0.3)");
    const holeFeather = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.8, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      return c;
    })();

    let ax = 0, ay = 0, aR = 48;

    const spheres: Sphere[] = Array.from({ length: 8 }, (_, i) => ({ seed: i + hash(i * 3.7) }));
    const motes: Mote[] = Array.from({ length: 320 }, (_, i) => ({
      seed: hash(i * 1.618),
      om: rand(0.05, 0.2) * (Math.random() < 0.8 ? 1 : -1),
      band: rand(0.9, 3.5),
      size: rand(2.5, 6.5),
      gold: Math.random() < 0.5,
    }));

    // ── triple-pass stroke = "solid burning light" without shadowBlur
    const burnStroke = (path: () => void, rgb: string, coreA: number) => {
      ctx.beginPath();
      path();
      ctx.strokeStyle = `rgba(${rgb},0.12)`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${rgb},0.32)`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${coreA})`;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    };

    // ── SYSTEM 1: the multi-dimensional core ──
    const drawCore = (t: number, grow: number) => {
      // ultraviolet ground-glow behind the geometry
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.4 + 0.15 * Math.sin(t * 0.6)) * grow;
      const hs = aR * 4.6 * grow;
      ctx.drawImage(uvHalo, ax - hs / 2, ay - hs / 2, hs, hs);
      ctx.globalAlpha = 1;

      const breathe = 1 + 0.06 * Math.sin(t * 0.5);

      // tesseract — rotate in XW and YZ planes, project 4D→3D→2D
      {
        const a = t * 0.22, b = t * 0.16;
        const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const R = aR * 1.15 * breathe * grow;
        const pts: [number, number][] = TESS_VERTS.map(([x, y, z, w]) => {
          const x1 = x * ca - w * sa;         // XW plane
          const w1 = x * sa + w * ca;
          const y1 = y * cb - z * sb;         // YZ plane
          const z1 = y * sb + z * cb;
          const k4 = 1.8 / (1.8 - w1 * 0.55); // 4D → 3D perspective
          const x2 = x1 * k4, y2 = y1 * k4, z2 = z1 * k4;
          const k3 = 2.4 / (2.4 - z2 * 0.5);  // 3D → 2D perspective
          return [ax + x2 * k3 * R, ay + y2 * k3 * R];
        });
        burnStroke(() => {
          for (const [i, j] of TESS_EDGES) {
            ctx.moveTo(pts[i][0], pts[i][1]);
            ctx.lineTo(pts[j][0], pts[j][1]);
          }
        }, "177,74,255", 0.75 * grow);
      }

      // dodecahedron — corrupted gold, counter-rotating
      {
        const a = -t * 0.13, b = t * 0.09;
        const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const R = aR * 1.62 * breathe * grow;
        const pts: [number, number][] = DODE_VERTS.map(([x, y, z]) => {
          const x1 = x * ca - y * sa;
          const y1 = x * sa + y * ca;
          const y2 = y1 * cb - z * sb;
          const z2 = y1 * sb + z * cb;
          const k3 = 3.1 / (3.1 - z2 * 0.55);
          return [ax + x1 * k3 * R * 0.5, ay + y2 * k3 * R * 0.5];
        });
        burnStroke(() => {
          for (const [i, j] of DODE_EDGES) {
            ctx.moveTo(pts[i][0], pts[i][1]);
            ctx.lineTo(pts[j][0], pts[j][1]);
          }
        }, "255,205,60", 0.6 * grow);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    // ── SYSTEM 2: the conjoined spheres ──
    const drawSpheres = (t: number, grow: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (const s of spheres) {
        const i = s.seed;
        const ang = (i / spheres.length) * TAU + t * 0.07 * (Math.floor(i) % 2 ? 1 : -1) + i * 2.4;
        const rad = aR * (1.35 + 0.55 * Math.sin(t * 0.11 + i * 2.2));
        const x = ax + Math.cos(ang) * rad;
        const y = ay + Math.sin(ang) * rad * 0.9;
        const r = Math.max(2, aR * (0.16 + 0.1 * hash(i * 5.1)) * (1 + 0.22 * Math.sin(t * 0.9 + i)) * grow);
        // iridescence slides each orb between ultraviolet and corrupted gold
        const mix = 0.5 + 0.5 * Math.sin(t * 0.23 + i * 1.7);
        const cr = Math.round(177 + (255 - 177) * mix);
        const cg = Math.round(74 + (205 - 74) * mix);
        const cb2 = Math.round(255 + (60 - 255) * mix);
        ctx.save();
        ctx.translate(x, y);
        // defined at the ORIGIN — painted under this translate (CTM rule)
        const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, 0, 0, r);
        grad.addColorStop(0, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.3, `rgba(${cr},${cg},${cb2},0.4)`);
        grad.addColorStop(0.72, "rgba(90,20,160,0.22)");
        grad.addColorStop(1, "rgba(40,8,90,0)");
        ctx.globalAlpha = 0.66 * grow;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // lidless golden iris, always facing the gateway
        const da = Math.atan2(ay - y, ax - x);
        const px = Math.cos(da) * r * 0.3, py = Math.sin(da) * r * 0.3;
        ctx.globalAlpha = 0.75 * grow;
        ctx.strokeStyle = "rgba(255,215,0,0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.22, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(px, py, Math.max(r * 0.09, 0.8), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // ── SYSTEM 3: cosmic radiation — a pure trig field, nothing linear ──
    const drawMotes = (t: number, grow: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (const p of motes) {
        const th = p.seed * TAU + t * p.om;
        const arm = Math.floor(p.seed * 3) * 2.094; // three spiral arms
        const r =
          aR * p.band +
          aR * 0.45 * Math.sin(3 * th + t * 0.7 + arm) +
          aR * 0.3 * Math.sin(th * PHI * 2 - t * 1.3);
        const x = ax + Math.cos(th) * r;
        const y = ay + Math.sin(th) * r * 0.88 + aR * 0.2 * Math.sin(t * 0.4 + p.seed * 9);
        ctx.globalAlpha = (0.22 + 0.34 * Math.abs(Math.sin(t * 1.1 + p.seed * 7))) * grow;
        ctx.drawImage(p.gold ? goldMote : uvMote, x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // ── SYSTEM 4: the glimpse of the abyss ──
    let nextGlimpse = 7 + Math.random() * 6; // first one comes early
    let glimpseT = -1; // >=0 while active
    const GLIMPSE_DUR = 0.45;

    const drawWhispers = () => {
      // corrupted-EKG waveforms tearing horizontally through the geometry —
      // re-randomized every frame so they crawl and jitter like a bad signal
      ctx.globalCompositeOperation = "lighter";
      for (let l = 0; l < 3; l++) {
        const baseY = H * (0.25 + 0.25 * l) + rand(-8, 8);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= W; x += 7) {
          const spike = Math.random() < 0.07 ? (Math.random() * 2 - 1) * H * 0.09 : (Math.random() * 2 - 1) * 4;
          ctx.lineTo(x, baseY + spike);
        }
        ctx.strokeStyle = l % 2 ? "rgba(255,215,0,0.8)" : "rgba(226,190,255,0.8)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    // ── conductor ──
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let paused = false;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      // avatar epicenter — ONLY anchors inside THIS canvas's card count
      const cRect = canvas.getBoundingClientRect();
      const host = canvas.parentElement;
      ax = W * 0.28; ay = H * 0.22; aR = 48;
      let best = 0;
      GATEWAY_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });

      const grow = clamp01((elapsed - 0.2) / 1.8);

      if (glimpseT >= 0) {
        glimpseT += dt;
        if (glimpseT > GLIMPSE_DUR) {
          glimpseT = -1;
          nextGlimpse = elapsed + rand(12, 18); // every 12-18s, as decreed
        }
      } else if (elapsed >= nextGlimpse) {
        glimpseT = 0;
      }

      ctx.clearRect(0, 0, W, H);
      drawCore(elapsed, grow);
      drawSpheres(elapsed, grow);
      drawMotes(elapsed, grow);

      if (glimpseT >= 0) {
        // THE SNAP — invert ONLY the drawn geometry for the glimpse window.
        // The difference fill alone would also flood every transparent pixel
        // 92%-white (blend modes composite source-over on empty backdrop),
        // whiting out the card's text through the screen blend — so the frame
        // is snapshotted first and destination-in masks the inversion back to
        // the geometry's own footprint. The serene glow blinks into a dark
        // alien negative; every word beneath stays untouched.
        snapCtx.clearRect(0, 0, snap.width, snap.height);
        snapCtx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(snap, 0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        // whispers AFTER the inversion — drawn before it they'd invert to
        // dark and vanish under the screen blend; this way the corrupted EKG
        // tears bright across the blinked-out geometry
        drawWhispers();
      }

      // punch the avatar's disc out LAST — the difference fill above paints
      // the whole rect, so punching earlier would let the snap wash the face
      ctx.globalCompositeOperation = "destination-out";
      const hr = aR + 4;
      ctx.drawImage(holeFeather, ax - hr, ay - hr, hr * 2, hr * 2);
      ctx.globalCompositeOperation = "source-over";
      // gateway ring where the geometry meets the profile picture
      ctx.strokeStyle = "rgba(226,190,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, aR + 1.5, 0, TAU);
      ctx.stroke();
      const rot = elapsed * 0.4;
      ctx.strokeStyle = "rgba(255,215,0,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, aR + 1.5, rot, rot + 0.9);
      ctx.stroke();

      if (!paused) raf = requestAnimationFrame(frame);
    };

    // The two "not being seen" signals are tracked SEPARATELY so a tab
    // hide→show can't resume a loop the IntersectionObserver had parked.
    let hidden = document.hidden;
    let offscreen = false;
    const sync = () => {
      const shouldPause = hidden || offscreen;
      if (shouldPause === paused) return;
      paused = shouldPause;
      if (paused) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            offscreen = !e.isIntersecting;
            sync();
          }, { threshold: 0 })
        : null;
    io?.observe(canvas);

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [canvasRef]);
}

// ── Card-level: the gateway, anchored INSIDE the card ───────────────────────

export function GatewayCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useGatewayCanvas(canvasRef);

  return (
    <>
      {/* the absolute dark of the cosmic void, BEHIND the card's text (z-6) */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(4,2,10,0.85), rgba(2,2,5,0.62) 55%, rgba(1,1,3,0.45) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 28%, rgba(138,43,226,0.16), transparent 68%)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* geometry · spheres · radiation · the glimpse — one canvas of pure
          light at z-30, screen-blended: it can only brighten, so it rides
          over the card's panels and text without hiding a single word */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the key ───────────────────────────────────────

// The mark's STRUCTURE (size="lg" surfaces — profile, popout, forum — render
// the full mark; small/dense surfaces still collapse to the cheap glow, so
// this only ever mounts a handful of times at once): a corrupted-gold
// tesseract hint — two
// counter-rotating square outlines with a white-hot core — hovering over the
// top rim, plus three ultraviolet motes orbiting just outside the rim on a
// precomputed octagonal path. Percentage units throughout, so the mark scales
// from ~80px popout avatars to 160px profile avatars.
const ORBIT_R = 55; // % of the avatar container — just outside the 50% rim
const ORBIT_STEPS = Array.from({ length: 9 }, (_, i) => (i * Math.PI) / 4);
const orbitPath = (phaseDeg: number) => {
  const phase = (phaseDeg * Math.PI) / 180;
  return {
    left: ORBIT_STEPS.map((a) => `${(50 + ORBIT_R * Math.cos(a + phase)).toFixed(1)}%`),
    top: ORBIT_STEPS.map((a) => `${(50 + ORBIT_R * Math.sin(a + phase)).toFixed(1)}%`),
  };
};
const GATE_MOTES = [
  { path: orbitPath(0), dur: 6.2 },
  { path: orbitPath(120), dur: 7.4 },
  { path: orbitPath(240), dur: 8 },
];

export function GatewayAvatarMark() {
  // Register so the gateway opens on THIS avatar's rim.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    GATEWAY_ANCHORS.add(el);
    return () => {
      GATEWAY_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* ultraviolet → blinding white → corrupted gold, breathing on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(2,2,5,0.9), 0 0 26px 8px rgba(138,43,226,0.55)",
            "0 0 16px 5px rgba(2,2,5,0.95), 0 0 42px 13px rgba(255,255,255,0.4)",
            "0 0 13px 4px rgba(2,2,5,0.9), 0 0 30px 9px rgba(255,215,0,0.5)",
            "0 0 12px 3px rgba(2,2,5,0.9), 0 0 26px 8px rgba(138,43,226,0.55)",
          ],
        }}
        transition={{ duration: 6.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* THE KEY — gold wireframe tesseract hint hovering just above the top
          rim: outer square + inner 45°-offset square, counter-rotating, white
          core. z-[1] like the glow (behind the z-10 avatar image) so its lower
          tip tucks behind the rim; never touches the face. All % units. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-22%] z-[1] block w-[36%]"
        style={{ x: "-50%" }}
        animate={{ y: ["0%", "-12%", "0%"] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 40 40" className="h-auto w-full" style={{ filter: "drop-shadow(0 0 4px rgba(255,215,0,0.55))" }}>
          <motion.rect
            x="8"
            y="8"
            width="24"
            height="24"
            fill="none"
            stroke="#ffd700"
            strokeWidth="1.8"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          <motion.rect
            x="12.5"
            y="12.5"
            width="15"
            height="15"
            fill="none"
            stroke="#ffd700"
            strokeWidth="1.4"
            opacity="0.8"
            initial={{ rotate: 45 }}
            animate={{ rotate: [45, -315] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
          <circle cx="20" cy="20" r="2" fill="#fff" opacity="0.95" />
        </svg>
      </motion.span>

      {/* three ultraviolet motes orbiting just outside the rim — z-0 behind
          the avatar image, octagonal % path ≈ circle, phases 120° apart */}
      {GATE_MOTES.map((m, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute z-0 block rounded-full"
          style={{
            width: "7%",
            height: "7%",
            x: "-50%",
            y: "-50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(138,43,226,0.8) 38%, rgba(138,43,226,0) 72%)",
          }}
          animate={{ left: m.path.left, top: m.path.top, opacity: [0.5, 0.95, 0.5] }}
          transition={{ duration: m.dur, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </>
  );
}
