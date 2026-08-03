"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CardFace, { CardDef, RARITY_META } from "./CardFace";
import { cardArt } from "@/data/cardArt";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

/**
 * PIXEL PULL — the gacha reveal as a retro altar rite.
 *
 * PRESENTATION ONLY. It receives results the server already decided (same
 * contract as the old PackReveal: cards + prints in, onClose out) and plays
 * them back. Nothing here rolls, prices, or writes — skipping can never lose
 * or alter a result because the result was final before the first frame.
 *
 * The read on the spec, adapted to this game:
 *  - rarity stars: common ★1 · rare ★2 · epic ★3 · legendary ★4 (event rides
 *    the ★3 track in its own pink).
 *  - pulls come in 1 / 3 / 4 / 8, not 10 — the fan and the summary grid size
 *    themselves to the batch.
 *  - the BEST card reveals last regardless of roll order (kept from the old
 *    reveal — a pull should crescendo).
 *  - deliberately NO audio: sound was built for this screen once already and
 *    the owner had it removed. The star ticks are visual stamps.
 *  - stepped easing everywhere: steps() timing and hard snaps, no silk.
 */

type PulledPrint = { cardId: string; serial: number; condition: string };

const STAR_COUNT: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 4, event: 3 };
const AURA: Record<string, string> = {
  common: "#cbd5e1", rare: "#5fa8ff", epic: "#c07dff", legendary: "#fbbf24", event: "#ff8ad0",
};
const PRINT_CLS: Record<string, string> = {
  fresh: "border-amber-400/60 bg-amber-500/15 text-amber-200",
  rusted: "border-orange-700/60 bg-orange-900/40 text-orange-300",
  factory: "border-slate-400/40 bg-slate-600/30 text-slate-200",
};
const PRINT_LABEL: Record<string, string> = { fresh: "Fresh Build", rusted: "Rusted", factory: "Factory New" };

/** big = the two tension tiers: longer aura hold, and legendary gets the rune beat. */
const isBig = (r: string) => r === "epic" || r === "legendary" || r === "event";

