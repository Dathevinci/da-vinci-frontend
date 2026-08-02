"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Heart, Shield, Crosshair, Trophy, Sparkles, Flag } from "lucide-react";
import CardFace, { CardDef } from "./CardFace";
// notch() is used by the support inspect sheet's buttons. It was missing, and
// because the frontend builds with typescript.ignoreBuildErrors the build was
// green while tapping a support card threw ReferenceError straight into the
// Next error boundary — the "Try Again" page. gacha.tsx imports only React,
// so there is no cycle here.
import { notch } from "./gacha";

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

/** Mirrors SUPPORTS_PER_DUEL on the server, which is where it's enforced. */
export const SUPPORTS_PER_DUEL = 3;

/** Plain English for what a support does, and how you aim it. */
function supportBrief(s: any): { what: string; how: string } {
  switch (s?.kind) {
    case "heal":   return { what: `Restores ${s.power} HP to one of your cards.`, how: "Drag it onto the card you want mended." };
    case "revive": return { what: `Brings a fallen card back at ${s.power}% health.`, how: "Drag it onto the card you want back." };
    case "mend":   return { what: `Heals your whole line by ${s.power} HP.`, how: "Play it — it affects everyone at once." };
    case "shield": return { what: "Halves the next hit you take.", how: "Play it — it guards whoever is out there." };
    case "block":  return { what: "The next attack against you doesn't land at all.", how: "Play it — it guards whoever is out there." };
    case "focus":  return { what: `Your next strike hits ${s.power}× as hard.`, how: "Play it, then attack." };
    default:       return { what: "Does something helpful.", how: "Play it." };
  }
}

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

/**
 * Health as a SHEARED bar rather than a rounded pill. Same shape language as
 * the rest of the card UI — a rounded bar was the last piece of default
 * styling left on this screen.
 */
