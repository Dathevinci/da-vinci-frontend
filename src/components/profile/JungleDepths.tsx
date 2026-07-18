"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "The Ancient Jungle" — Extreme Rare. A dark, overgrown, deep-jungle takeover.
 *
 * Reworked from tester feedback: framing TREES on the flanks, a lush hanging-VINE
 * curtain, butterflies + gnats (INSECTS), and — crucially — the giant Monstera
 * leaves now sprout from OUTSIDE the avatar rim and radiate OUTWARD so they frame
 * the profile picture instead of covering it.
 *
 * - JungleCardRealm (profile-level, portaled to <body>, mix-blend NORMAL), drawn
 *   back-to-front: blurred background ferns + distant trees → 3 warm god rays →
 *   two foreground framing trees (trunk, bark, leafy canopy) → a curtain of
 *   hanging vines swaying from the top → drifting spores → cyan/gold fireflies,
 *   flapping butterflies and darting gnats → the avatar framed by outward-
 *   radiating Monstera leaves + rim-coiling vines → tumbling falling leaves.
 *
 * - JungleAvatarFronds (avatar-level): an emerald/gold overgrowth aura + drifting
 *   spore motes for small surfaces / the shop preview, plus the rim anchor.
 *
 * No external assets. Full procedural Canvas math. dt clamped (never negative),
 * resilient loop, static scenery pre-rendered to offscreen layers, cleaned up on
 * unmount.
 */

const JUNGLE_ANCHORS = new Set<HTMLElement>();

// ── palette ──────────────────────────────────────────────────────────────────
const LEAF_DARK = "#0f3a22";
const LEAF_MID = "#1f6b38";
const LEAF_LIGHT = "#3fae5a";
const VINE_BROWN = "#3a2a1a";
const VINE_MOSS = "#4a5e2a";
const GOLD = "255,225,150";
const CYAN_FF = "0,255,213";
const GOLD_FF = "255,220,120";
const BUTTERFLY = [
  ["#22d3ee", "#0e7490"],
  ["#fbbf24", "#b45309"],
  ["#fb923c", "#9a3412"],
  ["#a78bfa", "#6d28d9"],
];

// ── engine types ─────────────────────────────────────────────────────────────
type Spore = { x: number; y: number; vy: number; amp: number; freq: number; phase: number; r: number; gold: boolean };
type Fly = { x: number; y: number; tx: number; ty: number; spd: number; phase: number; freq: number; size: number; gold: boolean };
type Fall = { x: number; y: number; vy: number; sway: number; swayF: number; rot: number; rotV: number; tumble: number; size: number; color: string; phase: number };
type Bfly = { x: number; y: number; tx: number; ty: number; spd: number; flap: number; flapF: number; size: number; ca: string; cb: string; phase: number };
type Gnat = { cx: number; cy: number; phase: number; freq: number; rad: number; drift: number };
type HangVine = { x0: number; depth: number; phase: number; width: number };

// A smooth closed path traced through a point list (quadratics through midpoints).
function smoothFill(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.closePath();
}

// Monstera leaf outline: base (0,0), tip (0,-L), fenestration slits on each side.
function monsteraOutline(L: number, W: number, lobes: number) {
  const env = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  const right: { x: number; y: number }[] = [];
  for (let s = 0; s < lobes; s++) {
    const tm = (s + 0.5) / lobes;
    const t1 = (s + 1) / lobes;
    right.push({ x: W * env(tm) * (1.05 - tm * 0.25), y: -tm * L });
    right.push({ x: W * 0.15 * env(t1) + W * 0.04, y: -t1 * L });
  }
  const left = right.map((p) => ({ x: -p.x, y: p.y })).reverse();
  return [{ x: 0, y: 0 }, ...right, { x: 0, y: -L }, ...left, { x: 0, y: 0 }];
}

