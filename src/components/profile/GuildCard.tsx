"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Gem, Shield, Sparkles, Users } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD PLAQUE — a profile's allegiance, in one compact card.
 *
 * Asks the public GET /api/guilds/of/:userId (no auth — anyone's profile can
 * show anyone's guild) and, in the profile page's established manner, renders
 * NOTHING when the answer is null or the network fails: guildless profiles
 * simply have no plaque, not an empty box.
 *
 * The whole card links to the guild hall. Role chips reuse the guild page
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
      className={`group relative block overflow-hidden rounded-2xl border border-emerald-400/25 bg-[#0b0b11] font-mono transition hover:border-emerald-400/50 ${className}`}
    >
      {guild.banner && (
        <span aria-hidden className="absolute inset-0">
          <img src={guild.banner} alt="" loading="lazy" className="h-full w-full object-cover opacity-40" />
          <span className="absolute inset-0 bg-gradient-to-r from-[#0b0b11]/95 via-[#0b0b11]/75 to-[#0b0b11]/45" />
        </span>
      )}

      <div className="relative p-3.5 text-left">
        <div className="flex items-center gap-2.5">
          {guild.avatar ? (
            <img src={guild.avatar} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-emerald-400/30" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-900/60 text-base font-black text-emerald-200 ring-1 ring-emerald-400/20">
              {guild.name?.[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {guild.name}{" "}
              <span className="text-[10px] font-black tracking-[0.16em] text-emerald-300">[{guild.tag}]</span>
            </p>
            <div className="mt-1">
              {guild.role === "leader" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
                  <Crown className="h-2.5 w-2.5" /> Leader
                </span>
              ) : guild.role === "co-leader" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">
                  <Shield className="h-2.5 w-2.5" /> Co-leader
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">
                  Member
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
            <Sparkles className="h-2.5 w-2.5" /> Lv {guild.level}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">
            <Gem className="h-2.5 w-2.5" /> {guild.shards.toLocaleString()} shards
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
            <Users className="h-2.5 w-2.5" /> {guild.memberCount}
          </span>
        </div>

        <p className="mt-2 text-[9px] text-slate-500">joined {joinedAgo(guild.joinedAt)}</p>
      </div>
    </Link>
  );
}
