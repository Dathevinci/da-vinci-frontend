"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

/**
 * Type-to-confirm dialog for irreversible console actions.
 *
 * The string typed here is sent to the server as `confirmUsername` / `confirm`
 * and re-verified there, so a direct curl gets exactly the same friction as this
 * modal. A client-only confirmation would be decoration.
 */
export default function ConsoleDangerDialog({
  open,
  title,
  body,
  confirmWord,
  confirmLabel = "Confirm",
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmWord: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (typed: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset between openings, otherwise the previous confirmation carries over and
  // the next destructive action is one click away.
  useEffect(() => {
    if (open) {
      setTyped("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const matches = typed.trim().toLowerCase() === confirmWord.trim().toLowerCase();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/25 bg-[#0f0f13] shadow-[0_20px_70px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start gap-3 border-b border-white/10 bg-red-500/[0.07] px-5 py-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-500/25 bg-red-500/15">
                <AlertTriangle className="h-4 w-4 text-red-300" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black tracking-tight text-white">{title}</h3>
                <div className="mt-1 text-[12px] leading-relaxed text-slate-400">{body}</div>
              </div>
              <button
                onClick={() => !busy && onClose()}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Type <span className="text-red-300">{confirmWord}</span> to continue
              </label>
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches && !busy) onConfirm(typed.trim());
                }}
                spellCheck={false}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-red-500/40"
                placeholder={confirmWord}
              />

              <div className="mt-4 flex gap-2">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onConfirm(typed.trim())}
                  disabled={!matches || busy}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900/40 disabled:text-red-300/50"
                >
                  {busy ? "Working…" : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
