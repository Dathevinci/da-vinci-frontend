"use client";
import { memo, type CSSProperties } from "react";
import { cardArt } from "@/data/cardArt";
import { CARD_BLUR } from "@/data/cardBlur";

/**
 * ARISE CARD ART — every card drawn procedurally, no image assets.
 *
 * Each card carries a `motif` that selects a genuinely different SCENE (an eye,
 * a mountain, a gate, a drowning sea…), and a `hue` that recolours it. That
 * combination is what stops 39 cards looking like 39 recolours of one shape.
 *
 * Layers, back to front: sky gradient → depth haze → the motif → foreground
 * grain/particles → inner border → foil sheen (if foil) → frame + plate.
 */

export type CardRarity = "common" | "rare" | "epic" | "legendary" | "event" | "mythic";
export type CardMotif =
  | "eye" | "wheel" | "tendril" | "peak" | "lotus" | "storm" | "gate"
  | "ember" | "moth" | "ripple" | "seed" | "scroll" | "path" | "seal"
  | "heart" | "sea" | "dawn" | "web"
  | "leviathan" | "trench" | "blade" | "mask" | "bell" | "comet";

export type SupportEffect =
  | { kind: "heal"; power: number }
  | { kind: "shield" }
  | { kind: "block" }
  | { kind: "focus"; power: number }
  | { kind: "mend"; power: number }
  | { kind: "revive"; power: number }
  // ── the Covenant — legendary supports, percent-scaled ──
  | { kind: "reflect"; power: number }
  | { kind: "bless"; power: number }
  | { kind: "pact"; power: number }
  | { kind: "stone"; power: number }
  | { kind: "mirror"; power: number }
  | { kind: "arise"; power: number };

export interface CardDef {
  id: string;
  name: string;
  rarity: CardRarity;
  set: string;
  hue: number;
  motif: CardMotif;
  flavor: string;
  /** Present on support cards — they're played for an effect, never fielded. */
  support?: SupportEffect;
  /**
   * A painted image to use instead of the drawn motif. Optional escape hatch
   * over the local manifest in data/cardArt.ts, so the server can start
   * sending art without a client release.
   */
  art?: string;
  /**
   * Overrides the corner plate's rarity word. Arena effects are graded
   * A/S/SS/SSS rather than common/legendary, and the plate is the one place
   * the grade survives every path — the hero overlay doesn't render at all
   * under reduced motion. Optional, so all 69 existing cards are untouched.
   */
  gradeLabel?: string;
}

/** One short line saying exactly what a support card does — at ITS level.
 *  Support levels raise the effect, never ATK/HP; the numbers here mirror
 *  supMult in both server engines (duel support play, dungeon use-support),
 *  so what the card face promises is what the server delivers. */
export function supportText(s: SupportEffect, level = 1): string {
  const m = 1 + (Math.min(10, Math.max(1, Math.floor(level || 1))) - 1) * 0.07;
  switch (s.kind) {
    case "heal":   return `Restore ${Math.round(s.power * m)} HP`;
    case "shield": return "Halve the next hit";
    case "block":  return "Negate the next hit";
    case "focus":  return `Next strike ×${Number((1 + (s.power - 1) * m).toFixed(2))}`;
    case "mend":   return `Heal your whole line ${Math.round(s.power * m)}`;
    case "revive": return `Revive a fallen card at ${Math.min(95, Math.round(s.power * m))}%`;
    // Covenant numbers mirror the server engines' caps exactly.
    case "reflect": return `Return ${Math.min(80, Math.round(s.power * 100 * m))}% of each blow, 3 hits`;
    case "bless":   return `Heal ALL allies ${Math.min(80, Math.round(s.power * 100 * m))}% of max HP`;
    case "pact":    return `Pay half your HP — strike ${Math.min(90, Math.round(50 * m))}% harder, 25% tougher`;
    case "stone":   return `+${Math.min(60, Math.round(s.power * m))}% ATK · untouchable for 2 attacks`;
    case "mirror":  return `Reflect ${Math.min(30, Math.round(s.power * 100 * m))}% of damage — and drink it`;
    case "arise":   return `ARISE — all fallen return at ${Math.min(25, Math.round(s.power * 100 * m))}%, +${Math.min(40, Math.round(20 * m))}% ATK`;
    // The ability row is now the ONLY place this text appears, so an
    // unhandled kind would leave a support card's primary line blank rather
    // than merely missing a tooltip.
    default: return `Effect: ${(s as { kind: string }).kind}`;
  }
}

export const RARITY_META: Record<CardRarity, { label: string; frame: string; gem: string; glow: string; order: number }> = {
  common:    { label: "Common",    frame: "#7c8598", gem: "#aab4c4", glow: "rgba(148,163,184,0.30)", order: 0 },
  rare:      { label: "Rare",      frame: "#3b82f6", gem: "#7dd3fc", glow: "rgba(59,130,246,0.45)",  order: 1 },
  epic:      { label: "Epic",      frame: "#a855f7", gem: "#d8b4fe", glow: "rgba(168,85,247,0.55)",  order: 2 },
  legendary: { label: "Legendary", frame: "#f59e0b", gem: "#fde68a", glow: "rgba(245,158,11,0.65)",  order: 3 },
  event:     { label: "Event",     frame: "#ec4899", gem: "#f9a8d4", glow: "rgba(236,72,153,0.60)",  order: 4 },
  // The ★5 synthesis tier — crimson where legendary is gold, because it was
  // MADE, not found. order 5 outranks everything (hero moments, best-last).
  mythic:    { label: "Mythic",    frame: "#e11d48", gem: "#fda4af", glow: "rgba(225,29,72,0.70)",   order: 5 },
};

/** Rarity as a star count, drawn on the card itself. Mirrors STARS in gacha.tsx. */
export const STAR_COUNT: Record<CardRarity, number> = {
  common: 1, rare: 2, epic: 3, legendary: 4, event: 5, mythic: 5,
};

/** The five legendaries the Synthesis Lab accepts — display-only mirror of
 *  FUSION_ELIGIBLE on the server; the machine itself is the gate. */
const FUSABLE = new Set(["card_gatekey", "card_lastronin", "card_leviathan", "card_longmorrow", "card_outergod"]);

// Deterministic per-card pseudo-random so a card always looks identical.
function rnd(id: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h ^ id.charCodeAt(i), 2246822519) + 1) >>> 0;
  return (h % 10000) / 10000;
}

