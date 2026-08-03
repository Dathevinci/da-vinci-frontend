"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Shuffle, Swords } from "lucide-react";
import CardFace, { CardDef, RARITY_META, FALLBACK_STATS, GOD_STATS_MIRROR } from "./CardFace";

/**
 * DECK BUILDER — pick your five, keep them.
 *
 * The old flow made you re-choose a deck every single challenge, from a
 * scrolling grid with no indication of what anything did. This shows the three
 * chosen cards as a proper loadout with a combined power readout, and
 * remembers the choice in localStorage so "my deck" is a thing you own rather
 * than a decision you repeat.
 */

const DECK_KEY = "davinci_deck";
export const DECK_SIZE = 5;

export function loadSavedDeck(): string[] {
  try {
    const raw = localStorage.getItem(DECK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, DECK_SIZE) : [];
  } catch {
    return [];
  }
}
export function saveDeck(deck: string[]) {
  try {
    localStorage.setItem(DECK_KEY, JSON.stringify(deck.slice(0, DECK_SIZE)));
  } catch { /* storage unavailable */ }
}

export default function DeckBuilder({
  myCards,
  foils = {},
  stats,
  deck,
  onChange,
  compact = false,
  asleep = {},
  levels = {},
  forges = {},
  skillLvls = {},
  skillCaps = {},
}: {
  myCards: CardDef[];
  foils?: Record<string, boolean>;
  /** cardId -> true when the card fell in a lost duel. It cannot be fielded
   *  until it is woken, and the server refuses the deck outright — so it has
   *  to be visibly unpickable HERE rather than rejected after you commit. */
  asleep?: Record<string, boolean>;
  stats?: Record<string, { hp: number; atk: number }>;
  /** Bought power — levels and forge ranks — so every card here shows the
   *  numbers it will actually fight with, not its untrained base. */
  levels?: Record<string, number>;
  forges?: Record<string, { atk: number; hp: number }>;
  /** Skill ranks + each card's cap, for CardFace's MAX sign. */
  skillLvls?: Record<string, number>;
  skillCaps?: Record<string, number>;
  deck: string[];
  onChange: (deck: string[]) => void;
  compact?: boolean;
}) {
  // Three fixed 138px tiles are ~440px of grid inside a ~356px modal on a
  // phone — the same horizontal-overflow disease the binder had. Under 640px
  // the tiles shrink to actually fit the three columns they're laid in.
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const tile = small ? (compact ? 84 : 100) : (compact ? 108 : 138);

  // Support cards can't be FIELDED — the server refuses to build a fighter
  // from one, so letting you pick it here would silently send you into a duel
  // with two cards instead of three.
  const units = myCards.filter((c) => !c.support);
  const supports = myCards.filter((c) => !!c.support);
  const byId = Object.fromEntries(units.map((c) => [c.id, c]));
  const S = stats || FALLBACK_STATS;

  // A deck saved to localStorage can name cards you no longer own — or, now that
  // support cards aren't fieldable, cards that can never be deployed at all.
  // Left alone the slot renders blank while `deck` still holds three entries, so
  // the challenge button lights up and the server rejects the deck with no
  // explanation. Guarded on the collection having actually loaded, otherwise the
  // first render (empty catalog) would wipe a perfectly good saved deck.
  useEffect(() => {
    if (units.length === 0) return;
    const clean = deck.filter((id) => !!byId[id]);
    if (clean.length !== deck.length) onChange(clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.join(","), units.length]);

  const toggle = (id: string) => {
    const next = deck.includes(id)
      ? deck.filter((x) => x !== id)
      : deck.length < DECK_SIZE
      ? [...deck, id]
      : deck;
    onChange(next);
  };

  // Total power tells you at a glance whether this loadout is any good —
  // levels and forge included, so trained cards actually count for more.
  const trueStats = (id: string) => {
    const c = byId[id];
    if (!c) return { atk: 0, hp: 0 };
    const base = c.set === "Pantheon" ? GOD_STATS_MIRROR : S[c.rarity] || S.common;
    const m = foils[id] ? 1.2 : 1;
    const lvlM = 1 + (Math.min(10, Math.max(1, levels[id] || 1)) - 1) * 0.07;
    const fg = forges[id] || { atk: 0, hp: 0 };
    return {
      atk: Math.round(base.atk * m * lvlM) + fg.atk,
      hp: Math.round(base.hp * m * lvlM) + fg.hp * 2,
    };
  };
  const power = deck.reduce((sum, id) => {
    const t = trueStats(id);
    return sum + t.atk + t.hp;
  }, 0);

  const autoPick = () => {
    // Best five you own: RARITY first — a Mythic you fought the machine for
    // outranks any legendary in a "best" picker, trained or not — then true
    // stats break ties within a tier.
    const ranked = [...units].sort((a, b) => {
      const ra = RARITY_META[a.rarity]?.order ?? 0;
      const rb = RARITY_META[b.rarity]?.order ?? 0;
      if (rb !== ra) return rb - ra;
      const ta = trueStats(a.id), tb = trueStats(b.id);
      return (tb.atk + tb.hp) - (ta.atk + ta.hp);
    });
    onChange(ranked.slice(0, DECK_SIZE).map((c) => c.id));
  };

  return (
    <div>
      {/* the loadout — one slot per deck card, always visible */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">
          Your deck · {deck.length}/{DECK_SIZE}
        </span>
        <div className="flex items-center gap-2">
          {deck.length > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-black text-amber-300">
              {power} power
            </span>
          )}
          <button onClick={autoPick} title="Fill with your strongest cards"
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-black text-slate-300 transition hover:bg-white/10">
            <Shuffle className="h-3 w-3" /> Best
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 sm:gap-3">
        {Array.from({ length: DECK_SIZE }, (_, i) => {
          const id = deck[i];
          const card = id ? byId[id] : null;
          const slot = compact ? 84 : 116;
          return (
            <div key={i} className="flex flex-col items-center">
              {card ? (
                <motion.button initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  onClick={() => toggle(card.id)} title="Remove from deck">
                  <CardFace card={card} owned foil={foils[card.id]} size={slot} ratio="5 / 9" showStats stats={S} level={levels[card.id]} forge={forges[card.id]} skillLevel={skillLvls[card.id]} skillCap={skillCaps[card.id]} />
                </motion.button>
              ) : (
                <div className="grid place-items-center rounded-xl border-2 border-dashed border-white/15"
                  style={{ width: slot, aspectRatio: "5 / 9" }}>
                  <Swords className="h-6 w-6 text-slate-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* the collection to pick from */}
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Your collection</p>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        {units.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No cards yet — open a pack first.</p>
        ) : (
          // Cards scale with the viewport instead of a fixed thumbnail size, so
          // a laptop actually shows the art rather than 72px stamps.
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {units.map((c) => {
              const picked = deck.includes(c.id);
              // A sleeping card is refused by the server, so it is refused
              // here. Letting you pick one only to have the whole challenge
              // bounce with "X is hibernating" is the same answer, delivered
              // after you have committed to it.
              const out = !!asleep[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => { if (!out) toggle(c.id); }}
                  disabled={out}
                  title={out ? `${c.name} is asleep — wake it with shards, or pull another copy` : c.name}
                  className={`relative flex justify-center rounded-lg p-1 transition ${
                    out
                      ? "cursor-not-allowed"
                      : `hover:-translate-y-0.5 ${picked ? "bg-rose-500/25 ring-2 ring-rose-400" : "hover:bg-white/5"}`
                  }`}
                >
                  {/* CardFace wears the crime-scene tape itself now — one
                      treatment for fallen cards everywhere. */}
                  <CardFace card={c} owned foil={foils[c.id]} size={tile} ratio="5 / 9" showStats stats={S} hibernating={out} level={levels[c.id]} forge={forges[c.id]} skillLevel={skillLvls[c.id]} skillCap={skillCaps[c.id]} />
                  {picked && !out && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* support cards — owned, not decked. They ride along automatically. */}
      {supports.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-cyan-400/70">
            Support · carried into every duel
          </p>
          <div className="flex gap-2.5 overflow-x-auto rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
            {supports.map((c) => (
              <div key={c.id} className="shrink-0">
                <CardFace card={c} owned foil={foils[c.id]} size={compact ? 96 : 118} ratio="5 / 9" />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            You don&apos;t pick these into your deck — each one can be played once per duel from the arena.
          </p>
        </div>
      )}

      {/* legend — what the numbers mean */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-[8px] font-black text-white">A</span>
          Attack — damage per strike
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-[8px] font-black text-white">H</span>
          Health — damage it survives
        </span>
        <span>Rarer cards hit harder · foils get +20%</span>
      </div>
    </div>
  );
}
