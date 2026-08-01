"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardFace, { CardDef, RARITY_META } from "./CardFace";

/**
 * PACK OPENING — the payoff moment.
 *
 * Cards arrive face-DOWN and are flipped one at a time, so each pull lands on
 * its own beat instead of four results appearing at once. The best card in the
 * pack is dealt LAST (a pack that peaks at the end feels better than one that
 * peaks first), and epic+ pulls fire a burst of rays and a colour flash sized
 * to the rarity.
 *
 * Everything is transform/opacity so it composites on the GPU — no layout
 * thrash mid-reveal. Honors prefers-reduced-motion by skipping straight to the
 * finished spread.
 */

export default function PackReveal({
  cards,
  onClose,
  title = "Your pull",
}: {
  cards: CardDef[];
  onClose: () => void;
  title?: string;
}) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Best card last — the pack should crescendo.
  const ordered = [...cards].sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order);
  const [revealed, setRevealed] = useState(reduce ? ordered.length : 0);
  const best = ordered.length ? ordered[ordered.length - 1] : null;

  useEffect(() => {
    if (reduce || revealed >= ordered.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 350 : 620);
    return () => clearTimeout(t);
  }, [revealed, ordered.length, reduce]);

  const allOut = revealed >= ordered.length;
  // Flash colour comes from the best card revealed so far.
  const flashUpto = ordered.slice(0, revealed);
  const peak = flashUpto.length ? flashUpto[flashUpto.length - 1] : null;
  const peakBig = peak && RARITY_META[peak.rarity].order >= 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center overflow-hidden bg-[#04040a]/95 p-6 backdrop-blur-md"
      onClick={() => allOut && onClose()}
    >
      {/* rarity flash — a soft radial pulse keyed to the card just flipped */}
      <AnimatePresence>
        {peakBig && (
          <motion.div
            key={`flash-${revealed}`}
            initial={{ opacity: 0.65, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.9 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${RARITY_META[peak!.rarity].glow}, transparent 62%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* SHOCKWAVE — a ring that punches outward the instant an epic+ lands.
          Two rings offset in time read as an impact rather than a fade. */}
      {peakBig && [0, 0.12].map((delay) => (
        <motion.div
          key={`ring-${revealed}-${delay}`}
          initial={{ opacity: 0.9, scale: 0.15 }}
          animate={{ opacity: 0, scale: 2.2 }}
          transition={{ duration: 1.0, delay, ease: "easeOut" }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ border: `2px solid ${RARITY_META[peak!.rarity].frame}` }}
        />
      ))}

      {/* SPARKS — a burst of embers flung outward, scaled to rarity. This is
          the bit that makes a legendary feel like an event rather than a card
          appearing. Fixed angles so it reads as a starburst, not confetti. */}
      {peakBig && Array.from({ length: RARITY_META[peak!.rarity].order >= 3 ? 26 : 14 }, (_, i, arr) => {
        const ang = (i / arr.length) * Math.PI * 2;
        const dist = 24 + (i % 4) * 9;
        return (
          <motion.span
            key={`spark-${revealed}-${i}`}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: `${Math.cos(ang) * dist}vmin`,
              y: `${Math.sin(ang) * dist}vmin`,
              scale: 0.2,
            }}
            transition={{ duration: 1.1 + (i % 3) * 0.25, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: RARITY_META[peak!.rarity].gem, boxShadow: `0 0 8px ${RARITY_META[peak!.rarity].glow}` }}
          />
        );
      })}

      {/* god rays for legendary */}
      {peak && RARITY_META[peak.rarity].order >= 3 && (
        <motion.div
          key={`rays-${revealed}`}
          initial={{ opacity: 0, rotate: 0 }}
          animate={{ opacity: [0, 0.5, 0.25], rotate: 22 }}
          transition={{ duration: 2.4, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-conic-gradient(from 0deg at 50% 50%, rgba(253,230,138,0.22) 0deg 5deg, transparent 5deg 22deg)",
            maskImage: "radial-gradient(circle at 50% 50%, black 10%, transparent 68%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 10%, transparent 68%)",
          }}
        />
      )}

      {/* The call-out. A legendary shouldn't be something you notice later
          while scanning four cards — it should announce itself. */}
      <AnimatePresence mode="wait">
        {peakBig ? (
          <motion.h3
            key={`hail-${peak!.id}`}
            initial={{ opacity: 0, scale: 0.7, letterSpacing: "0.6em" }}
            animate={{ opacity: 1, scale: 1, letterSpacing: "0.3em" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mb-8 text-center text-sm font-black uppercase sm:text-lg"
            style={{ color: RARITY_META[peak!.rarity].gem, textShadow: `0 0 24px ${RARITY_META[peak!.rarity].glow}` }}
          >
            {RARITY_META[peak!.rarity].order >= 3 ? "★ LEGENDARY ★" : "EPIC PULL"}
          </motion.h3>
        ) : (
          <motion.h3
            key="plain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 mb-8 text-xs font-black uppercase tracking-[0.3em] text-slate-400"
          >
            {allOut ? title : "Opening…"}
          </motion.h3>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
        {ordered.map((c, i) => {
          const isOut = i < revealed;
          return (
            <motion.div
              key={`${c.id}-${i}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: reduce ? 0 : i * 0.06, duration: 0.35 }}
              style={{ perspective: 900 }}
            >
              <motion.div
                animate={{ rotateY: isOut ? 0 : 180, scale: isOut ? 1 : 0.94 }}
                transition={{ duration: reduce ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: "preserve-3d", position: "relative" }}
              >
                {/* face */}
                <div style={{ backfaceVisibility: "hidden" }}>
                  <CardFace card={c} owned size={168} />
                </div>
                {/* back */}
                <div
                  className="absolute inset-0 grid place-items-center rounded-[9px] border-2 border-white/15"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background:
                      "repeating-linear-gradient(45deg,#170b2b 0 8px,#1e1038 8px 16px)",
                  }}
                >
                  <div className="h-10 w-10 rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10" />
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {allOut && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={onClose}
          className="relative z-10 mt-9 rounded-full border border-white/15 bg-white/10 px-7 py-2.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
        >
          {best && RARITY_META[best.rarity].order >= 3 ? "Incredible. Continue" : "Continue"}
        </motion.button>
      )}
    </motion.div>
  );
}