export default function PixelPull({
  cards,
  onClose,
  title = "Your pull",
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
  // Settings toggle: straight to the grid, every time, until switched off.
  const [skipAll, setSkipAll] = useState<boolean>(() => {
    try { return localStorage.getItem("davinci_skip_pull_anim") === "1"; } catch { return false; }
  });

  // Best last — the crescendo rule.
  const ordered = useMemo(
    () => [...cards].sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order),
    [cards]
  );
  const best = ordered.length ? ordered[ordered.length - 1] : null;
  const bestAura = best ? AURA[best.rarity] : AURA.common;

  // Each pulled legendary copy consumes its minted print, in order.
  const printFor = useMemo(() => {
    const queues: Record<string, PulledPrint[]> = {};
    for (const p of prints) (queues[p.cardId] ||= []).push(p);
    return ordered.map((c) => queues[c.id]?.shift());
  }, [ordered, prints]);

  /**
   * STAGES — one machine, re-entrant by construction: every transition is a
   * timer keyed off the CURRENT stage in state, and unmount clears them all.
   *  gather → rise → beat (legendary only) → reveal(i)… → grid
   * `shown` counts face-up cards; the reveal loop walks left to right.
   */
  const [stage, setStage] = useState<"gather" | "rise" | "beat" | "reveal" | "grid">(
    reduce || (typeof window !== "undefined" && localStorage.getItem("davinci_skip_pull_anim") === "1")
      ? "grid" : "gather"
  );
  const [shown, setShown] = useState(stage === "grid" ? ordered.length : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Preload EVERY art before frame one — the flip must show paint, not a
  // spinner. (Both the fan size and the grid size.)
  useEffect(() => {
    for (const c of ordered) {
      for (const s of [150, 260]) {
        const src = cardArt(c.id, c.art, s);
        if (src) { const im = new window.Image(); im.src = src; }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The timeline. Held ~300ms longer when the best is epic+ — the tell is
  // the aura, and tension is the point of a tell.
  useEffect(() => {
    if (stage === "gather") later(() => setStage("rise"), 400);
    if (stage === "rise") later(() => setStage(best && best.rarity === "legendary" ? "beat" : "reveal"),
      isBig(best?.rarity || "common") ? 800 : 500);
    if (stage === "beat") later(() => setStage("reveal"), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Reveal left to right, ~180ms apart; everything face-up → the grid.
  useEffect(() => {
    if (stage !== "reveal") return;
    if (shown >= ordered.length) { later(() => setStage("grid"), 700); return; }
    later(() => setShown((n) => n + 1), shown === 0 ? 120 : 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, shown]);

  /** Tap once: jump to the reveal. Tap again: dismiss to the grid is already
   *  there, so the second tap closes. Results can't change — they came in. */
  const tap = () => {
    if (stage === "grid") { onClose(); return; }
    if (stage !== "reveal" || shown < ordered.length) { setShown(ordered.length); setStage("grid"); return; }
    setStage("grid");
  };

  const toggleSkip = (v: boolean) => {
    setSkipAll(v);
    try { localStorage.setItem("davinci_skip_pull_anim", v ? "1" : "0"); } catch {}
  };

  const legendaryBeat = best?.rarity === "legendary";
  const dark = stage === "beat";
  const cardSize = ordered.length > 4 ? 116 : 150;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: dark ? "#020204" : "#07040d", imageRendering: "pixelated" }}
      onClick={tap}
    >
      {/* scanlines + vignette — the CRT read, two cheap layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,.5) 3px 4px)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 140px rgba(0,0,0,.85)" }} />

      {/* ── RUNE CIRCLE ── legendary beat: draws itself outward, then stays
          faint behind the reveal. Stepped dashes, not a smooth sweep. */}
      {legendaryBeat && (stage === "beat" || stage === "reveal" || stage === "grid") && !reduce && (
        <div aria-hidden className="pp-rune pointer-events-none absolute"
          style={{ width: "80vmin", height: "80vmin", color: bestAura, opacity: stage === "beat" ? 1 : 0.18 }}>
          <div className="absolute inset-0 rounded-full border-4 border-current" style={{ borderStyle: "dashed" }} />
          <div className="absolute inset-[12%] rounded-full border-2 border-current" style={{ borderStyle: "dotted" }} />
          <div className="absolute inset-[26%] rotate-45 border-2 border-current" />
          <div className="absolute inset-[26%] border-2 border-current" />
        </div>
      )}

      {/* ── THE ALTAR ── low-poly by way of stacked pixel slabs in fake
          perspective; the energy gathers into its centre on stage one. */}
      {(stage === "gather" || stage === "rise" || stage === "beat") && (
        <div className={`relative flex flex-col items-center ${stage === "gather" && !reduce ? "pp-pushin" : ""}`}>
          {/* sealed card(s) rising out of the slab, face-down, aura tell on */}
          {(stage === "rise" || stage === "beat") && (
            <div className="mb-[-14px] flex items-end justify-center" style={{ gap: ordered.length > 4 ? 6 : 12 }}>
              {ordered.map((c, i) => (
                <div key={i} className={reduce ? "" : "pp-rise"} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`relative ${reduce ? "" : "pp-spin"}`}
                    style={{
                      width: ordered.length > 4 ? 44 : 64,
                      height: ordered.length > 4 ? 62 : 90,
                      background: "linear-gradient(#1b1230, #0d0919)",
                      border: "3px solid #2b2145",
                      boxShadow: `0 0 ${isBig(c.rarity) ? 26 : 10}px ${AURA[c.rarity]}${isBig(c.rarity) ? "cc" : "66"}, inset 0 0 0 2px #120c22`,
                    }}>
                    <span className="absolute inset-0 grid place-items-center font-pixel text-[10px]" style={{ color: AURA[c.rarity] }}>?</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* the slab stack */}
          <div className="relative" style={{ width: 300, height: 92 }}>
            <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{ width: 220, height: 26, background: "#241a3e", border: "3px solid #3a2c60", transform: "translateX(-50%) perspective(240px) rotateX(48deg)" }} />
            <div className="absolute left-1/2 top-[22px] -translate-x-1/2" style={{ width: 260, height: 30, background: "#1b1230", border: "3px solid #2f2450" }} />
            <div className="absolute left-1/2 top-[52px] -translate-x-1/2" style={{ width: 300, height: 34, background: "#120c22", border: "3px solid #241a3e" }} />
            {/* gathered energy: pooled particles, looping — never re-created */}
            {!reduce && (
              <div aria-hidden className="absolute left-1/2 top-[-6px] h-0 w-0">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className="pp-mote absolute block"
                    style={{
                      width: 4, height: 4, background: stage === "gather" ? "#9b8ac9" : bestAura,
                      animationDelay: `${(i * 137) % 900}ms`,
                      ["--ang" as any]: `${i * 36}deg`,
                    }} />
                ))}
              </div>
            )}
          </div>
          <p className="mt-5 font-pixel text-[10px] tracking-[0.3em] text-[#8f86b8]">
            {stage === "gather" ? "THE ALTAR STIRS" : stage === "beat" ? "..." : "SOMETHING RISES"}
          </p>
        </div>
      )}

      {/* ── REVEAL + GRID ── the fan reveals left to right; the same nodes
          collapse into the summary grid (no remount, nothing to lose). */}
      {(stage === "reveal" || stage === "grid") && (
        <div className={`relative flex max-h-[92dvh] w-full max-w-5xl flex-col items-center overflow-y-auto px-3 py-6 ${
          stage === "reveal" && shown === ordered.length && best?.rarity === "legendary" && !reduce ? "pp-shake" : ""}`}>
          <p className="mb-1 font-pixel text-[12px] tracking-[0.28em] text-white">{title.toUpperCase()}</p>
          <p className="mb-4 font-pixel text-[9px] tracking-[0.2em]" style={{ color: bestAura }}>
            {stage === "grid" ? "TAP ANYWHERE TO KEEP THEM" : "REVEALING…"}
          </p>
          <div className={`flex flex-wrap items-start justify-center ${stage === "grid" ? "gap-3" : "gap-4"}`}>
            {ordered.map((c, i) => {
              const out = i < shown;
              const stars = STAR_COUNT[c.rarity] || 1;
              const flashy = out && isBig(c.rarity) && !reduce;
              return (
                <div key={i} className="relative flex flex-col items-center"
                  style={{ minWidth: cardSize, minHeight: Math.round((cardSize * 9) / 5) + 34 }}>
                  {!out ? (
                    <div className="relative"
                      style={{
                        width: cardSize, height: Math.round((cardSize * 9) / 5),
                        background: "linear-gradient(#1b1230, #0d0919)", border: "3px solid #2b2145",
                        boxShadow: `0 0 ${isBig(c.rarity) ? 24 : 8}px ${AURA[c.rarity]}${isBig(c.rarity) ? "bb" : "55"}`,
                      }}>
                      <span className="absolute inset-0 grid place-items-center font-pixel text-sm" style={{ color: AURA[c.rarity] }}>?</span>
                    </div>
                  ) : (
                    <div className={reduce ? "" : "pp-flip"}>
                      {/* the flash frame — one hard white pop on flip, bigger for epic+ */}
                      {flashy && <span aria-hidden className="pp-flash pointer-events-none absolute inset-[-20%] z-10"
                        style={{ background: `radial-gradient(circle, #ffffff 0%, ${AURA[c.rarity]}88 45%, transparent 70%)` }} />}
                      <div className={flashy && c.rarity === "legendary" ? "pp-aberrate" : ""}>
                        <CardFace card={c} owned size={cardSize} showStats={showStats} />
                      </div>
                      {/* rarity stars stamp in one at a time — visual ticks */}
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: stars }, (_, sIdx) => (
                          <span key={sIdx} className={reduce ? "" : "pp-stamp"} style={{ animationDelay: `${140 + sIdx * 120}ms`, color: AURA[c.rarity] }}>
                            <span className="font-pixel text-[11px]">★</span>
                          </span>
                        ))}
                      </div>
                      {/* the copy's minted identity — condition + serial */}
                      {printFor[i] && (
                        <span className={`pointer-events-none absolute inset-x-1 bottom-8 z-10 flex items-center justify-center gap-1 rounded-md border px-1 py-0.5 font-pixel text-[8px] ${PRINT_CLS[printFor[i]!.condition] || PRINT_CLS.factory}`}>
                          {PRINT_LABEL[printFor[i]!.condition] || printFor[i]!.condition} · #{String(printFor[i]!.serial).padStart(3, "0")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {stage === "grid" && (
            <div className="mt-6 flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={onClose}
                className="border-4 border-[#3a2c60] bg-[#1b1230] px-6 py-2.5 font-pixel text-[11px] tracking-[0.2em] text-white transition active:translate-y-[2px]">
                TAKE THEM
              </button>
              <label className="flex cursor-pointer items-center gap-2 font-pixel text-[9px] tracking-[0.14em] text-[#8f86b8]">
                <input type="checkbox" checked={skipAll} onChange={(e) => toggleSkip(e.target.checked)} className="accent-[#a274ff]" />
                SKIP ANIMATIONS
              </label>
            </div>
          )}
        </div>
      )}

      {/* stepped keyframes — steps() everywhere so it reads retro, and every
          particle/star is a fixed node that loops, never re-instantiated */}
      <style jsx global>{`
        .pp-pushin { animation: ppPush .4s steps(4) forwards; }
        @keyframes ppPush { from { transform: scale(.94); } to { transform: scale(1); } }
        .pp-rise { animation: ppRise .5s steps(6) backwards; }
        @keyframes ppRise { from { transform: translateY(70px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .pp-spin { animation: ppSpin .9s steps(8) infinite; }
        @keyframes ppSpin { 0% { transform: rotateY(0); } 100% { transform: rotateY(360deg); } }
        .pp-mote { animation: ppMote .9s steps(6) infinite; border-radius: 0; }
        @keyframes ppMote {
          from { transform: rotate(var(--ang)) translateX(120px); opacity: 0; }
          30% { opacity: 1; }
          to { transform: rotate(var(--ang)) translateX(6px); opacity: 0; }
        }
        .pp-flip { animation: ppFlip .28s steps(4) backwards; }
        @keyframes ppFlip { from { transform: rotateY(90deg) scale(.9); } 70% { transform: rotateY(0) scale(1.06); } to { transform: rotateY(0) scale(1); } }
        .pp-flash { animation: ppFlash .5s steps(5) forwards; }
        @keyframes ppFlash { from { opacity: 1; } to { opacity: 0; } }
        .pp-stamp { display: inline-block; animation: ppStamp .18s steps(2) backwards; }
        @keyframes ppStamp { from { transform: scale(2.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .pp-shake { animation: ppShake .4s steps(8); }
        @keyframes ppShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-5px, 3px); }
          50% { transform: translate(4px, -4px); }
          75% { transform: translate(-3px, -2px); }
        }
        .pp-aberrate { position: relative; animation: ppAb .5s steps(3); }
        @keyframes ppAb {
          0% { filter: drop-shadow(3px 0 0 rgba(255,0,80,.7)) drop-shadow(-3px 0 0 rgba(0,200,255,.7)); }
          100% { filter: none; }
        }
        .pp-rune { animation: ppRune .6s steps(6) backwards; }
        @keyframes ppRune { from { transform: scale(.1) rotate(-45deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
      `}</style>
    </motion.div>
  );
}
