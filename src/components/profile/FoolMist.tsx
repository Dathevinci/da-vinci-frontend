"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Fog of History" — the Mr. Fool effect (Lord of the Mysteries). Above the Grey
 * Fog, at the bronze table of Sefirah Castle…
 *
 * - FoolCardMist (profile-level, portaled to <body> to escape every component
 *   stacking context): a full-viewport canvas with `mix-blend-mode: screen`:
 *   · The Endless Grey Fog — two pre-rendered fog textures (dozens of layered
 *     radial-gradient plumes, an fBm-style buildup done ONCE offscreen) drift,
 *     wrap and counter-scroll in three depth layers with sine swirl, giving
 *     fluid rolling mist at 60fps without per-pixel noise cost.
 *   · Crimson Stars — glowing deep-red orbs (pre-rendered sprite) drifting
 *     lazily in the fog, pulsing in and out of existence: the Tarot Club.
 *   · Spirit Body Threads — ultra-thin silver-blue cubic Béziers that emerge
 *     from the screen edges and attach to the avatar's live coordinates
 *     (getBoundingClientRect per frame), swaying in a spiritual current, each
 *     with a bright bead of spirituality traveling along it.
 *
 * - FoolAvatarAura (avatar-level): a pulsing abyssal-black + cosmic-gold aura,
 *   a slow-turning gold halo, orbiting crimson motes, and a breathing grey
 *   mist wisp. Registers the avatar so the threads bind to it.
 *
 * Pure code — no images, no libraries beyond the app's existing stack.
 */

// Avatars register here; the mist engine binds spirit threads to the largest
// visible one (the profile avatar wins over the tiny navbar avatar).
const FOOL_ANCHORS = new Set<HTMLElement>();

// ── engine ───────────────────────────────────────────────────────────────────

type Star = { x: number; y: number; vx: number; vy: number; phase: number; speed: number; size: number };
type Thread = { side: number; pos: number; phase: number; freq: number; amp: number; beadPhase: number; beadSpeed: number };

