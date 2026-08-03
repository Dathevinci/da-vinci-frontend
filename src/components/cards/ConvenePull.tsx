"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CardFace, { CardDef, RARITY_META } from "./CardFace";
import { cardArt } from "@/data/cardArt";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

/**
 * CONVENE — the pull as a rite of light.
 *
 * PRESENTATION ONLY, same contract as every reveal before it: the server's
 * decided results come in (cards + minted prints), a promise-shaped overlay
 * plays them back, and skipping can never drop or alter a result because
 * the result was final before frame one.
 *
 * The visual language, per spec: a near-black void, everything on one
 * rippling rhythm, LIGHT doing the work — long streaks converging on a
 * point, each carrying the rarity colour of one result, so a multi's
 * quality is readable mid-flight by counting the gold in the sky.
 *
 * Adaptations to this game, stated plainly:
 *  - tiers here are the real pull sizes (1 / 3 / 4 / 8); the wall lays out
 *    a row up to 4 and a 4×2 grid at 8. The 16/32 layouts follow the same
 *    rule if those tiers ever exist.
 *  - rarity mapping: common ★1 / rare ★2 / epic ★3 / legendary ★4, event
 *    on the ★3 track in its own pink.
 *  - no per-card cinematics exist, so every legendary gets the generic
 *    gold blackout-rift. `cinematicId` has nowhere to point yet.
 *  - deliberately NO audio — sound was removed from this screen by the
 *    owner once already. The "tonal shift" is colour and rhythm.
 *  - no backdrop-filter refraction (banned for perf on this site); the
 *    warp is sold with rings, scale and brief chromatic fringing instead.
 *  - streaks and rings are POOLED — a fixed set of nodes animating in CSS,
 *    never instantiated per pull.
 */

type PulledPrint = { cardId: string; serial: number; condition: string };

const AURA: Record<string, string> = {
  common: "#cfd8e3", rare: "#22d3ee", epic: "#a274ff", legendary: "#fbbf24", event: "#ff8ad0",
};
const STARS: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 4, event: 3 };
const PRINT_CLS: Record<string, string> = {
  fresh: "border-amber-400/60 bg-amber-500/15 text-amber-200",
  rusted: "border-orange-700/60 bg-orange-900/40 text-orange-300",
  factory: "border-slate-400/40 bg-slate-600/30 text-slate-200",
};
const PRINT_LABEL: Record<string, string> = { fresh: "Fresh Build", rusted: "Rusted", factory: "Factory New" };
const isBig = (r: string) => r === "epic" || r === "legendary" || r === "event";

const STREAK_POOL = 26;

