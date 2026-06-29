"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Moon, Sun, Lock, Unlock, Save } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface SettingsModalProps {
  user: any;
  onClose: () => void;
  onUpdate: (data: any) => void;
}

export default function SettingsModal({ user, onClose, onUpdate }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
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
          className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">Profile Settings</h2>

          <div className="space-y-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-orange-400" />}
                  App Theme
                </h3>
                <p className="text-xs text-slate-500 mt-1">Switch between Light and Dark mode.</p>
              </div>
              <button 
                onClick={toggleTheme}
                className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 transition text-slate-800 dark:text-white"
              >
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </button>
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {isPrivate ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-green-400" />}
                  Private Profile
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Hide your watchlist, bio, and banner from non-followers.</p>
              </div>
              <button 
                onClick={() => setIsPrivate(!isPrivate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
