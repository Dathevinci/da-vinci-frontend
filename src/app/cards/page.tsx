"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Layers, Sparkles, Gem, X, Hammer, Recycle, PackageOpen, Users, Heart, Swords, Zap, ArrowUp, BarChart3 } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { loadCatalog } from "@/lib/catalogCache";
import { swrJson } from "@/lib/swrCache";
import { isLeadDev, displayArisePoints, displayShards } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, CardRarity, RARITY_META, supportText, groundText, GOD_STATS_MIRROR } from "@/components/cards/CardFace";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Stagger, { StaggerItem } from "@/components/ui/Stagger";
import Tilt from "@/components/ui/Tilt";
import CountUp from "@/components/ui/CountUp";
import PackReveal from "@/components/cards/PackReveal";
import { Panel, CornerTicks, Stars, SegBar, GachaButton, Heading, StatRow, notch, ACCENT, ACCENT_LIT, GachaAmbience, Rise, Twinkles } from "@/components/cards/gacha";
import { DIMENSIONS, DIMENSION_ORDER, CARD_LORE } from "@/data/cardLore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/** Cards drawn per set before "See all". One full row on most breakpoints. */
const SET_PREVIEW = 10;

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
  wakeCost?: Record<CardRarity, number>;
  pullSizes?: number[];
  pullPrices?: Record<number, number>;
  maxCardLevel?: number;
  upgradeBase?: Record<CardRarity, number>;
  upgradeGrowth?: number;
  levelStep?: number;
  /** The real pull odds as percentages, derived server-side from the same
   *  RARITY_WEIGHTS the roll uses, so the two can never disagree. */
  pullRates?: Record<string, number>;
  cardStats?: Record<string, { hp: number; atk: number }>;
  /** PER-CARD stats, which outrank cardStats (keyed by rarity). The Knight set
   *  is authored card by card, so without this a Squire renders the common
   *  line — 18/7 instead of the 9/4 it actually fights at. */
  cardStatsById?: Record<string, { hp: number; atk: number }>;
  /** Merge rules — the cap, the step, and the full shard ladder per rarity, so
   *  the button can name the price before the finger commits. */
  merge?: {
    max: number;
    step: number;
    cost: Record<string, number[]>;
  };
  foilMult?: number;
  maxSkillLevel?: number;
  maxDomainLevel?: number;
  /** Legendary domain expansions — same shape as skills, different mechanic. */
  domains?: Record<string, {
    name: string;
    kind: string;
    levels: { level: number; power: number; text: string; cost: number | null }[];
  }>;
  /**
   * Legendary skills, keyed by card id, with every rank's wording already
   * resolved server-side — so the number shown is the number charged and this
   * file never grows a second copy of the copy.
   */
  skills?: Record<string, {
    name: string;
    kind: string;
    levels: { level: number; power: number; text: string; cost: number | null }[];
  }>;
};

