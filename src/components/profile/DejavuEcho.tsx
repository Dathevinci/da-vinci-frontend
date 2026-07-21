"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Dejavu: Temporal Echo" — the LIMITED SSS-grade effect_dejavu.
 *
 * A dark-fantasy time distortion that plays across the whole profile card:
 *   1 · The Uncertainty Principle — a volatile quantum particle field orbits
 *       the avatar; every ~3 s translucent, glitchy ghost clones of the
 *       avatar ring split off, drift away and SNAP back — a memory repeating.
 *   2 · Relativity Rings — three massive slow-rotating dilation rings carry
 *       faint glowing runic physics equations (fillText along the arc).
 *   3 · The Psychological Shatter — every 8-12 s reality violently tears
 *       horizontally for 0.2 s (self drawImage band slicing), then 4-5
 *       jagged blood-red bezier threads crack out from the avatar.
 *   4 · The Void Ashes — grey ash falls UPWARD on a sine drift, like the
 *       profile is suspended in a frozen moment.
 *
 * Like CrimsonRealm/InfiniteVoid, the canvas is a CHILD of the profile card
 * (never a viewport-fixed portal) so the distortion scrolls locked to the
 * card, and the avatar is tracked live through the DEJAVU_ANCHORS registry.
 */

// The avatar registers here; the echo centers on the largest visible one.
const DEJAVU_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const rand = (i: number, s: number) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const EQUATIONS = [
  "Δt′ = γΔt", "E = mc²", "t′ = t/√(1−v²/c²)", "S = k·log W",
  "ds² = −c²dt² + dx²", "∇×E = −∂B/∂t", "ψ(x,t) = Ae^{i(kx−ωt)}",
  "ᚠᚢᚦᚨᚱᚲ", "τ = ∫√(1−v²/c²)dt", "ᛞᛖᛃᚨᚹᚢ", "G = 8πT", "Δx·Δp ≥ ℏ/2",
];

type Ghost = { born: number; life: number; dx: number; dy: number; scale: number; glitch: boolean };
type Thread = { pts: [number, number][]; w: number; seed: number };

function useDejavuCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — the echo stays locked to
      // the card while scrolling, exactly like a Discord profile effect.
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

    // PHASE 1 · quantum orbit field
    const QN = 56;
    const quanta = Array.from({ length: QN }, (_, i) => ({
      baseAng: rand(i, 1) * TAU,
      speed: (0.25 + rand(i, 2) * 0.9) * (i % 2 ? 1 : -1),
      rBase: 1.06 + rand(i, 3) * 0.38,
      wobAmp: 3 + rand(i, 4) * 8,
      wobFreq: 0.8 + rand(i, 5) * 2.4,
      size: 0.6 + rand(i, 6) * 1.6,
      hue: rand(i, 7),
      jitterSeed: rand(i, 8) * 100,
    }));
    const ghosts: Ghost[] = [];
    let nextGhostAt = 1.4;

    // PHASE 2 · dilation rings
    const RINGS = [
      { rMul: 2.0, speed: 0.05, alpha: 0.30, font: 10, eqOff: 0 },
      { rMul: 2.9, speed: -0.033, alpha: 0.22, font: 11, eqOff: 4 },
      { rMul: 3.9, speed: 0.021, alpha: 0.15, font: 12, eqOff: 8 },
    ];

    // PHASE 3 · shatter
    let nextShatterAt = 5.5;
    let shatterStart = -99;
    let threads: Thread[] = [];

    // PHASE 4 · ash (anti-gravity)
    const AN = 70;
    const ashes = Array.from({ length: AN }, (_, i) => ({
      x: rand(i, 11), y: rand(i, 12),
      v: 8 + rand(i, 13) * 24,
      driftAmp: 6 + rand(i, 14) * 18,
      driftFreq: 0.15 + rand(i, 15) * 0.5,
      phase: rand(i, 16) * TAU,
      size: 0.6 + rand(i, 17) * 1.9,
      grey: 55 + Math.floor(rand(i, 18) * 130),
      alpha: 0.12 + rand(i, 19) * 0.36,
    }));

    let t = 0;
    let last = performance.now();
    let raf = 0;
    let paused = false;

    const spawnGhosts = (now: number) => {
      const n = 2 + Math.floor(Math.random() * 2); // 2-3
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * TAU;
        ghosts.push({
          born: now,
          life: 1.6 + Math.random() * 0.9,
          dx: Math.cos(ang) * (14 + Math.random() * 26),
          dy: Math.sin(ang) * (10 + Math.random() * 20),
          scale: 1 + Math.random() * 0.14,
          glitch: Math.random() < 0.5,
        });
      }
    };

    const spawnThreads = (cx: number, cy: number) => {
      threads = [];
      const n = 4 + Math.floor(Math.random() * 2); // 4-5
      for (let i = 0; i < n; i++) {
        let a = (i / n) * TAU + Math.random() * 0.9;
        const reach = Math.max(W, H) * (0.4 + Math.random() * 0.4);
        const pts: [number, number][] = [[cx, cy]];
        let px = cx, py = cy;
        for (let s = 1; s <= 3; s++) {
          a += (Math.random() - 0.5) * 1.5;
          const seg = (reach / 3) * (0.7 + Math.random() * 0.6);
          px += Math.cos(a) * seg;
          py += Math.sin(a) * seg;
          pts.push([px, py]);
        }
        threads.push({ pts, w: 1.1 + Math.random() * 1.5, seed: Math.random() * 10 });
      }
    };

    const frame = (now: number) => {
      const rdt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += rdt;

      // time dilation breathes: the world slows, then releases — eerie
      const dilation = 0.55 + 0.45 * easeInOutSine((Math.sin(t * 0.21) + 1) / 2);

      ctx.clearRect(0, 0, W, H);

      // epicenter — the largest registered avatar, in canvas-LOCAL coordinates
      const cRect = canvas.getBoundingClientRect();
      let cx = W / 2;
      let cy = H * 0.3;
      let ar = 44;
      let best = 0;
      DEJAVU_ANCHORS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          cx = r.left - cRect.left + r.width / 2;
          cy = r.top - cRect.top + r.height / 2;
          ar = r.width / 2;
        }
      });

      // PHASE 4 — void ashes (back layer, non-additive)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (const a of ashes) {
        const y = ((a.y * H - t * a.v * dilation) % (H + 40) + H + 40) % (H + 40) - 20;
        const x = a.x * W + Math.sin(t * a.driftFreq * TAU + a.phase) * a.driftAmp;
        const g = a.grey;
        ctx.fillStyle = `rgba(${g},${g},${g + 6},${a.alpha})`;
        ctx.beginPath(); ctx.arc(x, y, a.size, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // PHASE 2 — relativity rings + runic equations (additive)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let ri = 0; ri < RINGS.length; ri++) {
        const ring = RINGS[ri];
        const R = ar * ring.rMul + Math.sin(t * 0.4 + ri) * 5;
        const rot = t * ring.speed * dilation + ri * 1.7;

        ctx.strokeStyle = `rgba(156,163,175,${ring.alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        for (let k = 0; k < 24; k++) {
          const a = rot * 1.5 + (k / 24) * TAU;
          ctx.strokeStyle = `rgba(0,255,255,${ring.alpha * 0.6})`;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3));
          ctx.lineTo(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3));
          ctx.stroke();
        }

        ctx.font = `${ring.font}px "Courier New", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let e = 0; e < 4; e++) {
          const eq = EQUATIONS[(ring.eqOff + e) % EQUATIONS.length];
          const startAng = rot + (e / 4) * TAU;
          const step = (ring.font * 0.78) / R;
          for (let cI = 0; cI < eq.length; cI++) {
            const a = startAng + cI * step;
            const x = cx + Math.cos(a) * R;
            const y = cy + Math.sin(a) * R;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a + Math.PI / 2);
            const flicker = 0.72 + 0.28 * Math.sin(t * 2.2 + cI * 1.7 + e * 9 + ri * 30);
            ctx.fillStyle = (cI + e) % 7 === 0
              ? `rgba(139,0,0,${ring.alpha * 1.35 * flicker})`
              : `rgba(103,232,249,${ring.alpha * flicker})`;
            ctx.shadowColor = "#00ffff";
            ctx.shadowBlur = 6;
            ctx.fillText(eq[cI], 0, 0);
            ctx.restore();
          }
        }
      }
      ctx.restore();

      // PHASE 1 — quantum orbit field (additive, Heisenberg jitter)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < QN; i++) {
        const q = quanta[i];
        const ang = q.baseAng + t * q.speed * dilation;
        const wob = Math.sin(t * q.wobFreq + q.jitterSeed) * q.wobAmp + (Math.random() - 0.5) * 1.6;
        const r = ar * q.rBase + wob;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        const tw = 0.45 + 0.55 * Math.sin(t * 3 + q.jitterSeed);
        ctx.fillStyle = q.hue < 0.7
          ? `rgba(0,255,255,${0.5 * tw})`
          : `rgba(249,250,251,${0.65 * tw})`;
        ctx.shadowColor = q.hue < 0.7 ? "#00ffff" : "#f9fafb";
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, q.size, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // PHASE 1 — afterimage ghosts: drift out, snap back
      if (t >= nextGhostAt) { spawnGhosts(t); nextGhostAt = t + 3 + Math.random() * 0.4; }
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i];
        const p = (t - g.born) / g.life;
        if (p >= 1) { ghosts.splice(i, 1); continue; }
        let k;
        if (p < 0.55) k = easeOutExpo(p / 0.55);
        else k = 1 - easeOutExpo((p - 0.55) / 0.45);
        const alpha = p < 0.55 ? 0.5 : 0.5 * (1 - (p - 0.55) / 0.45);
        const gx = cx + g.dx * k + (g.glitch ? (Math.random() - 0.5) * 3 : 0);
        const gy = cy + g.dy * k;
        const gr = ar * (1 + (g.scale - 1) * k) + 2;
        ctx.save();
        ctx.globalAlpha = Math.max(alpha, 0) * 0.85;
        ctx.filter = "blur(4px)";
        ctx.strokeStyle = "rgba(229,231,235,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.stroke();
        ctx.strokeStyle = g.glitch ? "rgba(139,0,0,0.9)" : "rgba(0,255,255,0.8)";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(gx + (g.glitch ? 2.5 : -2), gy, gr, 0, TAU); ctx.stroke();
        ctx.restore();
      }

      // PHASE 3 — schedule the shatter
      if (t >= nextShatterAt) {
        shatterStart = t;
        spawnThreads(cx, cy);
        nextShatterAt = t + 8 + Math.random() * 4; // every 8-12 s
      }

      // PHASE 3 — blood-red threads (source-over: dark, not additive)
      const sdt = t - shatterStart;
      if (sdt >= 0.06 && sdt <= 3.4) {
        const grow = easeOutExpo(Math.min((sdt - 0.06) / 0.5, 1));
        const fade = sdt > 2.2 ? 1 - (sdt - 2.2) / 1.2 : 1;
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        for (const th of threads) {
          const [p0, p1, p2, p3] = th.pts;
          const j = (k: number) => Math.sin(t * 17 + th.seed + k * 5) * 2.2;
          ctx.strokeStyle = `rgba(139,0,0,${0.85 * fade})`;
          ctx.lineWidth = th.w;
          ctx.lineCap = "round";
          ctx.shadowColor = "#8B0000";
          ctx.shadowBlur = 9;
          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.bezierCurveTo(
            p1[0] + j(1), p1[1] + j(2),
            p2[0] + j(3), p2[1] + j(4),
            p0[0] + (p3[0] - p0[0]) * grow, p0[1] + (p3[1] - p0[1]) * grow);
          ctx.stroke();
          ctx.strokeStyle = `rgba(248,113,113,${0.35 * fade})`;
          ctx.lineWidth = 0.6;
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        ctx.restore();
      }

      // PHASE 3 — the 0.2 s horizontal tear: slice the live canvas into bands
      // and redraw them offset (raw pixel space so DPR doesn't double-scale).
      if (sdt >= 0 && sdt <= 0.2) {
        const bands = 12;
        const bandH = canvas.height / bands;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let b = 0; b < bands; b++) {
          const off = (Math.random() - 0.5) * 70 * (1 - sdt / 0.2);
          ctx.drawImage(canvas,
            0, b * bandH, canvas.width, bandH,
            off, b * bandH, canvas.width, bandH);
        }
        for (let i = 0; i < 8; i++) {
          const y = Math.random() * canvas.height;
          ctx.fillStyle = i % 2 ? "rgba(139,0,0,0.5)" : "rgba(0,255,255,0.35)";
          ctx.fillRect(0, y, canvas.width, 1 + Math.random() * 2.5);
        }
        ctx.restore();
        // crimson flash bathes the card the instant reality tears
        ctx.fillStyle = `rgba(139,0,0,${0.16 * Math.random()})`;
        ctx.fillRect(0, 0, W, H);
      }

      if (!paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Pause when the echo isn't being seen (tab hidden / card off-screen) —
    // zero visual change while viewing; reset `last` on resume so the clock
    // doesn't jump forward.
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

// ── Card-level: the temporal echo, anchored INSIDE the card ──────────────────

export function DejavuCardEcho() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useDejavuCanvas(canvasRef);

  return (
    <>
      {/* the void swallows the card — pitch black with an ashen heart */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 30%, rgba(8,8,12,0.92), rgba(6,6,10,0.72) 55%, rgba(4,4,8,0.5) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.94] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 40%, rgba(139,0,0,0.10), transparent 65%)" }}
        animate={{ opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the quantum field, dilation rings, tear and red threads */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* one-shot: a phantom-white flicker the instant the memory repeats */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(70% 60% at 50% 35%, rgba(229,231,235,0.7), rgba(0,255,255,0.2) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0, 0.25, 0] }}
        transition={{ duration: 1.7, times: [0, 0.1, 0.4, 0.55, 1], ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the one who remembers ──────────────────────────

export function DejavuAvatarMark() {
  // Register so the quantum field + ghosts center on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    DEJAVU_ANCHORS.add(el);
    return () => {
      DEJAVU_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* breathing phantom glow: ash white cut by crimson and quantum cyan */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(10,10,14,0.9), 0 0 24px 7px rgba(156,163,175,0.35)",
            "0 0 15px 4px rgba(10,10,14,0.95), 0 0 38px 12px rgba(0,255,255,0.4)",
            "0 0 14px 4px rgba(10,10,14,0.95), 0 0 34px 10px rgba(139,0,0,0.5)",
            "0 0 12px 3px rgba(10,10,14,0.9), 0 0 24px 7px rgba(156,163,175,0.35)",
          ],
        }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
