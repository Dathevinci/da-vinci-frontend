"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Heart, Shield, Crosshair, Trophy, Sparkles, Flag } from "lucide-react";
import CardFace, { CardDef } from "./CardFace";

/**
 * THE ARENA — a full-screen battle surface.
 *
 * SIZING IS MEASURED, NOT GUESSED. The previous build derived the card size from
 * `window.innerHeight * 0.30`, which ignored the chrome above and below it. On a
 * 928px laptop the champions came out 260px wide — 364px tall — inside a slot
 * with barely 240px to give, so the clash overflowed UPWARD and drew straight
 * through the opponent's bench while roughly 1200px of horizontal space sat
 * empty on either side. Everything below now comes out of one explicit vertical
 * budget: measure the shell, subtract the chrome, divide what's left between the
 * champion, the bench and the hand. Nothing can overlap because nothing is
 * allowed to ask for more room than exists.
 *
 * THE CLASH IS HORIZONTAL for the same reason: side-by-side needs the height of
 * ONE card rather than two, and width is the thing this screen has spare.
 *
 * DRAGGING IS POINTER-BASED, NOT HTML5. The old build used draggable/dataTransfer,
 * which does not fire at all on touch — so on a phone dragging was simply dead —
 * and its drop handler only called setSel, making a drop identical to a tap.
 * Pointer events cover mouse, pen and touch on one path, and hit-testing through
 * `data-drop` lets a support card be dropped onto a SPECIFIC ally to mend it.
 */

export interface Fighter {
  cardId: string; name: string; rarity: any;
  maxHp: number; hp: number; atk: number; foil: boolean;
}
export interface ArenaSide {
  userId: string; username: string; fighters: Fighter[]; active: number;
  // Buffs the server tracks. They used to be invisible, so you could raise a
  // Ward and have no way to tell whether it was still up.
  shield?: boolean; block?: boolean; focus?: boolean; focusMult?: number;
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
/** Mirrors FORFEIT_FINE_PERCENT on the server. */
export function duelForfeitFine(stake: number): number {
  return Math.ceil((stake * 25) / 100);
}

type Drag =
  | { kind: "unit"; index: number }
  | { kind: "support"; cardId: string; targeted: boolean };

function Bar({ f, h = 6, showNumbers = false }: { f: Fighter; h?: number; showNumbers?: boolean }) {
  const pct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
  const tone = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-600";
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-black/70 ring-1 ring-white/10" style={{ height: h }}>
      <motion.div className={`h-full rounded-full ${tone}`} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.45, ease: "easeOut" }} />
      {showNumbers && (
        <span className="absolute inset-0 grid place-items-center text-[9px] font-black tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]">
          {f.hp}/{f.maxHp}
        </span>
      )}
    </div>
  );
}

