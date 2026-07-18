"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Mango Loco" — Extreme Rare. A completely unhinged Día de los Muertos /
 * tropical-chaos takeover in Monster Energy: Mango Loco colours (matte cobalt
 * blue, mango orange, marigold yellow, neon cyan, hot pink, toxic lime).
 *
 * - MangoLocoCardRealm (profile-level, portaled to <body>, mix-blend NORMAL so
 *   the flowers, skulls and juice read as SOLID/painted; the claws, bubbles and
 *   skull-eye halos still glow via `lighter` compositing on the canvas):
 *   · a Marigold (Cempasúchil) wreath of ruffled orange/yellow flowers around
 *     the avatar (live rect), rotating slowly,
 *   · 3 procedural sugar skulls (calaveras) orbiting the wreath, hollow eyes
 *     glowing cyan / pink / lime with painted line-art foreheads,
 *   · a Monster claw strike every 6–8s: 3 jagged toxic-lime claw marks tear
 *     down the screen with a blinding white core, linger, then drip and fade —
 *     each strike erupts a violent burst of thick mango-orange / hot-pink juice
 *     teardrops that arc out under gravity and drip down the screen,
 *   · hundreds of white/cyan carbonation bubbles fizzing up with a chaotic sine
 *     wobble, intersected by jagged fiesta confetti drifting down.
 *
 * - MangoLocoAvatarMarigold (avatar-level): a vibrant orange/lime aura + a few
 *   drifting confetti flecks for small surfaces / the shop preview, plus the
 *   rim anchor registration.
 *
 * No external assets. dt clamped (never negative), radii clamped, particles
 * recycled/GC'd, resilient loop, cleaned up on unmount.
 */

const MANGO_ANCHORS = new Set<HTMLElement>();

// ── the Mango Loco palette ───────────────────────────────────────────────────
const MANGO = "#FF8C00";
const MARIGOLD = "#FFD700";
const CYAN = "#00FFFF";
const PINK = "#FF1493";
const LIME = "#32CD32";
const CONFETTI = [MANGO, MARIGOLD, CYAN, PINK, LIME, "#ffffff"];
const SKULL_ACCENTS = [CYAN, PINK, LIME];
const JUICE = [MANGO, "#ffab2e", PINK, "#ff5aa8"];

// ── engine types ─────────────────────────────────────────────────────────────
type Bubble = { x: number; y: number; vy: number; amp: number; freq: number; phase: number; r: number; cyan: boolean };
type Confetti = { x: number; y: number; vx: number; vy: number; rot: number; rotV: number; w: number; h: number; color: string };
type Juice = { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number };
type Claw = { pts: { x: number; y: number }[]; drift: number };

const GRAV = 900; // juice gravity (px/s^2)

