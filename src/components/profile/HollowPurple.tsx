"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Hollow Purple" (Kyoshiki Murasaki) — the SSS-grade effect_hollow.
 *
 * A 4-phase cinematic, not a static orb. It ORIGINATES on the avatar's border
 * and then erases the card:
 *
 *   I · CONVERGENCE — Lapse Blue spawns on the avatar's left edge, Reversal Red
 *       on the right. They orbit the profile picture, spinning up exponentially,
 *       trailing after-images, while jagged cursed-energy arcs snap off both
 *       orbs and whip around the avatar's rim.
 *   II · THE SPARK — they smash together in the avatar's dead centre and ALL
 *       motion suspends for the anime micro-silence: a violently shaking,
 *       ultra-dense black-and-purple vortex around a white-hot pinpoint.
 *   III · HOLLOW PURPLE — a colossal sphere erupts and engulfs the whole card:
 *       blinding white core, thick neon-violet body, aggressive torn black rim,
 *       lightning lashing along the shell, chromatic blue/red fringing being
 *       ripped apart — with a violent 0.4s shake.
 *   IV · SPACE SHATTER — jagged white cracks tear across the card as space
 *       gives out under the imaginary mass, then high-velocity violet embers
 *       blow sideways: the erased trench left behind.
 *
 * Then it resets seamlessly (~8.2s cycle).
 *
 * Perf: NO shadowBlur / ctx.filter anywhere in the loop — every glow is a
 * pre-rendered radial sprite drawn additively, and every batch of identical
 * strokes is one path + one stroke. Card-anchored (never a viewport-fixed
 * portal); the shake is applied to the CANVAS, never to parentElement (framer
 * owns that transform in the shop preview).
 */

// The avatar registers here; the technique originates on the largest one's rim.
const HOLLOW_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const easeInExpo = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// phase clock
const P1 = 3.4;
const P2 = 0.42;
const P3 = 1.3;
const P4 = 3.05;
const T1 = P1;
const T2 = T1 + P2;
const T3 = T2 + P3;
const CYCLE = T3 + P4;

type Poly = [number, number][];
type Crack = { pts: Poly; w: number; delay: number };
type Ember = { x: number; y: number; vx: number; vy: number; s: number; life: number; age: number; hot: boolean };

function useHollowCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DIAG = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — the technique stays locked
      // to the card while scrolling, like a Discord profile effect.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      DIAG = Math.hypot(W, H);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // ── pre-rendered radial glow sprites ──
    const makeGlow = (rgb: string, core: boolean) => {
      const s = 128;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, `rgba(255,255,255,${core ? 1 : 0.95})`);
      grad.addColorStop(core ? 0.16 : 0.1, `rgba(${rgb},1)`);
      grad.addColorStop(0.42, `rgba(${rgb},0.42)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const SPR = {
      azure: makeGlow("0,191,255", true),
      crimson: makeGlow("255,0,0", true),
      violet: makeGlow("138,43,226", false),
      white: makeGlow("235,225,255", true),
    };

    // ── procedural cursed-energy arcs ──
    const makeArc = (x0: number, y0: number, x1: number, y1: number, segs: number, chaos: number): Poly => {
      const pts: Poly = [[x0, y0]];
      for (let i = 1; i < segs; i++) {
        const k = i / segs;
        const nx = -(y1 - y0);
        const ny = x1 - x0;
        const nl = Math.hypot(nx, ny) || 1;
        const off = (Math.random() - 0.5) * chaos * Math.sin(k * Math.PI);
        pts.push([lerp(x0, x1, k) + (nx / nl) * off, lerp(y0, y1, k) + (ny / nl) * off]);
      }
      pts.push([x1, y1]);
      return pts;
    };
    const makeRimArc = (cx: number, cy: number, r: number, a0: number, span: number, chaos: number): Poly => {
      const pts: Poly = [];
      for (let i = 0; i <= 9; i++) {
        const a = a0 + span * (i / 9);
        const rr = r + (Math.random() - 0.5) * chaos;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      return pts;
    };
    const strokePolys = (polys: Poly[], color: string, width: number, alpha: number) => {
      if (!polys.length || alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const p of polys) {
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // ── space-shatter cracks, rebuilt once per cycle at the eruption ──
    let cracks: Crack[] = [];
    const buildCracks = (cx: number, cy: number) => {
      cracks = [];
      const main = 9;
      for (let i = 0; i < main; i++) {
        const a = (i / main) * TAU + Math.random() * 0.5;
        const len = DIAG * (0.55 + Math.random() * 0.5);
        const pts: Poly = [[cx, cy]];
        let x = cx;
        let y = cy;
        let ang = a;
        for (let s = 0; s < 7; s++) {
          ang += (Math.random() - 0.5) * 0.5;
          const seg = len / 7;
          x += Math.cos(ang) * seg;
          y += Math.sin(ang) * seg;
          pts.push([x, y]);
        }
        cracks.push({ pts, w: 1.1 + Math.random() * 2, delay: Math.random() * 0.22 });
        const bn = 1 + ((Math.random() * 2) | 0);
        for (let b = 0; b < bn; b++) {
          const at = 2 + ((Math.random() * (pts.length - 3)) | 0);
          let bx = pts[at][0];
          let by = pts[at][1];
          let bang = ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7);
          const bpts: Poly = [[bx, by]];
          const bsteps = 3 + ((Math.random() * 3) | 0);
          for (let s = 0; s < bsteps; s++) {
            bang += (Math.random() - 0.5) * 0.6;
            const seg = DIAG * 0.09 * (0.6 + Math.random() * 0.8);
            bx += Math.cos(bang) * seg;
            by += Math.sin(bang) * seg;
            bpts.push([bx, by]);
          }
          cracks.push({ pts: bpts, w: 0.7 + Math.random(), delay: 0.1 + Math.random() * 0.3 });
        }
      }
    };

    // ── embers: the erased trench blowing sideways ──
    let embers: Ember[] = [];
    const seedEmbers = (cx: number, cy: number) => {
      embers = [];
      for (let i = 0; i < 120; i++) {
        const a = Math.random() * TAU;
        embers.push({
          x: cx + Math.cos(a) * Math.random() * 70,
          y: cy + Math.sin(a) * Math.random() * 70,
          vx: (Math.random() < 0.5 ? -1 : 1) * (170 + Math.random() * 520),
          vy: (Math.random() - 0.5) * 70 - 14,
          s: 1.1 + Math.random() * 3,
          life: 1.1 + Math.random() * 1.8,
          age: 0,
          hot: Math.random() < 0.22,
        });
      }
    };

    let t = 0;
    let last = performance.now();
    let raf = 0;
    let paused = false;
    let cycleIndex = -1;
    let shakeUntil = -1;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      const cyc = t % CYCLE;
      const idx = Math.floor(t / CYCLE);

      // the avatar is the origin — tracked live, in canvas-local coordinates
      const cRect = canvas.getBoundingClientRect();
      let ax = W * 0.28;
      let ay = H * 0.22;
      let arad = 58;
      let best = 0;
      HOLLOW_ANCHORS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          arad = r.width / 2;
        }
      });

      if (idx !== cycleIndex && cyc >= T2) {
        cycleIndex = idx;
        buildCracks(ax, ay);
        seedEmbers(ax, ay);
        shakeUntil = t + 0.4;
      }

      ctx.clearRect(0, 0, W, H);

      // ── I · CONVERGENCE ──
      if (cyc < T1) {
        const p = cyc / P1;
        const spin = easeInExpo(p) * 26 + p * 5;
        const orbitR = arad * 1.06 * (1 - easeInExpo(p) * 0.99);
        const orbR = lerp(arad * 0.32, arad * 0.48, easeOutCubic(p));
        const bA = Math.PI + spin;
        const rA = spin;
        const bx = ax + Math.cos(bA) * orbitR;
        const by = ay + Math.sin(bA) * orbitR;
        const rx = ax + Math.cos(rA) * orbitR;
        const ry = ay + Math.sin(rA) * orbitR;

        ctx.globalCompositeOperation = "lighter";

        // after-image trails sell the exponential spin-up
        for (let k = 5; k >= 1; k--) {
          const lagA = spin - k * (0.16 + p * 0.3);
          ctx.globalAlpha = (0.16 / k) * (0.4 + p);
          const tbx = ax + Math.cos(Math.PI + lagA) * orbitR;
          const tby = ay + Math.sin(Math.PI + lagA) * orbitR;
          const trx = ax + Math.cos(lagA) * orbitR;
          const try_ = ay + Math.sin(lagA) * orbitR;
          ctx.drawImage(SPR.azure, tbx - orbR, tby - orbR, orbR * 2, orbR * 2);
          ctx.drawImage(SPR.crimson, trx - orbR, try_ - orbR, orbR * 2, orbR * 2);
        }
        ctx.globalAlpha = 1;

        const pulse = 1 + 0.09 * Math.sin(t * 22);
        const sz = orbR * 1.55 * pulse;
        ctx.drawImage(SPR.azure, bx - sz, by - sz, sz * 2, sz * 2);
        ctx.drawImage(SPR.crimson, rx - sz, ry - sz, sz * 2, sz * 2);

        // cursed energy: arcs off each orb + whipping round the avatar rim
        const inten = 0.35 + p * 0.65;
        const rim: Poly[] = [];
        const core: Poly[] = [];
        const nArc = 2 + Math.round(p * 4);
        for (let i = 0; i < nArc; i++) {
          const ll = arad * (0.5 + Math.random() * 0.9);
          const la = Math.random() * TAU;
          core.push(makeArc(bx, by, bx + Math.cos(la) * ll, by + Math.sin(la) * ll, 6, arad * 0.5));
          const la2 = Math.random() * TAU;
          core.push(makeArc(rx, ry, rx + Math.cos(la2) * ll, ry + Math.sin(la2) * ll, 6, arad * 0.5));
        }
        for (let i = 0; i < 3; i++) {
          rim.push(makeRimArc(ax, ay, arad + 5, Math.random() * TAU, 0.7 + Math.random() * 1.5, 11 * inten));
        }
        strokePolys(rim, "rgba(150,90,255,0.55)", 4.5, inten * 0.8);
        strokePolys(rim, "rgba(240,225,255,0.95)", 1.4, inten);
        strokePolys(core, "rgba(90,160,255,0.5)", 3.2, inten * 0.7);
        strokePolys(core, "rgba(255,255,255,0.95)", 1.2, inten);

        // the space between them begins to glow violet as they close
        if (p > 0.45) {
          const g = (p - 0.45) / 0.55;
          ctx.globalAlpha = g * 0.7;
          const vr = arad * (0.5 + g * 1.1);
          ctx.drawImage(SPR.violet, ax - vr, ay - vr, vr * 2, vr * 2);
          ctx.globalAlpha = 1;
        }
      }

      // ── II · THE SPARK (all motion suspended; the vortex shakes) ──
      else if (cyc < T2) {
        const p = (cyc - T1) / P2;
        const jx = (Math.random() - 0.5) * 7;
        const jy = (Math.random() - 0.5) * 7;

        ctx.globalCompositeOperation = "lighter";
        const cr = arad * (0.3 + 0.08 * Math.sin(p * 40));
        ctx.drawImage(SPR.white, ax + jx - cr, ay + jy - cr, cr * 2, cr * 2);

        // ultra-dense black + purple vortex — source-over so the black reads
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = 2;
        for (let i = 0; i < 42; i++) {
          const a = (i / 42) * TAU + p * 26 + Math.random() * 0.1;
          const r0 = arad * (0.16 + Math.random() * 0.2);
          const r1 = r0 + arad * (0.3 + Math.random() * 0.55);
          ctx.strokeStyle = i % 3 === 0 ? "rgba(6,2,12,0.92)" : "rgba(96,26,168,0.75)";
          ctx.beginPath();
          ctx.moveTo(ax + jx + Math.cos(a) * r0, ay + jy + Math.sin(a) * r0);
          ctx.lineTo(ax + jx + Math.cos(a) * r1, ay + jy + Math.sin(a) * r1);
          ctx.stroke();
        }

        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.85;
        const hr = arad * 0.95;
        ctx.drawImage(SPR.violet, ax + jx - hr, ay + jy - hr, hr * 2, hr * 2);
        ctx.globalAlpha = 1;
      }

      // ── III · HOLLOW PURPLE (the eruption engulfs the card) ──
      else if (cyc < T3) {
        const p = (cyc - T2) / P3;
        const grow = easeOutExpo(Math.min(p * 1.35, 1));
        const R = arad * 0.3 + grow * DIAG * 0.8;
        // peak is deliberately brief so the card's own text stays legible
        const fade = p > 0.5 ? clamp01(1 - (p - 0.5) / 0.5) : 1;

        // aggressive torn black rim, behind the light
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * 0.9;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * TAU;
          const rr = R * (1 + (i % 2 ? 0.11 : 0.02) + Math.sin(i * 3.7 + t * 9) * 0.035);
          const x = ax + Math.cos(a) * rr;
          const y = ay + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(24,4,44,0.95)";
        ctx.lineWidth = Math.max(3, R * 0.05);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // layered radial gradient: blinding core → neon violet → void
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, R);
        g.addColorStop(0.0, `rgba(255,255,255,${0.9 * fade})`);
        g.addColorStop(0.13, `rgba(246,232,255,${0.82 * fade})`);
        g.addColorStop(0.3, `rgba(190,110,255,${0.66 * fade})`);
        g.addColorStop(0.58, `rgba(138,43,226,${0.4 * fade})`);
        g.addColorStop(0.82, `rgba(74,16,132,${0.19 * fade})`);
        g.addColorStop(1.0, "rgba(10,2,20,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ax, ay, R, 0, TAU);
        ctx.fill();

        // the blue/red being torn apart (chromatic split)
        ctx.globalAlpha = fade * 0.5 * (1 - grow);
        const fr = R * 0.5;
        ctx.drawImage(SPR.azure, ax - fr - 12, ay - fr, fr * 2, fr * 2);
        ctx.drawImage(SPR.crimson, ax - fr + 12, ay - fr, fr * 2, fr * 2);
        ctx.globalAlpha = 1;

        // lightning lashing along the shell
        const bolts: Poly[] = [];
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * TAU;
          const r0 = R * 0.45;
          bolts.push(
            makeArc(ax + Math.cos(a) * r0, ay + Math.sin(a) * r0, ax + Math.cos(a) * R * 1.02, ay + Math.sin(a) * R * 1.02, 7, R * 0.16)
          );
        }
        strokePolys(bolts, "rgba(150,80,255,0.6)", 5, fade * 0.7);
        strokePolys(bolts, "rgba(255,250,255,0.95)", 1.6, fade);
      }

      // ── IV · SPACE SHATTER & DISSIPATION ──
      else {
        const p = (cyc - T3) / P4;
        const fade = p < 0.14 ? 1 : clamp01(1 - (p - 0.14) / 0.86);

        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = clamp01(1 - p * 2.6) * 0.8;
        const ar2 = DIAG * 0.5 * (1 - easeOutCubic(Math.min(p * 2.2, 1)) * 0.72);
        ctx.drawImage(SPR.violet, ax - ar2, ay - ar2, ar2 * 2, ar2 * 2);
        ctx.globalAlpha = 1;

        // space shatters — jagged white cracks, drawn source-over
        ctx.globalCompositeOperation = "source-over";
        const reveal = easeOutCubic(clamp01(p / 0.3));
        const halo: Poly[] = [];
        for (const c of cracks) {
          const rv = clamp01((reveal - c.delay) / (1 - c.delay));
          if (rv <= 0) continue;
          const upto = 1 + Math.floor(rv * (c.pts.length - 1));
          const seg = c.pts.slice(0, upto + 1);
          if (seg.length > 1) halo.push(seg);
        }
        strokePolys(halo, "rgba(120,50,210,0.5)", 5, fade * 0.5);
        strokePolys(halo, "rgba(255,255,255,0.95)", 1.3, fade * 0.9);

        // violet embers blown sideways — the erased trench
        ctx.globalCompositeOperation = "lighter";
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i];
          e.age += dt;
          if (e.age > e.life) {
            embers.splice(i, 1);
            continue;
          }
          e.vy += 26 * dt;
          e.vx *= 1 - 0.55 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          const s = e.s * 3.2;
          ctx.globalAlpha = (1 - e.age / e.life) * 0.8;
          ctx.drawImage(e.hot ? SPR.white : SPR.violet, e.x - s, e.y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = "source-over";

      // violent shake for 0.4s from the eruption — on the CANVAS, never on
      // parentElement (framer-motion owns that transform in the shop preview).
      if (t < shakeUntil) {
        const k = (shakeUntil - t) / 0.4;
        const m = 11 * k * k;
        canvas.style.transform = `translate(${((Math.random() - 0.5) * m).toFixed(2)}px,${((Math.random() - 0.5) * m).toFixed(2)}px)`;
      } else if (canvas.style.transform) {
        canvas.style.transform = "";
      }

      if (!paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      ro?.disconnect();
      io?.disconnect();
      canvas.style.transform = "";
    };
  }, [canvasRef]);
}

// ── Card-level: the technique, anchored INSIDE the card ─────────────────────

export function HollowCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useHollowCanvas(canvasRef);

  return (
    <>
      {/* void wash so the luminous energy pops, behind the card's text */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(30,6,52,0.88), rgba(10,4,18,0.7) 55%, rgba(5,3,10,0.55) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 28%, rgba(138,43,226,0.15), transparent 68%)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* convergence · spark · eruption · shatter */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the strongest ─────────────────────────────────

export function HollowAvatarMark() {
  // Register so the technique originates on THIS avatar's border.
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
      {/* Lapse Blue → Hollow Purple → Reversal Red, breathing on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(5,3,10,0.9), 0 0 26px 8px rgba(0,191,255,0.5)",
            "0 0 16px 5px rgba(5,3,10,0.95), 0 0 44px 14px rgba(138,43,226,0.6)",
            "0 0 13px 4px rgba(5,3,10,0.9), 0 0 30px 9px rgba(255,0,0,0.45)",
            "0 0 12px 3px rgba(5,3,10,0.9), 0 0 26px 8px rgba(0,191,255,0.5)",
          ],
        }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
