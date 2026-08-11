"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy, Crown, Medal, Swords, Layers, Gem, Zap, Flame } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { displayShards, isAdmin, isLeadDev } from "@/lib/admin";
import PageTransition from "@/components/layout/PageTransition";
import { calculateLevel } from "@/lib/levels";
import { SegBar, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";
import VideoTitle from "@/components/ui/VideoTitle";
import GuildTag from "@/components/guild/GuildTag";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE LADDER — one board, four lenses.
 *
 * There were three separate ideas of "best" scattered around the site: level
 * from watching, Elo from duelling, and collection depth. Splitting them across
 * three screens made none of them feel like THE leaderboard. This fetches all
 * of it once and re-sorts client-side, so switching lens is instant and nobody
 * has to guess which board counts.
 */

type Row = {
  userId: string; username: string; avatar: string | null; cardTitle: string | null;
  /** Persistent account role — how staff are told apart from players. */
  role?: string | null;
  xp: number; shards: number; cards: number;
  rating: number | null; wins: number; losses: number; streak: number;
};

type Lens = "level" | "duels" | "cards" | "shards";

const LENSES: { key: Lens; label: string; Icon: any; blurb: string }[] = [
  { key: "level", label: "Level", Icon: Zap, blurb: "Ranked by experience earned" },
  { key: "duels", label: "Duels", Icon: Swords, blurb: "Ranked by duel rating" },
  { key: "cards", label: "Collection", Icon: Layers, blurb: "Ranked by distinct cards owned" },
  { key: "shards", label: "Shards", Icon: Gem, blurb: "Ranked by shards held" },
];

export default function LeaderboardPage() {
  const { user } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [lens, setLens] = useState<Lens>("level");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/cards/ladder`)
      .then((r) => r.json())
      .then((d) => { if (d?.success && Array.isArray(d.data)) setRows(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /**
   * STAFF SIT OUTSIDE THE LEVEL LADDER.
   *
   * Everywhere else on the site, admins and the lead dev display max level —
   * the popout, the profile hero, the level badge all say Lv 10. This board
   * ranked their RAW xp, so the owner appeared at #5, Lv 4, 12,383 XP, flatly
   * contradicting every other surface. Ranking them by a number the site
   * treats as ∞ is meaningless in both directions: mid-ladder looks broken,
   * and pinning them to #1 would eat the podium the actual players compete
   * for. So the level lens hoists them into their own strip and the numbered
   * ranks belong to players. Duels, collection and shards stay open to
   * everyone — those numbers are really earned.
   */
  const keepers = useMemo(
    () =>
      rows
        .filter((r) => isAdmin(r))
        .sort((a, b) => (isLeadDev(b) ? 1 : 0) - (isLeadDev(a) ? 1 : 0) || b.xp - a.xp),
    [rows]
  );

  // Each lens sorts the SAME fetched rows — no refetch, no flicker.
  const ranked = useMemo(() => {
    const v = (r: Row) =>
      lens === "level" ? r.xp
      : lens === "duels" ? (r.rating ?? -1)
      : lens === "cards" ? r.cards
      : r.shards;
    const base = lens === "level" ? rows.filter((r) => !isAdmin(r)) : rows;
    // Players with no duels at all are hidden from the duel lens rather than
    // padded to the bottom — an unranked player isn't "last", they haven't
    // played.
    const pool = lens === "duels" ? base.filter((r) => r.rating !== null) : base;
    return [...pool].sort((a, b) => v(b) - v(a));
  }, [rows, lens]);

  const metric = (r: Row) => {
    if (lens === "level") return { big: `Lv ${calculateLevel(r.xp)}`, small: `${r.xp.toLocaleString()} XP` };
    if (lens === "duels") return { big: `${r.rating}`, small: `${r.wins}W ${r.losses}L` };
    if (lens === "cards") return { big: `${r.cards}`, small: "cards" };
    // The lead dev's shards are server-side unlimited, so their row says so
    // instead of showing a stale finite number.
    return { big: displayShards(r, r.shards), small: "shards" };
  };

  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const best = ranked.length ? Math.max(1, (lens === "level" ? ranked[0].xp : lens === "duels" ? (ranked[0].rating ?? 1) : lens === "cards" ? ranked[0].cards : ranked[0].shards)) : 1;
  const barOf = (r: Row) => lens === "level" ? r.xp : lens === "duels" ? (r.rating ?? 0) : lens === "cards" ? r.cards : r.shards;
  const active = LENSES.find((l) => l.key === lens)!;

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-24 pt-14 font-mono text-white">
        {/* The Lunar top glow — same radial as the hub and updates pages. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-7 text-center">
            {/* The block-face title, with the site's clip playing inside the
                letters — the same treatment as the landing wordmark. */}
            <VideoTitle text="Leaderboard" className="mx-auto w-full max-w-3xl" />
            <p className="mt-3 text-sm text-slate-400">{active.blurb}</p>
          </div>

          {/* ── LENS TABS ── same data, four ways of being good at this place */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {LENSES.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setLens(key)}
                className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  lens === key
                    ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                    : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
                }`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* ── THE KEEPERS ── shown at the max level they wear everywhere
              else, above the ladder rather than inside it. */}
          {!loading && lens === "level" && keepers.length > 0 && (
            <div className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3">
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                <Crown className="h-3.5 w-3.5" /> Keepers · beyond the ladder
              </span>
              {/* The guild chip is its own link, so it sits BESIDE the profile
                  link rather than inside it — an anchor nested in an anchor is
                  re-parented by the HTML parser and breaks hydration. */}
              {keepers.map((k) => (
                <span key={k.userId} className="inline-flex min-w-0 items-center gap-1.5">
                  <Link href={`/user/${k.username}`} className="group inline-flex min-w-0 items-center gap-2">
                    {k.avatar ? (
                      <img src={k.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-amber-400/50" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-[10px] font-black">
                        {k.username?.[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 truncate text-sm font-black text-white group-hover:underline">{k.username}</span>
                  </Link>
                  <GuildTag userId={k.userId} size="sm" />
                  <span className="shrink-0 text-xs font-black tabular-nums text-amber-300">Lv 10 · ∞ XP</span>
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <p className="py-24 text-center text-sm text-slate-500">Reading the ladder…</p>
          ) : ranked.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0b0b11] py-20"><p className="text-center text-sm text-slate-500">Nobody has ranked here yet.</p></div>
          ) : (
            <>
              {/* ── PODIUM ── 2nd, 1st, 3rd, with the winner raised */}
              <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
                {[top[1], top[0], top[2]].map((r, i) => {
                  if (!r) return <div key={i} className="w-[28%]" />;
                  const place = i === 1 ? 1 : i === 0 ? 2 : 3;
                  const m = metric(r);
                  const tint = place === 1 ? ACCENT_LIT : place === 2 ? "#cbd5e1" : "#e0a56a";
                  const PIcon = place === 1 ? Crown : place === 2 ? Trophy : Medal;
                  const size = place === 1 ? 108 : 84;
                  return (
                    <motion.div key={r.userId} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`flex w-[30%] flex-col items-center ${place === 1 ? "-translate-y-5" : ""}`}>
                      <Link href={`/user/${r.username}`} className="group relative">
                        <span aria-hidden className="absolute -inset-3 -z-10 rounded-full blur-xl"
                          style={{ background: `${tint}40` }} />
                        {r.avatar ? (
                          <img src={r.avatar} alt="" className="rounded-full object-cover ring-2 transition group-hover:brightness-110"
                            style={{ width: size, height: size, boxShadow: `0 0 0 2px ${tint}` }} />
                        ) : (
                          <span className="grid place-items-center rounded-full bg-violet-700 text-2xl font-black"
                            style={{ width: size, height: size, boxShadow: `0 0 0 2px ${tint}` }}>
                            {r.username?.[0]?.toUpperCase()}
                          </span>
                        )}
                        <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full border-2 border-[#070709]"
                          style={{ background: tint }}>
                          <PIcon className="h-4 w-4 text-[#160b2b]" />
                        </span>
                      </Link>
                      <span className="mt-3 rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em]"
                        style={{ background: `${tint}22`, borderColor: `${tint}66`, color: tint }}>
                        {place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}
                      </span>
                      <span className="mt-2 flex max-w-full items-center justify-center gap-1.5">
                        <Link href={`/user/${r.username}`}
                          className="min-w-0 truncate text-sm font-black hover:underline" style={{ color: tint }}>
                          {r.username}
                        </Link>
                        <GuildTag userId={r.userId} />
                      </span>
                      <span className="text-lg font-black tabular-nums text-white">{m.big}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{m.small}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── THE REST ── */}
              <div className="space-y-2">
                {rest.map((r, i) => {
                  const m = metric(r);
                  const me = r.userId === user?.id;
                  return (
                    <motion.div key={r.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                        me ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-[#0b0b11]"
                      }`}>
                      <span className="w-9 shrink-0 text-center text-sm font-black tabular-nums text-slate-600">
                        #{i + 4}
                      </span>
                      <Link href={`/user/${r.username}`} className="shrink-0">
                        {r.avatar ? (
                          <img src={r.avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/15" />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-700 text-xs font-black">
                            {r.username?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link href={`/user/${r.username}`} className="min-w-0 truncate text-sm font-black text-white hover:underline">
                            {r.username}
                          </Link>
                          <GuildTag userId={r.userId} size="sm" />
                          {me && <span className="shrink-0 text-[9px] font-black uppercase tracking-widest" style={{ color: ACCENT }}>You</span>}
                          {lens === "duels" && r.streak >= 3 && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 text-[9px] font-black text-orange-300">
                              <Flame className="h-2.5 w-2.5" />{r.streak}
                            </span>
                          )}
                        </div>
                        {r.cardTitle && (
                          <p className="truncate text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
                            {r.cardTitle}
                          </p>
                        )}
                        <div className="mt-1"><SegBar value={barOf(r)} max={best} height={4} /></div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black tabular-nums" style={{ color: ACCENT_LIT }}>{m.big}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{m.small}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
