"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAnimeStatus, AnimeUserStatus } from "@/hooks/useAnimeStatus";
import { Eye, Check, Clock, Heart, Plus, Trash2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Anime } from "@tutkli/jikan-ts";
import { clsx } from "clsx";
import { useToast } from "@/components/ui/Toast";

type Variant = "full" | "compact" | "icon";

// The four tracker states, in the order the user picks them. "Watched" maps to
// the backend "Finished" status so it stays compatible with existing data.
const OPTIONS: { status: AnimeUserStatus; label: string; icon: typeof Eye; color: string }[] = [
  { status: "Watching", label: "Watching", icon: Eye, color: "text-green-400" },
  { status: "Finished", label: "Watched", icon: Check, color: "text-purple-400" },
  { status: "Waiting", label: "Waiting", icon: Clock, color: "text-blue-400" },
  { status: "Interested", label: "Interested", icon: Heart, color: "text-pink-400" },
];

const optionFor = (s: AnimeUserStatus) => OPTIONS.find((o) => o.status === s);

export default function TrackerButton({
  anime,
  variant = "full",
  className,
}: {
  anime: Anime;
  variant?: Variant;
  className?: string;
}) {
  const { getStatus, setStatus, isLoaded } = useAnimeStatus();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const status = getStatus(anime.mal_id);
  const tracked = status !== "None";
  const opt = optionFor(status);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const menuH = 260;
      const below = r.bottom + menuH < window.innerHeight;
      setCoords({
        top: below ? r.bottom + 8 : Math.max(8, r.top - menuH - 8),
        left: Math.min(r.left, window.innerWidth - 232),
        width: r.width,
      });
    }
    setOpen((v) => !v);
  };

  const pick = (e: React.MouseEvent, s: AnimeUserStatus) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus(anime, s);
    setOpen(false);
    toast(s === "None" ? "Removed from Tracker" : `Set to ${optionFor(s)?.label ?? s}`, "success");
  };

  // Close on outside interaction.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isLoaded) {
    return (
      <span
        className={clsx(
          "inline-block animate-pulse rounded-full bg-white/10",
          variant === "icon" ? "h-7 w-7 md:h-8 md:w-8" : variant === "compact" ? "h-7 w-28" : "h-12 w-44",
          className
        )}
      />
    );
  }

  const TriggerIcon = tracked ? opt?.icon ?? Check : Plus;
  const compact = variant === "compact";

  const trigger =
    variant === "icon" ? (
      <button
        ref={btnRef}
        onClick={toggleMenu}
        title="Add to Tracker"
        className={clsx(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors md:h-8 md:w-8",
          tracked ? clsx(opt?.color, "border-current bg-white/5") : "border-slate-400 text-white hover:border-white hover:bg-white/10",
          className
        )}
      >
        <TriggerIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
      </button>
    ) : (
      <button
        ref={btnRef}
        onClick={toggleMenu}
        className={clsx(
          "flex items-center gap-2 rounded-full border font-bold backdrop-blur-md transition",
          compact ? "px-3 py-1.5 text-xs" : "px-6 py-3",
          tracked ? clsx(opt?.color, "border-current bg-white/5") : "border-white/20 bg-white/10 text-white hover:bg-white/20",
          className
        )}
      >
        <TriggerIcon className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
        <span>{tracked ? opt?.label ?? status : "Add to Tracker"}</span>
        <ChevronDown className={clsx("opacity-70", compact ? "h-3 w-3" : "h-4 w-4")} />
      </button>
    );

  const menu =
    open && coords
      ? createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-[10000]" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                style={{ position: "fixed", top: coords.top, left: coords.left, minWidth: 216 }}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#161616] py-1 shadow-2xl"
              >
                {OPTIONS.map((o) => {
                  const Icon = o.icon;
                  const active = status === o.status;
                  return (
                    <button
                      key={o.status}
                      onClick={(e) => pick(e, o.status)}
                      className={clsx(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10",
                        active ? "bg-white/5" : "text-slate-300"
                      )}
                    >
                      <Icon className={clsx("h-4 w-4", o.color)} />
                      <span className={active ? o.color : ""}>{o.label}</span>
                      {active && <Check className="ml-auto h-3.5 w-3.5 text-white/50" />}
                    </button>
                  );
                })}
                {tracked && (
                  <button
                    onClick={(e) => pick(e, "None")}
                    className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" /> Remove from tracker
                  </button>
                )}
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
