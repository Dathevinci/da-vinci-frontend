"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, X, Check, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { authHeaders } from "@/lib/authToken";
import { loadCatalog } from "@/lib/catalogCache";
import { swrJson } from "@/lib/swrCache";
import CardFace, { CardDef, RARITY_META } from "@/components/cards/CardFace";
import { Panel, Heading, GachaButton, notch, ACCENT_LIT } from "@/components/cards/gacha";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
// Four, by the owner's eye: five full-size cards crowded the row.
const SLOTS = 4;

/**
 * SHOWCASE — up to four cards pinned to a profile, shown at the same
 * full-art size and shape the rest of the app uses.
 *
 * REMOVAL LIVES ON THE SHOWCASE, NOT IN THE PICKER. That is the whole point
 * of this component's shape. The picker can only list cards you own, so when
 * a pinned card left your collection — synthesised into a Mythic, dusted,
 * sold — it vanished from the picker while still rendering on the profile,
 * and there was no control anywhere that could unpin it. Worse, the server
 * rejects the entire array if any id fails the ownership check, so one dead
 * card meant no showcase edit could ever be saved again. A card you cannot
 * see is a card you cannot untick; every pinned slot now carries its own
 * remove button and removes BY INDEX, so anything can always be pulled.
 *
 * The server also filters dead pins out of the profile payload now, so this
 * is belt and braces — but the belt matters, because a cached collection can
 * still hand this component a card the server has already forgotten.
 *
 * The server verifies ownership on save, so the picker is a convenience, not
 * the check.
 */
