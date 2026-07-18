"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "With This Treasure…" — the complete Mahoraga summoning ritual (JJK).
 * SSS grade. One exists. Abyssal pitch-black versus blinding ethereal white.
 * No humanoid figures — the avatar is the vessel at the heart of the ritual.
 *
 * - MahoragaRitualCard (profile-level, portaled to <body>): a full-viewport
 *   canvas with `mix-blend-mode: NORMAL` — unlike every other realm, this one
 *   must be able to DARKEN the page, because the Ten Shadows are pitch black:
 *   · Boiling Shadows — soft black ink blobs churn across the whole screen,
 *     pulsing and drifting like a fluid at a rolling boil.
 *   · Suspension Tendrils — jagged, ultra-thin black béziers shoot in from the
 *     screen edges and ATTACH to the avatar's rim (live rect), writhe against
 *     the light, then snap, detach and re-launch from somewhere else, forever.
 *   · The Divine Core — a blinding white/pale-cyan radial burst behind the
 *     avatar, burning a hole through the shadows.
 *   · The Eight-Handled Wheel — monochrome and ancient: every ring, spoke,
 *     node and blade is drawn in three layered strokes (dark grey base →
 *     bone-white → pure white core) for a heavy, carved-metal look.
 *   · The Adaptation Click — the wheel hangs impossibly still (microscopic
 *     float only). Every 5–7s: a 0.1s violent jitter wind-up, then a rigid
 *     45° snap on a damped-spring curve (fast strike, metallic rebound
 *     settle), white sparks bursting radially — and when the click lands, the
 *     whole canvas is camera-shaken for 0.2s via a CSS transform.
 *   · Debris — heavy black ash rises; blinding spark streaks on every click.
 *   · The Chant — the summoning line plays aloud once when the profile opens
 *     (public/sounds/ritual-summon.mp3). If the browser blocks autoplay, it
 *     fires on the viewer's first interaction instead; silenced on unmount.
 *     While the chant rings the wheel holds impossibly still — and the FIRST
 *     Adaptation Click is cued to land exactly on the chant's final beat.
 *
 * - MahoragaRitualMark (avatar-level): silver-white aura + monochrome ring +
 *   the wheel anchor registration.
 *
 * Pure code, dt-based physics, DPR capped, cleaned up on unmount.
 */

const RITUAL_ANCHORS = new Set<HTMLElement>();

// The beat shared between the chant audio and the canvas engine: while the
// chant plays the wheel refuses its own timer (holdForChant) and instead does a
// few small "charge" snaps as the audio cues them (chargeClick), until the line
// lands and the wheel answers with the full 45° summon (fireClick). Reset on
// unmount so a profile closed mid-chant never leaves the next ritual frozen.
const RITUAL_CUE = { holdForChant: false, fireClick: false, chargeClick: false };

// ── engine ───────────────────────────────────────────────────────────────────

type Vec = { x: number; y: number; r: number };
type Tendril = {
  side: number; // 0 left, 1 right, 2 top, 3 bottom
  pos: number;
  rim: number; // attach angle on the avatar rim
  phase: number;
  freq: number;
  amp: number;
  state: "strike" | "hold" | "snap";
  t: number; // state progress
  holdFor: number;
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number };
type Ash = { x: number; y: number; vy: number; sway: number; phase: number; scale: number; alpha: number; sprite: number };

