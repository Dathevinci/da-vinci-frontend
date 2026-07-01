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

import { useNotifications } from "@/hooks/useNotifications";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Persist to notification history
    try {
      const stored = localStorage.getItem("davinci_notifications");
      let current = [];
      if (stored) {
        current = JSON.parse(stored);
      }
      const newNotification = {
        id,
        message,
        type,
        timestamp: Date.now(),
        read: false,
      };
      const updated = [newNotification, ...current].slice(0, 20);
      localStorage.setItem("davinci_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    } catch(e) {}

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -40, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.85, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="pointer-events-auto flex items-center gap-4 px-5 py-3 min-w-[250px] max-w-md rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl border"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                borderColor:
                  t.type === "success"
                    ? "rgba(16, 185, 129, 0.5)"
                    : t.type === "error"
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(99, 102, 241, 0.5)",
              }}
            >
              <div className="shrink-0 flex items-center justify-center">
                {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                {t.type === "error" && <AlertCircle className="w-5 h-5 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                {t.type === "info" && <Info className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
              </div>
              <p className="flex-1 text-sm font-semibold text-white drop-shadow-sm truncate pr-2">
                {t.message}
              </p>
            </motion.div>
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
