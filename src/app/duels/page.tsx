"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Trophy, Shield, Heart, Crosshair, Diamond, Gem, X, Flame } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { displayArisePoints, displayShards } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, FALLBACK_STATS, GOD_STATS_MIRROR } from "@/components/cards/CardFace";
import DeckBuilder, { loadSavedDeck, saveDeck } from "@/components/cards/DeckBuilder";
import Arena, { duelPayout } from "@/components/cards/Arena";
import { notch, ACCENT } from "@/components/cards/gacha";
import { loadCatalog } from "@/lib/catalogCache";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DECK_SIZE = 5;
// Mirrors MIN_STAKE / MAX_STAKE in the server's duelRules.
const MIN_STAKE = 50;
const MAX_STAKE = 5000;

const ITEM_META: Record<string, { name: string; desc: string; shards: number; Icon: any; tint: string }> = {
  heal:   { name: "Salve", desc: "Restore 10 HP", shards: 120, Icon: Heart, tint: "text-rose-300" },
  shield: { name: "Ward",  desc: "Halve next damage", shards: 150, Icon: Shield, tint: "text-sky-300" },
  focus:  { name: "Focus", desc: "+75% next attack", shards: 180, Icon: Crosshair, tint: "text-amber-300" },
};

type Fighter = { cardId: string; name: string; rarity: any; maxHp: number; hp: number; atk: number; foil: boolean };
type Side = {
  userId: string; username: string; fighters: Fighter[]; active: number;
  // Server-side fields the board reads. They were missing from this type, so
  // `mine.usedSupports` type-checked as an error the build was configured to
  // ignore — it worked by accident rather than by declaration.
  usedSupports?: string[]; usedAbilities?: string[]; shield?: boolean; block?: boolean; focus?: boolean; focusMult?: number;
  // Grounds laid this duel — a separate list from usedSupports because the
  // server keeps them separate: once each, but slot-free.
  usedGrounds?: string[];
};
type DuelState = {
  a: Side; b: Side; turn: string; log: string[]; round: number;
  /** Health per side after each resolved action — recorded server-side, so
   *  the post-match graph is authoritative rather than parsed out of a log
   *  that only keeps its last 60 lines. Absent on duels fought before it. */
  timeline?: { a: number; b: number }[];
};
type Duel = {
  id: string; challengerId: string; challengerName: string; opponentId: string; opponentName: string;
  stake: number; status: string; challengerDeck: string[]; opponentDeck: string[];
  state: string | null; turnUserId: string | null; winnerId: string | null;
};

