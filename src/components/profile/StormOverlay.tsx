"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Monarch's Tempest" — a cinematic dark-fantasy weather system (Solo Leveling
 * shadow-aura / JJK domain mood). Everything is generated in code — no images.
 *
 * - TempestCardStorm (profile-level, anchored INSIDE the profile card):
 *   · Drifting cel-shaded storm clouds in three parallax bands rolling across
 *     the whole viewport (CSS keyframes with negative delays = already mid-sky).
 *   · A full-viewport canvas engine: three depth layers of GLOWING GRADIENT
 *     rain streaks (pre-rendered offscreen sprites, one drawImage per drop),
 *     splash particles when rain hits the viewport floor OR the avatar (the
 *     avatar registers itself as a solid collider), rolling ground fog, and
 *     violent branched lightning with shadowBlur glow.
 *   · Lightning drives a `--flash` CSS variable each frame, which powers a
 *     global color-grade overlay (brightness/contrast spike) and backlights
 *     the drifting clouds — the whole page reacts to every strike.
 *
 * - TempestAvatarStorm (avatar-level): swirling shadow-energy aura (counter-
 *   rotating masked conic gradients), a cel-shaded thundercloud with lightning
 *   glowing inside, erratic electric arcs, rain streaks — and it registers the
 *   avatar as a collider so the global rain shatters against it.
 *
 * Physics is delta-time based (frame-rate independent); DPR is capped; all
 * loops and listeners are cleaned up on unmount.
 */

// Avatars register here so the storm engine treats them as solid objects.
const COLLIDERS = new Set<HTMLElement>();

// ── The storm engine ─────────────────────────────────────────────────────────

type Drop = { x: number; y: number; jit: number };
type Splash = { x: number; y: number; vx: number; vy: number; life: number; max: number };
type Bolt = { pts: [number, number][]; branches: [number, number][][] };

const RAIN_LAYERS = [
  // far → near: slow/faint/short behind, fast/bright/long (and softly blurred) in front
  { n: 65, speed: 1400, len: 26, w: 1, alpha: 0.35, rgb: "148,190,255", blur: 0 },
  { n: 55, speed: 2100, len: 40, w: 1.5, alpha: 0.55, rgb: "125,211,252", blur: 2 },
  { n: 35, speed: 3000, len: 60, w: 2, alpha: 0.75, rgb: "165,243,252", blur: 4 },
];

function useStormCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  wrapperRef: RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport. The canvas is a child of
      // the card and scrolls with it, so the whole storm stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow, images
    // loading) so the storm always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // ── offscreen sprites: gradient rain streaks (transparent tail → glowing head) ──
    const makeStreak = (len: number, w: number, rgb: string, alpha: number, blur: number) => {
      const pad = w + blur + 1;
      const sw = Math.ceil(len * 0.28 + pad * 2);
      const sh = Math.ceil(len + pad * 2);
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(pad, pad, sw - pad, sh - pad);
      grad.addColorStop(0, `rgba(${rgb},0)`);
      grad.addColorStop(0.55, `rgba(${rgb},${alpha * 0.5})`);
      grad.addColorStop(1, `rgba(${rgb},${alpha})`);
      g.strokeStyle = grad;
      g.lineWidth = w;
      g.lineCap = "round";
      if (blur > 0) {
        g.shadowColor = `rgba(${rgb},${Math.min(1, alpha)})`;
        g.shadowBlur = blur;
      }
      g.beginPath();
      g.moveTo(pad, pad);
      g.lineTo(sw - pad, sh - pad);
      g.stroke();
      return { c, sw, sh };
    };

    // ── offscreen sprite: soft fog blob ──
    const makeFog = (size: number) => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = Math.round(size * 0.5);
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(size / 2, size * 0.25, 0, size / 2, size * 0.25, size / 2);
      grad.addColorStop(0, "rgba(148,163,184,0.55)");
      grad.addColorStop(0.6, "rgba(100,116,139,0.22)");
      grad.addColorStop(1, "rgba(100,116,139,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size * 0.5);
      return c;
    };
    const fogSprites = [makeFog(300), makeFog(420)];
    const fogBlobs = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * 1.3 - 0.15,
      speed: 0.008 + Math.random() * 0.014,
      sprite: i % 2,
      alpha: 0.16 + Math.random() * 0.14,
      bob: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.7,
    }));

    const layers = RAIN_LAYERS.map((L) => ({
      ...L,
      sprite: makeStreak(L.len, L.w, L.rgb, L.alpha, L.blur),
      drops: Array.from({ length: L.n }, (): Drop => ({ x: Math.random(), y: Math.random(), jit: 0.85 + Math.random() * 0.3 })),
    }));

    // ── splash particles (rain shattering on the floor / on avatars) ──
    const splashes: Splash[] = [];
    const spawnSplash = (x: number, y: number, big: boolean) => {
      if (splashes.length > 150) return;
      const n = big ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const max = 0.3 + Math.random() * 0.25;
        splashes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 130,
          vy: -(40 + Math.random() * 120),
          life: max,
          max,
        });
      }
    };

    // ── lightning ──
    let bolt: Bolt | null = null;
    let boltAge = 0;
    let flash = 0;
    let nextStrike = performance.now() + 1800 + Math.random() * 3000;

    const makeBolt = (): Bolt => {
      let x = W * (0.15 + Math.random() * 0.7);
      let y = -10;
      const pts: [number, number][] = [[x, y]];
      const branches: [number, number][][] = [];
      const endY = H * (0.5 + Math.random() * 0.35);
      while (y < endY) {
        y += 14 + Math.random() * 26;
        x += (Math.random() - 0.5) * 46;
        pts.push([x, y]);
        if (Math.random() < 0.22) {
          let bx = x;
          let by = y;
          const branch: [number, number][] = [[bx, by]];
          const dir = Math.random() < 0.5 ? -1 : 1;
          const steps = 2 + Math.floor(Math.random() * 4);
          for (let i = 0; i < steps; i++) {
            by += 10 + Math.random() * 20;
            bx += dir * (8 + Math.random() * 26);
            branch.push([bx, by]);
          }
          branches.push(branch);
        }
      }
      return { pts, branches };
    };

    const strokePath = (pts: [number, number][]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, W, H);

      // ambient veil — darkens the scene, lightning briefly lifts it
      ctx.fillStyle = `rgba(2,6,18,${(0.15 * (1 - flash)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      if (flash > 0.01) {
        ctx.fillStyle = `rgba(190,220,255,${(flash * 0.24).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // avatars registered as solid objects — rain shatters against them.
      // Subtracting the canvas's own rect converts each avatar's viewport
      // position into coordinates INSIDE the card, so the colliders stay
      // pixel-locked to the pfp while the card scrolls.
      const cRect = canvas.getBoundingClientRect();
      const circles: { cx: number; cy: number; r: number }[] = [];
      COLLIDERS.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 8) {
          circles.push({ cx: r.left - cRect.left + r.width / 2, cy: r.top - cRect.top + r.height / 2, r: r.width / 2 });
        }
      });

      // rain — one cached gradient sprite per layer, one drawImage per drop
      for (const L of layers) {
        const { c, sw, sh } = L.sprite;
        for (const d of L.drops) {
          d.y += (L.speed * d.jit * dt) / H;
          d.x += (L.speed * 0.28 * d.jit * dt) / W;
          const px = d.x * W;
          const py = d.y * H;
          let hit = false;
          if (py >= H - 3) {
            spawnSplash(px, H - 3, L.blur > 0);
            hit = true;
          } else {
            for (const cc of circles) {
              const dx = px - cc.cx;
              const dy = py - cc.cy;
              if (dx * dx + dy * dy < cc.r * cc.r && py < cc.cy + cc.r * 0.2) {
                spawnSplash(px, py, L.blur > 0);
                hit = true;
                break;
              }
            }
          }
          if (hit || d.y > 1.05) {
            d.y = -0.08;
            d.x = Math.random() * 1.25 - 0.18;
            continue;
          }
          ctx.drawImage(c, px - sw, py - sh);
        }
      }

      // splash particles — tiny shards with gravity, fading out
      if (splashes.length) {
        ctx.fillStyle = "rgba(165,243,252,1)";
        for (let i = splashes.length - 1; i >= 0; i--) {
          const p = splashes[i];
          p.vy += 620 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) {
            splashes.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.85;
          ctx.fillRect(p.x, p.y, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
      }

      // rolling ground fog — eerie mist creeping along the bottom
      for (const f of fogBlobs) {
        f.x += f.speed * dt;
        if (f.x > 1.25) f.x = -0.3;
        f.bob += dt * 0.4;
        const sp = fogSprites[f.sprite];
        const fw = sp.width * f.scale;
        const fh = sp.height * f.scale;
        ctx.globalAlpha = f.alpha * (1 + flash * 0.8);
        ctx.drawImage(sp, f.x * W - fw / 2, H - fh * 0.72 + Math.sin(f.bob) * 6, fw, fh);
      }
      ctx.globalAlpha = 1;

      // lightning bolt — indigo glow pass under a white-hot core
      if (bolt && boltAge < 0.28) {
        const a = 1 - boltAge / 0.28;
        ctx.save();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(147,197,253,0.9)";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(129,140,248,${0.55 * a})`;
        ctx.lineWidth = 6;
        strokePath(bolt.pts);
        ctx.strokeStyle = `rgba(224,242,254,${0.95 * a})`;
        ctx.lineWidth = 2.4;
        strokePath(bolt.pts);
        ctx.lineWidth = 1.3;
        for (const b of bolt.branches) strokePath(b);
        ctx.restore();
        boltAge += dt;
      }

      if (now >= nextStrike) {
        bolt = makeBolt();
        boltAge = 0;
        flash = 1;
        // occasional double-strike for that unpredictable, dangerous feel
        nextStrike = Math.random() < 0.3 ? now + 260 : now + 2800 + Math.random() * 6500;
      }
      flash = Math.max(0, flash - dt * 3.2);

      // one CSS variable drives the page-wide color grade + cloud backlight
      if (wrapper) wrapper.style.setProperty("--flash", flash.toFixed(3));

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, [canvasRef, wrapperRef]);
}

