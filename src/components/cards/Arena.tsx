"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Heart, Shield, Crosshair, Trophy, Sparkles, Flag, Maximize2 } from "lucide-react";
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
    // ── Knight supports ── STANDING, not spent on one blow. Worded to make
    // that the first thing you read: these are the only cards in the tray that
    // keep working after the turn you played them.
    case "guard":  return { what: `Every blow against you lands ${s.power} lighter, for the rest of the duel.`, how: "Play it — it holds for the whole fight, not just the next hit." };
    case "edge":   return { what: `Each of your cards carries +${s.power} damage on its FIRST strike.`, how: "Play it early — a card that has already swung has spent its first strike." };
    case "veil":   return { what: `${Math.round((s.power || 0) * 100)}% of attacks against you find nobody there.`, how: "Play it — the cloak stays up; it doesn't fall off because it worked." };
    // ── Ground ── a different class entirely, and the tray is where a player
    // finds that out. Named as a LAY rather than a play.
    case "bulwark": return { what: `Every living ${s.set} card you have gains +${s.power} max health.`, how: "Lay it — it holds the whole board, and costs you no support slot." };
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
  supports = [], usedSupports = [], usedGrounds = [],
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
  /** Support cards you OWN — never spent, but each is playable once per duel.
   *  GROUND cards ride this same list: both are played rather than fielded. */
  supports?: CardDef[];
  usedSupports?: string[];
  /** Grounds already laid this duel. Tracked SEPARATELY from usedSupports
   *  because the server does: a ground is once-per-duel like a support but
   *  does NOT count against the three-support limit. Sharing one list would
   *  either grey out a ground the server would happily accept, or let a
   *  laid ground eat a support slot. */
  usedGrounds?: string[];
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

  // Grounds belong here too — the tray is "cards you play rather than field",
  // and filtering to `c.support` was why a held ground had no way onto the board.
  const playableSupports = useMemo(
    () => supports.filter((c) => !!c.support || !!(c as any).ground),
    [supports]
  );
  /**
   * Has this card already been played, and is it blocked by the slot limit?
   *
   * One helper because the answer differs by CLASS and the question is asked in
   * three places — the drag guard, the tray tile, and the inspect panel. A
   * ground checks its own list and ignores the three-support limit entirely,
   * exactly as the server does; keeping that rule in one place is what stops
   * the three copies drifting apart.
   */
  const playState = useCallback((c: CardDef) => {
    const isGround = !!(c as any).ground;
    return {
      isGround,
      spent: (isGround ? usedGrounds : usedSupports).includes(c.id),
      outOfSlots: !isGround && usedSupports.length >= SUPPORTS_PER_DUEL,
    };
  }, [usedSupports, usedGrounds]);
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
  // THE LOG RAIL IS ABSOLUTE, SO IT TAKES NO SPACE IN THE FLOW — but it very
  // much covers the right edge of the screen. This line already subtracted it
  // when sizing cards; the rows below did not, so they centred on the full
  // viewport while the right 340px was occupied. The board ended up sitting
  // right of the centre of the space actually left for it, which reads as a
  // dead band down the left. Everything that centres now pads by the same
  // number the card maths uses, so the two agree.
  const railW = wide ? 340 : 0;
  // On a MONITOR the hand leaves the bottom of the screen entirely and stands
  // in a left column that mirrors the log. The vertical stack drops from
  // 1 + 0.46 + 0.58 card-heights to 1 + 0.46, and every pixel the hand gives
  // back goes to the champions — the difference between ~210px champions in a
  // sea of margin and cards at the size the rest of the app shows them. Both
  // rails are 340, so the clash sits back at TRUE screen centre. 1280 is the
  // cutoff because two rails under that leave the centre too narrow for a
  // five-card bench. Phones and small laptops keep the stacked layout,
  // untouched.
  const sideHand = box.w >= 1280;
  const leftW = sideHand ? 340 : 0;
  const usableW = box.w - railW - leftW;
  const perCard = (usableW - (wide ? 0 : 24)) / lineup;
  // 1.4 * (1 + 0.46 [+ 0.58 only while the hand is in the stack]).
  const stack = sideHand ? 2.044 : 2.856;
  // The width fraction rises with the side rails: the centre is narrower, but
  // it holds exactly two cards and a VS, and 0.30 of it would size champions
  // SMALLER at 1280 than the layout it replaces.
  const champ = clamp(92, Math.min(forCards / stack, usableW * (sideHand ? 0.36 : 0.30)), sideHand ? 340 : 300);
  // In the side rail the hand is a two-column grid, so its size answers to
  // the rail's width and its row count, not to the champion.
  const inHand = mine.fighters.filter((_, i) => i !== mine.active).length;
  const handRows = Math.max(1, Math.ceil(inHand / 2));
  const hand = sideHand
    ? clamp(72, Math.min(136, ((box.h - 150) / handRows - 38) / 1.4), 148)
    : clamp(56, Math.min(champ * 0.58, perCard - 10), 150);
  // Floors matter: below ~48px a card is unreadable mush rather than a small
  // card, and the opponent's line is how you read the game.
  const bench = clamp(56, Math.min(champ * 0.46, perCard - 14), sideHand ? 156 : 118);
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
  // The domain doesn't just FLASH — it lingers. After the overlay clears, the
  // whole arena stays tinted in the caster's colour for a while: you are
  // fighting INSIDE their domain, and the room should say so.
  const [aura, setAura] = useState<{ mine: boolean; key: number } | null>(null);
  const lastLogRef = useRef<string | null>(null);
  useEffect(() => {
    const line = log.length ? log[log.length - 1] : null;
    if (!line || line === lastLogRef.current) return;
    lastLogRef.current = line;
    // "▲" literally — an earlier regex pass ate the \u escape and left this
    // comparing against the text "25B2", which no log line ever starts with,
    // so the overlay never fired even while the log showed domains landing.
    if (!line.startsWith("▲")) return;
    const mine = line.includes(myName);
    setDomain({ text: line.replace(/^▲\s*/, ""), mine, key: Date.now() });
    setAura({ mine, key: Date.now() });
  }, [log, myName]);
  // Cleared on a timer, never onAnimationComplete — that fires on the wrapper's
  // own animation, not the keyframes inside it.
  useEffect(() => {
    if (!domain) return;
    const t = setTimeout(() => setDomain(null), 3000);
    return () => clearTimeout(t);
  }, [domain?.key]);
  useEffect(() => {
    if (!aura) return;
    const t = setTimeout(() => setAura(null), 9000);
    return () => clearTimeout(t);
  }, [aura?.key]);
  const aliveFoe = foe.fighters.filter((f) => f.hp > 0).length;
  const aliveMine = mine.fighters.filter((f) => f.hp > 0).length;
  // Army totals for the war bar — the fight's whole state in one glance.
  const foeHp = foe.fighters.reduce((a, f) => a + Math.max(0, f.hp), 0);
  const foeMax = Math.max(1, foe.fighters.reduce((a, f) => a + f.maxHp, 0));
  const myHp = mine.fighters.reduce((a, f) => a + Math.max(0, f.hp), 0);
  const myMax = Math.max(1, mine.fighters.reduce((a, f) => a + f.maxHp, 0));
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
  // REACT IS NOT IN THE LOOP WHILE THE POINTER MOVES. The old shape kept the
  // pointer's x/y in state, which re-rendered the entire board — champions,
  // bench, hand, log — once per moved pixel. That is why dragging felt like
  // pulling a card through syrup. State now changes exactly three times per
  // gesture (start, target change, end); between those the ghost is steered
  // straight through a ref, and the hit-test runs once per FRAME rather than
  // once per pointer event.
  const [drag, setDrag] = useState<{ d: Drag; over: string | null } | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

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
    // Routed through playState so a ground dragged onto the board isn't
    // refused for having no support slots left; it never needed one.
    const dragDef = playableSupports.find((c) => c.id === d.cardId);
    if (dragDef) {
      const ps = playState(dragDef);
      if (ps.spent || ps.outOfSlots) return;
    }
    if (target.startsWith("ally-")) {
      const idx = Number(target.slice(5));
      onSupport(d.cardId, Number.isInteger(idx) ? idx : undefined);
    } else if (target === "field") {
      onSupport(d.cardId, mine.active >= 0 ? mine.active : undefined);
    }
  };

  useEffect(() => {
    // THE GHOST HAS WEIGHT NOW. It doesn't hard-lock to the cursor — it eases
    // toward it every frame and tilts into the direction of travel, which is
    // the whole difference between dragging a screenshot and dragging a card.
    // The loop runs continuously while a drag is live (compositor-only work),
    // and the hit-test always reads the POINTER, never the trailing ghost.
    const eased = { x: 0, y: 0 };
    let easedLive = false;
    const frame = () => {
      rafRef.current = 0;
      if (!dragRef.current) return;
      const { x, y } = posRef.current;
      const g = ghostRef.current;
      if (g) {
        if (g.style.transition) { g.style.transition = ""; g.style.opacity = ""; } // a snap-back was interrupted
        if (!easedLive) { eased.x = x; eased.y = y; easedLive = true; }
        eased.x += (x - eased.x) * 0.34;
        eased.y += (y - eased.y) * 0.34;
        const tilt = Math.max(-10, Math.min(10, (x - eased.x) * 0.22));
        g.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0) rotate(${tilt}deg)`;
      }
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const zone = el?.closest("[data-drop]") as HTMLElement | null;
      const next = zone?.getAttribute("data-drop") || null;
      if (next !== overRef.current) {
        overRef.current = next;
        setDrag((s) => (s ? { ...s, over: next } : s));
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    const move = (e: PointerEvent) => {
      const p = pendRef.current;
      if (!p) return;
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!dragRef.current) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return; // a tap stays a tap
        dragRef.current = p.d;
        easedLive = false;
        setDrag({ d: p.d, over: null });
      }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(frame);
    };
    const end = () => {
      // A click still fires after pointerup when the pointer moved, so without
      // this a completed drag would ALSO run the card's onClick — attacking and
      // then silently changing the selection underneath you.
      didDragRef.current = !!dragRef.current;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      if (dragRef.current) {
        // A fast flick can release before the frame that would have hit-tested
        // its last position — resolve against where the pointer actually IS,
        // not where the last frame saw it.
        const el = document.elementFromPoint(posRef.current.x, posRef.current.y) as HTMLElement | null;
        const zone = el?.closest("[data-drop]") as HTMLElement | null;
        const target = zone?.getAttribute("data-drop") || overRef.current;
        const grabbed = pendRef.current;
        if (target) {
          resolveRef.current(dragRef.current, target);
          pendRef.current = null; dragRef.current = null; overRef.current = null;
          setDrag(null);
        } else {
          // RELEASED OVER NOTHING — the card flies home before it vanishes,
          // instead of blinking out wherever it was dropped. It returns to
          // the point it was GRABBED at, which is where the hand card sits.
          const g = ghostRef.current;
          pendRef.current = null; dragRef.current = null; overRef.current = null;
          if (g && grabbed) {
            g.style.transition = "transform .3s cubic-bezier(.3,1.35,.45,1), opacity .3s ease";
            g.style.transform = `translate3d(${grabbed.x}px, ${grabbed.y}px, 0) rotate(0deg)`;
            g.style.opacity = "0.35";
            window.setTimeout(() => setDrag((s) => (dragRef.current ? s : null)), 300);
          } else {
            setDrag(null);
          }
        }
      } else {
        pendRef.current = null;
        setDrag(null);
      }
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
    // The ghost's very first paint reads this — without it the card would
    // flash at the top-left corner for one frame before the pointer caught it.
    posRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const swallowClick = () => {
    if (!didDragRef.current) return false;
    didDragRef.current = false;
    return true;
  };

  const dragging = drag?.d ?? null;
  const over = drag?.over ?? null;
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
  // On a wide screen the panel exists from the first frame, empty or not. It
  // holds open the column the board is padding for, so round one doesn't show
  // a reserved band with nothing in it — and nothing resizes when the first
  // line lands. Narrow keeps the old behaviour: no log, no panel, because the
  // height budget above only pays for it once there is something to read.
  const logPanel = (wide || log.length > 0) && (() => {
    const newest = log.length > 0 ? log[log.length - 1] : null;
    const older = log.length > 0 ? [...log].slice(0, -1).reverse() : [];
    // Domain lines are marked with a leading triangle by the engine.
    const isBig = !!newest && newest.startsWith("▲");
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-white/10 bg-black/70 ${wide ? "flex h-full flex-col" : "max-w-lg"}`}>
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
          key={newest ?? "idle"}
          className={`shrink-0 px-3 py-2 text-[12px] font-black leading-snug ${
            !newest ? "text-slate-600" : isBig ? "text-fuchsia-200" : "text-white"
          }`}
          style={{ background: isBig ? "rgba(217,70,239,.12)" : "rgba(255,255,255,.04)" }}
        >
          {newest ?? "No moves yet — send a card out to open the round."}
        </div>

        {(wide || older.length > 0) && (
          // Wide: flex-1 so the history fills the column down to the bottom of
          // the screen instead of stopping at 30vh with reserved space under
          // it. min-h-0 is what actually lets it scroll inside a flex parent.
          <div className={`overflow-y-auto px-3 py-1.5 text-[11px] leading-relaxed text-slate-500 ${wide ? "min-h-0 flex-1" : "max-h-12"}`}>
            {older.slice(0, wide ? 40 : 6).map((l, i) => (
              <div key={`${i}-${l}`}>{l}</div>
            ))}
          </div>
        )}
      </div>
    );
  })();

  /**
   * The hand, one node per card — HOMELESS ON PURPOSE. On a phone it renders
   * as the bottom row it has always been; on a monitor it renders inside the
   * left rail. Same nodes, same data-drop targets, same drag handlers — only
   * the container differs, so the two layouts cannot drift apart.
   */
  const handCards = mine.fighters.map((f, i) => {
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
          {byId[f.cardId] && <CardFace card={byId[f.cardId]} owned foil={f.foil} size={hand} showStats liveHp={f.hp} liveMaxHp={f.maxHp} liveAtk={f.atk} />}
          {dead && (
            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-12 border-y border-rose-500/70 bg-rose-950/80 py-0.5 text-center text-[8px] font-black uppercase tracking-[0.2em] text-rose-200">
              Fallen
            </span>
          )}
        </div>
        <div style={{ width: hand }}><Bar f={f} h={5} showNumbers /></div>
      </motion.div>
    );
  });

  return (
    <motion.div
      ref={shellRef}
      initial={{ opacity: 0 }}
      // A DOMAIN SHAKES THE ROOM. One transform on the root moves the entire
      // board — log, rails, cards, everything — which is cheaper than
      // animating anything inside it and reads as impact across the whole
      // window at once. Keyframes end at 0, so nothing needs putting back.
      animate={domain
        ? { opacity: 1, x: [0, -9, 7, -5, 3, -1, 0], y: [0, 5, -4, 3, -2, 0], scale: [1, 1.015, 1] }
        : { opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        x: { duration: 0.6, ease: "easeOut" },
        y: { duration: 0.6, ease: "easeOut" },
        scale: { duration: 0.7, ease: "easeOut" },
      }}
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
          {/* TRUE fullscreen, not just a full-viewport div. The board is
              already fixed inset-0, but browser chrome and the OS taskbar
              still eat 100-150px of height — and this screen sizes its cards
              off exactly that budget, so reclaiming it makes every card
              bigger rather than just hiding the address bar. */}
          <button
            onClick={() => {
              const el: any = document.documentElement;
              if (document.fullscreenElement) document.exitFullscreen?.();
              else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
            }}
            aria-label="Toggle fullscreen"
            title="Fullscreen"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-slate-400 transition hover:border-purple-400/50 hover:text-purple-200"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} aria-label="Leave the arena"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── WAR BAR ── both armies' remaining health facing each other,
          fighting-game style: the foe drains from the centre leftward, you
          drain from the centre rightward, the round sits at the join. */}
      <div className="relative z-20 shrink-0 px-3 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-l-full bg-black/50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(56,132,255,.25)" }}>
            <div className="ml-auto h-full transition-[width] duration-500 ease-out"
              style={{ width: `${(foeHp / foeMax) * 100}%`, background: "linear-gradient(270deg, #38bdf8, #0284c7)" }} />
          </div>
          <span className="shrink-0 font-mono text-[9px] font-black tracking-widest text-slate-500">R{round}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-r-full bg-black/50"
            style={{ boxShadow: "inset 0 0 0 1px rgba(244,63,94,.25)" }}>
            <div className="h-full transition-[width] duration-500 ease-out"
              style={{ width: `${(myHp / myMax) * 100}%`, background: "linear-gradient(90deg, #f43f5e, #fb7185)" }} />
          </div>
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-[9px] font-bold">
          <span className="text-sky-300/80">{foeHp.toLocaleString()} / {foeMax.toLocaleString()}</span>
          <span className="text-rose-300/80">{myHp.toLocaleString()} / {myMax.toLocaleString()}</span>
        </div>
      </div>

      {/* On a wide screen the log lives in the dead margin beside the board. */}
      {wide && logPanel && (
        // A real column, floor to ceiling. It used to be a short box pinned to
        // the top with the rest of the strip empty, which is why the space the
        // board gives up for it didn't look like it was paying for anything.
        // The heading is gone because the panel already has one — it said
        // "Battle log" twice, stacked.
        <div className="absolute bottom-3 right-3 top-16 z-30 w-[300px]">{logPanel}</div>
      )}

      {/* On a monitor YOUR HAND is the left column — the mirror of the log.
          Same nodes, same drop targets; see the note on handCards.
          z-30, NOT z-10: the bench, clash and bottom panel come later in the
          DOM and span the full viewport width, so at equal z they paint over
          the rails and swallow every pointer event — which made the hand
          untouchable: taps dead, drags never starting. The rails must sit
          above the rows they overlap (and below the modals at 110+). */}
      {sideHand && (
        <div className="absolute bottom-3 left-3 top-16 z-30 flex w-[300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/70">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-black text-rose-100">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500/25 text-[10px] ring-1 ring-rose-400/40">{myName[0]?.toUpperCase()}</span>
              <span className="truncate">{myName}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">
              {aliveMine} of {mine.fighters.length} standing
            </span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start justify-items-center gap-2 overflow-y-auto p-2.5">
            {handCards}
          </div>
        </div>
      )}

      {/* ── opponent's bench ── */}
      <div className="relative z-10 flex shrink-0 items-start justify-center gap-1.5 px-3"
        style={{ paddingRight: railW || undefined, paddingLeft: leftW || undefined }}>
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
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-3"
        style={{ paddingRight: railW || undefined, paddingLeft: leftW || undefined }}>
        {/* The divide runs BETWEEN the champions, not across them — a horizontal
            rule in a side-by-side clash cut through both cards and read as
            damage. The pools give left sky and right rose so the zone states
            who is who even mid-animation. */}
        {/* These sit in their own box that stops where the log rail starts.
            Percentage offsets on an absolute child resolve against the PADDING
            box, so left-1/2 would have put the divide at half the full width
            while the cards centre in the width minus the rail — the line would
            have run 170px right of the VS it is supposed to run through. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ right: railW, left: leftW }}>
          <div className="absolute inset-y-2 left-1/2 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="absolute inset-y-4 left-0 w-1/2 rounded-r-full bg-[radial-gradient(circle_at_40%_50%,rgba(56,189,248,.10),transparent_70%)]" />
          <div className="absolute inset-y-4 right-0 w-1/2 rounded-l-full bg-[radial-gradient(circle_at_60%_50%,rgba(244,63,94,.10),transparent_70%)]" />
        </div>

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
                <CardFace card={byId[foeActive.cardId]} owned foil={foeActive.foil} size={champ} showStats liveHp={foeActive.hp} liveMaxHp={foeActive.maxHp} liveAtk={foeActive.atk} />
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
                <CardFace card={byId[myActive.cardId]} owned foil={myActive.foil} size={champ} showStats liveHp={myActive.hp} liveMaxHp={myActive.maxHp} liveAtk={myActive.atk} />
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
        <motion.div
          animate={!finished && !busy && myTurn ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={!finished && !busy && myTurn ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          className={`relative z-10 shrink-0 px-6 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition ${
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
        </motion.div>

        {!wide && logPanel}
      </div>

      {/* ── YOUR SIDE ── */}
      <div className="relative z-10 shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
        style={{
          background: "linear-gradient(180deg, rgba(20,10,30,.82), rgba(8,5,14,.94))",
          boxShadow: "inset 0 1px 0 rgba(162,116,255,.35), 0 -18px 40px rgba(0,0,0,.55)",
          // The panel itself still spans the full width — it is the floor of
          // the board. Only its CONTENTS step aside for the side columns, so
          // what's left in it centres under the champions, not the viewport.
          paddingRight: railW || undefined,
          paddingLeft: leftW || undefined,
        }}>
        {/* On a monitor the name row lives in the hand rail's header instead
            — repeating it here said "You" twice on the same screen. */}
        {!sideHand && (
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-sm font-black text-rose-100">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500/25 text-[10px] ring-1 ring-rose-400/40">{myName[0]?.toUpperCase()}</span>
              {myName}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">
              {aliveMine} of {mine.fighters.length} standing
            </span>
          </div>
        )}

        {/* the hand — lives here on phones; on a monitor it's the left rail */}
        {!sideHand && <div className="flex items-end justify-center gap-1.5">{handCards}</div>}

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
                // Three supports per duel, matching the server — once spent,
                // the rest grey out rather than failing on click. A GROUND is
                // once-per-duel but slot-free, which is why this comes from
                // playState rather than reading usedSupports directly.
                const { spent, outOfSlots } = playState(c);
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
                const { spent, outOfSlots, isGround } = playState(peek);
                const targeted = TARGETED.has((peek.support as any)?.kind);
                // Grounds have no `support` object — read their effect from
                // `ground` instead, or the panel falls through to the generic
                // "does something helpful" and tells the player nothing.
                const brief = supportBrief(peek.support || (peek as any).ground);
                const canPlay = live && !spent && !outOfSlots;
                return (
                  <>
                    <div className="mx-auto w-fit"><CardFace card={peek} owned size={132} /></div>
                    <h3 className="mt-3 text-xl font-black">{peek.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-cyan-100">{brief.what}</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{brief.how}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {isGround
                        ? "Free to lay — keeps your turn · costs no support slot"
                        : `Free to play — keeps your turn · ${usedSupports.length}/${SUPPORTS_PER_DUEL} used`}
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

      {/* ── THE DOMAIN HOLDS ── after the expansion clears, the arena stays
          claimed: an edge vignette in the caster's colour over the ENTIRE
          window — board, rails, log, everything — with a slow ring turning
          behind the fight. It fades out on its own; nothing here takes
          pointer events or touches layout. */}
      <AnimatePresence>
        {aura && (
          <motion.div key={aura.key} aria-hidden
            className="pointer-events-none absolute inset-0 z-[60] overflow-hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.2 } }}
            transition={{ duration: 0.6 }}>
            <div className="absolute inset-0"
              style={{
                background: aura.mine
                  ? "radial-gradient(80% 70% at 50% 50%, transparent 55%, rgba(217,70,239,.16) 82%, rgba(217,70,239,.34))"
                  : "radial-gradient(80% 70% at 50% 50%, transparent 55%, rgba(244,63,94,.15) 82%, rgba(244,63,94,.32))",
              }} />
            <motion.div className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: "130vmax", height: "130vmax", marginLeft: "-65vmax", marginTop: "-65vmax",
                background: `conic-gradient(from 0deg, transparent 0 12%, ${aura.mine ? "rgba(217,70,239,.05)" : "rgba(244,63,94,.05)"} 16% 22%, transparent 26% 62%, ${aura.mine ? "rgba(217,70,239,.05)" : "rgba(244,63,94,.05)"} 66% 72%, transparent 76%)`,
                willChange: "transform",
              }}
              initial={{ rotate: 0 }} animate={{ rotate: 360 }}
              transition={{ duration: 26, ease: "linear", repeat: Infinity }} />
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

            {/* cinema bars — the fight stops being a UI for two and a half seconds */}
            <motion.div className="absolute inset-x-0 top-0 h-[9vh] bg-black"
              initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
            <motion.div className="absolute inset-x-0 bottom-0 h-[9vh] bg-black"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />

            {/* the shockline — one horizontal crack across the full window */}
            <motion.div className="absolute inset-x-0 top-1/2 h-[2px]"
              style={{ background: `linear-gradient(90deg, transparent, ${domain.mine ? "rgba(240,171,252,.9)" : "rgba(253,164,175,.9)"}, transparent)` }}
              initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1, opacity: [1, 0.9, 0] }}
              transition={{ duration: 0.8, ease: "easeOut" }} />

            {/* RINGS SIZED TO SWALLOW THE WINDOW. The old rings peaked at
                1200px — a phone-sized blast on a desktop — and their border
                colour had been eaten by the same escape-mangling pass that
                broke the trigger, so they were invisible anyway. The end
                scale is computed from the measured box, so the last ring
                always leaves through the corners of the screen. */}
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute rounded-full"
                style={{
                  width: 220, height: 220,
                  border: `3px solid ${domain.mine ? "rgba(240,171,252,.85)" : "rgba(253,164,175,.85)"}`,
                  willChange: "transform, opacity",
                }}
                initial={{ scale: 0.12, opacity: 0.95 }}
                animate={{ scale: (Math.max(box.w, box.h) * 1.6) / 220, opacity: 0 }}
                transition={{ duration: 1.5, delay: i * 0.16, ease: "easeOut" }} />
            ))}

            {/* motes rising through the whole window — deterministic per index,
                transform and opacity only */}
            {Array.from({ length: 14 }, (_, i) => (
              <motion.span key={`m${i}`} className="absolute bottom-0 rounded-full"
                style={{
                  left: `${(i * 61) % 100}%`,
                  width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
                  background: domain.mine ? "rgba(240,171,252,.8)" : "rgba(253,164,175,.8)",
                  willChange: "transform, opacity",
                }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: -(box.h + 60), opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.7 + (i % 5) * 0.18, delay: 0.15 + (i % 7) * 0.1, ease: "easeOut" }} />
            ))}

            <div className="relative z-10 px-8 text-center">
              <motion.p className="text-[11px] font-black uppercase tracking-[0.5em]"
                style={{ color: domain.mine ? "#f0abfc" : "#fda4af" }}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
                Domain Expansion
              </motion.p>
              <motion.p className="mt-3 text-3xl font-black leading-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,.9)] sm:text-5xl"
                initial={{ opacity: 0, scale: 1.18 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.25, ease: [0.22,1,0.36,1] }}>
                {domain.text}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DRAG GHOST ── pointer-events:none is REQUIRED, or elementFromPoint
          would only ever hit the ghost itself. */}
      {drag && ghostCard && (
        // Two layers: the OUTER one is steered by the frame loop with a bare
        // translate3d — compositor work only — and the inner one carries the
        // static centring, tilt and shadow so they never have to be recomputed.
        <div ref={ghostRef} className="pointer-events-none fixed left-0 top-0 z-[200] will-change-transform"
          style={{ transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)` }}>
          <div className="-translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_10px_30px_rgba(0,0,0,.8)]"
            style={{ rotate: "-4deg", scale: "1.06" }}>
            <CardFace card={ghostCard} owned size={hand} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
