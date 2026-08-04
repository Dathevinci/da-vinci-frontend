"use client";

import { useEffect, useState } from "react";
import { BarChart3, X, Check, Plus } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";

/**
 * POLLS — attached to a forum post, one question, 2-6 options.
 *
 * Two pieces live here: the BUILDER that rides inside the create-post
 * modal, and the CARD that renders on the post itself. Voting is a server
 * call with a verified token; one row per member per poll, so changing
 * your mind moves your vote rather than adding a second one.
 */

export type PollDraft = {
  question: string;
  options: string[];
  closesInHours: number;
};

export type PollData = {
  id: string;
  question: string;
  closesAt: string | null;
  closed: boolean;
  totalVotes: number;
  myOptionId: string | null;
  options: { id: string; text: string; votes: number }[];
};

export const EMPTY_POLL: PollDraft = { question: "", options: ["", ""], closesInHours: 0 };

/** Is this draft complete enough to attach? Mirrors the server's rule. */
export function pollIsValid(p: PollDraft | null): boolean {
  if (!p) return false;
  return p.question.trim().length > 0 && p.options.filter((o) => o.trim().length > 0).length >= 2;
}

// ── THE BUILDER ────────────────────────────────────────────────────────────

export function PollBuilder({
  value,
  onChange,
  onRemove,
  onInsert,
}: {
  value: PollDraft;
  onChange: (p: PollDraft) => void;
  onRemove: () => void;
  onInsert?: () => void;
}) {
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const rawDuration = unit === "days" ? value.closesInHours / 24 : value.closesInHours;

  const setDuration = (n: number, u: "hours" | "days") => {
    const hours = u === "days" ? n * 24 : n;
    onChange({ ...value, closesInHours: Number.isFinite(hours) && hours > 0 ? hours : 0 });
  };

  const setOption = (i: number, text: string) => {
    const options = [...value.options];
    options[i] = text;
    onChange({ ...value, options });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-indigo-300">
          <BarChart3 className="h-3.5 w-3.5" /> New poll
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove poll"
          className="rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        value={value.question}
        onChange={(e) => onChange({ ...value, question: e.target.value.slice(0, 200) })}
        placeholder="Ask a question..."
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-400/50"
      />

      <div className="mt-2 flex flex-col gap-2">
        {value.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              onChange={(e) => setOption(i, e.target.value.slice(0, 120))}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-400/50"
            />
            {value.options.length > 2 && (
              <button
                type="button"
                onClick={() => onChange({ ...value, options: value.options.filter((_, j) => j !== i) })}
                aria-label={`Remove option ${i + 1}`}
                className="shrink-0 rounded-full p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* how long it runs — 0 means it never closes */}
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Closes in</span>
        <input
          type="number"
          min={0}
          value={rawDuration || 0}
          onChange={(e) => setDuration(Number(e.target.value), unit)}
          className="w-16 rounded-lg border border-white/10 bg-black/50 px-2 py-1 font-mono text-sm text-white outline-none focus:border-indigo-400/50"
        />
        <select
          value={unit}
          onChange={(e) => {
            const u = e.target.value as "hours" | "days";
            setUnit(u);
            setDuration(rawDuration || 0, u);
          }}
          className="rounded-lg border border-white/10 bg-[#101018] px-2 py-1 font-mono text-sm text-white outline-none focus:border-indigo-400/50"
        >
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
        {!value.closesInHours && <span className="font-mono text-xs text-slate-500">(never)</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {value.options.length < 6 ? (
          <button
            type="button"
            onClick={() => onChange({ ...value, options: [...value.options, ""] })}
            className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-400 transition hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
        ) : (
          <span className="font-mono text-xs text-slate-600">Six options is the limit</span>
        )}

        {onInsert && (
          <button
            type="button"
            onClick={onInsert}
            disabled={!pollIsValid(value)}
            className="rounded-xl bg-indigo-500 px-5 py-2 font-mono text-xs font-black text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Insert
          </button>
        )}
      </div>
    </div>
  );
}

// ── THE CARD ───────────────────────────────────────────────────────────────

function closesLabel(poll: PollData): string {
  if (!poll.closesAt) return "";
  const ms = new Date(poll.closesAt).getTime() - Date.now();
  if (ms <= 0) return "Closed";
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

export function PollCard({ poll, onUpdate }: { poll: PollData; onUpdate?: (p: PollData) => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<PollData>(poll);

  // Re-seed when the parent hands down a genuinely different poll (a feed
  // refetch, or this card being recycled for another post) — otherwise the
  // first poll's tallies stay on screen under the new question.
  useEffect(() => { setLocal(poll); }, [poll.id]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const voted = !!local.myOptionId;
  // Results show once you've voted or once it's closed — otherwise the
  // running tally nudges people toward whatever is already winning.
  const showResults = voted || local.closed;
  const label = closesLabel(local);

  const vote = async (optionId: string) => {
    if (!user) return toast("Sign in to vote.", "error");
    if (local.closed || busy) return;
    // Re-tapping the option you already hold is a no-op. Without this the
    // optimistic block increments it again without decrementing anything,
    // so the tallies briefly sum past the total and render "200%".
    if (local.myOptionId === optionId) return;
    setBusy(true);
    const previous = local;
    // optimistic: move my vote, adjust both tallies
    setLocal((p) => {
      const had = p.myOptionId;
      return {
        ...p,
        myOptionId: optionId,
        totalVotes: had ? p.totalVotes : p.totalVotes + 1,
        options: p.options.map((o) => ({
          ...o,
          votes: o.id === optionId ? o.votes + 1 : o.id === had ? Math.max(0, o.votes - 1) : o.votes,
        })),
      };
    });
    try {
      const res = await fetch(`${API_URL}/api/polls/${local.id}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Vote failed");
      const next = { ...local, ...data.data };
      setLocal(next);
      onUpdate?.(next);
    } catch (err: any) {
      setLocal(previous);
      toast(err?.message || "Couldn't record that vote.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3.5">
      <p className="flex items-start gap-2 font-mono text-sm font-black text-white">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
        {local.question}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {local.options.map((o) => {
          const pct = local.totalVotes > 0 ? Math.round((o.votes / local.totalVotes) * 100) : 0;
          const mine = local.myOptionId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={busy || local.closed}
              onClick={() => vote(o.id)}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition ${
                mine ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
              } ${local.closed ? "cursor-default" : ""}`}
            >
              {/* the fill sits UNDER the label, never over it */}
              {showResults && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-indigo-500/15 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 font-mono text-sm text-slate-200">
                  {mine && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-300" />}
                  <span className="truncate">{o.text}</span>
                </span>
                {showResults && (
                  <span className="shrink-0 font-mono text-xs font-black text-slate-300">{pct}%</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 font-mono text-[11px] text-slate-500">
        {local.totalVotes} {local.totalVotes === 1 ? "vote" : "votes"}
        {label && ` · ${label}`}
        {!voted && !local.closed && " · pick one to see results"}
      </p>
    </div>
  );
}
