"use client";

import Link from "next/link";
import { Swords, Sparkles } from "lucide-react";
import { arenaEffect, GRADE_STYLE } from "@/data/arenaEffects";
import { ArenaPreview } from "./ArenaBackdrop";

/**
 * The "duel with arena effects?" switch, shown to BOTH players — the challenger
 * when sending and the opponent when accepting.
 *
 * Consent is per-duel and mutual: the server only dresses the board if both
 * boxes came back ticked. Someone with no arena equipped can still tick it —
 * their yes then just means "I'm happy to play under yours".
 */
export default function ArenaOptIn({
  value,
  onChange,
  equippedId,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  equippedId?: string | null;
}) {
  const fx = arenaEffect(equippedId);
  const g = fx ? GRADE_STYLE[fx.grade] : null;

  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        value ? "border-purple-400/50 bg-purple-500/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-black text-white">
            <Swords className="h-3.5 w-3.5 text-purple-400" />
            Duel with arena effects
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
            Only applies if <b className="text-slate-300">both</b> of you agree. If you each bring one, the rarer
            arena is what you play under. Effects never change damage or turn order.
          </span>
        </span>

        {fx && (
          <span className="hidden shrink-0 items-center gap-2 sm:flex">
            <ArenaPreview effectId={fx.id} className="h-12 w-20 rounded-lg border border-white/10" />
            <span className="text-right">
              <span className={`block text-xs font-black ${g!.text}`}>{fx.name}</span>
              <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-black tracking-widest ${g!.chip}`}>
                {g!.label}
              </span>
            </span>
          </span>
        )}
      </label>

      {value && !fx && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-purple-400" />
          You don&apos;t have an arena equipped, so you&apos;ll be playing under theirs.{" "}
          <Link href="/shop" className="font-bold text-purple-400 underline-offset-2 hover:underline">
            Get one in the Arise Shop
          </Link>
          .
        </p>
      )}
    </div>
  );
}
