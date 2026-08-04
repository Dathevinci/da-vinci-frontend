"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Tv, BookOpen, Feather, Compass, Users, Layers, Swords,
  FlaskConical, Store, Gavel, Trophy, ShoppingBag, Crown, Megaphone,
  Terminal, ArrowUpRight, Sparkles, Diamond, Zap,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { calculateLevel, calculateProgressPercent, MAX_LEVEL } from "@/lib/levels";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";

/**
 * THE HUB — the "where to today?" screen, straight from the owner's
 * reference: a welcome panel with the signed-in card on the right, then
 * every corner of Da Vinci as its own tile. This is where the landing
 * page's Start Watching lands you.
 *
 * It deliberately repeats the Dock sheet's destinations as FULL tiles with
 * descriptions — the sheet is for people who know where they're going, the
 * Hub is for deciding.
 */

type Section = { href: string; label: string; desc: string; Icon: any; tint: string };

const SECTIONS: Section[] = [
  { href: "/",            label: "Anime",            desc: "Watch the latest episodes and classic series.",    Icon: Tv,           tint: "#a274ff" },
  { href: "/manhwa",      label: "Manhwa",           desc: "Read your favourite chapters as they drop.",       Icon: BookOpen,     tint: "#38bdf8" },
  { href: "/novel",       label: "Novels",           desc: "Dive into light novels and web novels.",           Icon: Feather,      tint: "#fbbf24" },
  { href: "/explore",     label: "Explore",          desc: "Search every world at once.",                      Icon: Compass,      tint: "#818cf8" },
  { href: "/community",   label: "Community",        desc: "Connect with your fellow devotees.",               Icon: Users,        tint: "#34d399" },
  { href: "/cards",       label: "Arise Cards",      desc: "Pull heroes, collect prints, forge Mythics.",      Icon: Layers,       tint: "#c084fc" },
  { href: "/duels",       label: "Card Duels",       desc: "Stake your cards and fight.",                      Icon: Swords,       tint: "#f43f5e" },
  { href: "/forge",       label: "Synthesis Lab",    desc: "Fuse legendaries into something greater.",         Icon: FlaskConical, tint: "#ef4444" },
  { href: "/marketplace", label: "Marketplace",      desc: "Trade cards, serials and wears.",                  Icon: Store,        tint: "#22d3ee" },
  { href: "/auctions",    label: "Auction House",    desc: "Bid on the rarest prints.",                        Icon: Gavel,        tint: "#f59e0b" },
  { href: "/quests",      label: "Daily Quests",     desc: "Earn Arise Points every day.",                     Icon: Trophy,       tint: "#fb923c" },
  { href: "/shop",        label: "Shop",             desc: "Frames, effects and flair for your profile.",      Icon: ShoppingBag,  tint: "#e879f9" },
  { href: "/leaderboard", label: "Leaderboard",      desc: "See who tops the community rankings.",             Icon: Crown,        tint: "#7dd3fc" },
  { href: "/updates",     label: "Updates",          desc: "What changed, and what's coming.",                 Icon: Megaphone,    tint: "#94a3b8" },
];

const easeCine: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function HubPage() {
  const { user } = useUser();
  // The InviteOnlyGuard walls this route for guests, so `user` is only
  // briefly null while the session hydrates.
  if (!user) return <div className="min-h-screen bg-[#070709]" />;

  const sections: Section[] = isLeadDev(user)
    ? [...SECTIONS, { href: "/console", label: "Console", desc: "Lead developer controls.", Icon: Terminal, tint: "#a3e635" }]
    : SECTIONS;

  // The SAME level maths as the profile, leaderboard and LevelBadge —
  // src/lib/levels.ts is the one source of truth (max 10, exponential),
  // and staff show maxed exactly like the profile page shows them.
  const xp = (user as any).xp ?? 0;
  const staff = isLeadDev(user) || isAdmin(user);
  const level = staff ? MAX_LEVEL : calculateLevel(xp);
  const progress = staff ? 100 : calculateProgressPercent(xp);
  const roleChip = isLeadDev(user) ? "Lead Dev" : isAdmin(user) ? "Admin" : "Member";

  return (
    <div className="min-h-screen bg-[#070709] px-4 pb-32 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">

        {/* ── WELCOME PANEL ── */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeCine }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11] p-6 sm:p-10"
        >
          {/* a single soft spotlight — the reference panel's stage light */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 font-mono text-[11px] font-bold text-violet-200">
                <Sparkles className="h-3 w-3" /> Your Da Vinci universe
              </span>
              <h1 className="mt-5 font-fell text-4xl text-white sm:text-5xl md:text-6xl">
                Welcome back to <em className="italic text-violet-300">Da Vinci</em>
              </h1>
              <p className="mt-4 font-mono text-sm leading-relaxed text-slate-400 sm:text-base">
                Choose where you want to go today — drift between anime, manhwa,
                novels, and the worlds you&apos;ve built around them.
              </p>
            </div>

            {/* ── the signed-in card ── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: easeCine }}
              className="w-full shrink-0 rounded-2xl border border-white/10 bg-black/40 p-5 lg:w-[340px]"
            >
              <div className="flex items-center gap-3">
                <span className="relative h-12 w-12 shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="relative z-10 h-12 w-12 rounded-full object-cover ring-1 ring-white/20" />
                  ) : (
                    <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full bg-violet-700 text-lg font-black text-white">
                      {(user.username || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  <AvatarDecoration frame={(user as any).activeFrame} effect={(user as any).activeEffect} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-slate-500">Signed in as</p>
                  <p className="truncate text-lg font-black text-white">{user.username}</p>
                </div>
                <span className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wide text-violet-200">
                  {roleChip}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Sparkles className="h-3 w-3" /> Level
                  </p>
                  <p className="mt-1 text-xl font-black text-white">{level}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Diamond className="h-3 w-3" /> Arise Points
                  </p>
                  {/* displayArisePoints, like every other AP surface — the
                      lead dev reads ∞, admins the fixed balance */}
                  <p className="mt-1 text-xl font-black text-white">{displayArisePoints(user)}</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between font-mono text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> XP</span>
                  <span className="tabular-nums">
                    {level >= MAX_LEVEL ? "MAX" : `${Math.round(progress)}% to Lv ${level + 1}`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.9, delay: 0.3, ease: easeCine }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ── THE SECTIONS ── */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold text-slate-300">
            Browse {sections.length} sections
          </h2>
        </div>

        <motion.div
          initial="hide"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.045, delayChildren: 0.15 } } }}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {sections.map(({ href, label, desc, Icon, tint }) => (
            <motion.div
              key={href}
              variants={{
                hide: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeCine } },
              }}
            >
              <Link
                href={href}
                className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-[#0b0b11] p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-[#0e0e15]"
                style={{ boxShadow: "0 0 0 0 transparent" }}
              >
                {/* tinted border bloom on hover, without repainting layout */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ boxShadow: `inset 0 0 0 1px ${tint}55, 0 14px 40px rgba(0,0,0,.45)` }}
                />
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-xl"
                    style={{ background: `${tint}14`, boxShadow: `inset 0 0 0 1px ${tint}33` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: tint }} />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </div>
                <p className="mt-5 font-mono text-base font-black text-white">{label}</p>
                <p className="mt-1.5 font-mono text-xs leading-relaxed text-slate-500">{desc}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
