"use client";

/**
 * A collectible card, drawn entirely from a hue + rarity — no image assets.
 * The emblem is deterministic per card id, so a card always looks the same.
 */

export type CardRarity = "common" | "rare" | "epic" | "legendary" | "event";

export interface CardDef {
  id: string;
  name: string;
  rarity: CardRarity;
  set: string;
  hue: number;
  flavor: string;
}

export const RARITY_META: Record<CardRarity, { label: string; frame: string; gem: string; glow: string; order: number }> = {
  common:    { label: "Common",    frame: "#64748b", gem: "#94a3b8", glow: "rgba(148,163,184,0.35)", order: 0 },
  rare:      { label: "Rare",      frame: "#3b82f6", gem: "#60a5fa", glow: "rgba(59,130,246,0.45)",  order: 1 },
  epic:      { label: "Epic",      frame: "#a855f7", gem: "#c084fc", glow: "rgba(168,85,247,0.5)",   order: 2 },
  legendary: { label: "Legendary", frame: "#f59e0b", gem: "#fbbf24", glow: "rgba(245,158,11,0.6)",   order: 3 },
  event:     { label: "Event",     frame: "#ec4899", gem: "#f9a8d4", glow: "rgba(236,72,153,0.55)",  order: 4 },
};

// Cheap deterministic hash → 0..1, for stable per-card emblem geometry.
function seed01(str: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export default function CardFace({
  card,
  owned = true,
  count = 0,
  size = 190,
}: {
  card: CardDef;
  owned?: boolean;
  count?: number;
  size?: number;
}) {
  const R = RARITY_META[card.rarity];
  const h = card.hue;
  // Procedural emblem: a rosette of rays whose count/twist come from the id.
  const rays = 6 + Math.floor(seed01(card.id, 7) * 8);
  const twist = seed01(card.id, 3) * 40 - 20;
  const innerR = 14 + seed01(card.id, 11) * 8;

  const emblem: string[] = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (twist * Math.PI) / 180;
    const x1 = 50 + Math.cos(a) * innerR;
    const y1 = 50 + Math.sin(a) * innerR;
    const x2 = 50 + Math.cos(a) * 34;
    const y2 = 50 + Math.sin(a) * 34;
    emblem.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }

  return (
    <div
      className="relative select-none"
      style={{ width: size, aspectRatio: "5 / 7" }}
      title={owned ? `${card.name} — ${R.label}` : `${R.label} · not yet collected`}
    >
      <svg viewBox="0 0 100 140" className="h-full w-full" style={{ filter: owned ? `drop-shadow(0 6px 18px ${R.glow})` : "none" }}>
        <defs>
          <linearGradient id={`bg-${card.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`hsl(${h} 55% ${owned ? 22 : 8}%)`} />
            <stop offset="55%" stopColor={`hsl(${h} 45% ${owned ? 12 : 6}%)`} />
            <stop offset="100%" stopColor={`hsl(${(h + 30) % 360} 40% ${owned ? 8 : 4}%)`} />
          </linearGradient>
          <radialGradient id={`em-${card.id}`} cx="50%" cy="42%" r="50%">
            <stop offset="0%" stopColor={owned ? `hsl(${h} 90% 78%)` : "#33333a"} />
            <stop offset="100%" stopColor={owned ? `hsl(${h} 70% 45%)` : "#22222a"} />
          </radialGradient>
        </defs>

        {/* frame */}
        <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill={`url(#bg-${card.id})`} stroke={owned ? R.frame : "#2a2a32"} strokeWidth="2.5" />
        {/* art panel */}
        <rect x="7" y="9" width="86" height="78" rx="5" fill="rgba(0,0,0,0.35)" stroke={owned ? R.frame : "#2a2a32"} strokeOpacity="0.5" strokeWidth="1" />

        {/* emblem */}
        <g transform="translate(0,20)">
          <circle cx="50" cy="50" r="34" fill={`url(#em-${card.id})`} opacity={owned ? 0.28 : 0.15} />
          <path d={emblem.join(" ")} stroke={owned ? `hsl(${h} 85% 72%)` : "#3a3a44"} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity={owned ? 0.9 : 0.5} />
          <circle cx="50" cy="50" r={innerR - 4} fill="none" stroke={owned ? "#fff" : "#44444c"} strokeWidth="1" opacity={owned ? 0.7 : 0.4} />
          <circle cx="50" cy="50" r="2.6" fill={owned ? "#fff" : "#55555c"} />
        </g>

        {/* rarity gem */}
        <circle cx="88" cy="12" r="4" fill={owned ? R.gem : "#3a3a44"} stroke="#0b0b12" strokeWidth="1" />

        {/* name plate */}
        <rect x="7" y="95" width="86" height="18" rx="4" fill="rgba(0,0,0,0.55)" />
        <text x="50" y="106.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={owned ? "#f4f2f7" : "#5a5a64"} style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          {owned ? card.name : "???"}
        </text>

        {/* rarity label */}
        <text x="50" y="126" textAnchor="middle" fontSize="5.5" fontWeight="900" letterSpacing="1.5" fill={owned ? R.frame : "#44444c"} style={{ fontFamily: "ui-sans-serif, system-ui", textTransform: "uppercase" }}>
          {R.label}
        </text>
      </svg>

      {/* dupe count */}
      {owned && count > 1 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full border border-[#0b0b12] bg-white px-1.5 text-[11px] font-black text-black">
          ×{count}
        </span>
      )}
    </div>
  );
}
