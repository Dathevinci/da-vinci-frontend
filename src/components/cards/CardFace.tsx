"use client";

/**
 * ARISE CARD ART — every card drawn procedurally, no image assets.
 *
 * Each card carries a `motif` that selects a genuinely different SCENE (an eye,
 * a mountain, a gate, a drowning sea…), and a `hue` that recolours it. That
 * combination is what stops 21 cards looking like 21 recolours of one shape.
 *
 * Layers, back to front: sky gradient → depth haze → the motif → foreground
 * grain/particles → inner border → foil sheen (if foil) → frame + plate.
 */

export type CardRarity = "common" | "rare" | "epic" | "legendary" | "event";
export type CardMotif =
  | "eye" | "wheel" | "tendril" | "peak" | "lotus" | "storm" | "gate"
  | "ember" | "moth" | "ripple" | "seed" | "scroll" | "path" | "seal"
  | "heart" | "sea" | "dawn" | "web";

export interface CardDef {
  id: string;
  name: string;
  rarity: CardRarity;
  set: string;
  hue: number;
  motif: CardMotif;
  flavor: string;
}

export const RARITY_META: Record<CardRarity, { label: string; frame: string; gem: string; glow: string; order: number }> = {
  common:    { label: "Common",    frame: "#7c8598", gem: "#aab4c4", glow: "rgba(148,163,184,0.30)", order: 0 },
  rare:      { label: "Rare",      frame: "#3b82f6", gem: "#7dd3fc", glow: "rgba(59,130,246,0.45)",  order: 1 },
  epic:      { label: "Epic",      frame: "#a855f7", gem: "#d8b4fe", glow: "rgba(168,85,247,0.55)",  order: 2 },
  legendary: { label: "Legendary", frame: "#f59e0b", gem: "#fde68a", glow: "rgba(245,158,11,0.65)",  order: 3 },
  event:     { label: "Event",     frame: "#ec4899", gem: "#f9a8d4", glow: "rgba(236,72,153,0.60)",  order: 4 },
};

// Deterministic per-card pseudo-random so a card always looks identical.
function rnd(id: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h ^ id.charCodeAt(i), 2246822519) + 1) >>> 0;
  return (h % 10000) / 10000;
}

/** The scene. Drawn on a 100x86 art panel starting at y=0. */
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

    default:
      return <circle cx="50" cy="44" r="20" fill={mid} opacity={O} />;
  }
}

export default function CardFace({
  card,
  owned = true,
  count = 0,
  foil = false,
  size = 190,
}: {
  card: CardDef;
  owned?: boolean;
  count?: number;
  foil?: boolean;
  size?: number;
}) {
  const R = RARITY_META[card.rarity];
  const h = card.hue;
  const dim = !owned;
  const uid = card.id;

  return (
    <div className="relative select-none" style={{ width: size, aspectRatio: "5 / 7" }}
      title={owned ? `${card.name} — ${R.label}${foil ? " (Foil)" : ""}` : `${R.label} · not yet collected`}>
      <svg viewBox="0 0 100 140" className="h-full w-full"
        style={{ filter: owned ? `drop-shadow(0 8px 22px ${R.glow})` : "none" }}>
        <defs>
          <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dim ? "#101014" : `hsl(${h} 58% 24%)`} />
            <stop offset="60%" stopColor={dim ? "#0b0b0f" : `hsl(${(h + 18) % 360} 52% 12%)`} />
            <stop offset="100%" stopColor={dim ? "#08080b" : `hsl(${(h + 40) % 360} 46% 7%)`} />
          </linearGradient>
          <radialGradient id={`irisGrad-${uid}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={dim ? "#2a2a32" : `hsl(${h} 95% 72%)`} />
            <stop offset="70%" stopColor={dim ? "#1c1c22" : `hsl(${h} 80% 40%)`} />
            <stop offset="100%" stopColor="#05040a" />
          </radialGradient>
          <linearGradient id={`plate-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.75)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.75)" />
          </linearGradient>
          <linearGradient id={`foil-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="52%" stopColor="rgba(255,240,180,0.55)" />
            <stop offset="62%" stopColor="rgba(160,220,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            {foil && <animate attributeName="x1" values="-1;1" dur="3.5s" repeatCount="indefinite" />}
            {foil && <animate attributeName="x2" values="0;2" dur="3.5s" repeatCount="indefinite" />}
          </linearGradient>
          <clipPath id={`art-${uid}`}><rect x="7" y="9" width="86" height="78" rx="5" /></clipPath>
        </defs>

        {/* card body */}
        <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill={dim ? "#0a0a0e" : `hsl(${h} 30% 6%)`}
          stroke={dim ? "#26262e" : R.frame} strokeWidth="2.5" />

        {/* art panel */}
        <g clipPath={`url(#art-${uid})`}>
          <rect x="7" y="9" width="86" height="78" fill={`url(#sky-${uid})`} />
          <g transform="translate(7, 9) scale(0.86, 0.9)">
            <Motif card={card} dim={dim} />
          </g>
          {/* depth haze */}
          <rect x="7" y="9" width="86" height="78" fill={`url(#plate-${uid})`} opacity="0.25" />
          {foil && <rect x="7" y="9" width="86" height="78" fill={`url(#foil-${uid})`} />}
        </g>
        <rect x="7" y="9" width="86" height="78" rx="5" fill="none"
          stroke={dim ? "#26262e" : R.frame} strokeOpacity="0.55" strokeWidth="1" />

        {/* rarity gem */}
        <circle cx="88.5" cy="12.5" r="4.2" fill={dim ? "#2a2a32" : R.gem} stroke="#07070c" strokeWidth="1" />
        {foil && <circle cx="88.5" cy="12.5" r="6.4" fill="none" stroke={R.gem} strokeWidth="0.7" opacity="0.7" />}

        {/* name plate */}
        <rect x="7" y="94" width="86" height="19" rx="4" fill="rgba(0,0,0,0.6)" stroke={dim ? "#1e1e26" : R.frame} strokeOpacity="0.3" strokeWidth="0.6" />
        <text x="50" y="106" textAnchor="middle" fontSize={card.name.length > 17 ? 6.2 : 7.4} fontWeight="800"
          fill={dim ? "#4a4a54" : "#f4f2f7"} style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          {owned ? card.name : "???"}
        </text>

        {/* rarity strip */}
        <text x="50" y="124" textAnchor="middle" fontSize="5.4" fontWeight="900" letterSpacing="1.6"
          fill={dim ? "#3a3a44" : R.frame} style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          {foil ? `FOIL ${R.label.toUpperCase()}` : R.label.toUpperCase()}
        </text>
        <text x="50" y="132.5" textAnchor="middle" fontSize="4.2" fontWeight="700" letterSpacing="0.8"
          fill={dim ? "#2e2e36" : "#8b8b9a"} style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          {card.set.toUpperCase()}
        </text>
      </svg>

      {count > 1 && owned && (
        <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-[#0b0b12] bg-white px-1.5 text-[11px] font-black text-black">
          ×{count}
        </span>
      )}
    </div>
  );
}
