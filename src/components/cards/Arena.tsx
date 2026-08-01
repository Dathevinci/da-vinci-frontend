"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Heart, Shield, Crosshair, Trophy, Sparkles } from "lucide-react";
import CardFace, { CardDef } from "./CardFace";

/**
 * THE ARENA — a full-screen battle surface, built mobile-first.
 *
 * Three things drive the layout.
 *
 * First, a duel should own the screen: a modal on a phone left the board a few
 * hundred pixels tall with the cards too small to read. This is `fixed inset-0`
 * with a `dvh` height so it survives mobile browser chrome collapsing.
 *
 * Second, YOU CHOOSE WHO FIGHTS. Your cards along the bottom are the hand —
 * send one in and it attacks that turn. Because the card you send also takes the
 * counter-attack, spending a common to absorb a hit is a real play. That is the
 * whole tactical layer, and it has to be reachable with a thumb, so the hand
 * sits at the bottom where thumbs actually are.
 *
 * Third — and this is why the clash is HORIZONTAL rather than stacked — a
 * side-by-side board needs the height of only ONE card instead of two. That is
 * what buys the room to draw champions at 260px on a laptop instead of the
 * stamps this screen used to show.
 *
 * DRAGGING IS POINTER-BASED, NOT HTML5. The old build used draggable/dataTransfer,
 * which does not fire at all on touch devices — so on a phone drag-and-drop was
 * simply dead, and on desktop the drop handler only ever called setSel, making a
 * drag identical to a tap. Pointer events cover mouse, pen and touch with one
 * path, and hit-testing through `data-drop` means a support card can be dropped
 * onto a SPECIFIC ally to heal that card.
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

/** Support kinds that need to be pointed AT a card; the rest are side-wide. */
const TARGETED = new Set(["heal", "revive"]);

/**
 * What the winner actually receives. This MUST mirror the server's payout():
 * the rake is a floored integer, not a flat 10% of the pot. Showing
 * `stake * 2 * 0.9` disagreed with the real payout on any stake that isn't a
 * multiple of 5 — a 51 AP stake paid 92 but advertised 91.8.
 */
export function duelPayout(stake: number): number {
  const pot = stake * 2;
  return pot - Math.floor((pot * 10) / 100);
}

type Drag =
  | { kind: "unit"; index: number }
  | { kind: "support"; cardId: string; targeted: boolean };

function Bar({ f, h = 6, showNumbers = false }: { f: Fighter; h?: number; showNumbers?: boolean }) {
  const pct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
  const tone = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-600";
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-black/70 ring-1 ring-white/10" style={{ height: h }}>
      <motion.div
        className={`h-full rounded-full ${tone}`}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      {showNumbers && (
        <span className="absolute inset-0 grid place-items-center text-[9px] font-black tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]">
          {f.hp}/{f.maxHp}
        </span>
      )}
    </div>
  );
}

