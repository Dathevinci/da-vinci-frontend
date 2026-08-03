"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";

/**
 * THE FORGE BUTTON — pinned on every screen, red, and shaped like nothing
 * else in the UI, because it is the primary action the spec wants findable
 * from anywhere. It PULSES when a valid Mythic synthesis is sitting in the
 * binder (two or more distinct fusion-eligible legendaries), read from the
 * session collection cache so it costs zero network.
 */

// Display-only mirror of FUSION_ELIGIBLE on the server — the machine is the
// gate; this only decides whether the button breathes.
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
    } catch { /* no cache — the button just doesn't breathe */ }
  }, [pathname]);

  // The lab doesn't need a door to itself.
  if (pathname?.startsWith("/forge")) return null;

  return (
    <Link href="/forge" aria-label="Open the Synthesis Lab"
      className={`fixed bottom-6 left-5 z-[70] flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-white transition hover:brightness-115 ${pulse ? "ff-pulse" : ""}`}
      style={{
        // an octagon — no other button in the app is this shape or this red
        clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
        background: "linear-gradient(160deg, #b91c1c, #7f1d1d)",
        boxShadow: "0 0 0 2px rgba(248,113,113,.55), 0 4px 24px rgba(185,28,28,.5)",
      }}>
      <FlaskConical className="h-4 w-4" /> Forge
      <style jsx global>{`
        .ff-pulse { animation: ffPulse 1.8s ease-in-out infinite; }
        @keyframes ffPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(248,113,113,.55), 0 4px 24px rgba(185,28,28,.5); }
          50% { box-shadow: 0 0 0 4px rgba(248,113,113,.9), 0 4px 40px rgba(225,29,72,.85); }
        }
      `}</style>
    </Link>
  );
}