/** The scene. Drawn on a 100x86 art panel starting at y=0. */
/** Stable hash of a card id — art must not reshuffle between renders. */
function seedFrom(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** xorshift — deterministic, and far cheaper than anything that allocates. */
function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

function Motif({ card, dim }: { card: CardDef; dim: boolean }) {
  const h = card.hue;
  const R = (n: number) => rnd(card.id, n);
  // Palette derived from the hue so every motif is coherent with its card.
  const bright = dim ? "#3a3a44" : `hsl(${h} 92% 76%)`;
  const mid = dim ? "#2c2c34" : `hsl(${h} 78% 56%)`;
  const deep = dim ? "#22222a" : `hsl(${(h + 25) % 360} 70% 34%)`;
  const ink = dim ? "#1a1a20" : `hsl(${(h + 200) % 360} 60% 10%)`;
  const O = dim ? 0.45 : 1;

  switch (card.motif) {
    // ── A vast eye, lids and a slit pupil ──────────────────────────────────
    case "eye": {
      const rays = 16;
      const iris: string[] = [];
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        iris.push(`M ${50 + Math.cos(a) * 7} ${44 + Math.sin(a) * 7} L ${50 + Math.cos(a) * 17} ${44 + Math.sin(a) * 17}`);
      }
      return (
        <g opacity={O}>
          <ellipse cx="50" cy="44" rx="40" ry="24" fill={ink} />
          <circle cx="50" cy="44" r="18" fill={deep} />
          <circle cx="50" cy="44" r="18" fill={`url(#irisGrad-${card.id})`} />
          <path d={iris.join(" ")} stroke={bright} strokeWidth="0.7" opacity="0.55" fill="none" />
          <ellipse cx="50" cy="44" rx="4.5" ry="15" fill="#05040a" />
          <circle cx="44" cy="36" r="3.4" fill="#fff" opacity={dim ? 0.15 : 0.75} />
          {/* lids */}
          <path d="M 10 44 Q 50 8 90 44 Q 50 20 10 44 Z" fill={ink} />
          <path d="M 10 44 Q 50 80 90 44 Q 50 68 10 44 Z" fill={ink} />
          <path d="M 10 44 Q 50 8 90 44" stroke={mid} strokeWidth="1.6" fill="none" />
          <path d="M 10 44 Q 50 80 90 44" stroke={mid} strokeWidth="1.6" fill="none" />
        </g>
      );
    }

    // ── Layered mountain ridgelines under a moon ───────────────────────────
    case "peak": {
      const ridge = (yBase: number, amp: number, seed: number, fill: string, op: number) => {
        const pts: string[] = [`M 0 86`, `L 0 ${yBase}`];
        for (let x = 0; x <= 100; x += 10) {
          const y = yBase - Math.abs(Math.sin((x / 100) * Math.PI * (1.4 + R(seed)) + seed)) * amp;
          pts.push(`L ${x} ${y.toFixed(1)}`);
        }
        pts.push("L 100 86 Z");
        return <path d={pts.join(" ")} fill={fill} opacity={op} />;
      };
      return (
        <g opacity={O}>
          <circle cx="72" cy="24" r="11" fill={bright} opacity={dim ? 0.2 : 0.85} />
          <circle cx="68" cy="21" r="11" fill={ink} />
          {ridge(70, 26, 3, deep, 0.9)}
          {ridge(76, 20, 7, mid, 0.55)}
          {ridge(82, 12, 11, bright, 0.3)}
        </g>
      );
    }

    // ── Rotating many-spoked wheel ─────────────────────────────────────────
    case "wheel": {
      const spokes = 9;
      const d: string[] = [];
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        d.push(`M ${50 + Math.cos(a) * 8} ${44 + Math.sin(a) * 8} L ${50 + Math.cos(a) * 30} ${44 + Math.sin(a) * 30}`);
      }
      return (
        <g opacity={O}>
          <circle cx="50" cy="44" r="31" fill="none" stroke={deep} strokeWidth="6" />
          <circle cx="50" cy="44" r="31" fill="none" stroke={bright} strokeWidth="1.4" />
          <circle cx="50" cy="44" r="22" fill="none" stroke={mid} strokeWidth="1" opacity="0.7" />
          <path d={d.join(" ")} stroke={bright} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="50" cy="44" r="8" fill={ink} stroke={bright} strokeWidth="1.4" />
          <circle cx="50" cy="44" r="3" fill={bright} />
        </g>
      );
    }

    // ── Writhing tendrils from a void ──────────────────────────────────────
    case "tendril": {
      const arms = 6;
      const paths: string[] = [];
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + R(i) * 0.6;
        const x1 = 50 + Math.cos(a) * 14, y1 = 44 + Math.sin(a) * 14;
        const cx1 = 50 + Math.cos(a + 0.9) * 34, cy1 = 44 + Math.sin(a + 0.9) * 34;
        const x2 = 50 + Math.cos(a - 0.3) * 48, y2 = 44 + Math.sin(a - 0.3) * 42;
        paths.push(`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`);
      }
      return (
        <g opacity={O}>
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p} stroke={deep} strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.85" />
              <path d={p} stroke={bright} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
            </g>
          ))}
          <circle cx="50" cy="44" r="16" fill="#03040a" />
          <circle cx="50" cy="44" r="16" fill="none" stroke={bright} strokeWidth="1.5" opacity="0.8" />
          <circle cx="50" cy="44" r="9" fill={deep} opacity="0.6" />
        </g>
      );
    }

    // ── Open lotus ─────────────────────────────────────────────────────────
    case "lotus": {
      const petals = 10;
      return (
        <g opacity={O}>
          {Array.from({ length: petals }, (_, i) => {
            const a = (i / petals) * Math.PI * 2;
            const len = i % 2 === 0 ? 30 : 22;
            return (
              <ellipse key={i} cx={50 + Math.cos(a) * len * 0.5} cy={50 + Math.sin(a) * len * 0.5}
                rx={len * 0.5} ry="7" transform={`rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * len * 0.5} ${50 + Math.sin(a) * len * 0.5})`}
                fill={i % 2 === 0 ? mid : deep} opacity={i % 2 === 0 ? 0.85 : 0.6} />
            );
          })}
          <circle cx="50" cy="50" r="7" fill={bright} opacity="0.9" />
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={50 + Math.cos((i / 7) * Math.PI * 2) * 4} cy={50 + Math.sin((i / 7) * Math.PI * 2) * 4} r="1.2" fill={ink} />
          ))}
        </g>
      );
    }

    // ── Storm: cloud bank + forked lightning + rain ────────────────────────
    case "storm":
      return (
        <g opacity={O}>
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={6 + i * 7} y1={46 + R(i) * 10} x2={2 + i * 7} y2={76 + R(i + 9) * 8}
              stroke={mid} strokeWidth="0.8" opacity="0.45" />
          ))}
          <path d="M 54 22 L 44 48 L 52 48 L 42 74 L 66 42 L 56 42 L 66 22 Z" fill={bright} opacity={dim ? 0.3 : 0.95} />
          <ellipse cx="34" cy="26" rx="24" ry="11" fill={deep} />
          <ellipse cx="62" cy="22" rx="26" ry="12" fill={ink} />
          <ellipse cx="48" cy="30" rx="30" ry="10" fill={deep} opacity="0.8" />
        </g>
      );

    // ── A gate standing open ───────────────────────────────────────────────
    case "gate":
      return (
        <g opacity={O}>
          <rect x="30" y="16" width="40" height="66" rx="20" fill={ink} />
          <rect x="30" y="16" width="40" height="66" rx="20" fill={`url(#irisGrad-${card.id})`} opacity="0.55" />
          <rect x="30" y="16" width="40" height="66" rx="20" fill="none" stroke={bright} strokeWidth="2" />
          <rect x="36" y="23" width="28" height="52" rx="14" fill="none" stroke={mid} strokeWidth="0.9" opacity="0.7" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="30" y1={26 + i * 10} x2="70" y2={26 + i * 10} stroke={bright} strokeWidth="0.5" opacity="0.35" />
          ))}
          <circle cx="50" cy="49" r="6" fill={bright} opacity={dim ? 0.3 : 0.9} />
          <path d="M 22 82 L 78 82" stroke={deep} strokeWidth="4" />
        </g>
      );

    // ── A single ember rising through sparks ───────────────────────────────
    case "ember":
      return (
        <g opacity={O}>
          {Array.from({ length: 22 }, (_, i) => (
            <circle key={i} cx={12 + R(i) * 76} cy={10 + R(i + 30) * 74} r={0.6 + R(i + 60) * 1.6}
              fill={i % 3 === 0 ? bright : mid} opacity={0.25 + R(i + 90) * 0.5} />
          ))}
          <path d="M 50 70 C 36 56 42 42 50 26 C 58 42 64 56 50 70 Z" fill={mid} opacity="0.9" />
          <path d="M 50 66 C 42 55 45 45 50 34 C 55 45 58 55 50 66 Z" fill={bright} />
          <ellipse cx="50" cy="60" rx="5" ry="7" fill="#fff" opacity={dim ? 0.15 : 0.7} />
        </g>
      );

    // ── A pale moth ────────────────────────────────────────────────────────
    case "moth":
      return (
        <g opacity={O}>
          <circle cx="50" cy="26" r="14" fill={bright} opacity={dim ? 0.12 : 0.28} />
          <ellipse cx="34" cy="46" rx="19" ry="13" transform="rotate(-24 34 46)" fill={mid} opacity="0.85" />
          <ellipse cx="66" cy="46" rx="19" ry="13" transform="rotate(24 66 46)" fill={mid} opacity="0.85" />
          <ellipse cx="38" cy="62" rx="13" ry="9" transform="rotate(-14 38 62)" fill={deep} opacity="0.8" />
          <ellipse cx="62" cy="62" rx="13" ry="9" transform="rotate(14 62 62)" fill={deep} opacity="0.8" />
          <circle cx="34" cy="45" r="3.4" fill={ink} />
          <circle cx="66" cy="45" r="3.4" fill={ink} />
          <ellipse cx="50" cy="52" rx="3.6" ry="17" fill={ink} />
          <path d="M 50 36 Q 43 26 38 24 M 50 36 Q 57 26 62 24" stroke={ink} strokeWidth="1.4" fill="none" />
        </g>
      );

    // ── Concentric ripples ─────────────────────────────────────────────────
    case "ripple":
      return (
        <g opacity={O}>
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={i} cx="50" cy="52" rx={8 + i * 13} ry={3 + i * 5}
              fill="none" stroke={i % 2 ? mid : bright} strokeWidth={1.6 - i * 0.15} opacity={0.75 - i * 0.1} />
          ))}
          <ellipse cx="50" cy="52" rx="4" ry="2" fill={bright} />
          <circle cx="50" cy="26" r="2.2" fill={bright} opacity={dim ? 0.3 : 0.9} />
        </g>
      );

    // ── A seedling breaking soil ───────────────────────────────────────────
    case "seed":
      return (
        <g opacity={O}>
          <path d="M 0 72 Q 50 64 100 72 L 100 86 L 0 86 Z" fill={ink} />
          <path d="M 50 72 L 50 40" stroke={mid} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M 50 52 Q 32 44 26 28 Q 46 30 50 48 Z" fill={mid} />
          <path d="M 50 46 Q 68 38 74 22 Q 54 24 50 42 Z" fill={bright} opacity="0.9" />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={14 + R(i) * 72} cy={16 + R(i + 20) * 44} r="0.9" fill={bright} opacity={0.3 + R(i + 40) * 0.4} />
          ))}
        </g>
      );

    // ── An unfurled scroll ─────────────────────────────────────────────────
    case "scroll":
      return (
        <g opacity={O}>
          <rect x="22" y="18" width="56" height="52" rx="2" fill={deep} opacity="0.9" />
          <rect x="22" y="18" width="56" height="52" rx="2" fill="none" stroke={bright} strokeWidth="1" opacity="0.6" />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1="28" y1={26 + i * 5.6} x2={28 + 30 + R(i) * 16} y2={26 + i * 5.6} stroke={bright} strokeWidth="0.9" opacity="0.5" />
          ))}
          <rect x="16" y="12" width="68" height="8" rx="4" fill={mid} />
          <rect x="16" y="68" width="68" height="8" rx="4" fill={mid} />
          <circle cx="16" cy="16" r="4" fill={bright} opacity="0.8" />
          <circle cx="84" cy="72" r="4" fill={bright} opacity="0.8" />
        </g>
      );

    // ── A long road toward a horizon ───────────────────────────────────────
    case "path":
      return (
        <g opacity={O}>
          <circle cx="50" cy="34" r="9" fill={bright} opacity={dim ? 0.18 : 0.55} />
          <path d="M 0 86 L 42 34 L 58 34 L 100 86 Z" fill={deep} opacity="0.75" />
          <path d="M 44 34 L 56 34 L 74 86 L 26 86 Z" fill={mid} opacity="0.5" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x="48.5" y={38 + i * 8.6} width="3" height={3 + i} fill={bright} opacity="0.6" />
          ))}
          <path d="M 0 34 L 100 34" stroke={bright} strokeWidth="0.7" opacity="0.35" />
        </g>
      );

    // ── A wax seal ─────────────────────────────────────────────────────────
    case "seal": {
      const teeth = 18;
      const pts: string[] = [];
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 ? 24 : 29;
        pts.push(`${50 + Math.cos(a) * r},${46 + Math.sin(a) * r}`);
      }
      return (
        <g opacity={O}>
          <polygon points={pts.join(" ")} fill={deep} />
          <circle cx="50" cy="46" r="21" fill={mid} opacity="0.85" />
          <circle cx="50" cy="46" r="21" fill="none" stroke={bright} strokeWidth="1" />
          <path d="M 40 38 L 50 56 L 60 38 M 44 48 L 56 48" stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <ellipse cx="42" cy="38" rx="7" ry="4" fill="#fff" opacity={dim ? 0.08 : 0.22} />
        </g>
      );
    }

    // ── A beating heart of light ───────────────────────────────────────────
    case "heart":
      return (
        <g opacity={O}>
          {Array.from({ length: 3 }, (_, i) => (
            <path key={i} d="M 50 74 C 22 56 26 30 42 30 C 48 30 50 36 50 36 C 50 36 52 30 58 30 C 74 30 78 56 50 74 Z"
              fill="none" stroke={bright} strokeWidth="0.8" opacity={0.4 - i * 0.12}
              transform={`translate(50 52) scale(${1.12 + i * 0.16}) translate(-50 -52)`} />
          ))}
          <path d="M 50 74 C 22 56 26 30 42 30 C 48 30 50 36 50 36 C 50 36 52 30 58 30 C 74 30 78 56 50 74 Z" fill={deep} />
          <path d="M 50 68 C 30 54 33 36 43 36 C 48 36 50 41 50 41 C 50 41 52 36 57 36 C 67 36 70 54 50 68 Z" fill={mid} />
          <circle cx="50" cy="50" r="5" fill={bright} />
        </g>
      );

    // ── A rising red sea ───────────────────────────────────────────────────
    case "sea": {
      const wave = (y: number, amp: number, seed: number, fill: string, op: number) => {
        const p: string[] = [`M 0 86`, `L 0 ${y}`];
        for (let x = 0; x <= 100; x += 8) p.push(`L ${x} ${(y + Math.sin(x / 9 + seed) * amp).toFixed(1)}`);
        p.push("L 100 86 Z");
        return <path d={p.join(" ")} fill={fill} opacity={op} />;
      };
      return (
        <g opacity={O}>
          <circle cx="50" cy="20" r="13" fill={bright} opacity={dim ? 0.15 : 0.45} />
          {wave(46, 4, 1, deep, 0.85)}
          {wave(58, 5, 3, mid, 0.7)}
          {wave(70, 4, 5, bright, 0.4)}
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={10 + R(i) * 80} cy={44 + R(i + 12) * 30} r="1" fill="#fff" opacity="0.35" />
          ))}
        </g>
      );
    }

    // ── First light over a horizon ─────────────────────────────────────────
    case "dawn":
      return (
        <g opacity={O}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = -Math.PI + (i / 11) * Math.PI;
            return <path key={i} d={`M 50 64 L ${50 + Math.cos(a) * 60} ${64 + Math.sin(a) * 60}`} stroke={bright} strokeWidth="1.6" opacity={0.12 + (i % 3) * 0.08} />;
          })}
          <circle cx="50" cy="64" r="20" fill={bright} opacity={dim ? 0.25 : 0.9} />
          <circle cx="50" cy="64" r="28" fill={mid} opacity="0.25" />
          <rect x="0" y="64" width="100" height="22" fill={ink} />
          <path d="M 0 64 L 100 64" stroke={bright} strokeWidth="1.2" opacity="0.8" />
        </g>
      );

    // ── A spun web ─────────────────────────────────────────────────────────
    case "web": {
      const spokes = 10;
      const lines: string[] = [];
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        lines.push(`M 50 44 L ${50 + Math.cos(a) * 44} ${44 + Math.sin(a) * 40}`);
      }
      const rings: string[] = [];
      for (let r = 1; r <= 5; r++) {
        const rad = r * 8;
        const seg: string[] = [];
        for (let i = 0; i <= spokes; i++) {
          const a = (i / spokes) * Math.PI * 2;
          seg.push(`${i ? "L" : "M"} ${50 + Math.cos(a) * rad} ${44 + Math.sin(a) * rad * 0.92}`);
        }
        rings.push(seg.join(" "));
      }
      return (
        <g opacity={O}>
          <path d={lines.join(" ")} stroke={mid} strokeWidth="0.8" fill="none" opacity="0.75" />
          <path d={rings.join(" ")} stroke={bright} strokeWidth="0.7" fill="none" opacity="0.6" />
          <circle cx="50" cy="44" r="3" fill={bright} />
        </g>
      );
    }

    // ── A colossal shape passing beneath the light ─────────────────────────
    case "leviathan": {
      const plates: string[] = [];
      for (let i = 0; i < 9; i++) {
        const x = 24 + i * 7;
        const y = 60 + Math.sin(i / 2.2) * 4;
        plates.push(`M ${x} ${y.toFixed(1)} Q ${x + 3.5} ${(y + 8).toFixed(1)} ${x + 7} ${y.toFixed(1)}`);
      }
      return (
        <g opacity={O}>
          {/* shafts of surface light falling through the water */}
          {Array.from({ length: 4 }, (_, i) => (
            <path key={i} d={`M ${10 + i * 24} 0 L ${22 + i * 24} 0 L ${34 + i * 24 + R(i) * 8} 86 L ${4 + i * 24} 86 Z`}
              fill={bright} opacity={0.05 + R(i + 5) * 0.05} />
          ))}
          {/* a second, further body lost in the haze */}
          <path d="M -6 60 Q 24 38 56 44 Q 84 49 106 32" stroke={deep} strokeWidth="15" fill="none" opacity="0.3" strokeLinecap="round" />
          {/* the bulk */}
          <path d="M -4 68 Q 20 44 50 50 Q 78 55 104 40 L 104 86 L -4 86 Z" fill={ink} />
          <path d="M -4 68 Q 20 44 50 50 Q 78 55 104 40" stroke={mid} strokeWidth="1.6" fill="none" opacity="0.8" />
          {/* belly plating */}
          <path d={plates.join(" ")} stroke={mid} strokeWidth="0.9" fill="none" opacity="0.45" />
          {/* dorsal spines riding the spine line */}
          {Array.from({ length: 7 }, (_, i) => {
            const x = 16 + i * 11;
            const y = 53 - i * 1.1;
            return <path key={i} d={`M ${x} ${y.toFixed(1)} L ${x + 3} ${(y - 8 - R(i + 20) * 5).toFixed(1)} L ${x + 6} ${y.toFixed(1)} Z`} fill={deep} opacity="0.9" />;
          })}
          {/* tail fluke breaking upward */}
          <path d="M 6 70 Q 16 58 10 42 Q 23 51 25 66 Q 20 77 6 70 Z" fill={ink} />
          <path d="M 6 70 Q 16 58 10 42" stroke={bright} strokeWidth="0.9" fill="none" opacity="0.45" />
          {/* the head, and the eye that is already awake */}
          <ellipse cx="86" cy="44" rx="15" ry="9" transform="rotate(-14 86 44)" fill={ink} />
          <path d="M 72 48 Q 86 52 100 46" stroke={mid} strokeWidth="0.9" fill="none" opacity="0.6" />
          <circle cx="88" cy="42" r="3.6" fill={bright} opacity={dim ? 0.3 : 0.95} />
          <circle cx="88" cy="42" r="1.4" fill="#05040a" />
          {/* bubbles going the other way */}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} cx={8 + R(i + 40) * 84} cy={6 + R(i + 60) * 42} r={0.6 + R(i + 80) * 1.4}
              fill={bright} opacity={0.2 + R(i + 100) * 0.35} />
          ))}
        </g>
      );
    }

    // ── A rift in the seafloor, going down and then further ────────────────
    case "trench": {
      const strata: string[] = [];
      for (let i = 0; i < 7; i++) {
        const y = 20 + i * 9;
        strata.push(`M 0 ${y} L ${(29 - i * 2.4 + R(i) * 5).toFixed(1)} ${y + 4}`);
        strata.push(`M 100 ${y + 3} L ${(71 + i * 2.4 - R(i + 9) * 5).toFixed(1)} ${y + 7}`);
      }
      return (
        <g opacity={O}>
          {/* the gap itself */}
          <path d="M 34 0 L 66 0 L 58 86 L 42 86 Z" fill="#03040a" />
          <path d="M 36 0 L 64 0 L 56 86 L 44 86 Z" fill={`url(#irisGrad-${card.id})`} opacity="0.22" />
          {/* left wall */}
          <path d="M 0 0 L 34 0 L 42 86 L 0 86 Z" fill={deep} />
          <path d="M 0 5 L 29 2 L 39 86 L 0 86 Z" fill={ink} opacity="0.72" />
          {/* right wall */}
          <path d="M 66 0 L 100 0 L 100 86 L 58 86 Z" fill={deep} />
          <path d="M 71 3 L 100 6 L 100 86 L 61 86 Z" fill={ink} opacity="0.72" />
          {/* strata scoring the rock */}
          <path d={strata.join(" ")} stroke={mid} strokeWidth="0.7" fill="none" opacity="0.4" />
          {/* rim light along both lips */}
          <path d="M 34 0 L 42 86" stroke={bright} strokeWidth="1.1" opacity="0.7" />
          <path d="M 66 0 L 58 86" stroke={bright} strokeWidth="1.1" opacity="0.7" />
          {/* vents smoking off the ledges */}
          {Array.from({ length: 4 }, (_, i) => {
            const x = i < 2 ? 12 + i * 12 : 72 + (i - 2) * 12;
            const y = 34 + R(i + 30) * 34;
            return (
              <g key={i}>
                <path d={`M ${x} ${y.toFixed(1)} q -3 -9 1 -16`} stroke={bright} strokeWidth="2.4" fill="none" opacity="0.14" strokeLinecap="round" />
                <ellipse cx={x} cy={y.toFixed(1)} rx="3.4" ry="1.4" fill={ink} />
              </g>
            );
          })}
          {/* something lit, very far down */}
          <ellipse cx="50" cy="74" rx="7" ry="4" fill={bright} opacity={dim ? 0.2 : 0.5} />
          <ellipse cx="50" cy="74" rx="3" ry="1.6" fill="#fff" opacity={dim ? 0.1 : 0.6} />
          {/* marine snow falling into it */}
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={6 + R(i) * 88} cy={4 + R(i + 25) * 78} r={0.5 + R(i + 50) * 1}
              fill={bright} opacity={0.2 + R(i + 70) * 0.4} />
          ))}
        </g>
      );
    }

    // ── A drawn blade, rain running off the temper line ────────────────────
    case "blade": {
      const hamon: string[] = ["M 33 67"];
      for (let i = 1; i <= 9; i++) {
        const t = i / 9;
        const bx = 33 + t * 50 + Math.sin(i * 1.9) * 1.6;
        const by = 67 - t * 52 + Math.cos(i * 2.3) * 1.6;
        hamon.push(`L ${bx.toFixed(1)} ${by.toFixed(1)}`);
      }
      return (
        <g opacity={O}>
          {/* rain, slanting the other way */}
          {Array.from({ length: 18 }, (_, i) => (
            <line key={i} x1={2 + R(i) * 96} y1={R(i + 20) * 78} x2={-1 + R(i) * 96} y2={7 + R(i + 20) * 78 + R(i + 40) * 6}
              stroke={mid} strokeWidth="0.6" opacity={0.25 + R(i + 60) * 0.3} />
          ))}
          {/* the arc the cut left in the air */}
          <path d="M 14 76 Q 46 58 92 6" stroke={bright} strokeWidth="6" fill="none" opacity={dim ? 0.08 : 0.16} strokeLinecap="round" />
          <path d="M 16 73 Q 48 56 90 8" stroke={bright} strokeWidth="1.2" fill="none" opacity={dim ? 0.15 : 0.45} strokeLinecap="round" />
          {/* the blade */}
          <path d="M 30 68 Q 52 46 84 12 L 87 15 Q 58 48 36 71 Z" fill={ink} />
          <path d="M 30 68 Q 52 46 84 12 L 87 15 Q 58 48 36 71 Z" fill={bright} opacity={dim ? 0.25 : 0.9} />
          <path d="M 33 69 Q 55 47 85.5 13.5" stroke="#fff" strokeWidth="0.8" fill="none" opacity={dim ? 0.15 : 0.7} />
          <path d={hamon.join(" ")} stroke={ink} strokeWidth="0.8" fill="none" opacity="0.5" />
          {/* the guard */}
          <ellipse cx="28" cy="70" rx="9" ry="3.2" transform="rotate(-45 28 70)" fill={deep} />
          <ellipse cx="28" cy="70" rx="9" ry="3.2" transform="rotate(-45 28 70)" fill="none" stroke={bright} strokeWidth="0.8" opacity="0.7" />
          <circle cx="28" cy="70" r="1.7" fill={ink} />
          {/* the wrapped grip running off the corner */}
          <path d="M 26 72 L 12 86 L 6 80 L 20 66 Z" fill={ink} />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={19 - i * 2.9} y1={67 + i * 2.9} x2={25 - i * 2.9} y2={73 + i * 2.9}
              stroke={mid} strokeWidth="1.1" opacity={0.75 - i * 0.05} />
          ))}
          {/* whatever it just met, at the tip */}
          <circle cx="86" cy="13" r="6.5" fill={bright} opacity={dim ? 0.1 : 0.3} />
          <circle cx="86" cy="13" r="2.6" fill="#fff" opacity={dim ? 0.2 : 0.85} />
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 + R(i + 12);
            return <line key={i} x1={86 + Math.cos(a) * 4} y1={13 + Math.sin(a) * 4}
              x2={86 + Math.cos(a) * (9 + R(i + 24) * 5)} y2={13 + Math.sin(a) * (9 + R(i + 24) * 5)}
              stroke={bright} strokeWidth="0.7" opacity={dim ? 0.2 : 0.65} />;
          })}
        </g>
      );
    }

    // ── A carved mask, still warm from the face that left it ───────────────
    case "mask": {
      const cracks: string[] = [];
      for (let i = 0; i < 5; i++) {
        const sx = 34 + R(i) * 30, sy = 24 + R(i + 7) * 34;
        cracks.push(`M ${sx.toFixed(1)} ${sy.toFixed(1)} l ${(-4 + R(i + 14) * 8).toFixed(1)} ${(5 + R(i + 21) * 8).toFixed(1)} l ${(-3 + R(i + 28) * 6).toFixed(1)} ${(4 + R(i + 35) * 7).toFixed(1)}`);
      }
      return (
        <g opacity={O}>
          {/* lantern light behind it */}
          <circle cx="50" cy="42" r="32" fill={bright} opacity={dim ? 0.07 : 0.16} />
          <circle cx="50" cy="42" r="20" fill={bright} opacity={dim ? 0.06 : 0.12} />
          {/* the cord it hangs by */}
          <path d="M 20 30 Q 50 16 80 30" stroke={deep} strokeWidth="1.6" fill="none" opacity="0.8" />
          {/* horns */}
          <path d="M 32 26 Q 21 13 25 3 Q 34 12 38 24 Z" fill={deep} />
          <path d="M 68 26 Q 79 13 75 3 Q 66 12 62 24 Z" fill={deep} />
          {/* the face */}
          <path d="M 50 12 C 70 12 78 26 76 44 C 74 64 62 80 50 80 C 38 80 26 64 24 44 C 22 26 30 12 50 12 Z" fill={mid} />
          <path d="M 50 16 C 66 16 73 28 71 44 C 69 61 60 74 50 74 C 40 74 31 61 29 44 C 27 28 34 16 50 16 Z" fill={deep} opacity="0.45" />
          {/* brow ridges */}
          <path d="M 30 36 Q 39 27 46 34 M 70 36 Q 61 27 54 34" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {/* eye holes, and something looking out of them */}
          <path d="M 32 42 Q 40 35 46 42 Q 39 47 32 42 Z" fill="#04030a" />
          <path d="M 68 42 Q 60 35 54 42 Q 61 47 68 42 Z" fill="#04030a" />
          <circle cx="39" cy="41.5" r="1.7" fill={bright} opacity={dim ? 0.3 : 0.95} />
          <circle cx="61" cy="41.5" r="1.7" fill={bright} opacity={dim ? 0.3 : 0.95} />
          {/* nose and a mouth full of teeth */}
          <path d="M 50 43 L 46.5 56 L 53.5 56 Z" fill={ink} opacity="0.65" />
          <path d="M 36 61 Q 50 73 64 61 Q 50 66 36 61 Z" fill="#04030a" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={38.5 + i * 4.2} y="61.5" width="2.3" height={2.6 + R(i) * 2.4} fill={bright} opacity="0.8" />
          ))}
          {/* lacquer, gone in the heat */}
          <path d={cracks.join(" ")} stroke={ink} strokeWidth="0.6" fill="none" opacity="0.5" />
          <path d="M 34 22 Q 44 16 52 17" stroke="#fff" strokeWidth="1.4" fill="none" opacity={dim ? 0.08 : 0.28} strokeLinecap="round" />
        </g>
      );
    }

    // ── A hung bell, mid-toll ──────────────────────────────────────────────
    case "bell": {
      const rings = Array.from({ length: 5 }, (_, i) => 20 + i * 13);
      return (
        <g opacity={O}>
          {/* the sound leaving */}
          {rings.map((r, i) => (
            <circle key={i} cx="50" cy="48" r={r} fill="none" stroke={bright}
              strokeWidth={1.4 - i * 0.2} opacity={(0.45 - i * 0.07) * (dim ? 0.5 : 1)} />
          ))}
          {/* the beam it hangs from */}
          <rect x="2" y="5" width="96" height="7" rx="2" fill={ink} />
          <rect x="2" y="5" width="96" height="7" rx="2" fill="none" stroke={mid} strokeWidth="0.7" opacity="0.55" />
          {/* yoke and crown */}
          <path d="M 46 12 L 46 20 M 54 12 L 54 20" stroke={deep} strokeWidth="3" />
          <path d="M 43 21 Q 50 13 57 21 Z" fill={deep} />
          <circle cx="50" cy="19" r="3.4" fill="none" stroke={bright} strokeWidth="1.4" opacity="0.85" />
          {/* the bell */}
          <path d="M 50 22 C 34 22 26 42 24 62 L 76 62 C 74 42 66 22 50 22 Z" fill={deep} />
          <path d="M 50 22 C 40 22 34 42 32 62 L 46 62 C 44 42 44 22 50 22 Z" fill={mid} opacity="0.7" />
          {/* raised bands of inscription */}
          {Array.from({ length: 3 }, (_, i) => (
            <path key={i} d={`M ${29 + i * 6} ${52 - i * 11} Q 50 ${47 - i * 11} ${71 - i * 6} ${52 - i * 11}`}
              stroke={bright} strokeWidth="0.8" fill="none" opacity={0.3 + R(i) * 0.3} />
          ))}
          {/* studs around the waist */}
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={30 + i * 6.7} cy={49 - Math.abs(3 - i) * 0.9} r="1.2" fill={bright} opacity="0.7" />
          ))}
          {/* the flared lip */}
          <path d="M 22 62 Q 50 56 78 62 Q 50 72 22 62 Z" fill={deep} />
          <path d="M 22 62 Q 50 56 78 62 Q 50 72 22 62 Z" fill="none" stroke={bright} strokeWidth="1" opacity="0.75" />
          {/* the clapper, swung out */}
          <path d="M 52 60 L 56 72" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="56.5" cy="74" rx="3.6" ry="4.6" fill={ink} />
          <ellipse cx="55.2" cy="72.4" rx="1.2" ry="1.8" fill={bright} opacity="0.55" />
          {/* the striking log on its ropes */}
          <path d="M 86 12 L 86 58 M 96 12 L 96 56" stroke={mid} strokeWidth="0.8" opacity="0.65" />
          <rect x="80" y="56" width="22" height="7" rx="3.5" fill={ink} />
          <rect x="80" y="56" width="22" height="7" rx="3.5" fill="none" stroke={bright} strokeWidth="0.6" opacity="0.55" />
          <circle cx="82" cy="59.5" r="1.4" fill={bright} opacity="0.6" />
        </g>
      );
    }

    // ── A comet, and the sky it drags behind it ────────────────────────────
    case "comet": {
      const stars = Array.from({ length: 40 }, (_, i) => ({
        x: R(i) * 100,
        y: R(i + 45) * 70,
        r: 0.35 + R(i + 90) * 1.05,
        o: 0.2 + R(i + 135) * 0.6,
      }));
      return (
        <g opacity={O}>
          {/* the field it is crossing */}
          {stars.map((s, i) => (
            <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)}
              fill={i % 5 === 0 ? bright : "#fff"} opacity={s.o} />
          ))}
          {/* dust tail: wide, curved, lagging */}
          <path d="M 74 22 L 2 72 L 8 82 L 78 30 Z" fill={mid} opacity={dim ? 0.14 : 0.32} />
          {/* ion tail: thin and dead straight */}
          <path d="M 74 22 L -4 56 L -2 62 L 76 27 Z" fill={bright} opacity={dim ? 0.12 : 0.3} />
          {/* grain inside the tails */}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={70 - i * 7} y1={26 + i * 4.4 + R(i) * 5} x2={54 - i * 7} y2={34 + i * 4.4 + R(i) * 5}
              stroke={bright} strokeWidth="0.7" opacity={0.4 - i * 0.035} />
          ))}
          {/* the coma */}
          <circle cx="76" cy="20" r="15" fill={bright} opacity={dim ? 0.1 : 0.2} />
          <circle cx="76" cy="20" r="8.5" fill={bright} opacity={dim ? 0.18 : 0.5} />
          <circle cx="76" cy="20" r="4.4" fill="#fff" opacity={dim ? 0.25 : 0.95} />
          <path d="M 74 18 L 78 17 L 79.5 21 L 76 23.5 L 73 21 Z" fill={ink} opacity="0.5" />
          {/* the ridge it appears to be falling behind */}
          <path d="M 0 74 L 14 68 L 26 74 L 40 63 L 54 74 L 70 65 L 86 74 L 100 69 L 100 86 L 0 86 Z" fill={ink} />
          <path d="M 0 74 L 14 68 L 26 74 L 40 63 L 54 74 L 70 65 L 86 74 L 100 69" stroke={deep} strokeWidth="1" fill="none" opacity="0.9" />
          {/* fires lit by whoever is watching it */}
          {Array.from({ length: 3 }, (_, i) => (
            <g key={i}>
              <circle cx={20 + i * 30} cy={79 + R(i) * 3} r={4 + R(i + 5) * 2} fill={bright} opacity={dim ? 0.06 : 0.16} />
              <circle cx={20 + i * 30} cy={79 + R(i) * 3} r={1.3 + R(i + 5) * 0.9} fill={bright} opacity={dim ? 0.2 : 0.75} />
            </g>
          ))}
        </g>
      );
    }

    default:
      return <circle cx="50" cy="44" r="20" fill={mid} opacity={O} />;
  }
}

