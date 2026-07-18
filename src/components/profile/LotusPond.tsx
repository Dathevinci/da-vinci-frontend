"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "The Sacred Lotus Pond" — Extreme Rare. A tranquil, high-definition lotus
 * pond, the calm counterpart to the loud rares.
 *
 * - LotusCardRealm (profile-level, portaled to <body>, mix-blend NORMAL): a
 *   full-viewport canvas over clear pond water:
 *   · A cluster of giant green LILY PADS framing the avatar (live rect) — each
 *     an arc with a V-wedge notch cut out and lighter-green veins radiating
 *     from the centre, biased to the pond side so it never covers your name.
 *     The whole cluster drifts on slow, asynchronous sine physics.
 *   · Two blooming FLOWERS resting beside the avatar — a sacred pink Lotus and
 *     a pristine white Water Lily — built from nested rings of bezier teardrop
 *     petals that breathe open and closed, with glowing golden stamens shedding
 *     faint pollen that drifts upward.
 *   · A full-screen RIPPLE engine — random gentle drops send expanding rings
 *     across the water, and moving the mouse or scrolling stirs fresh
 *     disturbances that briefly warp the floating cluster.
 *   · 40 bioluminescent golden FIREFLIES hovering and dancing over the surface.
 *
 * - LotusAvatarPond (avatar-level): a jade aura + drifting pollen for small
 *   surfaces / the shop preview, plus the rim anchor registration.
 *
 * The card wash plunges the profile into a shaded aquatic atmosphere while
 * staying readable. Pure code, dt-based physics, DPR capped, particles
 * recycled, cleaned up on unmount.
 */

const LOTUS_ANCHORS = new Set<HTMLElement>();

// ── engine ───────────────────────────────────────────────────────────────────

type Ripple = { x: number; y: number; born: number; life: number; maxR: number; strong: boolean };
type Firefly = { x: number; y: number; phase: number; freq: number; dphase: number; dfreq: number; size: number; base: number };
type Pollen = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };

// lily-pad cluster, biased to the LEFT / BOTTOM (the "pond" side) so it frames
// the avatar without covering the username on the right. Angles in radians,
// distances/radii in avatar-radius units.
const PADS = [
  { ang: 1.22, dist: 1.42, r: 0.82, sway: 0.5, phase: 0.0 },
  { ang: 2.09, dist: 1.5, r: 0.64, sway: 0.42, phase: 1.1 },
  { ang: 2.79, dist: 1.38, r: 0.78, sway: 0.55, phase: 2.3 },
  { ang: 3.66, dist: 1.52, r: 0.6, sway: 0.47, phase: 3.0 },
  { ang: 4.36, dist: 1.4, r: 0.72, sway: 0.5, phase: 4.2 },
  { ang: 5.15, dist: 1.55, r: 0.55, sway: 0.44, phase: 5.1 },
];
// the two flowers, resting on the pond side
const FLOWERS = [
  { ang: 2.5, dist: 1.35, size: 0.5, kind: "lotus" as const, sway: 0.4, phase: 0.6 },
  { ang: 4.0, dist: 1.32, size: 0.44, kind: "lily" as const, sway: 0.46, phase: 2.9 },
];

// A soft radial glow sprite — one gradient reused for every firefly/pollen mote.
function makeGlow(rgb: string) {
  const s = 24;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${rgb},0.95)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.5)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

