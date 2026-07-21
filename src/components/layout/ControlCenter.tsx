"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePreferences } from "@/hooks/usePreferences";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { useAppMode, AppMode } from "@/components/providers/AppModeProvider";
import { authHeaders } from "@/lib/authToken";
import {
  Moon, Zap, Lock, Unlock, PlayCircle, EyeOff, Eye,
  Gauge, Wifi, MonitorPlay, BookOpen, Feather, SlidersHorizontal,
} from "lucide-react";

interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

// Per-mode accent — literal class strings so Tailwind's JIT keeps them.
const MODES: Record<AppMode, {
  label: string; Icon: any; solid: string; solidHover: string;
  softText: string; chip: string; dot: string; toggleOn: string;
}> = {
  anime:  { label: "Anime",  Icon: MonitorPlay, solid: "bg-purple-600", solidHover: "hover:bg-purple-500", softText: "text-purple-300", chip: "bg-purple-500/15 border-purple-500/30 text-purple-200", dot: "bg-purple-400", toggleOn: "bg-purple-500" },
  manhwa: { label: "Manhwa", Icon: BookOpen,    solid: "bg-red-600",    solidHover: "hover:bg-red-500",    softText: "text-red-300",    chip: "bg-red-500/15 border-red-500/30 text-red-200",       dot: "bg-red-400",    toggleOn: "bg-red-500" },
  novel:  { label: "Novel",  Icon: Feather,     solid: "bg-pink-600",   solidHover: "hover:bg-pink-500",   softText: "text-pink-300",   chip: "bg-pink-500/15 border-pink-500/30 text-pink-200",     dot: "bg-pink-400",   toggleOn: "bg-pink-500" },
};

const MODE_ORDER: AppMode[] = ["anime", "manhwa", "novel"];

export default function ControlCenter({ isOpen, onClose }: ControlCenterProps) {
  const { theme, toggleTheme } = useTheme();
  const { preferences, updatePreference } = usePreferences();
  const { user } = useUser();
  const { toast } = useToast();
  const { mode, setMode } = useAppMode();
  const ref = useRef<HTMLDivElement>(null);

  const accent = MODES[mode];

  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (user && (user as any).isPrivate !== undefined) {
      setIsPrivate((user as any).isPrivate);
    }
  }, [user]);

  const togglePrivacy = async () => {
    if (!user) return;
    const newPrivacy = !isPrivate;
    setIsPrivate(newPrivacy);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      await fetch(`${API_URL}/api/users/${user.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isPrivate: newPrivacy }),
      });
      toast(`Profile is now ${newPrivacy ? "Private" : "Public"}`, "success");
    } catch (err) {
      setIsPrivate(!newPrivacy);
      toast("Failed to update privacy", "error");
    }
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
          className="fixed top-20 right-4 md:right-8 w-[calc(100vw-32px)] sm:w-[400px] bg-[#0b0b0d]/80 backdrop-blur-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-3xl p-4 z-[100] flex flex-col gap-4 text-white overflow-hidden max-h-[85vh] overflow-y-auto"
        >
          {/* ── Header: title + live mode chip ── */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-white/70" />
              <span className="text-sm font-bold tracking-wide">Control Center</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${accent.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
              {accent.label}
            </div>
          </div>

          {/* ── Mode switcher — the one control that spans every mode ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1 mb-1.5">Mode</p>
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
              {MODE_ORDER.map((m) => {
                const c = MODES[m];
                const active = m === mode;
                return (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${active ? `${c.solid} text-white shadow-lg` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
                  >
                    <c.Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Appearance & account ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1 mb-1.5">Appearance</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleTheme}
                className={`flex flex-col p-4 rounded-2xl transition-colors text-left ${theme === "dark" ? `${accent.solid} ${accent.solidHover}` : "bg-white/10 hover:bg-white/20"}`}
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center mb-2 bg-white/20">
                  {theme === "dark" ? <Zap className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </span>
                <span className="text-sm font-semibold">Theme</span>
                <span className="text-[10px] text-white/70">{theme === "dark" ? "Neon Purple" : "Pure Black"}</span>
              </button>

              <button
                onClick={togglePrivacy}
                className={`flex flex-col p-4 rounded-2xl transition-colors text-left ${isPrivate ? "bg-rose-600/90 hover:bg-rose-500" : "bg-white/10 hover:bg-white/20"}`}
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center mb-2 bg-white/20">
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </span>
                <span className="text-sm font-semibold">Privacy</span>
                <span className="text-[10px] text-white/70">{isPrivate ? "Private" : "Public"}</span>
              </button>
            </div>
          </div>

          {/* ── Content (anime library) ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1 mb-1.5">Content</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updatePreference("autoplayTrailers", !preferences.autoplayTrailers)}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${preferences.autoplayTrailers ? `${accent.solid} ${accent.solidHover}` : "bg-white/10 hover:bg-white/20"}`}
              >
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <PlayCircle className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold text-left leading-tight">Autoplay<br /><span className="text-[9px] font-normal text-white/60">Trailers</span></span>
              </button>

              <button
                onClick={() => updatePreference("blurSensitiveContent", !preferences.blurSensitiveContent)}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${preferences.blurSensitiveContent ? "bg-emerald-600/90 hover:bg-emerald-500" : "bg-white/10 hover:bg-white/20"}`}
              >
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  {preferences.blurSensitiveContent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </span>
                <span className="text-xs font-semibold text-left leading-tight">Safe Browse<br /><span className="text-[9px] font-normal text-white/60">Blur mature</span></span>
              </button>
            </div>
          </div>

          {/* ── Performance — the toggles that actually matter for every mode ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1 mb-1.5">Performance</p>
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
      className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-colors ${on ? "bg-white/[0.07]" : "bg-white/[0.04] hover:bg-white/[0.08]"} border border-white/10`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${on ? toggleOn : "bg-white/10"}`}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex flex-col text-left">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-[10px] text-white/60">{subtitle}</span>
        </div>
      </div>
      <span className={`w-10 h-6 rounded-full p-1 shrink-0 transition-colors ${on ? toggleOn : "bg-white/15"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
