"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePreferences } from "@/hooks/usePreferences";
import { useAppMode, AppMode } from "@/components/providers/AppModeProvider";
import {
  Moon, Zap, PlayCircle, EyeOff, Eye, SkipForward,
  Gauge, Wifi, MonitorPlay, BookOpen, Feather, SlidersHorizontal,
} from "lucide-react";

interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Per-mode accent, spoken in the Lunar kit: translucent chips, never solid
 * blocks. Literal class strings so Tailwind's JIT keeps them. Anime uses the
 * kit's violet (the site accent); manhwa and novel keep their hues.
 */
const MODES: Record<AppMode, {
  label: string; Icon: any; chip: string; dot: string; toggleOn: string;
}> = {
  anime:  { label: "Anime",  Icon: MonitorPlay, chip: "border-violet-400/40 bg-violet-500/15 text-violet-200", dot: "bg-violet-400", toggleOn: "bg-violet-500" },
  manhwa: { label: "Manhwa", Icon: BookOpen,    chip: "border-red-400/40 bg-red-500/15 text-red-200",          dot: "bg-red-400",    toggleOn: "bg-red-500" },
  novel:  { label: "Novel",  Icon: Feather,     chip: "border-pink-400/40 bg-pink-500/15 text-pink-200",       dot: "bg-pink-400",   toggleOn: "bg-pink-500" },
};

const MODE_ORDER: AppMode[] = ["anime", "manhwa", "novel"];

/**
 * Auto-next lives in the watch page's own localStorage prefs, not in
 * usePreferences — same key, same shape. The event tells an OPEN player to
 * re-read, so the toggle applies mid-episode too.
 */
const WATCH_PREFS_KEY = "davinci_watch_prefs";

function readAutoNext(): boolean {
  try {
    return JSON.parse(localStorage.getItem(WATCH_PREFS_KEY) || "{}").autoNext === true;
  } catch {
    return false;
  }
}

export default function ControlCenter({ isOpen, onClose }: ControlCenterProps) {
  const { theme, toggleTheme } = useTheme();
  const { preferences, updatePreference } = usePreferences();
  const { mode, setMode } = useAppMode();
  const ref = useRef<HTMLDivElement>(null);

  const accent = MODES[mode];

  const [autoNext, setAutoNext] = useState(false);
  useEffect(() => {
    if (isOpen) setAutoNext(readAutoNext());
  }, [isOpen]);

  const toggleAutoNext = () => {
    const next = !autoNext;
    setAutoNext(next);
    // Parse and write in SEPARATE trys: if stored JSON is corrupted, the parse
    // failing must not skip the write — writing from {} repairs the storage.
    let cur: Record<string, unknown> = {};
    try { cur = JSON.parse(localStorage.getItem(WATCH_PREFS_KEY) || "{}"); } catch { /* corrupted — rebuild */ }
    try { localStorage.setItem(WATCH_PREFS_KEY, JSON.stringify({ ...cur, autoNext: next })); } catch { /* storage full */ }
    window.dispatchEvent(new Event("davinci_watch_prefs_updated"));
  };

  const switchMode = (m: AppMode) => {
    if (m !== mode) setMode(m);
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-20 right-4 z-[100] flex max-h-[85dvh] w-[calc(100vw-32px)] flex-col gap-4 overflow-hidden overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-4 font-mono text-white shadow-[0_30px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:w-[400px] md:right-8"
        >
          {/* ── Header: title + live mode chip ── */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-white/70" />
              <span className="text-sm font-bold tracking-wide">Control Center</span>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${accent.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
              {accent.label}
            </div>
          </div>

          {/* ── Mode switcher — the one control that spans every mode ── */}
          <div>
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Mode</p>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {MODE_ORDER.map((m) => {
                const c = MODES[m];
                const active = m === mode;
                return (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-colors ${
                      active ? c.chip : "border-transparent text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <c.Icon className="h-4 w-4" />
                    <span className="text-[11px] font-bold">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Appearance ── */}
          <div>
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Appearance</p>
            <ToggleRow
              on={theme === "dark"}
              onClick={toggleTheme}
              Icon={theme === "dark" ? Zap : Moon}
              title="Theme"
              subtitle={theme === "dark" ? "Neon Purple" : "Pure Black"}
              toggleOn={accent.toggleOn}
            />
          </div>

          {/* ── Content ── */}
          <div>
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Content</p>
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => updatePreference("autoplayTrailers", !preferences.autoplayTrailers)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                    preferences.autoplayTrailers ? accent.chip : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10">
                    <PlayCircle className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-left text-xs font-bold leading-tight">Autoplay<br /><span className="text-[9px] font-normal opacity-70">Trailers</span></span>
                </button>

                <button
                  onClick={() => updatePreference("blurSensitiveContent", !preferences.blurSensitiveContent)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                    preferences.blurSensitiveContent ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10">
                    {preferences.blurSensitiveContent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-left text-xs font-bold leading-tight">Safe Browse<br /><span className="text-[9px] font-normal opacity-70">Blur mature</span></span>
                </button>
              </div>

              {/* Auto-next is a WATCH pref — only meaningful in anime mode. */}
              {mode === "anime" && (
                <ToggleRow
                  on={autoNext}
                  onClick={toggleAutoNext}
                  Icon={SkipForward}
                  title="Auto-Next Episode"
                  subtitle="Roll into the next episode when one ends"
                  toggleOn={accent.toggleOn}
                />
              )}
            </div>
          </div>

          {/* ── Performance — the toggles that actually matter for every mode ── */}
          <div>
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Performance</p>
            <div className="flex flex-col gap-2.5">
              <ToggleRow
                on={preferences.reducedMotion}
                onClick={() => updatePreference("reducedMotion", !preferences.reducedMotion)}
                Icon={Gauge}
                title="Performance Mode"
                subtitle="Turns off profile 3D effects & heavy motion"
                toggleOn={accent.toggleOn}
              />
              <ToggleRow
                on={preferences.dataSaver}
                onClick={() => updatePreference("dataSaver", !preferences.dataSaver)}
                Icon={Wifi}
                title="Data Saver"
                subtitle="Skips autoplay trailers & heavy media"
                toggleOn={accent.toggleOn}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToggleRow({
  on, onClick, Icon, title, subtitle, toggleOn,
}: {
  on: boolean; onClick: () => void; Icon: any; title: string; subtitle: string; toggleOn: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border border-white/10 p-3.5 transition-colors ${
        on ? "bg-white/[0.07]" : "bg-white/[0.04] hover:bg-white/[0.08]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${on ? toggleOn : "bg-white/10"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold">{title}</span>
          <span className="text-[10px] text-slate-500">{subtitle}</span>
        </div>
      </div>
      <span className={`h-6 w-10 shrink-0 rounded-full p-1 transition-colors ${on ? toggleOn : "bg-white/15"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
