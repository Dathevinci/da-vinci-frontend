"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";
import { attachVisibilityPause } from "@/components/profile/pauseWhenUnseen";

/**
 * THE GRAND LINE — SSS profile effect. One continuous cinematic, no phases
 * (and therefore none of the phase-window state machinery that has needed
 * review-caught fixes twice): a four-layer trigonometric ocean rolls across
 * the card's lower reach while a mahogany galleon rides it on REAL buoyancy —
 * the hull reads the exact analytic height AND slope of the surface under its
 * keel every frame (the derivative is verified against the numeric central
 * difference in the prototype; canvas y grows DOWN, so a crest is where the
 * slope crosses negative→positive). It climbs swells, pitches over crests at
 * a keel-and-ballast-geared angle, and throws bow-spray when it crashes
 * downward. Above: sunset glow, gulls, wind streaks, a sun-glitter road; the
 * avatar wears the bounty treatment (gold god-rays + orbiting ฿ marks live in
 * the DOM layer, canvas keeps the sea).
 *
 * Rendering: TWO canvases (the OuterGod treatment). The SEA and the SHIP are
 * mid-dark inks — navy water, mahogany hull — so they render at z-[8] UNDER
 * the card's z-10 text; only light rides the z-[30] screen-blend canvas
 * (sun glow, glitter road, foam, splash, gulls, speed lines, god-rays). NO
 * shadowBlur/filter anywhere in the loop; all clocks are accumulated-t so the
 * visibility pause shifts nothing.
 */

// The avatar registers here; the bounty light centers on THIS card's avatar.
const GL_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

type LayerT = {
  base: number; speed: number; p: number;
  amp1: number; k1: number; amp2: number; k2: number; amp3: number; k3: number;
};
type GullT = { x: number; y: number; s: number; v: number; f: number; ph: number };
type StreakT = { x: number; y: number; len: number; v: number; a: number };
type SplashT = { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number; cyan: boolean };

function makeLayer(d: number): LayerT {
  return {
    base: 0.1 + d * 0.2,             // fraction of the sea band below horizon
    speed: 0.35 + d * 0.5,
    p: d * 1.7,
    amp1: 4 + d * 5,                 // card-scale amplitudes
    k1: 0.012 - d * 0.0016,
    amp2: 2.5 + d * 3,
    k2: 0.026 + d * 0.004,
    amp3: 1.5 + d * 2,
    k3: 0.048 - d * 0.006,
  };
}

