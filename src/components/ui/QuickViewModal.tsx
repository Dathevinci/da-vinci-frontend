"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";

import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import AnimeDetailView from "@/components/anime/AnimeDetailView";
import { AnimeModalOptions } from "@/components/providers/AnimeModalProvider";

interface QuickViewModalProps {
  anime: Anime | null;
  options?: AnimeModalOptions;
  onClose: () => void;
  /** Kept for callers that still pass it; the detail screen plays the
   *  trailer in its own tab rather than handing off to a second modal. */
  onPlayTrailer?: (youtubeId?: string | null) => void;
}

/**
 * The detail screen AS AN OVERLAY. Everything inside is AnimeDetailView —
 * the identical body the /anime/[id] route renders — so a show looks the
 * same whether you tapped a card or followed a comment link.
 */
export default function QuickViewModal({ anime, options, onClose }: QuickViewModalProps) {
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
          className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[#070709]"
        >
          {/* Close — pinned above everything while the page scrolls */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>

          <AnimeDetailView anime={anime} options={options} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
