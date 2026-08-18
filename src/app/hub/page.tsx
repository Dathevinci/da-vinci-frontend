"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv, BookOpen, Feather, Compass, Users, Layers, Swords,
  Store, Trophy, ShoppingBag, Crown, Megaphone,
  Terminal, ArrowRight, ArrowUpRight, Diamond, Zap, Gem, X, Stamp,
  Search, Shield, Play, Flame, Sparkles
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { calculateLevel, calculateProgressPercent, MAX_LEVEL } from "@/lib/levels";
import { getHeartRank } from "@/lib/heartRanks";
import { cloudinaryFit } from "@/lib/cloudinary";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";

type CategoryId = "all" | "media" | "games" | "community" | "rewards" | "system";

type Section = {
  href: string;
  label: string;
  desc: string;
  Icon: any;
  tint: string;
  category: CategoryId;
  badge?: string;
};

const SECTIONS: Section[] = [
  // Media Realm
  { href: "/", label: "Anime", desc: "Watch latest episodes and ongoing simulcasts.", Icon: Tv, tint: "#a855f7", category: "media" },
  { href: "/manhwa", label: "Manhwa", desc: "Read latest chapters, webtoons, and manga.", Icon: BookOpen, tint: "#38bdf8", category: "media" },
  { href: "/novel", label: "Novels", desc: "Light novels, web serials, and epubs.", Icon: Feather, tint: "#fbbf24", category: "media" },
  { href: "/explore", label: "Explore Anime", desc: "Filter by genre, season, and popularity.", Icon: Compass, tint: "#818cf8", category: "media" },
  { href: "/manhwa/explore", label: "Explore Comics", desc: "Search across all manhwa, manga and manhua sources.", Icon: Compass, tint: "#38bdf8", category: "media" },
  { href: "/novel/explore", label: "Explore Novels", desc: "Search novels by genre, tags, and status.", Icon: Compass, tint: "#fbbf24", category: "media" },

  // Combat & Collectibles
  { href: "/cards", label: "Arise Cards", desc: "Binder collection, shard crafting, and packs.", Icon: Layers, tint: "#c084fc", category: "games" },
  { href: "/duels", label: "Card Duels", desc: "PvP card battles with real stakes.", Icon: Swords, tint: "#f43f5e", category: "games" },
  { href: "/raid", label: "World Boss Raid", desc: "Weekly server-wide raid battles.", Icon: Flame, tint: "#f87171", category: "games", badge: "Boss Active" },
  { href: "/marketplace", label: "Marketplace", desc: "Trade cards, rare wears, and serial numbers.", Icon: Store, tint: "#22d3ee", category: "games" },

  // Community & Guilds
  { href: "/guilds", label: "Guilds", desc: "Team up, pool XP, raid bosses, and climb.", Icon: Shield, tint: "#10b981", category: "community" },
  { href: "/community", label: "Community", desc: "Forums, discussions, recommendations, and lore.", Icon: Users, tint: "#34d399", category: "community" },
  { href: "/leaderboard", label: "Leaderboard", desc: "Top ranks across XP, duels, and collections.", Icon: Crown, tint: "#7dd3fc", category: "community" },

  // Progression & Curation
  { href: "/quests", label: "Daily Quests", desc: "Complete tasks to earn daily Arise Points.", Icon: Trophy, tint: "#fb923c", category: "rewards" },
  { href: "/shop", label: "Flair Shop", desc: "Profile frames, glowing auras, and banner items.", Icon: ShoppingBag, tint: "#e879f9", category: "rewards" },
  { href: "/stamps", label: "Stamps", desc: "Weekly member stamps and activity feed.", Icon: Stamp, tint: "#fbbf24", category: "rewards" },
  { href: "#gems", label: "Hidden Gems", desc: "Weekly community-curated highlights.", Icon: Gem, tint: "#a78bfa", category: "rewards" },

  // Platform
  { href: "/updates", label: "Changelog", desc: "Platform release notes and roadmap updates.", Icon: Megaphone, tint: "#94a3b8", category: "system" },
];

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "All Destinations" },
  { id: "media", label: "Media & Library" },
  { id: "games", label: "Cards & Duels" },
  { id: "community", label: "Guilds & Social" },
  { id: "rewards", label: "Quests & Rewards" },
  { id: "system", label: "Platform" },
];

