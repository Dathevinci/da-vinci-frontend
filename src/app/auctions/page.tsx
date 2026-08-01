"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gavel, Clock, Crown, Diamond, Plus, X, Trophy, CircleAlert } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isLeadDev, displayArisePoints } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Curated list for the Lead Dev create form — typo-proof vs a free-text id.
const ITEM_OPTIONS: { id: string; name: string }[] = [
  { id: "effect_outergod", name: "Outer God: Abyssal Gaze" },
  { id: "effect_gateway", name: "The Gate & The Key" },
  { id: "effect_webslinger", name: "The Web-Slinger" },
  { id: "effect_hollow", name: "Hollow Technique: Purple" },
  { id: "effect_void", name: "Domain Expansion: Infinite Void" },
  { id: "effect_unblinking", name: "The Unblinking" },
  { id: "effect_ritual", name: "With This Treasure…" },
  { id: "effect_himalaya", name: "The Silent Himalayas" },
  { id: "effect_mahoraga", name: "Wheel of Adaptation" },
];

type Auction = {
  id: string;
  itemId: string;
  itemType: string;
  title: string;
  startPrice: number;
  minIncrement: number;
  topBid: number;
  topBidderId: string | null;
  topBidderName: string | null;
  bidCount: number;
  status: string;
  endsAt: string;
  winnerId: string | null;
};

