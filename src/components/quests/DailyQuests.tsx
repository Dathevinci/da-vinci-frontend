"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Flame, Gift, Swords, Sparkles, Trophy } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";

/**
 * Daily quests board — bonus Arise Points for things users already do.
 *
 * Progress is computed server-side from the points ledger, so this component
 * only renders what it's told and never decides whether a quest is finished.
 * Claiming re-verifies on the server too; a tampered payload just gets a 400.
 * After a claim it REFETCHES rather than patching locally — the server owns
 * progress, the all-clear bonus unlocking, and the streak.
 *
 * Lives on the OWNER'S PROFILE (the old /quests page now redirects there).
 * Renders nothing when signed out and nothing until the first fetch resolves,
 * so it cannot flash an empty shell.
 *
 * Motion notes: everything animates transform/opacity through framer, which
 * the app-wide MotionConfig already gates for Performance Mode — so the burst
 * and the shimmer cost nothing for users who turned effects off.
 */

type Quest = {
  id: string;
  label: string;
  hint: string;
  target: number;
  ap: number;
  xp: number;
  progress: number;
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
};

type QuestData = {
  day: string;
  resetsAt: string;
  streak: number;
  quests: Quest[];
  bonus: { id: string; ap: number; xp: number; claimed: boolean; claimable: boolean };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function useCountdown(iso?: string) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!iso) return;
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) return setLeft("resetting…");
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    // One tick a minute — a countdown chip doesn't need a seconds hand.
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

/** Short-lived sparkle burst over a just-claimed card. */
function ClaimBurst() {
  const dots = [
    [-34, -30], [30, -36], [-42, 10], [40, 16], [-8, -46], [12, 40], [-26, 34], [36, -8],
  ];
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
      {dots.map(([x, y], i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x, y, scale: 0, opacity: 0 }}
          transition={{ duration: 0.7, delay: i * 0.02, ease: "easeOut" }}
          className="absolute h-1.5 w-1.5 rounded-full bg-amber-300"
          style={{ boxShadow: "0 0 10px rgba(252,211,77,0.9)" }}
        />
      ))}
    </div>
  );
}

