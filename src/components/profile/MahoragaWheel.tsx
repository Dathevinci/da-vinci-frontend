"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "Wheel of Adaptation" — the Divine General's Eight-Handled Sword Divergent
 * Sila Divine General Wheel (JJK). Divine gold, metallic bronze, blinding
 * white, abyssal ink-black. No humanoid figures — the avatar IS the ritual's
 * focal point.
 *
 * - MahoragaCardRitual (profile-level, portaled to <body> to escape every
 *   stacking context): a full-viewport canvas (`mix-blend-mode: screen`):
 *   · The Eight-Handled Wheel — a thick inner ring, an outer ring, and exactly
 *     8 handles (spoke → sphere → blade tip) drawn procedurally with cos/sin
 *     around the avatar's LIVE coordinates, in heavy metallic gold/bronze
 *     gradients under a pale-gold shadowBlur.
 *   · The Adaptation Click — the wheel idles with a slow, ominous rotation;
 *     every 4–5 seconds it violently snaps EXACTLY 45° (π/4) on an
 *     easeOutBack curve: heavy, mechanical, unstoppable.
 *   · The Divine Shockwave — at the instant of each click, a high-opacity
 *     white/gold ring erupts from the avatar and expands past the screen
 *     edges, with a brief full-canvas brightness flash.
 *   · Cursed Ink — dark-violet shadow-technique ink drifts upward across the
 *     whole screen like fluid in zero gravity (pre-rendered blob sprites on
 *     desynced sine sways), contrasting the rigid divine geometry.
 *
 * - MahoragaAvatarWheel (avatar-level): registers the anchor and carries the
 *   lightweight DOM accents (gold aura, turning bronze ring, 8 gold studs) so
 *   the shop preview and small surfaces still read as the wheel.
 *
 * Pure code, dt-based physics, DPR capped, cleaned up on unmount.
 */

const MAHORAGA_ANCHORS = new Set<HTMLElement>();

// ── engine ───────────────────────────────────────────────────────────────────

type Ink = { x: number; y: number; vy: number; sway: number; phase: number; scale: number; rot: number; vr: number; sprite: number; alpha: number };
type Shockwave = { r: number };

