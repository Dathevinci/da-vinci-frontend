"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Shield, Users, Search, Gem, Trophy, Lock, Globe, Sparkles, Check,
  ChevronLeft, ChevronRight, LayoutGrid, TrendingUp, ArrowRight, X, Flame
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import PageTransition from "@/components/layout/PageTransition";
import {
  fetchGuilds, findMyGuild, GUILD_PER_PAGE, GUILD_SORTS,
  type GuildListMeta, type GuildRow, type GuildSort,
} from "@/lib/guild";

/**
 * GUILDS — the browse hall.
 *
 * Search, sort and paging all live on the SERVER: this page holds the query in
 * local state, hands it to `GET /api/guilds`, and renders the answer.
 */

type Status = "loading" | "ready" | "error";

const HEADINGS: Record<GuildSort, string> = {
  level: "Top Guilds by Level",
  members: "Biggest Guilds",
  xp: "Top Guilds by XP",
  new: "Newest Guilds",
};

function Chip({
  icon: Icon,
  children,
  tone = "slate",
}: {
  icon: typeof Users;
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber" | "cyan" | "violet";
}) {
  const tones = {
    slate: "border-white/10 bg-white/[0.04] text-slate-300",
    emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.15)]",
    amber: "border-amber-400/30 bg-amber-500/15 text-amber-200",
    cyan: "border-cyan-400/30 bg-cyan-500/15 text-cyan-200",
    violet: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  };
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider ${tones[tone]} transition-all`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accentColor = "emerald",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  accentColor?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c16]/80 p-4 sm:p-5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:bg-[#10101f] shadow-lg">
      <div className="flex items-center justify-between">
        <span className="truncate text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </div>
      </div>
      <p className="mt-2 truncate font-fell text-2xl font-black tabular-nums text-white sm:text-3xl">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function GuildCard({ g, mine }: { g: GuildRow; mine: boolean }) {
  const full = g.memberCap !== null && g.memberCount >= g.memberCap;

  return (
    <Link
      href={`/guild/${encodeURIComponent(g.id)}`}
      className={`group relative block overflow-hidden rounded-3xl border p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
        mine
          ? "border-emerald-400/50 bg-gradient-to-b from-[#0a1813]/90 via-[#0a1410]/95 to-[#060c0a] shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/30"
          : "border-white/10 bg-gradient-to-b from-[#0e0c1a]/80 via-[#0a0814]/90 to-[#07050d] hover:border-emerald-400/30 hover:bg-[#110f22]"
      }`}
    >
      {/* Ambient Banner Backdrop */}
      {g.banner ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
          <img src={g.banner} alt="" loading="lazy" className="h-full w-full object-cover opacity-35 filter brightness-[0.8] group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-[#0a0814]/80 to-[#0a0814]" />
        </div>
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-950/20 via-transparent to-transparent opacity-60" />
      )}

      {/* Main Guild Info Header */}
      <div className="relative flex items-start gap-3.5 sm:gap-4">
        {/* Avatar with Ring */}
        <div className="relative shrink-0">
          {g.avatar ? (
            <img
              src={g.avatar}
              alt=""
              loading="lazy"
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover ring-2 ring-white/15 group-hover:ring-emerald-400/40 shadow-lg transition-all"
            />
          ) : (
            <span className="grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 text-xl font-black text-emerald-100 ring-2 ring-white/10 shadow-lg">
              {g.name?.[0]?.toUpperCase() || "?"}
            </span>
          )}
          {/* Mini Level badge pinned to bottom of avatar */}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-emerald-950 px-2 py-0.5 text-[9px] font-mono font-black text-emerald-300 shadow-md">
            Lv.{g.level}
          </span>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-fell text-lg font-bold text-white transition group-hover:text-emerald-300 sm:text-xl">
              {g.name}
            </h3>
            <span className="shrink-0 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono font-black tracking-widest text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.2)]">
              [{g.tag}]
            </span>
            {mine && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Your Guild
              </span>
            )}
          </div>

          {g.description ? (
            <p className="mt-1.5 line-clamp-2 break-words text-xs leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors font-sans">
              {g.description}
            </p>
          ) : (
            <p className="mt-1.5 text-xs italic text-slate-500">No motto written yet.</p>
          )}
        </div>
      </div>

      {/* Guild Stats & Status Badges */}
      <div className="relative mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
        <Chip icon={Users} tone={full ? "amber" : "slate"}>
          {g.memberCap !== null ? `${g.memberCount}/${g.memberCap} Members` : `${g.memberCount} Members`}
        </Chip>
        <Chip icon={Sparkles} tone="violet">{g.xp.toLocaleString()} XP</Chip>
        <Chip icon={Gem} tone="cyan">{g.shards.toLocaleString()} Shards</Chip>
        {g.isPublic ? (
          <Chip icon={Globe} tone="emerald">Open</Chip>
        ) : (
          <Chip icon={Lock} tone="amber">Invite Only</Chip>
        )}
        {g.minLevel > 1 && <Chip icon={Shield} tone="slate">Req. Lv {g.minLevel}+</Chip>}
      </div>
    </Link>
  );
}

export default function GuildsPage() {
  const { user } = useUser();

  const [rows, setRows] = useState<GuildRow[]>([]);
  const [meta, setMeta] = useState<GuildListMeta | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [myGuildId, setMyGuildId] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GuildSort>("level");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    setStatus("loading");

    fetchGuilds({ search, sort, page, perPage: GUILD_PER_PAGE, signal: ac.signal })
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setMeta(res.meta);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive || ac.signal.aborted) return;
        setStatus("error");
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [search, sort, page, reloadKey]);

  useEffect(() => {
    let alive = true;
    findMyGuild(user?.id).then((g) => {
      if (alive) setMyGuildId(g?.id || null);
    });
    return () => { alive = false; };
  }, [user?.id]);

  const perPage = meta?.perPage || GUILD_PER_PAGE;
  const total = meta?.total ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  const heading = search ? `Results for "${search}"` : HEADINGS[sort];

  const goToPage = (next: number) => {
    const clamped = Math.min(pageCount, Math.max(1, next));
    if (clamped === page) return;
    setPage(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applySearch = () => {
    setSearch(draft.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setDraft("");
    setSearch("");
    setPage(1);
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-x-hidden bg-[#070709] px-4 pb-36 pt-6 font-mono text-white">
        {/* Ambient Top Emerald Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[550px] bg-[radial-gradient(ellipse_60%_80%_at_50%_-20%,rgba(16,185,129,0.20),transparent_75%)]"
        />

        <div className="relative mx-auto max-w-5xl">
          {/* ── HERO BANNER ── */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-teal-900/30 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.25)]">
                  <Shield className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="font-fell text-4xl text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-emerald-300 sm:text-5xl font-black tracking-wide">
                    Guilds
                  </h1>
                </div>
              </div>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-400 font-sans">
                Team up with allies, pool your collective XP, and dominate the leaderboards together.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
              <Link
                href="/guilds/create"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/50 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-mono font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition hover:brightness-110"
              >
                <Sparkles className="h-4 w-4" /> Create Guild
              </Link>
              {myGuildId && (
                <Link
                  href={`/guild/${encodeURIComponent(myGuildId)}`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-300 hover:bg-white/10 transition"
                >
                  <span>My Guild</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* ── STAT STRIP ── */}
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatTile icon={Shield} label="Total Guilds" value={meta?.totalGuilds ?? rows.length} />
            <StatTile icon={LayoutGrid} label="On This Page" value={rows.length} />
            <StatTile icon={Users} label="Members Shown" value={meta?.membersShown ?? 0} />
            <StatTile icon={Trophy} label="Highest Level" value={meta?.highestLevel ?? 0} />
          </div>

          {/* ── SEARCH & FILTER CONTROLS ── */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-[#0d0d18]/80 p-3.5 sm:p-4 backdrop-blur-xl shadow-xl space-y-3">
            <form
              onSubmit={(e) => { e.preventDefault(); applySearch(); }}
              className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Search guilds by name or tag"
                  placeholder="Search by guild name or [TAG]…"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-9 text-xs sm:text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50"
                />
                {draft && (
                  <button
                    type="button"
                    onClick={() => { setDraft(""); setSearch(""); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as GuildSort); setPage(1); }}
                aria-label="Sort guilds"
                style={{ colorScheme: "dark" }}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 text-xs sm:text-sm font-mono text-white outline-none transition focus:border-emerald-400/50 sm:w-44"
              >
                {GUILD_SORTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <button
                type="submit"
                className="h-11 shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-6 text-xs font-mono font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/30 hover:text-white shadow-[0_0_15px_rgba(52,211,153,0.15)]"
              >
                Search
              </button>
            </form>

            {/* Quick Sort Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mr-1">
                Sort:
              </span>
              {GUILD_SORTS.map((o) => {
                const active = sort === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setSort(o.value as GuildSort); setPage(1); }}
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition ${
                      active
                        ? "border-emerald-400/60 bg-emerald-500/25 text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                        : "border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── THE GUILDS LIST ── */}
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="min-w-0 truncate font-fell text-2xl text-white font-bold">{heading}</h2>
            {status === "ready" && total > 0 && (
              <span className="text-[11px] font-mono font-bold text-slate-500">
                {total.toLocaleString()} guild{total === 1 ? "" : "s"} found
              </span>
            )}
          </div>

          {status === "loading" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-3xl border border-white/10 bg-[#0c0c16]"
                />
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#0c0c16] px-6 py-16 text-center shadow-xl">
              <Shield className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400 font-sans">Couldn&apos;t reach the guild registry.</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/[0.05] px-6 text-xs font-mono font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/[0.1]"
              >
                Try again
              </button>
            </div>
          )}

          {status === "ready" && rows.length === 0 && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#0c0c16] px-6 py-16 text-center shadow-xl">
              <Shield className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400 font-sans">
                {search ? "No guild matches that name or tag." : "No guilds yet — the first banner is unclaimed."}
              </p>
              {search ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/[0.05] px-6 text-xs font-mono font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/[0.1]"
                >
                  Clear search
                </button>
              ) : (
                <Link
                  href="/guilds/create"
                  className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-6 text-xs font-mono font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  <Sparkles className="h-4 w-4" /> Create the first guild
                </Link>
              )}
            </div>
          )}

          {status === "ready" && rows.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {rows.map((g) => (
                <GuildCard key={g.id} g={g} mine={g.id === myGuildId} />
              ))}
            </div>
          )}

          {/* ── PAGER ── */}
          {status === "ready" && total > perPage && (
            <div className="mt-10 flex items-center justify-center gap-2 font-mono">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-h-[40px] min-w-[7rem] rounded-xl border border-white/10 bg-[#0c0c16] px-4 py-2.5 text-center text-xs font-mono font-bold uppercase tracking-wider tabular-nums text-slate-300">
                Page {page} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pageCount}
                aria-label="Next page"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

