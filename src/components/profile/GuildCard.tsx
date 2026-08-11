"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Gem, Shield, Sparkles, Users } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD PLAQUE — a profile's allegiance as a full-width horizontal bar.
 *
 * A designed section, not a floating box: it leads the profile's content
 * column at every breakpoint, banner as a dimmed cover when the guild has
 * one, crest → name → stats reading left to right like a letterhead.
 *
 * Asks the public GET /api/guilds/of/:userId (no auth — anyone's profile can
 * show anyone's guild) and, in the profile page's established manner, renders
 * NOTHING when the answer is null or the network fails: guildless profiles
 * simply have no plaque, not an empty box.
 *
 * The whole bar links to the guild hall. Role chips reuse the guild page
 * member-strip iconography exactly: amber Crown for the leader, violet Shield
 * for the co-leader, a plain chip for everyone else. Shards wear cyan with the
 * Gem — the forge's treasury colour — so Level's emerald stays its own.
 */

type GuildOf = {
  id: string;
  name: string;
  tag: string;
  avatar: string | null;
  banner: string | null;
  level: number;
  xp: number;
  shards: number;
  memberCount: number;
  role: "leader" | "co-leader" | "member";
  joinedAt: string;
};

/** "just now" / "3d ago" / "2mo ago" — the guild page's own clock. */
const joinedAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

export default function GuildCard({ userId, className = "" }: { userId: string; className?: string }) {
  const [guild, setGuild] = useState<GuildOf | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setGuild(null);
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/guilds/of/${encodeURIComponent(userId)}`);
        const d = await r.json();
        if (alive && d?.success && d.data) setGuild(d.data);
      } catch {
        /* offline or guildless — the plaque quietly stays away */
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!guild) return null;

  return (
    <Link
      href={`/guild/${encodeURIComponent(guild.id)}`}
      className={`group relative block overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#0b0b11] font-mono transition hover:border-emerald-400/50 ${className}`}
    >
      {/* Backdrop: the banner as a dimmed cover when the guild has one,
          else a quiet emerald-tinted dark wash. The left-to-right gradient
          keeps the reading edge dark where the crest and name sit. */}
      {guild.banner ? (
        <span aria-hidden className="absolute inset-0">
          <img src={guild.banner} alt="" loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
        </span>
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(115deg,rgba(16,185,129,0.14),rgba(11,11,17,0.92)_45%,rgba(16,185,129,0.08))]"
        />
      )}

      {/* One row on desktop (~5rem tall); below sm the stat chips wrap onto
          their own line under the name instead of overflowing the bar. */}
      <div className="relative flex min-h-[5rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left sm:flex-nowrap">
        {guild.avatar ? (
          <img src={guild.avatar} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-emerald-400/30" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-900/60 text-lg font-black text-emerald-200 ring-1 ring-emerald-400/25">
            {guild.name?.[0]?.toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 max-w-full truncate text-sm font-black text-white sm:text-base">{guild.name}</span>
            <span className="shrink-0 text-[10px] font-black tracking-[0.16em] text-emerald-300">[{guild.tag}]</span>
            {guild.role === "leader" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
                <Crown className="h-2.5 w-2.5" /> Leader
              </span>
            ) : guild.role === "co-leader" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">
                <Shield className="h-2.5 w-2.5" /> Co-leader
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">
                Member
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[9px] text-slate-400">joined {joinedAgo(guild.joinedAt)}</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
            <Sparkles className="h-2.5 w-2.5" /> Lv {guild.level}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">
            <Gem className="h-2.5 w-2.5" /> {guild.shards.toLocaleString()} shards
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
            <Users className="h-2.5 w-2.5" /> {guild.memberCount}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" />
        </div>
      </div>
    </Link>
  );
}
