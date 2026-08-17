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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE CARD WORKBENCH — the one place cards are made stronger.
 *
 * Levels, skills, stat forging and dissolution (dust). Mythic synthesis used
 * to live here too; it was retired with the card reset, along with every card
 * on both sides of a fusion, so the machine, its recipe book and the fusion
 * rite are gone. The endpoint is unrouted and the server now serves an empty
 * synthesis rulebook.
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

  const lead = isLeadDev(user);


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
              <Gem className="mr-1.5 inline h-4 w-4" />{displayShards(user, shards)} shards
            </span>
          </div>


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