const cubicAt = (t: number, p0: number, p1: number, p2: number, p3: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

function makeBlackBlob(size: number, alpha: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const half = size / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(3,3,8,${alpha})`);
  grad.addColorStop(0.6, `rgba(5,5,12,${alpha * 0.55})`);
  grad.addColorStop(1, "rgba(5,5,12,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function newTendril(): Tendril {
  return {
    side: Math.floor(Math.random() * 4),
    pos: 0.1 + Math.random() * 0.8,
    rim: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    freq: 2.2 + Math.random() * 2.4,
    amp: 35 + Math.random() * 55,
    state: "strike",
    t: 0,
    holdFor: 0.8 + Math.random() * 2.2,
  };
}

function useRitualCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
      // profile (Discord-style) instead of floating as a viewport overlay.
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

    // ── boiling shadow ink + rising ash ──
    const blobs = [makeBlackBlob(280, 0.6), makeBlackBlob(190, 0.5)];
    const ink: Ash[] = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vy: 5 + Math.random() * 9,
      sway: 8 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      scale: 0.6 + Math.random() * 1.1,
      alpha: 0.16 + Math.random() * 0.2, // sheer — ink must not blot out the page
      sprite: i % 2,
    }));
    const ash: Ash[] = Array.from({ length: 14 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vy: 16 + Math.random() * 20,
      sway: 10 + Math.random() * 12,
      phase: Math.random() * Math.PI * 2,
      scale: 0.12 + Math.random() * 0.16,
      alpha: 0.4 + Math.random() * 0.25,
      sprite: i % 2,
    }));

    // ── suspension tendrils ──
    const tendrils: Tendril[] = Array.from({ length: 10 }, () => {
      const td = newTendril();
      td.t = Math.random(); // desync
      td.state = Math.random() < 0.6 ? "hold" : "strike";
      return td;
    });

    // ── the Adaptation Click state machine ──
    // idle (5–7s, impossibly still) → jitter (0.1s wind-up) → snap (damped
    // spring, 0.55s) → camera shake (0.2s) → idle … A "charge" snap is the same
    // machine with a smaller angle and lighter sparks/shake, fired mid-chant.
    let rot = Math.random() * Math.PI * 2;
    let mode: "idle" | "jitter" | "snap" = "idle";
    let modeStart = performance.now();
    let nextClick = performance.now() + 3000 + Math.random() * 2000;
    let snapFrom = 0;
    let snapMag = Math.PI / 4; // this snap's rotation — 45° summon or ~20° charge
    let charging = false; // is the current snap a small charge (vs the full summon)?
    let shakeT = 0; // seconds of camera shake remaining
    let coreFlash = 0;
    const SNAP_DUR = 0.55;
    const sparks: Spark[] = [];
    const spawnSparks = (cx: number, cy: number, r: number, strong = true) => {
      const count = strong ? 26 : 9;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = (strong ? 500 : 240) + Math.random() * (strong ? 450 : 210);
        const max = 0.4 + Math.random() * 0.3;
        sparks.push({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r,
          vx: Math.cos(ang) * sp + (Math.random() - 0.5) * 120,
          vy: Math.sin(ang) * sp + (Math.random() - 0.5) * 120,
          life: max,
          max,
        });
      }
    };

    // three layered strokes = heavy, ancient, carved metal
    const strokeLayered = (path: () => void, w: number) => {
      ctx.strokeStyle = "#3a3a42";
      ctx.lineWidth = w;
      path();
      ctx.stroke();
      ctx.strokeStyle = "#e8e4d8";
      ctx.lineWidth = w * 0.55;
      path();
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = w * 0.22;
      path();
      ctx.stroke();
    };

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // ── plunge the world toward darkness (normal blend CAN darken) ──
      // Translucent enough that the profile stays readable beneath the ritual.
      const vign = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.75);
      vign.addColorStop(0, "rgba(2,2,6,0.1)");
      vign.addColorStop(1, "rgba(1,1,4,0.42)");
      ctx.fillStyle = vign;
      ctx.fillRect(0, 0, W, H);

      // boiling ink
      for (const k of ink) {
        k.y -= (k.vy * dt) / H;
        k.x += (Math.sin(t * 0.4 + k.phase) * k.sway * dt) / W;
        if (k.y < -0.15) {
          k.y = 1.15;
          k.x = Math.random();
        }
        const sp = blobs[k.sprite];
        const boil = 1 + 0.12 * Math.sin(t * 1.6 + k.phase * 2);
        const w = sp.width * k.scale * boil;
        ctx.globalAlpha = k.alpha;
        ctx.drawImage(sp, k.x * W - w / 2, k.y * H - w / 2, w, w);
      }
      // rising black ash (smaller, sharper)
      for (const a of ash) {
        a.y -= (a.vy * dt) / H;
        a.x += (Math.sin(t * 0.8 + a.phase) * a.sway * dt) / W;
        if (a.y < -0.06) {
          a.y = 1.06;
          a.x = Math.random();
        }
        const sp = blobs[a.sprite];
        const w = sp.width * a.scale;
        ctx.globalAlpha = a.alpha;
        ctx.drawImage(sp, a.x * W - w / 2, a.y * H - w / 2, w, w);
      }
      ctx.globalAlpha = 1;

      // ── the vessel, in canvas-LOCAL coordinates ──
      // Subtracting the canvas's own rect converts the avatar's viewport
      // position into coordinates inside the card. Because both the canvas and
      // the avatar live in the same scrolling card, these stay constant while
      // scrolling — so the wheel and core stay pixel-locked to the pfp.
      const cRect = canvas.getBoundingClientRect();
      let target: Vec | null = null;
      let best = 0;
      RITUAL_ANCHORS.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > best) {
          best = rect.width;
          target = { x: rect.left - cRect.left + rect.width / 2, y: rect.top - cRect.top + rect.height / 2, r: rect.width / 2 };
        }
      });
      const vessel = target as Vec | null;

      if (vessel) {
        const { x: cx, y: cy, r } = vessel;

        // ── the Divine Core: holy light burning through the shadows ──
        // A rim halo — brightest at the avatar's edge, nearly clear over the
        // face, so the vessel itself stays visible inside the light.
        const coreR = r * 2.7 * (1 + 0.05 * Math.sin(t * 0.9)) * (1 + coreFlash * 0.35);
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        core.addColorStop(0, `rgba(255,255,255,${0.14 + coreFlash * 0.35})`);
        core.addColorStop(0.34, `rgba(255,255,255,${0.55 + coreFlash * 0.3})`);
        core.addColorStop(0.55, `rgba(220,244,255,${0.22 + coreFlash * 0.25})`);
        core.addColorStop(1, "rgba(180,220,240,0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();

        // ── suspension tendrils: strike → hold (writhe) → snap → respawn ──
        ctx.lineCap = "round";
        for (const td of tendrils) {
          const x0 = td.side === 0 ? -14 : td.side === 1 ? W + 14 : W * td.pos;
          const y0 = td.side === 2 ? -14 : td.side === 3 ? H + 14 : H * td.pos;
          const ax = cx + Math.cos(td.rim) * r;
          const ay = cy + Math.sin(td.rim) * r;
          const dx = ax - x0;
          const dy = ay - y0;
          const len = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / len;
          const ny = dx / len;
          const s1 = Math.sin(t * td.freq + td.phase) * td.amp;
          const s2 = Math.sin(t * td.freq * 1.7 + td.phase + 2.4) * td.amp * 0.7;
          const jag = Math.sin(t * 13 + td.phase * 3) * 6; // high-freq struggle
          const c1x = x0 + dx * 0.3 + nx * (s1 + jag);
          const c1y = y0 + dy * 0.3 + ny * (s1 + jag);
          const c2x = x0 + dx * 0.7 + nx * (s2 - jag);
          const c2y = y0 + dy * 0.7 + ny * (s2 - jag);

          // state lifecycle
          if (td.state === "strike") {
            td.t += dt / 0.22; // shoots in fast
            if (td.t >= 1) {
              td.state = "hold";
              td.t = 0;
            }
          } else if (td.state === "hold") {
            td.t += dt / td.holdFor;
            if (td.t >= 1) {
              td.state = "snap";
              td.t = 0;
            }
          } else {
            td.t += dt / 0.3; // snaps away
            if (td.t >= 1) {
              Object.assign(td, newTendril());
            }
          }
          const reach = td.state === "strike" ? td.t : td.state === "hold" ? 1 : 1 - td.t;
          if (reach <= 0.02) continue;

          const STEPS = 24;
          const nPts = Math.max(2, Math.round(STEPS * reach));
          ctx.strokeStyle = td.state === "snap" ? `rgba(5,5,10,${(0.95 * (1 - td.t)).toFixed(3)})` : "rgba(4,4,9,0.95)";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          for (let i = 0; i <= nPts; i++) {
            const p = i / STEPS;
            const px = cubicAt(p, x0, c1x, c2x, ax);
            const py = cubicAt(p, y0, c1y, c2y, ay);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          // faint grey edge so the black reads against dark UI
          ctx.strokeStyle = "rgba(70,70,85,0.35)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // ── the Adaptation Click state machine ──
        let jx = 0;
        let jy = 0;
        if (mode === "idle") {
          if (RITUAL_CUE.fireClick) {
            // the chant just landed — the wheel answers with the FULL summon
            RITUAL_CUE.fireClick = false;
            RITUAL_CUE.chargeClick = false; // the summon supersedes any charge
            charging = false;
            mode = "jitter";
            modeStart = now;
          } else if (RITUAL_CUE.chargeClick) {
            // mid-chant — a small charge snap, the wheel straining to turn
            RITUAL_CUE.chargeClick = false;
            charging = true;
            mode = "jitter";
            modeStart = now;
          } else if (!RITUAL_CUE.holdForChant && now >= nextClick) {
            charging = false;
            mode = "jitter";
            modeStart = now;
          }
        } else if (mode === "jitter") {
          // the wind-up — gentler and quicker for a charge
          const j = charging ? 0.025 : 0.05;
          jx = (Math.random() - 0.5) * r * j;
          jy = (Math.random() - 0.5) * r * j;
          if (now - modeStart >= (charging ? 70 : 100)) {
            mode = "snap";
            modeStart = now;
            snapFrom = rot;
            snapMag = charging ? Math.PI / 9 : Math.PI / 4; // ~20° charge vs 45° summon
            coreFlash = charging ? 0.4 : 1;
            spawnSparks(cx, cy, r * 1.1, !charging);
          }
        } else {
          // rigid damped spring: fast strike, heavy metallic rebound settle
          const p = Math.min(1, (now - modeStart) / (SNAP_DUR * 1000));
          const target = snapFrom + snapMag;
          rot = target - snapMag * Math.exp(-6 * p) * Math.cos(14 * p);
          if (p >= 1) {
            rot = target;
            mode = "idle";
            // charges don't reset the post-chant cadence (holdForChant gates it
            // anyway); only the full summon schedules the next ordinary click
            if (!charging) nextClick = now + 5000 + Math.random() * 2000;
            shakeT = charging ? 0.07 : 0.2; // charges give a small kick, the summon a heavy one
            charging = false;
          }
        }

        // ── the Eight-Handled Wheel: monochrome, ancient, impossibly heavy ──
        const float = Math.sin(t * 0.5) * r * 0.015; // microscopic float
        const wx = cx + jx;
        const wy = cy + float + jy;
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,0.75)";
        ctx.shadowBlur = 14 + coreFlash * 20;

        // outer ring (hollow middle between the two rings)
        strokeLayered(() => {
          ctx.beginPath();
          ctx.arc(wx, wy, r * 1.5, 0, Math.PI * 2);
        }, r * 0.07);
        // thick inner ring
        strokeLayered(() => {
          ctx.beginPath();
          ctx.arc(wx, wy, r * 1.2, 0, Math.PI * 2);
        }, r * 0.12);

        // exactly 8 handles: thick base → spherical node → elongated blade tip
        for (let k = 0; k < 8; k++) {
          const ang = rot + (k * Math.PI) / 4;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          // thick base spoke
          strokeLayered(() => {
            ctx.beginPath();
            ctx.moveTo(wx + ca * r * 1.5, wy + sa * r * 1.5);
            ctx.lineTo(wx + ca * r * 1.76, wy + sa * r * 1.76);
          }, r * 0.085);
          // spherical node — concentric carved discs
          const sx = wx + ca * r * 1.82;
          const sy = wy + sa * r * 1.82;
          const sr = r * 0.1;
          ctx.fillStyle = "#3a3a42";
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e8e4d8";
          ctx.beginPath();
          ctx.arc(sx, sy, sr * 0.66, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(sx - sr * 0.2, sy - sr * 0.2, sr * 0.26, 0, Math.PI * 2);
          ctx.fill();
          // elongated blade tapering to the point
          const bw = r * 0.055;
          ctx.fillStyle = "#e8e4d8";
          ctx.beginPath();
          ctx.moveTo(sx - sa * bw, sy + ca * bw);
          ctx.lineTo(sx + sa * bw, sy - ca * bw);
          ctx.lineTo(wx + ca * r * 2.32, wy + sa * r * 2.32);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();

        // ── blinding spark streaks ──
        if (sparks.length) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.shadowColor = "rgba(255,255,255,0.95)";
          ctx.shadowBlur = 8;
          for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
            if (s.life <= 0) {
              sparks.splice(i, 1);
              continue;
            }
            ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, s.life / s.max).toFixed(3)})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.vx * 0.024, s.y - s.vy * 0.024);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      coreFlash = Math.max(0, coreFlash - dt * 2.6);

      // ── camera shake: violent 0.2s CSS transform on the whole canvas ──
      if (shakeT > 0) {
        shakeT = Math.max(0, shakeT - dt);
        const amp = 12 * (shakeT / 0.2);
        canvas.style.transform = `translate(${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px)`;
        if (shakeT === 0) canvas.style.transform = "";
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      canvas.style.transform = "";
    };
  }, [canvasRef]);
}

// ── Profile-level: the summoning, anchored INSIDE the card ──────────────────
// The canvas is a child of the profile card (not portaled to <body>), so it
// scrolls locked to the profile exactly like a Discord profile effect instead
// of floating as a viewport overlay that lags behind while scrolling.

export function MahoragaRitualCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useRitualCanvas(canvasRef);

  // 「 With this treasure, I summon— 」 — the chant, once, as the ritual begins.
  // Browsers may refuse autoplay without a user gesture; then the first
  // pointer/key interaction triggers it instead. Always silenced on unmount.
  //
  // Sync with the animation: while the chant plays the wheel holds impossibly
  // still (holdForChant) except for a few small "charge" snaps cued at set
  // points in the audio, then the FULL summon snap is cued ~0.7s before the
  // audio ends — jitter (0.1s) + snap (0.55s) — so the impact, sparks and
  // camera shake land exactly as the line finishes.
  useEffect(() => {
    const audio = new Audio("/sounds/ritual-summon.mp3");
    audio.volume = 0.65;
    let disposed = false;
    let cued = false;

    // fractions of the chant at which the wheel gives a small charge snap
    const chargesAt = [0.3, 0.52, 0.74];
    const chargesFired = [false, false, false];

    const cueClick = () => {
      if (disposed || cued) return;
      cued = true;
      RITUAL_CUE.holdForChant = false;
      RITUAL_CUE.chargeClick = false;
      RITUAL_CUE.fireClick = true;
    };
    const onPlaying = () => {
      if (!disposed && !cued) RITUAL_CUE.holdForChant = true;
    };
    const onTime = () => {
      const dur = audio.duration;
      if (!dur) return;
      if (!cued) {
        const frac = audio.currentTime / dur;
        for (let i = 0; i < chargesAt.length; i++) {
          if (!chargesFired[i] && frac >= chargesAt[i]) {
            chargesFired[i] = true;
            RITUAL_CUE.chargeClick = true;
          }
        }
      }
      if (dur - audio.currentTime <= 0.7) cueClick();
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", cueClick); // backstop — timeupdate is coarse

    const retry = () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      if (!disposed) audio.play().catch(() => {});
    };
    audio.play().catch(() => {
      if (disposed) return;
      window.addEventListener("pointerdown", retry);
      window.addEventListener("keydown", retry);
    });

    return () => {
      disposed = true;
      audio.pause();
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", cueClick);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      RITUAL_CUE.holdForChant = false;
      RITUAL_CUE.fireClick = false;
      RITUAL_CUE.chargeClick = false;
    };
  }, []);

  return (
    <>
      {/* the summoning — sized to and clipped by the card, so it scrolls locked
          to the profile like a Discord effect. mix-blend NORMAL so the Ten
          Shadows can still DARKEN the card beneath. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "normal" }}
      />

      {/* plunge the card into ritual dusk — dark, but the profile reads through */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 30%, rgba(2,2,5,0.55), rgba(2,2,5,0.35) 50%, rgba(2,2,5,0.18) 80%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.85] }}
        transition={{ duration: 1.8, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(60% 50% at 50% 45%, rgba(240,250,255,0.12), transparent 60%)" }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* one-shot: the chant — a blinding white tear when the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{ background: "radial-gradient(70% 60% at 50% 40%, rgba(255,255,255,0.95), rgba(200,235,255,0.4) 45%, transparent 75%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0, 0.35, 0] }}
        transition={{ duration: 1.6, times: [0, 0.12, 0.38, 0.5, 1], ease: "easeOut" }}
      />
    </>
  );
}

// ── Avatar-level: the vessel's mark ──────────────────────────────────────────

export function MahoragaRitualMark() {
  // Register so the wheel, tendrils and divine core center on this avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    RITUAL_ANCHORS.add(el);
    return () => {
      RITUAL_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* divine white-silver aura, fighting the dark */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 14px 5px rgba(2,2,6,0.95), 0 0 30px 10px rgba(255,255,255,0.4)",
            "0 0 18px 7px rgba(2,2,6,0.98), 0 0 52px 17px rgba(240,250,255,0.65)",
            "0 0 14px 5px rgba(2,2,6,0.95), 0 0 30px 10px rgba(255,255,255,0.4)",
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* slow bone-white ring — the wheel's presence at small sizes */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[6%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,255,255,0), rgba(255,255,255,0.9), rgba(160,160,175,0.5), rgba(255,255,255,0), rgba(232,228,216,0.8), rgba(90,90,105,0.4), rgba(255,255,255,0))",
          filter: "blur(1.5px)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
          maskImage: "radial-gradient(circle, transparent 58%, #000 66%)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />

      {/* eight bone-white studs — the handles, in miniature */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[10%] z-20"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
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
                background: "radial-gradient(circle at 35% 35%, #ffffff, #e8e4d8 55%, #3a3a42)",
                boxShadow: "0 0 7px 2px rgba(255,255,255,0.8)",
              }}
            />
          );
        })}
      </motion.span>
    </>
  );
}