export default function CardsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [asleep, setAsleep] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  // Legendary skill ranks, on their own shard track separate from level.
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});
  // Forge ranks — flat per-stat training, the third shard track.
  const [forges, setForges] = useState<Record<string, { atk: number; hp: number }>>({});
  /**
   * THE PULL ROLL — this copy's own HP/ATK, stamped when it was pulled, plus
   * how many times it has been merged. Held here rather than derived because
   * it is a property of the COPY, not the card: two players holding the same
   * card hold genuinely different objects, and the binder is where that has to
   * become visible. Until this shipped, every surface fell back to the printed
   * line and the randomisation was invisible outside a duel.
   */
  const [rolls, setRolls] = useState<Record<string, { hp?: number | null; atk?: number | null }>>({});
  const [merges, setMerges] = useState<Record<string, number>>({});
  // The binder's two readings: BY SET (the chase — what's missing) or
  // INVENTORY (what you HOLD, by rarity, legendaries shelved by build).
  const [view, setView] = useState<"sets" | "inv" | "dex">("sets");
  // The Codex's open lore page — only ever a card the viewer has DISCOVERED.
  const [loreCard, setLoreCard] = useState<CardDef | null>(null);
  // Legendary print identities: cardId -> [{serial, condition}], server-real.
  const [prints, setPrints] = useState<Record<string, { serial: number; condition: string }[]>>({});
  const [claimedSets, setClaimedSets] = useState<string[]>([]);
  const [shards, setShards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<CardDef[] | null>(null);
  // Prints minted by the pull being revealed, so the reveal can stamp
  // condition + serial on each legendary as it flips.
  const [revealPrints, setRevealPrints] = useState<{ cardId: string; serial: number; condition: string }[]>([]);
  /** Ids the player did not own before the pull that produced the open reveal. */
  const [revealNew, setRevealNew] = useState<string[]>([]);
  const [selected, setSelected] = useState<CardDef | null>(null);
  const [ap, setAp] = useState<number | null>(null);
  // Whose binder are we looking at? null = mine.
  const [viewing, setViewing] = useState<{ id: string; username: string } | null>(null);
  const [collectors, setCollectors] = useState<any[]>([]);
  const [showCollectors, setShowCollectors] = useState(false);
  // Sets start collapsed; opening one is a deliberate act.
  const [expandedSets, setExpandedSets] = useState<string[]>([]);

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
    // Session-cached, refreshed in the background — the binder paints its
    // sets instantly on every visit after the first instead of waiting out
    // a Render cold start. loadCatalog already refuses card-less payloads.
    loadCatalog(API_URL, (data) => setCatalog(data));
  }, []);

  // One parser for both the cached and the fresh payload — SWR calls it twice.
  const applyCollection = (data: any) => {
    const map: Record<string, number> = {};
    const fo: Record<string, boolean> = {};
    const hb: Record<string, boolean> = {};
    const lv: Record<string, number> = {};
    const sk: Record<string, number> = {};
    const fg: Record<string, { atk: number; hp: number }> = {};
    const pr: Record<string, { serial: number; condition: string }[]> = {};
    const rl: Record<string, { hp?: number | null; atk?: number | null }> = {};
    const mg: Record<string, number> = {};
    for (const c of data?.cards || []) {
      map[c.cardId] = c.count;
      if (c.foil) fo[c.cardId] = true;
      if (c.hibernating) hb[c.cardId] = true;
      lv[c.cardId] = c.level || 1;
      sk[c.cardId] = c.skillLevel || 1;
      fg[c.cardId] = { atk: c.atkForge || 0, hp: c.hpForge || 0 };
      // Only recorded when the server actually rolled this copy. A null is NOT
      // written as 0 — CardFace treats a positive number as the roll and
      // anything else as "use the printed line", so a zero here would render
      // every pre-roll card as a 0/0.
      if (typeof c.rolledHp === "number" || typeof c.rolledAtk === "number") {
        rl[c.cardId] = { hp: c.rolledHp, atk: c.rolledAtk };
      }
      if (c.merges) mg[c.cardId] = c.merges;
      if (Array.isArray(c.prints) && c.prints.length) pr[c.cardId] = c.prints;
    }
    setOwned(map);
    setFoils(fo);
    setAsleep(hb);
    setLevels(lv);
    setSkillLevels(sk);
    setForges(fg);
    setRolls(rl);
    setMerges(mg);
    setPrints(pr);
    setClaimedSets(data?.claimedSets || []);
    setShards(data?.shards || 0);
    setLoading(false);
  };

  const loadCollection = async (useCache = false) => {
    // When viewing someone else's binder we read THEIR collection; the action
    // buttons all key off `isMine` so nothing is spendable on their behalf.
    const targetId = viewing?.id || user?.id;
    if (!targetId) {
      setLoading(false);
      return;
    }
    const url = `${API_URL}/api/cards/collection/${targetId}`;
    if (useCache) {
      // Mount path: paint instantly from the session cache, correct from the
      // network. Post-action refreshes (dust, forge, pull) deliberately skip
      // the cached paint — flashing pre-action counts would read as the
      // action having silently undone itself.
      await swrJson(`davinci_col_${targetId}`, url, applyCollection, () => setLoading(false));
      return;
    }
    try {
      const r = await fetch(url);
      const d = await r.json();
      if (d.success) {
        applyCollection(d.data);
        try { sessionStorage.setItem(`davinci_col_${targetId}`, JSON.stringify({ shape: 1, at: Date.now(), data: d.data })); } catch {}
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Switching binders CLEARS the previous one first. Without this, the
    // seconds while the other user's collection loads (or forever, if the
    // fetch fails) showed YOUR cards — and your print serials — under their
    // name, which is exactly the kind of lie a collection page can't tell.
    setOwned({}); setFoils({}); setAsleep({}); setLevels({});
    setSkillLevels({}); setForges({}); setPrints({});
    // Cleared with the rest: a stale roll under someone else's name would show
    // THEIR card carrying YOUR copy's numbers, which is the same lie the
    // print serials were cleared to avoid.
    setRolls({}); setMerges({}); setLoading(true);
    loadCollection(true);
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

  /**
   * A PULL IS A PURCHASE, SO IT ASKS FIRST.
   *
   * Every spend in this game fired straight from onClick — a ×32 was 2,000
   * Arise Points on a single tap with no undo and no sheet. "Any flow where a
   * purchase can complete without an explicit confirm step" is on the list of
   * things this product deliberately does not do, and this was the loudest
   * example of it.
   *
   * The affordability check stays HERE rather than moving into the sheet, so
   * someone who cannot afford a pull is told before being asked to confirm
   * one — a confirm dialog you are not allowed to complete is a worse
   * experience than a straight refusal.
   */
  const [pendingPull, setPendingPull] = useState<number | null>(null);
  const askPull = (count?: number) => {
    if (!user) return toast("Sign in to open packs.", "error");
    if (!catalog) return;
    const price = (count && catalog.pullPrices?.[count]) ?? catalog.packPrice;
    if (!isLeadDev(user) && apDisplay < price) {
      return toast(`That pull costs ${price.toLocaleString()} AP.`, "error");
    }
    setPendingPull(count ?? catalog.packSize);
  };

  const openPack = async (count?: number) => {
    if (!user) return toast("Sign in to open packs.", "error");
    if (!catalog) return;
    const price = (count && catalog.pullPrices?.[count]) ?? catalog.packPrice;
    if (!isLeadDev(user) && apDisplay < price) return toast(`That pull costs ${price.toLocaleString()} AP.`, "error");
    setOpening(true);
    try {
      const r = await fetch(`${API_URL}/api/cards/open-pack`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, count }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        toast(d.message || "Pack failed.", "error");
        return;
      }
      const byId = Object.fromEntries((catalog.cards || []).map((c) => [c.id, c]));
      const pulled: CardDef[] = ((d.data?.pulls || []) as string[]).map((id) => byId[id]).filter(Boolean);
      /**
       * WHICH CARDS ARE NEW, decided HERE and not one line later.
       *
       * `owned` still holds the collection as it was before this request. The
       * moment loadCollection() below resolves, every card in this pack is
       * owned and the answer is gone — "new" is a fact about the past, so it
       * has to be captured before the refetch overwrites the past.
       *
       * Deduped, because a pack can contain two copies of a card you did not
       * own: both are new to the collection, but the second one is a duplicate
       * of the first and stamping both would be a small lie.
       */
      const seenNew = new Set<string>();
      const freshIds = pulled
        .filter((c) => {
          if ((owned[c.id] || 0) > 0 || seenNew.has(c.id)) return false;
          seenNew.add(c.id);
          return true;
        })
        .map((c) => c.id);
      setRevealNew(freshIds);
      if (typeof d.data.arisePoints === "number") syncAp(d.data.arisePoints);
      setRevealPrints(Array.isArray(d.data?.prints) ? d.data.prints : []);
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
      fire("dust", `+${d.data.gained} shards`);
      await loadCollection();
      // The sheet closes AFTER the burst has had the screen for a moment —
      // closing instantly pulled the modal out from under the animation, which
      // is why dusting looked like nothing happened.
      setTimeout(() => setSelected(null), 700);
    } catch {
      toast("Couldn't dust.", "error");
    }
  };

  const [forging, setForging] = useState(false);
  /** The forge: one stat, one rank, a lot of shards. The response carries the
   *  new rank and balance, so no refetch — and the sheet STAYS open, because
   *  forging is something you do again. */
  const forge = async (card: CardDef, stat: "atk" | "hp") => {
    if (!user || forging) return;
    setForging(true);
    try {
      const r = await fetch(`${API_URL}/api/cards/forge`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, cardId: card.id, stat }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "The forge went cold.", "error");
      setShards(d.data.shards);
      setForges((f) => ({ ...f, [card.id]: { ...(f[card.id] || { atk: 0, hp: 0 }), [stat]: d.data.rank } }));
      fire("dust", `${stat.toUpperCase()} forged · rank ${d.data.rank}`);
    } catch {
      toast("The forge went cold.", "error");
    } finally {
      setForging(false);
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

  /**
   * MERGE — feed a spare of the same rank in and keep the stronger card.
   *
   * The sheet stays OPEN afterwards, unlike foiling. Merging is a repeatable
   * ladder with a visible cap, so closing it would make the player reopen the
   * card to see what their shards just bought and whether there is another
   * step left.
   */
  const [merging, setMerging] = useState(false);
  /**
   * Merging takes NO fodder argument: the spare is always another copy of the
   * same card, so naming it would be naming the card twice and inviting the two
   * to disagree. The server enforces the same rule and refuses a mismatch.
   */
  const doMerge = async (card: CardDef) => {
    if (merging) return;
    setMerging(true);
    await shardAction("merge", { cardId: card.id }, (d) => {
      setShards(d.shards);
      toast(`${card.name} absorbed a spare copy — +${d.gainedHp} HP, +${d.gainedAtk} ATK, permanently.`, "success");
    });
    setMerging(false);
  };

  /**
   * A short burst keyed to an action. Rendered as ONE absolutely-positioned
   * element that animates transform and opacity — no layout, and it unmounts
   * itself, so nothing lingers costing frames after the moment has passed.
   */
  const [burst, setBurst] = useState<{ kind: "dust" | "level"; label: string; key: number } | null>(null);
  const fire = (kind: "dust" | "level", label: string) => setBurst({ kind, label, key: Date.now() });
  /**
   * The burst is cleared on a timer, NOT on onAnimationComplete.
   *
   * That callback fires when the element's OWN animation finishes — here the
   * 0.3s wrapper fade — not when the child keyframes do. So the whole thing
   * unmounted about a quarter of the way through, which is most of why dusting
   * looked like nothing happened.
   */
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1300);
    return () => clearTimeout(t);
  }, [burst?.key]);

  const upgrade = (card: CardDef) =>
    shardAction("upgrade", { cardId: card.id }, (d) => {
      setShards(d.shards);
      setLevels((l) => ({ ...l, [card.id]: d.level }));
      fire("level", `Level ${d.level}`);
    });

  const upgradeSkill = (card: CardDef) =>
    shardAction("upgrade-skill", { cardId: card.id }, (d) => {
      setShards(d.shards);
      setSkillLevels((l) => ({ ...l, [card.id]: d.skillLevel }));
      fire("level", `${d.skillName} · Rank ${d.skillLevel}`);
    });

  /**
   * Spend a duplicate to advance the ability one rank, no shards.
   *
   * The server decrements the copy and bumps the rank in one guarded update,
   * so the counts here are its answer rather than a local guess — otherwise a
   * double click would show two ranks bought off one spare.
   */
  const attune = (card: CardDef) =>
    shardAction("attune", { cardId: card.id }, (d) => {
      setSkillLevels((l) => ({ ...l, [card.id]: d.skillLevel }));
      setOwned((o) => ({ ...o, [card.id]: d.count }));
      fire("level", `${d.skillName} · Rank ${d.skillLevel}`);
    });

  const wake = (card: CardDef) =>
    shardAction("wake", { cardId: card.id }, (d) => {
      setShards(d.shards);
      toast(`${card.name} is awake.`, "success");
    });

  const openRelic = () =>
    shardAction("relic-pack", {}, (d) => {
      setShards(d.shards);
      const byId = Object.fromEntries((catalog?.cards || []).map((c) => [c.id, c]));
      setRevealPrints(Array.isArray(d?.prints) ? d.prints : []);
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
  // ── SEARCH & FILTER ── the binder is 80+ cards and growing; nobody
  // should scroll it to find one. The name search and rarity chips filter
  // WHAT RENDERS; set completion counts stay true to the full set.
  const [q, setQ] = useState("");
  /**
   * The binder filter is by RARITY *or* by CLASS, in one row of chips.
   *
   * They share a control because they answer the same question — "show me
   * fewer cards" — and a player looking for their supports is not also
   * narrowing by rarity at that moment. Class is not a rarity, so the two
   * live in one union rather than pretending "ground" is a tier.
   */
  const [rarFilter, setRarFilter] = useState<CardRarity | "all" | "support" | "ground">("all");
  // The skill cap for the MAX sign: domains max lower than skills, and a
  // card with neither has no skill requirement to meet.
  const skillCapFor = (c: CardDef) =>
    catalog?.domains?.[c.id] ? (catalog.maxDomainLevel ?? 3)
    : catalog?.skills?.[c.id] ? (catalog.maxSkillLevel ?? 5)
    : undefined;
  // ── PULL STATS ── the odds printed, the pulls counted. Data comes from
  // /pull-stats on open; until it lands the modal shows ellipses, and the
  // rates fall back to a display-only mirror of the server weights.
  const [statsOpen, setStatsOpen] = useState(false);
  const [pullStats, setPullStats] = useState<any | null>(null);
  // ── DUST ALL ── the whole binder's dupes → shards in one sweep.
  const [dustAllOpen, setDustAllOpen] = useState(false);
  const [dustingAll, setDustingAll] = useState(false);
  const openStats = async () => {
    setStatsOpen(true);
    try {
      // When browsing someone ELSE's binder, the stats are theirs too.
      const sid = viewing?.id || user?.id || "";
      const r = await fetch(`${API_URL}/api/cards/pull-stats?userId=${sid}`);
      const d = await r.json();
      if (d?.success) setPullStats(d.data);
    } catch { /* offline — the modal still shows the mirrored odds */ }
  };

  // What a full sweep WOULD dust — mirrors the server's rules (keep one of
  // each card, keep the best serial of every legendary build, events never
  // dust) so the confirm sheet promises exactly what the server delivers.
  const dustPreview = useMemo(() => {
    let copies = 0, gain = 0;
    for (const c of catalog?.cards || []) {
      const n = owned[c.id] || 0;
      if (n <= 1 || c.rarity === "event") continue;
      let d = 0;
      if (c.rarity === "legendary") {
        const perWear: Record<string, number> = {};
        for (const p of prints[c.id] || []) perWear[p.condition] = (perWear[p.condition] || 0) + 1;
        d = Object.values(perWear).reduce((a, k) => a + Math.max(0, k - 1), 0);
      } else {
        d = n - 1;
      }
      if (d > 0) { copies += d; gain += d * (catalog?.dustValue?.[c.rarity] || 0); }
    }
    return { copies, gain };
  }, [catalog, owned, prints]);

  const dustAll = async () => {
    if (!user) return;
    setDustingAll(true);
    try {
      const r = await fetch(`${API_URL}/api/cards/dust-all`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't dust.", "error");
      setShards(d.data.shards);
      toast(`Dusted ${d.data.copies.toLocaleString()} cop${d.data.copies === 1 ? "y" : "ies"} into ${d.data.gained.toLocaleString()} shards.`, "success");
      setDustAllOpen(false);
      await loadCollection();
    } catch {
      toast("Couldn't dust.", "error");
    } finally {
      setDustingAll(false);
    }
  };
  const qn = q.trim().toLowerCase();
  const filtering = qn.length > 0 || rarFilter !== "all";
  const matches = useCallback(
    (c: CardDef) =>
      (rarFilter === "all"
        ? true
        : rarFilter === "support"
        ? !!c.support
        : rarFilter === "ground"
        ? !!c.ground
        : c.rarity === rarFilter) &&
      (!qn || c.name.toLowerCase().includes(qn)),
    [qn, rarFilter]
  );

  const sets = useMemo(() => {
    if (!catalog) return [];
    const bySet: Record<string, CardDef[]> = {};
    for (const c of catalog.cards || []) (bySet[c.set] ||= []).push(c);
    return Object.entries(bySet).map(([set, cards]) => {
      cards.sort((a, b) => RARITY_META[a.rarity].order - RARITY_META[b.rarity].order || a.name.localeCompare(b.name));
      const haveCount = cards.filter((c) => (owned[c.id] || 0) > 0).length;
      // What the grid draws — filters apply here, never to the counts.
      const visible = cards.filter(matches);
      return { set, cards: visible, allCards: cards, have: haveCount, total: cards.length };
    }).filter((s) => !filtering || s.cards.length > 0);
  }, [catalog, owned, matches, filtering]);

  const totalHave = Object.keys(owned).length;
  const totalCards = catalog?.cards?.length ?? 0;

  // The sheet's own wrapper scrolls; the page behind it must NOT. Without
  // this, a phone swipe could grab the body instead of the sheet — modal
  // frozen, page moving underneath, which reads as "the preview broke".
  useEffect(() => {
    if (!selected && !statsOpen && !dustAllOpen && !loreCard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [selected, statsOpen, dustAllOpen, loreCard]);

  // THE ROOT CAUSE of "the preview messes up on mobile": fixed 216px tiles
  // in a two-column grid are ~480px of content on a 412px phone. The page
  // grew a horizontal pan, the layout viewport went wider than the screen —
  // and every fixed modal then centred itself in that wider canvas, landing
  // half off-screen. Tiles drop to 150px under 640px, so the grid actually
  // fits the phone it is on.
  const [smallScreen, setSmallScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmallScreen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const gridCard = smallScreen ? 150 : 216;

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-x-hidden px-4 pb-24 pt-24 text-white"
        style={{
          background:
            "radial-gradient(85% 50% at 12% -5%, rgba(120,86,196,.20), transparent 60%)," +
            "radial-gradient(70% 45% at 92% 4%, rgba(162,116,255,.20), transparent 62%)," +
            "linear-gradient(#0b0716, #070410 60%, #05030c)",
        }}>
        {/* faint diagonal weave — texture, so the page is never flat black */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 7px, rgba(255,255,255,.9) 7px 8px)" }} />

        {/* the living sky — nebulae, rising motes, and the kit's keyframes */}
        <GachaAmbience />

        <div className="relative mx-auto max-w-6xl">
          {/* ── BANNER HEADER ── the title plate, the resources, the progress */}
          <Rise>
          <Panel tone="gold" size={26} className="mb-7" sheen>
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
                      {/* The balance TRAVELS to its new value after a pull or a
                          spend. A number that snaps tells you what you have; a
                          number that rolls lets you feel what it cost.
                          Staff show ∞ and the roll is skipped — there is
                          nothing to count toward. */}
                      <span className="text-sm font-black tabular-nums">
                        {!user ? "—" : isLeadDev(user) ? "∞" : (
                          <CountUp value={apDisplay} />
                        )}
                        <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">AP</span>
                      </span>
                    </div>
                    <div className="flex h-10 items-center gap-2 px-3.5" style={{ clipPath: notch(9), background: "rgba(167,139,250,.07)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.22)" }}>
                      <Gem className="h-4 w-4 text-cyan-300" />
                      <span className="text-sm font-black tabular-nums text-cyan-100">
                        {/* displayShards returns ∞ for staff, so the roll is
                            reserved for a real number — same rule as AP. */}
                        {isLeadDev(user) ? displayShards(user, shards) : <CountUp value={shards} />}
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
                  {/* The count of what's LEFT. The grid only draws cards you
                      own now, so without this number the archive gives no
                      sense of scale — a page of ten cards looks the same
                      whether two are missing or forty. */}
                  <p className="mt-2 text-[11px] font-bold text-slate-500">
                    {totalCards - totalHave > 0 ? (
                      <>
                        <b style={{ color: ACCENT_LIT }}>{totalCards - totalHave}</b> still undiscovered
                        <span className="text-slate-700"> · </span>
                        keep pulling to find them
                      </>
                    ) : (
                      <b style={{ color: ACCENT_LIT }}>Every card discovered. The archive is complete.</b>
                    )}
                  </p>
                </div>
              )}
            </div>
          </Panel>
          </Rise>

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
            <Rise delay={0.08}>
            <Panel tone="gold" size={30} className="mb-8" sheen>
              <div className="relative overflow-hidden">
                {/* layered light — the banner glow every gacha summon screen has */}
                <div aria-hidden className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(70% 130% at 78% 20%, rgba(168,110,255,.30), transparent 62%), radial-gradient(55% 110% at 18% 90%, rgba(162,116,255,.18), transparent 65%)" }} />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30"
                  style={{ backgroundImage: "repeating-linear-gradient(72deg, transparent 0 26px, rgba(255,255,255,.55) 26px 27px)", maskImage: "linear-gradient(100deg, transparent 35%, black 75%, transparent)" }} />
                {/* glints twinkling out of phase — the banner is never still */}
                <Twinkles count={8} />

                <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-[0.32em]"
                      style={{ clipPath: "polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)", background: `linear-gradient(100deg, ${ACCENT_LIT}, ${ACCENT})`, color: "#1a1206" }}>
                      Standard Banner
                    </span>
                    <h2 className="mt-3 font-fell text-3xl font-bold uppercase tracking-[0.08em] text-white sm:text-4xl">
                      Arise Pack
                    </h2>
                    {/* Named for what it actually contains. It was "Ascension
                        Pack", but the pool is every non-event card across every
                        set — so the name promised one set and delivered five. */}
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                      Every set in the archive, one pool — the same odds on every card, every size.
                      A duplicate is never a loss: dust it into shards.
                    </p>
                    {sets.length > 0 && (
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {sets.map((s) => s.set).join(" · ")}
                      </p>
                    )}

                    {/* rarity ladder WITH the printed odds — same display-only
                        mirror of RARITY_WEIGHTS the Pull Stats modal uses, so
                        the banner says its chances out loud instead of hinting. */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                      {(["legendary", "epic", "rare", "common"] as const).map((r) => {
                        // FROM THE SERVER, never a literal. These were written
                        // out by hand and said 0.6 / 8 / 27.4 / 64 long after
                        // the roll had been retuned to 0.4 / 4.6 / 17 / 78 —
                        // the banner advertised odds nobody was being given.
                        // pullRates is derived from RARITY_WEIGHTS itself, so
                        // the number here and the number rolled cannot drift.
                        const pct = catalog?.pullRates?.[r] ?? pullStats?.rates?.[r];
                        if (pct == null) return null;
                        return (
                          <span key={r} className="inline-flex items-center gap-1.5">
                            <Stars rarity={r as CardRarity} size={11} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{RARITY_META[r as CardRarity]?.label ?? r}</span>
                            <span className="font-mono text-[11px] font-bold" style={{ color: RARITY_META[r as CardRarity]?.gem || "#cbd5e1" }}>{pct}%</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2.5 lg:w-[300px]">
                    {/* Pull sizes come from the server so the price shown is
                        the price charged — and so a client can't invent one. */}
                    {/* 2 columns up to four options; 3 columns once the x16
                        and x32 join — six buttons two-across is a tower.
                        gap-y-3 + pt-2 give the name-ribbons room to sit
                        above their buttons instead of being clipped. */}
                    {/* The six pull tiles deal in one after another rather than
                        appearing as a block — 50ms apart, the system default.
                        This is the cheapest quality signal there is and it is
                        the whole reason lib/motion.ts exists. */}
                    <Stagger className={`grid gap-x-2 gap-y-3 pt-2 ${(catalog.pullSizes?.length ?? 3) > 4 ? "grid-cols-3" : "grid-cols-2"}`}>
                      {(catalog.pullSizes ?? [catalog.packSize]).map((n) => {
                        const price = catalog.pullPrices?.[n] ?? catalog.packPrice;
                        const headline = n === catalog.packSize;
                        const allIn = n === 32;
                        return (
                          <StaggerItem key={n} y={10}>
                          <button onClick={() => askPull(n)} disabled={opening}
                            title={`${n} card${n === 1 ? "" : "s"} · ${(price / n) % 1 === 0 ? price / n : (price / n).toFixed(1)} AP per card`}
                            className={`group relative flex flex-col items-center gap-0.5 px-2 py-3 transition hover:-translate-y-0.5 hover:brightness-115 disabled:opacity-40 ${
                              headline ? "text-[#160b2b]" : "text-slate-200"}`}
                            style={{
                              clipPath: notch(10),
                              background: headline
                                ? `linear-gradient(140deg, ${ACCENT_LIT}, ${ACCENT})`
                                : "rgba(255,255,255,.05)",
                              // The headline size wears a halo — the eye should
                              // land on the pull the banner wants you to make.
                              boxShadow: headline ? `0 0 16px ${ACCENT}99, 0 0 34px ${ACCENT}44`
                                : allIn ? `inset 0 0 0 1px ${ACCENT}66` : "inset 0 0 0 1px rgba(255,255,255,.12)",
                            }}>
                            {/* the two spins with a NAME get a little ribbon */}
                            {(headline || allIn) && (
                              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-[1.5px] text-[7px] font-black uppercase tracking-[0.22em]"
                                style={{
                                  clipPath: "polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)",
                                  background: headline ? "#160b2b" : `linear-gradient(100deg, ${ACCENT_LIT}, ${ACCENT})`,
                                  color: headline ? ACCENT_LIT : "#160b2b",
                                }}>
                                {headline ? "The Pack" : "All In"}
                              </span>
                            )}
                            <span className="text-lg font-black leading-none">×{n}</span>
                            {/* legibility: prices were slate-500 ghosts — the
                                one number a buy button exists to say */}
                            <span className={`text-[11px] font-black uppercase tracking-[0.12em] ${headline ? "text-[#160b2b]/80" : "text-slate-300"}`}>
                              {price.toLocaleString()} AP
                            </span>
                          </button>
                          </StaggerItem>
                        );
                      })}
                    </Stagger>
                    {opening && (
                      <p className="text-center text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
                        Opening…
                      </p>
                    )}
                    <GachaButton tone="jade" onClick={openRelic}
                      disabled={shards < catalog.relicPackShards}
                      title={shards < catalog.relicPackShards ? "Not enough shards yet" : "Guaranteed Epic or better"}
                      className="!py-3.5 !text-[13px]">
                      <Gem className="h-4 w-4" /> Relic · {catalog.relicPackShards.toLocaleString()}
                    </GachaButton>
                    <p className="mt-0.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Epic or better. Every time.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
            </Rise>
          )}


          {/* ── what shards do ── */}
          {catalog && (
            <div className="mb-8 grid gap-2.5 sm:grid-cols-3">
              {[
                { Icon: Recycle, t: "Dust", d: "Duplicates melt into shards — the rarer the dupe, the richer the dust. One tap on Dust Dupes clears the lot." },
                { Icon: Hammer, t: "Craft & Foil", d: "Shards build the exact card luck keeps withholding — or foil one you love to fight 20% harder." },
                { Icon: Gem, t: "Relic Packs", d: "Shards buy certainty: a Relic pack is Epic or better, every single time." },
              ].map(({ Icon, t, d }, i) => (
                <Rise key={t} delay={0.1 + i * 0.07}>
                <div className="relative flex items-start gap-3 px-4 py-3.5 transition hover:-translate-y-0.5"
                  style={{ clipPath: notch(13), background: "rgba(167,139,250,.045)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.16)" }}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">{t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{d}</p>
                  </div>
                </div>
                </Rise>
              ))}
            </div>
          )}

          {/* collection */}
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading your collection…</div>
          ) : (
            <div className="space-y-10">
              {/* ── ASLEEP ── surfaced at the TOP rather than left to be hunted.
                  A fallen card sits wherever its set happens to be, so with 69
                  cards across six sets the only way to find one was to scroll
                  the whole collection looking for a blue tint. Click one to
                  open its sheet, where the Wake button lives. */}
              {(() => {
                const fallen = catalog?.cards?.filter((c: CardDef) => asleep[c.id]) || [];
                if (!fallen.length) return null;
                return (
                  <div
                    className="px-4 py-3"
                    style={{ clipPath: notch(12), background: "rgba(56,120,200,.10)", boxShadow: "inset 0 0 0 1px rgba(125,211,252,.35)" }}
                  >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                        {fallen.length} card{fallen.length === 1 ? "" : "s"} asleep
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Fell in a duel you lost — wake with shards, or pull another copy free.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {fallen.map((c: CardDef) => (
                        <button
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className="rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-100 transition hover:bg-sky-500/20"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── VIEW TOGGLE + SEARCH ── one toolbar: how to read the
                  binder, and how to cut straight through it. */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Codex removed with the card reset — it catalogued tiers
                    that no longer exist. Dropped from the tab list so it is
                    unreachable; its render block is dead and can go with a
                    tidy pass. */}
                {([["sets", "By Set"], ["inv", "Inventory"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${view === v ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                    style={{
                      clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
                      background: view === v ? "linear-gradient(100deg, rgba(162,116,255,.35), rgba(124,58,237,.22))" : "rgba(255,255,255,.04)",
                      boxShadow: `inset 0 0 0 1px ${view === v ? "rgba(196,164,255,.55)" : "rgba(255,255,255,.08)"}`,
                    }}>
                    {label}
                  </button>
                ))}
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search cards…"
                  className="min-w-[10rem] flex-1 bg-black/40 px-3.5 py-2 text-sm text-white outline-none placeholder:text-slate-600 sm:max-w-xs"
                  style={{ clipPath: notch(9), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}
                />
                <div className="flex gap-1">
                  {/* S and G are CLASS filters sitting among the rarity ones.
                      Tinted to match their own plates (cyan for supports,
                      orange for grounds) rather than borrowing a rarity colour,
                      so it stays visible that they are a different question. */}
                  {(["all", "common", "rare", "epic", "legendary", "mythic", "support", "ground"] as const).map((r) => {
                    const on = rarFilter === r;
                    const tint = r === "all" ? "#cbd5e1"
                      : r === "support" ? "#67e8f9"
                      : r === "ground" ? "#fdba74"
                      : RARITY_META[r as CardRarity]?.gem || "#cbd5e1";
                    const label = r === "all" ? "Every rarity"
                      : r === "support" ? "Support cards — played, never fielded"
                      : r === "ground" ? "Ground cards — laid for a whole set"
                      : RARITY_META[r as CardRarity]?.label;
                    return (
                      <button key={r} onClick={() => setRarFilter(on && r !== "all" ? "all" : r)}
                        title={label}
                        className="px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition"
                        style={{
                          clipPath: notch(7),
                          color: on ? tint : "#64748b",
                          background: on ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.03)",
                          boxShadow: `inset 0 0 0 1px ${on ? `${tint}66` : "rgba(255,255,255,.07)"}`,
                        }}>
                        {r === "all" ? "All" : r.slice(0, 1)}
                      </button>
                    );
                  })}
                </div>
                <button onClick={openStats} title="Packs opened and the printed odds"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200/90 transition hover:text-amber-100"
                  style={{ clipPath: notch(7), background: "rgba(251,191,36,.08)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.30)" }}>
                  <BarChart3 className="h-3.5 w-3.5" /> Pull Stats
                </button>
                {isMine && isLeadDev(user) && (
                  <button
                    onClick={async () => {
                      if (!user) return;
                      try {
                        const r = await fetch(`${API_URL}/api/cards/grant-all`, {
                          method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: user.id }),
                        });
                        const d = await r.json();
                        if (!r.ok || !d.success) return toast(d.message || "Couldn't grant.", "error");
                        toast(d.data.granted > 0 ? `The whole catalog: ${d.data.granted} new cards granted.` : "You already hold every card.", "success");
                        await loadCollection();
                      } catch { toast("Couldn't grant.", "error"); }
                    }}
                    title="Lead dev only — grant one copy of every card you don't hold"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-300/90 transition hover:text-fuchsia-200"
                    style={{ clipPath: notch(7), background: "rgba(217,70,239,.08)", boxShadow: "inset 0 0 0 1px rgba(217,70,239,.30)" }}>
                    <Sparkles className="h-3.5 w-3.5" /> Claim Catalog
                  </button>
                )}
                {isMine && (
                  <button onClick={() => setDustAllOpen(true)} disabled={dustPreview.copies === 0}
                    title={dustPreview.copies === 0 ? "No duplicates to dust" : `${dustPreview.copies} duplicate cop${dustPreview.copies === 1 ? "y" : "ies"} → ${dustPreview.gain.toLocaleString()} shards`}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/90 transition hover:text-cyan-100 disabled:opacity-35"
                    style={{ clipPath: notch(7), background: "rgba(34,211,238,.08)", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.30)" }}>
                    <Recycle className="h-3.5 w-3.5" /> Dust Dupes{dustPreview.copies > 0 ? ` · ${dustPreview.copies}` : ""}
                  </button>
                )}
                {filtering && (
                  <span className="text-[11px] font-bold text-slate-500">
                    {sets.reduce((n, s) => n + s.cards.length, 0)} match{sets.reduce((n, s) => n + s.cards.length, 0) === 1 ? "" : "es"}
                  </span>
                )}
              </div>

              {/* ── PULL STATS MODAL ── how many packs the world has torn
                  open, how many were yours, and the exact odds inside one. */}
              <AnimatePresence>
                {statsOpen && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4"
                    onClick={() => setStatsOpen(false)}>
                    <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.22 }} onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-md overflow-y-auto p-5"
                      style={{ maxHeight: "85dvh", clipPath: notch(18), background: "linear-gradient(165deg, #16102b, #0c0818)", boxShadow: `inset 0 0 0 1px ${ACCENT}55` }}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-[0.24em] text-white">Pull Stats</h3>
                        <button onClick={() => setStatsOpen(false)} className="text-slate-500 transition hover:text-white" aria-label="Close">
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2.5">
                        {([[viewing ? `${viewing.username}'s spins` : "Your spins", pullStats?.mine], ["Community", pullStats?.community]] as const).map(([label, t]) => (
                          <div key={label} className="px-4 py-3"
                            style={{ clipPath: notch(10), background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
                            <p className="mt-1 text-2xl font-black text-white">{t ? t.packs.toLocaleString() : "…"}</p>
                            <p className="text-[10px] font-bold text-slate-500">{t ? `${t.cards.toLocaleString()} cards pulled` : "counting"}</p>
                            <p className="text-[10px] font-bold text-amber-200/80">{t ? `${(t.apSpent ?? 0).toLocaleString()} AP spent` : ""}</p>
                          </div>
                        ))}
                      </div>

                      <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Drop rates — every card in a pack</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {(["common", "rare", "epic", "legendary"] as const).map((r) => {
                          // Same rule as the banner: the served rates first, and
                          // no hardcoded fallback. A stale literal here would be
                          // worse than a blank — the Pull Stats sheet is where a
                          // player goes specifically to check the odds.
                          const pct = pullStats?.rates?.[r] ?? catalog?.pullRates?.[r];
                          if (pct == null) return null;
                          const tint = RARITY_META[r as CardRarity]?.gem || "#cbd5e1";
                          return (
                            <div key={r} className="flex items-center gap-2">
                              <span className="w-24 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: tint }}>
                                {RARITY_META[r as CardRarity]?.label || r}
                              </span>
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                                {/* floor at 1.2% width so legendary's 0.6% is a visible sliver, not nothing */}
                                <span className="block h-full rounded-full" style={{ width: `${Math.max(1.2, pct)}%`, background: tint }} />
                              </span>
                              <span className="w-14 text-right font-mono text-[11px] font-bold text-slate-300">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* THE DERIVED ODDS LINE, off the served rate only.
                          This still carried `?? 0.6` after the literals were
                          removed from the rows above it — and 0.6 has been
                          wrong since the roll was retuned to 0.4, so whenever
                          /pull-stats was slow this sentence quietly overstated
                          the chance of a legendary by half. A stale number
                          inside a computed sentence is worse than a stale
                          number in a table: nothing about it looks hardcoded.
                          No fallback now — the line is omitted until the real
                          rate arrives. */}
                      {(() => {
                        const lg = pullStats?.rates?.legendary ?? catalog?.pullRates?.legendary;
                        const size = catalog?.packSize ?? 4;
                        if (lg == null) return null;
                        return (
                          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                            A full pack of {size} turns up at least one legendary about{" "}
                            {(100 * (1 - Math.pow(1 - lg / 100, size))).toFixed(1)}% of the time.
                          </p>
                        );
                      })()}

                      <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Legendary build odds</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {([["fresh", "Fresh Build", "#fbbf24"], ["rusted", "Rusted", "#fb923c"], ["factory", "Factory New", "#cbd5e1"]] as const).map(([k, label, tint]) => {
                          const pct = pullStats?.legendaryWears?.[k]?.pct ?? ({ fresh: 8, rusted: 30, factory: 62 } as Record<string, number>)[k];
                          return (
                            <div key={k} className="flex items-center gap-2">
                              <span className="w-24 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: tint }}>{label}</span>
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: tint }} />
                              </span>
                              <span className="w-14 text-right font-mono text-[11px] font-bold text-slate-300">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                        Fresh Builds are the handmade originals — only a few ever existed. Factory News came off a line, which is why the machine made so many.
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── DUST ALL CONFIRM ── destructive, so it says exactly what
                  it will keep and exactly what it will take before it moves. */}
              <AnimatePresence>
                {dustAllOpen && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4"
                    onClick={() => setDustAllOpen(false)}>
                    <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.22 }} onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-sm p-5"
                      style={{ clipPath: notch(18), background: "linear-gradient(165deg, #0f1a2b, #0a0d18)", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.35)" }}>
                      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.24em] text-cyan-200">
                        <Recycle className="h-4 w-4" /> Dust every dupe
                      </h3>
                      <p className="mt-3 text-xs leading-relaxed text-slate-400">
                        Keeps <b className="text-white">one copy of every card</b> — and the best serial of{" "}
                        <b className="text-amber-300">every legendary build</b> (a Rusted is never a dupe of a Fresh Build). Event cards are untouched.
                      </p>
                      <div className="mt-4 px-4 py-3"
                        style={{ clipPath: notch(10), background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">The sweep</p>
                        <p className="mt-1 text-lg font-black text-white">
                          {dustPreview.copies.toLocaleString()} <span className="text-xs font-bold text-slate-500">copies</span>
                          <span className="mx-2 text-slate-600">→</span>
                          <span className="text-cyan-300">{dustPreview.gain.toLocaleString()}</span> <span className="text-xs font-bold text-slate-500">shards</span>
                        </p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => setDustAllOpen(false)}
                          className="flex-1 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:text-white"
                          style={{ clipPath: notch(9), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                          Keep them
                        </button>
                        <button onClick={dustAll} disabled={dustingAll || dustPreview.copies === 0}
                          className="flex-1 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:brightness-115 disabled:opacity-40"
                          style={{ clipPath: notch(9), background: "linear-gradient(100deg, #0e7490, #22d3ee)" }}>
                          {dustingAll ? "Dusting…" : "Dust them"}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {view === "sets" ? sets.map(({ set, cards, have, total }) => (
                // Each set glides in as you reach it — the page unrolls
                // instead of arriving as one wall.
                <Rise key={set}>
                <div>
                  <Heading
                    title={set}
                    sub={have >= total ? "Complete" : `${total - have} undiscovered`}
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

                  {/* Only cards you actually own are drawn. Two reasons: a card
                      you have never seen should be a surprise when it drops,
                      not a greyed-out silhouette you have already studied — and
                      rendering the whole catalog meant ~47 procedural SVG
                      portraits per page, most of them dimmed placeholders
                      nobody was looking at. What is still missing is shown as a
                      count instead. */}
                  {/* ── COLLAPSED BY DEFAULT ──────────────────────────────
                      Each card is a full SVG — gradients, rays, particles, a
                      vignette. A completed set is twenty of them, and several
                      sets on one page meant the browser building a hundred
                      before you had scrolled anywhere.

                      Only the first row and a bit is built up front; the rest
                      is behind See all. content-visibility already skips
                      PAINTING what is off-screen, but the elements still had
                      to exist and be laid out — this stops them being created
                      at all until asked for. */}
                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {(() => {
                      const mineInSet = cards.filter((c) => (owned[c.id] || 0) > 0);
                      const isOpen = expandedSets.includes(set);
                      return isOpen ? mineInSet : mineInSet.slice(0, SET_PREVIEW);
                    })().flatMap((c) => {
                      const count = owned[c.id] || 0;
                      const has = count > 0;
                      const tileStyle = {
                        clipPath: notch(12),
                        background: has ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.012)",
                        boxShadow: `inset 0 0 0 1px ${has ? "rgba(162,116,255,.24)" : "rgba(255,255,255,.05)"}`,
                        /**
                         * Off-screen cards are not rendered at all.
                         *
                         * Every card is a full SVG with gradients, rays,
                         * particles and a vignette. A collection of forty
                         * meant the browser laid out and painted forty of
                         * them whether or not two were on screen — that is
                         * what made scrolling this grid heavy.
                         *
                         * contain-intrinsic-size supplies a placeholder box
                         * so the scrollbar stays honest and nothing jumps
                         * as cards enter and leave the viewport.
                         */
                        contentVisibility: "auto",
                        containIntrinsicSize: `auto ${smallScreen ? 310 : 400}px`,
                      } as any;

                      /**
                       * WEAR TIERS ARE THEIR OWN ENTRIES. A legendary held in
                       * Fresh Build, Rusted and Factory New shows as THREE
                       * binder entries; two Factory New copies stack into one
                       * entry ×2. Same-card-different-wear never merges —
                       * that is the whole point of a graded copy.
                       */
                      const held = has ? prints[c.id] || [] : [];
                      if (held.length > 0) {
                        const wearMeta: Record<string, { label: string; cls: string }> = {
                          fresh:   { label: "Fresh Build", cls: "border-amber-400/60 bg-amber-500/15 text-amber-200" },
                          rusted:  { label: "Rusted",      cls: "border-orange-700/60 bg-orange-900/40 text-orange-300" },
                          factory: { label: "Factory New", cls: "border-slate-400/40 bg-slate-600/30 text-slate-200" },
                        };
                        const byWear: Record<string, number> = {};
                        for (const p of held) byWear[p.condition] = (byWear[p.condition] || 0) + 1;
                        return (["fresh", "rusted", "factory"] as const)
                          .filter((w) => byWear[w])
                          .map((w) => (
                            <button key={`${c.id}-${w}`} onClick={() => setSelected(c)}
                              className="group relative flex flex-col items-center gap-1.5 p-2 transition hover:-translate-y-1"
                              style={tileStyle}>
                              <CardFace card={c} owned count={byWear[w]} foil={!!foils[c.id]} hibernating={!!asleep[c.id]} level={levels[c.id]} forge={forges[c.id]} skillLevel={skillLevels[c.id]} skillCap={skillCapFor(c)} stats={catalog?.cardStats} statsById={catalog?.cardStatsById} roll={rolls[c.id]} merges={merges[c.id] || 0} wear={w} size={gridCard} ratio="5 / 9" />
                              <span className={`pointer-events-none inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${wearMeta[w].cls}`}>
                                {wearMeta[w].label}{byWear[w] > 1 ? ` ×${byWear[w]}` : ""}
                              </span>
                            </button>
                          ));
                      }

                      return [
                        <button key={c.id} onClick={() => setSelected(c)}
                          className="group relative flex flex-col items-center gap-1.5 p-2 transition hover:-translate-y-1"
                          style={tileStyle}>
                          {/* The card carries its own name, stars and rarity
                              badge now that the art is full-bleed, so nothing
                              is repeated underneath it. */}
                          <CardFace card={c} owned={has} count={count} foil={!!foils[c.id]} hibernating={!!asleep[c.id]} level={levels[c.id]} forge={forges[c.id]} skillLevel={skillLevels[c.id]} skillCap={skillCapFor(c)} stats={catalog?.cardStats} statsById={catalog?.cardStatsById} roll={rolls[c.id]} merges={merges[c.id] || 0} size={gridCard} ratio="5 / 9" />
                        </button>,
                      ];
                    })}
                  </div>

                  {/* See all / show less — only when there is actually more */}
                  {(() => {
                    const mineInSet = cards.filter((c) => (owned[c.id] || 0) > 0);
                    if (mineInSet.length <= SET_PREVIEW) return null;
                    const isOpen = expandedSets.includes(set);
                    return (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => setExpandedSets((s) =>
                            isOpen ? s.filter((x) => x !== set) : [...s, set]
                          )}
                          className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:text-white"
                          style={{
                            clipPath: notch(10),
                            background: "rgba(255,255,255,.05)",
                            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
                          }}>
                          {isOpen
                            ? "Show less"
                            : `See all ${mineInSet.length} · ${mineInSet.length - SET_PREVIEW} more`}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                </Rise>
              )) : view === "inv" ? (
                /* ── INVENTORY ── the shelf reading: everything you HOLD, by
                   rarity, nothing you don't. Legendaries get a shelf per
                   BUILD, because each wear is its own card. */
                <div className="space-y-8">
                  {(["gods", "mythic", "common", "rare", "epic"] as string[]).map((r) => {
                    // "gods" is the Pantheon shelf — set-keyed, above even
                    // mythic; the mythic shelf then excludes them so a god
                    // never files as an ordinary ★5.
                    const mine = (catalog?.cards || []).filter((c: CardDef) =>
                      (r === "gods"
                        ? c.set === "Pantheon"
                        : r === "mythic" ? c.rarity === "mythic" && c.set !== "Pantheon" : c.rarity === r)
                      && (owned[c.id] || 0) > 0 && matches(c));
                    if (!mine.length) return null;
                    return (
                      <Rise key={r}>
                      <div>
                        <Heading title={r === "gods" ? "Gods · The Pantheon" : RARITY_META[r as CardRarity].label} sub={`${mine.length} owned`} />
                        {/* whenVisible: these shelves sit far below the fold, and
                            a list that already animated before you scrolled to
                            it spent its one moment on nobody. */}
                        <Stagger whenVisible className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                          {mine.map((c: CardDef) => (
                            <StaggerItem key={c.id} y={10}>
                            <Tilt
                              className="relative h-full"
                              /* The foil sweep is EPIC AND ABOVE. A specular
                                 highlight on every common is how a foil stops
                                 meaning anything — the point of the effect is
                                 that seeing it tells you something. */
                              shine={RARITY_META[c.rarity].order >= 2}
                              max={7}
                            >
                            <button onClick={() => setSelected(c)}
                              className="group relative flex w-full flex-col items-center gap-1.5 p-2"
                              style={{
                                clipPath: notch(12), background: "rgba(255,255,255,.035)",
                                boxShadow: "inset 0 0 0 1px rgba(162,116,255,.24)",
                                contentVisibility: "auto", containIntrinsicSize: `auto ${smallScreen ? 310 : 400}px`,
                              } as any}>
                              <CardFace card={c} owned count={owned[c.id]} foil={!!foils[c.id]} hibernating={!!asleep[c.id]} level={levels[c.id]} forge={forges[c.id]} skillLevel={skillLevels[c.id]} skillCap={skillCapFor(c)} stats={catalog?.cardStats} statsById={catalog?.cardStatsById} roll={rolls[c.id]} merges={merges[c.id] || 0} size={gridCard} ratio="5 / 9" />
                            </button>
                            </Tilt>
                            </StaggerItem>
                          ))}
                        </Stagger>
                      </div>
                      </Rise>
                    );
                  })}
                  {(() => {
                    const wearMeta = [
                      { key: "fresh", label: "Fresh Build", cls: "border-amber-400/60 bg-amber-500/15 text-amber-200" },
                      { key: "rusted", label: "Rusted", cls: "border-orange-700/60 bg-orange-900/40 text-orange-300" },
                      { key: "factory", label: "Factory New", cls: "border-slate-400/40 bg-slate-600/30 text-slate-200" },
                    ];
                    const legendaries = (catalog?.cards || []).filter((c: CardDef) => c.rarity === "legendary" && (owned[c.id] || 0) > 0 && matches(c));
                    if (!legendaries.length) return null;
                    return (
                      <Rise>
                      <div>
                        <Heading title="Legendary" sub="Shelved by build — each wear is its own card" />
                        <div className="space-y-6">
                          {wearMeta.map((w) => {
                            const held = legendaries
                              .map((c: CardDef) => ({ c, n: (prints[c.id] || []).filter((p) => p.condition === w.key).length }))
                              .filter((x) => x.n > 0);
                            if (!held.length) return null;
                            return (
                              <div key={w.key}>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${w.cls}`}>
                                  {w.label} · {held.reduce((n, x) => n + x.n, 0)}
                                </span>
                                <div className="mt-2 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                  {held.map(({ c, n }) => (
                                    <button key={c.id} onClick={() => setSelected(c)}
                                      className="group relative flex flex-col items-center gap-1.5 p-2 transition hover:-translate-y-1"
                                      style={{
                                        clipPath: notch(12), background: "rgba(255,255,255,.035)",
                                        boxShadow: "inset 0 0 0 1px rgba(245,158,11,.28)",
                                        contentVisibility: "auto", containIntrinsicSize: `auto ${smallScreen ? 310 : 400}px`,
                                      } as any}>
                                      <CardFace card={c} owned count={n} foil={!!foils[c.id]} hibernating={!!asleep[c.id]} level={levels[c.id]} forge={forges[c.id]} skillLevel={skillLevels[c.id]} skillCap={skillCapFor(c)} stats={catalog?.cardStats} statsById={catalog?.cardStatsById} roll={rolls[c.id]} merges={merges[c.id] || 0} wear={w.key} size={gridCard} ratio="5 / 9" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      </Rise>
                    );
                  })()}
                </div>
              ) : (
                /* ── THE CODEX ── every card the Archive has ever recorded,
                   grouped by the DIMENSION it echoes from. Discovered cards
                   open their lore; undiscovered ones stay grey and silent —
                   a page the Archive hasn't turned for you yet. */
                <div className="space-y-10">
                  {DIMENSION_ORDER.map((dim) => {
                    const dimCards = (catalog?.cards || []).filter((c: CardDef) => c.set === dim && matches(c));
                    if (!dimCards.length) return null;
                    const found = dimCards.filter((c: CardDef) => (owned[c.id] || 0) > 0).length;
                    const D = DIMENSIONS[dim];
                    return (
                      <Rise key={dim}>
                      <div>
                        <Heading title={D?.title || dim} sub={`${found} of ${dimCards.length} discovered`} />
                        {D && (
                          <p className="mb-4 -mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{D.text}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                          {dimCards.map((c: CardDef) => {
                            const found1 = (owned[c.id] || 0) > 0;
                            return (
                              <button key={c.id}
                                onClick={() => { if (found1) setLoreCard(c); }}
                                className={`group relative flex flex-col items-center gap-1.5 p-2 transition ${found1 ? "hover:-translate-y-1" : "cursor-default"}`}
                                style={{
                                  clipPath: notch(12),
                                  background: "rgba(255,255,255,.03)",
                                  boxShadow: `inset 0 0 0 1px ${found1 ? "rgba(162,116,255,.24)" : "rgba(255,255,255,.06)"}`,
                                  contentVisibility: "auto", containIntrinsicSize: `auto ${smallScreen ? 310 : 400}px`,
                                } as any}>
                                <span className={found1 ? "" : "opacity-45 grayscale"}>
                                  <CardFace card={c} owned={found1} foil={found1 && !!foils[c.id]} size={gridCard} ratio="5 / 9" showStats={false} />
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${found1 ? "text-slate-400" : "italic text-slate-600"}`}>
                                  {found1 ? "Tap for the lore" : "Better luck next time"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      </Rise>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── THE LORE PAGE ── one discovered record, read aloud. */}
          <AnimatePresence>
            {loreCard && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[85] grid place-items-center bg-black/80 p-4"
                onClick={() => setLoreCard(null)}>
                <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.22 }} onClick={(e) => e.stopPropagation()}
                  className="flex w-full max-w-2xl flex-col items-center gap-5 overflow-y-auto p-6 md:flex-row md:items-start"
                  style={{ maxHeight: "88dvh", clipPath: notch(18), background: "linear-gradient(165deg, #14102b, #0a0716)", boxShadow: `inset 0 0 0 1px ${ACCENT}55` }}>
                  <div className="shrink-0">
                    <CardFace card={loreCard} owned foil={!!foils[loreCard.id]} level={levels[loreCard.id]} forge={forges[loreCard.id]} size={170} ratio="5 / 9" showStats={false} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: ACCENT_LIT }}>
                      {DIMENSIONS[loreCard.set]?.title || loreCard.set}
                    </p>
                    <h3 className="mt-1 font-fell text-2xl font-bold text-white">{loreCard.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      {CARD_LORE[loreCard.id] || loreCard.flavor}
                    </p>
                    {CARD_LORE[loreCard.id] && (
                      <p className="mt-3 text-xs italic leading-relaxed text-slate-500">&ldquo;{loreCard.flavor}&rdquo;</p>
                    )}
                    <button onClick={() => setLoreCard(null)}
                      className="mt-5 px-5 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-300 transition hover:text-white"
                      style={{ clipPath: notch(8), background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}>
                      Close the page
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── ACTION BURST ── one element, transform + opacity, self-unmounting.
          Dusting and levelling used to happen in total silence: a number
          changed somewhere and that was it. This is the smallest thing that
          makes a spend feel like it landed, and it costs a single compositor
          layer for under a second. */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.key}
            className="pointer-events-none fixed inset-0 z-[125] grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div aria-hidden className="absolute inset-0 bg-black/45" />
            {/* glow */}
            <motion.span
              className="absolute rounded-full"
              style={{
                width: 340, height: 340,
                background: burst.kind === "dust"
                  ? "radial-gradient(closest-side, rgba(103,232,249,.9), transparent 70%)"
                  : `radial-gradient(closest-side, ${ACCENT_LIT}, transparent 70%)`,
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.1, 1.4], opacity: [0, 1, 0] }}
              transition={{ duration: 1.25, ease: "easeOut" }}
            />
            {/* shards thrown outward — 10 elements, transform only */}
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2;
              return (
                <motion.span key={i} className="absolute h-2 w-2 rounded-sm"
                  style={{ background: burst.kind === "dust" ? "#67e8f9" : ACCENT_LIT }}
                  initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    x: Math.cos(a) * 190, y: Math.sin(a) * 190,
                    opacity: [0, 1, 0], rotate: 220,
                  }}
                  transition={{ duration: 1.1, ease: "easeOut", delay: 0.05 }}
                />
              );
            })}
            <motion.div
              className="relative flex flex-col items-center gap-1"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.12, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.25, times: [0, 0.25, 0.5, 1], ease: "easeOut" }}
            >
              <span className="text-3xl font-black uppercase tracking-[0.28em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,.95)]">
                {burst.kind === "dust" ? "Dusted" : "Level Up"}
              </span>
              <span className="text-lg font-black tabular-nums"
                style={{ color: burst.kind === "dust" ? "#a5f3fc" : ACCENT_LIT }}>
                {burst.label}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* pack reveal — staggered flip, rarity burst, best card last */}
      <AnimatePresence>
        {reveal && (
          <PackReveal cards={reveal} prints={revealPrints} newIds={revealNew}
            onClose={() => { setReveal(null); setRevealPrints([]); setRevealNew([]); }} />
        )}
      </AnimatePresence>

      {/* THE PULL CONFIRM. Names the exact size and the exact price, because a
          sheet that just says "are you sure" makes the player confirm a number
          they have to remember. Cancel is the plain-text option and Open is the
          coloured one, but neither is hidden — the rule is that cancelling must
          never be harder than committing. */}
      <ConfirmModal
        isOpen={pendingPull !== null}
        title={`Open ${pendingPull ?? 0} card${(pendingPull ?? 0) === 1 ? "" : "s"}?`}
        message={
          isLeadDev(user)
            ? `This pull is free on your account.`
            : `This costs ${((pendingPull && catalog?.pullPrices?.[pendingPull]) ?? catalog?.packPrice ?? 0).toLocaleString()} Arise Points. You'll have ${Math.max(
                0,
                apDisplay - ((pendingPull && catalog?.pullPrices?.[pendingPull]) ?? catalog?.packPrice ?? 0)
              ).toLocaleString()} left.`
        }
        danger={false}
        confirmText="Open"
        cancelText="Not now"
        onCancel={() => setPendingPull(null)}
        onConfirm={() => {
          const n = pendingPull;
          setPendingPull(null);
          if (n != null) openPack(n);
        }}
      />

      {/* card detail */}
      <AnimatePresence>
        {selected && catalog && (() => {
          const count = owned[selected.id] || 0;
          const R = RARITY_META[selected.rarity];
          const craftable = selected.rarity !== "event" && (catalog.craftCost[selected.rarity] || 0) > 0;
          const cost = catalog.craftCost[selected.rarity] || 0;
          const dustEach = catalog.dustValue[selected.rarity] || 0;
          /**
           * BASE STATS, in the server's own precedence: this copy's roll, then
           * the per-card table, then rarity. Both upper rungs were missing
           * here — the sheet read the rarity line only, so a Squire's detail
           * panel advertised 18/7 and every rolled copy showed numbers the
           * arena would never honour.
           */
          // All THREE rungs the server uses, in order: per-card table, then the
          // Pantheon's flat line, then rarity. The middle one was missing, so a
          // god read off the mythic row (36/15) and the sheet contradicted the
          // grid tile behind it (44/19) on the same screen.
          const printedCs = catalog.cardStatsById?.[selected.id]
            || (selected.set === "Pantheon"
              ? GOD_STATS_MIRROR
              : catalog.cardStats?.[selected.rarity])
            || { atk: 0, hp: 0 };
          const myRoll = rolls[selected.id];
          const cs = {
            atk: typeof myRoll?.atk === "number" && myRoll.atk > 0 ? myRoll.atk : printedCs.atk,
            hp: typeof myRoll?.hp === "number" && myRoll.hp > 0 ? myRoll.hp : printedCs.hp,
          };
          const mergedTimes = merges[selected.id] || 0;
          const isRolled = cs.atk !== printedCs.atk || cs.hp !== printedCs.hp;
          const m = foils[selected.id] ? 1.2 : 1;
          const lvl = levels[selected.id] || 1;
          const maxLvl = catalog.maxCardLevel ?? 10;
          const lvlMult = 1 + (lvl - 1) * (catalog.levelStep ?? 0.07);
          // What the card ACTUALLY fights with: base × foil × level, plus the
          // forge's flat points — matching buildFighter() on the server so the
          // sheet can't advertise a number the arena won't honour.
          const F = (catalog as any).forge;
          const fg = forges[selected.id] || { atk: 0, hp: 0 };
          const atk = Math.round(cs.atk * m * lvlMult) + fg.atk * (F?.atkStep ?? 1);
          const hp = Math.round(cs.hp * m * lvlMult) + fg.hp * (F?.hpStep ?? 2);
          const lvlBase = catalog.upgradeBase?.[selected.rarity] ?? 30;
          const lvlCost = Math.round(lvlBase * Math.pow(catalog.upgradeGrowth ?? 1.35, lvl - 1));
          const lvlCapped = lvl >= maxLvl;
          // A card carries a DOMAIN or a SKILL, never both. Domains are the
          // legendary mechanic and rewrite a rule of the fight; skills are the
          // epic one and do a thing. They render differently on purpose.
          const dom = catalog.domains?.[selected.id];
          const sk = dom ?? catalog.skills?.[selected.id];
          const isDomain = !!dom;
          const skLvl = skillLevels[selected.id] || 1;
          const skMax = isDomain ? (catalog.maxDomainLevel ?? 3) : (catalog.maxSkillLevel ?? 5);
          const skNow = sk?.levels?.[skLvl - 1];
          const skCost = skNow?.cost ?? null;
          const asl = !!asleep[selected.id];
          // Legendaries carry REAL identities now — server-minted serials with
          // a condition each. The hash tag below survives only as the
          // stand-in for tiers that don't have prints.
          const myPrints = prints[selected.id] || [];
          const bestPrint = [...myPrints].sort((a, b) => {
            const rank = (c: string) => (c === "fresh" ? 2 : c === "rusted" ? 1 : 0);
            return rank(b.condition) - rank(a.condition) || a.serial - b.serial;
          })[0];
          const condMeta: Record<string, { label: string; cls: string }> = {
            fresh:   { label: "Fresh Build", cls: "border-amber-400/60 bg-amber-500/15 text-amber-200" },
            rusted:  { label: "Rusted",      cls: "border-orange-700/60 bg-orange-900/30 text-orange-300" },
            factory: { label: "Factory New", cls: "border-slate-400/40 bg-slate-500/15 text-slate-200" },
          };
          const tag = String(Math.abs([...selected.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 10000).padStart(4, "0");

          /**
           * SPARE COPIES — computed ONCE, read by both things that can consume
           * one. Dusting and merging are now presented as a choice, so if they
           * disagreed about how many spares exist the panel would offer a
           * merge the dust button says you can't afford, or vice versa.
           *
           * WEAR-AWARE for legendaries: a Fresh Build and a Factory New are
           * different objects, not duplicates of each other, and only same-build
           * extras count. Mirrors the server's rule exactly.
           */
          const wearDupes = myPrints.length > 0
            ? myPrints.length - new Set(myPrints.map((p) => p.condition)).size
            : count - 1;

          // The card yields to the phone: full 340 on desktop, whatever the
          // viewport actually affords on mobile. Computed at open — the sheet
          // is transient, so a rotation just means reopening it.
          const sheetSize = Math.min(340, (typeof window !== "undefined" ? window.innerWidth : 640) - 72);
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              /* THE WRAPPER SCROLLS. A centred child taller than the viewport
                 cannot be scrolled back to — this codebase has shipped that
                 bug once already, and on a phone this sheet (card + readouts,
                 stacked) is ALWAYS taller than the viewport. min-h-full
                 centring below keeps the desktop look identical. */
              className="fixed inset-0 z-[120] overflow-y-auto bg-black/90"
              onClick={() => setSelected(null)}
            >
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex w-full max-w-4xl flex-col items-center gap-6 py-2 md:flex-row md:items-stretch md:justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── LEFT · the card, big, lit by its own rarity ── */}
                <div className="shrink-0" style={{ filter: `drop-shadow(0 20px 60px ${R.glow})` }}>
                  <CardFace
                    card={selected}
                    owned={count > 0}
                    count={count}
                    foil={!!foils[selected.id]}
                    hibernating={asl}
                    wear={bestPrint?.condition}
                    skillLevel={skillLevels[selected.id]}
                    skillCap={skillCapFor(selected)}
                    size={sheetSize}
                    // Matches the grids. The sheet was still on the default
                    // 5/7 while the collection behind it had gone 5/9, so
                    // opening a card made it visibly squarer than the card you
                    // just clicked.
                    ratio="5 / 9"
                    showStats={false}
                    stats={catalog.cardStats}
                    statsById={catalog.cardStatsById}
                    roll={myRoll}
                    merges={mergedTimes}
                  />
                </div>

                {/* ── RIGHT · the readouts. On desktop they scroll on their own
                       so the art never leaves the screen; on a phone the WHOLE
                       sheet scrolls as one page, because a scroll region inside
                       a scroll region is how mobile modals eat swipes. */}
                <div
                  className="flex w-full flex-col rounded-2xl border border-white/10 bg-[#0b0b11] md:max-h-[86dvh] md:w-[420px] md:overflow-y-auto"
                  style={{ boxShadow: "0 24px 70px rgba(0,0,0,.7)" }}
                >
                  <div className="flex flex-col gap-4 p-5">
                    {/* header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {selected.support
                          ? <Heart className="h-4 w-4 shrink-0 text-rose-400" />
                          : <Gem className="h-4 w-4 shrink-0" style={{ color: R.frame }} />}
                        <span className="truncate text-base font-black" style={{ color: R.gem }}>
                          {selected.support ? "Support" : R.label}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-slate-500">Lv.{lvl}</span>
                      </div>
                      <span className="shrink-0 font-mono text-sm text-slate-600">
                        {bestPrint ? `#${String(bestPrint.serial).padStart(3, "0")}` : `#${tag}`}
                      </span>
                    </div>

                    {/* ── PRINTS ── each legendary copy is a numbered, graded
                        object. Every one you hold is listed; the badge colour
                        is the condition. */}
                    {myPrints.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {myPrints.map((p) => {
                          const m = condMeta[p.condition] || condMeta.factory;
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

                    {/* ── STAT TILES ── support cards genuinely have no attack
                        or health, so they get their effect here instead of a
                        row of zeroes pretending to be a stat line. */}
                    {selected.support ? (
                      <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">Effect</p>
                        <p className="mt-1 text-sm font-bold leading-relaxed text-cyan-100">{supportText(selected.support, levels[selected.id] || 1)}</p>
                      </div>
                    ) : selected.ground ? (
                      /* Grounds are their own class — laid, never fielded, and
                         scoped to one set. Given their own plate rather than
                         folded in with supports so the scope is unmissable:
                         splashing this into a mixed deck buys nothing. */
                      <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300/80">
                          Ground · {selected.ground.set} only
                        </p>
                        <p className="mt-1 text-sm font-bold leading-relaxed text-orange-100">{groundText(selected.ground, levels[selected.id] || 1)}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2.5">
                        <StatTile Icon={Heart} value={hp} label="HP" tint="#fb7185" wash="rgba(190,24,60,.16)" edge="rgba(251,113,133,.30)" />
                        <StatTile Icon={Swords} value={atk} label="ATK" tint="#fbbf24" wash="rgba(180,83,9,.16)" edge="rgba(251,191,36,.30)" />
                        <StatTile Icon={Layers} value={count} label="COPIES" tint="#60a5fa" wash="rgba(30,64,175,.16)" edge="rgba(96,165,250,.30)" />
                      </div>
                    )}

                    {/* ── THIS COPY ── the pull roll, said out loud.
                        Every pulled card is stamped with its own HP/ATK inside
                        ±15% of the printed line, so two copies of one card are
                        genuinely different objects. That was true for a while
                        before anything on any screen SAID so, which read from
                        the outside exactly like the feature never shipped. */}
                    {count > 0 && !selected.support && !selected.ground && (isRolled || mergedTimes > 0) && (
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/80">
                          <Sparkles className="h-3 w-3" /> This copy
                          {mergedTimes > 0 && <span className="text-amber-300">· merged {mergedTimes}×</span>}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-emerald-100">
                          {cs.hp} HP · {cs.atk} ATK
                          <span className="ml-2 font-sans text-[11px] font-medium text-slate-500">
                            printed {printedCs.hp} / {printedCs.atk}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Rolled when it was pulled. Levels and the forge apply on top, so this is a
                          starting point rather than a ceiling.
                        </p>
                      </div>
                    )}

                    {/* ── LEVEL ── the reference's XP bar, on the thing we
                        actually track. Shards, not experience: nothing in this
                        game earns a card passive progress, and a bar that only
                        ever moves when you pay would be a lie shaped like one
                        that fills on its own. */}
                    {count > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
                            <Sparkles className="h-3.5 w-3.5" /> Level
                          </span>
                          <span className="font-mono text-xs text-slate-400">{lvl} / {maxLvl}</span>
                        </div>
                        <SegBar value={lvl} max={maxLvl} tone="#FBBF24" />
                        <p className="mt-2 text-[11px] text-slate-500">
                          {lvlCapped
                            ? "Fully levelled — nothing left to raise."
                            : `${lvlCost.toLocaleString()} shards to level ${lvl + 1} · +${Math.round((lvl) * (catalog.levelStep ?? 0.07) * 100)}% ${selected.support ? "EFFECT POWER" : "ATK & HP"} at the next step`}
                        </p>
                      </div>
                    )}

                    {/* ── SPARE COPIES ── the choice, priced both ways.
                        A duplicate can go two places and they are opposites:
                        DUST pays you shards and the spare is gone, MERGE costs
                        you shards and the spare is gone. Presenting them in one
                        block with both numbers visible is the whole point —
                        dust was buried in the action stack below while merge
                        sat up here, so the two were never actually a choice.
                        Both act on a duplicate of THIS card and nothing else,
                        so the panel needs no picker: strengthening a card is
                        gated on pulling that same card again. */}
                    {isMine && count > 0 && !selected.support && !selected.ground && catalog.merge && (() => {
                      const cap = catalog.merge.max;
                      const done = mergedTimes;
                      const nextCost = catalog.merge.cost?.[selected.rarity]?.[done] ?? null;
                      const capped = done >= cap;
                      const tooPoor = nextCost !== null && shards < nextCost;
                      /**
                       * MERGE and DUST count spares DIFFERENTLY, on purpose.
                       *
                       * Dust is wear-aware: a Fresh Build and a Factory New are
                       * distinct collectibles, not duplicates, so it refuses to
                       * melt one for shards. Merging deliberately consumes a
                       * copy and the server burns the WORST print first, so it
                       * only needs a second copy to exist at all.
                       *
                       * Matching the server exactly matters here — a client that
                       * used wearDupes for both would grey out a merge the API
                       * would happily accept, on precisely the legendaries where
                       * the upgrade is worth the most.
                       */
                      const canMerge = count >= 2;
                      // Nothing to say when there is no spare of any kind.
                      if (wearDupes <= 0 && !canMerge) return null;
                      return (
                        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-4 py-3">
                          <div className="mb-2 flex items-baseline justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-200">
                              <Layers className="h-3.5 w-3.5" /> Spare copies
                            </span>
                            <span className="font-mono text-xs text-slate-400">merged {done}/{cap}</span>
                          </div>
                          <SegBar value={done} max={cap} tone="#E879F9" />

                          {/* The two paths, side by side, each showing its own
                              price. Disabled states say WHY rather than going
                              quietly grey — "no spare to dust" and "not enough
                              shards" are different problems with different fixes. */}
                          <div className="mt-2.5 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => dust(selected)}
                              disabled={wearDupes <= 0}
                              title={wearDupes <= 0
                                ? "No spare copy of this card to dust"
                                : `Melt ${wearDupes} spare cop${wearDupes === 1 ? "y" : "ies"} down for shards`}
                              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-2 text-center transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <span className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                                <Recycle className="h-3 w-3" /> Dust
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] font-bold text-cyan-100">
                                {wearDupes > 0 ? `+${(wearDupes * dustEach).toLocaleString()}` : "—"}
                              </span>
                              <span className="block text-[9px] uppercase tracking-[0.12em] text-slate-500">shards</span>
                            </button>

                            <button
                              onClick={() => doMerge(selected)}
                              disabled={capped || tooPoor || !canMerge || merging}
                              title={capped
                                ? `Already merged ${cap} times — that's the cap`
                                : !canMerge
                                ? `Needs a second copy of ${selected.name} itself — merging only takes the same card`
                                : tooPoor
                                ? `Costs ${nextCost?.toLocaleString()} shards`
                                : "Spend a spare copy AND shards to make this one permanently stronger"}
                              className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/15 px-2 py-2 text-center transition hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <span className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200">
                                <ArrowUp className="h-3 w-3" /> Merge
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] font-bold text-fuchsia-100">
                                {capped ? "MAX" : nextCost !== null ? `−${nextCost.toLocaleString()}` : "Free"}
                              </span>
                              <span className="block text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                {capped ? "merged out" : "shards"}
                              </span>
                            </button>
                          </div>

                          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                            {capped
                              ? "Merged to the cap — this copy is as strong as merging can make it. Spares can still be dusted."
                              : !canMerge
                              ? <>Merging takes a second copy of {selected.name} itself — no other card will do.</>
                              : <>
                                  Dusting pays you and the spare is gone. Merging costs you, the spare is gone,
                                  and this copy keeps
                                  {" "}+{Math.max(1, Math.round(printedCs.hp * (catalog.merge.step ?? 0.08)))} HP
                                  {" "}/ +{Math.max(1, Math.round(printedCs.atk * (catalog.merge.step ?? 0.08)))} ATK
                                  {" "}permanently.
                                </>}
                          </p>
                        </div>
                      );
                    })()}

                    {/* ── THE FORGE ── flat stat training, one stat at a time,
                        deliberately dear: the price doubles per rank. Sits
                        under LEVEL because it's the same idea, sharpened —
                        level raises everything a little, the forge raises ONE
                        thing a lot. */}
                    {/* Grounds excluded, same as every other stat panel in this
                        sheet. They were the one panel that missed it, so a
                        ground offered live forge buttons the server honoured —
                        up to 34,100 shards bought into ranks that buildFighter
                        never reads, because a ground is never a fighter. */}
                    {count > 0 && !selected.support && !selected.ground && F && isMine && (() => {
                      const rows = [
                        { stat: "atk" as const, label: "ATK", step: F.atkStep, rank: fg.atk, costs: F.atkCost?.[selected.rarity] || [], tint: "#fbbf24" },
                        { stat: "hp" as const, label: "HP", step: F.hpStep, rank: fg.hp, costs: F.hpCost?.[selected.rarity] || [], tint: "#fb7185" },
                      ];
                      return (
                        <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] px-4 py-3">
                          <div className="mb-2.5 flex items-baseline justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-orange-200">
                              <Hammer className="h-3.5 w-3.5" /> The Forge
                            </span>
                            <span className="text-[10px] text-slate-500">flat power · price doubles per rank</span>
                          </div>
                          <div className="space-y-2.5">
                            {rows.map((r) => {
                              const maxed = r.rank >= F.max;
                              const cost = maxed ? null : r.costs[r.rank];
                              return (
                                <div key={r.stat} className="flex items-center gap-2.5">
                                  <span className="w-8 shrink-0 text-xs font-black" style={{ color: r.tint }}>{r.label}</span>
                                  <span className="flex shrink-0 items-center gap-1">
                                    {Array.from({ length: F.max }, (_, i) => (
                                      <span key={i} className="h-2 w-3.5"
                                        style={{ background: i < r.rank ? r.tint : "rgba(255,255,255,.10)", clipPath: "polygon(15% 0,100% 0,85% 100%,0 100%)" }} />
                                    ))}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                                    +{r.step * r.rank}{maxed ? " · fully forged" : ""}
                                  </span>
                                  {!maxed && (
                                    <button onClick={() => forge(selected, r.stat)}
                                      disabled={forging || (!isLeadDev(user) && shards < (cost ?? 0))}
                                      title={`+${r.step} ${r.label}, permanently, in every mode`}
                                      className="shrink-0 rounded-lg border border-orange-400/30 bg-orange-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-orange-200 transition hover:bg-orange-500/25 disabled:opacity-35">
                                      {(cost ?? 0).toLocaleString()} shards
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── ABILITY ── a DOMAIN on legendaries, a SKILL on epics.
                        They get visibly different treatment because they are
                        different mechanics, not two sizes of one. */}
                    {count > 0 && sk && (
                      <div
                        className={`rounded-xl px-4 py-3 ${
                          isDomain
                            ? "border border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-500/[0.14] to-purple-500/[0.06]"
                            : "border border-purple-400/25 bg-purple-500/[0.07]"
                        }`}
                        style={isDomain ? { boxShadow: "inset 0 0 30px rgba(217,70,239,.14)" } : undefined}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] ${isDomain ? "text-fuchsia-200" : "text-purple-200"}`}>
                            <Zap className="h-3.5 w-3.5" /> {isDomain ? "Domain Expansion" : "Skill"}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${isDomain ? "bg-fuchsia-500/30 text-fuchsia-100" : "bg-purple-500/25 text-purple-200"}`}>
                            LV.{skLvl}
                          </span>
                        </div>
                        <p className="text-lg font-black leading-tight text-white">{sk.name}</p>
                        {isDomain && (
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-300/70">
                            Once per duel · rewrites the fight
                          </p>
                        )}
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{skNow?.text}</p>
                        {skLvl < skMax && sk.levels?.[skLvl] && (
                          <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-600">
                            Next rank: {sk.levels[skLvl].text}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── ASLEEP ── */}
                    {asl && (
                      <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.08] px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">Asleep</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                          It fell in a duel you lost and can&rsquo;t be fielded until it wakes. Pulling another copy wakes it free.
                        </p>
                      </div>
                    )}

                    {/* ── ACTIONS ── */}
                    {isMine && (
                      <div className="flex flex-col gap-2">
                        {asl && (() => {
                          const wc = (catalog as any).wakeCost?.[selected.rarity] ?? 0;
                          return (
                            <ActionButton onClick={() => wake(selected)} disabled={shards < wc} Icon={Sparkles}>
                              Wake ({wc.toLocaleString()} shards)
                            </ActionButton>
                          );
                        })()}

                        {count > 0 && !asl && (
                          <ActionButton onClick={() => upgrade(selected)} disabled={lvlCapped || shards < lvlCost} Icon={ArrowUp}>
                            {lvlCapped ? "Max level" : `Upgrade Level (${lvlCost.toLocaleString()} shards)`}
                          </ActionButton>
                        )}

                        {count > 0 && !asl && sk && (
                          <ActionButton
                            onClick={() => upgradeSkill(selected)}
                            disabled={skLvl >= skMax || skCost === null || shards < skCost}
                            Icon={Zap}
                          >
                            {skLvl >= skMax
                              ? (isDomain ? "Domain at its ceiling" : "Skill mastered")
                              : `${isDomain ? "Deepen Domain" : "Upgrade Skill"} (${(skCost ?? 0).toLocaleString()} shards)`}
                          </ActionButton>
                        )}

                        {(count > 1 || (count === 0 && craftable) || (count > 0 && !foils[selected.id] && selected.rarity !== "event")) && (
                          <div className="my-1 h-px bg-white/10" />
                        )}

                        {/* Attune sits ABOVE Dust on purpose. Both consume
                            spares, and this is the one that's usually the
                            better answer for a card you actually play — the
                            order is the recommendation. */}
                        {count > 1 && sk && skLvl < skMax && !asl && (
                          <ActionButton onClick={() => attune(selected)} Icon={Zap}>
                            Attune · 1 copy → {isDomain ? "Domain" : "Skill"} rank {skLvl + 1}
                          </ActionButton>
                        )}

                        {/* Dust lives in the SPARE COPIES panel above for
                            anything that can merge, so the two fates of a
                            duplicate are presented as one choice with both
                            prices on screen. This button is the fallback for
                            cards that panel never renders for — supports and
                            grounds, which have no stat line to merge into. */}
                        {wearDupes > 0 && (selected.support || selected.ground || !catalog.merge) && (
                          <ActionButton onClick={() => dust(selected)} Icon={Recycle}>
                            Dust {wearDupes} same-build dupe{wearDupes === 1 ? "" : "s"} (+{wearDupes * dustEach} shards)
                          </ActionButton>
                        )}

                        {count > 0 && !foils[selected.id] && selected.rarity !== "event" && (
                          <ActionButton
                            onClick={() => foilUp(selected)}
                            disabled={shards < (catalog.foilCost[selected.rarity] || 0)}
                            Icon={Gem}
                          >
                            Make Foil · +20% ({(catalog.foilCost[selected.rarity] || 0).toLocaleString()} shards)
                          </ActionButton>
                        )}

                        {count === 0 && craftable && (
                          <ActionButton onClick={() => craft(selected)} disabled={shards < cost} Icon={Hammer}>
                            Craft ({cost.toLocaleString()} shards)
                          </ActionButton>
                        )}
                      </div>
                    )}

                    {/* footnotes */}
                    {foils[selected.id] && (
                      <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-center text-[11px] font-bold text-purple-200">
                        Foil — fights 20% harder in duels
                      </p>
                    )}
                    {count === 1 && <p className="text-center text-[11px] text-slate-600">Pull another copy to dust it for shards.</p>}
                    {count === 0 && !craftable && <p className="text-center text-[11px] text-slate-600">This card only appears during events.</p>}
                    {count === 0 && <p className="text-center text-[11px] text-slate-600">Not yet collected — its stats are what it WOULD bring.</p>}
                  </div>
                </div>
              </motion.div>

              {/* FIXED, not absolute: the wrapper scrolls now, and an absolute
                  button would scroll away with the top of the sheet. */}
              <button onClick={() => setSelected(null)} aria-label="Close"
                className="fixed right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/60 text-slate-300 transition hover:bg-white/15 hover:text-white">
                <X className="h-5 w-5" />
              </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}

/**
 * One big stat readout. Three of these are the top band of the card sheet —
 * the number is the subject, the label is a footnote, and the icon carries the
 * colour so the three read apart at a glance rather than needing to be read.
 */
function StatTile({
  Icon, value, label, tint, wash, edge,
}: {
  Icon: ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  tint: string;
  wash: string;
  edge: string;
}) {
  return (
    <div className="rounded-xl px-2 py-3 text-center" style={{ background: wash, boxShadow: `inset 0 0 0 1px ${edge}` }}>
      <Icon className="mx-auto h-4 w-4" />
      <div className="mt-1 text-2xl font-black leading-none tabular-nums" style={{ color: tint }}>{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
    </div>
  );
}

/** A full-width action row. Flat, like everything else on the sheet. */
function ActionButton({
  onClick, disabled, Icon, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  Icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.05]"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
