"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";
import { attachVisibilityPause } from "@/components/profile/pauseWhenUnseen";

/**
 * DANDADAN: THE TURBO CLASH — SSS profile effect. Occult vs. sci-fi, cut
 * together with hard whip-pan snaps (no gentle easing between states), on a
 * ~12.5s loop:
 *
 *   I   BIFURCATED REALITY — left of the avatar pulses toxic green/cyan
 *       (abduction beams, glitching saucers, wireframe pyramids, math grids);
 *       right of it bleeds red/magenta (viscous bezier ghost-hands and
 *       manga-ink scribbles tearing in from the edge). A crackling seam
 *       divides the two worlds through the avatar.
 *   II  HYPER-KINETIC DASH — the chaos halts INSTANTLY; neon streaks cross
 *       the card at 100-card-widths-per-2-frames with destination-out trail
 *       fade, then a 0.15s band-slice CRT tear with RGB channel ghosts.
 *   III PSYCHOKINETIC BLAST — a 22-point uneven comic starburst erupts from
 *       the avatar (white fill, magenta+green outline), then a dual-tone
 *       roaring flame aura: green/cyan on the left, red/magenta on the right.
 *   IV  ZERO-G POP ART — gravity inverts: crosshairs, jagged teeth and red
 *       spirit-orbs float UP while the whole canvas tilts a few surreal
 *       degrees… then a hard cut back to phase I.
 *
 * Rendering: TWO canvases (the OuterGod treatment) because this effect's
 * signature ink is DARK and dark ink must never sit above the card's text —
 * the ink canvas (ghost hands, scribbles, blood washes) renders at z-[8]
 * UNDER the z-10 text, and the glow canvas (beams, streaks, tear, blast,
 * aura, debris) rides at z-[30] with screen blending, which can only
 * brighten. NO shadowBlur/filter in any loop (glow = gradients + additive).
 * All clocks are accumulated-t, so the visibility pause shifts nothing.
 */

// The avatar registers here; realities split along THIS card's avatar.
const DAN_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/* the loop, in seconds — hard cuts, not fades */
const T_DASH = 4.2;
const T_TEAR = 4.9;
const TEAR_DUR = 0.15;
const T_BLAST = 5.6;
const T_ZEROG = 7.4;
const CYCLE = 12.5;

type BeamT = { x: number; w: number; y: number; v: number; hue: string; alpha: number; len: number };
type SaucerT = { x: number; y: number; s: number; bornAt: number; life: number; vx: number; kind: number; spin: number };
type HandT = { i: number; bornAt: number; life: number; rootY: number; reach: number; size: number; wob: number; fingers: { ang: number; len: number; w: number }[] };
type StreakT = { fromLeft: boolean; y: number; launch: number; v: number; x: number; hue: string; done: boolean };
type DebrisT = { kind: number; x: number; y: number; vy: number; sway: number; s: number; rot: number; vr: number; seed: number };

