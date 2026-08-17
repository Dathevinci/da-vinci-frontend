"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Trophy, Crown, Medal, Swords, Layers, Gem, Zap, Flame, Shield, Users, Sparkles, Star } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { displayShards, isAdmin, isLeadDev } from "@/lib/admin";
import PageTransition from "@/components/layout/PageTransition";
import { calculateLevel, MAX_LEVEL } from "@/lib/levels";
import { fetchGuilds, type GuildRow } from "@/lib/guild";
import { SegBar, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";
import GuildTag from "@/components/guild/GuildTag";
import VideoTitle from "@/components/ui/VideoTitle";
import { cloudinaryFit } from "@/lib/cloudinary";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Row = {
  userId: string;
  username: string;
  avatar: string | null;
  cardTitle: string | null;
  role?: string | null;
  xp: number;
  shards: number;
  cards: number;
  rating: number | null;
  wins: number;
  losses: number;
  streak: number;
};

type Lens = "level" | "duels" | "cards" | "shards" | "guilds";

const LENSES: { key: Lens; label: string; Icon: any; blurb: string }[] = [
  { key: "level", label: "Level", Icon: Zap, blurb: "Ranked by experience points earned" },
  { key: "duels", label: "Duels", Icon: Swords, blurb: "Ranked by competitive duel rating" },
  { key: "cards", label: "Collection", Icon: Layers, blurb: "Ranked by unique cards unlocked" },
  { key: "shards", label: "Shards", Icon: Gem, blurb: "Ranked by total shards held" },
  { key: "guilds", label: "Guilds", Icon: Shield, blurb: "Halls ranked by guild achievements" },
];

type GuildLensSort = "level" | "xp" | "members";

const GUILD_LENS_SORTS: { key: GuildLensSort; label: string; blurb: string }[] = [
  { key: "level", label: "Level", blurb: "Halls ranked by guild level" },
  { key: "xp", label: "Total XP", blurb: "Halls ranked by total guild XP" },
  { key: "members", label: "Members", blurb: "Halls ranked by members mustered" },
];

const GUILD_PAGE = 50;

function PodiumFigure({
  slot,
  href,
  image,
  letter,
  name,
  chip,
  big,
  small,
  round = true,
  fallbackClass = "bg-violet-700",
}: {
  slot: number;
  href: string;
  image: string | null;
  letter: string;
  name: string;
  chip?: ReactNode;
  big: string;
  small: string;
  round?: boolean;
  fallbackClass?: string;
}) {
  const place = slot === 1 ? 1 : slot === 0 ? 2 : 3;
  const isFirst = place === 1;
  const isSecond = place === 2;

  const tint = isFirst ? "#fbbf24" : isSecond ? "#cbd5e1" : "#d97706";
  const glow = isFirst
    ? "shadow-[0_0_35px_rgba(251,191,36,0.35)] ring-amber-400"
    : isSecond
    ? "shadow-[0_0_25px_rgba(203,213,225,0.25)] ring-slate-300"
    : "shadow-[0_0_25px_rgba(217,119,6,0.25)] ring-amber-700";

  const PIcon = isFirst ? Crown : isSecond ? Trophy : Medal;
  const size = isFirst ? 116 : 88;
  const shape = round ? "rounded-full" : "rounded-2xl";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: slot * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className={`flex w-[31%] max-w-[190px] flex-col items-center font-mono ${isFirst ? "-translate-y-6 sm:-translate-y-8" : ""}`}
    >
      <Link href={href} className="group relative block transition-transform duration-300 hover:scale-105">
        {/* Glow backdrop */}
        <span
          aria-hidden
          className="absolute -inset-4 -z-10 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `${tint}30`, opacity: isFirst ? 0.9 : 0.6 }}
        />

        {/* Crown Badge */}
        <div
          className="absolute -top-3 -right-2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-[#09090b] shadow-lg"
          style={{ background: tint }}
        >
          <PIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[#0f0a1c]" />
        </div>

        {/* Avatar Container */}
        <div
          className={`relative overflow-hidden ${shape} ring-4 ${glow} transition-all duration-300`}
          style={{ width: size, height: size }}
        >
          {image ? (
            <img
              src={cloudinaryFit(image, 180)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <span className={`grid h-full w-full place-items-center ${fallbackClass} text-2xl sm:text-3xl font-black text-white`}>
              {letter}
            </span>
          )}
        </div>
      </Link>

      {/* Rank Place Pill */}
      <span
        className="mt-3.5 rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm"
        style={{ background: `${tint}18`, borderColor: `${tint}60`, color: tint }}
      >
        {isFirst ? "1st Place" : isSecond ? "2nd Place" : "3rd Place"}
      </span>

      {/* Name & Chip */}
      <div className="mt-2 flex max-w-full items-center justify-center gap-1.5 px-1">
        <Link
          href={href}
          className="min-w-0 truncate text-sm sm:text-base font-bold text-white transition-colors hover:text-amber-300"
        >
          {name}
        </Link>
        {chip}
      </div>

      {/* Value */}
      <span className="mt-0.5 text-base sm:text-lg font-bold tabular-nums text-white" style={{ color: isFirst ? "#fef08a" : undefined }}>
        {big}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{small}</span>
    </motion.div>
  );
}

function GuildTagChip({ tag, size = "xs" }: { tag: string; size?: "xs" | "sm" }) {
  if (!tag) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 align-middle font-mono font-bold leading-none tracking-wider text-emerald-300 ${
        size === "sm" ? "py-[3px] text-[10px]" : "py-[2px] text-[9px]"
      }`}
    >
      [{tag}]
    </span>
  );
}

function GuildStat({ icon: Icon, tone = "text-white/40", children }: { icon: any; tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {children}
    </span>
  );
}

function GuildBoard({ rows, loading, sort }: { rows: GuildRow[]; loading: boolean; sort: GuildLensSort }) {
  const metric = (g: GuildRow) => {
    if (sort === "members") {
      return { big: g.memberCap !== null ? `${g.memberCount}/${g.memberCap}` : `${g.memberCount}`, small: "members" };
    }
    if (sort === "xp") return { big: g.xp.toLocaleString(), small: "guild XP" };
    return { big: `Lv ${g.level}`, small: `${g.xp.toLocaleString()} XP` };
  };
  const barOf = (g: GuildRow) => (sort === "members" ? g.memberCount : sort === "xp" ? g.xp : g.level);

  if (loading) {
    return <p className="py-24 text-center text-xs font-mono text-white/40">Loading hall records…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b0b11] py-20 text-center font-mono">
        <Shield className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-3 text-sm font-bold text-white/50">No hall has raised a banner yet.</p>
      </div>
    );
  }

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const best = Math.max(1, ...rows.map(barOf));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── PODIUM ── */}
      <div className="mb-14 flex items-end justify-center gap-3 sm:gap-6 pt-4">
        {[top[1], top[0], top[2]].map((g, i) =>
          g ? (
            <PodiumFigure
              key={g.id}
              slot={i}
              href={`/guild/${encodeURIComponent(g.id)}`}
              image={g.avatar}
              letter={g.name?.[0]?.toUpperCase() || "?"}
              name={g.name}
              chip={<GuildTagChip tag={g.tag} />}
              big={metric(g).big}
              small={metric(g).small}
              round={false}
              fallbackClass="bg-emerald-900/70 text-emerald-200"
            />
          ) : (
            <div key={i} className="w-[30%]" />
          )
        )}
      </div>

      {/* ── REST LIST ── */}
      <div className="space-y-2.5 font-mono">
        {rest.map((g, i) => {
          const m = metric(g);
          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="rounded-2xl border border-white/10 bg-[#0b0b11] transition-all duration-200 hover:border-emerald-400/40 hover:bg-[#0e0e16]"
            >
              <Link href={`/guild/${encodeURIComponent(g.id)}`} className="group flex items-center gap-3.5 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-xs font-bold tabular-nums text-white/50">
                  #{i + 4}
                </span>
                {g.avatar ? (
                  <img
                    src={cloudinaryFit(g.avatar, 80)}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-900/70 text-xs font-black text-emerald-200 ring-1 ring-white/10">
                    {g.name?.[0]?.toUpperCase() || "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {g.name}
                    </span>
                    <GuildTagChip tag={g.tag} size="sm" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <GuildStat icon={Shield} tone="text-emerald-300/90">
                      Lv {g.level}
                    </GuildStat>
                    <GuildStat icon={Users}>
                      {g.memberCap !== null ? `${g.memberCount}/${g.memberCap}` : `${g.memberCount}`}
                    </GuildStat>
                    <GuildStat icon={Sparkles}>{g.xp.toLocaleString()} XP</GuildStat>
                    <GuildStat icon={Gem}>{g.shards.toLocaleString()} Shards</GuildStat>
                  </div>
                  <div className="mt-2">
                    <SegBar value={barOf(g)} max={best} height={4} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-emerald-300">{m.big}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{m.small}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function LeaderboardPage() {
  const { user } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [lens, setLens] = useState<Lens>("level");
  const [loading, setLoading] = useState(true);
  const [guilds, setGuilds] = useState<GuildRow[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildSort, setGuildSort] = useState<GuildLensSort>("level");

  useEffect(() => {
    fetch(`${API_URL}/api/cards/ladder`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data)) setRows(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    setGuildsLoading(true);
    fetchGuilds({ sort: guildSort, perPage: GUILD_PAGE })
      .then(({ rows: g }) => {
        if (alive) setGuilds(g);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setGuildsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [guildSort]);

  const keepers = useMemo(
    () =>
      rows
        .filter((r) => isAdmin(r))
        .sort((a, b) => (isLeadDev(b) ? 1 : 0) - (isLeadDev(a) ? 1 : 0) || b.xp - a.xp),
    [rows]
  );

  const ranked = useMemo(() => {
    const v = (r: Row) =>
      lens === "level"
        ? r.xp
        : lens === "duels"
        ? r.rating ?? -1
        : lens === "cards"
        ? r.cards
        : r.shards;
    const base = lens === "level" ? rows.filter((r) => !isAdmin(r)) : rows;
    const pool = lens === "duels" ? base.filter((r) => r.rating !== null) : base;
    return [...pool].sort((a, b) => v(b) - v(a));
  }, [rows, lens]);

  const rankedGuilds = useMemo(() => {
    const v = (g: GuildRow) => (guildSort === "members" ? g.memberCount : guildSort === "xp" ? g.xp : g.level);
    return [...guilds].sort((a, b) => v(b) - v(a) || b.xp - a.xp || b.memberCount - a.memberCount);
  }, [guilds, guildSort]);

  const metric = (r: Row) => {
    if (lens === "level") return { big: `Lv ${calculateLevel(r.xp)}`, small: `${r.xp.toLocaleString()} XP` };
    if (lens === "duels") return { big: `${r.rating}`, small: `${r.wins}W ${r.losses}L` };
    if (lens === "cards") return { big: `${r.cards}`, small: "cards" };
    return { big: displayShards(r, r.shards), small: "shards" };
  };

  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const best = ranked.length
    ? Math.max(
        1,
        lens === "level"
          ? ranked[0].xp
          : lens === "duels"
          ? ranked[0].rating ?? 1
          : lens === "cards"
          ? ranked[0].cards
          : ranked[0].shards
      )
    : 1;
  const barOf = (r: Row) =>
    lens === "level" ? r.xp : lens === "duels" ? r.rating ?? 0 : lens === "cards" ? r.cards : r.shards;
  const active = LENSES.find((l) => l.key === lens)!;
  const activeGuildSort = GUILD_LENS_SORTS.find((s) => s.key === guildSort)!;
  const blurb = lens === "guilds" ? activeGuildSort.blurb : active.blurb;

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#09090b] px-4 pb-36 pt-24 font-mono text-white">
        {/* Subtle top ambient radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_60%_80%_at_50%_-10%,rgba(139,92,246,0.18),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-4xl space-y-8">
          
          {/* ── HEADER WITH VIDEO DISPLAY TYPOGRAPHY ── */}
          <div className="text-center font-mono">
            <p className="text-[10px] font-bold uppercase tracking-[0.42em] text-violet-400/80 mb-2">
              Da Vinci · Hall of Fame
            </p>
            <div className="mx-auto w-full max-w-2xl px-2">
              <VideoTitle text="Leaderboard" />
            </div>
            <p className="mt-2 text-xs sm:text-sm text-white/50">{blurb}</p>
          </div>

          {/* ── LENS TABS (PILL BAR) ── */}
          <div className="flex justify-center font-mono">
            <div className="inline-flex w-max items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] p-1.5 shadow-2xl backdrop-blur-xl">
              {LENSES.map(({ key, label, Icon }) => {
                const on = lens === key;
                return (
                  <button
                    key={key}
                    onClick={() => setLens(key)}
                    className={`group relative flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition sm:px-5 sm:py-2.5 ${
                      on
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-200 shadow-sm"
                        : "border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 transition ${on ? "text-violet-300" : "text-white/40 group-hover:text-white"}`}
                    />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── GUILD SORTS ── */}
          {lens === "guilds" && (
            <div className="flex justify-center -mt-3 font-mono">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/20 p-1 backdrop-blur-md">
                <span className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Sort By</span>
                {GUILD_LENS_SORTS.map(({ key, label }) => {
                  const on = guildSort === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setGuildSort(key)}
                      className={`rounded-full border px-3.5 py-1 text-xs font-bold tracking-wide transition ${
                        on
                          ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                          : "border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── THE KEEPERS STRIP ── */}
          {!loading && lens === "level" && keepers.length > 0 && (
            <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-950/30 via-[#0b0b11] to-amber-950/30 p-4 sm:p-5 shadow-xl shadow-amber-500/5 font-mono backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-amber-400/15 pb-2.5 mb-3">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                  <Crown className="h-4 w-4 text-amber-400" /> Keepers · Beyond the Ladder
                </span>
                <span className="text-[10px] text-amber-300/60 uppercase tracking-widest hidden sm:inline">Immortal Ranks</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                {keepers.map((k) => (
                  <div
                    key={k.userId}
                    className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5 hover:border-amber-400/30 transition"
                  >
                    <Link href={`/user/${k.username}`} className="group inline-flex min-w-0 items-center gap-2">
                      {k.avatar ? (
                        <img
                          src={cloudinaryFit(k.avatar, 80)}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-amber-400/50"
                        />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-[10px] font-black text-white ring-2 ring-amber-400/50">
                          {k.username?.[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 truncate text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {k.username}
                      </span>
                    </Link>
                    <GuildTag userId={k.userId} size="sm" />
                    <span className="shrink-0 text-xs font-bold tabular-nums text-amber-300/90">
                      Lv {isAdmin(k) ? MAX_LEVEL : calculateLevel(k.xp)} · {isLeadDev(k) ? "∞" : k.xp.toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BOARD CONTENT ── */}
          <AnimatePresence mode="wait">
            {lens === "guilds" ? (
              <GuildBoard key="guilds-board" rows={rankedGuilds} loading={guildsLoading} sort={guildSort} />
            ) : loading ? (
              <p key="loading" className="py-24 text-center text-xs font-mono text-white/40">Reading the ladder…</p>
            ) : ranked.length === 0 ? (
              <div key="empty" className="rounded-2xl border border-white/10 bg-[#0b0b11] py-20 text-center font-mono">
                <Trophy className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-3 text-sm font-bold text-white/50">Nobody has ranked here yet.</p>
              </div>
            ) : (
              <motion.div
                key={`player-board-${lens}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {/* ── PODIUM ── */}
                <div className="mb-14 flex items-end justify-center gap-3 sm:gap-6 pt-4">
                  {[top[1], top[0], top[2]].map((r, i) =>
                    r ? (
                      <PodiumFigure
                        key={r.userId}
                        slot={i}
                        href={`/user/${r.username}`}
                        image={r.avatar}
                        letter={r.username?.[0]?.toUpperCase() || "?"}
                        name={r.username}
                        chip={<GuildTag userId={r.userId} />}
                        big={metric(r).big}
                        small={metric(r).small}
                      />
                    ) : (
                      <div key={i} className="w-[30%]" />
                    )
                  )}
                </div>

                {/* ── LIST ROWS ── */}
                <div className="space-y-2.5 font-mono">
                  {rest.map((r, i) => {
                    const m = metric(r);
                    const me = r.userId === user?.id;
                    return (
                      <motion.div
                        key={r.userId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3 shadow-lg transition-all duration-200 ${
                          me
                            ? "border-violet-400/50 bg-violet-950/25 ring-1 ring-violet-500/20"
                            : "border-white/10 bg-[#0b0b11] hover:border-violet-400/40 hover:bg-[#0e0e16]"
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-xs font-bold tabular-nums text-white/50">
                          #{i + 4}
                        </span>
                        <Link href={`/user/${r.username}`} className="shrink-0 group">
                          {r.avatar ? (
                            <img
                              src={cloudinaryFit(r.avatar, 80)}
                              alt=""
                              className="h-11 w-11 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-violet-400/50 transition"
                            />
                          ) : (
                            <span className="grid h-11 w-11 place-items-center rounded-full bg-violet-700 text-xs font-black text-white ring-2 ring-white/10">
                              {r.username?.[0]?.toUpperCase()}
                            </span>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              href={`/user/${r.username}`}
                              className="min-w-0 truncate text-sm font-bold text-white hover:text-violet-300 transition-colors"
                            >
                              {r.username}
                            </Link>
                            <GuildTag userId={r.userId} size="sm" />
                            {me && (
                              <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.2 text-[9px] font-bold uppercase tracking-widest text-violet-300">
                                You
                              </span>
                            )}
                            {lens === "duels" && r.streak >= 3 && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black text-orange-300 border border-orange-500/20">
                                <Flame className="h-2.5 w-2.5" />
                                {r.streak} Streak
                              </span>
                            )}
                          </div>
                          {r.cardTitle && (
                            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-violet-400 mt-0.5">
                              {r.cardTitle}
                            </p>
                          )}
                          <div className="mt-2">
                            <SegBar value={barOf(r)} max={best} height={4} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums text-white" style={{ color: ACCENT_LIT }}>
                            {m.big}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{m.small}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