export default function HubPage() {
  const { user } = useUser();
  const [gemsOpen, setGemsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const staff = isLeadDev(user) || isAdmin(user);
  const allSections: Section[] = useMemo(() => {
    return isLeadDev(user)
      ? [...SECTIONS, { href: "/console", label: "Lead Dev Console", desc: "System control panel and admin tools.", Icon: Terminal, tint: "#a3e635", category: "system" as CategoryId }]
      : SECTIONS;
  }, [user]);

  // Filter sections by category and search
  const filteredSections = useMemo(() => {
    return allSections.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchQuery =
        !searchQuery ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [allSections, activeCategory, searchQuery]);

  if (!user) return <div className="min-h-screen bg-[#070709]" />;

  const xp = (user as any).xp ?? 0;
  const level = staff ? MAX_LEVEL : calculateLevel(xp);
  const progress = staff ? 100 : calculateProgressPercent(xp);
  const rankInfo = getHeartRank(level);
  const roleBadge = isLeadDev(user) ? "Lead Dev" : isAdmin(user) ? "Admin" : "Member";

  return (
    <div className="min-h-screen bg-[#070709] px-4 pb-36 pt-12 sm:px-6 lg:px-10 font-sans text-white">
      {/* Background ambient lighting */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(139,92,246,0.14),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl space-y-10">

        {/* ── COMMAND DECK & USER PASSPORT ── */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#120c24]/90 via-[#0d091a]/95 to-[#07050e]/95 p-6 sm:p-8 lg:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.85)]">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
            
            {/* Left: Hub Title & Quick Jump */}
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                  Da Vinci Universe Portal
                </span>
              </div>

              <h1 className="mt-3 font-fell text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl tracking-wide">
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-violet-200 to-white">{user.username}</span>
              </h1>

              <p className="mt-3 max-w-lg text-sm sm:text-base leading-relaxed text-slate-300">
                Explore anime, manhwa, novels, and participate in community card battles, guild raids, and daily quests.
              </p>

              {/* Quick Jump Buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/15 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-500/25 transition shadow-sm"
                >
                  <Play className="h-3.5 w-3.5 text-violet-400" />
                  Watch Anime
                </Link>
                <Link
                  href="/manhwa"
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-sky-200 hover:bg-sky-500/25 transition shadow-sm"
                >
                  <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                  Read Manhwa
                </Link>
                <Link
                  href="/novel"
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/25 transition shadow-sm"
                >
                  <Feather className="h-3.5 w-3.5 text-amber-400" />
                  Light Novels
                </Link>
              </div>
            </div>

            {/* Right: User Passport Card */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 shrink-0">
                    {user.avatar ? (
                      <img
                        src={cloudinaryFit(user.avatar, 120)}
                        alt=""
                        className="relative z-10 h-12 w-12 rounded-2xl object-cover ring-2 ring-white/15"
                      />
                    ) : (
                      <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-violet-800 font-bold text-lg text-white">
                        {(user.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <AvatarDecoration frame={(user as any).activeFrame} effect={(user as any).activeEffect} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold text-white">{user.username}</p>
                      <span className="rounded-md border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider text-violet-200">
                        {roleBadge}
                      </span>
                    </div>
                    <p className="truncate text-xs font-mono text-slate-400">
                      {rankInfo.name}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/user/${encodeURIComponent(user.username)}`}
                  className="shrink-0 text-slate-400 hover:text-white transition p-1"
                  title="View Profile"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Stats Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    <Sparkles className="h-3 w-3 text-amber-400" /> Level
                  </span>
                  <p className="mt-1 font-mono text-xl font-black text-white">{level}</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    <Diamond className="h-3 w-3 text-cyan-400" /> Arise Points
                  </span>
                  <p className="mt-1 font-mono text-xl font-black text-white">{displayArisePoints(user)}</p>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-violet-400" /> XP Progress</span>
                  <span>{level >= MAX_LEVEL ? "MAX RANK" : `${Math.round(progress)}%`}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── THE BIG 3 REALMS (HERO GATEWAYS) ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-fell text-2xl font-bold text-white">Media Gateways</h2>
            <span className="text-xs font-mono text-slate-500">Core Libraries</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Anime Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-b from-violet-950/40 via-[#0d091b]/90 to-[#07050f] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 text-violet-300">
                  <Tv className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-violet-300">
                  Streaming
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Anime Realm</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Stream ongoing simulcasts, sub & dub releases, and classic anime archives.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/5">
                <Link
                  href="/"
                  className="flex-1 rounded-xl bg-violet-600 px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-violet-500 transition shadow-md"
                >
                  Watch Now
                </Link>
                <Link
                  href="/explore"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Explore Anime Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Manhwa Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-sky-500/25 bg-gradient-to-b from-sky-950/40 via-[#09101b]/90 to-[#05090f] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-[0_0_30px_rgba(56,189,248,0.2)]">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/15 text-sky-300">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-sky-300">
                  Comics & Manga
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Manhwa & Comics</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                High-definition scans for Korean manhwa, Japanese manga, and Chinese manhua.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/5">
                <Link
                  href="/manhwa"
                  className="flex-1 rounded-xl bg-sky-600 px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-sky-500 transition shadow-md"
                >
                  Read Now
                </Link>
                <Link
                  href="/manhwa/explore"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Explore Comics Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Light Novels Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-b from-amber-950/40 via-[#151009]/90 to-[#0d0a06] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)]">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-300">
                  <Feather className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                  Web Serials
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Light Novels</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Immersive reader for serialized light novels, translated web novels, and epubs.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/5">
                <Link
                  href="/novel"
                  className="flex-1 rounded-xl bg-amber-600 px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-amber-500 transition shadow-md"
                >
                  Read Now
                </Link>
                <Link
                  href="/novel/explore"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Explore Novels Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── SEARCH & CATEGORY FILTER ── */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hub destinations…"
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0d091a]/80 pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/60 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition ${
                      active
                        ? "border-violet-400/60 bg-violet-500/20 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                        : "border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ALL SECTIONS GRID ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSections.map(({ href, label, desc, Icon, tint, badge }) => {
              const content = (
                <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#0c0818]/80 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-[#120d22] shadow-lg">
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                        style={{ background: `${tint}15`, border: `1px solid ${tint}30` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: tint }} />
                      </div>

                      <div className="flex items-center gap-2">
                        {badge && (
                          <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[9px] font-mono font-black uppercase text-rose-300">
                            {badge}
                          </span>
                        )}
                        <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                      </div>
                    </div>

                    <h4 className="mt-4 text-base font-bold text-white transition group-hover:text-violet-200">
                      {label}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400 font-sans">
                      {desc}
                    </p>
                  </div>
                </div>
              );

              return (
                <div key={href}>
                  {href === "#gems" ? (
                    <button
                      type="button"
                      onClick={() => setGemsOpen(true)}
                      className="w-full text-left h-full"
                    >
                      {content}
                    </button>
                  ) : (
                    <Link href={href} className="block h-full">
                      {content}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* ── GEMS SELECTION MODAL ── */}
      <AnimatePresence>
        {gemsOpen && (
          <div className="fixed inset-0 z-[120] grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setGemsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d091a] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-fell text-2xl font-bold text-white">Select Gems Mode</h3>
                  <p className="mt-1 text-xs text-slate-400 font-sans">
                    Weekly community curations and top rated hidden gems.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGemsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  { href: "/gems/anime", label: "Anime Gems", Icon: Tv, tint: "#a855f7" },
                  { href: "/gems/manhwa", label: "Manhwa Gems", Icon: BookOpen, tint: "#38bdf8" },
                  { href: "/gems/novel", label: "Novel Gems", Icon: Feather, tint: "#fbbf24" },
                ].map(({ href, label, Icon, tint }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setGemsOpen(false)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-violet-500/40 hover:bg-violet-500/10"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${tint}15`, border: `1px solid ${tint}30` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: tint }} />
                    </span>
                    <span className="flex-1 font-mono text-sm font-bold text-white">{label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

