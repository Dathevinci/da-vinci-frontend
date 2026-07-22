"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * One-time, frontend-only service notice — works even when the BACKEND is down
 * (unlike MaintenanceOverlay, which asks the backend whether to show itself).
 *
 * To REMOVE it once the incident is over: set `active: false` (or let `until`
 * pass) and redeploy. To post a DIFFERENT notice later: change `id` so everyone
 * sees the new one even if they dismissed the old.
 */
const NOTICE = {
  id: "render-outage-2026-07-21",
  active: false, // ← outage resolved 2026-07-21; flip to true (+ bump id/message) to reuse

  // Safety net: auto-hides after this instant even if we forget to flip it off.
  until: Date.parse("2026-07-24T00:00:00Z"),
};

export default function ServiceNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!NOTICE.active || Date.now() > NOTICE.until) return;
    try {
      if (localStorage.getItem(`davinci_notice_${NOTICE.id}`)) return;
    } catch {
      /* ignore */
    }
    setShow(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(`davinci_notice_${NOTICE.id}`, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    // z is BELOW the splash (99999) so the intro plays uncovered, then this is
    // revealed — but above everything else, including the invite gate.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Service notice"
      className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md bg-[#131009] border border-amber-500/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-6 text-center">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>

        <h2 className="text-xl font-black text-white mb-2">Some features are temporarily down</h2>

        <p className="text-slate-300 text-sm leading-relaxed mb-2">
          Our hosting provider (<b className="text-amber-300">Render</b>) is having an outage, so
          <b className="text-white"> signing in, profiles, comments, Arise Points, and saving to your library</b> may
          not work right now.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mb-5">
          Browsing anime, manhwa &amp; novels still works. This is on Render&apos;s end — it&apos;ll recover on its own.
          Thanks for your patience&nbsp;🙏
        </p>

        <button
          onClick={dismiss}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
