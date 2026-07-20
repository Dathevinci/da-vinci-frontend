"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Diamond, ExternalLink, Copy, Check, Info } from "lucide-react";
import { KOFI_BUNDLES, currencySymbol } from "@/lib/kofiBundles";

// Money → Arise Points. Real money tops up AP (via Ko-fi); AP then buys any shop
// item. The webhook credits the points automatically once Ko-fi confirms the
// payment — as long as the buyer puts their username in the Ko-fi note.
export default function BuyPointsModal({ username, onClose }: { username: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; the name is shown anyway */
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="bp-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative w-full max-w-2xl bg-[#0b0b12] border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                <Diamond className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black">Buy Arise Points</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Top up with Ko-fi and spend your points on any frame or effect in the shop. Points are added automatically after payment.
            </p>

            {/* Username reminder — the critical step */}
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <Info className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-amber-100 font-semibold mb-2">
                  Important: in the Ko-fi <span className="underline">message/note</span>, write your username so the points reach your account:
                </p>
                <button
                  onClick={copyName}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-black/30 px-3 py-1.5 text-sm font-black text-amber-200 transition hover:bg-black/50"
                  title="Copy your username"
                >
                  {username || "your-username"}
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 opacity-70" />}
                </button>
              </div>
            </div>

            {/* Bundle grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KOFI_BUNDLES.map((b) => (
                <a
                  key={b.price}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-purple-500/50 hover:bg-white/[0.06]"
                >
                  {b.badge && (
                    <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow">
                      {b.badge}
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 text-lg font-black text-white">
                      <Diamond className="w-4 h-4 text-fuchsia-400" />
                      {b.ap.toLocaleString()} AP
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{b.label}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black text-purple-300">
                      {currencySymbol(b.currency)}
                      {b.price}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-purple-300 transition">
                      Ko-fi <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              Payments are handled securely by Ko-fi. Points usually arrive within a minute of payment.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