// Combat stat line by rarity — mirrors CARD_STATS on the server. Passed in
// from the catalog where available so the two can't drift; this is the
// fallback for surfaces that render before the catalog resolves.
export const FALLBACK_STATS: Record<CardRarity, { hp: number; atk: number }> = {
  common: { hp: 10, atk: 3 },
  rare: { hp: 14, atk: 5 },
  epic: { hp: 20, atk: 8 },
  legendary: { hp: 28, atk: 12 },
  event: { hp: 24, atk: 10 },
  mythic: { hp: 36, atk: 15 },
};

function CardFaceImpl({
  card,
  owned = true,
  count = 0,
  foil = false,
  size = 190,
  // Defaults ON now. The collection grid — the densest and most-looked-at
  // surface in the app — never passed this, so with the old default the whole
  // stat row would be invisible exactly where it matters most. The two callers
  // that pass showStats={false} explicitly (arena shop cards, which have no
  // combat stats) still get what they asked for.
  showStats = true,
  stats,
  liveHp,
  liveMaxHp,
  liveAtk,
  level,
  forge,
  wear,
  skillLevel,
  skillCap,
  hibernating = false,
  ratio = "5 / 7",
}: {
  card: CardDef;
  owned?: boolean;
  count?: number;
  foil?: boolean;
  size?: number;
  /** Show the ATK/HP badges — what this card actually does in a duel. */
  showStats?: boolean;
  stats?: Record<string, { hp: number; atk: number }>;
  /**
   * Current health mid-duel. In the arena the badge used to keep showing the
   * card's MAX health while the bar beside it counted down, so the same card
   * displayed two different "health" numbers at once. Pass this and the badge
   * tracks the fight.
   */
  liveHp?: number;
  /** The fighter's true max HP, which includes level. See maxHp below. */
  liveMaxHp?: number;
  /** The fighter's true ATK from a live board — beats any client arithmetic. */
  liveAtk?: number;
  /** Shard-bought level (1-10); bends the badges by the server's +7% curve. */
  level?: number;
  /** Forge ranks; +1 ATK / +2 HP per rank, matching the server's steps. */
  forge?: { atk: number; hp: number };
  /**
   * Print wear, worn VISIBLY — the owner's canon: a Fresh Build is a
   * handmade original and stays untouched (no treatment IS the treatment);
   * Factory New is a machine replica, clean and a little sterile; Rusted is
   * a Fresh Build that time got to, and it shows.
   */
  wear?: string;
  /** This card's skill/domain rank, for the MAX sign — see skillCap. */
  skillLevel?: number;
  /** The rank that skill maxes at (3 domains / 5 skills). Absent = the card
   *  has no skill, or the surface can't know — the sign only judges what it
   *  is told about. */
  skillCap?: number;
  /** Fell in a lost duel and is asleep — owned, but not fieldable until woken. */
  hibernating?: boolean;
  /** CSS aspect-ratio for the whole card. Defaults to the arena's 5/7. */
  ratio?: string;
}) {
  const S = (stats || FALLBACK_STATS)[card.rarity] || FALLBACK_STATS.common;
  const mult = foil ? 1.2 : 1;
  /**
   * BOUGHT POWER SHOWS ON THE FACE. The badges knew rarity and foil but not
   * levels or the forge, so a trained card advertised its untrained numbers
   * everywhere except the arena. `level` bends the same +7% curve the server
   * uses (clamped at 10); `forge` adds the same flat points. Both optional —
   * a caller that passes nothing gets exactly the old card. `liveAtk`, like
   * liveMaxHp, is the fighter's REAL number when a board has one — server
   * truth beats any client arithmetic.
   */
  const lvlM = 1 + (Math.min(10, Math.max(1, level || 1)) - 1) * 0.07;
  const atk = typeof liveAtk === "number" && liveAtk > 0
    ? liveAtk
    : Math.round(S.atk * mult * lvlM) + (forge?.atk || 0);
  const maxHp = typeof liveMaxHp === "number" && liveMaxHp > 0
    ? liveMaxHp
    : Math.round(S.hp * mult * lvlM) + (forge?.hp || 0) * 2;
  const hp = typeof liveHp === "number" ? liveHp : maxHp;
  const wounded = typeof liveHp === "number" && liveHp < maxHp;
  // MAX — every dial this card has, turned to the top: level 10, both forge
  // ranks full (fighters only; a support's level IS its power), and the
  // skill at cap when the surface knows the skill. Mirrors MAX_CARD_LEVEL
  // and FORGE_MAX on the server.
  const maxed = !!owned &&
    (level || 1) >= 10 &&
    (card.support ? true : (forge?.atk || 0) >= 5 && (forge?.hp || 0) >= 5) &&
    (skillCap ? (skillLevel || 1) >= skillCap : true);
  const R = RARITY_META[card.rarity];
  const h = card.hue;
  const dim = !owned;
  const uid = card.id;
  // Atmosphere is only drawn where it can actually be seen. See the detail
  // budget note in the art stack below.
  const rich = size >= 96;
  // Read from the manifest INSIDE the component, never taken as a prop — a new
  // prop would defeat the memo() at the bottom of this file, which Arena's
  // two-second poll loop depends on to avoid re-rendering every card on screen.
  const painted = cardArt(card.id, card.art, size);

  /**
   * ── GEOMETRY ──────────────────────────────────────────────────────────
   * One table instead of eight magic multipliers scattered through the file.
   * The floors bind below ~140px and release above it, so small cards get
   * proportionally larger type — which is not a new idea, it is what the old
   * `size >= 96 ? 10.4 : 8.6` title tuning already encoded, made explicit.
   *
   * radius is PX and never a percentage: a percentage radius on a 5:7 box
   * resolves per axis and gives elliptical corners.
   */
  const px = (f: number, floor: number) => Math.max(floor, Math.round(size * f));
  const T = {
    radius: Math.min(18, Math.max(4, Math.round(size * 0.06))),
    pad: px(0.0426, 5),
    gap: px(0.026, 3),
    name: px(0.0638, 9),
    slot: px(0.0511, 8),
    stat: px(0.0468, 8),
    ability: px(0.0426, 8),
    micro: px(0.0383, 7),
    segW: px(0.028, 3),
    segH: px(0.0116, 2),
    pillH: px(0.088, 14),
    track: px(0.0139, 2),
  };

  /**
   * ── TIERS ──────────────────────────────────────────────────────────────
   * Adaptation happens by DELETING ROWS, never by growing the box. The card
   * is 5:7 at every size; anything that could add height instead disappears.
   * Boundaries sit between the real call-site sizes (48/52/56 bench and rail,
   * 84/92 pickers, 100–132 deck builder, 150+ everything else).
   */
  const panel = size >= 68;      // below this the art is the whole card
  const chrome = size >= 96;     // pill backgrounds, set code, foil mark
  const roomy = size >= 150;     // the ability line

  const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  /**
   * ── RARITY, FLAT ───────────────────────────────────────────────────────
   * No gem, no metal frame, no glow — those were the 3D. Rarity is carried by
   * four quiet signals instead, and the first one is ungated so it survives
   * down to a 48px bench card where nothing else fits:
   *   1. the hairline's ALPHA (never its width — width is a frame)
   *   2. a barely-there tint in the panel surface
   *   3. the segment meter's fill
   *   4. the rarity word, as bare type on the art
   */
  const FLAT: Record<string, { accent: string; line: string; panel: string; meter: string; segs: number }> = {
    common:    { accent: "#8B95A7", line: "rgba(139,149,167,0.16)", panel: "#0E0E13", meter: "#8B95A7", segs: 1 },
    rare:      { accent: "#60A5FA", line: "rgba(59,130,246,0.34)",  panel: "#0C0E17", meter: "#60A5FA", segs: 2 },
    epic:      { accent: "#C084FC", line: "rgba(168,85,247,0.40)",  panel: "#110C18", meter: "#C084FC", segs: 3 },
    legendary: { accent: "#FBBF24", line: "rgba(245,158,11,0.48)",  panel: "#14100A", meter: "#FBBF24", segs: 4 },
    event:     { accent: "#F472B6", line: "rgba(236,72,153,0.44)",  panel: "#150C12", meter: "#F472B6", segs: 5 },
    mythic:    { accent: "#FB7185", line: "rgba(225,29,72,0.50)",   panel: "#160A0E", meter: "#FB7185", segs: 5 },
  };
  const F = FLAT[card.rarity] || FLAT.common;

  // One mechanism for the unowned state instead of twenty scattered ternaries:
  // the art dims, the image is suppressed, and every value in the panel is
  // redacted. A card-shaped slot with blanked readouts reads far more like a
  // collection than a grey blob does.
  const surface = dim ? "#08080B" : F.panel;
  const hairline = dim ? "rgba(255,255,255,0.06)" : panel ? F.line : "rgba(255,255,255,0.55)";
  const ink = dim ? "#3F3F46" : "#F4F4F5";
  const muted = dim ? "#3F3F46" : "#71717A";

  const hpTone = hp <= 0 ? "#71717A" : wounded ? "#FBBF24" : "#34D399";
  const pillBg = chrome ? "rgba(255,255,255,0.055)" : "transparent";

  const abilityText = card.support
    ? supportText(card.support, level)
    : hibernating && owned
    ? "FALLEN, NOT DEAD — WAKE WITH SHARDS"
    : card.flavor;

  /** Every string is bounded. SVG could not do this, which is half of why the
   *  frame and the type moved to HTML. */
  const clip: CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  };

  return (
    <div
      className="relative select-none"
      style={{
        width: size,
        // 5/7 is LOAD-BEARING in the arena: that board sizes its whole stack
        // off this ratio and has about a fifth of a pixel of slack, so a
        // taller card there overflows into the opponent bench. Grids have
        // vertical room to spare, so they pass their own.
        aspectRatio: ratio,
        // No height anywhere, overflow hidden, and not one min-height inside:
        // this is what keeps the card exactly 5:7 at every size. The duel
        // board budgets its layout against that ratio with about a fifth of a
        // pixel of slack, so a card that grew even slightly would push the
        // champion through the opponent's bench.
        overflow: "hidden",
        borderRadius: T.radius,
        border: `1px solid ${hairline}`,
        background: surface,
        display: "flex",
        flexDirection: "column",
      }}
      title={owned ? `${card.name} — ${R.label}${foil ? " (Foil)" : ""}` : `${R.label} · not yet collected`}
    >
      {/* ── LEGENDARY AURA ── at the CARD ROOT, not inside the art band.
          The first attempt was an inset glow on the art container, which the
          container clipped and the panel covered — technically present and
          effectively invisible. This sits over the whole card, above the
          panel, and pulses a real ring of the rarity's colour. */}
      {owned && size >= 110 && (card.rarity === "legendary" || card.rarity === "mythic") && (
        /* NEON, not a hint. A solid 2px edge with THREE stacked outer
           blooms — tight, mid, wide — which is what makes light read as a
           tube rather than a blur. It never dims below 80%: the old ring
           breathed down to 30% and spent half its life invisible. Still one
           promoted layer animating opacity only; the shadows rasterise once.
           Gold for a legendary; CRIMSON for a mythic — made, not found. */
        <span
          aria-hidden
          className="cf-anim"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            pointerEvents: "none",
            borderRadius: "inherit",
            boxShadow: card.rarity === "mythic"
              ? `inset 0 0 0 2px #FB7185, inset 0 0 ${Math.round(size * 0.10)}px #E11D4866, ` +
                `0 0 6px #E11D48CC, 0 0 ${Math.round(size * 0.10)}px #E11D4899, 0 0 ${Math.round(size * 0.22)}px #E11D484D`
              : `inset 0 0 0 2px #FBBF24, inset 0 0 ${Math.round(size * 0.10)}px #F59E0B66, ` +
                `0 0 6px #F59E0BCC, 0 0 ${Math.round(size * 0.10)}px #F59E0B99, 0 0 ${Math.round(size * 0.22)}px #F59E0B4D`,
            animation: "cf-neon 2.8s ease-in-out infinite",
            willChange: "opacity",
          }}
        />
      )}
      {/* ── ART ───────────────────────────────────────────────────────────
          flex:1 with min-height:0 so every row the panel drops hands its
          height back to the picture instead of leaving a gap. */}
      <div style={{
        position: "relative", flex: 1, minHeight: 0, overflow: "hidden",
        // A fallen card goes GREY — the colour drains out of the picture while
        // the tape (below) stays loud on top of it. Static filter, no repaint
        // cost beyond the first.
        filter: hibernating && owned ? "grayscale(0.85) brightness(0.82)" : undefined,
      }}>
        <svg
          viewBox="0 0 100 87"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: dim ? 0.38 : 1 }}
        >
          <defs>
            <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={dim ? "#101014" : `hsl(${h} 58% 24%)`} />
              <stop offset="60%" stopColor={dim ? "#0b0b0f" : `hsl(${(h + 18) % 360} 52% 12%)`} />
              <stop offset="100%" stopColor={dim ? "#08080b" : `hsl(${(h + 40) % 360} 46% 7%)`} />
            </linearGradient>
            <radialGradient id={`bloom-${uid}`} cx="50%" cy="72%" r="62%">
              <stop offset="0%" stopColor={dim ? "#1a1a22" : `hsl(${h} 72% 46%)`} stopOpacity={dim ? 0.5 : 0.72} />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            {/* Consumed by the eye, scroll and trench motifs. An SVG paint
                reference that resolves to nothing fails silently — the shape
                just renders unfilled — so this has to travel with them. */}
            <radialGradient id={`irisGrad-${uid}`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor={dim ? "#2a2a32" : `hsl(${h} 95% 72%)`} />
              <stop offset="70%" stopColor={dim ? "#1c1c22" : `hsl(${h} 80% 40%)`} />
              <stop offset="100%" stopColor="#05040a" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="100" height="87" fill={`url(#sky-${uid})`} />
          <rect x="0" y="0" width="100" height="87" fill={`url(#bloom-${uid})`} />
          {/* The motif's own coordinate space is 100x87, so it finally draws
              at its true proportions — the old wrapper stretched it by
              scale(0.95, 1.16), turning every circle into an ellipse. */}
          <Motif card={card} dim={dim} />
        </svg>

        {/* Painted art, over the drawn art. If the file 404s this paints
            nothing and the motif underneath is what you see — the failure is
            unreachable rather than handled. */}
        {/* FIRST PAINT. A 14px version of the same painting, inlined in the
            bundle and blurred up. It is on screen before any request is made,
            so the card starts as a soft version of its own art rather than as
            the drawn motif — the real image then resolves on top of it and the
            visible swap you noticed on a cold load disappears.
            Scaled past the edges because a blur samples past its own bounds
            and would otherwise show a pale rim. */}
        {owned && painted && CARD_BLUR[card.id] && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${CARD_BLUR[card.id]})`,
              backgroundSize: "cover",
              backgroundPosition: "50% 50%",
              filter: "blur(10px)",
              transform: "scale(1.12)",
            }}
          />
        )}

        {owned && painted && (
          <img
            src={painted}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 50%",
            }}
          />
        )}

        {/* ── LIVE TREATMENTS ── only on cards big enough to read them, and
            only when owned. Both are transform/opacity keyframes on a single
            promoted layer, so a grid of them costs the compositor and nothing
            else. Reduced Motion stops them dead via the media query below. */}
        {owned && size >= 110 && (card.rarity === "legendary" || foil) && (
          <style
            dangerouslySetInnerHTML={{
              __html: `
@keyframes cf-glint { 0% { transform: translate3d(-150%,0,0) skewX(-14deg); } 46% { transform: translate3d(160%,0,0) skewX(-14deg); } 100% { transform: translate3d(160%,0,0) skewX(-14deg); } }
@keyframes cf-breathe { 0%,100% { opacity:.30 } 50% { opacity:.75 } }
@keyframes cf-neon { 0%,100% { opacity:.8 } 50% { opacity:1 } }
@keyframes cf-maxflick { 0%,100% { opacity:1 } 6% { opacity:.55 } 8% { opacity:1 } 44% { opacity:1 } 46% { opacity:.8 } 47% { opacity:1 } 72% { opacity:1 } 73% { opacity:.6 } 75% { opacity:1 } }
@keyframes cf-rift { 0%, 100% { transform: scaleX(1) scaleY(.96); opacity: .55; } 45% { transform: scaleX(3.2) scaleY(1); opacity: 1; } 55% { transform: scaleX(2.6) scaleY(1); opacity: .95; } }
@keyframes cf-riftring { 0% { transform: scale(.2); opacity: 0; } 42% { opacity: 0; } 48% { opacity: .8; } 100% { transform: scale(2.1); opacity: 0; } }
@keyframes cf-mythember { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-120px); opacity: 0; } }
@keyframes cf-rgb { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .cf-anim { animation: none !important; } }
`,
            }}
          />
        )}

        {/* A legendary breathes. One slow inner glow in the rarity's own
            colour — enough that a legendary in a grid of commons catches the
            eye without adding a frame back. */}
        {owned && size >= 110 && (card.rarity === "legendary" || card.rarity === "mythic") && (
          <span
            aria-hidden
            className="cf-anim"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              boxShadow: `inset 0 0 ${Math.round(size * 0.16)}px ${F.accent}55`,
              animation: "cf-breathe 3.6s ease-in-out infinite",
              willChange: "opacity",
            }}
          />
        )}
        {/* ── MYTHIC ALONE moves differently — and NOT like foil. No sweep:
            a vertical RIFT breathes open down the middle of the painting
            (a crack of light pulsing wide and narrow), a heartbeat ring
            blooms off it, and embers rise. All cf-anim (killed by
            reduced-motion and Performance Mode), transform/opacity only. */}
        {owned && size >= 96 && card.rarity === "mythic" && (
          <>
            {/* the rift — a living crack, not a passing shine */}
            <span aria-hidden className="cf-anim" style={{
              position: "absolute", top: "8%", bottom: "8%", left: "50%",
              width: 2, marginLeft: -1,
              background: "linear-gradient(180deg, transparent, #fff 22%, #fb7185 50%, #fff 78%, transparent)",
              boxShadow: "0 0 8px #e11d48, 0 0 18px #e11d48",
              animation: "cf-rift 3.2s ease-in-out infinite",
              willChange: "transform, opacity", pointerEvents: "none",
            }} />
            {/* the heartbeat — a ring blooming off the rift on the beat */}
            <span aria-hidden className="cf-anim" style={{
              position: "absolute", left: "50%", top: "50%",
              width: Math.round(size * 0.5), height: Math.round(size * 0.5),
              marginLeft: -Math.round(size * 0.25), marginTop: -Math.round(size * 0.25),
              borderRadius: 999, border: "1.5px solid rgba(251,113,133,.8)",
              animation: "cf-riftring 3.2s ease-out infinite",
              willChange: "transform, opacity", pointerEvents: "none",
            }} />
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} aria-hidden className="cf-anim" style={{
                position: "absolute", bottom: 0, left: `${12 + i * 18}%`,
                width: 3, height: 3, borderRadius: 99,
                background: i % 2 ? "#fda4af" : "#fbbf24",
                boxShadow: "0 0 6px #e11d48",
                animation: `cf-mythember ${2.8 + (i % 3) * 0.9}s linear infinite`,
                animationDelay: `${i * 0.55}s`,
                willChange: "transform, opacity", pointerEvents: "none",
              }} />
            ))}
          </>
        )}

        {/* Foil catches the light — it doesn't scan. The old band was a
            hard-edged colour bar marching back and forth on a metronome,
            which reads as a barcode scanner. This is a WIDE, white-cored
            glint with only hue FRINGES, tilted like a real reflection, that
            crosses once and then RESTS for half the cycle — light caught,
            not light performed. Same compositor-only cost: one transform. */}
        {owned && size >= 110 && foil && (
          <span
            aria-hidden
            style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
          >
            <span
              className="cf-anim"
              style={{
                position: "absolute",
                top: "-10%",
                bottom: "-10%",
                width: "62%",
                background:
                  "linear-gradient(105deg, transparent 0%, rgba(255,255,255,.04) 30%, rgba(125,211,252,.09) 41%, rgba(255,255,255,.17) 50%, rgba(240,171,252,.09) 59%, rgba(255,255,255,.04) 70%, transparent 100%)",
                animation: "cf-glint 5.6s cubic-bezier(.35,0,.25,1) infinite",
                willChange: "transform",
              }}
            />
          </span>
        )}

        {/* ── WEAR, WORN ── the print's condition on its face, per the
            owner's canon. RUSTED: a handmade original that time got to —
            corrosion blooming from corners and edges, multiplied into the
            art, with a dark oxidised vignette. FACTORY NEW: a machine
            replica — a crisp cool gloss and a sterile clean edge, brand new
            and a little soulless. FRESH BUILD: deliberately NOTHING — the
            untouched card IS the mark of the hand that made it. All static
            gradients; nothing animates, nothing repaints. */}
        {owned && size >= 96 && wear === "rusted" && (
          <>
            <span aria-hidden style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              mixBlendMode: "multiply",
              background:
                "radial-gradient(40% 28% at 6% 4%, rgba(146,64,14,.6), transparent 70%)," +
                "radial-gradient(34% 24% at 97% 90%, rgba(120,53,15,.65), transparent 70%)," +
                "radial-gradient(20% 14% at 90% 10%, rgba(154,52,18,.45), transparent 70%)," +
                "radial-gradient(24% 18% at 10% 94%, rgba(146,64,14,.5), transparent 70%)," +
                "radial-gradient(10% 7% at 55% 3%, rgba(120,53,15,.4), transparent 70%)",
            }} />
            <span aria-hidden style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              boxShadow: `inset 0 0 ${Math.max(8, Math.round(size * 0.14))}px rgba(69,26,3,.55)`,
              backgroundImage:
                "radial-gradient(2px 2px at 22% 30%, rgba(154,52,18,.5), transparent 60%)," +
                "radial-gradient(2px 3px at 70% 55%, rgba(146,64,14,.45), transparent 60%)," +
                "radial-gradient(3px 2px at 38% 78%, rgba(120,53,15,.5), transparent 60%)," +
                "radial-gradient(2px 2px at 82% 26%, rgba(154,52,18,.4), transparent 60%)",
            }} />
          </>
        )}
        {owned && size >= 96 && wear === "factory" && (
          <span aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            boxShadow: "inset 0 0 0 1px rgba(226,240,255,.30)",
            background: "linear-gradient(168deg, rgba(226,240,255,.10), rgba(226,240,255,.03) 24%, transparent 40%)",
          }} />
        )}

        {/* Foil as PRINTED STOCK, not as a specular highlight. The stripe
            period is constant device pixels, so it stays a texture at 84px
            instead of becoming a band at 300px — a sweep with a bright core
            is exactly the curved-surface read being removed. */}
        {foil && owned && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              mixBlendMode: "overlay",
              opacity: 0.26,
              backgroundImage:
                "repeating-linear-gradient(115deg, rgba(125,211,252,.10) 0 3px, rgba(240,171,252,.10) 3px 6px, rgba(253,230,138,.10) 6px 9px, transparent 9px 14px)",
            }}
          />
        )}

        {/* ── FALLEN: CRIME-SCENE TAPE ── the card is a scene now, greyed by
            the filter on this container while two caution tapes wrap across
            it. They run past both edges (the overflow clip cuts them at the
            border, which is what sells "wrapped around" rather than "printed
            on"), crossing at opposite angles like a real cordon. */}
        {hibernating && owned && (
          <>
            <span aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(8,12,22,0.38)" }} />
            {[
              { rot: -9, top: "36%" },
              { rot: 7, top: "55%" },
            ].map((b, i) => (
              <span
                key={i}
                aria-hidden={i > 0}
                style={{
                  position: "absolute",
                  left: "-16%",
                  right: "-16%",
                  top: b.top,
                  transform: `rotate(${b.rot}deg)`,
                  background: "#eab308",
                  color: "#111827",
                  borderTop: `${Math.max(1, Math.round(size * 0.011))}px solid #111827`,
                  borderBottom: `${Math.max(1, Math.round(size * 0.011))}px solid #111827`,
                  padding: `${Math.max(1, Math.round(size * 0.014))}px 0`,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: Math.max(6, Math.round(size * 0.048)),
                  letterSpacing: "0.13em",
                  lineHeight: 1.25,
                  boxShadow: "0 3px 10px rgba(0,0,0,.55)",
                }}
              >
                {"FALLEN · BUT NOT DEAD · ".repeat(4)}
              </span>
            ))}
          </>
        )}

        {/* The scrim's last stop is the panel's exact colour, so at the meeting
            line the two surfaces are identical and no edge can exist. A rule
            there would turn one object into two rectangles — the same claim a
            bevel makes, restated in a single pixel. */}
        {panel && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              height: "34%",
              background: `linear-gradient(to bottom, rgba(14,14,19,0) 0%, rgba(14,14,19,.55) 55%, ${surface} 100%)`,
            }}
          />
        )}

        {/* ── THE FUSION MARK ── the five legendaries the machine accepts
            wear a small crimson seal on their right edge, everywhere they
            render — so "which cards can synthesize" is readable at a
            glance, owned or not. Display-only mirror of FUSION_ELIGIBLE. */}
        {FUSABLE.has(card.id) && size >= 96 && (
          <span
            aria-label="Fusion-eligible"
            style={{
              position: "absolute",
              top: Math.round(size * 0.16),
              right: -3,
              zIndex: 7,
              transform: "rotate(9deg)",
              padding: "1px 6px",
              fontSize: Math.max(7, Math.round(size * 0.048)),
              fontWeight: 900,
              letterSpacing: "0.16em",
              color: "#ffe4e6",
              background: "rgba(24,3,8,.8)",
              border: "1px solid #fb7185",
              borderRadius: 5,
              textShadow: "0 0 5px #e11d48, 0 0 11px #e11d48",
              boxShadow: "0 0 8px rgba(225,29,72,.7), inset 0 0 6px rgba(225,29,72,.35)",
            }}
          >
            ⚗ FUSES
          </span>
        )}

        {/* ── THE MAX SIGN ── a neon tube hung slightly crooked off the top
            edge, flickering the way real neon does. Only on cards with every
            dial at the top — see `maxed` above. */}
        {maxed && size >= 76 && (
          <span
            aria-label="Fully maxed"
            style={{
              position: "absolute",
              top: Math.round(size * 0.16),
              left: -3,
              zIndex: 7,
              transform: "rotate(-9deg)",
              padding: "1px 7px",
              fontSize: Math.max(8, Math.round(size * 0.055)),
              fontWeight: 900,
              letterSpacing: "0.18em",
              fontStyle: "italic",
              color: "#eafdff",
              background: "rgba(3,18,22,.78)",
              border: "1px solid #22d3ee",
              borderRadius: 5,
              textShadow: "0 0 5px #22d3ee, 0 0 12px #22d3ee, 0 0 24px #0891b2",
              boxShadow: "0 0 9px rgba(34,211,238,.85), inset 0 0 7px rgba(34,211,238,.4)",
              animation: "cf-maxflick 2.8s linear infinite",
            }}
          >
            MAX
          </span>
        )}

        {/* rarity / grade / support, as bare type on a soft plate. A MYTHIC
            plate is a neon tube with one BIG star sigil — the tier announces
            itself before the stats do. */}
        {size >= 76 && (
          <span
            className={card.rarity === "mythic" && !dim ? "cf-anim" : undefined}
            style={{
              position: "absolute",
              left: T.pad,
              top: T.pad,
              padding: `${Math.round(T.micro * 0.34)}px ${Math.round(T.micro * 0.72)}px`,
              borderRadius: 999,
              background: card.rarity === "mythic" ? "rgba(20,2,8,0.8)" : "rgba(8,8,11,0.62)",
              color: dim ? "#52525B" : card.rarity === "mythic" ? "#ffe4e6" : F.accent,
              // BIG for a mythic — the tier is the headline, and the RGB
              // cycle (a hue-rotate over the crimson neon) runs the whole
              // plate through the spectrum. cf-anim, so Performance Mode
              // and reduced-motion pin it back to still crimson.
              fontSize: card.rarity === "mythic" ? Math.round(T.micro * 1.45) : T.micro,
              fontWeight: card.rarity === "mythic" ? 900 : 600,
              letterSpacing: card.rarity === "mythic" ? "0.18em" : "0.10em",
              lineHeight: 1.4,
              ...(card.rarity === "mythic" && !dim ? {
                border: "1px solid #fb7185",
                textShadow: "0 0 6px #e11d48, 0 0 14px #e11d48, 0 0 26px #9f1239",
                boxShadow: "0 0 12px rgba(225,29,72,.8), inset 0 0 7px rgba(225,29,72,.4)",
                animation: "cf-rgb 5s linear infinite",
                willChange: "filter",
              } : {}),
              ...clip,
              maxWidth: "80%",
            }}
          >
            {card.rarity === "mythic" && !dim && (
              <span style={{ fontSize: "1.5em", verticalAlign: "-0.12em", marginRight: 3, color: "#fb7185" }}>★</span>
            )}
            {card.support ? "SUPPORT" : (card.gradeLabel ?? R.label).toUpperCase()}
          </span>
        )}

        {chrome && foil && owned && (
          <span
            style={{
              position: "absolute",
              right: T.pad,
              top: T.pad,
              fontSize: T.micro,
              fontWeight: 700,
              letterSpacing: "0.14em",
              backgroundImage: "linear-gradient(115deg,#7DD3FC,#F0ABFC,#FDE68A)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            FOIL
          </span>
        )}
      </div>

      {/* ── PANEL ─────────────────────────────────────────────────────────
          flex:0 0 auto and a max-height, with NO min-height on any row. Rows
          size from line-height alone; when there isn't room, a row is dropped
          rather than squeezed. */}
      {panel && (
        <div
          style={{
            flex: "0 0 auto",
            maxHeight: "42%",
            overflow: "hidden",
            padding: `${Math.round(T.pad * 0.75)}px ${T.pad}px ${Math.round(T.pad * 0.75)}px`,
            display: "flex",
            flexDirection: "column",
            gap: T.gap,
            background: surface,
          }}
        >
          {/* R1 — name, and the duplicate count where a card id would go */}
          <div style={{ display: "flex", alignItems: "baseline", gap: T.gap }}>
            <span style={{ ...clip, flex: 1, fontSize: T.name, fontWeight: 700, letterSpacing: "-0.01em", color: ink }}>
              {owned ? card.name : "???"}
            </span>
            {chrome && (
              <span style={{ fontSize: T.slot, fontWeight: 500, fontFamily: MONO, color: muted, flexShrink: 0 }}>
                {!owned ? "—" : count > 1 ? `×${Math.min(count, 99)}` : ""}
              </span>
            )}
          </div>

          {/* R2 — the meter that replaces the stars, and the set code.
              Filled segments read pre-attentively: one bar versus four lands
              without counting, which one star versus four never did. */}
          <div style={{ display: "flex", alignItems: "center", gap: T.gap }}>
            <span style={{ display: "flex", gap: T.segH, flex: 1 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={{
                    width: T.segW,
                    height: T.segH,
                    borderRadius: 1,
                    background: dim
                      ? "#3F3F46"
                      : i < F.segs
                      ? F.meter
                      : "rgba(255,255,255,0.10)",
                  }}
                />
              ))}
            </span>
            {chrome && (
              <span style={{ ...clip, fontSize: T.micro, fontWeight: 600, letterSpacing: "0.10em", fontFamily: MONO, color: muted, flexShrink: 0 }}>
                {card.set.toUpperCase()}
              </span>
            )}
          </div>

          {/* R3 — what it does in a fight. Support cards have no attack or
              health and printing 0/0 would be a lie, so they skip this. */}
          {showStats && !card.support && (
            <div style={{ display: "flex", gap: T.gap, alignItems: "center" }}>
              <Stat glyph="⚔" value={owned ? atk : "—"} tone={dim ? "#3F3F46" : "#F87171"}
                bg={pillBg} h={T.pillH} fs={T.stat} chrome={chrome} />
              <Stat glyph="♥" value={owned ? hp : "—"} tone={dim ? "#3F3F46" : hpTone}
                bg={pillBg} h={T.pillH} fs={T.stat} chrome={chrome} />
            </div>
          )}

          {/* R4 — the line the reference is built around. flavor was declared
              on every card and rendered nowhere until now. */}
          {roomy && (
            <span
              style={{
                ...clip,
                fontSize: T.ability,
                fontFamily: MONO,
                color: hibernating && owned ? "#FBBF24" : muted,
              }}
              title={owned ? abilityText : undefined}
            >
              {owned ? abilityText : "—"}
            </span>
          )}

          {/* R5 — live health, mid-duel. A labelled track with the real
              numbers is strictly more than a coloured circle was. */}
          {typeof liveHp === "number" && owned && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: Math.round(T.segH * 0.8) }}>
                <span style={{ fontSize: T.micro, fontWeight: 600, letterSpacing: "0.18em", color: "#52525B" }}>HP</span>
                <span style={{ fontSize: T.micro, fontWeight: 500, fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: "#A1A1AA" }}>
                  {Math.max(0, hp)}/{maxHp}
                </span>
              </div>
              <div style={{ height: T.track, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))}%`, background: hpTone }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One stat readout. Loses its plate below 96px and becomes a bare glyph and
 *  number, which is all that fits and all that is needed. */
function Stat({
  glyph, value, tone, bg, h, fs, chrome,
}: {
  glyph: string; value: number | string; tone: string; bg: string;
  h: number; fs: number; chrome: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(fs * 0.34),
        height: chrome ? h : "auto",
        padding: chrome ? `0 ${Math.round(fs * 0.55)}px` : 0,
        borderRadius: 999,
        background: bg,
        fontSize: fs,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: tone,
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: Math.round(fs * 1.1) }}>{glyph}</span>
      {value}
    </span>
  );
}

/**
 * Memoised on purpose. Each card is a 20-40 node SVG scene, and the arena
 * renders ~10 of them while polling every few seconds — without this, every
 * poll re-rendered every card's full artwork and the board crawled. The props
 * are all primitives plus a stable card object, so a shallow compare is exact.
 */
const CardFace = memo(CardFaceImpl);
export default CardFace;
