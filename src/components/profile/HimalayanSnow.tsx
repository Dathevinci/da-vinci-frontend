"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "The Silent Himalayas" — SSS grade. A serene night on the roof of the world:
 * Sagarmāthā under heavy, weightless snow. The opposite of the loud SSS ritual —
 * this one is stillness.
 *
 * - SnowCardRealm (profile-level, portaled to <body>): a full-viewport canvas
 *   (normal blend) drawing, back to front:
 *   · a faint moon glow + twinkling twilight stars,
 *   · the FAR snow layer (tiny, slow — it drifts behind the peaks),
 *   · THREE parallax Himalayan ridgelines, procedural jagged silhouettes from
 *     deep twilight blue in the distance to moonlit icy white up front,
 *   · rolling mountain mist (wide, slow radial gradients),
 *   · the MID snow layer,
 *   · accumulating snow: flakes that reach the ground — or land on the top edge
 *     of the profile card — vanish and raise a soft, rolling snowdrift drawn
 *     with quadraticCurveTo, slowly burying the bottom of the screen,
 *   · the NEAR snow layer (large, soft, fast) in front of everything.
 *   Snow fluttering is a gentle Math.sin drift — heavy but perfectly calm.
 *
 * - SnowAvatarFrost (avatar-level): an icy moonlit rim glow + a soft cap of
 *   snow resting on the crown of the avatar, plus the anchor registration.
 *
 * No external assets. dt-based physics, DPR capped, particles recycled (never
 * grown unbounded), mountains + drift array rebuilt on resize, cleaned up on
 * unmount.
 */

// ── engine ───────────────────────────────────────────────────────────────────

type Flake = {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number; // horizontal flutter amplitude
  freq: number; // flutter frequency
  phase: number;
  layer: 0 | 1 | 2; // 0 far, 1 mid, 2 near
  alpha: number;
};
type Star = { x: number; y: number; r: number; base: number; freq: number; phase: number };
type Ridge = { pts: { x: number; y: number }[]; top: string; mid: string; bottom: string; highlight: string | null; crestY: number; alpha: number };

const LAYERS = [
  { count: 240, rMin: 0.6, rMax: 1.4, sMin: 10, sMax: 20, drift: 6, alpha: 0.55 }, // far
  { count: 180, rMin: 1.2, rMax: 2.5, sMin: 22, sMax: 40, drift: 11, alpha: 0.78 }, // mid
  { count: 130, rMin: 2.2, rMax: 4.6, sMin: 44, sMax: 74, drift: 17, alpha: 0.98 }, // near
] as const;

const BUCKET = 8; // px width of each snowdrift column
const MOON = { xf: 0.8, yf: 0.16 };

