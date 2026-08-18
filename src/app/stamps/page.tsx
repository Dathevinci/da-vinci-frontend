"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stamp,
  Trophy,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Sparkles,
  LogIn,
  Globe,
  Flame,
  Award,
  Crown,
  Medal,
  Clock,
  ArrowRight,
  CheckCircle2,
  Tv,
  BookMarked,
  BookOpen,
} from "lucide-react";
import { StampSeal } from "@/components/stamp/StampSeal";
import RecCard from "@/components/stamp/RecCard";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import {
  StampFeedType,
  StampRankingEntry,
  StampRec,
  StampRequestError,
  GRADE_BANDS,
  daysUntilMonday,
  fetchRecentStamps,
  fetchStampFeed,
  fetchStampRankings,
  hasStampSession,
  isoWeekKey,
  weekKeyAgo,
} from "@/lib/stamps";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { cloudinaryFit } from "@/lib/cloudinary";
import { nameColorClass } from "@/lib/cosmetics";

type Tab = "board" | "all" | "feed";

const TAB_PARAM: Record<string, Tab> = { board: "board", all: "all", feed: "feed" };

const MODE_FILTERS: { key: StampFeedType; label: string; Icon: any }[] = [
  { key: "all", label: "All Media", Icon: Globe },
  { key: "anime", label: "Anime", Icon: Tv },
  { key: "manhwa", label: "Manhwa", Icon: BookMarked },
  { key: "novel", label: "Novels", Icon: BookOpen },
];

function SessionWarning() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-3.5 backdrop-blur-md shadow-lg shadow-amber-500/5"
    >
      <p className="text-xs leading-relaxed text-amber-200">
        Your voting session expired. Sign in again to cast recommendation votes — previous votes are preserved.
      </p>
      <Link
        href="/login"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/30"
      >
        <LogIn className="h-3.5 w-3.5" /> Sign in again
      </Link>
    </motion.div>
  );
}

const PODIUM_META: Record<
  number,
  {
    gradient: string;
    border: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    label: string;
    icon: any;
  }
> = {
  1: {
    gradient: "from-amber-500/20 via-[#0e0c08] to-[#070709]",
    border: "border-amber-400/50 hover:border-amber-400/80",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.2)]",
    badgeBg: "bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]",
    badgeText: "text-amber-300",
    label: "1ST PLACE · CHAMPION",
    icon: Crown,
  },
  2: {
    gradient: "from-slate-400/20 via-[#0b0c10] to-[#070709]",
    border: "border-slate-300/40 hover:border-slate-300/70",
    glow: "shadow-[0_0_35px_rgba(203,213,225,0.12)]",
    badgeBg: "bg-gradient-to-r from-slate-200 to-slate-400 text-black shadow-[0_0_12px_rgba(203,213,225,0.3)]",
    badgeText: "text-slate-300",
    label: "2ND PLACE · RUNNER UP",
    icon: Medal,
  },
  3: {
    gradient: "from-amber-700/20 via-[#0e0906] to-[#070709]",
    border: "border-amber-700/40 hover:border-amber-700/70",
    glow: "shadow-[0_0_35px_rgba(180,83,9,0.12)]",
    badgeBg: "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-[0_0_12px_rgba(180,83,9,0.3)]",
    badgeText: "text-amber-400",
    label: "3RD PLACE · PODIUM",
    icon: Award,
  },
};

const BOARD_SIZE = 100;

function ScoreSplit({ e, live }: { e: StampRankingEntry; live: boolean }) {
  if (!e.weekSplit && !e.lifetime) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono text-white/50">
      {e.weekSplit && (
        <>
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-300">
            +{e.weekSplit.organic.toLocaleString()} earned
          </span>
          <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-bold text-amber-300">
            +{e.weekSplit.boosted.toLocaleString()} boosted
          </span>
        </>
      )}
      {e.lifetime && (
        <span className="text-white/40 text-[10px]">
          ({e.lifetime.score.toLocaleString()} all-time)
        </span>
      )}
    </div>
  );
}

