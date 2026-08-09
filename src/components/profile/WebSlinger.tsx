"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "framer-motion";

/**
 * THE WEB-SLINGER — Extreme Rare profile effect. High-tension web mechanics
 * anchored on the avatar (the Spider), in four systems:
 *
 *   THE ANCHOR RING — a chaotic tangled lattice of thin white threads
 *              tightly wrapping the avatar's rim: dozens of crisscrossing
 *              chords with a cyan under-glow, generated once in avatar-local
 *              polar space and re-scaled live.
 *   PRIMARY WEBS — six thick silk lines shot from the avatar to the card's
 *              corners and edges. Not straight lines: each is a quadratic
 *              with gravity sag at the midpoint, flanked by two thinner
 *              threads twisting around the main strand like spun silk.
 *   THE PLUCK — the webs are INTERACTIVE. When the cursor crosses a strand
 *              it stretches toward the pointer; when the cursor leaves it
 *              snaps back on an underdamped spring, visibly bouncing as the
 *              oscillation decays. Resize re-anchors instantly — tension
 *              geometry is derived fresh every frame, only the spring
 *              displacement persists.
 *   SPIDEY-SENSE — red/blue ember motes drift in the background, and every
 *              few seconds a quick white-or-crimson ring pulses out from
 *              behind the avatar and fades.
 *
 * Rendering: webs are pure light on dark, so this takes the single z-[30]
 * screen-blend canvas (the Gateway/Hollow treatment) — it can only brighten,
 * so it rides over the card's text at full presence without hiding a word.
 * No shadowBlur in the loop (house rule): the cyan "glow" is a wide faint
 * stroke pass under the white core pass. Anchors are scoped to the canvas's
 * own card via DOM containment. Cursor is tracked in client coords and
 * converted per frame with the same rect as the anchors.
 */

// The avatar registers here; the web anchors on this card's own Spider.
const WEBSLINGER_ANCHORS = new Set<HTMLElement>();

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Chord = { a1: number; r1: number; a2: number; r2: number };
type Web = {
  // anchor target as a fraction of the card (corners + edge midpoints)
  fx: number;
  fy: number;
  // spring state: perpendicular displacement of the control point
  disp: number;
  vel: number;
  twistP: number;
};
type Ember = { fx: number; fy: number; phase: number; size: number; red: boolean };
type Pulse = { t0: number; red: boolean };

function useWebSlingerCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
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

    // pre-rendered ember sprites — glow without per-frame shadowBlur
    const makeSprite = (inner: string, mid: string) => {
      const s = 64;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.4, mid);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const redEmber = makeSprite("rgba(255,190,190,0.9)", "rgba(220,38,38,0.4)");
    const blueEmber = makeSprite("rgba(190,225,255,0.9)", "rgba(37,99,235,0.4)");
    const holeFeather = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.82, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      return c;
    })();

    // cursor kept in CLIENT coords; converted per frame with the anchor rect
    const mouseClient = { x: -9999, y: -9999 };
    const onPointer = (e: PointerEvent) => {
      mouseClient.x = e.clientX;
      mouseClient.y = e.clientY;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    // RELEASE is an event, not an absence: with only pointermove, a finger
    // lifting on a strand (the Android PWA) or the cursor leaving the window
    // left the last position latched and the strand plucked FOREVER — the
    // snap-back could never fire. Touch/pen lift always releases; mouse
    // clicks don't (hovering a strand shouldn't twang it), but leaving the
    // window does.
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") {
        mouseClient.x = -9999;
        mouseClient.y = -9999;
      }
    };
    const onWindowLeave = () => {
      mouseClient.x = -9999;
      mouseClient.y = -9999;
    };
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    window.addEventListener("blur", onWindowLeave);
    document.documentElement.addEventListener("mouseleave", onWindowLeave);

    let ax = 0, ay = 0, aR = 48;
    let mx = -9999, my = -9999;

    // the tangled anchor ring — generated ONCE in unit-radius polar space
    const chords: Chord[] = Array.from({ length: 44 }, () => ({
      a1: rand(0, TAU),
      r1: rand(1.05, 1.45),
      a2: rand(0, TAU),
      r2: rand(1.05, 1.45),
    }));

    // six primary webs: four corners + top/bottom edge midpoints
    const webs: Web[] = [
      { fx: 0, fy: 0 }, { fx: 1, fy: 0 }, { fx: 0, fy: 1 }, { fx: 1, fy: 1 },
      { fx: 0.5, fy: 0 }, { fx: 0.5, fy: 1 },
    ].map((w) => ({ ...w, disp: 0, vel: 0, twistP: rand(0, TAU) }));

    const embers: Ember[] = Array.from({ length: 60 }, () => ({
      fx: Math.random(),
      fy: Math.random(),
      phase: rand(0, TAU),
      size: rand(4, 10),
      red: Math.random() < 0.5,
    }));

    const pulses: Pulse[] = [];
    let nextPulse = 2.5;

    const drawRing = (t: number, grow: number) => {
      // cyan under-glow pass (the "high-tech" halo), then the white threads —
      // one batched path each, so the whole tangle costs two strokes
      ctx.globalCompositeOperation = "lighter";
      const wob = 1 + 0.02 * Math.sin(t * 1.7);
      for (const pass of [
        { style: `rgba(34,211,238,${0.16 * grow})`, lw: 2.6 },
        { style: `rgba(255,255,255,${0.55 * grow})`, lw: 0.8 },
      ]) {
        ctx.beginPath();
        for (const c of chords) {
          ctx.moveTo(ax + Math.cos(c.a1) * c.r1 * aR * wob, ay + Math.sin(c.a1) * c.r1 * aR * wob);
          ctx.lineTo(ax + Math.cos(c.a2) * c.r2 * aR * wob, ay + Math.sin(c.a2) * c.r2 * aR * wob);
        }
        ctx.strokeStyle = pass.style;
        ctx.lineWidth = pass.lw;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const drawWebs = (t: number, dt: number, grow: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (const w of webs) {
        // endpoints derived fresh every frame — resize re-anchors instantly
        const tx = w.fx * W;
        const ty = w.fy * H;
        const dx = tx - ax, dy = ty - ay;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const p0x = ax + ux * aR * 0.95, p0y = ay + uy * aR * 0.95;
        const midx = (p0x + tx) / 2, midy = (p0y + ty) / 2;
        // gravity sag at the midpoint, pulled taut as displacement grows
        const sag = len * 0.055 * (1 - clamp(Math.abs(w.disp) / 80, 0, 0.7));
        const nx = -uy, ny = ux; // perpendicular

        // THE PLUCK — distance from cursor to the strand via chord
        // projection: project onto the p0→anchor chord, evaluate the current
        // Bezier at that parameter, measure once. Continuous along the WHOLE
        // strand (the old 7-point sampling left dead bands between samples on
        // long strands where the cursor could cross without any response) and
        // cheaper than the 7 hypots it replaces.
        const cx0 = midx + nx * w.disp, cy0 = midy + ny * w.disp + sag;
        const ex = tx - p0x, ey = ty - p0y;
        const u = clamp(((mx - p0x) * ex + (my - p0y) * ey) / (ex * ex + ey * ey || 1), 0, 1);
        const invU = 1 - u;
        const qx = invU * invU * p0x + 2 * invU * u * cx0 + u * u * tx;
        const qy = invU * invU * p0y + 2 * invU * u * cy0 + u * u * ty;
        const minD = Math.hypot(mx - qx, my - qy);
        // target: stretch toward the cursor while it presses the strand,
        // zero (snap back) the moment it leaves
        const target = minD < 30 ? clamp((mx - midx) * nx + (my - midy) * ny, -70, 70) : 0;
        // underdamped spring — the visible bounce on release
        w.vel += (170 * (target - w.disp) - 7.5 * w.vel) * dt;
        w.disp += w.vel * dt;

        const cx = midx + nx * w.disp, cy = midy + ny * w.disp + sag;
        // spun-silk: main strand + two thin threads twisting around it
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * grow})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p0x, p0y);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.stroke();
        ctx.strokeStyle = `rgba(186,230,253,${0.28 * grow})`;
        ctx.lineWidth = 0.8;
        for (let k = 0; k < 2; k++) {
          const off = (k ? -1 : 1) * (6 + 4 * Math.sin(t * 3 + w.twistP + k * 2.1));
          ctx.beginPath();
          ctx.moveTo(p0x + nx * 1.5 * (k ? -1 : 1), p0y + ny * 1.5 * (k ? -1 : 1));
          ctx.quadraticCurveTo(cx + nx * off, cy + ny * off, tx, ty);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const drawEmbers = (t: number, grow: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (const e of embers) {
        const x = e.fx * W + 14 * Math.sin(t * 0.3 + e.phase);
        const y = e.fy * H + 10 * Math.cos(t * 0.23 + e.phase * 1.7);
        ctx.globalAlpha = (0.16 + 0.18 * Math.abs(Math.sin(t * 0.8 + e.phase * 3))) * grow;
        ctx.drawImage(e.red ? redEmber : blueEmber, x - e.size / 2, y - e.size / 2, e.size, e.size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const drawPulses = (t: number, grow: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = (t - pulses[i].t0) / 0.7;
        if (p >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        if (p < 0) continue; // echo pulses are born slightly in the future
        const r = aR * (1.05 + 1.6 * p);
        ctx.strokeStyle = pulses[i].red
          ? `rgba(248,113,113,${0.55 * (1 - p) * grow})`
          : `rgba(255,255,255,${0.5 * (1 - p) * grow})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    // ── conductor ──
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let paused = false;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      // avatar epicenter + cursor — ONLY anchors inside THIS canvas's card
      const cRect = canvas.getBoundingClientRect();
      const host = canvas.parentElement;
      ax = W * 0.28; ay = H * 0.22; aR = 48;
      let best = 0;
      WEBSLINGER_ANCHORS.forEach((el) => {
        if (host && !host.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > best) {
          best = r.width;
          ax = r.left - cRect.left + r.width / 2;
          ay = r.top - cRect.top + r.height / 2;
          aR = r.width / 2;
        }
      });
      mx = mouseClient.x - cRect.left;
      my = mouseClient.y - cRect.top;

      const grow = clamp((elapsed - 0.2) / 1.4, 0, 1);

      if (elapsed >= nextPulse) {
        pulses.push({ t0: elapsed, red: Math.random() < 0.45 });
        if (Math.random() < 0.4) pulses.push({ t0: elapsed + 0.12, red: true });
        nextPulse = elapsed + rand(4, 7);
      }

      ctx.clearRect(0, 0, W, H);
      drawEmbers(elapsed, grow);
      drawPulses(elapsed, grow);
      drawRing(elapsed, grow);
      drawWebs(elapsed, dt, grow);
      // punch the avatar's disc out LAST — the ring and strands emerge from
      // BEHIND the Spider, and nothing bright ever washes the face
      ctx.globalCompositeOperation = "destination-out";
      const hr = aR + 2;
      ctx.drawImage(holeFeather, ax - hr, ay - hr, hr * 2, hr * 2);
      ctx.globalCompositeOperation = "source-over";

      if (!paused) raf = requestAnimationFrame(frame);
    };

    // The two "not being seen" signals are tracked SEPARATELY so a tab
    // hide→show can't resume a loop the IntersectionObserver had parked.
    let hidden = document.hidden;
    let offscreen = false;
    const sync = () => {
      const shouldPause = hidden || offscreen;
      if (shouldPause === paused) return;
      paused = shouldPause;
      if (paused) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            offscreen = !e.isIntersecting;
            sync();
          }, { threshold: 0 })
        : null;
    io?.observe(canvas);

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("blur", onWindowLeave);
      document.documentElement.removeEventListener("mouseleave", onWindowLeave);
      document.removeEventListener("visibilitychange", onVis);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [canvasRef]);
}

// ── Card-level: the web, anchored INSIDE the card ───────────────────────────

export function WebSlingerCardDomain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWebSlingerCanvas(canvasRef);

  return (
    <>
      {/* subtle midnight wash BEHIND the card's text (z-6) so the stark white
          silk reads sharply */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(120% 100% at 50% 25%, rgba(15,20,30,0.8), rgba(10,14,22,0.6) 55%, rgba(6,9,15,0.45) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.95] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: "radial-gradient(70% 55% at 50% 28%, rgba(34,211,238,0.1), transparent 68%)" }}
        animate={{ opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 6.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ring · webs · pluck physics · spidey-sense — pure light at z-30,
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

// ── Avatar-level: the mark of the Spider ────────────────────────────────────

export function WebSlingerAvatarMark() {
  // Register so the web anchors on THIS avatar.
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    WEBSLINGER_ANCHORS.add(el);
    return () => {
      WEBSLINGER_ANCHORS.delete(el);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} aria-hidden className="pointer-events-none absolute inset-0 rounded-full" />
      {/* titanium white → cyan → crimson, breathing on the rim */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 z-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 12px 3px rgba(10,14,22,0.9), 0 0 26px 8px rgba(255,255,255,0.4)",
            "0 0 16px 5px rgba(10,14,22,0.95), 0 0 40px 12px rgba(34,211,238,0.5)",
            "0 0 13px 4px rgba(10,14,22,0.9), 0 0 30px 9px rgba(220,38,38,0.45)",
            "0 0 12px 3px rgba(10,14,22,0.9), 0 0 26px 8px rgba(255,255,255,0.4)",
          ],
        }}
        transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* THE ANCHOR WEB — a corner of spun web clinging to the top-left rim:
          3 radial threads + 2 sagging arc chords (titanium white over a
          blurred cyan under-glow), and one tiny crimson spider that
          occasionally slides a few px down the vertical thread and back.
          Layered like Tempest's thundercloud: the visible structure rides
          z-20 above the avatar image so it reads as clinging to the rim.
          All geometry lives in viewBox units inside a %-sized wrapper, so it
          scales from 160px profiles down to 80px popouts untouched. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-[-7%] top-[-7%] z-20 block w-[46%]"
        animate={{ opacity: [0.7, 1, 0.7], y: [0, 1, 0] }}
        transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 40 40" className="h-auto w-full" fill="none">
          {/* cyan under-glow: same path, wider + blurred, drawn first */}
          <path
            d="M3 3 L3 34 M3 3 L34 3 M3 3 L25 25 M3 16 Q7.5 7.5 16 3 M3 30 Q13 13 30 3"
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.5"
            style={{ filter: "blur(1.4px)" }}
          />
          {/* the threads: 3 radials from the corner + 2 arc chords sagging
              toward the anchor point */}
          <path
            d="M3 3 L3 34 M3 3 L34 3 M3 3 L25 25 M3 16 Q7.5 7.5 16 3 M3 30 Q13 13 30 3"
            stroke="#f8fafc"
            strokeWidth="0.5"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* the spider — one crimson ember dot; mostly at rest, then a slow
              slide down the vertical thread and back up */}
          <motion.g
            animate={{ y: [0, 0, 6, 6, 0, 0] }}
            transition={{ duration: 7.5, times: [0, 0.5, 0.6, 0.72, 0.84, 1], repeat: Infinity, ease: "easeInOut" }}
          >
            <circle
              cx="3"
              cy="9.5"
              r="1.4"
              fill="#ef4444"
              style={{ filter: "drop-shadow(0 0 2px rgba(239,68,68,0.9))" }}
            />
          </motion.g>
        </svg>
      </motion.span>
    </>
  );
}
