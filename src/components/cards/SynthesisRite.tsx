"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CardFace, { CardDef, RARITY_META } from "./CardFace";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

/**
 * THE SYNTHESIS RITE — the laboratory reaction, played AFTER the server has
 * already decided the outcome. Presentation only: skipping can never change
 * what the machine already did.
 *
 * Two glass chambers, angled toward a dark third. The lever has already
 * slammed (the hold-button on the lab page IS the lever) — this overlay
 * opens on the red-alert frame and runs:
 *   alarm(600) → dissolve(1000) → collide(1000) → overload(400) →
 *   shatter+hang(800) → descend(1000) → idle (affixes list in)
 * FAILURE stalls at collide: vents, amber lights, one parent re-assembles.
 * Tap anywhere to skip to the outcome. prefers-reduced-motion crossfades.
 */

type Outcome = {
  held: boolean;
  myth: CardDef | null;
  affixLabel?: string | null;
  modLabel?: string | null;
  returned?: CardDef | null;
};

export default function SynthesisRite({
  a, b, outcome, onClose,
}: {
  a: CardDef; b: CardDef; outcome: Outcome; onClose: () => void;
}) {
  useLockBodyScroll();
  const reduce = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  type Stage = "alarm" | "dissolve" | "collide" | "overload" | "shatter" | "descend" | "idle" | "vent";
  const [stage, setStage] = useState<Stage>(reduce ? (outcome.held ? "idle" : "vent") : "alarm");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (reduce) return;
    if (stage === "alarm") later(() => setStage("dissolve"), 600);
    if (stage === "dissolve") later(() => setStage("collide"), 1000);
    if (stage === "collide") later(() => setStage(outcome.held ? "overload" : "vent"), 1000);
    if (stage === "overload") later(() => setStage("shatter"), 400);
    if (stage === "shatter") later(() => setStage("descend"), 800);
    if (stage === "descend") later(() => setStage("idle"), 1000);
    if (stage === "vent") later(() => setStage("idle"), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const skip = () => { if (stage === "idle") onClose(); else setStage("idle"); };

  const colA = RARITY_META[a.rarity]?.glow || "#f59e0b";
  const colB = RARITY_META[b.rarity]?.glow || "#f59e0b";
  const red = stage === "alarm" || stage === "dissolve" || stage === "collide" || stage === "overload";
  const amber = stage === "vent" || (!outcome.held && stage === "idle");
  const failed = !outcome.held;

  const Chamber = ({ card, col, side }: { card: CardDef; col: string; side: "l" | "r" }) => (
    <div className={`relative ${side === "l" ? "rotate-[7deg]" : "-rotate-[7deg]"}`}
      style={{ width: 130, height: 260 }}>
      {/* the glass */}
      <div className="absolute inset-0 rounded-[40px]"
        style={{
          background: "linear-gradient(180deg, rgba(160,200,255,.10), rgba(120,160,220,.04) 40%, rgba(160,200,255,.12))",
          boxShadow: `inset 0 0 0 2px rgba(190,220,255,.35), inset 0 -30px 50px ${col}44, 0 0 24px ${col}33`,
        }} />
      {/* the fluid, lit from below */}
      <div className="absolute inset-x-2 bottom-2 rounded-b-[36px]"
        style={{ height: "58%", background: `linear-gradient(180deg, transparent, ${col}30 30%, ${col}55)` }} />
      {/* the fluid BOILS — pooled bubbles, faster as the reaction runs */}
      {!reduce && [0, 1, 2, 3, 4].map((bi) => (
        <span key={bi} aria-hidden className="sy-bubble absolute rounded-full"
          style={{
            left: `${14 + bi * 17}%`, bottom: 6,
            width: 3 + (bi % 3), height: 3 + (bi % 3),
            background: "rgba(225,240,255,.55)",
            animationDelay: `${bi * 0.5}s`,
            animationDuration: stage === "dissolve" || stage === "collide" ? "1.1s" : "2.6s",
          }} />
      ))}
      {/* the card, suspended and slowly turning — dissolving on cue */}
      <motion.div className="absolute left-1/2 top-1/2"
        style={{ x: "-50%", y: "-50%" }}
        animate={reduce ? {} : stage === "dissolve" || stage === "collide"
          ? { opacity: 0, scale: 0.6, filter: "blur(6px)" }
          : { rotateY: [0, 360] }}
        transition={stage === "dissolve" || stage === "collide"
          ? { duration: 0.9, ease: "easeIn" }
          : { duration: 9, repeat: Infinity, ease: "linear" }}>
        <CardFace card={card} owned size={86} showStats={false} />
      </motion.div>
      {/* dissolve streams pouring toward the centre */}
      {!reduce && (stage === "dissolve" || stage === "collide") && (
        <motion.div aria-hidden className="absolute top-1/2 h-1.5 rounded-full"
          style={{
            [side === "l" ? "left" : "right"]: "60%",
            width: "22vw", maxWidth: 260,
            background: side === "l"
              ? `linear-gradient(90deg, ${col}, transparent)`
              : `linear-gradient(270deg, ${col}, transparent)`,
            boxShadow: `0 0 12px ${col}`,
          }}
          initial={{ opacity: 0, scaleX: 0.2 }} animate={{ opacity: [0, 1, 1], scaleX: 1 }}
          transition={{ duration: 0.8 }} />
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[96] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#050208" }}
      onClick={skip}>
      {/* lab wash — red alert, amber failure, calm otherwise */}
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-colors duration-500"
        style={{ background: red ? "rgba(150,10,20,.16)" : amber ? "rgba(180,120,10,.12)" : "rgba(30,20,60,.10)" }} />
      {/* warning strobes */}
      {!reduce && red && (
        <>
          <div aria-hidden className="sy-strobe pointer-events-none absolute left-6 top-6 h-3 w-3 rounded-full bg-red-500" />
          <div aria-hidden className="sy-strobe pointer-events-none absolute right-6 top-6 h-3 w-3 rounded-full bg-red-500" style={{ animationDelay: ".4s" }} />
        </>
      )}
      {/* gauges swinging into the red */}
      <div aria-hidden className="pointer-events-none absolute top-8 flex gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-10 w-10 rounded-full border-2 border-slate-600/60 bg-black/60">
            <span className={`absolute bottom-1/2 left-1/2 h-4 w-[2px] origin-bottom ${red ? "bg-red-400" : amber ? "bg-amber-300" : "bg-slate-400"} ${!reduce && (red || stage === "overload") ? "sy-needle" : ""}`}
              style={{ transform: red ? "rotate(70deg)" : "rotate(-30deg)", transition: "transform .5s", animationDelay: `${i * 0.15}s` }} />
          </div>
        ))}
      </div>

      {/* klaxon — the lab SAYS what it's doing */}
      {(stage === "alarm" || stage === "dissolve" || stage === "collide") && (
        <div className="sy-klaxon pointer-events-none absolute top-16 rounded border border-red-500/60 bg-red-950/70 px-5 py-1.5 text-[11px] font-black uppercase tracking-[0.4em] text-red-300">
          ⚠ Reaction in progress ⚠
        </div>
      )}
      {stage === "vent" && (
        <div className="pointer-events-none absolute top-16 rounded border border-amber-500/60 bg-amber-950/70 px-5 py-1.5 text-[11px] font-black uppercase tracking-[0.4em] text-amber-300">
          Pressure venting — reaction stalled
        </div>
      )}

      {/* ── THE MACHINE ── */}
      {(stage === "alarm" || stage === "dissolve" || stage === "collide" || stage === "overload" || stage === "vent") && (
        <div className={`relative flex items-end gap-6 sm:gap-12 ${!reduce && stage === "collide" ? "sy-shake" : ""}`}>
          {/* electric arcs leaping between the chambers as the colours fight */}
          {!reduce && stage === "collide" && (
            <svg aria-hidden className="sy-arc pointer-events-none absolute inset-x-0 top-8 z-10 h-24 w-full" viewBox="0 0 400 100" preserveAspectRatio="none">
              <polyline points="30,20 90,55 130,30 200,60 260,25 330,50 370,22" fill="none" stroke="#e8f4ff" strokeWidth="2" opacity=".9" />
              <polyline points="40,70 110,40 180,75 250,45 320,70 365,45" fill="none" stroke={colA} strokeWidth="1.5" opacity=".8" />
              <polyline points="35,45 100,65 170,35 240,68 310,38 368,60" fill="none" stroke={colB} strokeWidth="1.5" opacity=".8" />
            </svg>
          )}
          <Chamber card={a} col={colA} side="l" />
          {/* centre chamber — dark until the streams arrive */}
          <div className="relative" style={{ width: 150, height: 300 }}>
            <div className={`absolute inset-0 rounded-[44px] ${!reduce && stage === "collide" ? "sy-strain" : ""}`}
              style={{
                background: "linear-gradient(180deg, rgba(120,140,190,.08), rgba(60,70,110,.03))",
                boxShadow: stage === "collide" || stage === "overload"
                  ? `inset 0 0 0 2px rgba(255,255,255,.5), 0 0 40px ${colA}66, 0 0 70px ${colB}55`
                  : "inset 0 0 0 2px rgba(150,180,230,.25)",
              }} />
            {/* the two colours meeting and refusing to mix */}
            {!reduce && (stage === "collide" || stage === "overload") && (
              <>
                <motion.span className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full"
                  style={{ x: "-50%", y: "-50%", background: `radial-gradient(circle, ${colA}, transparent 70%)` }}
                  animate={{ x: ["-70%", "-30%", "-70%"], rotate: 180 }} transition={{ duration: 0.6, repeat: Infinity }} />
                <motion.span className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full"
                  style={{ x: "-50%", y: "-50%", background: `radial-gradient(circle, ${colB}, transparent 70%)` }}
                  animate={{ x: ["-30%", "-70%", "-30%"], rotate: -180 }} transition={{ duration: 0.6, repeat: Infinity }} />
              </>
            )}
            {/* hairline cracks as the glass strains */}
            {!reduce && (stage === "collide" || stage === "overload") && (
              <>
                <span className="absolute left-[30%] top-[24%] h-10 w-[1.5px] rotate-[24deg] bg-white/70" />
                <span className="absolute right-[26%] top-[46%] h-14 w-[1.5px] -rotate-[36deg] bg-white/60" />
              </>
            )}
            {/* venting on failure */}
            {stage === "vent" && (
              <motion.div aria-hidden className="absolute inset-x-4 top-0 h-24"
                style={{ background: "linear-gradient(180deg, rgba(220,220,230,.35), transparent)" }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: [0, 1, 0], y: -40 }} transition={{ duration: 1.4 }} />
            )}
          </div>
          <Chamber card={b} col={colB} side="r" />
          {/* conduits */}
          <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-10 h-[3px] rounded-full"
            style={{ background: `linear-gradient(90deg, ${colA}66, rgba(200,220,255,.25), ${colB}66)` }} />
        </div>
      )}

      {/* overload — sparks fly, THEN the white takes everything */}
      {!reduce && stage === "overload" && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            {Array.from({ length: 12 }, (_, i) => (
              <motion.span key={i} className="absolute h-1 w-4 rounded-full"
                style={{ background: i % 2 ? "#fff" : "#fbbf24", boxShadow: "0 0 8px #fbbf24", rotate: `${i * 30}deg` }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: Math.cos((i / 12) * Math.PI * 2) * 220, y: Math.sin((i / 12) * Math.PI * 2) * 220, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }} />
            ))}
          </div>
          <motion.div aria-hidden className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} />
        </>
      )}

      {/* ── SHATTER → DESCEND → IDLE — the new card in the gap ── */}
      {(stage === "shatter" || stage === "descend" || stage === "idle") && !failed && outcome.myth && (
        <div className="relative flex flex-col items-center px-4">
          {stage === "shatter" && !reduce && (
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              {/* shard needles */}
              {Array.from({ length: 16 }, (_, i) => (
                <motion.span key={i} className="absolute h-6 w-[2px] bg-white/80"
                  style={{ rotate: `${i * 22.5}deg` }}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: Math.cos((i / 16) * Math.PI * 2) * 200, y: Math.sin((i / 16) * Math.PI * 2) * 200, opacity: 0 }}
                  transition={{ duration: 1.4, ease: "easeOut" }} />
              ))}
              {/* glass panes, tumbling out in slow motion */}
              {Array.from({ length: 6 }, (_, i) => (
                <motion.span key={`g${i}`} className="absolute"
                  style={{
                    width: 14 + (i % 3) * 8, height: 20 + (i % 2) * 10,
                    background: "linear-gradient(160deg, rgba(220,240,255,.5), rgba(160,200,255,.15))",
                    clipPath: "polygon(50% 0, 100% 40%, 70% 100%, 0 70%)",
                  }}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 0.95 }}
                  animate={{
                    x: Math.cos((i / 6) * Math.PI * 2 + 0.5) * 240,
                    y: Math.sin((i / 6) * Math.PI * 2 + 0.5) * 240 + 60,
                    rotate: 180 + i * 60, opacity: 0,
                  }}
                  transition={{ duration: 1.6, ease: "easeOut" }} />
              ))}
              {/* one hard ring off the break */}
              <motion.span className="absolute rounded-full border-2 border-white/70"
                style={{ width: 80, height: 80 }}
                initial={{ scale: 0.2, opacity: 1 }} animate={{ scale: 7, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }} />
            </div>
          )}
          <motion.div
            initial={reduce ? { opacity: 0 } : { y: -60, opacity: 0, filter: "blur(10px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: reduce ? 0.4 : 1.0, ease: [0.22, 1, 0.36, 1] }}>
            <CardFace card={outcome.myth} owned size={230} showStats={false} />
          </motion.div>
          {/* the fifth star strikes in */}
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span key={i} className="text-lg" style={{ color: "#fb7185" }}
                initial={{ scale: 2.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (reduce ? 0 : 0.5) + i * 0.14, duration: 0.18 }}>★</motion.span>
            ))}
          </div>
          <motion.p className="mt-1 text-sm font-black uppercase tracking-[0.3em] text-rose-200"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.2 }}>
            {outcome.myth.name}
          </motion.p>
          {stage === "idle" && (
            <div className="mt-3 flex flex-col items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {[outcome.affixLabel, outcome.modLabel].filter(Boolean).map((t, i) => (
                <motion.span key={i}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-200"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.35 }}>
                  {t}
                </motion.span>
              ))}
              <button onClick={onClose}
                className="mt-3 rounded-full px-7 py-2.5 text-[11px] font-black uppercase tracking-[0.24em] text-white"
                style={{ background: "linear-gradient(100deg, #7f1d1d, #e11d48)", boxShadow: "0 0 18px rgba(225,29,72,.5)" }}>
                Take it
              </button>
            </div>
          )}
        </div>
      )}

      {/* failure idle: the reaction stalled, one parent came back */}
      {stage === "idle" && failed && (
        <div className="relative flex flex-col items-center px-4 text-center">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">The reaction stalled</p>
          {outcome.returned && (
            <>
              <div className="mt-4"><CardFace card={outcome.returned} owned size={170} showStats={false} /></div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
                {outcome.returned.name} re-assembled in its chamber and is returned to you.
                The other legendary was lost to the machine.
              </p>
            </>
          )}
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="mt-5 rounded-full border border-amber-400/40 bg-amber-500/10 px-7 py-2.5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200">
            Understood
          </button>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
        {stage === "idle" ? "" : "Tap to skip"}
      </p>

      <style jsx global>{`
        .sy-strobe { animation: syStrobe .8s steps(2) infinite; box-shadow: 0 0 14px 4px rgba(239,68,68,.8); }
        @keyframes syStrobe { 0%, 100% { opacity: 1; } 50% { opacity: .15; } }
        .sy-needle { animation: syNeedle .3s ease-in-out infinite alternate; }
        @keyframes syNeedle { from { transform: rotate(55deg); } to { transform: rotate(80deg); } }
        .sy-shake { animation: syShake .3s linear infinite; }
        @keyframes syShake { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-6px,4px); } 50% { transform: translate(5px,-4px); } 75% { transform: translate(-4px,-3px); } }
        .sy-bubble { animation: syBubble 2.6s ease-in infinite; }
        @keyframes syBubble { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } 100% { transform: translateY(-140px); opacity: 0; } }
        .sy-arc { animation: syArc .14s steps(2) infinite; }
        @keyframes syArc { 0%, 100% { opacity: 1; } 50% { opacity: .15; } }
        .sy-klaxon { animation: syKlaxon .9s steps(2) infinite; }
        @keyframes syKlaxon { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .sy-strain { animation: syStrain .5s ease-in-out infinite; }
        @keyframes syStrain { 0%,100% { transform: scale(1); } 50% { transform: scale(1.015); } }
      `}</style>
    </motion.div>
  );
}
