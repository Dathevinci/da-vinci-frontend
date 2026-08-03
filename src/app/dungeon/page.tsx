"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { displayArisePoints } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef } from "@/components/cards/CardFace";
import { cardArt } from "@/data/cardArt";
import { loadCatalog } from "@/lib/catalogCache";
import { swrJson } from "@/lib/swrCache";

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
  /** Skill/domain rank — the same track the duels train. */
  skillLevel?: number;
  dgnHp: number | null; dgnInjured: boolean; dgnDead: boolean;
  dgnDeaths?: number;
  /** Per-card revival price from the server: rarity base × prior deaths. */
  reviveCost?: number;
  atkForge?: number;
  hpForge?: number;
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
  | { k: "domain"; i: number; name: string; text: string }
  | { k: "pheal"; i: number; amt: number }
  | { k: "note"; text: string }
  | { k: "clear"; ap: number; shards: number }
  | { k: "wipe" };
type RunResult = {
  status: string; floors: number; ap: number; shards: number;
  lostAp?: number; lostShards?: number;
  party: { cardId: string; name: string; rarity: string; hp: number; maxHp: number; outcome: string }[];
};

/** Effective (display) stats for a card in the lobby — injury AND forge
 *  included, matching makeUnit on the server point for point. */
function effStats(c: DgnCard, rarity: string) {
  const base = DGN_STATS[rarity] || DGN_STATS.common;
  const m = (c.foil ? 1.2 : 1) * lvlMult(c.level);
  const fullMax = Math.round(base.hp * m) + (c.hpForge || 0) * 2;
  const maxHp = c.dgnInjured ? Math.max(1, Math.round(fullMax * 0.7)) : fullMax;
  const hp = c.dgnDead ? 0 : c.dgnHp === null ? maxHp : Math.min(c.dgnHp, maxHp);
  return { maxHp, hp, atk: Math.round(base.atk * m) + (c.atkForge || 0) };
}

const RARITY_TINT: Record<string, string> = {
  common: "#9aa4b2", rare: "#5fa8ff", epic: "#c07dff", legendary: "#ffcf5c", event: "#ff8ad0",
};

/** What a support card DOES down there — the duel effect, dungeon-phrased,
 *  at ITS level. Support levels raise the effect (never ATK/HP); the math
 *  mirrors supMult in the server's use-support handler point for point. */
function supText(s: any, lvl = 1): string {
  if (!s) return "";
  const m = lvlMult(lvl);
  return s.kind === "heal" ? `heals the worst-off +${Math.round(s.power * m)} HP, instantly`
    : s.kind === "mend" ? `heals EVERY living unit +${Math.round(s.power * m)} HP, instantly`
    : s.kind === "revive" ? `a FALLEN unit stands back up at ${Math.min(95, Math.round(s.power * m))}% — mid-run`
    : s.kind === "shield" ? "next floor: first 2 enemy volleys land HALVED"
    : s.kind === "block" ? "next floor: the first enemy volley does NOT land"
    : s.kind === "focus" ? `next floor: opening volley ×${Number((1 + (s.power - 1) * m).toFixed(2))}`
    : s.kind === "bless" ? `heals EVERY living unit ${Math.min(80, Math.round(s.power * 100 * m))}% of max HP, instantly`
    : s.kind === "arise" ? `ARISE — every fallen unit stands at ${Math.min(25, Math.round(s.power * 100 * m))}%, +${Math.min(40, Math.round(20 * m))}% ATK lasting`
    : s.kind === "pact" ? `the strongest pays half their HP — party hits ${Math.min(90, Math.round(50 * m))}% harder and 25% tougher, lasting`
    : s.kind === "reflect" ? `the next 3 blows that land come back ${Math.min(80, Math.round(s.power * 100 * m))}% on the enemy`
    : s.kind === "stone" ? `next floor: 2 whole volleys MISS · +${Math.min(60, Math.round(s.power * m))}% ATK lasting`
    : s.kind === "mirror" ? `${Math.min(30, Math.round(s.power * 100 * m))}% of enemy damage returns — and heals, lasting`
    : "it does something, somewhere";
}
const SUP_TONE: Record<string, string> = {
  heal: "#7fe07f", mend: "#7fe07f", revive: "#ffd23e",
  shield: "#9be8ff", block: "#9be8ff", focus: "#ffb45f",
  bless: "#7fe07f", arise: "#ffd23e", pact: "#ff6b81",
  reflect: "#ffd23e", stone: "#c9b8ff", mirror: "#9be8ff",
};
const dgnTier = (id: string) => id === "dgn_keep" ? 2 : id === "dgn_orchard" ? 1 : 0;

