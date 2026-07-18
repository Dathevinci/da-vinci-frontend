"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Bright amethyst-silver fill so the monogram stays legible on near-black.
const AMETHYST_TEXT: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(100deg, #a78bfa 0%, #ddd6fe 25%, #ffffff 50%, #ddd6fe 75%, #a78bfa 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/**
 * Branded loading screen — used both as the App Router Suspense fallback
 * (server-render waits / cold starts) and inline for client data fetches.
 */
export default function LoadingScreen({
  message = "Loading",
  fullscreen = true,
}: {
  message?: string;
  fullscreen?: boolean;
}) {
  // After a beat, reassure the user that a slow load is usually the free-tier
  // backend waking up — not a hang.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`${fullscreen ? "fixed inset-0" : "relative min-h-[60vh] w-full"} z-[9998] flex flex-col items-center justify-center overflow-hidden bg-[#050505]`}
    >
      {/* Violet ambience */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(88,44,160,0.18)_0%,transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Counter-rotating rings around a pulsing monogram */}
        <div className="relative h-20 w-20">
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-violet-300/10 border-t-violet-300/80"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            className="absolute inset-[7px] rounded-full border-2 border-fuchsia-300/10 border-b-fuchsia-400/70"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.7, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            className="absolute inset-0 grid place-items-center font-fell text-xl font-bold tracking-wider"
            style={AMETHYST_TEXT}
            animate={{ opacity: [0.55, 1, 0.55], scale: [0.94, 1, 0.94] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          >
            DV
          </motion.span>
        </div>

        {/* Message */}
        <motion.p
          className="mt-7 font-garamond text-sm uppercase italic tracking-[0.28em] text-violet-100/70"
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        >
          {message}
        </motion.p>

        {/* Cold-start reassurance (fades in only if the load is genuinely slow) */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={slow ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-2 h-4 text-[11px] tracking-wide text-slate-500"
        >
          {slow ? "The server may be waking up — hang tight." : ""}
        </motion.p>
      </div>
    </div>
  );
}
