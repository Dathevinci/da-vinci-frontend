"use client";

/**
 * The featured novel's purple dress — keyframes plus the aura layers, shared
 * by the Must Read spotlight and the novel detail page so the effect cannot
 * drift between the two surfaces.
 *
 * PURE CSS ON TRANSFORM/OPACITY ONLY: no canvas, no framer, no per-frame JS.
 * The aura is compositor work, not a render loop, and prefers-reduced-motion
 * stills every animation. Class names are prefixed `sps-` because the style
 * tag is global — styled-jsx is deliberately not used here, since its template
 * literal silently terminates on a backtick in a comment, a trap this repo has
 * already paid for twice.
 */
export function PurpleAuraStyles() {
  return (
    <style>{`
      @keyframes sps-aura {
        0%, 100% { transform: scale(1); opacity: 0.55; }
        50% { transform: scale(1.12); opacity: 0.9; }
      }
      @keyframes sps-ring {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes sps-ember {
        0% { transform: translateY(0) scale(1); opacity: 0; }
        12% { opacity: 0.9; }
        100% { transform: translateY(-90px) scale(0.4); opacity: 0; }
      }
      @keyframes sps-flicker {
        0%, 86%, 92%, 100% { opacity: 0; }
        88%, 90% { opacity: 0.5; }
      }
      @keyframes sps-sheen {
        0%, 55%, 100% { transform: translateX(-130%) skewX(-18deg); }
        70%, 85% { transform: translateX(230%) skewX(-18deg); }
      }
      .sps-aura { animation: sps-aura 4.5s ease-in-out infinite; }
      .sps-aura2 { animation: sps-aura 6s ease-in-out infinite reverse; }
      .sps-ring { animation: sps-ring 9s linear infinite; }
      .sps-ember { animation: sps-ember 5s ease-out infinite; }
      .sps-flicker { animation: sps-flicker 7s linear infinite; }
      .sps-sheen { animation: sps-sheen 8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .sps-aura, .sps-aura2, .sps-ring, .sps-ember, .sps-flicker, .sps-sheen { animation: none; }
      }
    `}</style>
  );
}

/** The two breathing plumes that sit BEHIND the cover. */
export function AuraPlumes() {
  return (
    <>
      <div className="sps-aura pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.55),rgba(126,34,206,0.25)_55%,transparent_75%)] blur-2xl" />
      <div className="sps-aura2 pointer-events-none absolute -inset-12 rounded-full bg-[radial-gradient(closest-side,rgba(216,180,254,0.28),transparent_70%)] blur-3xl" />
    </>
  );
}

/** The rotating conic neon rim; wrap around the cover frame. */
export function AuraRing() {
  return (
    <div className="pointer-events-none absolute -inset-[3px] overflow-hidden rounded-2xl">
      <div className="sps-ring absolute -inset-16 bg-[conic-gradient(from_0deg,transparent_0%,rgba(192,132,252,0.9)_12%,transparent_28%,transparent_55%,rgba(147,51,234,0.8)_68%,transparent_82%)]" />
    </div>
  );
}

/** Lightning wash + sheen; place INSIDE the cover's overflow-hidden frame. */
export function AuraOverlays() {
  return (
    <>
      <div className="sps-flicker pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(216,180,254,0.55)_48%,rgba(147,51,234,0.35)_52%,transparent_70%)] mix-blend-screen" />
      <div className="sps-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent mix-blend-screen" />
    </>
  );
}

const EMBERS: Array<[string, string, string]> = [
  ["8%", "0s", "4px"],
  ["24%", "1.4s", "3px"],
  ["78%", "0.6s", "5px"],
  ["90%", "2.2s", "3px"],
  ["50%", "3.1s", "4px"],
];

/** Violet embers drifting up; position relative to the cover's wrapper. */
export function AuraEmbers() {
  return (
    <>
      {EMBERS.map(([left, delay, size], i) => (
        <span
          key={i}
          className="sps-ember pointer-events-none absolute bottom-2 rounded-full bg-purple-300"
          style={{ left, width: size, height: size, animationDelay: delay, boxShadow: "0 0 8px rgba(192,132,252,0.9)" }}
        />
      ))}
    </>
  );
}