/* ── PIXEL BESTIARY ── Hollow-Knight-style silhouettes: near-black bodies
   with pale glowing eyes, one grid per creature, one set per BIOME.
   `x` = body cell, `o` = eye cell. Drawn as two box-shadow layers on one
   scaled div — rasterised once, never repainted. */
const BIOME_MOBS: string[][][] = [
  [ // 0 · THE MILDEW CELLARS — soft things that grew in the dark
    ["..xxxx..", ".xxxxxx.", "xxxxxxxx", "xo.xx.ox", "xxxxxxxx", "..x..x..", ".x....x.", "x......x"],   // shroomling
    ["........", "..xxx...", ".xxxxxx.", "xxo..ox.", "xxxxxxxx", "xxxxxxxx", "x.x.x.x.", "x.x.x.x."],   // damp crawler
    ["..xxxx..", ".x....x.", "x..oo..x", "x......x", ".x....x.", "..xxxx..", "...xx...", "..x..x.."],   // wall jelly
    [".x.xx.x.", "xxxxxxxx", "x.o..o.x", "xxxxxxxx", ".xxxxxx.", "..xxxx..", ".x.xx.x.", "x..xx..x"],   // mildew knot
  ],
  [ // 1 · THE BONE ORCHARD — thin dead things among the trees
    ["...xx...", "..xxxx..", ".xo..ox.", ".xxxxxx.", "..xxxx..", "...xx...", "...xx...", "..x..x.."],   // orchard wight
    ["x......x", ".x....x.", "..xxxx..", ".xxooxx.", "xxxxxxxx", "..x..x..", ".x....x.", "x......x"],   // bone picker
    [".x....x.", "x.x..x.x", "x.xxxx.x", "..xoox..", ".xxxxxx.", "..xxxx..", "...xx...", "..x..x.."],   // marrow wasp
    ["..xxxx..", ".xxxxxx.", "xx.oo.xx", "xxxxxxxx", ".x.xx.x.", "..xxxx..", "..x..x..", ".xx..xx."],   // grave tender
  ],
  [ // 2 · THE SUNLESS KEEP — armour that never stood down
    [".xxxxxx.", "xxxxxxxx", "xo....ox", "xxxxxxxx", "xxxxxxxx", "x.xxxx.x", "..x..x..", ".xx..xx."],   // sentinel
    ["......x.", ".....xx.", "..xxxx..", ".xxoox..", "xxxxxx..", "..xx....", ".x..x...", "x....x.."],   // dark lancer
    ["xx....xx", "xxx..xxx", "xxxxxxxx", "xo.xx.ox", "xxxxxxxx", "x.x..x.x", ".x....x.", "x......x"],   // vault horror
    ["..xxxx..", ".xxxxxx.", ".x.oo.x.", ".xxxxxx.", "..xxxx..", "..xxxx..", "..x..x..", "..x..x.."],   // sunless monk
  ],
];
const BIOME_BOSS: string[][] = [
  [ // The Cellar King — a crowned mass of growth
    "..x..xx..x..", ".xx.xxxx.xx.", "xxxxxxxxxxxx", "xxo.xxxx.oxx", "xxxxxxxxxxxx",
    "xxxxxxxxxxxx", ".xxxxxxxxxx.", "..xx.xx.xx..", ".x..x..x..x.", "x...x..x...x",
  ],
  [ // What Tends the Orchard — tall, thin, wrong
    ".....xx.....", "....xxxx....", "...xxooxx...", "....xxxx....", "..xxxxxxxx..",
    ".x.xxxxxx.x.", "x..xxxxxx..x", "...xx..xx...", "...xx..xx...", "..xx....xx..",
  ],
  [ // Warden of the Sunless — a door that fights back
    "xxxxxxxxxxxx", "xxxxxxxxxxxx", "xxo......oxx", "xxxxxxxxxxxx", "xx.xxxxxx.xx",
    "xxxxxxxxxxxx", "xxxxxxxxxxxx", ".xx.x..x.xx.", ".xx.x..x.xx.", "xxx.x..x.xxx",
  ],
];
const BIOME_BODY = ["#1c3325", "#332b1e", "#1c2c40"];
const BIOME_BOSS_BODY = ["#2a4a33", "#4a3e28", "#2b4058"];
const EYE = "#e8f6ff";

