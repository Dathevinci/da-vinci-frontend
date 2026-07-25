"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, Tv, BookOpen } from "lucide-react";
import { useAppMode } from "@/components/providers/AppModeProvider";

/**
 * Full-screen cover that plays while the app switches Anime <-> Manhwa <-> Novel.
 *
 * AppModeProvider swaps the route + theme at 500ms and lifts this at 1000ms, so
 * the screen MUST be fully opaque before 500ms or the change flashes. The old
 * two-panel curtain finished closing at exactly 500ms — no margin at all, so a
 * single dropped frame showed the swap — and its emblem only appeared at 660ms,
 * leaving it legible for ~340ms before it started leaving again. It also split
 * the screen with a hard bright seam, which read as harsh rather than premium.
 *
 * This version: an opaque mode-tinted wash lands at ~280ms (safe margin), the
 * emblem is up by ~450ms and holds, and a ring + bar track the wait so the pause
 * feels intentional instead of like a flicker.
 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function ModeTransition() {
  const { transition } = useAppMode();

  const theme =
    transition.target === "manhwa"
      ? { accent: "#f05252", soft: "rgba(220,38,38,0.5)", glow: "rgba(220,38,38,0.45)", wash: "rgba(70,10,10,1)", label: "Manhwa", sub: "Enter the library", Icon: BookMarked }
      : transition.target === "novel"
      ? { accent: "#f472b6", soft: "rgba(236,72,153,0.5)", glow: "rgba(236,72,153,0.45)", wash: "rgba(62,10,44,1)", label: "Novels", sub: "Enter the archive", Icon: BookOpen }
      : { accent: "#a78bfa", soft: "rgba(139,92,246,0.5)", glow: "rgba(139,92,246,0.45)", wash: "rgba(34,18,68,1)", label: "Anime", sub: "Enter the theater", Icon: Tv };

  const { accent, soft, glow, wash, label, sub, Icon } = theme;
  const R = 34;
  const CIRC = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      {transition.active && (
        <motion.div
          key="mode-transition"
          className="pointer-events-auto fixed inset-0 z-[99990] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeInOut" } }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          style={{ background: `radial-gradient(ellipse 120% 90% at 50% 45%, ${wash} 0%, #050507 68%)` }}
        >
          {/* a slow breathing bloom so the hold isn't visually dead */}
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle 42% at 50% 50%, ${glow}, transparent 70%)` }}
            initial={{ opacity: 0.25, scale: 0.9 }}
            animate={{ opacity: [0.25, 0.55, 0.35], scale: [0.9, 1.05, 1] }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.22, ease: "easeIn" } }}
              transition={{ delay: 0.12, duration: 0.34, ease: EASE }}
            >
              {/* emblem with a ring that sweeps once across the wait */}
              <div className="relative mb-6 grid h-[88px] w-[88px] place-items-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="2" />
                  <motion.circle
                    cx="44" cy="44" r={R} fill="none"
                    stroke={accent} strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={CIRC}
                    initial={{ strokeDashoffset: CIRC }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ delay: 0.12, duration: 0.85, ease: "easeInOut" }}
                    style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
                  />
                </svg>
                <div
                  className="grid h-[62px] w-[62px] place-items-center rounded-full"
                  style={{ background: "rgba(6,6,10,0.75)", boxShadow: `0 0 38px ${glow}` }}
                >
                  <Icon className="h-7 w-7" style={{ color: accent }} strokeWidth={1.5} />
                </div>
              </div>

              <div
                className="font-fell text-[26px] font-bold uppercase leading-none tracking-[0.34em] text-white md:text-3xl"
                style={{ paddingLeft: "0.34em", textShadow: `0 0 30px ${glow}` }}
              >
                {label}
              </div>

              <div className="mt-3.5 font-garamond text-[13px] italic tracking-[0.22em]" style={{ color: soft }}>
                {sub}
              </div>

              {/* a real progress bar — gives the pause a purpose */}
              <div className="mt-6 h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(to right, transparent, ${accent})`, boxShadow: `0 0 12px ${glow}` }}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.1, duration: 0.88, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
