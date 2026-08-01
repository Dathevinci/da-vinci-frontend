"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";

/**
 * THE SHOWCASE — the profile effect with the whole viewport to perform in.
 *
 * Effects are card-anchored by design (they scroll locked to the profile card
 * like a Discord effect), which means most of them have never been seen at the
 * size they were actually built for: Himalayan Snow is a mountain landscape
 * with accumulating drifts, Tempest hangs its clouds above the frame and needs
 * height for rain to fall, Evernight splits sky from river at 70% of the card.
 * In a 420px column those read as a smudge.
 *
 * This is NOT a new rendering path — it is the same <ProfileEffect> mounted in
 * a bigger box. The overlay is `relative`, so the effect's `absolute inset-0`
 * canvases size to the viewport instead of the card, and the avatar inside
 * registers the anchor the effect centres on. Every effect scopes its anchor
 * scan with `host.contains(el)`, so mounting this over a live profile does not
 * make either instance grab the other's avatar.
 *
 * Portaled to document.body on purpose: the profile card is `overflow-hidden`
 * for its rounded corners, which would clip a full-screen child.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  username: string;
  avatar?: string | null;
  effect?: string | null;
  frame?: string | null;
  /** Themed name gradient for the equipped effect (same class the card uses). */
  nameClass?: string;
  /** Small line under the name — rank, title, whatever the card shows. */
  subtitle?: string;
}

export default function ProfileShowcase({
  open,
  onClose,
  username,
  avatar,
  effect,
  frame,
  nameClass,
  subtitle,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc closes, and the page behind must not scroll while the stage is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[120] overflow-hidden bg-[#050308]"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${username}'s profile effect`}
        >
          {/* The effect fills the viewport — this container is its "card". */}
          <ProfileEffect effect={effect} />

          {/* Vignette, above the effect's washes but below the subject. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[9]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 45%, transparent 32%, rgba(2,1,6,0.5) 66%, rgba(0,0,0,0.88) 100%)",
            }}
          />

          <button
            onClick={onClose}
            aria-label="Close showcase"
            className="absolute right-5 top-5 z-[60] grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Subject: avatar + name, centred. z-50 keeps it above every effect
              layer (the tallest an effect uses is z-30). Clicks here must not
              close, so the backdrop's onClick is stopped. */}
          <div
            className="pointer-events-none absolute inset-0 z-[50] flex flex-col items-center justify-center gap-6 px-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.86, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto relative"
            >
              <div className="relative h-40 w-40 sm:h-48 sm:w-48 md:h-56 md:w-56">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={username}
                    className="relative z-10 h-full w-full rounded-full border-4 border-[#0b0b12] bg-[#141414] object-cover shadow-[0_0_70px_rgba(0,0,0,0.9)]"
                  />
                ) : (
                  <div className="relative z-10 grid h-full w-full place-items-center rounded-full border-4 border-[#0b0b12] bg-purple-600 text-6xl font-black text-white">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* the anchor this stage's effect centres on */}
                <AvatarDecoration frame={frame} effect={effect} size="lg" />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <h2
                className={`text-4xl font-black tracking-tight drop-shadow-2xl sm:text-5xl md:text-6xl ${
                  nameClass || "text-white"
                }`}
              >
                {username}
              </h2>
              {subtitle && (
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  {subtitle}
                </p>
              )}
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[60] text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
            Press Esc or click anywhere to close
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
