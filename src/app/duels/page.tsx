"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Trophy, Shield, Heart, Crosshair, Diamond, Gem, X, Flame } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { displayArisePoints } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META } from "@/components/cards/CardFace";
import DeckBuilder, { loadSavedDeck, saveDeck } from "@/components/cards/DeckBuilder";
import Arena from "@/components/cards/Arena";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DECK_SIZE = 3;

const ITEM_META: Record<string, { name: string; desc: string; shards: number; Icon: any; tint: string }> = {
  heal:   { name: "Salve", desc: "Restore 10 HP", shards: 120, Icon: Heart, tint: "text-rose-300" },
  shield: { name: "Ward",  desc: "Halve next damage", shards: 150, Icon: Shield, tint: "text-sky-300" },
  focus:  { name: "Focus", desc: "+75% next attack", shards: 180, Icon: Crosshair, tint: "text-amber-300" },
};

type Fighter = { cardId: string; name: string; rarity: any; maxHp: number; hp: number; atk: number; foil: boolean };
type Side = { userId: string; username: string; fighters: Fighter[]; active: number };
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
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [shards, setShards] = useState(0);
  const [bag, setBag] = useState<string[]>([]);
  const [active, setActive] = useState<Duel | null>(null);
  const [busy, setBusy] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [tab, setTab] = useState<"duels" | "ladder">("duels");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [d, l, c] = await Promise.all([
        fetch(`${API_URL}/api/duels/mine/${user.id}`).then((r) => r.json()),
        fetch(`${API_URL}/api/duels/leaderboard`).then((r) => r.json()),
        fetch(`${API_URL}/api/cards/collection/${user.id}`).then((r) => r.json()),
      ]);
      if (d.success) { setDuels(d.data.duels || []); setRating(d.data.rating); }
      if (l.success) setBoard(l.data || []);
      if (c.success) {
        const m: Record<string, number> = {};
        const fo: Record<string, boolean> = {};
        for (const x of c.data?.cards || []) { m[x.cardId] = x.count; if (x.foil) fo[x.cardId] = true; }
        setOwned(m);
        setFoils(fo);
        setShards(c.data.shards || 0);
      }
      // Keep the open board fresh so the opponent's move appears.
      if (active) {
        const fresh = await fetch(`${API_URL}/api/duels/${active.id}`).then((r) => r.json());
        if (fresh.success) setActive(fresh.data);
      }
    } catch { /* offline */ }
  }, [user?.id, active?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${API_URL}/api/cards/catalog`).then((r) => r.json()).then((d) => { if (!d?.success || !Array.isArray(d?.data?.cards)) return; setCatalog(d.data.cards); setCardStats(d.data.cardStats); });
    fetch(`${API_URL}/api/users/${user?.id}`).then((r) => r.json()).then((d) => d?.data?.duelItems && setBag(d.data.duelItems)).catch(() => {});
  }, [user?.id]);
  // Poll while a duel is open — turns arrive without websockets (Render sleeps).
  useEffect(() => {
    if (!active || active.status !== "ACTIVE") return;
    const t = setInterval(load, 4000);
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

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050505] px-4 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
                <Swords className="h-8 w-8 text-rose-400" /> Card Duels
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Stake Arise Points, field three cards, and fight for the pot. Rarity is power — and foils hit harder.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {rating && (
                <div className="flex h-11 items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] px-3.5">
                  <Trophy className="h-4 w-4 text-rose-300" />
                  <span className="text-sm font-black text-rose-100">{rating.rating} <span className="text-rose-400/70">· {rating.wins}W {rating.losses}L</span></span>
                </div>
              )}
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5">
                <Diamond className="h-4 w-4 text-fuchsia-400" />
                <span className="text-sm font-black">{user ? displayArisePoints(user) : "—"} AP</span>
              </div>
              <button onClick={() => setShowChallenge(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 px-4 text-sm font-black text-white transition hover:brightness-110">
                <Swords className="h-4 w-4" /> Challenge
              </button>
            </div>
          </div>

          {/* tabs */}
          <div className="mb-6 flex gap-1 border-b border-white/10">
            {(["duels", "ladder"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`border-b-2 px-5 py-2.5 text-sm font-bold transition ${tab === t ? "border-rose-500 text-white" : "border-transparent text-slate-500 hover:text-white"}`}>
                {t === "duels" ? "My Duels" : "Ranked Ladder"}
              </button>
            ))}
          </div>

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
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-cyan-300">Support items</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-200"><Gem className="h-3.5 w-3.5" />{shards.toLocaleString()} shards</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(ITEM_META).map(([id, m]) => {
                    const held = bag.filter((b) => b === id).length;
                    return (
                      <button key={id} disabled={busy || shards < m.shards}
                        onClick={() => post("buy-item", { item: id }, (d) => { setShards(d.shards); setBag(d.duelItems || []); toast(`Bought ${m.name}`, "success"); })}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-500/40 hover:bg-cyan-500/[0.08] disabled:opacity-40">
                        <m.Icon className={`h-5 w-5 shrink-0 ${m.tint}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black">{m.name} {held > 0 && <span className="text-cyan-400">×{held}</span>}</span>
                          <span className="block text-[11px] text-slate-500">{m.desc} · {m.shards} shards</span>
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
          <DuelBoard duel={active} me={user?.id} byId={byId} myCards={myCards} bag={bag} busy={busy} foils={foils} cardStats={cardStats}
            onClose={() => setActive(null)}
            onAccept={(deck) => post(`${active.id}/accept`, { deck }, () => toast("Duel started!", "success"))}
            onMove={(action: string, index?: number, cardId?: string) =>
              post(`${active.id}/move`, { action, index, cardId })} />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">{title}</h3>
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
    <div onClick={onOpen} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-white/20">
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

  const toggle = (id: string) =>
    setDeck((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < DECK_SIZE ? [...d, id] : d));

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
          <label className="text-xs font-bold text-slate-400">Stake (AP, each side)
            <input type="number" value={stake} onChange={(e) => setStake(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums text-white" />
          </label>
        </div>
        {/* the deck grid scrolls; the header and the action button stay put */}
        <div className="mb-4 min-h-0 flex-1 overflow-y-auto">
          <DeckBuilder myCards={myCards} foils={foils} stats={cardStats} deck={deck}
            onChange={(d) => { setDeck(d); saveDeck(d); }} />
        </div>
        {/* Requires a PICKED member, not just typed text — so a challenge can
            never 404 on a username that was only ever a guess. */}
        <button disabled={busy || !picked || deck.length !== DECK_SIZE}
          style={{ flexShrink: 0 }}
          onClick={() => picked && onSend(picked.username, Math.floor(Number(stake)) || 0, deck)}
          className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white transition hover:brightness-110 disabled:opacity-40">
          {busy ? "Sending…"
            : !picked ? "Pick an opponent"
            : deck.length !== DECK_SIZE ? `Pick ${DECK_SIZE - deck.length} more card${DECK_SIZE - deck.length === 1 ? "" : "s"}`
            : `Challenge ${picked.username} for ${Number(stake).toLocaleString()} AP`}
        </button>
      </div>
    </motion.div>
  );
}

function DuelBoard({ duel, me, byId, myCards, bag, busy, onClose, onAccept, onMove, foils, cardStats }: any) {
  const [deck, setDeck] = useState<string[]>(() => loadSavedDeck());
  const state: DuelState | null = duel.state ? JSON.parse(duel.state) : null;
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

  const toggle = (id: string) =>
    setDeck((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < DECK_SIZE ? [...d, id] : d));

  // A LIVE duel takes the whole screen. Arena is `fixed inset-0` with a dvh
  // height, so it survives mobile browser chrome and the cards stay readable
  // on a phone — which they were not inside a modal.
  if (state && mine && foe && !needsAccept) {
    const resultText = !inDuel
      ? `${duel.winnerId === duel.challengerId ? duel.challengerName : duel.opponentName} won`
      : duel.winnerId === me
      ? `You won ${(duel.stake * 2 * 0.9).toLocaleString()} AP`
      : "You lost this duel";
    return (
      <Arena
        mine={mine} foe={foe} byId={byId}
        myName={myName} foeName={foeName}
        myTurn={myTurn} finished={duel.status === "FINISHED"} resultText={resultText}
        bag={bag} busy={busy} log={state.log} stake={duel.stake}
        supports={myCards.filter((c: any) => !!c.support)}
        usedSupports={mine.usedSupports || []}
        onAttack={(i: number) => onMove("attack", i)}
        onItem={(item: string) => onMove(item)}
        onSupport={(cardId: string) => onMove("support", undefined, cardId)}
        onClose={onClose}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }}
        className="w-full max-w-3xl rounded-3xl border border-white/15 bg-[#0b0b12] p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black sm:text-xl">{duel.challengerName} vs {duel.opponentName}</h2>
            <p className="text-xs text-slate-500">{duel.stake.toLocaleString()} AP each · winner takes {(duel.stake * 2 * 0.9).toLocaleString()} (10% burned)</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        {needsAccept ? (
          <>
            <div className="mb-4">
              <DeckBuilder myCards={myCards} foils={foils} stats={cardStats} deck={deck}
                onChange={(d) => { setDeck(d); saveDeck(d); }} compact />
            </div>
            <button disabled={busy || deck.length !== DECK_SIZE} onClick={() => onAccept(deck)}
              className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 py-3 font-black text-white disabled:opacity-40">
              Match the {duel.stake.toLocaleString()} AP stake and fight
            </button>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">Waiting for the opponent to accept…</p>
        )}
      </motion.div>
    </motion.div>
  );
}
