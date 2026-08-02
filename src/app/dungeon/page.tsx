"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { displayArisePoints } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { CardDef } from "@/components/cards/CardFace";
import { cardArt } from "@/data/cardArt";
import { loadCatalog } from "@/lib/catalogCache";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * DUNGEON DISPATCH — the second game mode.
 *
 * You don't fight here. You CHOOSE who goes in, and you watch. The whole
 * raid resolves on the server one floor per request; this page is a screen
 * bolted to the front of that engine — it renders the event reel it's
 * handed, at the speed you ask for, and its single verb is RECALL.
 *
 * Everything below is deliberately pixel-era: hard borders, a real arcade
 * font, steps() timing, box-shadow sprite monsters, an optional CRT scan
 * overlay. No gradients, no glass — the duels own that look.
 */

// MUST mirror CARD_STATS in the backend duelRules + levelMult in cardCatalog.
// Display-only (the server builds the real units), same contract as the
// marketplace's MARKET_STATS mirror.
const DGN_STATS: Record<string, { hp: number; atk: number }> = {
  common:    { hp: 18, atk: 7 },
  rare:      { hp: 20, atk: 8 },
  epic:      { hp: 23, atk: 9 },
  legendary: { hp: 26, atk: 10 },
  event:     { hp: 24, atk: 9 },
};
const lvlMult = (l: number) => 1 + (Math.max(1, Math.min(10, Math.floor(l || 1))) - 1) * 0.07;

type DgnCard = {
  cardId: string; count: number; foil: boolean; level: number;
  dgnHp: number | null; dgnInjured: boolean; dgnDead: boolean;
};
type Dungeon = {
  id: string; name: string; depth: number; recPower: number; flavor: string; apMul: number;
};
type Unit = { cardId: string; name: string; rarity: string; maxHp: number; hp: number; atk: number; foil: boolean };
type Enemy = { name: string; hp: number; maxHp: number; atk: number; kind: number; boss?: boolean };
type Ev =
  | { k: "spawn"; enemies: Enemy[] }
  | { k: "phit"; i: number; e: number; dmg: number; crit?: 1 }
  | { k: "ekill"; e: number }
  | { k: "ehit"; e: number; i: number; dmg: number }
  | { k: "fall"; i: number }
  | { k: "clear"; ap: number; shards: number }
  | { k: "wipe" };
type RunResult = {
  status: string; floors: number; ap: number; shards: number;
  lostAp?: number; lostShards?: number;
  party: { cardId: string; name: string; rarity: string; hp: number; maxHp: number; outcome: string }[];
};

/** Effective (display) stats for a card in the lobby, injury included. */
function effStats(c: DgnCard, rarity: string) {
  const base = DGN_STATS[rarity] || DGN_STATS.common;
  const m = (c.foil ? 1.2 : 1) * lvlMult(c.level);
  const fullMax = Math.round(base.hp * m);
  const maxHp = c.dgnInjured ? Math.max(1, Math.round(fullMax * 0.7)) : fullMax;
  const hp = c.dgnDead ? 0 : c.dgnHp === null ? maxHp : Math.min(c.dgnHp, maxHp);
  return { maxHp, hp, atk: Math.round(base.atk * m) };
}

const RARITY_TINT: Record<string, string> = {
  common: "#9aa4b2", rare: "#5fa8ff", epic: "#c07dff", legendary: "#ffcf5c", event: "#ff8ad0",
};

/* ── PIXEL MONSTERS ── 8×8 grids drawn with one box-shadow per lit cell on a
   single scaled div. Authentically cheap: rasterised once, never repainted. */
const MOB_GRIDS: string[][] = [
  ["..xxxx..", ".xxxxxx.", "xx.xx.xx", "xxxxxxxx", "xx.xx.xx", ".xxxxxx.", "..x..x..", ".xx..xx."],
  ["...xx...", "..xxxx..", ".xxxxxx.", "xx.xx.xx", "xxxxxxxx", ".x.xx.x.", "..xxxx..", ".x....x."],
  ["x......x", "xx....xx", "xxxxxxxx", "xx.xx.xx", "xxxxxxxx", "..xxxx..", ".xx..xx.", "xx....xx"],
  ["..xxxx..", ".x.xx.x.", "xxxxxxxx", "x.xxxx.x", "xxxxxxxx", "..x..x..", ".x.xx.x.", "x......x"],
  [".xx..xx.", "..xxxx..", ".xxxxxx.", "xxx.x.xx", "xxxxxxxx", ".xxxxxx.", "..x..x..", "..x..x.."],
];
const BOSS_GRID: string[] = [
  "..xx....xx..", ".xxx.xx.xxx.", "xxxxxxxxxxxx", "xx.xxxxxx.xx", "xxxxxxxxxxxx",
  "xxx.xxxx.xxx", "xxxxxxxxxxxx", ".xxxxxxxxxx.", "..xx.xx.xx..", ".xx..xx..xx.",
];
const MOB_TINTS = ["#6ecb63", "#5fa8ff", "#c07dff", "#ff8a5f", "#e2d06a"];

