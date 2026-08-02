"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Lock, ArrowUpDown, Clock, Tag, Layers, ShieldAlert, X, Sparkles, Gavel, ArrowUpRight } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META } from "@/components/cards/CardFace";
import { Panel, CornerTicks, Stars, GachaButton, StatRow, notch, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * MARKETPLACE — DESIGN PREVIEW ONLY.
 *
 * Every action on this page is inert on purpose. There is no listing endpoint,
 * no buy endpoint, and no card ever changes hands, because a player-to-player
 * market cannot be opened while an account can be taken over: the Discord OAuth
 * callback mints a 60-day session from an email address with no password check.
 * Today that costs someone their Arise Points. With a market it would empty
 * their collection into a stranger's hands, and a good-faith buyer makes that
 * impossible to unwind cleanly.
 *
 * So this file renders the shape of the thing and nothing else. The listings
 * below are generated from the card catalog purely so the layout can be judged
 * with realistic content — they are not real offers and are labelled as such.
 * When auth is fixed, the sample generator is deleted and real listings drop
 * into the same components.
 */

type Listing = {
  key: string;
  card: CardDef;
  seller: string;
  price: number;
  topBid: number | null;
  endsInMin: number;
  foil: boolean;
};

const SELLERS = ["dejavuh", "kaitou", "shirogane", "yuuhi", "arclight", "nozomi", "vermeil", "seiran"];

/** Deterministic sample data — same catalog always yields the same shopfront. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function buildSamples(cards: CardDef[]): Listing[] {
  return cards
    .filter((c) => !c.support)
    .slice(0, 12)
    .map((card, i) => {
      const h = hash(card.id);
      const base = { common: 220, rare: 600, epic: 1800, legendary: 5200, event: 9000 }[card.rarity] ?? 300;
      const price = base + (h % 7) * Math.round(base * 0.12);
      return {
        key: `${card.id}-${i}`,
        card,
        seller: SELLERS[h % SELLERS.length],
        price,
        topBid: h % 3 === 0 ? null : Math.round(price * 0.72),
        endsInMin: 90 + (h % 2600),
        foil: h % 11 === 0,
      };
    });
}

const fmtLeft = (min: number) => {
  const hrs = Math.floor(min / 60);
  return hrs >= 1 ? `${hrs}h ${min % 60}m` : `${min}m`;
};

export default function MarketplacePage() {
  const { user } = useUser();
  const [cards, setCards] = useState<CardDef[]>([]);
  const [sort, setSort] = useState<"low" | "high" | "soon">("low");
  const [tab, setTab] = useState<"all" | "cards" | "effects">("all");
  const [open, setOpen] = useState<Listing | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/cards/catalog`)
      .then((r) => r.json())
      .then((d) => { if (d?.success && Array.isArray(d?.data?.cards)) setCards(d.data.cards); })
      .catch(() => {});
  }, []);

  const listings = useMemo(() => {
    const l = buildSamples(cards);
    if (sort === "low") return [...l].sort((a, b) => a.price - b.price);
    if (sort === "high") return [...l].sort((a, b) => b.price - a.price);
    return [...l].sort((a, b) => a.endsInMin - b.endsInMin);
  }, [cards, sort]);

  const shown = tab === "effects" ? [] : listings;

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
              <h1 className="mt-1 text-4xl font-black tracking-tight md:text-5xl">Marketplace</h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                Buy, sell and bid on Arise Cards and limited profile effects.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 items-center gap-2 px-3.5"
                style={{ clipPath: notch(9), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10)" }}>
                <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                <span className="text-sm font-black tabular-nums">
                  {user?.arisePoints?.toLocaleString() ?? "—"}
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">AP</span>
                </span>
              </div>
              <GachaButton tone="ghost" disabled title="Disabled during the design preview">Trade</GachaButton>
              <GachaButton disabled title="Disabled during the design preview">+ Sell item</GachaButton>
              <GachaButton tone="ghost" disabled title="Disabled during the design preview">
                <Layers className="h-3.5 w-3.5" /> Bulk list
              </GachaButton>
            </div>
          </div>

          {/* ── THE REASON NOTHING WORKS ── stated plainly, not buried ── */}
          <Panel tone="danger" size={18} className="mb-7">
            <div className="relative flex flex-wrap items-start gap-4 px-5 py-4">
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-200">
                  Design preview · trading is switched off
                </p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  These listings are <b className="text-white">not real</b> and nothing here can be bought or sold. The market
                  stays closed until account sign-in is hardened — right now a session can be minted from an email address
                  alone, and a market would turn that into someone&rsquo;s collection being emptied and resold to a buyer who
                  did nothing wrong.
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  The layout below is real, though. Tell me what to change and it&rsquo;s ready the day trading opens.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-200"
                style={{ clipPath: notch(8), background: "rgba(226,69,63,.14)", boxShadow: "inset 0 0 0 1px rgba(226,69,63,.45)" }}>
                <Lock className="h-3 w-3" /> Locked
              </span>
            </div>
          </Panel>

          {/* ── filters ── */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
              <ArrowUpDown className="h-3 w-3" /> Sort
            </span>
            {([["low", "Lowest price"], ["high", "Highest price"], ["soon", "Expiring soon"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                  sort === k ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                style={{
                  clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
                  background: sort === k ? "rgba(162,116,255,.20)" : "rgba(255,255,255,.04)",
                  boxShadow: `inset 0 0 0 1px ${sort === k ? "rgba(162,116,255,.55)" : "rgba(255,255,255,.08)"}`,
                }}>
                {label}
              </button>
            ))}
            <span aria-hidden className="mx-2 h-5 w-px bg-white/10" />
            {/* The live auction house lives HERE now rather than in the nav.
                It is a link, not a tab: auctions are a real, working, escrowed
                feature and this page is a disabled preview — folding the two
                into one surface would put a working buy button next to six
                dead ones. */}
            <Link href="/auctions"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:brightness-125"
              style={{
                clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
                background: "rgba(251,191,36,.12)",
                boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45)",
              }}>
              <Gavel className="h-3 w-3" /> Auction House <ArrowUpRight className="h-3 w-3" />
            </Link>
            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
            {([["all", "All"], ["cards", "Cards"], ["effects", "Effects"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                  tab === k ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                style={{
                  clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
                  background: tab === k ? "rgba(255,255,255,.14)" : "transparent",
                  boxShadow: `inset 0 0 0 1px ${tab === k ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.07)"}`,
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── listings ── */}
          {shown.length === 0 ? (
            <Panel className="py-16">
              <p className="text-center text-sm text-slate-500">
                {tab === "effects" ? "No effects listed yet." : "Loading the shopfront…"}
              </p>
            </Panel>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((l) => (
                <ListingCard key={l.key} listing={l} onOpen={() => setOpen(l)} />
              ))}
            </div>
          )}

          <p className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">
            Sample listings · not real offers
          </p>
        </div>
      </div>

      <AnimatePresence>
        {open && <ListingDetail listing={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </PageTransition>
  );
}

/** One shopfront tile: full-bleed portrait, then the trade furniture beneath. */
function ListingCard({ listing, onOpen }: { listing: Listing; onOpen: () => void }) {
  const { card, seller, price, topBid, endsInMin, foil } = listing;
  const R = RARITY_META[card.rarity];
  return (
    <Panel size={16} className="transition hover:-translate-y-1">
      <div className="relative">
        {/* art — the card draws its own name, stars and badges */}
        {/* CardFace takes a pixel size, so it is sized for the NARROWEST column
            (4-up on a 1152px container ≈ 250px) and centred. Anything larger
            would overflow the tile at that breakpoint. */}
        <button onClick={onOpen} className="relative block w-full text-left">
          <div className="grid w-full place-items-center p-2">
            <CardFace card={card} owned foil={foil} size={232} />
          </div>
          {/* auction clock, mirroring where a live listing would show it */}
          <span className="absolute right-2 top-2 flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200"
            style={{ clipPath: notch(6), background: "rgba(4,20,14,.78)", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.4)" }}>
            <Clock className="h-2.5 w-2.5" /> {fmtLeft(endsInMin)}
          </span>
        </button>

        <div className="border-t border-white/10 px-3.5 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600">By {seller}</p>

          <div className="mt-2">
            <StatRow label="Buy now" value={<span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" style={{ color: ACCENT }} />{price.toLocaleString()}</span>} tint={ACCENT_LIT} />
            <StatRow label="Top bid" value={topBid ? topBid.toLocaleString() : "—"} tint={topBid ? "#cbd5e1" : "#475569"} />
          </div>

          <button disabled title="Trading is disabled during the design preview"
            className="mt-3 w-full cursor-not-allowed px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
            style={{ clipPath: notch(9), background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
            <Lock className="mr-1.5 inline h-3 w-3" /> Buy now
          </button>
        </div>

        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${R.frame}, transparent)`, opacity: 0.6 }} />
      </div>
    </Panel>
  );
}

/** The listing sheet — card, stat tiles, flavour, price. */
function ListingDetail({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { card, seller, price, topBid, foil } = listing;
  const R = RARITY_META[card.rarity];
  const stats = { common: [3, 10], rare: [5, 14], epic: [8, 20], legendary: [12, 28], event: [10, 24] }[card.rarity] ?? [3, 10];
  const mult = foil ? 1.2 : 1;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/85 p-5 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Panel tone="gold" size={24}>
          <div className="relative max-h-[92dvh] overflow-y-auto p-6 text-center">
            <CornerTicks inset={10} />
            <div aria-hidden className="pointer-events-none absolute inset-0"
              style={{ background: `radial-gradient(60% 60% at 50% 18%, ${R.frame}22, transparent 70%)` }} />

            <div className="relative">
              <div className="mx-auto w-fit"><CardFace card={card} owned foil={foil} size={230} /></div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <Stars rarity={card.rarity} size={16} />
              </div>
              <h2 className="mt-1.5 text-2xl font-black uppercase tracking-[0.02em]">{card.name}</h2>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                {R.label} · {card.set} · by {seller}
              </p>

              {/* three tiles, the shape the reference uses for HP/ATK/DEF */}
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: "ATK", value: Math.round(stats[0] * mult), tint: "#ff9d6b", bg: "rgba(249,115,22,.10)", ring: "rgba(249,115,22,.32)" },
                  { label: "HP", value: Math.round(stats[1] * mult), tint: "#6ee7b7", bg: "rgba(16,185,129,.10)", ring: "rgba(16,185,129,.32)" },
                  { label: "Foil", value: foil ? "Yes" : "No", tint: foil ? ACCENT_LIT : "#64748b", bg: "rgba(162,116,255,.10)", ring: "rgba(162,116,255,.30)" },
                ].map((s) => (
                  <div key={s.label} className="px-2 py-3"
                    style={{ clipPath: notch(10), background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}>
                    <p className="text-xl font-black tabular-nums" style={{ color: s.tint }}>{s.value}</p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm italic leading-relaxed text-slate-400">&ldquo;{card.flavor}&rdquo;</p>

              <div className="mt-5 px-4 py-3 text-left"
                style={{ clipPath: notch(12), background: "rgba(0,0,0,.45)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                <StatRow label="Buy now" value={`${price.toLocaleString()} AP`} tint={ACCENT_LIT} />
                <StatRow label="Top bid" value={topBid ? `${topBid.toLocaleString()} AP` : "No bids"} />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button disabled className="w-full cursor-not-allowed px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500"
                  style={{ clipPath: notch(10), background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                  <Lock className="mr-1.5 inline h-3 w-3" /> Buy now
                </button>
                <button disabled className="w-full cursor-not-allowed px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500"
                  style={{ clipPath: notch(10), background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                  <Lock className="mr-1.5 inline h-3 w-3" /> Place bid
                </button>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
                  Sample listing. Trading opens once sign-in is hardened.
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
