"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Heart, Shield, Crosshair, Trophy } from "lucide-react";
import CardFace, { CardDef } from "./CardFace";

/**
 * THE ARENA — a full-screen battle surface, built mobile-first.
 *
 * Two things drive the layout. First, a duel should own the screen: a modal
 * on a phone left the board a few hundred pixels tall with the cards too small
 * to read. This is `fixed inset-0` with a `dvh` height so it survives mobile
 * browser chrome collapsing, and the only scrolling region is the log.
 *
 * Second, YOU CHOOSE WHO FIGHTS. Your cards along the bottom are the hand —
 * tap one to send it in, and it attacks that turn. Because the card you send
 * also takes the counter-attack, spending a common to absorb a hit is a real
 * play. That is the whole tactical layer, and it has to be reachable with a
 * thumb, so the hand sits at the bottom where thumbs actually are.
 */

export interface Fighter {
  cardId: string; name: string; rarity: any;
  maxHp: number; hp: number; atk: number; foil: boolean;
}
export interface ArenaSide {
  userId: string; username: string; fighters: Fighter[]; active: number;
}

const ITEMS = [
  { id: "heal", name: "Salve", Icon: Heart, tint: "text-rose-300" },
  { id: "shield", name: "Ward", Icon: Shield, tint: "text-sky-300" },
  { id: "focus", name: "Focus", Icon: Crosshair, tint: "text-amber-300" },
];

