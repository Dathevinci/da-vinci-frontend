"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePreferences } from "@/hooks/usePreferences";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { Moon, Sun, PlayCircle, EyeOff, Zap, Lock, Unlock } from "lucide-react";

interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ControlCenter({ isOpen, onClose }: ControlCenterProps) {
  const { theme, toggleTheme } = useTheme();
  const { preferences, updatePreference } = usePreferences();
  const { user, loginOrRegister } = useUser();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: newPrivacy })
      });
      toast(`Profile is now ${newPrivacy ? 'Private' : 'Public'}`, "success");
      // Optionally sync user state if loginOrRegister supports it without auth redirect
    } catch (err) {
      setIsPrivate(!newPrivacy);
      toast("Failed to update privacy", "error");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-20 right-4 md:right-8 w-80 sm:w-96 bg-black/70 backdrop-blur-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-3xl p-4 z-[100] flex flex-col gap-4 text-white overflow-hidden max-h-[85vh]"
        >
          {/* Quick Toggles Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className={`flex flex-col p-4 rounded-2xl transition-colors ${theme === 'dark' ? 'bg-indigo-600/90 hover:bg-indigo-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white/20'}`}>
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <span className="text-sm font-semibold text-left">Theme</span>
              <span className="text-[10px] text-white/70 text-left">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            {/* Privacy Toggle */}
            <button 
              onClick={togglePrivacy}
              className={`flex flex-col p-4 rounded-2xl transition-colors ${isPrivate ? 'bg-rose-600/90 hover:bg-rose-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 bg-white/20`}>
                {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <span className="text-sm font-semibold text-left">Privacy</span>
              <span className="text-[10px] text-white/70 text-left">{isPrivate ? 'Private' : 'Public'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Cinematic */}
            <button 
              onClick={() => updatePreference('autoplayTrailers', !preferences.autoplayTrailers)}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${preferences.autoplayTrailers ? 'bg-purple-600/90 hover:bg-purple-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <PlayCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold">Autoplay</span>
            </button>

            {/* Safe Browsing */}
            <button 
              onClick={() => updatePreference('blurSensitiveContent', !preferences.blurSensitiveContent)}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${preferences.blurSensitiveContent ? 'bg-emerald-600/90 hover:bg-emerald-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <EyeOff className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold">Safe Browse</span>
            </button>
          </div>

          {/* Sliders Area (Reduced Motion Toggle masquerading as a wide button) */}
          <button 
            onClick={() => updatePreference('reducedMotion', !preferences.reducedMotion)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${preferences.reducedMotion ? 'bg-amber-600/90 hover:bg-amber-500' : 'bg-white/10 hover:bg-white/20'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold">Performance Mode</span>
                <span className="text-[10px] text-white/70">Reduces animations & 3D effects</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${preferences.reducedMotion ? 'bg-white/30' : 'bg-white/10'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${preferences.reducedMotion ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
