"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Shield, Users, Search, Gem, Trophy, Lock, Globe, Sparkles, Check,
  ChevronLeft, ChevronRight, LayoutGrid, TrendingUp,
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
 * local state, hands it to `GET /api/guilds`, and renders the answer. Nothing
 * here recomputes a level, a member cap or a page count from raw XP — those are
 * the server's numbers and drift is the only thing a second copy would add.
 *
 * The query is deliberately NOT mirrored into the URL. Reading it back would
 * mean `useSearchParams` at page level, and this codebase has a standing build
 * trap there: without a Suspense boundary the Next build fails, Vercel keeps
 * serving the last good deploy, and the page looks live while the new code
 * never shipped. A shareable /guilds?search= link is not worth that.
 */

type Status = "loading" | "ready" | "error";

const HEADINGS: Record<GuildSort, string> = {
  level: "Top Guilds by Level",
  members: "Biggest Guilds",
  xp: "Top Guilds by XP",
  new: "Newest Guilds",
};

function Chip({
  icon: Icon, children, tone = "slate",
}: {
  icon: typeof Users;
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber";
}) {
  const tones = {
    slate: "border-white/10 bg-white/[0.04] text-slate-400",
    emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  };
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function StatTile({
  icon: Icon, label, value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#0b0b11] p-3.5 sm:p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
        <span className="truncate text-[10px] font-black uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 truncate font-fell text-2xl tabular-nums text-white sm:text-3xl">
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
      className={`group relative block overflow-hidden rounded-3xl border p-4 transition sm:p-5 ${
        mine
          ? "border-emerald-400/40 bg-emerald-500/[0.06]"
          : "border-white/10 bg-[#0b0b11] hover:border-white/20"
      }`}
    >
      {g.banner && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24">
          <img src={g.banner} alt="" loading="lazy" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0b0b11]/70 to-[#0b0b11]" />
        </div>
      )}

      <div className="relative flex items-start gap-3 sm:gap-4">
        {g.avatar ? (
          <img
            src={g.avatar}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/15"
          />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-900/60 text-xl font-black text-emerald-200 ring-1 ring-white/10">
            {g.name?.[0]?.toUpperCase() || "?"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate font-fell text-lg text-white transition group-hover:text-emerald-200 sm:text-xl">
              {g.name}
            </h3>
            <span className="shrink-0 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black tracking-widest text-emerald-300">
              [{g.tag}]
            </span>
          </div>

          {mine && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
              <Check className="h-2.5 w-2.5" /> Your guild
            </span>
          )}

          {g.description ? (
            <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-500">
              {g.description}
            </p>
          ) : (
            <p className="mt-1 text-xs italic text-slate-600">No words over the door yet.</p>
          )}
        </div>
      </div>

      <div className="relative mt-3.5 flex flex-wrap items-center gap-1.5">
        <Chip icon={TrendingUp} tone="emerald">Lv {g.level}</Chip>
        <Chip icon={Users} tone={full ? "amber" : "slate"}>
          {g.memberCap !== null ? `${g.memberCount}/${g.memberCap}` : `${g.memberCount}`}
        </Chip>
        <Chip icon={Sparkles}>{g.xp.toLocaleString()} XP</Chip>
        <Chip icon={Gem}>{g.shards.toLocaleString()} Shards</Chip>
        {g.isPublic ? (
          <Chip icon={Globe}>Open</Chip>
        ) : (
          <Chip icon={Lock} tone="amber">Invite only</Chip>
        )}
        {g.minLevel > 1 && <Chip icon={Shield}>Lv {g.minLevel}+</Chip>}
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

  // `draft` is what is typed; `search` is what has been applied. Typing alone
  // must not refetch — the Search button (or Enter) commits it.
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GuildSort>("level");
  const [page, setPage] = useState(1);
  // Bumped by "Try again". Setting `page` to the value it already holds would
  // not re-run the fetch — React bails out on an identical state write.
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
        // An abort is this effect being superseded, not a failure to report.
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
      <div className="relative min-h-screen overflow-x-hidden bg-[#070709] px-4 pb-32 pt-14 font-mono text-white">
        {/* the Lunar top glow — emerald here, the guilds' own colour */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(16,185,129,0.16),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-5xl">
          {/* ── HERO ── */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
                  <Shield className="h-5 w-5 text-emerald-300" />
                </span>
                <h1 className="font-fell text-4xl text-white sm:text-5xl">Guilds</h1>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Team up, pool your XP, and climb together.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href="/guilds/create"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25"
              >
                <Sparkles className="h-3.5 w-3.5" /> Create Guild
              </Link>
              {myGuildId && (
                <Link
                  href={`/guild/${encodeURIComponent(myGuildId)}`}
                  className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:text-emerald-200 sm:text-right"
                >
                  Open your guild
                </Link>
              )}
            </div>
          </div>

          {/* ── STAT STRIP ── */}
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <StatTile icon={Shield} label="Total Guilds" value={meta?.totalGuilds ?? 0} />
            <StatTile icon={LayoutGrid} label="On This Page" value={rows.length} />
            <StatTile icon={Users} label="Members Shown" value={meta?.membersShown ?? 0} />
            <StatTile icon={Trophy} label="Highest Level" value={meta?.highestLevel ?? 0} />
          </div>

          {/* ── SEARCH ── */}
          <form
            onSubmit={(e) => { e.preventDefault(); applySearch(); }}
            className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Search guilds by name or tag"
                placeholder="Search by name or tag"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/40"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as GuildSort); setPage(1); }}
              aria-label="Sort guilds"
              style={{ colorScheme: "dark" }}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition focus:border-emerald-400/40 sm:w-40"
            >
              {GUILD_SORTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              type="submit"
              className="h-12 shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-6 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25"
            >
              Search
            </button>
          </form>

          {/* ── THE GUILDS ── */}
          <div className="mt-9 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="min-w-0 truncate font-fell text-2xl text-white">{heading}</h2>
            {status === "ready" && total > 0 && (
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                {total.toLocaleString()} found
              </span>
            )}
          </div>

          {status === "loading" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-3xl border border-white/10 bg-[#0b0b11]"
                />
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400">Couldn&apos;t reach the guild registry.</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]"
              >
                Try again
              </button>
            </div>
          )}

          {status === "ready" && rows.length === 0 && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400">
                {search ? "No guild matches that name or tag." : "No guilds yet — the first banner is unclaimed."}
              </p>
              {search ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]"
                >
                  Clear search
                </button>
              ) : (
                <Link
                  href="/guilds/create"
                  className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Create the first guild
                </Link>
              )}
            </div>
          )}

          {status === "ready" && rows.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rows.map((g) => (
                <GuildCard key={g.id} g={g} mine={g.id === myGuildId} />
              ))}
            </div>
          )}

          {/* ── PAGER ── */}
          {status === "ready" && total > perPage && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-h-[44px] min-w-[7rem] rounded-xl border border-white/10 bg-[#0b0b11] px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.16em] tabular-nums text-slate-400">
                Page {page} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pageCount}
                aria-label="Next page"
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
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
