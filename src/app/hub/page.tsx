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
  category: CategoryId;
  badge?: string;
};

const SECTIONS: Section[] = [
  // Media Realm
  { href: "/", label: "Anime", desc: "Watch latest episodes and ongoing simulcasts.", Icon: Tv, category: "media" },
  { href: "/manhwa", label: "Manhwa", desc: "Read latest chapters, webtoons, and manga.", Icon: BookOpen, category: "media" },
  { href: "/novel", label: "Novels", desc: "Light novels, web serials, and epubs.", Icon: Feather, category: "media" },
  { href: "/explore", label: "Explore Anime", desc: "Filter by genre, season, and popularity.", Icon: Compass, category: "media" },
  { href: "/manhwa/explore", label: "Explore Comics", desc: "Search across all manhwa, manga and manhua sources.", Icon: Compass, category: "media" },
  { href: "/novel/explore", label: "Explore Novels", desc: "Search novels by genre, tags, and status.", Icon: Compass, category: "media" },

  // Combat & Collectibles
  { href: "/cards", label: "Arise Cards", desc: "Binder collection, shard crafting, and packs.", Icon: Layers, category: "games" },
  { href: "/duels", label: "Card Duels", desc: "PvP card battles with real stakes.", Icon: Swords, category: "games" },
  { href: "/raid", label: "World Boss Raid", desc: "Weekly server-wide raid battles.", Icon: Flame, category: "games", badge: "Boss Active" },
  { href: "/marketplace", label: "Marketplace", desc: "Trade cards, rare wears, and serial numbers.", Icon: Store, category: "games" },

  // Community & Guilds
  { href: "/guilds", label: "Guilds", desc: "Team up, pool XP, raid bosses, and climb.", Icon: Shield, category: "community" },
  { href: "/community", label: "Community", desc: "Forums, discussions, recommendations, and lore.", Icon: Users, category: "community" },
  { href: "/leaderboard", label: "Leaderboard", desc: "Top ranks across XP, duels, and collections.", Icon: Crown, category: "community" },

  // Progression & Curation
  { href: "/quests", label: "Daily Quests", desc: "Complete tasks to earn daily Arise Points.", Icon: Trophy, category: "rewards" },
  { href: "/shop", label: "Flair Shop", desc: "Profile frames, glowing auras, and banner items.", Icon: ShoppingBag, category: "rewards" },
  { href: "/stamps", label: "Stamps", desc: "Weekly member stamps and activity feed.", Icon: Stamp, category: "rewards" },
  { href: "#gems", label: "Hidden Gems", desc: "Weekly community-curated highlights.", Icon: Gem, category: "rewards" },

  // Platform
  { href: "/updates", label: "Changelog", desc: "Platform release notes and roadmap updates.", Icon: Megaphone, category: "system" },
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
      ? [...SECTIONS, { href: "/console", label: "Lead Dev Console", desc: "System control panel and admin tools.", Icon: Terminal, category: "system" as CategoryId }]
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

  if (!user) return <div className="min-h-screen bg-black" />;

  const xp = (user as any).xp ?? 0;
  const level = staff ? MAX_LEVEL : calculateLevel(xp);
  const progress = staff ? 100 : calculateProgressPercent(xp);
  const rankInfo = getHeartRank(level);
  const roleBadge = isLeadDev(user) ? "Lead Dev" : isAdmin(user) ? "Admin" : "Member";

  return (
    <div className="min-h-screen bg-black px-4 pb-36 pt-12 sm:px-6 lg:px-10 font-sans text-white">
      {/* Subtle monochrome ambient light */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(255,255,255,0.08),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl space-y-10">

        {/* ── COMMAND DECK & USER PASSPORT ── */}
        <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] via-[#090909] to-[#000000] p-6 sm:p-8 lg:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.9),_0_0_30px_rgba(255,255,255,0.03)]">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
            
            {/* Left: Hub Title & Quick Jump */}
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-400">
                  Da Vinci Portal // Monochrome Edition
                </span>
              </div>

              <h1 className="mt-3 font-fell text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl tracking-wide">
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-neutral-400">{user.username}</span>
              </h1>

              <p className="mt-3 max-w-lg text-sm sm:text-base leading-relaxed text-neutral-400 font-sans">
                Explore anime broadcasts, manhwa webtoons, light novels, and participate in community duels, guild raids, and daily quests.
              </p>

              {/* Quick Jump Buttons (High Contrast Monochrome) */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition shadow-sm"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Watch Anime
                </Link>
                <Link
                  href="/manhwa"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition shadow-sm"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Read Manhwa
                </Link>
                <Link
                  href="/novel"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition shadow-sm"
                >
                  <Feather className="h-3.5 w-3.5" />
                  Light Novels
                </Link>
              </div>
            </div>

            {/* Right: User Passport Card */}
            <div className="rounded-2xl border border-white/15 bg-neutral-950/80 p-5 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 shrink-0">
                    {user.avatar ? (
                      <img
                        src={cloudinaryFit(user.avatar, 120)}
                        alt=""
                        className="relative z-10 h-12 w-12 rounded-2xl object-cover ring-2 ring-white/30"
                      />
                    ) : (
                      <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-neutral-800 font-bold text-lg text-white ring-2 ring-white/20">
                        {(user.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <AvatarDecoration frame={(user as any).activeFrame} effect={(user as any).activeEffect} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold text-white">{user.username}</p>
                      <span className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider text-white">
                        {roleBadge}
                      </span>
                    </div>
                    <p className="truncate text-xs font-mono text-neutral-400">
                      {rankInfo.name}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/user/${encodeURIComponent(user.username)}`}
                  className="shrink-0 text-neutral-400 hover:text-white transition p-1"
                  title="View Profile"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Stats Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    <Sparkles className="h-3 w-3 text-neutral-300" /> Level
                  </span>
                  <p className="mt-1 font-mono text-xl font-black text-white">{level}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    <Diamond className="h-3 w-3 text-neutral-300" /> Arise Points
                  </span>
                  <p className="mt-1 font-mono text-xl font-black text-white">{displayArisePoints(user)}</p>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-400">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-white" /> XP Progress</span>
                  <span className="text-neutral-300 font-mono">{level >= MAX_LEVEL ? "MAX RANK" : `${Math.round(progress)}%`}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neutral-400 to-white transition-all duration-700 shadow-[0_0_10px_#ffffff]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── THE BIG 3 MEDIA GATEWAYS (HERO TRIAD) ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-fell text-2xl font-bold text-white">Media Gateways</h2>
            <span className="text-xs font-mono text-neutral-500">Core Libraries</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Anime Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141414] via-[#0a0a0a] to-[#020202] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-sm">
                  <Tv className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                  Streaming
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Anime Realm</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400 font-sans">
                Stream ongoing simulcasts, sub & dub releases, and classic anime archives.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/10">
                <Link
                  href="/"
                  className="flex-1 rounded-xl bg-white px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-black hover:bg-neutral-200 transition shadow-md"
                >
                  Watch Now
                </Link>
                <Link
                  href="/explore"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 transition"
                  title="Explore Anime Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Manhwa Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141414] via-[#0a0a0a] to-[#020202] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-sm">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                  Comics & Manga
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Manhwa & Comics</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400 font-sans">
                High-definition scans for Korean manhwa, Japanese manga, and Chinese manhua.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/10">
                <Link
                  href="/manhwa"
                  className="flex-1 rounded-xl bg-white px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-black hover:bg-neutral-200 transition shadow-md"
                >
                  Read Now
                </Link>
                <Link
                  href="/manhwa/explore"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 transition"
                  title="Explore Comics Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Light Novels Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141414] via-[#0a0a0a] to-[#020202] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-sm">
                  <Feather className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                  Web Serials
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Light Novels</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400 font-sans">
                Immersive reader for serialized light novels, translated web novels, and epubs.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/10">
                <Link
                  href="/novel"
                  className="flex-1 rounded-xl bg-white px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-black hover:bg-neutral-200 transition shadow-md"
                >
                  Read Now
                </Link>
                <Link
                  href="/novel/explore"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 transition"
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
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hub destinations…"
                className="h-11 w-full rounded-2xl border border-white/15 bg-neutral-900/90 pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/50 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
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
                        ? "border-white bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/10 hover:text-white"
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
            {filteredSections.map(({ href, label, desc, Icon, badge }) => {
              const content = (
                <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-white/30 hover:bg-[#141414] shadow-lg">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex items-center gap-2">
                        {badge && (
                          <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[9px] font-mono font-black uppercase text-white">
                            {badge}
                          </span>
                        )}
                        <ArrowUpRight className="h-4 w-4 text-neutral-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                      </div>
                    </div>

                    <h4 className="mt-4 text-base font-bold text-white transition group-hover:text-neutral-200">
                      {label}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400 font-sans">
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
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setGemsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/20 bg-neutral-950 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-fell text-2xl font-bold text-white">Select Gems Mode</h3>
                  <p className="mt-1 text-xs text-neutral-400 font-sans">
                    Weekly community curations and top rated hidden gems.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGemsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  { href: "/gems/anime", label: "Anime Gems", Icon: Tv },
                  { href: "/gems/manhwa", label: "Manhwa Gems", Icon: BookOpen },
                  { href: "/gems/novel", label: "Novel Gems", Icon: Feather },
                ].map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setGemsOpen(false)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-3.5 transition hover:border-white/40 hover:bg-white/10"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 font-mono text-sm font-bold text-white">{label}</span>
                    <ArrowRight className="h-4 w-4 text-neutral-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
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



