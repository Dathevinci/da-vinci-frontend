"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Moon, Sun, Lock, Unlock, Save, PlayCircle, EyeOff, Zap, Wifi } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { usePreferences } from "@/hooks/usePreferences";

interface SettingsModalProps {
  user: any;
  onClose: () => void;
  onUpdate: (data: any) => void;
}

export default function SettingsModal({ user, onClose, onUpdate }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { preferences, updatePreference, isLoaded } = usePreferences();
  const [isPrivate, setIsPrivate] = useState(user.isPrivate || false);
  const [isSaving, setIsSaving] = useState(false);
  
  useLockBodyScroll();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate, theme })
      });
      const data = await res.json();
      if (data.success) {
        onUpdate({ isPrivate, theme });
        onClose();
        toast("Settings saved successfully", "success");
      } else {
        toast(data.message || "Failed to update settings", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Error saving settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-[#09090b] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative max-h-[85vh] flex flex-col"
        >
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-500 hover:text-white transition bg-white/5 hover:bg-white/10 p-2 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-black mb-6 text-white tracking-tight flex-shrink-0">Settings</h2>

          {/* Scrollable Content Area */}
          <div className="overflow-y-auto pr-2 -mr-2 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
            
            {/* Account Section */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-2">Account</h4>
              <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-orange-400" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">App Theme</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Switch between Light and Dark mode.</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className="px-3 py-1.5 rounded-lg font-bold text-xs bg-white/10 hover:bg-white/20 transition text-white"
                  >
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </button>
                </div>

                {/* Privacy Toggle */}
                <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      {isPrivate ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-green-400" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Private Profile</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Hide watchlist and bio from non-followers.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-indigo-600' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-2">App Preferences</h4>
              <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                {/* Cinematic Mode */}
                <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <PlayCircle className={`w-4 h-4 ${preferences.autoplayTrailers ? 'text-indigo-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Cinematic Autoplay</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Auto-play trailers on hover.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updatePreference('autoplayTrailers', !preferences.autoplayTrailers)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.autoplayTrailers ? 'bg-indigo-600' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.autoplayTrailers ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Safe Browsing */}
                <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <EyeOff className={`w-4 h-4 ${preferences.blurSensitiveContent ? 'text-red-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Safe Browsing</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Blur NSFW or sensitive content.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updatePreference('blurSensitiveContent', !preferences.blurSensitiveContent)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.blurSensitiveContent ? 'bg-red-500' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.blurSensitiveContent ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Performance Mode */}
                <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <Zap className={`w-4 h-4 ${preferences.reducedMotion ? 'text-yellow-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Reduced Motion</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Disable heavy 3D shuffles for performance.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updatePreference('reducedMotion', !preferences.reducedMotion)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.reducedMotion ? 'bg-yellow-500' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.reducedMotion ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Data Saver Mode */}
                <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <Wifi className={`w-4 h-4 ${preferences.dataSaver ? 'text-green-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Data Saver</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Load lower resolution images.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updatePreference('dataSaver', !preferences.dataSaver)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.dataSaver ? 'bg-green-500' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.dataSaver ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 flex-shrink-0 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            <Save className="w-5 h-5" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