function PixelMob({ kind, boss, dead, scale = 5, tier = 0 }: {
  kind: number; boss?: boolean; dead?: boolean; scale?: number; tier?: number;
}) {
  const t = Math.max(0, Math.min(2, tier));
  const grid = boss ? BIOME_BOSS[t] : BIOME_MOBS[t][kind % BIOME_MOBS[t].length];
  const body = boss ? BIOME_BOSS_BODY[t] : BIOME_BODY[t];
  const { bodyShadow, eyeShadow } = useMemo(() => {
    const bodyParts: string[] = [];
    const eyeParts: string[] = [];
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "x") bodyParts.push(`${x * scale}px ${y * scale}px 0 0 ${body}`);
        else if (row[x] === "o") eyeParts.push(`${x * scale}px ${y * scale}px 0 0 ${EYE}`);
      }
    });
    return { bodyShadow: bodyParts.join(","), eyeShadow: eyeParts.join(",") };
  }, [grid, body, scale]);
  const w = grid[0].length * scale, h = grid.length * scale;
  return (
    <span aria-hidden className="relative block" style={{ width: w, height: h, opacity: dead ? 0.15 : 1, transition: "opacity .4s" }}>
      <span className="absolute left-0 top-0" style={{ width: scale, height: scale, boxShadow: bodyShadow }} />
      {/* the eyes carry the glow — dead things go dark first */}
      {!dead && eyeShadow && (
        <span className="absolute left-0 top-0 dg-eyes" style={{ width: scale, height: scale, boxShadow: eyeShadow }} />
      )}
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

  // ── the pack ── up to three of the player's OWN SUPPORT CARDS, chosen at
  // dispatch and PLAYED by the player mid-run. Same cards as the duels, one
  // use each per run — nothing consumed.
  const [supportIds, setSupportIds] = useState<string[]>([]);
  const [supLevels, setSupLevels] = useState<Record<string, number>>({});
  const [packMax, setPackMax] = useState(3);
  const [packed, setPacked] = useState<string[]>([]);
  const [runSupports, setRunSupports] = useState<{ id: string; used: boolean }[]>([]);
  const [armed, setArmed] = useState<{ ward?: boolean; focus?: boolean; block?: boolean }>({});
  const [itemBusy, setItemBusy] = useState(false);
  // which biome the LIVE run is in — drives the stage's environment + bestiary
  const [runBio, setRunBio] = useState(0);
  // real card sizes for the lobby — the binder-fit lesson: fixed tiles must
  // shrink on a phone or the page grows a sideways pan
  const [smallScr, setSmallScr] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmallScr(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const rosterSize = smallScr ? 130 : 150;
  const supSize = smallScr ? 104 : 122;

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
  // A domain expansion takes the stage over for a beat — pixel style, but
  // unmistakably the same moment the arena makes of it.
  const [domainShow, setDomainShow] = useState<{ name: string; text: string; who: string } | null>(null);

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
  const loadStatus = useCallback(async (useCache = false) => {
    if (!user?.id) return;
    // Applied twice on the cached path (cache, then network). The RUN resume
    // only ever fires from FRESH data — a stale cached run could reopen a
    // raid screen for a run that already ended.
    const apply = (d: any, fromCache: boolean) => {
      setDungeons(d.dungeons || []);
      setCards(d.cards || []);
      setPartyMax(d.partyMax || 4);
      setHealCost(d.healCost ?? 80);
      setReviveCost(d.reviveCost ?? 500);
      setSupportIds(d.supportCards || []);
      setSupLevels(d.supportLevels || {});
      setPackMax(d.packMax ?? 3);
      if (fromCache) return;
      // A run still in flight: reopen the raid screen paused between floors.
      const run = d.activeRun;
      if (run && run.status === "RUNNING") {
        const st = JSON.parse(run.state);
        setRunId(run.id);
        setUnits(st.party);
        setFloorNum(st.floor);
        setBanked({ ap: st.apEarned, shards: st.shardsEarned });
        setRunSupports(st.supports || []);
        setRunBio(dgnTier(run.dungeon));
        setArmed({ ward: !!st.pendingWard, focus: !!st.pendingFocus, block: !!st.pendingBlock });
        setEnemies([]);
        setLog((l) => l.length ? l : [`> party is ${st.floor === 0 ? "at the entrance" : `resting past floor ${st.floor}`}.`]);
        setScreen("raid");
        setPhase("idle");
      }
    };
    const url = `${API_URL}/api/dungeon/status/${user.id}`;
    if (useCache) {
      // Lobby paints instantly from the session copy while Render wakes.
      await swrJson(`davinci_dgn_${user.id}`, url, apply);
      return;
    }
    try {
      const r = await fetch(url);
      const d = await r.json();
      if (!d?.success) return;
      apply(d.data, false);
      try { sessionStorage.setItem(`davinci_dgn_${user.id}`, JSON.stringify({ shape: 1, at: Date.now(), data: d.data })); } catch {}
    } catch { /* offline */ }
  }, [user?.id]);

  const [domains, setDomains] = useState<Record<string, any>>({});
  const [skills, setSkills] = useState<Record<string, any>>({});
  useEffect(() => { loadCatalog(API_URL, (cat: any) => {
    const cardsArr: CardDef[] = cat?.cards || [];
    setById(Object.fromEntries(cardsArr.map((c) => [c.id, c])));
    setDomains(cat?.domains || {});
    setSkills(cat?.skills || {});
  }, () => {}); }, []);

  /** The hover card's ability line — defensive about the catalog's level
   *  shape so an unexpected field never renders "[object Object]". */
  const abilityLine = (cardId: string, rank: number): { label: string; text: string | null } | null => {
    const dom = domains[cardId];
    const sk = dom ?? skills[cardId];
    if (!sk) return null;
    const lvlDef = Array.isArray(sk.levels) ? sk.levels[Math.max(0, Math.min(rank, sk.levels.length) - 1)] : null;
    const text = typeof lvlDef === "string" ? lvlDef
      : typeof lvlDef?.text === "string" ? lvlDef.text
      : typeof lvlDef?.desc === "string" ? lvlDef.desc
      : null;
    return {
      label: `${dom ? "▲ DOMAIN" : "◆ SKILL"} · ${sk.name} · RANK ${rank}${dom ? "/3" : "/5"}`,
      text,
    };
  };
  useEffect(() => { loadStatus(true); }, [loadStatus]);
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
        // whatever was armed is being spent by this floor's opening
        setArmed({});
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
      } else if (ev.k === "domain") {
        // The mode's loudest beat. The stage floods, the name lands, the
        // fight waits for it — even at 2x. Skip still skips.
        setDomainShow({ name: ev.name, text: ev.text, who: liveUnits[ev.i]?.name ?? "?" });
        pushLog(`> ▲ ${liveUnits[ev.i]?.name ?? "?"} EXPANDS A DOMAIN — ${ev.name}`);
        await nap(1600);
        setDomainShow(null);
        await nap(150);
      } else if (ev.k === "pheal") {
        pop("p", ev.i, `+${ev.amt}`);
        liveUnits[ev.i] = { ...liveUnits[ev.i], hp: Math.min(liveUnits[ev.i].maxHp, Math.max(0, liveUnits[ev.i].hp) + ev.amt) };
        setUnits([...liveUnits]);
        await nap(300);
      } else if (ev.k === "note") {
        pushLog(ev.text);
        await nap(340);
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
      const d = await post("", { dungeon: dungeonSel, cardIds: party, items: packed });
      setRunId(d.run.id);
      setUnits(d.party);
      setFloorNum(0);
      setBanked({ ap: 0, shards: 0 });
      setRunSupports(d.supports || []);
      setRunBio(dgnTier(dungeonSel));
      setArmed({});
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

  /**
   * THE PLAYER'S HELPING HAND — play a packed support card into the run,
   * any time it's live. The server applies it to the TRUE state (between
   * floors); heals, mends and revives show immediately when the stage is
   * calm, and an armed ward/bulwark/cry announces itself at the next
   * floor's opening.
   */
  const playSupport = async (cardId: string) => {
    if (!runId || itemBusy) return;
    setItemBusy(true);
    try {
      const d = await post(`/${runId}/use-support`, { cardId });
      setRunSupports(d.supports || []);
      if (d.note) pushLog(d.note);
      const kind = (byId[cardId] as any)?.support?.kind;
      if (kind === "shield") setArmed((a) => ({ ...a, ward: true }));
      if (kind === "block") setArmed((a) => ({ ...a, block: true }));
      if (kind === "focus") setArmed((a) => ({ ...a, focus: true }));
      // Mid-reel the stage is replaying the PAST — don't jump HP around under
      // the animation; the next floor's payload carries the healed truth.
      if ((kind === "heal" || kind === "mend" || kind === "revive") && phase !== "fighting") setUnits(d.party);
    } catch (e: any) {
      toast(e.message || "It didn't reach them.", "error");
    } finally { setItemBusy(false); }
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
    // Injury shuts the dungeon door (the server enforces it too) — the card
    // can still duel, where the arena heals for free.
    if (!c || c.dgnDead || c.dgnInjured) return;
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
              <h1 className="font-pixel mt-2 text-xl leading-relaxed text-[#e8f6ff] sm:text-2xl" style={{ textShadow: "3px 3px 0 #0d2733" }}>
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
                        <p className="font-pixel text-[10px] leading-relaxed" style={{ color: on ? "#bfe9ff" : "#dfeef6" }}>{d.name}</p>
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
                {/* ── THE FAN ── the party as a cover-flow hand: the middle
                    stands proud, the flanks angle away with depth. Tap a
                    fanned card to send it back to the roster. */}
                <div className="flex items-start justify-center overflow-hidden pb-1 pt-2"
                  style={{ perspective: "900px" }}>
                  {Array.from({ length: partyMax }, (_, i) => {
                    const id = party[i];
                    const def = id ? byId[id] : null;
                    const fanSize = smallScr ? 96 : 128;
                    const dist = i - (partyMax - 1) / 2;
                    const style: React.CSSProperties = {
                      transform: `rotateY(${Math.max(-32, Math.min(32, dist * 18))}deg) scale(${1 - Math.abs(dist) * 0.07}) translateY(${Math.abs(dist) * 8}px)`,
                      zIndex: 20 - Math.round(Math.abs(dist) * 4),
                      marginLeft: i === 0 ? 0 : -Math.round(fanSize * 0.26),
                      transition: "transform .25s, filter .2s",
                      transformStyle: "preserve-3d",
                    };
                    if (def) {
                      // One lookup, then the card wears its TRUE dungeon
                      // condition — a wounded unit fans out at its real HP,
                      // not a fresh copy of itself.
                      const row = cards.find((c) => c.cardId === id);
                      const s = row ? effStats(row, def.rarity) : null;
                      return (
                        <button key={i} onClick={() => toggle(id)} title={`${def.name} — tap to remove`}
                          className="dg-fan-card relative shrink-0" style={style}>
                          <CardFace card={def} owned foil={!!row?.foil}
                            level={row?.level} forge={{ atk: row?.atkForge || 0, hp: row?.hpForge || 0 }}
                            liveAtk={s?.atk} liveHp={s?.hp} liveMaxHp={s?.maxHp}
                            size={fanSize} ratio="5 / 9" showStats stats={DGN_STATS} />
                        </button>
                      );
                    }
                    return (
                      <span key={i} className="grid shrink-0 place-items-center"
                        style={{ ...style, width: fanSize, height: Math.round((fanSize * 9) / 5), background: "#0a141f", border: "3px dashed #2b4a5e" }}>
                        <span className="font-pixel text-[10px] text-[#4c4470]">+</span>
                      </span>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
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

                {/* ── THE PACK ── the player's mid-run hand: YOUR support
                    cards. Same cards as the duels, one play each per run,
                    nothing consumed. */}
                <div className="mt-3 border-t-[3px] border-[#2b4a5e] pt-3">
                  <p className="font-pixel mb-2 text-[9px] text-[#8f86b8]">
                    PACK SUPPORT CARDS · {packed.length}/{packMax} — YOU play these while they fight
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {supportIds.map((cid) => {
                      const def = byId[cid] as any;
                      if (!def?.support) return null;
                      const on = packed.includes(cid);
                      const tone = SUP_TONE[def.support.kind] || "#9be8ff";
                      return (
                        <button key={cid} title={supText(def.support, supLevels[cid])}
                          onClick={() => setPacked((p) =>
                            p.includes(cid) ? p.filter((x) => x !== cid) : p.length < packMax ? [...p, cid] : p)}
                          className={`dg-panel dg-press p-1.5 text-left ${on ? "dg-sel" : ""}`}>
                          {/* the REAL card, not a name on a button — at its level */}
                          <CardFace card={def} owned size={supSize} ratio="5 / 9" showStats={false}
                            level={supLevels[cid]} />
                          <span className="mt-1.5 block font-mono text-[9px] leading-snug"
                            style={{ width: supSize, color: on ? tone : "#8f86b8" }}>
                            {on ? "▶ PACKED — " : ""}{(supLevels[cid] || 1) > 1 ? `LV${supLevels[cid]} · ` : ""}{supText(def.support, supLevels[cid])}
                          </span>
                        </button>
                      );
                    })}
                    {supportIds.length === 0 && (
                      <span className="font-mono text-[10px] text-[#6b6390]">
                        no support cards yet — pull the Succour set from the Archive. Second Wind raises the fallen mid-run.
                      </span>
                    )}
                  </div>
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
                    const status = c.dgnDead ? "DEAD" : c.dgnInjured ? "INJURED" : s.hp < s.maxHp ? "WOUNDED" : "HEALTHY";
                    const statusTone = c.dgnDead ? "#ff5f5f" : c.dgnInjured ? "#ffd23e" : s.hp < s.maxHp ? "#ffb45f" : "#5fd18a";
                    const rank = Math.max(1, c.skillLevel || 1);
                    const abil = abilityLine(c.cardId, rank);
                    return (
                      <div key={c.cardId}
                        className={`dg-panel group relative p-2 ${picked ? "dg-sel" : ""} ${c.dgnDead ? "opacity-80" : ""}`}>
                        {/* ── HOVER CARD ── level, real stats, and the skill or
                            domain at its trained rank. Desktop-only by nature;
                            the same facts live in the card sheet on touch. */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-60 -translate-x-1/2 group-hover:block">
                          <div className="dg-panel p-2.5 text-left">
                            <p className="font-pixel text-[8px] leading-relaxed text-[#e8f6ff]">{def.name.toUpperCase()}</p>
                            <p className="mt-1 font-mono text-[10px] text-[#9fd8e8]">
                              LV.{c.level}{c.foil ? " · ★FOIL (+20%)" : ""} · ATK {s.atk} · HP {s.hp}/{s.maxHp}
                            </p>
                            {abil && (
                              <>
                                <p className="mt-1.5 font-mono text-[10px] font-bold" style={{ color: domains[c.cardId] ? "#f0abfc" : "#c07dff" }}>
                                  {abil.label}
                                </p>
                                {abil.text && <p className="mt-0.5 font-mono text-[10px] leading-snug text-[#8f86b8]">{abil.text}</p>}
                                {domains[c.cardId] && (
                                  <p className="mt-0.5 font-mono text-[9px] text-[#6b6390]">fires itself: boss floor, or badly hurt. once per run.</p>
                                )}
                              </>
                            )}
                            <p className="mt-1.5 font-mono text-[10px]" style={{ color: statusTone }}>{status}{c.dgnInjured ? " — heal before dispatch" : ""}</p>
                          </div>
                        </div>
                        <button onClick={() => toggle(c.cardId)} disabled={c.dgnDead || c.dgnInjured}
                          title={c.dgnInjured ? "Injured — heal before the next dispatch. It can still duel." : undefined}
                          className="relative block w-full text-left disabled:cursor-not-allowed">
                          {/* THE REAL CARD — full art, the same face as everywhere
                              else in the app. Dungeon condition layers on top. */}
                          <span className={`flex justify-center ${c.dgnDead ? "grayscale" : ""}`}>
                            <CardFace card={def} owned foil={c.foil} size={rosterSize} ratio="5 / 9" showStats stats={DGN_STATS} level={c.level} forge={{ atk: c.atkForge || 0, hp: c.hpForge || 0 }} />
                          </span>
                          {c.dgnDead && (
                            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y-[3px] border-[#ff5f6e] bg-[#1a0a10]/95 py-1 text-center font-pixel text-[9px] tracking-widest text-[#ffb4bc]">
                              ✕ DEAD ✕
                            </span>
                          )}
                          {c.dgnInjured && !c.dgnDead && (
                            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y-[3px] border-[#ffd23e] bg-[#1a1408]/95 py-1 text-center font-pixel text-[9px] tracking-widest text-[#ffe9a3]">
                              INJURED
                            </span>
                          )}
                          <span className="mt-1.5 block">
                            {domains[c.cardId] && (
                              <span className="block truncate font-mono text-[10px] text-[#f0abfc]" title="Expands automatically: on a boss floor, or when badly hurt. Once per run.">
                                ▲ {domains[c.cardId].name}
                              </span>
                            )}
                            <span className="mt-1 block h-[7px] w-full border border-[#2b4a5e] bg-[#0a141f]">
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
                            {c.dgnDead
                              ? `REVIVE · ${c.reviveCost ?? reviveCost} AP${(c.dgnDeaths ?? 0) > 1 ? ` (†${c.dgnDeaths})` : ""}`
                              : `HEAL · ${healCost} AP`}
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
                <p className="font-pixel text-[11px]" style={{ color: bossFloor && phase === "fighting" ? "#ff5f6e" : "#bfe9ff" }}>
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

              {/* the stage — costumed by the biome the party is actually in */}
              <div className={`dg-panel dg-stage dg-bio-${runBio} relative overflow-hidden ${phase === "marching" ? "dg-marching" : ""}`}>
                <div aria-hidden className="dg-bg dg-bg-far" />
                <div aria-hidden className="dg-bg dg-bg-mid" />
                <div aria-hidden className="dg-bg dg-bg-near" />
                <div aria-hidden className="dg-motes" />
                <div aria-hidden className="dg-vig" />

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
                        <span className="mt-1 block h-[6px] w-12 border border-[#2b4a5e] bg-[#0a141f] sm:w-14">
                          <span className="block h-full" style={{
                            width: `${Math.round((Math.max(0, u.hp) / Math.max(1, u.maxHp)) * 100)}%`,
                            background: u.hp / u.maxHp > 0.5 ? "#5fd18a" : u.hp / u.maxHp > 0.25 ? "#ffd23e" : "#ff5f5f",
                          }} />
                        </span>
                        {/* the number, not just the bar — a sliver of green
                            at 3/41 and at 3/9 look the same; the digits don't */}
                        <span className="font-pixel mt-0.5 block text-[7px] leading-none" style={{
                          color: dead ? "#ff5f5f" : u.hp / u.maxHp > 0.5 ? "#5fd18a" : u.hp / u.maxHp > 0.25 ? "#ffd23e" : "#ff5f5f",
                        }}>
                          {Math.max(0, u.hp)}/{u.maxHp}
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
                        <div className={`${dead ? "" : "dg-bob-e"} ${hitE ? "dg-hit" : ""} ${e.boss && !dead ? "dg-bossglow" : ""}`} style={{ animationDelay: `${i * 0.3}s` }}>
                          <PixelMob kind={e.kind} boss={e.boss} dead={dead} scale={e.boss ? 6 : 5} tier={runBio} />
                        </div>
                        {!dead && (
                          <span className="mt-1 block h-[6px] w-12 border border-[#2b4a5e] bg-[#0a141f]">
                            <span className="block h-full bg-[#ff5f5f]" style={{ width: `${Math.round((e.hp / Math.max(1, e.maxHp)) * 100)}%` }} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {skipping && (
                  <p className="font-pixel absolute left-1/2 top-3 -translate-x-1/2 text-[9px] text-[#bfe9ff]">FAST-FORWARDING...</p>
                )}

                {/* ── DOMAIN EXPANSION ── the stage belongs to it for a beat */}
                {domainShow && (
                  <div className="dg-domain absolute inset-0 z-20 grid place-items-center">
                    <div className="px-4 text-center">
                      <p className="font-pixel text-[9px] tracking-widest text-[#bfe9ff]">▲ DOMAIN EXPANSION ▲</p>
                      <p className="font-pixel mt-3 text-[13px] leading-relaxed text-[#e8f6ff]" style={{ textShadow: "3px 3px 0 #04121d" }}>
                        {domainShow.name}
                      </p>
                      <p className="mt-2 font-mono text-[11px] text-[#e8e3d0]">{domainShow.who}</p>
                      <p className="mt-1 font-mono text-[10px] text-[#b9aee0]">{domainShow.text}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* log + controls */}
              <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                <div className="dg-panel h-36 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed text-[#9fd8e8]">
                  {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
                <div className="flex flex-col gap-2">
                  {/* ── SUPPORT FROM TOPSIDE ── the player's hand of support
                      cards. Playable any time the run is live, once each. */}
                  {runSupports.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {runSupports.map((s) => {
                        const def = byId[s.id] as any;
                        if (!def?.support) return null;
                        const kind = def.support.kind;
                        const blocked = (kind === "shield" && armed.ward) || (kind === "focus" && armed.focus) || (kind === "block" && armed.block);
                        const tone = SUP_TONE[kind] || "#9be8ff";
                        return (
                          <button key={s.id} onClick={() => playSupport(s.id)}
                            disabled={itemBusy || s.used || !!result || !!blocked}
                            title={s.used ? "Already played this run" : blocked ? "Already armed — it lands next floor" : supText(def.support, supLevels[s.id])}
                            className="dg-btn w-full px-2 py-2 text-left font-pixel text-[8px] leading-relaxed disabled:opacity-35"
                            style={!s.used && !blocked ? { color: tone } : undefined}>
                            {s.used ? "✕ " : "▶ "}{def.name.toUpperCase()}{s.used ? " — PLAYED" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {(armed.ward || armed.focus || armed.block) && (
                    <p className="font-pixel text-[8px] leading-relaxed text-[#9be8ff]">
                      ARMED:{armed.ward ? " WARD" : ""}{armed.block ? " BULWARK" : ""}{armed.focus ? " CRY" : ""} — lands at the next floor
                    </p>
                  )}
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
                  style={{ color: result.status === "WIPED" ? "#ff5f5f" : result.status === "CLEARED" ? "#bfe9ff" : "#5fd18a" }}>
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
 *  the whole thing away. The palette is HOLLOW NIGHT: deep cavern blue-black,
 *  pale bone light, cold cyan glow. Gold survives only on money. */
const DG_CSS = `
.dg-root { background:
  radial-gradient(90% 45% at 50% -5%, #12293c, transparent 70%), #070d14; }
.dg-panel { background: #0d1826; border: 3px solid #2b4a5e; box-shadow: 0 3px 0 0 #030608; }
.dg-sel { border-color: #bfe9ff; box-shadow: 0 3px 0 0 #0d2733; }
.dg-btn { background: #14283a; border: 3px solid #3e6278; color: #dfeef6;
  box-shadow: 0 3px 0 0 #030608; transition: none; }
.dg-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 0 0 0 #030608; }
.dg-btn-gold { background: #1d4457; border-color: #9be8ff; color: #dff6ff; }
.dg-btn-red { background: #4a1420; border-color: #ff5f6e; color: #ffb4bc; }
.dg-slot { width: 64px; height: 64px; background: #0a141f; border: 3px dashed #2b4a5e; }
.dg-slot img { border: none; }
.dg-frame { display: grid; place-items: center; width: 44px; height: 44px; background: #0a141f; border: 3px solid; }
.dg-frame-lg { display: grid; place-items: center; width: 68px; height: 68px; background: #0a141f; border: 3px solid; }
.dg-pix { image-rendering: pixelated; }
/* ── BIOMES ── one set of layer graphics, three costumes. The Sunless Keep
   blue is the default; the Cellars go fungal green, the Orchard goes dead
   bone-amber. Everything reads the variables, so a biome is nine colours. */
.dg-stage { height: 300px; background: var(--bioBase, #081019);
  --bioCeilA:#0a1620; --bioCeilB:#0e1e2c; --bioHang:#0a1826; --bioPillar:#0c1b2a;
  --bioGroundA:#11232f; --bioGroundB:#0a141f; --bioThorn:#16303f;
  --bioLight:#cfeaf780; --bioBase:#081019; }
.dg-bio-0 { --bioCeilA:#08160f; --bioCeilB:#0c2416; --bioHang:#0a1f12; --bioPillar:#0d2617;
  --bioGroundA:#10291b; --bioGroundB:#081410; --bioThorn:#164a2c;
  --bioLight:#9fe8c880; --bioBase:#071310; }
.dg-bio-1 { --bioCeilA:#171208; --bioCeilB:#241c0e; --bioHang:#1c150a; --bioPillar:#261e10;
  --bioGroundA:#2a2112; --bioGroundB:#140f08; --bioThorn:#453317;
  --bioLight:#e8d8a080; --bioBase:#120d06; }
@media (min-width: 640px) { .dg-stage { height: 340px; } }
.dg-bg { position: absolute; inset: 0; background-repeat: repeat-x; }
/* far: the cavern ceiling, hanging silhouettes, and distant pale lights */
.dg-bg-far { background-image:
  radial-gradient(2px 2px at 18% 34%, var(--bioLight), transparent 60%),
  radial-gradient(2px 2px at 67% 24%, var(--bioLight), transparent 60%),
  radial-gradient(3px 3px at 44% 50%, var(--bioLight), transparent 60%),
  repeating-linear-gradient(90deg, transparent 0 52px, var(--bioHang) 52px 66px, transparent 66px 120px),
  linear-gradient(var(--bioCeilA) 0 26%, var(--bioCeilB) 26% 30%, transparent 30%);
  background-size: 240px 100%, 240px 100%, 240px 100%, 120px 34%, 240px 100%; }
/* mid: broken pillars of an older kingdom */
.dg-bg-mid { background-image:
  repeating-linear-gradient(90deg, transparent 0 70px, var(--bioPillar) 70px 96px, transparent 96px 240px);
  background-size: 240px 100%; opacity: .92; }
/* near: the path, and thorn-fringe along it */
.dg-bg-near { background-image:
  linear-gradient(transparent 0 80%, var(--bioGroundA) 80% 85%, var(--bioGroundB) 85%),
  repeating-linear-gradient(90deg, transparent 0 24px, var(--bioThorn) 24px 28px, transparent 28px 60px);
  background-size: 240px 100%, 60px 100%; }
/* the bestiary's eyes glow — dead things go dark first */
.dg-eyes { filter: drop-shadow(0 0 4px #e8f6ffb3); }
/* the fan: hover pulls a card forward without fighting its inline rotate */
.dg-fan-card:hover { z-index: 40 !important; filter: brightness(1.18); }
/* always-on cavern dust, rising slow — the room is alive even at rest */
.dg-motes { position: absolute; inset: 0; pointer-events: none; background-repeat: repeat; background-image:
  radial-gradient(2px 2px at 20% 82%, #bfe9ff59, transparent 60%),
  radial-gradient(1.5px 1.5px at 56% 58%, #bfe9ff40, transparent 60%),
  radial-gradient(2px 2px at 83% 74%, #bfe9ff4d, transparent 60%);
  background-size: 210px 230px; animation: dg-rise 8s linear infinite; }
@keyframes dg-rise { from { background-position-y: 0; } to { background-position-y: -230px; } }
.dg-vig { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 95% at 50% 42%, transparent 52%, #04080cc0); }
.dg-bossglow { filter: drop-shadow(0 0 12px #bfe9ff59); }
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
.dg-domain { background: rgba(8, 18, 30, .94); border: 3px solid #bfe9ff;
  animation: dg-domain-in .25s steps(4); }
@keyframes dg-domain-in { from { opacity: 0; } to { opacity: 1; } }
.dg-crt { position: fixed; inset: 0; z-index: 40; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px);
  mix-blend-mode: multiply; }
@media (prefers-reduced-motion: reduce) {
  .dg-bob, .dg-bob-e, .dg-motes, .dg-marching .dg-bg-far, .dg-marching .dg-bg-mid, .dg-marching .dg-bg-near { animation: none !important; }
}
`;
