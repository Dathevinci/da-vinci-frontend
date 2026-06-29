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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

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
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 min-w-[300px] max-w-sm rounded-2xl shadow-2xl backdrop-blur-2xl border"
              style={{
                backgroundColor:
                  t.type === "success"
                    ? "rgba(16, 185, 129, 0.2)"
                    : t.type === "error"
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(99, 102, 241, 0.2)",
                borderColor:
                  t.type === "success"
                    ? "rgba(16, 185, 129, 0.4)"
                    : t.type === "error"
                    ? "rgba(239, 68, 68, 0.4)"
                    : "rgba(99, 102, 241, 0.4)",
              }}
            >
              <div className="shrink-0 bg-white/20 dark:bg-black/20 p-1.5 rounded-full shadow-sm">
                {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                {t.type === "error" && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                {t.type === "info" && <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
              </div>
              <p className="flex-1 text-sm font-bold text-slate-900 dark:text-white drop-shadow-sm">
                {t.message}
              </p>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
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
