"use client";

import { motion } from "framer-motion";

/**
 * Petals drifting out from behind the shelf title.
 *
 * framer-motion rather than raw rAF or CSS keyframes for one specific reason:
 * the app bridges Performance Mode into framer through MotionConfig, so this
 * goes still for anyone who has asked for less motion — and for anyone whose
 * system says prefers-reduced-motion — without needing to know about it here.
 *
 * Purely decorative, so aria-hidden and pointer-events-none: it must never
 * intercept a click meant for the shelf, and a screen reader should hear the
 * title, not a garden.
 */

/** A single petal: broad at the base, drawn to a point. */
const PETAL_PATH = "M12 2C7.5 6.2 4.5 10.3 4.5 14a7.5 7.5 0 0 0 15 0c0-3.7-3-7.8-7.5-12z";

/**
 * Hand-placed rather than random. Math.random would give a different bloom on
 * the server and the client and desynchronise hydration, and scattering by
 * hand lets the petals lean away from the title instead of across it.
 *
 * x/y are the start, dx/dy the drift, all in px. `delay` staggers the bloom so
 * they never pulse in unison.
 */
const PETALS = [
  { x: 4, y: 34, dx: -26, dy: -46, rot: -35, scale: 0.55, delay: 0.0, dur: 9.5, fill: "#fb7185", op: 0.55 },
  { x: 30, y: 10, dx: 34, dy: -38, rot: 48, scale: 0.42, delay: 1.6, dur: 11, fill: "#f9a8d4", op: 0.5 },
  { x: 74, y: 40, dx: 18, dy: -54, rot: -22, scale: 0.5, delay: 3.1, dur: 10, fill: "#fda4af", op: 0.45 },
  { x: 120, y: 8, dx: -20, dy: -34, rot: 66, scale: 0.36, delay: 0.9, dur: 12, fill: "#fbbf24", op: 0.4 },
  { x: 168, y: 38, dx: 30, dy: -50, rot: -54, scale: 0.46, delay: 4.2, dur: 10.5, fill: "#fb7185", op: 0.5 },
  { x: 214, y: 14, dx: -14, dy: -42, rot: 30, scale: 0.4, delay: 2.4, dur: 11.5, fill: "#f9a8d4", op: 0.42 },
  { x: 262, y: 36, dx: 26, dy: -48, rot: -40, scale: 0.52, delay: 5.0, dur: 9, fill: "#fda4af", op: 0.48 },
  { x: 310, y: 12, dx: -30, dy: -36, rot: 58, scale: 0.38, delay: 1.2, dur: 12.5, fill: "#fbbf24", op: 0.38 },
];

export default function RosePetals() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {/* A soft bloom under the wordmark so the petals read as coming from
          somewhere rather than appearing out of flat black. */}
      <motion.div
        className="absolute -left-6 -top-4 h-24 w-64 rounded-full blur-2xl"
        style={{ background: "radial-gradient(closest-side, rgba(244,63,94,0.20), transparent)" }}
        animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {PETALS.map((p, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute h-6 w-6"
          style={{ left: p.x, top: p.y }}
          initial={{ opacity: 0, scale: p.scale * 0.3, x: 0, y: 0, rotate: p.rot * 0.3 }}
          animate={{
            // Fade in over the first fifth, hold, then fade as it drifts off.
            opacity: [0, p.op, p.op, 0],
            scale: [p.scale * 0.3, p.scale, p.scale * 1.05, p.scale * 0.9],
            x: [0, p.dx * 0.45, p.dx * 0.8, p.dx],
            y: [0, p.dy * 0.4, p.dy * 0.75, p.dy],
            rotate: [p.rot * 0.3, p.rot * 0.7, p.rot, p.rot * 1.25],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            // The app's standard ease-out. Nothing here should accelerate —
            // petals settle, they do not launch.
            ease: [0.22, 1, 0.36, 1],
            times: [0, 0.2, 0.72, 1],
          }}
        >
          <path d={PETAL_PATH} fill={p.fill} />
        </motion.svg>
      ))}
    </div>
  );
}
