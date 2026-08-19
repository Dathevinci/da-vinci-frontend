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
  { href: "/", label: "Anime Realm", desc: "Stream latest episodes, ongoing simulcasts, and cinema.", Icon: Tv, category: "media" },
  { href: "/manhwa", label: "Manhwa & Comics", desc: "Read latest chapters, serialized webtoons, and manga.", Icon: BookOpen, category: "media" },
  { href: "/novel", label: "Light Novels", desc: "Light novels, translated web serials, and epubs.", Icon: Feather, category: "media" },
  { href: "/explore", label: "Explore Anime", desc: "Filter by genre, season, studio, and popularity.", Icon: Compass, category: "media" },
  { href: "/manhwa/explore", label: "Explore Comics", desc: "Search across all manhwa, manga and manhua sources.", Icon: Compass, category: "media" },
  { href: "/novel/explore", label: "Explore Novels", desc: "Search novels by genre, tags, and status.", Icon: Compass, category: "media" },

  // Combat & Collectibles
  { href: "/cards", label: "Arise Cards", desc: "Binder collection, shard crafting, and gacha packs.", Icon: Layers, category: "games" },
  { href: "/duels", label: "Card Duels", desc: "PvP battle arena with live staked cards.", Icon: Swords, category: "games" },
  { href: "/raid", label: "World Boss Raid", desc: "Weekly server-wide raid battles.", Icon: Flame, category: "games", badge: "Boss Active" },
  { href: "/marketplace", label: "Marketplace", desc: "Trade cards, rare wears, and serial numbers.", Icon: Store, category: "games" },

  // Community & Guilds
  { href: "/guilds", label: "Guilds & Factions", desc: "Team up, pool XP, raid bosses, and climb.", Icon: Shield, category: "community" },
  { href: "/community", label: "Community BBS", desc: "Forums, discussions, recommendations, and lore.", Icon: Users, category: "community" },
  { href: "/leaderboard", label: "Hall of Fame", desc: "Top ranks across XP, duels, and collections.", Icon: Crown, category: "community" },

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

