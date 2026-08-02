"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Trophy, Shield, Heart, Crosshair, Diamond, Gem, X, Flame } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { displayArisePoints } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { CardDef } from "@/components/cards/CardFace";
import DeckBuilder, { loadSavedDeck, saveDeck } from "@/components/cards/DeckBuilder";
import Arena, { duelPayout } from "@/components/cards/Arena";
import { notch, ACCENT } from "@/components/cards/gacha";

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
};
type DuelState = { a: Side; b: Side; turn: string; log: string[]; round: number };
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
  // Which cards have a skill or a domain, so the arena only offers the button
  // on cards that actually have one.
  const [abilityIds, setAbilityIds] = useState<Set<string>>(new Set());
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [shards, setShards] = useState(0);
  const [bag, setBag] = useState<string[]>([]);
  const [active, setActive] = useState<Duel | null>(null);
  const [busy, setBusy] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
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
        for (const x of c.data?.cards || []) { m[x.cardId] = x.count; if (x.foil) fo[x.cardId] = true; }
        setOwned((p) => keep(p, m));
        setFoils((p) => keep(p, fo));
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
    let cancelled = false;
    const getCatalog = () => {
      fetch(`${API_URL}/api/cards/catalog`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (!d?.success || !Array.isArray(d?.data?.cards)) throw new Error("bad catalog");
          setCatalog(d.data.cards);
          setAbilityIds(new Set([...Object.keys(d.data.skills || {}), ...Object.keys(d.data.domains || {})]));
          setCardStats(d.data.cardStats);
          setCatalogFailed(false);
        })
        .catch(() => { if (!cancelled) setCatalogFailed(true); });
    };
    getCatalog();
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
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [active?.id, active?.status, load]);

  const post = async (path: string, body: any, ok?: (d: any) => void) => {
    if (!user) return toast("Sign in first.", "error");
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/duels/${path}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id, ...body }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) { toast(d.message || "That didn't work.", "error"); return; }
      ok?.(d.data);
      await load();
    } catch { toast("That didn't work.", "error"); } finally { setBusy(false); }
  };

  const byId = Object.fromEntries(catalog.map((c) => [c.id, c]));
  const myCards = catalog.filter((c) => (owned[c.id] || 0) > 0);
  const pending = duels.filter((d) => d.status === "PENDING");
  const running = duels.filter((d) => d.status === "ACTIVE");
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
              {/* item shop */}
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
                    <Gem className="h-3.5 w-3.5" />{shards.toLocaleString()}
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
                        className={`rounded-full px-4 py-1.5 text-xs font-black ${d.turnUserId === user?.id ? "bg-gradient-to-r from-rose-600 to-orange-600 text-white" : "border border-white/15 text-slate-400"}`}>
                        {d.turnUserId === user?.id ? "Your turn" : "Waiting"}
                      </button>} />
                  ))}
                </Section>
              )}

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
        {showChallenge && (
          <ChallengeModal myCards={myCards} meId={user?.id} foils={foils} cardStats={cardStats} onClose={() => setShowChallenge(false)}
            onSend={(opp, stake, deck) => post("", { opponentUsername: opp, stake, deck }, () => { setShowChallenge(false); toast("Challenge sent!", "success"); })}
            busy={busy} />
        )}
        {active && (
          <DuelBoard duel={active} me={user?.id} byId={byId} myCards={myCards} bag={bag} busy={busy} foils={foils} cardStats={cardStats} abilityIds={abilityIds}
           
            onClose={() => setActive(null)}
            onAccept={(deck) => post(`${active.id}/accept`, { deck }, () => toast("Duel started!", "success"))}
            onMove={(action: string, index?: number, cardId?: string, target?: number) =>
              post(`${active.id}/move`, { action, index, cardId, target })}
            onForfeit={() => post(`${active.id}/forfeit`, {}, () =>
              toast("You forfeited. The stake and the fine went to your opponent.", "error"))} />
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

function ChallengeModal({ myCards, onClose, onSend, busy, meId, foils, cardStats }: any) {
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
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
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
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
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
          <DeckBuilder myCards={myCards} foils={foils} stats={cardStats} deck={deck}
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

function DuelBoard({ duel, me, byId, myCards, bag, busy, onClose, onAccept, onMove, onForfeit, foils, cardStats, abilityIds }: any) {
  const [deck, setDeck] = useState<string[]>(() => loadSavedDeck());
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
        supports={myCards.filter((c: any) => !!c.support)}
        usedSupports={mine.usedSupports || []}
        onAttack={() => onMove("attack")}
        onDeploy={(i: number) => onMove("deploy", i)}
        onItem={(item: string) => onMove(item)}
        onSupport={(cardId: string, target?: number) => onMove("support", undefined, cardId, target)}
        onAbility={() => onMove("ability")}
        abilityIds={abilityIds}
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
              <DeckBuilder myCards={myCards} foils={foils} stats={cardStats} deck={deck}
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
          <p className="py-10 text-center text-sm text-slate-500">Waiting for the opponent to accept…</p>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * LAST DUEL — what actually happened, read off the final state.
 *
 * Everything here is DERIVED from the state the duel already carries: who was
 * left standing, what health they finished on, how many rounds it ran. Nothing
 * new is stored, and nothing is estimated — a "damage dealt" figure would have
 * to be reconstructed from the log, which is a display artefact, so it isn't
 * shown rather than shown wrong.
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

        <div className="grid grid-cols-3 gap-2">
          <Stat label={won ? "Won" : "Lost"} value={`${won ? "+" : "−"}${(won ? duelPayout(duel.stake) : duel.stake).toLocaleString()}`}
            tint={won ? "#6ee7b7" : "#fda4af"} />
          <Stat label="Your line" value={`${standing(mine)}/${mine.fighters.length}`} tint="#7dd3fc" />
          <Stat label="Theirs" value={`${standing(theirs)}/${theirs.fighters.length}`} tint="#fbbf24" />
        </div>

        <div className="mt-3 space-y-2">
          <HpRow label="You" pct={pct(mine)} tint="#34d399" />
          <HpRow label={foeName} pct={pct(theirs)} tint="#f43f5e" />
        </div>

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
          <ReplayModal log={state.log} won={won} foeName={foeName} onClose={() => setReplaying(false)} />
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
  log, won, foeName, onClose,
}: { log: string[]; won: boolean; foeName: string; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const endRef = useRef<HTMLDivElement | null>(null);

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
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="flex max-h-[86dvh] w-full max-w-lg flex-col rounded-2xl border border-white/12 bg-[#0a0a11]"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {log.slice(0, at).map((l, i) => {
            const isDomain = l.startsWith("▲");
            const newest = i === at - 1;
            return (
              <motion.div
                key={`${i}-${l}`}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={`py-1 text-[12px] leading-snug ${
                  isDomain ? "font-black text-fuchsia-300" : newest ? "font-bold text-white" : "text-slate-500"
                }`}
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

        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <button
            onClick={() => (done ? (setAt(0), setPlaying(true)) : setPlaying((p) => !p))}
            className="flex-1 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-110"
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
    <div className="bg-black/30 px-2 py-2 text-center" style={{ clipPath: notch(8) }}>
      <div className="text-base font-black tabular-nums" style={{ color: tint }}>{value}</div>
      <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
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
