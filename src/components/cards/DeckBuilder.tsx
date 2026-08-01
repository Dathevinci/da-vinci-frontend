"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Shuffle, Swords } from "lucide-react";
import CardFace, { CardDef, RARITY_META, FALLBACK_STATS } from "./CardFace";

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
}: {
  myCards: CardDef[];
  foils?: Record<string, boolean>;
  stats?: Record<string, { hp: number; atk: number }>;
  deck: string[];
  onChange: (deck: string[]) => void;
  compact?: boolean;
}) {
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

  // Total power tells you at a glance whether this loadout is any good.
  const power = deck.reduce((sum, id) => {
    const c = byId[id];
    if (!c) return sum;
    const base = S[c.rarity] || S.common;
    const m = foils[id] ? 1.2 : 1;
    return sum + Math.round(base.atk * m) + Math.round(base.hp * m);
  }, 0);

  const autoPick = () => {
    // Strongest five you own — a sane default so a new player isn't stuck
    // staring at a grid wondering what's good.
    const ranked = [...units].sort((a, b) => {
      const pa = (S[a.rarity] || S.common).atk + (S[a.rarity] || S.common).hp + (foils[a.id] ? 5 : 0);
      const pb = (S[b.rarity] || S.common).atk + (S[b.rarity] || S.common).hp + (foils[b.id] ? 5 : 0);
      return pb - pa;
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
                  <CardFace card={card} owned foil={foils[card.id]} size={slot} showStats stats={S} />
                </motion.button>
              ) : (
                <div className="grid place-items-center rounded-xl border-2 border-dashed border-white/15"
                  style={{ width: slot, aspectRatio: "5 / 7" }}>
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
              return (
                <button key={c.id} onClick={() => toggle(c.id)}
                  className={`relative flex justify-center rounded-lg p-1 transition hover:-translate-y-0.5 ${picked ? "bg-rose-500/25 ring-2 ring-rose-400" : "hover:bg-white/5"}`}>
                  <CardFace card={c} owned foil={foils[c.id]} size={compact ? 92 : 118} showStats stats={S} />
                  {picked && (
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
                <CardFace card={c} owned foil={foils[c.id]} size={compact ? 84 : 100} />
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
