"use client";

import { ReactNode } from "react";

/**
 * GACHA UI KIT
 *
 * The card pages looked generic because every surface was the same shape: a
 * rounded rectangle with a soft gradient and a pill button. That is the default
 * of the styling framework, not a design, and it reads as such.
 *
 * The console-gacha look is built from a few specific, repeatable moves:
 *
 *  1. CUT CORNERS. Panels are clipped octagons or corner-notched rectangles,
 *     never uniform border-radius. This one change does most of the work.
 *  2. DOUBLE HAIRLINES. A metallic outer edge with a dark inset behind it,
 *     rather than a single 1px border.
 *  3. CORNER TICKS. Small L-marks at the panel corners that suggest a frame
 *     rather than a box.
 *  4. STARS, NOT WORDS. Rarity is a star count you can read without parsing.
 *  5. SEGMENTED METERS. Progress is notched into discrete cells.
 *  6. SLANTED TYPE FURNITURE. Skewed tabs and a diagonal accent beside every
 *     heading, with a small Latin subtitle under a heavier title.
 *
 * Everything here is presentational. No data, no fetching, no state.
 */

/** Corner-notched rectangle: top-right and bottom-left cut. The house shape. */
export function notch(size = 18) {
  return `polygon(0 0, calc(100% - ${size}px) 0, 100% ${size}px, 100% 100%, ${size}px 100%, 0 calc(100% - ${size}px))`;
}
/** Octagonal bevel — all four corners cut. Used for emphasis panels. */
export function bevel(size = 14) {
  return `polygon(${size}px 0, calc(100% - ${size}px) 0, 100% ${size}px, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, ${size}px 100%, 0 calc(100% - ${size}px), 0 ${size}px)`;
}

/**
 * The accent. Everything ornamental in the kit reads from these two tokens, so
 * repainting the whole card UI is a two-line change.
 */
export const ACCENT = "#a274ff";
export const ACCENT_LIT = "#e2d0ff";
export const ACCENT_DEEP = "#3b2168";

/** @deprecated Kept so older imports keep compiling; both point at the accent. */
export const GOLD = ACCENT;
export const GOLD_LIT = ACCENT_LIT;

/**
 * A framed panel. The metallic edge is a parent whose background shows through
 * a 1px gap around the clipped child — you cannot get a crisp double border on
 * a clipped shape with `border` alone, because the border is clipped too.
 */
export function Panel({
  children,
  tone = "ink",
  shape = "notch",
  size = 18,
  className = "",
  edge,
}: {
  children: ReactNode;
  tone?: "ink" | "gold" | "danger" | "jade";
  shape?: "notch" | "bevel";
  size?: number;
  className?: string;
  edge?: string;
}) {
  const clip = shape === "bevel" ? bevel(size) : notch(size);
  const edges: Record<string, string> = {
    ink: "linear-gradient(160deg, rgba(255,255,255,.22), rgba(255,255,255,.04) 40%, rgba(255,255,255,.14))",
    gold: `linear-gradient(160deg, ${ACCENT_LIT}, ${ACCENT} 35%, ${ACCENT_DEEP} 72%, ${ACCENT})`,
    danger: "linear-gradient(160deg, #ffb4b4, #e2453f 40%, #7a1f1c)",
    jade: "linear-gradient(160deg, #bff5e4, #34d0a2 40%, #14624c)",
  };
  return (
    <div className={`relative ${className}`} style={{ clipPath: clip, background: edge || edges[tone] }}>
      <div className="relative" style={{ clipPath: clip, margin: 1, background: "linear-gradient(165deg, #1a1230 0%, #110c20 55%, #0c0817 100%)" }}>
        {children}
      </div>
    </div>
  );
}

/** Small L-marks that make a rectangle read as a frame. */
export function CornerTicks({ color = ACCENT, inset = 6 }: { color?: string; inset?: number }) {
  const common = "pointer-events-none absolute h-3 w-3";
  return (
    <>
      <span className={`${common} border-l border-t`} style={{ left: inset, top: inset, borderColor: color, opacity: 0.75 }} />
      <span className={`${common} border-r border-t`} style={{ right: inset, top: inset, borderColor: color, opacity: 0.75 }} />
      <span className={`${common} border-b border-l`} style={{ left: inset, bottom: inset, borderColor: color, opacity: 0.75 }} />
      <span className={`${common} border-b border-r`} style={{ right: inset, bottom: inset, borderColor: color, opacity: 0.75 }} />
    </>
  );
}

