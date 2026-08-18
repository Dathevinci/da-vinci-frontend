"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv, BookOpen, Feather, Compass, Users, Layers, Swords,
  Store, Trophy, ShoppingBag, Crown, Megaphone,
  Terminal, ArrowRight, ArrowUpRight, Diamond, Zap, Gem, X, Stamp,
  Search, Shield, Play, Flame, Sparkles, Radio, Disc, Cpu
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
  sectorCode: string;
};

const SECTIONS: Section[] = [
  // Media Realm
  { href: "/", label: "Anime Broadcast", desc: "Simulcasts, VHS tape archives, and classic cinema.", Icon: Tv, tint: "#ff2a85", category: "media", sectorCode: "CH-01" },
  { href: "/manhwa", label: "Manhwa Cyber-Pulp", desc: "Weekly comic drops, serialized webtoons, and manga.", Icon: BookOpen, tint: "#00f0ff", category: "media", sectorCode: "VOL-84" },
  { href: "/novel", label: "Light Novel Textdeck", desc: "Epubs, web serials, and translated cyberpunk novels.", Icon: Feather, tint: "#ffe600", category: "media", sectorCode: "DOC-99" },
  { href: "/explore", label: "Explore Broadcasts", desc: "Filter by genre, season, and popularity.", Icon: Compass, tint: "#a855f7", category: "media", sectorCode: "SCAN-A" },
  { href: "/manhwa/explore", label: "Explore Comics", desc: "Search across all manhwa, manga and manhua sources.", Icon: Compass, tint: "#00f0ff", category: "media", sectorCode: "SCAN-B" },
  { href: "/novel/explore", label: "Explore Novels", desc: "Search novels by genre, tags, and status.", Icon: Compass, tint: "#ffe600", category: "media", sectorCode: "SCAN-C" },

  // Combat & Collectibles
  { href: "/cards", label: "Arise Holo-Cards", desc: "Binder collection, holographic foils, and gacha.", Icon: Layers, tint: "#ff007f", category: "games", sectorCode: "DECK-01" },
  { href: "/duels", label: "Arcade Card Duels", desc: "PvP battle arena with live staked cards.", Icon: Swords, tint: "#ff003c", category: "games", sectorCode: "1P VS 2P" },
  { href: "/raid", label: "World Boss Raid", desc: "Weekly server-wide raid battles.", Icon: Flame, tint: "#ff3838", category: "games", badge: "BOSS ACTIVE", sectorCode: "RAID-X" },
  { href: "/marketplace", label: "Black Market Exchange", desc: "Trade serials, vintage wares, and cards.", Icon: Store, tint: "#00f0ff", category: "games", sectorCode: "TRD-88" },

  // Community & Guilds
  { href: "/guilds", label: "Factions & Guilds", desc: "Team up, pool XP, raid bosses, and climb.", Icon: Shield, tint: "#00ff66", category: "community", sectorCode: "CLAN-07" },
  { href: "/community", label: "BBS Forum Net", desc: "Discussions, recommendations, and lore boards.", Icon: Users, tint: "#00f0ff", category: "community", sectorCode: "NET-SYS" },
  { href: "/leaderboard", label: "High Score Hall", desc: "Top ranks across XP, duels, and collections.", Icon: Crown, tint: "#ffe600", category: "community", sectorCode: "HI-SCORE" },

  // Progression & Curation
  { href: "/quests", label: "Daily Quests", desc: "Complete arcade challenges to earn Arise Points.", Icon: Trophy, tint: "#ff7700", category: "rewards", sectorCode: "MISSION" },
  { href: "/shop", label: "Synth Boutique", desc: "Neon frames, glowing auras, and profile flair.", Icon: ShoppingBag, tint: "#ff00bb", category: "rewards", sectorCode: "SHOP-80" },
  { href: "/stamps", label: "Collector Stamps", desc: "Weekly curation stamps and community feed.", Icon: Stamp, tint: "#ffe600", category: "rewards", sectorCode: "STAMP" },
  { href: "#gems", label: "Hidden Gems", desc: "Weekly community-curated gold mines.", Icon: Gem, tint: "#bf55ec", category: "rewards", sectorCode: "VOTE-GEM" },

  // Platform
  { href: "/updates", label: "Changelog Patch", desc: "System updates, firmware releases, and logs.", Icon: Megaphone, tint: "#94a3b8", category: "system", sectorCode: "V2.84" },
];