export default function ConvenePull({
  cards,
  onClose,
  title = "Convene",
  showStats = true,
  prints = [],
}: {
  cards: CardDef[];
  onClose: () => void;
  title?: string;
  showStats?: boolean;
  footer?: React.ReactNode;
  calm?: boolean;
  prints?: PulledPrint[];
}) {
  useLockBodyScroll();
  const reduce = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [skipAll, setSkipAll] = useState<boolean>(() => {
    try { return localStorage.getItem("davinci_skip_pull_anim") === "1"; } catch { return false; }
  });

  // Wall order is ROLL order (reading the batch), but the features walk
  // epics first, then legendaries — the crescendo lives in the features.
  const wall = cards;
  const best = useMemo(() => {
    const sorted = [...cards].sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order);
    return sorted.length ? sorted[sorted.length - 1] : null;
  }, [cards]);
  const bestColor = best ? AURA[best.rarity] : AURA.common;
  const hasLegend = cards.some((c) => c.rarity === "legendary");
  const featureQueue = useMemo(() => {
    const epics = wall.map((c, i) => ({ c, i })).filter((x) => x.c.rarity === "epic" || x.c.rarity === "event");
    const legends = wall.map((c, i) => ({ c, i })).filter((x) => x.c.rarity === "legendary");
    return [...epics, ...legends];
  }, [wall]);

  // Prints attach to copies in roll order.
  const printFor = useMemo(() => {
    const queues: Record<string, PulledPrint[]> = {};
    for (const p of prints) (queues[p.cardId] ||= []).push(p);
    return wall.map((c) => queues[c.id]?.shift());
  }, [wall, prints]);

  /**
   * STAGES
   *   void → converge → (blackout → rift, legendary only) → impact →
   *   cascade (★1/★2 sweep) → feature[k] (★3 then ★4, one at a time) → idle
   * Re-entrant by construction: transitions are timers keyed off current
   * stage; unmount clears every timer; spamming taps only ever moves
   * FORWARD through the same list.
   */
  type Stage = "void" | "converge" | "blackout" | "rift" | "impact" | "cascade" | "feature" | "idle";
  const [stage, setStage] = useState<Stage>(reduce || skipAll ? "idle" : "void");
  const [flipped, setFlipped] = useState<boolean[]>(() =>
    wall.map(() => reduce || skipAll ? true : false));
  const [featIdx, setFeatIdx] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Preload every result's paint before the first frame.
  useEffect(() => {
    for (const c of wall) for (const s of [150, 260]) {
      const src = cardArt(c.id, c.art, s);
      if (src) { const im = new window.Image(); im.src = src; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The rhythm. Epic+ holds the convergence 400ms longer — the hang IS the tell.
  useEffect(() => {
    if (stage === "void") later(() => setStage("converge"), 300);
    if (stage === "converge") later(
      () => setStage(hasLegend ? "blackout" : "impact"),
      1100 + (isBig(best?.rarity || "common") ? 400 : 0)
    );
    if (stage === "blackout") later(() => setStage("rift"), 600);
    if (stage === "rift") later(() => setStage("impact"), 1000);
    if (stage === "impact") later(() => setStage("cascade"), hasLegend ? 450 : 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Cascade: every ★1/★2 flips in a fast sweep; features follow.
  useEffect(() => {
    if (stage !== "cascade") return;
    let delay = 120;
    wall.forEach((c, i) => {
      if (!isBig(c.rarity)) {
        later(() => setFlipped((f) => f.map((v, j) => (j === i ? true : v))), delay);
        delay += 40;
      }
    });
    later(() => setStage(featureQueue.length ? "feature" : "idle"), delay + 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Features: each ★3 rises for its 600ms; each ★4 gets the dim + rift.
  useEffect(() => {
    if (stage !== "feature") return;
    const f = featureQueue[featIdx];
    if (!f) { setStage("idle"); return; }
    const legend = f.c.rarity === "legendary";
    later(() => setFlipped((fl) => fl.map((v, j) => (j === f.i ? true : v))), legend ? 900 : 250);
    later(() => {
      if (featIdx + 1 < featureQueue.length) setFeatIdx((k) => k + 1);
      else setStage("idle");
    }, legend ? 2200 : 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, featIdx]);

  /** Tap once → jump to impact (wall + commons up). Tap again → everything. */
  const tap = () => {
    if (stage === "idle") { onClose(); return; }
    if (stage === "void" || stage === "converge" || stage === "blackout" || stage === "rift" || stage === "impact") {
      setStage("cascade");
      return;
    }
    setFlipped(wall.map(() => true));
    setStage("idle");
  };

  const toggleSkip = (v: boolean) => {
    setSkipAll(v);
    try { localStorage.setItem("davinci_skip_pull_anim", v ? "1" : "0"); } catch {}
  };

  // Streak pool colouring: cycle through the batch so the sky carries the
  // batch's composition — count the gold mid-flight.
  const streakColors = useMemo(
    () => Array.from({ length: STREAK_POOL }, (_, i) => AURA[wall[i % wall.length]?.rarity || "common"]),
    [wall]
  );

  const featured = stage === "feature" ? featureQueue[featIdx] : null;
  const legendFeature = featured?.c.rarity === "legendary";
  const wallVisible = stage === "cascade" || stage === "feature" || stage === "idle";
  const cardSize = wall.length > 4 ? 128 : wall.length > 1 ? 150 : 190;
  const blackoutish = stage === "blackout" || stage === "rift";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden"
      style={{ background: blackoutish ? "#000" : "#030308" }}
      onClick={tap}
    >
      {/* drifting motes — always on, the void is never quite still */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="cv-mote absolute block rounded-full"
              style={{
                width: 3, height: 3, left: `${(i * 83) % 100}%`, top: `${(i * 47) % 100}%`,
                background: "rgba(180,190,220,.5)", animationDelay: `${(i * 700) % 4000}ms`,
              }} />
          ))}
        </div>
      )}

      {/* ── CONVERGENCE ── the point ignites, rings ripple on the rhythm,
          pooled streaks fly in carrying the batch's colours. */}
      {(stage === "void" || stage === "converge" || stage === "impact") && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center"
          style={{ perspective: "700px" }}>
          {/* the point */}
          <span className={stage === "void" && !reduce ? "cv-ignite" : ""}
            style={{
              position: "absolute", width: 6, height: 6, borderRadius: 999,
              background: "#fff", boxShadow: `0 0 24px 6px ${stage === "void" ? "#9fb2d8" : bestColor}`,
            }} />
          {/* ripple rings, one rhythm */}
          {!reduce && stage !== "void" && [0, 1, 2].map((i) => (
            <span key={i} className="cv-ring absolute rounded-full border-2"
              style={{ width: 40, height: 40, borderColor: bestColor, animationDelay: `${i * 380}ms` }} />
          ))}
          {/* streak pool — long thin light, blurred at the edges, converging */}
          {!reduce && stage === "converge" && (
            <div className="absolute left-1/2 top-1/2 h-0 w-0">
              {streakColors.map((col, i) => (
                <span key={i} className="cv-streak absolute block"
                  style={{
                    height: 2, width: "38vmax",
                    background: `linear-gradient(90deg, transparent, ${col})`,
                    boxShadow: `0 0 8px ${col}`,
                    // The angle rides a CSS variable — the keyframes own
                    // `transform`, so an inline transform would be overridden
                    // and every streak would fly the same direction.
                    ["--r" as any]: `${(i * 360) / STREAK_POOL}deg`,
                    transformOrigin: "left center",
                    animationDelay: `${(i * 53) % 500}ms`,
                    filter: i % 3 === 0 ? "blur(2px)" : undefined, // foreground pass, blurred past the camera
                  }} />
              ))}
            </div>
          )}
          {/* impact: shockwave + white-out, longer and brighter after a rift */}
          {stage === "impact" && !reduce && (
            <>
              <span className="cv-shock absolute rounded-full border-4" style={{ width: 60, height: 60, borderColor: bestColor }} />
              <span className="cv-whiteout absolute inset-0" style={{ background: "#fff" }} />
            </>
          )}
        </div>
      )}

      {/* ── LEGENDARY RIFT ── total black, one gold line, then it splits. */}
      {blackoutish && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className={stage === "blackout" ? "cv-line" : "cv-rift"}
            style={{ background: AURA.legendary, boxShadow: `0 0 30px 4px ${AURA.legendary}` }} />
          {stage === "rift" && (
            <span className="cv-riftglow absolute" style={{
              width: "40vmin", height: "70vmin",
              background: `radial-gradient(ellipse at center, ${AURA.legendary}33, transparent 70%)`,
            }} />
          )}
        </div>
      )}

      {/* ── THE WALL ── impact resolves the batch at once; commons sweep,
          epics rise, legendaries rise LAST over a dimmed field. */}
      {wallVisible && (
        <div className="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col items-center overflow-y-auto px-3 py-6">
          <p className="mb-1 text-[13px] font-black uppercase tracking-[0.34em] text-white">{title}</p>
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: bestColor }}>
            {stage === "idle" ? "Tap anywhere to keep them" : "…"}
          </p>
          <div className={`grid justify-items-center gap-3 ${wall.length > 4 ? "grid-cols-2 sm:grid-cols-4" : ""}`}
            style={wall.length <= 4 ? { gridTemplateColumns: `repeat(${Math.min(wall.length, 4)}, minmax(0, 1fr))` } : undefined}>
            {wall.map((c, i) => {
              const out = flipped[i];
              const isFeat = featured?.i === i;
              return (
                <div key={i}
                  className={`relative transition-opacity duration-300 ${featured && !isFeat ? "opacity-25" : "opacity-100"}`}
                  style={{ minHeight: Math.round((cardSize * 9) / 5) + 26 }}>
                  {!out ? (
                    // sealed: a slab of light breathing in the card's colour
                    <div className={reduce ? "" : "cv-breathe"}
                      style={{
                        width: cardSize, height: Math.round((cardSize * 9) / 5), borderRadius: 10,
                        background: "linear-gradient(170deg, #0b0918, #060410)",
                        boxShadow: `0 0 ${isBig(c.rarity) ? 26 : 10}px ${AURA[c.rarity]}${isBig(c.rarity) ? "aa" : "44"}, inset 0 0 0 1px ${AURA[c.rarity]}55`,
                      }} />
                  ) : (
                    <div className={reduce ? "" : isFeat && legendFeature ? "cv-slam" : "cv-lock"}>
                      <div className={isFeat && legendFeature && !reduce ? "cv-fringe" : ""}>
                        <CardFace card={c} owned size={cardSize} showStats={showStats} />
                      </div>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: STARS[c.rarity] || 1 }, (_, sIdx) => (
                          <span key={sIdx} className={reduce ? "" : "cv-star"}
                            style={{ animationDelay: `${120 + sIdx * 110}ms`, color: AURA[c.rarity] }}>★</span>
                        ))}
                      </div>
                      {printFor[i] && (
                        <span className={`pointer-events-none absolute inset-x-1 bottom-7 z-10 flex items-center justify-center gap-1 rounded-md border px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${PRINT_CLS[printFor[i]!.condition] || PRINT_CLS.factory}`}>
                          {PRINT_LABEL[printFor[i]!.condition] || printFor[i]!.condition} · #{String(printFor[i]!.serial).padStart(3, "0")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {stage === "idle" && (
            <div className="mt-6 flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={onClose}
                className="rounded-full px-7 py-2.5 text-[11px] font-black uppercase tracking-[0.24em] text-white transition hover:brightness-115"
                style={{ background: `linear-gradient(100deg, #312256, ${bestColor}44)`, boxShadow: `inset 0 0 0 1px ${bestColor}66` }}>
                Take them
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                <input type="checkbox" checked={skipAll} onChange={(e) => toggleSkip(e.target.checked)} className="accent-[#a274ff]" />
                Skip animations
              </label>
            </div>
          )}
        </div>
      )}

      {/* mini blackout behind a featured legendary — the grid stays, dimmed */}
      {legendFeature && !reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "rgba(0,0,0,.6)" }} />
      )}

      <style jsx global>{`
        .cv-mote { animation: cvMote 5s ease-in-out infinite; }
        @keyframes cvMote { 0%, 100% { transform: translate(0, 0); opacity: .2; } 50% { transform: translate(10px, -16px); opacity: .7; } }
        .cv-ignite { animation: cvIgnite .3s ease-out backwards; }
        @keyframes cvIgnite { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .cv-ring { animation: cvRing 1.15s cubic-bezier(.16,.84,.44,1) infinite; }
        @keyframes cvRing { from { transform: scale(.2); opacity: .9; } to { transform: scale(14); opacity: 0; } }
        .cv-streak { animation: cvStreak .7s cubic-bezier(.55,0,.85,.4) infinite; }
        @keyframes cvStreak { from { transform: rotate(var(--r, 0deg)) scaleX(1); opacity: 0; } 15% { opacity: 1; } to { transform: rotate(var(--r, 0deg)) scaleX(.04); opacity: .9; } }
        .cv-shock { animation: cvShock .5s cubic-bezier(.16,.84,.44,1) forwards; }
        @keyframes cvShock { from { transform: scale(.3); opacity: 1; } to { transform: scale(18); opacity: 0; } }
        .cv-whiteout { animation: cvWhite .45s ease-out forwards; }
        @keyframes cvWhite { from { opacity: .95; } to { opacity: 0; } }
        .cv-line { width: 0; height: 2px; animation: cvLine .6s cubic-bezier(.2,.9,.3,1) forwards; }
        @keyframes cvLine { from { width: 0; } to { width: 78vw; } }
        .cv-rift { width: 78vw; height: 2px; animation: cvRift .9s cubic-bezier(.6,0,.8,.4) forwards; }
        @keyframes cvRift { from { transform: scaleY(1); } to { transform: scaleY(90); opacity: .9; } }
        .cv-riftglow { animation: cvGlow .9s ease-out backwards; }
        @keyframes cvGlow { from { opacity: 0; } to { opacity: 1; } }
        .cv-breathe { animation: cvBreathe 1.6s ease-in-out infinite; }
        @keyframes cvBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
        .cv-lock { animation: cvLock .32s cubic-bezier(.2,1.4,.4,1) backwards; }
        @keyframes cvLock { from { transform: scale(.7) rotate(2deg); opacity: 0; } 70% { transform: scale(1.06); opacity: 1; } to { transform: scale(1); } }
        .cv-slam { animation: cvSlam .5s cubic-bezier(.2,1.3,.3,1) backwards; }
        @keyframes cvSlam { from { transform: scale(1.7); opacity: 0; } 60% { transform: scale(.97); opacity: 1; } to { transform: scale(1); } }
        .cv-star { display: inline-block; font-size: 12px; animation: cvStar .2s cubic-bezier(.2,1.6,.4,1) backwards; }
        @keyframes cvStar { from { transform: scale(2.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .cv-fringe { animation: cvFringe .6s ease-out; }
        @keyframes cvFringe {
          0% { filter: drop-shadow(4px 0 0 rgba(255,60,90,.6)) drop-shadow(-4px 0 0 rgba(40,200,255,.6)); }
          100% { filter: none; }
        }
      `}</style>
    </motion.div>
  );
}
