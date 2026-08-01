"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Sparkles, Gem, X, Hammer, Recycle, PackageOpen, Users } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isLeadDev, displayArisePoints } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, CardRarity, RARITY_META } from "@/components/cards/CardFace";
import PackReveal from "@/components/cards/PackReveal";
import { Panel, CornerTicks, Stars, SegBar, GachaButton, Heading, StatRow, notch, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type SetReward = { set: string; ap: number; shards: number; title: string };

type Catalog = {
  cards: CardDef[];
  packPrice: number;
  packSize: number;
  dustValue: Record<CardRarity, number>;
  craftCost: Record<CardRarity, number>;
  foilCost: Record<CardRarity, number>;
  relicPackShards: number;
  setRewards: Record<string, SetReward>;
  cardStats?: Record<string, { hp: number; atk: number }>;
  foilMult?: number;
};

export default function CardsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [claimedSets, setClaimedSets] = useState<string[]>([]);
  const [shards, setShards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<CardDef[] | null>(null);
  const [selected, setSelected] = useState<CardDef | null>(null);
  const [ap, setAp] = useState<number | null>(null);
  // Whose binder are we looking at? null = mine.
  const [viewing, setViewing] = useState<{ id: string; username: string } | null>(null);
  const [collectors, setCollectors] = useState<any[]>([]);
  const [showCollectors, setShowCollectors] = useState(false);

  // Keep the navbar/shop balance in sync after a spend (mirrors the shop's
  // localStorage + event pattern).
  const syncAp = (newAP: number) => {
    setAp(newAP);
    try {
      const stored = localStorage.getItem("davinci_user");
      if (stored) {
        const u = JSON.parse(stored);
        u.arisePoints = newAP;
        localStorage.setItem("davinci_user", JSON.stringify(u));
        window.dispatchEvent(new Event("davinci_user_updated"));
      }
    } catch {}
  };

  useEffect(() => {
    fetch(`${API_URL}/api/cards/catalog`)
      .then((r) => r.json())
      // Only accept a catalog that actually HAS its card list. Render's free
      // tier sleeps, so a cold start can answer with a partial or error-shaped
      // body; storing that produced a catalog object whose `.cards` was
      // undefined, and every `catalog.cards...` read downstream then threw.
      .then((d) => {
        if (d?.success && Array.isArray(d?.data?.cards)) setCatalog(d.data);
      })
      .catch(() => {});
  }, []);

  const loadCollection = async () => {
    // When viewing someone else's binder we read THEIR collection; the action
    // buttons all key off `isMine` so nothing is spendable on their behalf.
    const targetId = viewing?.id || user?.id;
    if (!targetId) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${API_URL}/api/cards/collection/${targetId}`);
      const d = await r.json();
      if (d.success) {
        const map: Record<string, number> = {};
        const fo: Record<string, boolean> = {};
        for (const c of d.data?.cards || []) {
          map[c.cardId] = c.count;
          if (c.foil) fo[c.cardId] = true;
        }
        setOwned(map);
        setFoils(fo);
        setClaimedSets(d.data.claimedSets || []);
        setShards(d.data.shards || 0);
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, viewing?.id]);

  useEffect(() => {
    fetch(`${API_URL}/api/cards/collectors`)
      .then((r) => r.json())
      .then((d) => d.success && setCollectors(d.data || []))
      .catch(() => {});
  }, []);

  const isMine = !viewing || viewing.id === user?.id;

  const apDisplay = ap !== null ? ap : user?.arisePoints ?? 0;

  const openPack = async () => {
    if (!user) return toast("Sign in to open packs.", "error");
    if (!catalog) return;
    if (!isLeadDev(user) && apDisplay < catalog.packPrice) return toast("Not enough Arise Points for a pack.", "error");
    setOpening(true);
    try {
      const r = await fetch(`${API_URL}/api/cards/open-pack`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        toast(d.message || "Pack failed.", "error");
        return;
      }
      const byId = Object.fromEntries((catalog.cards || []).map((c) => [c.id, c]));
      const pulled: CardDef[] = ((d.data?.pulls || []) as string[]).map((id) => byId[id]).filter(Boolean);
      if (typeof d.data.arisePoints === "number") syncAp(d.data.arisePoints);
      setReveal(pulled);
      await loadCollection();
    } catch {
      toast("Pack failed.", "error");
    } finally {
      setOpening(false);
    }
  };

  const dust = async (card: CardDef) => {
    if (!user) return;
    try {
      const r = await fetch(`${API_URL}/api/cards/dust`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, cardId: card.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't dust.", "error");
      setShards(d.data.shards);
      toast(`+${d.data.gained} shards`, "success");
      await loadCollection();
      setSelected(null);
    } catch {
      toast("Couldn't dust.", "error");
    }
  };

  // Generic shard action — foil / relic-pack / claim-set all follow the same
  // shape, so one helper keeps the error + refresh handling consistent.
  const shardAction = async (
    path: string,
    body: Record<string, unknown>,
    onOk: (data: any) => void
  ) => {
    if (!user) return toast("Sign in first.", "error");
    try {
      const r = await fetch(`${API_URL}/api/cards/${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, ...body }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "That didn't work.", "error");
      onOk(d.data);
      await loadCollection();
    } catch {
      toast("That didn't work.", "error");
    }
  };

  const foilUp = (card: CardDef) =>
    shardAction("foil", { cardId: card.id }, (d) => {
      setShards(d.shards);
      toast(`${card.name} is now FOIL ✨`, "success");
      setSelected(null);
    });

  const openRelic = () =>
    shardAction("relic-pack", {}, (d) => {
      setShards(d.shards);
      const byId = Object.fromEntries((catalog?.cards || []).map((c) => [c.id, c]));
      setReveal(((d?.pulls || []) as string[]).map((id) => byId[id]).filter(Boolean));
    });

  const claimSet = (setName: string) =>
    shardAction("claim-set", { set: setName }, (d) => {
      setShards(d.shards);
      if (typeof d.arisePoints === "number") syncAp(d.arisePoints);
      toast(`Set complete! +${d.ap?.toLocaleString?.() ?? ""} You are now "${d.title}"`, "success");
    });

  const craft = async (card: CardDef) => {
    if (!user || !catalog) return;
    try {
      const r = await fetch(`${API_URL}/api/cards/craft`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, cardId: card.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't craft.", "error");
      setShards(d.data.shards);
      toast(`Crafted ${card.name}!`, "success");
      await loadCollection();
      setSelected(null);
    } catch {
      toast("Couldn't craft.", "error");
    }
  };

  // Group by set, cards within a set sorted by rarity then name.
  const sets = useMemo(() => {
    if (!catalog) return [];
    const bySet: Record<string, CardDef[]> = {};
    for (const c of catalog.cards || []) (bySet[c.set] ||= []).push(c);
    return Object.entries(bySet).map(([set, cards]) => {
      cards.sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order || a.name.localeCompare(b.name));
      const haveCount = cards.filter((c) => (owned[c.id] || 0) > 0).length;
      return { set, cards, have: haveCount, total: cards.length };
    });
  }, [catalog, owned]);

  const totalHave = Object.keys(owned).length;
  const totalCards = catalog?.cards?.length ?? 0;

  return (
    <PageTransition>
      <div className="relative min-h-screen px-4 pb-24 pt-24 text-white"
        style={{
          background:
            "radial-gradient(85% 50% at 12% -5%, rgba(120,86,196,.20), transparent 60%)," +
            "radial-gradient(70% 45% at 92% 4%, rgba(162,116,255,.20), transparent 62%)," +
            "linear-gradient(#0b0716, #070410 60%, #05030c)",
        }}>
        {/* faint diagonal weave — texture, so the page is never flat black */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 7px, rgba(255,255,255,.9) 7px 8px)" }} />

        <div className="relative mx-auto max-w-6xl">
          {/* ── BANNER HEADER ── the title plate, the resources, the progress */}
          <Panel tone="gold" size={26} className="mb-7">
            <div className="relative px-5 py-5 sm:px-7">
              <CornerTicks />
              <div aria-hidden className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(60% 120% at 100% 0%, rgba(162,116,255,.13), transparent 70%)" }} />
              <div className="relative flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.42em]" style={{ color: ACCENT }}>Da Vinci Archive</p>
                  <h1 className="mt-1 flex items-center gap-3 text-3xl font-black uppercase tracking-[0.06em] md:text-[2.6rem] md:leading-none">
                    <Layers className="h-8 w-8" style={{ color: ACCENT_LIT }} /> Arise Cards
                  </h1>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                    Open packs, complete the set, dust your dupes into shards, and craft the cards luck won&rsquo;t give you.
                  </p>
                </div>

                <div className="flex flex-col items-stretch gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 items-center gap-2 px-3.5" style={{ clipPath: notch(9), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10)" }}>
                      <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                      <span className="text-sm font-black tabular-nums">
                        {user ? (isLeadDev(user) ? "∞" : displayArisePoints({ ...user, arisePoints: apDisplay } as any)) : "—"}
                        <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">AP</span>
                      </span>
                    </div>
                    <div className="flex h-10 items-center gap-2 px-3.5" style={{ clipPath: notch(9), background: "rgba(167,139,250,.07)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.22)" }}>
                      <Gem className="h-4 w-4 text-cyan-300" />
                      <span className="text-sm font-black tabular-nums text-cyan-100">
                        {shards.toLocaleString()}
                        <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-cyan-500/70">shards</span>
                      </span>
                    </div>
                  </div>
                  <GachaButton tone="ghost" onClick={() => setShowCollectors((v) => !v)}>
                    <Users className="h-3.5 w-3.5" /> Collectors
                  </GachaButton>
                </div>
              </div>

              {/* archive completion, as a notched meter */}
              {totalCards > 0 && (
                <div className="relative mt-5">
                  <div className="mb-1.5 flex items-end justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Archive completion</span>
                    <span className="text-[11px] font-black tabular-nums" style={{ color: ACCENT_LIT }}>
                      {totalHave}<span className="text-slate-600"> / {totalCards}</span>
                    </span>
                  </div>
                  <SegBar value={totalHave} max={totalCards} />
                </div>
              )}
            </div>
          </Panel>

          {/* ── collectors board — see who owns what ── */}
          {showCollectors && (
            <Panel className="mb-7" size={20}>
              <div className="relative p-5">
                <CornerTicks color="rgba(255,255,255,.22)" />
                <Heading title="Collectors" sub="Ranked by distinct cards" />
                {collectors.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nobody has opened a pack yet. Be the first.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {collectors.map((c, i) => {
                      const top = i < 3;
                      const isOpen = viewing?.id === c.userId;
                      return (
                        <button key={c.userId}
                          onClick={() => { setViewing({ id: c.userId, username: c.username }); setShowCollectors(false); }}
                          className="group flex items-center gap-3 px-3 py-2 text-left transition hover:translate-x-0.5"
                          style={{
                            clipPath: notch(11),
                            background: isOpen ? "rgba(162,116,255,.14)" : "rgba(255,255,255,.028)",
                            boxShadow: `inset 0 0 0 1px ${isOpen ? "rgba(162,116,255,.5)" : "rgba(255,255,255,.07)"}`,
                          }}>
                          <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums"
                            style={{ color: top ? ACCENT_LIT : "#4b5565" }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {c.avatar ? (
                            <img src={c.avatar} alt="" className="h-9 w-9 shrink-0 object-cover" style={{ clipPath: notch(7) }} />
                          ) : (
                            <span className="grid h-9 w-9 shrink-0 place-items-center bg-purple-700 text-xs font-black" style={{ clipPath: notch(7) }}>
                              {c.username?.[0]?.toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-white">{c.username}</span>
                            {c.cardTitle && (
                              <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                                {c.cardTitle}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-base font-black tabular-nums" style={{ color: ACCENT_LIT }}>{c.distinct}</span>
                            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">cards</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* ── viewing someone else's binder ── */}
          {!isMine && viewing && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              style={{ clipPath: notch(14), background: "rgba(162,116,255,.10)", boxShadow: "inset 0 0 0 1px rgba(162,116,255,.35)" }}>
              <span className="text-sm font-bold text-slate-200">
                Viewing <b className="text-white">{viewing.username}</b>&rsquo;s archive — {totalHave} of {totalCards}
              </span>
              <GachaButton tone="ghost" onClick={() => setViewing(null)}>Back to mine</GachaButton>
            </div>
          )}

          {/* open a pack — only on your OWN binder */}
          {catalog && isMine && (
            <Panel tone="gold" size={30} className="mb-8">
              <div className="relative overflow-hidden">
                {/* layered light — the banner glow every gacha summon screen has */}
                <div aria-hidden className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(70% 130% at 78% 20%, rgba(168,110,255,.30), transparent 62%), radial-gradient(55% 110% at 18% 90%, rgba(162,116,255,.18), transparent 65%)" }} />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30"
                  style={{ backgroundImage: "repeating-linear-gradient(72deg, transparent 0 26px, rgba(255,255,255,.55) 26px 27px)", maskImage: "linear-gradient(100deg, transparent 35%, black 75%, transparent)" }} />

                <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-[0.32em]"
                      style={{ clipPath: "polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)", background: `linear-gradient(100deg, ${ACCENT_LIT}, ${ACCENT})`, color: "#1a1206" }}>
                      Standard Banner
                    </span>
                    <h2 className="mt-3 text-3xl font-black uppercase tracking-[0.04em] text-white sm:text-4xl">Ascension Pack</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                      {catalog.packSize} cards a pull, with a real shot at an Epic or Legendary. No duplicate is ever wasted — dust it into shards.
                    </p>

                    {/* rarity ladder — reads as odds furniture, which is the point */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                      {(["legendary", "epic", "rare"] as CardRarity[]).map((r) => (
                        <span key={r} className="inline-flex items-center gap-1.5">
                          <Stars rarity={r} size={11} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{RARITY_META[r]?.label ?? r}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2.5 lg:w-[280px]">
                    <GachaButton onClick={openPack} disabled={opening} className="!py-3.5 !text-[13px]">
                      <PackageOpen className="h-4 w-4" />
                      {opening ? "Opening…" : `Open · ${catalog.packPrice.toLocaleString()} AP`}
                    </GachaButton>
                    <GachaButton tone="jade" onClick={openRelic}
                      disabled={shards < catalog.relicPackShards}
                      title={shards < catalog.relicPackShards ? "Not enough shards yet" : "Guaranteed Epic or better"}
                      className="!py-3.5 !text-[13px]">
                      <Gem className="h-4 w-4" /> Relic · {catalog.relicPackShards.toLocaleString()}
                    </GachaButton>
                    <p className="mt-0.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      Relic guarantees Epic or better
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* ── what shards do ── */}
          {catalog && (
            <div className="mb-8 grid gap-2.5 sm:grid-cols-3">
              {[
                { Icon: Recycle, t: "Dust", d: "Turn duplicates into shards. No pull is ever wasted." },
                { Icon: Hammer, t: "Craft & Foil", d: "Make the card luck won't give you, or foil one to fight 20% harder." },
                { Icon: Gem, t: "Relic Packs", d: "Trade patience for a guaranteed Epic or better." },
              ].map(({ Icon, t, d }) => (
                <div key={t} className="relative flex items-start gap-3 px-4 py-3.5"
                  style={{ clipPath: notch(13), background: "rgba(167,139,250,.045)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.16)" }}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">{t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* collection */}
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading your collection…</div>
          ) : (
            <div className="space-y-10">
              {sets.map(({ set, cards, have, total }) => (
                <div key={set}>
                  <Heading
                    title={set}
                    sub={have >= total ? "Complete" : `${total - have} remaining`}
                    right={
                      <div className="flex min-w-[180px] flex-col items-end gap-1.5 sm:min-w-[260px]">
                        <span className="text-[11px] font-black tabular-nums" style={{ color: have >= total ? ACCENT_LIT : "#94a3b8" }}>
                          {have}<span className="text-slate-600"> / {total}</span>
                        </span>
                        <SegBar value={have} max={total} tone={have >= total ? ACCENT_LIT : ACCENT} height={6} />
                      </div>
                    }
                  />
                  {/* Set completion — the payoff. Cards aren't just a binder:
                      finishing a set pays AP, shards and a title you wear. */}
                  {catalog?.setRewards?.[set] && (() => {
                    const claimed = claimedSets.includes(set);
                    const ready = have >= total && !claimed;
                    const rw = catalog.setRewards[set];
                    return (
                      <Panel tone={ready ? "gold" : claimed ? "jade" : "ink"} size={16} className="mb-4">
                        <div className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-3.5"
                          style={ready ? { background: "linear-gradient(100deg, rgba(162,116,255,.16), transparent 65%)" } : undefined}>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em]"
                              style={{ color: claimed ? "#5eead4" : ready ? ACCENT_LIT : "#64748b" }}>
                              {claimed ? "Set complete" : ready ? "Reward unlocked" : "Set reward"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              <b className="text-white">{rw.ap.toLocaleString()}</b> AP ·{" "}
                              <b className="text-cyan-200">{rw.shards.toLocaleString()}</b> shards · the title{" "}
                              <b style={{ color: ACCENT_LIT }}>&ldquo;{rw.title}&rdquo;</b>
                            </p>
                          </div>
                          {claimed ? (
                            <span className="px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300"
                              style={{ clipPath: notch(9), background: "rgba(167,139,250,.10)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.3)" }}>
                              Claimed
                            </span>
                          ) : (
                            <GachaButton onClick={() => claimSet(set)} disabled={have < total || !isMine}
                              tone={ready ? "gold" : "ghost"}>
                              {ready ? "Claim" : `${total - have} to go`}
                            </GachaButton>
                          )}
                        </div>
                      </Panel>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {cards.map((c) => {
                      const count = owned[c.id] || 0;
                      const has = count > 0;
                      return (
                        <button key={c.id} onClick={() => setSelected(c)}
                          className="group relative flex flex-col items-center gap-1.5 p-2 transition hover:-translate-y-1"
                          style={{
                            clipPath: notch(12),
                            background: has ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.012)",
                            boxShadow: `inset 0 0 0 1px ${has ? "rgba(162,116,255,.24)" : "rgba(255,255,255,.05)"}`,
                          }}>
                          {/* The card carries its own name, stars and rarity
                              badge now that the art is full-bleed, so nothing
                              is repeated underneath it. */}
                          <CardFace card={c} owned={has} count={count} foil={!!foils[c.id]} size={216} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* pack reveal — staggered flip, rarity burst, best card last */}
      <AnimatePresence>
        {reveal && <PackReveal cards={reveal} onClose={() => setReveal(null)} />}
      </AnimatePresence>

      {/* card detail */}
      <AnimatePresence>
        {selected && catalog && (() => {
          const count = owned[selected.id] || 0;
          const R = RARITY_META[selected.rarity];
          const craftable = selected.rarity !== "event" && (catalog.craftCost[selected.rarity] || 0) > 0;
          const cost = catalog.craftCost[selected.rarity] || 0;
          const dustEach = catalog.dustValue[selected.rarity] || 0;
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-6 backdrop-blur"
              onClick={() => setSelected(null)}
            >
              <motion.div
                initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }}
                className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}
              >
                <Panel tone={count > 0 ? "gold" : "ink"} size={26}>
                  <div className="relative max-h-[92dvh] overflow-y-auto">
                    <CornerTicks color={count > 0 ? ACCENT : "rgba(255,255,255,.2)"} inset={10} />
                    {/* rarity wash behind the trophy shot */}
                    <div aria-hidden className="pointer-events-none absolute inset-0"
                      style={{ background: `radial-gradient(60% 90% at 22% 30%, ${R.frame}26, transparent 65%)` }} />

                    <div className="relative flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:items-start sm:p-7 sm:text-left">
                      {/* the trophy shot */}
                      <div className="shrink-0">
                        <CardFace card={selected} owned={count > 0} count={count} foil={!!foils[selected.id]} size={300} showStats stats={catalog.cardStats} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                          <Stars rarity={selected.rarity} size={15} />
                          <span className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: R.frame }}>{R.label}</span>
                          {foils[selected.id] && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em]"
                              style={{ clipPath: notch(5), background: `linear-gradient(100deg, ${ACCENT_LIT}, ${ACCENT})`, color: "#1a1206" }}>
                              Foil
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 text-3xl font-black uppercase leading-none tracking-[0.02em]">
                          {count > 0 ? selected.name : "Unrecorded"}
                        </h3>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{selected.set}</p>
                        <p className="mt-3 text-sm italic leading-relaxed text-slate-400">&ldquo;{selected.flavor}&rdquo;</p>

                        {/* ── COMBAT DATA ── dense stat rows, not chunky cards */}
                        {(() => {
                          const cs = catalog.cardStats?.[selected.rarity] || { atk: 0, hp: 0 };
                          const m = foils[selected.id] ? 1.2 : 1;
                          const atk = Math.round(cs.atk * m);
                          const hp = Math.round(cs.hp * m);
                          return (
                            <div className="mt-4 px-4 py-3 text-left"
                              style={{ clipPath: notch(12), background: "rgba(0,0,0,.45)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ACCENT }}>Combat data</p>
                              <StatRow label="Attack" value={atk} tint="#ff9d6b" />
                              <StatRow label="Health" value={hp} tint="#6ee7b7" />
                              <StatRow label="Dust value" value={`${dustEach} shards`} tint="#67e8f9" />
                              <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500">
                                Sent into the arena it strikes for {atk} — and takes the counter.
                                {foils[selected.id]
                                  ? " This foil fights 20% harder than a normal copy."
                                  : selected.rarity !== "event" && " Foiling adds 20% to both numbers."}
                              </p>
                            </div>
                          );
                        })()}

                        <div className="mt-4 flex flex-col items-stretch gap-2">
                          {isMine && count > 1 && (
                            <GachaButton tone="jade" onClick={() => dust(selected)}>
                              <Recycle className="h-3.5 w-3.5" /> Dust {count - 1} dupe{count - 1 === 1 ? "" : "s"} · +{(count - 1) * dustEach}
                            </GachaButton>
                          )}
                          {isMine && count === 0 && craftable && (
                            <GachaButton tone="ghost" onClick={() => craft(selected)} disabled={shards < cost}>
                              <Hammer className="h-3.5 w-3.5" /> Craft · {cost.toLocaleString()} shards{shards < cost ? " (need more)" : ""}
                            </GachaButton>
                          )}
                          {isMine && count > 0 && !foils[selected.id] && selected.rarity !== "event" && (
                            <GachaButton onClick={() => foilUp(selected)} disabled={shards < (catalog.foilCost[selected.rarity] || 0)}>
                              <Sparkles className="h-3.5 w-3.5" /> Foil · +20% · {(catalog.foilCost[selected.rarity] || 0).toLocaleString()}
                            </GachaButton>
                          )}
                          {foils[selected.id] && (
                            <p className="px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em]"
                              style={{ clipPath: notch(9), background: "rgba(162,116,255,.10)", boxShadow: "inset 0 0 0 1px rgba(162,116,255,.32)", color: ACCENT_LIT }}>
                              Foil — fights 20% harder in duels
                            </p>
                          )}
                          {count === 1 && <p className="text-xs text-slate-500">Pull another copy to dust it for shards.</p>}
                          {count === 0 && !craftable && <p className="text-xs text-slate-500">This card only appears during events.</p>}
                        </div>
                      </div>
                    </div>

                    <button onClick={() => setSelected(null)} aria-label="Close"
                      className="absolute right-4 top-4 z-10 text-slate-500 transition hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </Panel>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}
