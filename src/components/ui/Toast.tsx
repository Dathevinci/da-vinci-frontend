"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATION = 4200; // auto-dismiss (ms); the progress bar tracks this exactly.

const ACCENTS: Record<
  ToastType,
  { icon: string; iconBg: string; border: string; glow: string; Icon: typeof Info }
> = {
  success: { icon: "#34d399", iconBg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.38)", glow: "rgba(16,185,129,0.28)", Icon: CheckCircle2 },
  error:   { icon: "#fb7185", iconBg: "rgba(244,63,94,0.14)",  border: "rgba(244,63,94,0.42)",  glow: "rgba(244,63,94,0.28)",  Icon: AlertCircle },
  info:    { icon: "#a78bfa", iconBg: "rgba(139,92,246,0.16)", border: "rgba(139,92,246,0.44)", glow: "rgba(139,92,246,0.30)", Icon: Info },
};

function ToastItem({ t, onClose }: { t: ToastMessage; onClose: () => void }) {
  const a = ACCENTS[t.type];
  const Icon = a.Icon;

  return (
    <motion.div
      layout
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500) onClose();
      }}
      initial={{ opacity: 0, y: -26, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -14, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 440, damping: 32 }}
      className="pointer-events-auto relative w-[92vw] cursor-grab select-none overflow-hidden rounded-2xl border backdrop-blur-2xl active:cursor-grabbing sm:w-auto sm:min-w-[300px] sm:max-w-md"
      style={{
        backgroundColor: "rgba(10,10,12,0.92)",
        borderColor: a.border,
        boxShadow: `0 18px 50px -12px rgba(0,0,0,0.9), 0 0 24px -8px ${a.glow}`,
      }}
    >
      <div className="flex items-start gap-3 p-3.5 pr-9">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: a.iconBg }}>
          <Icon className="h-5 w-5" style={{ color: a.icon }} />
        </span>
        <p className="flex-1 pt-1 text-sm font-medium leading-snug text-white/95">{t.message}</p>
      </div>

      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Countdown bar — shrinks in lockstep with the auto-dismiss timer. */}
      <motion.span
        className="absolute bottom-0 left-0 right-0 h-[3px] origin-left"
        style={{ backgroundColor: a.icon, opacity: 0.85 }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: DURATION / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Persist to notification history
    try {
      const stored = localStorage.getItem("davinci_notifications");
      let current = [];
      if (stored) current = JSON.parse(stored);
      const newNotification = { id, message, type, timestamp: Date.now(), read: false };
      const updated = [newNotification, ...current].slice(0, 20);
      localStorage.setItem("davinci_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    } catch (e) {}

    setTimeout(() => removeToast(id), DURATION);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-20 z-[9999] flex w-full -translate-x-1/2 flex-col items-center gap-2.5 px-4 sm:w-auto sm:px-0 lg:top-28">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} t={t} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
