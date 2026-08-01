"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardFace, { CardDef, RARITY_META } from "./CardFace";

/**
 * THE ARENA — where a duel actually reads as a fight.
 *
 * The first version was two flat panels of stats side by side; you could tell
 * who was winning by reading numbers, which is not the same as watching a
 * battle. This stages it vertically the way arena games do: the opponent's
 * line up top, yours along the bottom, and the two ACTIVE fighters facing each
 * other across a lit centre strip where the blows land.
 *
 * The one piece of real feedback is the hit: when a fighter's HP drops between
 * polls we lunge that side forward, flash the target red and float the damage
 * number. Without it, an opponent's turn arriving by poll is just numbers
 * quietly changing while you look elsewhere.
 */

export interface Fighter {
  cardId: string; name: string; rarity: any;
  maxHp: number; hp: number; atk: number; foil: boolean;
}
export interface ArenaSide {
  userId: string; username: string; fighters: Fighter[]; active: number;
}

function HealthBar({ f, big }: { f: Fighter; big?: boolean }) {
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  return (
    <div className={`w-full overflow-hidden rounded-full bg-black/60 ${big ? "h-2" : "h-1.5"}`}>
      <motion.div
        className={`h-full rounded-full ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-600"}`}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
    </div>
  );
}

/** One fighter as it appears in a side's line-up. */
function Slot({
  f, card, isActive, isMine, size,
}: { f: Fighter; card?: CardDef; isActive: boolean; isMine: boolean; size: number }) {
  const dead = f.hp <= 0;
  return (
    <div className={`flex flex-col items-center gap-1 transition-all ${dead ? "opacity-25 grayscale" : ""}`}
      style={{ transform: isActive && !dead ? "scale(1.08)" : "scale(0.92)" }}>
      <div className={`rounded-xl ${isActive && !dead ? (isMine ? "ring-2 ring-rose-400" : "ring-2 ring-sky-400") : ""}`}>
        {card ? <CardFace card={card} owned foil={f.foil} size={size} /> : <div style={{ width: size, aspectRatio: "5/7" }} className="rounded-lg bg-white/5" />}
      </div>
      <div style={{ width: size }}>
        <HealthBar f={f} big={isActive} />
        <div className="text-center text-[9px] font-black tabular-nums text-slate-400">{f.hp}/{f.maxHp}</div>
      </div>
    </div>
  );
}

export default function Arena({
  mine, foe, byId, myName, foeName, myTurn, finished,
}: {
  mine: ArenaSide; foe: ArenaSide;
  byId: Record<string, CardDef>;
  myName: string; foeName: string;
  myTurn: boolean; finished: boolean;
}) {
  const myActive = mine.fighters[mine.active];
  const foeActive = foe.fighters[foe.active];

  // Detect damage between renders so a hit can be SEEN, not just read.
  const prev = useRef<{ mine: number; foe: number } | null>(null);
  const [hit, setHit] = useState<{ side: "mine" | "foe"; amount: number; key: number } | null>(null);
  useEffect(() => {
    const now = { mine: myActive?.hp ?? 0, foe: foeActive?.hp ?? 0 };
    const before = prev.current;
    if (before) {
      if (now.foe < before.foe) setHit({ side: "foe", amount: before.foe - now.foe, key: Date.now() });
      else if (now.mine < before.mine) setHit({ side: "mine", amount: before.mine - now.mine, key: Date.now() });
    }
    prev.current = now;
  }, [myActive?.hp, foeActive?.hp]);

  const aliveFoe = foe.fighters.filter((f) => f.hp > 0).length;
  const aliveMine = mine.fighters.filter((f) => f.hp > 0).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 0%, rgba(56,110,190,.20), transparent 60%)," +
          "radial-gradient(120% 60% at 50% 100%, rgba(190,50,70,.20), transparent 60%)," +
          "linear-gradient(#0a0a12, #0e0d18)",
      }}>
      {/* arena floor markings */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 26px, rgba(255,255,255,.5) 26px 27px)" }} />

      {/* ── opponent line ── */}
      <div className="relative px-4 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-black text-sky-200">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-sky-500/20 text-[10px]">{foeName[0]?.toUpperCase()}</span>
            {foeName}
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{aliveFoe} left</span>
        </div>
        <div className="flex items-start justify-center gap-2">
          {foe.fighters.map((f, i) => (
            <Slot key={i} f={f} card={byId[f.cardId]} isActive={i === foe.active} isMine={false} size={62} />
          ))}
        </div>
      </div>

      {/* ── the clash strip ── */}
      <div className="relative my-3 flex items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <motion.div
          animate={hit ? { scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.4 }}
          className="relative z-10 rounded-full border border-white/15 bg-[#0b0b14] px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: finished ? "#94a3b8" : myTurn ? "#fda4af" : "#7dd3fc" }}>
          {finished ? "Duel over" : myTurn ? "Your move" : `${foeName}'s move`}
        </motion.div>

        {/* damage number floats from the side that got hit */}
        <AnimatePresence>
          {hit && (
            <motion.span
              key={hit.key}
              initial={{ opacity: 0, y: hit.side === "foe" ? 10 : -10, scale: 0.7 }}
              animate={{ opacity: 1, y: hit.side === "foe" ? -34 : 34, scale: 1.25 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              onAnimationComplete={() => setHit(null)}
              className="pointer-events-none absolute text-2xl font-black text-rose-400 drop-shadow-[0_2px_10px_rgba(244,63,94,.7)]">
              −{hit.amount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── the two champions facing off ── */}
      <div className="relative flex items-center justify-center gap-6 px-4 pb-2">
        <motion.div animate={hit?.side === "mine" ? { x: [0, -6, 0] } : {}} transition={{ duration: 0.3 }}
          className={hit?.side === "foe" ? "translate-y-0" : ""}>
          {foeActive && byId[foeActive.cardId] && (
            <div className="text-center">
              <CardFace card={byId[foeActive.cardId]} owned foil={foeActive.foil} size={92} showStats />
              <p className="mt-1 max-w-[92px] truncate text-[10px] font-bold text-sky-200">{foeActive.name}</p>
            </div>
          )}
        </motion.div>

        <span className="text-2xl font-black text-white/20">VS</span>

        <motion.div animate={hit?.side === "foe" ? { x: [0, 6, 0] } : {}} transition={{ duration: 0.3 }}>
          {myActive && byId[myActive.cardId] && (
            <div className="text-center">
              <CardFace card={byId[myActive.cardId]} owned foil={myActive.foil} size={92} showStats />
              <p className="mt-1 max-w-[92px] truncate text-[10px] font-bold text-rose-200">{myActive.name}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── your line ── */}
      <div className="relative px-4 pb-4">
        <div className="flex items-start justify-center gap-2">
          {mine.fighters.map((f, i) => (
            <Slot key={i} f={f} card={byId[f.cardId]} isActive={i === mine.active} isMine size={62} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-black text-rose-200">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500/20 text-[10px]">{myName[0]?.toUpperCase()}</span>
            {myName}
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{aliveMine} left</span>
        </div>
      </div>
    </div>
  );
}
