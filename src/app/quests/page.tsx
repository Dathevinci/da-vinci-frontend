"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Swords, Flame, RefreshCw, Diamond, Clock } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import DailyQuests from "@/components/quests/DailyQuests";
import { useUser } from "@/hooks/useUser";
import { authHeaders } from "@/lib/authToken";

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
      <div className="relative min-h-screen overflow-clip bg-[#050505] pt-24 pb-28 text-white md:pb-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-purple-600/10 blur-[150px]" />

        <div className="relative z-10 mx-auto max-w-4xl px-4">
          <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-purple-500/25 bg-purple-500/15">
                <Swords className="h-5 w-5 text-purple-300" />
              </span>
              <div>
                <h1 className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                  Daily Quests
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">Bonus Arise Points for what you already do.</p>
              </div>
            </div>
          </motion.header>

          {!isLoaded ? (
            <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
          ) : !user ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-slate-400">Sign in to start earning from quests.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Flame className="h-3 w-3" /> Streak
                  </div>
                  <div className="mt-1 text-xl font-black tabular-nums text-orange-300">
                    {meta?.streak ?? 0} <span className="text-xs font-bold text-slate-500">day{meta?.streak === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Clock className="h-3 w-3" /> Progress resets
                  </div>
                  <div className="mt-1 text-xl font-black text-white">Daily</div>
                </div>
                <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:col-span-1">
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

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white transition hover:bg-purple-500"
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