export default function DuelsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [rating, setRating] = useState<any>(null);
  const [board, setBoard] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [cardStats, setCardStats] = useState<Record<string, { hp: number; atk: number }> | undefined>(undefined);
  /**
   * PER-CARD stats, which outrank the rarity table above.
   *
   * The catalog has shipped these since the Knight set landed and this page
   * simply never read them, so every deck-selection surface fell back to the
   * rarity line: the Squire (9/4) and the Jester (13/1) are both common, so
   * both printed 18/7. The binder was fixed and this screen — the one where
   * you actually commit to a deck — was not.
   */
  const [cardStatsById, setCardStatsById] = useState<Record<string, { hp: number; atk: number }> | undefined>(undefined);
  // Which cards have a skill or a domain, so the arena only offers the button
  // on cards that actually have one.
  const [abilityIds, setAbilityIds] = useState<Set<string>>(new Set());
  // cardId -> { name, kind, levels[], isDomain }, so the arena can show what
  // an ability actually does instead of an unlabelled button.
  const [abilities, setAbilities] = useState<Record<string, any>>({});
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  // cardId -> true when it fell in a lost duel and cannot be fielded.
  const [asleep, setAsleep] = useState<Record<string, boolean>>({});
  // Bought power, so the cards SHOW what they'll actually fight with.
  const [cardLevels, setCardLevels] = useState<Record<string, number>>({});
  const [cardForges, setCardForges] = useState<Record<string, { atk: number; hp: number }>>({});
  /** Per-copy pull rolls, so the picker scores the copy you actually own. */
  const [cardRolls, setCardRolls] = useState<Record<string, { hp?: number | null; atk?: number | null }>>({});
  const [cardSkillLvls, setCardSkillLvls] = useState<Record<string, number>>({});
  // Caps for the MAX sign: domains top out at 3, skills at 5 — display-only
  // mirrors of the server caps, same contract as the cardStats mirror.
  const skillCaps = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [id, a] of Object.entries<any>(abilities)) m[id] = a.isDomain ? 3 : 5;
    return m;
  }, [abilities]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [shards, setShards] = useState(0);
  const [bag, setBag] = useState<string[]>([]);
  const [active, setActive] = useState<Duel | null>(null);
  const [busy, setBusy] = useState(false);
  // The saved deck, mirrored here so the page can SHOW it. It used to live
  // only inside the challenge modal — the one thing every duel is fought
  // with was invisible until you were already committing to a fight.
  const [deck, setDeck] = useState<string[]>([]);
  const [editDeck, setEditDeck] = useState(false);
  useEffect(() => { setDeck(loadSavedDeck()); }, []);
  const [showChallenge, setShowChallenge] = useState(false);
  // Any open modal locks the page behind it. The Arena locks on its own and
  // restores what it found, so the two nest cleanly. DECLARED AFTER
  // showChallenge: a const initializer that reads a state declared below it
  // is a TDZ ReferenceError at first render — and with ignoreBuildErrors,
  // that crash BUILDS AND DEPLOYS. It took this page down once.
  const modalOpen = !!active || showChallenge || editDeck;
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [modalOpen]);
  const [tab, setTab] = useState<"duels" | "ladder">("duels");
  // Which duel is on screen RIGHT NOW, readable from inside an in-flight
  // request whose closure captured an older value.
  const openIdRef = useRef<string | null>(null);
  useEffect(() => { openIdRef.current = active?.id ?? null; }, [active?.id]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // The item bag is refetched HERE rather than once on mount. It used to
      // load a single time, so after spending a Salve the button still showed a
      // charge and the next click 400'd with "you have no Salve left".
      const [d, l, c, u] = await Promise.all([
        fetch(`${API_URL}/api/duels/mine/${user.id}`).then((r) => r.json()),
        fetch(`${API_URL}/api/duels/leaderboard`).then((r) => r.json()),
        fetch(`${API_URL}/api/cards/collection/${user.id}`).then((r) => r.json()),
        fetch(`${API_URL}/api/users/${user.id}`).then((r) => r.json()).catch(() => null),
      ]);
      /**
       * Every setter bails when the data is UNCHANGED. The poll runs every two
       * seconds, and each response is a freshly-parsed object — new identity,
       * same content. Handing those to setState re-rendered the entire page,
       * and the arena with it, every tick of an idle duel. If every updater
       * returns its previous value React skips the render outright, so a quiet
       * poll now costs the fetch and nothing else. (The earlier fix did this
       * for `active` only — these five setters were still churning.)
       */
      const keep = <T,>(prev: T, next: T): T =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      if (u?.data?.duelItems) setBag((p) => keep(p, u.data.duelItems));
      if (d.success) {
        setDuels((p) => keep(p, d.data.duels || []));
        setRating((p: any) => keep(p, d.data.rating));
      }
      if (l.success) setBoard((p) => keep(p, l.data || []));
      if (c.success) {
        const m: Record<string, number> = {};
        const fo: Record<string, boolean> = {};
        const sl: Record<string, boolean> = {};
        const lv: Record<string, number> = {};
        const fg: Record<string, { atk: number; hp: number }> = {};
        const sk: Record<string, number> = {};
        // The per-copy pull roll. Only recorded when the server actually rolled
        // this copy — a null must NOT become 0, or a pre-roll card renders as
        // a 0/0 instead of falling back to its printed line.
        const rl: Record<string, { hp?: number | null; atk?: number | null }> = {};
        for (const x of c.data?.cards || []) {
          m[x.cardId] = x.count;
          if (x.foil) fo[x.cardId] = true;
          if (typeof x.rolledHp === "number" || typeof x.rolledAtk === "number") {
            rl[x.cardId] = { hp: x.rolledHp, atk: x.rolledAtk };
          }
          // Captured so the deck picker can grey a sleeping card out. Without
          // it the picker showed every card as available and the server threw
          // the deck back only after you had committed to the challenge.
          if (x.hibernating) sl[x.cardId] = true;
          lv[x.cardId] = x.level || 1;
          fg[x.cardId] = { atk: x.atkForge || 0, hp: x.hpForge || 0 };
          sk[x.cardId] = x.skillLevel || 1;
        }
        setOwned((p) => keep(p, m));
        setFoils((p) => keep(p, fo));
        setAsleep((p) => keep(p, sl));
        setCardLevels((p) => keep(p, lv));
        setCardForges((p) => keep(p, fg));
        setCardSkillLvls((p) => keep(p, sk));
        setCardRolls((p) => keep(p, rl));
        setShards(c.data.shards || 0);
      }
      // Keep the open board fresh so the opponent's move appears.
      if (active) {
        const fresh = await fetch(`${API_URL}/api/duels/${active.id}`).then((r) => r.json());
        // Only apply it if that duel is STILL the one on screen. This closure
        // captured `active` before the request went out, so closing the arena
        // mid-flight — exactly what happens when you forfeit and immediately
        // hit "Leave the arena", since forfeiting awaits this same load() —
        // would otherwise re-open the board you just walked out of.
        // Only swap state in when something ACTUALLY changed. The poll fires
        // every couple of seconds; handing React a new object each time
        // re-rendered the whole arena — twelve procedural SVG cards and every
        // framer transform — to draw an identical board. Comparing the fields
        // that can move makes an idle turn cost nothing.
        if (fresh.success && openIdRef.current === active.id) {
          setActive((prev) => {
            const n = fresh.data;
            if (
              prev &&
              prev.id === n.id &&
              prev.status === n.status &&
              prev.turnUserId === n.turnUserId &&
              prev.winnerId === n.winnerId &&
              prev.state === n.state
            ) {
              return prev; // identical board — keep the same reference
            }
            return n;
          });
        }
      }
    } catch { /* offline */ }
  }, [user?.id, active?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // The catalog is what turns a cardId into art and a name. Without it the
    // arena renders a board of blanks, so a failed fetch has to be visible and
    // retryable rather than a silent empty grid. (Render's free tier sleeps —
    // the first request after an idle period genuinely does fail sometimes.)
    // Served from the session cache FIRST, then refreshed from the network.
    // The board used to sit as a grid of blanks until Render woke up; now the
    // only visit that waits is the first one in a session.
    let cancelled = false;
    loadCatalog(
      API_URL,
      (data) => {
        if (cancelled) return;
        setCatalog(data.cards);
        setAbilityIds(new Set([...Object.keys(data.skills || {}), ...Object.keys(data.domains || {})]));
        // The board needs to SAY what an ability does, not just offer a
        // button for it. Domains are tagged so the arena can label them
        // differently — they are a different mechanic, not a bigger skill.
        const abil: Record<string, any> = {};
        for (const [id, s] of Object.entries<any>(data.skills || {})) abil[id] = { ...s, isDomain: false };
        for (const [id, d] of Object.entries<any>(data.domains || {})) abil[id] = { ...d, isDomain: true };
        setAbilities(abil);
        setCardStats(data.cardStats);
        setCardStatsById(data.cardStatsById);
        setCatalogFailed(false);
      },
      () => { if (!cancelled) setCatalogFailed(true); }
    );
    return () => { cancelled = true; };
  }, [user?.id]);
  // Poll while a duel is open — turns arrive without websockets (Render sleeps).
  // PENDING is polled too: a challenge you sent needs to flip to ACTIVE the
  // moment the other player accepts, and gating this on ACTIVE meant the
  // waiting screen sat there forever until you backed out and reopened it.
  useEffect(() => {
    if (!active || (active.status !== "ACTIVE" && active.status !== "PENDING")) return;
    // 2s, not 4s. The backend is off the sleeping free tier now, so a poll is
    // a warm request rather than a possible cold start — and with the
    // unchanged-state bail above, a quiet turn costs one small fetch and no
    // render at all. Turns land visibly faster.
    /**
     * Polls ONE endpoint, not the whole page.
     *
     * This used to call load(), which fires five requests — duels, ladder,
     * collection, user, plus the duel itself. At 2s that is 150 requests a
     * minute against a 300-per-15-minute budget, so a couple of minutes of
     * play tripped the rate limiter and threw "Too many requests from this
     * IP" over a live board. The comment here claimed "one small fetch"; it
     * was five, and that gap is the whole bug.
     *
     * Only the duel changes between turns. Everything else load() fetches is
     * page furniture that a poll has no reason to touch.
     */
    const tick = async () => {
      const id = openIdRef.current;
      if (!id) return;
      try {
        const r = await fetch(`${API_URL}/api/duels/${id}`);
        const fresh = await r.json();
        if (!fresh?.success || openIdRef.current !== id) return;
        setActive((prev) => {
          const n = fresh.data;
          if (
            prev && prev.id === n.id && prev.status === n.status &&
            prev.turnUserId === n.turnUserId && prev.winnerId === n.winnerId &&
            prev.state === n.state
          ) return prev; // identical board — keep the reference, skip the render
          return n;
        });
      } catch { /* offline */ }
    };
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [active?.id, active?.status]);

  /**
   * `refresh` is why moves used to feel slow. Every action awaited load() —
   * FIVE requests re-fetching the ladder, the collection and the user — while
   * `busy` kept the action bar disabled, so each attack cost one round trip of
   * game and four of page furniture. The move endpoints all return the updated
   * duel row, which is everything the open board needs:
   *   "none"       — apply the response, touch nothing else (mid-duel moves)
   *   "background" — refetch the page without holding `busy` for it
   *   "await"      — the old behaviour, for actions where the page must be
   *                  current before the user's next look (spending shards)
   */
  const post = async (
    path: string, body: any, ok?: (d: any) => void,
    refresh: "await" | "background" | "none" = "await",
  ) => {
    if (!user) return toast("Sign in first.", "error");
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/duels/${path}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id, ...body }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) { toast(d.message || "That didn't work.", "error"); return; }
      ok?.(d.data);
      if (refresh === "await") await load();
      else if (refresh === "background") void load();
    } catch { toast("That didn't work.", "error"); } finally { setBusy(false); }
  };

  /**
   * Both were rebuilt on EVERY render of this page and handed straight to the
   * arena. `busy` alone flips twice per move and load() runs after each one, so
   * a single attack recreated the lookup table and the collection several
   * times over — and a new object identity re-renders the whole board even when
   * nothing in it changed.
   */
  const byId = useMemo(
    () => Object.fromEntries(catalog.map((c) => [c.id, c])),
    [catalog]
  );
  const myCards = useMemo(
    () => catalog.filter((c) => (owned[c.id] || 0) > 0),
    [catalog, owned]
  );
  // Same arithmetic as the deck builder's readout, so the two never disagree.
  const deckPower = useMemo(() => {
    const S: any = cardStats || FALLBACK_STATS;
    return deck.reduce((sum, id) => {
      const c = byId[id];
      if (!c) return sum;
      // Full server precedence: this copy's roll, then the per-card table, then
      // the Pantheon line, then rarity. Rarity alone scored every Knight of a
      // tier identically and credited a Squire 25 for a card that fights at 13.
      const printed = cardStatsById?.[c.id]
        || (c.set === "Pantheon" ? GOD_STATS_MIRROR : S[c.rarity] || S.common);
      const r = cardRolls[id];
      const base = {
        atk: typeof r?.atk === "number" && r.atk > 0 ? r.atk : printed.atk,
        hp: typeof r?.hp === "number" && r.hp > 0 ? r.hp : printed.hp,
      };
      const m = foils[id] ? 1.2 : 1;
      // The FULL formula — level curve and forge points included, exactly
      // like the cards below it show. The old base-only sum read a maxed
      // deck at half its true weight.
      const lvlM = 1 + (Math.min(10, Math.max(1, cardLevels[id] || 1)) - 1) * 0.07;
      const fg = cardForges[id] || { atk: 0, hp: 0 };
      return sum
        + Math.round(base.atk * m * lvlM) + fg.atk
        + Math.round(base.hp * m * lvlM) + fg.hp * 2;
    }, 0);
    // cardStatsById and cardRolls belong in the deps: both now feed the sum, and
    // both arrive AFTER the first render (one from the catalog fetch, one from
    // the collection fetch). Left out, the readout would freeze at the rarity
    // numbers it computed before either landed.
  }, [deck, byId, cardStats, cardStatsById, cardRolls, foils, cardLevels, cardForges]);
  const pending = duels.filter((d) => d.status === "PENDING");
  const running = duels.filter((d) => d.status === "ACTIVE");
  // What's waiting on YOU — the two lists that should never be below a shop.
  const needMe = pending.filter((d) => d.opponentId === user?.id);
  const myTurnDuels = running.filter((d) => d.turnUserId === user?.id);
  const ladderRank = user ? board.findIndex((r: any) => r.userId === user.id) : -1;
  const winPct = rating && rating.wins + rating.losses > 0
    ? Math.round((rating.wins / (rating.wins + rating.losses)) * 100)
    : null;
  const done = duels.filter((d) => ["FINISHED", "DECLINED", "EXPIRED"].includes(d.status));
  // The most recent duel that was actually FOUGHT. A declined or expired
  // challenge has no state to report on, and calling one of those "your last
  // game" would be worse than showing nothing.
  const lastFought = done.find((d) => d.status === "FINISHED" && !!d.state);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050505] px-4 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.42em] text-rose-400/80">Da Vinci · Arena</p>
              <h1 className="mt-1 flex items-center gap-3 font-fell text-4xl font-bold uppercase tracking-[0.1em] md:text-5xl">
                <Swords className="h-8 w-8 shrink-0 text-rose-400" />
                <span style={{
                  background: "linear-gradient(100deg, #fff 10%, #ffb4c4 55%, #f43f5e 92%)",
                  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                  filter: "drop-shadow(0 2px 18px rgba(244,63,94,.35))",
                }}>Card Duels</span>
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                Stake Arise Points, field five cards, and fight for the pot. Rarity is power — and foils hit harder.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {rating && (
                <div className="flex h-11 items-center gap-2 px-4"
                  style={{ clipPath: notch(10), background: "rgba(244,63,94,.10)", boxShadow: "inset 0 0 0 1px rgba(244,63,94,.42)" }}>
                  <Trophy className="h-4 w-4 text-rose-300" />
                  <span className="text-sm font-black tabular-nums text-rose-50">
                    {rating.rating}
                    <span className="ml-1.5 text-[11px] font-bold text-rose-400/80">{rating.wins}W {rating.losses}L</span>
                  </span>
                </div>
              )}
              <div className="flex h-11 items-center gap-2 px-4"
                style={{ clipPath: notch(10), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.11)" }}>
                <Diamond className="h-4 w-4" style={{ color: ACCENT }} />
                <span className="text-sm font-black tabular-nums">
                  {user ? displayArisePoints(user) : "—"}
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">AP</span>
                </span>
              </div>
              <button onClick={() => setShowChallenge(true)}
                className="inline-flex h-11 items-center gap-2 px-6 text-[12px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115"
                style={{
                  clipPath: "polygon(11px 0, 100% 0, calc(100% - 11px) 100%, 0 100%)",
                  background: "linear-gradient(100deg, #b91c3c, #f97316)",
                  boxShadow: "0 6px 24px rgba(244,63,94,.4)",
                }}>
                <Swords className="h-4 w-4" /> Challenge
              </button>
            </div>
          </div>

          {/* tabs — sheared plates, not an underline */}
          <div className="mb-6 flex gap-1.5">
            {(["duels", "ladder"] as const).map((t) => {
              const on = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                    on ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                  style={{
                    clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
                    background: on ? "linear-gradient(100deg, rgba(244,63,94,.35), rgba(249,115,22,.22))" : "rgba(255,255,255,.04)",
                    boxShadow: `inset 0 0 0 1px ${on ? "rgba(255,150,170,.55)" : "rgba(255,255,255,.08)"}`,
                  }}>
                  {t === "duels" ? "My Duels" : "Ranked Ladder"}
                </button>
              );
            })}
          </div>

          {/* Without the catalog every card is a blank rectangle. Say so and
              offer a retry instead of rendering an empty board silently. */}
          {catalogFailed && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-bold text-amber-200">
                Couldn&rsquo;t load the card catalog — cards will show as blanks until it does.
              </p>
              <button onClick={() => window.location.reload()}
                className="rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-black text-amber-100 transition hover:bg-amber-500/30">
                Retry
              </button>
            </div>
          )}

          {tab === "ladder" ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              {board.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No ranked duels yet. Be the first to climb.</p>
              ) : board.map((r, i) => (
                <div key={r.userId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${r.userId === user?.id ? "bg-rose-500/10" : i % 2 ? "bg-white/[0.02]" : ""}`}>
                  <span className={`w-7 text-center text-sm font-black ${i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-600"}`}>{i + 1}</span>
                  <span className="flex-1 truncate font-bold">{r.username}</span>
                  {r.streak >= 3 && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black text-orange-300"><Flame className="h-3 w-3" />{r.streak}</span>}
                  <span className="text-xs text-slate-500">{r.wins}W {r.losses}L</span>
                  <span className="w-14 text-right font-black text-rose-300">{r.rating}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── NEEDS YOU ── the single most important thing on this page,
                  so it comes before everything, shop included: games where the
                  clock is on YOUR side of the table. */}
              {(needMe.length > 0 || myTurnDuels.length > 0) && (
                <div className="relative p-4"
                  style={{ clipPath: notch(16), background: "linear-gradient(100deg, rgba(244,63,94,.16), rgba(249,115,22,.07))", boxShadow: "inset 0 0 0 1px rgba(244,63,94,.45)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
                      </span>
                      <p className="text-sm font-black text-white">
                        {myTurnDuels.length > 0 && `${myTurnDuels.length} duel${myTurnDuels.length === 1 ? "" : "s"} waiting on your move`}
                        {myTurnDuels.length > 0 && needMe.length > 0 && <span className="text-slate-500"> · </span>}
                        {needMe.length > 0 && `${needMe.length} challenge${needMe.length === 1 ? "" : "s"} to answer`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {myTurnDuels[0] && (
                        <button onClick={() => setActive(myTurnDuels[0])}
                          className="rounded-full bg-gradient-to-r from-rose-600 to-orange-600 px-5 py-2 text-xs font-black text-white transition hover:brightness-110">
                          Fight now
                        </button>
                      )}
                      {needMe[0] && (
                        <button onClick={() => setActive(needMe[0])}
                          className="rounded-full border border-rose-400/40 bg-rose-500/10 px-5 py-2 text-xs font-black text-rose-200 transition hover:bg-rose-500/20">
                          Answer the challenge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── YOUR NUMBERS ── the record the page always had and never
                  showed: rating, W/L, win rate, and where that puts you. */}
              {rating && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  <Stat label="Rating" value={String(rating.rating)} tint="#fda4af" />
                  <Stat label="Record" value={`${rating.wins}W · ${rating.losses}L`} tint="#7dd3fc" />
                  <Stat label="Win rate" value={winPct === null ? "—" : `${winPct}%`} tint="#6ee7b7" />
                  <Stat label={ladderRank >= 0 ? "Ladder rank" : "Streak"}
                    value={ladderRank >= 0 ? `#${ladderRank + 1}` : String(rating.streak || 0)} tint="#fbbf24" />
                </div>
              )}

              {/* YOUR DECK — the five that walk into every duel. The page never
                  showed them: the deck lived inside the challenge modal, so the
                  thing every fight is fought with was invisible until you were
                  already committing to one. */}
              <div className="relative p-5"
                style={{ clipPath: notch(20), background: "linear-gradient(160deg, rgba(244,63,94,.06), rgba(28,8,16,.5))", boxShadow: "inset 0 0 0 1px rgba(244,63,94,.26)" }}>
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-stretch gap-2.5">
                    <span aria-hidden className="w-[5px] shrink-0"
                      style={{ background: "linear-gradient(#fda4af, #f43f5e)", transform: "skewX(-14deg)" }} />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-200">Your deck</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {deckPower > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black tabular-nums text-amber-200"
                        style={{ clipPath: notch(7), background: "rgba(245,158,11,.12)", boxShadow: "inset 0 0 0 1px rgba(245,158,11,.4)" }}>
                        {deckPower} power
                      </span>
                    )}
                    <button onClick={() => setEditDeck(true)}
                      className="px-4 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-rose-100 transition hover:brightness-115"
                      style={{ clipPath: notch(7), background: "rgba(244,63,94,.18)", boxShadow: "inset 0 0 0 1px rgba(244,63,94,.45)" }}>
                      Edit
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-center gap-2.5 sm:justify-start">
                  {Array.from({ length: DECK_SIZE }, (_, i) => {
                    const c = deck[i] ? byId[deck[i]] : null;
                    return c ? (
                      <button key={i} onClick={() => setEditDeck(true)} title={`${c.name} — tap to edit your deck`}
                        className="relative transition hover:-translate-y-0.5">
                        <CardFace card={c} owned foil={foils[c.id]} size={92} ratio="5 / 9" showStats stats={cardStats} statsById={cardStatsById} roll={cardRolls[c.id]} hibernating={!!asleep[c.id]} level={cardLevels[c.id]} forge={cardForges[c.id]} skillLevel={cardSkillLvls[c.id]} skillCap={abilities[c.id] ? (abilities[c.id].isDomain ? 3 : 5) : undefined} />
                      </button>
                    ) : (
                      <button key={i} onClick={() => setEditDeck(true)} title="Empty slot — tap to build your deck"
                        className="grid place-items-center rounded-xl border-2 border-dashed border-white/15 text-slate-700 transition hover:border-rose-400/40 hover:text-rose-400/60"
                        style={{ width: 92, aspectRatio: "5 / 9" }}>
                        <Swords className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  These five walk into every challenge you send or accept. A card that falls in a loss sleeps until you wake it with shards.
                </p>
              </div>

              {pending.length > 0 && (
                <Section title="Challenges">
                  {pending.map((d) => (
                    <DuelRow key={d.id} duel={d} me={user?.id} onOpen={() => setActive(d)}
                      right={
                        d.opponentId === user?.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => setActive(d)} className="rounded-full bg-gradient-to-r from-rose-600 to-orange-600 px-4 py-1.5 text-xs font-black">Accept</button>
                            <button onClick={() => post(`${d.id}/decline`, {})} className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-black text-slate-300">Decline</button>
                          </div>
                        ) : (
                          <button onClick={() => post(`${d.id}/decline`, {})} className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-black text-slate-400">Cancel</button>
                        )
                      } />
                  ))}
                </Section>
              )}

              {running.length > 0 && (
                <Section title="In progress">
                  {running.map((d) => (
                    <DuelRow key={d.id} duel={d} me={user?.id} onOpen={() => setActive(d)}
                      right={<button onClick={() => setActive(d)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black ${d.turnUserId === user?.id ? "bg-gradient-to-r from-rose-600 to-orange-600 text-white" : "border border-white/15 text-slate-400"}`}>
                        {d.turnUserId === user?.id && (
                          // the ping says "the game is waiting on YOU" from
                          // across the page, before any text is read
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                        )}
                        {d.turnUserId === user?.id ? "Your turn" : "Waiting"}
                      </button>} />
                  ))}
                </Section>
              )}

              {/* ── SUPPORT ITEMS ── below the live games now: buying wards is
                  preparation, and preparation never outranks a fight in
                  progress. */}
              <div className="relative p-5"
                style={{ clipPath: notch(20), background: "linear-gradient(160deg, rgba(34,211,238,.07), rgba(8,20,30,.5))", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.28)" }}>
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="flex items-stretch gap-2.5">
                    <span aria-hidden className="w-[5px] shrink-0"
                      style={{ background: "linear-gradient(#a5f3fc, #22d3ee)", transform: "skewX(-14deg)" }} />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Support items</h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black tabular-nums text-cyan-100"
                    style={{ clipPath: notch(7), background: "rgba(34,211,238,.12)", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.4)" }}>
                    <Gem className="h-3.5 w-3.5" />{displayShards(user, shards)}
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {Object.entries(ITEM_META).map(([id, m]) => {
                    const held = bag.filter((b) => b === id).length;
                    const afford = shards >= m.shards;
                    return (
                      <button key={id} disabled={busy || !afford}
                        onClick={() => post("buy-item", { item: id }, (d) => { setShards(d.shards); setBag(d.duelItems || []); toast(`Bought ${m.name}`, "success"); })}
                        className="group flex items-center gap-3 p-3.5 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                        style={{ clipPath: notch(12), background: "rgba(255,255,255,.035)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                        <m.Icon className={`h-5 w-5 shrink-0 ${m.tint}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black">
                            {m.name}
                            {held > 0 && <span className="ml-1.5 text-cyan-300">×{held}</span>}
                          </span>
                          <span className="block text-[11px] text-slate-500">{m.desc}</span>
                          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.14em] text-cyan-400/80">
                            {m.shards} shards
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── HOW DUELS WORK ── the rules lived in a Discord post and
                  nowhere on the page. Folded shut so veterans never see it;
                  one tap for everyone who was guessing. */}
              <details className="group"
                style={{ clipPath: notch(14), background: "rgba(255,255,255,.025)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                <summary className="cursor-pointer list-none px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-300 transition hover:text-white">
                  How duels work · the 60-second version
                  <span className="ml-2 text-slate-600 group-open:hidden">＋</span>
                  <span className="ml-2 hidden text-slate-600 group-open:inline">−</span>
                </summary>
                <div className="grid gap-x-8 gap-y-2.5 px-4 pb-4 text-xs leading-relaxed text-slate-400 sm:grid-cols-2">
                  <p><b className="text-white">The stake.</b> Both sides pay it in. Winner takes the pot minus a 10% burn — competitive play is a sink, not a faucet.</p>
                  <p><b className="text-white">Five cards, turns.</b> Deploy one to the field, attack with it, or swap it out. Rarer cards hit harder; foils hit 20% harder still.</p>
                  <p><b className="text-white">Supports keep your turn.</b> Up to three support cards a duel, played free — heal, ward, revive — without passing the move.</p>
                  <p><b className="text-white">Skills &amp; domains.</b> Epics carry a skill, legendaries a domain expansion — each fires once per duel, and a domain can rewrite the fight.</p>
                  <p><b className="text-white">Fallen cards sleep.</b> Lose the duel and your fallen cards hibernate — wake them with shards, or pull another copy free.</p>
                  <p><b className="text-white">Items are consumables.</b> Salve, Ward and Focus are bought with shards below and spent one charge at a time, any turn.</p>
                </div>
              </details>

              {lastFought && <LastDuelStats duel={lastFought} me={user?.id} byId={byId} />}

              {done.length > 0 && (
                <Section title="History">
                  {done.slice(0, 8).map((d) => (
                    <DuelRow key={d.id} duel={d} me={user?.id} onOpen={() => d.state && setActive(d)}
                      right={<span className={`text-xs font-black ${d.winnerId === user?.id ? "text-emerald-400" : d.winnerId ? "text-slate-500" : "text-slate-600"}`}>
                        {d.winnerId === user?.id ? "Won" : d.winnerId ? "Lost" : d.status.toLowerCase()}
                      </span>} />
                  ))}
                </Section>
              )}

              {duels.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
                  <Swords className="h-10 w-10 text-slate-600" />
                  <p className="text-lg font-bold text-slate-300">No duels yet.</p>
                  <p className="max-w-sm text-sm text-slate-500">Challenge someone and put your points where your collection is.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editDeck && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] flex items-center justify-center bg-black/90 p-3 backdrop-blur sm:p-4"
            onClick={() => setEditDeck(false)}>
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }}
              className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-3xl border border-white/15 bg-[#0b0b12] p-4 sm:p-6"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black sm:text-xl">Your deck</h2>
                  <p className="text-xs text-slate-500">Saved as you tap — every duel starts from this five.</p>
                </div>
                <button onClick={() => setEditDeck(false)} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button>
              </div>
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                <DeckBuilder myCards={myCards} foils={foils} asleep={asleep} stats={cardStats} statsById={cardStatsById} rolls={cardRolls} levels={cardLevels} forges={cardForges} skillLvls={cardSkillLvls} skillCaps={skillCaps} deck={deck}
                  onChange={(d) => { setDeck(d); saveDeck(d); }} />
              </div>
              <button onClick={() => setEditDeck(false)}
                className="mt-4 w-full shrink-0 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white">
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
        {showChallenge && (
          <ChallengeModal myCards={myCards} meId={user?.id} foils={foils} asleep={asleep} cardStats={cardStats} cardStatsById={cardStatsById} cardRolls={cardRolls} levels={cardLevels} forges={cardForges} skillLvls={cardSkillLvls} skillCaps={skillCaps}
            onClose={() => { setShowChallenge(false); setDeck(loadSavedDeck()); }}
            onSend={(opp, stake, deck) => post("", { opponentUsername: opp, stake, deck }, (d) => {
              setShowChallenge(false);
              // Straight into the waiting room — the response IS the duel row,
              // and the poll takes over from there. Staying is optional: closing
              // it leaves the challenge in the list below.
              setActive(d);
              toast("Challenge sent!", "success");
            }, "background")}
            busy={busy} />
        )}
        {active && (
          <DuelBoard duel={active} me={user?.id} byId={byId} myCards={myCards} bag={bag} busy={busy} foils={foils} cardStats={cardStats} cardStatsById={cardStatsById} cardRolls={cardRolls} abilityIds={abilityIds} abilities={abilities} asleep={asleep} levels={cardLevels} forges={cardForges} skillLvls={cardSkillLvls} skillCaps={skillCaps}
            onClose={() => { setActive(null); setDeck(loadSavedDeck()); }}
            onAccept={(deck) => post(`${active.id}/accept`, { deck }, (d) => { setActive(d); toast("Duel started!", "success"); }, "background")}
            onMove={(action: string, index?: number, cardId?: string, target?: number) =>
              post(`${active.id}/move`, { action, index, cardId, target }, (d) => {
                // The response carries the whole updated duel — showing it IS
                // the refresh. A finished duel moved AP around, so that one
                // refetches the page, but without holding the board for it.
                setActive(d);
                if (d?.status === "FINISHED") void load();
              }, "none")}
            onCancel={() => post(`${active.id}/decline`, {}, () => {
              setActive(null);
              toast("Challenge withdrawn — your stake is back.", "success");
            })}
            onForfeit={() => post(`${active.id}/forfeit`, {}, (d) => {
              if (d?.id) setActive(d);
              toast("You forfeited. The stake and the fine went to your opponent.", "error");
            }, "background")} />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div>
      <div className="mb-2.5 flex items-stretch gap-2.5">
        <span aria-hidden className="w-[5px] shrink-0"
          style={{ background: "linear-gradient(#ffb4c4, #f43f5e)", transform: "skewX(-14deg)" }} />
        <h3 className="text-[11px] font-black uppercase tracking-[0.26em] text-slate-300">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DuelRow({ duel, me, right, onOpen }: { duel: Duel; me?: string; right: any; onOpen: () => void }) {
  // Only name an opponent once we know who is looking. Without the `!!me`
  // guard an unresolved viewer fell through to the challenger's name — so the
  // challenger saw THEIR OWN name listed as the opponent.
  const inDuel = !!me && (duel.challengerId === me || duel.opponentId === me);
  const label = inDuel
    ? `vs ${duel.challengerId === me ? duel.opponentName : duel.challengerName}`
    : `${duel.challengerName} vs ${duel.opponentName}`;
  return (
    <div onClick={onOpen}
      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 transition hover:translate-x-0.5"
      style={{ clipPath: notch(13), background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
      <div className="min-w-0">
        <div className="truncate font-bold">{label}</div>
        <div className="text-xs text-slate-500">{duel.stake.toLocaleString()} AP staked</div>
      </div>
      {right}
    </div>
  );
}

function ChallengeModal({ myCards, onClose, onSend, busy, meId, foils, cardStats, cardStatsById, cardRolls = {}, asleep = {}, levels = {}, forges = {}, skillLvls = {}, skillCaps = {} }: any) {
  const [opp, setOpp] = useState("");
  const [stake, setStake] = useState("100");
  const stakeNum = Math.floor(Number(stake)) || 0;
  const stakeError =
    !stake.trim() ? "Enter a stake."
    : !Number.isFinite(Number(stake)) ? "That isn't a number."
    : stakeNum < MIN_STAKE ? `Minimum stake is ${MIN_STAKE} AP.`
    : stakeNum > MAX_STAKE ? `Maximum stake is ${MAX_STAKE.toLocaleString()} AP.`
    : null;
  const [deck, setDeck] = useState<string[]>(() => loadSavedDeck());
  // Real people, not a name you have to spell from memory. The old free-text
  // field gave no signal whether "davinci" was even an account until the
  // request came back 404.
  const [people, setPeople] = useState<{ id: string; username: string; avatar?: string | null }[]>([]);
  const [picked, setPicked] = useState<{ id: string; username: string } | null>(null);
  // The member list only opens on focus — see the note beside it.
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.data) return;
        setPeople(
          d.data
            .filter((u: any) => u.id !== meId)
            .map((u: any) => ({ id: u.id, username: u.username, avatar: u.avatar }))
            .sort((a: any, b: any) => a.username.localeCompare(b.username))
        );
      })
      .catch(() => {});
  }, [meId]);

  const q = opp.trim().toLowerCase();
  const matches = q
    ? people.filter((p) => p.username.toLowerCase().includes(q)).slice(0, 6)
    : people.slice(0, 6);

  return (
    // Full screen: the deck grid + opponent search never fitted a phone modal,
    // and on desktop the card art deserves the room.
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex flex-col bg-[#08080e]" style={{ height: "100dvh" }}>
      {/* max-w-6xl, not 3xl: the old column was so narrow the card art stayed
          thumbnail-sized even on a laptop, which is the whole reason to go
          full screen in the first place. */}
      {/* Fills the window. max-w-6xl left a dead margin down both sides and
          squeezed the collection grid into fewer columns than the screen had
          room for, so the sheet looked boxed on a wide display while its own
          content was still cut off at the bottom. */}
      <div className="flex h-full w-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-xl font-black">Send a challenge</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5">
            <X className="h-4 w-4 text-slate-300" />
          </button>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="text-xs font-bold text-slate-400">Opponent
            {picked ? (
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-purple-600 text-[10px] font-black">
                  {people.find((p) => p.id === picked.id)?.avatar
                    ? <img src={people.find((p) => p.id === picked.id)!.avatar!} alt="" className="h-full w-full object-cover" />
                    : picked.username[0]?.toUpperCase()}
                </span>
                <span className="flex-1 truncate text-sm font-black text-white">{picked.username}</span>
                <button onClick={() => { setPicked(null); setOpp(""); }} className="text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="relative mt-1">
                <input value={opp} onChange={(e) => setOpp(e.target.value)} placeholder="Search a member…"
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
                {/* Only while the field is focused or you have typed. It used
                    to render unconditionally, so the member list sat open over
                    the deck the moment the sheet appeared, covering the cards
                    you came here to choose. The blur is delayed because a
                    click on a result blurs the input before the click lands. */}
                {(searchOpen || q) && (
                <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-white/15 bg-[#12121a] shadow-xl">
                  {matches.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-500">No member by that name.</p>
                  ) : matches.map((p) => (
                    <button key={p.id} onClick={() => { setPicked(p); setOpp(p.username); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/10">
                      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-purple-600 text-[10px] font-black">
                        {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.username[0]?.toUpperCase()}
                      </span>
                      <span className="truncate text-sm font-bold text-white">{p.username}</span>
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}
          </div>
          {/* The server enforces 50–5000. Surfacing the range here turns a
              rejected challenge into a bound you can see before you send it. */}
          <label className="text-xs font-bold text-slate-400">
            Stake (AP, each side) <span className="text-slate-600">· {MIN_STAKE}–{MAX_STAKE.toLocaleString()}</span>
            <input type="number" min={MIN_STAKE} max={MAX_STAKE} step={10}
              value={stake} onChange={(e) => setStake(e.target.value)}
              className={`mt-1 w-full rounded-lg border bg-white/5 px-3 py-2 text-sm tabular-nums text-white ${
                stakeError ? "border-rose-500/60" : "border-white/10"}`} />
            {stakeError && <span className="mt-1 block font-bold text-rose-400">{stakeError}</span>}
          </label>
        </div>
        {/* the deck grid scrolls; the header and the action button stay put */}
        <div className="mb-4 min-h-0 flex-1 overflow-y-auto">
          <DeckBuilder myCards={myCards} foils={foils} asleep={asleep} stats={cardStats} statsById={cardStatsById} rolls={cardRolls} levels={levels} forges={forges} skillLvls={skillLvls} skillCaps={skillCaps} deck={deck}
            onChange={(d) => { setDeck(d); saveDeck(d); }} />
        </div>
        {/* Requires a PICKED member, not just typed text — so a challenge can
            never 404 on a username that was only ever a guess. */}
        <button disabled={busy || !picked || deck.length !== DECK_SIZE || !!stakeError}
          style={{ flexShrink: 0 }}
          onClick={() => picked && !stakeError && onSend(picked.username, stakeNum, deck)}
          className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white transition hover:brightness-110 disabled:opacity-40">
          {busy ? "Sending…"
            : !picked ? "Pick an opponent"
            : deck.length !== DECK_SIZE ? `Pick ${DECK_SIZE - deck.length} more card${DECK_SIZE - deck.length === 1 ? "" : "s"}`
            : stakeError ? stakeError
            : `Challenge ${picked.username} for ${stakeNum.toLocaleString()} AP`}
        </button>
      </div>
    </motion.div>
  );
}

function DuelBoard({ duel, me, byId, myCards, bag, busy, onClose, onAccept, onMove, onForfeit, onCancel, foils, cardStats, cardStatsById, cardRolls = {}, abilityIds, abilities, asleep = {}, levels = {}, forges = {}, skillLvls = {}, skillCaps = {} }: any) {
  const [deck, setDeck] = useState<string[]>(() => loadSavedDeck());
  // Filtered ONCE per collection, not once per render. Arena memoizes its
  // playable supports off this array, so handing it a fresh one every render
  // made that memo recompute every time — the exact thing it exists to avoid.
  // Grounds ride this tray alongside supports. They are a different card class
  // with different accounting on the server — laid once, not counted against
  // the three-support limit, scoped to their own set — but both are "cards you
  // play rather than field", and this list is what makes them reachable at all.
  // Filtering to `c.support` alone was why A Fitting End could be owned and
  // never laid: the server accepted it, the tray never offered it.
  const supportCards = useMemo(
    () => (myCards || []).filter((c: any) => !!c.support || !!c.ground),
    [myCards]
  );
  // Parsed once per state STRING, not once per render. DuelBoard re-renders
  // whenever anything on the page moves (busy, bag, a toast), and re-parsing
  // built a brand-new fighters tree every time — which also handed Arena new
  // object identities and defeated CardFace's memo further down.
  const state: DuelState | null = useMemo(
    () => (duel.state ? JSON.parse(duel.state) : null),
    [duel.state]
  );
  const needsAccept = duel.status === "PENDING" && duel.opponentId === me;
  const myTurn = duel.status === "ACTIVE" && duel.turnUserId === me;

  // Work out which side is which from the DUEL ROW, which always carries both
  // names, and only after we actually know who is looking. `me` is undefined on
  // the first render (useUser hydrates from localStorage in an effect), and the
  // old `state.a.userId === me` test silently fell through to side B in that
  // window — which swapped the two players' names on the board.
  const iAmChallenger = !!me && duel.challengerId === me;
  const inDuel = !!me && (iAmChallenger || duel.opponentId === me);
  const mine = state ? (iAmChallenger ? state.a : state.b) : null;
  const foe = state ? (iAmChallenger ? state.b : state.a) : null;
  // Labels come from the duel row rather than the serialized state snapshot.
  const foeName = inDuel ? (iAmChallenger ? duel.opponentName : duel.challengerName) : duel.challengerName;
  const myName = inDuel ? "You" : duel.opponentName;

  // A LIVE duel takes the whole screen. Arena is `fixed inset-0` with a dvh
  // height, so it survives mobile browser chrome and the cards stay readable
  // on a phone — which they were not inside a modal.
  if (state && mine && foe && !needsAccept) {
    const resultText = !inDuel
      ? `${duel.winnerId === duel.challengerId ? duel.challengerName : duel.opponentName} won`
      : duel.winnerId === me
      ? `You won ${duelPayout(duel.stake).toLocaleString()} AP`
      : "You lost this duel";
    return (
      <Arena
        mine={mine} foe={foe} byId={byId}
        myName={myName} foeName={foeName}
        myTurn={myTurn} finished={duel.status === "FINISHED"} resultText={resultText}
        won={!!me && duel.winnerId === me}
        bag={bag} busy={busy} log={state.log} stake={duel.stake} round={state.round}
        supports={supportCards}
        usedSupports={mine.usedSupports || []}
        usedGrounds={mine.usedGrounds || []}
        onAttack={() => onMove("attack")}
        onDeploy={(i: number) => onMove("deploy", i)}
        onItem={(item: string) => onMove(item)}
        onSupport={(cardId: string, target?: number) => onMove("support", undefined, cardId, target)}
        onAbility={() => onMove("ability")}
        abilityIds={abilityIds}
        abilities={abilities}
        onForfeit={onForfeit}
        onClose={onClose}
      />
    );
  }

  return (
    // A CENTRED child taller than the viewport cannot be scrolled back to — the
    // overflow container clips its top and there is no way to reach it. With a
    // five-slot deck builder plus a full collection grid this is now always the
    // case, which is why the player being challenged could only see part of the
    // panel. Fixed height, header and action pinned, and ONLY the deck area
    // scrolls.
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-3 backdrop-blur sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-3xl border border-white/15 bg-[#0b0b12] p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black sm:text-xl">{duel.challengerName} vs {duel.opponentName}</h2>
            <p className="text-xs text-slate-500">{duel.stake.toLocaleString()} AP each · winner takes {duelPayout(duel.stake).toLocaleString()} (10% burned)</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        {needsAccept ? (
          <>
            <div className="-mx-1 mb-4 min-h-0 flex-1 overflow-y-auto px-1">
              <DeckBuilder myCards={myCards} foils={foils} asleep={asleep} stats={cardStats} statsById={cardStatsById} rolls={cardRolls} levels={levels} forges={forges} skillLvls={skillLvls} skillCaps={skillCaps} deck={deck}
                onChange={(d) => { setDeck(d); saveDeck(d); }} compact />
            </div>
            <button disabled={busy || deck.length !== DECK_SIZE} onClick={() => onAccept(deck)}
              className="w-full shrink-0 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white disabled:opacity-40">
              {deck.length !== DECK_SIZE
                ? `Pick ${DECK_SIZE - deck.length} more card${DECK_SIZE - deck.length === 1 ? "" : "s"}`
                : `Match the ${duel.stake.toLocaleString()} AP stake and fight`}
            </button>
          </>
        ) : (
          /* ── THE WAITING ROOM ── this used to be one grey sentence. The poll
             is already watching the duel, so the moment the opponent accepts,
             this same panel BECOMES the arena — staying here means walking
             straight into the fight. Leaving is fine too: the challenge keeps
             living in the list below, and the room reopens from there. */
          <div className="flex flex-col items-center py-8">
            <div className="flex items-center gap-6 sm:gap-10">
              {/* the challenger — you */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {/* pulse rings say "alive and looking", not frozen */}
                  {[0, 1].map((i) => (
                    <motion.span key={i} aria-hidden
                      className="absolute inset-0 rounded-full border-2 border-rose-400/50"
                      animate={{ scale: [1, 1.75], opacity: [0.6, 0] }}
                      transition={{ duration: 1.8, delay: i * 0.9, repeat: Infinity, ease: "easeOut" }} />
                  ))}
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-500/25 text-xl font-black text-rose-100 ring-2 ring-rose-400/50">
                    {duel.challengerName?.[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="max-w-[7rem] truncate text-xs font-black text-rose-200">{duel.challengerName}</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">Ready</span>
              </div>

              <span className="text-2xl font-black tracking-widest text-white/25">VS</span>

              {/* the opponent — the one everyone is waiting on */}
              <div className="flex flex-col items-center gap-2">
                <motion.span
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="grid h-16 w-16 place-items-center rounded-full bg-sky-500/15 text-xl font-black text-sky-200/80 ring-2 ring-dashed ring-sky-400/40">
                  {duel.opponentName?.[0]?.toUpperCase()}
                </motion.span>
                <span className="max-w-[7rem] truncate text-xs font-black text-sky-200">{duel.opponentName}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Deciding
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} animate={{ opacity: [0.15, 1, 0.15] }}
                      transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}>.</motion.span>
                  ))}
                </span>
              </div>
            </div>

            <p className="mt-6 max-w-sm text-center text-sm leading-relaxed text-slate-400">
              <span className="font-black text-slate-200">{duel.opponentName}</span> has been challenged for{" "}
              <span className="font-black text-amber-300">{duel.stake.toLocaleString()} AP</span>.
              The fight opens here by itself the second they accept — stay if you like,
              or close this and it&apos;ll wait in your duels list.
            </p>

            {me && duel.challengerId === me && onCancel && (
              <button onClick={onCancel} disabled={busy}
                className="mt-5 rounded-full border border-white/15 px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-40">
                Withdraw the challenge
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * HEALTH OVER TIME — both lines' totals across the whole fight.
 *
 * Drawn from state.timeline, which the SERVER appends per resolved action —
 * never parsed out of the log (capped at 60 lines, it would invent the
 * opening of any long fight). Each side is normalised to its OWN starting
 * total, so the two series share one % axis no matter how the decks differ.
 *
 * Colours are the app's standing identities — you are rose, they are blue —
 * snapped to steps that pass the full palette validation on this surface
 * (lightness band, chroma, CVD ΔE 16+/22+, contrast 4.8+). Identity is never
 * colour-alone: both lines carry a direct label and a legend.
 */
function HealthGraph({ timeline, mineIsA, foeName, height = 130 }: {
  timeline: { a: number; b: number }[]; mineIsA: boolean; foeName: string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  if (!timeline || timeline.length < 2) return null;

  const W = 560, H = height, PL = 8, PR = 46, PT = 10, PB = 8;
  const mine = timeline.map((t) => (mineIsA ? t.a : t.b));
  const foe = timeline.map((t) => (mineIsA ? t.b : t.a));
  const m0 = Math.max(1, mine[0]), f0 = Math.max(1, foe[0]);
  const YOU = "#f43f5e", FOE = "#0284c7";

  const px = (i: number) => PL + (i / (timeline.length - 1)) * (W - PL - PR);
  const py = (v: number, base: number) => PT + (1 - Math.max(0, Math.min(1, v / base))) * (H - PT - PB);
  const path = (arr: number[], base: number) =>
    arr.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v, base).toFixed(1)}`).join(" ");
  const area = (arr: number[], base: number) =>
    `${path(arr, base)} L${px(arr.length - 1).toFixed(1)},${H - PB} L${px(0).toFixed(1)},${H - PB} Z`;

  // Direct labels at the line ends — nudged apart if the endings collide.
  let yMineEnd = py(mine[mine.length - 1], m0);
  let yFoeEnd = py(foe[foe.length - 1], f0);
  if (Math.abs(yMineEnd - yFoeEnd) < 12) {
    if (yMineEnd <= yFoeEnd) { yMineEnd -= 6; yFoeEnd += 6; } else { yMineEnd += 6; yFoeEnd -= 6; }
  }

  const onMove = (e: React.PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const frac = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    setHover(Math.round(frac * (timeline.length - 1)));
  };
  const hi = hover;

  return (
    <div className="mt-3">
      {/* legend — two series, so it is always present; text stays in ink */}
      <div className="mb-1 flex items-center gap-4 text-[10px] font-bold text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: YOU }} />You</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: FOE }} />{foeName}</span>
        <span className="ml-auto text-slate-600">% of line health · per move</span>
      </div>
      <div ref={boxRef} className="relative select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height }}>
          {/* recessive grid — quarters of the shared % axis */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={PL} x2={W - PR} y1={PT + (1 - g) * (H - PT - PB)} y2={PT + (1 - g) * (H - PT - PB)}
              stroke="rgba(255,255,255,.07)" strokeWidth="1" />
          ))}
          <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="rgba(255,255,255,.14)" strokeWidth="1" />

          <path d={area(foe, f0)} fill={FOE} opacity="0.08" />
          <path d={area(mine, m0)} fill={YOU} opacity="0.08" />
          <path d={path(foe, f0)} fill="none" stroke={FOE} strokeWidth="2" strokeLinejoin="round" />
          <path d={path(mine, m0)} fill="none" stroke={YOU} strokeWidth="2" strokeLinejoin="round" />

          {/* direct labels — identity without reading the legend */}
          <text x={W - PR + 5} y={yMineEnd + 3} fontSize="10" fontWeight="700" fill="#94a3b8">You</text>
          <text x={W - PR + 5} y={yFoeEnd + 3} fontSize="10" fontWeight="700" fill="#94a3b8">
            {foeName.length > 6 ? `${foeName.slice(0, 6)}…` : foeName}
          </text>

          {/* hover: crosshair + 8px markers */}
          {hi !== null && (
            <g>
              <line x1={px(hi)} x2={px(hi)} y1={PT} y2={H - PB} stroke="rgba(255,255,255,.22)" strokeWidth="1" />
              <circle cx={px(hi)} cy={py(mine[hi], m0)} r="4" fill={YOU} stroke="#0a0a11" strokeWidth="2" />
              <circle cx={px(hi)} cy={py(foe[hi], f0)} r="4" fill={FOE} stroke="#0a0a11" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hi !== null && (
          <div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-black/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-300"
            style={{ left: `${Math.min(78, Math.max(2, (hi / (timeline.length - 1)) * 100))}%` }}>
            Move {hi} · <span style={{ color: "#fda4af" }}>{Math.round((mine[hi] / m0) * 100)}%</span>
            {" · "}<span style={{ color: "#7dd3fc" }}>{Math.round((foe[hi] / f0) * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sum of drops, rises and the single biggest drop along one health series. */
function swings(arr: number[]) {
  let lost = 0, healed = 0, biggest = 0;
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    if (d < 0) { lost += -d; biggest = Math.max(biggest, -d); }
    else healed += d;
  }
  return { lost, healed, biggest };
}

/**
 * LAST DUEL — what actually happened, read off the final state.
 *
 * Everything here is DERIVED from state the duel already carries: who was
 * left standing, what health they finished on, how many rounds it ran — and,
 * for duels fought since the server began recording it, the health timeline,
 * which is what makes honest damage figures and a graph possible at all.
 */
function LastDuelStats({ duel, me, byId }: { duel: Duel; me?: string; byId: Record<string, CardDef> }) {
  const [replaying, setReplaying] = useState(false);
  const state: DuelState | null = useMemo(() => {
    try { return duel.state ? JSON.parse(duel.state) : null; } catch { return null; }
  }, [duel.state]);
  if (!state) return null;

  const iAmChallenger = duel.challengerId === me;
  const mine = iAmChallenger ? state.a : state.b;
  const theirs = iAmChallenger ? state.b : state.a;
  const won = duel.winnerId === me;
  const foeName = iAmChallenger ? duel.opponentName : duel.challengerName;

  const standing = (s: Side) => s.fighters.filter((f) => f.hp > 0).length;
  const hpLeft = (s: Side) => s.fighters.reduce((n, f) => n + Math.max(0, f.hp), 0);
  const hpMax = (s: Side) => s.fighters.reduce((n, f) => n + f.maxHp, 0);

  // Whoever ended with the largest share of their own health still intact.
  // Share, not raw HP, so a common that survived untouched can out-rank a
  // legendary that limped home — which is the honest reading of "best".
  const best = [...mine.fighters]
    .filter((f) => f.hp > 0)
    .sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)[0];

  const pct = (s: Side) => Math.round((hpLeft(s) / Math.max(1, hpMax(s))) * 100);

  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">Last duel</p>
      <div
        className="relative overflow-hidden p-4"
        style={{
          clipPath: notch(14),
          background: won ? "rgba(16,185,129,.07)" : "rgba(244,63,94,.06)",
          boxShadow: `inset 0 0 0 1px ${won ? "rgba(52,211,153,.32)" : "rgba(244,63,94,.28)"}`,
        }}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className={`text-xl font-black ${won ? "text-emerald-300" : "text-rose-300"}`}>
            {won ? "Victory" : "Defeat"}
          </span>
          <span className="text-xs font-bold text-slate-400">
            vs {foeName} · <span className="tabular-nums">{state.round}</span> rounds
          </span>
        </div>

        {/* Three tiles still fit 375px — they just need to stop shouting.
            The label sizes drop below sm so "Your line" doesn't wrap to two
            lines inside a 105px tile. */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Stat label={won ? "Won" : "Lost"} value={`${won ? "+" : "−"}${(won ? duelPayout(duel.stake) : duel.stake).toLocaleString()}`}
            tint={won ? "#6ee7b7" : "#fda4af"} />
          <Stat label="Your line" value={`${standing(mine)}/${mine.fighters.length}`} tint="#7dd3fc" />
          <Stat label="Theirs" value={`${standing(theirs)}/${theirs.fighters.length}`} tint="#fbbf24" />
        </div>

        <div className="mt-3 space-y-2">
          <HpRow label="You" pct={pct(mine)} tint="#34d399" />
          <HpRow label={foeName} pct={pct(theirs)} tint="#f43f5e" />
        </div>

        {/* ── THE FIGHT, AS A LINE ── plus the figures the timeline makes
            honest: every number below is a sum over recorded health changes,
            not a guess parsed out of the log. */}
        {(state.timeline?.length ?? 0) >= 2 ? (() => {
          const tl = state.timeline!;
          const mineSeries = tl.map((t) => (iAmChallenger ? t.a : t.b));
          const foeSeries = tl.map((t) => (iAmChallenger ? t.b : t.a));
          const dealt = swings(foeSeries), taken = swings(mineSeries);
          const biggestMine = dealt.biggest, biggestTheirs = taken.biggest;
          return (
            <>
              <HealthGraph timeline={tl} mineIsA={iAmChallenger} foeName={foeName} />
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:gap-2">
                <Stat label="Dealt" value={dealt.lost.toLocaleString()} tint="#fda4af" />
                <Stat label="Taken" value={taken.lost.toLocaleString()} tint="#7dd3fc" />
                <Stat label="Healed" value={taken.healed.toLocaleString()} tint="#6ee7b7" />
                <Stat label="Big hit" value={`${Math.max(biggestMine, biggestTheirs)}${biggestMine >= biggestTheirs ? "" : " (them)"}`} tint="#fbbf24" />
              </div>
            </>
          );
        })() : (
          <p className="mt-3 text-[10px] text-slate-600">
            Health graphs record from your next fight — this one predates them.
          </p>
        )}

        {best && (
          <p className="mt-3 border-t border-white/10 pt-2 text-[11px] text-slate-400">
            Last one standing strongest:{" "}
            <b className="text-white">{byId[best.cardId]?.name || best.name}</b>{" "}
            <span className="tabular-nums text-slate-500">
              {best.hp}/{best.maxHp} HP
            </span>
          </p>
        )}

        {state.log?.length > 0 && (
          <button
            onClick={() => setReplaying(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-110"
            style={{ clipPath: notch(9), background: "linear-gradient(100deg, #7c3aed, #a855f7)" }}
          >
            <Swords className="h-3.5 w-3.5" /> Watch replay
          </button>
        )}
      </div>

      <AnimatePresence>
        {replaying && (
          <ReplayModal log={state.log} won={won} foeName={foeName}
            timeline={state.timeline} mineIsA={iAmChallenger}
            onClose={() => setReplaying(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * REPLAY — the fight, played back beat by beat.
 *
 * Built on the battle log because that is genuinely all there is: the server
 * stores the FINAL state of a duel, not a snapshot per turn, so the board
 * cannot be rewound. The log, though, is complete and ordered — every deploy,
 * strike, ability and death in the sequence they happened.
 *
 * So this replays what was SAID rather than redrawing what was shown, which is
 * an honest recap rather than a reconstruction that would have to invent the
 * health totals between each line.
 */
function ReplayModal({
  log, won, foeName, onClose, timeline, mineIsA = true,
}: {
  log: string[]; won: boolean; foeName: string; onClose: () => void;
  timeline?: { a: number; b: number }[]; mineIsA?: boolean;
}) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const endRef = useRef<HTMLDivElement | null>(null);
  // The replay scrolls its own log; the page behind it stays put.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // What KIND of line this is, so the log reads as beats rather than one
  // grey column: domains loudest, falls in rose, supports/items in cyan.
  const lineClass = (l: string, newest: boolean) =>
    l.startsWith("▲") ? "font-black text-fuchsia-300"
      : / fell\.$/.test(l) || /has fallen/.test(l) ? "font-bold text-rose-300"
      : /Salve|Ward|focus|support|played|stood back up|recovered/i.test(l) ? "text-cyan-300/90"
      : newest ? "font-bold text-white" : "text-slate-500";

  useEffect(() => {
    if (!playing || at >= log.length) return;
    const t = setTimeout(() => setAt((n) => n + 1), 900 / speed);
    return () => clearTimeout(t);
  }, [playing, at, log.length, speed]);

  // Follow the newest line as it lands, so a long fight doesn't scroll away.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [at]);

  const done = at >= log.length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-2 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-2xl border border-white/12 bg-[#0a0a11] sm:max-h-[86dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Replay</p>
            <p className="truncate text-sm font-black text-white">vs {foeName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* the whole fight as a line, above the beats it narrates */}
        {(timeline?.length ?? 0) >= 2 && (
          <div className="border-b border-white/10 px-4 pb-2">
            <HealthGraph timeline={timeline!} mineIsA={mineIsA} foeName={foeName} height={92} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {log.slice(0, at).map((l, i) => {
            const newest = i === at - 1;
            return (
              <motion.div
                key={`${i}-${l}`}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={`py-1 text-[12px] leading-snug ${lineClass(l, newest)}`}
              >
                {l}
              </motion.div>
            );
          })}
          {done && (
            <motion.p
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              className={`mt-3 border-t border-white/10 pt-3 text-center text-lg font-black ${won ? "text-emerald-300" : "text-rose-300"}`}
            >
              {won ? "Victory" : "Defeat"}
            </motion.p>
          )}
          <div ref={endRef} />
        </div>

        {/* SCRUB ANYWHERE. Watching a 50-line fight from the top to reach one
            moment was the replay's biggest ask; dragging pauses playback so
            the scrubber never fights the timer. */}
        <div className="border-t border-white/10 px-4 pt-3">
          <input
            type="range" min={0} max={log.length} step={1} value={Math.min(at, log.length)}
            onChange={(e) => { setAt(Number(e.target.value)); setPlaying(false); }}
            className="w-full accent-fuchsia-500"
            aria-label="Scrub through the replay"
          />
        </div>

        {/* wrap, not overflow: a play button plus three speed chips plus the
            counter does not fit 375px on one line, and the counter was the
            piece that got pushed off the edge. */}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1 sm:px-4">
          <button
            onClick={() => (done ? (setAt(0), setPlaying(true)) : setPlaying((p) => !p))}
            className="min-w-[7rem] flex-1 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-110"
            style={{ clipPath: notch(9), background: "linear-gradient(100deg, #7c3aed, #a855f7)" }}
          >
            {done ? "Watch again" : playing ? "Pause" : "Play"}
          </button>
          {([1, 2, 4] as const).map((x) => (
            <button
              key={x}
              onClick={() => setSpeed(x)}
              className={`px-3 py-2.5 text-[11px] font-black tabular-nums transition ${
                speed === x ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              style={{ clipPath: notch(8), background: speed === x ? "rgba(162,116,255,.22)" : "rgba(255,255,255,.05)" }}
            >
              {x}×
            </button>
          ))}
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-600">
            {Math.min(at, log.length)}/{log.length}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="bg-black/30 px-1.5 py-2 text-center sm:px-2" style={{ clipPath: notch(8) }}>
      <div className="text-sm font-black tabular-nums sm:text-base" style={{ color: tint }}>{value}</div>
      {/* Tracking is dropped on phones: 0.16em on a 9px label inside a ~105px
          tile is what pushed "Your line" onto a second row. */}
      <div className="mt-0.5 truncate text-[9px] font-black uppercase tracking-normal text-slate-500 sm:tracking-[0.16em]">
        {label}
      </div>
    </div>
  );
}

function HpRow({ label, pct, tint }: { label: string; pct: number; tint: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[10px] font-bold">
        <span className="truncate text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-500">{pct}% health left</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-black/60" style={{ clipPath: "polygon(2px 0,100% 0,calc(100% - 2px) 100%,0 100%)" }}>
        <div className="h-full" style={{ width: `${pct}%`, background: tint }} />
      </div>
    </div>
  );
}