function makeFogTexture(w: number, h: number, plumes: number, alpha: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  for (let i = 0; i < plumes; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 60 + Math.random() * 170;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const a = alpha * (0.35 + Math.random() * 0.65);
    grad.addColorStop(0, `rgba(148,163,184,${a.toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(120,134,156,${(a * 0.45).toFixed(3)})`);
    grad.addColorStop(1, "rgba(148,163,184,0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

function makeStarSprite(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const half = size / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(254,202,202,0.95)");
  grad.addColorStop(0.25, "rgba(220,38,38,0.8)");
  grad.addColorStop(0.6, "rgba(153,27,27,0.35)");
  grad.addColorStop(1, "rgba(153,27,27,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

const cubicAt = (t: number, p0: number, p1: number, p2: number, p3: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

function useFoolCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
      // the card and scrolls with it, so the mist stays locked to the profile
      // (Discord-style) instead of floating as a viewport overlay.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the mist always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // fog textures are built once; per-frame work is just a few drawImages
    const fogA = makeFogTexture(900, 640, 46, 0.16);
    const fogB = makeFogTexture(760, 560, 34, 0.13);
    const FOG_LAYERS = [
      { tex: fogA, speed: 9, dir: 1, alpha: 0.55, bobAmp: 18, bobFreq: 0.05, yAt: 0.0 },
      { tex: fogB, speed: 5.5, dir: -1, alpha: 0.4, bobAmp: 24, bobFreq: 0.035, yAt: 0.25 },
      { tex: fogA, speed: 16, dir: 1, alpha: 0.3, bobAmp: 12, bobFreq: 0.07, yAt: 0.45 },
    ];

    const starSprite = makeStarSprite(64);
    const stars: Star[] = Array.from({ length: 15 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.006,
      vy: (Math.random() - 0.5) * 0.004,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.5,
      size: 22 + Math.random() * 34,
    }));

    const threads: Thread[] = Array.from({ length: 7 }, (_, i) => ({
      side: i % 3, // 0 = left edge, 1 = right edge, 2 = top edge
      pos: 0.12 + Math.random() * 0.76,
      phase: Math.random() * Math.PI * 2,
      freq: 0.5 + Math.random() * 0.5,
      amp: 30 + Math.random() * 55,
      beadPhase: Math.random(),
      beadSpeed: 0.06 + Math.random() * 0.07,
    }));

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // ── the Endless Grey Fog: wrapping, counter-scrolling, breathing layers ──
      for (const L of FOG_LAYERS) {
        const scale = Math.max(W / L.tex.width, H / L.tex.height) * 1.25;
        const tw = L.tex.width * scale;
        const th = L.tex.height * scale;
        const off = ((t * L.speed * L.dir * 4) % tw + tw) % tw;
        const y = H * L.yAt - th * 0.2 + Math.sin(t * L.bobFreq * Math.PI * 2 + L.yAt * 9) * L.bobAmp;
        ctx.globalAlpha = L.alpha * (0.85 + 0.15 * Math.sin(t * 0.3 + L.yAt * 7));
        for (let x = -off; x < W; x += tw) ctx.drawImage(L.tex, x, y, tw, th);
      }
      ctx.globalAlpha = 1;

      // ── Crimson Stars of the Tarot Club ──
      for (const s of stars) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < -0.05) s.x = 1.05;
        if (s.x > 1.05) s.x = -0.05;
        if (s.y < -0.05) s.y = 0.95;
        if (s.y > 1.0) s.y = 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * s.speed * Math.PI + s.phase);
        const sz = s.size * (0.8 + pulse * 0.4);
        ctx.globalAlpha = 0.25 + pulse * 0.6;
        ctx.drawImage(starSprite, s.x * W - sz / 2, s.y * H - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;

      // ── Spirit Body Threads → bound to the avatar's live position ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the threads stay pixel-locked to the pfp.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number } | null = null;
      let best = 0;
      FOOL_ANCHORS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          target = { x: r.left - cRect.left + r.width / 2, y: r.top - cRect.top + r.height / 2 };
        }
      });
      if (target) {
        const { x: tx, y: ty } = target;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(147,197,253,0.8)";
        ctx.shadowBlur = 6;
        for (const th of threads) {
          const x0 = th.side === 0 ? -12 : th.side === 1 ? W + 12 : W * th.pos;
          const y0 = th.side === 2 ? -12 : H * th.pos;
          const dx = tx - x0;
          const dy = ty - y0;
          const len = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / len; // perpendicular — the sway direction
          const ny = dx / len;
          const sway1 = Math.sin(t * th.freq * Math.PI + th.phase) * th.amp;
          const sway2 = Math.sin(t * th.freq * Math.PI * 1.4 + th.phase + 2.1) * th.amp * 0.8;
          const c1x = x0 + dx * 0.33 + nx * sway1;
          const c1y = y0 + dy * 0.33 + ny * sway1;
          const c2x = x0 + dx * 0.66 + nx * sway2;
          const c2y = y0 + dy * 0.66 + ny * sway2;
          ctx.strokeStyle = "rgba(186,213,255,0.3)";
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
          ctx.stroke();
          // a bead of spirituality traveling along the thread
          th.beadPhase = (th.beadPhase + th.beadSpeed * dt * 10) % 1;
          const bt = th.beadPhase;
          const bx = cubicAt(bt, x0, c1x, c2x, tx);
          const by = cubicAt(bt, y0, c1y, c2y, ty);
          ctx.fillStyle = "rgba(224,242,254,0.9)";
          ctx.beginPath();
          ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
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

// ── Profile-level: the Divine Realm, anchored INSIDE the card ───────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function FoolCardMist() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFoolCanvas(canvasRef);

  return (
    <>
      {/* abyssal wash over the card so the mist reads "through" it */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 30%, rgba(15,15,26,0.55), rgba(30,30,46,0.25) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.85] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 100%, rgba(245,158,11,0.08), transparent 60%)" }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot: the Fog parts when the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(80% 70% at 50% 40%, rgba(203,213,225,0.85), rgba(148,163,184,0.35) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.9, ease: "easeOut" }}
      />

      {/* the Endless Grey Fog — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. `mix-blend: screen` keeps
          the mist reading "through" the card surface. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the Scholar of Yore ────────────────────────────────────────

export function FoolAvatarAura() {
  // Register so the spirit threads bind to this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    FOOL_ANCHORS.add(el);
    return () => {
      FOOL_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* breathing grey mist wisp behind the avatar */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[16%] z-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(148,163,184,0.4), rgba(148,163,184,0.12) 55%, transparent 72%)", filter: "blur(6px)" }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5], rotate: [0, 20, 0] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* slow-turning cosmic-gold halo */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[4%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(245,158,11,0), rgba(253,230,138,0.7), rgba(245,158,11,0), rgba(180,83,9,0.5), rgba(245,158,11,0), rgba(253,230,138,0.6), rgba(245,158,11,0))",
          filter: "blur(2px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
          maskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
      />

      {/* pulsing abyssal-black + cosmic-gold aura — the Fool's divine authority */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 4px rgba(0,0,0,0.85), 0 0 24px 7px rgba(245,158,11,0.3)",
            "0 0 16px 6px rgba(0,0,0,0.9), 0 0 40px 12px rgba(251,191,36,0.55)",
            "0 0 12px 4px rgba(0,0,0,0.85), 0 0 24px 7px rgba(245,158,11,0.3)",
          ],
        }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* crimson motes of the Tarot Club orbiting the rim */}
      {[
        { dur: 9, delay: 0, size: 5 },
        { dur: 12, delay: 2.4, size: 4 },
        { dur: 15, delay: 5.2, size: 6 },
      ].map((m, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: m.dur, repeat: Infinity, ease: "linear", delay: -m.delay }}
        >
          <motion.span
            className="absolute rounded-full"
            style={{
              left: "50%",
              top: "-4%",
              width: m.size,
              height: m.size,
              marginLeft: -m.size / 2,
              background: "radial-gradient(circle, #fecaca, #dc2626 55%, rgba(153,27,27,0.4))",
              boxShadow: "0 0 8px 2px rgba(220,38,38,0.75)",
            }}
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 2.2 + i * 0.7, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.span>
      ))}
    </>
  );
}