// ── Drifting storm sky: cel-shaded clouds rolling left → right, three bands ──

// All bands hug the top of the viewport — a rolling storm CEILING that never
// drifts down over faces or content.
const DRIFT_CLOUDS = [
  // background: small, faint, slow
  { top: "1%", scale: 0.7, dur: 160, delay: -90, op: 0.3, z: 0 },
  { top: "7%", scale: 0.6, dur: 175, delay: -120, op: 0.26, z: 0 },
  // midground
  { top: "0%", scale: 1.1, dur: 112, delay: -60, op: 0.5, z: 1 },
  { top: "4%", scale: 0.95, dur: 128, delay: -16, op: 0.44, z: 1 },
  // foreground: large, dark, faster — anchored partly above the viewport edge
  { top: "-6%", scale: 1.6, dur: 78, delay: -22, op: 0.85, z: 2 },
  { top: "-4%", scale: 1.8, dur: 66, delay: -48, op: 0.9, z: 2 },
];

function DriftClouds() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`@keyframes tempest-drift { from { transform: translateX(-48vw) scale(var(--cs)); } to { transform: translateX(114vw) scale(var(--cs)); } }`}</style>
      {DRIFT_CLOUDS.map((c, i) => (
        <span
          key={i}
          className="absolute left-0 block w-[42vw] min-w-[260px] max-w-[600px]"
          style={
            {
              top: c.top,
              opacity: c.op,
              zIndex: c.z,
              "--cs": c.scale,
              animation: `tempest-drift ${c.dur}s linear ${c.delay}s infinite`,
            } as CSSProperties
          }
        >
          <CloudShape className="h-auto w-full" />
        </span>
      ))}
    </div>
  );
}

// A big, flat-toned, hard-edged storm cloud (three values + rim light) with a
// faint violet under-glow — the litRPG storm-sky silhouette.
function CloudShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 74" className={className}>
      <ellipse cx="110" cy="60" rx="86" ry="12" fill="#4c1d95" opacity="0.22" />
      <g fill="#0b1120">
        <ellipse cx="42" cy="52" rx="38" ry="16" />
        <ellipse cx="112" cy="56" rx="52" ry="16" />
        <ellipse cx="180" cy="52" rx="36" ry="15" />
      </g>
      <g fill="#111c33">
        <ellipse cx="38" cy="40" rx="30" ry="17" />
        <ellipse cx="82" cy="30" rx="34" ry="21" />
        <ellipse cx="136" cy="28" rx="37" ry="23" />
        <ellipse cx="184" cy="40" rx="29" ry="17" />
      </g>
      <g fill="#1d2b47">
        <ellipse cx="72" cy="22" rx="21" ry="12" />
        <ellipse cx="130" cy="17" rx="23" ry="12" />
        <ellipse cx="176" cy="31" rx="16" ry="9" />
      </g>
      <g fill="#3b4d70">
        <ellipse cx="68" cy="14" rx="11" ry="3.6" />
        <ellipse cx="126" cy="9" rx="12" ry="3.8" />
        <ellipse cx="172" cy="24" rx="8" ry="2.8" />
      </g>
    </svg>
  );
}