export default function ShowcaseCards({
  userId,
  isMine,
  initial = [],
}: {
  userId: string;
  isMine: boolean;
  initial?: string[];
}) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  // Stat truth: a showcased card carries its level, forge ranks and best
  // build — the same numbers the binder, duels and dungeon show.
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [forges, setForges] = useState<Record<string, { atk: number; hp: number }>>({});
  const [wears, setWears] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, number>>({});
  const [asleep, setAsleep] = useState<Record<string, boolean>>({});
  const [skillLvls, setSkillLvls] = useState<Record<string, number>>({});
  // Has the collection actually arrived? Without this, an empty first render
  // reads as "you own nothing" and every pin looks dead.
  const [loaded, setLoaded] = useState(false);
  // The picker portals to <body>, which does not exist during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // skills/domains + caps from the catalog, for CardFace's MAX sign.
  const [catMeta, setCatMeta] = useState<any>(null);
  const capFor = (c: CardDef) =>
    catMeta?.domains?.[c.id] ? (catMeta.maxDomainLevel ?? 3)
    : catMeta?.skills?.[c.id] ? (catMeta.maxSkillLevel ?? 5)
    : undefined;

  // Two states, not one. `committed` is the last thing the server confirmed;
  // `draft` is what you are editing. Cancel restores committed rather than a
  // prop the parent never refetches.
  const [committed, setCommitted] = useState<string[]>(initial.slice(0, SLOTS));
  const [draft, setDraft] = useState<string[]>(initial.slice(0, SLOTS));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Picker controls
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<string>("all");
  const [sort, setSort] = useState<"rarity" | "level" | "copies" | "name">("rarity");

  // On a phone, 216px cards stack one per row and the showcase becomes a
  // scroll marathon. Under 640px they drop to 150 — two per row.
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const cardSize = small ? 150 : 216;

  useEffect(() => {
    const next = initial.slice(0, SLOTS);
    setCommitted(next);
    setDraft(next);
  }, [initial.join(",")]);

  useEffect(() => {
    if (!userId) return;
    loadCatalog(API_URL, (data) => {
      setCatalog(data.cards || []);
      setCatMeta({ skills: data.skills || {}, domains: data.domains || {}, maxSkillLevel: data.maxSkillLevel, maxDomainLevel: data.maxDomainLevel });
    });
    swrJson(`davinci_col_${userId}`, `${API_URL}/api/cards/collection/${userId}`, (colData) => {
      const col = { success: true, data: colData };
      if (col?.success) {
        const m: Record<string, number> = {};
        const f: Record<string, boolean> = {};
        const lv: Record<string, number> = {};
        const fg: Record<string, { atk: number; hp: number }> = {};
        const wr: Record<string, string> = {};
        const sr: Record<string, number> = {};
        const sl: Record<string, boolean> = {};
        const sk: Record<string, number> = {};
        // Best build shown when copies span wears: handmade first, per the
        // lore — fresh outranks rusted outranks factory.
        const WEAR_RANK: Record<string, number> = { fresh: 0, rusted: 1, factory: 2 };
        for (const c of col.data?.cards || []) {
          m[c.cardId] = c.count;
          if (c.foil) f[c.cardId] = true;
          if ((c.level || 1) > 1) lv[c.cardId] = c.level;
          sk[c.cardId] = c.skillLevel || 1;
          if (c.hibernating) sl[c.cardId] = true;
          if (c.atkForge || c.hpForge) fg[c.cardId] = { atk: c.atkForge || 0, hp: c.hpForge || 0 };
          if (Array.isArray(c.prints) && c.prints.length > 0) {
            const best = [...c.prints].sort((a: any, b: any) =>
              (WEAR_RANK[a.condition] ?? 9) - (WEAR_RANK[b.condition] ?? 9))[0];
            wr[c.cardId] = best.condition;
            if (typeof best.serial === "number") sr[c.cardId] = best.serial;
          }
        }
        setOwned(m);
        setFoils(f);
        setLevels(lv);
        setForges(fg);
        setWears(wr);
        setSerials(sr);
        setAsleep(sl);
        setSkillLvls(sk);
        setLoaded(true);
      }
    });
  }, [userId]);

  // Declared above the effect below and above the early returns: the Escape
  // handler closes over it, and a render that bailed out early would leave the
  // binding uninitialised.
  const cancel = () => { setDraft(committed); setEditing(false); };

  // Close the picker on Escape, and stop the page scrolling behind it.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const byId = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c])), [catalog]);
  const mine = useMemo(() => catalog.filter((c) => (owned[c.id] || 0) > 0), [catalog, owned]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = mine.filter((c) =>
      (rarity === "all" || c.rarity === rarity) &&
      (!term || c.name.toLowerCase().includes(term))
    );
    const sorted = [...list];
    if (sort === "rarity") sorted.sort((a, b) => (RARITY_META[b.rarity]?.order ?? 0) - (RARITY_META[a.rarity]?.order ?? 0) || a.name.localeCompare(b.name));
    else if (sort === "level") sorted.sort((a, b) => (levels[b.id] || 1) - (levels[a.id] || 1) || a.name.localeCompare(b.name));
    else if (sort === "copies") sorted.sort((a, b) => (owned[b.id] || 0) - (owned[a.id] || 0) || a.name.localeCompare(b.name));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [mine, q, rarity, sort, levels, owned]);

  // Rarity chips only for tiers actually present in this collection.
  const rarities = useMemo(() => {
    const seen = new Set(mine.map((c) => c.rarity));
    return (["common", "rare", "epic", "legendary", "event", "mythic"] as const).filter((r) => seen.has(r));
  }, [mine]);

  // Render whenever it is yours OR something is pinned. The old guard bailed
  // out entirely when the collection was empty — which is also what a slow or
  // failed fetch looks like, taking your pinned cards down with it.
  if (!isMine && committed.length === 0) return null;
  if (!isMine && catalog.length === 0) return null;

  const toggle = (id: string) =>
    setDraft((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < SLOTS ? [...p, id] : p));

  /** By index, never by id — a duplicate or unresolvable entry must still go. */
  const removeAt = (i: number) => setDraft((p) => p.filter((_, n) => n !== i));

  const nudge = (i: number, dir: -1 | 1) =>
    setDraft((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      // Strip anything we already know is gone, so one stale entry can't 400
      // the whole array. The server is still the real check.
      const cardIds = loaded ? draft.filter((id) => (owned[id] || 0) > 0) : draft;
      const r = await fetch(`${API_URL}/api/cards/showcase`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId, cardIds }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        // Keep the sheet open — closing on a rejection made a failed save look
        // identical to a successful one until the next reload.
        toast(j?.message || "Couldn't save your showcase.", "error");
        return;
      }
      const saved: string[] = j.data?.showcaseCards || cardIds;
      setCommitted(saved);
      setDraft(saved);
      setEditing(false);
      // The collection cache outlives this save for the rest of the tab
      // session, so a just-consumed card would otherwise linger as ownable.
      try { sessionStorage.removeItem(`davinci_col_${userId}`); } catch { /* private mode */ }
    } catch {
      toast("Couldn't reach the server. Your choice is still here.", "error");
    } finally {
      setSaving(false);
    }
  };

  const list = editing ? draft : committed;

  return (
    <Panel size={20} className="mb-6">
      <div className="relative p-5">
        <Heading
          title="Showcase"
          sub={isMine ? `${list.length} of ${SLOTS} pinned` : "Cards on display"}
          right={
            isMine ? (
              <GachaButton tone="ghost" onClick={() => { setDraft(committed); setEditing(true); }}>
                <Star className="h-3.5 w-3.5" /> Choose
              </GachaButton>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
          {Array.from({ length: SLOTS }, (_, i) => {
            const id = list[i];
            const card = id ? byId[id] : null;
            // Only a loaded collection can prove a card is gone; before that,
            // absence is just latency.
            const ghost = !!id && loaded && (owned[id] || 0) === 0;

            // Visitors never see dead pins or the edit chrome.
            if (!isMine && (!card || ghost)) return null;

            if (card) {
              return (
                <motion.div key={`${id}-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }} className="group relative">
                  {/* THE SHOWCASE IS MONOCHROME.
                      Rarity colour is doing a job everywhere else — in the
                      binder it is how you find things — but a showcase is three
                      cards someone chose, and three competing rarity glows
                      fight each other instead of reading as a set.
                      Desaturating is a wrapper rather than a CardFace prop on
                      purpose: the card keeps drawing its real colours, so the
                      art, the frame and the plate all go grey together and
                      nothing has to know it is being shown here.

                      BRIGHTNESS, not saturation, now carries the dead-pin
                      signal. Grayscale used to be what marked a card you no
                      longer own, so making the whole shelf grey would have
                      erased that tell — the ghost is dimmed instead, and still
                      wears its NO LONGER YOURS banner. */}
                  <div style={{ filter: ghost ? "grayscale(1) brightness(.4)" : "grayscale(1)" }}>
                    <CardFace card={card} owned foil={!!foils[card.id]} size={cardSize} ratio="5 / 9"
                      level={levels[card.id]} forge={forges[card.id]} wear={wears[card.id]}
                      skillLevel={skillLvls[card.id]} skillCap={capFor(card)} />
                  </div>

                  {ghost && (
                    <span className="pointer-events-none absolute inset-x-2 top-2 rounded px-2 py-1 text-center font-mono text-[9px] font-black tracking-[0.14em] text-rose-200"
                      style={{ background: "rgba(190,18,60,.75)" }}>
                      NO LONGER YOURS
                    </span>
                  )}

                  {isMine && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setEditing(true); removeAt(i); }}
                        aria-label={`Remove ${card.name} from your showcase`}
                        title="Remove from showcase"
                        className="absolute -right-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-[#160b2b] text-slate-300 opacity-0 transition hover:bg-rose-600 hover:text-white focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {editing && (
                        <div className="absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                          <button type="button" onClick={() => nudge(i, -1)} disabled={i === 0}
                            aria-label="Move left" title="Move left"
                            className="grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-[#160b2b] text-slate-300 transition hover:text-white disabled:opacity-30">
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => nudge(i, 1)} disabled={i >= list.length - 1}
                            aria-label="Move right" title="Move right"
                            className="grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-[#160b2b] text-slate-300 transition hover:text-white disabled:opacity-30">
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            }

            // A pinned id the catalog doesn't know at all. It used to silently
            // eat a slot and show a "+", so it could never be cleared.
            if (id && isMine) {
              return (
                <div key={`dead-${i}`} className="relative grid place-items-center px-3 text-center"
                  style={{ width: cardSize, aspectRatio: "5 / 9", clipPath: notch(14), background: "rgba(190,18,60,.10)", boxShadow: "inset 0 0 0 1px rgba(244,63,94,.35)" }}>
                  <span className="font-mono text-[10px] leading-relaxed text-rose-300/80">
                    Unknown card<br />
                    <span className="text-rose-300/50">{id}</span>
                  </span>
                  <button type="button" onClick={() => { setEditing(true); removeAt(i); }}
                    aria-label="Remove unknown card from your showcase" title="Remove from showcase"
                    className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-[#160b2b] text-slate-300 transition hover:bg-rose-600 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            // Empty slots are only worth showing on your own profile.
            if (!isMine) return null;
            return (
              <button key={`empty-${i}`} onClick={() => { setDraft(committed); setEditing(true); }}
                aria-label="Add a card to your showcase"
                className="grid place-items-center text-slate-700 transition hover:text-slate-500"
                style={{ width: cardSize, aspectRatio: "5 / 9", clipPath: notch(14), background: "rgba(255,255,255,.02)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                <Plus className="h-7 w-7" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PICKER SHEET ── a modal, not the old inline drawer: that one shoved
          the whole profile down and left the grid 72px of scroll.

          PORTALLED TO <body>, and it must stay that way. Panel draws itself
          with a clipPath, and a clip-path on an ancestor clips EVERY
          descendant — including position:fixed ones. Rendered in place, the
          sheet was cropped to the panel's box: the header carrying Cancel and
          Save sat outside the clip and simply wasn't there, leaving no way
          out of the picker. */}
      {mounted && createPortal(
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
          >
            {/* Flat scrim, no backdrop-filter: it would make this the containing
                block for fixed children, and Performance Mode turns blur off. */}
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.78)" }} onClick={cancel} />

            <motion.div
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label="Choose your showcase"
              className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-[#0c0912] sm:max-h-[86dvh] sm:rounded-2xl"
            >
              {/* header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-black text-white">Choose your showcase</p>
                  <p className="font-mono text-[11px] text-slate-500">{draft.length} of {SLOTS} pinned</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <GachaButton tone="ghost" onClick={cancel}>Cancel</GachaButton>
                  <GachaButton onClick={save} disabled={saving}>
                    <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                  </GachaButton>
                </div>
              </div>

              {/* toolbar */}
              <div className="space-y-2.5 border-b border-white/10 px-4 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search your collection"
                    aria-label="Search your collection"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 font-mono text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-white/25"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setRarity("all")}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-black transition ${rarity === "all" ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>
                    ALL
                  </button>
                  {rarities.map((r) => (
                    <button key={r} type="button" onClick={() => setRarity(r)} title={RARITY_META[r].label}
                      className="rounded-lg border px-2.5 py-1 font-mono text-[11px] font-black transition"
                      style={
                        rarity === r
                          ? { borderColor: RARITY_META[r].gem, background: `${RARITY_META[r].gem}22`, color: RARITY_META[r].gem }
                          : { borderColor: "rgba(255,255,255,.10)", color: RARITY_META[r].gem, opacity: 0.65 }
                      }>
                      {RARITY_META[r].label[0]}
                    </button>
                  ))}

                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    aria-label="Sort collection"
                    className="ml-auto rounded-lg border border-white/10 bg-[#150f22] px-2 py-1 font-mono text-[11px] font-black text-slate-300 outline-none"
                  >
                    <option value="rarity">Rarity</option>
                    <option value="level">Level</option>
                    <option value="copies">Copies</option>
                    <option value="name">Name</option>
                  </select>
                </div>

                <p className="font-mono text-[11px] text-slate-600">{shown.length} card{shown.length === 1 ? "" : "s"}</p>
              </div>

              {/* grid */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {mine.length === 0 ? (
                  <p className="py-16 text-center font-mono text-xs text-slate-500">
                    {loaded ? "No cards yet — open a pack first." : "Loading your collection…"}
                  </p>
                ) : shown.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="font-mono text-xs text-slate-500">No cards match that.</p>
                    <button type="button" onClick={() => { setQ(""); setRarity("all"); }}
                      className="mt-3 font-mono text-[11px] font-black text-violet-300 hover:text-violet-200">
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {shown.map((c) => {
                      const slot = draft.indexOf(c.id);
                      const on = slot >= 0;
                      const full = !on && draft.length >= SLOTS;
                      const count = owned[c.id] || 0;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id)}
                          disabled={full}
                          aria-pressed={on}
                          title={full ? "Showcase is full — remove a pinned card first" : on ? `Unpin ${c.name}` : `Pin ${c.name}`}
                          className="relative flex justify-center p-1 transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                          style={{
                            clipPath: notch(9),
                            background: on ? "rgba(162,116,255,.22)" : "transparent",
                            boxShadow: on ? "inset 0 0 0 1px rgba(162,116,255,.6)" : "none",
                            contentVisibility: "auto",
                            containIntrinsicSize: "150px",
                          }}
                        >
                          {/* 108/96 clears CardFace's rich-detail threshold (96),
                              so wear, the mythic rift and the fusion seal are
                              actually visible. The old 84px tiles hid exactly
                              the marks that tell two copies apart. */}
                          <CardFace card={c} owned foil={!!foils[c.id]} size={small ? 96 : 108}
                            level={levels[c.id]} forge={forges[c.id]} wear={wears[c.id]}
                            skillLevel={skillLvls[c.id]} skillCap={capFor(c)} />

                          {count > 1 && (
                            <span className="absolute left-1 top-1 rounded bg-black/70 px-1 font-mono text-[9px] font-black text-slate-200">
                              ×{count}
                            </span>
                          )}
                          {c.rarity === "legendary" && serials[c.id] !== undefined && (
                            <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/70 px-1 text-center font-mono text-[8px] font-black text-amber-200">
                              #{serials[c.id]}{wears[c.id] ? ` · ${wears[c.id]}` : ""}
                            </span>
                          )}
                          {asleep[c.id] && (
                            <span className="absolute inset-x-1 top-1 truncate rounded bg-amber-500/80 px-1 text-center font-mono text-[8px] font-black text-black">
                              ASLEEP
                            </span>
                          )}
                          {on && (
                            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] font-black"
                              style={{ background: ACCENT_LIT, color: "#160b2b" }}>
                              {slot + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="border-t border-white/10 px-4 py-2.5 font-mono text-[10px] text-slate-600">
                Pinned cards can be removed from the showcase above — even ones you no longer own.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </Panel>
  );
}
