"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";

import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import AnimeDetailView from "@/components/anime/AnimeDetailView";
import { AnimeModalOptions } from "@/components/providers/AnimeModalProvider";

interface QuickViewModalProps {
  anime: Anime | null;
  options?: AnimeModalOptions;
  onClose: () => void;
  /** Present when this show was opened from another's "More Like This" —
   *  steps back to that one instead of dumping to the feed. */
  onBack?: () => void;
  /** Kept for callers that still pass it; the detail screen plays the
   *  trailer in its own tab rather than handing off to a second modal. */
  onPlayTrailer?: (youtubeId?: string | null) => void;
}

/**
 * The detail screen AS AN OVERLAY. Everything inside is AnimeDetailView —
 * the identical body the /anime/[id] route renders — so a show looks the
 * same whether you tapped a card or followed a comment link.
 */
export default function QuickViewModal({ anime, options, onClose, onBack }: QuickViewModalProps) {
  const [mounted, setMounted] = useState(false);

  useLockBodyScroll();

  useEffect(() => { setMounted(true); }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {anime && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          // z-70 — BELOW the Dock (75) and real dialogs (login/search/
          // control centre), ABOVE page content and the mobile header.
          // At z-9999 this opaque full-screen surface buried the navbar
          // every single time an anime was opened; it isn't a dialog, it's
          // a page that happens to float.
          className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#070709]"
        >
          {/* Close — pinned above everything while the page scrolls */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Back — the X's mirror, shown only when there is a trail. Returns
              to the show whose More Like This grid opened this one, restored
              onto that tab; without it, checking two recommendations meant
              re-finding the first show from scratch. */}
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to previous anime"
              className="fixed left-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <AnimeDetailView anime={anime} options={options} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
