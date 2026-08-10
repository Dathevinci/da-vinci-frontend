"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import { loadCatalog } from "@/lib/catalogCache";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META, CardRarity } from "@/components/cards/CardFace";
import {
  Swords, Skull, X, CalendarDays, Trophy, Flame, ShieldAlert, History, Sparkles,
  ChevronDown, ChevronUp, Users,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * GUILD RAID BOSS — /raid, phases 2–3 of the raid spec.
 *
 * One boss per ISO week, everyone's damage counts. This page is a WINDOW onto
 * the server: every multiplier, the variance roll, injuries and the kill claim
 * are computed in raid.controller.ts — the client sends 3 catalog card ids and
 * a nonce, nothing else. That's why the squad picker's projected damage is a
 * literal "?": recomputing the formula here would just be a second copy that
 * could lie.
 */

type RaidLine = {
  cardId: string; name: string; set: string; rarity: string;
  base: number; rarityMult: number;
  condition: string | null; condMult: number;
  affinity: boolean; affMult: number;
  gimMult: number; varietyMult: number;
  line: number; injured: boolean;
};

/** Last week's settled (or settling) outcome — every number here is the server's. */
type LastWeek = {
  week: string; name: string; slug: string;
  killed: boolean; dealtRatio: number; settled: boolean;
  mine: { attacks: number; damage: number; rank: number | null; eligible: boolean; ap: number; shards: number } | null;
};

type RaidData = {
  week: string;
  boss: { slug: string; name: string; series: string; art: string; flavor: string; gimmickText: string };
  // The caller's own guild encounter when set; null = the realm-wide fight.
  // hp/standings/mine/lastWeek are already scoped to it by the server.
  guild: { id: string; name: string; tag: string } | null;
  hpMax: number; hpLeft: number; killedAt: string | null;
  freeAttacksPerDay: number; maxAttacksPerDay: number; rallyCost: number; squadSize: number;
  mine: { attacksToday: number; usedCardIds: string[]; myDamage: number; myAttacks: number };
  standings: { username: string; avatar: string | null; damage: number }[];
  lastWeek?: LastWeek | null;
};

type HistoryRow = { week: string; name: string; series: string; art: string; killed: boolean; dealtRatio: number };

type LadderRow = { username: string; avatar: string | null; damage: number; attacks: number };

type Report = {
  damage: number; isRally: boolean; variance?: number;
  lines: RaidLine[]; injuredCount: number; restUntil: string | null;
  hpBefore: number; hpLeft: number; hpMax: number;
  killed: boolean; killingBlow: boolean; replay: boolean;
};

type Catalog = {
  cards: CardDef[];
  cardStats?: Record<string, { hp: number; atk: number }>;
  cardStatsById?: Record<string, { hp: number; atk: number }>;
};

/** Whole days until the next ISO Monday — the gems countdown, same math. */
function daysUntilMonday(d: Date = new Date()): number {
  const dayNum = d.getUTCDay() || 7;
  return 8 - dayNum;
}

/** Whole hours until an ISO timestamp, floored at 1 — "resting · 14h". */
function hoursLeft(iso: string): number {
  return Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 3600000));
}

const fmtMult = (m: number) => `×${Number(m.toFixed(2))}`;

/**
 * A number that counts up from zero after a delay — the battle report's drama.
 * CountUp (the shared one) deliberately never animates its first paint, and
 * every number in the report IS a first paint, so this tiny rAF roll exists.
 * Honors reduced motion by landing on the number instantly.
 */
function Roll({ to, delay = 0, className }: { to: number; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) { setShown(to); return; }
    let start: number | null = null;
    const dur = 700;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(to * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    const t = setTimeout(() => { raf.current = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(t); if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [to, delay, reduce]);
  return <span className={className}>{Math.round(shown).toLocaleString()}</span>;
}

/** One small multiplier chip in a battle-report line. */
function MultChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full border px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wider"
      style={{ borderColor: `${color}55`, background: `${color}14`, color }}
    >
      {label}
    </span>
  );
}

