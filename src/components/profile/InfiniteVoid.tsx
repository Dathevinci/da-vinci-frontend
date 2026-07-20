"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Domain Expansion: Infinite Void" — the SSS-grade effect_void.
 *
 * A 4-phase cinematic that plays when the profile is opened:
 *   1 · Domain Expansion — an inverted black barrier with a blinding starlight
 *       rim erupts from the avatar (easeOutExpo — impossibly fast) and seals
 *       the card.
 *   2 · The Cosmic Eye — a blinding white singularity ringed by a slowly
 *       rotating iris of deep indigo and cyan fades in behind the avatar.
 *   3 · Infinite Information — 700 glowing motes / streaks / data-glyphs erupt
 *       outward along golden-angle fractal spirals.
 *   4 · Stasis — the flow of time collapses by 95%: the storm freezes mid-air
 *       and hangs, drifting microscopically, while the eye keeps pulsing with
 *       a calm, terrifying glow on real time.
 *
 * Like CrimsonRealm, the canvas is a CHILD of the profile card (never a
 * viewport-fixed portal) so the whole domain scrolls locked to the profile,
 * and the avatar is tracked live through the VOID_ANCHORS registry.
 */

// The avatar registers here; the domain centers on the largest visible one.
const VOID_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const rand = (i: number, s: number) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const pcol = (h: number, a: number) =>
  h < 0.5 ? `rgba(255,255,255,${a})` : h < 0.85 ? `rgba(103,232,249,${a})` : `rgba(129,140,248,${a})`;

type Mote = {
  x: number; y: number; vx: number; vy: number;
  birth: number; size: number; type: number; hue: number;
  drift: number; rot: number; alive: boolean;
};