function fmtLeft(ms: number) {
  if (ms <= 0) return "Closing…";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function AuctionsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [active, setActive] = useState<Auction[]>([]);
  const [settled, setSettled] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bidInput, setBidInput] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  // nowTs ticks the countdowns; starts null so SSR and first client render match.
  const [nowTs, setNowTs] = useState<number | null>(null);

  const canManage = isLeadDev(user);

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auctions`);
      const data = await res.json();
      if (data.success) {
        setActive(data.data.active || []);
        setSettled(data.data.settled || []);
      }
    } catch {
      /* offline — leave what we have */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Poll so a bid from someone else shows up without a manual refresh. Gentle
    // interval — this is a bidding board, not a trading floor.
    const poll = setInterval(load, 15000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const placeBid = async (a: Auction) => {
    if (!user) return toast("Sign in to bid.", "error");
    const raw = bidInput[a.id];
    const amount = Math.floor(Number(raw));
    const minBid = Math.max(a.startPrice, a.topBid > 0 ? a.topBid + a.minIncrement : a.startPrice);
    if (!(amount >= minBid)) return toast(`Bid at least ${minBid.toLocaleString()} AP.`, "error");
    if (!isLeadDev(user) && (user.arisePoints || 0) < amount) return toast("Not enough Arise Points.", "error");

    setBusyId(a.id);
    try {
      const res = await fetch(`${API_URL}/api/auctions/${a.id}/bid`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "Bid failed.", "error");
        return;
      }
      toast(`You're the top bidder at ${amount.toLocaleString()} AP!`, "success");
      setBidInput((s) => ({ ...s, [a.id]: "" }));
      await load();
    } catch {
      toast("Bid failed.", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050505] px-4 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
                <Gavel className="h-8 w-8 text-amber-400" />
                Auction House
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Bid Arise Points on rare effects. Highest bid when the clock ends wins — points spent leave the economy for good.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5">
                <Diamond className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-black">
                  {user ? (isLeadDev(user) ? <span className="text-amber-400">∞ AP</span> : `${displayArisePoints(user)} AP`) : "—"}
                </span>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowCreate((v) => !v)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 text-sm font-black text-white transition hover:brightness-110"
                >
                  <Plus className="h-4 w-4" /> List item
                </button>
              )}
            </div>
          </div>

          {canManage && showCreate && (
            <CreateForm
              onClose={() => setShowCreate(false)}
              onCreated={() => {
                setShowCreate(false);
                load();
              }}
              userId={user!.id}
            />
          )}

          {/* ── how it works ── */}
          <div className="mb-8 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400 sm:grid-cols-3">
            <div className="flex items-start gap-2"><Diamond className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> Your bid is held the moment you place it, and refunded the instant someone outbids you.</div>
            <div className="flex items-start gap-2"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> A bid in the last 2 minutes extends the clock by 2 minutes — no last-second snipes.</div>
            <div className="flex items-start gap-2"><Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> Win and the item lands in Shop → Owned, ready to equip.</div>
          </div>

          {loading ? (
            <div className="py-24 text-center text-slate-500">Loading auctions…</div>
          ) : active.length === 0 && settled.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
              <Gavel className="h-10 w-10 text-slate-600" />
              <p className="text-lg font-bold text-slate-300">No auctions running right now.</p>
              <p className="max-w-sm text-sm text-slate-500">Check back soon — rare effects go under the hammer here.</p>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div className="mb-12 space-y-4">
                  {active.map((a) => {
                    const msLeft = nowTs !== null ? new Date(a.endsAt).getTime() - nowTs : null;
                    const minBid = Math.max(a.startPrice, a.topBid > 0 ? a.topBid + a.minIncrement : a.startPrice);
                    const isTop = !!user && a.topBidderId === user.id;
                    const closing = msLeft !== null && msLeft < 120000;
                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border bg-gradient-to-b from-white/[0.05] to-black/40 p-5 ${
                          isTop ? "border-emerald-500/40" : closing ? "border-amber-500/50" : "border-white/10"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-xl font-black">{a.title}</h3>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-300">
                                {a.itemType}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Crown className="h-3 w-3 text-amber-400" />
                                {a.topBidderName ? (
                                  <>Top: <b className="text-white">{a.topBidderName}</b></>
                                ) : (
                                  "No bids yet"
                                )}
                              </span>
                              <span>{a.bidCount} bid{a.bidCount === 1 ? "" : "s"}</span>
                            </div>
                          </div>
                          <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-black tabular-nums ${
                            closing ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/10 bg-white/5 text-slate-200"
                          }`}>
                            <Clock className="h-3.5 w-3.5" />
                            {msLeft === null ? "—" : fmtLeft(msLeft)}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current bid</div>
                            <div className="text-2xl font-black text-amber-300">
                              {a.topBid > 0 ? a.topBid.toLocaleString() : a.startPrice.toLocaleString()}
                              <span className="ml-1 text-xs font-bold text-slate-500">AP {a.topBid > 0 ? "" : "· start"}</span>
                            </div>
                          </div>

                          {isTop ? (
                            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-300">
                              <Crown className="h-4 w-4" /> You're winning
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                value={bidInput[a.id] ?? ""}
                                onChange={(e) => setBidInput((s) => ({ ...s, [a.id]: e.target.value }))}
                                placeholder={`≥ ${minBid.toLocaleString()}`}
                                className="w-32 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm tabular-nums outline-none transition focus:border-amber-500/50"
                              />
                              <button
                                onClick={() => placeBid(a)}
                                disabled={busyId === a.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-50"
                              >
                                <Gavel className="h-4 w-4" /> Bid
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {settled.length > 0 && (
                <div>
                  <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Recent results</h2>
                  <div className="space-y-2">
                    {settled.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                        <div className="min-w-0">
                          <span className="truncate font-bold text-slate-200">{a.title}</span>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          {a.topBidderName ? (
                            <span className="text-slate-400">
                              Won by <b className="text-amber-300">{a.topBidderName}</b> · {a.topBid.toLocaleString()} AP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <CircleAlert className="h-3 w-3" /> No bids
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function CreateForm({ onClose, onCreated, userId }: { onClose: () => void; onCreated: () => void; userId: string }) {
  const { toast } = useToast();
  const [itemId, setItemId] = useState(ITEM_OPTIONS[0].id);
  const [startPrice, setStartPrice] = useState("1000");
  const [durationHours, setDurationHours] = useState("24");
  const [minIncrement, setMinIncrement] = useState("100");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const title = ITEM_OPTIONS.find((o) => o.id === itemId)?.name || itemId;
      const res = await fetch(`${API_URL}/api/auctions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          itemId,
          title,
          startPrice: Math.floor(Number(startPrice)) || 0,
          durationHours: Math.floor(Number(durationHours)) || 0,
          minIncrement: Math.floor(Number(minIncrement)) || 100,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "Could not create auction.", "error");
        return;
      }
      toast("Auction listed.", "success");
      onCreated();
    } catch {
      toast("Could not create auction.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black text-amber-300">List an item for auction</h3>
        <button onClick={onClose} className="text-slate-400 transition hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-400">
          Item
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#151518] px-3 py-2 text-sm text-white">
            {ITEM_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-400">
          Start price (AP)
          <input type="number" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums" />
        </label>
        <label className="text-xs font-bold text-slate-400">
          Duration (hours)
          <input type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums" />
        </label>
        <label className="text-xs font-bold text-slate-400">
          Min increment (AP)
          <input type="number" value={minIncrement} onChange={(e) => setMinIncrement(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums" />
        </label>
      </div>
      <button
        onClick={submit}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 font-black text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Listing…" : "List it"}
      </button>
    </div>
  );
}