export default function DailyQuests() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<QuestData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const resetsIn = useCountdown(data?.resetsAt);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/quests`, { headers: authHeaders() });
      const json = await res.json();
      if (json?.success) setData(json.data);
    } catch {
      // Silent: a profile card shouldn't throw a toast at you on page load.
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(questId: string, ap: number) {
    if (!user?.id || busy) return;
    setBusy(questId);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/quests/${questId}/claim`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast(json?.message || "Couldn't claim that.", "error");
      } else {
        toast(`+${ap} Arise Points`, "success");
        setBurst(questId);
        setTimeout(() => setBurst(null), 800);
        await load();
      }
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!isLoaded || !user || !data) return null;

  const claimedCount = data.quests.filter((q) => q.claimed).length;
  const allClaimed = claimedCount === data.quests.length;
  const boardProgress =
    data.quests.reduce((a, q) => a + Math.min(q.progress, q.target) / q.target, 0) / Math.max(1, data.quests.length);

  return (
    <section id="quests" className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-[#0a0812]">
      {/* Ambient wash + drifting glow so the board reads as a place, not a table. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_15%_0%,rgba(139,92,246,0.16),transparent_60%),radial-gradient(50%_90%_at_95%_100%,rgba(217,70,239,0.1),transparent_60%)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/3 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl"
        animate={{ x: [0, 40, -20, 0], opacity: [0.5, 0.9, 0.6, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative p-5 sm:p-7">
        {/* ── header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-400/40 bg-violet-500/15 shadow-[0_0_18px_rgba(139,92,246,0.35)]">
              <Swords className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              {/* Same face Activity History wears — the two panels sit in the
                  same world and should read as siblings. */}
              <h2 className="font-fell bg-gradient-to-r from-violet-200 via-fuchsia-300 to-violet-400 bg-clip-text text-2xl font-bold uppercase tracking-[0.08em] text-transparent">
                Daily Quests
              </h2>
              <p className="text-xs font-bold text-slate-500">
                {claimedCount}/{data.quests.length} claimed · resets in {resetsIn}
              </p>
            </div>
          </div>

          {/* Streak flame — burns brighter the longer it lives. */}
          <div
            className="flex items-center gap-2 rounded-2xl border px-4 py-2"
            style={{
              borderColor: data.streak > 0 ? "rgba(251,146,60,0.45)" : "rgba(255,255,255,0.1)",
              background: data.streak > 0 ? "rgba(251,146,60,0.1)" : "rgba(255,255,255,0.04)",
              boxShadow: data.streak > 2 ? "0 0 22px rgba(251,146,60,0.35)" : "none",
            }}
          >
            <motion.div
              animate={data.streak > 0 ? { scale: [1, 1.18, 1] } : {}}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Flame className={`h-5 w-5 ${data.streak > 0 ? "text-orange-400" : "text-slate-600"}`} />
            </motion.div>
            <div className="leading-tight">
              <div className={`text-lg font-black ${data.streak > 0 ? "text-orange-300" : "text-slate-500"}`}>
                {data.streak}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">day streak</div>
            </div>
          </div>
        </div>

        {/* ── board progress ──────────────────────────────────────────── */}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300"
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(boardProgress * 100)}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 16 }}
          />
        </div>

        {/* ── quest cards ─────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {data.quests.map((q, i) => {
              const pct = Math.round((Math.min(q.progress, q.target) / q.target) * 100);
              return (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 120, damping: 18 }}
                  className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${
                    q.claimed
                      ? "border-emerald-400/25 bg-emerald-500/[0.05]"
                      : q.claimable
                        ? "border-amber-400/45 bg-amber-400/[0.07] shadow-[0_0_24px_rgba(251,191,36,0.15)]"
                        : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {burst === q.id && <ClaimBurst />}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        className={`font-fell text-lg font-bold transition-colors duration-300 ${
                          q.claimed ? "text-emerald-200/80 line-through" : "text-white"
                        }`}
                      >
                        {q.label}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">{q.hint}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-base font-black ${q.claimed ? "text-emerald-300" : "text-amber-300"}`}>
                        +{q.ap}
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">AP</div>
                    </div>
                  </div>

                  {q.target > 1 && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className={`h-full rounded-full ${
                            q.complete
                              ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                              : "bg-gradient-to-r from-violet-500 to-fuchsia-400"
                          }`}
                          initial={false}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 70, damping: 18 }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-500">
                        {Math.min(q.progress, q.target)}/{q.target}
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    {q.claimed ? (
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
                        <Check className="h-4 w-4" /> Claimed
                      </div>
                    ) : q.claimable ? (
                      <motion.button
                        type="button"
                        onClick={() => claim(q.id, q.ap)}
                        disabled={busy === q.id}
                        whileTap={{ scale: 0.96 }}
                        className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2 text-sm font-black uppercase tracking-wide text-black shadow-[0_0_20px_rgba(52,211,153,0.35)] transition hover:brightness-110 disabled:opacity-60"
                      >
                        {/* sheen sweep so a ready claim visibly asks for the tap */}
                        <motion.span
                          aria-hidden
                          className="absolute inset-y-0 w-1/3 bg-white/30"
                          initial={{ x: "-150%", skewX: -18 }}
                          animate={{ x: "350%" }}
                          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
                        />
                        {busy === q.id ? "Claiming…" : "Claim"}
                      </motion.button>
                    ) : (
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600">In progress</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── all-clear bonus ─────────────────────────────────────────── */}
        <motion.div
          layout
          className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border p-4 ${
            data.bonus.claimed
              ? "border-emerald-400/25 bg-emerald-500/[0.05]"
              : data.bonus.claimable
                ? "border-fuchsia-400/50 bg-fuchsia-500/10 shadow-[0_0_28px_rgba(217,70,239,0.25)]"
                : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={data.bonus.claimable && !data.bonus.claimed ? { rotate: [0, -8, 8, 0] } : {}}
              transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.2 }}
            >
              <Gift className={`h-6 w-6 ${data.bonus.claimed ? "text-emerald-400" : "text-fuchsia-300"}`} />
            </motion.div>
            <div>
              <div className="font-fell text-lg font-bold text-white">All-clear bonus</div>
              <div className="text-xs text-slate-500">Claim every quest today and this unlocks on top.</div>
            </div>
          </div>
          {data.bonus.claimed ? (
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
              <Check className="h-4 w-4" /> +{data.bonus.ap} claimed
            </div>
          ) : data.bonus.claimable ? (
            <motion.button
              type="button"
              onClick={() => claim(data.bonus.id, data.bonus.ap)}
              disabled={busy === data.bonus.id}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-2 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(217,70,239,0.4)] transition hover:brightness-110 disabled:opacity-60"
            >
              {busy === data.bonus.id ? "Claiming…" : `Claim +${data.bonus.ap}`}
            </motion.button>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-black text-slate-600">
              <Sparkles className="h-4 w-4" /> +{data.bonus.ap} AP
            </div>
          )}
        </motion.div>

        {allClaimed && data.bonus.claimed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-amber-300"
          >
            <Trophy className="h-4 w-4" /> Board cleared — see you tomorrow
          </motion.div>
        )}
      </div>
    </section>
  );
}
