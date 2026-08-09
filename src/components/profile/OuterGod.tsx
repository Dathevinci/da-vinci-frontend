"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";

/**
 * OUTER GOD: ABYSSAL GAZE — SSS-grade profile effect. Lovecraftian cosmic
 * horror in four movements, on a loop that treats the profile as a tear in
 * reality:
 *
 *   AMBIENT — a jagged black wound pulses open behind the avatar, rimmed in
 *             sickly teal; bioluminescent mist spirals INWARD, ignoring
 *             gravity; five colossal appendages writhe out toward the card's
 *             edges, dreadfully slow, lined with pale suckers (two of them
 *             grow eyes that follow the cursor).
 *   THE GAZE — every 10–15s the card darkens and 2–3 immense magenta eyes
 *             crack open in the deep background. Their pupils SNAP to the
 *             cursor with no easing at all.
 *   SANITY DRAIN — as the eyes open (and in aftershocks while they watch),
 *             reality buckles: the frame is redrawn as split RGB channels,
 *             horizontal bands tear sideways, and the canvas itself jolts.
 *   AFTERMATH — the eyes seal, the gloom lifts, the appendages keep writhing.
 *
 * Perf: zero shadowBlur / ctx.filter in the loop — pre-rendered radial glow
 * sprites, batched sucker fills, one cached gradient per eye (defined at the
 * ORIGIN because gradients live in paint-time user space — see the Hollow
 * Purple CTM bug). Card-anchored (never viewport-fixed). The glitch shake
 * targets the CANVAS only (framer owns parentElement's transform in the shop
 * preview) and is reset in cleanup. Everything is drawn to an offscreen scene
 * each frame and blitted — that indirection is what makes the chromatic
 * aberration possible.
 */

// The avatar registers here; the tear in reality opens on the largest one.
const OUTERGOD_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
// deterministic per-vertex jaggedness for the void tear
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

type Tentacle = {
  baseAng: number;
  w1: number; k1: number; p1: number; a1: number;
  w2: number; k2: number; p2: number; a2: number;
  w3: number; w4: number; k3: number; a3: number;
  wanderW: number; wanderP: number;
  reachW: number; reachP: number;
  hasEyes: boolean;
  grow: number;
};
type Mote = { ang: number; rad: number; swirl: number; pull: number; size: number; a: number; tint: number };
type CosmicEye = {
  x: number; y: number; rx: number; ry: number; tilt: number; delay: number;
  irisR: number; irisGrad: CanvasGradient; veins: { x: number; y: number }[][];
  blinkAt: number; blinkT: number;
};
type Glitch = { at: number; dur: number };

function useOuterGodCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  glowRef: RefObject<HTMLCanvasElement | null>
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const glowCanvas = glowRef.current;
    if (!canvas || !glowCanvas) return;
    const ctx = canvas.getContext("2d");
    // The LIGHT rides on a second canvas ABOVE the card's text (z-30,
    // screen-blended — it can only brighten, so no word is ever hidden).
    // The dark inks stay on the z-8 canvas under the text. One layer under,
    // one layer over: legibility and presence stop being a trade-off.
    const gctx = glowCanvas.getContext("2d");
    if (!ctx || !gctx) return;

    // Offscreen scene + one channel scratch — the sanity drain needs a frame
    // it can re-composite, which a directly-drawn canvas can't provide.
    const scene = document.createElement("canvas");
    const sctx = scene.getContext("2d");
    const chan = document.createElement("canvas");
    const chctx = chan.getContext("2d");
    if (!sctx || !chctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — the horror stays locked
      // to the card while scrolling, like a Discord profile effect.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      for (const c of [canvas, glowCanvas, scene, chan]) {
        c.width = Math.max(1, Math.round(W * DPR));
        c.height = Math.max(1, Math.round(H * DPR));
      }
      // Art is drawn in CSS px on the scene; compositing happens in device px.
      sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      chctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // ── pre-rendered radial glow sprites ──
    const makeSprite = (inner: string, mid: string) => {
      const s = 128;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.35, mid);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const tealGlow = makeSprite("rgba(120,255,242,0.9)", "rgba(0,128,128,0.4)");
    const magentaGlow = makeSprite("rgba(255,120,235,0.9)", "rgba(216,31,180,0.35)");
    const corpseGlow = makeSprite("rgba(240,244,236,0.85)", "rgba(180,190,180,0.28)");
    // Feathered punch, used with destination-out to cut the avatar's disc out
    // of everything drawn — the void reads as BEHIND the profile picture, and
    // the gloom never dims the face.
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

    // ── shared per-frame state ──
    // Cursor kept in CLIENT coords; converted to canvas-local each frame with
    // the same rect used for the anchors, so eyes track correctly mid-scroll.
    const mouseClient = { x: innerWidth / 2, y: innerHeight / 3 };
    const onPointer = (e: PointerEvent) => {
      mouseClient.x = e.clientX;
      mouseClient.y = e.clientY;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let ax = 0, ay = 0, aR = 56; // avatar epicenter in canvas-local coords
    let mx = 0, my = 0; // cursor in canvas-local coords

    const pathCatmull = (g: CanvasRenderingContext2D, p: { x: number; y: number }[], continued: boolean) => {
      if (continued) g.lineTo(p[0].x, p[0].y);
      else g.moveTo(p[0].x, p[0].y);
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
        g.bezierCurveTo(
          p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
          p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
          p2.x, p2.y
        );
      }
    };

    const distToEdge = (x: number, y: number, ang: number) => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let d = 1e9;
      if (dx > 1e-6) d = Math.min(d, (W - x) / dx);
      if (dx < -1e-6) d = Math.min(d, (0 - x) / dx);
      if (dy > 1e-6) d = Math.min(d, (H - y) / dy);
      if (dy < -1e-6) d = Math.min(d, (0 - y) / dy);
      return Math.max(d, 40);
    };

    // ── the appendages (5 fits the narrow card; 7 was for the full-screen demo) ──
    const SEG = 22;
    const tents: Tentacle[] = Array.from({ length: 5 }, (_, i) => ({
      baseAng: (i / 5) * TAU + rand(-0.22, 0.22),
      // three stacked wave systems — the third nests sin inside sin, so the
      // rhythm never quite repeats and the motion reads as muscle, not metronome
      w1: rand(0.16, 0.28), k1: rand(2.2, 3.4), p1: rand(0, TAU), a1: rand(0.5, 0.72),
      w2: rand(0.06, 0.13), k2: rand(4.5, 6.5), p2: rand(0, TAU), a2: rand(0.32, 0.55),
      w3: rand(0.2, 0.33), w4: rand(0.05, 0.1), k3: rand(1.5, 2.8), a3: rand(0.15, 0.26),
      wanderW: rand(0.05, 0.11), wanderP: rand(0, TAU),
      reachW: rand(0.04, 0.08), reachP: rand(0, TAU),
      hasEyes: i % 2 === 1,
      grow: 0,
    }));

    const spinePoints = (T: Tentacle, t: number) => {
      const reach = 0.5 + 0.42 * (0.5 + 0.5 * Math.sin(t * T.reachW + T.reachP));
      const L = distToEdge(ax, ay, T.baseAng) * reach * T.grow;
      const step = Math.max(L, 1) / SEG;
      const ang0 = T.baseAng + Math.sin(t * T.wanderW + T.wanderP) * 0.35;
      let x = ax + Math.cos(T.baseAng) * aR * 0.55;
      let y = ay + Math.sin(T.baseAng) * aR * 0.55;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= SEG; i++) {
        pts.push({ x, y });
        const s = i / SEG;
        const bend =
          Math.sin(t * T.w1 + s * T.k1 + T.p1) * T.a1 * s +
          Math.sin(t * T.w2 + s * T.k2 + T.p2) * T.a2 * s * s +
          Math.sin(t * T.w3 + Math.sin(t * T.w4 + s * T.k3) * 2.0) * T.a3 * s;
        const a = ang0 + bend;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
      }
      return pts;
    };

    const drawTentacle = (T: Tentacle, t: number) => {
      const pts = spinePoints(T, t);
      const w0 = aR * 0.34 * Math.min(1, T.grow * 1.4);
      const left: { x: number; y: number }[] = [];
      const right: { x: number; y: number }[] = [];
      const widths: number[] = [];
      const normals: { x: number; y: number }[] = [];
      for (let i = 0; i < pts.length; i++) {
        const pA = pts[Math.max(0, i - 1)], pB = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(pB.y - pA.y), ny = pB.x - pA.x;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        const s = i / (pts.length - 1);
        const w = w0 * Math.pow(1 - s, 1.18) + 1.3;
        widths.push(w);
        normals.push({ x: nx, y: ny });
        left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
        right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
      }

      // body: one closed ribbon, shaded root-black → drowned teal at the tip
      sctx.beginPath();
      pathCatmull(sctx, left, false);
      pathCatmull(sctx, right.slice().reverse(), true);
      sctx.closePath();
      const tip = pts[pts.length - 1];
      const g = sctx.createLinearGradient(pts[0].x, pts[0].y, tip.x, tip.y);
      g.addColorStop(0, "rgba(2,5,7,0.96)");
      g.addColorStop(0.55, "rgba(7,22,26,0.94)");
      g.addColorStop(1, "rgba(18,84,86,0.92)");
      sctx.fillStyle = g;
      sctx.fill();

      // single rim light along one edge — bioluminescence catching the
      // muscle. Glow layer: this is the line that makes a tentacle crossing
      // a bio panel still READ as a tentacle.
      gctx.beginPath();
      pathCatmull(gctx, left, false);
      gctx.strokeStyle = "rgba(45,215,205,0.6)";
      gctx.lineWidth = 2;
      gctx.stroke();

      // suckers along the INNER curve (the side facing the avatar), batched
      // into two fills instead of one fill per cup
      const cups: { x: number; y: number; r: number }[] = [];
      for (let i = 3; i < pts.length - 2; i += 3) {
        const s = i / (pts.length - 1);
        if (s < 0.14 || s > 0.9) continue;
        const n = normals[i];
        const toC = (ax - pts[i].x) * n.x + (ay - pts[i].y) * n.y;
        const sgn = toC > 0 ? 1 : -1;
        cups.push({
          x: pts[i].x + n.x * sgn * widths[i] * 0.55,
          y: pts[i].y + n.y * sgn * widths[i] * 0.55,
          r: Math.max(widths[i] * 0.4, 1),
        });
      }
      sctx.fillStyle = "rgba(226,232,222,0.45)";
      sctx.beginPath();
      for (const c of cups) { sctx.moveTo(c.x + c.r, c.y); sctx.arc(c.x, c.y, c.r, 0, TAU); }
      sctx.fill();
      sctx.fillStyle = "rgba(5,24,26,0.85)";
      sctx.beginPath();
      for (const c of cups) { const r2 = c.r * 0.5; sctx.moveTo(c.x + r2, c.y); sctx.arc(c.x, c.y, r2, 0, TAU); }
      sctx.fill();

      // a couple of tentacles grow eyes instead — they also watch the cursor
      if (T.hasEyes && T.grow > 0.6) {
        for (const idx of [7, 14]) {
          const p = pts[idx], q = pts[idx + 1];
          const tang = Math.atan2(q.y - p.y, q.x - p.x);
          const w = widths[idx];
          sctx.save();
          sctx.translate(p.x, p.y);
          sctx.rotate(tang);
          sctx.fillStyle = "rgba(230,235,228,0.8)";
          sctx.beginPath();
          sctx.ellipse(0, 0, w * 0.55, w * 0.3, 0, 0, TAU);
          sctx.fill();
          const pa = Math.atan2(my - p.y, mx - p.x) - tang;
          sctx.fillStyle = "#d81fb4";
          sctx.beginPath();
          sctx.arc(Math.cos(pa) * w * 0.18, Math.sin(pa) * w * 0.1, Math.max(w * 0.14, 1), 0, TAU);
          sctx.fill();
          sctx.restore();
        }
      }
    };

    // ── the tear in reality ──
    const voidLayers = [
      { base: 1.58, rot: 0.0, rs: 0.05, pw: 0.9, seed: 11, K: 24 },
      { base: 1.34, rot: 2.1, rs: -0.075, pw: 1.3, seed: 37, K: 20 },
      { base: 1.14, rot: 4.2, rs: 0.06, pw: 1.7, seed: 71, K: 26 },
    ];
    const drawVoid = (t: number, growV: number) => {
      // bioluminescent halo bleeding out of the tear — on the GLOW layer, so
      // it shines over the card's panels instead of being muted under them
      gctx.globalCompositeOperation = "lighter";
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.7);
      gctx.globalAlpha = (0.55 + 0.2 * pulse) * growV;
      const gs = aR * 5.2 * growV;
      gctx.drawImage(tealGlow, ax - gs / 2, ay - gs / 2, gs, gs);
      gctx.globalAlpha = (0.3 + 0.14 * (1 - pulse)) * growV;
      const ms = aR * 3.3 * growV;
      gctx.drawImage(magentaGlow, ax - ms / 2, ay - ms / 2, ms, ms);
      gctx.globalAlpha = 1;
      gctx.globalCompositeOperation = "source-over";

      // overlapping jagged polygons of pure black — straight lineTo on
      // purpose, a tear has edges, not curves
      for (let li = 0; li < voidLayers.length; li++) {
        const L = voidLayers[li];
        const rot = L.rot + t * L.rs;
        sctx.beginPath();
        for (let i = 0; i < L.K; i++) {
          const a = rot + (i / L.K) * TAU;
          const jag = hash(i * 7.13 + L.seed);
          const fang = jag > 0.7 ? 1.28 + 0.22 * Math.sin(t * 1.1 + i * 3.1) : 1 - 0.1 * jag;
          const r = L.base * aR * growV * (1 + 0.13 * Math.sin(t * L.pw + i * 2.7)) * fang;
          const x = ax + Math.cos(a) * r, y = ay + Math.sin(a) * r;
          if (i === 0) sctx.moveTo(x, y);
          else sctx.lineTo(x, y);
        }
        sctx.closePath();
        sctx.fillStyle = "rgba(0,0,0,1)";
        sctx.fill();
        if (li === 0) {
          sctx.strokeStyle = "rgba(0,190,180,0.55)";
          sctx.lineWidth = 2;
          sctx.stroke();
        } else if (li === 1) {
          sctx.strokeStyle = "rgba(216,31,180,0.3)";
          sctx.lineWidth = 1.3;
          sctx.stroke();
        }
      }
    };

    // ── mist: teal motes spiraling INTO the tear, gravity be damned ──
    let mist: Mote[] | null = null;
    const spawnMote = (anywhere: boolean): Mote => ({
      ang: rand(0, TAU),
      rad: aR * (anywhere ? rand(1.15, 4.2) : rand(3.8, 4.4)),
      swirl: rand(0.5, 1.4) * (Math.random() < 0.85 ? 1 : -1),
      pull: rand(8, 22),
      size: rand(10, 30),
      a: rand(0.16, 0.42),
      tint: Math.random(),
    });
    const drawMist = (dt: number, growM: number) => {
      if (!mist) mist = Array.from({ length: 64 }, () => spawnMote(true));
      // Glow layer: the indrawn motes drift OVER bio boxes and stat tiles —
      // pure light, so the text under them stays perfectly readable.
      gctx.globalCompositeOperation = "lighter";
      const maxR = aR * 4.4;
      for (const p of mist) {
        p.rad -= (p.pull + 16 * (1 - p.rad / maxR)) * dt;
        p.ang += (p.swirl * 40 / Math.max(p.rad, 22)) * dt;
        if (p.rad < aR * 0.95) Object.assign(p, spawnMote(false));
        const x = ax + Math.cos(p.ang) * p.rad;
        const y = ay + Math.sin(p.ang) * p.rad;
        const edgeFade = clamp01((maxR - p.rad) / (aR * 0.9)) * clamp01((p.rad - aR) / (aR * 0.5));
        gctx.globalAlpha = p.a * edgeFade * growM;
        const spr = p.tint < 0.1 ? corpseGlow : p.tint < 0.2 ? magentaGlow : tealGlow;
        gctx.drawImage(spr, x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
      gctx.globalAlpha = 1;
      gctx.globalCompositeOperation = "source-over";
    };

    // ── the gaze of the outer god ──
    const EYE_ZONES: [number, number][] = [
      [0.16, 0.14], [0.84, 0.12], [0.12, 0.6], [0.88, 0.58], [0.5, 0.84], [0.2, 0.88], [0.8, 0.86],
    ];
    const gaze = {
      state: "idle" as "idle" | "opening" | "watching" | "closing",
      t: 0,
      eyes: [] as CosmicEye[],
      next: 6, // the first gaze comes early; profile visits are short
      watchDur: 4,
    };
    const glitches: Glitch[] = [];

    const openGaze = (elapsed: number) => {
      const zones = EYE_ZONES.slice();
      for (let i = zones.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [zones[i], zones[j]] = [zones[j], zones[i]];
      }
      const n = 2 + Math.floor(Math.random() * 2); // 2–3 eyes on the narrow card
      const eyes: CosmicEye[] = [];
      for (const z of zones) {
        if (eyes.length >= n) break;
        const x = z[0] * W + rand(-0.03, 0.03) * W;
        const y = z[1] * H + rand(-0.03, 0.03) * H;
        const rx = Math.min(W, H) * rand(0.14, 0.2);
        if (Math.hypot(x - ax, y - ay) < aR * 2.1 + rx * 0.6) continue; // never near the avatar
        // iris gradient cached per eye, defined AT THE ORIGIN — it is painted
        // under a translate, and gradients live in paint-time user space
        const irisR = rx * 0.55;
        const ig = sctx.createRadialGradient(0, 0, 0, 0, 0, irisR);
        ig.addColorStop(0, "#ff9df0");
        ig.addColorStop(0.18, "#e93fd0");
        ig.addColorStop(0.45, "#8b12a8");
        ig.addColorStop(0.75, "rgba(60,6,90,0.6)");
        ig.addColorStop(1, "rgba(20,2,40,0)");
        const veins: { x: number; y: number }[][] = [];
        for (let v = 0; v < 5; v++) {
          const side = v % 2 === 0 ? -1 : 1;
          const pts = [{ x: side * rx * 0.95, y: rand(-5, 5) }];
          for (let s = 1; s <= 3; s++) {
            pts.push({ x: side * rx * (0.95 - s * 0.22) + rand(-4, 4), y: rand(-rx * 0.12, rx * 0.12) });
          }
          veins.push(pts);
        }
        eyes.push({
          x, y, rx,
          ry: rx * rand(0.4, 0.52),
          tilt: rand(-0.16, 0.16),
          delay: eyes.length * 0.18,
          irisR, irisGrad: ig, veins,
          blinkAt: elapsed + rand(1.8, 3.4),
          blinkT: -1,
        });
      }
      gaze.eyes = eyes;
      gaze.state = "opening";
      gaze.t = 0;
      gaze.watchDur = rand(3.2, 4.8);
      // the sanity drain rides on the gaze: one hard glitch as reality buckles
      // open, then an aftershock or two while it watches
      glitches.length = 0;
      glitches.push({ at: elapsed + 0.12, dur: 0.45 });
      glitches.push({ at: elapsed + 1.5 + Math.random() * 1.6, dur: 0.28 });
      if (Math.random() < 0.5) glitches.push({ at: elapsed + 3.1, dur: 0.22 });
    };

    const eyeOpenness = (e: CosmicEye, elapsed: number) => {
      let open = 0;
      if (gaze.state === "opening") open = easeOutCubic(clamp01((gaze.t - e.delay) / 1.1));
      else if (gaze.state === "watching") open = 1;
      else if (gaze.state === "closing") open = 1 - clamp01(gaze.t / 0.7);
      if (gaze.state === "watching") {
        if (e.blinkT < 0 && elapsed >= e.blinkAt) {
          e.blinkT = 0;
          e.blinkAt = elapsed + rand(1.6, 3.2);
        }
        if (e.blinkT >= 0) {
          open *= 1 - 0.92 * Math.sin(Math.PI * clamp01(e.blinkT / 0.22));
          if (e.blinkT > 0.22) e.blinkT = -1;
        }
      }
      return open;
    };

    const drawEye = (e: CosmicEye, open: number) => {
      if (open <= 0.02) return;
      sctx.save();
      sctx.translate(e.x, e.y);
      sctx.rotate(e.tilt);
      const ry = e.ry * open;

      // dread-glow beneath the lids — glow layer (drawn at absolute coords
      // since gctx doesn't share sctx's translate/rotate), so the magenta
      // burn pierces the panels even where the eye itself is behind them
      gctx.globalCompositeOperation = "lighter";
      gctx.globalAlpha = 0.5 * open;
      const gs = e.rx * 2.6;
      gctx.drawImage(magentaGlow, e.x - gs / 2, e.y - gs / 2, gs, gs);
      gctx.globalAlpha = 1;
      gctx.globalCompositeOperation = "source-over";

      // lens (two quadratics = upper and lower lids)
      sctx.beginPath();
      sctx.moveTo(-e.rx, 0);
      sctx.quadraticCurveTo(0, -ry * 2, e.rx, 0);
      sctx.quadraticCurveTo(0, ry * 2, -e.rx, 0);
      sctx.closePath();
      sctx.fillStyle = "rgba(8,3,15,0.94)";
      sctx.fill();

      sctx.save();
      sctx.clip();
      // sclera veins
      sctx.strokeStyle = "rgba(216,60,120,0.3)";
      sctx.lineWidth = 1.1;
      sctx.beginPath();
      for (const vn of e.veins) {
        sctx.moveTo(vn[0].x, vn[0].y);
        for (let i = 1; i < vn.length; i++) sctx.lineTo(vn[i].x, vn[i].y);
      }
      sctx.stroke();
      // iris — intensely glowing mutated magenta
      sctx.fillStyle = e.irisGrad;
      sctx.beginPath();
      sctx.arc(0, 0, e.irisR, 0, TAU);
      sctx.fill();
      // striations, batched into a single stroke
      sctx.strokeStyle = "rgba(255,180,240,0.18)";
      sctx.lineWidth = 1;
      sctx.beginPath();
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * TAU;
        sctx.moveTo(Math.cos(a) * e.irisR * 0.22, Math.sin(a) * e.irisR * 0.22);
        sctx.lineTo(Math.cos(a) * e.irisR * 0.88, Math.sin(a) * e.irisR * 0.88);
      }
      sctx.stroke();
      // pupil SNAPS to the cursor — no easing at all, that's the horror of it
      const lmx = mx - e.x, lmy = my - e.y;
      const c = Math.cos(-e.tilt), s = Math.sin(-e.tilt);
      const lx = lmx * c - lmy * s, ly = lmx * s + lmy * c;
      const ll = Math.hypot(lx, ly) || 1;
      const off = Math.min(ll * 0.04, e.irisR * 0.32);
      const px = (lx / ll) * off, py = (ly / ll) * off;
      sctx.fillStyle = "#050208";
      sctx.beginPath();
      sctx.ellipse(px, py, e.irisR * 0.14, e.irisR * 0.6 * Math.max(open, 0.25), 0, 0, TAU);
      sctx.fill();
      sctx.fillStyle = "rgba(240,244,236,0.5)";
      sctx.beginPath();
      sctx.arc(px + e.irisR * 0.1, py - e.irisR * 0.2, e.irisR * 0.05, 0, TAU);
      sctx.fill();
      sctx.restore();

      // lid line — the current path is NOT part of save/restore state, so the
      // lens must be re-traced (the clip section's beginPath calls clobbered it)
      sctx.beginPath();
      sctx.moveTo(-e.rx, 0);
      sctx.quadraticCurveTo(0, -ry * 2, e.rx, 0);
      sctx.quadraticCurveTo(0, ry * 2, -e.rx, 0);
      sctx.closePath();
      sctx.strokeStyle = "rgba(200,160,190,0.25)";
      sctx.lineWidth = 1.4;
      sctx.stroke();
      sctx.restore();
    };

    // ── sanity drain ──
    const glitchPower = (elapsed: number) => {
      let p = 0;
      for (const q of glitches) {
        if (elapsed >= q.at && elapsed <= q.at + q.dur) {
          p = Math.max(p, Math.sin(Math.PI * (elapsed - q.at) / q.dur));
        }
      }
      return p;
    };

    const drawChannel = (tint: string, dx: number, dy: number) => {
      chctx.globalCompositeOperation = "source-over";
      chctx.clearRect(0, 0, chan.width, chan.height);
      chctx.drawImage(scene, 0, 0);
      chctx.globalCompositeOperation = "multiply";
      chctx.fillStyle = tint;
      chctx.fillRect(0, 0, chan.width, chan.height);
      chctx.globalCompositeOperation = "destination-in";
      chctx.drawImage(scene, 0, 0); // restore the scene's alpha after multiply
      ctx.drawImage(chan, dx, dy);
    };

    let shook = false;
    const composite = (power: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (power <= 0.02) {
        ctx.drawImage(scene, 0, 0);
        if (shook) {
          canvas.style.transform = "";
          glowCanvas.style.transform = "";
          shook = false;
        }
        return;
      }
      // chromatic aberration: the same frame as three shifted RGB channels
      const s = (2 + 8 * power) * DPR * rand(0.6, 1.4);
      ctx.globalCompositeOperation = "lighter";
      drawChannel("#ff0000", -s, 0);
      drawChannel("#00ff00", 0, 0);
      drawChannel("#0000ff", s, s * 0.25);
      ctx.globalCompositeOperation = "source-over";
      // screen tear: slice horizontal bands and shove them sideways
      const bands = 2 + Math.floor(rand(0, 3) * power);
      for (let b = 0; b < bands; b++) {
        const by = Math.random() * canvas.height;
        const bh = (5 + Math.random() * 30) * DPR;
        const bx = (Math.random() * 2 - 1) * (12 + 50 * power) * DPR;
        ctx.drawImage(scene, 0, by, canvas.width, bh, bx, by, canvas.width, bh);
      }
      // inverse-color spasm — alien, migraine-bright, gone in a frame or two
      if (power > 0.6 && Math.random() < 0.25) {
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "rgba(0,190,170,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }
      // jolt the CANVASES only — never parentElement (framer owns that
      // transform in the shop preview modal); reset above and in cleanup.
      // Both layers get the SAME offsets so the light stays welded to the ink.
      const jx = (Math.random() * 2 - 1) * 3 * power;
      const jy = (Math.random() * 2 - 1) * 2 * power;
      canvas.style.transform = `translate(${jx}px, ${jy}px)`;
      glowCanvas.style.transform = `translate(${jx}px, ${jy}px)`;
      shook = true;
    };

    // ── conductor ──
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let dim = 0;
    let paused = false;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      // avatar epicenter + cursor, converted to canvas-local with ONE rect.
      // ONLY anchors inside THIS canvas's card count — the shop mounts a hero
      // instance and a preview-modal instance simultaneously, and a global
      // largest-rect-wins scan made the modal's tear open on the HERO's
      // avatar. DOM containment (not rect intersection — the centered modal
      // geometrically overlaps the hero panel) keeps each tear on its own card.
      const cRect = canvas.getBoundingClientRect();
      const host = canvas.parentElement;
      ax = W * 0.28; ay = H * 0.22; aR = 56; // fallback: roughly where the card's avatar sits
      let best = 0;
      OUTERGOD_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });
      mx = mouseClient.x - cRect.left;
      my = mouseClient.y - cRect.top;

      // intro: the tear forms first, appendages follow
      const growV = easeOutCubic(clamp01((elapsed - 0.3) / 1.6));
      for (let i = 0; i < tents.length; i++) {
        tents[i].grow = easeInOut(clamp01((elapsed - 1.6 - i * 0.3) / 2.2));
      }

      // gaze state machine
      if (gaze.state === "idle") {
        if (elapsed >= gaze.next) openGaze(elapsed);
      } else {
        gaze.t += dt;
        if (gaze.state === "opening" && gaze.t > 1.1 + 0.18 * gaze.eyes.length) {
          gaze.state = "watching";
          gaze.t = 0;
        } else if (gaze.state === "watching" && gaze.t > gaze.watchDur) {
          gaze.state = "closing";
          gaze.t = 0;
        } else if (gaze.state === "closing" && gaze.t > 0.7) {
          gaze.state = "idle";
          gaze.eyes = [];
          gaze.next = elapsed + rand(10, 15); // every 10–15s, as decreed
        }
      }
      // gloom is kept MILD (max 0.22) — the card's own text must stay legible
      // through the climax
      const dimTarget =
        gaze.state === "opening" ? 0.22 * clamp01(gaze.t / 1.1) :
        gaze.state === "watching" ? 0.22 :
        gaze.state === "closing" ? 0.22 * (1 - clamp01(gaze.t / 0.7)) : 0;
      dim += (dimTarget - dim) * Math.min(1, dt * 6);

      // — scene —
      sctx.clearRect(0, 0, W, H);
      gctx.clearRect(0, 0, W, H);
      if (dim > 0.004) {
        sctx.fillStyle = `rgba(1,3,7,${dim})`;
        sctx.fillRect(0, 0, W, H);
      }
      for (const e of gaze.eyes) drawEye(e, eyeOpenness(e, elapsed));
      if (growV > 0.01) drawVoid(elapsed, growV);
      for (const T of tents) if (T.grow > 0.02) drawTentacle(T, elapsed);
      // punch the avatar's disc out of ALL of it — the void sits behind the
      // profile picture, and the gloom never touches the face
      sctx.globalCompositeOperation = "destination-out";
      const hr = aR + 8;
      sctx.drawImage(holeFeather, ax - hr, ay - hr, hr * 2, hr * 2);
      sctx.globalCompositeOperation = "source-over";
      // …and out of the glow layer too (tighter radius), or the screen-blend
      // halo would wash the profile picture itself teal. Rim arcs + mist draw
      // AFTER this, so light still kisses the edge and motes cross the face.
      gctx.globalCompositeOperation = "destination-out";
      const ghr = aR + 4;
      gctx.drawImage(holeFeather, ax - ghr, ay - ghr, ghr * 2, ghr * 2);
      gctx.globalCompositeOperation = "source-over";
      // rim light where reality still holds — glow layer, riding over the
      // avatar frame ring instead of hiding beneath it
      gctx.strokeStyle = "rgba(30,200,190,0.85)";
      gctx.lineWidth = 2;
      gctx.beginPath();
      gctx.arc(ax, ay, aR + 1.5, 0, TAU);
      gctx.stroke();
      const rot = elapsed * 0.5;
      gctx.strokeStyle = "rgba(230,45,195,0.95)";
      gctx.lineWidth = 2;
      gctx.beginPath();
      gctx.arc(ax, ay, aR + 1.5, rot, rot + 1.1);
      gctx.stroke();
      drawMist(dt, clamp01(elapsed / 1.6));

      composite(glitchPower(elapsed));

      if (!paused) raf = requestAnimationFrame(frame);
    };

    // The two "not being seen" signals are tracked SEPARATELY so a tab
    // hide→show can't resume a loop the IntersectionObserver had parked while
    // the card was scrolled off-screen (and vice versa).
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
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      ro?.disconnect();
      io?.disconnect();
      canvas.style.transform = "";
      glowCanvas.style.transform = "";
    };
  }, [canvasRef, glowRef]);
}