function useDandadanCanvases(
  inkRef: RefObject<HTMLCanvasElement | null>,
  glowRef: RefObject<HTMLCanvasElement | null>
) {
  useEffect(() => {
    const ink = inkRef.current;
    const glow = glowRef.current;
    if (!ink || !glow) return;
    const ictx = ink.getContext("2d");
    const gctx = glow.getContext("2d");
    if (!ictx || !gctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const snap = document.createElement("canvas");
    const snapCtx = snap.getContext("2d")!;
    const tint = document.createElement("canvas");
    const tintCtx = tint.getContext("2d")!;
    const resize = () => {
      // Size to the profile CARD, not the viewport — the clash scrolls with
      // the card like a Discord effect.
      W = Math.max(1, glow.clientWidth || glow.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, glow.clientHeight || glow.parentElement?.clientHeight || 420);
      for (const c of [ink, glow]) {
        c.width = Math.max(1, Math.round(W * DPR));
        c.height = Math.max(1, Math.round(H * DPR));
      }
      snap.width = tint.width = glow.width;
      snap.height = tint.height = glow.height;
      ictx.setTransform(DPR, 0, 0, DPR, 0, 0);
      gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(glow);

    /* ── state ── */
    let raf = 0;
    let paused = false;
    let last = performance.now();
    let t = 0;                       // accumulated — pause-safe by construction
    let cycleN = -1;
    let dashArmed = false;
    let tearArmed = false;
    let blastArmed = false;
    let shakeMag = 0;
    let wasShaking = false;
    let streaks: StreakT[] = [];
    let tearBands: { y: number; h: number; dx: number }[] = [];
    let burstSpikes: { ang: number; rOut: number; rIn: number }[] = [];

    const beams: BeamT[] = [];
    const resetBeam = (b: BeamT, scatter: boolean) => {
      b.x = rand(0.05, 0.42);        // fraction of the LEFT span, resolved per frame
      b.w = rand(14, 40);
      b.y = scatter ? rand(-1, 0) : -rand(0.1, 0.4);   // fractions of H
      b.v = rand(1.1, 2.2);          // H-fractions per second
      b.hue = Math.random() < 0.5 ? "57,255,20" : "0,255,255";
      b.alpha = rand(0.12, 0.28);
      b.len = rand(0.4, 0.8);
    };
    for (let i = 0; i < 4; i++) { const b = {} as BeamT; resetBeam(b, true); beams.push(b); }

    const saucers: SaucerT[] = [];
    const respawnSaucer = (s: SaucerT, tt: number) => {
      s.x = rand(0.08, 0.9);         // fraction of left span
      s.y = rand(0.08, 0.7);
      s.s = rand(9, 20);
      s.bornAt = tt + rand(0, 2.4);
      s.life = rand(1.4, 3);
      s.vx = rand(-18, 18);
      s.kind = (Math.random() * 3) | 0;
      s.spin = rand(0.6, 2.2) * (Math.random() < 0.5 ? -1 : 1);
    };
    for (let i = 0; i < 4; i++) { const s = {} as SaucerT; respawnSaucer(s, 0); saucers.push(s); }

    const hands: HandT[] = [];
    const rollHand = (h: HandT, tt: number) => {
      h.bornAt = tt + rand(0, 1.6);
      h.life = rand(1.8, 3.2);
      h.rootY = rand(0.1, 0.9);
      h.reach = rand(0.3, 0.62);     // fraction of the RIGHT span it invades
      h.size = rand(16, 34);
      h.wob = rand(2, 5);
      h.fingers = [];
      for (let f = 0; f < 5; f++) {
        h.fingers.push({ ang: rand(-1.1, 1.1), len: h.size * rand(0.7, 1.4), w: rand(2.5, 5.5) });
      }
    };
    for (let i = 0; i < 3; i++) { const h = { i } as HandT; rollHand(h, 0); hands.push(h); }

    const debris: DebrisT[] = [];
    const respawnDebris = (d: DebrisT, scatter: boolean) => {
      d.kind = (Math.random() * 3) | 0;
      d.x = rand(0.05, 0.95);
      d.y = scatter ? rand(0.1, 1.1) : 1.1 + rand(0, 0.3);
      d.vy = -rand(0.03, 0.09);      // H-fractions per second, upward
      d.sway = rand(0.4, 1.4);
      d.s = rand(5, 13);
      d.rot = rand(0, TAU);
      d.vr = rand(-0.7, 0.7);
      d.seed = rand(0, TAU);
    };
    for (let i = 0; i < 16; i++) { const d = {} as DebrisT; respawnDebris(d, true); debris.push(d); }

    const newCycle = () => {
      /* Timer-based actors carry cycle-relative bornAt clocks but are only
         updated inside Phase I's ct < T_DASH window — a death that schedules
         its rebirth past that window is an ABSORBING state, and within a few
         cycles every saucer and hand is permanently dark (review-caught).
         Re-roll them at the wrap, like Bankai rebuilds its blades. */
      for (const s of saucers) respawnSaucer(s, 0);
      for (const h of hands) rollHand(h, 0);
      dashArmed = false;
      tearArmed = false;
      blastArmed = false;
      streaks = [];
      tearBands = [];
      burstSpikes = [];
      const n = 22;
      for (let i = 0; i < n; i++) {
        burstSpikes.push({ ang: (i / n) * TAU + rand(-0.09, 0.09), rOut: rand(0.55, 1.5), rIn: rand(0.16, 0.3) });
      }
    };

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      const cyc = Math.floor(t / CYCLE);
      if (cyc !== cycleN) { cycleN = cyc; newCycle(); }
      const ct = t - cyc * CYCLE;

      // avatar epicenter — ONLY anchors inside THIS card
      const host = glow.parentElement;
      // Measured from the parent, which is never shaken: the canvas's own
      // rect still carries LAST frame's shake translate, and anchoring to it
      // doubles the jitter on the blast and aura (differenced noise).
      const cRect = (host || glow).getBoundingClientRect();
      let ax = W * 0.5;
      let ay = H * 0.3;
      let aR = 46;
      let best = 0;
      DAN_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });
      const leftW = Math.max(40, ax);              // the sci-fi span
      const rightW = Math.max(40, W - ax);         // the occult span

      // shake belongs to the CANVASES, never the parent (Unblinking rule)
      shakeMag = Math.max(0, shakeMag - dt * 30);
      if (shakeMag > 0.3) {
        const sx = rand(-shakeMag, shakeMag).toFixed(1);
        const sy = rand(-shakeMag, shakeMag).toFixed(1);
        ink.style.transform = glow.style.transform = `translate(${sx}px, ${sy}px)`;
        wasShaking = true;
      } else if (wasShaking) {
        ink.style.transform = glow.style.transform = "";
        wasShaking = false;
      }

      /* clears: ink always wipes; glow keeps burning trails during the dash */
      ictx.clearRect(0, 0, W, H);
      if (ct >= T_DASH && ct < T_BLAST) {
        gctx.globalCompositeOperation = "destination-out";
        gctx.fillStyle = "rgba(0,0,0,0.3)";
        gctx.fillRect(0, 0, W, H);
        gctx.globalCompositeOperation = "source-over";
      } else {
        gctx.clearRect(0, 0, W, H);
      }

      /* PHASE IV's off-balance world — glow canvas only, a few degrees */
      const zeroG = ct >= T_ZEROG;
      if (zeroG) {
        const tilt = Math.sin((ct - T_ZEROG) * 0.5) * 0.045;
        gctx.translate(W / 2, H / 2);
        gctx.rotate(tilt);
        gctx.translate(-W / 2, -H / 2);
      }

      /* ── PHASE I: bifurcated reality (halted instantly at the dash) ── */
      if (ct < T_DASH) {
        /* sci-fi left — pure light on the glow canvas */
        gctx.save();
        gctx.beginPath();
        gctx.rect(0, 0, ax, H);
        gctx.clip();
        const pulse = 0.5 + 0.5 * Math.sin(ct * 7);
        gctx.fillStyle = `rgba(57,255,20,${0.05 + 0.035 * pulse})`;
        gctx.fillRect(0, 0, ax, H);
        gctx.globalCompositeOperation = "screen";
        for (const b of beams) {
          b.y += b.v * dt;
          if ((b.y - b.len) * H > H) resetBeam(b, false);
          const bx = b.x * leftW;
          const yPix = b.y * H;
          const lenPix = b.len * H;
          const flare = b.w * 1.9;
          const g = gctx.createLinearGradient(0, yPix - lenPix, 0, yPix);
          g.addColorStop(0, `rgba(${b.hue},0)`);
          g.addColorStop(0.6, `rgba(${b.hue},${b.alpha})`);
          g.addColorStop(1, `rgba(${b.hue},${b.alpha * 1.6})`);
          gctx.fillStyle = g;
          gctx.beginPath();
          gctx.moveTo(bx - b.w / 2, yPix - lenPix);
          gctx.lineTo(bx + b.w / 2, yPix - lenPix);
          gctx.lineTo(bx + flare / 2, yPix);
          gctx.lineTo(bx - flare / 2, yPix);
          gctx.closePath();
          gctx.fill();
        }
        gctx.globalCompositeOperation = "lighter";
        for (const s of saucers) {
          s.x += (s.vx * dt) / Math.max(leftW, 1);
          if (ct > s.bornAt + s.life) respawnSaucer(s, ct);
          const age = ct - s.bornAt;
          if (age < 0) continue;
          const flicker = age < 0.25 ? (Math.sin(age * 210) > -0.2 ? 1 : 0) : 1;
          if (!flicker) continue;
          const jx = age < 0.25 ? rand(-5, 5) : 0;
          const a = Math.min(1, age * 4) * Math.min(1, (s.bornAt + s.life - ct) * 2);
          gctx.save();
          gctx.translate(s.x * leftW + jx, s.y * H);
          gctx.globalAlpha = a * 0.9;
          if (s.kind === 0) {
            gctx.strokeStyle = "#00FFFF";
            gctx.lineWidth = 1.6;
            gctx.beginPath();
            gctx.ellipse(0, 0, s.s, s.s * 0.34, 0, 0, TAU);
            gctx.stroke();
            gctx.beginPath();
            gctx.arc(0, -s.s * 0.18, s.s * 0.45, Math.PI, 0);
            gctx.stroke();
            gctx.fillStyle = "#39ff14";
            for (let i = -1; i <= 1; i++) {
              if (Math.sin(ct * 9 + i * 2) > 0) gctx.fillRect(i * s.s * 0.45 - 1.3, s.s * 0.1, 2.6, 2.6);
            }
          } else if (s.kind === 1) {
            const angR = ct * s.spin;
            const c = Math.cos(angR), sn = Math.sin(angR);
            const proj = (x: number, y: number, z: number): [number, number] => {
              const rx = x * c - z * sn;
              const rz = x * sn + z * c;
              const d = 3.2 / (3.2 + rz);
              return [rx * s.s * d, y * s.s * 0.8 * d];
            };
            const P: [number, number][] = [proj(-1, 1, -1), proj(1, 1, -1), proj(1, 1, 1), proj(-1, 1, 1)];
            const A = proj(0, -1.2, 0);
            gctx.strokeStyle = "#39ff14";
            gctx.lineWidth = 1.3;
            gctx.beginPath();
            for (let i = 0; i < 4; i++) {
              gctx.moveTo(P[i][0], P[i][1]);
              gctx.lineTo(P[(i + 1) % 4][0], P[(i + 1) % 4][1]);
              gctx.moveTo(P[i][0], P[i][1]);
              gctx.lineTo(A[0], A[1]);
            }
            gctx.stroke();
          } else {
            gctx.strokeStyle = "rgba(0,255,255,0.7)";
            gctx.lineWidth = 1;
            gctx.beginPath();
            for (let i = 0; i <= 4; i++) {
              const f = i / 4;
              gctx.moveTo(-s.s + f * s.s * 2, -s.s * 0.5);
              gctx.lineTo(-s.s * 1.6 + f * s.s * 3.2, s.s * 0.5);
              gctx.moveTo(-s.s * (1 + 0.6 * f), -s.s * 0.5 + f * s.s);
              gctx.lineTo(s.s * (1 + 0.6 * f), -s.s * 0.5 + f * s.s);
            }
            gctx.stroke();
          }
          gctx.restore();
          gctx.globalAlpha = 1;
        }
        gctx.restore();

        /* occult right — viscous darks on the INK canvas, under the text */
        ictx.save();
        ictx.beginPath();
        ictx.rect(ax, 0, rightW, H);
        ictx.clip();
        const bleed = 0.5 + 0.5 * Math.sin(ct * 5 + 2);
        ictx.fillStyle = `rgba(120,0,30,${0.1 + 0.06 * bleed})`;
        ictx.fillRect(ax, 0, rightW, H);
        ictx.lineCap = "round";
        for (const h of hands) {
          if (ct > h.bornAt + h.life) rollHand(h, ct);
          const age = ct - h.bornAt;
          if (age < 0) continue;
          const out = Math.min(1, age * 3);
          const die = Math.min(1, (h.bornAt + h.life - ct) * 3);
          const a = out * die;
          if (a <= 0) continue;
          const wx = W - h.reach * rightW * out;
          const wy = h.rootY * H + Math.sin(ct * h.wob + h.i * 2.1) * 14;
          ictx.strokeStyle = `rgba(20,2,10,${0.85 * a})`;
          ictx.lineWidth = h.size * 0.5;
          ictx.beginPath();
          ictx.moveTo(W + 20, h.rootY * H);
          ictx.bezierCurveTo(
            W - h.reach * rightW * 0.3, h.rootY * H + Math.sin(ct * 7 + h.i) * 22,
            wx + h.size * 2, wy - 18,
            wx, wy
          );
          ictx.stroke();
          ictx.strokeStyle = `rgba(255,0,0,${0.5 * a})`;
          ictx.lineWidth = h.size * 0.5 + 4;
          ictx.globalCompositeOperation = "destination-over";
          ictx.stroke();
          ictx.globalCompositeOperation = "source-over";
          for (const f of h.fingers) {
            const fx = wx + Math.cos(f.ang + Math.PI) * h.size * 0.2;
            const fy = wy + Math.sin(f.ang) * h.size * 0.32;
            const tx = wx - Math.cos(f.ang * 0.5) * f.len * (0.8 + 0.2 * Math.sin(ct * 11 + f.ang * 5));
            const ty = wy + Math.sin(f.ang) * f.len;
            ictx.strokeStyle = `rgba(24,3,12,${0.9 * a})`;
            ictx.lineWidth = f.w;
            ictx.beginPath();
            ictx.moveTo(fx, fy);
            ictx.quadraticCurveTo((fx + tx) / 2 + Math.sin(ct * 13 + f.ang * 7) * 6, (fy + ty) / 2, tx, ty);
            ictx.stroke();
            ictx.strokeStyle = `rgba(255,0,255,${0.4 * a})`;
            ictx.lineWidth = 1.3;
            ictx.stroke();
          }
        }
        /* manga scribbles */
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const seed = sIdx * 37.7;
          const phase = (ct + seed) % 3;
          if (phase > 1.4) continue;
          const a = Math.min(1, phase * 6) * Math.min(1, (1.4 - phase) * 3);
          let x = W + 8;
          let y = (seed * 971) % H;
          ictx.strokeStyle = sIdx % 2 ? `rgba(255,0,0,${0.5 * a})` : `rgba(30,4,16,${0.75 * a})`;
          ictx.lineWidth = sIdx % 2 ? 1.6 : 3.4;
          ictx.beginPath();
          ictx.moveTo(x, y);
          for (let k = 0; k < 12; k++) {
            x -= rand(5, 26) * (0.5 + phase);
            y += Math.sin(k * 2.7 + seed + ct * 21) * rand(6, 24);
            ictx.lineTo(x, y);
          }
          ictx.stroke();
        }
        ictx.restore();

        /* the frontier seam, crackling through the avatar — glow canvas */
        gctx.globalCompositeOperation = "lighter";
        gctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.16 * Math.sin(ct * 23)})`;
        gctx.lineWidth = 1.6;
        gctx.beginPath();
        for (let y = 0; y <= H; y += 12) {
          const x = ax + Math.sin(y * 0.05 + ct * 17) * 5;
          y === 0 ? gctx.moveTo(x, y) : gctx.lineTo(x, y);
        }
        gctx.stroke();
        gctx.globalCompositeOperation = "source-over";
      }

      /* ── PHASE II: the dash ── */
      if (!dashArmed && ct >= T_DASH) {
        dashArmed = true;
        streaks = Array.from({ length: 14 }, (_, i) => ({
          fromLeft: i % 2 === 0,
          y: rand(0.05, 0.95),           // fraction — survives a mid-dash resize
          launch: ct + i * 0.045,
          v: 0,                          // resolved per frame from live W
          x: i % 2 === 0 ? -W * 0.2 : W * 1.2,
          hue: i % 2 ? "255,0,255" : "0,255,255",
          done: false,
        }));
      }
      if (ct >= T_DASH && ct < T_BLAST) {
        gctx.globalCompositeOperation = "lighter";
        for (const s of streaks) {
          if (ct < s.launch || s.done) continue;
          s.x += (s.fromLeft ? 1 : -1) * (W / 2) * 60 * dt;
          if (s.fromLeft ? s.x > W * 1.3 : s.x < -W * 0.3) { s.done = true; continue; }
          const len = W * 0.34;
          const dir = s.fromLeft ? -1 : 1;
          const g = gctx.createLinearGradient(s.x, 0, s.x + dir * len, 0);
          g.addColorStop(0, "rgba(255,255,255,0.95)");
          g.addColorStop(0.12, `rgba(${s.hue},0.9)`);
          g.addColorStop(1, `rgba(${s.hue},0)`);
          gctx.fillStyle = g;
          gctx.fillRect(s.fromLeft ? s.x + dir * len : s.x, s.y * H - 2, len, 4);
        }
        gctx.globalCompositeOperation = "source-over";
      }

      /* the 0.15s reality tear — glow canvas bands + RGB ghosts */
      if (!tearArmed && ct >= T_TEAR) {
        tearArmed = true;
        shakeMag = Math.max(shakeMag, 6);
        tearBands = [];
        const n = 7;
        for (let b = 0; b < n; b++) {
          tearBands.push({ y: (b / n) * H, h: H / n + 1, dx: (b % 2 ? 26 : -26) * rand(0.6, 1.2) });
        }
      }
      if (tearArmed && ct < T_TEAR + TEAR_DUR) {
        snapCtx.setTransform(1, 0, 0, 1, 0, 0);
        snapCtx.clearRect(0, 0, snap.width, snap.height);
        snapCtx.drawImage(glow, 0, 0);
        const base = gctx.getTransform();
        gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        gctx.clearRect(0, 0, W, H);
        for (const b of tearBands) {
          gctx.drawImage(snap, 0, b.y * DPR, snap.width, b.h * DPR, b.dx, b.y, W, b.h);
        }
        for (const [color, ox] of [["#FF0000", 5], ["#00FFFF", -5]] as const) {
          tintCtx.setTransform(1, 0, 0, 1, 0, 0);
          tintCtx.clearRect(0, 0, tint.width, tint.height);
          tintCtx.drawImage(snap, 0, 0);
          tintCtx.globalCompositeOperation = "multiply";
          tintCtx.fillStyle = color;
          tintCtx.fillRect(0, 0, tint.width, tint.height);
          tintCtx.globalCompositeOperation = "destination-in";
          tintCtx.drawImage(snap, 0, 0);
          tintCtx.globalCompositeOperation = "source-over";
          gctx.globalCompositeOperation = "lighter";
          gctx.globalAlpha = 0.5;
          gctx.drawImage(tint, 0, 0, tint.width, tint.height, ox, 0, W, H);
        }
        gctx.globalAlpha = 1;
        gctx.globalCompositeOperation = "source-over";
        gctx.setTransform(base);
      }

      /* ── PHASE III: the psychokinetic blast ── */
      if (!blastArmed && ct >= T_BLAST) {
        blastArmed = true;
        shakeMag = 12;
      }
      if (ct >= T_BLAST && ct < T_BLAST + 0.55) {
        const p = (ct - T_BLAST) / 0.55;
        const grow = easeOutExpo(Math.min(p * 2.2, 1));
        const fade = 1 - clamp01((p - 0.55) / 0.45);
        const R = aR * 1.05 + grow * Math.max(W, H) * 0.2;
        gctx.save();
        gctx.globalAlpha = fade;
        gctx.beginPath();
        for (let i = 0; i < burstSpikes.length; i++) {
          const sp = burstSpikes[i];
          const nxt = burstSpikes[(i + 1) % burstSpikes.length];
          const midAng = (sp.ang + (i + 1 === burstSpikes.length ? nxt.ang + TAU : nxt.ang)) / 2;
          const oxp = ax + Math.cos(sp.ang) * R * sp.rOut;
          const oyp = ay + Math.sin(sp.ang) * R * sp.rOut;
          const ixp = ax + Math.cos(midAng) * R * sp.rIn;
          const iyp = ay + Math.sin(midAng) * R * sp.rIn;
          i === 0 ? gctx.moveTo(oxp, oyp) : gctx.lineTo(oxp, oyp);
          gctx.lineTo(ixp, iyp);
        }
        gctx.closePath();
        gctx.fillStyle = "rgba(255,255,255,0.95)";
        gctx.fill();
        gctx.lineWidth = 5;
        gctx.strokeStyle = "#FF00FF";
        gctx.stroke();
        gctx.lineWidth = 2;
        gctx.strokeStyle = "#39ff14";
        gctx.stroke();
        gctx.restore();
        gctx.globalAlpha = 1;
      }

      /* dual-tone roaring aura, from the blast to the end of the loop */
      if (ct >= T_BLAST + 0.12) {
        gctx.save();
        gctx.globalCompositeOperation = "lighter";
        for (let side = 0; side < 2; side++) {
          const grad = gctx.createRadialGradient(ax, ay, aR * 0.7, ax, ay, aR * 2.5);
          if (side === 0) {
            grad.addColorStop(0, "rgba(57,255,20,0.45)");
            grad.addColorStop(0.55, "rgba(0,255,255,0.25)");
            grad.addColorStop(1, "rgba(0,255,255,0)");
          } else {
            grad.addColorStop(0, "rgba(255,0,0,0.45)");
            grad.addColorStop(0.55, "rgba(255,0,255,0.25)");
            grad.addColorStop(1, "rgba(255,0,255,0)");
          }
          gctx.fillStyle = grad;
          gctx.beginPath();
          gctx.moveTo(ax, ay - aR);
          const steps = 40;
          for (let i = 0; i <= steps; i++) {
            const th = Math.PI / 2 + (side === 0 ? 1 : -1) * Math.PI * (i / steps);
            const roar =
              Math.sin(i * 0.9 + t * 26) * 0.16 +
              Math.sin(i * 2.3 - t * 31) * 0.1 +
              Math.sin(i * 0.31 + t * 12) * 0.3;
            const r = aR * (1.14 + Math.max(0, roar) * 1.1);
            gctx.lineTo(ax + Math.cos(th) * r, ay - Math.sin(th) * r);
          }
          gctx.closePath();
          gctx.fill();
        }
        gctx.restore();
      }

      /* ── PHASE IV: zero-g pop art ── */
      if (zeroG) {
        for (const d of debris) {
          d.y += d.vy * dt;
          d.x += (Math.sin(d.seed + d.y * 8) * d.sway * 10 * dt) / Math.max(W, 1);
          d.rot += d.vr * dt;
          if (d.y < -0.08) respawnDebris(d, false);
          const dx = d.x * W;
          const dy = d.y * H;
          gctx.save();
          gctx.translate(dx, dy);
          gctx.rotate(d.rot);
          if (d.kind === 0) {
            gctx.strokeStyle = "rgba(0,255,255,0.8)";
            gctx.lineWidth = 1.3;
            gctx.beginPath();
            gctx.arc(0, 0, d.s, 0, TAU);
            gctx.stroke();
            gctx.beginPath();
            for (let q = 0; q < 4; q++) {
              const a2 = (q / 4) * TAU;
              gctx.moveTo(Math.cos(a2) * d.s * 0.6, Math.sin(a2) * d.s * 0.6);
              gctx.lineTo(Math.cos(a2) * d.s * 1.35, Math.sin(a2) * d.s * 1.35);
            }
            gctx.stroke();
            gctx.fillStyle = "#39ff14";
            gctx.fillRect(-1.2, -1.2, 2.4, 2.4);
          } else if (d.kind === 1) {
            const g = gctx.createLinearGradient(0, -d.s, 0, d.s);
            g.addColorStop(0, "rgba(255,60,60,0.9)");
            g.addColorStop(0.35, "#fffdf5");
            g.addColorStop(1, "#f0e8d8");
            gctx.fillStyle = g;
            gctx.beginPath();
            gctx.moveTo(-d.s * 0.5, -d.s * 0.6);
            gctx.lineTo(d.s * 0.55, -d.s * 0.5);
            gctx.lineTo(d.s * 0.3, d.s * 0.4);
            gctx.lineTo(d.s * 0.05, d.s * 0.95);
            gctx.lineTo(-d.s * 0.28, d.s * 0.45);
            gctx.closePath();
            gctx.fill();
          } else {
            gctx.fillStyle = "rgba(255,0,0,0.16)";
            gctx.beginPath();
            gctx.arc(0, 0, d.s * 1.6, 0, TAU);
            gctx.fill();
            gctx.fillStyle = "rgba(255,0,0,0.45)";
            gctx.beginPath();
            gctx.arc(0, 0, d.s * 0.85, 0, TAU);
            gctx.fill();
            gctx.fillStyle = "rgba(255,180,180,0.9)";
            gctx.beginPath();
            gctx.arc(-d.s * 0.2, -d.s * 0.2, d.s * 0.3, 0, TAU);
            gctx.fill();
          }
          gctx.restore();
        }
        /* undo the tilt so the next frame starts clean */
        gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      }

      if (!paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const detach = attachVisibilityPause(glow, {
      onPause: () => {
        paused = true;
        cancelAnimationFrame(raf);
        // never leave the card frozen mid-shake
        ink.style.transform = glow.style.transform = "";
        wasShaking = false;
      },
      onResume: () => {
        paused = false;
        // all clocks are accumulated t — nothing to shift, just re-arm dt
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
    });

    return () => {
      detach();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      ink.style.transform = glow.style.transform = "";
    };
  }, [inkRef, glowRef]);
}

// ── Card-level: the clash ───────────────────────────────────────────────────

export function DandadanCardDomain() {
  const inkRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  useDandadanCanvases(inkRef, glowRef);

  return (
    <>
      {/* the gritty over-saturated dark, behind the card's text */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(10,5,15,0.85), rgba(8,4,12,0.6) 55%, rgba(7,4,12,0.45) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      {/* the two realities breathing against each other */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "linear-gradient(90deg, rgba(57,255,20,0.07), transparent 46%, transparent 54%, rgba(255,0,60,0.08))" }}
        animate={{ opacity: [0.4, 0.95, 0.4] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* viscous occult ink — UNDER the card's z-10 text */}
      <canvas
        ref={inkRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
      />
      {/* beams · streaks · tear · blast · aura · debris — pure light on top */}
      <canvas
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the bifurcated mark ───────────────────────────────────────

export function DandadanAvatarMark() {
  // Register so the realities split along THIS avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    DAN_ANCHORS.add(el);
    return () => {
      DAN_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* dual-reality breath: alien green/cyan vs cursed red/magenta */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "-6px 0 22px 4px rgba(57,255,20,0.4), 6px 0 22px 4px rgba(255,0,0,0.4)",
            "-9px 0 30px 7px rgba(0,255,255,0.42), 9px 0 30px 7px rgba(255,0,255,0.42)",
            "-6px 0 22px 4px rgba(57,255,20,0.4), 6px 0 22px 4px rgba(255,0,0,0.4)",
          ],
        }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the split ring itself: half alien light, half cursed light */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-[4%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,0,255,0.75), rgba(255,0,0,0.7) 90deg, rgba(255,0,255,0.0) 175deg, rgba(0,255,255,0.0) 185deg, rgba(0,255,255,0.7) 270deg, rgba(57,255,20,0.75) 355deg, rgba(255,0,255,0.75))",
          WebkitMaskImage: "radial-gradient(circle, transparent 62%, #000 70%)",
          maskImage: "radial-gradient(circle, transparent 62%, #000 70%)",
        }}
      />

      {/* a UFO crosshair slowly orbiting the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[10%] z-[1]"
        style={{ willChange: "transform" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute left-1/2 top-0 block h-[12%] w-[12%] -translate-x-1/2 rounded-full border border-cyan-300/90"
          style={{ boxShadow: "0 0 6px rgba(0,255,255,0.7), inset 0 0 4px rgba(57,255,20,0.6)" }}
        />
      </motion.span>

      {/* one red spirit-orb drifting UP past the rim, zero-g style */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute z-[1] h-[8%] w-[8%] rounded-full"
        style={{
          left: "68%",
          background: "radial-gradient(circle at 35% 35%, #ffb4b4, #ff0000 70%)",
          boxShadow: "0 0 8px rgba(255,0,0,0.75)",
        }}
        initial={{ top: "96%", opacity: 0 }}
        animate={{
          top: ["96%", "70%", "30%", "-12%"],
          opacity: [0, 0.9, 0.85, 0],
          x: ["0%", "18%", "-14%", "6%"],
        }}
        transition={{ duration: 7.5, times: [0, 0.25, 0.7, 1], repeat: Infinity, ease: "linear" }}
      />
    </>
  );
}
