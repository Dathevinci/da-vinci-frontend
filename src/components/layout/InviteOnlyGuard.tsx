"use client";

import { useUser } from "@/hooks/useUser";
import { useState } from "react";
import LoginModal from "@/components/layout/LoginModal";
import { Lock, KeyRound, Tv, BookMarked, BookOpen } from "lucide-react";
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

/**
 * The landing artwork. Drop a file at `public/landing-bg.jpg` and it appears
 * here and inside the wordmark.
 *
 * If the file is missing the page still works — the gradients underneath carry
 * it, and the title falls back to the amethyst fill. Nothing breaks, it just
 * looks like it did before.
 */
const LANDING_BG = "/landing-bg.jpg";

/**
 * The wordmark is a WINDOW onto the background rather than a painted colour.
 *
 * `background-attachment: fixed` is what makes it work: the image is anchored
 * to the viewport, not to the letters, so the art inside the text lines up
 * exactly with the art behind the page. Without it the fill would be a second,
 * differently-cropped copy and the illusion collapses.
 */
const WORDMARK_WINDOW: React.CSSProperties = {
  // TWO layers, and the order matters. The artwork sits on top; the amethyst
  // gradient sits under it as a floor. background-clip:text makes the letters
  // transparent, so if the image ever fails to load a single-layer version
  // renders NOTHING — the title simply disappears, which is exactly what
  // happened when the file wasn't deployed. The gradient guarantees letters.
  backgroundImage: `url(${LANDING_BG}), linear-gradient(100deg, #6d28d9 0%, #a78bfa 18%, #f5f3ff 32%, #c4b5fd 46%, #8b5cf6 62%, #a78bfa 82%, #6d28d9 100%)`,
  backgroundSize: "cover, 200% 100%",
  backgroundPosition: "center, center",
  // The page background is blurred; this one is NOT. Sharp art inside the
  // letters against a soft field is what makes the wordmark read as a window.
  backgroundAttachment: "fixed, scroll",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

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
      <div className="relative min-h-screen overflow-hidden bg-[#050505] p-4 text-white selection:bg-violet-500/20">
        {/* ── THE ARTWORK ── full-bleed, fixed, so the wordmark's window lines
            up with it exactly. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${LANDING_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            // Blur pushes the art back so the copy sits in front of it rather
            // than fighting it. Scaled up because a blur samples past its own
            // edges and would otherwise leave a soft border around the screen.
            filter: "blur(14px) saturate(1.1)",
            transform: "scale(1.08)",
          }}
        />
        {/* Scrims. Two of them: a flat darkener so text is legible over any
            crop, and a bottom-heavy gradient so the page has a floor. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-black/55" />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#050505]/85 via-transparent to-[#050505]" />
        {/* The original tri-mode ambience stays underneath — it is what carries
            the page if the artwork file isn't there yet. */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_32%,rgba(139,92,246,0.18)_0%,transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_78%,rgba(220,38,38,0.12)_0%,transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_80%_75%,rgba(236,72,153,0.12)_0%,transparent_50%)]" />

        {/* ── FLOATING PILL BAR ── */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: easeCine }}
          className="absolute inset-x-0 top-5 z-20 flex justify-center px-4"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-xl sm:gap-5 sm:px-5">
            <span className="flex items-center gap-2 pr-1 sm:pr-3">
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-violet-400/50" />
              <span className="font-fell text-sm font-bold uppercase tracking-[0.24em] text-white">Da Vinci</span>
            </span>
            <span aria-hidden className="hidden h-5 w-px bg-white/10 sm:block" />
            <span className="hidden items-center gap-1.5 text-[11px] font-bold text-slate-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Anime
            </span>
            <span className="hidden items-center gap-1.5 text-[11px] font-bold text-slate-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Manhwa
            </span>
            <span className="hidden items-center gap-1.5 text-[11px] font-bold text-slate-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" /> Novels
            </span>
          </div>
        </motion.div>

        {/* ── HERO ── */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center text-center">
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: easeCine }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-black/40 px-4 py-1.5 backdrop-blur"
          >
            <Lock className="h-3 w-3 text-violet-200" strokeWidth={2} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-100">Invitation only</span>
          </motion.div>

          {/* The wordmark — a window onto the art behind it */}
          <motion.h1
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: easeCine }}
            className="font-fell text-6xl font-bold uppercase leading-none tracking-[0.16em] pl-[0.16em] drop-shadow-[0_6px_40px_rgba(0,0,0,0.9)] sm:text-8xl md:text-[9rem]"
            style={WORDMARK_WINDOW}
          >
            Da Vinci
          </motion.h1>

          {/* Ornamental rule */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: easeCine }}
            className="mt-7 mb-7 h-px w-44 origin-center bg-[linear-gradient(to_right,transparent,rgba(167,139,250,0.6),rgba(248,113,113,0.5),rgba(244,114,182,0.6),transparent)] md:w-72"
          />

          {/* Refined Renaissance copy */}
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.25, ease: easeCine }}
            className="font-garamond mb-3 max-w-2xl text-xl italic leading-relaxed text-violet-50/90 md:text-3xl"
          >
            An invitation-only atelier for the devoted student of the anime, manhwa &amp; light-novel arts.
          </motion.p>
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.32, ease: easeCine }}
            className="text-sm md:text-base text-slate-400/80 mb-12 max-w-md mx-auto font-light tracking-wide"
          >
            Present your seal to unlock the vault — anime to watch, manhwa &amp; novels to read — and begin your study.
          </motion.p>

          {/* ── ONE WAY IN ──────────────────────────────────────────────────
              There were three buttons — Sign in, Request Access, I have a seal
              — and every one of them opened the SAME modal. Three doors into
              one room is a choice the visitor has to make for no reason and
              can't make wrongly. The modal already handles both new and
              returning people, so the page offers one door and says so. */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: easeCine }}
            className="flex flex-col items-center gap-3"
          >
            <button
              onClick={() => setShowLogin(true)}
              className="group inline-flex items-center gap-3 rounded-full bg-white px-10 py-4 text-sm font-black uppercase tracking-[0.16em] text-black shadow-[0_10px_40px_rgba(0,0,0,.6)] transition hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <KeyRound className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" strokeWidth={2} />
              Enter the Vault
            </button>
            <p className="text-[11px] font-bold tracking-wide text-slate-400">
              Already have a seal? Same door.
            </p>
          </motion.div>

          {/* ── THE THREE ARTS ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: easeCine }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[11px] font-black uppercase tracking-[0.24em]"
          >
            <span className="flex items-center gap-2 text-violet-300">
              <Tv className="h-3.5 w-3.5" /> Anime
            </span>
            <span className="flex items-center gap-2 text-red-400">
              <BookMarked className="h-3.5 w-3.5" /> Manhwa
            </span>
            <span className="flex items-center gap-2 text-pink-400">
              <BookOpen className="h-3.5 w-3.5" /> Novels
            </span>
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