// state-machine timings (seconds since the profile opened)
const P1_DUR = 1.15;
const P2_AT = 0.85;
const P3_AT = 2.2;
const P4_AT = 4.6;
const P4_RAMP = 0.9;
const N = 700;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function useVoidCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — the domain stays locked to
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

    // ambient stars of the domain's cosmos
    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: rand(i, 1), y: rand(i, 2),
      r: 0.4 + rand(i, 3) * 1.3,
      tw: rand(i, 4) * TAU,
      sp: 0.4 + rand(i, 5) * 1.6,
    }));

    // the information flood
    const parts: Mote[] = new Array(N);
    let spawned = false;
    const spawnParticles = (cx: number, cy: number) => {
      for (let i = 0; i < N; i++) {
        const armAng = ((i % 6) / 6) * TAU;
        const ang = armAng + i * GOLDEN * 0.5; // golden-angle sweep → fractal arms
        const spd = 140 + rand(i, 6) * 400;
        const tang = 0.55; // tangential swirl → logarithmic-spiral flow
        parts[i] = {
          x: cx, y: cy,
          vx: Math.cos(ang) * spd + Math.cos(ang + Math.PI / 2) * spd * tang,
          vy: Math.sin(ang) * spd + Math.sin(ang + Math.PI / 2) * spd * tang,
          birth: (i / N) * 1.6,
          size: 0.7 + rand(i, 7) * 2.1,
          type: i % 5 === 0 ? 2 : i % 2, // 0 dot · 1 streak · 2 data-glyph
          hue: rand(i, 8),
          drift: rand(i, 9) * TAU,
          rot: rand(i, 10) * TAU,
          alive: false,
        };
      }
    };

    let elapsed = 0; // real time — the eye's calm clock
    let t = 0;       // domain time — collapses by 95% in stasis
    let timeScale = 1;
    let last = performance.now();
    let raf = 0;

    const drawEye = (cx: number, cy: number, R: number, a: number) => {
      const rot = elapsed * 0.06 + t * 0.18; // slows to a crawl, never dies
      const pulse = 1 + 0.035 * Math.sin(elapsed * 0.9); // breathes on REAL time

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;

      // deep-space halo
      let g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
      g.addColorStop(0, "rgba(129,140,248,0.30)");
      g.addColorStop(0.45, "rgba(49,46,129,0.35)");
      g.addColorStop(0.8, "rgba(30,27,75,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

      // swirling iris annulus (conic where supported)
      const irisOut = R * 0.62 * pulse;
      const irisIn = R * 0.3 * pulse;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      let iris: CanvasGradient;
      const anyCtx = ctx as any;
      if (typeof anyCtx.createConicGradient === "function") {
        iris = anyCtx.createConicGradient(0, 0, 0);
        for (let s = 0; s <= 24; s++) {
          iris.addColorStop(s / 24, s % 3 === 0 ? "rgba(255,255,255,0.55)" : s % 3 === 1 ? "rgba(34,211,238,0.50)" : "rgba(79,70,229,0.55)");
        }
      } else {
        iris = ctx.createRadialGradient(0, 0, irisIn, 0, 0, irisOut);
        iris.addColorStop(0, "rgba(34,211,238,0.50)");
        iris.addColorStop(0.6, "rgba(79,70,229,0.50)");
        iris.addColorStop(1, "rgba(255,255,255,0.35)");
      }
      ctx.beginPath();
      ctx.arc(0, 0, irisOut, 0, TAU);
      ctx.arc(0, 0, irisIn, 0, TAU, true);
      ctx.fillStyle = iris;
      ctx.globalAlpha = a * 0.8;
      ctx.fill("evenodd");
      ctx.restore();

      // three spiral galaxy filaments
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-rot * 1.6);
      for (let arm = 0; arm < 3; arm++) {
        const off = arm * (TAU / 3);
        ctx.beginPath();
        for (let s = 0; s <= 48; s++) {
          const th = (s / 48) * Math.PI * 2.6;
          const rr = irisIn * 0.9 + (irisOut * 1.25 - irisIn * 0.9) * (s / 48);
          const x = Math.cos(th + off) * rr;
          const y = Math.sin(th + off) * rr;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = arm === 1 ? "rgba(255,255,255,0.35)" : "rgba(103,232,249,0.32)";
        ctx.lineWidth = 1.4;
        ctx.shadowColor = "#67e8f9";
        ctx.shadowBlur = 9;
        ctx.stroke();
      }
      ctx.restore();

      // the blinding starlight core + cross-flare
      const coreR = R * 0.2 * pulse;
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(224,242,254,0.95)");
      g.addColorStop(0.7, "rgba(103,232,249,0.5)");
      g.addColorStop(1, "rgba(103,232,249,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU); ctx.fill();
      for (let k = 0; k < 4; k++) {
        const angk = k * (Math.PI / 2) + rot * 0.5;
        const len = coreR * (k % 2 ? 2.4 : 3.1);
        const lg = ctx.createLinearGradient(cx, cy, cx + Math.cos(angk) * len, cy + Math.sin(angk) * len);
        lg.addColorStop(0, "rgba(255,255,255,0.85)");
        lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angk) * len, cy + Math.sin(angk) * len);
        ctx.stroke();
      }

      // thin outer rim
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = "rgba(165,243,252,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.66 * pulse, 0, TAU); ctx.stroke();

      ctx.restore();
    };

    const frame = (now: number) => {
      const rdt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += rdt;

      // PHASE 4 — the paralysis: collapse the flow of time by 95%
      if (elapsed > P4_AT) {
        const k = Math.min((elapsed - P4_AT) / P4_RAMP, 1);
        timeScale = 1 - 0.95 * easeOutExpo(k);
      } else {
        timeScale = 1;
      }
      const dt = rdt * timeScale;
      t += dt;

      ctx.clearRect(0, 0, W, H);

      // epicenter — the largest registered avatar, in canvas-LOCAL coordinates
      const cRect = canvas.getBoundingClientRect();
      let cx = W / 2;
      let cy = H * 0.3;
      let ar = 44;
      let best = 0;
      VOID_ANCHORS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          cx = r.left - cRect.left + r.width / 2;
          cy = r.top - cRect.top + r.height / 2;
          ar = r.width / 2;
        }
      });

      // impact shake while the barrier drops
      let sx = 0;
      let sy = 0;
      if (elapsed < 0.45) {
        const s = (0.45 - elapsed) / 0.45;
        sx = (Math.random() - 0.5) * 10 * s;
        sy = (Math.random() - 0.5) * 10 * s;
      }
      ctx.save();
      ctx.translate(sx, sy);

      // ambient stars reveal once the barrier has sealed the domain
      const starA = easeOutExpo(Math.min(Math.max(elapsed - 0.35, 0) / 1.2, 1));
      if (starA > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const st of stars) {
          const twinkle = 0.28 + 0.28 * Math.sin(elapsed * st.sp + st.tw);
          ctx.fillStyle = `rgba(226,232,240,${(twinkle * starA).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(st.x * W, st.y * H, st.r, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      // PHASE 1 — the barrier drop
      const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.2;
      const bp = Math.min(elapsed / P1_DUR, 1);
      const bR = ar + easeOutExpo(bp) * maxR;
      const bFade = bp < 1 ? 1 : Math.max(1 - (elapsed - P1_DUR) / 0.6, 0);
      if (bFade > 0) {
        ctx.save();
        ctx.globalAlpha = bFade;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 32;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(cx, cy, bR, 0, TAU); ctx.stroke();
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "rgba(103,232,249,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, bR * 0.985, 0, TAU); ctx.stroke();
        ctx.globalAlpha = bFade * 0.4;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(129,140,248,0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, bR * 0.9, 0, TAU); ctx.stroke();
        ctx.restore();
      }

      // PHASE 2 — the cosmic eye behind the avatar
      if (elapsed > P2_AT) {
        const ep = Math.min((elapsed - P2_AT) / 1.5, 1);
        drawEye(cx, cy, Math.min(W, H) * 0.55, easeOutExpo(ep));
      }

      // PHASE 3 — the flood of infinite information
      if (elapsed > P3_AT && !spawned) {
        spawnParticles(cx, cy);
        spawned = true;
      }
      if (spawned) {
        const pt = elapsed - P3_AT;
        const hang = 1 - timeScale;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < N; i++) {
          const p = parts[i];
          if (!p.alive) {
            if (pt >= p.birth) p.alive = true;
            else continue;
          }
          // curl the velocity → true spiral trajectories
          const curl = 0.35 * dt;
          const c = Math.cos(curl);
          const s = Math.sin(curl);
          const nvx = p.vx * c - p.vy * s;
          const nvy = p.vx * s + p.vy * c;
          p.vx = nvx * (1 - 0.22 * dt);
          p.vy = nvy * (1 - 0.22 * dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          // stasis: microscopic real-time drift so the frozen storm stays alive
          p.x += Math.cos(elapsed * 0.7 + p.drift) * 2.6 * hang * rdt;
          p.y += Math.sin(elapsed * 0.6 + p.drift) * 2.6 * hang * rdt;

          if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;

          const ain = Math.min((pt - p.birth) / 0.25, 1);
          if (p.type === 1) {
            const lx = Math.max(Math.min(p.vx * 0.05, 20), -20);
            const ly = Math.max(Math.min(p.vy * 0.05, 20), -20);
            ctx.strokeStyle = pcol(p.hue, 0.8 * ain);
            ctx.lineWidth = p.size * 0.8;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - lx, p.y - ly);
            ctx.stroke();
          } else if (p.type === 2) {
            const L = p.size * 2.6;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot + t * 1.2);
            ctx.strokeStyle = pcol(p.hue, 0.7 * ain);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-L, 0); ctx.lineTo(L, 0);
            ctx.moveTo(0, -L); ctx.lineTo(0, L);
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.fillStyle = pcol(p.hue, 0.2 * ain);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, TAU); ctx.fill();
            ctx.fillStyle = pcol(p.hue, 0.9 * ain);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
          }
        }
        ctx.restore();
      }

      ctx.restore();
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

// ── Card-level: the domain, anchored INSIDE the card ─────────────────────────

export function VoidCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useVoidCanvas(canvasRef);

  return (
    <>
      {/* the domain swallows the card — pitch black over deep-space indigo */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 30%, rgba(2,2,8,0.92), rgba(3,3,14,0.72) 55%, rgba(4,4,18,0.5) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.94] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 40%, rgba(49,46,129,0.20), transparent 65%)" }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the barrier, the cosmic eye, and the frozen information storm */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* one-shot: starlight tears through the instant the domain drops */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(70% 60% at 50% 35%, rgba(224,242,254,0.9), rgba(103,232,249,0.35) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0, 0.3, 0] }}
        transition={{ duration: 1.6, times: [0, 0.12, 0.45, 0.6, 1], ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the honored one ────────────────────────────────

export function VoidAvatarMark() {
  // Register so the barrier + cosmic eye center on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    VOID_ANCHORS.add(el);
    return () => {
      VOID_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* breathing starlight-cyan glow hugging the border */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(8,10,24,0.9), 0 0 26px 8px rgba(34,211,238,0.4)",
            "0 0 16px 5px rgba(8,10,24,0.95), 0 0 44px 14px rgba(224,242,254,0.6)",
            "0 0 12px 3px rgba(8,10,24,0.9), 0 0 26px 8px rgba(34,211,238,0.4)",
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
