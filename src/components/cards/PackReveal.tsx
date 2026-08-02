"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
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

type Stage = "warp" | "hole" | "burst" | "reveal";

/** A legendary copy's minted identity, straight from the pull response. */
export type PulledPrint = { cardId: string; serial: number; condition: string };

const PRINT_META: Record<string, { label: string; cls: string }> = {
  fresh:   { label: "Fresh Build", cls: "border-amber-400/70 bg-amber-500/20 text-amber-200" },
  rusted:  { label: "Rusted",      cls: "border-orange-700/70 bg-orange-950/60 text-orange-300" },
  factory: { label: "Factory New", cls: "border-slate-400/50 bg-slate-800/70 text-slate-200" },
};

export default function PackReveal({
  cards,
  onClose,
  title = "Your pull",
  showStats = true,
  footer,
  calm = false,
  prints = [],
}: {
  cards: CardDef[];
  onClose: () => void;
  title?: string;
  /** Prints minted by THIS pull — legendaries get their condition + serial
   *  stamped as they flip, which is half the drama of pulling one. */
  prints?: PulledPrint[];
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
  // A fullscreen reveal over a scrollable page: without the lock, a phone
  // swipe during the sequence scrolls the ARCHIVE underneath it.
  useLockBodyScroll();

  // Best card last — a pack should crescendo, not peak on the first card.
  const ordered = useMemo(
    () => [...cards].sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order),
    [cards]
  );

  // Prints aligned to the sorted row. Dupes are real (two of the same
  // legendary in one pack mints two serials), so each card CONSUMES a print
  // from its id's queue rather than looking one up.
  const printFor = useMemo(() => {
    const queues: Record<string, PulledPrint[]> = {};
    for (const p of prints) (queues[p.cardId] ||= []).push(p);
    return ordered.map((c) => queues[c.id]?.shift());
  }, [ordered, prints]);
  const best = ordered.length ? ordered[ordered.length - 1] : null;
  const bestMeta = best ? RARITY_META[best.rarity] : null;
  const bestOrder = best ? RARITY_META[best.rarity].order : 0;

  // The colour of the whole sequence is decided by the best card BEFORE any of
  // it is shown. That is the tell.
  const tell = bestMeta?.frame || ACCENT;
  const tellGlow = bestMeta?.glow || `${ACCENT}88`;

  const [stage, setStage] = useState<Stage>(reduce ? "reveal" : "warp");
  const [revealed, setRevealed] = useState(reduce ? ordered.length : 0);

  // One number drives both the beat cut and the comet's travel, so the star
  // always LANDS on the cut to the crash — a star that arrives early hovers,
  // and one that arrives late crashes off-screen.
  const fallMs = bestOrder >= 3 ? 1500 : 950;

  // Beat timing. A legendary-or-better pull gets an extra beat: the fallen
  // star doesn't just crash, it COLLAPSES — warp → hole → burst — so the
  // detonation that follows reads as the black hole letting go.
  useEffect(() => {
    if (reduce) return;
    if (stage === "warp") {
      const t = setTimeout(() => setStage(bestOrder >= 3 ? "hole" : "burst"), fallMs);
      return () => clearTimeout(t);
    }
    if (stage === "hole") {
      const t = setTimeout(() => setStage("burst"), 1250);
      return () => clearTimeout(t);
    }
    if (stage === "burst") {
      const t = setTimeout(() => setStage("reveal"), 620);
      return () => clearTimeout(t);
    }
  }, [stage, reduce, fallMs, bestOrder]);

  /**
   * A legendary or better gets taken OUT of the row and shown on its own.
   * Flipping a 4-star in place, in a line of commons, at the same size as the
   * commons, is the single biggest reason a pull can land and feel like
   * nothing happened.
   */
  const [hero, setHero] = useState<CardDef | null>(null);
  // The hero's INDEX in the row, not just the card — two copies of one
  // legendary are the same object, so indexOf(hero) would pin both hero
  // moments to the first copy's serial.
  const [heroIdx, setHeroIdx] = useState(-1);

  // Cards flip one at a time once the reveal starts — paused while a hero card
  // has the screen, so the rest of the pack doesn't resolve behind it.
  useEffect(() => {
    if (reduce || stage !== "reveal" || hero || revealed >= ordered.length) return;
    const t = setTimeout(() => {
      const next = ordered[revealed];
      setRevealed((n) => n + 1);
      if (next && RARITY_META[next.rarity].order >= 3) { setHero(next); setHeroIdx(revealed); }
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
      initial={{ opacity: 0 }}
      // THE CRASH SHAKES THE SKY. One transform on the root during the impact
      // beat; keyframes end at zero so nothing needs putting back.
      animate={stage === "burst"
        ? { opacity: 1, x: [0, -9, 8, -5, 3, 0], y: [0, 6, -4, 2, 0] }
        : { opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ x: { duration: 0.5, ease: "easeOut" }, y: { duration: 0.5, ease: "easeOut" } }}
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center overflow-hidden bg-[#04030a] p-6"
      onClick={() => (allOut ? onClose() : skip())}
    >
      {/* ── the night sky ── it IS the background now: a field of stars that
          twinkle through every beat, so the falling star has somewhere to
          fall FROM and the reveal happens under the same sky. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 28 }, (_, i) => (
          <motion.span key={i} className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 37) % 100}%`, top: `${(i * 53) % 97}%`,
              width: i % 3 ? 1.5 : 2.5, height: i % 3 ? 1.5 : 2.5,
            }}
            animate={{ opacity: [0.1, 0.65, 0.1] }}
            transition={{ duration: 2 + (i % 5) * 0.7, repeat: Infinity, delay: (i % 7) * 0.5, ease: "easeInOut" }} />
        ))}
      </div>

      {/* ── ambient field ── present through every beat. An epic-or-better
          pull tints the whole sky in its colour from the first frame of the
          fall — a purple star under a purple sky is unmistakable. */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(60% 55% at 50% 50%, ${tellGlow}, transparent 70%)`, opacity: stage === "warp" ? (bestOrder >= 2 ? 0.45 : 0.25) : 0.5 }} />

      {/* ── BEAT 1: THE FALL ── a star drops out of the sky, burning in the
          colour of the best card in the pack — the tell is the fireball. It
          accelerates the whole way down and lands exactly on the cut to the
          crash, because the same fallMs drives both. */}
      <AnimatePresence>
        {stage === "warp" && (
          <motion.div key="warp" className="pointer-events-none absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <div className="absolute left-1/2 top-1/2">
              <motion.div
                initial={{ x: -480, y: -360, scale: 0.5, opacity: 0 }}
                animate={{ x: 0, y: 0, scale: 1.3, opacity: [0, 1, 1] }}
                transition={{ duration: (fallMs - 80) / 1000, ease: [0.5, 0, 0.85, 0.6] }}
                style={{ willChange: "transform" }}
              >
                {/* the assembly is rotated to the travel line (atan2(360, 480)
                    ≈ 37°), so the trail always streams straight back along
                    the path it fell — head at the front, fire behind. */}
                <div className="relative" style={{ transform: "rotate(36.87deg)" }}>
                  <span className="absolute right-0 top-1/2 h-[3px] w-[340px] -translate-y-1/2 rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${tell} 60%, #fff)` }} />
                  <span className="absolute right-0 top-1/2 h-[9px] w-[190px] -translate-y-1/2 rounded-full opacity-40"
                    style={{ background: `linear-gradient(90deg, transparent, ${tell})` }} />
                  <span className="absolute right-[-11px] top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
                    style={{ background: `radial-gradient(circle, #fff 22%, ${tell} 55%, transparent 78%)`, boxShadow: `0 0 26px 7px ${tell}` }} />
                </div>
              </motion.div>
            </div>
            <motion.p
              className="absolute inset-x-0 bottom-24 text-center text-[11px] font-black uppercase tracking-[0.5em]"
              style={{ color: ACCENT }}
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0.2] }} transition={{ duration: 1.2 }}
            >
              A star is falling
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEGENDARY BEAT: THE COLLAPSE ── the star that fell doesn't crash;
          it caves in. The sky goes dark, light bends INWARD — a photon ring
          contracting, sparks spiralling into the centre — around a black core
          wearing a tilted accretion disk in the tell colour. Then the cut to
          the burst reads as the hole letting everything back out at once.
          Transform and opacity only; the disk's tilt is a static transform on
          a wrapper while only the child rotates. */}
      <AnimatePresence>
        {stage === "hole" && (
          <motion.div key="hole" className="pointer-events-none absolute inset-0 grid place-items-center"
            exit={{ opacity: 0, transition: { duration: 0.1 } }}>
            {/* the sky is being eaten */}
            <motion.div className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }} animate={{ opacity: 0.78 }} transition={{ duration: 0.8, ease: "easeOut" }} />

            {/* photon ring — light bending in, not blasting out */}
            <motion.span className="absolute rounded-full"
              style={{ width: 240, height: 240, border: "1.5px solid rgba(255,255,255,.85)", boxShadow: `0 0 30px ${tell}` }}
              initial={{ scale: 2.6, opacity: 0 }} animate={{ scale: 1.06, opacity: [0, 1, 0.85] }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />

            {/* sparks falling IN — the debris animation, reversed, on a slowly
                turning carrier so the infall reads as a spiral */}
            <motion.div className="absolute" initial={{ rotate: 0 }} animate={{ rotate: 80 }}
              transition={{ duration: 1.25, ease: "linear" }}>
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                const dist = 230 + (i % 3) * 60;
                return (
                  <motion.span key={i} className="absolute rounded-full"
                    style={{
                      width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
                      background: i % 2 ? "#fff" : tell, boxShadow: `0 0 8px ${tell}`,
                      willChange: "transform, opacity",
                    }}
                    initial={{ x: Math.cos(a) * dist, y: Math.sin(a) * dist, opacity: 0, scale: 1 }}
                    animate={{ x: 0, y: 0, opacity: [0, 1, 0], scale: 0.2 }}
                    transition={{ duration: 0.85, delay: (i % 4) * 0.12, ease: "easeIn" }} />
                );
              })}
            </motion.div>

            {/* the accretion disk — tilted by the wrapper, spun by the child */}
            <div className="absolute" style={{ transform: "rotate(-18deg) scaleY(0.38)" }}>
              <motion.div className="rounded-full"
                style={{
                  width: 300, height: 300,
                  background: `conic-gradient(from 0deg, transparent 8%, ${tell} 30%, #fff 42%, transparent 55%, ${tell} 78%, transparent 92%)`,
                  WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 63%)",
                  maskImage: "radial-gradient(circle, transparent 58%, black 63%)",
                  willChange: "transform",
                }}
                initial={{ rotate: 0, scale: 0.2, opacity: 0 }}
                animate={{ rotate: 360, scale: 1, opacity: 1 }}
                transition={{ rotate: { duration: 1.3, ease: "linear" }, scale: { duration: 0.5, ease: "easeOut" }, opacity: { duration: 0.35 } }} />
            </div>

            {/* the void itself — black on black works because of the rim */}
            <motion.span className="absolute rounded-full bg-black"
              style={{ width: 150, height: 150, boxShadow: `0 0 60px 14px ${tell}, 0 0 12px 2px rgba(255,255,255,.6)` }}
              initial={{ scale: 0.1 }} animate={{ scale: [0.1, 1.14, 1] }}
              transition={{ duration: 0.7, times: [0, 0.7, 1], ease: "easeOut" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BEAT 2: THE CRASH ── the tell detonates where the star landed:
          flash, shock rings, thrown debris and cracks of light — while the
          root shakes the whole sky. */}
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
            {/* cracks — light escaping along the ground */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span key={`c${i}`} className="absolute left-1/2 top-1/2 origin-left"
                style={{ height: 2, width: 230, background: `linear-gradient(90deg, ${tell}, transparent)`, rotate: `${i * 60 + 8}deg` }}
                initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1, opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }} />
            ))}
            {/* debris thrown out of the crater, with a little lift */}
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const dist = 160 + (i % 4) * 55;
              return (
                <motion.span key={`d${i}`} className="absolute rounded-full"
                  style={{
                    width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3,
                    background: i % 2 ? "#fff" : tell, boxShadow: `0 0 10px ${tell}`,
                    willChange: "transform, opacity",
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(a) * dist, y: Math.sin(a) * dist - 40, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.7 + (i % 3) * 0.12, ease: "easeOut" }} />
              );
            })}
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
            {/* the print — a legendary isn't just "a legendary" anymore, it's
                THIS one: a condition and a number that exists exactly once */}
            {(() => {
              const hp = printFor[heroIdx];
              if (!hp) return null;
              const m = PRINT_META[hp.condition] || PRINT_META.factory;
              return (
                <motion.span
                  className={`absolute bottom-[12%] inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${m.cls}`}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55 }}
                >
                  {m.label}
                  <span className="font-mono normal-case tracking-normal opacity-80">#{String(hp.serial).padStart(3, "0")}</span>
                </motion.span>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── THE CLOUD BED ── the crash settles into weather: soft banks of
          cloud roll up from the bottom of the screen once the reveal starts,
          and the cards float on top of them. Every puff is a radial gradient
          on its own compositor layer — no blur filters, nothing repaints. */}
      {stage === "reveal" && <CloudBed still={reduce} />}

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
                /* THREE WRAPPERS, ONE JOB EACH — entrance, idle float, flip.
                   The old version did all of it with one spring on one element
                   that SWAPPED its contents mid-turn, which is why every card
                   showed its face MIRRORED for the first half of the flip —
                   there was no second side to hide behind, and `perspective`
                   was set on the rotating element itself, where it applies to
                   children and did nothing. This is a real two-sided card: the
                   face is rendered from the start (so its art is decoded
                   before the flip, not popping in after) and stays hidden
                   behind the back until the turn passes 90°. */
                <motion.div key={`${c.id}-${i}`} className="relative"
                  initial={{ y: 90, opacity: 0 }}
                  animate={{ y: out ? 0 : 22, opacity: out ? 1 : 0.95 }}
                  transition={{
                    y: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: out ? 0 : i * 0.06 },
                    opacity: { duration: 0.35, delay: out ? 0 : i * 0.06 },
                  }}
                >
                  {/* face-down cards breathe while they wait their turn —
                      and once revealed they keep a slower, calmer float, so
                      the row reads as resting ON the clouds rather than
                      pinned above them. */}
                  <motion.div
                    animate={out
                      ? (reduce ? { y: 0 } : { y: [0, -5, 0] })
                      : { y: [0, -7, 0] }}
                    transition={out
                      ? (reduce ? { duration: 0.3 } : { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 + i * 0.35 })
                      : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                  >
                    {/* the pillar lives OUTSIDE the 3D flipper so it doesn't spin */}
                    {out && meta.order >= 3 && (
                      <motion.span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: 190, height: 320, background: `radial-gradient(closest-side, ${meta.glow}, transparent 70%)` }}
                        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.85, scale: 1 }} transition={{ duration: 0.5 }} />
                    )}
                    <motion.div className="relative"
                      initial={false}
                      animate={{ rotateY: out ? 0 : 180, scale: out ? [1, 1.07, 1] : 1 }}
                      transition={{
                        rotateY: { duration: 0.55, ease: [0.45, 0, 0.2, 1] },
                        scale: { duration: 0.55, times: [0, 0.55, 1], ease: "easeOut" },
                      }}
                      style={{ transformStyle: "preserve-3d", transformPerspective: 1000, willChange: "transform" }}
                    >
                      <div className="relative" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                        <CardFace card={c} owned size={150} showStats={showStats} />
                        {/* the copy's minted identity — condition + serial */}
                        {out && printFor[i] && (
                          <span className={`pointer-events-none absolute inset-x-1 bottom-1 z-10 flex items-center justify-center gap-1 rounded-md border px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${(PRINT_META[printFor[i]!.condition] || PRINT_META.factory).cls}`}>
                            {(PRINT_META[printFor[i]!.condition] || PRINT_META.factory).label}
                            <span className="font-mono normal-case tracking-normal opacity-80">#{String(printFor[i]!.serial).padStart(3, "0")}</span>
                          </span>
                        )}
                      </div>
                      <div className="absolute inset-0"
                        style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        <CardBack size={150} />
                      </div>
                    </motion.div>
                  </motion.div>
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

