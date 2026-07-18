"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

/**
 * "The Unblinking" — SSS grade. Hand-drawn cosmic horror in the style of a
 * cursed horror-manga manuscript: every line procedurally inked and BOILING
 * (each point re-jittered per frame so the whole page looks like a frantic,
 * living sketch).
 *
 * - UnblinkingCardRealm (profile-level): a card-anchored <canvas> draws
 *   jagged sketch rings vibrating around the avatar, a colossal hand-drawn
 *   eye whose scribbled crimson iris tracks the viewer's cursor — it BLINKS,
 *   its slit pupil dilates as the cursor nears, and every so often it stops
 *   chasing and stares straight out at the viewer — plus spindly shadow
 *   tendrils, black/crimson ink drips, small WATCHER eyes that open in the
 *   dark and stare before sealing shut, a skeletal hand that rises from the
 *   bottom of the page reaching for the avatar, a many-legged skitterer that
 *   crosses the card, a double-thump heartbeat darkness, decaying film grain,
 *   and — every 4–9 seconds — four slash marks that tear across the card for
 *   3 frames with a 2px shake (sometimes twice in quick succession). Palette:
 *   ink black, ash grey, bleeding crimson #8B0000, parchment white.
 *
 * - UnblinkingAvatarMark (avatar-level): registers the anchor and wraps the
 *   avatar in an ink-black aura with a crimson pulse.
 *
 * Pure code — no images. Canvas is a child of the profile card (absolute
 * inset-0, card-local coordinates) so it scrolls locked to the profile.
 */

export const UNBLINKING_ANCHORS = new Set<HTMLElement>();

const CRIMSON = "#8B0000";
const PARCH = "#f2ead8";

// jitter ±n — the "boiling line"
function j(n: number): number {
  return Math.random() * (n * 2) - n;
}