// ── Card-level: the tear in reality, anchored INSIDE the card ───────────────

export function OuterGodCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  useOuterGodCanvas(canvasRef, glowRef);

  return (
    <>
      {/* abyssal wash BEHIND the card's text (z-6 < text's z-10) — the deep-sea
          gloom lives here so the canvas never has to darken the words */}
      {/* The wash is deliberately LIGHTER than the first cut (0.9→0.72 core):
          the canvas art is dark teal on near-black, and the murkier the wash,
          the more the tear/tentacles vanished into it. Less wash = more pop. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(2,10,12,0.72), rgba(2,5,8,0.55) 55%, rgba(1,2,4,0.42) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 28%, rgba(0,128,128,0.2), transparent 68%)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* tear · appendages · gaze · sanity drain — NORMAL compositing (not
          screen blend: the void's blacks and the eyes' dark scleras must
          actually darken what's beneath). z-[8], NOT the z-[30] the screen-
          blend effects use: with normal compositing the canvas must sit UNDER
          the card's z-10 text (profile body, modal content) or the tentacles
          and eyes paint the words out. Above the z-[6] washes and the banner,
          below every word — the deep background the eyes are written to open in. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
      />
      {/* the LIGHT — halos, mist, rim lines, eye-burn — rides ABOVE the text
          at z-30, but screen-blended: it can only brighten, never occlude, so
          the effect finally has presence over the card's panels while every
          word stays readable */}
      <canvas
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the noticed ───────────────────────────────────

// THE ABYSS PEEKS — tapered tentacle-tip silhouettes for the avatar mark.
// Drawn in a 120×56 viewBox that spans the avatar's bottom edge: the bases sit
// at the TOP of the viewBox (inside the avatar disc, so the z-10 profile image
// hides them) and the curled tips reach past the circle's silhouette just
// below the bottom rim — they read as something peeking out from behind.
const TENTACLE_TIPS = [
  // left — the big one, curling out to the lower-left
  {
    d: "M24 0 C16 14 13 27 18 38 C21 45 28 51 35 50 C39 49.4 41 46 39.5 43.5 C38.6 42 36.4 41.8 35.4 43.2 C34.6 44.3 35.2 45.8 36.4 46.2 C32 47.6 26.6 43.4 24.8 37 C22.8 30 26 16 33 2 Z",
    fill: "#052e2b",
    sway: [-6, 5, -6],
    dur: 6.5,
    delay: 0,
  },
  // right — medium, curling the other way
  {
    d: "M86 4 C93 16 96 28 92 38 C89 45 83 50 77 48.6 C73.6 47.8 72.2 44.6 73.6 42.4 C74.6 40.9 76.8 40.9 77.7 42.4 C78.4 43.6 77.8 45 76.6 45.4 C80.6 46.4 85.2 42 86.8 36 C88.6 29 86 17 79.4 6 Z",
    fill: "#06423c",
    sway: [5, -6, 5],
    dur: 5.6,
    delay: 0.8,
  },
  // center — small, barely breaking the rim
  {
    d: "M57 10 C53 20 52 30 55 38 C57.4 43.6 62 47.6 66 46.2 C68.8 45.2 69.8 42.4 68.5 40.6 C67.5 39.2 65.5 39.3 64.8 40.7 C64.3 41.8 64.8 43 65.9 43.3 C62.6 44 59.2 40.4 58.3 35.4 C57.3 29.8 59 20.4 62.6 11 Z",
    fill: "#052e2b",
    sway: [-4, 4, -4],
    dur: 7.2,
    delay: 1.5,
  },
];

export function OuterGodAvatarMark() {
  // Register so the tear in reality opens on THIS avatar's rim.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    OUTERGOD_ANCHORS.add(el);
    return () => {
      OUTERGOD_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* sickly teal → mutated magenta → corpse white, breathing on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(1,3,6,0.9), 0 0 26px 8px rgba(0,150,140,0.5)",
            "0 0 16px 5px rgba(1,3,6,0.95), 0 0 42px 13px rgba(216,31,180,0.55)",
            "0 0 13px 4px rgba(1,3,6,0.9), 0 0 30px 9px rgba(232,236,225,0.3)",
            "0 0 12px 3px rgba(1,3,6,0.9), 0 0 26px 8px rgba(0,150,140,0.5)",
          ],
        }}
        transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* THE ABYSS PEEKS — three bioluminescent tentacle tips swaying up from
          BEHIND the bottom rim. z-0 like the glow (under the z-10 avatar
          image), so the bases vanish behind the disc and only the curled tips
          break the silhouette. All percentage-sized: hugs the rim at 160px
          profile avatars and ~80–96px popouts alike. */}
      <svg
        aria-hidden
        viewBox="0 0 120 56"
        className="pointer-events-none absolute z-0 h-auto"
        style={{
          left: "-5%",
          bottom: "-12%",
          width: "110%",
          filter:
            "blur(0.5px) drop-shadow(0 0 4px rgba(20,184,166,0.7)) drop-shadow(0 2px 3px rgba(0,0,0,0.8))",
        }}
      >
        {TENTACLE_TIPS.map((tip, i) => (
          <motion.path
            key={i}
            d={tip.d}
            fill={tip.fill}
            stroke="#14b8a6"
            strokeWidth="1"
            strokeLinejoin="round"
            style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
            animate={{ rotate: tip.sway }}
            transition={{ duration: tip.dur, repeat: Infinity, delay: tip.delay, ease: "easeInOut" }}
          />
        ))}
      </svg>

      {/* the eye-slit of the noticed — a tiny magenta eye straddling the top
          rim that cracks open (scaleY 0 → 1) for a beat every few seconds,
          then seals. Rides at z-20 over the avatar's edge — the same layer
          TempestAvatarStorm floats its cloud on — and stays rim-hugging,
          never near the face's center. Closed (scale 0 + opacity 0) for most
          of every cycle. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute z-20 block"
        style={{
          left: "26%",
          top: "0%",
          width: "17%",
          height: "6%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, #ff9df0 0%, #d81fb4 35%, #7a0f68 70%, rgba(5,2,8,0.95) 100%)",
          boxShadow: "0 0 7px 2px rgba(216,31,180,0.8), 0 0 2px 1px rgba(2,2,6,0.9)",
        }}
        animate={{ scaleY: [0, 0, 1, 0.85, 1, 0, 0], opacity: [0, 0, 1, 1, 1, 0, 0] }}
        transition={{
          duration: 7.4,
          times: [0, 0.6, 0.66, 0.7, 0.76, 0.82, 1],
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* vertical slit pupil */}
        <span
          aria-hidden
          className="pointer-events-none absolute block"
          style={{ left: "46%", top: "14%", width: "8%", height: "72%", borderRadius: "9999px", background: "#050208" }}
        />
      </motion.span>
    </>
  );
}
