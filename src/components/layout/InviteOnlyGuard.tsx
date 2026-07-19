"use client";

import { useUser } from "@/hooks/useUser";
import { useState } from "react";
import LoginModal from "@/components/layout/LoginModal";
import { Lock, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Shared amethyst-purple text fill, matching the splash wordmark + site theme.
const AMETHYST: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(100deg, #6d28d9 0%, #a78bfa 18%, #f5f3ff 32%, #c4b5fd 46%, #8b5cf6 62%, #a78bfa 82%, #6d28d9 100%)",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const easeCine: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function InviteOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [showLogin, setShowLogin] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-violet-300/20 border-t-violet-300/80 rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden text-white p-4 selection:bg-violet-500/20">
        {/* Violet ambience + edge vignette (no generic floating blobs) */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_35%,rgba(88,44,160,0.20)_0%,transparent_55%)]" />
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,#050505_100%)]" />

        {/* Faint concentric geometry — a nod to da Vinci's proportion studies */}
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, rotate: 360 }}
            transition={{ opacity: { duration: 2 }, scale: { duration: 2, ease: easeCine }, rotate: { duration: 160, repeat: Infinity, ease: "linear" } }}
            className="gpu-layer w-[520px] h-[520px] md:w-[720px] md:h-[720px] rounded-full border border-violet-300/[0.07]"
          />
          <div className="absolute w-[360px] h-[360px] md:w-[500px] md:h-[500px] rounded-full border border-violet-300/[0.06]" />
        </div>

        <div className="z-10 flex flex-col items-center text-center max-w-2xl w-full">
          {/* Wax-seal emblem */}
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: easeCine }}
            className="relative w-24 h-24 mb-10 mx-auto"
          >
            <div className="absolute inset-0 rounded-full bg-violet-500/15 blur-2xl" />
            <div className="relative w-full h-full rounded-full flex items-center justify-center border border-violet-300/30 bg-gradient-to-b from-violet-400/[0.10] to-transparent shadow-[0_0_40px_rgba(139,92,246,0.22)] group">
              <div className="absolute inset-1.5 rounded-full border border-violet-300/15" />
              <Lock className="w-9 h-9 text-violet-200/90 group-hover:text-violet-100 transition-colors duration-500" strokeWidth={1.25} />
            </div>
          </motion.div>

          {/* Amethyst wordmark */}
          <motion.h1
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: easeCine }}
            className="font-fell text-5xl md:text-7xl font-bold uppercase tracking-[0.2em] pl-[0.2em] mb-3"
            style={AMETHYST}
          >
            Da Vinci
          </motion.h1>

          {/* Medium badge — the two arts studied within */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.5, ease: easeCine }}
            className="mb-6 px-4 py-1 rounded-full border border-violet-400/40 bg-violet-500/10 text-violet-200/90 text-[10px] md:text-xs font-bold tracking-[0.25em] uppercase"
          >
            Anime &middot; Manhwa
          </motion.div>

          {/* Ornamental rule */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: easeCine }}
            className="h-px w-44 md:w-56 bg-gradient-to-r from-transparent via-violet-300/50 to-transparent origin-center mb-8"
          />

          {/* Refined Renaissance copy */}
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.25, ease: easeCine }}
            className="font-garamond italic text-lg md:text-2xl text-violet-100/80 mb-3 leading-relaxed"
          >
            An invitation-only atelier for the devoted student of the anime &amp; manhwa arts.
          </motion.p>
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.32, ease: easeCine }}
            className="text-sm md:text-base text-slate-400/80 mb-12 max-w-md mx-auto font-light tracking-wide"
          >
            Present your seal to unlock the vault — anime to watch, manhwa to read — and begin your study.
          </motion.p>

          {/* Request Access — purple-lined seal button */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: easeCine }}
          >
            <button
              onClick={() => setShowLogin(true)}
              className="group relative inline-flex items-center gap-3 px-9 py-4 rounded-full border border-violet-300/40 text-violet-100 font-cinzel tracking-[0.2em] uppercase text-sm transition-all duration-500 hover:border-violet-300/80 hover:text-white focus:outline-none focus:ring-1 focus:ring-violet-300/60 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-violet-400/25 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <KeyRound className="relative w-4 h-4 text-violet-200 transition-transform duration-500 group-hover:-rotate-12" strokeWidth={1.5} />
              <span className="relative">Request Access</span>
            </button>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="absolute bottom-8 text-center text-violet-100/25 text-xs tracking-[0.3em] uppercase font-cinzel"
        >
          &copy; {new Date().getFullYear()} Da Vinci &middot; All Rights Reserved
        </motion.div>

        <AnimatePresence>
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  return <>{children}</>;
}