export default function RaidPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const reduce = useReducedMotion();

  const [raid, setRaid] = useState<RaidData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  // The picker's slice of the collection: counts, cosmetics, and raid rest.
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [rests, setRests] = useState<Record<string, string>>({});

  // GUILD: cards guildmates lent you. The collection fetch can't know about
  // loans (they're the OWNER's rows), so active borrowed entries merge into
  // the picker as usable cards — the server fields them at the owner's stats
  // and injures the owner's copy. (Which guild YOU are in now arrives on the
  // raid payload itself — data.guild — so no findMyGuild lookup here.)
  const [borrowedFrom, setBorrowedFrom] = useState<Record<string, string>>({});

  // Boss art is owner-supplied and 404s until phase 4 — the gradient
  // underneath is the real background, the img is a bonus when it exists.
  const [artOk, setArtOk] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [squad, setSquad] = useState<string[]>([]);
  const [attacking, setAttacking] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  // The full ladder: fetched once on first expand, cached after (null = never
  // fetched, so a failed attempt simply retries on the next expand).
  const [ladderOpen, setLadderOpen] = useState(false);
  const [ladder, setLadder] = useState<LadderRow[] | null>(null);
  const [ladderLoading, setLadderLoading] = useState(false);

  const loadRaid = useCallback(async () => {
    try {
      // authHeaders so `mine` fills in for the signed-in viewer.
      const r = await fetch(`${API_URL}/api/raid`, { headers: authHeaders() });
      const d = await r.json();
      if (d?.success && d.data) setRaid(d.data);
    } catch {
      /* offline — the empty state carries the page */
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      // authHeaders: history is caller-scoped now — without the token a
      // guild member gets the REALM record, the wrong win/loss story.
      const r = await fetch(`${API_URL}/api/raid/history`, { headers: authHeaders() });
      const d = await r.json();
      if (d?.success && Array.isArray(d.data)) setHistory(d.data);
    } catch {
      /* the strip simply doesn't render */
    }
  }, []);

  const loadCollection = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await fetch(`${API_URL}/api/cards/collection/${user.id}`);
      const d = await r.json();
      if (!d?.success) return;
      const map: Record<string, number> = {};
      const fo: Record<string, boolean> = {};
      const lv: Record<string, number> = {};
      const rest: Record<string, string> = {};
      for (const c of d.data?.cards || []) {
        map[c.cardId] = c.count;
        if (c.foil) fo[c.cardId] = true;
        lv[c.cardId] = c.level || 1;
        if (c.raidRestUntil) rest[c.cardId] = c.raidRestUntil;
      }
      setOwned(map); setFoils(fo); setLevels(lv); setRests(rest);
    } catch {
      /* picker shows its own empty state */
    }
  }, [user?.id]);

  const loadLoans = useCallback(async () => {
    if (!user?.id) { setBorrowedFrom({}); return; }
    try {
      const r = await fetch(`${API_URL}/api/guilds/mine/loans`, { headers: authHeaders() });
      const d = await r.json();
      if (!d?.success) return;
      const map: Record<string, string> = {};
      for (const l of d.data?.borrowed || []) {
        if (l?.active && l.cardId) map[l.cardId] = l.counterpartyName || "a guildmate";
      }
      setBorrowedFrom(map);
    } catch {
      /* no loans shown — owned cards still fight */
    }
  }, [user?.id]);

  useEffect(() => { loadRaid(); }, [loadRaid, user?.id]);
  // Re-run on sign-in/out: the token rescopes the record to the caller's guild.
  useEffect(() => { loadHistory(); }, [loadHistory, user?.id]);
  useEffect(() => { loadCollection(); }, [loadCollection]);
  useEffect(() => { loadLoans(); }, [loadLoans]);
  useEffect(() => { loadCatalog(API_URL, (data: Catalog) => setCatalog(data)); }, []);

  // The sheet/modal scrolls; the page behind it must not (cards-page rule).
  useEffect(() => {
    if (!pickerOpen && !report) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [pickerOpen, report]);

  const fallen = !!raid?.killedAt;
  const attacksToday = raid?.mine.attacksToday ?? 0;
  const maxAttacks = raid?.maxAttacksPerDay ?? 3;
  const freeAttacks = raid?.freeAttacksPerDay ?? 2;
  const attacksLeft = Math.max(0, maxAttacks - attacksToday);
  const nextIsRally = attacksToday >= freeAttacks;
  const usedToday = useMemo(() => new Set(raid?.mine.usedCardIds || []), [raid?.mine.usedCardIds]);
  const hpPct = raid && raid.hpMax > 0 ? (raid.hpLeft / raid.hpMax) * 100 : 0;
  const daysLeft = daysUntilMonday();
  // Absent on the very first week ever — the card simply doesn't render.
  const lastWeek = raid?.lastWeek ?? null;

  /** Why a card can't fight right now — or null if it can. */
  const disabledReason = useCallback(
    (cardId: string): string | null => {
      if (usedToday.has(cardId)) return "fought today";
      const until = rests[cardId];
      if (until && Date.parse(until) > Date.now()) return `resting · ${hoursLeft(until)}h`;
      return null;
    },
    [usedToday, rests]
  );

  // Owned OR borrowed cards for the picker — healthy first, then rarity,
  // then name. A borrowed card is usable exactly like an owned one; the
  // server resolves it to the owner's copy when the squad lands.
  const roster = useMemo(() => {
    if (!catalog) return [];
    return catalog.cards
      .filter((c) => (owned[c.id] || 0) > 0 || !!borrowedFrom[c.id])
      .sort((a, b) => {
        const da = disabledReason(a.id) ? 1 : 0;
        const db = disabledReason(b.id) ? 1 : 0;
        if (da !== db) return da - db;
        const ra = RARITY_META[a.rarity as CardRarity]?.order ?? 0;
        const rb = RARITY_META[b.rarity as CardRarity]?.order ?? 0;
        return rb - ra || a.name.localeCompare(b.name);
      });
  }, [catalog, owned, borrowedFrom, disabledReason]);

  const toggle = (cardId: string) => {
    if (disabledReason(cardId)) return;
    // Plain reads, not an updater: toast is a side effect, and StrictMode
    // double-invokes updaters — one tap would toast twice from inside one.
    if (squad.includes(cardId)) return setSquad(squad.filter((id) => id !== cardId));
    if (squad.length >= (raid?.squadSize ?? 3)) {
      return toast(`A squad is ${raid?.squadSize ?? 3} cards — drop one first.`, "error");
    }
    setSquad([...squad, cardId]);
  };

  const toggleLadder = async () => {
    const opening = !ladderOpen;
    setLadderOpen(opening);
    if (!opening || ladder !== null || ladderLoading) return;
    setLadderLoading(true);
    try {
      // authHeaders: the ladder is scoped to the caller's own encounter —
      // unauthenticated it would show the realm ladder under a header that
      // says "Guild standings".
      const r = await fetch(`${API_URL}/api/raid/leaderboard`, { headers: authHeaders() });
      const d = await r.json();
      if (Array.isArray(d?.data?.rows)) setLadder(d.data.rows);
      else toast("The ladder didn't answer — try again in a moment.", "error");
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setLadderLoading(false);
    }
  };

  const openPicker = () => {
    if (!user) return toast("Sign in to raid.", "error");
    if (fallen) return toast(`${raid?.boss.name || "The boss"} has already fallen this week.`, "error");
    if (attacksLeft <= 0) return toast("No attacks left today — the boss resets at midnight UTC.", "error");
    setSquad([]);
    setPickerOpen(true);
  };

  const sendSquad = async () => {
    if (!raid || squad.length !== raid.squadSize || attacking) return;
    setAttacking(true);
    const hpBefore = raid.hpLeft;
    try {
      const r = await fetch(`${API_URL}/api/raid/attack`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ squadCardIds: squad, nonce: crypto.randomUUID() }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "The attack didn't land.", "error");
        return;
      }
      const data = d.data || {};
      setPickerOpen(false);
      setSquad([]);
      setReport({
        damage: data.damage || 0,
        isRally: !!data.isRally,
        variance: typeof data.variance === "number" ? data.variance : undefined,
        lines: Array.isArray(data.lines) ? data.lines : [],
        injuredCount: data.injuredCount || 0,
        restUntil: data.restUntil || null,
        // A replayed nonce returns only {damage, lines} — the original report.
        // No HP delta arrives, so the bar honestly stays where it is.
        hpBefore: d.replay ? raid.hpLeft : hpBefore,
        hpLeft: typeof data.hpLeft === "number" ? data.hpLeft : raid.hpLeft,
        hpMax: typeof data.hpMax === "number" && data.hpMax > 0 ? data.hpMax : raid.hpMax,
        killed: !!data.killed,
        killingBlow: !!data.killingBlow,
        replay: !!d.replay,
      });
      // Refresh behind the modal: attacks used, fatigue, standings, injuries.
      loadRaid();
      loadCollection();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setAttacking(false);
    }
  };

  // Battle-report choreography: each line lands, then the total, then the bar.
  const lineDelay = (i: number) => 0.3 + i * 0.55;
  const totalDelay = report ? 0.3 + report.lines.length * 0.55 + 0.15 : 0;
  const hpDelay = totalDelay + 0.55;

  const pastBosses = useMemo(
    () => history.filter((h) => h.week !== raid?.week),
    [history, raid?.week]
  );

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-32 pt-14 font-mono text-white">
        {/* the Lunar top glow — same radial as the hub and leaderboard */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl">
          {!loaded ? (
            <p className="py-24 text-center text-sm text-slate-500">Waking the boss…</p>
          ) : !raid ? (
            <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-20 text-center">
              <Skull className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400">The raid didn&rsquo;t answer. It happens — try again in a moment.</p>
              <button type="button" onClick={() => { setLoaded(false); loadRaid(); }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/25">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* ── THE BOSS HERO ── */}
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11]">
                {/* Gradient bedrock — always painted, so a 404ing art file
                    never leaves a broken image or a flat black hole. */}
                <div aria-hidden className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(85% 90% at 82% 0%, rgba(248,113,113,.17), transparent 60%)," +
                      "radial-gradient(70% 85% at 8% 100%, rgba(139,92,246,.20), transparent 65%)," +
                      "linear-gradient(180deg, #150a10, #0b0b11)",
                  }} />
                {artOk && raid.boss.art && (
                  <img src={raid.boss.art} alt="" onError={() => setArtOk(false)}
                    className={`absolute inset-0 h-full w-full object-cover ${fallen ? "opacity-15 grayscale" : "opacity-30"}`} />
                )}
                {/* readability scrim over whatever is behind the copy */}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-[#0b0b11]/55 to-transparent" />

                <div className="relative p-6 sm:p-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                      <Swords className="h-3 w-3 text-red-300" /> {raid.guild ? "Guild Raid" : "World Raid"} · {raid.week}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
                      <CalendarDays className="h-3 w-3" /> Resets Monday · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                    </span>
                    {raid.guild && (
                      <Link href={`/guild/${encodeURIComponent(raid.guild.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20">
                        <Users className="h-3 w-3" /> [{raid.guild.tag}] {raid.guild.name} — your guild faces the boss
                      </Link>
                    )}
                    {fallen && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                        <Skull className="h-3 w-3" /> Slain
                      </span>
                    )}
                  </div>

                  <h1 className="mt-5 font-fell text-4xl leading-tight text-white sm:text-6xl">{raid.boss.name}</h1>
                  <p className="mt-1 font-fell text-lg text-slate-300 sm:text-xl">
                    terror of <em className="italic text-red-400">{raid.boss.series}</em>
                  </p>
                  {raid.boss.flavor && (
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{raid.boss.flavor}</p>
                  )}

                  {/* the week's gimmick, said once, plainly */}
                  {raid.boss.gimmickText && (
                    <div className="mt-5 flex max-w-xl items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                      <p className="text-xs leading-relaxed text-red-200/90">{raid.boss.gimmickText}</p>
                    </div>
                  )}

                  {/* ── THE HP BAR ── */}
                  <div className="mt-7">
                    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                        {fallen ? "It is done" : "Boss HP"}
                      </span>
                      <span className="text-sm font-black tabular-nums text-white">
                        {raid.hpLeft.toLocaleString()} <span className="text-slate-500">/ {raid.hpMax.toLocaleString()}</span>
                        <span className="ml-2 text-[10px] font-bold text-slate-500">{Math.round(hpPct)}%</span>
                      </span>
                    </div>
                    <div className="h-5 overflow-hidden rounded-full border border-white/10 bg-black/50">
                      <motion.div
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${hpPct}%` }}
                        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-red-500"
                        style={{ boxShadow: "0 0 18px rgba(248,113,113,.45)" }}
                      />
                    </div>
                  </div>

                  {fallen && raid.killedAt && (
                    <p className="mt-4 text-xs text-emerald-300/90">
                      Felled {new Date(raid.killedAt).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })} —
                      a new boss rises Monday.
                    </p>
                  )}
                </div>
              </div>

              {/* ── YOUR ATTACKS TODAY ── */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-white">Your attacks today</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {user
                        ? `${freeAttacks} free each day — the third is a Rally, ${raid.rallyCost} AP. Squads of ${raid.squadSize}; a card fights once per day.`
                        : "Sign in to send a squad — everyone's damage counts."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: maxAttacks }).map((_, i) => {
                      const used = i < attacksToday;
                      const isRallySlot = i >= freeAttacks;
                      return (
                        <span key={i}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                            used
                              ? "border-violet-400/40 bg-violet-500/20 text-violet-200"
                              : "border-white/10 bg-white/[0.03] text-slate-500"
                          }`}>
                          {isRallySlot ? (<><Flame className="h-3 w-3" /> Rally · {raid.rallyCost} AP</>) : (<>Attack {i + 1}</>)}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button type="button" onClick={openPicker}
                  disabled={fallen || (!!user && attacksLeft <= 0)}
                  className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-sm font-black uppercase tracking-[0.18em] transition sm:w-auto ${
                    fallen || (!!user && attacksLeft <= 0)
                      ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-600"
                      : nextIsRally
                      ? "border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                      : "border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                  }`}>
                  <Swords className="h-4 w-4" />
                  {fallen
                    ? `${raid.boss.name} has already fallen`
                    : !user
                    ? "Sign in to fight"
                    : attacksLeft <= 0
                    ? "No attacks left today"
                    : nextIsRally
                    ? `Rally · ${raid.rallyCost} AP`
                    : "Send a squad"}
                </button>
                {!fallen && !!user && attacksLeft <= 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">The boss resets at midnight UTC.</p>
                )}

                {user && raid.mine.myAttacks > 0 && (
                  <p className="mt-4 text-[11px] text-slate-500">
                    Your week so far: <b className="tabular-nums text-violet-300">{raid.mine.myDamage.toLocaleString()}</b> damage
                    across <b className="tabular-nums text-violet-300">{raid.mine.myAttacks}</b> attack{raid.mine.myAttacks === 1 ? "" : "s"}.
                  </p>
                )}
              </div>

              {/* ── LAST WEEK — the settlement, straight from the server ── */}
              {lastWeek && (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <p className="text-sm font-black text-white">Last week</p>
                    {!lastWeek.settled && (
                      <span className="text-[10px] text-slate-500">settling…</span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{lastWeek.week}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{lastWeek.name}</span>
                    {lastWeek.killed ? (
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                        Slain
                      </span>
                    ) : (
                      <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-red-300">
                        Escaped at {Math.round(lastWeek.dealtRatio * 100)}%
                      </span>
                    )}
                  </div>

                  {lastWeek.mine && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                      <p className="text-[11px] text-slate-400">
                        Your week: <b className="tabular-nums text-violet-300">{lastWeek.mine.attacks}</b> attack{lastWeek.mine.attacks === 1 ? "" : "s"}
                        {" · "}<b className="tabular-nums text-violet-300">{lastWeek.mine.damage.toLocaleString()}</b> damage
                        {lastWeek.mine.rank !== null && (
                          <> · rank <b className="tabular-nums text-violet-300">#{lastWeek.mine.rank}</b></>
                        )}
                      </p>
                      {lastWeek.mine.eligible ? (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                            +{lastWeek.mine.ap} AP
                          </span>
                          <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
                            +{lastWeek.mine.shards} shards
                          </span>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Not enough attacks to qualify ({lastWeek.mine.attacks}/3)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── STANDINGS ── */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-violet-300" />
                  <p className="text-sm font-black text-white">
                    {raid.guild ? "Guild standings" : "This week’s vanguard"}
                  </p>
                </div>
                {raid.standings.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-600">Nobody has struck yet. First blood is waiting.</p>
                ) : (
                  <>
                    {ladderOpen ? (
                      ladderLoading ? (
                        <p className="py-10 text-center text-xs text-slate-600">Climbing the ladder…</p>
                      ) : ladder === null ? (
                        <p className="py-10 text-center text-xs text-slate-600">
                          The ladder didn&rsquo;t answer — close it and try again.
                        </p>
                      ) : ladder.length === 0 ? (
                        <p className="py-10 text-center text-xs text-slate-600">Nobody on the ladder yet.</p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {ladder.slice(0, 25).map((s, i) => {
                            const me = !!user && s.username === user.username;
                            return (
                              <div key={`${s.username}-${i}`}
                                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                                  me ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-white/[0.02]"
                                }`}>
                                <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-slate-600">{i + 1}</span>
                                {s.avatar ? (
                                  <img src={s.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
                                ) : (
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-[10px] font-black">
                                    {s.username?.[0]?.toUpperCase()}
                                  </span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm font-black text-white">
                                  {s.username}
                                  {me && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-violet-300">You</span>}
                                </span>
                                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">{s.attacks} atk</span>
                                <span className="shrink-0 text-sm font-black tabular-nums text-red-300">{s.damage.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="mt-4 space-y-2">
                        {raid.standings.slice(0, 10).map((s, i) => {
                          const me = !!user && s.username === user.username;
                          return (
                            <div key={`${s.username}-${i}`}
                              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                                me ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-white/[0.02]"
                              }`}>
                              <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-slate-600">{i + 1}</span>
                              {s.avatar ? (
                                <img src={s.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
                              ) : (
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-700 text-[10px] font-black">
                                  {s.username?.[0]?.toUpperCase()}
                                </span>
                              )}
                              <span className="min-w-0 flex-1 truncate text-sm font-black text-white">
                                {s.username}
                                {me && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-violet-300">You</span>}
                              </span>
                              <span className="shrink-0 text-sm font-black tabular-nums text-red-300">{s.damage.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button type="button" onClick={toggleLadder}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-white">
                      {ladderOpen ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Back to the top ten
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Full ladder
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* ── PAST BOSSES ── */}
              {pastBosses.length > 0 && (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <p className="text-sm font-black text-white">The record</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {pastBosses.map((h) => (
                      <div key={h.week} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{h.week}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-black text-white">
                          {h.name} <em className="not-italic text-slate-500">· {h.series}</em>
                        </span>
                        {h.killed ? (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                            Killed
                          </span>
                        ) : (
                          <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-red-300">
                            Escaped at {Math.round(h.dealtRatio * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── SQUAD PICKER — bottom sheet ── */}
        {pickerOpen && raid && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setPickerOpen(false)} />
            <div role="dialog" aria-modal="true" aria-label="Pick your raid squad"
              className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-fell text-lg text-white">Send a squad</p>
                  <p className="text-[11px] text-slate-500">
                    Pick exactly {raid.squadSize} — a card fights once per day
                    {nextIsRally ? ` · this one's a Rally, ${raid.rallyCost} AP` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {roster.length === 0 ? (
                  <p className="py-14 text-center text-xs text-slate-600">
                    {catalog ? "No cards yet — open a pack first." : "Reading your collection…"}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4">
                    {roster.map((c) => {
                      const reason = disabledReason(c.id);
                      const selIdx = squad.indexOf(c.id);
                      const lender = !(owned[c.id] > 0) ? borrowedFrom[c.id] : undefined;
                      return (
                        <button key={c.id} type="button" onClick={() => toggle(c.id)} disabled={!!reason}
                          className={`relative transition ${reason ? "cursor-not-allowed opacity-40 grayscale" : "hover:-translate-y-0.5"}`}>
                          {selIdx > -1 && (
                            <span className="absolute -left-1.5 -top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full bg-violet-500 text-[11px] font-black text-white ring-2 ring-[#0b0b11]">
                              {selIdx + 1}
                            </span>
                          )}
                          <span className={`block rounded-xl ${selIdx > -1 ? "ring-2 ring-violet-400" : ""}`}>
                            <CardFace card={c} owned count={owned[c.id] || 1} foil={!!foils[c.id]} level={levels[c.id]}
                              stats={catalog?.cardStats} statsById={catalog?.cardStatsById} size={110} ratio="5 / 9" />
                          </span>
                          {lender && !reason && (
                            <span className="absolute inset-x-0 top-1.5 z-20 mx-auto w-fit max-w-[95%] truncate whitespace-nowrap rounded-full border border-emerald-400/40 bg-black/85 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-300">
                              borrowed · {lender}
                            </span>
                          )}
                          {reason && (
                            <span className="absolute inset-x-0 bottom-1.5 z-20 mx-auto w-fit whitespace-nowrap rounded-full bg-black/85 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-300">
                              {reason}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* sticky confirm bar */}
              <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0b0b11] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-black tabular-nums text-white">{squad.length} / {raid.squadSize} picked</p>
                  {/* Deliberately a "?": the multipliers are the server's
                      business, and a wrong number is worse than none. */}
                  <p className="text-[10px] text-slate-500" title="The boss keeps its multipliers to itself — find out when the blow lands.">
                    Projected damage: <span className="font-black text-violet-300">?</span>
                  </p>
                </div>
                <button type="button" disabled={squad.length !== raid.squadSize || attacking} onClick={sendSquad}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    nextIsRally
                      ? "border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                      : "border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                  }`}>
                  <Swords className="h-3.5 w-3.5" />
                  {attacking ? "Striking…" : nextIsRally ? `Rally · ${raid.rallyCost} AP` : "Send squad"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BATTLE REPORT ── */}
        <AnimatePresence>
          {report && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[130] flex items-end justify-center bg-black/80 sm:items-center sm:p-4">
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                role="dialog" aria-modal="true" aria-label="Battle report"
                className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto border border-white/10 bg-[#0b0b11] p-5 sm:rounded-2xl sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-fell text-2xl text-white">Battle Report</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {report.isRally && <MultChip label="Rally" color="#fbbf24" />}
                      {typeof report.variance === "number" && <MultChip label={`${fmtMult(report.variance)} fate`} color="#94a3b8" />}
                      {report.replay && <MultChip label="replayed — original report" color="#94a3b8" />}
                    </div>
                  </div>
                  <button type="button" onClick={() => setReport(null)} aria-label="Close"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* per-card lines, revealed in sequence */}
                <div className="mt-5 space-y-2.5">
                  {report.lines.map((l, i) => {
                    const rMeta = RARITY_META[l.rarity as CardRarity];
                    return (
                      <motion.div key={`${l.cardId}-${i}`}
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduce ? 0 : lineDelay(i), duration: 0.35 }}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-black text-white">{l.name}</p>
                          <p className="shrink-0 text-base font-black tabular-nums" style={{ color: rMeta?.gem || "#e2e8f0" }}>
                            <Roll to={l.line} delay={reduce ? 0 : lineDelay(i) * 1000 + 150} />
                          </p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <MultChip label={`${fmtMult(l.rarityMult)} ${rMeta?.label || l.rarity}`} color={rMeta?.gem || "#cbd5e1"} />
                          {l.condition && l.condMult !== 1 && (
                            <MultChip label={`${fmtMult(l.condMult)} ${l.condition}`} color={l.condition === "fresh" ? "#34d399" : "#e0a56a"} />
                          )}
                          {l.affMult > 1 && <MultChip label={`${fmtMult(l.affMult)} ${l.set}`} color="#f87171" />}
                          {l.gimMult !== 1 && <MultChip label={`${fmtMult(l.gimMult)} gimmick`} color="#fbbf24" />}
                          {l.varietyMult !== 1 && <MultChip label={`${fmtMult(l.varietyMult)} variety`} color="#22d3ee" />}
                          {l.injured && <MultChip label="injured — resting 36h" color="#f87171" />}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* the total */}
                <motion.div
                  initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: reduce ? 0 : totalDelay, duration: 0.4 }}
                  className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/[0.07] px-4 py-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300/80">Total damage</p>
                  <p className="mt-1 text-4xl font-black tabular-nums text-red-300">
                    <Roll to={report.damage} delay={reduce ? 0 : totalDelay * 1000 + 100} />
                  </p>
                  {report.injuredCount > 0 && report.restUntil && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      {report.injuredCount} card{report.injuredCount === 1 ? "" : "s"} injured — back{" "}
                      {new Date(report.restUntil).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}.
                    </p>
                  )}
                </motion.div>

                {/* HP before → after */}
                <motion.div
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: reduce ? 0 : hpDelay, duration: 0.3 }}
                  className="mt-5">
                  <div className="mb-1.5 flex items-end justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Boss HP</span>
                    <span className="text-xs font-black tabular-nums text-white">
                      <span className="text-slate-500 line-through">{report.hpBefore.toLocaleString()}</span>
                      {" → "}{report.hpLeft.toLocaleString()}
                      <span className="text-slate-500"> / {report.hpMax.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="h-3.5 overflow-hidden rounded-full border border-white/10 bg-black/50">
                    <motion.div
                      initial={{ width: `${report.hpMax > 0 ? (report.hpBefore / report.hpMax) * 100 : 0}%` }}
                      animate={{ width: `${report.hpMax > 0 ? (report.hpLeft / report.hpMax) * 100 : 0}%` }}
                      transition={{ delay: reduce ? 0 : hpDelay + 0.2, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-red-500"
                    />
                  </div>
                </motion.div>

                {/* the moment, when it's yours */}
                {report.killingBlow ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, scale: 1.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: reduce ? 0 : hpDelay + 0.9, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-6 text-center">
                    <p className="font-fell text-3xl tracking-[0.14em] text-red-400"
                      style={{ textShadow: "0 0 24px rgba(248,113,113,.6)" }}>
                      KILLING BLOW
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">Your squad ended it. The whole realm shares the kill.</p>
                  </motion.div>
                ) : report.killed ? (
                  <motion.p
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduce ? 0 : hpDelay + 0.9 }}
                    className="mt-6 text-center text-sm font-black text-emerald-300">
                    <Sparkles className="mr-1.5 inline h-4 w-4" /> The boss has fallen.
                  </motion.p>
                ) : null}

                <button type="button" onClick={() => setReport(null)}
                  className="mt-6 w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
