"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import Link from "next/link";

// Show once per browser session (i.e. each fresh visit to the site), like the
// splash. sessionStorage clears when the tab/session ends, so a returning
// visitor sees it again next time — but it won't nag on internal navigation.
const SESSION_KEY = "daVinciSupportShown";

/**
 * A gentle "Support Us" popup shown to a visitor on their first entry each
 * session (after the cinematic splash clears). They can head to the /support
 * page or dismiss it.
 */
export default function SupportUsModal() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);

    let alreadyShown = false;
    let splashPlaying = false;
    try {
      alreadyShown = !!sessionStorage.getItem(SESSION_KEY);
      // The splash plays once per session; if its flag isn't set yet it's about to.
      splashPlaying = !sessionStorage.getItem("cinematicIntroPlayed");
    } catch {
      /* storage blocked — fall through and show */
    }

    if (alreadyShown) return; // already shown this session

    // Let the splash finish so the popup animates in cleanly on a fresh load.
    const delay = splashPlaying ? 6200 : 1800;
    const timer = setTimeout(() => {
      // Mark shown for this session as soon as it appears, so navigating
      // around doesn't pop it a second time.
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
      setShow(true);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => setShow(false);

  // Close on Escape while open.
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="support-us"
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop — click to dismiss */}
          <div onClick={dismiss} className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="relative w-full max-w-md bg-[#0b0b0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Themed glows matching the /support page */}
            <div className="absolute -top-24 -right-16 w-64 h-64 bg-[#ff5e5b]/20 blur-[90px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-24 -left-16 w-64 h-64 bg-purple-600/20 blur-[90px] rounded-full pointer-events-none" />

            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-[1] px-8 py-9 text-center">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.12, type: "spring", stiffness: 200 }}
                className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#ff5e5b]/15 border border-[#ff5e5b]/30 flex items-center justify-center shadow-[0_0_40px_rgba(255,94,91,0.25)] rotate-3"
              >
                <Heart className="w-8 h-8 text-[#ff5e5b] fill-[#ff5e5b]/40" />
              </motion.div>

              <h2 className="font-fell text-2xl md:text-3xl font-bold text-white mb-3 tracking-wide">Keep Da Vinci Alive</h2>
              <p className="text-slate-400 text-sm md:text-[15px] leading-relaxed mb-7 max-w-sm mx-auto">
                We run <span className="text-white font-semibold">completely ad-free</span> so nothing comes between you
                and the art. The servers aren&apos;t free though — a small gift keeps the vault open for everyone.
              </p>

              <div className="flex flex-col gap-2.5">
                <Link
                  href="/support"
                  onClick={dismiss}
                  className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff5e5b] to-[#ff8f6b] text-white font-bold shadow-lg shadow-[#ff5e5b]/20 hover:shadow-[#ff5e5b]/40 hover:brightness-110 transition-all"
                >
                  <Heart className="w-4 h-4 fill-current" /> Support Us
                </Link>
                <button
                  onClick={dismiss}
                  className="w-full py-3 rounded-xl text-slate-400 hover:text-white font-semibold text-sm hover:bg-white/5 transition-colors"
                >
                  Maybe later
                </button>
              </div>

              <p className="mt-5 text-[11px] text-slate-600 tracking-wide">You can always support us later from the menu.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
