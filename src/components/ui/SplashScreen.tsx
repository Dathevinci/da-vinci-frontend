"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem("cinematicIntroPlayed");
    
    if (!hasPlayed) {
      sessionStorage.setItem("cinematicIntroPlayed", "true");
      
      const audio = new Audio("https://cdn.pixabay.com/download/audio/2022/02/15/audio_b2f9f8c6fb.mp3?filename=cinematic-deep-bass-rumble-115328.mp3");
      audio.volume = 0.5;
      audioRef.current = audio;

      const timer = setTimeout(() => {
        setShow(false);
      }, 4500);

      setHasChecked(true);

      return () => {
        clearTimeout(timer);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
    } else {
      setShow(false);
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    if (show && audioRef.current && hasChecked) {
      const playTimer = setTimeout(() => {
        audioRef.current?.play().catch(() => {
          /* autoplay blocked until the user interacts — expected, ignore */
        });
      }, 300);
      return () => clearTimeout(playTimer);
    }
  }, [show, hasChecked]);

  // Prevent rendering if we already know it shouldn't show to avoid flashes
  if (!show && hasChecked) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash-screen-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          style={{ willChange: "opacity" }}
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-[#050505]"
          onClick={() => {
            if (!userInteracted) {
              setUserInteracted(true);
              audioRef.current?.play().catch(() => {});
            }
          }}
        >
          <style>{`
            @keyframes gildedSheen {
              0%   { background-position: -180% 0; }
              55%  { background-position: 220% 0; }
              100% { background-position: 220% 0; }
            }
          `}</style>

          {/* Deep vignette so the gilded logo reads like ink on aged parchment-dark */}
          <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(88,44,160,0.20)_0%,rgba(5,5,5,0)_55%)]" />
          <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,#050505_100%)]" />

          {/* Netflix-style light ribbons that sweep across and reveal the mark */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
            {Array.from({ length: 9 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: -260, opacity: 0 }}
                animate={{ x: [-260, 260], opacity: [0, 0.55, 0] }}
                transition={{ delay: 0.5 + i * 0.05, duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
                style={{ left: `calc(50% + ${(i - 4) * 34}px)`, willChange: "transform, opacity" }}
                className="absolute top-1/2 -translate-y-1/2 w-[2px] h-56 md:h-72 bg-gradient-to-b from-transparent via-violet-300/80 to-transparent blur-[1px]"
              />
            ))}
          </div>

          {/* Logo */}
          <motion.div
            initial={{ scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            style={{ willChange: "transform, opacity" }}
            className="relative z-10 flex flex-col items-center"
          >
            <motion.img
              src="/logo.png"
              alt="Da Vinci Logo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              className="w-32 h-32 md:w-44 md:h-44 rounded-full mb-8 shadow-[0_0_70px_rgba(139,92,246,0.4)] ring-1 ring-violet-300/25"
            />

            {/* Gilded wordmark — Renaissance engraved capitals with a sweeping
                gold sheen, revealed letter-by-letter like a Netflix title. */}
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.7 } } }}
              className="font-fell text-5xl md:text-7xl font-bold uppercase flex tracking-[0.22em] pl-[0.22em]"
              aria-label="Da Vinci"
            >
              {"DA VINCI".split("").map((ch, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
                    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
                  }}
                  className={ch === " " ? "inline-block w-[0.4em]" : "inline-block"}
                  style={{
                    // Solid light fill (NOT background-clip:text — that renders
                    // transparent on some mobile WebViews, leaving only the
                    // shadow: the "invisible wordmark" bug). Reads on every device.
                    color: "#ece8ff",
                    textShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 26px rgba(167,139,250,0.6), 0 0 3px rgba(221,214,254,0.55)",
                  }}
                >
                  {ch === " " ? " " : ch}
                </motion.span>
              ))}
            </motion.h1>

            {/* Engraved rule + refined Renaissance tagline */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 1.7, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 h-px w-40 md:w-56 bg-gradient-to-r from-transparent via-violet-300/60 to-transparent origin-center"
            />
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 1.1, ease: "easeOut" }}
              className="font-garamond italic text-violet-100/70 text-base md:text-xl tracking-[0.35em] mt-4 pl-[0.35em]"
            >
              The Renaissance of Anime, Manhwa &amp; Novels
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
