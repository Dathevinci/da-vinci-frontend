"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Hollow Purple" — the SSS-grade effect_hollow.
 *
 * The collision of two opposing cursed-energy spheres into an imaginary-mass
 * singularity, playing across the whole profile card:
 *   · A cobalt sphere rushes in from the left, IMPLODING — debris streaks
 *     spiral inward. A crimson sphere rushes from the right, EXPLODING —
 *     jagged repulsion arcs. They slam together and birth a violent
 *     violet-magenta orb with a blinding white core.
 *   · Concentric shockwave rings ripple outward; a hexagonal cursed-energy
 *     lattice flickers across the orb's surface; lightning (void-violet halo,
 *     white-hot core) crackles around its perimeter.
 *   · Violet motes and ash drift; wispy tendrils curl around the avatar's rim;
 *     twice a cycle a faint six-eyes motif pulses above the orb.
 *   · The collision re-fires every ~9s. Chromatic aberration (offset red/blue
 *     orb ghosts) sells the impact frame.
 *
 * Perf rules applied from the start (the Dejavu lesson): NO shadowBlur and NO
 * ctx.filter anywhere in the loop — glow comes from pre-rendered radial
 * sprites drawn additively; identical strokes are batched into single paths.
 * Card-anchored (never viewport-fixed); avatar tracked via HOLLOW_ANCHORS,
 * and the heavy layers are clipped OUT of the avatar disc so the face stays
 * clear (the spec's "negative space" zone).
 */

// The avatar registers here; the effect keeps its disc clear + curls tendrils
// around the largest visible one.
const HOLLOW_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInCubic = (x: number) => x * x * x;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const rand = (i: number, s: number) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

type Ring = { born: number; speed: number; width: number; alpha: number };
type Bolt = { pts: [number, number][]; born: number; life: number };
type Debris = { a: number; r: number; born: number };

function useHollowCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — the singularity stays
      // locked to the card while scrolling, like a Discord profile effect.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // ── pre-rendered glow sprites (drawImage beats shadowBlur ~50x) ──
    const makeGlow = (rgb: string, hard = 0.35) => {
      const s = 64;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(hard, `rgba(${rgb},0.5)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const G = {
      violet: makeGlow("167,36,240"),
      magenta: makeGlow("199,36,240"),
      blue: makeGlow("27,79,224"),
      crimson: makeGlow("224,27,60"),
      white: makeGlow("255,255,255", 0.25),
      ash: makeGlow("148,143,160", 0.5),
    };

    // ── hex lattice sprite: cursed-energy geometry, rendered once ──
    const makeHex = (R: number) => {
      const s = R * 2 + 8;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      g.translate(s / 2, s / 2);
      g.strokeStyle = "rgba(230,200,255,0.5)";
      g.lineWidth = 1;
      const hr = R / 4.2;
      for (let q = -4; q <= 4; q++) {
        for (let r = -4; r <= 4; r++) {
          const x = hr * 1.5 * q;
          const y = hr * Math.sqrt(3) * (r + q / 2);
          if (Math.hypot(x, y) > R - hr) continue;
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU + Math.PI / 6;
            const px = x + Math.cos(a) * hr;
            const py = y + Math.sin(a) * hr;
            if (k) g.lineTo(px, py);
            else g.moveTo(px, py);
          }
          g.closePath();
          g.stroke();
        }
      }
      // fade toward the rim so the lattice reads as wrapped on a sphere
      g.globalCompositeOperation = "destination-in";
      const m = g.createRadialGradient(0, 0, 0, 0, 0, R);
      m.addColorStop(0, "rgba(0,0,0,0.9)");
      m.addColorStop(0.75, "rgba(0,0,0,0.55)");
      m.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = m;
      g.fillRect(-s / 2, -s / 2, s, s);
      return c;
    };
    const hexSprite = makeHex(90);

    // ── state ──
    const CYCLE = 9;        // collide → bloom → idle, then re-fire
    const COLLIDE_T = 1.15; // spheres rush-in duration
    const motes = Array.from({ length: 44 }, (_, i) => ({
      x: rand(i, 1), y: rand(i, 2), v: 6 + rand(i, 3) * 16,
      amp: 6 + rand(i, 4) * 20, f: 0.12 + rand(i, 5) * 0.4,
      ph: rand(i, 6) * TAU, s: 1.4 + rand(i, 7) * 3,
      a: 0.1 + rand(i, 8) * 0.28, kind: i % 5, // 0-2 violet · 3 white · 4 ash
    }));
    const rings: Ring[] = [];
    let bolts: Bolt[] = [];
    const debris: Debris[] = [];

    let t = 0;
    let last = performance.now();
    let raf = 0;
    let paused = false;

    const mkBolt = (cx: number, cy: number, R: number, big: boolean): Bolt => {
      const pts: [number, number][] = [];
      let a = Math.random() * TAU;
      let r = R * (0.9 + Math.random() * 0.25);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      const n = big ? 6 : 4;
      for (let i = 0; i < n; i++) {
        a += (Math.random() - 0.5) * 1.4;
        r += (big ? 22 : 12) + Math.random() * (big ? 34 : 16);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return { pts, born: t, life: 0.14 + Math.random() * 0.12 };
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      ctx.clearRect(0, 0, W, H);

      // avatar anchor → keep-clear disc, in canvas-local coordinates
      const cRect = canvas.getBoundingClientRect();
      let ax = W * 0.28;
      let ay = H * 0.24;
      let arad = 60;
      let best = 0;
      HOLLOW_ANCHORS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          arad = r.width / 2 + 6;
        }
      });

      // the orb hovers in the card's open upper region, offset from the avatar
      const orbX = Math.min(W * 0.68, ax + arad * 2.4);
      const orbY = Math.max(H * 0.1, ay - arad * 0.5);
      const baseR = Math.min(W, H) * 0.16;

      const cyc = t % CYCLE;
      const collideP = clamp01(cyc / COLLIDE_T);
      const impact = cyc >= COLLIDE_T && cyc < COLLIDE_T + 0.28;
      const bloom = clamp01((cyc - COLLIDE_T) / 0.9);
      const orbAlpha = cyc < COLLIDE_T ? 0.25 + collideP * 0.2 : 0.55 + 0.45 * easeOutExpo(bloom);
      const pulse = 1 + 0.05 * Math.sin(t * 1.7);
      const R = baseR * pulse * (cyc < COLLIDE_T ? 0.55 : 0.55 + 0.45 * easeOutExpo(bloom));

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // drifting motes + rising ash (never over the avatar's face)
      for (const m of motes) {
        const y = ((m.y * H - t * m.v) % (H + 30) + H + 30) % (H + 30) - 15;
        const x = m.x * W + Math.sin(t * m.f * TAU + m.ph) * m.amp;
        if ((x - ax) ** 2 + (y - ay) ** 2 < arad * arad) continue;
        const spr = m.kind < 3 ? G.violet : m.kind === 3 ? G.white : G.ash;
        ctx.globalAlpha = m.a * (0.7 + 0.3 * Math.sin(t * 2 + m.ph));
        ctx.drawImage(spr, x - m.s * 2, y - m.s * 2, m.s * 4, m.s * 4);
      }
      ctx.globalAlpha = 1;

      // ── the two spheres rush in ──
      if (cyc < COLLIDE_T) {
        const p = easeInCubic(collideP);
        const bx = -baseR + (orbX + baseR) * p; // cobalt from off-left
        const rx = W + baseR - (W + baseR - orbX) * p; // crimson from off-right
        const sR = baseR * 0.62;
        ctx.drawImage(G.blue, bx - sR * 2, orbY - sR * 2, sR * 4, sR * 4);
        ctx.drawImage(G.white, bx - sR * 0.7, orbY - sR * 0.7, sR * 1.4, sR * 1.4);
        if (Math.random() < 0.6) debris.push({ a: Math.random() * TAU, r: sR * (2 + Math.random() * 1.5), born: t });
        ctx.drawImage(G.crimson, rx - sR * 2, orbY - sR * 2, sR * 4, sR * 4);
        ctx.drawImage(G.white, rx - sR * 0.6, orbY - sR * 0.6, sR * 1.2, sR * 1.2);
        if (Math.random() < 0.35) bolts.push(mkBolt(rx, orbY, sR * 0.8, false));
        // implosion streaks spiralling into the cobalt sphere — one batched path
        ctx.strokeStyle = "rgba(120,170,255,0.75)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = debris.length - 1; i >= 0; i--) {
          const d = debris[i];
          const age = t - d.born;
          const rr = d.r * (1 - age * 1.8);
          if (age > 0.5 || rr <= 2) { debris.splice(i, 1); continue; }
          const aa = d.a + age * 7;
          ctx.moveTo(bx + Math.cos(aa) * rr, orbY + Math.sin(aa) * rr);
          ctx.lineTo(bx + Math.cos(aa + 0.28) * (rr + 8), orbY + Math.sin(aa + 0.28) * (rr + 8));
        }
        ctx.stroke();
      }

      // ── impact: flash + shockwaves + chromatic aberration ──
      if (impact) {
        const fp = 1 - (cyc - COLLIDE_T) / 0.28;
        ctx.globalAlpha = fp * 0.8;
        ctx.drawImage(G.white, orbX - R * 3, orbY - R * 3, R * 6, R * 6);
        ctx.globalAlpha = 1;
        if (rings.length < 8 && Math.random() < 0.5) rings.push({ born: t, speed: 300 + Math.random() * 220, width: 2 + Math.random() * 3, alpha: 0.5 });
        if (Math.random() < 0.8) bolts.push(mkBolt(orbX, orbY, R, true));
        ctx.globalAlpha = fp * 0.5;
        ctx.drawImage(G.crimson, orbX - R * 1.5 + 4, orbY - R * 1.5, R * 3, R * 3);
        ctx.drawImage(G.blue, orbX - R * 1.5 - 4, orbY - R * 1.5, R * 3, R * 3);
        ctx.globalAlpha = 1;
      }

      // ── the singularity orb ──
      ctx.globalAlpha = orbAlpha;
      ctx.drawImage(G.violet, orbX - R * 2.1, orbY - R * 2.1, R * 4.2, R * 4.2);
      ctx.drawImage(G.magenta, orbX - R * 1.35, orbY - R * 1.35, R * 2.7, R * 2.7);
      ctx.drawImage(G.white, orbX - R * 0.62, orbY - R * 0.62, R * 1.24, R * 1.24);
      ctx.globalAlpha = 1;

      // hex lattice flicker wrapped on the orb
      if (cyc >= COLLIDE_T) {
        const flick = 0.16 + 0.14 * Math.sin(t * 5.1) + 0.1 * Math.sin(t * 13.7);
        ctx.globalAlpha = Math.max(0, flick) * easeOutExpo(bloom);
        const hs = R * 2 + 8;
        ctx.save();
        ctx.translate(orbX, orbY);
        ctx.rotate(t * 0.22);
        ctx.drawImage(hexSprite, -hs / 2, -hs / 2, hs, hs);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // shockwave rings — clipped OUT of the avatar disc so the face stays clear
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(ax, ay, arad, 0, TAU, true);
      ctx.clip("evenodd");
      for (let i = rings.length - 1; i >= 0; i--) {
        const rg = rings[i];
        const age = t - rg.born;
        const rr = R + age * rg.speed;
        const aa = rg.alpha * (1 - age / 1.6);
        if (aa <= 0 || rr > Math.max(W, H) * 1.2) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(180,90,255,${aa})`;
        ctx.lineWidth = rg.width;
        ctx.beginPath();
        ctx.arc(orbX, orbY, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      if (Math.random() < dt * 0.5 && rings.length < 5) rings.push({ born: t, speed: 110, width: 1.5, alpha: 0.2 });

      // lightning — two batched passes (dark violet halo, white-hot core)
      if (Math.random() < dt * 1.1 && cyc > COLLIDE_T) bolts.push(mkBolt(orbX, orbY, R, false));
      if (bolts.length) {
        const drawPass = (style: string, width: number) => {
          ctx.strokeStyle = style;
          ctx.lineWidth = width;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.beginPath();
          for (const b of bolts) {
            if (t - b.born > b.life) continue;
            ctx.moveTo(b.pts[0][0], b.pts[0][1]);
            for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
          }
          ctx.stroke();
        };
        drawPass("rgba(60,8,90,0.9)", 4);
        drawPass("rgba(240,210,255,0.95)", 1.4);
        bolts = bolts.filter((b) => t - b.born <= b.life);
      }

      // six-eyes motif — two pale slits pulsing TWICE per cycle (an early
      // whisper, then a brighter stare), as the shop copy promises
      const eyeWin = (at: number) => {
        const p = clamp01((cyc - CYCLE * at) / 0.5);
        return p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
      };
      const eyeA = Math.max(eyeWin(0.3) * 0.3, eyeWin(0.62) * 0.45);
      if (eyeA > 0.01) {
        ctx.globalAlpha = eyeA;
        const ew = R * 0.9;
        const eh = R * 0.09;
        const gap = R * 0.62;
        const ey = Math.max(12, orbY - R * 1.55);
        for (const s of [-1, 1]) {
          const ex = orbX + s * gap;
          ctx.save();
          ctx.translate(ex, ey);
          ctx.scale(1, eh / ew);
          // Gradient at the ORIGIN: canvas gradients are mapped through the
          // transform active at PAINT time, so defining this at (ex, ey) while
          // also translating there would land it off-path (invisible slits).
          const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, ew / 2);
          grd.addColorStop(0, "rgba(190,250,255,0.9)");
          grd.addColorStop(1, "rgba(190,250,255,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(0, 0, ew / 2, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      // wispy tendrils curling around the avatar's rim — one batched path
      ctx.strokeStyle = "rgba(167,36,240,0.26)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const base = t * (0.35 + i * 0.12) + (i * TAU) / 3;
        let px = ax + Math.cos(base) * (arad + 8);
        let py = ay + Math.sin(base) * (arad + 5);
        ctx.moveTo(px, py);
        for (let s = 1; s <= 10; s++) {
          const aa = base + s * 0.5;
          const rr = arad + 8 + Math.sin(t * 1.3 + i * 2 + s) * 6 + s * 1.2;
          px = ax + Math.cos(aa) * rr;
          py = ay + Math.sin(aa) * rr * 0.85;
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      ctx.restore();
      if (!paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // The two "not being seen" signals are tracked SEPARATELY so a tab
    // hide→show can't resume a loop the IntersectionObserver had parked
    // while the card was scrolled off-screen (and vice versa).
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
    const onVis = () => { hidden = document.hidden; sync(); };
    document.addEventListener("visibilitychange", onVis);
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => { offscreen = !e.isIntersecting; sync(); }, { threshold: 0 })
        : null;
    io?.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [canvasRef]);
}

// ── Card-level: the imaginary-mass singularity, anchored INSIDE the card ─────

export function HollowCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useHollowCanvas(canvasRef);

  return (
    <>
      {/* void wash — deep violet over near-black, behind the card's text */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 55% 20%, rgba(46,10,70,0.85), rgba(12,7,20,0.66) 55%, rgba(8,6,13,0.5) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.94] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 62% 22%, rgba(167,36,240,0.16), transparent 65%)" }}
        animate={{ opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* spheres, orb, shockwaves, lattice, lightning, motes, tendrils */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* one-shot: the birth flash the instant the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(70% 55% at 55% 25%, rgba(255,255,255,0.85), rgba(199,36,240,0.35) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.85, 0, 0.3, 0] }}
        transition={{ duration: 2.1, times: [0, 0.5, 0.58, 0.75, 0.85, 1], ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the strongest ─────────────────────────────────

export function HollowAvatarMark() {
  // Register so the singularity keeps this avatar's disc clear + wraps
  // tendrils around it.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    HOLLOW_ANCHORS.add(el);
    return () => {
      HOLLOW_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* breathing glow: cobalt → hollow violet → crimson, the technique's recipe */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(8,6,16,0.9), 0 0 26px 8px rgba(27,79,224,0.45)",
            "0 0 16px 5px rgba(8,6,16,0.95), 0 0 42px 13px rgba(167,36,240,0.55)",
            "0 0 13px 4px rgba(8,6,16,0.9), 0 0 30px 9px rgba(224,27,60,0.45)",
            "0 0 12px 3px rgba(8,6,16,0.9), 0 0 26px 8px rgba(27,79,224,0.45)",
          ],
        }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