// ── Profile-level: the full storm, anchored INSIDE the card ─────────────────
// The storm wrapper is a child of the profile card (not portaled to <body>), so
// it scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function TempestCardStorm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useStormCanvas(canvasRef, wrapperRef);

  return (
    <>
      {/* the storm — sized to and clipped by the card, so it scrolls locked to
          the profile like a Discord effect */}
      <div
        ref={wrapperRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30]"
        style={{ "--flash": 0 } as CSSProperties}
      >
        {/* backlight BEHIND the clouds — they light up when lightning hits */}
        <div
          className="absolute inset-0"
          style={{
            opacity: "calc(var(--flash, 0) * 0.9)",
            background:
              "radial-gradient(70% 45% at 50% 8%, rgba(167,139,250,0.55), rgba(56,189,248,0.25) 45%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
        <DriftClouds />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {/* page-wide color grade — brightness/contrast spike on every strike */}
        <div
          className="absolute inset-0"
          style={{
            opacity: "calc(var(--flash, 0) * 0.55)",
            background: "linear-gradient(180deg, rgba(139,92,246,0.5), rgba(56,189,248,0.32))",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      {/* deep storm-blue wash over the card, behind the text */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(30,58,138,0.45), rgba(8,47,73,0.18) 45%, transparent 72%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.85] }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(90% 70% at 50% 100%, rgba(56,189,248,0.12), transparent 60%)" }}
        animate={{ opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot thunderclap flash when the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(70% 60% at 50% 30%, rgba(224,242,254,0.9), rgba(129,140,248,0.35) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0, 0.5, 0] }}
        transition={{ duration: 1.1, times: [0, 0.12, 0.3, 0.42, 1], ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the eye of the storm ───────────────────────────────────────

// Jagged little arcs that snap around the border, each on its own flicker cycle.
const ARCS = [
  { d: "M2 12 L9 5 L6 11 L14 3", pos: "right-[-8%] top-[12%]", delay: 0.6, period: 2.8 },
  { d: "M2 4 L8 10 L5 6 L13 13", pos: "left-[-9%] top-[38%]", delay: 1.7, period: 3.4 },
  { d: "M3 13 L8 4 L7 9 L13 2", pos: "right-[4%] bottom-[-4%]", delay: 2.6, period: 3.1 },
];

export function TempestAvatarStorm() {
  // Register the avatar as a solid object in the storm — global rain splashes
  // against it (the engine reads this element's rect every frame).
  const colliderRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = colliderRef.current;
    if (!el) return;
    COLLIDERS.add(el);
    return () => {
      COLLIDERS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={colliderRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* swirling shadow-energy aura — two counter-rotating smoky rings */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[14%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(15,23,42,0), rgba(88,28,135,0.6), rgba(2,6,23,0.85), rgba(30,58,138,0.55), rgba(15,23,42,0), rgba(76,29,149,0.65), rgba(2,6,23,0.8), rgba(15,23,42,0))",
          filter: "blur(6px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 52%, #000 64%)",
          maskImage: "radial-gradient(circle, transparent 52%, #000 64%)",
        }}
        animate={{ rotate: 360, scale: [1, 1.05, 1] }}
        transition={{
          rotate: { duration: 7, repeat: Infinity, ease: "linear" },
          scale: { duration: 3.1, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[9%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 180deg, rgba(15,23,42,0), rgba(56,189,248,0.35), rgba(2,6,23,0.7), rgba(139,92,246,0.45), rgba(15,23,42,0))",
          filter: "blur(5px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 55%, #000 66%)",
          maskImage: "radial-gradient(circle, transparent 55%, #000 66%)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "linear" }}
      />

      {/* electric aura hugging the border */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 10px 2px rgba(56,189,248,0.4)",
            "0 0 24px 7px rgba(99,102,241,0.7)",
            "0 0 12px 3px rgba(56,189,248,0.45)",
            "0 0 20px 6px rgba(125,211,252,0.65)",
            "0 0 10px 2px rgba(56,189,248,0.4)",
          ],
        }}
        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
      />

      <span aria-hidden className="pointer-events-none absolute -inset-2 z-20">
        {/* thin rain streaks falling past the avatar */}
        {[18, 44, 72, 90].map((x, i) => (
          <motion.span
            key={i}
            className="absolute w-px rounded-full"
            style={{ left: `${x}%`, height: "26%", background: "linear-gradient(to bottom, transparent, rgba(165,243,252,0.85))", rotate: "14deg" }}
            initial={{ top: "-30%", opacity: 0 }}
            animate={{ top: ["-30%", "115%"], opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.9 + (i % 3) * 0.25, repeat: Infinity, delay: i * 0.4, ease: "linear" }}
          />
        ))}

        {/* electric arcs snapping around the rim */}
        {ARCS.map((a, i) => (
          <motion.span
            key={i}
            className={`absolute ${a.pos} block w-[22%] min-w-[10px] max-w-[26px]`}
            animate={{ opacity: [0, 0, 1, 0.2, 1, 0] }}
            transition={{ duration: a.period, times: [0, 0.6, 0.65, 0.7, 0.76, 0.85], repeat: Infinity, delay: a.delay, ease: "linear" }}
          >
            <svg viewBox="0 0 16 16" className="h-auto w-full" style={{ filter: "drop-shadow(0 0 4px rgba(125,211,252,0.95))" }}>
              <path d={a.d} fill="none" stroke="#bae6fd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        ))}

        {/* cel-shaded thundercloud wrapping the top edge of the avatar */}
        <motion.span
          className="absolute left-1/2 top-[-16%] block w-[112%]"
          style={{ x: "-50%" }}
          animate={{ y: [0, -2, 0], x: ["-50%", "-48%", "-50%"] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ThunderCloud className="h-auto w-full" />
        </motion.span>
      </span>
    </>
  );
}

// Flat-toned, hard-edged cloud in three values (shadow → base → rim light) for
// that cel-shaded anime look, with lightning glowing from inside.
function ThunderCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 52" className={className} style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.5))" }}>
      {/* lightning glow pulsing INSIDE the cloud */}
      <motion.ellipse
        cx="88"
        cy="34"
        rx="26"
        ry="12"
        fill="#818cf8"
        animate={{ opacity: [0, 0, 0.85, 0.15, 0.7, 0] }}
        transition={{ duration: 3.6, times: [0, 0.55, 0.6, 0.66, 0.71, 0.8], repeat: Infinity, ease: "linear" }}
      />
      {/* under-shadow mass (darkest value) */}
      <g fill="#0f172a">
        <ellipse cx="28" cy="40" rx="24" ry="12" />
        <ellipse cx="70" cy="43" rx="30" ry="12" />
        <ellipse cx="112" cy="40" rx="24" ry="11" />
      </g>
      {/* main cloud body (base value) */}
      <g fill="#1e293b">
        <ellipse cx="24" cy="33" rx="20" ry="13" />
        <ellipse cx="52" cy="26" rx="22" ry="16" />
        <ellipse cx="86" cy="24" rx="24" ry="17" />
        <ellipse cx="116" cy="32" rx="19" ry="13" />
      </g>
      {/* mid tone bumps */}
      <g fill="#334155">
        <ellipse cx="46" cy="20" rx="14" ry="9" />
        <ellipse cx="82" cy="16" rx="15" ry="9" />
        <ellipse cx="110" cy="26" rx="11" ry="7" />
      </g>
      {/* hard rim light (cel highlight) */}
      <g fill="#64748b">
        <ellipse cx="43" cy="14.5" rx="8" ry="3" />
        <ellipse cx="79" cy="10.5" rx="9" ry="3" />
        <ellipse cx="108" cy="21" rx="6" ry="2.4" />
      </g>
    </svg>
  );
}
