"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy, Crown, Medal, Swords, Layers, Gem, Zap, Flame, Shield, Users, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { displayShards, isAdmin, isLeadDev } from "@/lib/admin";
import PageTransition from "@/components/layout/PageTransition";
import { calculateLevel, MAX_LEVEL } from "@/lib/levels";
import { fetchGuilds, type GuildRow } from "@/lib/guild";
import { SegBar, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";
import VideoTitle from "@/components/ui/VideoTitle";
import GuildTag from "@/components/guild/GuildTag";
// Board avatars are 32-40px; serve them at that scale instead of the original
// upload (animated uploads pass through untouched — see cloudinary.ts).
import { cloudinaryFit } from "@/lib/cloudinary";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE LADDER — one board, five lenses.
 *
 * There were three separate ideas of "best" scattered around the site: level
 * from watching, Elo from duelling, and collection depth. Splitting them across
 * three screens made none of them feel like THE leaderboard. This fetches all
 * of it once and re-sorts client-side, so switching lens is instant and nobody
 * has to guess which board counts.
 *
 * The fifth lens ranks GUILDS rather than people. It follows the same rule —
 * fetched once, re-sorted in the browser — but from its own request, fired
 * beside the ladder's rather than after it: a slow or dead guild registry must
 * never hold up the four player boards, so its failure state is simply an empty
 * guild lens while everything else works.
 */

type Row = {
  userId: string; username: string; avatar: string | null; cardTitle: string | null;
  /** Persistent account role — how staff are told apart from players. */
  role?: string | null;
  xp: number; shards: number; cards: number;
  rating: number | null; wins: number; losses: number; streak: number;
};

type Lens = "level" | "duels" | "cards" | "shards" | "guilds";

const LENSES: { key: Lens; label: string; Icon: any; blurb: string }[] = [
  { key: "level", label: "Level", Icon: Zap, blurb: "Ranked by experience earned" },
  { key: "duels", label: "Duels", Icon: Swords, blurb: "Ranked by duel rating" },
  { key: "cards", label: "Collection", Icon: Layers, blurb: "Ranked by distinct cards owned" },
  { key: "shards", label: "Shards", Icon: Gem, blurb: "Ranked by shards held" },
  { key: "guilds", label: "Guilds", Icon: Shield, blurb: "Halls ranked by guild level" },
];

/**
 * The guild lens's own sorts.
 *
 * The player lenses ARE sorts — one tab per way of being good. Guilds only have
 * one board, so its ways of being good live one step in, as a second, quieter
 * strip. Level leads (XP breaks the tie, so two Lv 9 halls are separated by the
 * one that actually earned more), and the other two are the same affordances a
 * player gets: raw XP, and how many people you brought with you.
 */
type GuildLensSort = "level" | "xp" | "members";

const GUILD_LENS_SORTS: { key: GuildLensSort; label: string; blurb: string }[] = [
  { key: "level", label: "Level", blurb: "Halls ranked by guild level" },
  { key: "xp", label: "Total XP", blurb: "Halls ranked by total guild XP" },
  { key: "members", label: "Members", blurb: "Halls ranked by members mustered" },
];

/** How many halls the board reads in one go. */
const GUILD_PAGE = 50;

/**
 * One figure on the podium — the shape BOTH boards stand on.
 *
 * Players and guilds take the same steps: the winner raised and crowned, silver
 * to its left, bronze to its right, a tinted place chip, then name, metric,
 * label. Extracted rather than copied so the guild lens cannot drift into
 * looking like a table bolted onto a podium page; the only things it varies are
 * the crest's shape (a guild wears a squared crest, as everywhere else on the
 * site) and the fallback tile's colour.
 */
function PodiumFigure({
  slot, href, image, letter, name, chip, big, small,
  round = true,
  fallbackClass = "bg-violet-700",
}: {
  /** 0 = left (2nd), 1 = centre (1st), 2 = right (3rd) — the render order. */
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
  const tint = place === 1 ? ACCENT_LIT : place === 2 ? "#cbd5e1" : "#e0a56a";
  const PIcon = place === 1 ? Crown : place === 2 ? Trophy : Medal;
  const size = place === 1 ? 108 : 84;
  const shape = round ? "rounded-full" : "rounded-2xl";

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: slot * 0.08 }}
      className={`flex w-[30%] flex-col items-center ${place === 1 ? "-translate-y-5" : ""}`}>
      <Link href={href} className="group relative">
        <span aria-hidden className="absolute -inset-3 -z-10 rounded-full blur-xl"
          style={{ background: `${tint}40` }} />
        {image ? (
          <img src={image} alt="" className={`${shape} object-cover ring-2 transition group-hover:brightness-110`}
            style={{ width: size, height: size, boxShadow: `0 0 0 2px ${tint}` }} />
        ) : (
          <span className={`grid place-items-center ${shape} ${fallbackClass} text-2xl font-black`}
            style={{ width: size, height: size, boxShadow: `0 0 0 2px ${tint}` }}>
            {letter}
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
        <Link href={href} className="min-w-0 truncate text-sm font-black hover:underline" style={{ color: tint }}>
          {name}
        </Link>
        {chip}
      </span>
      <span className="text-lg font-black tabular-nums text-white">{big}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{small}</span>
    </motion.div>
  );
}

/**
 * The `[TAG]` chip, as a plain span.
 *
 * components/guild/GuildTag renders the same chip as a LINK, which cannot be
 * used here: a guild row is itself one big anchor to the hall, and an anchor
 * inside an anchor is re-parented by the HTML parser — the same hydration break
 * the keepers strip is written around. Same classes, no link.
 */
function GuildTagChip({ tag, size = "xs" }: { tag: string; size?: "xs" | "sm" }) {
  if (!tag) return null;
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 align-middle font-black leading-none tracking-wider text-emerald-300 ${
      size === "sm" ? "py-[3px] text-[10px]" : "py-[2px] text-[9px]"
    }`}>
      [{tag}]
    </span>
  );
}

/**
 * One numeric fact about a hall.
 *
 * `shrink-0` + `whitespace-nowrap` on every chip and `flex-wrap` on their row:
 * at 360px the four of them cannot fit on one line, and the row must grow DOWN
 * rather than push the card past the viewport.
 */
function GuildStat({ icon: Icon, tone = "text-slate-500", children }: { icon: any; tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.12em] ${tone}`}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {children}
    </span>
  );
}

