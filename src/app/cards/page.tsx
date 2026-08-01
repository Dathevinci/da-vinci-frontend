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
      .then((d) => d.success && setCatalog(d.data))
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
        for (const c of d.data.cards) {
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
      const byId = Object.fromEntries(catalog.cards.map((c) => [c.id, c]));
      const pulled: CardDef[] = (d.data.pulls as string[]).map((id) => byId[id]).filter(Boolean);
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
      setReveal((d.pulls as string[]).map((id) => byId[id]).filter(Boolean));
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
    for (const c of catalog.cards) (bySet[c.set] ||= []).push(c);
    return Object.entries(bySet).map(([set, cards]) => {
      cards.sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order || a.name.localeCompare(b.name));
      const haveCount = cards.filter((c) => (owned[c.id] || 0) > 0).length;
      return { set, cards, have: haveCount, total: cards.length };
    });
  }, [catalog, owned]);

  const totalHave = Object.keys(owned).length;
  const totalCards = catalog?.cards.length ?? 0;

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050505] px-4 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-6xl">
          {/* header */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
                <Layers className="h-8 w-8 text-fuchsia-400" /> Arise Cards
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Open packs, complete the set, dust your dupes into shards, and craft the cards luck won't give you.
                {totalCards > 0 && <> You've collected <b className="text-white">{totalHave}</b> of {totalCards}.</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCollectors((v) => !v)}
                className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              >
                <Users className="h-4 w-4 text-fuchsia-400" /> Collectors
              </button>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5">
                <Sparkles className="h-4 w-4 text-fuchsia-400" />
                <span className="text-sm font-black">{user ? (isLeadDev(user) ? "∞" : displayArisePoints({ ...user, arisePoints: apDisplay } as any)) : "—"} <span className="text-slate-500">AP</span></span>
              </div>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.07] px-3.5">
                <Gem className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-black text-cyan-100">{shards.toLocaleString()} <span className="text-cyan-500/70">shards</span></span>
              </div>
            </div>
          </div>

          {/* ── collectors board — see who owns what ── */}
          {showCollectors && (
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Collectors · ranked by distinct cards</h3>
              {collectors.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Nobody has opened a pack yet. Be the first.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {collectors.map((c, i) => (
                    <button
                      key={c.userId}
                      onClick={() => { setViewing({ id: c.userId, username: c.username }); setShowCollectors(false); }}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                        viewing?.id === c.userId ? "border-fuchsia-500/50 bg-fuchsia-500/10" : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-black text-slate-600">{i + 1}</span>
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-600 text-xs font-black">{c.username?.[0]?.toUpperCase()}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">{c.username}</span>
                        {c.cardTitle && <span className="block truncate text-[10px] font-black uppercase tracking-wider text-amber-300">{c.cardTitle}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-black text-fuchsia-300">{c.distinct}</span>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-600">cards</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── viewing someone else's binder ── */}
          {!isMine && viewing && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/[0.07] px-4 py-3">
              <span className="text-sm font-bold text-fuchsia-100">
                Viewing <b className="text-white">{viewing.username}</b>&rsquo;s collection — {totalHave} of {totalCards}
              </span>
              <button
                onClick={() => setViewing(null)}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-black text-white transition hover:bg-white/20"
              >
                Back to mine
              </button>
            </div>
          )}

          {/* open a pack — only on your OWN binder */}
          {catalog && isMine && (
            <div className="mb-10 flex flex-col items-center gap-3 rounded-3xl border border-fuchsia-500/25 bg-gradient-to-b from-fuchsia-500/[0.08] to-black/40 p-6 text-center">
              <PackageOpen className="h-10 w-10 text-fuchsia-300" />
              <h2 className="text-xl font-black">Ascension Pack</h2>
              <p className="max-w-md text-sm text-slate-400">{catalog.packSize} cards, one chance at an epic or legendary. Duplicates aren't wasted — dust them for shards.</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={openPack}
                  disabled={opening}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-8 py-3 font-black text-white shadow-[0_0_24px_rgba(217,70,239,0.4)] transition hover:brightness-110 disabled:opacity-60"
                >
                  <PackageOpen className="h-5 w-5" /> {opening ? "Opening…" : `Open Pack · ${catalog.packPrice.toLocaleString()} AP`}
                </button>
                {/* Shard sink #3 — guaranteed epic+, bought with shards not AP */}
                <button
                  onClick={openRelic}
                  disabled={shards < catalog.relicPackShards}
                  title={shards < catalog.relicPackShards ? "Not enough shards yet" : "Guaranteed Epic or better"}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-6 py-3 font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
                >
                  <Gem className="h-4 w-4" /> Relic Pack · {catalog.relicPackShards.toLocaleString()} shards
                </button>
              </div>
              <p className="text-[11px] text-slate-500">Relic packs guarantee at least one Epic or Legendary.</p>
            </div>
          )}

          {/* ── what shards do ── */}
          {catalog && (
            <div className="mb-8 grid gap-2 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] p-4 text-xs text-slate-400 sm:grid-cols-3">
              <div className="flex items-start gap-2"><Recycle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> <span><b className="text-cyan-200">Dust</b> duplicates into shards — no pull is ever wasted.</span></div>
              <div className="flex items-start gap-2"><Hammer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> <span><b className="text-cyan-200">Craft</b> the exact card luck won't give you, or <b className="text-cyan-200">Foil</b> one to make it fight <b className="text-cyan-200">20% harder</b> in duels.</span></div>
              <div className="flex items-start gap-2"><Gem className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> <span><b className="text-cyan-200">Relic packs</b> turn patience into a guaranteed Epic.</span></div>
            </div>
          )}

          {/* collection */}
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading your collection…</div>
          ) : (
            <div className="space-y-10">
              {sets.map(({ set, cards, have, total }) => (
                <div key={set}>
                  <div className="mb-4 flex items-center gap-3">
                    <h3 className="text-lg font-black">{set}</h3>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-black text-slate-300">{have} / {total}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-500" style={{ width: `${total ? (have / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  {/* Set completion — the payoff. Cards aren't just a binder:
                      finishing a set pays AP, shards and a title you wear. */}
                  {catalog?.setRewards?.[set] && (
                    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                      claimedSets.includes(set)
                        ? "border-emerald-500/25 bg-emerald-500/[0.05]"
                        : have >= total
                        ? "border-amber-500/40 bg-amber-500/[0.08]"
                        : "border-white/10 bg-white/[0.02]"
                    }`}>
                      <div className="text-sm">
                        <div className="font-black text-white">
                          {claimedSets.includes(set) ? "Set complete ✓" : have >= total ? "Set complete — claim your reward" : "Complete this set to earn"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {catalog.setRewards[set].ap.toLocaleString()} AP · {catalog.setRewards[set].shards.toLocaleString()} shards · the title
                          <b className="text-amber-300"> “{catalog.setRewards[set].title}”</b>
                        </div>
                      </div>
                      {claimedSets.includes(set) ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">Claimed</span>
                      ) : (
                        <button
                          onClick={() => claimSet(set)}
                          disabled={have < total || !isMine}
                          className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-xs font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {have >= total ? "Claim reward" : `${total - have} to go`}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {cards.map((c) => {
                      const count = owned[c.id] || 0;
                      return (
                        <button key={c.id} onClick={() => setSelected(c)} className="flex justify-center transition hover:-translate-y-1">
                          <CardFace card={c} owned={count > 0} count={count} foil={!!foils[c.id]} size={165} />
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
                className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border border-white/15 bg-[#0b0b12] p-6 text-center sm:flex-row sm:items-start sm:text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0"><CardFace card={selected} owned={count > 0} count={count} foil={!!foils[selected.id]} size={170} /></div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest" style={{ color: R.frame, background: `${R.frame}22` }}>{R.label}</span>
                    <span className="text-xs font-bold text-slate-500">{selected.set}</span>
                  </div>
                  <h3 className="text-2xl font-black">{count > 0 ? selected.name : "Not yet collected"}</h3>
                  <p className="mt-2 text-sm italic leading-relaxed text-slate-400">&ldquo;{selected.flavor}&rdquo;</p>

                  <div className="mt-5 space-y-2">
                    {isMine && count > 1 && (
                      <button onClick={() => dust(selected)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2.5 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20">
                        <Recycle className="h-4 w-4" /> Dust {count - 1} dupe{count - 1 === 1 ? "" : "s"} · +{(count - 1) * dustEach} shards
                      </button>
                    )}
                    {isMine && count === 0 && craftable && (
                      <button
                        onClick={() => craft(selected)}
                        disabled={shards < cost}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 py-2.5 text-sm font-black text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-40"
                      >
                        <Hammer className="h-4 w-4" /> Craft · {cost.toLocaleString()} shards {shards < cost && "(need more)"}
                      </button>
                    )}
                    {/* Foil — shard sink #2. Looks incredible AND fights 20%
                        harder in duels, so the button has to SAY that. */}
                    {isMine && count > 0 && !foils[selected.id] && selected.rarity !== "event" && (
                      <button
                        onClick={() => foilUp(selected)}
                        disabled={shards < (catalog.foilCost[selected.rarity] || 0)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-black text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4" /> Make it Foil · +20% in duels · {(catalog.foilCost[selected.rarity] || 0).toLocaleString()} shards
                      </button>
                    )}
                    {foils[selected.id] && (
                      <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] py-2 text-xs font-black text-amber-200">✨ Foil — fights 20% harder in duels</p>
                    )}
                    {count === 1 && <p className="text-xs text-slate-500">Pull another copy to dust it for shards.</p>}
                    {count === 0 && !craftable && <p className="text-xs text-slate-500">This card only appears during events.</p>}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="absolute right-4 top-4 text-slate-500 transition hover:text-white"><X className="h-5 w-5" /></button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}