/** The active buffs on a side, spelled out under its champion. */
function Buffs({ side }: { side: ArenaSide }) {
  const list: { label: string; cls: string }[] = [];
  if (side.block) list.push({ label: "Bulwark", cls: "border-violet-400/50 bg-violet-500/25 text-violet-100" });
  if (side.shield) list.push({ label: "Ward", cls: "border-sky-400/50 bg-sky-500/25 text-sky-100" });
  if (side.focus) list.push({ label: "Focus +75%", cls: "border-amber-400/50 bg-amber-500/25 text-amber-100" });
  if (side.focusMult && side.focusMult > 1) {
    list.push({ label: `Focus ×${side.focusMult}`, cls: "border-amber-400/50 bg-amber-500/25 text-amber-100" });
  }
  if (!list.length) return null;
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-1">
      {list.map((b) => (
        <span key={b.label} className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${b.cls}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export default function Arena({
  mine, foe, byId, myName, foeName, myTurn, finished, resultText, won = false,
  bag = [], busy, log = [], stake,
  supports = [], usedSupports = [],
  onAttack, onItem, onSupport, onForfeit, onClose,
}: {
  mine: ArenaSide; foe: ArenaSide;
  byId: Record<string, CardDef>;
  myName: string; foeName: string;
  myTurn: boolean; finished: boolean; resultText?: string;
  /** Did I win? Passed explicitly — an abandoned duel leaves both sides alive,
   *  so counting survivors would call a walkover a loss. */
  won?: boolean;
  bag?: string[]; busy?: boolean; log?: string[]; stake?: number;
  /** Support cards you OWN — never spent, but each is playable once per duel. */
  supports?: CardDef[];
  usedSupports?: string[];
  onAttack: (index: number) => void;
  onItem: (item: string) => void;
  onSupport?: (cardId: string, target?: number) => void;
  onForfeit?: () => void;
  onClose: () => void;
}) {
  const myActive = mine.active >= 0 ? mine.fighters[mine.active] : undefined;
  const foeActive = foe.active >= 0 ? foe.fighters[foe.active] : undefined;

  const [sel, setSel] = useState<number | null>(null);
  const selected = sel !== null ? mine.fighters[sel] : undefined;
  const live = myTurn && !finished && !busy;
  const isSwap = sel !== null && mine.active >= 0 && sel !== mine.active;
  const [confirmQuit, setConfirmQuit] = useState(false);

  const playableSupports = useMemo(() => supports.filter((c) => !!c.support), [supports]);
  const hasSupport = playableSupports.length > 0 && !!onSupport && !finished;

  // ── Measured layout ──────────────────────────────────────────────────────
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 1024, h: 800 });
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // dvh changes when mobile browser chrome collapses; RO on the shell catches
    // it, but orientation needs the explicit nudge.
    window.addEventListener("orientationchange", measure);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", measure); };
  }, []);

  const clamp = (lo: number, v: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)));
  // Wide screens park the log in the empty margin instead of stacking it under
  // the board, which hands its height back to the cards.
  const wide = box.w >= 1024;
  // Everything that is NOT a card, in pixels.
  const chrome =
    58 +                       // top bar
    36 +                       // turn banner
    (wide ? 0 : log.length ? 56 : 0) +
    (hasSupport ? 76 : 0) +    // support rail
    (finished ? 0 : 58) +      // action bar
    46;                        // gaps + safe areas
  // A card is 5:7, and under each champion sits a bar plus a buff row (~34px).
  // bench = 0.30 champ and hand = 0.62 champ, so total card height works out to
  // champ * 1.4 * (1 + 0.30 + 0.62). Solving for champ is the whole budget.
  const forCards = box.h - chrome - 34;
  const lineup = Math.max(mine.fighters.length, foe.fighters.length, 1);
  const perCard = (box.w - (wide ? 340 : 24)) / lineup;
  const champ = clamp(92, Math.min(forCards / 2.688, box.w * 0.30), 300);
  const hand = clamp(52, Math.min(champ * 0.62, perCard - 10), 150);
  const bench = clamp(30, Math.min(champ * 0.30, perCard - 14), 92);
  const suppSize = clamp(44, champ * 0.32, 78);

  // ── A selection must never outlive the card it points at ─────────────────
  const hpKey = mine.fighters.map((f) => f.hp).join(",");
  useEffect(() => {
    if (sel !== null) {
      const f = mine.fighters[sel];
      if (!f || f.hp <= 0) setSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpKey, sel]);

  // ── Damage / heal flashes ────────────────────────────────────────────────
  // Keyed on cardId as well as hp: tracking hp alone meant a REDEPLOY (a
  // different card with different hp) rendered a phantom hit.
  const prev = useRef<{ mi?: string; mh: number; fi?: string; fh: number } | null>(null);
  const [hit, setHit] = useState<{ side: "mine" | "foe"; amount: number; key: number } | null>(null);
  const [heal, setHeal] = useState<{ amount: number; key: number } | null>(null);
  useEffect(() => {
    const now = { mi: myActive?.cardId, mh: myActive?.hp ?? 0, fi: foeActive?.cardId, fh: foeActive?.hp ?? 0 };
    const b = prev.current;
    if (b) {
      if (b.fi === now.fi && now.fh < b.fh) setHit({ side: "foe", amount: b.fh - now.fh, key: now.fh + b.fh });
      else if (b.mi === now.mi && now.mh < b.mh) setHit({ side: "mine", amount: b.mh - now.mh, key: now.mh + b.mh });
      else if (b.mi === now.mi && now.mh > b.mh) setHeal({ amount: now.mh - b.mh, key: now.mh + b.mh });
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myActive?.hp, foeActive?.hp, myActive?.cardId, foeActive?.cardId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // ── Pointer drag ─────────────────────────────────────────────────────────
  const pendRef = useRef<{ d: Drag; x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const overRef = useRef<string | null>(null);
  const didDragRef = useRef(false);
  const [dragUI, setDragUI] = useState<{ d: Drag; x: number; y: number; over: string | null } | null>(null);

  // Kept in a ref so the window listeners (mounted once) always call the
  // CURRENT handlers rather than a closure captured on the first render.
  const resolveRef = useRef<(d: Drag, target: string | null) => void>(() => {});
  resolveRef.current = (d, target) => {
    if (!target || !live) return;
    if (d.kind === "unit") {
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
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return; // a tap stays a tap
        dragRef.current = p.d;
      }
      // The ghost is pointer-events:none, so this reads what's UNDER the finger.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zone = el?.closest("[data-drop]") as HTMLElement | null;
      overRef.current = zone?.getAttribute("data-drop") || null;
      setDragUI({ d: dragRef.current, x: e.clientX, y: e.clientY, over: overRef.current });
    };
    const end = () => {
      // A click still fires after pointerup when the pointer moved, so without
      // this a completed drag would ALSO run the card's onClick — attacking and
      // then silently changing the selection underneath you.
      didDragRef.current = !!dragRef.current;
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
    didDragRef.current = false;
    pendRef.current = { d, x: e.clientX, y: e.clientY };
  }, []);
  const swallowClick = () => {
    if (!didDragRef.current) return false;
    didDragRef.current = false;
    return true;
  };

  const dragging = dragUI?.d ?? null;
  const over = dragUI?.over ?? null;
  const aiming = dragging?.kind === "support" && dragging.targeted;
  const aliveFoe = foe.fighters.filter((f) => f.hp > 0).length;
  const aliveMine = mine.fighters.filter((f) => f.hp > 0).length;

  const ghostCard = dragging
    ? dragging.kind === "unit"
      ? byId[mine.fighters[dragging.index]?.cardId]
      : playableSupports.find((c) => c.id === dragging.cardId)
    : undefined;

  const logPanel = log.length > 0 && (
    <div className={`overflow-y-auto rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] leading-relaxed text-slate-400 backdrop-blur ${
      wide ? "max-h-[38vh] w-full" : "max-h-14 w-full max-w-lg"}`}>
      {[...log].reverse().slice(0, wide ? 18 : 6).map((l, i) => (
        <div key={`${i}-${l}`} className={i === 0 ? "font-black text-white" : ""}>{l}</div>
      ))}
    </div>
  );

  return (
    <motion.div
      ref={shellRef}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] flex select-none flex-col overflow-hidden"
      style={{
        height: "100dvh",
        background:
          "radial-gradient(70% 38% at 50% 0%, rgba(56,110,190,.28), transparent 64%)," +
          "radial-gradient(70% 38% at 50% 100%, rgba(190,50,70,.28), transparent 64%)," +
          "linear-gradient(#07070e, #0c0b14)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 34px, rgba(255,255,255,.55) 34px 35px)" }} />

      {/* ── top bar ── */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500/25 text-xs font-black text-sky-100 ring-1 ring-sky-400/40">
            {foeName[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-tight text-sky-100">{foeName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400/70">
              {aliveFoe} of {foe.fighters.length} standing
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeof stake === "number" && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-300">
              {duelPayout(stake).toLocaleString()} AP
            </span>
          )}
          {!finished && onForfeit && (
            <button onClick={() => setConfirmQuit(true)} title="Forfeit this duel"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300">
              <Flag className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} aria-label="Leave the arena"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* On a wide screen the log lives in the dead margin beside the board. */}
      {wide && logPanel && (
        <div className="absolute right-3 top-16 z-10 w-[300px]">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Battle log</p>
          {logPanel}
        </div>
      )}

      {/* ── opponent's bench ── */}
      <div className="relative z-10 flex shrink-0 items-start justify-center gap-1.5 px-3">
        {foe.fighters.map((f, i) => (
          <div key={i} className={`flex flex-col items-center gap-1 transition-all duration-300 ${f.hp <= 0 ? "opacity-20 grayscale" : ""}`}
            style={{ transform: i === foe.active && f.hp > 0 ? "scale(1)" : "scale(0.9)" }}>
            <div className={`relative rounded-lg transition ${i === foe.active && f.hp > 0 ? "ring-2 ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,.45)]" : ""}`}>
              {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={bench} />}
              {f.hp <= 0 && (
                <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-12 border-y border-rose-500/70 bg-rose-950/80 text-center text-[7px] font-black uppercase tracking-[0.15em] text-rose-200">
                  Fallen
                </span>
              )}
            </div>
            <div style={{ width: bench }}><Bar f={f} h={3} /></div>
          </div>
        ))}
      </div>

      {/* ── the clash ── */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-3">
        {/* The divide runs BETWEEN the champions, not across them — a horizontal
            rule in a side-by-side clash cut through both cards and read as
            damage. The pools give left sky and right rose so the zone states
            who is who even mid-animation. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-2 left-1/2 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-4 left-0 w-1/2 rounded-r-full bg-[radial-gradient(circle_at_40%_50%,rgba(56,189,248,.10),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-y-4 right-0 w-1/2 rounded-l-full bg-[radial-gradient(circle_at_60%_50%,rgba(244,63,94,.10),transparent_70%)]" />

        <div className="relative flex items-start justify-center gap-3 sm:gap-8">
          {/* THEIR champion — dragging your card at the enemy is the obvious
              way to say "attack", so it is a drop target too. */}
          <motion.div data-drop="foe" animate={hit?.side === "foe" ? { x: [0, -7, 7, -4, 0] } : {}}
            transition={{ duration: 0.32 }} className="text-center">
            {foeActive && byId[foeActive.cardId] ? (
              <div className={`rounded-xl transition ${over === "foe" && dragging?.kind === "unit" ? "ring-4 ring-rose-400 shadow-[0_0_30px_rgba(244,63,94,.6)]" : ""}`}>
                <CardFace card={byId[foeActive.cardId]} owned foil={foeActive.foil} size={champ} showStats liveHp={foeActive.hp} />
                <div className="mx-auto mt-1.5" style={{ width: champ }}>
                  <Bar f={foeActive} h={9} showNumbers />
                  <Buffs side={foe} />
                </div>
              </div>
            ) : (
              <div className="grid place-items-center rounded-xl border-2 border-dashed border-sky-500/25"
                style={{ width: champ, aspectRatio: "5 / 7" }}>
                <span className="px-2 text-center text-[10px] font-black uppercase leading-relaxed tracking-wider text-sky-500/50">
                  {`${foeName} hasn’t sent anyone`}
                </span>
              </div>
            )}
          </motion.div>

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
              {heal && (
                <motion.span key={`h${heal.key}`}
                  initial={{ opacity: 0, scale: 0.6, y: 0 }} animate={{ opacity: 1, scale: 1.2, y: 40 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}
                  onAnimationComplete={() => setHeal(null)}
                  className="absolute whitespace-nowrap text-2xl font-black text-emerald-300 drop-shadow-[0_2px_12px_rgba(52,211,153,.85)]">
                  +{heal.amount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* MY champion — the drop target for a fighter and for an untargeted
              support card. */}
          <motion.div data-drop="field" animate={hit?.side === "mine" ? { x: [0, 7, -7, 4, 0] } : {}}
            transition={{ duration: 0.32 }} className="text-center">
            {myActive && byId[myActive.cardId] ? (
              <div className={`rounded-xl transition ${
                over === "field" ? "ring-4 ring-emerald-400 shadow-[0_0_30px_rgba(52,211,153,.6)]"
                  : aiming ? "ring-2 ring-cyan-400/60" : ""}`}>
                <CardFace card={byId[myActive.cardId]} owned foil={myActive.foil} size={champ} showStats liveHp={myActive.hp} />
                <div className="mx-auto mt-1.5" style={{ width: champ }}>
                  <Bar f={myActive} h={9} showNumbers />
                  <Buffs side={mine} />
                </div>
              </div>
            ) : (
              <motion.div animate={live ? { scale: [1, 1.035, 1] } : {}}
                transition={{ duration: 1.8, repeat: live ? Infinity : 0 }}
                className={`grid place-items-center rounded-xl border-2 border-dashed transition ${
                  over === "field" ? "border-emerald-400 bg-emerald-500/20"
                    : live ? "border-rose-500/60 bg-rose-500/5" : "border-white/15"}`}
                style={{ width: champ, aspectRatio: "5 / 7" }}>
                <span className="px-2 text-center text-[10px] font-black uppercase tracking-wider text-rose-300/70">
                  {live ? "Drag a card here" : "Empty"}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ── TURN BANNER ── */}
        <div className={`relative z-10 rounded-full border px-5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
          finished ? "border-white/20 bg-black/60 text-slate-200"
            : busy ? "border-white/20 bg-black/50 text-slate-400"
            : myTurn ? "border-rose-400/60 bg-rose-500/20 text-rose-100 shadow-[0_0_26px_rgba(244,63,94,.35)]"
            : "border-sky-400/40 bg-sky-500/10 text-sky-200"}`}>
          {finished ? (resultText || "Duel over")
            : busy ? "Resolving…"
            : dragging
            ? (dragging.kind === "support"
                ? (dragging.targeted ? "Drop it on a card to mend it" : "Drop it anywhere on your side")
                : "Drop to send this card in")
            : myTurn ? (mine.active < 0 ? "Send in your first card" : "Your move")
            : `${foeName} is thinking…`}
        </div>

        {!wide && logPanel}
      </div>

      {/* ── YOUR SIDE ── */}
      <div className="relative z-10 shrink-0 border-t border-white/10 bg-black/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="flex items-center gap-2 text-sm font-black text-rose-100">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500/25 text-[10px] ring-1 ring-rose-400/40">{myName[0]?.toUpperCase()}</span>
            {myName}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">
            {aliveMine} of {mine.fighters.length} standing
          </span>
        </div>

        {/* the hand — each card is ALSO an ally drop target for support */}
        <div className="flex items-end justify-center gap-1.5">
          {mine.fighters.map((f, i) => {
            const dead = f.hp <= 0;
            const canTake = aiming && (dead || f.hp < f.maxHp);
            const playable = live && !dead;
            const lit = over === `ally-${i}` && aiming;
            return (
              <motion.div key={i} data-drop={`ally-${i}`}
                whileTap={playable ? { scale: 0.95 } : {}}
                onPointerDown={playable ? startDrag({ kind: "unit", index: i }) : undefined}
                onClick={() => { if (swallowClick()) return; if (playable) setSel(i); }}
                role="button" aria-disabled={!playable}
                title={dead ? `${f.name} has fallen` : `Choose ${f.name}`}
                style={{ touchAction: "none" }}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl p-0.5 transition ${
                  lit ? "bg-cyan-400/30 ring-2 ring-cyan-300 shadow-[0_0_22px_rgba(34,211,238,.6)]"
                    : canTake ? "ring-2 ring-cyan-400/40"
                    : dead ? "opacity-25 grayscale"
                    : sel === i ? "bg-rose-500/25 ring-2 ring-rose-400"
                    : playable ? "cursor-grab ring-1 ring-white/15 hover:ring-rose-400/60 active:cursor-grabbing"
                    : "opacity-70"
                } ${dragging?.kind === "unit" && dragging.index === i ? "opacity-30" : ""}`}>
                <div className="relative">
                  {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={hand} showStats liveHp={f.hp} />}
                  {dead && (
                    <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-12 border-y border-rose-500/70 bg-rose-950/80 py-0.5 text-center text-[8px] font-black uppercase tracking-[0.2em] text-rose-200">
                      Fallen
                    </span>
                  )}
                </div>
                <div style={{ width: hand }}><Bar f={f} h={5} showNumbers /></div>
              </motion.div>
            );
          })}
        </div>

        {/* ── SUPPORT RAIL ── */}
        {hasSupport && (
          <div className="mt-2">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-cyan-300" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80">Support — drag onto a card</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {playableSupports.map((c) => {
                const spent = usedSupports.includes(c.id);
                const usable = live && !spent;
                const targeted = TARGETED.has((c.support as any)?.kind);
                return (
                  <div key={c.id}
                    onPointerDown={usable ? startDrag({ kind: "support", cardId: c.id, targeted }) : undefined}
                    onClick={() => { if (swallowClick()) return; if (usable && !targeted) onSupport!(c.id); }}
                    role="button" aria-disabled={!usable}
                    title={spent ? `${c.name} — already played this duel`
                      : targeted ? `Drag ${c.name} onto a card` : `Play ${c.name} (costs your turn)`}
                    style={{ touchAction: "none" }}
                    className={`shrink-0 rounded-lg p-0.5 transition ${
                      usable ? "cursor-grab ring-1 ring-cyan-400/50 hover:-translate-y-1 hover:ring-cyan-300 active:cursor-grabbing"
                        : "opacity-25 grayscale"
                    } ${dragging?.kind === "support" && dragging.cardId === c.id ? "opacity-30" : ""}`}>
                    <CardFace card={c} owned size={suppSize} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ACTIONS ── */}
        {!finished ? (
          <div className="mt-2 flex items-stretch justify-center gap-2">
            <button disabled={!live || sel === null} onClick={() => sel !== null && onAttack(sel)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-30">
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
              // nothing to act on, and the server refuses it.
              const usable = live && held > 0 && mine.active >= 0;
              return (
                <button key={it.id} disabled={!usable} onClick={() => onItem(it.id)}
                  title={held === 0 ? `${it.name} — none left` : mine.active < 0 ? `${it.name} — send in a card first` : `${it.name} ×${held}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black transition hover:bg-white/10 disabled:opacity-25">
                  <it.Icon className={`h-4 w-4 ${it.tint}`} />
                  {held > 0 && <span className="text-slate-300">{held}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <button onClick={onClose}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white">
            <Trophy className="h-4 w-4" /> Leave the arena
          </button>
        )}
      </div>

      {/* ── FORFEIT CONFIRM ── money leaves your account, so it is never one tap */}
      <AnimatePresence>
        {confirmQuit && !finished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[160] grid place-items-center bg-black/70 backdrop-blur-[2px] px-6">
            <motion.div initial={{ scale: 0.85, y: 16 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl border border-rose-500/30 bg-[#120d12] p-6 text-center">
              <Flag className="mx-auto h-8 w-8 text-rose-400" />
              <p className="mt-3 text-lg font-black text-white">Forfeit this duel?</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {foeName} wins.{" "}
                {typeof stake === "number" ? (
                  <>
                    You lose your {stake.toLocaleString()} AP stake <span className="font-black text-rose-300">
                    and pay a {duelForfeitFine(stake).toLocaleString()} AP fine</span> on top, paid to them.
                  </>
                ) : (
                  <>You lose your stake and pay a fine on top.</>
                )}{" "}
                It counts as a loss on the ladder.
              </p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setConfirmQuit(false)}
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-black text-slate-300 transition hover:bg-white/10">
                  Keep playing
                </button>
                <button disabled={busy} onClick={() => { setConfirmQuit(false); onForfeit?.(); }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-700 to-red-700 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-40">
                  Forfeit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT ── */}
      <AnimatePresence>
        {finished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[150] grid place-items-center bg-black/55 backdrop-blur-[2px]">
            <motion.div initial={{ scale: 0.7, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="pointer-events-auto mx-6 flex flex-col items-center gap-3 rounded-3xl border border-white/15 bg-[#0b0a12]/95 px-8 py-7 text-center shadow-[0_30px_80px_rgba(0,0,0,.8)]">
              <Trophy className={`h-10 w-10 ${won ? "text-amber-300" : "text-slate-600"}`} />
              <p className={`text-2xl font-black ${won ? "text-amber-200" : "text-slate-300"}`}>{won ? "Victory" : "Defeated"}</p>
              {resultText && <p className="max-w-xs text-sm font-bold text-slate-400">{resultText}</p>}
              <button onClick={onClose}
                className="mt-1 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 px-6 py-2.5 text-sm font-black text-white transition hover:brightness-110">
                Leave the arena
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DRAG GHOST ── pointer-events:none is REQUIRED, or elementFromPoint
          would only ever hit the ghost itself. */}
      {dragUI && ghostCard && (
        <div className="pointer-events-none fixed z-[200] opacity-90 drop-shadow-[0_10px_30px_rgba(0,0,0,.8)]"
          style={{ left: dragUI.x, top: dragUI.y, transform: "translate(-50%, -50%) rotate(-4deg) scale(1.06)" }}>
          <CardFace card={ghostCard} owned size={hand} />
        </div>
      )}
    </motion.div>
  );
}