/**
 * SOFT CLOUDS for the reveal to rest on. Twelve overlapping puffs — flat
 * radial gradients, deterministically placed by index — rise into the lower
 * half of the screen and wander slowly sideways. A faint haze floor under
 * them keeps the puffs reading as a bank rather than separate blobs.
 * `still` renders the same weather frozen, for the reduced-motion path.
 */
function CloudBed({ still = false }: { still?: boolean }) {
  const puffs = Array.from({ length: 12 }, (_, i) => ({
    left: (i * 83) % 100,
    bottom: (i * 37) % 34,
    size: 180 + ((i * 61) % 240),
    dur: 9 + (i % 5) * 2.4,
    delay: (i % 7) * 0.9,
    drift: 26 + ((i * 29) % 40),
    tint: i % 3 === 0,
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "52%" }}>
      <div className="absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: "linear-gradient(to top, rgba(190,170,255,.10), rgba(190,170,255,.035) 55%, transparent)" }} />
      {puffs.map((p, i) => (
        <motion.span key={i} className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: p.size,
            height: Math.round(p.size * 0.42),
            marginLeft: -p.size / 2,
            background: p.tint
              ? "radial-gradient(closest-side, rgba(203,180,255,.16), rgba(203,180,255,.05) 60%, transparent 75%)"
              : "radial-gradient(closest-side, rgba(255,255,255,.13), rgba(255,255,255,.045) 60%, transparent 75%)",
            willChange: still ? undefined : "transform",
          }}
          initial={{ opacity: 0, y: 26 }}
          animate={still
            ? { opacity: 1, y: 0 }
            : { opacity: 1, y: 0, x: [0, p.drift, 0, -p.drift, 0] }}
          transition={{
            opacity: { duration: 1.1, delay: 0.15 + p.delay * 0.12 },
            y: { duration: 1.1, delay: 0.15 + p.delay * 0.12, ease: [0.22, 1, 0.36, 1] },
            ...(still ? {} : { x: { duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" } }),
          }}
        />
      ))}
    </div>
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