function Bar({ f, h = 6 }: { f: Fighter; h?: number }) {
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  return (
    <div className="w-full overflow-hidden rounded-full bg-black/70" style={{ height: h }}>
      <motion.div
        className={`h-full rounded-full ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-600"}`}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

export default function Arena({
  mine, foe, byId, myName, foeName, myTurn, finished, resultText,
  bag = [], busy, log = [], stake,
  supports = [], usedSupports = [],
  onAttack, onItem, onSupport, onClose,
}: {
  mine: ArenaSide; foe: ArenaSide;
  byId: Record<string, CardDef>;
  myName: string; foeName: string;
  myTurn: boolean; finished: boolean; resultText?: string;
  bag?: string[]; busy?: boolean; log?: string[]; stake?: number;
  /** Support cards you OWN — never spent, but each is playable once per duel. */
  supports?: CardDef[];
  usedSupports?: string[];
  onAttack: (index: number) => void;
  onItem: (item: string) => void;
  onSupport?: (cardId: string) => void;
  onClose: () => void;
}) {
  // active = -1 means that side hasn't deployed yet, so the field is empty.
  const myActive = mine.active >= 0 ? mine.fighters[mine.active] : undefined;
  const foeActive = foe.active >= 0 ? foe.fighters[foe.active] : undefined;
  // SELECT then ACT. Tapping a card used to fire the move immediately, which
  // made a mis-tap cost you a turn and gave drag-and-drop nothing to be better
  // than. Now a tap only SELECTS; an explicit button commits.
  const [sel, setSel] = useState<number | null>(null);
  const [overField, setOverField] = useState(false);
  const selected = sel !== null ? mine.fighters[sel] : undefined;
  const selectable = myTurn && !finished && !busy;
  // Choosing a card that isn't the one already fighting is a REDEPLOY.
  const isSwap = sel !== null && mine.active >= 0 && sel !== mine.active;

  // Damage detection so a hit is SEEN, not just read off a number.
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

  // Lock the page behind the arena while it owns the screen.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  const aliveFoe = foe.fighters.filter((f) => f.hp > 0).length;
  const aliveMine = mine.fighters.filter((f) => f.hp > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] flex flex-col"
      style={{
        height: "100dvh",
        background:
          "radial-gradient(90% 45% at 50% 0%, rgba(56,110,190,.28), transparent 62%)," +
          "radial-gradient(90% 45% at 50% 100%, rgba(190,50,70,.28), transparent 62%)," +
          "linear-gradient(#080810, #0d0c16)",
      }}
    >
      {/* floor lines */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 30px, rgba(255,255,255,.6) 30px 31px)" }} />

      {/* ── top bar ── */}
      <div className="relative flex shrink-0 items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/20 text-[11px] font-black text-sky-200">
              {foeName[0]?.toUpperCase()}
            </span>
            <span className="truncate text-sm font-black text-sky-100">{foeName}</span>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">{aliveFoe} left</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeof stake === "number" && (
            <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-300 sm:inline">
              {(stake * 2 * 0.9).toLocaleString()} AP pot
            </span>
          )}
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── opponent's line ── */}
      <div className="relative flex shrink-0 items-start justify-center gap-1.5 px-3">
        {foe.fighters.map((f, i) => (
          <div key={i} className={`flex flex-col items-center gap-1 transition-all ${f.hp <= 0 ? "opacity-25 grayscale" : ""}`}
            style={{ transform: i === foe.active && f.hp > 0 ? "scale(1)" : "scale(0.86)" }}>
            <div className={`rounded-lg ${i === foe.active && f.hp > 0 ? "ring-2 ring-sky-400" : ""}`}>
              {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={54} />}
            </div>
            <div style={{ width: 54 }}><Bar f={f} h={4} /></div>
          </div>
        ))}
      </div>

      {/* ── the clash ── */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-2">
        <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="relative flex items-center justify-center gap-4 sm:gap-10">
          <motion.div animate={hit?.side === "foe" ? { y: [0, 8, 0] } : {}} transition={{ duration: 0.3 }} className="text-center">
            {foeActive && byId[foeActive.cardId] ? (
              <>
                <CardFace card={byId[foeActive.cardId]} owned foil={foeActive.foil} size={132} showStats />
                <p className="mt-1 max-w-[132px] truncate text-[11px] font-bold text-sky-200">{foeActive.name}</p>
                <div className="mx-auto mt-1" style={{ width: 132 }}>
                  <Bar f={foeActive} h={7} />
                  <div className="text-center text-[10px] font-black tabular-nums text-slate-300">{foeActive.hp}/{foeActive.maxHp}</div>
                </div>
              </>
            ) : (
              <div className="grid place-items-center rounded-xl border-2 border-dashed border-sky-500/25"
                style={{ width: 132, aspectRatio: "5 / 7" }}>
                <span className="px-2 text-center text-[9px] font-black uppercase tracking-wider text-sky-500/50">
                  {foeName} hasn&rsquo;t sent anyone
                </span>
              </div>
            )}
          </motion.div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xl font-black text-white/20 sm:text-3xl">VS</span>
            <AnimatePresence>
              {hit && (
                <motion.span key={hit.key}
                  initial={{ opacity: 0, scale: 0.6, y: hit.side === "foe" ? 16 : -16 }}
                  animate={{ opacity: 1, scale: 1.3, y: hit.side === "foe" ? -30 : 30 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
                  onAnimationComplete={() => setHit(null)}
                  className="absolute text-2xl font-black text-rose-400 drop-shadow-[0_2px_10px_rgba(244,63,94,.75)]">
                  −{hit.amount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* MY SLOT — also the drop target. Dragging a card here deploys it;
              tapping the card in hand does the same, since drag events never
              fire on touch. */}
          <motion.div
            animate={hit?.side === "mine" ? { y: [0, -8, 0] } : {}}
            transition={{ duration: 0.3 }}
            className="text-center"
            onDragOver={(e) => { e.preventDefault(); setOverField(true); }}
            onDragLeave={() => setOverField(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOverField(false);
              const idx = Number(e.dataTransfer.getData("text/plain"));
              if (Number.isInteger(idx) && selectable) setSel(idx);
            }}
          >
            {myActive && byId[myActive.cardId] ? (
              <div className={overField ? "rounded-xl ring-2 ring-rose-400" : ""}>
                <CardFace card={byId[myActive.cardId]} owned foil={myActive.foil} size={132} showStats />
                <p className="mt-1 max-w-[132px] truncate text-[11px] font-bold text-rose-200">{myActive.name}</p>
                {/* health of whoever is actually on the field */}
                <div className="mx-auto mt-1" style={{ width: 132 }}>
                  <Bar f={myActive} h={7} />
                  <div className="text-center text-[10px] font-black tabular-nums text-slate-300">{myActive.hp}/{myActive.maxHp}</div>
                </div>
              </div>
            ) : (
              <motion.div
                animate={myTurn ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 1.8, repeat: myTurn ? Infinity : 0 }}
                className={`grid place-items-center rounded-xl border-2 border-dashed transition ${
                  overField ? "border-rose-400 bg-rose-500/15" : myTurn ? "border-rose-500/60 bg-rose-500/5" : "border-white/15"
                }`}
                style={{ width: 132, aspectRatio: "5 / 7" }}
              >
                <span className="px-2 text-center text-[9px] font-black uppercase tracking-wider text-rose-300/70">
                  {myTurn ? "Drop a card here" : "Empty"}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className={`relative z-10 rounded-full border px-4 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
          finished ? "border-white/15 bg-black/50 text-slate-300"
            : myTurn ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
            : "border-sky-400/40 bg-sky-500/10 text-sky-200"}`}>
          {finished
            ? (resultText || "Duel over")
            : myTurn
            ? (mine.active < 0 ? "Send in your first card" : "Drag or tap a card to strike")
            : `${foeName} is thinking…`}
        </div>

        {/* battle log — the only scrolling region */}
        {log.length > 0 && (
          <div className="mt-1 max-h-16 w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            {[...log].reverse().slice(0, 6).map((l, i) => (
              <div key={i} className={i === 0 ? "font-bold text-white" : ""}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── YOUR HAND — tap a card to send it in ── */}
      <div className="relative shrink-0 border-t border-white/10 bg-black/50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-black text-rose-100">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500/20 text-[10px]">{myName[0]?.toUpperCase()}</span>
            {myName}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">{aliveMine} left</span>
        </div>

        <div className="flex items-end justify-center gap-2">
          {mine.fighters.map((f, i) => {
            const dead = f.hp <= 0;
            const playable = myTurn && !dead && !finished && !busy;
            return (
              <motion.button
                key={i}
                whileTap={playable ? { scale: 0.94 } : {}}
                disabled={!playable}
                // Tap SELECTS. Committing happens on the button below, so a
                // mis-tap costs nothing.
                onClick={() => setSel(i)}
                draggable={playable}
                onDragStart={(e: any) => e.dataTransfer?.setData("text/plain", String(i))}
                onDragEnd={() => setOverField(false)}
                title={dead ? `${f.name} has fallen` : `Choose ${f.name}`}
                className={`flex flex-col items-center gap-1 rounded-xl p-1 transition ${
                  dead ? "opacity-25 grayscale"
                    : sel === i ? "bg-rose-500/25 ring-2 ring-rose-400"
                    : playable ? "cursor-grab ring-1 ring-white/15 hover:ring-rose-400/60 active:cursor-grabbing"
                    : "opacity-70"
                }`}
              >
                {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={92} showStats />}
                <div style={{ width: 92 }}>
                  <Bar f={f} h={5} />
                  <div className="text-center text-[9px] font-black tabular-nums text-slate-400">{f.hp}/{f.maxHp}</div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* SUPPORT RAIL — cards you own rather than charges you burn. Playing
            one costs your turn, so it's a real trade and not a free heal. */}
        {!finished && supports.length > 0 && onSupport && (
          <div className="mt-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {supports.map((c) => {
                const spent = usedSupports.includes(c.id);
                const usable = myTurn && !busy && !spent;
                return (
                  <button
                    key={c.id}
                    disabled={!usable}
                    onClick={() => onSupport(c.id)}
                    title={spent ? `${c.name} — already played this duel` : `Play ${c.name} (costs your turn)`}
                    className={`shrink-0 rounded-lg p-0.5 transition ${
                      usable ? "ring-1 ring-cyan-400/40 hover:-translate-y-0.5 hover:ring-cyan-300"
                             : "opacity-30 grayscale"
                    }`}
                  >
                    <CardFace card={c} owned size={64} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIONS — the commit step. Selecting a card never fires a move; you
            press the button, so a mis-tap can't waste a turn. */}
        {!finished && (
          <div className="mt-3 flex items-stretch justify-center gap-2">
            <button
              disabled={!selectable || sel === null}
              onClick={() => sel !== null && onAttack(sel)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-30"
            >
              <Swords className="h-4 w-4" />
              {!myTurn ? "Not your turn"
                : sel === null ? "Choose a card"
                : isSwap ? `Redeploy ${selected?.name?.split(" ").slice(-1)[0] ?? ""} & strike`
                : "Attack"}
            </button>
            {ITEMS.map((it) => {
              const held = bag.filter((b) => b === it.id).length;
              const usable = myTurn && held > 0 && !busy;
              return (
                <button key={it.id} disabled={!usable} onClick={() => onItem(it.id)}
                  title={`${it.name}${held ? ` ×${held}` : " — none left"}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black disabled:opacity-25">
                  <it.Icon className={`h-4 w-4 ${it.tint}`} />
                  {held > 0 && <span className="text-slate-300">{held}</span>}
                </button>
              );
            })}
          </div>
        )}

        {finished && (
          <button onClick={onClose}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white">
            <Trophy className="h-4 w-4" /> Leave the arena
          </button>
        )}

        {!myTurn && !finished && (
          <p className="mt-2 text-center text-[11px] font-bold text-slate-500">
            <Swords className="mr-1 inline h-3 w-3" /> Waiting for {foeName}…
          </p>
        )}
      </div>
    </motion.div>
  );
}