// A soft, pre-rendered flake sprite — one radial gradient reused for every
// flake, so 460 soft snowflakes cost 460 cheap drawImage calls, not 460 blurs.
function makeFlakeSprite() {
  const s = 24;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(238,245,255,0.85)");
  grad.addColorStop(1, "rgba(220,232,255,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

function useSnowCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cardRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const sprite = makeFlakeSprite();

    const flakes: Flake[] = [];
    let stars: Star[] = [];
    let ridges: Ridge[] = [];
    let piles: number[] = []; // snowdrift height per bucket, along the ground
    let cardSnow = 0; // soft ridge accumulated on the profile card's top edge

    const resetFlake = (f: Flake, top: boolean) => {
      f.x = Math.random() * W;
      f.y = top ? -10 - Math.random() * 40 : Math.random() * H;
      f.phase = Math.random() * Math.PI * 2;
    };

    const buildFlakes = () => {
      flakes.length = 0;
      LAYERS.forEach((L, li) => {
        for (let i = 0; i < L.count; i++) {
          const f: Flake = {
            x: 0,
            y: 0,
            r: L.rMin + Math.random() * (L.rMax - L.rMin),
            speed: L.sMin + Math.random() * (L.sMax - L.sMin),
            drift: L.drift,
            freq: 0.4 + Math.random() * 0.8,
            phase: 0,
            layer: li as 0 | 1 | 2,
            alpha: L.alpha * (0.7 + Math.random() * 0.3),
          };
          resetFlake(f, false);
          flakes.push(f);
        }
      });
    };

    const buildStars = () => {
      const n = Math.round((W * H) / 46000);
      stars = Array.from({ length: Math.min(70, Math.max(20, n)) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.5,
        r: 0.4 + Math.random() * 1.1,
        base: 0.15 + Math.random() * 0.4,
        freq: 0.4 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    // Three procedural ridgelines — jagged peaks, distant blue to moonlit white.
    const buildMountains = () => {
      // Lower, translucent ranges: a distant BACKGROUND horizon the page content
      // still shows through — not an opaque wall over the profile & collection.
      const spec = [
        { baseY: 0.76, amp: 0.12, step: 90, top: "#41537a", mid: "#26324e", bottom: "#121a2b", highlight: null, alpha: 0.46 },
        { baseY: 0.85, amp: 0.13, step: 122, top: "#52679a", mid: "#2a3a5c", bottom: "#0f1725", highlight: null, alpha: 0.57 },
        { baseY: 0.94, amp: 0.13, step: 160, top: "#dce8ff", mid: "#33466c", bottom: "#16223a", highlight: "#f2f7ff", alpha: 0.7 },
      ];
      ridges = spec.map((s) => {
        const baseY = H * s.baseY;
        const amp = H * s.amp;
        const pts: { x: number; y: number }[] = [];
        for (let x = -s.step; x <= W + s.step; x += s.step) {
          // sharp alternating peaks with jitter — a serene, craggy skyline
          const peak = 0.35 + 0.65 * Math.random();
          pts.push({ x, y: baseY - amp * peak });
        }
        const crestY = Math.min(...pts.map((p) => p.y));
        return { pts, top: s.top, mid: s.mid, bottom: s.bottom, highlight: s.highlight, crestY, alpha: s.alpha };
      });
    };

    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of the
      // card and scrolls with it, so the whole snowfall stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const cols = Math.ceil(W / BUCKET) + 1;
      const old = piles;
      piles = new Array(cols).fill(0).map((_, i) => {
        // preserve the drift across a resize by sampling the old array
        if (!old.length) return 0;
        const src = Math.min(old.length - 1, Math.round((i / cols) * old.length));
        return old[src] || 0;
      });

      if (!flakes.length) buildFlakes();
      buildStars();
      buildMountains();
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the snowfall always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    const maxGround = () => H * 0.045;
    const maxCard = 10;

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      const moonX = W * MOON.xf;
      const moonY = H * MOON.yf;

      // ── moon glow ──
      const moon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, Math.min(W, H) * 0.22);
      moon.addColorStop(0, "rgba(226,236,255,0.16)");
      moon.addColorStop(0.5, "rgba(200,216,248,0.05)");
      moon.addColorStop(1, "rgba(200,216,248,0)");
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, W, H);
      const disc = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 34);
      disc.addColorStop(0, "rgba(245,249,255,0.5)");
      disc.addColorStop(0.7, "rgba(226,236,255,0.22)");
      disc.addColorStop(1, "rgba(226,236,255,0)");
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 34, 0, Math.PI * 2);
      ctx.fill();

      // ── stars ──
      for (const s of stars) {
        const a = s.base * (0.55 + 0.45 * Math.sin(t * s.freq + s.phase));
        ctx.fillStyle = `rgba(226,236,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // read the profile card's live position for the card-ledge snow, in
      // canvas-LOCAL coordinates. Subtracting the canvas's own rect converts the
      // card's viewport position into coordinates inside the canvas; since both
      // live in the same scrolling card, these stay constant while scrolling.
      let card: { left: number; right: number; top: number } | null = null;
      const cardEl = cardRef.current;
      if (cardEl) {
        const cRect = canvas.getBoundingClientRect();
        const rc = cardEl.getBoundingClientRect();
        if (rc.width > 0) card = { left: rc.left - cRect.left, right: rc.right - cRect.left, top: rc.top - cRect.top };
      }

      const drawFlakeLayer = (layer: number) => {
        for (const f of flakes) {
          if (f.layer !== layer) continue;
          f.y += f.speed * dt;
          f.x += Math.sin(t * f.freq + f.phase) * f.drift * dt;

          // land on the profile card's top edge → melt into the card ridge
          if (
            card &&
            f.x >= card.left &&
            f.x <= card.right &&
            f.y >= card.top &&
            f.y <= card.top + 12 &&
            card.top < H - (piles[Math.min(piles.length - 1, Math.max(0, Math.floor(f.x / BUCKET)))] || 0)
          ) {
            cardSnow = Math.min(maxCard, cardSnow + f.r * 0.03);
            resetFlake(f, true);
            continue;
          }

          // land on the ground drift
          const bi = Math.min(piles.length - 1, Math.max(0, Math.floor(f.x / BUCKET)));
          if (f.y >= H - (piles[bi] || 0)) {
            piles[bi] = Math.min(maxGround(), (piles[bi] || 0) + f.r * 0.14);
            resetFlake(f, true);
            continue;
          }
          if (f.x < -12) f.x = W + 12;
          else if (f.x > W + 12) f.x = -12;

          const d = f.r * 2;
          ctx.globalAlpha = f.alpha;
          ctx.drawImage(sprite, f.x - f.r, f.y - f.r, d, d);
        }
        ctx.globalAlpha = 1;
      };

      // FAR snow drifts behind the peaks
      drawFlakeLayer(0);

      // ── the three Himalayan ridgelines — translucent, snow-capped ──
      for (const rg of ridges) {
        ctx.globalAlpha = rg.alpha;
        const grad = ctx.createLinearGradient(0, rg.crestY, 0, H);
        grad.addColorStop(0, rg.top);
        grad.addColorStop(0.18, rg.mid);
        grad.addColorStop(1, rg.bottom);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rg.pts[0].x, H);
        for (const p of rg.pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(rg.pts[rg.pts.length - 1].x, H);
        ctx.closePath();
        ctx.fill();
        // moonlit ice highlight tracing the nearest ridge's crest
        if (rg.highlight) {
          ctx.strokeStyle = rg.highlight;
          ctx.globalAlpha = rg.alpha * 0.85;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          rg.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // ── rolling mountain mist ──
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const mx = ((t * (6 + i * 3) + i * W * 0.33) % (W + 400)) - 200;
        const my = H * (0.66 + i * 0.05);
        const mr = W * (0.28 + i * 0.06);
        const mist = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        mist.addColorStop(0, "rgba(200,220,255,0.05)");
        mist.addColorStop(1, "rgba(200,220,255,0)");
        ctx.fillStyle = mist;
        ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      }
      ctx.restore();

      // MID snow
      drawFlakeLayer(1);

      // ── gently settle the drift so neighbouring columns roll into each other ──
      for (let i = 1; i < piles.length - 1; i++) {
        const avg = (piles[i - 1] + piles[i + 1]) * 0.5;
        piles[i] += (avg - piles[i]) * Math.min(1, dt * 1.6);
      }

      // ── the accumulating ground snow, soft & organic via quadratic curves ──
      if (piles.length > 1) {
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, H - piles[0]);
        for (let i = 1; i < piles.length; i++) {
          const x = i * BUCKET;
          const px = (i - 1) * BUCKET;
          const midX = (px + x) / 2;
          const midY = H - (piles[i - 1] + piles[i]) / 2;
          ctx.quadraticCurveTo(px, H - piles[i - 1], midX, midY);
        }
        ctx.lineTo(W, H - piles[piles.length - 1]);
        ctx.lineTo(W, H);
        ctx.closePath();
        const snowGrad = ctx.createLinearGradient(0, H - maxGround(), 0, H);
        snowGrad.addColorStop(0, "rgba(238,246,255,0.7)");
        snowGrad.addColorStop(1, "rgba(198,214,244,0.42)");
        ctx.fillStyle = snowGrad;
        ctx.fill();
      }

      // ── snow resting on the profile card's top edge ──
      if (card && cardSnow > 0.5) {
        const y0 = card.top;
        ctx.beginPath();
        ctx.moveTo(card.left, y0 + 2);
        const span = card.right - card.left;
        const bumps = Math.max(3, Math.round(span / 90));
        for (let i = 0; i <= bumps; i++) {
          const x = card.left + (span * i) / bumps;
          const h = cardSnow * (0.65 + 0.35 * Math.sin(i * 1.7 + card.left * 0.01));
          const px = card.left + (span * (i - 0.5)) / bumps;
          if (i === 0) ctx.lineTo(x, y0 - h);
          else ctx.quadraticCurveTo(px, y0 - cardSnow, x, y0 - h);
        }
        ctx.lineTo(card.right, y0 + 2);
        ctx.closePath();
        ctx.fillStyle = "rgba(244,249,255,0.82)";
        ctx.fill();
      }

      // NEAR snow — large, soft, fast, in front of everything
      drawFlakeLayer(2);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, [canvasRef, cardRef]);
}

// ── Profile-level: the realm, anchored INSIDE the card ──────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function SnowCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  useSnowCanvas(canvasRef, cardRef);

  return (
    <>
      {/* cold, serene night air over the card — the canvas reads this span's
          rect (it fills the card) to pile snow on the card's top edge */}
      <motion.span
        ref={cardRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "rgba(15,25,40,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
      {/* faint moonlight settling from above */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(90% 70% at 75% 0%, rgba(200,220,255,0.12), transparent 60%)" }}
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the snowfall — sized to and clipped by the card, so it scrolls locked to
          the profile like a Discord effect. Sits above the card content so snow
          drifts over the surface and piles on the card's top edge. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
      />
    </>
  );
}

// ── Avatar-level: moonlit frost + a soft snow cap ───────────────────────────

export function SnowAvatarFrost() {
  return (
    <>
      {/* icy moonlit rim glow */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 10px 2px rgba(191,219,254,0.4)",
            "0 0 22px 6px rgba(226,236,255,0.6)",
            "0 0 10px 2px rgba(191,219,254,0.4)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* a thin cap of snow resting on the very CROWN of the avatar — it hugs
          the top rim (y ≲ 21 of a 100 viewBox) so the face below stays clear,
          with soft mounds piled just above the top edge as if it settled there
          while the flakes fall past it to the ground */}
      <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-20">
        <path
          d="M20 21 Q26 9 33 12 Q40 1 47 8 Q50 -3 54 8 Q62 2 68 12 Q75 10 80 21 Q62 12 50 11.5 Q38 12 20 21 Z"
          fill="rgba(246,250,255,0.95)"
        />
        {/* soft blue underside shadow — the snow's shaded belly on the dome */}
        <path
          d="M20 21 Q38 12 50 11.5 Q62 12 80 21"
          fill="none"
          stroke="rgba(186,214,244,0.5)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* moonlit highlight riding the mounds */}
        <path
          d="M20 21 Q26 9 33 12 Q40 1 47 8 Q50 -3 54 8 Q62 2 68 12 Q75 10 80 21"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>

      {/* a few flakes drifting right around the avatar */}
      <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
        {[14, 34, 52, 70, 88, 26].map((left, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ left: `${left}%`, width: 3, height: 3, background: "#eef5ff", boxShadow: "0 0 4px rgba(226,236,255,0.9)" }}
            initial={{ top: "-10%", opacity: 0 }}
            animate={{ top: ["-10%", "112%"], opacity: [0, 1, 1, 0], x: [0, 4, -4, 0] }}
            transition={{ duration: 3.4 + (i % 3) * 0.9, repeat: Infinity, delay: i * 0.5, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}
