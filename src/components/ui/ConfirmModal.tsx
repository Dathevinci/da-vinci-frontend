"use client";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  /**
   * Is this action DESTRUCTIVE? Red is reserved for things that cannot be
   * undone. Defaults true so every existing caller — all of which delete
   * something — keeps exactly the treatment it had.
   */
  danger?: boolean;
}

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", danger = true }: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.09] p-6 shadow-2xl"
            style={{ background: "linear-gradient(165deg, #16161a 0%, #101012 55%, #0a0a0c 100%)" }}
          >
            {/* The top rule is the ONLY colour in the sheet, and only when the
                action is genuinely destructive. Everything else is white on
                near-black, matching the rest of the app.
                This modal used to be red no matter what it asked — which was
                fine while it only ever deleted a forum post, and wrong the
                moment it started confirming purchases too. A pull dressed as
                a deletion tells the player the wrong thing before they have
                read a word. */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: danger
                  ? "linear-gradient(90deg, transparent, #f87171, transparent)"
                  : "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)",
              }}
            />

            <div className="flex items-start gap-4">
              <div
                className="shrink-0 rounded-full p-3"
                style={{
                  background: danger ? "rgba(248,113,113,.10)" : "rgba(255,255,255,.06)",
                  boxShadow: `inset 0 0 0 1px ${danger ? "rgba(248,113,113,.32)" : "rgba(255,255,255,.14)"}`,
                }}
              >
                <AlertTriangle className={`h-5 w-5 ${danger ? "text-red-400" : "text-slate-200"}`} />
              </div>
              <div>
                <h3 className="mb-1 text-lg font-black tracking-tight text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{message}</p>
              </div>
            </div>

            {/* CANCEL IS NEVER HARDER THAN COMMIT. Both buttons are the same
                size and equally reachable; only the fill differs. */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 font-bold text-white transition hover:bg-white/[0.09]"
              >
                {cancelText}
              </button>
              <button
                onClick={() => { onConfirm(); onCancel(); }}
                className={`flex-1 rounded-xl py-2.5 font-bold transition ${
                  danger
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-500"
                    : "bg-white text-[#0a0a0c] hover:bg-slate-200"
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
