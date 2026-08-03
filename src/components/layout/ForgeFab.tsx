"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";

/**
 * THE SYNTHESIZE BUTTON — pinned at the TOP of every screen, red, octagonal,
 * and shaped like nothing else in the UI. It breathes with a slow ember
 * glow always, and PULSES HARD when a valid Mythic synthesis is sitting in
 * the binder (two or more distinct fusion-eligible legendaries), read from
 * the session collection cache so it costs zero network.
 */

// Display-only mirror of FUSION_ELIGIBLE on the server — the machine is the
// gate; this only decides whether the button screams or hums.
const ELIGIBLE = ["card_gatekey", "card_lastronin", "card_leviathan", "card_longmorrow", "card_outergod"];

export default function ForgeFab() {
  const pathname = usePathname();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("davinci_user");
      if (!stored) return;
      const id = JSON.parse(stored)?.id;
      if (!id) return;
      const raw = sessionStorage.getItem(`davinci_col_${id}`);
      if (!raw) return;
      const cards = JSON.parse(raw)?.data?.cards || [];
      const held = ELIGIBLE.filter((e) => cards.some((c: any) => c.cardId === e && c.count > 0));
      setPulse(held.length >= 2);
    } catch { /* no cache — the button just hums */ }
  }, [pathname]);

  // The lab doesn't need a door to itself.
  if (pathname?.startsWith("/forge")) return null;

  return (
    <Link href="/forge" aria-label="Open the Synthesis Lab"
      className={`fixed right-4 top-20 z-[70] flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-white transition hover:brightness-115 lg:top-5 ${pulse ? "ff-pulse" : "ff-hum"}`}
      style={{
        // an octagon — no other button in the app is this shape or this red
        clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
        background: "linear-gradient(160deg, #b91c1c, #7f1d1d)",
        boxShadow: "0 0 0 2px rgba(248,113,113,.55), 0 4px 24px rgba(185,28,28,.5)",
      }}>
      {/* orbiting embers — two sparks riding a slow circle behind the text */}
      <span aria-hidden className="ff-orbit pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-rose-300" />
      <span aria-hidden className="ff-orbit pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-amber-300" style={{ animationDelay: "-1.6s" }} />
      <FlaskConical className={`h-4 w-4 ${pulse ? "ff-tilt" : ""}`} /> Synthesize
      <style jsx global>{`
        .ff-hum { animation: ffHum 3.2s ease-in-out infinite; }
        @keyframes ffHum {
          0%, 100% { box-shadow: 0 0 0 2px rgba(248,113,113,.5), 0 4px 20px rgba(185,28,28,.4); }
          50% { box-shadow: 0 0 0 2px rgba(248,113,113,.7), 0 4px 30px rgba(185,28,28,.65); }
        }
        .ff-pulse { animation: ffPulse 1.4s ease-in-out infinite; }
        @keyframes ffPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(248,113,113,.6), 0 4px 24px rgba(185,28,28,.55); transform: scale(1); }
          50% { box-shadow: 0 0 0 5px rgba(248,113,113,.95), 0 4px 44px rgba(225,29,72,.9); transform: scale(1.04); }
        }
        .ff-orbit { animation: ffOrbit 3.2s linear infinite; }
        @keyframes ffOrbit {
          from { transform: rotate(0deg) translateX(34px); opacity: .9; }
          to { transform: rotate(360deg) translateX(34px); opacity: .9; }
        }
        .ff-tilt { animation: ffTilt 1.4s ease-in-out infinite; }
        @keyframes ffTilt { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-14deg); } }
      `}</style>
    </Link>
  );
}