function drawMonstera(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, W: number, ang: number, lobes: number, tone: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const outline = monsteraOutline(L, W, lobes);
  const g = ctx.createLinearGradient(0, 0, 0, -L);
  g.addColorStop(0, tone > 0.5 ? LEAF_MID : LEAF_DARK);
  g.addColorStop(0.6, tone > 0.5 ? LEAF_LIGHT : LEAF_MID);
  g.addColorStop(1, tone > 0.5 ? "#5fce78" : LEAF_LIGHT);
  ctx.fillStyle = g;
  smoothFill(ctx, outline);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,60,35,0.6)";
  ctx.lineWidth = Math.max(1, L * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -L);
  ctx.stroke();
  ctx.strokeStyle = "rgba(120,200,140,0.4)";
  ctx.lineWidth = Math.max(0.6, L * 0.01);
  for (let s = 0; s < lobes; s++) {
    const tm = (s + 0.5) / lobes;
    const env = Math.sin(Math.PI * Math.min(1, tm)) * (1.05 - tm * 0.25);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -tm * L);
      ctx.quadraticCurveTo(side * W * 0.4, -tm * L - L * 0.02, side * W * env * 0.9, -tm * L);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// A twisting woody vine along control points, tapering, mossy overlay + leaflets.
function drawVine(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], width: number, t: number) {
  if (pts.length < 2) return;
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  ctx.lineCap = "round";
  ctx.strokeStyle = VINE_BROWN;
  ctx.lineWidth = width;
  trace();
  ctx.stroke();
  ctx.strokeStyle = VINE_MOSS;
  ctx.lineWidth = width * 0.5;
  trace();
  ctx.stroke();
  ctx.fillStyle = LEAF_MID;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const p = pts[i];
    const side = i % 2 === 0 ? 1 : -1;
    const wob = Math.sin(t * 1.4 + i) * 0.2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(side * (0.7 + wob));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(width * 1.5, -width, width * 3.2, 0);
    ctx.quadraticCurveTo(width * 1.5, width, 0, 0);
    ctx.fill();
    ctx.restore();
  }
}

