"use client";

import { useUser } from "@/hooks/useUser";
import { useState } from "react";
import LoginModal from "@/components/layout/LoginModal";
import { Lock, Play, ArrowRight, Tv, BookMarked, BookOpen } from "lucide-react";
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

        {/* ── FLOATING PILL BAR, with the mascot perched on top of it ── */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: easeCine }}
          className="absolute inset-x-0 top-9 z-20 flex justify-center px-4"
        >
          <div className="relative">
            {/* the mascot bobs gently above the bar, pointer tucked under it */}
            <motion.div
              aria-hidden
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center"
            >
              <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover shadow-[0_6px_20px_rgba(0,0,0,.6)] ring-2 ring-white/25" />
              <span className="-mt-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white/90" />
            </motion.div>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-2 py-1.5 backdrop-blur-xl sm:gap-2 sm:px-3">
              <span className="flex items-center gap-2 px-2 sm:pr-4">
                <img src="/logo.png" alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-violet-400/50" />
                <span className="font-fell text-sm font-bold uppercase tracking-[0.22em] text-white">Da Vinci</span>
              </span>
              <span className="rounded-full bg-white/12 px-4 py-1.5 text-[11px] font-bold text-white">Home</span>
              <span className="hidden items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Anime
              </span>
              <span className="hidden items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Manhwa
              </span>
              <span className="hidden items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-300 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-400" /> Novels
              </span>
              <button
                onClick={() => setShowLogin(true)}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Enter
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── HERO ── the owner's reference layout: status pills, the huge
            wordmark with art living inside the letters, one mono tagline
            with the load-bearing words in white, two doors, and the three
            arts as a breadcrumb trail. */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center text-center">
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: easeCine }}
            className="mb-8 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3.5 py-1.5 backdrop-blur">
              <Lock className="h-3 w-3 text-emerald-300" strokeWidth={2.5} />
              <span className="font-mono text-[11px] font-bold tracking-wide text-slate-200">invitation only</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3.5 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="font-mono text-[11px] font-bold tracking-wide text-slate-200">three arts inside</span>
            </span>
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

          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.28, ease: easeCine }}
            className="mx-auto mt-8 mb-10 max-w-2xl font-mono text-base leading-relaxed text-slate-400 md:text-lg"
          >
            The anime, manhwa &amp; light-novel atelier that&apos;s{" "}
            <strong className="font-bold text-white">invitation-only</strong>,{" "}
            <strong className="font-bold text-white">ad-free</strong>, and{" "}
            <strong className="font-bold text-white">beautiful</strong>.
          </motion.p>

          {/* ── TWO DOORS ── the white one starts the journey (the modal
              handles both new seals and returning ones), the dark one goes
              to the atelier's Discord. */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: easeCine }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={() => setShowLogin(true)}
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-3.5 font-mono text-sm font-black text-black shadow-[0_10px_40px_rgba(0,0,0,.6)] transition hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              Start Watching
            </button>
            <a
              href="https://discord.gg/dSPPjPUQbM"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] px-7 py-3.5 font-mono text-sm font-bold text-slate-100 backdrop-blur transition hover:bg-white/10"
            >
              Join Discord
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          {/* ── THE THREE ARTS, as a trail ── each one is a door too. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: easeCine }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[12px] font-bold"
          >
            <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 text-slate-300 transition hover:text-violet-300">
              <Tv className="h-3.5 w-3.5" /> Anime <span className="text-slate-600">&rsaquo;</span>
            </button>
            <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 text-slate-300 transition hover:text-red-300">
              <BookMarked className="h-3.5 w-3.5" /> Manhwa <span className="text-slate-600">&rsaquo;</span>
            </button>
            <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 text-slate-300 transition hover:text-pink-300">
              <BookOpen className="h-3.5 w-3.5" /> Novel <span className="text-slate-600">&rsaquo;</span>
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
          {/* Landing sign-ins arrive at the Hub — the sections screen is the
              "what do you want today" moment the reference flow opens with. */}
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} redirectTo="/hub" />}
        </AnimatePresence>
      </div>
    );
  }

  return <>{children}</>;
}
