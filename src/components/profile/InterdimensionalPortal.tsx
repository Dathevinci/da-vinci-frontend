"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";
import { attachVisibilityPause } from "@/components/profile/pauseWhenUnseen";

/**
 * DIMENSION C-137 — SSS profile effect. An interdimensional portal tears open
 * behind the avatar, in four systems:
 *
 *   THE SINGULARITY — the swirling portal itself: layered rotating fluid
 *              discs plus three Archimedean spiral arms of churning acid
 *              particles, their radius wobbled by erratic sines so the rim
 *              bubbles and spits rather than sitting as a flat circle.
 *   TOXIC SPIT — slime drops with real ballistics: flung from the rim with
 *              outward velocity, pulled down by gravity, stretched into
 *              teardrops along their velocity vector as they fall.
 *   MULTIVERSE GARBAGE — magenta triangles, jagged cyan rocks and red
 *              squiggles tumble out of the portal and drift across the card,
 *              spinning on their own axes.
 *   REALITY GLITCH — every 5–8 seconds the card's reality breaks for 0.2s:
 *              the canvas is sliced into horizontal bands and shoved
 *              sideways, two offset ghost passes fake chromatic aberration,
 *              and the canvas itself shakes.
 *
 * Rendering: everything here is bright light on dark, so it takes the single
 * z-[30] screen-blend canvas (the Gateway/Hollow/WebSlinger treatment) — it
 * can only brighten, so it rides over the card's text without hiding a word.
 * The dark "vacuum" comes from z-[6] wash spans behind the text. NO
 * shadowBlur anywhere in the loop (house rule): all glow is pre-rendered
 * radial-gradient sprites stamped with the 'lighter' composite.
 *
 * The glitch runs on an ABSOLUTE clock (nextGlitch), so onResume shifts it by
 * the parked span — otherwise reality would tear the instant the card
 * scrolled back into view (the MahoragaWheel lesson).
 */

// The avatar registers here; the portal opens behind THIS card's avatar.
const PORTAL_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Spit = {
  x: number; y: number; vx: number; vy: number;
  life: number; ttl: number; size: number;
};
type Junk = {
  kind: 0 | 1 | 2; // triangle | rock | squiggle
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; size: number; life: number; ttl: number;
};

function usePortalCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
      // The glitch snapshot buffer must track the same size.
      snap.width = canvas.width;
      snap.height = canvas.height;
    };
    const snap = document.createElement("canvas");
    const snapCtx = snap.getContext("2d")!;
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);

    // ── glow sprites — radial gradients baked once, stamped with 'lighter' ──
    const makeSprite = (inner: string, mid: string, edge = "rgba(0,0,0,0)") => {
      const s = 64;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.45, mid);
      grad.addColorStop(1, edge);
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const acid = makeSprite("rgba(235,255,200,0.95)", "rgba(57,255,20,0.5)");
    const lime = makeSprite("rgba(217,249,157,0.9)", "rgba(163,230,53,0.42)");
    const cyanDot = makeSprite("rgba(207,250,254,0.9)", "rgba(34,211,238,0.4)");
    const magentaDot = makeSprite("rgba(250,232,255,0.9)", "rgba(232,121,249,0.4)");

    // ── state ──
    const spits: Spit[] = [];
    const junks: Junk[] = [];
    let raf = 0;
    let paused = false;
    let last = performance.now();
    let t = 0;
    // ABSOLUTE clocks — both must be shifted by the parked span on resume.
    let nextGlitch = performance.now() + rand(5000, 8000);
    let glitchStart = 0; // 0 = not glitching
    // per-glitch band layout, rebuilt when a glitch begins
    let bands: { y: number; h: number; dx: number }[] = [];

    const spawnSpit = (ax: number, ay: number, aR: number) => {
      const ang = rand(0, TAU);
      const sp = rand(120, 260);
      spits.push({
        x: ax + Math.cos(ang) * aR,
        y: ay + Math.sin(ang) * aR,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - rand(30, 90),
        life: 0,
        ttl: rand(1.4, 2.6),
        size: rand(2.5, 5.5),
      });
    };
    const spawnJunk = (ax: number, ay: number, aR: number) => {
      const ang = rand(0, TAU);
      junks.push({
        kind: (Math.floor(rand(0, 3)) % 3) as 0 | 1 | 2,
        x: ax + Math.cos(ang) * aR * 0.7,
        y: ay + Math.sin(ang) * aR * 0.7,
        vx: Math.cos(ang) * rand(14, 38),
        vy: Math.sin(ang) * rand(10, 26),
        rot: rand(0, TAU),
        vr: rand(-2.2, 2.2),
        size: rand(7, 16),
        life: 0,
        ttl: rand(6, 11),
      });
    };

    const drawJunk = (j: Junk, alpha: number) => {
      ctx.save();
      ctx.translate(j.x, j.y);
      ctx.rotate(j.rot);
      ctx.globalAlpha = alpha;
      if (j.kind === 0) {
        // magenta triangle
        ctx.strokeStyle = "rgba(232,121,249,0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -j.size);
        ctx.lineTo(j.size * 0.87, j.size * 0.5);
        ctx.lineTo(-j.size * 0.87, j.size * 0.5);
        ctx.closePath();
        ctx.stroke();
      } else if (j.kind === 1) {
        // jagged cyan rock
        ctx.strokeStyle = "rgba(34,211,238,0.85)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU;
          const r = j.size * (0.55 + 0.45 * ((k * 37) % 5) / 5);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        // glowing red squiggle
        ctx.strokeStyle = "rgba(248,113,113,0.85)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-j.size, 0);
        ctx.bezierCurveTo(-j.size * 0.4, -j.size, j.size * 0.4, j.size, j.size, 0);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      // avatar epicenter — ONLY anchors inside THIS canvas's card
      const cRect = canvas.getBoundingClientRect();
      const host = canvas.parentElement;
      let ax = W * 0.5;
      let ay = H * 0.35;
      let aR = 60;
      let best = 0;
      PORTAL_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });
      const pR = aR * 2.1; // the portal's outer radius

      ctx.clearRect(0, 0, W, H);

      // ── THE SINGULARITY ── layered fluid discs + spiral arms, all additive
      ctx.globalCompositeOperation = "lighter";

      // breathing fluid discs behind the avatar
      for (let d = 0; d < 3; d++) {
        const wob = 1 + 0.06 * Math.sin(t * (2.1 + d * 0.8) + d * 2.4);
        const r = pR * (1.05 - d * 0.22) * wob;
        const g = ctx.createRadialGradient(ax, ay, r * 0.25, ax, ay, r);
        g.addColorStop(0, d === 2 ? "rgba(217,249,157,0.10)" : "rgba(57,255,20,0.10)");
        g.addColorStop(0.72, d === 1 ? "rgba(163,230,53,0.16)" : "rgba(57,255,20,0.13)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, TAU);
        ctx.fill();
      }

      // three spiral arms of churning acid — Archimedean r = base + b·θ,
      // rim wobbled by erratic sines so the edge bubbles and spits
      for (let arm = 0; arm < 3; arm++) {
        const dir = arm % 2 === 0 ? 1 : -1;
        const speed = 0.9 + arm * 0.35;
        for (let i = 0; i < 24; i++) {
          const p = i / 24;
          const theta = p * TAU * 1.6 + t * speed * dir + arm * (TAU / 3);
          const churn = 1 + 0.13 * Math.sin(t * 5.2 + i * 1.7 + arm * 3.1);
          const r = (pR * 0.28 + p * pR * 0.78) * churn;
          const x = ax + Math.cos(theta) * r;
          const y = ay + Math.sin(theta) * r;
          const s = (1 - p * 0.55) * (7 + aR * 0.05) * (i % 3 === 0 ? 1.5 : 1);
          const sprite = i % 4 === 3 ? lime : acid;
          ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        }
      }

      // rim bubbles — the boiling edge
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + t * 0.7;
        const boil = pR * (1 + 0.1 * Math.sin(t * 6.5 + i * 2.3));
        const x = ax + Math.cos(a) * boil;
        const y = ay + Math.sin(a) * boil;
        const s = 5 + 4 * Math.abs(Math.sin(t * 3.7 + i));
        ctx.drawImage(acid, x - s / 2, y - s / 2, s, s);
      }

      // ── TOXIC SPIT ── ballistic slime, stretched along its velocity
      if (spits.length < 22 && Math.random() < 0.5) spawnSpit(ax, ay, pR * 0.95);
      for (let i = spits.length - 1; i >= 0; i--) {
        const s = spits[i];
        s.life += dt;
        if (s.life > s.ttl || s.y > H + 30) { spits.splice(i, 1); continue; }
        s.vy += 340 * dt; // heavy gravity
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const sp2 = Math.hypot(s.vx, s.vy);
        const stretch = 1 + Math.min(sp2 / 240, 2.2);
        const fade = Math.min(1, (s.ttl - s.life) / 0.5);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.globalAlpha = 0.85 * fade;
        // glow pass then a bright teardrop core
        ctx.drawImage(acid, -s.size * 2.2, -s.size * 2.2, s.size * 4.4, s.size * 4.4);
        ctx.fillStyle = "rgba(190,255,120,0.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, s.size * stretch, s.size * 0.62, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // ── MULTIVERSE GARBAGE ── tumbling debris
      if (junks.length < 7 && Math.random() < 0.02) spawnJunk(ax, ay, pR);
      for (let i = junks.length - 1; i >= 0; i--) {
        const j = junks[i];
        j.life += dt;
        if (j.life > j.ttl) { junks.splice(i, 1); continue; }
        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.rot += j.vr * dt;
        const a = Math.min(j.life / 0.8, 1) * Math.min((j.ttl - j.life) / 1.2, 1);
        drawJunk(j, a * 0.9);
      }

      // stray ambience — a few cyan/magenta motes drifting through the dark
      for (let i = 0; i < 8; i++) {
        const mx = ((i * 137 + t * (6 + i)) % (W + 40)) - 20;
        const my = (i * 61) % H + Math.sin(t * 0.8 + i) * 14;
        const s = 3 + (i % 3);
        ctx.drawImage(i % 2 ? cyanDot : magentaDot, mx - s / 2, my - s / 2, s, s);
      }

      ctx.globalCompositeOperation = "source-over";

      // ── REALITY GLITCH ── 0.2s of broken signal on an absolute clock
      if (!glitchStart && now >= nextGlitch) {
        glitchStart = now;
        bands = [];
        const n = 7;
        for (let b = 0; b < n; b++) {
          bands.push({
            y: (b / n) * H,
            h: H / n + 1,
            dx: rand(-26, 26),
          });
        }
      }
      if (glitchStart) {
        const gp = (now - glitchStart) / 200; // 0→1 over 0.2s
        if (gp >= 1) {
          glitchStart = 0;
          canvas.style.transform = "";
          nextGlitch = now + rand(5000, 8000);
        } else {
          // slice reality into bands and shove them sideways
          snapCtx.clearRect(0, 0, snap.width, snap.height);
          snapCtx.drawImage(canvas, 0, 0);
          ctx.clearRect(0, 0, W, H);
          for (const b of bands) {
            ctx.drawImage(
              snap,
              0, b.y * DPR, snap.width, b.h * DPR,
              b.dx * (1 - gp), b.y, W, b.h
            );
          }
          // cheap chromatic aberration: two offset ghost passes, additive
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.22;
          ctx.drawImage(snap, 0, 0, snap.width, snap.height, 3, 0, W, H);
          ctx.drawImage(snap, 0, 0, snap.width, snap.height, -3, 1, W, H);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          // violent shake, decaying across the glitch
          const k = (1 - gp) * 5;
          canvas.style.transform = `translate(${rand(-k, k)}px, ${rand(-k, k)}px)`;
        }
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
        const now = performance.now();
        const parked = now - last;
        // BOTH absolute clocks skip the parked span — otherwise reality tears
        // the instant the card scrolls back into view.
        nextGlitch += parked;
        if (glitchStart) glitchStart += parked;
        last = now;
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

// ── Card-level: the portal domain ───────────────────────────────────────────

export function PortalCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePortalCanvas(canvasRef);

  return (
    <>
      {/* the vacuum of space behind the card's text (z-6) so the acid glow
          reads blinding against the dark */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(5,10,15,0.85), rgba(4,8,12,0.62) 55%, rgba(3,6,10,0.45) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 30%, rgba(57,255,20,0.09), transparent 66%)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* singularity · spit · garbage · glitch — pure light at z-30,
          screen-blended: it can only brighten, never hide a word */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </>
  );
}

// ── Avatar-level: the event horizon ─────────────────────────────────────────

export function PortalAvatarMark() {
  // Register so the portal opens behind THIS avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    PORTAL_ANCHORS.add(el);
    return () => {
      PORTAL_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* toxic acid green → cyan → magenta, churning on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(4,8,12,0.9), 0 0 28px 9px rgba(57,255,20,0.45)",
            "0 0 16px 5px rgba(4,8,12,0.95), 0 0 42px 13px rgba(34,211,238,0.4)",
            "0 0 13px 4px rgba(4,8,12,0.9), 0 0 32px 10px rgba(232,121,249,0.4)",
            "0 0 12px 3px rgba(4,8,12,0.9), 0 0 28px 9px rgba(57,255,20,0.45)",
          ],
        }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
