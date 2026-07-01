"use client";

import { useUser } from "@/hooks/useUser";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ShieldAlert, Zap, ServerCrash, X, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function GodModeConsole() {
  const { user, isLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check initial maintenance status
    fetch('/api/system/maintenance')
      .then(res => res.json())
      .then(data => setIsMaintenance(data.enabled))
      .catch(() => {});
  }, []);

  if (!isLoaded || user?.username.toLowerCase() !== "dejavuh") return null;

  const toggleMaintenance = async () => {
    try {
      const res = await fetch('/api/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isMaintenance, secret: "GODMODE_OVERRIDE" })
      });
      const data = await res.json();
      setIsMaintenance(data.enabled);
      toast(`Maintenance Mode: ${data.enabled ? "ON" : "OFF"}`, data.enabled ? "error" : "success");
    } catch (e) {
      toast("Failed to toggle maintenance", "error");
    }
  };

  const grantPoints = async () => {
    try {
      toast("Granted +10,000 Arise Points!", "success");
      // MOCK: In a real scenario we'd do a fetch to backend.
      if (user) {
         user.arisePoints = (user.arisePoints || 0) + 10000;
      }
    } catch (e) {
      toast("Failed to grant points", "error");
    }
  };

  const nukeCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast("Local caches nuked. Reloading...", "success");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            drag
            dragConstraints={{ left: 0, top: 0, right: 0, bottom: 0 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed z-[9999] bottom-24 right-6 w-14 h-14 bg-gradient-to-tr from-purple-600 to-amber-500 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.6)] cursor-pointer flex items-center justify-center border-2 border-amber-300/50"
          >
            <Terminal className="w-6 h-6 text-white" />
          </motion.div>
        )}

        {isOpen && (
          <motion.div
            drag
            dragConstraints={{ left: -500, top: -500, right: 50, bottom: 50 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed z-[9999] bottom-24 right-6 w-72 bg-[#09090b]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.2)] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900/40 to-amber-900/40 border-b border-purple-500/20 px-4 py-3 flex items-center justify-between cursor-move">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400 uppercase">God Mode Console</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col gap-3">
              
              <button 
                onClick={toggleMaintenance}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm transition-all border ${isMaintenance ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-slate-800/50 border-white/5 text-slate-300 hover:bg-slate-800'}`}
              >
                <ServerCrash className="w-4 h-4" />
                {isMaintenance ? "Disable Maintenance" : "Trigger Maintenance"}
              </button>

              <button 
                onClick={grantPoints}
                className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-xl font-bold text-sm transition-all"
              >
                <Zap className="w-4 h-4" />
                Grant +10K Arise
              </button>

              <button 
                onClick={nukeCache}
                className="flex items-center gap-3 w-full px-4 py-3 bg-slate-800/50 border border-white/5 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl font-bold text-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Nuke Local Cache
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
