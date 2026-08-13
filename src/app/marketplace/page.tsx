"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpDown, Tag, Layers, X, Sparkles, Gavel, ArrowUpRight, Loader2,
  Store, Trash2, ShieldAlert, Heart, Swords,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isLeadDev } from "@/lib/admin";
import { loadCatalog } from "@/lib/catalogCache";
import { swrJson } from "@/lib/swrCache";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META } from "@/components/cards/CardFace";
import { Panel, CornerTicks, Stars, StatRow, notch, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * MARKETPLACE — live player-to-player card sales.
 *
 * The escrow rule the server enforces, restated here because the UI has to be
 * honest about it: LISTING a card removes it from your collection immediately,
 * not when it sells. Cancelling gives it back. Every price is for the whole
 * lot, not per card.
 */

type Listing = {
  id: string;
  sellerId: string; sellerName: string;
  cardId: string; qty: number; foil: boolean; level: number;
  price: number; status: string;
  buyerName?: string | null;
  createdAt: string;
  card: CardDef | null;
  /** Legendary lots only: the escrowed copies' identities. */
  prints?: { serial: number; condition: string }[];
};

/** Condition badge styling — mirrors the collection sheet's palette. */
const PRINT_META: Record<string, { label: string; cls: string }> = {
  fresh:   { label: "Fresh Build", cls: "border-amber-400/60 bg-amber-500/15 text-amber-200" },
  rusted:  { label: "Rusted",      cls: "border-orange-700/60 bg-orange-900/30 text-orange-300" },
  factory: { label: "Factory New", cls: "border-slate-400/40 bg-slate-500/15 text-slate-200" },
};

const FEE_PERCENT = 5;
const fmt = (n: number) => n.toLocaleString();

export default function MarketplacePage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [sort, setSort] = useState<"low" | "high" | "new">("low");
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  // Browse legendaries BY BUILD — each wear is its own market.
  const [wearFilter, setWearFilter] = useState<"all" | "fresh" | "rusted" | "factory">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selling, setSelling] = useState(false);
  const [open, setOpen] = useState<Listing | null>(null);
  const [ap, setAp] = useState<number | null>(null);

  // Infinity flows through everything downstream honestly: fmt() renders it
  // as "∞", and every canAfford check is simply true. The server skips the
  // debit for the lead dev, so the number never has to lie.
  const balance = isLeadDev(user) ? Number.POSITIVE_INFINITY : ap ?? user?.arisePoints ?? 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqs: Promise<any>[] = [
        fetch(`${API_URL}/api/market?sort=${sort}`).then((r) => r.json()),
      ];
      if (user?.id) reqs.push(fetch(`${API_URL}/api/market?mine=${user.id}`).then((r) => r.json()));
      const [all, own] = await Promise.all(reqs);
      if (all?.success) setListings(all.data || []);
      if (own?.success) setMine(own.data || []);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [sort, user?.id]);

  useEffect(() => { load(); }, [load]);

  const syncAp = (v: number) => {
    setAp(v);
    try {
      const stored = localStorage.getItem("davinci_user");
      if (stored) {
        const u = JSON.parse(stored);
        u.arisePoints = v;
        localStorage.setItem("davinci_user", JSON.stringify(u));
        window.dispatchEvent(new Event("davinci_user_updated"));
      }
    } catch {}
  };

  const buy = async (l: Listing) => {
    if (!user) return toast("Sign in to buy.", "error");
    setBusy(l.id);
    try {
      const r = await fetch(`${API_URL}/api/market/${l.id}/buy`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't buy that.", "error");
      if (typeof d.data?.arisePoints === "number") syncAp(d.data.arisePoints);
      toast(`Bought ${l.card?.name ?? "card"} ×${l.qty}. It's in your collection.`, "success");
      setOpen(null);
      await load();
    } catch {
      toast("Couldn't buy that.", "error");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (l: Listing) => {
    if (!user) return;
    setBusy(l.id);
    try {
      const r = await fetch(`${API_URL}/api/market/${l.id}/cancel`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't cancel.", "error");
      toast("Listing pulled. The cards are back in your collection.", "success");
      await load();
    } catch {
      toast("Couldn't cancel.", "error");
    } finally {
      setBusy(null);
    }
  };

  // Wear filter only steers the browse tab — its chips live there, and a
  // filter you can't see shouldn't be able to hide your own listings.
  const shown = tab === "mine" ? mine : listings.filter((l) =>
    wearFilter === "all" || (l as any).prints?.[0]?.condition === wearFilter);
  const activeMine = useMemo(() => mine.filter((l) => l.status === "ACTIVE"), [mine]);

  return (
    <PageTransition>
      <div className="relative min-h-screen px-4 pb-24 pt-24 text-white"
        style={{
          background:
            "radial-gradient(85% 50% at 12% -5%, rgba(120,86,196,.20), transparent 60%)," +
            "radial-gradient(70% 45% at 92% 4%, rgba(162,116,255,.14), transparent 62%)," +
            "linear-gradient(#0b0716, #070410 60%, #05030c)",
        }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 7px, rgba(255,255,255,.9) 7px 8px)" }} />

        <div className="relative mx-auto max-w-6xl">
          {/* ── header ── */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.42em]" style={{ color: ACCENT }}>
                Da Vinci <span className="text-slate-700">/</span> Market <Tag className="h-3 w-3" />
              </p>
              <h1 className="mt-1 font-fell text-4xl font-bold uppercase tracking-[0.1em] md:text-5xl"
                style={{
                  background: `linear-gradient(100deg, #fff 10%, ${ACCENT_LIT} 55%, ${ACCENT} 92%)`,
                  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                  filter: `drop-shadow(0 2px 18px ${ACCENT}55)`,
                }}>
                Marketplace
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                Buy and sell Arise Cards with other collectors. Listing a card takes it out of your
                collection until it sells or you pull the listing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 items-center gap-2 px-3.5"
                style={{ clipPath: notch(9), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10)" }}>
                <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                <span className="text-sm font-black tabular-nums">
                  {fmt(balance)}
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">AP</span>
                </span>
              </div>
              <button onClick={() => (user ? setSelling(true) : toast("Sign in to sell.", "error"))}
                className="inline-flex h-10 items-center gap-2 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115"
                style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
                <Store className="h-3.5 w-3.5" /> Sell a card
              </button>
            </div>
          </div>

          {/* ── filters ── */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Link href="/auctions"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:brightness-125"
              style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)", background: "rgba(251,191,36,.12)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45)" }}>
              <Gavel className="h-3 w-3" /> Auction House <ArrowUpRight className="h-3 w-3" />
            </Link>
            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
            {([["browse", "Browse"], ["mine", `My listings${activeMine.length ? ` (${activeMine.length})` : ""}`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k as any)}
                className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition"
                style={{
                  clipPath: notch(7),
                  background: tab === k ? `${ACCENT}30` : "rgba(255,255,255,.03)",
                  boxShadow: `inset 0 0 0 1px ${tab === k ? ACCENT : "rgba(255,255,255,.08)"}`,
                  color: tab === k ? "#fff" : "#64748b",
                }}>
                {label}
              </button>
            ))}
            {tab === "browse" && (
              <>
                <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
                <span className="mr-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                  <ArrowUpDown className="h-3 w-3" /> Sort
                </span>
                {([["low", "Cheapest"], ["high", "Priciest"], ["new", "Newest"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)}
                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                      sort === k ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                    style={{
                      clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
                      background: sort === k ? `${ACCENT}33` : "rgba(255,255,255,.04)",
                      boxShadow: `inset 0 0 0 1px ${sort === k ? `${ACCENT}99` : "rgba(255,255,255,.08)"}`,
                    }}>
                    {label}
                  </button>
                ))}
                {/* build filter — each wear is its own market with its own prices */}
                <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
                {([["all", "All", "#cbd5e1"], ["fresh", "Fresh Build", "#fbbf24"], ["rusted", "Rusted", "#fb923c"], ["factory", "Factory New", "#cbd5e1"]] as const).map(([k, label, tint]) => (
                  <button key={k} onClick={() => setWearFilter(wearFilter === k && k !== "all" ? "all" : k)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition"
                    style={{
                      clipPath: notch(7),
                      color: wearFilter === k ? tint : "#64748b",
                      background: wearFilter === k ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
                      boxShadow: `inset 0 0 0 1px ${wearFilter === k ? `${tint}66` : "rgba(255,255,255,.07)"}`,
                    }}>
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* ── listings ── */}
          {loading ? (
            <div className="grid place-items-center py-24 text-slate-600"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <Panel className="py-20">
              <p className="text-center text-sm text-slate-500">
                {tab === "mine" ? "You haven't listed anything." : "Nothing for sale yet. Be the first."}
              </p>
            </Panel>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((l) => (
                <ListingCard key={l.id} listing={l} meId={user?.id} busy={busy === l.id}
                  onOpen={() => setOpen(l)} onCancel={() => cancel(l)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <ListingDetail listing={open} meId={user?.id} balance={balance} busy={busy === open.id}
            onBuy={() => buy(open)} onClose={() => setOpen(null)} />
        )}
        {selling && <SellSheet onClose={() => setSelling(false)} onListed={() => { setSelling(false); load(); }} />}
      </AnimatePresence>
    </PageTransition>
  );
}

/**
 * Combat stats by rarity. MUST mirror CARD_STATS in the backend duelRules —
 * the marketplace is where people decide what a card is worth, so a figure
 * here that disagrees with the arena is worse than no figure at all.
 */
const MARKET_STATS: Record<string, { hp: number; atk: number }> = {
  common:    { hp: 18, atk: 7 },
  rare:      { hp: 20, atk: 8 },
  epic:      { hp: 23, atk: 9 },
  legendary: { hp: 26, atk: 10 },
  event:     { hp: 24, atk: 9 },
  mythic:    { hp: 36, atk: 15 },
};

function ListingCard({ listing, meId, busy, onOpen, onCancel }: {
  listing: Listing; meId?: string; busy: boolean; onOpen: () => void; onCancel: () => void;
}) {
  const { card, qty, price, sellerName, foil, level, status } = listing;
  const isMine = meId === listing.sellerId;
  const R = card ? RARITY_META[card.rarity] : null;

  return (
    <Panel size={16} className="transition hover:-translate-y-1">
      <div className="relative">
        <button onClick={onOpen} className="relative block w-full text-left">
          {/* Art-dominant, edge to edge. The card used to be centred inside
              padding, so the tile read as a frame around a smaller thing
              rather than as the card itself. Bigger, flush, and the info sits
              tight underneath it. */}
          <div className="grid w-full place-items-center p-1">
            {card
              ? <CardFace card={card} owned foil={foil} level={level} wear={(listing as any).prints?.[0]?.condition} size={272} ratio="5 / 9" />
              : <div className="grid h-[490px] w-[272px] place-items-center text-xs text-slate-600">Unknown card</div>}
          </div>
          {/* the BUILD, said out loud — the tile treatment shows it, the
              badge names it, so a Rusted price is never mistaken for a
              Fresh Build price. */}
          {(listing as any).prints?.[0] && (() => {
            const m = PRINT_META[(listing as any).prints[0].condition] || PRINT_META.factory;
            return (
              <span className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${m.cls}`}>
                {m.label}
              </span>
            );
          })()}
          {qty > 1 && (
            <span className="absolute right-3 top-3 px-2 py-1 text-[10px] font-black text-white"
              style={{ clipPath: notch(6), background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
              ×{qty}
            </span>
          )}
          {status !== "ACTIVE" && (
            <span className="absolute left-3 top-3 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-300"
              style={{ clipPath: notch(6), background: "rgba(0,0,0,.75)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}>
              {status === "SOLD" ? `Sold${listing.buyerName ? ` · ${listing.buyerName}` : ""}` : "Cancelled"}
            </span>
          )}
        </button>

        <div className="border-t border-white/10 px-3.5 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600">
            By {sellerName}{level > 1 ? ` · Lv ${level}` : ""}
          </p>

          {/* Stat pills, on their own row under the art. Combat numbers are
              what you weigh a listing on, and they were only readable by
              squinting at the card face. Derived the same way the arena builds
              a fighter — rarity base, then foil, then level — so the figures
              here are the ones that actually walk into a duel. */}
          {card && (() => {
            const base = card.set === "Pantheon" ? { hp: 44, atk: 19 } : MARKET_STATS[card.rarity] || MARKET_STATS.common;
            const mult = (foil ? 1.2 : 1) * (1 + (Math.max(1, level || 1) - 1) * 0.07);
            const hp = Math.round(base.hp * mult);
            const atk = Math.round(base.atk * mult);
            return (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.055] px-2 py-1 text-[11px] font-black tabular-nums text-rose-300">
                  <Heart className="h-3 w-3" /> {hp}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.055] px-2 py-1 text-[11px] font-black tabular-nums text-amber-300">
                  <Swords className="h-3 w-3" /> {atk}
                </span>
                {foil && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.055] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200">
                    Foil
                  </span>
                )}
              </div>
            );
          })()}

          {/* Legendary lots carry PRINTS — a Fresh Build #3 is a different
              asset from a Factory New #212, and the tile has to say which
              one is actually for sale before anyone weighs the price. */}
          {(listing.prints?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {listing.prints!.map((p) => {
                const m = PRINT_META[p.condition] || PRINT_META.factory;
                return (
                  <span key={p.serial}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${m.cls}`}>
                    {m.label}
                    <span className="font-mono normal-case tracking-normal opacity-80">#{String(p.serial).padStart(3, "0")}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-2">
            <StatRow label="Price" value={
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" style={{ color: ACCENT }} />{fmt(price)}
              </span>
            } tint={ACCENT_LIT} />
          </div>

          {status !== "ACTIVE" ? (
            <p className="mt-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Closed</p>
          ) : isMine ? (
            <button onClick={onCancel} disabled={busy}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-200 transition hover:brightness-125 disabled:opacity-40"
              style={{ clipPath: notch(9), background: "rgba(244,63,94,.12)", boxShadow: "inset 0 0 0 1px rgba(244,63,94,.4)" }}>
              <Trash2 className="h-3 w-3" /> {busy ? "Pulling…" : "Pull listing"}
            </button>
          ) : (
            <button onClick={onOpen}
              className="mt-3 w-full px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:brightness-115"
              style={{ clipPath: notch(9), background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
              Buy now
            </button>
          )}
        </div>

        {R && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${R.frame}, transparent)`, opacity: 0.6 }} />
        )}
      </div>
    </Panel>
  );
}

function ListingDetail({ listing, meId, balance, busy, onBuy, onClose }: {
  listing: Listing; meId?: string; balance: number; busy: boolean;
  onBuy: () => void; onClose: () => void;
}) {
  const { card, qty, price, sellerName, foil, level } = listing;
  const R = card ? RARITY_META[card.rarity] : null;
  const isMine = meId === listing.sellerId;
  const canAfford = balance >= price;
  const statsMap: Record<string, number[]> = { common: [3, 10], rare: [5, 14], epic: [8, 20], legendary: [12, 28], mythic: [16, 36], event: [10, 24] };
  const stats = card ? (statsMap[card.rarity] ?? [3, 10]) : [0, 0];
  const mult = (foil ? 1.2 : 1) * (1 + (Math.max(1, level) - 1) * 0.07);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/85 p-5 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Panel tone="gold" size={24}>
          <div className="relative max-h-[92dvh] overflow-y-auto p-6 text-center">
            <CornerTicks inset={10} />
            {R && (
              <div aria-hidden className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(60% 60% at 50% 18%, ${R.frame}22, transparent 70%)` }} />
            )}
            <div className="relative">
              {card && <div className="mx-auto w-fit"><CardFace card={card} owned foil={foil} size={230} /></div>}

              {card && (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2"><Stars rarity={card.rarity} size={16} /></div>
                  <h2 className="mt-1.5 text-2xl font-black uppercase tracking-[0.02em]">{card.name}</h2>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    {R?.label} · {card.set} · by {sellerName}
                  </p>
                </>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: "ATK", value: Math.round(stats[0] * mult), tint: "#ff9d6b", bg: "rgba(249,115,22,.10)", ring: "rgba(249,115,22,.32)" },
                  { label: "HP", value: Math.round(stats[1] * mult), tint: "#6ee7b7", bg: "rgba(16,185,129,.10)", ring: "rgba(16,185,129,.32)" },
                  { label: "Level", value: level, tint: ACCENT_LIT, bg: "rgba(162,116,255,.10)", ring: "rgba(162,116,255,.30)" },
                ].map((s) => (
                  <div key={s.label} className="px-2 py-3"
                    style={{ clipPath: notch(10), background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}>
                    <p className="text-xl font-black tabular-nums" style={{ color: s.tint }}>{s.value}</p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {card?.flavor && <p className="mt-4 text-sm italic leading-relaxed text-slate-400">&ldquo;{card.flavor}&rdquo;</p>}

              {/* exactly which prints this lot hands over */}
              {(listing.prints?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  {listing.prints!.map((p) => {
                    const m = PRINT_META[p.condition] || PRINT_META.factory;
                    return (
                      <span key={p.serial}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${m.cls}`}>
                        {m.label}
                        <span className="font-mono normal-case tracking-normal opacity-80">#{String(p.serial).padStart(3, "0")}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 px-4 py-3 text-left"
                style={{ clipPath: notch(12), background: "rgba(0,0,0,.45)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                <StatRow label="Copies" value={`×${qty}`} />
                <StatRow label="Price" value={`${fmt(price)} AP`} tint={ACCENT_LIT} />
                <StatRow label="Your balance" value={`${fmt(balance)} AP`} tint={canAfford ? "#6ee7b7" : "#f87171"} />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {isMine ? (
                  <p className="py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Your own listing</p>
                ) : (
                  <button onClick={onBuy} disabled={busy || !canAfford}
                    className="w-full px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:brightness-115 disabled:opacity-35"
                    style={{ clipPath: notch(10), background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
                    {busy ? "Buying…" : canAfford ? `Buy for ${fmt(price)} AP` : "Not enough AP"}
                  </button>
                )}
                <p className="text-[10px] leading-relaxed text-slate-600">
                  The card lands in your collection immediately. Foil and level come from this listing.
                </p>
              </div>
            </div>

            <button onClick={onClose} aria-label="Close"
              className="absolute right-4 top-4 z-10 text-slate-500 transition hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

/** Pick a card you own, choose how many copies, name a price. */
function SellSheet({ onClose, onListed }: { onClose: () => void; onListed: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [owned, setOwned] = useState<Record<string, { count: number; foil: boolean; level: number; hibernating: boolean; prints?: { serial: number; condition: string }[] }>>({});
  const [pick, setPick] = useState<CardDef | null>(null);
  const [qty, setQty] = useState(1);
  // For legendaries: the EXACT serials being sold. Each wear tier is its own
  // asset now — the seller points at the copies, never at a count.
  const [sel, setSel] = useState<number[]>([]);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  // Tapping a card in the grid used to leave you at the top of the sheet
  // with the price and quantity controls somewhere below a whole collection
  // — the sheet now carries you straight to them.
  const detailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (pick) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pick?.id]);

  useEffect(() => {
    if (!user?.id) return;
    // Session-cached, refreshed in the background — the sell sheet opens
    // with your cards already there instead of arriving late.
    loadCatalog(API_URL, (data) => setCatalog(data.cards || []));
    swrJson(`davinci_col_${user.id}`, `${API_URL}/api/cards/collection/${user.id}`, (colData) => {
      const m: Record<string, any> = {};
      for (const c of colData?.cards || []) {
        m[c.cardId] = { count: c.count, foil: !!c.foil, level: c.level || 1, hibernating: !!c.hibernating, prints: Array.isArray(c.prints) ? c.prints : [] };
      }
      setOwned(m);
    });
  }, [user?.id]);

  // Only cards you actually hold, awake, and not support cards.
  const sellable = useMemo(
    () => catalog.filter((c) => (owned[c.id]?.count || 0) > 0 && !owned[c.id]?.hibernating && !c.support),
    [catalog, owned]
  );

  const max = pick ? owned[pick.id]?.count || 1 : 1;
  const pickPrints = pick ? owned[pick.id]?.prints || [] : [];
  // A legendary with prints sells BY PRINT; everything else sells by count.
  const byPrint = pick?.rarity === "legendary" && pickPrints.length > 0;
  const selling = byPrint ? sel.length : qty;
  const ask = Math.floor(Number(price) || 0);
  const fee = Math.floor((ask * FEE_PERCENT) / 100);

  const submit = async () => {
    if (!user || !pick) return;
    if (ask < 10) return toast("Price must be at least 10 AP.", "error");
    if (byPrint && sel.length === 0) return toast("Pick which prints you're selling.", "error");
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/market`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, cardId: pick.id, qty: selling, price: ask, serials: byPrint ? sel : undefined }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't list that.", "error");
      toast(`${pick.name} ×${selling} listed.`, "success");
      onListed();
    } catch {
      toast("Couldn't list that.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/85 p-4 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col p-6"
        style={{ clipPath: notch(22), background: "linear-gradient(165deg, #16102b, #0c0818)", boxShadow: `inset 0 0 0 1px ${ACCENT}55` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-xl font-black">Sell a card</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* The rule people most need to know BEFORE they list, not after. */}
        <div className="mb-4 flex shrink-0 items-start gap-3 px-4 py-3"
          style={{ clipPath: notch(12), background: `${ACCENT}12`, boxShadow: `inset 0 0 0 1px ${ACCENT}44` }}>
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT_LIT }} />
          <p className="text-xs leading-relaxed text-slate-300">
            Listing takes the copies <b className="text-white">out of your collection straight away</b> — you can&rsquo;t
            duel or dust with them while they&rsquo;re up. Pull the listing any time to get them back.
            A <b className="text-white">{FEE_PERCENT}%</b> fee comes off the sale.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Your collection</p>
          {sellable.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nothing sellable — open a pack first.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {sellable.map((c) => {
                const on = pick?.id === c.id;
                const info = owned[c.id];
                return (
                  <button key={c.id}
                    onClick={() => { setPick(c); setQty(1); setSel([]); }}
                    className="relative flex justify-center p-1 transition hover:-translate-y-0.5"
                    style={{
                      clipPath: notch(9),
                      background: on ? `${ACCENT}26` : "transparent",
                      boxShadow: on ? `inset 0 0 0 1px ${ACCENT}` : "none",
                    }}>
                    <CardFace card={c} owned foil={info?.foil} size={84} />
                    {info?.count > 1 && (
                      <span className="absolute right-1 top-1 rounded-full bg-white px-1.5 text-[10px] font-black text-black">
                        ×{info.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {pick && (
            <div ref={detailRef} className="mt-5 grid scroll-mt-2 gap-4 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto"><CardFace card={pick} owned foil={owned[pick.id]?.foil} size={150} /></div>
              <div>
                <p className="text-lg font-black">{pick.name}</p>
                <p className="text-[11px] text-slate-500">
                  You hold {max} · Level {owned[pick.id]?.level || 1}{owned[pick.id]?.foil ? " · Foil" : ""}
                </p>

                {byPrint ? (
                  <>
                    {/* Each copy is its own graded object — you sell THESE
                        prints, not "some copies". */}
                    <label className="mt-3 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Prints to sell — tap to pick · one build per listing
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(() => {
                        // ONE BUILD PER LISTING — each wear is its own market
                        // with its own price. The first pick locks the build;
                        // other builds grey out until the selection clears.
                        const selWear = sel.length > 0 ? pickPrints.find((p) => p.serial === sel[0])?.condition : null;
                        return pickPrints.map((p) => {
                          const on = sel.includes(p.serial);
                          const locked = !!selWear && p.condition !== selWear;
                          const m = PRINT_META[p.condition] || PRINT_META.factory;
                          return (
                            <button key={p.serial} disabled={locked}
                              title={locked ? "One build per listing — list this wear separately" : undefined}
                              onClick={() => setSel((s) => on ? s.filter((n) => n !== p.serial) : [...s, p.serial])}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${m.cls} ${
                                on ? "ring-2 ring-white/80" : locked ? "opacity-25 cursor-not-allowed" : "opacity-70 hover:opacity-100"
                              }`}>
                              {m.label}
                              <span className="font-mono normal-case tracking-normal opacity-80">#{String(p.serial).padStart(3, "0")}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                    {sel.length === pickPrints.length && pickPrints.length > 1 && (
                      <p className="mt-1.5 text-[11px] text-amber-300/80">
                        That&rsquo;s every print — this card will leave your collection entirely.
                      </p>
                    )}
                    {sel.some((n) => (pickPrints.find((p) => p.serial === n)?.condition === "fresh")) && (
                      <p className="mt-1.5 text-[11px] text-amber-200">
                        You&rsquo;re selling a Fresh Build — the rarest wear. Price it like one.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="mt-3 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Copies to sell
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                        <button key={n} onClick={() => setQty(n)}
                          className="h-9 w-9 text-sm font-black transition"
                          style={{
                            clipPath: notch(7),
                            background: qty === n ? `linear-gradient(140deg, ${ACCENT_LIT}, ${ACCENT})` : "rgba(255,255,255,.05)",
                            boxShadow: qty === n ? "none" : "inset 0 0 0 1px rgba(255,255,255,.12)",
                            color: qty === n ? "#160b2b" : "#cbd5e1",
                          }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {qty === max && max > 1 && (
                      <p className="mt-1.5 text-[11px] text-amber-300/80">
                        That&rsquo;s every copy — this card will leave your collection entirely.
                      </p>
                    )}
                  </>
                )}

                <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Price for the whole lot
                </label>
                <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric" placeholder="e.g. 500"
                  className="mt-1.5 w-full bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                  style={{ clipPath: notch(10), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />
                {ask > 0 && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Fee {fmt(fee)} AP · you receive <b style={{ color: ACCENT_LIT }}>{fmt(ask - fee)} AP</b>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex shrink-0 justify-end gap-2">
          <button onClick={onClose}
            className="px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:brightness-125"
            style={{ clipPath: notch(9), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!pick || ask < 10 || busy || (byPrint && sel.length === 0)}
            className="px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115 disabled:opacity-35"
            style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
            {busy ? "Listing…" : "List for sale"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
