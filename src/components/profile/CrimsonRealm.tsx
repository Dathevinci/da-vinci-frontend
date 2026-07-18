"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "The Visceral Crimson Realm" — a DONOR-EXCLUSIVE profile effect, granted only
 * to the username "Māna-Yood-Sushāī". Not sold in the shop.
 *
 * - CrimsonCardRealm (profile-level, a canvas child of the profile card that
 *   scrolls locked to it like a Discord effect, `mix-blend-mode: screen`):
 *   · The Jagged Cosmic Halo — THREE overlapping thorned rings drawn
 *     procedurally point-by-point around the avatar's live coordinates. Each
 *     ring's radius spikes EXPONENTIALLY at 3 evenly spaced angles, producing
 *     massive needle-like thorns (not a smooth circle); dense crimson node
 *     orbs burn at the thorn bases. The layers counter-rotate at different
 *     speeds and are composited with globalCompositeOperation='lighter' under
 *     shadowBlur 30 for the neon blood-glow.
 *   · The Viscous Red Sea — four heavy dual-harmonic wave bands with
 *     randomized phase shifts churning across the bottom third, abyssal
 *     troughs under glowing blood-red crests.
 *   · Ash & Embers — 150 particles rising from the sea with erratic sine
 *     wander; within 200px of the avatar a gravitational vector violently
 *     pulls them into the halo, shrinking them until they vanish on contact.
 *
 * - CrimsonAvatarMark (avatar-level): registers the avatar as the halo anchor
 *   and adds a breathing blood-glow.
 *
 * No humanoid figures are ever drawn — the avatar itself is the focal point.
 * Pure code, dt-based physics, DPR capped, cleaned up on unmount.
 */

// The blessed avatar registers here; the realm centers on the largest visible one.
const CRIMSON_ANCHORS = new Set<HTMLElement>();

// The one soul this realm answers to. Identity is PERSISTENT so a username change
// never strips her realm again: the authoritative marker is that her account OWNS
// the un-buyable effect_crimson (it lives in `purchasedEffects`). Because crimson
// is absent from the shop catalog it can never be bought or gifted, so no other
// account can ever carry that marker. The hardcoded username is only a fallback
// for the moment before her account is backfilled — kept in sync with her
// current name so she's recognised instantly even before the marker lands.
export const CRIMSON_CHOSEN = "underworld_daoist";

// Accepts EITHER the user object (preferred — rename-proof) or a bare username.
export function isCrimsonChosen(u?: any): boolean {
  if (!u) return false;
  if (typeof u === "object") {
    if (Array.isArray(u.purchasedEffects) && u.purchasedEffects.includes("effect_crimson")) return true;
    return (u.username || "").toLowerCase() === CRIMSON_CHOSEN;
  }
  return (u || "").toLowerCase() === CRIMSON_CHOSEN;
}

// The value stored in `activeEffect` when the chosen deliberately silences her
// realm. It is not a real effect id, so nothing renders for it.
export const CRIMSON_OFF = "effect_none";

// Is the chosen's crimson realm currently showing? Her realm is her DEFAULT:
// an empty activeEffect means "wearing crimson". It is off only when she has
// equipped some OTHER effect, or explicitly silenced it (CRIMSON_OFF).
export function isCrimsonActive(activeEffect?: string | null) {
  return activeEffect === "effect_crimson" || !activeEffect;
}

/**
 * The effect a profile should actually render, honoring the donor rules:
 *  - The chosen wears whatever she equips (crimson OR any shop effect she
 *    bought); an empty slot defaults back to her crimson realm so she never
 *    loses it by unequipping; CRIMSON_OFF means she silenced it entirely.
 *  - Nobody else may ever wear effect_crimson, even if the field is set by hand.
 */
export function resolveActiveEffect(
  userOrUsername?: any,
  activeEffect?: string | null
): string | undefined {
  if (isCrimsonChosen(userOrUsername)) {
    if (activeEffect === CRIMSON_OFF) return undefined;
    return activeEffect || "effect_crimson";
  }
  return activeEffect === "effect_crimson" ? undefined : activeEffect || undefined;
}

// ── engine ───────────────────────────────────────────────────────────────────

type Ember = { x: number; y: number; vx: number; vy: number; phase: number; size: number; hot: boolean };

const SEA_BANDS = [
  { yAt: 0.72, amp: 10, amp2: 5, k: 1.6, k2: 3.7, speed: 0.22, speed2: -0.38, fill: "rgba(90,4,4,0.2)", crest: "rgba(255,30,30,0.5)" },
  { yAt: 0.79, amp: 14, amp2: 6, k: 1.2, k2: 2.9, speed: -0.17, speed2: 0.31, fill: "rgba(120,8,8,0.24)", crest: "rgba(255,50,50,0.6)" },
  { yAt: 0.86, amp: 12, amp2: 5, k: 2.0, k2: 4.4, speed: 0.28, speed2: -0.45, fill: "rgba(70,2,2,0.3)", crest: "rgba(220,20,20,0.55)" },
  { yAt: 0.93, amp: 9, amp2: 4, k: 2.5, k2: 5.2, speed: -0.33, speed2: 0.5, fill: "rgba(139,0,0,0.34)", crest: "rgba(255,70,70,0.65)" },
];

