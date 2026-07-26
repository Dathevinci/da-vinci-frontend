"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Flame, Gift, Swords, ChevronDown } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";

/**
 * Daily quests card — bonus Arise Points for things users already do.
 *
 * Progress is computed server-side from the points ledger, so this component
 * only renders what it's told and never decides whether a quest is finished.
 * Claiming re-verifies on the server too; a tampered payload just gets a 400.
 *
 * Renders nothing at all when signed out, and nothing until the first fetch
 * resolves, so it can't flash an empty shell on the dashboard.
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
    // One tick a minute — this sits on the dashboard, it doesn't need a seconds hand.
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

export default function DailyQuests() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<QuestData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const resetsIn = useCountdown(data?.resetsAt);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/quests`, { headers: authHeaders() });
      const json = await res.json();
      if (json?.success) setData(json.data);
    } catch {
      // Silent: a dashboard card shouldn't throw a toast at you on page load.
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
      if (!json?.success) {
        toast(json?.message || "Couldn't claim that.", "error");
      } else {
        toast(`+${ap} Arise Points`, "success");
        // Refetch rather than patching locally — the server owns progress, the
        // all-clear bonus unlocking, and the streak.
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
  const anyClaimable = data.quests.some((q) => q.claimable) || data.bonus.claimable;

  return (
    <section className="mb-10">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-600/[0.07] via-white/[0.02] to-transparent p-4 sm:p-5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-purple-500/25 bg-purple-500/15">
            <Swords className="h-5 w-5 text-purple-300" />
            {anyClaimable && (
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#050505]" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white sm:text-lg">Daily Quests</h2>
              {data.streak > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-orange-400/25 bg-orange-500/15 px-2 py-0.5 text-[10px] font-black text-orange-300">
                  <Flame className="h-3 w-3" /> {data.streak} day{data.streak === 1 ? "" : "s"}
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              {claimedCount}/{data.quests.length} claimed
              {resetsIn ? <> · resets in {resetsIn}</> : null}
            </span>
          </span>

          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.quests.map((q) => {
                  const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        q.claimed
                          ? "border-white/5 bg-white/[0.02]"
                          : q.claimable
                          ? "border-emerald-400/30 bg-emerald-500/[0.06]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-bold ${q.claimed ? "text-slate-500" : "text-white"}`}>
                            {q.label}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{q.hint}</p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-black tabular-nums text-amber-300">+{q.ap}</span>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-600">AP</span>
                        </span>
                      </div>

                      {/* The check-in has nothing to measure, so it gets a button
                          rather than a 0/1 bar that reads as unfinished. */}
                      {q.target > 1 && (
                        <div className="mt-2.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                q.complete ? "bg-emerald-400" : "bg-purple-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] tabular-nums text-slate-600">
                            {q.progress}/{q.target}
                          </p>
                        </div>
                      )}

                      <div className="mt-2.5">
                        {q.claimed ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400/70">
                            <Check className="h-3.5 w-3.5" /> Claimed
                          </span>
                        ) : q.claimable ? (
                          <button
                            onClick={() => claim(q.id, q.ap)}
                            disabled={busy === q.id}
                            className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {busy === q.id ? "Claiming…" : "Claim"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600">In progress</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All-clear bonus */}
              <div
                className={`mt-2 flex items-center gap-3 rounded-xl border p-3 ${
                  data.bonus.claimed
                    ? "border-white/5 bg-white/[0.02]"
                    : data.bonus.claimable
                    ? "border-amber-400/30 bg-amber-500/[0.07]"
                    : "border-dashed border-white/10 bg-white/[0.02]"
                }`}
              >
                <Gift className={`h-4 w-4 shrink-0 ${data.bonus.claimable ? "text-amber-300" : "text-slate-600"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${data.bonus.claimed ? "text-slate-500" : "text-white"}`}>
                    Clear them all
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Claim every quest above for a bonus <span className="font-bold text-amber-300">+{data.bonus.ap} AP</span>
                  </p>
                </div>
                {data.bonus.claimed ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-emerald-400/70">
                    <Check className="h-3.5 w-3.5" /> Claimed
                  </span>
                ) : (
                  <button
                    onClick={() => claim(data.bonus.id, data.bonus.ap)}
                    disabled={!data.bonus.claimable || busy === data.bonus.id}
                    className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-600"
                  >
                    {busy === data.bonus.id ? "Claiming…" : "Claim bonus"}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
