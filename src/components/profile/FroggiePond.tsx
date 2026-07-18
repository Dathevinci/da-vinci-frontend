"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/**
 * Froggie Frenzy — a lush magical pond that wraps the avatar and the profile card.
 *
 * Everything here is drawn in code (inline SVG with gradients + soft shadows) and
 * animated with transform/opacity ONLY, so it stays on the compositor: no layout
 * properties are ever animated. The frog tours the card on a CSS motion path
 * (offset-path) with `offset-rotate: auto`, so it turns to face the direction it
 * is moving; hops use squash-and-stretch with a back-out cubic-bezier.
 */

// ── The star: a chibi frog drawn entirely in code ──
export function ChibiFrog({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 50"
      className={className}
      style={{
        filter:
          "drop-shadow(0 2px 3px rgba(0,0,0,0.35)) drop-shadow(0 0 6px rgba(74,222,128,0.55))",
      }}
    >
      <defs>
        <radialGradient id="frog-body" cx="50%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="55%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="frog-eyebump" cx="50%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
      </defs>
      {/* eye bumps on top of the head */}
      <circle cx="17" cy="13" r="10" fill="url(#frog-eyebump)" />
      <circle cx="47" cy="13" r="10" fill="url(#frog-eyebump)" />
      {/* chibi body */}
      <ellipse cx="32" cy="31" rx="23" ry="17.5" fill="url(#frog-body)" />
      {/* pale belly */}
      <ellipse cx="32" cy="37.5" rx="13" ry="8" fill="#d9f99d" opacity="0.9" />
      {/* glossy head highlight */}
      <ellipse cx="22" cy="21.5" rx="7" ry="3.1" fill="#ffffff" opacity="0.32" transform="rotate(-16 22 21.5)" />
      {/* eyes — the whole group squints shut for an occasional blink */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
        transition={{ duration: 4.4, times: [0, 0.88, 0.93, 0.97, 1], repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="17" cy="13" r="7" fill="#ffffff" />
        <circle cx="47" cy="13" r="7" fill="#ffffff" />
        <circle cx="18.5" cy="14" r="3.9" fill="#14261a" />
        <circle cx="45.5" cy="14" r="3.9" fill="#14261a" />
        {/* catchlights */}
        <circle cx="20" cy="12.4" r="1.5" fill="#ffffff" />
        <circle cx="47" cy="12.4" r="1.5" fill="#ffffff" />
        <circle cx="17.4" cy="16" r="0.8" fill="#ffffff" opacity="0.85" />
        <circle cx="44.4" cy="16" r="0.8" fill="#ffffff" opacity="0.85" />
      </motion.g>
      {/* rosy cheeks */}
      <ellipse cx="13" cy="33" rx="3.6" ry="2" fill="#fda4af" opacity="0.75" />
      <ellipse cx="51" cy="33" rx="3.6" ry="2" fill="#fda4af" opacity="0.75" />
      {/* happy smile */}
      <path d="M23 33 Q32 41 41 33" fill="none" stroke="#14532d" strokeWidth="2.2" strokeLinecap="round" />
      {/* little hands resting on the edge */}
      <ellipse cx="18" cy="46" rx="5" ry="3" fill="url(#frog-body)" />
      <ellipse cx="46" cy="46" rx="5" ry="3" fill="url(#frog-body)" />
      <path d="M15.5 45.5 V48 M18 46 V48.6 M20.5 45.5 V48" stroke="#15803d" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M43.5 45.5 V48 M46 46 V48.6 M48.5 45.5 V48" stroke="#15803d" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

// ── A lily pad with a notch, radial shading, veins, and a dewy rim light ──
function LilyPad({ className, hue = 0 }: { className?: string; hue?: number }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className={className}
      style={{ filter: `hue-rotate(${hue}deg) drop-shadow(0 2px 2px rgba(0,0,0,0.35))` }}
    >
      <defs>
        <radialGradient id="pad-g" cx="42%" cy="35%" r="78%">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="45%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
      </defs>
      {/* pad with a wedge notch */}
      <path d="M33 20 L59 12 A27 16 0 1 0 59 28 Z" fill="url(#pad-g)" />
      {/* veins radiating from the heart */}
      <g stroke="#065f46" strokeWidth="0.8" opacity="0.3" fill="none">
        <path d="M33 20 L12 8" />
        <path d="M33 20 L6 19" />
        <path d="M33 20 L12 32" />
        <path d="M33 20 L27 36" />
        <path d="M33 20 L44 35" />
      </g>
      {/* dewy rim light */}
      <path d="M14 8 A27 16 0 0 0 6 17" stroke="#d9f99d" strokeWidth="1.4" opacity="0.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── A blooming lotus: two fans of gradient petals around a golden heart ──
function Lotus({ className, white = false }: { className?: string; white?: boolean }) {
  const gid = white ? "lotus-w" : "lotus-p";
  const outerTip = white ? "#f8fafc" : "#f9a8d4";
  const outerBase = white ? "#c7d2fe" : "#ec4899";
  const innerTip = white ? "#ffffff" : "#fce7f3";
  return (
    <svg viewBox="0 0 64 56" className={className} style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}>
      <defs>
        <linearGradient id={`${gid}-o`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={outerBase} />
          <stop offset="100%" stopColor={outerTip} />
        </linearGradient>
        <linearGradient id={`${gid}-i`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={outerTip} />
          <stop offset="100%" stopColor={innerTip} />
        </linearGradient>
      </defs>
      {/* outer petal fan */}
      <g fill={`url(#${gid}-o)`}>
        {[-70, -35, 0, 35, 70].map((a) => (
          <ellipse key={a} cx="32" cy="22" rx="7.5" ry="17" transform={`rotate(${a} 32 40)`} />
        ))}
      </g>
      {/* inner petal fan */}
      <g fill={`url(#${gid}-i)`}>
        {[-38, 0, 38].map((a) => (
          <ellipse key={a} cx="32" cy="26" rx="6.5" ry="14" transform={`rotate(${a} 32 40)`} />
        ))}
      </g>
      {/* golden heart */}
      <circle cx="32" cy="36" r="5.5" fill="#fde047" />
      <circle cx="30" cy="34.5" r="1.1" fill="#f59e0b" />
      <circle cx="34.5" cy="35.5" r="1.1" fill="#f59e0b" />
      <circle cx="32" cy="38.2" r="1.1" fill="#f59e0b" />
    </svg>
  );
}

// ── Desynchronized floating wrapper: gentle bob + sway, transforms only ──
function Bob({
  children,
  className,
  dur = 4,
  delay = 0,
  dy = 3,
  rot = 2,
}: {
  children: ReactNode;
  className?: string;
  dur?: number;
  delay?: number;
  dy?: number;
  rot?: number;
}) {
  return (
    <motion.span
      className={className}
      animate={{ y: [0, -dy, 0], rotate: [0, rot, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
}

const FIREFLIES = [
  { size: 3, dur: 6.5, delay: 0, dir: 1, color: "#bef264" },
  { size: 2.4, dur: 8.5, delay: 1.3, dir: -1, color: "#6ee7b7" },
  { size: 3.4, dur: 7.2, delay: 2.6, dir: 1, color: "#a3e635" },
  { size: 2.2, dur: 9.4, delay: 0.7, dir: -1, color: "#5eead4" },
];

function Fireflies() {
  return (
    <>
      {FIREFLIES.map((f, i) => (
        <motion.span
          key={i}
          className="absolute inset-0"
          animate={{ rotate: 360 * f.dir }}
          transition={{ duration: f.dur, repeat: Infinity, ease: "linear", delay: f.delay }}
        >
          <motion.span
            className="absolute rounded-full"
            style={{
              left: "50%",
              top: -1,
              width: f.size,
              height: f.size,
              marginLeft: -f.size / 2,
              background: f.color,
              boxShadow: `0 0 6px 1.5px ${f.color}`,
            }}
            animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.3, 0.7] }}
            transition={{ duration: 1.7 + i * 0.35, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.span>
      ))}
    </>
  );
}

// Back-out easing for hops — a springy, natural leap curve.
const LEAP: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

/**
 * Avatar-level pond: lily pads peek out from BEHIND the avatar (z-0), lotus
 * blooms sit in front (z-20), fireflies orbit, and the froggie scurries around
 * the rim of the avatar — pausing, then dashing on, always facing its direction
 * of travel (the rotating carrier turns its body along the curve).
 */
export function FroggieAvatarPond() {
  return (
    <>
      {/* BACK LAYER — pads tucked behind the avatar so it never gets covered */}
      <span aria-hidden className="pointer-events-none absolute -inset-3 z-0">
        <Bob className="absolute -left-[10%] bottom-[0%] block w-[38%]" dur={4.4} dy={2}>
          <LilyPad className="w-full h-auto" />
        </Bob>
        <Bob className="absolute -right-[12%] bottom-[10%] block w-[34%]" dur={5.2} delay={1.1} dy={2} rot={-3}>
          <LilyPad className="w-full h-auto -scale-x-100" hue={18} />
        </Bob>
        <Bob className="absolute -right-[6%] top-[2%] block w-[24%]" dur={5.8} delay={2} dy={2} rot={4}>
          <LilyPad className="w-full h-auto" hue={-14} />
        </Bob>
      </span>

      {/* FRONT LAYER — blooms, fireflies, and the rim-running froggie */}
      <span aria-hidden className="pointer-events-none absolute -inset-3 z-20">
        <Bob className="absolute left-[0%] bottom-[-9%] block w-[30%]" dur={5} delay={0.5} dy={2}>
          <Lotus className="w-full h-auto" />
        </Bob>
        <Bob className="absolute right-[2%] bottom-[-11%] block w-[24%]" dur={5.7} delay={1.7} dy={2} rot={-2}>
          <Lotus white className="w-full h-auto" />
        </Bob>
        <Fireflies />
        {/* rotating carrier sweeps the frog around the rim with scurry-pause pacing */}
        <motion.span
          className="absolute inset-0"
          animate={{ rotate: [0, 70, 85, 190, 205, 320, 360] }}
          transition={{ duration: 14, times: [0, 0.16, 0.26, 0.48, 0.58, 0.86, 1], repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.span
            className="absolute left-1/2 top-[-7%] block w-[36%] min-w-[16px] max-w-[50px]"
            style={{ x: "-50%" }}
            animate={{ y: [0, -3, 0], scaleY: [1, 1.1, 0.94], scaleX: [1, 0.93, 1.06] }}
            transition={{ duration: 0.55, repeat: Infinity, ease: LEAP }}
          >
            <ChibiFrog className="w-full h-auto" />
          </motion.span>
        </motion.span>
      </span>
    </>
  );
}

/**
 * Card-level pond: a dense, bobbing shoreline of lily pads and lotus blooms
 * along the bottom (plus a few drifting at the top corners), rising bubbles,
 * and the froggie touring the WHOLE card on a rounded motion path — turning to
 * face its travel direction, scurrying, pausing, and leaping between blooms.
 */
export function FroggieCardPond() {
  return (
    <>
      {/* Pond backdrop — glow, bubbles, and the lush shoreline (behind the text) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
        <motion.span
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 90% at 50% 100%, rgba(16,185,129,0.22), rgba(52,211,153,0.06) 45%, transparent 65%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.65] }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        {[12, 30, 52, 71, 88].map((x, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border border-emerald-200/50"
            style={{ left: `${x}%`, bottom: -12, width: 7 + (i % 3) * 4, height: 7 + (i % 3) * 4 }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, -170], opacity: [0, 0.7, 0], x: [0, 6, -5, 0] }}
            transition={{ duration: 5.5 + i * 0.8, repeat: Infinity, delay: i * 0.9, ease: "linear" }}
          />
        ))}

        {/* dense lily-pad shoreline along the bottom */}
        <Bob className="absolute -left-4 -bottom-3 block w-24" dur={4.6} dy={2.5}>
          <LilyPad className="w-full h-auto" />
        </Bob>
        <Bob className="absolute left-[13%] -bottom-4 block w-20" dur={5.4} delay={0.9} dy={2} rot={-2}>
          <LilyPad hue={16} className="w-full h-auto -scale-x-100" />
        </Bob>
        <Bob className="absolute left-[30%] -bottom-3 block w-16" dur={4.1} delay={1.8} dy={2}>
          <LilyPad hue={-12} className="w-full h-auto" />
        </Bob>
        <Bob className="absolute left-[47%] -bottom-4 block w-24" dur={5.9} delay={0.4} dy={2.5} rot={3}>
          <LilyPad className="w-full h-auto" />
        </Bob>
        <Bob className="absolute left-[68%] -bottom-3 block w-20" dur={4.8} delay={2.3} dy={2} rot={-3}>
          <LilyPad hue={20} className="w-full h-auto -scale-x-100" />
        </Bob>
        <Bob className="absolute -right-4 -bottom-3 block w-24" dur={5.1} delay={1.2} dy={2.5}>
          <LilyPad hue={-8} className="w-full h-auto" />
        </Bob>

        {/* blossoms nestled between the pads */}
        <Bob className="absolute left-[7%] -bottom-2 block w-14" dur={5.2} delay={0.6} dy={2}>
          <Lotus className="w-full h-auto" />
        </Bob>
        <Bob className="absolute left-[40%] -bottom-3 block w-12" dur={6} delay={1.5} dy={2}>
          <Lotus white className="w-full h-auto" />
        </Bob>
        <Bob className="absolute left-[82%] -bottom-2 block w-14" dur={5.6} delay={2.6} dy={2}>
          <Lotus className="w-full h-auto" />
        </Bob>

        {/* a couple of pads drifting past the top corners */}
        <Bob className="absolute -left-5 -top-3 block w-16" dur={6.4} delay={0.2} dy={2} rot={5}>
          <LilyPad hue={10} className="w-full h-auto rotate-[160deg]" />
        </Bob>
        <Bob className="absolute -right-5 -top-3 block w-14" dur={7} delay={1.9} dy={2} rot={-5}>
          <LilyPad hue={-16} className="w-full h-auto rotate-[200deg]" />
        </Bob>
      </span>

      {/* The froggie tours the whole card on a rounded motion path (offset-path),
          rotating to face its direction of travel; hops use squash & stretch. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[16] overflow-hidden">
        <motion.span
          className="absolute left-0 top-0 block w-9"
          style={{ offsetPath: "inset(5% round 32px)", offsetRotate: "auto" } as CSSProperties}
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: ["0%", "15%", "15%", "42%", "42%", "70%", "70%", "100%"] }}
          transition={{ duration: 18, times: [0, 0.14, 0.22, 0.42, 0.5, 0.72, 0.8, 1], repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.span
            className="block"
            animate={{ y: [0, -7, 0], scaleY: [1, 1.14, 0.9], scaleX: [1, 0.9, 1.08] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: LEAP }}
          >
            <ChibiFrog className="w-full h-auto" />
          </motion.span>
        </motion.span>

        {/* ribbit pops near the shoreline */}
        <motion.span
          className="absolute bottom-10 left-[14%] whitespace-nowrap rounded-full rounded-bl-none bg-emerald-300/95 px-2 py-0.5 text-[10px] font-black tracking-wide text-emerald-950 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.8], y: [5, 0, 0, -6] }}
          transition={{ duration: 2.6, times: [0, 0.15, 0.65, 1], repeat: Infinity, repeatDelay: 4.2, ease: "easeOut" }}
        >
          ribbit ribbit
        </motion.span>
        <motion.span
          className="absolute bottom-12 right-[16%] whitespace-nowrap rounded-full rounded-br-none bg-lime-300/95 px-2 py-0.5 text-[10px] font-black tracking-wide text-lime-950 shadow-[0_0_10px_rgba(163,230,53,0.6)]"
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.8], y: [5, 0, 0, -6] }}
          transition={{ duration: 2.6, times: [0, 0.15, 0.65, 1], repeat: Infinity, repeatDelay: 5.6, delay: 3.1, ease: "easeOut" }}
        >
          ribbit ribbit
        </motion.span>
      </span>

      {/* One-shot intro — a big happy "ribbit ribbit!" pops when the profile opens */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[20] whitespace-nowrap rounded-2xl rounded-bl-none bg-emerald-300 px-4 py-2 text-lg font-black text-emerald-950 shadow-[0_0_30px_rgba(52,211,153,0.7)]"
        initial={{ scale: 0, opacity: 0, rotate: -8, x: "-50%", y: "-50%" }}
        animate={{ scale: [0, 1.15, 1, 0.9], opacity: [0, 1, 1, 0], rotate: [-8, 4, 0, 0], x: "-50%", y: "-50%" }}
        transition={{ duration: 2, times: [0, 0.2, 0.75, 1], ease: "easeOut" }}
      >
        🐸 ribbit ribbit!
      </motion.span>
    </>
  );
}