/**
 * THE GUILD LENS — the same podium and the same rows, ranking halls.
 *
 * Every number shown here is the SERVER'S: level, seats and treasury are all
 * computed backend-side (see lib/guild.ts), so this file re-sorts them and
 * never recomputes them.
 */
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
    return <p className="py-24 text-center text-sm text-slate-500">Reading the halls…</p>;
  }

  // A registry that failed to answer and a site with no guilds land here alike —
  // the lens is empty, the rest of the board is untouched.
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0b0b11] py-20">
        <p className="text-center text-sm text-slate-500">No hall has raised a banner yet.</p>
      </div>
    );
  }

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const best = Math.max(1, ...rows.map(barOf));

  return (
    <>
      <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
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
            <div key={i} className="w-[28%]" />
          )
        )}
      </div>

      <div className="space-y-2">
        {rest.map((g, i) => {
          const m = metric(g);
          return (
            <motion.div key={g.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.015, 0.3) }}
              className="rounded-2xl border border-white/10 bg-[#0b0b11] transition hover:border-emerald-400/30">
              {/* The WHOLE row is the link to the hall — nothing inside it is
                  separately clickable, which is why the tag is a plain chip. */}
              <Link href={`/guild/${encodeURIComponent(g.id)}`} className="group flex items-center gap-3 px-3 py-2.5">
                <span className="w-9 shrink-0 text-center text-sm font-black tabular-nums text-slate-600">
                  #{i + 4}
                </span>
                {g.avatar ? (
                  <img src={cloudinaryFit(g.avatar, 80)} alt="" loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/15" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-900/70 text-xs font-black text-emerald-200 ring-1 ring-white/10">
                    {g.name?.[0]?.toUpperCase() || "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-black text-white group-hover:underline">
                      {g.name}
                    </span>
                    <GuildTagChip tag={g.tag} size="sm" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <GuildStat icon={Shield} tone="text-emerald-300/90">Lv {g.level}</GuildStat>
                    <GuildStat icon={Users}>
                      {g.memberCap !== null ? `${g.memberCount}/${g.memberCap}` : `${g.memberCount}`}
                    </GuildStat>
                    <GuildStat icon={Sparkles}>{g.xp.toLocaleString()} XP</GuildStat>
                    <GuildStat icon={Gem}>{g.shards.toLocaleString()} Shards</GuildStat>
                  </div>
                  <div className="mt-1"><SegBar value={barOf(g)} max={best} height={4} /></div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black tabular-nums" style={{ color: ACCENT_LIT }}>{m.big}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{m.small}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </>
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
      .then((d) => { if (d?.success && Array.isArray(d.data)) setRows(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));

  }, []);

  /**
   * The guild board REFETCHES per sort instead of re-sorting one page.
   *
   * Fired BESIDE the ladder, never chained to it: the player lenses are ready
   * when their own fetch lands, whatever the guild registry is doing. A throw
   * here leaves `guilds` empty, which the guild lens renders as its empty
   * state — no error banner over four boards that are perfectly fine.
   *
   * Why per sort: the server caps a page at 50 and orders it by the sort we
   * ask for. Sorting 50 XP-ranked rows by member count client-side would rank
   * only the guilds that were already rich in XP — a truncated board presented
   * as a complete one. Asking the server for `sort=members` ranks the whole
   * registry and hands back the real top 50.
   */
  useEffect(() => {
    let alive = true;
    setGuildsLoading(true);
    fetchGuilds({ sort: guildSort, perPage: GUILD_PAGE })
      .then(({ rows: g }) => { if (alive) setGuilds(g); })
      .catch(() => {})
      .finally(() => { if (alive) setGuildsLoading(false); });
    return () => { alive = false; };
  }, [guildSort]);

  /**
   * STAFF SIT OUTSIDE THE LEVEL LADDER.
   *
   * Everywhere else on the site, admins and the lead dev display max level —
   * the popout, the profile hero, the level badge all say the cap. This board
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

  // Same trick as the player lenses: one fetch, re-sorted in place. Level is the
  // headline and XP is the tiebreak, so halls level-locked together are still
  // ordered by the work behind the level.
  const rankedGuilds = useMemo(() => {
    const v = (g: GuildRow) => (guildSort === "members" ? g.memberCount : guildSort === "xp" ? g.xp : g.level);
    return [...guilds].sort((a, b) => v(b) - v(a) || b.xp - a.xp || b.memberCount - a.memberCount);
  }, [guilds, guildSort]);

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
  const activeGuildSort = GUILD_LENS_SORTS.find((s) => s.key === guildSort)!;
  const blurb = lens === "guilds" ? activeGuildSort.blurb : active.blurb;

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
            <p className="mt-3 text-sm text-slate-400">{blurb}</p>
          </div>

          {/* ── LENS TABS ── same data, five ways of being good at this place.
              Wrapping was fine at four tabs; a fifth pushes past 360px, so on a
              phone the strip becomes one swipeable line that bleeds to the
              screen edges (-mx-4 / px-4) instead of stacking into three rows
              that shove the podium below the fold. It wraps and centres again
              from sm up, where everything fits. */}
          <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-x-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {LENSES.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setLens(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  lens === key
                    ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                    : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
                }`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* ── GUILD SORTS ── the lens's own affordances, one step quieter than
              the lens tabs so the two strips can't be mistaken for one row. */}
          {lens === "guilds" && (
            <div className="-mx-4 -mt-5 mb-8 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-x-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">Sort</span>
              {GUILD_LENS_SORTS.map(({ key, label }) => (
                <button key={key} onClick={() => setGuildSort(key)}
                  className={`inline-flex shrink-0 items-center rounded-lg border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                    guildSort === key
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── THE KEEPERS ── shown at the max level they wear everywhere
              else, above the ladder rather than inside it. The cap comes from
              lib/levels (MAX_LEVEL), never a literal: when the curve was
              re-cut this strip would otherwise have gone on claiming Lv 10
              while every other surface said something else. */}
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
                      <img src={cloudinaryFit(k.avatar, 80)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-amber-400/50" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-[10px] font-black">
                        {k.username?.[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 truncate text-sm font-black text-white group-hover:underline">{k.username}</span>
                  </Link>
                  <GuildTag userId={k.userId} size="sm" />
                  {/* Staff read as maxed exactly like the hub and the profile
                      hero do (staff ? MAX_LEVEL : calculateLevel), and only the
                      lead dev's XP is the ∞ the server actually treats it as. */}
                  <span className="shrink-0 text-xs font-black tabular-nums text-amber-300">
                    Lv {isAdmin(k) ? MAX_LEVEL : calculateLevel(k.xp)} · {isLeadDev(k) ? "∞" : k.xp.toLocaleString()} XP
                  </span>
                </span>
              ))}
            </div>
          )}

          {lens === "guilds" ? (
            <GuildBoard rows={rankedGuilds} loading={guildsLoading} sort={guildSort} />
          ) : loading ? (
            <p className="py-24 text-center text-sm text-slate-500">Reading the ladder…</p>
          ) : ranked.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0b0b11] py-20"><p className="text-center text-sm text-slate-500">Nobody has ranked here yet.</p></div>
          ) : (
            <>
              {/* ── PODIUM ── 2nd, 1st, 3rd, with the winner raised */}
              <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
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
                    <div key={i} className="w-[28%]" />
                  )
                )}
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
                          <img src={cloudinaryFit(r.avatar, 80)} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/15" />
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