export default function Arena({
  mine, foe, byId, myName, foeName, myTurn, finished, resultText, won = false,
  bag = [], busy, log = [], stake,
  supports = [], usedSupports = [],
  onAttack, onItem, onSupport, onClose,
}: {
  mine: ArenaSide; foe: ArenaSide;
  byId: Record<string, CardDef>;
  myName: string; foeName: string;
  myTurn: boolean; finished: boolean; resultText?: string;
  /** Did I win? Passed explicitly — an abandoned duel leaves both sides alive,
   *  so counting survivors would call a draw a loss. */
  won?: boolean;
  bag?: string[]; busy?: boolean; log?: string[]; stake?: number;
  /** Support cards you OWN — never spent, but each is playable once per duel. */
  supports?: CardDef[];
  usedSupports?: string[];
  onAttack: (index: number) => void;
  onItem: (item: string) => void;
  onSupport?: (cardId: string, target?: number) => void;
  onClose: () => void;
}) {
  // active = -1 means that side hasn't deployed yet, so the field is empty.
  const myActive = mine.active >= 0 ? mine.fighters[mine.active] : undefined;
  const foeActive = foe.active >= 0 ? foe.fighters[foe.active] : undefined;

  // SELECT then ACT. Tapping a card only SELECTS; an explicit button commits, so
  // a mis-tap can't cost you a turn.
  const [sel, setSel] = useState<number | null>(null);
  const selected = sel !== null ? mine.fighters[sel] : undefined;
  const live = myTurn && !finished && !busy;
  const isSwap = sel !== null && mine.active >= 0 && sel !== mine.active;

  // ── Card sizing ──────────────────────────────────────────────────────────
  // The complaint was that cards are tiny on a laptop. Sizes are derived from
  // the actual viewport rather than hard-coded, and because the clash is
  // side-by-side we only need to fit ONE card's height, not two.
  const [vp, setVp] = useState({ w: 1024, h: 800 });
  useEffect(() => {
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);
  const clamp = (lo: number, v: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)));
  const champ = clamp(116, Math.min(vp.h * 0.30, vp.w * 0.32), 260);
  const hand = clamp(74, champ * 0.62, 148);
  const bench = clamp(44, champ * 0.34, 86);
  const suppSize = clamp(46, champ * 0.32, 80);
  const roomy = vp.h >= 760;

  // ── A selection must never outlive the card it points at ──────────────────
  // If your chosen card falls, `sel` used to keep pointing at the corpse and the
  // Attack button stayed lit, so you'd fire a move the server then rejected.
  const hpKey = mine.fighters.map((f) => f.hp).join(",");
  useEffect(() => {
    if (sel !== null) {
      const f = mine.fighters[sel];
      if (!f || f.hp <= 0) setSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpKey, sel]);

  // ── Damage flash ─────────────────────────────────────────────────────────
  // Keyed on cardId as well as hp. Tracking hp alone meant a REDEPLOY (a
  // different card stepping up with different hp) rendered a fake damage number.
  const prev = useRef<{ mi?: string; mh: number; fi?: string; fh: number } | null>(null);
  const [hit, setHit] = useState<{ side: "mine" | "foe"; amount: number; key: number } | null>(null);
  const [heal, setHeal] = useState<{ index: number; amount: number; key: number } | null>(null);
  useEffect(() => {
    const now = {
      mi: myActive?.cardId, mh: myActive?.hp ?? 0,
      fi: foeActive?.cardId, fh: foeActive?.hp ?? 0,
    };
    const b = prev.current;
    if (b) {
      if (b.fi === now.fi && now.fh < b.fh) setHit({ side: "foe", amount: b.fh - now.fh, key: now.fh + b.fh });
      else if (b.mi === now.mi && now.mh < b.mh) setHit({ side: "mine", amount: b.mh - now.mh, key: now.mh + b.mh });
      else if (b.mi === now.mi && now.mh > b.mh) setHeal({ index: mine.active, amount: now.mh - b.mh, key: now.mh + b.mh });
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myActive?.hp, foeActive?.hp, myActive?.cardId, foeActive?.cardId]);

  // Lock the page behind the arena while it owns the screen.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // ── Pointer drag ─────────────────────────────────────────────────────────
  const pendRef = useRef<{ d: Drag; x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const overRef = useRef<string | null>(null);
  const [dragUI, setDragUI] = useState<{ d: Drag; x: number; y: number; over: string | null } | null>(null);

  // Kept in a ref so the window listeners (mounted once) always call the
  // CURRENT handlers instead of a closure captured on the first render.
  const resolveRef = useRef<(d: Drag, target: string | null) => void>(() => {});
  resolveRef.current = (d, target) => {
    if (!target || !live) return;
    if (d.kind === "unit") {
      // Dropping a fighter anywhere on the battlefield sends it in and strikes.
      if (target === "field" || target === "foe") onAttack(d.index);
      return;
    }
    if (!onSupport) return;
    if (target.startsWith("ally-")) {
      const idx = Number(target.slice(5));
      onSupport(d.cardId, Number.isInteger(idx) ? idx : undefined);
    } else if (target === "field") {
      onSupport(d.cardId, mine.active >= 0 ? mine.active : undefined);
    }
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pendRef.current;
      if (!p) return;
      if (!dragRef.current) {
        // A small threshold keeps a tap a tap.
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
        dragRef.current = p.d;
      }
      // The ghost is pointer-events:none, so this reads what's UNDER the finger.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zone = el?.closest("[data-drop]") as HTMLElement | null;
      overRef.current = zone?.getAttribute("data-drop") || null;
      setDragUI({ d: dragRef.current, x: e.clientX, y: e.clientY, over: overRef.current });
    };
    const end = () => {
      if (dragRef.current) resolveRef.current(dragRef.current, overRef.current);
      pendRef.current = null;
      dragRef.current = null;
      overRef.current = null;
      setDragUI(null);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const startDrag = useCallback((d: Drag) => (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    pendRef.current = { d, x: e.clientX, y: e.clientY };
  }, []);

  const dragging = dragUI?.d ?? null;
  const over = dragUI?.over ?? null;
  // While a targeted support is in the air, every one of your cards lights up as
  // a legal destination — otherwise there's no way to know you can aim it.
  const aiming = dragging?.kind === "support" && dragging.targeted;

  const aliveFoe = foe.fighters.filter((f) => f.hp > 0).length;
  const aliveMine = mine.fighters.filter((f) => f.hp > 0).length;
  const playableSupports = useMemo(
    () => supports.filter((c) => !!c.support),
    [supports]
  );

  const ghostCard = dragging
    ? dragging.kind === "unit"
      ? byId[mine.fighters[dragging.index]?.cardId]
      : playableSupports.find((c) => c.id === dragging.cardId)
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] flex flex-col overflow-hidden select-none"
      style={{
        height: "100dvh",
        background:
          "radial-gradient(75% 40% at 50% 0%, rgba(56,110,190,.30), transparent 64%)," +
          "radial-gradient(75% 40% at 50% 100%, rgba(190,50,70,.30), transparent 64%)," +
          "linear-gradient(#07070e, #0c0b14)",
      }}
    >
      {/* floor grid — perspective lines so the middle reads as a FLOOR */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 34px, rgba(255,255,255,.55) 34px 35px)" }} />
      {/* the two sides get their own wash so the board never reads as one blob */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-sky-500/[0.07] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-rose-500/[0.07] to-transparent" />

      {/* ── top bar ── */}
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500/25 text-xs font-black text-sky-100 ring-1 ring-sky-400/40">
            {foeName[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-tight text-sky-100">{foeName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400/70">{aliveFoe} card{aliveFoe === 1 ? "" : "s"} standing</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeof stake === "number" && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-300">
              {duelPayout(stake).toLocaleString()} AP
            </span>
          )}
          <button onClick={onClose} aria-label="Leave the arena"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── opponent's bench ── */}
      <div className="relative z-10 flex shrink-0 items-start justify-center gap-2 px-3">
        {foe.fighters.map((f, i) => (
          <div key={i} className={`flex flex-col items-center gap-1 transition-all duration-300 ${f.hp <= 0 ? "opacity-20 grayscale" : ""}`}
            style={{ transform: i === foe.active && f.hp > 0 ? "scale(1)" : "scale(0.88)" }}>
            <div className={`relative rounded-lg transition ${i === foe.active && f.hp > 0 ? "ring-2 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,.45)]" : ""}`}>
              {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={bench} />}
              {f.hp <= 0 && (
                <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-12 border-y border-rose-500/70 bg-rose-950/80 text-center text-[7px] font-black uppercase tracking-[0.15em] text-rose-200">
                  Fallen
                </span>
              )}
            </div>
            <div style={{ width: bench }}><Bar f={f} h={4} /></div>
          </div>
        ))}
      </div>

      {/* ── the clash ── */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 py-1">
        <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="relative flex items-start justify-center gap-3 sm:gap-8">
          {/* THEIR champion — also a drop target, since dragging your card at
              the enemy is the obvious way to say "attack". */}
          <motion.div
            data-drop="foe"
            animate={hit?.side === "foe" ? { x: [0, -7, 7, -4, 0] } : {}}
            transition={{ duration: 0.32 }}
            className="text-center"
          >
            {foeActive && byId[foeActive.cardId] ? (
              <div className={`rounded-xl transition ${over === "foe" && dragging?.kind === "unit" ? "ring-4 ring-rose-400 shadow-[0_0_30px_rgba(244,63,94,.6)]" : ""}`}>
                <CardFace card={byId[foeActive.cardId]} owned foil={foeActive.foil} size={champ} showStats liveHp={foeActive.hp} />
                <div className="mx-auto mt-1.5" style={{ width: champ }}>
                  <Bar f={foeActive} h={10} showNumbers />
                </div>
              </div>
            ) : (
              <div className="grid place-items-center rounded-xl border-2 border-dashed border-sky-500/25"
                style={{ width: champ, aspectRatio: "5 / 7" }}>
                <span className="px-2 text-center text-[10px] font-black uppercase tracking-wider text-sky-500/50">
                  {foeName} hasn&rsquo;t sent anyone
                </span>
              </div>
            )}
          </motion.div>

          {/* centre column — VS mark and the floating damage number */}
          <div className="relative flex shrink-0 flex-col items-center justify-center self-center">
            <span className="text-xl font-black tracking-widest text-white/20 sm:text-3xl">VS</span>
            <AnimatePresence>
              {hit && (
                <motion.span key={hit.key}
                  initial={{ opacity: 0, scale: 0.5, y: hit.side === "foe" ? 20 : -20 }}
                  animate={{ opacity: 1, scale: 1.35, y: hit.side === "foe" ? -34 : 34 }}
                  exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.85, ease: "easeOut" }}
                  onAnimationComplete={() => setHit(null)}
                  className="absolute whitespace-nowrap text-3xl font-black text-rose-400 drop-shadow-[0_2px_12px_rgba(244,63,94,.85)]">
                  −{hit.amount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* MY champion — the primary drop target for both a fighter and an
              untargeted support card. */}
          <motion.div
            data-drop="field"
            animate={hit?.side === "mine" ? { x: [0, 7, -7, 4, 0] } : {}}
            transition={{ duration: 0.32 }}
            className="text-center"
          >
            {myActive && byId[myActive.cardId] ? (
              <div className={`relative rounded-xl transition ${
                over === "field" ? "ring-4 ring-emerald-400 shadow-[0_0_30px_rgba(52,211,153,.6)]"
                : aiming ? "ring-2 ring-cyan-400/60" : ""}`}>
                <CardFace card={byId[myActive.cardId]} owned foil={myActive.foil} size={champ} showStats liveHp={myActive.hp} />
                <div className="mx-auto mt-1.5" style={{ width: champ }}>
                  <Bar f={myActive} h={10} showNumbers />
                </div>
                <AnimatePresence>
                  {heal && heal.index === mine.active && (
                    <motion.span key={heal.key}
                      initial={{ opacity: 0, y: 0, scale: 0.7 }}
                      animate={{ opacity: 1, y: -40, scale: 1.2 }}
                      exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}
                      onAnimationComplete={() => setHeal(null)}
                      className="pointer-events-none absolute inset-x-0 top-1/3 text-2xl font-black text-emerald-300 drop-shadow-[0_2px_12px_rgba(52,211,153,.85)]">
                      +{heal.amount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                animate={live ? { scale: [1, 1.035, 1] } : {}}
                transition={{ duration: 1.8, repeat: live ? Infinity : 0 }}
                className={`grid place-items-center rounded-xl border-2 border-dashed transition ${
                  over === "field" ? "border-emerald-400 bg-emerald-500/20"
                    : live ? "border-rose-500/60 bg-rose-500/5" : "border-white/15"
                }`}
                style={{ width: champ, aspectRatio: "5 / 7" }}
              >
                <span className="px-2 text-center text-[10px] font-black uppercase tracking-wider text-rose-300/70">
                  {live ? "Drag a card here" : "Empty"}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ── TURN BANNER — the single most important line on the screen ── */}
        <div className={`relative z-10 mt-1 rounded-full border px-5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
          finished ? "border-white/20 bg-black/60 text-slate-200"
            : busy ? "border-white/20 bg-black/50 text-slate-400"
            : myTurn ? "border-rose-400/60 bg-rose-500/20 text-rose-100 shadow-[0_0_26px_rgba(244,63,94,.35)]"
            : "border-sky-400/40 bg-sky-500/10 text-sky-200"}`}>
          {finished
            ? (resultText || "Duel over")
            : busy ? "Resolving…"
            : dragging
            ? (dragging.kind === "support"
                ? (dragging.targeted ? "Drop it on a card to mend it" : "Drop it anywhere on your side")
                : "Drop to send this card in")
            : myTurn
            ? (mine.active < 0 ? "Send in your first card" : "Your move")
            : `${foeName} is thinking…`}
        </div>

        {/* battle log */}
        {log.length > 0 && (
          <div className={`w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] leading-relaxed text-slate-400 backdrop-blur ${roomy ? "max-h-24" : "max-h-14"}`}>
            {[...log].reverse().slice(0, 8).map((l, i) => (
              <div key={`${i}-${l}`} className={i === 0 ? "font-black text-white" : ""}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── YOUR SIDE ── */}
      <div className="relative z-10 shrink-0 border-t border-white/10 bg-black/60 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-black text-rose-100">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500/25 text-[10px] ring-1 ring-rose-400/40">{myName[0]?.toUpperCase()}</span>
            {myName}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">{aliveMine} standing</span>
        </div>

        {/* the hand — each card is ALSO an ally drop target for support */}
        <div className="flex items-end justify-center gap-2">
          {mine.fighters.map((f, i) => {
            const dead = f.hp <= 0;
            // A fallen card is still a legal target for a revive.
            const canTake = aiming && (dead ? true : f.hp < f.maxHp);
            const playable = live && !dead;
            const lit = over === `ally-${i}` && aiming;
            return (
              <motion.div
                key={i}
                data-drop={`ally-${i}`}
                whileTap={playable ? { scale: 0.95 } : {}}
                onPointerDown={playable ? startDrag({ kind: "unit", index: i }) : undefined}
                onClick={() => { if (playable) setSel(i); }}
                role="button"
                aria-disabled={!playable}
                title={dead ? `${f.name} has fallen` : `Choose ${f.name}`}
                style={{ touchAction: "none" }}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl p-1 transition ${
                  lit ? "bg-cyan-400/30 ring-2 ring-cyan-300 shadow-[0_0_22px_rgba(34,211,238,.6)]"
                    : canTake ? "ring-2 ring-cyan-400/40"
                    : dead ? "opacity-25 grayscale"
                    : sel === i ? "bg-rose-500/25 ring-2 ring-rose-400"
                    : playable ? "cursor-grab ring-1 ring-white/15 hover:ring-rose-400/60 active:cursor-grabbing"
                    : "opacity-70"
                } ${dragging?.kind === "unit" && dragging.index === i ? "opacity-30" : ""}`}
              >
                <div className="relative">
                  {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={hand} showStats liveHp={f.hp} />}
                  {/* Grayscale alone reads as "disabled", not "dead". A card
                      that has fallen gets said out loud. */}
                  {dead && (
                    <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-12 border-y border-rose-500/70 bg-rose-950/80 py-0.5 text-center text-[9px] font-black uppercase tracking-[0.2em] text-rose-200">
                      Fallen
                    </span>
                  )}
                </div>
                <div style={{ width: hand }}><Bar f={f} h={6} showNumbers /></div>
              </motion.div>
            );
          })}
        </div>

        {/* ── SUPPORT RAIL ── cards you own, each playable once per duel ── */}
        {!finished && playableSupports.length > 0 && onSupport && (
          <div className="mt-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-cyan-300" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80">
                Support — drag onto a card
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {playableSupports.map((c) => {
                const spent = usedSupports.includes(c.id);
                const usable = live && !spent;
                const targeted = TARGETED.has((c.support as any)?.kind);
                return (
                  <div
                    key={c.id}
                    onPointerDown={usable ? startDrag({ kind: "support", cardId: c.id, targeted }) : undefined}
                    onClick={() => { if (usable && !targeted) onSupport(c.id); }}
                    role="button"
                    aria-disabled={!usable}
                    title={spent ? `${c.name} — already played this duel`
                      : targeted ? `Drag ${c.name} onto a card` : `Play ${c.name} (costs your turn)`}
                    style={{ touchAction: "none" }}
                    className={`shrink-0 rounded-lg p-0.5 transition ${
                      usable ? "cursor-grab ring-1 ring-cyan-400/50 hover:-translate-y-1 hover:ring-cyan-300 active:cursor-grabbing"
                        : "opacity-25 grayscale"
                    } ${dragging?.kind === "support" && dragging.cardId === c.id ? "opacity-30" : ""}`}
                  >
                    <CardFace card={c} owned size={suppSize} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ACTIONS ── */}
        {!finished ? (
          <div className="mt-2.5 flex items-stretch justify-center gap-2">
            <button
              disabled={!live || sel === null}
              onClick={() => sel !== null && onAttack(sel)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-30"
            >
              <Swords className="h-4 w-4" />
              {!myTurn ? "Not your turn"
                : busy ? "Resolving…"
                : sel === null ? "Choose a card"
                : isSwap ? `Send in ${selected?.name?.split(" ").slice(-1)[0] ?? ""}`
                : "Attack"}
            </button>
            {ITEMS.map((it) => {
              const held = bag.filter((b) => b === it.id).length;
              // Gated on having deployed: an item with an empty field has
              // nothing to act on, and the server refuses it. Better to show it
              // as unavailable than to let the tap read as broken.
              const usable = live && held > 0 && mine.active >= 0;
              return (
                <button key={it.id} disabled={!usable} onClick={() => onItem(it.id)}
                  title={`${it.name}${held ? ` ×${held}` : " — none left"}${mine.active < 0 ? " — send in a card first" : ""}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black transition hover:bg-white/10 disabled:opacity-25">
                  <it.Icon className={`h-4 w-4 ${it.tint}`} />
                  {held > 0 && <span className="text-slate-300">{held}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <button onClick={onClose}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white">
            <Trophy className="h-4 w-4" /> Leave the arena
          </button>
        )}
      </div>

      {/* ── RESULT ── staking points on a duel and being told you won by a grey
          10px pill was the anticlimax of the whole feature. */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[150] grid place-items-center bg-black/55 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.7, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="pointer-events-auto mx-6 flex flex-col items-center gap-3 rounded-3xl border border-white/15 bg-[#0b0a12]/95 px-8 py-7 text-center shadow-[0_30px_80px_rgba(0,0,0,.8)]"
            >
              <Trophy className={`h-10 w-10 ${won ? "text-amber-300" : "text-slate-600"}`} />
              <p className={`text-2xl font-black ${won ? "text-amber-200" : "text-slate-300"}`}>
                {won ? "Victory" : "Defeated"}
              </p>
              {resultText && <p className="max-w-xs text-sm font-bold text-slate-400">{resultText}</p>}
              <button onClick={onClose}
                className="mt-1 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 px-6 py-2.5 text-sm font-black text-white transition hover:brightness-110">
                Leave the arena
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DRAG GHOST ── follows the finger. pointer-events:none is REQUIRED,
          otherwise elementFromPoint would only ever hit the ghost itself. */}
      {dragUI && ghostCard && (
        <div
          className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_10px_30px_rgba(0,0,0,.8)]"
          style={{ left: dragUI.x, top: dragUI.y, transform: "translate(-50%, -50%) rotate(-4deg) scale(1.06)" }}
        >
          <CardFace card={ghostCard} owned size={hand} />
        </div>
      )}
    </motion.div>
  );
}
