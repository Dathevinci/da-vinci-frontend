"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, Tv, BookOpen } from "lucide-react";
import { useAppMode } from "@/components/providers/AppModeProvider";

// Strong easeInOutQuint — gives the curtain a weighty, cinematic close/open.
const easeCurtain: [number, number, number, number] = [0.83, 0, 0.17, 1];

/**
 * Full-screen curtain that plays when the user switches Anime <-> Manhwa mode.
 * The AppModeProvider swaps the route + theme WHILE the curtain is closed, so
 * the change never flashes — the panels part to reveal the new mode already set.
 */
export default function ModeTransition() {
  const { transition } = useAppMode();

  // Themed per destination mode: manhwa = crimson, novel = pink, anime = amethyst.
  const theme =
    transition.target === "manhwa"
      ? { accent: "#dc2626", dim: "rgba(220,38,38,0.55)", glow: "rgba(220,38,38,0.35)", panel: "rgba(60,10,10,0.92)", label: "Manhwa Mode", sub: "Enter the library", Icon: BookMarked }
      : transition.target === "novel"
      ? { accent: "#ec4899", dim: "rgba(236,72,153,0.55)", glow: "rgba(236,72,153,0.35)", panel: "rgba(55,10,40,0.92)", label: "Novels Mode", sub: "Enter the archive", Icon: BookOpen }
      : { accent: "#8b5cf6", dim: "rgba(139,92,246,0.55)", glow: "rgba(139,92,246,0.35)", panel: "rgba(30,16,60,0.92)", label: "Anime Mode", sub: "Enter the theater", Icon: Tv };

  const accent = theme.accent;
  const accentDim = theme.dim;
  const glow = theme.glow;
  const label = theme.label;
  const sub = theme.sub;
  const Icon = theme.Icon;
  const panelBg = `radial-gradient(ellipse at center, ${theme.panel} 0%, #050505 72%)`;

  return (
    <AnimatePresence>
      {transition.active && (
        <motion.div
          key="mode-transition"
          className="fixed inset-0 z-[99990] pointer-events-auto overflow-hidden"
          initial="hidden"
          animate="cover"
          exit="reveal"
        >
          {/* Top panel slides down to meet the middle, then lifts away */}
          <motion.div
            variants={{ hidden: { y: "-101%" }, cover: { y: "0%" }, reveal: { y: "-101%" } }}
            transition={{ duration: 0.5, ease: easeCurtain }}
            className="absolute top-0 left-0 w-full h-[51%]"
            style={{ background: panelBg, borderBottom: `1px solid ${accent}`, boxShadow: `inset 0 -1px 34px ${accentDim}` }}
          />
          {/* Bottom panel slides up to meet the middle, then drops away */}
          <motion.div
            variants={{ hidden: { y: "101%" }, cover: { y: "0%" }, reveal: { y: "101%" } }}
            transition={{ duration: 0.5, ease: easeCurtain }}
            className="absolute bottom-0 left-0 w-full h-[51%]"
            style={{ background: panelBg, borderTop: `1px solid ${accent}`, boxShadow: `inset 0 1px 34px ${accentDim}` }}
          />

          {/* Seam flare where the panels meet */}
          <motion.div
            variants={{ hidden: { opacity: 0, scaleX: 0.2 }, cover: { opacity: 1, scaleX: 1 }, reveal: { opacity: 0, scaleX: 0.2 } }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] origin-center"
            style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)`, boxShadow: `0 0 26px 4px ${glow}` }}
          />

          {/* Emblem + wordmark, revealed once the curtain is closed */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.82, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8, transition: { duration: 0.22, ease: "easeIn" } }}
              transition={{ delay: 0.26, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full mb-5"
                style={{ border: `1px solid ${accentDim}`, boxShadow: `0 0 44px ${glow}`, background: "rgba(5,5,5,0.6)" }}
              >
                <Icon className="h-7 w-7" style={{ color: accent }} strokeWidth={1.5} />
              </div>
              <div
                className="font-fell text-2xl md:text-3xl font-bold uppercase tracking-[0.35em] pl-[0.35em] text-white"
                style={{ textShadow: `0 0 26px ${glow}` }}
              >
                {label}
              </div>
              <div className="mt-3 h-px w-24" style={{ background: `linear-gradient(to right, transparent, ${accentDim}, transparent)` }} />
              <div className="mt-3 font-garamond italic text-sm tracking-[0.25em]" style={{ color: accentDim }}>
                {sub}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