function Curator({ e, size = "sm" }: { e: StampRankingEntry; size?: "sm" | "lg" }) {
  const px = size === "lg" ? "h-7 w-7" : "h-6 w-6";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative shrink-0">
        {e.avatar ? (
          <img
            src={cloudinaryFit(e.avatar, 80)}
            alt=""
            loading="lazy"
            className={`${px} rounded-full object-cover ring-1 ring-white/20`}
          />
        ) : (
          <span className={`grid ${px} place-items-center rounded-full bg-violet-700 text-xs font-black text-white ring-1 ring-white/20`}>
            {(e.username || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="truncate text-sm font-black text-white hover:text-amber-300 transition-colors">
        {e.username}
      </span>
      <span
        title="All-time Grade Tier"
        className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-black tracking-wider text-amber-300 shadow-sm"
      >
        {e.grade}
      </span>
    </div>
  );
}

function PodiumCard({ e, mine, live }: { e: StampRankingEntry; mine: boolean; live: boolean }) {
  const meta = PODIUM_META[e.rank] ?? PODIUM_META[3];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: (e.rank - 1) * 0.08 }}
      className="group relative"
    >
      <Link
        href={`/user/${encodeURIComponent(e.username)}`}
        className={`relative flex flex-col items-center gap-3.5 rounded-3xl border bg-gradient-to-b ${meta.gradient} p-6 sm:p-7 text-center backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] ${meta.border} ${meta.glow} ${
          mine ? "ring-2 ring-violet-400" : ""
        }`}
      >
        {/* Top Medal Ribbon */}
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${meta.badgeBg}`}>
          <Icon className="h-3 w-3" />
          <span>{meta.label}</span>
        </div>

        {/* Animated Wax Seal */}
        <div className="my-1 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
          <StampSeal username={e.username} grade={e.grade} size="md" rank={e.topThreeRank} animated />
        </div>

        {/* Curator Identity */}
        <div className="flex w-full min-w-0 items-center justify-center">
          <Curator e={e} size="lg" />
        </div>

        {/* Score Display */}
        <div className="my-1">
          <p className="font-fell text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-md">
            {e.weekScore.toLocaleString()}
          </p>
          <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white/40">
            {live ? "points this week" : "points that week"}
          </p>
        </div>

        {/* Score Breakdown */}
        <ScoreSplit e={e} live={live} />
      </Link>
    </motion.div>
  );
}

function BoardRow({ e, mine, live, index }: { e: StampRankingEntry; mine: boolean; live: boolean; index: number }) {
  const isTopTen = e.rank <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
    >
      <Link
        href={`/user/${encodeURIComponent(e.username)}`}
        className={`group flex items-center gap-3.5 rounded-2xl sm:rounded-3xl border p-3.5 sm:px-6 sm:py-4 transition-all duration-200 hover:border-amber-400/40 hover:bg-[#0e0d16] hover:shadow-xl ${
          mine
            ? "border-violet-400/50 bg-violet-500/10 shadow-lg shadow-violet-500/5"
            : "border-white/10 bg-[#0b0b11]/90"
        }`}
      >
        {/* Rank Number */}
        <div className="w-10 sm:w-12 shrink-0 text-center">
          <span
            className={`font-mono text-base sm:text-lg font-black tabular-nums ${
              isTopTen ? "text-amber-300 font-extrabold" : "text-white/40"
            }`}
          >
            #{e.rank}
          </span>
        </div>

        {/* Small Seal if in Top 3 */}
        <div className="hidden sm:grid h-12 w-12 shrink-0 place-items-center">
          {e.topThreeRank ? (
            <StampSeal username={e.username} grade={e.grade} size="sm" rank={e.topThreeRank} />
          ) : (
            <span className="h-2 w-2 rounded-full bg-white/10" />
          )}
        </div>

        {/* Curator details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Curator e={e} />
          </div>
          <div className="mt-1">
            <ScoreSplit e={e} live={live} />
          </div>
        </div>

        {/* Score column */}
        <div className="shrink-0 text-right">
          <p className="font-fell text-xl sm:text-2xl font-bold tabular-nums text-white group-hover:text-amber-300 transition-colors">
            {e.weekScore.toLocaleString()}
          </p>
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/40">
            {live ? "points" : "final"}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function StampsPage() {
  const { user } = useUser();
  const viewerId = user?.id || null;

  const [tab, setTab] = useState<Tab>("board");
  const [weekAgo, setWeekAgo] = useState(0);
  const [entries, setEntries] = useState<StampRankingEntry[]>([]);
  const [serverWeek, setServerWeek] = useState<string | null>(null);
  const [boardLoaded, setBoardLoaded] = useState(false);

  const [feed, setFeed] = useState<StampRec[]>([]);
  const [feedLoaded, setFeedLoaded] = useState(false);

  const [browseType, setBrowseType] = useState<StampFeedType>("all");
  const [browse, setBrowse] = useState<StampRec[]>([]);
  const [browseCursor, setBrowseCursor] = useState<string | null>(null);
  const [browseLoaded, setBrowseLoaded] = useState(false);
  const [browsingMore, setBrowsingMore] = useState(false);
  const [browseFailed, setBrowseFailed] = useState(false);
  const browseRun = useRef(0);

  const [needsSignIn, setNeedsSignIn] = useState(false);
  useEffect(() => {
    setNeedsSignIn(!!viewerId && !hasStampSession());
  }, [viewerId]);

  const loadBoard = useCallback(async () => {
    setBoardLoaded(false);
    try {
      const wanted = weekAgo === 0 ? null : weekKeyAgo(weekAgo);
      const d = await fetchStampRankings(wanted);
      setEntries(d.entries);
      setServerWeek(d.week);
    } catch {
      setEntries([]);
      setServerWeek(null);
    } finally {
      setBoardLoaded(true);
    }
  }, [weekAgo]);

  useEffect(() => {
    if (tab === "board") loadBoard();
  }, [tab, loadBoard]);

  const loadFeed = useCallback(async () => {
    if (!viewerId) {
      setFeedLoaded(true);
      return;
    }
    setFeedLoaded(false);
    try {
      const recs = await fetchStampFeed(viewerId);
      setFeed(recs);
    } catch {
      setFeed([]);
    } finally {
      setFeedLoaded(true);
    }
  }, [viewerId]);

  useEffect(() => {
    if (tab === "feed") loadFeed();
  }, [tab, loadFeed]);

  const loadBrowse = useCallback(async () => {
    const run = ++browseRun.current;
    setBrowseLoaded(false);
    setBrowseFailed(false);
    setBrowse([]);
    setBrowseCursor(null);
    try {
      const page = await fetchRecentStamps({ type: browseType, viewer: viewerId });
      if (run !== browseRun.current) return;
      setBrowse(page.recs);
      setBrowseCursor(page.nextCursor);
    } catch {
      if (run !== browseRun.current) return;
      setBrowse([]);
      setBrowseCursor(null);
      setBrowseFailed(true);
    } finally {
      if (run === browseRun.current) setBrowseLoaded(true);
    }
  }, [browseType, viewerId]);

  useEffect(() => {
    if (tab === "all") loadBrowse();
  }, [tab, loadBrowse]);

  const loadMoreBrowse = useCallback(async () => {
    if (!browseCursor || browsingMore) return;
    const run = browseRun.current;
    setBrowsingMore(true);
    try {
      const page = await fetchRecentStamps({
        type: browseType,
        cursor: browseCursor,
        viewer: viewerId,
      });
      if (run !== browseRun.current) return;
      setBrowse((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.recs.filter((r) => !seen.has(r.id))];
      });
      setBrowseCursor(page.nextCursor);
    } catch (e) {
      if (e instanceof StampRequestError && e.code === "BAD_CURSOR") {
        loadBrowse();
        return;
      }
    } finally {
      setBrowsingMore(false);
    }
  }, [browseCursor, browsingMore, browseType, viewerId, loadBrowse]);

  useEffect(() => {
    const wanted = TAB_PARAM[new URLSearchParams(window.location.search).get("tab") || ""];
    if (wanted) setTab(wanted);
  }, []);

  const week = serverWeek || (weekAgo === 0 ? isoWeekKey() : weekKeyAgo(weekAgo));
  const daysLeft = daysUntilMonday();
  const live = weekAgo === 0;
  const podiumIsWorn = weekAgo === 1;
  const myRank = (viewerId && entries.find((e) => e.userId === viewerId)?.rank) || null;

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-36 pt-10 font-mono text-white selection:bg-amber-500/30 selection:text-amber-200">
        {/* Subtle Ambient Background Gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-amber-600/15 via-amber-900/10 to-transparent blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -right-60 w-[500px] h-[500px] bg-amber-950/10 blur-[130px] rounded-full" />
        <div className="pointer-events-none absolute bottom-20 -left-60 w-[500px] h-[500px] bg-yellow-950/10 blur-[130px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-5xl">
          
          {/* ── HEADER HERO ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Curator Leaderboard & Reputation Seals</span>
              </div>
              
              <h1 className="font-fell text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-[0.06em] text-white drop-shadow-md">
                Stamps
              </h1>
              
              <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-slate-400 font-mono">
                Three curated recommendations, one official reputation seal, and a live grade answering to the community.
              </p>
            </div>

            {user && (
              <Link
                href={`/user/${encodeURIComponent(user.username)}`}
                className="inline-flex items-center gap-2.5 self-start md:self-auto rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500 to-yellow-600 px-6 py-3 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all hover:scale-105 hover:brightness-110 active:scale-95"
              >
                <Stamp className="h-4 w-4" />
                <span>Your Stamp & Profile</span>
              </Link>
            )}
          </div>

          {/* ── TABS NAVIGATION (Pill Switcher) ── */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex w-max items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] p-1.5 shadow-2xl backdrop-blur-xl">
              {[
                { key: "board" as const, label: `Top ${BOARD_SIZE} Board`, hint: "Weekly Ranking", Icon: Trophy },
                { key: "all" as const, label: "All Stamps", hint: "Live Recommendations", Icon: Globe },
                { key: "feed" as const, label: "Following", hint: "Curator Feed", Icon: Users },
              ].map(({ key, label, hint, Icon }) => {
                const on = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`group relative flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition sm:px-6 sm:py-2.5 ${
                      on
                        ? "border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-md shadow-amber-500/10"
                        : "border-transparent text-white/50 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 transition ${on ? "text-amber-300" : "text-white/40 group-hover:text-white"}`} />
                    <span className="text-left font-mono">
                      <span className="block text-xs sm:text-sm font-bold uppercase tracking-wider">{label}</span>
                      <span className={`hidden text-[9px] font-bold uppercase tracking-wider sm:block ${on ? "text-amber-300/70" : "text-white/30"}`}>
                        {hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════ TAB 1: BOARD ═══════════════════ */}
          {tab === "board" && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-8 space-y-6"
            >
              {/* Week Strip Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-5 backdrop-blur-xl shadow-xl">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-fell text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
                        Week {week}
                      </p>
                      {live && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Week
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-white/50">
                      {live
                        ? `Scored on votes and boosts this week · resets Monday (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`
                        : podiumIsWorn
                          ? "Last week — this top three wear their seals on covers right now"
                          : "Archived finished week"}
                    </p>
                    {myRank !== null && (
                      <p className="mt-1.5 text-xs font-bold text-violet-300 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        <span>You&rsquo;re ranked <b>#{myRank}</b> {live ? "this week" : "that week"}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Week Navigation Controls */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWeekAgo((w) => w + 1)}
                    aria-label="Previous week"
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={live}
                    onClick={() => setWeekAgo((w) => Math.max(0, w - 1))}
                    aria-label="Next week"
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Podium & List */}
              <div>
                {!boardLoaded ? (
                  <div className="space-y-4 py-12">
                    <p className="text-center text-xs font-bold text-white/40">Loading leaderboard standings…</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-64 rounded-3xl border border-white/[0.06] bg-[#0b0b11] animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center shadow-xl">
                    <Trophy className="mx-auto h-10 w-10 text-white/20" />
                    <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">No stamps scored yet this week</p>
                    <p className="mt-1 text-xs text-white/40">Cast the first votes on recommendations to rank curators!</p>
                  </div>
                ) : (
                  <>
                    {/* Top 3 Podium */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      {entries.slice(0, 3).map((e) => (
                        <PodiumCard key={e.userId} e={e} mine={viewerId === e.userId} live={live} />
                      ))}
                    </div>

                    {/* Rest of the Board (4 - 100) */}
                    {entries.length > 3 && (
                      <div className="mt-10 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <h2 className="font-fell text-xl font-bold uppercase tracking-wider text-white">
                            The Rest of the Board
                          </h2>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-white/50">
                            Ranks 4 – {entries.length}
                          </span>
                        </div>

                        <div className="space-y-2.5 pt-2">
                          {entries.slice(3).map((e, idx) => (
                            <BoardRow key={e.userId} e={e} mine={viewerId === e.userId} live={live} index={idx} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════ TAB 2: ALL STAMPS ═══════════════════ */}
          {tab === "all" && (
            <motion.div
              key="all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-8 space-y-6"
            >
              {/* Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  {MODE_FILTERS.map((m) => {
                    const on = browseType === m.key;
                    const Icon = m.Icon;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setBrowseType(m.key)}
                        className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                          on
                            ? "border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-md shadow-amber-500/10"
                            : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-white/40">
                  Showing latest active recommendations across all members.
                </p>
              </div>

              {needsSignIn && <SessionWarning />}

              {/* Browse List */}
              {!browseLoaded ? (
                <div className="space-y-3 py-12">
                  <p className="text-center text-xs font-bold text-white/40">Fetching recommendations…</p>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-44 rounded-3xl border border-white/[0.06] bg-[#0b0b11] animate-pulse" />
                  ))}
                </div>
              ) : browseFailed ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center">
                  <Globe className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-4 text-sm text-slate-400">Couldn&rsquo;t read recommendations just now.</p>
                  <button
                    type="button"
                    onClick={loadBrowse}
                    className="mt-4 rounded-full border border-amber-400/40 bg-amber-500/20 px-5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    Try again
                  </button>
                </div>
              ) : browse.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center">
                  <Stamp className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">No stamps found</p>
                  <p className="mt-1 text-xs text-white/40">Be the first to stamp a title in this category!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {browse.map((rec) => (
                    <RecCard
                      key={rec.id}
                      rec={rec}
                      variant="feed"
                      viewerId={viewerId}
                      needsSignIn={needsSignIn}
                      showOwner
                    />
                  ))}

                  {browseCursor && (
                    <div className="pt-4 text-center">
                      <button
                        type="button"
                        onClick={loadMoreBrowse}
                        disabled={browsingMore}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-8 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                      >
                        {browsingMore ? "Loading more stamps…" : "Load More Stamps"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════ TAB 3: FEED (FOLLOWING) ═══════════════════ */}
          {tab === "feed" && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-8 space-y-6"
            >
              {!user ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center shadow-xl">
                  <Users className="mx-auto h-10 w-10 text-white/20" />
                  <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">Sign in to view followed curators</p>
                  <p className="mt-1 text-xs text-white/40">Follow curators across the community to see their recommendations here.</p>
                  <Link
                    href="/login"
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/20 px-6 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    <LogIn className="h-4 w-4" /> Sign In
                  </Link>
                </div>
              ) : !feedLoaded ? (
                <div className="space-y-3 py-12">
                  <p className="text-center text-xs font-bold text-white/40">Reading your curator feed…</p>
                  {[0, 1].map((i) => (
                    <div key={i} className="h-44 rounded-3xl border border-white/[0.06] bg-[#0b0b11] animate-pulse" />
                  ))}
                </div>
              ) : feed.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center shadow-xl">
                  <Users className="mx-auto h-10 w-10 text-white/20" />
                  <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">Your feed is quiet</p>
                  <p className="mt-1 text-xs text-white/40 max-w-sm mx-auto">
                    Follow curators on the leaderboard or explore recommendations across the site.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTab("board")}
                      className="rounded-full border border-amber-400/40 bg-amber-500/20 px-5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                    >
                      Top Curators Board
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("all")}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.08]"
                    >
                      Browse All Stamps
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {needsSignIn && <SessionWarning />}
                  {feed.map((rec) => (
                    <RecCard
                      key={rec.id}
                      rec={rec}
                      variant="feed"
                      viewerId={viewerId}
                      needsSignIn={needsSignIn}
                      showOwner
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════ HOW IT WORKS (BENTO) ═══════════════════ */}
          <div className="mt-16 border-t border-white/10 pt-10">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
                <Award className="h-4 w-4" />
              </span>
              <h2 className="font-fell text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white">
                How Stamps & Reputation Work
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Three Recommendations",
                  d: "Your stamp profile holds up to three active recommendations at a time. Retiring a recommendation frees a slot without wiping its earned reputation.",
                },
                {
                  n: "02",
                  t: "Reader Validated",
                  d: "Votes are weighted from readers who actually open and read chapters/episodes of the recommended title to ensure genuine recommendations.",
                },
                {
                  n: "03",
                  t: "Point Boost Limits",
                  d: "Arise Points can boost visibility, but are capped strictly by earned reader score. Nobody can purchase high grades from zero.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-6 backdrop-blur-xl shadow-xl"
                >
                  <span className="font-fell text-2xl font-bold text-amber-400/60">{s.n}</span>
                  <p className="mt-3 font-fell text-lg font-bold uppercase tracking-wider text-white">{s.t}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400 font-mono">{s.d}</p>
                </div>
              ))}
            </div>

            {/* Published Grade Bands */}
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Grade Tier Thresholds
                </span>
                <span className="text-[11px] text-amber-300 font-bold">Resets Weekly on Monday</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {GRADE_BANDS.map((b) => (
                  <div
                    key={b.grade}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-center transition hover:border-amber-400/40 hover:bg-amber-500/10"
                  >
                    <p className="font-fell text-xl font-bold text-amber-300">{b.grade}</p>
                    <p className="mt-1 font-mono text-[10px] tabular-nums text-white/50">
                      {b.max === null
                        ? `${b.min}+`
                        : b.min === -Infinity
                          ? "< 0"
                          : `${b.min}–${b.max}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
