"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardFace, { CardDef, RARITY_META } from "./CardFace";
import { ACCENT, ACCENT_LIT, notch } from "./gacha";

/**
 * PACK OPENING — the summon sequence.
 *
 * The old version dealt cards straight onto the screen and flipped them. That
 * skips the part that actually makes a gacha pull feel like an event: the
 * WAIT, and the tell inside it.
 *
 * The sequence is three beats, which is the shape every one of these games uses:
 *
 *   1. WARP — the screen goes dark and a star streaks in while speed lines rush
 *      toward the centre. Nothing is shown yet. This beat exists only to make
 *      the next one land.
 *   2. BURST — light detonates in the colour of the BEST card in the pull, with
 *      expanding shock rings. This is the tell: the colour tells you what you
 *      got a fraction of a second before you can see it, which is the entire
 *      reason these animations work.
 *   3. REVEAL — cards arrive face-down in a fan and flip one at a time, best
 *      last, each epic-or-better firing its own burst.
 *
 * Everything animates transform and opacity only, so it composites on the GPU.
 * prefers-reduced-motion skips straight to the finished spread, and a Skip
 * control is on screen the whole time — a sequence you cannot escape stops
 * being a reward the second time you see it.
 */

type Stage = "warp" | "burst" | "reveal";

export default function PackReveal({
  cards,
  onClose,
  title = "Your pull",
  showStats = true,
  footer,
  calm = false,
}: {
  cards: CardDef[];
  onClose: () => void;
  title?: string;
  /**
   * Arena cards have no combat stats. Leaving this on would print ATK/HP off
   * the fallback table onto a card whose whole design line is that arena
   * effects never touch combat maths — an active lie on the card face.
   */
  showStats?: boolean;
  /** Shown under the row once every card is out. Survives the calm path. */
  footer?: ReactNode;
  /**
   * Forces the finished spread with no beats. Needed because the app wraps
   * everything in <MotionConfig reducedMotion="never">, which makes framer
   * ignore the OS query outright — so a caller that knows the user wants
   * reduced motion has to say so here.
   */
  calm?: boolean;
}) {
  const reduce = calm || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // Best card last — a pack should crescendo, not peak on the first card.
  const ordered = useMemo(
    () => [...cards].sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order),
    [cards]
  );
  const best = ordered.length ? ordered[ordered.length - 1] : null;
  const bestMeta = best ? RARITY_META[best.rarity] : null;
  const bestOrder = best ? RARITY_META[best.rarity].order : 0;

  // The colour of the whole sequence is decided by the best card BEFORE any of
  // it is shown. That is the tell.
  const tell = bestMeta?.frame || ACCENT;
  const tellGlow = bestMeta?.glow || `${ACCENT}88`;

  const [stage, setStage] = useState<Stage>(reduce ? "reveal" : "warp");
  const [revealed, setRevealed] = useState(reduce ? ordered.length : 0);

  // Beat timing.
  useEffect(() => {
    if (reduce) return;
    if (stage === "warp") {
      const t = setTimeout(() => setStage("burst"), bestOrder >= 3 ? 1500 : 950);
      return () => clearTimeout(t);
    }
    if (stage === "burst") {
      const t = setTimeout(() => setStage("reveal"), 620);
      return () => clearTimeout(t);
    }
  }, [stage, reduce, bestOrder]);

  /**
   * A legendary or better gets taken OUT of the row and shown on its own.
   * Flipping a 4-star in place, in a line of commons, at the same size as the
   * commons, is the single biggest reason a pull can land and feel like
   * nothing happened.
   */
  const [hero, setHero] = useState<CardDef | null>(null);

  // Cards flip one at a time once the reveal starts — paused while a hero card
  // has the screen, so the rest of the pack doesn't resolve behind it.
  useEffect(() => {
    if (reduce || stage !== "reveal" || hero || revealed >= ordered.length) return;
    const t = setTimeout(() => {
      const next = ordered[revealed];
      setRevealed((n) => n + 1);
      if (next && RARITY_META[next.rarity].order >= 3) setHero(next);
    }, revealed === 0 ? 260 : 560);
    return () => clearTimeout(t);
  }, [revealed, ordered, reduce, stage, hero]);

  // The hero card holds the screen, then hands it back.
  useEffect(() => {
    if (!hero) return;
    const t = setTimeout(() => setHero(null), 1900);
    return () => clearTimeout(t);
  }, [hero]);

  const allOut = revealed >= ordered.length;
  const skip = () => { setStage("reveal"); setRevealed(ordered.length); setHero(null); };

  // Flash colour follows the card just flipped, not the final best.
  const peak = revealed > 0 ? ordered[revealed - 1] : null;
  const peakBig = !!peak && RARITY_META[peak.rarity].order >= 2;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center overflow-hidden bg-[#04030a] p-6"
      onClick={() => (allOut ? onClose() : skip())}
    >
      {/* ── ambient field ── present through every beat */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(60% 55% at 50% 50%, ${tellGlow}, transparent 70%)`, opacity: stage === "warp" ? 0.25 : 0.5 }} />

      {/* ── BEAT 1: WARP ── speed lines rushing inward, and a star crossing */}
      <AnimatePresence>
        {stage === "warp" && (
          <motion.div key="warp" className="pointer-events-none absolute inset-0" exit={{ opacity: 0 }}>
            {Array.from({ length: 26 }, (_, i) => {
              const a = (i / 26) * Math.PI * 2;
              return (
                <motion.span key={i} className="absolute left-1/2 top-1/2 origin-left"
                  style={{
                    height: 1.5,
                    background: `linear-gradient(90deg, transparent, ${tell})`,
                    rotate: `${(a * 180) / Math.PI}deg`,
                  }}
                  initial={{ width: 0, x: 520, opacity: 0 }}
                  animate={{ width: [0, 190, 0], x: [520, 40, 0], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 1.1, delay: (i % 7) * 0.07, repeat: Infinity, ease: "easeIn" }}
                />
              );
            })}
            {/* the wishing star */}
            <motion.span className="absolute h-[3px] rounded-full"
              style={{ background: `linear-gradient(90deg, transparent, #fff, ${tell})`, boxShadow: `0 0 22px ${tell}` }}
              initial={{ width: 0, top: "22%", left: "-15%", rotate: 18 }}
              animate={{ width: [0, 320, 0], left: ["-15%", "55%", "115%"] }}
              transition={{ duration: 1.15, ease: "easeInOut" }}
            />
            <motion.p
              className="absolute inset-x-0 bottom-24 text-center text-[11px] font-black uppercase tracking-[0.5em]"
              style={{ color: ACCENT }}
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0.2] }} transition={{ duration: 1.2 }}
            >
              Summoning
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BEAT 2: BURST ── the colour tell */}
      <AnimatePresence>
        {stage === "burst" && (
          <motion.div key="burst" className="pointer-events-none absolute inset-0 grid place-items-center" exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0"
              style={{ background: `radial-gradient(closest-side, #fff, ${tell} 40%, transparent 72%)` }}
              initial={{ scale: 0.05, opacity: 0 }} animate={{ scale: [0.05, 1.5, 2.2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.65, ease: "easeOut" }} />
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute rounded-full"
                style={{ border: `2px solid ${tell}`, width: 200, height: 200 }}
                initial={{ scale: 0.1, opacity: 0.9 }} animate={{ scale: 5.5, opacity: 0 }}
                transition={{ duration: 0.85, delay: i * 0.12, ease: "easeOut" }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* per-card flash on epic+ */}
      <AnimatePresence>
        {stage === "reveal" && peakBig && (
          <motion.div key={`flash-${revealed}`} className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(closest-side, ${RARITY_META[peak!.rarity].glow}, transparent 68%)` }}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: [0, 0.85, 0], scale: [0.7, 1.35, 1.6] }}
            transition={{ duration: 0.95, ease: "easeOut" }} />
        )}
      </AnimatePresence>

      {/* ── HERO PULL ── a legendary gets the whole screen for a moment.
          It spins in, holds, and drops back into the row. Everything here is
          transform + opacity on ONE element, so the spin composites on the GPU
          and never touches layout. */}
      <AnimatePresence>
        {hero && (
          <motion.div
            key={`hero-${hero.id}`}
            className="absolute inset-0 z-[60] grid place-items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* No backdrop-blur here. Blurring a full-screen layer forces a
                re-blur on every frame that anything above it moves, which is
                most of what made this beat stutter. A flat scrim is free. */}
            <div aria-hidden className="absolute inset-0 bg-black/80" />

            {/* Rays. Rotation only — no scale, no opacity keyframes — and the
                element is promoted to its own layer, so the conic gradient is
                rasterised once and the spin is a compositor transform. */}
            <motion.div
              aria-hidden
              className="absolute h-[520px] w-[520px] rounded-full"
              style={{
                background: `conic-gradient(from 0deg, transparent, ${RARITY_META[hero.rarity].glow}, transparent 28%, ${RARITY_META[hero.rarity].glow}, transparent 56%)`,
                opacity: 0.6,
                willChange: "transform",
                transform: "translateZ(0)",
              }}
              initial={{ rotate: 0 }}
              animate={{ rotate: 180 }}
              transition={{ duration: 1.9, ease: "linear" }}
            />

            {/* The card. A spring on a 260px procedural SVG was the actual
                cause of the chop: springs settle in many tiny sub-pixel steps,
                and each one re-rasterises the whole card. A fixed-duration
                tween on a promoted layer scales the already-rasterised bitmap
                instead — same motion, a fraction of the work. */}
            <motion.div
              className="relative"
              initial={{ scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.75, opacity: 0, y: 40 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: "transform, opacity", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
            >
              <CardFace card={hero} owned size={260} showStats={showStats} />
            </motion.div>
            <motion.p
              className="absolute bottom-[18%] text-center text-sm font-black uppercase tracking-[0.4em]"
              style={{ color: RARITY_META[hero.rarity].gem }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            >
              {hero.gradeLabel ?? RARITY_META[hero.rarity].label}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SKIP ── always reachable */}
      {!allOut && (
        <button onClick={(e) => { e.stopPropagation(); skip(); }}
          className="absolute right-5 top-5 z-20 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-slate-300 transition hover:text-white"
          style={{ clipPath: notch(8), background: "rgba(255,255,255,.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}>
          Skip
        </button>
      )}

      {/* ── BEAT 3: REVEAL ── */}
      {stage === "reveal" && (
        <div className="relative z-10 flex flex-col items-center">
          <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-[11px] font-black uppercase tracking-[0.5em]" style={{ color: ACCENT }}>
            {title}
          </motion.p>

          <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-5">
            {ordered.map((c, i) => {
              const out = i < revealed;
              const meta = RARITY_META[c.rarity];
              return (
                <motion.div key={`${c.id}-${i}`} className="relative"
                  initial={{ y: 90, opacity: 0, rotateY: 180 }}
                  animate={out
                    ? { y: 0, opacity: 1, rotateY: 0, scale: 1 }
                    : { y: 22, opacity: 0.9, rotateY: 180, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 180, damping: 18, delay: out ? 0 : i * 0.05 }}
                  style={{ transformStyle: "preserve-3d", perspective: 900 }}
                >
                  {out ? (
                    <>
                      {/* a legendary earns a standing pillar of light */}
                      {meta.order >= 3 && (
                        <motion.span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
                          style={{ width: 190, height: 320, background: `radial-gradient(closest-side, ${meta.glow}, transparent 70%)` }}
                          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.85, scale: 1 }} transition={{ duration: 0.5 }} />
                      )}
                      <CardFace card={c} owned size={150} showStats={showStats} />
                    </>
                  ) : (
                    <CardBack size={150} />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Caller-supplied verdict — new vs duplicate, refunds, collection
              progress. It lives HERE rather than inside the hero overlay
              because the hero never renders on the reduced-motion path, and
              no fact about what you won may exist only inside a motion beat. */}
          <AnimatePresence>
            {allOut && footer && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="mt-7 flex w-full justify-center">
                {footer}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {allOut && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="mt-7 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                Tap anywhere to continue
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

/** The face-down card. A pack you can already read isn't a pack. */
function CardBack({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, aspectRatio: "5 / 7" }}>
      <svg viewBox="0 0 100 140" className="h-full w-full"
        style={{ filter: `drop-shadow(0 8px 20px ${ACCENT}55)` }}>
        <defs>
          <linearGradient id="pb-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#241748" />
            <stop offset="55%" stopColor="#150d2c" />
            <stop offset="100%" stopColor="#0b0718" />
          </linearGradient>
          <radialGradient id="pb-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ACCENT_LIT} stopOpacity="0.95" />
            <stop offset="60%" stopColor={ACCENT} stopOpacity="0.35" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="url(#pb-body)" stroke={ACCENT} strokeWidth="2.5" />
        <rect x="7" y="9" width="86" height="122" rx="5" fill="none" stroke={ACCENT} strokeOpacity="0.35" strokeWidth="0.8" />
        {/* concentric sigil */}
        <circle cx="50" cy="70" r="30" fill="url(#pb-core)" />
        <circle cx="50" cy="70" r="24" fill="none" stroke={ACCENT_LIT} strokeOpacity="0.55" strokeWidth="0.9" />
        <circle cx="50" cy="70" r="17" fill="none" stroke={ACCENT_LIT} strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="3 4" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path key={deg} d="M50 34 L53 44 L50 41 L47 44 Z" fill={ACCENT_LIT} opacity="0.75"
            transform={`rotate(${deg} 50 70)`} />
        ))}
        <path d="M50 56 L60 70 L50 84 L40 70 Z" fill={ACCENT_LIT} opacity="0.9" />
      </svg>
    </div>
  );
}
