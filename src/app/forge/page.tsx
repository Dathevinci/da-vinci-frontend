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
  const [showRecipes, setShowRecipes] = useState(false);
  // Three full-size chambers are ~360px of glass before gaps — wider than a
  // phone. Small screens get a scaled-down machine that actually fits.
  const [smallScr, setSmallScr] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const sync = () => setSmallScr(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  // The one-bill quote for maxing the benched card — priced by the server
  // (dryRun) so the button says exactly what the press will cost.
  const [maxQuote, setMaxQuote] = useState<number | "maxed" | "loading">("loading");
  useEffect(() => {
    setMaxQuote("loading");
    if (!bench || !user?.id) return;
    let gone = false;
    fetch(`${API_URL}/api/cards/max`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ userId: user.id, cardId: bench, dryRun: true }),
    })
      .then((r) => r.json())
      .then((d) => { if (!gone) setMaxQuote(d?.success ? d.data.cost : "maxed"); })
      .catch(() => {});
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bench, levels, skills, forges]);
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
        {/* ── LAB AMBIENCE ── the room is part of the machine: pipework down
            both walls, floor grating, hazard tape, gauges, breathing lamps
            and steam. All static gradients or transform/opacity loops. */}
        <div aria-hidden className="pointer-events-none fixed inset-0">
          {/* wall pipes, with joints */}
          {(["left-2", "right-2"] as const).map((side) => (
            <div key={side} className={`absolute ${side} top-16 bottom-0 hidden w-3 md:block`}
              style={{ background: "linear-gradient(90deg, #2a2140, #453764 45%, #221a36)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
              {[0, 1, 2, 3].map((j) => (
                <span key={j} className="absolute -left-1 -right-1 h-2 rounded-sm"
                  style={{ top: `${14 + j * 24}%`, background: "#4c4470", boxShadow: "inset 0 1px 0 rgba(255,255,255,.2), 0 1px 2px rgba(0,0,0,.6)" }} />
              ))}
            </div>
          ))}
          {/* floor grating */}
          <div className="absolute inset-x-0 bottom-0 h-16 opacity-60"
            style={{ background: "repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,.55) 14px 16px), linear-gradient(180deg, transparent, #16102855 40%, #1b1230)" }} />
          {/* hazard tape running under the header */}
          <div className="absolute inset-x-0 top-14 h-2 opacity-30"
            style={{ background: "repeating-linear-gradient(45deg, #f59e0b 0 12px, #0a0a0a 12px 24px)" }} />
          <div className="fg-steam absolute bottom-0 left-[8%] h-64 w-40" />
          <div className="fg-steam absolute bottom-0 right-[12%] h-72 w-48" style={{ animationDelay: "2.2s" }} />
          <span className="fg-lamp absolute left-7 top-24 h-2.5 w-2.5 rounded-full bg-red-500 md:left-8" />
          <span className="fg-lamp absolute left-7 top-32 h-2.5 w-2.5 rounded-full bg-amber-400 md:left-8" style={{ animationDelay: ".7s" }} />
          <span className="fg-lamp absolute left-7 top-40 h-2.5 w-2.5 rounded-full bg-emerald-400 md:left-8" style={{ animationDelay: "1.3s" }} />
          {/* the wall gauges, needles never quite still */}
          <div className="absolute right-8 top-24 hidden gap-3 lg:flex">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative h-12 w-12 rounded-full border-2 border-[#3a2c50] bg-black/70"
                style={{ boxShadow: "inset 0 0 8px rgba(0,0,0,.8), 0 0 6px rgba(167,139,250,.15)" }}>
                <span className="fg-needle absolute bottom-1/2 left-1/2 h-4 w-[2px] origin-bottom bg-red-400"
                  style={{ animationDelay: `${i * 0.9}s` }} />
                <span className="absolute inset-x-0 bottom-1.5 text-center font-mono text-[6px] text-slate-500">{["PSI", "FLUX", "TEMP"][i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto max-w-5xl px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-red-400/80">Da Vinci Archive</p>
              <h1 className="mt-1 flex items-center gap-3 font-fell text-4xl font-bold uppercase tracking-[0.06em]">
                <FlaskConical className="h-8 w-8 text-red-400" /> Card Workbench
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
            {/* hazard tape across the machine's lintel */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: "repeating-linear-gradient(45deg, #b91c1c 0 10px, #14060b 10px 20px)" }} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.28em] text-red-300">
                <Zap className="h-4 w-4" /> Mythic Synthesis
              </h2>
              <button onClick={() => setShowRecipes(true)}
                className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-200 transition hover:bg-red-500/20">
                📜 Recipes
              </button>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Two eligible cards go in. <b className="text-white">Both are consumed.</b>{" "}
              The pair decides what comes out — the machine only rolls its affix and its eruption.
              A failed reaction returns <b className="text-amber-300">one</b> parent, never neither.
              Any two of the five legendaries forge a Mythic. And three <b className="text-rose-300">specific
              pairs of two Mythics</b> each forge a GOD — Doors+Hours → Gojo, Blade+Tomorrow → Sukuna,
              Saint+Tide → Unohana.
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

            {/* ── THE APPARATUS ── three real glass chambers on a piped
                console base. Tap a filled chamber to empty it. */}
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-end">
              <div className="relative flex items-end justify-center gap-2 pb-2 sm:gap-12">
                {/* the feed pipe running behind all three chambers */}
                <div aria-hidden className="absolute bottom-9 left-[6%] right-[6%] h-2 overflow-hidden rounded-full"
                  style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10)" }}>
                  <span className="fg-flow absolute inset-y-0 left-0 w-1/3"
                    style={{ background: `linear-gradient(90deg, transparent, ${slotA && slotB ? "#fb7185" : "rgba(148,163,184,.5)"}, transparent)` }} />
                </div>
                {([[slotA, "Chamber A", () => setSlotA(null)], [null, "", null], [slotB, "Chamber B", () => setSlotB(null)]] as const).map(([s, label, clear], i) => {
                  const centre = i === 1;
                  const card = centre ? resultDef : s ? byId[s] : null;
                  const lit = centre ? (resultDef ? "#e11d48" : "#3f2430") : card ? (RARITY_META[card.rarity]?.frame || "#f59e0b") : "#334155";
                  const w = centre ? (smallScr ? 92 : 128) : (smallScr ? 74 : 106);
                  const h = centre ? (smallScr ? 172 : 236) : (smallScr ? 140 : 192);
                  return (
                    <button key={i} type="button" onClick={() => { if (!centre && clear && s) clear(); }}
                      className="relative z-10 flex flex-col items-center" title={!centre && s ? "Tap to empty this chamber" : undefined}
                      style={{ cursor: !centre && s ? "pointer" : "default" }}>
                      {/* cap */}
                      <div style={{ width: w * 0.55, height: 10, borderRadius: 6, background: "#3a2c50", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)" }} />
                      {/* tube */}
                      <div className="relative overflow-hidden" style={{
                        width: w, height: h, borderRadius: 999,
                        background: "linear-gradient(180deg, rgba(170,200,255,.10), rgba(120,150,220,.03) 45%, rgba(170,200,255,.10))",
                        boxShadow: `inset 0 0 0 2px rgba(190,215,255,.28), inset 0 -40px 60px ${lit}44, 0 0 ${card ? 30 : 14}px ${lit}33`,
                      }}>
                        {/* the fluid, lit from below */}
                        <div className="absolute inset-x-2 bottom-2 rounded-full"
                          style={{ height: "56%", background: `linear-gradient(180deg, transparent, ${lit}28 30%, ${lit}55)` }} />
                        {/* bubbles rising through it */}
                        {[0, 1, 2, 3].map((bi) => (
                          <span key={bi} aria-hidden className="fg-bubble absolute rounded-full"
                            style={{ left: `${16 + bi * 20}%`, bottom: 8, width: 4 + (bi % 2) * 2, height: 4 + (bi % 2) * 2, background: "rgba(220,240,255,.45)", animationDelay: `${bi * 0.9 + i * 0.4}s` }} />
                        ))}
                        {/* the suspended card, bobbing in the fluid */}
                        {card ? (
                          <div className="absolute left-1/2 top-1/2" style={{ transform: "translate(-50%,-50%)" }}>
                            <div className="fg-float">
                              <CardFace card={card} owned={centre ? (owned[card.id] || 0) > 0 : true} size={centre ? (smallScr ? 66 : 92) : (smallScr ? 54 : 80)} showStats={false} />
                            </div>
                          </div>
                        ) : (
                          <span className="absolute inset-0 grid place-items-center px-2 text-center text-[9px] font-black uppercase tracking-[0.24em]"
                            style={{ color: centre ? "rgba(251,113,133,.6)" : "rgba(203,213,225,.6)" }}>
                            {centre ? "The Result" : label}
                          </span>
                        )}
                      </div>
                      {/* base plate */}
                      <div style={{ width: w + 22, height: 14, borderRadius: 8, background: "linear-gradient(180deg,#241a3e,#120c22)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />
                      <span className="mt-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-slate-500">
                        {centre ? (resultDef ? resultDef.name : "Reaction chamber") : label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── REACTOR CONSOLE ── the metal box that runs the machine */}
              <div className="relative flex min-w-[240px] flex-col gap-2.5 rounded-2xl p-4"
                style={{ background: "linear-gradient(170deg, #1b1226, #0e0916)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10), 0 10px 30px rgba(0,0,0,.5)" }}>
                {/* corner screws */}
                {[["6px", "6px"], ["6px", "auto"], ["auto", "6px"], ["auto", "auto"]].map(([t, l], i) => (
                  <span key={i} aria-hidden className="absolute h-1.5 w-1.5 rounded-full"
                    style={{ top: t === "auto" ? undefined : t, bottom: t === "auto" ? "6px" : undefined, left: l === "auto" ? undefined : l, right: l === "auto" ? "6px" : undefined, background: "#4c4470", boxShadow: "inset 0 -1px 1px rgba(0,0,0,.7)" }} />
                ))}
                <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-red-300/80">— Reactor console —</p>
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
                  ⚠ Both parents are consumed — hold the lever to commit
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
            {benchDef && (
              // ── THE WHOLE CLIMB, ONE PRESS ── every remaining level, both
              // forge tracks, the skill to cap. Priced by the server; earns
              // the neon MAX sign on the spot.
              <button
                onClick={() => act("max", { cardId: benchDef.id }, `${benchDef.name} is MAXED.`)}
                disabled={!!busy || typeof maxQuote !== "number"}
                className="mt-4 w-full rounded-xl py-4 text-[12px] font-black uppercase tracking-[0.3em] text-[#1a1206] transition hover:brightness-110 disabled:opacity-40"
                style={{
                  background: "linear-gradient(100deg, #fde68a, #f59e0b)",
                  boxShadow: "0 0 22px rgba(245,158,11,.45), inset 0 0 0 1px rgba(255,255,255,.35)",
                }}>
                {maxQuote === "loading" ? "★ Pricing the climb…"
                  : maxQuote === "maxed" ? "★ Already maxed — the sign is lit"
                  : `★ Max this card — ${maxQuote.toLocaleString()} shards`}
              </button>
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

        {/* ── THE RECIPE BOOK ── every pairing the machine will accept,
            with what you hold marked. Data straight from the server's
            catalog, so this page can never promise a recipe it won't honor. */}
        <AnimatePresence>
          {showRecipes && synth && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[92] grid place-items-center bg-black/80 p-4"
              onClick={() => setShowRecipes(false)}>
              <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.22 }} onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg overflow-y-auto p-6"
                style={{ maxHeight: "85dvh", clipPath: "polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)", background: "linear-gradient(165deg, #1c0a10, #0c0510)", boxShadow: "inset 0 0 0 1px rgba(225,29,72,.4)" }}>
                <h3 className="text-sm font-black uppercase tracking-[0.28em] text-red-300">📜 The Recipe Book</h3>
                {([["Mythos — two legendaries", (id: string) => byId[id]?.rarity === "legendary"],
                   ["Pantheon — two Mythics", (id: string) => byId[id]?.rarity === "mythic"]] as const).map(([groupTitle, isGroup]) => (
                  <div key={groupTitle} className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{groupTitle}</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {Object.entries(synth.fusions)
                        .filter(([key]) => isGroup(key.split("+")[0]))
                        .map(([key, resultId]) => {
                          const [pa, pb] = key.split("+");
                          const haveA = (owned[pa] || 0) > 0, haveB = (owned[pb] || 0) > 0;
                          const haveR = (owned[resultId] || 0) > 0;
                          return (
                            <div key={key} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                              style={{ background: "rgba(0,0,0,.35)", boxShadow: `inset 0 0 0 1px ${haveR ? "rgba(110,231,183,.35)" : "rgba(255,255,255,.08)"}` }}>
                              <span className={`font-bold ${haveA ? "text-slate-200" : "text-slate-500"}`}>{byId[pa]?.name || pa}</span>
                              <span className="text-slate-600">+</span>
                              <span className={`font-bold ${haveB ? "text-slate-200" : "text-slate-500"}`}>{byId[pb]?.name || pb}</span>
                              <span className="text-red-400">→</span>
                              <span className="flex-1 truncate font-black text-rose-200">{byId[resultId]?.name || resultId}</span>
                              {haveR && <span className="shrink-0 text-emerald-300">✓ forged</span>}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
                <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
                  Greyed names are parents you don&apos;t currently hold. Every recipe consumes both parents.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
          .fg-bubble { animation: fgBubble 3.4s ease-in infinite; }
          @keyframes fgBubble { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } 100% { transform: translateY(-150px); opacity: 0; } }
          .fg-float { animation: fgFloat 4.2s ease-in-out infinite; }
          @keyframes fgFloat { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-7px) rotate(1.5deg); } }
          .fg-needle { animation: fgNeedle 2.8s ease-in-out infinite; }
          @keyframes fgNeedle { 0%, 100% { transform: rotate(-38deg); } 40% { transform: rotate(-16deg); } 60% { transform: rotate(-30deg); } 80% { transform: rotate(-20deg); } }
        `}</style>
      </div>
    </PageTransition>
  );
}