function PixelMob({ kind, boss, dead, scale = 5 }: { kind: number; boss?: boolean; dead?: boolean; scale?: number }) {
  const grid = boss ? BOSS_GRID : MOB_GRIDS[kind % MOB_GRIDS.length];
  const tint = boss ? "#ff5f5f" : MOB_TINTS[kind % MOB_TINTS.length];
  const shadow = useMemo(() => {
    const parts: string[] = [];
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "x") parts.push(`${x * scale}px ${y * scale}px 0 0 ${tint}`);
      }
    });
    return parts.join(",");
  }, [grid, tint, scale]);
  const w = grid[0].length * scale, h = grid.length * scale;
  return (
    <span aria-hidden className="relative block" style={{ width: w, height: h, opacity: dead ? 0.15 : 1, transition: "opacity .4s" }}>
      <span className="absolute left-0 top-0" style={{ width: scale, height: scale, boxShadow: shadow }} />
    </span>
  );
}

export default function DungeonPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [byId, setById] = useState<Record<string, CardDef>>({});
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [cards, setCards] = useState<DgnCard[]>([]);
  const [partyMax, setPartyMax] = useState(4);
  const [healCost, setHealCost] = useState(80);
  const [reviveCost, setReviveCost] = useState(500);
  const [busy, setBusy] = useState(false);

  const [screen, setScreen] = useState<"lobby" | "raid" | "results">("lobby");
  const [dungeonSel, setDungeonSel] = useState<string>("dgn_cellars");
  const [party, setParty] = useState<string[]>([]);

  // ── raid state ──
  const [runId, setRunId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [floorNum, setFloorNum] = useState(0);
  const [banked, setBanked] = useState({ ap: 0, shards: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "marching" | "fighting">("idle");
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [skipping, setSkipping] = useState(false);
  const [flash, setFlash] = useState<{ side: "p" | "e"; idx: number; t: number } | null>(null);
  const [pops, setPops] = useState<{ id: number; side: "p" | "e"; idx: number; text: string; crit?: boolean }[]>([]);
  const [bossFloor, setBossFloor] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [crt, setCrt] = useState(true);

  const speedRef = useRef(1);
  const skipRef = useRef(false);
  const stopRef = useRef(false);       // unmount / recall requested
  const recallRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popId = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    try { setCrt(localStorage.getItem("davinci_crt") !== "off"); } catch { /* fine */ }
  }, []);
  const toggleCrt = () => setCrt((v) => {
    const n = !v;
    try { localStorage.setItem("davinci_crt", n ? "on" : "off"); } catch { /* fine */ }
    return n;
  });

  // ── data ──
  const loadStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await fetch(`${API_URL}/api/dungeon/status/${user.id}`);
      const d = await r.json();
      if (!d?.success) return;
      setDungeons(d.data.dungeons || []);
      setCards(d.data.cards || []);
      setPartyMax(d.data.partyMax || 4);
      setHealCost(d.data.healCost ?? 80);
      setReviveCost(d.data.reviveCost ?? 500);
      // A run still in flight: reopen the raid screen paused between floors.
      const run = d.data.activeRun;
      if (run && run.status === "RUNNING") {
        const st = JSON.parse(run.state);
        setRunId(run.id);
        setUnits(st.party);
        setFloorNum(st.floor);
        setBanked({ ap: st.apEarned, shards: st.shardsEarned });
        setEnemies([]);
        setLog((l) => l.length ? l : [`> party is ${st.floor === 0 ? "at the entrance" : `resting past floor ${st.floor}`}.`]);
        setScreen("raid");
        setPhase("idle");
      }
    } catch { /* offline */ }
  }, [user?.id]);

  useEffect(() => { loadCatalog(API_URL, (cat: any) => {
    const cardsArr: CardDef[] = cat?.cards || [];
    setById(Object.fromEntries(cardsArr.map((c) => [c.id, c])));
  }, () => {}); }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => () => { stopRef.current = true; if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const post = async (path: string, body: any) => {
    const r = await fetch(`${API_URL}/api/dungeon${path}`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user?.id, ...body }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.message || "That didn't work.");
    return d.data;
  };

  // ── playback ──
  const nap = (ms: number) => new Promise<void>((ok) => {
    if (skipRef.current) return ok();
    setTimeout(ok, ms / speedRef.current);
  });
  const pushLog = (line: string) => setLog((l) => [...l.slice(-59), line]);
  const pop = (side: "p" | "e", idx: number, text: string, crit?: boolean) => {
    const id = ++popId.current;
    setPops((p) => [...p, { id, side, idx, text, crit }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 750);
  };
  const flashNow = (side: "p" | "e", idx: number) => setFlash({ side, idx, t: Date.now() });

  async function playEvents(evts: Ev[], liveUnits: Unit[]) {
    for (const ev of evts) {
      if (stopRef.current) return;
      if (ev.k === "spawn") {
        setEnemies(ev.enemies.map((e) => ({ ...e })));
        setBossFloor(!!ev.enemies[0]?.boss);
        pushLog(`> ${ev.enemies.length === 1 ? ev.enemies[0].name : `${ev.enemies.length} enemies`} ahead${ev.enemies[0]?.boss ? " — BOSS" : ""}.`);
        await nap(650);
      } else if (ev.k === "phit") {
        flashNow("e", ev.e);
        pop("e", ev.e, `-${ev.dmg}`, !!ev.crit);
        setEnemies((es) => es.map((e, i) => i === ev.e ? { ...e, hp: Math.max(0, e.hp - ev.dmg) } : e));
        if (ev.crit) pushLog(`> ${liveUnits[ev.i]?.name ?? "?"} CRITS for ${ev.dmg}!`);
        await nap(ev.crit ? 380 : 260);
      } else if (ev.k === "ekill") {
        setEnemies((es) => es.map((e, i) => i === ev.e ? { ...e, hp: 0 } : e));
        pushLog(`> enemy down.`);
        await nap(300);
      } else if (ev.k === "ehit") {
        flashNow("p", ev.i);
        pop("p", ev.i, `-${ev.dmg}`);
        liveUnits[ev.i] = { ...liveUnits[ev.i], hp: Math.max(0, liveUnits[ev.i].hp - ev.dmg) };
        setUnits([...liveUnits]);
        await nap(260);
      } else if (ev.k === "fall") {
        pushLog(`> ${liveUnits[ev.i]?.name ?? "?"} HAS FALLEN.`);
        await nap(520);
      } else if (ev.k === "clear") {
        setBanked((b) => ({ ap: b.ap + ev.ap, shards: b.shards + ev.shards }));
        pushLog(`> floor cleared. +${ev.ap} AP${ev.shards ? ` +${ev.shards} shards` : ""} (unbanked).`);
        await nap(600);
      } else if (ev.k === "wipe") {
        pushLog(`> ...the dungeon goes quiet.`);
        await nap(900);
      }
    }
  }

  async function stepFloor(id: string) {
    if (stopRef.current || recallRef.current) return;
    setPhase("marching");
    pushLog(`> descending to floor ${floorRefSafe() + 1}...`);
    await nap(850);
    if (stopRef.current || recallRef.current) { setPhase("idle"); return; }
    setPhase("fighting");
    let data: any;
    try {
      data = await post(`/${id}/advance`, {});
    } catch (e: any) {
      toast(e.message || "The dungeon didn't answer.", "error");
      setPhase("idle");
      return;
    }
    await playEvents(data.events as Ev[], unitsRef.current.map((u) => ({ ...u })));
    // After the reel, trust the SERVER's numbers, never our reconstruction.
    setUnits(data.party);
    setFloorNum(data.floor);
    setBanked({ ap: data.apEarned, shards: data.shardsEarned });
    if (data.done) {
      setResult(data.result);
      setPhase("idle");
      setSkipping(false);
      skipRef.current = false;
      setScreen("results");
      loadStatus();
      return;
    }
    setPhase("idle");
    // auto-advance after a breath — the breath is when RECALL is answerable
    timerRef.current = setTimeout(() => { void stepFloor(id); }, skipRef.current ? 0 : 1200 / speedRef.current);
  }

  // refs that playback reads to dodge stale closures
  const unitsRef = useRef<Unit[]>([]);
  useEffect(() => { unitsRef.current = units; }, [units]);
  const floorNumRef = useRef(0);
  useEffect(() => { floorNumRef.current = floorNum; }, [floorNum]);
  const floorRefSafe = () => floorNumRef.current;

  const dispatch = async () => {
    if (!user || party.length === 0) return;
    setBusy(true);
    try {
      const d = await post("", { dungeon: dungeonSel, cardIds: party });
      setRunId(d.run.id);
      setUnits(d.party);
      setFloorNum(0);
      setBanked({ ap: 0, shards: 0 });
      setEnemies([]);
      setLog([`> party of ${d.party.length} enters ${dungeons.find((x) => x.id === dungeonSel)?.name ?? "the dark"}.`]);
      setResult(null);
      recallRef.current = false;
      stopRef.current = false;
      setScreen("raid");
      timerRef.current = setTimeout(() => { void stepFloor(d.run.id); }, 700);
    } catch (e: any) {
      toast(e.message || "Couldn't dispatch.", "error");
    } finally { setBusy(false); }
  };

  const recall = async () => {
    if (!runId) return;
    recallRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setBusy(true);
    try {
      const d = await post(`/${runId}/recall`, {});
      setResult(d);
      setScreen("results");
      loadStatus();
    } catch (e: any) {
      toast(e.message || "Couldn't recall.", "error");
      recallRef.current = false;
    } finally { setBusy(false); }
  };

  const resume = () => {
    if (!runId) return;
    recallRef.current = false;
    stopRef.current = false;
    timerRef.current = setTimeout(() => { void stepFloor(runId); }, 400);
  };

  const heal = async (cardId: string) => {
    setBusy(true);
    try { await post("/heal", { cardId }); toast("Healed.", "success"); await loadStatus(); }
    catch (e: any) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };
  const revive = async (cardId: string) => {
    setBusy(true);
    try { await post("/revive", { cardId }); toast("It stands back up.", "success"); await loadStatus(); }
    catch (e: any) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  // ── lobby derived ──
  const dgn = dungeons.find((d) => d.id === dungeonSel);
  const partyCards = party.map((id) => cards.find((c) => c.cardId === id)).filter(Boolean) as DgnCard[];
  const power = partyCards.reduce((n, c) => {
    const def = byId[c.cardId];
    if (!def) return n;
    const s = effStats(c, def.rarity);
    return n + s.atk + s.maxHp;
  }, 0);
  const ratio = dgn ? power / Math.max(1, dgn.recPower) : 0;
  const estimate = !dgn || party.length === 0 ? null
    : ratio >= 1.3 ? { label: "OVERWHELMING", tone: "#5fd18a", hint: "should walk the whole thing" }
    : ratio >= 1.0 ? { label: "FAVOURABLE", tone: "#a4d65f", hint: "bosses will leave marks" }
    : ratio >= 0.72 ? { label: "RISKY", tone: "#ffd23e", hint: "expect injuries. maybe worse" }
    : { label: "A FUNERAL", tone: "#ff5f5f", hint: "they will not all come home" };

  const toggle = (id: string) => {
    const c = cards.find((x) => x.cardId === id);
    if (!c || c.dgnDead) return;
    setParty((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < partyMax ? [...p, id] : p);
  };

  return (
    <PageTransition>
      <div className="dg-root relative min-h-screen overflow-x-hidden px-3 pb-28 pt-24 text-[#e8e3d0] sm:px-4">
        {/* ── the whole mode's pixel styling, scoped here ── */}
        <style dangerouslySetInnerHTML={{ __html: DG_CSS }} />
        {crt && <div aria-hidden className="dg-crt" />}

        <div className="mx-auto max-w-5xl">
          {/* header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-pixel text-[9px] text-[#8f86b8]">DA VINCI · EXPEDITIONS</p>
              <h1 className="font-pixel mt-2 text-xl leading-relaxed text-[#ffd23e] sm:text-2xl" style={{ textShadow: "3px 3px 0 #3a2b00" }}>
                DUNGEON DISPATCH
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="dg-panel px-3 py-2 font-pixel text-[10px] text-[#9be8ff]">
                {user ? displayArisePoints(user) : "—"} AP
              </span>
              <button onClick={toggleCrt} className="dg-btn px-3 py-2 font-pixel text-[9px]" title="CRT scanlines">
                CRT {crt ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          {/* ══ LOBBY ══ */}
          {screen === "lobby" && (
            <div className="space-y-6">
              {/* dungeon select */}
              <div>
                <p className="font-pixel mb-2 text-[10px] text-[#8f86b8]">SELECT DUNGEON</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {dungeons.map((d) => {
                    const on = d.id === dungeonSel;
                    return (
                      <button key={d.id} onClick={() => setDungeonSel(d.id)}
                        className={`dg-panel dg-press p-3 text-left ${on ? "dg-sel" : ""}`}>
                        <p className="font-pixel text-[10px] leading-relaxed" style={{ color: on ? "#ffd23e" : "#e8e3d0" }}>{d.name}</p>
                        <p className="mt-2 font-mono text-[11px] text-[#8f86b8]">FLOORS 1–{d.depth} · BOSS EVERY 5TH</p>
                        <p className="font-mono text-[11px] text-[#8f86b8]">REC POWER {d.recPower} · PAY ×{d.apMul}</p>
                        <p className="mt-2 font-mono text-[11px] italic text-[#6b6390]">{d.flavor}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* party slots + estimate + dispatch */}
              <div className="dg-panel p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: partyMax }, (_, i) => {
                      const id = party[i];
                      const def = id ? byId[id] : null;
                      const art = id ? cardArt(id, undefined, 64) : null;
                      return (
                        <button key={i} onClick={() => id && toggle(id)}
                          className="dg-slot grid place-items-center overflow-hidden"
                          title={def?.name || "Empty slot"}>
                          {art
                            ? <img src={art} alt="" className="dg-pix h-full w-full object-cover" />
                            : def
                            ? <span className="font-pixel text-[8px]">{def.name.slice(0, 2)}</span>
                            : <span className="font-pixel text-[10px] text-[#4c4470]">+</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px] text-[#8f86b8]">PARTY POWER <b className="text-[#e8e3d0]">{power}</b>{dgn ? ` / REC ${dgn.recPower}` : ""}</p>
                    {estimate && (
                      <p className="font-pixel mt-1 text-[9px]" style={{ color: estimate.tone }}>
                        {estimate.label} <span className="font-mono text-[10px] text-[#8f86b8]">— {estimate.hint}</span>
                      </p>
                    )}
                  </div>
                  <button onClick={dispatch} disabled={busy || party.length === 0}
                    className="dg-btn dg-btn-gold px-5 py-3 font-pixel text-[10px] disabled:opacity-40">
                    ▶ DISPATCH
                  </button>
                </div>
              </div>

              {/* roster */}
              <div>
                <p className="font-pixel mb-2 text-[10px] text-[#8f86b8]">YOUR UNITS — TAP TO ADD</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {cards.map((c) => {
                    const def = byId[c.cardId];
                    if (!def) return null;
                    const s = effStats(c, def.rarity);
                    const picked = party.includes(c.cardId);
                    const art = cardArt(c.cardId, undefined, 64);
                    const status = c.dgnDead ? "DEAD" : c.dgnInjured ? "INJURED" : s.hp < s.maxHp ? "WOUNDED" : "HEALTHY";
                    const statusTone = c.dgnDead ? "#ff5f5f" : c.dgnInjured ? "#ffd23e" : s.hp < s.maxHp ? "#ffb45f" : "#5fd18a";
                    return (
                      <div key={c.cardId}
                        className={`dg-panel relative p-2 ${picked ? "dg-sel" : ""} ${c.dgnDead ? "opacity-70" : ""}`}>
                        <button onClick={() => toggle(c.cardId)} disabled={c.dgnDead}
                          className="flex w-full items-center gap-2 text-left disabled:cursor-not-allowed">
                          <span className="dg-frame shrink-0" style={{ borderColor: RARITY_TINT[def.rarity] || "#9aa4b2" }}>
                            {art
                              ? <img src={art} alt="" className={`dg-pix h-full w-full object-cover ${c.dgnDead ? "grayscale" : ""}`} />
                              : <span className="font-pixel text-[8px]">{def.name.slice(0, 2)}</span>}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-pixel text-[8px] leading-relaxed">{def.name}</span>
                            <span className="block font-mono text-[10px] text-[#8f86b8]">LV.{c.level}{c.foil ? " ★FOIL" : ""} · ATK {s.atk}</span>
                            <span className="mt-1 block h-[7px] w-full border border-[#3a3357] bg-[#141024]">
                              <span className="block h-full" style={{
                                width: `${Math.round((s.hp / Math.max(1, s.maxHp)) * 100)}%`,
                                background: s.hp / s.maxHp > 0.5 ? "#5fd18a" : s.hp / s.maxHp > 0.25 ? "#ffd23e" : "#ff5f5f",
                              }} />
                            </span>
                            <span className="mt-0.5 flex items-center justify-between font-mono text-[10px]">
                              <b style={{ color: statusTone }}>{status}</b>
                              <span className="text-[#8f86b8]">{s.hp}/{s.maxHp}</span>
                            </span>
                          </span>
                        </button>
                        {(c.dgnDead || c.dgnInjured || (s.hp < s.maxHp && !c.dgnDead)) && (
                          <button
                            onClick={() => c.dgnDead ? revive(c.cardId) : heal(c.cardId)}
                            disabled={busy}
                            className="dg-btn mt-2 w-full px-2 py-1.5 font-pixel text-[8px] disabled:opacity-40">
                            {c.dgnDead ? `REVIVE · ${reviveCost} AP` : `HEAL · ${healCost} AP`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <p className="col-span-full py-10 text-center font-mono text-sm text-[#8f86b8]">
                      No units. Open a pack in the Archive first.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ RAID ══ */}
          {screen === "raid" && (
            <div className="space-y-3">
              {/* status strip */}
              <div className="dg-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <p className="font-pixel text-[11px]" style={{ color: bossFloor && phase === "fighting" ? "#ff5f5f" : "#ffd23e" }}>
                  {phase === "marching" ? "DESCENDING..." : `FLOOR ${Math.max(1, floorNum + (phase === "fighting" ? 1 : 0))}`}
                  {bossFloor && phase === "fighting" ? " · BOSS" : ""}
                </p>
                <p className="font-mono text-[11px] text-[#8f86b8]">
                  UNBANKED <b className="text-[#9be8ff]">{banked.ap} AP</b>{banked.shards > 0 ? <> · <b className="text-[#9be8ff]">{banked.shards} SH</b></> : null}
                </p>
                <div className="flex items-center gap-1.5">
                  {([1, 2] as const).map((x) => (
                    <button key={x} onClick={() => setSpeed(x)}
                      className={`dg-btn px-2.5 py-1.5 font-pixel text-[8px] ${speed === x && !skipping ? "dg-btn-gold" : ""}`}>
                      {x}X
                    </button>
                  ))}
                  <button onClick={() => { setSkipping(true); skipRef.current = true; }}
                    disabled={skipping}
                    className={`dg-btn px-2.5 py-1.5 font-pixel text-[8px] ${skipping ? "dg-btn-gold" : ""}`}>
                    SKIP▶▶
                  </button>
                </div>
              </div>

              {/* the stage */}
              <div className={`dg-panel dg-stage relative overflow-hidden ${phase === "marching" ? "dg-marching" : ""}`}>
                <div aria-hidden className="dg-bg dg-bg-far" />
                <div aria-hidden className="dg-bg dg-bg-mid" />
                <div aria-hidden className="dg-bg dg-bg-near" />

                {/* party, left */}
                <div className="absolute bottom-6 left-3 flex items-end gap-2 sm:left-6 sm:gap-3">
                  {units.map((u, i) => {
                    const art = cardArt(u.cardId, undefined, 64);
                    const dead = u.hp <= 0;
                    const hitP = flash?.side === "p" && flash.idx === i;
                    return (
                      <div key={u.cardId} className="relative flex flex-col items-center" style={{ zIndex: 10 - i }}>
                        {pops.filter((p) => p.side === "p" && p.idx === i).map((p) => (
                          <span key={p.id} className="dg-pop font-pixel text-[10px] text-[#ff5f5f]">{p.text}</span>
                        ))}
                        <div className={`dg-frame-lg ${dead ? "dg-dead" : "dg-bob"} ${hitP ? "dg-hit" : ""}`}
                          style={{ borderColor: RARITY_TINT[u.rarity] || "#9aa4b2", animationDelay: `${i * 0.22}s` }}>
                          {art
                            ? <img src={art} alt={u.name} className={`dg-pix h-full w-full object-cover ${dead ? "grayscale" : ""}`} />
                            : <span className="font-pixel text-[8px]">{u.name.slice(0, 2)}</span>}
                        </div>
                        <span className="mt-1 block h-[6px] w-12 border border-[#3a3357] bg-[#141024] sm:w-14">
                          <span className="block h-full" style={{
                            width: `${Math.round((Math.max(0, u.hp) / Math.max(1, u.maxHp)) * 100)}%`,
                            background: u.hp / u.maxHp > 0.5 ? "#5fd18a" : u.hp / u.maxHp > 0.25 ? "#ffd23e" : "#ff5f5f",
                          }} />
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* enemies, right */}
                <div className="absolute bottom-8 right-3 flex items-end gap-3 sm:right-8 sm:gap-4">
                  {enemies.map((e, i) => {
                    const dead = e.hp <= 0;
                    const hitE = flash?.side === "e" && flash.idx === i;
                    return (
                      <div key={`${floorNum}-${i}`} className="relative flex flex-col items-center">
                        {pops.filter((p) => p.side === "e" && p.idx === i).map((p) => (
                          <span key={p.id} className={`dg-pop font-pixel ${p.crit ? "text-[12px] text-[#ffd23e]" : "text-[10px] text-[#e8e3d0]"}`}>
                            {p.text}{p.crit ? "!" : ""}
                          </span>
                        ))}
                        <div className={`${dead ? "" : "dg-bob-e"} ${hitE ? "dg-hit" : ""}`} style={{ animationDelay: `${i * 0.3}s` }}>
                          <PixelMob kind={e.kind} boss={e.boss} dead={dead} scale={e.boss ? 6 : 5} />
                        </div>
                        {!dead && (
                          <span className="mt-1 block h-[6px] w-12 border border-[#3a3357] bg-[#141024]">
                            <span className="block h-full bg-[#ff5f5f]" style={{ width: `${Math.round((e.hp / Math.max(1, e.maxHp)) * 100)}%` }} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {skipping && (
                  <p className="font-pixel absolute left-1/2 top-3 -translate-x-1/2 text-[9px] text-[#ffd23e]">FAST-FORWARDING...</p>
                )}
              </div>

              {/* log + controls */}
              <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                <div className="dg-panel h-36 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed text-[#7fe07f]">
                  {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={recall} disabled={busy || phase !== "idle" || skipping || !!result}
                    className="dg-btn dg-btn-red flex-1 px-4 py-3 font-pixel text-[10px] disabled:opacity-40"
                    title={phase !== "idle" ? "Recall answers between floors" : "Bank everything and come home"}>
                    ◀ RECALL PARTY
                  </button>
                  {phase === "idle" && !result && log.length <= 1 && (
                    <button onClick={resume} disabled={busy}
                      className="dg-btn dg-btn-gold px-4 py-3 font-pixel text-[10px] disabled:opacity-40">
                      ▶ CONTINUE
                    </button>
                  )}
                  <p className="font-mono text-[10px] leading-relaxed text-[#6b6390]">
                    The party fights alone. Recall between floors to bank — a wipe forfeits everything unbanked.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══ RESULTS ══ */}
          {screen === "results" && result && (
            <div className="mx-auto max-w-xl">
              <div className="dg-panel p-4 text-center">
                <p className="font-pixel text-[13px] leading-relaxed"
                  style={{ color: result.status === "WIPED" ? "#ff5f5f" : result.status === "CLEARED" ? "#ffd23e" : "#5fd18a" }}>
                  {result.status === "WIPED" ? "THE PARTY FELL" : result.status === "CLEARED" ? "DUNGEON CLEARED!" : "PARTY RECALLED"}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="dg-panel p-2">
                    <p className="font-pixel text-[12px] text-[#e8e3d0]">{result.floors}</p>
                    <p className="font-mono text-[10px] text-[#8f86b8]">FLOORS</p>
                  </div>
                  <div className="dg-panel p-2">
                    <p className="font-pixel text-[12px] text-[#9be8ff]">{result.ap}</p>
                    <p className="font-mono text-[10px] text-[#8f86b8]">AP BANKED</p>
                  </div>
                  <div className="dg-panel p-2">
                    <p className="font-pixel text-[12px] text-[#9be8ff]">{result.shards}</p>
                    <p className="font-mono text-[10px] text-[#8f86b8]">SHARDS</p>
                  </div>
                </div>
                {result.status === "WIPED" && (result.lostAp || 0) > 0 && (
                  <p className="mt-3 font-mono text-[11px] text-[#ff5f5f]">
                    LOST UNBANKED: {result.lostAp} AP{result.lostShards ? ` · ${result.lostShards} SHARDS` : ""}
                  </p>
                )}
                <div className="mt-4 space-y-1.5 text-left">
                  {result.party.map((p) => {
                    const art = cardArt(p.cardId, undefined, 64);
                    const tone = p.outcome === "died" ? "#ff5f5f" : p.outcome === "injured" ? "#ffd23e" : p.outcome === "wounded" ? "#ffb45f" : "#5fd18a";
                    const label = p.outcome === "died" ? "DIED" : p.outcome === "injured" ? "INJURED — heal before the next run" : p.outcome === "wounded" ? `WOUNDED ${p.hp}/${p.maxHp}` : "UNSCATHED";
                    return (
                      <div key={p.cardId} className="dg-panel flex items-center gap-2 p-2">
                        <span className="dg-frame shrink-0" style={{ borderColor: RARITY_TINT[p.rarity] || "#9aa4b2" }}>
                          {art && <img src={art} alt="" className={`dg-pix h-full w-full object-cover ${p.outcome === "died" ? "grayscale" : ""}`} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-pixel text-[8px] leading-relaxed">{p.name}</span>
                        <span className="shrink-0 font-mono text-[10px] font-bold" style={{ color: tone }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => { setScreen("lobby"); setResult(null); setRunId(null); setParty([]); setLog([]); }}
                  className="dg-btn dg-btn-gold mt-5 w-full px-4 py-3 font-pixel text-[10px]">
                  ▶ BACK TO THE LOBBY
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

/** All the retro in one place. steps() everywhere — smooth easing would give
 *  the whole thing away. */
const DG_CSS = `
.dg-root { background:
  radial-gradient(90% 40% at 50% -5%, #1c1633, transparent 70%), #0d0a18; }
.dg-panel { background: #1a1530; border: 3px solid #3a3357; box-shadow: 0 3px 0 0 #0a0714; }
.dg-sel { border-color: #ffd23e; box-shadow: 0 3px 0 0 #3a2b00; }
.dg-btn { background: #2a2347; border: 3px solid #4c4470; color: #e8e3d0;
  box-shadow: 0 3px 0 0 #0a0714; transition: none; }
.dg-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 0 0 0 #0a0714; }
.dg-btn-gold { background: #7a5c00; border-color: #ffd23e; color: #ffe9a3; }
.dg-btn-red { background: #5c1414; border-color: #ff5f5f; color: #ffb4b4; }
.dg-slot { width: 52px; height: 52px; background: #141024; border: 3px dashed #3a3357; }
.dg-slot img { border: none; }
.dg-frame { display: grid; place-items: center; width: 44px; height: 44px; background: #141024; border: 3px solid; }
.dg-frame-lg { display: grid; place-items: center; width: 56px; height: 56px; background: #141024; border: 3px solid; }
.dg-pix { image-rendering: pixelated; }
.dg-stage { height: 300px; }
@media (min-width: 640px) { .dg-stage { height: 340px; } }
.dg-bg { position: absolute; inset: 0; background-repeat: repeat-x; }
.dg-bg-far { background-image: linear-gradient(#181229 0 62%, #221a3d 62% 66%, transparent 66%); }
.dg-bg-mid { background-image:
  repeating-linear-gradient(90deg, transparent 0 90px, #221a3d 90px 118px, transparent 118px 240px);
  background-size: 240px 100%; opacity: .8; }
.dg-bg-near { background-image:
  linear-gradient(transparent 0 82%, #241d42 82% 86%, #141024 86%),
  repeating-linear-gradient(90deg, transparent 0 34px, #2c2450 34px 38px, transparent 38px 72px);
  background-size: 100% 100%, 72px 100%; }
.dg-marching .dg-bg-far  { animation: dg-scroll 2.4s steps(12) infinite; }
.dg-marching .dg-bg-mid  { animation: dg-scroll 1.2s steps(12) infinite; }
.dg-marching .dg-bg-near { animation: dg-scroll .6s steps(12) infinite; }
@keyframes dg-scroll { from { background-position-x: 0; } to { background-position-x: -240px; } }
.dg-bob   { animation: dg-bob 1s steps(2) infinite; }
.dg-bob-e { animation: dg-bob 1.2s steps(2) infinite; }
@keyframes dg-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.dg-hit { animation: dg-hitflash .18s steps(2) 2; }
@keyframes dg-hitflash { 0%,100% { filter: none; } 50% { filter: brightness(3) saturate(0); } }
.dg-dead { transform: rotate(90deg) translateX(8px); opacity: .35; filter: grayscale(1); }
.dg-pop { position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
  animation: dg-pop .7s steps(6) forwards; pointer-events: none; white-space: nowrap; text-shadow: 2px 2px 0 #000; z-index: 30; }
@keyframes dg-pop { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, -26px); opacity: 0; } }
.dg-crt { position: fixed; inset: 0; z-index: 40; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px);
  mix-blend-mode: multiply; }
@media (prefers-reduced-motion: reduce) {
  .dg-bob, .dg-bob-e, .dg-marching .dg-bg-far, .dg-marching .dg-bg-mid, .dg-marching .dg-bg-near { animation: none !important; }
}
`;