const CATEGORIES: { id: CategoryId; label: string; code: string }[] = [
  { id: "all", label: "ALL SECTORS", code: "00" },
  { id: "media", label: "MEDIA DRIVE", code: "01" },
  { id: "games", label: "BATTLE ZONE", code: "02" },
  { id: "community", label: "GUILD DECK", code: "03" },
  { id: "rewards", label: "LOOT & QUESTS", code: "04" },
  { id: "system", label: "SYS.CONFIG", code: "05" },
];

export default function HubPage() {
  const { user } = useUser();
  const [gemsOpen, setGemsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const staff = isLeadDev(user) || isAdmin(user);
  const allSections: Section[] = useMemo(() => {
    return isLeadDev(user)
      ? [...SECTIONS, { href: "/console", label: "Lead Dev Console", desc: "Root terminal and kernel administrative tools.", Icon: Terminal, tint: "#00ff66", category: "system" as CategoryId, sectorCode: "ROOT-DEV" }]
      : SECTIONS;
  }, [user]);

  // Filter sections by category and search
  const filteredSections = useMemo(() => {
    return allSections.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchQuery =
        !searchQuery ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sectorCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [allSections, activeCategory, searchQuery]);

  if (!user) return <div className="min-h-screen bg-[#06030a]" />;

  const xp = (user as any).xp ?? 0;
  const level = staff ? MAX_LEVEL : calculateLevel(xp);
  const progress = staff ? 100 : calculateProgressPercent(xp);
  const rankInfo = getHeartRank(level);
  const roleBadge = isLeadDev(user) ? "LEAD DEV" : isAdmin(user) ? "ADMIN" : "PLAYER 1";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#06020c] font-mono text-white selection:bg-[#ff007f] selection:text-white pb-36 pt-10 px-4 sm:px-6 lg:px-10">
      
      {/* ── 80s CRT Scanline & Perspective Grid Background ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.14] z-50 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(18, 16, 26, 0) 50%, rgba(0, 0, 0, 0.75) 50%), linear-gradient(90deg, rgba(255, 0, 128, 0.04), rgba(0, 240, 255, 0.04))",
          backgroundSize: "100% 4px, 6px 100%",
        }}
      />

      {/* 80s Outrun Synthwave Horizon Glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_70%_60%_at_50%_-15%,rgba(255,0,128,0.22),transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[350px] bg-[radial-gradient(ellipse_80%_50%_at_50%_115%,rgba(0,240,255,0.18),transparent_75%)]"
      />

      <div className="relative mx-auto max-w-6xl space-y-10">

        {/* ── 80s VHS MARQUEE TAPE HEADER ── */}
        <div className="flex flex-wrap items-center justify-between border-b-2 border-[#ff007f]/40 pb-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[#ff2a85]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-rose-400 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ff003c]" />
              REC ● 198X
            </span>
            <span className="text-slate-600">//</span>
            <span className="text-cyan-400">HI-FI STEREO</span>
            <span className="text-slate-600">//</span>
            <span className="text-amber-400">CH-04 TRACKING: AUTO</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-slate-400">
            <span className="text-[#00ff66]">SYS: ONLINE</span>
            <span className="text-slate-600">//</span>
            <span>DA VINCI CYBERDECK V2.84</span>
          </div>
        </div>

        {/* ── ARCADE HERO COMMAND DECK ── */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-[#ff007f]/50 bg-gradient-to-br from-[#1b0a2a]/95 via-[#0e051a]/95 to-[#06010d]/98 p-6 sm:p-8 lg:p-10 shadow-[0_0_40px_rgba(255,0,127,0.25),_inset_0_0_20px_rgba(0,240,255,0.1)]">
          {/* Neon Corner Accents */}
          <div className="absolute left-1 top-1 h-3 w-3 border-l-2 border-t-2 border-cyan-400" />
          <div className="absolute right-1 top-1 h-3 w-3 border-r-2 border-t-2 border-cyan-400" />
          <div className="absolute bottom-1 left-1 h-3 w-3 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-cyan-400" />

          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
            
            {/* Left: 80s Arcade Title & Stage Selection */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                <Cpu className="h-3 w-3 text-cyan-400" />
                INSERT COIN // STAGE SELECT
              </div>

              <h1 className="mt-3 font-fell text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#ff2a85] via-[#ffe600] to-[#00f0ff] drop-shadow-[0_0_20px_rgba(255,42,133,0.4)]">
                DA VINCI // 198X
              </h1>

              <p className="mt-2 text-xs sm:text-sm uppercase tracking-wide text-slate-300 leading-relaxed font-mono">
                SELECT DESTINATION TAPE. DRIFT ACROSS ANIME BROADCASTS, CYBER-MANHWA, AND VINTAGE LIGHT NOVEL ARCHIVES.
              </p>

              {/* 80s Arcade Quick Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/"
                  className="group relative inline-flex items-center gap-2 rounded-lg border-2 border-[#ff007f] bg-[#ff007f]/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#ff66b2] shadow-[0_0_15px_rgba(255,0,127,0.35)] hover:bg-[#ff007f] hover:text-white transition-all duration-200"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>1P ANIME</span>
                </Link>

                <Link
                  href="/manhwa"
                  className="group relative inline-flex items-center gap-2 rounded-lg border-2 border-[#00f0ff] bg-[#00f0ff]/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.35)] hover:bg-[#00f0ff] hover:text-black transition-all duration-200"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>2P MANHWA</span>
                </Link>

                <Link
                  href="/novel"
                  className="group relative inline-flex items-center gap-2 rounded-lg border-2 border-[#ffe600] bg-[#ffe600]/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#ffe600] shadow-[0_0_15px_rgba(255,230,0,0.35)] hover:bg-[#ffe600] hover:text-black transition-all duration-200"
                >
                  <Feather className="h-3.5 w-3.5" />
                  <span>NOVEL DECK</span>
                </Link>
              </div>
            </div>

            {/* Right: 80s Cyberdeck Player 1 Scorecard */}
            <div className="relative rounded-xl border-2 border-cyan-400/40 bg-black/60 p-5 shadow-[0_0_25px_rgba(0,240,255,0.15)] backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-cyan-400/30 pb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-13 w-13 shrink-0">
                    {user.avatar ? (
                      <img
                        src={cloudinaryFit(user.avatar, 120)}
                        alt=""
                        className="relative z-10 h-12 w-12 rounded-xl object-cover ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                      />
                    ) : (
                      <span className="relative z-10 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#ff007f] to-[#7928ca] font-black text-lg text-white ring-2 ring-cyan-400">
                        {(user.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <AvatarDecoration frame={(user as any).activeFrame} effect={(user as any).activeEffect} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-black tracking-wide text-white uppercase">{user.username}</p>
                      <span className="rounded border border-[#ff007f] bg-[#ff007f]/20 px-2 py-0.5 text-[9px] font-black tracking-wider text-[#ff66b2] shadow-[0_0_8px_rgba(255,0,127,0.3)]">
                        {roleBadge}
                      </span>
                    </div>
                    <p className="truncate text-xs font-mono text-cyan-300 uppercase tracking-widest mt-0.5">
                      {rankInfo.name}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/user/${encodeURIComponent(user.username)}`}
                  className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-2 text-cyan-300 hover:bg-cyan-400 hover:text-black transition shadow-sm"
                  title="ACCESS USER FILE"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* 80s LED Segmented Stats */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                    <Sparkles className="h-3 w-3 text-amber-400" /> STAGE LEVEL
                  </span>
                  <p className="mt-1 font-mono text-2xl font-black text-amber-200 tabular-nums drop-shadow-[0_0_8px_rgba(255,230,0,0.5)]">
                    LV.{level}
                  </p>
                </div>

                <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                    <Diamond className="h-3 w-3 text-cyan-400" /> HI-SCORE AP
                  </span>
                  <p className="mt-1 font-mono text-2xl font-black text-cyan-200 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                    {displayArisePoints(user)}
                  </p>
                </div>
              </div>

              {/* 80s Neon XP Gauge */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-300">
                  <span className="flex items-center gap-1 text-[#ff007f]"><Zap className="h-3 w-3" /> XP GAUGE</span>
                  <span className="text-cyan-300 tabular-nums">{level >= MAX_LEVEL ? "MAXED OUT" : `${Math.round(progress)}% TO NEXT`}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black border border-white/20 p-[1px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ff007f] via-[#ffe600] to-[#00f0ff] shadow-[0_0_10px_#ff007f] transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── THE BIG 3 MEDIA CASSETTES / CARTRIDGES ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 drop-shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              // PRIMARY CARTRIDGES
            </h2>
            <span className="text-xs font-black uppercase tracking-widest text-[#ff007f]">
              LOAD CARTRIDGE
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Anime Cassette */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-[#ff2a85]/60 bg-gradient-to-b from-[#240822] via-[#100315] to-[#06000a] p-6 shadow-[0_0_25px_rgba(255,42,133,0.2)] hover:border-[#ff2a85] hover:shadow-[0_0_35px_rgba(255,42,133,0.4)] transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="rounded border border-[#ff2a85] bg-[#ff2a85]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#ff66b2]">
                  TAPE 01 // SIDE A
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">VHS-SP</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#ff2a85] bg-[#ff2a85]/20 text-[#ff2a85] shadow-[0_0_12px_#ff2a85]">
                  <Tv className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-white tracking-wide">ANIME STREAM</h3>
                  <span className="text-[10px] text-pink-400 tracking-widest font-black uppercase">BROADCAST SIGNAL</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400 font-mono">
                Stream ongoing simulcasts, sub & dub audio releases, and classic animated archives.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-[#ff2a85]/30">
                <Link
                  href="/"
                  className="flex-1 rounded-lg bg-[#ff2a85] py-2 text-center text-xs font-black uppercase tracking-wider text-white hover:brightness-110 transition shadow-[0_0_12px_rgba(255,42,133,0.4)]"
                >
                  PLAY TAPE
                </Link>
                <Link
                  href="/explore"
                  className="rounded-lg border border-[#ff2a85]/40 bg-[#ff2a85]/10 px-3 py-2 text-xs text-[#ff66b2] hover:bg-[#ff2a85]/20 transition"
                  title="CATALOG INDEX"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Manhwa Cassette */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-[#00f0ff]/60 bg-gradient-to-b from-[#061e2a] via-[#030f17] to-[#01060a] p-6 shadow-[0_0_25px_rgba(0,240,255,0.2)] hover:border-[#00f0ff] hover:shadow-[0_0_35px_rgba(0,240,255,0.4)] transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="rounded border border-[#00f0ff] bg-[#00f0ff]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#00f0ff]">
                  TAPE 02 // VOL.84
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">CYBER-PULP</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#00f0ff] bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_12px_#00f0ff]">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-white tracking-wide">MANHWA COMICS</h3>
                  <span className="text-[10px] text-cyan-400 tracking-widest font-black uppercase">COLOR STRIPS</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400 font-mono">
                High-definition scans for Korean manhwa, Japanese manga, and Chinese manhua.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-[#00f0ff]/30">
                <Link
                  href="/manhwa"
                  className="flex-1 rounded-lg bg-[#00f0ff] py-2 text-center text-xs font-black uppercase tracking-wider text-black hover:brightness-110 transition shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                >
                  READ ISSUE
                </Link>
                <Link
                  href="/manhwa/explore"
                  className="rounded-lg border border-[#00f0ff]/40 bg-[#00f0ff]/10 px-3 py-2 text-xs text-[#00f0ff] hover:bg-[#00f0ff]/20 transition"
                  title="CATALOG INDEX"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Light Novels Cassette */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-[#ffe600]/60 bg-gradient-to-b from-[#2a2205] via-[#141002] to-[#080601] p-6 shadow-[0_0_25px_rgba(255,230,0,0.2)] hover:border-[#ffe600] hover:shadow-[0_0_35px_rgba(255,230,0,0.4)] transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="rounded border border-[#ffe600] bg-[#ffe600]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#ffe600]">
                  TAPE 03 // TEXTDECK
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">SERIAL</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#ffe600] bg-[#ffe600]/20 text-[#ffe600] shadow-[0_0_12px_#ffe600]">
                  <Feather className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-white tracking-wide">LIGHT NOVELS</h3>
                  <span className="text-[10px] text-yellow-400 tracking-widest font-black uppercase">TEXT ARCHIVE</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400 font-mono">
                Immersive reader for serialized light novels, translated web serials, and epubs.
              </p>
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-[#ffe600]/30">
                <Link
                  href="/novel"
                  className="flex-1 rounded-lg bg-[#ffe600] py-2 text-center text-xs font-black uppercase tracking-wider text-black hover:brightness-110 transition shadow-[0_0_12px_rgba(255,230,0,0.4)]"
                >
                  LOAD TEXT
                </Link>
                <Link
                  href="/novel/explore"
                  className="rounded-lg border border-[#ffe600]/40 bg-[#ffe600]/10 px-3 py-2 text-xs text-[#ffe600] hover:bg-[#ffe600]/20 transition"
                  title="CATALOG INDEX"
                >
                  <Compass className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 80s TERMINAL SEARCH & CATEGORY PUSH BUTTONS ── */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Terminal Input */}
            <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="> SEARCH_SECTOR_QUERY..."
                className="h-11 w-full rounded-xl border-2 border-cyan-400/50 bg-black/80 pl-10 pr-9 text-xs sm:text-sm font-mono text-cyan-200 placeholder:text-cyan-900 outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 80s LED Arcade Push Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
                      active
                        ? "border-[#ff007f] bg-[#ff007f] text-white shadow-[0_0_15px_#ff007f]"
                        : "border-white/15 bg-white/5 text-slate-400 hover:border-cyan-400 hover:text-cyan-300"
                    }`}
                  >
                    <span className="text-[9px] opacity-60 mr-1">[{cat.code}]</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ARCADE SECTORS GRID ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSections.map(({ href, label, desc, Icon, tint, badge, sectorCode }) => {
              const content = (
                <div className="group relative flex h-full flex-col justify-between rounded-xl border-2 border-white/10 bg-[#0a0514]/90 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#00f0ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:bg-[#100820]">
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-lg border shadow-md"
                        style={{ background: `${tint}20`, borderColor: tint, color: tint }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded border border-white/20 bg-black/60 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-slate-400">
                          {sectorCode}
                        </span>
                        {badge && (
                          <span className="rounded border border-rose-500 bg-rose-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-rose-300 animate-pulse shadow-[0_0_8px_#ff003c]">
                            {badge}
                          </span>
                        )}
                        <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                      </div>
                    </div>

                    <h4 className="mt-4 text-base font-black uppercase tracking-wide text-white transition group-hover:text-cyan-300">
                      {label}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400 font-mono">
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

      {/* ── 80s GEMS VECTOR SELECTOR MODAL ── */}
      <AnimatePresence>
        {gemsOpen && (
          <div className="fixed inset-0 z-[120] grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              onClick={() => setGemsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-2xl border-2 border-[#ff007f] bg-[#0c0418] p-6 shadow-[0_0_40px_rgba(255,0,127,0.35)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[#ff007f]/40 pb-3">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#ff007f] to-cyan-400">
                    // SELECT GEM DISK
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 font-mono">
                    WEEKLY CURATED GOLD MINES FROM THE COMMUNITY.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGemsOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-slate-400 hover:border-cyan-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  { href: "/gems/anime", label: "ANIME GEMS // CH-01", Icon: Tv, tint: "#ff2a85" },
                  { href: "/gems/manhwa", label: "MANHWA GEMS // VOL-84", Icon: BookOpen, tint: "#00f0ff" },
                  { href: "/gems/novel", label: "NOVEL GEMS // DOC-99", Icon: Feather, tint: "#ffe600" },
                ].map(({ href, label, Icon, tint }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setGemsOpen(false)}
                    className="group flex items-center gap-3 rounded-xl border-2 border-white/10 bg-white/5 p-3.5 transition hover:border-[#00f0ff] hover:bg-cyan-950/30"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-md"
                      style={{ background: `${tint}20`, borderColor: tint, color: tint }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 font-mono text-sm font-black uppercase text-white">{label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
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