function useGrandLineCanvases(
  seaRef: RefObject<HTMLCanvasElement | null>,
  glowRef: RefObject<HTMLCanvasElement | null>
) {
  useEffect(() => {
    const sea = seaRef.current;
    const glow = glowRef.current;
    if (!sea || !glow) return;
    const sctx = sea.getContext("2d");
    const gctx = glow.getContext("2d");
    if (!sctx || !gctx) return;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    /**
     * DECLARED BEFORE resize(), WHICH RUNS IMMEDIATELY BELOW IT. The resize
     * re-seed touches these, and the first call always takes the changed-size
     * branch (W/H start 0) — declaring them any later is a temporal-dead-zone
     * ReferenceError on mount, the exact crash the Portal effect shipped
     * once. Order is load-bearing.
     */
    let splash: SplashT[] = [];
    let splashClock = 0;
    let shipY = 0;
    let shipTilt = 0;
    const resize = () => {
      // Sized to the profile CARD — the voyage scrolls with it.
      const prevW = W, prevH = H;
      W = Math.max(1, glow.clientWidth || glow.parentElement?.clientWidth || window.innerWidth);
      H = Math.max(1, glow.clientHeight || glow.parentElement?.clientHeight || 420);
      if (W !== prevW || H !== prevH) {
        // The waterline moved with H; letting the smoothed hull glide there
        // reads as motion and fired a phantom bow-splash (review-caught).
        // Re-seeding lets the first-frame guard snap it, and stranded spray
        // is cleared rather than left hanging at stale coordinates.
        shipY = 0;
        shipTilt = 0;
        splash = [];
        splashClock = 0.35;
      }
      for (const c of [sea, glow]) {
        c.width = Math.max(1, Math.round(W * DPR));
        c.height = Math.max(1, Math.round(H * DPR));
      }
      sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(glow);

    const layers = [makeLayer(0), makeLayer(1), makeLayer(2), makeLayer(3)];
    const horizonY = () => H * 0.62;
    const layerBaseY = (L: LayerT) => horizonY() + L.base * (H - horizonY());
    const waveY = (L: LayerT, x: number, t: number) =>
      layerBaseY(L)
      - L.amp1 * Math.sin(L.k1 * x + t * L.speed + L.p)
      - L.amp2 * Math.sin(L.k2 * x - t * L.speed * 1.4 + L.p * 2)
      - L.amp3 * Math.sin(L.k3 * x + t * L.speed * 2.2 + L.p * 3);
    /* exact dy/dx — the time terms never touch the x-derivative */
    const waveSlope = (L: LayerT, x: number, t: number) =>
      -L.amp1 * L.k1 * Math.cos(L.k1 * x + t * L.speed + L.p)
      - L.amp2 * L.k2 * Math.cos(L.k2 * x - t * L.speed * 1.4 + L.p * 2)
      - L.amp3 * L.k3 * Math.cos(L.k3 * x + t * L.speed * 2.2 + L.p * 3);

    /* ── continuous actors (positional respawns only — no timer clocks, so
          no absorbing states are possible) ── */
    const gulls: GullT[] = Array.from({ length: 4 }, (_, i) => ({
      x: rand(0, 1), y: rand(0.12, 0.5), s: rand(4, 8),
      v: rand(0.014, 0.032), f: rand(4, 7), ph: i * 1.7,
    }));
    const streaks: StreakT[] = Array.from({ length: 6 }, () => ({
      x: rand(0, 1.2), y: rand(0.06, 0.5), len: rand(0.06, 0.18),
      v: rand(0.5, 1.0), a: rand(0.08, 0.22),
    }));
    let raf = 0;
    let paused = false;
    let last = performance.now();
    let t = 0;                        // accumulated — pause-safe by construction

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      // bounty light centers on THIS card's avatar
      const host = glow.parentElement;
      const cRect = (host || glow).getBoundingClientRect();
      let ax = W * 0.28;
      let ay = H * 0.3;
      let aR = 40;
      let best = 0;
      GL_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });

      sctx.clearRect(0, 0, W, H);
      gctx.clearRect(0, 0, W, H);
      const HOR = horizonY();

      /* ── glow: sunset + sun halo + wind + gulls (light only) ── */
      const sunX = W * 0.82, sunY = HOR * 0.9;
      const sun = gctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, HOR * 0.55);
      sun.addColorStop(0, "rgba(255,238,170,0.5)");
      sun.addColorStop(0.16, "rgba(255,196,90,0.3)");
      sun.addColorStop(0.55, "rgba(255,150,60,0.1)");
      sun.addColorStop(1, "rgba(255,150,60,0)");
      gctx.fillStyle = sun;
      /* to H, not to the horizon: on the screen-blend canvas nothing ever
         paints over this, and cutting the fill mid-gradient left a visible
         warm seam across the water (review-caught; the prototype's opaque
         sea used to hide it) */
      gctx.fillRect(0, 0, W, H);

      for (const s of streaks) {
        s.x -= s.v * dt;
        if (s.x + s.len < -0.05) {
          s.x = 1.15; s.y = rand(0.06, 0.5); s.len = rand(0.06, 0.18);
          s.v = rand(0.5, 1.0); s.a = rand(0.08, 0.22);
        }
        const y = s.y * HOR;
        const g = gctx.createLinearGradient(s.x * W, 0, (s.x + s.len) * W, 0);
        g.addColorStop(0, "rgba(255,240,210,0)");
        g.addColorStop(0.5, `rgba(255,240,210,${s.a})`);
        g.addColorStop(1, "rgba(255,240,210,0)");
        gctx.fillStyle = g;
        gctx.fillRect(s.x * W, y, s.len * W, 1.3);
      }

      gctx.strokeStyle = "rgba(255,250,240,0.8)";
      gctx.lineWidth = 1.4;
      gctx.lineCap = "round";
      for (const gl of gulls) {
        gl.x -= gl.v * dt;
        if (gl.x < -0.06) { gl.x = 1.06; gl.y = rand(0.12, 0.5); }
        const x = gl.x * W;
        const y = gl.y * HOR + Math.sin(t * 0.8 + gl.ph) * 5;
        const flap = Math.sin(t * gl.f + gl.ph) * gl.s * 0.55;
        gctx.beginPath();
        gctx.moveTo(x - gl.s, y - flap * 0.6);
        gctx.quadraticCurveTo(x - gl.s * 0.4, y + flap * 0.5, x, y);
        gctx.quadraticCurveTo(x + gl.s * 0.4, y + flap * 0.5, x + gl.s, y - flap * 0.6);
        gctx.stroke();
      }

      /* ── sea canvas: layered water + the galleon, under the card's text ── */
      const drawLayer = (L: LayerT, top: string, bottom: string) => {
        const g = sctx.createLinearGradient(0, layerBaseY(L) - 24, 0, H);
        g.addColorStop(0, top);
        g.addColorStop(1, bottom);
        sctx.globalAlpha = 1;
        sctx.fillStyle = g;
        sctx.beginPath();
        sctx.moveTo(-4, waveY(L, -4, t));
        for (let x = 0; x <= W + 4; x += 7) sctx.lineTo(x, waveY(L, x, t));
        sctx.lineTo(W + 4, H + 4);
        sctx.lineTo(-4, H + 4);
        sctx.closePath();
        sctx.fill();
      };

      drawLayer(layers[0], "rgba(22,48,92,0.8)", "rgba(12,28,56,0.9)");
      drawLayer(layers[1], "rgba(28,74,124,0.85)", "rgba(16,39,72,0.92)");

      /* the galleon rides layer 2 */
      const scl = Math.max(0.42, Math.min(W / 900, 0.85));
      const shipX = W * 0.55 + Math.sin(t * 0.11) * W * 0.04;
      const L2 = layers[2];
      const targetY = waveY(L2, shipX, t);
      const prevY = shipY || targetY;
      shipY = lerp(prevY, targetY, Math.min(1, dt * 3.4));
      shipTilt = lerp(shipTilt, Math.atan(waveSlope(L2, shipX, t)) * 0.6, Math.min(1, dt * 2.8));
      const vy = (shipY - prevY) / Math.max(dt, 1e-4);

      splashClock -= dt;
      if (vy > 7 && splashClock <= 0) {
        splashClock = 0.3;
        const bowX = shipX + Math.cos(shipTilt) * 150 * scl;
        const bowY = shipY + Math.sin(shipTilt) * 150 * scl;
        for (let i = 0; i < 12; i++) {
          splash.push({
            x: bowX + rand(-6, 10) * scl, y: bowY + rand(-3, 4) * scl,
            vx: rand(25, 130) * scl, vy: rand(-150, -50) * scl,
            r: rand(1, 2.8) * scl, life: rand(0.4, 0.85), age: 0,
            cyan: Math.random() < 0.4,
          });
        }
      }

      sctx.save();
      sctx.translate(shipX, shipY + 4 * scl);
      sctx.rotate(shipTilt);
      sctx.scale(scl, scl);

      const hullG = sctx.createLinearGradient(0, -30, 0, 55);
      hullG.addColorStop(0, "#8b5a2b");
      hullG.addColorStop(0.45, "#5a3420");
      hullG.addColorStop(1, "#2e1a0e");
      sctx.fillStyle = hullG;
      sctx.beginPath();
      sctx.moveTo(-165, -38);
      sctx.bezierCurveTo(-150, -8, -158, 8, -148, 22);
      sctx.bezierCurveTo(-95, 52, 60, 54, 118, 30);
      sctx.bezierCurveTo(140, 20, 148, 6, 152, -12);
      sctx.lineTo(138, -16);
      sctx.bezierCurveTo(90, 6, -60, 8, -128, -14);
      sctx.bezierCurveTo(-138, -20, -146, -28, -165, -38);
      sctx.closePath();
      sctx.fill();
      sctx.strokeStyle = "rgba(30,16,8,0.55)";
      sctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        sctx.beginPath();
        sctx.moveTo(-150 + i * 6, 6 + i * 13);
        sctx.bezierCurveTo(-80, 26 + i * 12, 50, 28 + i * 12, 128 - i * 10, 8 + i * 9);
        sctx.stroke();
      }
      sctx.fillStyle = "rgba(20,10,5,0.85)";
      for (let i = 0; i < 4; i++) sctx.fillRect(-104 + i * 52, 12, 12, 9);
      sctx.strokeStyle = "#d4a017";
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(-140, -16);
      sctx.bezierCurveTo(-60, 6, 90, 4, 140, -15);
      sctx.stroke();

      /* golden lion figurehead */
      sctx.globalAlpha = 0.75;
      const goldG = sctx.createRadialGradient(158, -26, 2, 158, -26, 26);
      goldG.addColorStop(0, "#e6c455");
      goldG.addColorStop(0.55, "#c9a227");
      goldG.addColorStop(1, "#6b4f08");
      sctx.fillStyle = goldG;
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI * 0.75 + (i / 7) * Math.PI * 1.5;
        sctx.beginPath();
        sctx.ellipse(158 + Math.cos(a) * 13, -26 + Math.sin(a) * 13, 8.5, 4.5, a, 0, TAU);
        sctx.fill();
      }
      sctx.beginPath(); sctx.arc(158, -26, 11.5, 0, TAU); sctx.fill();
      sctx.beginPath(); sctx.ellipse(167, -22, 7, 5, 0.35, 0, TAU); sctx.fill();
      sctx.fillStyle = "#3d2214";
      sctx.beginPath(); sctx.arc(156, -29, 2, 0, TAU); sctx.fill();
      sctx.globalAlpha = 1;

      /* masts, yards, bowsprit */
      sctx.strokeStyle = "#3d2214";
      sctx.lineCap = "round";
      sctx.lineWidth = 7;
      sctx.beginPath(); sctx.moveTo(-12, -2); sctx.lineTo(-12, -196); sctx.stroke();
      sctx.lineWidth = 6;
      sctx.beginPath(); sctx.moveTo(-96, -8); sctx.lineTo(-96, -150); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(74, -4); sctx.lineTo(74, -140); sctx.stroke();
      sctx.lineWidth = 5;
      sctx.beginPath(); sctx.moveTo(128, -14); sctx.lineTo(190, -52); sctx.stroke();
      sctx.lineWidth = 4;
      sctx.beginPath(); sctx.moveTo(-70, -186); sctx.lineTo(46, -186); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(-64, -104); sctx.lineTo(40, -104); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(-140, -142); sctx.lineTo(-52, -142); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(30, -132); sctx.lineTo(118, -132); sctx.stroke();

      /* billowing sails */
      const billow = 1 + 0.1 * Math.sin(t * 1.9);
      const drawSail = (x1: number, yTop: number, x2: number, yBot: number, bulge: number) => {
        /* DUSK CANVAS, NOT PAPER-WHITE. These sails sit on the z-8 canvas
           UNDER the card's text, and opaque cream behind light text collapsed
           contrast to ~1.1:1 in the stats band (review-caught, judged against
           the OuterGod precedent: light ink under text only at partial
           alpha). Darker weave + 0.55 alpha lets the card read through. */
        sctx.globalAlpha = 0.55;
        const sailG = sctx.createLinearGradient(x1, yTop, x1, yBot);
        sailG.addColorStop(0, "#e3d6b8");
        sailG.addColorStop(0.6, "#c4b48e");
        sailG.addColorStop(1, "#9a8a66");
        sctx.fillStyle = sailG;
        sctx.beginPath();
        sctx.moveTo(x1, yTop);
        sctx.lineTo(x2, yTop);
        sctx.bezierCurveTo(x2 + bulge * billow, yTop + (yBot - yTop) * 0.3,
                           x2 + bulge * billow, yBot - (yBot - yTop) * 0.24, x2, yBot);
        sctx.lineTo(x1, yBot);
        sctx.bezierCurveTo(x1 + bulge * 0.72 * billow, yBot - (yBot - yTop) * 0.26,
                           x1 + bulge * 0.72 * billow, yTop + (yBot - yTop) * 0.3, x1, yTop);
        sctx.closePath();
        sctx.fill();
        sctx.strokeStyle = "rgba(90,70,45,0.5)";
        sctx.lineWidth = 1.6;
        sctx.stroke();
        sctx.globalAlpha = 1;
      };
      drawSail(-70, -186, 46, -108, 34);
      drawSail(-140, -142, -52, -78, 26);
      drawSail(30, -132, 118, -72, 24);

      /* the Jolly Roger */
      const jx = 0, jy = -150;
      sctx.strokeStyle = "#141210";
      sctx.lineWidth = 5.5;
      sctx.lineCap = "round";
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        sctx.beginPath();
        sctx.moveTo(jx - Math.cos(a) * 21, jy - Math.sin(a) * 21 + 4);
        sctx.lineTo(jx + Math.cos(a) * 21, jy + Math.sin(a) * 21 + 4);
        sctx.stroke();
      }
      sctx.fillStyle = "#141210";
      sctx.beginPath();
      sctx.arc(jx, jy, 12.5, Math.PI * 0.96, Math.PI * 0.04, false);
      sctx.closePath();
      sctx.fill();
      sctx.fillRect(jx - 7, jy + 6.5, 14, 7.5);
      sctx.fillStyle = "#efe6d2";
      sctx.beginPath(); sctx.arc(jx - 5, jy - 2.5, 3.4, 0, TAU); sctx.fill();
      sctx.beginPath(); sctx.arc(jx + 5, jy - 2.5, 3.4, 0, TAU); sctx.fill();
      sctx.beginPath();
      sctx.moveTo(jx, jy + 2); sctx.lineTo(jx - 2.4, jy + 6.4); sctx.lineTo(jx + 2.4, jy + 6.4);
      sctx.closePath(); sctx.fill();
      sctx.fillRect(jx - 5.4, jy + 8.5, 1.8, 5);
      sctx.fillRect(jx - 0.9, jy + 8.5, 1.8, 5);
      sctx.fillRect(jx + 3.6, jy + 8.5, 1.8, 5);

      /* pennant */
      sctx.fillStyle = "#141210";
      const flap = Math.sin(t * 7) * 7;
      sctx.beginPath();
      sctx.moveTo(-12, -196);
      sctx.quadraticCurveTo(28, -204 + flap * 0.4, 52, -196 + flap);
      sctx.quadraticCurveTo(30, -190 + flap * 0.5, -12, -184);
      sctx.closePath();
      sctx.fill();

      sctx.restore();

      drawLayer(layers[2], "rgba(31,111,158,0.85)", "rgba(18,58,94,0.92)");
      drawLayer(layers[3], "rgba(43,163,201,0.8)", "rgba(21,83,119,0.9)");

      /* ── glow: foam on true crests, splash, glitter road, god-rays ── */
      gctx.lineCap = "round";
      for (const [L, alpha] of [[layers[2], 0.4], [layers[3], 0.65]] as const) {
        gctx.strokeStyle = `rgba(240,255,255,${alpha})`;
        gctx.lineWidth = 1.8;
        for (let x = 12; x <= W - 12; x += 10) {
          const s1 = waveSlope(L, x - 5, t);
          const s2 = waveSlope(L, x + 5, t);
          /* canvas y grows DOWN: crest = slope crossing negative → positive */
          if (s1 < -0.02 && s2 > 0.02) {
            const y = waveY(L, x, t);
            const curl = 4 + 3 * Math.sin(t * 3 + x);
            gctx.beginPath();
            gctx.moveTo(x - curl * 1.4, y + 2);
            gctx.quadraticCurveTo(x - curl * 0.3, y - curl, x + curl * 0.8, y - curl * 0.35);
            gctx.quadraticCurveTo(x + curl * 0.3, y + 1, x + curl * 1.1, y + 2.5);
            gctx.stroke();
          }
        }
      }

      for (const p of splash) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 380 * dt;
        const f = 1 - p.age / p.life;
        if (f <= 0) continue;
        gctx.fillStyle = p.cyan
          ? `rgba(110,235,255,${0.8 * f})`
          : `rgba(245,252,255,${0.85 * f})`;
        gctx.beginPath();
        gctx.arc(p.x, p.y, p.r * (0.6 + 0.4 * f), 0, TAU);
        gctx.fill();
      }
      splash = splash.filter((p) => p.age < p.life);

      /* sun-glitter road */
      gctx.save();
      gctx.globalCompositeOperation = "lighter";
      for (let y = HOR + 8; y < H; y += 18) {
        const w = 16 + (y - HOR) * 0.5;
        const gx = sunX + Math.sin(y * 0.13 + t * 2.2) * w * 0.35;
        const a = Math.max(0, 0.12 - (y - HOR) / (H - HOR) * 0.1);
        gctx.fillStyle = `rgba(255,214,120,${a})`;
        gctx.fillRect(gx - w / 2, y, w, 1.8);
      }
      /* bounty god-rays sweeping slowly from the avatar */
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.12;
        const rayA = 0.035 + 0.02 * Math.sin(t * 0.9 + i * 2.2);
        gctx.fillStyle = `rgba(255,214,130,${rayA})`;
        gctx.beginPath();
        gctx.moveTo(ax + Math.cos(a - 0.045) * (aR + 4), ay + Math.sin(a - 0.045) * (aR + 4));
        gctx.lineTo(ax + Math.cos(a) * aR * 3.6, ay + Math.sin(a) * aR * 3.6);
        gctx.lineTo(ax + Math.cos(a + 0.045) * (aR + 4), ay + Math.sin(a + 0.045) * (aR + 4));
        gctx.closePath();
        gctx.fill();
      }
      gctx.restore();

      if (!paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const detach = attachVisibilityPause(glow, {
      onPause: () => {
        paused = true;
        cancelAnimationFrame(raf);
      },
      onResume: () => {
        paused = false;
        // accumulated t — nothing to shift, just re-arm dt
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
    });

    return () => {
      detach();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, [seaRef, glowRef]);
}

// ── Card-level: the voyage ──────────────────────────────────────────────────

export function GrandLineCardDomain() {
  const seaRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  useGrandLineCanvases(seaRef, glowRef);

  return (
    <>
      {/* golden-hour wash behind everything */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(28,44,84,0.55), rgba(79,74,122,0.4) 38%, rgba(201,111,53,0.35) 58%, rgba(255,179,71,0.3) 66%, rgba(10,21,38,0.5) 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.92] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      {/* the sea and the galleon — UNDER the card's z-10 text */}
      <canvas
        ref={seaRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
      />
      {/* sun, foam, spray, gulls, wind, god-rays — pure light on top */}
      <canvas
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the bounty poster ─────────────────────────────────────────

export function GrandLineAvatarMark() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    GL_ANCHORS.add(el);
    return () => {
      GL_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* warm bounty glow breathing */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 20px 4px rgba(255,183,71,0.4), 0 0 44px 10px rgba(255,140,0,0.18)",
            "0 0 30px 7px rgba(255,215,0,0.5), 0 0 66px 16px rgba(255,140,0,0.26)",
            "0 0 20px 4px rgba(255,183,71,0.4), 0 0 44px 10px rgba(255,140,0,0.18)",
          ],
        }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* torn parchment ring — dashed double border reads as distressed edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-[7%] z-0 rounded-full border-[3px] border-dashed border-amber-200/70"
        style={{ boxShadow: "inset 0 0 10px rgba(122,84,32,0.6), 0 0 8px rgba(233,196,124,0.4)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-[2%] z-0 rounded-full border border-amber-700/60"
      />

      {/* two golden Berri marks orbiting the poster */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-[16%] z-[1]"
        style={{ willChange: "transform" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
      >
        {/* SVG text scales with its viewBox — a CSS font-size percentage
            resolves against the PARENT's font (16px), which rendered these
            as ~2px specks (review-caught). */}
        <svg
          viewBox="0 0 24 28"
          className="absolute left-1/2 top-0 h-[16%] w-auto -translate-x-1/2"
          aria-hidden
        >
          <circle cx="12" cy="14" r="11" fill="rgba(255,215,0,0.16)" />
          <text
            x="12" y="21"
            textAnchor="middle"
            fontSize="20"
            fontWeight="900"
            fill="#fcd34d"
          >
            ฿
          </text>
        </svg>
        <svg
          viewBox="0 0 24 28"
          className="absolute bottom-0 left-1/2 h-[12%] w-auto -translate-x-1/2"
          aria-hidden
        >
          <circle cx="12" cy="14" r="11" fill="rgba(255,215,0,0.14)" />
          <text
            x="12" y="21"
            textAnchor="middle"
            fontSize="20"
            fontWeight="900"
            fill="#fde68a"
          >
            ฿
          </text>
        </svg>
      </motion.span>
    </>
  );
}