// A soft glow sprite reused for every bubble — cheap drawImage instead of a
// per-bubble gradient.
function makeGlow(rgb: string) {
  const s = 20;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, `rgba(${rgb},0.95)`);
  gr.addColorStop(0.4, `rgba(${rgb},0.5)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

// A ruffled marigold pom-pom: nested rings of pointed petals, orange outside to
// marigold-yellow inside, with a dark-gold centre.
function drawMarigold(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  const ring = (rad: number, count: number, pr: number, color: string, phase: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const a = rot + phase + (i / count) * Math.PI * 2;
      const bx = x + Math.cos(a) * (rad - pr * 0.55);
      const by = y + Math.sin(a) * (rad - pr * 0.55);
      const tx = x + Math.cos(a) * (rad + pr * 0.4);
      const ty = y + Math.sin(a) * (rad + pr * 0.4);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * rad, y + Math.sin(a + 0.5) * rad, tx, ty);
      ctx.quadraticCurveTo(x + Math.cos(a - 0.5) * rad, y + Math.sin(a - 0.5) * rad, bx, by);
      ctx.closePath();
      ctx.fill();
    }
  };
  ring(r * 0.9, 16, r * 0.4, MANGO, 0);
  ring(r * 0.62, 13, r * 0.36, "#FFA500", 0.22);
  ring(r * 0.36, 10, r * 0.3, MARIGOLD, 0.44);
  ctx.fillStyle = "#B8860B";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r * 0.15), 0, Math.PI * 2);
  ctx.fill();
}

// A procedural sugar skull: bone base + jaw, glowing accent eyes, heart nose,
// painted forehead line-art, teeth.
function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, accent: string) {
  ctx.save();
  ctx.translate(x, y);
  // bone cranium + jaw
  ctx.fillStyle = "#f6f1e7";
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.08, s * 0.62, s * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, s * 0.32);
  ctx.quadraticCurveTo(-s * 0.44, s * 0.86, 0, s * 0.92);
  ctx.quadraticCurveTo(s * 0.44, s * 0.86, s * 0.4, s * 0.32);
  ctx.closePath();
  ctx.fill();
  // glowing eye halos
  ctx.globalCompositeOperation = "lighter";
  for (const ex of [-1, 1]) {
    const eg = ctx.createRadialGradient(ex * s * 0.28, -s * 0.14, 0, ex * s * 0.28, -s * 0.14, s * 0.3);
    eg.addColorStop(0, accent);
    eg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex * s * 0.28, -s * 0.14, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // eye discs
  for (const ex of [-1, 1]) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(ex * s * 0.28, -s * 0.14, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // little painted rays around the eye
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(0.5, s * 0.025);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ex * s * 0.28 + Math.cos(a) * s * 0.19, -s * 0.14 + Math.sin(a) * s * 0.19);
      ctx.lineTo(ex * s * 0.28 + Math.cos(a) * s * 0.24, -s * 0.14 + Math.sin(a) * s * 0.24);
      ctx.stroke();
    }
  }
  // heart nose
  ctx.fillStyle = "#1a2440";
  ctx.beginPath();
  ctx.moveTo(0, s * 0.14);
  ctx.quadraticCurveTo(-s * 0.14, -s * 0.02, 0, -s * 0.04);
  ctx.quadraticCurveTo(s * 0.14, -s * 0.02, 0, s * 0.14);
  ctx.fill();
  // forehead marigold dot + teardrops
  ctx.fillStyle = MARIGOLD;
  ctx.beginPath();
  ctx.arc(0, -s * 0.52, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  for (const dx of [-0.24, -0.12, 0.12, 0.24]) {
    ctx.beginPath();
    ctx.arc(dx * s, -s * 0.42, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // teeth
  ctx.strokeStyle = "#c9c2b0";
  ctx.lineWidth = Math.max(0.5, s * 0.028);
  ctx.beginPath();
  ctx.moveTo(-s * 0.26, s * 0.46);
  ctx.lineTo(s * 0.26, s * 0.46);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.1, s * 0.46);
    ctx.lineTo(i * s * 0.1, s * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

// A thick liquid teardrop, tail trailing behind the velocity direction.
function drawJuice(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.quadraticCurveTo(r * 1.4, -r * 0.25, r * 2.6, 0);
  ctx.quadraticCurveTo(r * 1.4, r * 0.25, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function useMangoCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const whiteGlow = makeGlow("255,255,255");
    const cyanGlow = makeGlow("120,255,255");

    const bubbles: Bubble[] = [];
    const confetti: Confetti[] = [];
    const juice: Juice[] = [];
    let claws: Claw[] = [];
    let strikeAge = Infinity; // time since the last claw strike
    let wreathRot = 0;

    const spawnBubble = (anywhere: boolean): Bubble => ({
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      vy: 90 + Math.random() * 170,
      amp: 8 + Math.random() * 22,
      freq: 1.5 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      r: 1.4 + Math.random() * 3.4,
      cyan: Math.random() < 0.45,
    });
    const spawnConfetti = (anywhere: boolean): Confetti => ({
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -10,
      vx: (Math.random() - 0.5) * 30,
      vy: 25 + Math.random() * 45,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 6,
      w: 4 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    });

    const bubbleTarget = () => Math.round(Math.min(220, Math.max(90, (W * H) / 11000)));
    const confettiTarget = () => Math.round(Math.min(90, Math.max(40, (W * H) / 26000)));

    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the whole effect stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      while (bubbles.length < bubbleTarget()) bubbles.push(spawnBubble(true));
      if (bubbles.length > bubbleTarget()) bubbles.length = bubbleTarget();
      while (confetti.length < confettiTarget()) confetti.push(spawnConfetti(true));
      if (confetti.length > confettiTarget()) confetti.length = confettiTarget();
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the effect always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let nextStrike = 2.2; // first strike shortly after the profile opens

    // The claw strike — 3 jagged toxic-lime tears + a violent juice eruption.
    const strike = (cx: number, cy: number, R: number) => {
      strikeAge = 0;
      claws = [];
      for (let c = 0; c < 3; c++) {
        const baseX = cx + (c - 1) * R * 0.9 + (Math.random() - 0.5) * R * 0.3;
        const pts: { x: number; y: number }[] = [];
        const segs = 9;
        for (let i = 0; i <= segs; i++) {
          const p = i / segs;
          pts.push({ x: baseX + (Math.random() - 0.5) * R * 0.5 + Math.sin(p * 7) * R * 0.12, y: -20 + p * (H + 40) });
        }
        claws.push({ pts, drift: 0 });
      }
      // juice eruption
      for (let i = 0; i < 46; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
        const sp = 260 + Math.random() * 520;
        const life = 2.4 + Math.random() * 1.6;
        juice.push({
          x: cx + (Math.random() - 0.5) * R * 0.4,
          y: cy + (Math.random() - 0.5) * R * 0.4,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: 3 + Math.random() * 6,
          color: JUICE[Math.floor(Math.random() * JUICE.length)],
          life,
          max: life,
        });
      }
    };

    const frameBody = (now: number) => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      t += dt;
      wreathRot += dt * 0.25;
      ctx.clearRect(0, 0, W, H);

      // ── carbonation bubbles (lighter, glowing) ──
      ctx.globalCompositeOperation = "lighter";
      for (const b of bubbles) {
        b.y -= b.vy * dt;
        b.x += Math.sin(t * b.freq + b.phase) * b.amp * dt;
        if (b.y < -12) {
          b.y = H + 10;
          b.x = Math.random() * W;
        }
        const s = b.r * 4;
        ctx.globalAlpha = 0.75;
        ctx.drawImage(b.cyan ? cyanGlow : whiteGlow, b.x - s / 2, b.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // ── fiesta confetti (normal blend) ──
      for (const cf of confetti) {
        cf.y += cf.vy * dt;
        cf.x += (cf.vx + Math.sin(t * 1.3 + cf.rot) * 14) * dt;
        cf.rot += cf.rotV * dt;
        if (cf.y > H + 14) {
          cf.y = -10;
          cf.x = Math.random() * W;
        }
        ctx.save();
        ctx.translate(cf.x, cf.y);
        ctx.rotate(cf.rot);
        ctx.fillStyle = cf.color;
        ctx.globalAlpha = 0.9;
        // jagged rectangle (a slightly skewed quad)
        ctx.beginPath();
        ctx.moveTo(-cf.w / 2, -cf.h / 2);
        ctx.lineTo(cf.w / 2, -cf.h / 2 + 1.5);
        ctx.lineTo(cf.w / 2, cf.h / 2);
        ctx.lineTo(-cf.w / 2, cf.h / 2 - 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // ── locate the avatar, in canvas-LOCAL coordinates ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the wreath is pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      MANGO_ANCHORS.forEach((el) => {
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

      // ── strike timing ──
      strikeAge += dt;
      nextStrike -= dt;
      if (nextStrike <= 0) {
        if (focus) {
          strike(focus.x, focus.y, Math.max(40, focus.r));
          nextStrike = 6 + Math.random() * 2;
        } else {
          nextStrike = 0.5;
        }
      }

      // ── the claw marks (lighter, glowing lime + white core) ──
      if (strikeAge < 0.8 && claws.length) {
        const appear = Math.min(1, strikeAge / 0.06);
        const fade = strikeAge < 0.3 ? 1 : Math.max(0, 1 - (strikeAge - 0.3) / 0.5);
        const drip = Math.max(0, strikeAge - 0.3) * 260; // claws drip downward as they fade
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const cl of claws) {
          const trace = (col: string, wid: number, blur: number) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = wid;
            ctx.shadowColor = LIME;
            ctx.shadowBlur = blur;
            ctx.beginPath();
            const n = Math.max(2, Math.round(cl.pts.length * appear));
            for (let i = 0; i < n; i++) {
              const px = cl.pts[i].x;
              const py = cl.pts[i].y + drip * (i / cl.pts.length);
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          };
          trace(`rgba(50,205,50,${(0.85 * fade).toFixed(3)})`, 16, 30);
          trace(`rgba(180,255,120,${(0.9 * fade).toFixed(3)})`, 7, 16);
          trace(`rgba(255,255,255,${(0.95 * fade).toFixed(3)})`, 2.5, 8);
        }
        ctx.restore();
      }

      // ── thick juice teardrops (normal blend, gravity + friction) ──
      for (let i = juice.length - 1; i >= 0; i--) {
        const j = juice[i];
        j.vy += GRAV * dt;
        j.vx *= Math.pow(0.4, dt); // friction
        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.life -= dt;
        if (j.life <= 0 || j.y > H + 20 || j.x < -20 || j.x > W + 20) {
          juice.splice(i, 1);
          continue;
        }
        const a = Math.min(1, j.life / j.max);
        ctx.globalAlpha = 0.55 + 0.45 * a;
        drawJuice(ctx, j.x, j.y, Math.max(1, j.r), Math.atan2(j.vy, j.vx), j.color);
      }
      ctx.globalAlpha = 1;

      // ── the avatar cluster: marigold wreath + orbiting sugar skulls ──
      if (focus) {
        const { x: cx, y: cy, r } = focus;
        const R = Math.max(40, r);
        // marigold wreath
        const flowers = 11;
        for (let i = 0; i < flowers; i++) {
          const a = wreathRot + (i / flowers) * Math.PI * 2;
          const fx = cx + Math.cos(a) * R * 1.24;
          const fy = cy + Math.sin(a) * R * 1.24;
          drawMarigold(ctx, fx, fy, R * 0.34, wreathRot * 2 + i);
        }
        // 3 orbiting sugar skulls
        for (let i = 0; i < 3; i++) {
          const a = -wreathRot * 0.8 + (i / 3) * Math.PI * 2;
          const sx = cx + Math.cos(a) * R * 1.95;
          const sy = cy + Math.sin(a) * R * 1.95 + Math.sin(t * 1.4 + i) * R * 0.08;
          drawSkull(ctx, sx, sy, R * 0.42, SKULL_ACCENTS[i % SKULL_ACCENTS.length]);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    // Resilient loop — one bad frame logs once and is skipped, never a silent halt.
    let warned = false;
    const frame = (now: number) => {
      try {
        frameBody(now);
      } catch (err) {
        if (!warned) {
          warned = true;
          console.error("[mango] frame error:", err);
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

// ── Profile-level: the realm, anchored INSIDE the card ──────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function MangoLocoCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMangoCanvas(canvasRef);

  return (
    <>
      {/* deep matte cobalt-blue of the can */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "rgba(13,44,84,0.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.3, ease: "easeOut" }}
      />
      {/* tropical neon glow washing across the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 30% 20%, rgba(255,140,0,0.16), transparent 55%), radial-gradient(70% 60% at 80% 90%, rgba(255,20,147,0.14), transparent 60%)" }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the fiesta chaos — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. Sits above the card
          content so the wreath crowns the avatar and bubbles fizz over it.
          Solid painted flowers/skulls/juice; glows use `lighter` internally. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
      />
    </>
  );
}

// ── Avatar-level: a vibrant fiesta aura for small surfaces / the shop preview ──

export function MangoLocoAvatarMarigold() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    MANGO_ANCHORS.add(el);
    return () => {
      MANGO_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* mango-orange → lime fiesta aura */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(255,140,0,0.55)",
            "0 0 24px 8px rgba(50,205,50,0.6)",
            "0 0 14px 4px rgba(255,20,147,0.55)",
            "0 0 24px 8px rgba(50,205,50,0.6)",
            "0 0 12px 3px rgba(255,140,0,0.55)",
          ],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* drifting confetti flecks */}
      <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
        {[14, 38, 60, 82, 28, 72].map((left, i) => (
          <motion.span
            key={i}
            className="absolute"
            style={{
              left: `${left}%`,
              width: 4,
              height: 7,
              background: [MANGO, MARIGOLD, CYAN, PINK, LIME, "#ffffff"][i % 6],
              boxShadow: "0 0 4px rgba(255,255,255,0.6)",
            }}
            initial={{ top: "-10%", opacity: 0, rotate: 0 }}
            animate={{ top: ["-10%", "112%"], opacity: [0, 1, 1, 0], rotate: 220, x: [0, 5, -5, 0] }}
            transition={{ duration: 3 + (i % 3) * 0.7, repeat: Infinity, delay: i * 0.4, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}
