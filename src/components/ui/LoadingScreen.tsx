"use client";

import { useEffect, useState } from "react";

/**
 * THE LOADING SCREEN — one waiting state for the whole site.
 *
 * The site's own mark, breathing inside a violet bloom with a thin arc
 * turning around it, over the mono "Loading…" the rest of the UI is set in.
 * It replaced a "DV" monogram once the site had a real logo: showing the
 * actual mark while you wait is what makes the wait feel like Da Vinci
 * rather than like a generic spinner.
 *
 * Everything animates transform and opacity only, in CSS rather than
 * framer, so a loading screen costs nothing while the real work happens —
 * and it keeps working under Performance Mode, which switches framer off.
 */
export default function LoadingScreen({
  message = "Loading",
  fullscreen = true,
}: {
  message?: string;
  fullscreen?: boolean;
}) {
  // After a beat, reassure the user that a slow load is usually the backend
  // waking up — not a hang.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3800);
    return () => clearTimeout(t);
  }, []);

  // Inline loaders sit in the page flow, so they must NOT carry the overlay
  // z-index or they paint over the navbar. They also stay transparent and
  // take the host page's own background.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`${
        fullscreen
          ? "fixed inset-0 z-[9998] bg-[#070709]"
          : "relative min-h-[60vh] w-full"
      } flex flex-col items-center justify-center overflow-hidden`}
    >
      {/* violet ambience */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(88,44,160,0.18)_0%,transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center">
        <span className="relative grid h-20 w-20 place-items-center">
          {/* the bloom */}
          <span
            aria-hidden
            className="dv-load-glow absolute inset-[-18%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,.34), transparent 68%)" }}
          />
          {/* the turning arc */}
          <span
            aria-hidden
            className="dv-load-ring absolute inset-0 rounded-full"
            style={{
              border: "2px solid transparent",
              borderTopColor: "rgba(167,139,250,.85)",
              borderRightColor: "rgba(167,139,250,.22)",
            }}
          />
          {/* the mark */}
          <img
            src="/logo.png"
            alt=""
            aria-hidden
            className="dv-load-mark relative h-12 w-12 rounded-full object-cover"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.14)" }}
          />
        </span>

        <p className="mt-7 font-mono text-sm tracking-[0.22em] text-slate-400">
          {message}
          <span className="dv-load-dots" aria-hidden />
        </p>

        {/* Cold-start reassurance — only if the load is genuinely slow. The
            height is reserved so its arrival doesn't shift the mark. */}
        <p
          className="mt-2 h-4 font-mono text-[11px] tracking-wide text-slate-600 transition-opacity duration-500"
          style={{ opacity: slow ? 1 : 0 }}
        >
          The server may be waking up — hang tight.
        </p>
      </div>

      <style jsx global>{`
        .dv-load-ring { animation: dvLoadSpin 1.1s linear infinite; }
        .dv-load-glow { animation: dvLoadGlow 2.4s ease-in-out infinite; }
        .dv-load-mark { animation: dvLoadMark 2.4s ease-in-out infinite; }
        .dv-load-dots::after { content: ""; animation: dvLoadDots 1.4s steps(1, end) infinite; }

        @keyframes dvLoadSpin { to { transform: rotate(360deg); } }
        @keyframes dvLoadGlow {
          0%, 100% { opacity: 0.45; transform: scale(0.92); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
        @keyframes dvLoadMark {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
        @keyframes dvLoadDots {
          0%   { content: ""; }
          25%  { content: "."; }
          50%  { content: ".."; }
          75%  { content: "..."; }
        }

        @media (prefers-reduced-motion: reduce) {
          .dv-load-ring, .dv-load-glow, .dv-load-mark, .dv-load-dots::after { animation: none; }
          .dv-load-dots::after { content: "..."; }
        }
        body.reduced-motion .dv-load-ring,
        body.reduced-motion .dv-load-glow,
        body.reduced-motion .dv-load-mark,
        body.reduced-motion .dv-load-dots::after { animation: none; }
      `}</style>
    </div>
  );
}

/**
 * The same idea at button/row scale, for places where a centred block would
 * be absurd — a submit button, a table row, a card corner. Inherits the
 * current text colour so it sits on any button.
 */
export function LoadingDot({ className = "" }: { className?: string }) {
  return (
    <>
      <span
        role="status"
        aria-busy="true"
        className={`dv-load-ring inline-block h-4 w-4 shrink-0 rounded-full align-[-2px] ${className}`}
        style={{
          border: "2px solid transparent",
          borderTopColor: "currentColor",
          borderRightColor: "rgba(255,255,255,.25)",
        }}
      >
        <span className="sr-only">Loading</span>
      </span>
      {/* Carries its own keyframes: a dot is usually shown with no
          LoadingScreen anywhere on the page, and the rule lives in that
          component's style block. */}
      <style jsx global>{`
        .dv-load-ring { animation: dvLoadSpin 1.1s linear infinite; }
        @keyframes dvLoadSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .dv-load-ring { animation: none; } }
        body.reduced-motion .dv-load-ring { animation: none; }
      `}</style>
    </>
  );
}
