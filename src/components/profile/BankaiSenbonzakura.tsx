"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";
import { attachVisibilityPause } from "@/components/profile/pauseWhenUnseen";

/**
 * BANKAI: SENBONZAKURA KAGEYOSHI — SSS profile effect. A full release cycle,
 * looping forever as build → climax → aftermath (the Hollow Purple lesson:
 * an EVENT, not an object):
 *
 *   I   THE DROP — a lone katana falls dead-vertical out of the card's dark
 *       and stabs the floor beneath the avatar. Shock rings, a flash, and a
 *       shake (on the CANVAS, never the parent — the Unblinking rule).
 *   II  REIATSU — a pillar of white-pink light erupts through the avatar
 *       while the floor ripples like liquid; six monolithic blades rise
 *       through it, framing the avatar.
 *   III THE SCATTER — half a second of silence, then every blade shatters
 *       into hundreds of glowing petals that tornado around the avatar.
 *   IV  THE DOMAIN — the storm calms into drifting petals... which finally
 *       re-gather into the floor and vanish, resetting the dark for the next
 *       release. ~15s seamless loop.
 *
 * Rendering: pure light on dark, so the whole effect is ONE z-[30]
 * screen-blend canvas (Gateway/Portal treatment) — it can only brighten, so
 * it rides over the card's text. The blades are deliberately silver-white
 * ghosts (no dark ink above text, ever). NO shadowBlur anywhere in the loop
 * (the Dejavu lesson): all glow is pre-rendered sprites + additive composite
 * + wide faint strokes.
 *
 * All clocks are ACCUMULATED time (t += dt), never wall-clock absolutes, so
 * the visibility pause needs no clock-shifting on resume — a parked card
 * resumes mid-phase exactly where it froze.
 */

// The avatar registers here; the release erupts beneath THIS card's avatar.
const BANKAI_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInExpo = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, 10 * p - 10));
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);

/* the cycle, in seconds — every phase boundary lives here */
const CYCLE = 15;
const T_DROP = 0.35;
const DROP_DUR = 0.6;
const T_IMPACT = T_DROP + DROP_DUR;            // 0.95
const T_PILLAR_END = T_IMPACT + 1.1;           // 2.05
const T_RISE = 1.45;
const RISE_DUR = 0.55;
const RISE_STAGGER = 0.07;
const T_SCATTER = 3.1;                         // rise ends ~2.35, hold ~0.5s… see blades
const SWARM_DUR = 1.8;
const T_REGATHER = 12.6;
const REGATHER_DUR = 1.6;

type Petal = {
  alive: boolean;
  x: number; y: number; vx: number; vy: number;
  dir: number; orbitR: number;
  rot: number; rotV: number;
  flutterF: number; seed: number;
  sprite: HTMLCanvasElement; scale: number;
};

type Blade = { off: number; hFrac: number; w: number; delay: number; progress: number; shattered: boolean };

function useBankaiCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      // Size to the profile CARD, not the viewport — locked to the card while
      // scrolling, like a Discord profile effect.
      W = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 420);
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    /* ── petal sprites: baked once, stamped thousands of times ── */
    const sprites: HTMLCanvasElement[] = [];
    for (const [hi, mid, lo] of [
      ["#ff9dcc", "#ff69b4", "#ff1493"],
      ["#ffc4e1", "#ff69b4", "#e91280"],
      ["#ffffff", "#ffb3d9", "#ff1493"],
    ]) {
      for (const size of [7, 10, 13]) {
        const s = document.createElement("canvas");
        const px = size * 2;
        s.width = px; s.height = px;
        const g = s.getContext("2d")!;
        g.translate(px / 2, px / 2);
        const grad = g.createLinearGradient(0, -size, 0, size);
        grad.addColorStop(0, hi);
        grad.addColorStop(0.55, mid);
        grad.addColorStop(1, lo);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, size * 0.95);
        g.bezierCurveTo(size * 0.62, size * 0.45, size * 0.55, -size * 0.35, size * 0.16, -size * 0.78);
        g.lineTo(0, -size * 0.55);
        g.lineTo(-size * 0.16, -size * 0.78);
        g.bezierCurveTo(-size * 0.55, -size * 0.35, -size * 0.62, size * 0.45, 0, size * 0.95);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.5)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, size * 0.9);
        g.bezierCurveTo(size * 0.5, size * 0.4, size * 0.45, -size * 0.3, size * 0.14, -size * 0.7);
        g.stroke();
        sprites.push(s);
      }
    }
    // one soft radial glow for impacts/motes — glow without shadowBlur
    const glowSprite = (() => {
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.4, "rgba(255,105,180,0.45)");
      grad.addColorStop(1, "rgba(255,20,147,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return s;
    })();

    /* ── state ── */
    let raf = 0;
    let paused = false;
    let last = performance.now();
    let t = 0;               // accumulated — pause-safe by construction
    let cycleN = -1;         // which cycle the one-shot flags belong to
    let impactFired = false;
    let scatterFired = false;
    let flash = 0;
    let shakeMag = 0;
    let wasShaking = false;
    let rings: { born: number; maxR: number; dur: number; wide: number; neg: boolean }[] = [];
    let streaks: { x: number; y: number; len: number; v: number; a: number }[] = [];
    let blades: Blade[] = [];
    const BLADE_LAYOUT: [number, number, number][] = [
      [-0.86, 0.62, 14], [-0.55, 0.82, 19], [-0.28, 0.5, 11],
      [0.28, 0.54, 12], [0.55, 0.78, 18], [0.86, 0.66, 15],
    ];
    let petals: Petal[] = [];

    const newCycle = () => {
      impactFired = false;
      scatterFired = false;
      rings = [];
      streaks = [];
      flash = 0;
      blades = BLADE_LAYOUT.map(([off, hFrac, w], i) => ({
        off, hFrac, w,
        delay: RISE_STAGGER * Math.abs(i - 2.5) * 2,
        progress: 0,
        shattered: false,
      }));
      for (const p of petals) p.alive = false;
    };

    const ignitePetal = (p: Petal, x: number, y: number, cx: number, cy: number) => {
      p.alive = true;
      p.x = x; p.y = y;
      const away = Math.atan2(y - cy, x - cx) + rand(-0.6, 0.6);
      const burst = rand(60, 340);
      p.vx = Math.cos(away) * burst + rand(-70, 70);
      p.vy = Math.sin(away) * burst * 0.62 + rand(-110, 30);
      p.dir = Math.random() < 0.5 ? -1 : 1;
      p.orbitR = rand(46, Math.max(W, H) * 0.46);
      p.rot = rand(0, TAU);
      p.rotV = rand(-6, 6);
      p.flutterF = rand(2.2, 5.4);
      p.seed = rand(0, TAU);
      p.sprite = sprites[(Math.random() * sprites.length) | 0];
      p.scale = rand(0.5, 1.05);
    };

    /* the falling / planted katana — sized to the card */
    const drawSword = (x: number, tipY: number, alpha: number) => {
      const L = Math.max(60, H * 0.15);
      const w = Math.max(5, L * 0.06);
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(x - w, 0, x + w, 0);
      grad.addColorStop(0, "#9aa3b4");
      grad.addColorStop(0.48, "#ffffff");
      grad.addColorStop(0.55, "#e8edf5");
      grad.addColorStop(1, "#b9c2d4");
      // faint aura first (wide ghost pass — glow without shadowBlur)
      ctx.strokeStyle = "rgba(255,105,180,0.28)";
      ctx.lineWidth = w * 2.6;
      ctx.beginPath();
      ctx.moveTo(x, tipY);
      ctx.lineTo(x, tipY - L);
      ctx.stroke();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, tipY);
      ctx.bezierCurveTo(x + w * 0.5, tipY - L * 0.06, x + w * 0.5, tipY - L * 0.1, x + w * 0.5, tipY - L * 0.12);
      ctx.lineTo(x + w * 0.5, tipY - L);
      ctx.lineTo(x - w * 0.4, tipY - L);
      ctx.lineTo(x - w * 0.4, tipY - L * 0.1);
      ctx.closePath();
      ctx.fill();
      // habaki + tsuba + wrapped hilt, all light inks
      ctx.fillStyle = "#e8edf5";
      ctx.fillRect(x - w * 0.55, tipY - L - L * 0.045, w * 1.1, L * 0.045);
      ctx.strokeStyle = "rgba(255,105,180,0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, tipY - L - L * 0.07, w * 1.6, L * 0.024, 0, 0, TAU);
      ctx.stroke();
      const grip = L * 0.3;
      ctx.fillStyle = "rgba(232,237,245,0.55)";
      ctx.fillRect(x - w * 0.45, tipY - L - L * 0.07 - grip, w * 0.9, grip);
      ctx.fillStyle = "rgba(255,105,180,0.7)";
      for (let i = 0; i < 3; i++) {
        const gy = tipY - L - L * 0.07 - grip + grip * (0.2 + i * 0.3);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.45, gy);
        ctx.lineTo(x, gy + grip * 0.1);
        ctx.lineTo(x + w * 0.45, gy);
        ctx.lineTo(x, gy - grip * 0.1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      const cyc = Math.floor(t / CYCLE);
      if (cyc !== cycleN) {
        cycleN = cyc;
        newCycle();
      }
      const ct = t - cyc * CYCLE;

      // avatar epicenter — ONLY anchors inside THIS canvas's card
      const cRect = canvas.getBoundingClientRect();
      const host = canvas.parentElement;
      let ax = W * 0.5;
      let ay = H * 0.3;
      let aR = 50;
      let best = 0;
      BANKAI_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });
      const floorY = Math.min(ay + aR + H * 0.2, H - 24);
      /* The forest must fit the card it's on. The profile hero centers the
         avatar, but the popout/preview surfaces LEFT-anchor it — a symmetric
         ±340px spread lost half the blades offscreen there (review-caught).
         Each side's span compresses to the room that side actually has, and
         the scatter reuses the same helpers so petals ignite exactly where
         the blades stood. */
      const leftSpan = Math.min(Math.max(ax - 14, 36), 340);
      const rightSpan = Math.min(Math.max(W - ax - 14, 36), 340);
      // The spans alone already guarantee on-card placement — no second
      // width factor, or narrow cards get a doubly-compressed forest.
      const bladeX = (off: number) => ax + off * (off < 0 ? leftSpan : rightSpan);
      const bladeW = (w: number) => w * Math.max(0.7, Math.min(W / 380, 1.4));

      // shake belongs to the CANVAS, never the parent (Unblinking rule)
      shakeMag = Math.max(0, shakeMag - dt * 26);
      if (shakeMag > 0.3) {
        canvas.style.transform = `translate(${rand(-shakeMag, shakeMag).toFixed(1)}px, ${rand(-shakeMag, shakeMag).toFixed(1)}px)`;
        wasShaking = true;
      } else if (wasShaking) {
        // one clearing write, not one per idle frame (CSSOM writes aren't free)
        canvas.style.transform = "";
        wasShaking = false;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      /* ── I: the drop ── */
      if (ct >= T_DROP && ct < T_IMPACT) {
        const p = easeInExpo((ct - T_DROP) / DROP_DUR);
        drawSword(ax, -H * 0.2 + (floorY + H * 0.2) * p, 1);
      }
      if (!impactFired && ct >= T_IMPACT) {
        impactFired = true;
        shakeMag = 8;
        flash = 0.6;
        const maxR = Math.hypot(Math.max(ax, W - ax), Math.max(floorY, H - floorY));
        rings.push({ born: ct, maxR: maxR * 1.1, dur: 0.6, wide: 14, neg: false });
        rings.push({ born: ct, maxR: maxR * 0.9, dur: 0.7, wide: 8, neg: true });
        for (let i = 0; i < 26; i++) {
          streaks.push({
            x: ax + rand(-aR * 0.7, aR * 0.7) * Math.random(),
            y: rand(floorY * 0.15, floorY),
            len: rand(8, 26),
            v: rand(300, 720),
            a: rand(0.4, 1),
          });
        }
      }
      // the sword stays planted until the forest takes over
      if (impactFired && ct < T_RISE + 0.3) {
        drawSword(ax, floorY, 1 - clamp01((ct - T_RISE) / 0.3));
      }

      /* ── II: the reiatsu pillar ── */
      if (impactFired && ct < T_PILLAR_END + 0.2) {
        const p = clamp01((ct - T_IMPACT) / (T_PILLAR_END - T_IMPACT));
        const grow = easeOutExpo(Math.min(p * 3, 1));
        const fade = 1 - easeInExpo(clamp01((p - 0.6) / 0.4));
        if (fade > 0) {
          const flicker = 0.82 + 0.18 * Math.sin(ct * 47) * Math.sin(ct * 23 + 1.7);
          const wCore = Math.max(6, W * 0.03) * grow * flicker;
          const wGlow = Math.max(26, W * 0.14) * grow * flicker;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = fade;
          let g = ctx.createLinearGradient(ax - wGlow, 0, ax + wGlow, 0);
          g.addColorStop(0, "rgba(255,20,147,0)");
          g.addColorStop(0.5, "rgba(255,105,180,0.5)");
          g.addColorStop(1, "rgba(255,20,147,0)");
          ctx.fillStyle = g;
          ctx.fillRect(ax - wGlow, 0, wGlow * 2, floorY);
          g = ctx.createLinearGradient(ax - wCore, 0, ax + wCore, 0);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(0.5, "rgba(255,255,255,0.95)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(ax - wCore, 0, wCore * 2, floorY);
          for (const s of streaks) {
            s.y -= s.v * dt;
            if (s.y + s.len < 0) s.y = floorY;
            ctx.globalAlpha = fade * s.a;
            ctx.fillStyle = Math.random() < 0.3 ? "#ffffff" : "#ff9dcc";
            ctx.fillRect(s.x - 1, s.y, 2, s.len);
          }
          ctx.restore();
        }
      }

      /* liquid floor: sine bands rippling outward while the forest stands */
      const floorEnv = clamp01((ct - T_IMPACT - 0.4) / 0.7) *
        (ct < T_SCATTER + 1 ? 1 : Math.max(0, 1 - (ct - T_SCATTER - 1) / 1.2));
      if (floorEnv > 0) {
        for (let band = 0; band < 3; band++) {
          const amp = (2.5 + band * 2.5) * floorEnv;
          const yBase = floorY + band * 6;
          if (yBase > H - 4) continue;
          ctx.strokeStyle = band % 2 === 0
            ? `rgba(205,214,228,${0.35 * floorEnv})`
            : `rgba(255,105,180,${0.3 * floorEnv})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 6) {
            const y = yBase
              + Math.sin(x * 0.03 + ct * 3.1 + band * 1.3) * amp
              + Math.sin(x * 0.011 - ct * 1.9 + band) * amp * 0.6;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      /* ── II: the blade forest — silver-white ghosts, light ink only ── */
      const holdPulse = 0.5 + 0.5 * Math.sin(ct * 6);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, floorY);
      ctx.clip();
      for (const b of blades) {
        b.progress = easeOutExpo(clamp01((ct - T_RISE - b.delay) / RISE_DUR));
        if (b.shattered || b.progress <= 0) continue;
        const x = bladeX(b.off);
        const hgt = H * b.hFrac * b.progress;
        const tipY = floorY - hgt;
        const w = bladeW(b.w);
        const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        grad.addColorStop(0, "rgba(154,163,180,0.16)");
        grad.addColorStop(0.34, "rgba(205,214,228,0.5)");
        grad.addColorStop(0.52, "rgba(255,255,255,0.95)");
        grad.addColorStop(0.62, "rgba(232,237,245,0.7)");
        grad.addColorStop(1, "rgba(185,194,212,0.2)");
        // wide faint pink aura pass (no shadowBlur)
        ctx.strokeStyle = `rgba(255,105,180,${0.1 + holdPulse * 0.08})`;
        ctx.lineWidth = w * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, tipY + 4);
        ctx.lineTo(x, floorY);
        ctx.stroke();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, tipY);
        ctx.bezierCurveTo(x + w * 0.3, tipY + hgt * 0.045, x + w * 0.5, tipY + hgt * 0.1, x + w * 0.5, tipY + hgt * 0.14);
        ctx.lineTo(x + w * 0.5, floorY + 2);
        ctx.lineTo(x - w * 0.42, floorY + 2);
        ctx.lineTo(x - w * 0.42, tipY + hgt * 0.16);
        ctx.bezierCurveTo(x - w * 0.42, tipY + hgt * 0.09, x - w * 0.22, tipY + hgt * 0.035, x, tipY);
        ctx.closePath();
        ctx.fill();
        // the cutting edge, pink rim-light
        ctx.strokeStyle = `rgba(255,20,147,${0.3 + holdPulse * 0.35})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, tipY);
        ctx.bezierCurveTo(x + w * 0.3, tipY + hgt * 0.045, x + w * 0.5, tipY + hgt * 0.1, x + w * 0.5, tipY + hgt * 0.14);
        ctx.lineTo(x + w * 0.5, floorY);
        ctx.stroke();
      }
      ctx.restore();

      /* ── III: the shattering ── */
      if (!scatterFired && ct >= T_SCATTER) {
        scatterFired = true;
        shakeMag = 11;
        flash = 0.85;
        const want = Math.round(Math.min(650, Math.max(380, (W * H) / 460)));
        while (petals.length < want) petals.push({ alive: false } as Petal);
        let idx = 0;
        const per = Math.floor(want / blades.length);
        for (const b of blades) {
          b.shattered = true;
          const x = bladeX(b.off);
          const hgt = H * b.hFrac;
          for (let i = 0; i < per && idx < want; i++) {
            const f = Math.random();
            const halfW = (bladeW(b.w) / 2) * (0.3 + 0.7 * Math.min(f * 4, 1));
            ignitePetal(petals[idx++], x + rand(-halfW, halfW), floorY - hgt + f * hgt, ax, ay);
          }
        }
        while (idx < want) ignitePetal(petals[idx++], ax + rand(-20, 20), rand(floorY * 0.3, floorY), ax, ay);
      }

      /* petals: tornado → domain drift → re-gather, one continuous system */
      if (scatterFired) {
        const swarm = 1 - easeOutCubic(clamp01((ct - T_SCATTER) / SWARM_DUR));
        const regather = clamp01((ct - T_REGATHER) / REGATHER_DUR);
        const additive = clamp01(1 - (ct - T_SCATTER) / 1.1);
        ctx.globalCompositeOperation = additive > 0.02 ? "lighter" : "source-over";
        const baseAlpha = (0.85 + 0.15 * additive) * (1 - easeInExpo(regather));
        // Once the regather seals (alpha 0), the remaining ~0.8s of the cycle
        // must not pay physics + a zero-alpha stamp per petal (review-caught:
        // ~36k no-op draws per cycle at the 650 cap).
        if (baseAlpha <= 0.002) {
          for (const p of petals) p.alive = false;
        }
        for (const p of petals) {
          if (!p.alive) continue;
          const dx = p.x - ax;
          const dy = (p.y - ay) / 0.72;
          const r = Math.hypot(dx, dy) || 1;
          const ang = Math.atan2(dy, dx);
          if (swarm > 0) {
            const spring = (p.orbitR - r) * 3.0;
            const tangential = p.dir * (180 + 300 * (1 - Math.min(r / (Math.max(W, H) * 0.5), 1)));
            p.vx += ((Math.cos(ang) * spring - Math.sin(ang) * tangential) * swarm
              + Math.sin(p.y * 0.02 + ct * 5.3 + p.seed) * 130 * swarm) * dt;
            p.vy += ((Math.sin(ang) * spring + Math.cos(ang) * tangential) * swarm * 0.72
              + Math.cos(p.x * 0.017 - ct * 4.1 + p.seed) * 110 * swarm) * dt;
          }
          const drift = 1 - swarm;
          if (drift > 0 && regather < 1) {
            const fx = 14 * Math.sin(p.y * 0.008 + ct * 0.55 + p.seed)
              + 9 * Math.cos(p.x * 0.007 - ct * 0.33) + 10;
            const fy = 8 * Math.cos(p.x * 0.009 + ct * 0.42 + p.seed)
              + 5 * Math.sin(ct * 0.8 + p.seed) + 7;
            p.vx += (fx - p.vx) * Math.min(1, dt * (0.6 + drift * 1.4));
            p.vy += (fy - p.vy) * Math.min(1, dt * (0.6 + drift * 1.4));
          }
          if (regather > 0) {
            // the release ends where it began: petals spiral back into the floor
            const gx = ax - p.x;
            const gy = floorY - p.y;
            const pull = 3.2 * regather * regather;
            p.vx += (gx * pull - gy * 1.6 * regather * p.dir) * dt;
            p.vy += (gy * pull + gx * 1.6 * regather * p.dir) * dt;
          }
          const drag = Math.pow(0.9, dt * 60 * (0.3 + 0.7 * Math.max(swarm, regather)));
          p.vx *= drag; p.vy *= drag;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.rotV * (0.3 + Math.max(swarm, regather)) * dt;
          if (drift > 0.5 && regather === 0) {
            if (p.x < -22) p.x = W + 20;
            if (p.x > W + 22) p.x = -20;
            if (p.y > H + 22) { p.y = -20; p.x = rand(0, W); }
            if (p.y < -30) p.y = H + 20;
          }
          const flip = 0.32 + 0.68 * Math.abs(Math.sin(ct * p.flutterF + p.seed));
          const c = Math.cos(p.rot), s = Math.sin(p.rot);
          const sx = p.scale, sy = p.scale * flip;
          ctx.setTransform(DPR * c * sx, DPR * s * sx, -DPR * s * sy, DPR * c * sy, DPR * p.x, DPR * p.y);
          ctx.globalAlpha = baseAlpha;
          ctx.drawImage(p.sprite, -p.sprite.width / 2, -p.sprite.height / 2);
        }
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        // the vanishing point glows as the petals seal back in
        if (regather > 0.15) {
          ctx.globalCompositeOperation = "lighter";
          const gs = 30 + 40 * regather;
          ctx.globalAlpha = 0.55 * Math.sin(Math.min(regather, 1) * Math.PI);
          ctx.drawImage(glowSprite, ax - gs / 2, floorY - gs / 2, gs, gs);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }

      /* shock rings — LAST, after every light pass. The void ring punches
         transparency with destination-out, which can only erase what is
         already painted: drawn early it ran before the pillar and flash
         existed and erased almost nothing (review-caught near-no-op). Here it
         carves through the full frame's light, so the inverted wave actually
         reads at the moment of impact. The flash paints first — it is the
         brightest thing the void gets to carve. */
      if (flash > 0.01) {
        flash = Math.max(0, flash - dt * 2.6);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(ax, floorY, 0, ax, floorY, Math.max(W, H));
        g.addColorStop(0, `rgba(255,255,255,${flash})`);
        g.addColorStop(0.35, `rgba(255,105,180,${flash * 0.45})`);
        g.addColorStop(1, "rgba(255,20,147,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      for (const ring of rings) {
        const p = clamp01((ct - ring.born) / ring.dur);
        if (p >= 1) continue;
        const r = ring.maxR * easeOutExpo(p);
        ctx.save();
        if (ring.neg) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - p)})`;
        }
        ctx.lineWidth = ring.wide * (1 - p) + 1.5;
        ctx.beginPath();
        ctx.arc(ax, floorY, Math.max(r, 1), 0, TAU);
        ctx.stroke();
        if (!ring.neg) {
          // wide faint pink echo instead of shadowBlur
          ctx.strokeStyle = `rgba(255,105,180,${0.3 * (1 - p)})`;
          ctx.lineWidth = ring.wide * 2.4 * (1 - p) + 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const detach = attachVisibilityPause(canvas, {
      onPause: () => {
        paused = true;
        cancelAnimationFrame(raf);
        // never leave the card frozen mid-shake
        canvas.style.transform = "";
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
      canvas.style.transform = "";
    };
  }, [canvasRef]);
}

// ── Card-level: the release ─────────────────────────────────────────────────

export function BankaiCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useBankaiCanvas(canvasRef);

  return (
    <>
      {/* the crushing dark of a spiritual domain, behind the card's text */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(4,3,7,0.85), rgba(3,2,6,0.6) 55%, rgba(2,2,5,0.45) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 30%, rgba(255,20,147,0.08), transparent 66%)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* drop · pillar · forest · scatter · domain — pure light at z-30 */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the wielder's mark ────────────────────────────────────────

export function BankaiAvatarMark() {
  // Register so the release erupts beneath THIS avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    BANKAI_ANCHORS.add(el);
    return () => {
      BANKAI_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* steel silver → sakura pink, breathing on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(4,3,7,0.9), 0 0 28px 9px rgba(255,105,180,0.45)",
            "0 0 16px 5px rgba(4,3,7,0.95), 0 0 42px 13px rgba(205,214,228,0.4)",
            "0 0 13px 4px rgba(4,3,7,0.9), 0 0 32px 10px rgba(255,20,147,0.45)",
            "0 0 12px 3px rgba(4,3,7,0.9), 0 0 28px 9px rgba(255,105,180,0.45)",
          ],
        }}
        transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* a crescent of scattered light orbiting the rim — the blade that is
          no longer a blade. Conic gradient carries color through ~110°, the
          radial mask carves it to a thin ring. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[8%] z-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,105,180,0) 0deg, rgba(255,105,180,0.85) 28deg, #ffffff 58deg, rgba(255,20,147,0.9) 88deg, rgba(255,157,204,0) 110deg, transparent 360deg)",
          filter: "blur(2px)",
          // rotate + filter on one layer = the Android smear stack;
          // will-change pins it to its own composited layer (documented cure)
          willChange: "transform",
          WebkitMaskImage: "radial-gradient(circle, transparent 56%, #000 68%)",
          maskImage: "radial-gradient(circle, transparent 56%, #000 68%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />

      {/* two stray petals shed off the rim, falling and fading each cycle */}
      {[
        { left: "26%", delay: 1.1, dur: 6.2, drift: "14%" },
        { left: "62%", delay: 3.8, dur: 7.4, drift: "-12%" },
      ].map((d, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute z-[1] h-[7%] w-[5%]"
          style={{
            left: d.left,
            background: "radial-gradient(ellipse at 50% 30%, #ffc4e1, #ff69b4 70%)",
            borderRadius: "80% 20% 60% 40% / 60% 40% 60% 40%",
            boxShadow: "0 0 6px rgba(255,105,180,0.7)",
          }}
          initial={{ top: "78%", opacity: 0 }}
          animate={{
            top: ["78%", "88%", "104%", "108%"],
            x: ["0%", d.drift, d.drift, d.drift],
            opacity: [0, 0.95, 0.75, 0],
            rotate: [0, 140, 320, 320],
          }}
          transition={{
            duration: d.dur,
            times: [0, 0.18, 0.55, 0.66],
            repeat: Infinity,
            delay: d.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </>
  );
}
