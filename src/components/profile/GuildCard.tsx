"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Gem, Shield, Sparkles, Users } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
        /* offline or guildless */
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!guild) return null;

  return (
    <Link
      href={`/guild/${encodeURIComponent(guild.id)}`}
      className={`group relative block overflow-hidden rounded-3xl border border-emerald-400/20 bg-[#0b0b11]/90 font-mono transition-all duration-300 hover:border-emerald-400/50 hover:shadow-2xl shadow-lg backdrop-blur-xl ${className}`}
    >
      {/* Backdrop */}
      {guild.banner ? (
        <span aria-hidden className="absolute inset-0">
          <img src={guild.banner} alt="" loading="lazy" className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/40" />
        </span>
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(115deg,rgba(16,185,129,0.18),rgba(11,11,17,0.94)_50%,rgba(16,185,129,0.10))]"
        />
      )}

      <div className="relative flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 px-5 py-4 sm:px-6 sm:py-5 text-left">
        {/* Guild Crest */}
        {guild.avatar ? (
          <img
            src={guild.avatar}
            alt=""
            className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl object-cover ring-2 ring-emerald-400/30 shadow-lg transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-14 w-14 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-2xl bg-emerald-900/60 font-fell text-2xl font-black text-emerald-200 ring-2 ring-emerald-400/25 shadow-lg">
            {guild.name?.[0]?.toUpperCase()}
          </span>
        )}

        {/* Guild Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="min-w-0 max-w-full truncate font-fell text-lg sm:text-2xl font-bold uppercase tracking-wider text-white group-hover:text-emerald-300 transition-colors">
              {guild.name}
            </h3>
            <span className="shrink-0 rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-black tracking-widest text-emerald-300">
              [{guild.tag}]
            </span>
            {guild.role === "leader" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-300 shadow-sm">
                <Crown className="h-3 w-3" /> Leader
              </span>
            ) : guild.role === "co-leader" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-violet-300 shadow-sm">
                <Shield className="h-3 w-3" /> Co-leader
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/[0.06] px-3 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-300">
                Member
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">Joined {joinedAgo(guild.joinedAt)}</p>
        </div>

        {/* Stat Pills */}
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200 shadow-sm">
            <Sparkles className="h-3 w-3 text-emerald-300" /> Lv {guild.level}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-200 shadow-sm">
            <Gem className="h-3 w-3 text-cyan-300" /> {guild.shards.toLocaleString()} shards
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-300 shadow-sm">
            <Users className="h-3 w-3 text-slate-400" /> {guild.memberCount} members
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-emerald-300" />
        </div>
      </div>
    </Link>
  );
}
