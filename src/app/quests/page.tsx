"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Swords, Flame, RefreshCw, Diamond, Clock } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import DailyQuests from "@/components/quests/DailyQuests";
import { useUser } from "@/hooks/useUser";
import { authHeaders } from "@/lib/authToken";
import { notch, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";

/**
 * Dedicated quests page. The board itself is <DailyQuests /> — the same
 * component the dashboard renders, so there is one implementation of claiming
 * and one place progress is drawn.
 *
 * This page adds the surrounding context that doesn't belong on a compact
 * dashboard card: how the two clocks work (daily reset vs the rotating lineup)
 * and where the points go.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function QuestsPage() {
  const { user, isLoaded } = useUser();
  const [meta, setMeta] = useState<{ rotationDays: number; rotatesAt: string; streak: number } | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/quests`, { headers: authHeaders() });
      const json = await res.json();
      if (json?.success) {
        setMeta({ rotationDays: json.data.rotationDays, rotatesAt: json.data.rotatesAt, streak: json.data.streak });
      }
    } catch {
      /* the card below surfaces its own state; no toast on a page load */
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const rotatesIn = (() => {
    if (!meta?.rotatesAt) return null;
    const ms = new Date(meta.rotatesAt).getTime() - Date.now();
    if (ms <= 0) return "any moment";
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  })();

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-clip pt-24 pb-28 text-white md:pb-24"
        style={{
          background:
            "radial-gradient(80% 45% at 50% -5%, rgba(120,86,196,.20), transparent 62%)," +
            "linear-gradient(#0b0716, #070410 60%, #05030c)",
        }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 7px, rgba(255,255,255,.9) 7px 8px)" }} />

        <div className="relative z-10 mx-auto max-w-4xl px-4">
          <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
            <p className="text-[10px] font-black uppercase tracking-[0.42em]" style={{ color: ACCENT }}>
              Da Vinci · Daily
            </p>
            <h1 className="mt-1 flex items-center gap-3 font-fell text-4xl font-bold uppercase tracking-[0.1em] md:text-5xl">
              <Swords className="h-8 w-8 shrink-0" style={{ color: ACCENT }} />
              <span style={{
                background: `linear-gradient(100deg, #fff 10%, ${ACCENT_LIT} 55%, ${ACCENT} 92%)`,
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                filter: `drop-shadow(0 2px 18px ${ACCENT}55)`,
              }}>Daily Quests</span>
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
              Bonus Arise Points for what you already do.
            </p>
          </motion.header>

          {!isLoaded ? (
            <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
          ) : !user ? (
            <div className="p-8 text-center" style={{ clipPath: notch(18), background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
              <p className="text-sm text-slate-400">Sign in to start earning from quests.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="px-4 py-3.5" style={{ clipPath: notch(12), background: "rgba(255,255,255,.035)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Flame className="h-3 w-3" /> Streak
                  </div>
                  <div className="mt-1 text-xl font-black tabular-nums text-orange-300">
                    {meta?.streak ?? 0} <span className="text-xs font-bold text-slate-500">day{meta?.streak === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="px-4 py-3.5" style={{ clipPath: notch(12), background: "rgba(255,255,255,.035)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Clock className="h-3 w-3" /> Progress resets
                  </div>
                  <div className="mt-1 text-xl font-black text-white">Daily</div>
                </div>
                <div className="col-span-2 px-4 py-3.5 sm:col-span-1" style={{ clipPath: notch(12), background: "rgba(255,255,255,.035)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <RefreshCw className="h-3 w-3" /> New lineup
                  </div>
                  <div className="mt-1 text-xl font-black text-fuchsia-300">
                    {rotatesIn ?? "—"}
                    {meta?.rotationDays ? (
                      <span className="ml-1 text-xs font-bold text-slate-500">/ every {meta.rotationDays}d</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* The board. Same component as the dashboard card. */}
              <DailyQuests />

              <div className="p-5" style={{ clipPath: notch(18), background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                <h2 className="text-sm font-black text-white">How it works</h2>
                <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-400">
                  <li>
                    <b className="text-slate-200">Two clocks.</b> Your progress and claims reset every day at midnight UTC.
                    The set of quests itself changes every {meta?.rotationDays ?? 3} days, so the board doesn't go stale.
                  </li>
                  <li>
                    <b className="text-slate-200">Quests stack with normal earning.</b> Watching an episode still pays its
                    usual Arise Points — quest rewards land on top.
                  </li>
                  <li>
                    <b className="text-slate-200">Every board is balanced.</b> One watching goal, one reading goal, one social
                    goal and one that counts both, plus the check-in. You'll never get a lineup you can't complete.
                  </li>
                  <li>
                    <b className="text-slate-200">Clear the board</b> for a bonus on top of the individual rewards.
                  </li>
                </ul>
                <Link
                  href="/shop"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115"
                  style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, )` }}
                >
                  <Diamond className="h-4 w-4" /> Spend your points
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