function Bar({ f, h = 6, showNumbers = false }: { f: Fighter; h?: number; showNumbers?: boolean }) {
  const pct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
  const tone = pct > 50 ? "#34d399" : pct > 20 ? "#fbbf24" : "#f43f5e";
  return (
    <div className="relative w-full overflow-hidden bg-black/75"
      style={{ height: h, clipPath: "polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
      <motion.div className="h-full" animate={{ width: `${pct}%` }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{ background: `linear-gradient(90deg, ${tone}, ${tone}cc)`, boxShadow: `0 0 8px ${tone}80` }} />
      {showNumbers && (
        <span className="absolute inset-0 grid place-items-center text-[9px] font-black tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.95)]">
          {f.hp}/{f.maxHp}
        </span>
      )}
    </div>
  );
}

/**
 * The impact when a card lands on the field — something heavy hitting the
 * floor. Two ground rings thrown outward plus a short dust puff.
 *
 * Keyed on the cardId, so it fires once when the card in the slot CHANGES and
 * never again on the poll ticks in between. Transform and opacity only, and it
 * unmounts itself on a timer rather than onAnimationComplete, which fires on
 * the wrapper's own animation and not the keyframes inside it.
 */
function LandShock({ cardId }: { cardId?: string }) {
  const [key, setKey] = useState(0);
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!cardId || cardId === prev.current) { prev.current = cardId; return; }
    prev.current = cardId;
    setKey((k) => k + 1);
  }, [cardId]);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (key === 0) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 620);
    return () => clearTimeout(t);
  }, [key]);

  return (
    <AnimatePresence>
      {on && (
        <motion.div key={key} aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 grid place-items-center overflow-visible"
          initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {[0, 1].map((i) => (
            <motion.span key={i} className="absolute rounded-[50%]"
              style={{ width: 130, height: 26, border: "2px solid rgba(255,255,255,.55)", willChange: "transform, opacity" }}
              initial={{ scale: 0.25, opacity: 0.9 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.55, delay: i * 0.09, ease: "easeOut" }}
            />
          ))}
          <motion.span className="absolute rounded-[50%]"
            style={{ width: 150, height: 34, background: "radial-gradient(closest-side, rgba(255,255,255,.35), transparent 70%)", willChange: "transform, opacity" }}
            initial={{ scale: 0.4, opacity: 0.85 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
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

/**
 * The death of a fighter, made visible: a shockwave ring, eight shards thrown
 * outward, and K.O. stamped over the slot. Fixed element count, transform and
 * opacity only, unmounted by the parent's timer.
 */
function KoBurst({ show, koKey }: { show?: boolean; koKey?: number }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={koKey} aria-hidden
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-visible"
          initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.span className="absolute rounded-full"
            style={{ width: 150, height: 150, border: "3px solid rgba(244,63,94,.9)", willChange: "transform, opacity" }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <motion.span key={i} className="absolute h-2 w-2 rounded-sm"
                style={{ background: i % 2 ? "#fda4af" : "#f43f5e", willChange: "transform, opacity" }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: Math.cos(a) * 110, y: Math.sin(a) * 110, opacity: 0, rotate: 200 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            );
          })}
          <motion.span
            className="relative text-4xl font-black uppercase tracking-[0.18em] text-rose-300 drop-shadow-[0_2px_16px_rgba(244,63,94,.9)]"
            initial={{ scale: 2.4, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            transition={{ duration: 0.22, ease: "easeIn" }}>
            K.O.
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Arena({
  mine, foe, byId, myName, foeName, myTurn, finished, resultText, won = false,
  bag = [], busy, log = [], stake, round = 1,
  supports = [], usedSupports = [],
  onAttack, onDeploy, onItem, onSupport, onAbility, abilityIds, abilities, onForfeit, onClose,
}: {
  mine: ArenaSide; foe: ArenaSide;
  byId: Record<string, CardDef>;
  myName: string; foeName: string;
  myTurn: boolean; finished: boolean; resultText?: string;
  /** Did I win? Passed explicitly — an abandoned duel leaves both sides alive,
   *  so counting survivors would call a walkover a loss. */
  won?: boolean;
  bag?: string[]; busy?: boolean; log?: string[]; stake?: number;
  /** Current round, shown live in the battle log header. */
  round?: number;
  /** Support cards you OWN — never spent, but each is playable once per duel. */
  supports?: CardDef[];
  usedSupports?: string[];
  /** Swing with whoever is already on the field. Deploying is a separate move. */
  onAttack: () => void;
  onDeploy: (index: number) => void;
  onItem: (item: string) => void;
  onSupport?: (cardId: string, target?: number) => void;
  /** Fire the standing card's skill or domain. Once per duel, costs the turn. */
  onAbility?: () => void;
  /** Card ids that HAVE an ability, so the button only offers a real move. */
  abilityIds?: Set<string>;
  /** cardId -> { name, kind, levels[], isDomain }. Lets the board SAY what an
   *  ability does rather than offering an unlabelled button. */
  abilities?: Record<string, any>;
  onForfeit?: () => void;
  onClose: () => void;
}) {
  const myActive = mine.active >= 0 ? mine.fighters[mine.active] : undefined;
  const foeActive = foe.active >= 0 ? foe.fighters[foe.active] : undefined;

  const [sel, setSel] = useState<number | null>(null);
  const selected = sel !== null ? mine.fighters[sel] : undefined;
  const live = myTurn && !finished && !busy;
  // Selecting a card that isn't the one already fighting means you want to send
  // it in; an empty field always means deploy.
  const wantsDeploy = mine.active < 0 || (sel !== null && sel !== mine.active);
  const [confirmQuit, setConfirmQuit] = useState(false);
  // The support card currently being inspected, before you commit to it.
  const [peek, setPeek] = useState<CardDef | null>(null);
  // The support rail starts shut — see the note beside it.
  const [showSupports, setShowSupports] = useState(false);

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
    (hasSupport ? 96 : 0) +    // support rail
    (finished ? 0 : 58) +      // action bar
    46;                        // gaps + safe areas
  // A card is 5:7. Under the champion sits a bar plus a buff row, and each
  // bench and hand card carries its own bar — 62px of non-card furniture that
  // the first pass forgot, which is why the hand's health bars were sheared off
  // at the bottom edge. bench = 0.34 champ and hand = 0.58 champ, so the card
  // height works out to champ * 1.4 * (1 + 0.46 + 0.58). Solve for champ.
  //
  // The bench used to be 0.34 against the hand's 0.58 — barely half the
  // weight for the same information. The opponent's line is how you read the
  // game, and at that ratio the top of the board read as decoration while the
  // bottom read as content. 0.46 closes most of the gap without letting the
  // bench rival your own hand.
  //
  // THE DIVISOR BELOW MOVES WITH IT. 1 + 0.46 + 0.58 = 2.04, so the ratio is
  // 1.4 * 2.04 = 2.856. Leaving it at 2.688 would size the champion for a
  // shorter stack than actually renders, and this board has roughly no slack
  // — it would overflow into the opponent's bench on a laptop.
  const forCards = box.h - chrome - 62;
  const lineup = Math.max(mine.fighters.length, foe.fighters.length, 1);
  const perCard = (box.w - (wide ? 340 : 24)) / lineup;
  const champ = clamp(92, Math.min(forCards / 2.856, box.w * 0.30), 300);
  const hand = clamp(56, Math.min(champ * 0.58, perCard - 10), 150);
  // Floors matter: below ~48px a card is unreadable mush rather than a small
  // card, and the opponent's line is how you read the game.
  const bench = clamp(56, Math.min(champ * 0.46, perCard - 14), 118);
  // 78 floor, not 52. Below the card face's ~68-76px thresholds a support
  // renders as art with no panel, no name and no grade plate — and supports
  // have no painted art, so what was left was a dim grey smudge. 78 clears
  // the name row and the corner plate, which is the minimum for the tray to
  // read as cards rather than placeholders.
  const suppSize = clamp(78, champ * 0.42, 112);

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
  const prev = useRef<{ mi?: string; mh: number; fi?: string; fh: number; am: number; af: number } | null>(null);
  const [hit, setHit] = useState<{ side: "mine" | "foe"; amount: number; key: number } | null>(null);
  const [heal, setHeal] = useState<{ amount: number; key: number } | null>(null);
  /**
   * A KILLING BLOW used to show nothing at all. The server empties the field
   * when a fighter dies (active becomes -1), so the active-card comparison
   * above sees a vanished cardId and registers no hit — the single most
   * important moment in a duel was invisible. Deaths are detected from the
   * alive COUNT dropping instead, which survives the field emptying.
   */
  const [ko, setKo] = useState<{ side: "mine" | "foe"; key: number } | null>(null);

  /**
   * DOMAIN EXPANSION — the one animation the whole legendary tier is selling.
   *
   * Detected off the log rather than a prop: the engine marks a domain line
   * with a leading triangle, and that line is already in the state the board
   * polls. No new field, and it fires for BOTH players — watching the other
   * side expand a domain should be as loud as doing it yourself.
   */
  const [domain, setDomain] = useState<{ text: string; mine: boolean; key: number } | null>(null);
  const lastLogRef = useRef<string | null>(null);
  useEffect(() => {
    const line = log.length ? log[log.length - 1] : null;
    if (!line || line === lastLogRef.current) return;
    lastLogRef.current = line;
    if (!line.startsWith("25B2")) return;
    setDomain({ text: line.replace(/^25B2s*/, ""), mine: line.includes(myName), key: Date.now() });
  }, [log, myName]);
  // Cleared on a timer, never onAnimationComplete — that fires on the wrapper's
  // own animation, not the keyframes inside it.
  useEffect(() => {
    if (!domain) return;
    const t = setTimeout(() => setDomain(null), 2600);
    return () => clearTimeout(t);
  }, [domain?.key]);
  const aliveFoe = foe.fighters.filter((f) => f.hp > 0).length;
  const aliveMine = mine.fighters.filter((f) => f.hp > 0).length;
  useEffect(() => {
    const now = {
      mi: myActive?.cardId, mh: myActive?.hp ?? 0,
      fi: foeActive?.cardId, fh: foeActive?.hp ?? 0,
      am: aliveMine, af: aliveFoe,
    };
    const b = prev.current;
    if (b) {
      if (now.af < b.af) {
        // The fallen card WAS the active one, so its last-known hp is the
        // least the blow dealt — honest, even if the roll gave a little more.
        setHit({ side: "foe", amount: b.fh, key: Date.now() });
        setKo({ side: "foe", key: Date.now() });
      } else if (now.am < b.am) {
        setHit({ side: "mine", amount: b.mh, key: Date.now() });
        setKo({ side: "mine", key: Date.now() });
      } else if (b.fi === now.fi && now.fh < b.fh) {
        setHit({ side: "foe", amount: b.fh - now.fh, key: now.fh + b.fh });
      } else if (b.mi === now.mi && now.mh < b.mh) {
        setHit({ side: "mine", amount: b.mh - now.mh, key: now.mh + b.mh });
      } else if (b.mi === now.mi && now.mh > b.mh) {
        setHeal({ amount: now.mh - b.mh, key: now.mh + b.mh });
      }
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myActive?.hp, foeActive?.hp, myActive?.cardId, foeActive?.cardId, aliveMine, aliveFoe]);

  // Cleared on a timer, not onAnimationComplete — that callback fires when the
  // wrapper's own animation ends, not the keyframes inside it (the dust-burst
  // lesson).
  useEffect(() => {
    if (!ko) return;
    const t = setTimeout(() => setKo(null), 1000);
    return () => clearTimeout(t);
  }, [ko?.key]);

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
      // Dropping a card on the battlefield SENDS IT IN. It does not swing —
      // that used to happen in the same gesture, so a drag both committed a
      // card and spent the attack before you'd seen the board.
      if (target === "field" || target === "foe") onDeploy(d.index);
      return;
    }
    if (!onSupport) return;
    // Drag has to respect the slot limit too — the rail greys spent cards out,
    // but a drag started before the third play resolved would slip past it.
    if (usedSupports.includes(d.cardId) || usedSupports.length >= SUPPORTS_PER_DUEL) return;
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

  const ghostCard = dragging
    ? dragging.kind === "unit"
      ? byId[mine.fighters[dragging.index]?.cardId]
      : playableSupports.find((c) => c.id === dragging.cardId)
    : undefined;

  /**
   * The battle log, read as a live feed rather than a footnote.
   *
   * The newest line gets its own row at the top — it is what just happened,
   * and burying it in a scroll of identically-styled text was why nobody could
   * tell what a card had actually done. Everything older is history underneath.
   *
   * Lines are NOT tagged with a round each: the server pushes plain strings, so
   * assigning a round to a line here would be a guess. The current round is
   * shown once, in the header, where it is true.
   */
  const logPanel = log.length > 0 && (() => {
    const newest = log[log.length - 1];
    const older = [...log].slice(0, -1).reverse();
    // Domain lines are marked with a leading triangle by the engine.
    const isBig = newest.startsWith("▲");
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-white/10 bg-black/70 ${wide ? "" : "max-w-lg"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Battle log
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
            Round <span className="tabular-nums text-slate-300">{round}</span>
          </span>
        </div>

        <div
          key={newest}
          className={`px-3 py-2 text-[12px] font-black leading-snug ${isBig ? "text-fuchsia-200" : "text-white"}`}
          style={{ background: isBig ? "rgba(217,70,239,.12)" : "rgba(255,255,255,.04)" }}
        >
          {newest}
        </div>

        {older.length > 0 && (
          <div className={`overflow-y-auto px-3 py-1.5 text-[11px] leading-relaxed text-slate-500 ${wide ? "max-h-[30vh]" : "max-h-12"}`}>
            {older.slice(0, wide ? 18 : 6).map((l, i) => (
              <div key={`${i}-${l}`}>{l}</div>
            ))}
          </div>
        )}
      </div>
    );
  })();

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
          {/* ATTACKER LUNGES, DEFENDER SHAKES. The foe sits on the left, so
              when it deals damage (hit on MY side) it lunges right toward me;
              when it takes damage it recoils. Two transforms, no layout. */}
          <motion.div data-drop="foe"
            animate={
              hit?.side === "foe" ? { x: [0, -8, 8, -4, 0] }
              : hit?.side === "mine" ? { x: [0, 42, 0] } : {}
            }
            transition={hit?.side === "mine" ? { duration: 0.38, times: [0, 0.3, 1], ease: "easeOut" } : { duration: 0.32 }}
            className="relative text-center">
            <KoBurst show={ko?.side === "foe"} koKey={ko?.key} />
            {foeActive && byId[foeActive.cardId] ? (
              // Keyed on the cardId: a deploy or redeploy re-mounts this block,
              // so a card ARRIVES on the field instead of teleporting in. One
              // fixed-duration tween — the spring-on-SVG lesson stands.
              <motion.div key={foeActive.cardId}
                initial={{ y: 26, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-xl transition ${over === "foe" && dragging?.kind === "unit" ? "ring-4 ring-rose-400 shadow-[0_0_30px_rgba(244,63,94,.6)]" : ""}`}>
                <CardFace card={byId[foeActive.cardId]} owned foil={foeActive.foil} size={champ} showStats liveHp={foeActive.hp} liveMaxHp={foeActive.maxHp} />
                <div className="mx-auto mt-1.5" style={{ width: champ }}>
                  <Bar f={foeActive} h={9} showNumbers />
                  <Buffs side={foe} />
                </div>
              </motion.div>
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
            {/* impact flash — fires with every hit, behind the number */}
            <AnimatePresence>
              {hit && (
                <motion.span key={`fx${hit.key}`} aria-hidden
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    width: 140, height: 140,
                    background: "radial-gradient(closest-side, rgba(255,255,255,.95), rgba(244,63,94,.55) 45%, transparent 70%)",
                    willChange: "transform, opacity",
                  }}
                  initial={{ scale: 0.15, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
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
          <motion.div data-drop="field"
            animate={
              hit?.side === "mine" ? { x: [0, 8, -8, 4, 0] }
              : hit?.side === "foe" ? { x: [0, -42, 0] } : {}
            }
            transition={hit?.side === "foe" ? { duration: 0.38, times: [0, 0.3, 1], ease: "easeOut" } : { duration: 0.32 }}
            className="relative text-center">
            <KoBurst show={ko?.side === "mine"} koKey={ko?.key} />
            <LandShock cardId={myActive?.cardId} />
            {myActive && byId[myActive.cardId] ? (
              /* It DROPS in rather than fading. Starting higher, bigger and
                 overshooting on the way down reads as weight landing, which is
                 what the shockwave underneath is answering. */
              <motion.div key={myActive.cardId}
                initial={{ y: -70, scale: 1.18, opacity: 0 }}
                animate={{ y: [-70, 6, 0], scale: [1.18, 0.94, 1], opacity: [0, 1, 1] }}
                transition={{ duration: 0.42, times: [0, 0.72, 1], ease: [0.4, 0, 0.2, 1] }}
                style={{ willChange: "transform, opacity" }}
                className={`rounded-xl transition ${
                over === "field" ? "ring-4 ring-emerald-400 shadow-[0_0_30px_rgba(52,211,153,.6)]"
                  : aiming ? "ring-2 ring-cyan-400/60" : ""}`}>
                <CardFace card={byId[myActive.cardId]} owned foil={myActive.foil} size={champ} showStats liveHp={myActive.hp} liveMaxHp={myActive.maxHp} />
                <div className="mx-auto mt-1.5" style={{ width: champ }}>
                  <Bar f={myActive} h={9} showNumbers />
                  <Buffs side={mine} />
                </div>
              </motion.div>
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

        {/* ── TURN BANNER ── shrink-0 so the flex parent cannot compress it.
            Without it the clash section reclaimed the banner's height when
            space ran short and sliced the text in half against the edge of
            YOUR SIDE below. */}
        <div className={`relative z-10 shrink-0 px-6 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition ${
          finished ? "text-slate-200"
            : busy ? "text-slate-400"
            : myTurn ? "text-rose-50 shadow-[0_0_30px_rgba(244,63,94,.4)]"
            : "text-sky-100"}`}
          style={{
            clipPath: "polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%)",
            background: finished ? "rgba(10,8,20,.85)"
              : busy ? "rgba(10,8,20,.75)"
              : myTurn ? "linear-gradient(100deg, rgba(244,63,94,.35), rgba(120,40,90,.5))"
              : "linear-gradient(100deg, rgba(56,132,255,.28), rgba(30,60,120,.45))",
            boxShadow: `inset 0 0 0 1px ${myTurn && !finished && !busy ? "rgba(255,150,170,.55)" : "rgba(255,255,255,.18)"}`,
          }}>
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
      <div className="relative z-10 shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
        style={{
          background: "linear-gradient(180deg, rgba(20,10,30,.82), rgba(8,5,14,.94))",
          boxShadow: "inset 0 1px 0 rgba(162,116,255,.35), 0 -18px 40px rgba(0,0,0,.55)",
        }}>
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
            // The card that is OUT belongs to the field, not the hand. It used
            // to render in both at once, so deploying looked like it had
            // duplicated the card rather than moved it.
            if (i === mine.active) return null;
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
                // Hovering says what the card WOULD do. The board showed a
                // stat line but never the thing you actually want before
                // committing: how hard this one hits, and whether the swing
                // finishes what is standing opposite.
                title={
                  dead
                    ? `${f.name} has fallen`
                    : `${f.name} — hits for ~${f.atk}${
                        foeActive ? ` · ${foeActive.name} has ${foeActive.hp} HP left` : ""
                      }${foeActive && f.atk >= foeActive.hp ? " · this would finish it" : ""}`
                }
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
                  {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={hand} showStats liveHp={f.hp} liveMaxHp={f.maxHp} />}
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
            {/* COLLAPSED BY DEFAULT. This rail rendered every support you own —
                thirteen cards on a full collection — when only three can ever
                be played in a duel. It was the single biggest block of noise on
                the board, and most of it was cards you could not use. It opens
                on demand and shuts again after a play. */}
            <button
              onClick={() => setShowSupports((v) => !v)}
              className="mb-1 flex w-full items-center gap-1.5 text-left"
            >
              <Sparkles className="h-3 w-3 text-cyan-300" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80">
                Support · {usedSupports.length}/{SUPPORTS_PER_DUEL} played
              </span>
              <span className="text-[10px] font-bold text-slate-600">
                {showSupports ? "— tap a card to see what it does" : `— ${playableSupports.length} available, tap to open`}
              </span>
              <span className="ml-auto text-[10px] font-black text-cyan-300/70">{showSupports ? "HIDE" : "SHOW"}</span>
            </button>
            <div className={`gap-2 overflow-x-auto pb-1 ${showSupports ? "flex" : "hidden"}`}>
              {playableSupports.map((c) => {
                const spent = usedSupports.includes(c.id);
                // Three per duel, matching the server. Once you've spent them
                // the rest grey out rather than failing on click.
                const outOfSlots = usedSupports.length >= SUPPORTS_PER_DUEL;
                const usable = live && !spent && !outOfSlots;
                const targeted = TARGETED.has((c.support as any)?.kind);
                return (
                  <div key={c.id}
                    onPointerDown={usable ? startDrag({ kind: "support", cardId: c.id, targeted }) : undefined}
                    // Tapping INSPECTS. It used to play the card instantly,
                    // which meant the only way to find out what a support did
                    // was to spend it — mid-duel, on your turn.
                    onClick={() => { if (swallowClick()) return; setPeek(c); }}
                    role="button" aria-disabled={!usable}
                    // Says what it DOES on hover, not just its name. The tray
                    // holds a dozen of these and reading them meant tapping
                    // each one in turn.
                    title={spent ? `${c.name} — already played`
                      : outOfSlots ? `No support slots left this duel`
                      : `${c.name} — ${supportBrief(c.support).what} (free to play, keeps your turn)`}
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

        {/* ── ABILITY BRIEF ── what the card in front of you actually does,
            readable BEFORE you spend it. The button on its own just said
            "Ability", which tells you nothing about a once-per-duel resource
            you only get to use with one card. */}
        {(() => {
          const self = mine.active >= 0 ? mine.fighters[mine.active] : undefined;
          const a = self ? abilities?.[self.cardId] : null;
          if (!a) return null;
          const ranks = a.levels?.length || 1;
          const rank = Math.max(1, Math.min(ranks, (self as any)?.skillLevel || 1));
          const now = a.levels?.[rank - 1];
          const spent = (mine.usedAbilities || []).includes(self!.cardId);
          return (
            <div
              className="mt-2 px-3 py-2"
              style={{
                clipPath: notch(10),
                background: a.isDomain ? "rgba(217,70,239,.10)" : "rgba(162,116,255,.08)",
                boxShadow: `inset 0 0 0 1px ${a.isDomain ? "rgba(240,171,252,.35)" : "rgba(162,116,255,.28)"}`,
              }}
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className="text-[9px] font-black uppercase tracking-[0.22em]"
                  style={{ color: a.isDomain ? "#f0abfc" : "#c4b5fd" }}
                >
                  {a.isDomain ? "Domain" : "Skill"} · Rank {rank}
                </span>
                <span className="text-[12px] font-black text-white">{a.name}</span>
                {spent && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Spent</span>
                )}
              </div>
              {now?.text && (
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400 sm:line-clamp-none sm:text-[11px]">
                  {now.text}
                </p>
              )}
            </div>
          );
        })()}

        {/* ── ACTIONS ── */}
        {!finished ? (
          <div className="mt-2 flex items-stretch justify-center gap-2">
            {/* Two different moves behind one button, decided by what you have
                selected. Picking a card that isn't already out SENDS IT IN;
                otherwise you swing with whoever is standing. */}
            {/* Ability — only shown when the card standing actually has one and
                has not spent it. A button that exists but never works reads as
                broken; one that is absent reads as "this card doesn't do that". */}
            {(() => {
              const self = mine.active >= 0 ? mine.fighters[mine.active] : undefined;
              const has = !!self && !!abilityIds?.has(self.cardId) && !!onAbility;
              const spent = !!self && (mine.usedAbilities || []).includes(self.cardId);
              if (!has) return null;
              return (
                <button
                  disabled={!live || spent}
                  onClick={() => { if (live && !spent) onAbility!(); }}
                  title={spent ? "Already used this duel" : "Use this card's ability"}
                  className="relative flex shrink-0 items-center justify-center gap-1.5 px-4 py-3.5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition disabled:opacity-30"
                  style={{
                    clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
                    background: "linear-gradient(100deg, #a21caf, #d946ef)",
                  }}>
                  <Sparkles className="h-4 w-4" />
                  {spent ? "Spent" : abilities?.[self!.cardId]?.name || "Ability"}
                </button>
              );
            })()}
            <button
              disabled={!live || (wantsDeploy ? sel === null : mine.active < 0 || foe.active < 0)}
              onClick={() => {
                if (!live) return;
                if (wantsDeploy && sel !== null) onDeploy(sel);
                else onAttack();
              }}
              className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden py-3.5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition disabled:opacity-30"
              style={{
                clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
                background: wantsDeploy
                  ? "linear-gradient(100deg, #7c3aed, #a855f7)"
                  : "linear-gradient(100deg, #b91c3c, #f97316)",
              }}>
              <Swords className="h-4 w-4" />
              {!myTurn ? "Not your turn"
                : busy ? "Resolving…"
                : wantsDeploy
                ? (sel === null ? "Choose a card to send in" : `Send in ${selected?.name ?? "card"}`)
                : foe.active < 0 ? `Waiting for ${foeName}'s card`
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
                  className="inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs font-black transition hover:brightness-125 disabled:opacity-25"
                  style={{
                    clipPath: "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)",
                    background: "rgba(255,255,255,.06)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)",
                  }}>
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

      {/* ── SUPPORT INSPECT ─────────────────────────────────────────────────
          What the card does, in words, BEFORE you spend it. Previously a tap
          played the card outright, so the only way to learn a support was to
          burn it mid-duel on your own turn — and you only get three. */}
      <AnimatePresence>
        {peek && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-[155] grid place-items-center bg-black/75 px-6 backdrop-blur-[2px]"
            onClick={() => setPeek(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm p-5 text-center"
              style={{
                clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))",
                background: "linear-gradient(165deg, #0d2230, #071019)",
                boxShadow: "inset 0 0 0 1px rgba(34,211,238,.45)",
              }}
            >
              {(() => {
                const spent = usedSupports.includes(peek.id);
                const outOfSlots = usedSupports.length >= SUPPORTS_PER_DUEL;
                const targeted = TARGETED.has((peek.support as any)?.kind);
                const brief = supportBrief(peek.support);
                const canPlay = live && !spent && !outOfSlots;
                return (
                  <>
                    <div className="mx-auto w-fit"><CardFace card={peek} owned size={132} /></div>
                    <h3 className="mt-3 text-xl font-black">{peek.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-cyan-100">{brief.what}</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{brief.how}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Free to play — keeps your turn · {usedSupports.length}/{SUPPORTS_PER_DUEL} used
                    </p>

                    <div className="mt-4 flex gap-2">
                      <button onClick={() => setPeek(null)}
                        className="flex-1 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:brightness-125"
                        style={{ clipPath: notch(9), background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}>
                        Close
                      </button>
                      {/* A targeted card has no button on purpose — it has to
                          be aimed, and offering "Play" would either pick a
                          card for you or fail. */}
                      {!targeted && (
                        <button
                          disabled={!canPlay}
                          onClick={() => { onSupport?.(peek.id); setPeek(null); setShowSupports(false); }}
                          className="flex-1 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#04232e] transition hover:brightness-110 disabled:opacity-35"
                          style={{ clipPath: notch(9), background: "linear-gradient(100deg, #a5f3fc, #22d3ee)" }}>
                          {spent ? "Already played" : outOfSlots ? "No slots left" : !live ? "Not your turn" : "Play it"}
                        </button>
                      )}
                    </div>
                    {targeted && (
                      <p className="mt-3 text-[11px] font-bold text-cyan-300/80">
                        Close this and drag it onto the card you want.
                      </p>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ── DOMAIN EXPANSION ── the tier's signature moment. Sits above the
          board but under the modals, and is deliberately louder than a KO:
          rings, a colour flood and the name of the thing that just rewrote
          the fight. Transform and opacity only, unmounted by a timer. */}
      <AnimatePresence>
        {domain && (
          <motion.div key={domain.key} aria-hidden
            className="pointer-events-none absolute inset-0 z-[110] grid place-items-center overflow-hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            <motion.div className="absolute inset-0"
              style={{ background: domain.mine
                ? "radial-gradient(60% 50% at 50% 50%, rgba(217,70,239,.42), rgba(6,2,12,.94) 70%)"
                : "radial-gradient(60% 50% at 50% 50%, rgba(244,63,94,.38), rgba(10,2,6,.94) 70%)" }}
              initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }} />
            {[0,1,2].map((i) => (
              <motion.span key={i} className="absolute rounded-full"
                style={{ width: 200, height: 200, border: `2px solid `, willChange: "transform, opacity" }}
                initial={{ scale: 0.15, opacity: .95 }} animate={{ scale: 6, opacity: 0 }}
                transition={{ duration: 1.5, delay: i * 0.16, ease: "easeOut" }} />
            ))}
            <div className="relative z-10 px-8 text-center">
              <motion.p className="text-[11px] font-black uppercase tracking-[0.5em]"
                style={{ color: domain.mine ? "#f0abfc" : "#fda4af" }}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
                Domain Expansion
              </motion.p>
              <motion.p className="mt-3 text-2xl font-black leading-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,.9)] sm:text-4xl"
                initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.25, ease: [0.22,1,0.36,1] }}>
                {domain.text}
              </motion.p>
            </div>
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
