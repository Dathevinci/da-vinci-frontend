"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";

/**
 * One-time, frontend-only service notice — works even when the BACKEND is down
 * (unlike MaintenanceOverlay, which asks the backend whether to show itself).
 */
const NOTICE = {
  id: "maintenance-lucid-flix-fallback",
  active: true, // Activated by owner request to provide fallback
  until: Date.parse("2028-01-01T00:00:00Z"), // Long expiry to keep it active
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Service notice"
      className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      <div className="relative w-full max-w-md bg-[#0a0a0a]/90 backdrop-blur-xl border border-rose-500/30 rounded-3xl shadow-[0_20px_80px_rgba(225,29,72,0.25)] p-8 text-center">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>

        <h2 className="text-2xl font-black text-white mb-3 tracking-wide">Server Maintenance</h2>

        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          Da Vinci is currently undergoing scheduled maintenance to bring you a better experience. 
          While we're down, please use our fallback website to continue watching!
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="https://lucid-flix.com/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-colors shadow-lg shadow-rose-600/20"
          >
            Go to Lucid-Flix <ExternalLink className="w-4 h-4" />
          </a>
          
          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-colors"
          >
            I'll wait here
          </button>
        </div>
      </div>
    </div>
  );
}