function bez(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

type Drip = { x: number; y0: number; y: number; spd: number; w: number; crimson: boolean };
type Tendril = { a: number; reach: number; ph: number; spd: number };
type Ring = { off: number; seed: number; steps: number };

function useUnblinkingCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

    const rings: Ring[] = [];
    for (let r = 0; r < 5; r++) {
      rings.push({ off: 9 + r * 6 + Math.random() * 4, seed: Math.random() * 10, steps: 34 + ((Math.random() * 10) | 0) });
    }
    const tendrils: Tendril[] = [];
    for (let tn = 0; tn < 6; tn++) {
      tendrils.push({ a: (tn / 6) * Math.PI * 2 + Math.random() * 0.5, reach: 0.55 + Math.random() * 0.45, ph: Math.random() * 6, spd: 0.3 + Math.random() * 0.5 });
    }
    const drips: Drip[] = [];
    let dripTimer = 1.2;

    // the eye's slow, erratic pursuit of the cursor
    const eye = { x: 0, y: 0, tx: 0, ty: 0, twitchT: 0, twx: 0, twy: 0, seeded: false };
    let mouseX: number | null = null;
    let mouseY: number | null = null;
    const onPointer = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("pointermove", onPointer);

    const scratch = { marks: [] as { x: number; y: number }[][], full: 0, alpha: 0, timer: 4 + Math.random() * 5, shake: 0, doubleT: 0 };

    // The Watchers — small eyes that OPEN in the dark, stare at the cursor,
    // blink, and seal shut again.
    type Watcher = { x: number; y: number; w: number; open: number; phase: "opening" | "staring" | "closing"; life: number; blinkT: number };
    const watchers: Watcher[] = [];
    let watcherTimer = 2.5;

    // A skeletal hand that rises from below and reaches for the avatar.
    const hand = { active: false, t: 0, x: 0, timer: 9 + Math.random() * 9 };
    // A many-legged thing that skitters across a corner of the page.
    const pede = { active: false, t: 0, x0: 0, y0: 0, x1: 0, y1: 0, timer: 16 + Math.random() * 18 };
    // Heartbeat darkness — the page itself seems to clench, twice.
    const pulse = { a: 0, again: 0, timer: 5 + Math.random() * 4 };
    // The great eye's moods: periodic blinks, and the moment it stops following
    // the cursor and stares STRAIGHT OUT at the viewer.
    const gaze = { blinkT: 5 + Math.random() * 8, blink: 0, stareT: 12 + Math.random() * 14, stare: 0 };

    const resize = () => {
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    const spawnDrip = (cx: number, cy: number, R: number) => {
      const fromAvatar = Math.random() < 0.45;
      const x = fromAvatar ? cx + j(R * 0.9) : Math.random() * W;
      const y0 = fromAvatar ? cy + R * 0.9 : -10;
      drips.push({ x, y0, y: y0 + 4, spd: 110 + Math.random() * 150, w: 2 + Math.random() * 3, crimson: Math.random() < 0.5 });
    };

    const triggerScratch = () => {
      scratch.marks = [];
      for (let m = 0; m < 4; m++) {
        const vert = Math.random() < 0.5;
        const x0 = vert ? Math.random() * W : -15;
        const y0 = vert ? -15 : Math.random() * H;
        const x1 = vert ? x0 + j(W * 0.3) : W + 15;
        const y1 = vert ? H + 15 : y0 + j(H * 0.3);
        const pts: { x: number; y: number }[] = [];
        for (let s = 0; s <= 8; s++) {
          const f = s / 8;
          pts.push({ x: x0 + (x1 - x0) * f + j(14), y: y0 + (y1 - y0) * f + j(14) });
        }
        scratch.marks.push(pts);
      }
      scratch.full = 3;
      scratch.alpha = 1;
      scratch.shake = 6;
      // sometimes the page is slashed TWICE in quick succession
      if (Math.random() < 0.25) scratch.doubleT = 0.35;
    };

    const spawnWatcher = () => {
      const edge = Math.random();
      let x: number, y: number;
      if (edge < 0.35) {
        x = Math.random() * W;
        y = 18 + Math.random() * H * 0.1;
      } else if (edge < 0.62) {
        x = W * (Math.random() < 0.5 ? 0.07 : 0.93) + j(12);
        y = H * (0.15 + Math.random() * 0.7);
      } else {
        x = Math.random() * W;
        y = H * (0.84 + Math.random() * 0.12);
      }
      watchers.push({ x, y, w: 12 + Math.random() * 16, open: 0, phase: "opening", life: 2 + Math.random() * 4, blinkT: 1 + Math.random() * 2 });
    };

    const strokePath = (pts: { x: number; y: number }[]) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    };

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frameBody = (now: number) => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      // ── locate the avatar, in canvas-LOCAL coordinates ──
      const cRect = canvas.getBoundingClientRect();
      let target: { x: number; y: number; r: number } | null = null;
      let best = 0;
      UNBLINKING_ANCHORS.forEach((el) => {
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
      const cx = focus ? focus.x : W * 0.28;
      const cy = focus ? focus.y : H * 0.2;
      const R = focus ? Math.max(34, focus.r) : 46;

      // cursor in card-local space; when unknown, the eye wanders on its own
      const mx = mouseX !== null ? mouseX - cRect.left : W * (0.5 + Math.sin(t * 0.4) * 0.3);
      const my = mouseY !== null ? mouseY - cRect.top : H * (0.4 + Math.cos(t * 0.3) * 0.2);

      // ═══ THE ELDRITCH GAZE ═══
      const baseX = Math.min(W * 0.72, cx + R * 2.6);
      const baseY = Math.max(56, cy - R * 0.2);
      if (!eye.seeded) {
        eye.x = baseX;
        eye.y = baseY;
        eye.seeded = true;
      }
      eye.twitchT -= dt;
      if (eye.twitchT <= 0) {
        eye.twitchT = 0.7 + Math.random() * 1.8;
        eye.twx = j(18);
        eye.twy = j(10);
      }
      eye.tx = baseX + (mx - baseX) * 0.08 + eye.twx;
      eye.ty = baseY + (my - baseY) * 0.06 + eye.twy;
      eye.x += (eye.tx - eye.x) * Math.min(1, dt * 2.2);
      eye.y += (eye.ty - eye.y) * Math.min(1, dt * 2.2);

      const ew = Math.min(W * 0.3, 128);
      const eh = ew * 0.42;
      const dx = mx - eye.x;
      const dy = my - eye.y;
      const dist = Math.hypot(dx, dy) || 1;
      let lookX = dx / dist;
      let lookY = dy / dist;

      // moods: periodic blink; and every so often it stops chasing the cursor
      // and stares STRAIGHT OUT of the page at the viewer.
      gaze.blinkT -= dt;
      if (gaze.blinkT <= 0) {
        gaze.blink = 0.16;
        gaze.blinkT = 6 + Math.random() * 8;
      }
      if (gaze.blink > 0) gaze.blink -= dt;
      gaze.stareT -= dt;
      if (gaze.stareT <= 0) {
        gaze.stare = 1.6;
        gaze.stareT = 15 + Math.random() * 16;
        if (Math.random() < 0.5) triggerScratch();
      }
      if (gaze.stare > 0) {
        gaze.stare -= dt;
        lookX *= 0.06;
        lookY *= 0.06;
      }
      // the slit pupil dilates as the cursor draws near — or when it stares
      const prox = Math.max(0, 1 - dist / 300);
      const slit = Math.min(eh * 0.8 * 0.4, eh * 0.8 * 0.17 * (1 + prox * 0.7 + (gaze.stare > 0 ? 0.9 : 0)));

      ctx.save();
      ctx.globalAlpha = 0.8;
      for (let p = 0; p < 3; p++) {
        ctx.strokeStyle = p === 0 ? "rgba(10,10,12,0.9)" : `rgba(30,30,36,${0.32 + Math.random() * 0.3})`;
        ctx.lineWidth = 0.7 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(eye.x - ew + j(3), eye.y + j(3));
        ctx.bezierCurveTo(eye.x - ew * 0.42 + j(4), eye.y - eh + j(4), eye.x + ew * 0.42 + j(4), eye.y - eh + j(4), eye.x + ew + j(3), eye.y + j(3));
        ctx.bezierCurveTo(eye.x + ew * 0.42 + j(4), eye.y + eh + j(4), eye.x - ew * 0.42 + j(4), eye.y + eh + j(4), eye.x - ew + j(3), eye.y + j(3));
        ctx.stroke();
      }
      for (let L = 0; L < 8; L++) {
        const la = (L / 8) * Math.PI * 2;
        const lx = eye.x + Math.cos(la) * ew * 0.92;
        const ly = eye.y + Math.sin(la) * eh * 0.92;
        ctx.strokeStyle = `rgba(14,14,16,${0.3 + Math.random() * 0.3})`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(lx + j(2), ly + j(2));
        ctx.lineTo(lx + Math.cos(la) * (10 + Math.random() * 8) + j(2), ly + Math.sin(la) * (8 + Math.random() * 6) + j(2));
        ctx.stroke();
      }
      const ir = eh * 0.8;
      const px = eye.x + lookX * ew * 0.34;
      const py = eye.y + lookY * eh * 0.34;
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        ctx.strokeStyle = `rgba(139,0,0,${0.22 + Math.random() * 0.38})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * ir + j(3), py + Math.sin(a) * ir * 0.8 + j(3));
        ctx.quadraticCurveTo(px + Math.cos(a + 0.6) * ir * 0.5 + j(4), py + Math.sin(a + 0.6) * ir * 0.4 + j(4), px + j(4), py + j(4));
        ctx.stroke();
      }
      for (let p2 = 0; p2 < 2; p2++) {
        ctx.strokeStyle = `rgba(100,0,0,${0.5 - p2 * 0.2})`;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        for (let s = 0; s <= 26; s++) {
          const a = (s / 26) * Math.PI * 2;
          const x = px + Math.cos(a) * ir + j(2.5);
          const y = py + Math.sin(a) * ir * 0.8 + j(2.5);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      // staring? the iris web doubles down, scribbled brighter and angrier
      if (gaze.stare > 0) {
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          ctx.strokeStyle = `rgba(180,10,10,${0.35 + Math.random() * 0.4})`;
          ctx.lineWidth = 0.6 + Math.random() * 1.4;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(a) * ir + j(3), py + Math.sin(a) * ir * 0.8 + j(3));
          ctx.quadraticCurveTo(px + Math.cos(a + 0.5) * ir * 0.5 + j(4), py + Math.sin(a + 0.5) * ir * 0.4 + j(4), px + j(3), py + j(3));
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#050506";
      ctx.beginPath();
      ctx.moveTo(px + j(1.5), py - ir * 0.72 + j(1.5));
      ctx.bezierCurveTo(px + slit, py - ir * 0.22, px + slit, py + ir * 0.22, px + j(1.5), py + ir * 0.72 + j(1.5));
      ctx.bezierCurveTo(px - slit, py + ir * 0.22, px - slit, py - ir * 0.22, px + j(1.5), py - ir * 0.72 + j(1.5));
      ctx.fill();
      // the lids SNAP shut — a filled dark almond swallowing the whole eye
      if (gaze.blink > 0) {
        ctx.fillStyle = "rgba(11,11,13,0.96)";
        ctx.beginPath();
        ctx.moveTo(eye.x - ew, eye.y);
        ctx.bezierCurveTo(eye.x - ew * 0.42, eye.y - eh * 1.06, eye.x + ew * 0.42, eye.y - eh * 1.06, eye.x + ew, eye.y);
        ctx.bezierCurveTo(eye.x + ew * 0.42, eye.y + eh * 1.06, eye.x - ew * 0.42, eye.y + eh * 1.06, eye.x - ew, eye.y);
        ctx.fill();
      }
      ctx.restore();

      // ═══ SHADOW TENDRILS ═══
      for (const td of tendrils) {
        const grow = 0.7 + Math.sin(t * td.spd + td.ph) * 0.3;
        const ex2 = cx + Math.cos(td.a) * (W + H) * 0.26 * td.reach * grow;
        const ey2 = cy + Math.sin(td.a) * (W + H) * 0.26 * td.reach * grow;
        const m1x = cx + Math.cos(td.a + Math.sin(t * 0.7 + td.ph) * 0.4) * R * 2.4 + j(3);
        const m1y = cy + Math.sin(td.a + Math.sin(t * 0.7 + td.ph) * 0.4) * R * 2.4 + j(3);
        const m2x = (m1x + ex2) / 2 + Math.sin(t * 0.9 + td.ph * 2) * 28 + j(3);
        const m2y = (m1y + ey2) / 2 + Math.cos(t * 0.8 + td.ph * 2) * 28 + j(3);
        for (let s = 0; s < 5; s++) {
          const f0 = s / 5;
          const f1 = (s + 1) / 5;
          ctx.strokeStyle = `rgba(8,8,10,${0.8 - f0 * 0.5})`;
          ctx.lineWidth = Math.max(0.6, 8 * (1 - f0));
          ctx.beginPath();
          ctx.moveTo(bez(cx, m1x, m2x, ex2, f0) + j(1.5), bez(cy, m1y, m2y, ey2, f0) + j(1.5));
          ctx.lineTo(bez(cx, m1x, m2x, ex2, f1) + j(1.5), bez(cy, m1y, m2y, ey2, f1) + j(1.5));
          ctx.stroke();
        }
      }

      // ═══ INK DRIPS ═══
      dripTimer -= dt;
      if (dripTimer <= 0 && drips.length < 6) {
        spawnDrip(cx, cy, R);
        dripTimer = 2 + Math.random() * 3;
      }
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        d.y += d.spd * dt;
        if (d.y > H + 40) {
          drips.splice(i, 1);
          continue;
        }
        const col = d.crimson ? "139,0,0" : "10,10,12";
        const tail = Math.max(d.y0, d.y - 140);
        const g = ctx.createLinearGradient(0, tail, 0, d.y);
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(1, `rgba(${col},0.8)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = d.w;
        ctx.beginPath();
        ctx.moveTo(d.x + j(0.6), tail);
        ctx.lineTo(d.x + j(0.6), d.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(${col},0.9)`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.w * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // ═══ THE WATCHERS — eyes opening in the dark ═══
      watcherTimer -= dt;
      if (watcherTimer <= 0 && watchers.length < 6) {
        spawnWatcher();
        watcherTimer = 3 + Math.random() * 4;
      }
      for (let i = watchers.length - 1; i >= 0; i--) {
        const wt = watchers[i];
        if (wt.phase === "opening") {
          wt.open += dt / 1.1;
          if (wt.open >= 1) {
            wt.open = 1;
            wt.phase = "staring";
          }
        } else if (wt.phase === "staring") {
          wt.life -= dt;
          wt.blinkT -= dt;
          if (wt.blinkT <= -0.12) wt.blinkT = 1.2 + Math.random() * 2.4;
          if (wt.life <= 0) wt.phase = "closing";
        } else {
          wt.open -= dt / 0.45;
          if (wt.open <= 0) {
            watchers.splice(i, 1);
            continue;
          }
        }
        const blink = wt.phase === "staring" && wt.blinkT < 0 ? 0.04 : 1;
        const ww = wt.w;
        const wh = wt.w * 0.45 * Math.max(0, wt.open) * blink;
        if (wh < 0.6) {
          // just a closed slit trembling in the dark
          ctx.strokeStyle = "rgba(20,20,24,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wt.x - ww + j(1), wt.y + j(1));
          ctx.lineTo(wt.x + ww + j(1), wt.y + j(1));
          ctx.stroke();
          continue;
        }
        for (let p = 0; p < 2; p++) {
          ctx.strokeStyle = p === 0 ? "rgba(12,12,14,0.85)" : `rgba(32,32,38,${0.3 + Math.random() * 0.3})`;
          ctx.lineWidth = 0.6 + Math.random();
          ctx.beginPath();
          ctx.moveTo(wt.x - ww + j(1.5), wt.y + j(1.5));
          ctx.bezierCurveTo(wt.x - ww * 0.4 + j(2), wt.y - wh + j(2), wt.x + ww * 0.4 + j(2), wt.y - wh + j(2), wt.x + ww + j(1.5), wt.y + j(1.5));
          ctx.bezierCurveTo(wt.x + ww * 0.4 + j(2), wt.y + wh + j(2), wt.x - ww * 0.4 + j(2), wt.y + wh + j(2), wt.x - ww + j(1.5), wt.y + j(1.5));
          ctx.stroke();
        }
        const wa = Math.atan2(my - wt.y, mx - wt.x);
        const pwx = wt.x + Math.cos(wa) * ww * 0.3;
        const pwy = wt.y + Math.sin(wa) * wh * 0.4;
        for (let s = 0; s < 4; s++) {
          const a = Math.random() * Math.PI * 2;
          ctx.strokeStyle = `rgba(139,0,0,${0.3 + Math.random() * 0.3})`;
          ctx.lineWidth = 0.5 + Math.random() * 0.8;
          ctx.beginPath();
          ctx.moveTo(pwx + Math.cos(a) * wh * 0.8 + j(1.5), pwy + Math.sin(a) * wh * 0.8 + j(1.5));
          ctx.lineTo(pwx + j(1.5), pwy + j(1.5));
          ctx.stroke();
        }
        ctx.fillStyle = "#050506";
        ctx.beginPath();
        ctx.arc(pwx, pwy, Math.max(1.2, wh * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }

      // ═══ THE FRANTIC SKETCH FRAME ═══
      if (focus) {
        for (let i = 0; i < rings.length; i++) {
          const ring = rings[i];
          ctx.strokeStyle = i % 3 === 2 ? "rgba(139,0,0,0.42)" : `rgba(22,22,26,${0.5 + Math.random() * 0.35})`;
          ctx.lineWidth = 0.5 + Math.random() * 1.5;
          ctx.beginPath();
          for (let s = 0; s <= ring.steps; s++) {
            const a = (s / ring.steps) * Math.PI * 2;
            const wob = Math.sin(a * 3 + ring.seed * 7 + t * 0.9) * 3.2;
            const rr = R + ring.off + wob;
            const x = cx + Math.cos(a) * rr + j(2);
            const y = cy + Math.sin(a) * rr + j(2);
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // ═══ THE REACHING HAND ═══
      hand.timer -= dt;
      if (!hand.active && hand.timer <= 0 && focus) {
        hand.active = true;
        hand.t = 0;
        hand.x = cx + j(R * 0.8);
      }
      if (hand.active) {
        hand.t += dt;
        const RISE = 1.6;
        const HOLD = 1.1;
        const DROP = 1.2;
        if (hand.t >= RISE + HOLD + DROP) {
          hand.active = false;
          hand.timer = 14 + Math.random() * 16;
        } else {
          let p: number;
          if (hand.t < RISE) p = hand.t / RISE;
          else if (hand.t < RISE + HOLD) p = 1;
          else p = Math.max(0, 1 - (hand.t - RISE - HOLD) / DROP);
          const ease = p * p * (3 - 2 * p);
          const wristY = H + 30 - (H + 30 - (cy + R * 1.7)) * ease;
          const curl = hand.t > RISE && hand.t < RISE + HOLD ? Math.sin((hand.t - RISE) * 6) * 0.22 : 0;
          // the arm, rising out of the bottom of the page
          ctx.strokeStyle = "rgba(8,8,10,0.9)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(hand.x + j(1.5), H + 40);
          ctx.lineTo(hand.x + j(1.5), wristY + 10);
          ctx.stroke();
          // five spindly jointed fingers, splaying toward the avatar
          for (let f = 0; f < 5; f++) {
            const flen = R * (1.05 - Math.abs(f - 2) * 0.12);
            let fx = hand.x + (f - 2) * 7 + j(1);
            let fy = wristY + j(1);
            let seg = flen * 0.45;
            let ang = -Math.PI / 2 + (f - 2) * 0.28 + curl * (f - 2) * 0.12;
            ctx.lineWidth = 2.6;
            for (let s = 0; s < 3; s++) {
              const nx = fx + Math.cos(ang) * seg;
              const ny = fy + Math.sin(ang) * seg;
              ctx.strokeStyle = `rgba(8,8,10,${0.9 - s * 0.12})`;
              ctx.beginPath();
              ctx.moveTo(fx + j(1), fy + j(1));
              ctx.lineTo(nx + j(1), ny + j(1));
              ctx.stroke();
              ctx.fillStyle = "rgba(8,8,10,0.85)";
              ctx.beginPath();
              ctx.arc(nx, ny, 1.6, 0, Math.PI * 2);
              ctx.fill();
              fx = nx;
              fy = ny;
              seg *= 0.72;
              ang += curl - 0.12 + (f - 2) * 0.03;
              ctx.lineWidth *= 0.75;
            }
          }
        }
      }

      // ═══ THE SKITTERER — a many-legged thing crosses the page ═══
      pede.timer -= dt;
      if (!pede.active && pede.timer <= 0) {
        pede.active = true;
        pede.t = 0;
        const fromLeft = Math.random() < 0.5;
        pede.x0 = fromLeft ? -30 : W + 30;
        pede.x1 = fromLeft ? W + 40 : -40;
        pede.y0 = Math.random() < 0.5 ? H * (0.05 + Math.random() * 0.2) : H * (0.75 + Math.random() * 0.2);
        pede.y1 = pede.y0 + j(H * 0.16);
      }
      if (pede.active) {
        pede.t += dt / 1.7;
        if (pede.t > 1.3) {
          pede.active = false;
          pede.timer = 22 + Math.random() * 26;
        } else {
          const SEGS = 13;
          const SP = 0.022;
          const dirA = Math.atan2(pede.y1 - pede.y0, pede.x1 - pede.x0);
          for (let s = 0; s < SEGS; s++) {
            const tt = pede.t - s * SP;
            if (tt < 0 || tt > 1) continue;
            const bx = pede.x0 + (pede.x1 - pede.x0) * tt;
            const by = pede.y0 + (pede.y1 - pede.y0) * tt + Math.sin(tt * 26) * 7;
            const rr = 3 * (1 - (s / SEGS) * 0.55);
            ctx.fillStyle = "rgba(8,8,10,0.92)";
            ctx.beginPath();
            ctx.arc(bx + j(0.8), by + j(0.8), rr, 0, Math.PI * 2);
            ctx.fill();
            for (const sgn of [-1, 1]) {
              const la = dirA + (Math.PI / 2) * sgn + Math.sin(t * 40 + s) * 0.4;
              ctx.strokeStyle = "rgba(8,8,10,0.8)";
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(la) * (rr + 4), by + Math.sin(la) * (rr + 4));
              ctx.stroke();
            }
            if (s === 0) {
              for (const sgn of [-1, 1]) {
                ctx.strokeStyle = "rgba(8,8,10,0.85)";
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(dirA + sgn * 0.4) * 9 + j(1.5), by + Math.sin(dirA + sgn * 0.4) * 9 + j(1.5));
                ctx.stroke();
              }
            }
          }
        }
      }

      // ═══ HEARTBEAT DARKNESS — the page clenches, twice ═══
      pulse.timer -= dt;
      if (pulse.timer <= 0) {
        pulse.a = 0.2;
        pulse.again = 0.28;
        pulse.timer = 6 + Math.random() * 5;
      }
      if (pulse.again > 0) {
        pulse.again -= dt;
        if (pulse.again <= 0) pulse.a = 0.26;
      }
      if (pulse.a > 0.01) {
        pulse.a *= Math.max(0, 1 - dt * 5);
        ctx.fillStyle = `rgba(0,0,0,${pulse.a})`;
        ctx.fillRect(0, 0, W, H);
      }

      // ═══ SCHIZOPHRENIC SCRATCHES ═══
      scratch.timer -= dt;
      if (scratch.timer <= 0) {
        triggerScratch();
        scratch.timer = 4 + Math.random() * 5;
      }
      if (scratch.doubleT > 0) {
        scratch.doubleT -= dt;
        if (scratch.doubleT <= 0) triggerScratch();
      }
      if (scratch.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = scratch.alpha;
        for (const pts of scratch.marks) {
          ctx.strokeStyle = CRIMSON;
          ctx.lineWidth = 5;
          strokePath(pts);
          ctx.strokeStyle = PARCH;
          ctx.lineWidth = 1.8;
          strokePath(pts);
        }
        ctx.restore();
        if (scratch.full > 0) scratch.full--;
        else scratch.alpha = Math.max(0, scratch.alpha - 0.09);
      }

      // ═══ FILM GRAIN — the page itself is decaying ═══
      for (let g = 0; g < 60; g++) {
        ctx.fillStyle = Math.random() < 0.85 ? "rgba(242,234,216,0.05)" : "rgba(139,0,0,0.07)";
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }

      // Shake the CANVAS, not the card: in the shop preview modal the card is a
      // framer-motion element whose inline transform framer owns — writing to it
      // would fight the library. The charcoal wash hides the card content, so
      // shaking just the ink layer reads the same.
      if (scratch.shake > 0) {
        canvas.style.transform = `translate(${j(2)}px, ${j(2)}px)`;
        scratch.shake--;
        if (scratch.shake === 0) canvas.style.transform = "";
      }

      raf = requestAnimationFrame(frame);
    };

    let warned = false;
    const frame = (now: number) => {
      try {
        frameBody(now);
      } catch (err) {
        if (!warned) {
          warned = true;
          console.error("[unblinking] frame error:", err);
        }
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      ro?.disconnect();
      canvas.style.transform = "";
    };
  }, [canvasRef]);
}

// ── Profile-level: the manuscript, anchored INSIDE the card ─────────────────

export function UnblinkingCardRealm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useUnblinkingCanvas(canvasRef);

  return (
    <>
      {/* the cursed page — charcoal wash + heavy distressed vignette */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "rgba(10,10,12,0.92)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(circle at 50% 42%, rgba(28,28,32,0) 0%, rgba(10,10,12,0.5) 55%, rgba(0,0,0,0.85) 92%)" }}
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* a faint crimson pulse deep in the page, like something breathing */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(60% 40% at 70% 18%, rgba(139,0,0,0.14), transparent 65%)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* the living ink — boiling lines, the gaze, tendrils, drips, scratches */}
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-[30] h-full w-full" />
    </>
  );
}

// ── Avatar-level: the mark of being watched ─────────────────────────────────

export function UnblinkingAvatarMark() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    UNBLINKING_ANCHORS.add(el);
    return () => {
      UNBLINKING_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />

      {/* ink-black aura with a bleeding-crimson pulse */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-full z-0"
        animate={{
          boxShadow: [
            "0 0 10px 2px rgba(10,10,12,0.7), 0 0 18px 5px rgba(139,0,0,0.35)",
            "0 0 14px 3px rgba(10,10,12,0.8), 0 0 26px 8px rgba(139,0,0,0.55)",
            "0 0 10px 2px rgba(10,10,12,0.7), 0 0 18px 5px rgba(139,0,0,0.35)",
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* a thin parchment scratch-ring that flickers like redrawn ink */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[5px] rounded-full z-0 border border-dashed"
        style={{ borderColor: "rgba(242,234,216,0.35)" }}
        animate={{ rotate: 360, opacity: [0.25, 0.6, 0.25] }}
        transition={{ rotate: { duration: 22, repeat: Infinity, ease: "linear" }, opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
      />
    </>
  );
}