// A giant lily pad: an arc with a V-wedge notch cut out, veins radiating.
function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, notch: number) {
  const half = 0.34;
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  g.addColorStop(0, "#3aa869");
  g.addColorStop(0.65, "#1f7a4d");
  g.addColorStop(1, "#0d4a2f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, notch + half, notch - half + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  // rim sheen
  ctx.strokeStyle = "rgba(140,230,170,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  // veins radiating from the centre (skipping the wedge)
  ctx.strokeStyle = "rgba(160,235,180,0.28)";
  ctx.lineWidth = Math.max(0.6, r * 0.014);
  const rays = 12;
  for (let i = 0; i <= rays; i++) {
    const a = notch + half + (i / rays) * (Math.PI * 2 - half * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
}

// A single teardrop petal in the current transform, tip at -y.
function petalPath(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, -len * 0.4, wid * 0.55, -len * 0.95, 0, -len);
  ctx.bezierCurveTo(-wid * 0.55, -len * 0.95, -wid, -len * 0.4, 0, 0);
  ctx.closePath();
}

const LOTUS_RINGS = [
  { n: 8, len: 1.0, wid: 0.44, inner: "#fde7f1", outer: "#f472b6" },
  { n: 7, len: 0.78, wid: 0.4, inner: "#fff0f6", outer: "#f9a8d4" },
  { n: 6, len: 0.56, wid: 0.36, inner: "#fff5f9", outer: "#fbcfe8" },
];
const LILY_RINGS = [
  { n: 9, len: 1.0, wid: 0.34, inner: "#eaf2ff", outer: "#ffffff" },
  { n: 8, len: 0.76, wid: 0.32, inner: "#f2f8ff", outer: "#ffffff" },
  { n: 6, len: 0.54, wid: 0.3, inner: "#ffffff", outer: "#ffffff" },
];

// A blooming flower: nested rings of teardrop petals that open with `bloom`
// (0..1), golden stamened centre.
function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, bloom: number, t: number, kind: "lotus" | "lily") {
  const rings = kind === "lotus" ? LOTUS_RINGS : LILY_RINGS;
  ctx.save();
  ctx.translate(x, y);
  rings.forEach((ring, ri) => {
    const spread = 0.5 + 0.5 * bloom - ri * 0.05; // outer petals open wider
    const len = size * ring.len * (0.85 + 0.28 * bloom);
    const wid = size * ring.wid;
    const offset = ri * 0.32 + t * 0.04;
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + offset;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -size * 0.14 * spread);
      ctx.scale(spread, 1);
      const pg = ctx.createLinearGradient(0, 0, 0, -len);
      pg.addColorStop(0, ring.outer);
      pg.addColorStop(1, ring.inner);
      ctx.fillStyle = pg;
      ctx.globalAlpha = 0.94;
      petalPath(ctx, len, wid);
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.globalAlpha = 1;
  // golden glowing centre
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.32);
  cg.addColorStop(0, "#fff7cc");
  cg.addColorStop(0.5, "#fbbf24");
  cg.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // stamens
  ctx.strokeStyle = "#f4d35e";
  ctx.lineWidth = Math.max(0.6, size * 0.02);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + t * 0.15;
    const rr = size * (0.16 + 0.08 * (i % 2));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    ctx.stroke();
  }
  ctx.restore();
}

function useLotusCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const goldSprite = makeGlow("255,214,120");
    const pollenSprite = makeGlow("253,230,170");

    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the whole pond stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      spawnDrop(true); // a fresh ring so a resize feels like a settling ripple
    };

    const ripples: Ripple[] = [];
    const spawnDrop = (ambient: boolean, px?: number, py?: number) => {
      if (ripples.length > 34) return;
      ripples.push({
        x: px ?? Math.random() * W,
        y: py ?? Math.random() * H,
        born: t,
        life: ambient ? 2.6 + Math.random() * 1.2 : 1.8 + Math.random() * 0.8,
        maxR: ambient ? 70 + Math.random() * 130 : 50 + Math.random() * 80,
        strong: !ambient,
      });
    };

    const fireflies: Firefly[] = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      freq: 0.3 + Math.random() * 0.7,
      dphase: Math.random() * Math.PI * 2,
      dfreq: 0.2 + Math.random() * 0.5,
      size: 2.5 + Math.random() * 4,
      base: 0.4 + Math.random() * 0.5,
    }));

    const pollen: Pollen[] = [];
    let waveEnergy = 0; // spikes on interaction, decays — warps the cluster

    // timing — declared before resize() runs, since resize()→spawnDrop() reads t
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let dropTimer = 1.2;

    // interactive ripples (canvas is pointer-events:none, so listen on window)
    let lastPointer = 0;
    const onPointer = (e: PointerEvent) => {
      const now2 = performance.now();
      if (now2 - lastPointer < 220) return; // throttle
      lastPointer = now2;
      // convert the viewport pointer position into canvas-LOCAL coordinates so
      // the interactive ripple lands under the cursor inside the card
      const rect = canvas.getBoundingClientRect();
      spawnDrop(false, e.clientX - rect.left, e.clientY - rect.top);
      waveEnergy = Math.min(1, waveEnergy + 0.35);
    };
    const onScroll = () => {
      spawnDrop(false, Math.random() * W, H * (0.3 + Math.random() * 0.5));
      waveEnergy = Math.min(1, waveEnergy + 0.25);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the pond always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // Resilient loop: a bad frame logs once and is skipped — the pond never
    // silently dies. (This caught the launch bug: see the dt clamp below.)
    let warned = false;
    const frame = (now: number) => {
      try {
        frameBody(now);
      } catch (err) {
        if (!warned) {
          warned = true;
          console.error("[lotus] frame error:", err);
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const frameBody = (now: number) => {
      // Clamped at 0: the first rAF timestamp can PRECEDE the performance.now()
      // captured at setup, and a negative dt drove t (and then a ripple's age →
      // its arc radius) negative, crashing the canvas on frame one.
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      waveEnergy = Math.max(0, waveEnergy - dt * 0.6);

      // ── clear pond water: a faint crystal-blue depth wash (kept translucent
      //    so the page stays readable) ──
      const water = ctx.createLinearGradient(0, 0, 0, H);
      water.addColorStop(0, "rgba(12,40,45,0.05)");
      water.addColorStop(1, "rgba(8,30,40,0.16)");
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, W, H);

      // ── ripples ──
      dropTimer -= dt;
      if (dropTimer <= 0) {
        spawnDrop(true);
        dropTimer = 1.4 + Math.random() * 1.8;
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const age = Math.max(0, t - rp.born); // never a negative radius
        if (age > rp.life) {
          ripples.splice(i, 1);
          continue;
        }
        const p = age / rp.life;
        const rad = rp.maxR * p;
        const a = (1 - p) * (rp.strong ? 0.5 : 0.32);
        ctx.strokeStyle = `rgba(190,235,245,${a.toFixed(3)})`;
        ctx.lineWidth = rp.strong ? 2 : 1.4;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        // a second, tighter inner ring for depth
        if (rad > 8) {
          ctx.strokeStyle = `rgba(150,220,235,${(a * 0.6).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rad * 0.7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // ── fireflies hovering over the surface ──
      ctx.globalCompositeOperation = "lighter";
      for (const f of fireflies) {
        f.x += (Math.cos(t * f.freq + f.phase) * 10 * dt) / W;
        f.y += (Math.sin(t * f.dfreq + f.dphase) * 8 * dt) / H;
        if (f.x < -0.02) f.x = 1.02;
        else if (f.x > 1.02) f.x = -0.02;
        if (f.y < -0.02) f.y = 1.02;
        else if (f.y > 1.02) f.y = -0.02;
        const tw = f.base * (0.55 + 0.45 * Math.sin(t * 2.2 + f.phase));
        const s = f.size * (2.4 + tw);
        ctx.globalAlpha = Math.max(0, tw);
        ctx.drawImage(goldSprite, f.x * W - s / 2, f.y * H - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // ── the avatar cluster: pads + flowers, drifting ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the cluster is pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      LOTUS_ANCHORS.forEach((el) => {
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

      if (focus) {
        const { x: cx, y: cy, r } = focus;
        const R = Math.max(40, r);
        const warp = 1 + waveEnergy * 1.4;

        // pads first (they sit under the flowers)
        for (const pd of PADS) {
          const bob = Math.sin(t * pd.sway + pd.phase) * R * 0.05 * warp;
          const drift = Math.cos(t * pd.sway * 0.7 + pd.phase) * 0.06 * warp;
          const ang = pd.ang + drift;
          const px = cx + Math.cos(ang) * pd.dist * R;
          const py = cy + Math.sin(ang) * pd.dist * R + bob;
          const notch = ang + Math.PI; // wedge faces the avatar
          drawPad(ctx, px, py, pd.r * R, notch + Math.sin(t * 0.3 + pd.phase) * 0.15);
        }

        // flowers + their pollen
        for (const fl of FLOWERS) {
          const bob = Math.sin(t * fl.sway + fl.phase) * R * 0.05 * warp;
          const ang = fl.ang + Math.cos(t * fl.sway * 0.6 + fl.phase) * 0.05 * warp;
          const fx = cx + Math.cos(ang) * fl.dist * R;
          const fy = cy + Math.sin(ang) * fl.dist * R + bob;
          const bloom = 0.5 + 0.5 * Math.sin(t * 0.22 + fl.phase); // slow breathing
          drawFlower(ctx, fx, fy, fl.size * R, bloom, t, fl.kind);
          // shed pollen from the golden centre
          if (pollen.length < 70 && Math.random() < 0.5) {
            pollen.push({
              x: fx + (Math.random() - 0.5) * fl.size * R * 0.3,
              y: fy + (Math.random() - 0.5) * fl.size * R * 0.3,
              vx: (Math.random() - 0.5) * 8,
              vy: -12 - Math.random() * 16,
              life: 1.8 + Math.random() * 1.2,
              max: 1.8 + Math.random() * 1.2,
              size: 2 + Math.random() * 2.5,
            });
          }
        }
      }

      // ── golden pollen drifting up ──
      ctx.globalCompositeOperation = "lighter";
      for (let i = pollen.length - 1; i >= 0; i--) {
        const pp = pollen[i];
        pp.x += (pp.vx + Math.sin(t * 1.6 + i) * 6) * dt;
        pp.y += pp.vy * dt;
        pp.vy += 3 * dt; // buoyancy eases off
        pp.life -= dt;
        if (pp.life <= 0) {
          pollen.splice(i, 1);
          continue;
        }
        const a = Math.min(1, pp.life / pp.max);
        const s = pp.size * (1 + (1 - a));
        ctx.globalAlpha = a * 0.85;
        ctx.drawImage(pollenSprite, pp.x - s, pp.y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [canvasRef]);
}

// ── Profile-level: the pond, anchored INSIDE the card ───────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function LotusCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLotusCanvas(canvasRef);

  return (
    <>
      {/* shaded aquatic atmosphere over the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "rgba(10,25,20,0.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
      {/* soft jade + gold light filtering through the water */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(90% 70% at 50% 30%, rgba(52,211,153,0.12), transparent 60%), radial-gradient(60% 50% at 50% 100%, rgba(251,191,36,0.08), transparent 60%)" }}
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the tranquil pond — sized to and clipped by the card, so it scrolls
          locked to the profile like a Discord effect. Sits above the card
          content so the lily cluster frames the avatar and ripples drift over
          the surface. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
      />
    </>
  );
}

// ── Avatar-level: a small pond aura for dense surfaces / the shop preview ────

export function LotusAvatarPond() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    LOTUS_ANCHORS.add(el);
    return () => {
      LOTUS_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* jade water aura, breathing */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(16,185,129,0.45)",
            "0 0 24px 8px rgba(52,211,153,0.6)",
            "0 0 12px 3px rgba(16,185,129,0.45)",
          ],
        }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* drifting golden pollen motes */}
      <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
        {[16, 40, 62, 84, 30, 72].map((left, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ left: `${left}%`, width: 3, height: 3, background: "#fde68a", boxShadow: "0 0 5px rgba(251,191,36,0.9)" }}
            initial={{ top: "108%", opacity: 0 }}
            animate={{ top: ["108%", "-10%"], opacity: [0, 1, 1, 0], x: [0, 4, -4, 0] }}
            transition={{ duration: 3.6 + (i % 3) * 0.8, repeat: Infinity, delay: i * 0.5, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}
