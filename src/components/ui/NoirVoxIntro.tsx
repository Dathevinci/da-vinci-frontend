"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, X, Sparkles, Film, Eye, Clock,
  CheckCircle2, RotateCcw, Shield, Layers, Play
} from "lucide-react";

const TOTAL_SLIDES = 3;
const SLIDE_DURATION_MS = 8000;
const STORAGE_KEY = "davinci_noir_vox_seen_v1";
const NOIR_ACTIVE_KEY = "davinci_noir_protocol_enabled";

export default function NoirVoxIntro() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState({ days: 7, hours: 0, minutes: 0, seconds: 0 });

  // Initialize and check if user has seen the Vox intro
  useEffect(() => {
    // Enable noir mode on document root by default for the 1-week event
    const isNoirDisabled = localStorage.getItem(NOIR_ACTIVE_KEY) === "false";
    if (!isNoirDisabled) {
      document.documentElement.classList.add("noir-protocol-active");
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      setIsOpen(true);
    }

    // Listen for custom trigger to replay intro anytime
    const handleReopen = () => {
      setCurrentSlide(0);
      setProgress(0);
      setIsOpen(true);
    };

    window.addEventListener("open_noir_vox_intro", handleReopen);
    return () => window.removeEventListener("open_noir_vox_intro", handleReopen);
  }, []);

  // 7-day countdown calculation
  useEffect(() => {
    const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const interval = setInterval(() => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-advance progress timer
  useEffect(() => {
    if (!isOpen || isPaused) return;

    const interval = 50; // 50ms tick
    const increment = (interval / SLIDE_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentSlide < TOTAL_SLIDES - 1) {
            setCurrentSlide((s) => s + 1);
            return 0;
          }
          return 100;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, currentSlide]);

  const handleNext = useCallback(() => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((s) => s + 1);
      setProgress(0);
    } else {
      handleComplete();
    }
  }, [currentSlide]);

  const handlePrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide((s) => s - 1);
      setProgress(0);
    }
  }, [currentSlide]);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex flex-col justify-between bg-black text-white selection:bg-[#ffe600] selection:text-black overflow-y-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* ── Background Halftone Paper & Film Grain ── */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07] bg-halftone"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(255,255,255,0.15),transparent_70%)]"
          />

          {/* ── TOP VOX CHAPTER BAR & CONTROLS ── */}
          <header className="relative z-20 mx-auto w-full max-w-5xl px-4 sm:px-6 pt-6">
            {/* 3-Part Vox Story Progress Indicators */}
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((idx) => {
                const isPast = currentSlide > idx;
                const isCurrent = currentSlide === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setCurrentSlide(idx);
                      setProgress(0);
                    }}
                    className="group cursor-pointer py-2"
                  >
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-[#ffe600] transition-all duration-100 ease-linear shadow-[0_0_8px_#ffe600]"
                        style={{
                          width: isPast ? "100%" : isCurrent ? `${progress}%` : "0%",
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 group-hover:text-white transition">
                      <span>{`0${idx + 1} // ${idx === 0 ? "THE EVENT" : idx === 1 ? "THE SCIENCE" : "THE PROTOCOL"}`}</span>
                      {isCurrent && <span className="text-[#ffe600]">• ACTIVE</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vox Header Banner */}
            <div className="mt-4 flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-[#ffe600] text-black px-2 py-0.5 text-xs font-black uppercase tracking-tight">
                  VOX
                </span>
                <span className="text-xs font-mono font-black uppercase tracking-widest text-neutral-300">
                  EXPLAINS: THE 7-DAY NOIR EVENT
                </span>
              </div>

              <button
                onClick={handleComplete}
                className="group flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 hover:bg-white hover:text-black transition"
              >
                <span>SKIP TO SITE</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* ── KINETIC VOX SLIDE CONTENT ── */}
          <main className="relative z-10 mx-auto my-auto w-full max-w-5xl px-4 sm:px-6 py-8">
            <AnimatePresence mode="wait">
              {currentSlide === 0 && (
                <motion.div
                  key="slide-0"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center"
                >
                  {/* Left: Vox Editorial Headline */}
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-mono font-bold text-neutral-300">
                      <Film className="h-3.5 w-3.5 text-[#ffe600]" />
                      <span>CHAPTER 1 : THE EXTINCTION OF COLOR</span>
                    </div>

                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                      Why did Da Vinci go{" "}
                      <span className="relative inline-block text-black bg-[#ffe600] px-2 py-0.5 transform -rotate-1 shadow-md">
                        Black & White?
                      </span>
                    </h2>

                    <p className="text-base sm:text-lg leading-relaxed text-neutral-300 font-sans max-w-xl">
                      Starting right now, all RGB saturation across Da Vinci has been decommissioned for exactly{" "}
                      <strong className="text-white font-black underline decoration-[#ffe600] decoration-2 underline-offset-4">
                        7 days
                      </strong>
                      . This is not a malfunction — it is a deliberate 1-week cinematic experiment.
                    </p>

                    <div className="pt-2 flex items-center gap-4 text-xs font-mono text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-[#ffe600]" /> FULL MONOCHROME
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-[#ffe600]" /> 1-WEEK DURATION
                      </span>
                    </div>
                  </div>

                  {/* Right: Vox Infographic Card (RGB Spectrum Drain) */}
                  <div className="relative rounded-2xl border-2 border-white/20 bg-neutral-950 p-6 shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-mono font-bold text-neutral-400">
                      <span>SPECTRUM COLLAPSE // DATA</span>
                      <span className="text-[#ffe600]">STATUS: 0% RGB</span>
                    </div>

                    <div className="mt-5 space-y-4 font-mono">
                      <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                          <span>RED CHANNEL (R)</span>
                          <span className="line-through text-neutral-600">255</span>
                          <span className="text-white font-bold">000</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-neutral-900 border border-neutral-800">
                          <div className="h-full w-0 bg-red-500 transition-all duration-1000" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                          <span>GREEN CHANNEL (G)</span>
                          <span className="line-through text-neutral-600">255</span>
                          <span className="text-white font-bold">000</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-neutral-900 border border-neutral-800">
                          <div className="h-full w-0 bg-emerald-500 transition-all duration-1000" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                          <span>BLUE CHANNEL (B)</span>
                          <span className="line-through text-neutral-600">255</span>
                          <span className="text-white font-bold">000</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-neutral-900 border border-neutral-800">
                          <div className="h-full w-0 bg-blue-500 transition-all duration-1000" />
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/15 bg-white/[0.04] p-3 text-xs text-neutral-300">
                        <div className="flex items-center gap-2 font-bold text-white mb-1">
                          <Sparkles className="h-3.5 w-3.5 text-[#ffe600]" /> RESULT: PURE CONTRAST
                        </div>
                        Color distractions eliminated. Shadow, linework, and storytelling elevated.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 1 && (
                <motion.div
                  key="slide-1"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center"
                >
                  {/* Left: Vox Editorial Headline */}
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-mono font-bold text-neutral-300">
                      <Eye className="h-3.5 w-3.5 text-[#ffe600]" />
                      <span>CHAPTER 2 : THE SCIENCE OF CONTRAST</span>
                    </div>

                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
                      Less color.{" "}
                      <span className="relative inline-block text-black bg-[#ffe600] px-2 py-0.5 transform rotate-1 shadow-md">
                        More focus.
                      </span>
                    </h2>

                    <p className="text-base sm:text-lg leading-relaxed text-neutral-300 font-sans max-w-xl">
                      In classical 1940s Film Noir and master manga inks, directors stripped away color to draw attention directly to emotion, silhouette, and movement.
                    </p>

                    <blockquote className="border-l-4 border-[#ffe600] pl-4 py-1 text-sm text-neutral-400 italic">
                      "When you take color away, you don't lose information — you gain clarity."
                    </blockquote>
                  </div>

                  {/* Right: Comparison Infographic */}
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/20 bg-neutral-950 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black font-black text-sm">
                          +28%
                        </div>
                        <div>
                          <p className="font-mono text-sm font-bold text-white uppercase">Visual Processing Speed</p>
                          <p className="text-xs text-neutral-400">High-contrast monochrome frames allow the eye to parse action faster.</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/20 bg-neutral-950 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe600] text-black font-black text-sm">
                          100%
                        </div>
                        <div>
                          <p className="font-mono text-sm font-bold text-white uppercase">Manga & Anime Fidelity</p>
                          <p className="text-xs text-neutral-400">Every panel and animation cell rendered in pure darkroom tones.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 2 && (
                <motion.div
                  key="slide-2"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-8 text-center max-w-2xl mx-auto"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3.5 py-1 text-[11px] font-mono font-bold text-neutral-300">
                    <Clock className="h-3.5 w-3.5 text-[#ffe600]" />
                    <span>CHAPTER 3 : THE 7-DAY PROTOCOL HAS BEGUN</span>
                  </div>

                  <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-tight">
                    Enter the{" "}
                    <span className="relative inline-block text-black bg-[#ffe600] px-3 py-1 transform -rotate-1 shadow-lg">
                      Noir Universe
                    </span>
                  </h2>

                  <p className="text-base sm:text-lg leading-relaxed text-neutral-300 font-sans max-w-xl mx-auto">
                    Experience anime streaming, manhwa reading, light novels, PvP duels, and guild raids in stark cinema noir. The countdown is live.
                  </p>

                  {/* 7-Day Live Countdown Clock */}
                  <div className="rounded-3xl border-2 border-white/20 bg-neutral-950/90 p-6 shadow-2xl backdrop-blur-md max-w-lg mx-auto">
                    <span className="text-xs font-mono font-black uppercase tracking-widest text-[#ffe600]">
                      // NOIR PROTOCOL TIME REMAINING
                    </span>
                    <div className="mt-3 grid grid-cols-4 gap-2 font-mono">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-2xl sm:text-3xl font-black text-white">{String(countdown.days).padStart(2, "0")}</p>
                        <span className="text-[9px] uppercase tracking-wider text-neutral-400">DAYS</span>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-2xl sm:text-3xl font-black text-white">{String(countdown.hours).padStart(2, "0")}</p>
                        <span className="text-[9px] uppercase tracking-wider text-neutral-400">HOURS</span>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-2xl sm:text-3xl font-black text-white">{String(countdown.minutes).padStart(2, "0")}</p>
                        <span className="text-[9px] uppercase tracking-wider text-neutral-400">MINS</span>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-2xl sm:text-3xl font-black text-[#ffe600]">{String(countdown.seconds).padStart(2, "0")}</p>
                        <span className="text-[9px] uppercase tracking-wider text-neutral-400">SECS</span>
                      </div>
                    </div>
                  </div>

                  {/* Big CTA Button to enter the site */}
                  <div className="pt-2">
                    <button
                      onClick={handleComplete}
                      className="group inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-base font-black uppercase tracking-wider text-black shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:bg-[#ffe600] hover:scale-105 transition-all duration-200"
                    >
                      <span>CONTINUE TO DA VINCI</span>
                      <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* ── FOOTER CONTROLS & NAVIGATION ── */}
          <footer className="relative z-20 mx-auto w-full max-w-5xl px-4 sm:px-6 pb-6">
            <div className="flex items-center justify-between border-t border-white/15 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>PREV</span>
                </button>

                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2 text-xs font-mono font-black uppercase tracking-wider text-black hover:bg-[#ffe600] transition shadow-md"
                >
                  <span>{currentSlide === TOTAL_SLIDES - 1 ? "ENTER SITE" : "NEXT SLIDE"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-xs font-mono text-neutral-500">
                <span>{`SLIDE ${currentSlide + 1} OF ${TOTAL_SLIDES}`}</span>
              </div>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