const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function makeInkSprite(size: number, core: string, halo: string) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const half = size / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, core);
  grad.addColorStop(0.55, halo);
  grad.addColorStop(1, "rgba(30,10,50,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function useMahoragaCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
      // the card and scrolls with it, so the whole ritual stays locked to the
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
    // loading) so the ritual always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // ── cursed ink: two blob sprites, built once ──
    const inkSprites = [
      makeInkSprite(220, "rgba(46,16,80,0.5)", "rgba(76,29,149,0.22)"),
      makeInkSprite(160, "rgba(30,10,50,0.55)", "rgba(88,28,135,0.25)"),
    ];
    const inks: Ink[] = Array.from({ length: 22 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vy: 8 + Math.random() * 14, // upward px/s
      sway: 10 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
      scale: 0.5 + Math.random() * 0.9,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.15,
      sprite: i % 2,
      alpha: 0.22 + Math.random() * 0.26,
    }));
    // a few bright violet motes for contrast
    const motes = Array.from({ length: 8 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vy: 14 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
      size: 1.6 + Math.random() * 1.8,
    }));

    // ── the Adaptation Click state machine ──
    let rot = Math.random() * Math.PI * 2;
    const IDLE_SPEED = 0.05; // rad/s — slow, ominous
    const SNAP_DUR = 0.55; // s — violent
    let snapping = false;
    let snapStart = 0;
    let snapFrom = 0;
    let nextSnap = performance.now() + 2500 + Math.random() * 1500;
    let flash = 0;
    const shockwaves: Shockwave[] = [];

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // abyssal ambience
      const amb = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      amb.addColorStop(0, "rgba(40,20,60,0.14)");
      amb.addColorStop(1, "rgba(10,5,20,0)");
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, W, H);

      // ── cursed ink drifting upward like zero-gravity fluid ──
      for (const k of inks) {
        k.y -= (k.vy * dt) / H;
        k.x += (Math.sin(t * 0.35 + k.phase) * k.sway * dt) / W;
        k.rot += k.vr * dt;
        if (k.y < -0.14) {
          k.y = 1.14;
          k.x = Math.random();
        }
        const sp = inkSprites[k.sprite];
        const w = sp.width * k.scale;
        ctx.save();
        ctx.translate(k.x * W, k.y * H);
        ctx.rotate(k.rot);
        ctx.globalAlpha = k.alpha * (0.8 + 0.2 * Math.sin(t * 0.6 + k.phase));
        ctx.drawImage(sp, -w / 2, -w / 2, w, w);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const m of motes) {
        m.y -= (m.vy * dt) / H;
        m.x += (Math.sin(t * 0.7 + m.phase) * 9 * dt) / W;
        if (m.y < -0.05) {
          m.y = 1.05;
          m.x = Math.random();
        }
        ctx.globalAlpha = 0.35 + 0.4 * Math.sin(t * 1.4 + m.phase);
        ctx.fillStyle = "#a78bfa";
        ctx.shadowColor = "rgba(167,139,250,0.9)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(m.x * W, m.y * H, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // ── track the vessel, in canvas-LOCAL coordinates ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the wheel is pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      MAHORAGA_ANCHORS.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > best) {
          best = rect.width;
          target = { x: rect.left - cRect.left + rect.width / 2, y: rect.top - cRect.top + rect.height / 2, r: rect.width / 2 };
        }
      });

      // snapshot: TS can't track assignments made inside the forEach closure
      const vessel = target as { x: number; y: number; r: number } | null;

      // ── the Adaptation Click ──
      if (!snapping) {
        rot += IDLE_SPEED * dt;
        if (now >= nextSnap && vessel) {
          snapping = true;
          snapStart = now;
          snapFrom = rot;
          flash = 1;
          shockwaves.push({ r: vessel.r * 1.1 });
        }
      } else {
        const p = Math.min(1, (now - snapStart) / (SNAP_DUR * 1000));
        rot = snapFrom + (Math.PI / 4) * easeOutBack(p);
        if (p >= 1) {
          snapping = false;
          nextSnap = now + 4000 + Math.random() * 1000;
        }
      }

      // ── the Eight-Handled Wheel ──
      if (vessel) {
        const { x: cx, y: cy, r } = vessel;
        const snapGlow = snapping ? 1 - Math.min(1, (now - snapStart) / (SNAP_DUR * 1000)) : 0;

        // heavy metallic gradient shared by the whole wheel
        const R = r * 2.15;
        const metal = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        metal.addColorStop(0, "#fff7d6");
        metal.addColorStop(0.25, "#FFD700");
        metal.addColorStop(0.5, "#B8860B");
        metal.addColorStop(0.75, "#FFD700");
        metal.addColorStop(1, "#fff7d6");

        ctx.save();
        ctx.shadowColor = "rgba(255,240,200,0.9)";
        ctx.shadowBlur = 16 + snapGlow * 22;

        // outer ring
        ctx.strokeStyle = metal;
        ctx.lineWidth = r * 0.055;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
        ctx.stroke();
        // thick inner ring
        ctx.lineWidth = r * 0.1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
        ctx.stroke();

        // exactly 8 handles: spoke → sphere → blade tip
        for (let k = 0; k < 8; k++) {
          const ang = rot + (k * Math.PI) / 4;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          // spoke from the outer ring out to the sphere
          ctx.lineWidth = r * 0.06;
          ctx.beginPath();
          ctx.moveTo(cx + ca * r * 1.45, cy + sa * r * 1.45);
          ctx.lineTo(cx + ca * r * 1.72, cy + sa * r * 1.72);
          ctx.stroke();
          // the sphere — its own radial highlight for the 3D metal look
          const sx = cx + ca * r * 1.78;
          const sy = cy + sa * r * 1.78;
          const sr = r * 0.095;
          const orb = ctx.createRadialGradient(sx - sr * 0.35, sy - sr * 0.35, 0, sx, sy, sr);
          orb.addColorStop(0, "#ffffff");
          orb.addColorStop(0.45, "#FFD700");
          orb.addColorStop(1, "#8a6508");
          ctx.fillStyle = orb;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
          // blade tip tapering to a sharp point
          const px = ca * r * 0.06;
          const py = sa * r * 0.06;
          ctx.fillStyle = metal;
          ctx.beginPath();
          ctx.moveTo(sx - py, sy + px); // perpendicular base corner
          ctx.lineTo(sx + py, sy - px);
          ctx.lineTo(cx + ca * r * 2.15, cy + sa * r * 2.15); // the point
          ctx.closePath();
          ctx.fill();
        }

        // rivets between the handles on the inner ring
        ctx.shadowBlur = 8;
        for (let k = 0; k < 8; k++) {
          const ang = rot + (k * Math.PI) / 4 + Math.PI / 8;
          ctx.fillStyle = "#fff2b8";
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * r * 1.18, cy + Math.sin(ang) * r * 1.18, r * 0.03, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // ── divine shockwaves ──
        const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.05;
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const s = shockwaves[i];
          s.r += (maxR / 0.7) * dt; // clears the screen in ~0.7s
          const p = Math.min(1, s.r / maxR);
          if (p >= 1) {
            shockwaves.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.strokeStyle = `rgba(255,248,225,${(0.85 * (1 - p)).toFixed(3)})`;
          ctx.lineWidth = 14 * (1 - p) + 2;
          ctx.shadowColor = "rgba(255,215,0,0.9)";
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
          ctx.stroke();
          // trailing gold echo
          ctx.strokeStyle = `rgba(255,215,0,${(0.4 * (1 - p)).toFixed(3)})`;
          ctx.lineWidth = 5 * (1 - p) + 1;
          ctx.beginPath();
          ctx.arc(cx, cy, s.r * 0.92, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ── the click's screen flash ──
      if (flash > 0.01) {
        ctx.fillStyle = `rgba(255,245,215,${(flash * 0.22).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      flash = Math.max(0, flash - dt * 3.4);

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

// ── Profile-level: the ritual, anchored INSIDE the card ─────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function MahoragaCardRitual() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMahoragaCanvas(canvasRef);

  return (
    <>
      {/* abyssal ink wash over the card, gold light pooling below */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 15%, rgba(20,12,40,0.6), rgba(10,8,20,0.3) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.88] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 100%, rgba(255,215,0,0.1), transparent 60%)" }}
        animate={{ opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot: the ritual convenes when the profile is beheld */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(75% 65% at 50% 35%, rgba(255,248,225,0.9), rgba(184,134,11,0.35) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0, 0.4, 0] }}
        transition={{ duration: 1.5, times: [0, 0.15, 0.4, 0.55, 1], ease: "easeOut" }}
      />

      {/* the eight-handled wheel — sized to and clipped by the card, so it
          scrolls locked to the profile like a Discord effect. Sits above the
          card content so the wheel crowns the avatar and ink drifts over it. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the vessel's mark ──────────────────────────────────────────

export function MahoragaAvatarWheel() {
  // Register so the wheel + shockwaves center on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    MAHORAGA_ANCHORS.add(el);
    return () => {
      MAHORAGA_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* divine gold aura breathing on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 4px rgba(10,8,20,0.9), 0 0 26px 8px rgba(255,215,0,0.4)",
            "0 0 16px 6px rgba(10,8,20,0.95), 0 0 44px 14px rgba(255,236,150,0.6)",
            "0 0 12px 4px rgba(10,8,20,0.9), 0 0 26px 8px rgba(255,215,0,0.4)",
          ],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* slow bronze-gold ring — the wheel's presence at small sizes */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[6%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,215,0,0), rgba(255,236,150,0.8), rgba(184,134,11,0.5), rgba(255,215,0,0), rgba(255,215,0,0.7), rgba(184,134,11,0.45), rgba(255,215,0,0))",
          filter: "blur(1.5px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
          maskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />

      {/* eight gold studs — the handles, in miniature */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[10%] z-20"
        animate={{ rotate: 360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const ang = (i * Math.PI) / 4;
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${50 + Math.cos(ang) * 50}%`,
                top: `${50 + Math.sin(ang) * 50}%`,
                width: 5,
                height: 5,
                marginLeft: -2.5,
                marginTop: -2.5,
                background: "radial-gradient(circle at 35% 35%, #ffffff, #FFD700 55%, #8a6508)",
                boxShadow: "0 0 7px 2px rgba(255,215,0,0.75)",
              }}
            />
          );
        })}
      </motion.span>
    </>
  );
}
