"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Hammer, Zap, Recycle, Gem, Swords, Heart, ArrowUp } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isLeadDev, displayShards } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import { loadCatalog } from "@/lib/catalogCache";
import { swrJson } from "@/lib/swrCache";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META } from "@/components/cards/CardFace";
import SynthesisRite from "@/components/cards/SynthesisRite";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE SYNTHESIS LAB — the one place cards are made stronger.
 *
 * Everything that FORGES lives here: Mythic synthesis (the machine), the
 * workbench (levels, skills, stat forging), and dissolution (dust). The
 * card preview screens stay view-only; this tab is where the sparks fly.
 *
 * The lab's rulebook — which pairs fuse, what it costs, the odds — comes
 * from the server's catalog, so this page can only ever OFFER what the
 * machine will accept.
 */

type Synth = {
  eligible: string[];
  fusions: Record<string, string>;
  ap: number;
  shards: number;
  baseChance: number;
  boostStep: number;
  affixes: Record<string, { label: string }>;
  mods: Record<string, { label: string }>;
};

export default function ForgePage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<any | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [forges, setForges] = useState<Record<string, { atk: number; hp: number }>>({});
  const [shards, setShards] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);
  const [boost, setBoost] = useState(0); // steps of +5%
  const [rite, setRite] = useState<{ a: CardDef; b: CardDef; outcome: any } | null>(null);
  const [bench, setBench] = useState<string | null>(null);

  const loadCollection = async (useCache = false) => {
    if (!user?.id) return;
    const apply = (data: any) => {
      const m: Record<string, number> = {};
      const f: Record<string, boolean> = {};
      const lv: Record<string, number> = {};
      const sk: Record<string, number> = {};
      const fg: Record<string, { atk: number; hp: number }> = {};
      for (const c of data?.cards || []) {
        m[c.cardId] = c.count;
        if (c.foil) f[c.cardId] = true;
        lv[c.cardId] = c.level || 1;
        sk[c.cardId] = c.skillLevel || 1;
        fg[c.cardId] = { atk: c.atkForge || 0, hp: c.hpForge || 0 };
      }
      setOwned(m); setFoils(f); setLevels(lv); setSkills(sk); setForges(fg);
      setShards(data?.shards || 0);
    };
    const url = `${API_URL}/api/cards/collection/${user.id}`;
    if (useCache) { await swrJson(`davinci_col_${user.id}`, url, apply); return; }
    try {
      const r = await fetch(url); const d = await r.json();
      if (d.success) apply(d.data);
    } catch { /* offline */ }
  };

  useEffect(() => { loadCatalog(API_URL, (data) => setCatalog(data)); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCollection(true); }, [user?.id]);

  const byId = useMemo(() => {
    const m: Record<string, CardDef> = {};
    for (const c of catalog?.cards || []) m[c.id] = c;
    return m;
  }, [catalog]);

  const synth: Synth | null = catalog?.synthesis || null;
  const eligibleOwned = useMemo(
    () => (synth?.eligible || []).filter((id: string) => (owned[id] || 0) > 0),
    [synth, owned]
  );
  const resultId = slotA && slotB ? synth?.fusions?.[[slotA, slotB].sort().join("+")] : null;
  const resultDef = resultId ? byId[resultId] : null;
  const chance = Math.min(100, (synth?.baseChance ?? 85) + boost * 5);
  const shardCost = (synth?.shards ?? 800) + boost * (synth?.boostStep ?? 150);
  const lead = isLeadDev(user);

  // ── HOLD TO FUSE ── the lever. 1.2s of commitment, because both parents
  // are consumed and a click is too cheap a gesture for that.
  const [holdPct, setHoldPct] = useState(0);
  const holdRef = useRef<{ t0: number; raf: number } | null>(null);
  const startHold = () => {
    if (!slotA || !slotB || busy) return;
    const t0 = performance.now();
    const step = () => {
      const pct = Math.min(100, ((performance.now() - t0) / 1200) * 100);
      setHoldPct(pct);
      if (pct >= 100) { endHold(true); return; }
      holdRef.current = { t0, raf: requestAnimationFrame(step) };
    };
    holdRef.current = { t0, raf: requestAnimationFrame(step) };
  };
  const endHold = (fire = false) => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current.raf);
    holdRef.current = null;
    setHoldPct(0);
    if (fire) fuse();
  };

  const fuse = async () => {
    if (!user || !slotA || !slotB) return;
    setBusy("fuse");
    try {
      const r = await fetch(`${API_URL}/api/cards/synthesize`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, a: slotA, b: slotB, boostShards: boost * (synth?.boostStep ?? 150) }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "The machine refused.", "error");
      setShards(d.data.shards);
      setRite({
        a: byId[slotA], b: byId[slotB],
        outcome: {
          held: d.data.held,
          myth: d.data.mythId ? byId[d.data.mythId] || null : null,
          affixLabel: d.data.affixLabel,
          modLabel: d.data.modLabel,
          returned: d.data.returned ? byId[d.data.returned] || null : null,
        },
      });
      setSlotA(null); setSlotB(null); setBoost(0);
      await loadCollection();
    } catch { toast("The machine refused.", "error"); } finally { setBusy(null); }
  };

  const act = async (path: string, body: any, okMsg: string) => {
    if (!user) return;
    setBusy(path);
    try {
      const r = await fetch(`${API_URL}/api/cards/${path}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id, ...body }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't do that.", "error");
      if (typeof d.data?.shards === "number") setShards(d.data.shards);
      toast(okMsg, "success");
      await loadCollection();
    } catch { toast("Couldn't do that.", "error"); } finally { setBusy(null); }
  };

  const benchDef = bench ? byId[bench] : null;
  const lvlCost = benchDef
    ? Math.round((catalog?.upgradeBase?.[benchDef.rarity] ?? 30) * Math.pow(catalog?.upgradeGrowth ?? 1.35, (levels[benchDef.id] || 1) - 1))
    : 0;
  const forgeCostOf = (stat: "atk" | "hp") => {
    if (!benchDef) return null;
    const arr = stat === "atk" ? catalog?.forge?.atkCost?.[benchDef.rarity] : catalog?.forge?.hpCost?.[benchDef.rarity];
    const rank = stat === "atk" ? (forges[benchDef.id]?.atk || 0) : (forges[benchDef.id]?.hp || 0);
    return Array.isArray(arr) ? arr[rank] ?? null : null;
  };

  const ownedList = useMemo(
    () => (catalog?.cards || []).filter((c: CardDef) => (owned[c.id] || 0) > 0),
    [catalog, owned]
  );

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-x-hidden pb-24 pt-24 text-white" style={{ background: "linear-gradient(180deg, #0c0508 0%, #08040c 60%, #050308 100%)" }}>
        {/* ── LAB AMBIENCE ── steam, status lights, a hum you can see */}
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <div className="fg-steam absolute bottom-0 left-[8%] h-64 w-40" />
          <div className="fg-steam absolute bottom-0 right-[12%] h-72 w-48" style={{ animationDelay: "2.2s" }} />
          <span className="fg-lamp absolute left-5 top-24 h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="fg-lamp absolute left-5 top-32 h-2.5 w-2.5 rounded-full bg-amber-400" style={{ animationDelay: ".7s" }} />
          <span className="fg-lamp absolute left-5 top-40 h-2.5 w-2.5 rounded-full bg-emerald-400" style={{ animationDelay: "1.3s" }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-red-400/80">Da Vinci Archive</p>
              <h1 className="mt-1 flex items-center gap-3 font-fell text-4xl font-bold uppercase tracking-[0.06em]">
                <FlaskConical className="h-8 w-8 text-red-400" /> Synthesis Lab
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                The one place cards are made stronger. Levels, skills and stat forging on the
                workbench — and the machine that fuses two legendaries into a Mythic.
              </p>
            </div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-black text-cyan-200">
              <Gem className="mr-1.5 inline h-4 w-4" />{lead ? "∞" : displayShards({ ...user, shards } as any)} shards
            </span>
          </div>

          {/* ═══ THE MACHINE ═══ */}
          <section className="relative mb-10 p-6"
            style={{ clipPath: "polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px)", background: "linear-gradient(165deg, #1c0a10, #0d0510)", boxShadow: "inset 0 0 0 1px rgba(225,29,72,.35)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.28em] text-red-300">
              <Zap className="h-4 w-4" /> Mythic Synthesis
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Two of the five eligible legendaries go in. <b className="text-white">Both are consumed.</b>{" "}
              The pair decides which Mythic comes out — the machine only rolls its affix and its
              eruption. A failed reaction returns <b className="text-amber-300">one</b> parent, never neither.
            </p>

            {/* eligible roster */}
            <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              Fusion-eligible in your binder — tap two
            </p>
            <div className="flex flex-wrap gap-3">
              {eligibleOwned.length === 0 && (
                <p className="text-sm text-slate-400">You hold none of the five. They are: {(synth?.eligible || []).map((id: string) => byId[id]?.name || id).join(" · ")}</p>
              )}
              {eligibleOwned.map((id: string) => {
                const inA = slotA === id, inB = slotB === id, on = inA || inB;
                return (
                  <button key={id}
                    onClick={() => {
                      if (inA) setSlotA(null);
                      else if (inB) setSlotB(null);
                      else if (!slotA) setSlotA(id);
                      else if (!slotB && id !== slotA) setSlotB(id);
                    }}
                    className="relative p-1 transition hover:-translate-y-1"
                    style={{ background: on ? "rgba(225,29,72,.18)" : "transparent", boxShadow: on ? "inset 0 0 0 2px rgba(251,113,133,.7)" : "inset 0 0 0 1px rgba(255,255,255,.08)", borderRadius: 12 }}>
                    <CardFace card={byId[id]} owned foil={!!foils[id]} level={levels[id]} size={96} showStats={false} />
                    {on && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-2 text-[9px] font-black text-white">{inA ? "A" : "B"}</span>}
                  </button>
                );
              })}
            </div>

            {/* the pairing readout */}
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  {[slotA, slotB].map((s, i) => (
                    <div key={i} className="grid place-items-center rounded-xl border-2 border-dashed border-red-400/40"
                      style={{ width: 96, height: 148, background: "rgba(0,0,0,.35)" }}>
                      {s ? <CardFace card={byId[s]} owned size={84} showStats={false} /> :
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300/60">Chamber {i === 0 ? "A" : "B"}</span>}
                    </div>
                  ))}
                  {/* the conduit — energy visibly flowing toward the result */}
                  <div className="relative h-1.5 w-10 overflow-hidden rounded-full sm:w-16" style={{ background: "rgba(255,255,255,.08)" }}>
                    <span className="fg-flow absolute inset-y-0 left-0 w-1/2" style={{ background: "linear-gradient(90deg, transparent, #fb7185, transparent)" }} />
                  </div>
                  <div className="grid place-items-center rounded-xl border-2 border-red-400/60"
                    style={{ width: 104, height: 158, background: "rgba(20,0,8,.6)", boxShadow: resultDef ? "0 0 26px rgba(225,29,72,.45)" : "none" }}>
                    {resultDef
                      ? <div className="flex flex-col items-center"><CardFace card={resultDef} owned={(owned[resultDef.id] || 0) > 0} size={88} showStats={false} /><span className="mt-1 max-w-[100px] truncate text-[9px] font-black uppercase tracking-[0.1em] text-rose-200">{resultDef.name}</span></div>
                      : <span className="px-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-red-300/50">The Mythic</span>}
                  </div>
                </div>
              </div>

              <div className="flex min-w-[240px] flex-col gap-2.5">
                <div className="rounded-xl px-4 py-3" style={{ background: "rgba(0,0,0,.4)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">The bill</p>
                  <p className="mt-1 text-sm font-bold text-slate-200">
                    {(synth?.ap ?? 5000).toLocaleString()} AP · {shardCost.toLocaleString()} shards
                    <span className="text-slate-500"> · both cards</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Success</span>
                    <span className="font-mono text-sm font-black" style={{ color: chance >= 100 ? "#6ee7b7" : "#fbbf24" }}>{chance}%</span>
                  </div>
                  {/* the odds, as a meter you can feel filling */}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${chance}%`, background: chance >= 100 ? "linear-gradient(90deg,#059669,#6ee7b7)" : "linear-gradient(90deg,#b45309,#fbbf24)" }} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button onClick={() => setBoost((b) => Math.max(0, b - 1))} className="h-7 w-7 rounded-lg bg-white/10 font-black">−</button>
                    <span className="flex-1 text-center text-[10px] font-bold text-slate-300">
                      {boost === 0 ? "no boost" : `+${boost * 5}% for ${(boost * (synth?.boostStep ?? 150)).toLocaleString()} shards`}
                    </span>
                    <button onClick={() => setBoost((b) => Math.min(3, b + 1))} className="h-7 w-7 rounded-lg bg-white/10 font-black">+</button>
                  </div>
                </div>

                {/* THE LEVER — hold it down */}
                <button
                  onPointerDown={startHold}
                  onPointerUp={() => endHold(false)}
                  onPointerLeave={() => endHold(false)}
                  disabled={!slotA || !slotB || !!busy}
                  className="relative overflow-hidden rounded-xl py-4 text-sm font-black uppercase tracking-[0.3em] text-white transition disabled:opacity-40"
                  style={{ background: "linear-gradient(180deg, #7f1d1d, #450a0a)", boxShadow: "inset 0 0 0 2px rgba(248,113,113,.5), 0 0 22px rgba(225,29,72,.35)" }}>
                  <span aria-hidden className="absolute inset-y-0 left-0 bg-red-500/50" style={{ width: `${holdPct}%` }} />
                  <span className="relative">{busy === "fuse" ? "REACTING…" : holdPct > 0 ? "HOLD…" : "HOLD TO FUSE"}</span>
                </button>
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
                  ⚠ Both legendaries are consumed — hold the lever to commit
                </div>
              </div>
            </div>
          </section>

          {/* ═══ THE WORKBENCH ═══ */}
          <section className="mb-10 p-6"
            style={{ clipPath: "polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px)", background: "linear-gradient(165deg, #120b1e, #0a0712)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.25)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.28em] text-violet-300">
              <Hammer className="h-4 w-4" /> The Workbench
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Pick a card, then spend shards on it: levels raise ATK &amp; HP (+7% each), skills
              deepen, and the forge adds flat power point by point.
            </p>
            <div className="mt-4 flex gap-2.5 overflow-x-auto pb-2">
              {ownedList.map((c: CardDef) => (
                <button key={c.id} onClick={() => setBench(c.id)} className="shrink-0 p-1 transition hover:-translate-y-0.5"
                  style={{ background: bench === c.id ? "rgba(167,139,250,.2)" : "transparent", boxShadow: bench === c.id ? "inset 0 0 0 2px rgba(196,164,255,.7)" : "inset 0 0 0 1px rgba(255,255,255,.07)", borderRadius: 10 }}>
                  <CardFace card={c} owned foil={!!foils[c.id]} level={levels[c.id]} forge={forges[c.id]} size={84} />
                </button>
              ))}
            </div>
            {benchDef && (
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <button onClick={() => act("upgrade", { cardId: benchDef.id }, "Level up.")} disabled={!!busy || (levels[benchDef.id] || 1) >= 10}
                  className="rounded-xl px-4 py-3 text-left transition hover:bg-white/5 disabled:opacity-40" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300"><ArrowUp className="h-3.5 w-3.5" /> Level {(levels[benchDef.id] || 1)} → {(levels[benchDef.id] || 1) + 1}</p>
                  <p className="mt-1 text-xs text-slate-400">{(levels[benchDef.id] || 1) >= 10 ? "At the cap." : `${lvlCost.toLocaleString()} shards · +7% ${benchDef.support ? "effect" : "ATK & HP"}`}</p>
                </button>
                <button onClick={() => act("upgrade-skill", { cardId: benchDef.id }, "Skill deepened.")} disabled={!!busy}
                  className="rounded-xl px-4 py-3 text-left transition hover:bg-white/5 disabled:opacity-40" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-300"><Zap className="h-3.5 w-3.5" /> Skill · rank {skills[benchDef.id] || 1}</p>
                  <p className="mt-1 text-xs text-slate-400">Raise this card&apos;s skill or domain</p>
                </button>
                <button onClick={() => act("forge", { cardId: benchDef.id, stat: "atk" }, "ATK forged.")} disabled={!!busy || (forges[benchDef.id]?.atk || 0) >= 5}
                  className="rounded-xl px-4 py-3 text-left transition hover:bg-white/5 disabled:opacity-40" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-rose-300"><Swords className="h-3.5 w-3.5" /> Forge ATK · {(forges[benchDef.id]?.atk || 0)}/5</p>
                  <p className="mt-1 text-xs text-slate-400">{(forges[benchDef.id]?.atk || 0) >= 5 ? "Fully forged." : `${(forgeCostOf("atk") ?? 0).toLocaleString()} shards · +1 ATK`}</p>
                </button>
                <button onClick={() => act("forge", { cardId: benchDef.id, stat: "hp" }, "HP forged.")} disabled={!!busy || (forges[benchDef.id]?.hp || 0) >= 5}
                  className="rounded-xl px-4 py-3 text-left transition hover:bg-white/5 disabled:opacity-40" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-pink-300"><Heart className="h-3.5 w-3.5" /> Forge HP · {(forges[benchDef.id]?.hp || 0)}/5</p>
                  <p className="mt-1 text-xs text-slate-400">{(forges[benchDef.id]?.hp || 0) >= 5 ? "Fully forged." : `${(forgeCostOf("hp") ?? 0).toLocaleString()} shards · +2 HP`}</p>
                </button>
              </div>
            )}
          </section>

          {/* ═══ DISSOLUTION ═══ */}
          <section className="p-6"
            style={{ clipPath: "polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px)", background: "linear-gradient(165deg, #071518, #050d12)", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.25)" }}>
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
              <Recycle className="h-4 w-4" /> Dissolution
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Duplicates melt into shards — the fuel for everything above. Dusting keeps one copy
              of every card, and one of every legendary build.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => act("dust-all", {}, "Every dupe dusted.")} disabled={!!busy}
                className="rounded-xl px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100 transition hover:brightness-115 disabled:opacity-40"
                style={{ background: "linear-gradient(100deg, #0e7490, #164e63)", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.4)" }}>
                Dust every dupe
              </button>
              {benchDef && (
                <button onClick={() => act("dust", { cardId: benchDef.id }, "Dusted.")} disabled={!!busy}
                  className="rounded-xl px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}>
                  Dust {benchDef.name} dupes
                </button>
              )}
            </div>
          </section>
        </div>

        <AnimatePresence>
          {rite && (
            <SynthesisRite a={rite.a} b={rite.b} outcome={rite.outcome}
              onClose={() => setRite(null)} />
          )}
        </AnimatePresence>

        <style jsx global>{`
          .fg-steam { background: radial-gradient(60% 100% at 50% 100%, rgba(200,210,230,.10), transparent 70%); animation: fgSteam 7s ease-in-out infinite; }
          @keyframes fgSteam { 0%, 100% { transform: translateY(0) scaleY(1); opacity: .5; } 50% { transform: translateY(-30px) scaleY(1.25); opacity: .9; } }
          .fg-lamp { animation: fgLamp 2.4s ease-in-out infinite; box-shadow: 0 0 10px 2px currentColor; }
          @keyframes fgLamp { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
          .fg-flow { animation: fgFlow 1.6s ease-in-out infinite; }
          @keyframes fgFlow { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
        `}</style>
      </div>
    </PageTransition>
  );
}