// Smooth container spring variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 26,
    },
  },
};

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
    <div className="min-h-screen bg-black px-4 pb-36 pt-6 sm:px-6 lg:px-10 font-sans text-white selection:bg-violet-500 selection:text-white">
      {/* ── Subtle Atmospheric Violet Backlight ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(139,92,246,0.14),transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative mx-auto max-w-6xl space-y-10"
      >

        {/* ── COMMAND DECK & USER PASSPORT ── */}
        <motion.section
          variants={itemVariants}
          className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-b from-[#141414] via-[#090909] to-[#010101] p-6 sm:p-8 lg:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.95),_0_0_30px_rgba(139,92,246,0.08)]"
        >
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
            
            {/* Left: Hub Title & Quick Jump */}
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa] animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-400">
                  Da Vinci Universe Deck
                </span>
              </div>

              <h1 className="mt-3 font-fell text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl tracking-wide">
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-violet-400">{user.username}</span>
              </h1>

              <p className="mt-3 max-w-lg text-sm sm:text-base leading-relaxed text-neutral-400 font-sans">
                Explore anime broadcasts, manhwa webtoons, light novels, and participate in community card battles, guild raids, and daily quests.
              </p>

              {/* Quick Jump Buttons (Fluid Hover Springs) */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-violet-100 hover:bg-violet-500 hover:text-white transition-colors duration-200 shadow-sm"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Watch Anime
                  </Link>
                </motion.div>

                <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/manhwa"
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-500 hover:text-white transition-colors duration-200 shadow-sm"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Read Manhwa
                  </Link>
                </motion.div>

                <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/novel"
                    className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-fuchsia-100 hover:bg-fuchsia-500 hover:text-white transition-colors duration-200 shadow-sm"
                  >
                    <Feather className="h-3.5 w-3.5" />
                    Light Novels
                  </Link>
                </motion.div>
              </div>
            </div>

            {/* Right: User Passport Card */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              className="rounded-2xl border border-violet-500/20 bg-neutral-950/90 p-5 backdrop-blur-md shadow-xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 shrink-0">
                    {user.avatar ? (
                      <img
                        src={cloudinaryFit(user.avatar, 120)}
                        alt=""
                        className="relative z-10 h-12 w-12 rounded-2xl object-cover ring-2 ring-violet-400/40 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                      />
                    ) : (
                      <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-neutral-800 font-bold text-lg text-white ring-2 ring-violet-400/30">
                        {(user.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <AvatarDecoration frame={(user as any).activeFrame} effect={(user as any).activeEffect} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold text-white">{user.username}</p>
                      <span className="rounded-md border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider text-violet-200">
                        {roleBadge}
                      </span>
                    </div>
                    <p className="truncate text-xs font-mono text-neutral-400">
                      {rankInfo.name}
                    </p>
                  </div>
                </div>

                <motion.div whileHover={{ scale: 1.15, x: 2 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    href={`/user/${encodeURIComponent(user.username)}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/15 text-neutral-400 hover:border-violet-400/40 hover:bg-violet-500 hover:text-white transition-colors"
                    title="View Profile"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>

              {/* Stats Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.06] p-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    <Sparkles className="h-3 w-3 text-violet-300" /> Level
                  </span>
                  <p className="mt-1 font-mono text-xl font-black text-white">{level}</p>
                </div>

                <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.06] p-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    <Diamond className="h-3 w-3 text-violet-300" /> Arise Points
                  </span>
                  <p className="mt-1 font-mono text-xl font-black text-white">{displayArisePoints(user)}</p>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-400">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-violet-300" /> XP Progress</span>
                  <span className="text-neutral-300 font-mono">{level >= MAX_LEVEL ? "MAX RANK" : `${Math.round(progress)}%`}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-800 border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 via-violet-400 to-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                  />
                </div>
              </div>
            </motion.div>

          </div>
        </motion.section>

        {/* ── THE BIG 3 MEDIA GATEWAYS (HERO TRIAD) ── */}
        <motion.section variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-fell text-2xl font-bold text-white">Media Gateways</h2>
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Primary Archives</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Anime Card */}
            <motion.div
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 350, damping: 22 } }}
              className="group relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-b from-[#141414] via-[#090909] to-[#010101] p-6 backdrop-blur-md shadow-lg hover:border-violet-400/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.18)] transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-200 shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <Tv className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-violet-200">
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
                  className="flex-1 rounded-xl bg-violet-500 px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-violet-400 transition-all duration-200 shadow-md hover:shadow-[0_0_15px_rgba(139,92,246,0.45)]"
                >
                  Watch Now
                </Link>
                <Link
                  href="/explore"
                  className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs font-mono text-violet-300 hover:text-white hover:bg-violet-500/20 transition"
                  title="Explore Anime Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            {/* Manhwa Card */}
            <motion.div
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 350, damping: 22 } }}
              className="group relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-b from-[#141414] via-[#090909] to-[#010101] p-6 backdrop-blur-md shadow-lg hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.18)] transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-purple-200 shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-200">
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
                  className="flex-1 rounded-xl bg-purple-500 px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-purple-400 transition-all duration-200 shadow-md hover:shadow-[0_0_15px_rgba(168,85,247,0.45)]"
                >
                  Read Now
                </Link>
                <Link
                  href="/manhwa/explore"
                  className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs font-mono text-purple-300 hover:text-white hover:bg-purple-500/20 transition"
                  title="Explore Comics Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            {/* Light Novels Card */}
            <motion.div
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 350, damping: 22 } }}
              className="group relative overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-gradient-to-b from-[#141414] via-[#090909] to-[#010101] p-6 backdrop-blur-md shadow-lg hover:border-fuchsia-400/50 hover:shadow-[0_0_30px_rgba(217,70,239,0.18)] transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200 shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <Feather className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-fuchsia-200">
                  Web Serials
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">Light Novels</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400 font-sans">
                Immersive reader for serialized light novels, translated web serials, and epubs.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-white/10">
                <Link
                  href="/novel"
                  className="flex-1 rounded-xl bg-fuchsia-500 px-3.5 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-fuchsia-400 transition-all duration-200 shadow-md hover:shadow-[0_0_15px_rgba(217,70,239,0.45)]"
                >
                  Read Now
                </Link>
                <Link
                  href="/novel/explore"
                  className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2 text-xs font-mono text-fuchsia-300 hover:text-white hover:bg-fuchsia-500/20 transition"
                  title="Explore Novels Catalog"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ── SEARCH & CATEGORY FILTER WITH FLUID LAYOUT ── */}
        <motion.section variants={itemVariants} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hub destinations…"
                className="h-11 w-full rounded-2xl border border-violet-500/20 bg-neutral-900/90 pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-neutral-600 outline-none focus:border-violet-400/60 focus:shadow-[0_0_15px_rgba(139,92,246,0.25)] transition-all duration-200"
              />
              <AnimatePresence>
                {searchQuery && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-violet-300 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Violet Category Selector with Fluid Pill Highlight */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`relative rounded-xl border px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 ${
                      active
                        ? "border-violet-400 bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                        : "border-violet-500/15 bg-violet-500/[0.04] text-neutral-400 hover:border-violet-400/40 hover:text-violet-200"
                    }`}
                  >
                    {cat.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ── ALL SECTIONS GRID WITH FLUID LAYOUT REORDERING ── */}
          <motion.div
            layout
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredSections.map(({ href, label, desc, Icon, badge }) => {
                const content = (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -4, transition: { type: "spring", stiffness: 350, damping: 22 } }}
                    className="group relative flex h-full flex-col justify-between rounded-2xl border border-violet-500/15 bg-[#0d0d0d] p-5 transition-all duration-200 hover:border-violet-400/40 hover:bg-[#141414] shadow-lg"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-200 shadow-sm transition-transform duration-300 group-hover:scale-110">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="flex items-center gap-2">
                          {badge && (
                            <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[9px] font-mono font-black uppercase text-violet-100 shadow-[0_0_8px_rgba(139,92,246,0.3)]">
                              {badge}
                            </span>
                          )}
                          <ArrowUpRight className="h-4 w-4 text-neutral-600 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" />
                        </div>
                      </div>

                      <h4 className="mt-4 text-base font-bold text-white transition-colors group-hover:text-violet-200">
                        {label}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-400 font-sans">
                        {desc}
                      </p>
                    </div>
                  </motion.div>
                );

                return (
                  <motion.div
                    layout
                    key={href}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </motion.section>

      </motion.div>

      {/* ── GEMS SELECTION MODAL (ULTRA-FLUID MOTION) ── */}
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
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="relative w-full max-w-sm rounded-3xl border border-violet-500/25 bg-neutral-950 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-fell text-2xl font-bold text-white">Select Gems Mode</h3>
                  <p className="mt-1 text-xs text-neutral-400 font-sans">
                    Weekly community curations and top rated hidden gems.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setGemsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-violet-500/15 hover:text-violet-200 transition"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  { href: "/gems/anime", label: "Anime Gems", Icon: Tv },
                  { href: "/gems/manhwa", label: "Manhwa Gems", Icon: BookOpen },
                  { href: "/gems/novel", label: "Novel Gems", Icon: Feather },
                ].map(({ href, label, Icon }) => (
                  <motion.div key={href} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href={href}
                      onClick={() => setGemsOpen(false)}
                      className="group flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-3.5 transition-colors hover:border-violet-400/50 hover:bg-violet-500/15"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-400/30 bg-violet-500/10 text-violet-200 transition-transform group-hover:scale-105">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1 font-mono text-sm font-bold text-white">{label}</span>
                      <ArrowRight className="h-4 w-4 text-neutral-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-violet-300" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