/** Rarity as a star count. Event sits at the top because it is the only tier
 *  you cannot pull, craft or plan for. */
export const STARS: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 4, event: 5 };

export function Stars({ rarity, size = 12, className = "" }: { rarity: string; size?: number; className?: string }) {
  const n = STARS[rarity] ?? 1;
  const tint = rarity === "event" ? "#ff9ad5" : rarity === "legendary" ? "#ffcf5c" : rarity === "epic" ? "#c78bff" : rarity === "rare" ? "#6fc7ff" : "#9aa4b2";
  return (
    <span className={`inline-flex items-center gap-[1px] ${className}`} title={`${n} star`}>
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z"
            fill={tint} stroke="rgba(0,0,0,.55)" strokeWidth="1" />
        </svg>
      ))}
    </span>
  );
}

/** A notched meter. Discrete cells read as progress toward a countable goal —
 *  which is exactly what a set is — where a smooth bar reads as a percentage. */
export function SegBar({ value, max, tone = ACCENT, height = 7 }: { value: number; max: number; tone?: string; height?: number }) {
  const cells = Math.max(1, Math.min(max, 40));
  const filled = max > 0 ? Math.round((value / max) * cells) : 0;
  return (
    <div className="flex w-full items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className="h-full flex-1 transition-colors"
          style={{
            background: i < filled ? tone : "rgba(255,255,255,.07)",
            boxShadow: i < filled ? `0 0 6px ${tone}66` : "none",
            transform: "skewX(-18deg)",
          }} />
      ))}
    </div>
  );
}

/** Slanted action button. The skew is the whole point — a straight pill is the
 *  thing that made every control look identical. */
export function GachaButton({
  children, onClick, disabled, tone = "gold", title, className = "", type = "button",
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  tone?: "gold" | "jade" | "ghost" | "danger"; title?: string; className?: string;
  type?: "button" | "submit";
}) {
  const tones: Record<string, string> = {
    gold: "text-[#160b2b] [--g1:#d9c2ff] [--g2:#8b5cf6]",
    jade: "text-[#04231b] [--g1:#a9f2da] [--g2:#2fbf98]",
    danger: "text-[#2a0808] [--g1:#ffc0bd] [--g2:#e2453f]",
    ghost: "text-slate-200 [--g1:rgba(255,255,255,.16)] [--g2:rgba(255,255,255,.06)]",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`group relative inline-flex select-none items-center justify-center px-6 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-35 ${tones[tone]} ${className}`}
      style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
      <span aria-hidden className="absolute inset-0 -z-10"
        style={{ background: "linear-gradient(100deg, var(--g1), var(--g2))" }} />
      <span aria-hidden
        className="absolute inset-0 -z-10 translate-x-[-120%] opacity-0 transition-all duration-500 group-hover:translate-x-[120%] group-hover:opacity-100 group-disabled:hidden"
        style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent)" }} />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

/** Section heading: a slanted accent bar, a heavy title, and a small Latin
 *  subtitle under it. */
export function Heading({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex items-stretch gap-3">
        <span aria-hidden className="w-[6px] shrink-0" style={{ background: `linear-gradient(${ACCENT_LIT}, ${ACCENT})`, transform: "skewX(-14deg)" }} />
        <div>
          <h3 className="text-lg font-black uppercase tracking-[0.10em] text-white">{title}</h3>
          {sub && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: ACCENT }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** A stat line with a dotted leader — the density trick that makes a detail
 *  panel look like a game screen instead of a form. */
export function StatRow({ label, value, tint }: { label: string; value: ReactNode; tint?: string }) {
  return (
    <div className="flex items-baseline gap-2 py-[5px] text-[12px]">
      <span className="shrink-0 font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-white/15" />
      <span className="shrink-0 font-black tabular-nums" style={{ color: tint || "#e8e6ef" }}>{value}</span>
    </div>
  );
}

/** Rotated rail label down the side of a panel. */
export function SideLabel({ text, color = GOLD }: { text: string; color?: string }) {
  return (
    <span aria-hidden
      className="pointer-events-none absolute left-[-1px] top-1/2 origin-center -translate-y-1/2 -rotate-90 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.45em]"
      style={{ color, opacity: 0.5, transformOrigin: "center", left: -22 }}>
      {text}
    </span>
  );
}