// Three overlapping thorned rings — different speeds, directions, and weights.
const HALO_LAYERS = [
  { rotSpeed: 0.2, dir: 1, scale: 0.94, width: 6, color: "rgba(139,0,0,0.65)", blur: 30, thorn: 1.35, sigma: 0.075 },
  { rotSpeed: 0.14, dir: -1, scale: 1.0, width: 3, color: "rgba(220,38,38,0.8)", blur: 30, thorn: 1.6, sigma: 0.06 },
  { rotSpeed: 0.09, dir: 1, scale: 1.08, width: 1.8, color: "rgba(255,60,60,0.9)", blur: 18, thorn: 1.5, sigma: 0.05 },
];
const HALO_STEPS = 168;
const THIRD = (Math.PI * 2) / 3;

function useCrimsonCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
      // the card and scrolls with it, so the whole realm stays locked to the
      // profile (Discord-style) instead of lagging behind while you scroll.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    // React to the card growing/shrinking (bio length, responsive reflow,
    // images loading) so the realm always fills it exactly.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // randomized phase shifts per sea band (pseudo-Perlin turbulence)
    const seaPhase = SEA_BANDS.map(() => ({
      p1: Math.random() * Math.PI * 2,
      p2: Math.random() * Math.PI * 2,
    }));

    // ── 150 embers + ash rising from the sea ──
    const embers: Ember[] = Array.from({ length: 150 }, (_, i) => ({
      x: Math.random(),
      y: 0.7 + Math.random() * 0.3,
      vx: 0,
      vy: -(10 + Math.random() * 24),
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 1.7,
      hot: i % 4 !== 0, // every 4th is dim, pitch-dark "ash"
    }));
    const respawn = (e: Ember) => {
      e.x = Math.random();
      e.y = 0.76 + Math.random() * 0.24;
      e.vx = 0;
      e.vy = -(10 + Math.random() * 24);
    };

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // oppressive crimson ambience
      const amb = ctx.createRadialGradient(W / 2, H * 0.85, 0, W / 2, H * 0.85, H * 0.9);
      amb.addColorStop(0, "rgba(80,0,0,0.22)");
      amb.addColorStop(1, "rgba(20,0,0,0)");
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, W, H);

      // ── track the blessed avatar, in canvas-LOCAL coordinates ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the halo is pixel-locked to the pfp, never lagging.
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      CRIMSON_ANCHORS.forEach((el) => {
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

      // ── the Jagged Cosmic Halo: 3 layered thorned rings, additively blended ──
      let haloR = 0;
      if (target) {
        const { x: cx, y: cy, r } = target;
        haloR = r * 1.45;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineJoin = "round";
        ctx.shadowColor = "#ff0000";
        HALO_LAYERS.forEach((L, k) => {
          const rot = t * L.rotSpeed * L.dir + k * 2.1;
          const R = haloR * L.scale * (1 + 0.04 * Math.sin(t * 1.3 + k * 1.7));
          ctx.beginPath();
          for (let i = 0; i <= HALO_STEPS; i++) {
            const ang = (i / HALO_STEPS) * Math.PI * 2;
            // angular distance to the nearest of this layer's 3 rotating thorns
            const m = (((ang - rot) % THIRD) + THIRD) % THIRD;
            const dth = Math.min(m, THIRD - m);
            // exponential needle: huge at the thorn angle, collapsing fast off it
            const needle = 1 + L.thorn * Math.exp(-Math.pow(dth / L.sigma, 1.35));
            // low-amplitude jag so the ring itself is never a smooth circle
            const jag = 1 + 0.045 * Math.sin(ang * 7 + t * 1.2 + k * 2) + 0.035 * Math.sin(ang * 11 - t * 0.8);
            const rad = R * jag * needle;
            const px = cx + Math.cos(ang) * rad;
            const py = cy + Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.shadowBlur = L.blur;
          ctx.strokeStyle = L.color;
          ctx.lineWidth = L.width;
          ctx.stroke();
        });
        // dense crimson node-orbs burning at the middle layer's thorn bases
        const midRot = t * HALO_LAYERS[1].rotSpeed * HALO_LAYERS[1].dir + 2.1;
        for (let j = 0; j < 3; j++) {
          const ang = midRot + j * THIRD;
          const nx = cx + Math.cos(ang) * haloR;
          const ny = cy + Math.sin(ang) * haloR;
          const nr = r * 0.13 * (1 + 0.3 * Math.sin(t * 2.4 + j * 2.2));
          const orb = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
          orb.addColorStop(0, "rgba(255,90,90,0.95)");
          orb.addColorStop(0.5, "rgba(220,20,20,0.7)");
          orb.addColorStop(1, "rgba(139,0,0,0)");
          ctx.shadowBlur = 22;
          ctx.fillStyle = orb;
          ctx.beginPath();
          ctx.arc(nx, ny, nr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── 150 embers & ash, dragged into the halo within a 200px gravity well ──
      const ZONE = 200;
      ctx.save();
      for (const e of embers) {
        let ax = Math.sin(t * 0.9 + e.phase) * 9 + Math.sin(t * 2.3 + e.phase * 1.7) * 4 - e.vx * 0.7;
        let ay = -2;
        let shrink = 1;
        if (target) {
          const { x: cx, y: cy } = target;
          const px = e.x * W;
          const py = e.y * H;
          const dx = px - cx;
          const dy = py - cy;
          const d = Math.hypot(dx, dy);
          if (d < ZONE && d > 1) {
            const s = 1 - d / ZONE;
            // violent gravitational vector toward the ring, with a swirl
            const toRing = d > haloR ? -1 : 1;
            ax += (dx / d) * toRing * 620 * s - (dy / d) * 260 * s;
            ay += (dy / d) * toRing * 620 * s + (dx / d) * 260 * s;
            // they shrink as the halo claims them…
            shrink = 0.35 + 0.65 * (d / ZONE);
            // …and vanish on contact
            if (Math.abs(d - haloR) < 12) {
              respawn(e);
              continue;
            }
          }
        }
        e.vx += ax * dt;
        e.vy += ay * dt;
        e.vx = Math.max(-190, Math.min(190, e.vx));
        e.vy = Math.max(-200, Math.min(80, e.vy));
        e.x += (e.vx * dt) / W;
        e.y += (e.vy * dt) / H;
        if (e.y < -0.05 || e.x < -0.06 || e.x > 1.06) {
          respawn(e);
          continue;
        }
        const flicker = 0.45 + 0.45 * Math.sin(t * 2.4 + e.phase);
        ctx.globalAlpha = e.hot ? Math.max(0.15, flicker) : 0.16;
        ctx.shadowColor = e.hot ? "rgba(255,60,30,0.9)" : "rgba(60,10,10,0.3)";
        ctx.shadowBlur = e.hot ? 5 : 0;
        ctx.fillStyle = e.hot ? "#ff5a3c" : "#4a100c";
        ctx.beginPath();
        ctx.arc(e.x * W, e.y * H, e.size * shrink, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ── the Viscous Red Sea: heavy, churning, randomly phased ──
      const STEP = 14;
      SEA_BANDS.forEach((b, bi) => {
        const { p1, p2 } = seaPhase[bi];
        const baseY = H * b.yAt;
        const waveY = (x: number) =>
          baseY +
          Math.sin((x / W) * Math.PI * b.k + t * b.speed * Math.PI + p1) * b.amp +
          Math.sin((x / W) * Math.PI * b.k2 + t * b.speed2 * Math.PI + p2) * b.amp2;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W + STEP; x += STEP) ctx.lineTo(x, waveY(x));
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = b.fill;
        ctx.fill();
        // glowing blood crest over the abyssal trough
        ctx.beginPath();
        for (let x = 0; x <= W + STEP; x += STEP) {
          if (x === 0) ctx.moveTo(x, waveY(x));
          else ctx.lineTo(x, waveY(x));
        }
        ctx.strokeStyle = b.crest;
        ctx.lineWidth = 1.7;
        ctx.shadowColor = "rgba(255,30,30,0.85)";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

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

// ── Profile-level: the realm, anchored INSIDE the card ──────────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function CrimsonCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCrimsonCanvas(canvasRef);

  return (
    <>
      {/* the realm — sized to and clipped by the card, so it scrolls locked to
          the profile like a Discord effect. Screen-blended so the crimson halo
          and embers glow over the card content beneath. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* abyssal blood wash over the card */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 20%, rgba(60,0,0,0.55), rgba(20,0,0,0.28) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.88] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(80% 60% at 50% 100%, rgba(220,38,38,0.14), transparent 60%)" }}
        animate={{ opacity: [0.45, 0.85, 0.45] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot: the realm tears open when the profile is beheld */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(75% 65% at 50% 35%, rgba(255,60,60,0.85), rgba(139,0,0,0.35) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0, 0.4, 0] }}
        transition={{ duration: 1.5, times: [0, 0.15, 0.4, 0.55, 1], ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the mark of the chosen ─────────────────────────────────────

export function CrimsonAvatarMark() {
  // Register so the jagged halo + ember physics center on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    CRIMSON_ANCHORS.add(el);
    return () => {
      CRIMSON_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* breathing blood-glow hugging the border */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 14px 4px rgba(20,0,0,0.9), 0 0 28px 9px rgba(220,38,38,0.45)",
            "0 0 18px 6px rgba(20,0,0,0.95), 0 0 46px 15px rgba(255,0,0,0.65)",
            "0 0 14px 4px rgba(20,0,0,0.9), 0 0 28px 9px rgba(220,38,38,0.45)",
          ],
        }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