function makeGlow(rgb: string) {
  const s = 22;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, `rgba(${rgb},0.95)`);
  gr.addColorStop(0.4, `rgba(${rgb},0.45)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

// A fern frond — for the blurred background silhouette layer.
function drawFern(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, color: string) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(1, len * 0.02);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.1, -len * 0.5, 0, -len);
  g.stroke();
  const pinnae = 14;
  for (let i = 1; i <= pinnae; i++) {
    const t = i / pinnae;
    const py = -t * len;
    const px = Math.sin(t * Math.PI) * len * 0.05;
    const pl = len * 0.28 * (1 - t * 0.6);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(px, py);
      g.rotate(side * (0.9 - t * 0.3));
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(pl * 0.5, -pl * 0.25, pl, 0);
      g.quadraticCurveTo(pl * 0.5, pl * 0.25, 0, 0);
      g.fill();
      g.restore();
    }
  }
  g.restore();
}

// A framing tree: tapered curved trunk with bark lines and a leafy canopy of
// overlapping blobs. `dir` = +1 leans right, -1 leans left. Drawn to offscreen.
function drawTree(g: CanvasRenderingContext2D, x: number, baseY: number, h: number, dir: number) {
  const w = h * 0.05;
  const topX = x + dir * h * 0.14;
  const topY = baseY - h;
  // trunk
  const bark = g.createLinearGradient(x - w, 0, x + w, 0);
  bark.addColorStop(0, "#0c1a0e");
  bark.addColorStop(0.5, "#22331c");
  bark.addColorStop(1, "#0c1a0e");
  g.fillStyle = bark;
  g.beginPath();
  g.moveTo(x - w, baseY);
  g.quadraticCurveTo(x - w * 0.6 + dir * h * 0.06, baseY - h * 0.5, topX - w * 0.35, topY);
  g.lineTo(topX + w * 0.35, topY);
  g.quadraticCurveTo(x + w * 0.6 + dir * h * 0.06, baseY - h * 0.5, x + w, baseY);
  g.closePath();
  g.fill();
  // bark texture
  g.strokeStyle = "rgba(90,120,70,0.22)";
  g.lineWidth = Math.max(1, w * 0.12);
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(x + i * w * 0.3, baseY);
    g.quadraticCurveTo(x + i * w * 0.3 + dir * h * 0.05, baseY - h * 0.5, topX + i * w * 0.2, topY);
    g.stroke();
  }
  // a couple of branches
  g.strokeStyle = "#16260f";
  g.lineWidth = w * 0.5;
  for (const by of [0.55, 0.75]) {
    const bx = x + dir * h * (0.14 * by);
    g.beginPath();
    g.moveTo(bx, baseY - h * by);
    g.quadraticCurveTo(bx - dir * h * 0.12, baseY - h * (by + 0.05), bx - dir * h * 0.22, baseY - h * (by + 0.16));
    g.stroke();
  }
  // leafy canopy — overlapping dark-green blobs around the crown
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = h * (0.06 + Math.random() * 0.22);
    const bx = topX - dir * h * 0.12 + Math.cos(a) * h * 0.24;
    const by = topY + Math.sin(a) * h * 0.2 - h * 0.02;
    const shade = Math.random() < 0.5 ? "#123a20" : "#1a4d2b";
    g.fillStyle = shade;
    g.beginPath();
    g.ellipse(bx, by, rr, rr * 0.75, a, 0, Math.PI * 2);
    g.fill();
  }
}

// A butterfly with flapping wings, facing its heading `ang`.
function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, flap: number, ca: string, cb: string, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const open = 0.2 + 0.8 * Math.abs(Math.sin(flap));
  ctx.fillStyle = "#241a0f";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.08, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s * open, 1);
    ctx.fillStyle = ca;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.12);
    ctx.quadraticCurveTo(size * 0.72, -size * 0.58, size * 0.56, -size * 0.04);
    ctx.quadraticCurveTo(size * 0.42, size * 0.06, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cb;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.02);
    ctx.quadraticCurveTo(size * 0.52, size * 0.42, size * 0.36, size * 0.14);
    ctx.quadraticCurveTo(size * 0.22, size * 0.03, 0, size * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function useJungleCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const cyanGlow = makeGlow(CYAN_FF);
    const goldGlow = makeGlow(GOLD_FF);
    const sporeGlow = makeGlow("150,220,120");

    const spores: Spore[] = [];
    const flies: Fly[] = [];
    const falling: Fall[] = [];
    const butterflies: Bfly[] = [];
    const gnats: Gnat[] = [];
    const hangVines: HangVine[] = [];
    let bgLayer: HTMLCanvasElement | null = null;
    let treeLayer: HTMLCanvasElement | null = null;

    const spawnSpore = (any: boolean): Spore => ({
      x: Math.random() * W,
      y: any ? Math.random() * H : H + 10,
      vy: 8 + Math.random() * 20,
      amp: 6 + Math.random() * 18,
      freq: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      r: 1 + Math.random() * 2.4,
      gold: Math.random() < 0.4,
    });
    const spawnFly = (): Fly => ({
      x: Math.random() * W,
      y: Math.random() * H,
      tx: Math.random() * W,
      ty: Math.random() * H,
      spd: 0.4 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      freq: 1.2 + Math.random() * 2.2,
      size: 2 + Math.random() * 3,
      gold: Math.random() < 0.5,
    });
    const spawnBfly = (): Bfly => {
      const [ca, cb] = BUTTERFLY[Math.floor(Math.random() * BUTTERFLY.length)];
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        tx: Math.random() * W,
        ty: Math.random() * H * 0.8,
        spd: 0.5 + Math.random() * 0.6,
        flap: Math.random() * Math.PI * 2,
        flapF: 10 + Math.random() * 8,
        size: 16 + Math.random() * 14,
        ca,
        cb,
        phase: Math.random() * Math.PI * 2,
      };
    };
    const spawnFall = (): Fall => {
      const dark = Math.random() < 0.5;
      return {
        x: Math.random() * W,
        y: -30,
        vy: 22 + Math.random() * 40,
        sway: 20 + Math.random() * 40,
        swayF: 0.5 + Math.random() * 1.2,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 2,
        tumble: 0.6 + Math.random() * 1.4,
        size: 12 + Math.random() * 18,
        color: dark ? "#12331f" : "#4a3a1c",
        phase: Math.random() * Math.PI * 2,
      };
    };

    const sporeTarget = () => Math.round(Math.min(80, Math.max(36, (W * H) / 26000)));

    const buildBg = () => {
      const c = document.createElement("canvas");
      c.width = Math.max(1, W);
      c.height = Math.max(1, H);
      const g = c.getContext("2d");
      if (!g) {
        bgLayer = null;
        return;
      }
      g.globalAlpha = 0.5;
      const n = Math.round(Math.min(18, Math.max(8, (W * H) / 130000)));
      for (let i = 0; i < n; i++) {
        const x = Math.random() * W;
        const y = H * (0.55 + Math.random() * 0.55);
        const len = H * (0.32 + Math.random() * 0.45);
        drawFern(g, x, y, len, (Math.random() - 0.5) * 1.2, Math.random() < 0.5 ? "#0a2415" : "#0e2c1a");
      }
      // a few small distant trees
      g.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) {
        drawTree(g, W * (0.2 + Math.random() * 0.6), H * (0.72 + Math.random() * 0.1), H * (0.4 + Math.random() * 0.2), Math.random() < 0.5 ? 1 : -1);
      }
      const blurred = document.createElement("canvas");
      blurred.width = c.width;
      blurred.height = c.height;
      const bg = blurred.getContext("2d");
      if (bg) {
        bg.filter = "blur(9px)";
        bg.drawImage(c, 0, 0);
        bgLayer = blurred;
      } else bgLayer = c;
    };

    const buildTrees = () => {
      const c = document.createElement("canvas");
      c.width = Math.max(1, W);
      c.height = Math.max(1, H);
      const g = c.getContext("2d");
      if (!g) {
        treeLayer = null;
        return;
      }
      // two framing trees hugging the flanks — pushed further off the edges on
      // phones so their canopies frame rather than crowd the profile.
      const edge = W < 680 ? 0.09 : -0.02;
      drawTree(g, W * -edge, H + 8, H * (0.92 + Math.random() * 0.1), 1);
      drawTree(g, W * (1 + edge), H + 8, H * (0.92 + Math.random() * 0.1), -1);
      treeLayer = c;
    };

    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the whole jungle stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      while (spores.length < sporeTarget()) spores.push(spawnSpore(true));
      if (spores.length > sporeTarget()) spores.length = sporeTarget();
      while (flies.length < 26) flies.push(spawnFly());
      if (flies.length > 26) flies.length = 26;
      while (butterflies.length < 5) butterflies.push(spawnBfly());
      if (butterflies.length > 5) butterflies.length = 5;
      gnats.length = 0;
      for (let i = 0; i < 4; i++) gnats.push({ cx: Math.random() * W, cy: H * (0.3 + Math.random() * 0.5), phase: Math.random() * 6, freq: 0.3 + Math.random() * 0.4, rad: 30 + Math.random() * 40, drift: (Math.random() - 0.5) * 8 });
      hangVines.length = 0;
      const nmob = W < 680;
      const nv = Math.round(Math.min(8, Math.max(nmob ? 3 : 4, W / 260)));
      for (let i = 0; i < nv; i++) hangVines.push({ x0: (i + 0.5 + (Math.random() - 0.5) * 0.6) * (W / nv), depth: (nmob ? 0.18 : 0.28) + Math.random() * (nmob ? 0.24 : 0.4), phase: Math.random() * 6, width: (nmob ? 2.5 : 4) + Math.random() * (nmob ? 2 : 4) });
      buildBg();
      buildTrees();
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the jungle always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let fallTimer = 1.5;

    const frameBody = (now: number) => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      // On phones the effect must stay OUT of the profile text — fewer, shorter,
      // dimmer elements so the card underneath stays readable.
      const narrow = W < 680;

      // 1. blurred background
      if (bgLayer) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(bgLayer, Math.sin(t * 0.15) * 12 - 6, Math.cos(t * 0.12) * 6);
        ctx.globalAlpha = 1;
      }

      // 2. god rays — soft volumetric shafts. A heavy blur feathers the polygon
      //    edges so they read as beams of light instead of hard-edged glass
      //    panels (without it, the sharp overlapping seams carve a dark
      //    "diamond" across the profile).
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${narrow ? 20 : 30}px)`;
      const RAYS = narrow
        ? [
            { originX: 0.14, dir: 1 },
            { originX: 0.84, dir: -1 },
          ]
        : [
            { originX: 0.06, dir: 1 },
            { originX: 0.34, dir: 1 },
            { originX: 0.9, dir: -1 },
          ];
      for (let i = 0; i < RAYS.length; i++) {
        const drift = Math.sin(t * 0.2 + i * 1.7) * W * 0.05;
        const topX = RAYS[i].originX * W + drift;
        const spread = W * (0.13 + i * 0.03);
        const botX = topX + RAYS[i].dir * W * 0.5;
        const grad = ctx.createLinearGradient(topX, 0, botX, H);
        grad.addColorStop(0, `rgba(${GOLD},${narrow ? 0.06 : 0.1})`);
        grad.addColorStop(0.5, `rgba(${GOLD},${narrow ? 0.02 : 0.04})`);
        grad.addColorStop(1, `rgba(${GOLD},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(topX, -10);
        ctx.lineTo(topX + spread, -10);
        ctx.lineTo(botX + spread * 1.5, H + 10);
        ctx.lineTo(botX, H + 10);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 3. foreground framing trees (gentle sway; dimmer + pushed off-screen on phones)
      if (treeLayer) {
        ctx.globalAlpha = narrow ? 0.55 : 1;
        ctx.drawImage(treeLayer, Math.sin(t * 0.25) * 5, 0);
        ctx.globalAlpha = 1;
      }

      // 4. hanging-vine curtain from the top
      for (const hv of hangVines) {
        const sway = Math.sin(t * 0.5 + hv.phase) * 26;
        const bottom = H * hv.depth;
        const pts = [
          { x: hv.x0, y: -10 },
          { x: hv.x0 + sway * 0.3, y: bottom * 0.4 },
          { x: hv.x0 + sway * 0.7, y: bottom * 0.75 },
          { x: hv.x0 + sway, y: bottom },
        ];
        drawVine(ctx, pts, hv.width, t + hv.phase);
      }

      // 5. spores
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const sp of spores) {
        sp.y -= sp.vy * dt;
        sp.x += Math.sin(t * sp.freq + sp.phase) * sp.amp * dt;
        if (sp.y < -12) {
          sp.y = H + 10;
          sp.x = Math.random() * W;
        }
        const s = sp.r * 5;
        ctx.globalAlpha = 0.4;
        ctx.drawImage(sporeGlow, sp.x - s / 2, sp.y - s / 2, s, s);
      }
      // fireflies
      for (const f of flies) {
        const dx = f.tx - f.x;
        const dy = f.ty - f.y;
        const d = Math.hypot(dx, dy);
        if (d < 24) {
          f.tx = Math.random() * W;
          f.ty = Math.random() * H;
        } else {
          f.x += (dx / d) * f.spd * 60 * dt + Math.cos(t * f.freq + f.phase) * 14 * dt;
          f.y += (dy / d) * f.spd * 60 * dt + Math.sin(t * f.freq * 1.3 + f.phase) * 14 * dt;
        }
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + f.phase);
        const s = f.size * (2.6 + tw);
        ctx.globalAlpha = 0.35 + 0.5 * tw;
        ctx.drawImage(f.gold ? goldGlow : cyanGlow, f.x - s / 2, f.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // 6. darting gnats (little dark clusters)
      ctx.fillStyle = "rgba(10,20,12,0.8)";
      for (const gn of gnats) {
        gn.cx += gn.drift * dt;
        if (gn.cx < 20) gn.cx = W - 20;
        else if (gn.cx > W - 20) gn.cx = 20;
        for (let k = 0; k < 5; k++) {
          const a = t * gn.freq * (2 + k) + gn.phase + k * 1.3;
          const gx = gn.cx + Math.cos(a) * gn.rad * (0.5 + 0.5 * Math.sin(a * 1.7));
          const gy = gn.cy + Math.sin(a * 1.3) * gn.rad * 0.6;
          ctx.beginPath();
          ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // butterflies
      for (const b of butterflies) {
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 30) {
          b.tx = Math.random() * W;
          b.ty = Math.random() * H * 0.85;
        }
        const ux = d > 1 ? dx / d : 0;
        const uy = d > 1 ? dy / d : 0;
        b.x += ux * b.spd * 55 * dt + Math.cos(t * 1.3 + b.phase) * 12 * dt;
        b.y += uy * b.spd * 55 * dt + Math.sin(t * 1.1 + b.phase) * 18 * dt;
        b.flap += b.flapF * dt;
        const heading = Math.atan2(uy, ux) + Math.PI / 2;
        drawButterfly(ctx, b.x, b.y, b.size, b.flap, b.ca, b.cb, heading);
      }

      // ── locate the avatar, in canvas-LOCAL coordinates ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the leaves are pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      JUNGLE_ANCHORS.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > best) {
          best = rect.width;
          target = {
            x: rect.left - cRect.left + rect.width / 2,
            y: rect.top - cRect.top + rect.height / 2,
            r: rect.width / 2,
          };
        }
      });
      const focus = target as { x: number; y: number; r: number } | null;

      // 7. the avatar FRAMED (leaves radiate OUTWARD from outside the rim; the
      //    face is never covered), plus rim-coiling vines
      if (focus) {
        const { x: cx, y: cy, r } = focus;
        const R = Math.max(40, r);
        // Monstera leaves around the upper 3/4, bases just OUTSIDE the rim,
        // tips pointing radially outward — a crown, not a veil.
        // Fewer, shorter leaves on phones so they crown the avatar rather than
        // swallow the name and bio beneath it.
        const leafAngles = narrow
          ? [-2.36, -1.57, -0.79, 3.14]
          : [-2.7, -2.15, -1.57, -0.99, -0.44, 0.35, 3.14];
        const leafW = R * (narrow ? 0.5 : 0.72);
        leafAngles.forEach((base, i) => {
          const a = base + Math.sin(t * 0.5 + i) * 0.08;
          const bx = cx + Math.cos(a) * R * 1.08;
          const by = cy + Math.sin(a) * R * 1.08;
          const len = R * (narrow ? 0.95 : 1.7) + (i % 2) * R * (narrow ? 0.16 : 0.3);
          drawMonstera(ctx, bx, by, len, leafW, a + Math.PI / 2, 6, i % 2);
        });
        // woody vines dropping from above and coiling the rim
        for (let v = 0; v < (narrow ? 2 : 3); v++) {
          const topX = cx + (v - 1) * R * 1.0;
          const sway = Math.sin(t * 0.6 + v * 2) * R * 0.25;
          const rimA = -Math.PI / 2 + (v - 1) * 0.7;
          const rimX = cx + Math.cos(rimA) * R * 1.06;
          const rimY = cy + Math.sin(rimA) * R * 1.06;
          const pts: { x: number; y: number }[] = [
            { x: topX, y: -10 },
            { x: topX + sway * 0.4, y: cy - R * 3 },
            { x: topX + sway, y: cy - R * 1.5 },
            { x: rimX, y: rimY },
          ];
          for (let k = 1; k <= 4; k++) {
            const a = rimA + k * 0.55;
            pts.push({ x: cx + Math.cos(a) * R * 1.08, y: cy + Math.sin(a) * R * 1.08 });
          }
          drawVine(ctx, pts, Math.max(3, R * 0.08), t + v);
        }
      }

      // 8. falling canopy leaves
      fallTimer -= dt;
      if (fallTimer <= 0 && falling.length < 12) {
        falling.push(spawnFall());
        fallTimer = 0.9 + Math.random() * 1.4;
      }
      for (let i = falling.length - 1; i >= 0; i--) {
        const fl = falling[i];
        fl.y += fl.vy * dt;
        fl.x += Math.sin(t * fl.swayF + fl.phase) * fl.sway * dt;
        fl.rot += fl.rotV * dt;
        if (fl.y > H + 40) {
          falling.splice(i, 1);
          continue;
        }
        const scaleX = Math.cos(t * fl.tumble + fl.phase);
        ctx.save();
        ctx.translate(fl.x, fl.y);
        ctx.rotate(fl.rot);
        ctx.scale(Math.max(0.12, Math.abs(scaleX)), 1);
        ctx.fillStyle = fl.color;
        ctx.beginPath();
        ctx.moveTo(0, -fl.size);
        ctx.quadraticCurveTo(fl.size * 0.7, -fl.size * 0.2, 0, fl.size);
        ctx.quadraticCurveTo(-fl.size * 0.7, -fl.size * 0.2, 0, -fl.size);
        ctx.fill();
        ctx.strokeStyle = "rgba(180,200,140,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -fl.size);
        ctx.lineTo(0, fl.size);
        ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };

    let warned = false;
    const frame = (now: number) => {
      try {
        frameBody(now);
      } catch (err) {
        if (!warned) {
          warned = true;
          console.error("[jungle] frame error:", err);
        }
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, [canvasRef]);
}

// ── Profile-level: the jungle, anchored INSIDE the card ─────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function JungleCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useJungleCanvas(canvasRef);

  return (
    <>
      {/* dark humid jungle-floor shade over the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "rgba(5,15,10,0.9)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
      {/* dappled emerald + gold light through the canopy */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 30% 0%, rgba(255,225,150,0.14), transparent 55%), radial-gradient(80% 70% at 60% 100%, rgba(31,107,56,0.16), transparent 60%)" }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the living jungle — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. Sits above the card
          content so leaves crown the avatar and spores drift over the surface. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
      />
    </>
  );
}

// ── Avatar-level: an overgrowth aura for small surfaces / the shop preview ───

export function JungleAvatarFronds() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    JUNGLE_ANCHORS.add(el);
    return () => {
      JUNGLE_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* deep-emerald overgrowth aura with a warm gold edge */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(31,107,56,0.55)",
            "0 0 24px 8px rgba(63,174,90,0.6)",
            "0 0 14px 4px rgba(255,220,120,0.45)",
            "0 0 24px 8px rgba(63,174,90,0.6)",
            "0 0 12px 3px rgba(31,107,56,0.55)",
          ],
        }}
        transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* drifting spore motes */}
      <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
        {[14, 38, 60, 82, 28, 72].map((left, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              width: 3,
              height: 3,
              background: i % 3 === 2 ? "#ffdc78" : "#8fce6a",
              boxShadow: "0 0 5px rgba(143,206,106,0.9)",
            }}
            initial={{ top: "108%", opacity: 0 }}
            animate={{ top: ["108%", "-10%"], opacity: [0, 1, 1, 0], x: [0, 4, -4, 0] }}
            transition={{ duration: 3.4 + (i % 3) * 0.8, repeat: Infinity, delay: i * 0.5, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}
