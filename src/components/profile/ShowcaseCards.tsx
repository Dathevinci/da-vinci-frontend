"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, X, Check, Search, ChevronLeft, ChevronRight, Layers, Sparkles } from "lucide-react";
import { authHeaders } from "@/lib/authToken";
import { loadCatalog } from "@/lib/catalogCache";
import { swrJson } from "@/lib/swrCache";
import CardFace, { CardDef, RARITY_META } from "@/components/cards/CardFace";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const SLOTS = 4;

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
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [forges, setForges] = useState<Record<string, { atk: number; hp: number }>>({});
  const [wears, setWears] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, number>>({});
  const [asleep, setAsleep] = useState<Record<string, boolean>>({});
  const [skillLvls, setSkillLvls] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [catMeta, setCatMeta] = useState<any>(null);
  const capFor = (c: CardDef) =>
    catMeta?.domains?.[c.id]
      ? (catMeta.maxDomainLevel ?? 3)
      : catMeta?.skills?.[c.id]
        ? (catMeta.maxSkillLevel ?? 5)
        : undefined;

  const [committed, setCommitted] = useState<string[]>(initial.slice(0, SLOTS));
  const [draft, setDraft] = useState<string[]>(initial.slice(0, SLOTS));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<string>("all");
  const [sort, setSort] = useState<"rarity" | "level" | "copies" | "name">("rarity");

  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Sleek compact card sizes (reduced from 216px down to 148px desktop / 128px mobile)
  const cardSize = small ? 128 : 148;

  useEffect(() => {
    const next = initial.slice(0, SLOTS);
    setCommitted(next);
    setDraft(next);
  }, [initial.join(",")]);

  useEffect(() => {
    if (!userId) return;
    loadCatalog(API_URL, (data) => {
      setCatalog(data.cards || []);
      setCatMeta({
        skills: data.skills || {},
        domains: data.domains || {},
        maxSkillLevel: data.maxSkillLevel,
        maxDomainLevel: data.maxDomainLevel,
      });
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
        const WEAR_RANK: Record<string, number> = { fresh: 0, rusted: 1, factory: 2 };
        for (const c of col.data?.cards || []) {
          m[c.cardId] = c.count;
          if (c.foil) f[c.cardId] = true;
          if ((c.level || 1) > 1) lv[c.cardId] = c.level;
          sk[c.cardId] = c.skillLevel || 1;
          if (c.hibernating) sl[c.cardId] = true;
          if (c.atkForge || c.hpForge) fg[c.cardId] = { atk: c.atkForge || 0, hp: c.hpForge || 0 };
          if (Array.isArray(c.prints) && c.prints.length > 0) {
            const best = [...c.prints].sort(
              (a: any, b: any) => (WEAR_RANK[a.condition] ?? 9) - (WEAR_RANK[b.condition] ?? 9)
            )[0];
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

  const cancel = () => {
    setDraft(committed);
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editing]);

  const byId = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c])), [catalog]);
  const mine = useMemo(() => catalog.filter((c) => (owned[c.id] || 0) > 0), [catalog, owned]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = mine.filter(
      (c) => (rarity === "all" || c.rarity === rarity) && (!term || c.name.toLowerCase().includes(term))
    );
    const sorted = [...list];
    if (sort === "rarity")
      sorted.sort(
        (a, b) =>
          (RARITY_META[b.rarity]?.order ?? 0) - (RARITY_META[a.rarity]?.order ?? 0) || a.name.localeCompare(b.name)
      );
    else if (sort === "level")
      sorted.sort((a, b) => (levels[b.id] || 1) - (levels[a.id] || 1) || a.name.localeCompare(b.name));
    else if (sort === "copies")
      sorted.sort((a, b) => (owned[b.id] || 0) - (owned[a.id] || 0) || a.name.localeCompare(b.name));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [mine, q, rarity, sort, levels, owned]);

  const rarities = useMemo(() => {
    const seen = new Set(mine.map((c) => c.rarity));
    return (["common", "rare", "epic", "legendary", "event", "mythic"] as const).filter((r) => seen.has(r));
  }, [mine]);

  if (!isMine && committed.length === 0) return null;
  if (!isMine && catalog.length === 0) return null;

  const toggle = (id: string) =>
    setDraft((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < SLOTS ? [...p, id] : p));

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
      const cardIds = loaded ? draft.filter((id) => (owned[id] || 0) > 0) : draft;
      const r = await fetch(`${API_URL}/api/cards/showcase`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId, cardIds }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        toast(j?.message || "Couldn't save your showcase.", "error");
        return;
      }
      const saved: string[] = j.data?.showcaseCards || cardIds;
      setCommitted(saved);
      setDraft(saved);
      setEditing(false);
      try {
        sessionStorage.removeItem(`davinci_col_${userId}`);
      } catch {}
    } catch {
      toast("Couldn't reach the server. Your choice is still here.", "error");
    } finally {
      setSaving(false);
    }
  };

  const list = editing ? draft : committed;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300 shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
              Card Showcase
            </h2>
            <p className="font-mono text-[11px] text-white/50">
              {isMine ? `${list.length} of ${SLOTS} cards pinned to profile` : "Featured Cards on Display"}
            </p>
          </div>
        </div>

        {isMine && (
          <button
            onClick={() => {
              setDraft(committed);
              setEditing(true);
            }}
            className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-200 shadow-md transition hover:scale-105 hover:bg-amber-500/25 active:scale-95"
          >
            <Star className="h-3.5 w-3.5 text-amber-300" />
            <span>Choose Cards</span>
          </button>
        )}
      </div>

      {/* Cards Grid — Compact 4-Card Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 justify-items-center">
        {Array.from({ length: SLOTS }, (_, i) => {
          const id = list[i];
          const card = id ? byId[id] : null;
          const ghost = !!id && loaded && (owned[id] || 0) === 0;

          if (!isMine && (!card || ghost)) return null;

          if (card) {
            return (
              <motion.div
                key={`${id}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative transition-transform duration-300 hover:scale-105"
              >
                <div
                  className="rounded-2xl overflow-hidden shadow-lg border border-white/10"
                  style={ghost ? { filter: "grayscale(1) brightness(.55)" } : undefined}
                >
                  <CardFace
                    card={card}
                    owned
                    foil={!!foils[card.id]}
                    size={cardSize}
                    ratio="5 / 9"
                    level={levels[card.id]}
                    forge={forges[card.id]}
                    wear={wears[card.id]}
                    skillLevel={skillLvls[card.id]}
                    skillCap={capFor(card)}
                  />
                </div>

                {ghost && (
                  <span className="pointer-events-none absolute inset-x-2 top-2 rounded-md bg-rose-600/90 px-2 py-1 text-center font-mono text-[9px] font-black tracking-wider text-white shadow-md">
                    NO LONGER YOURS
                  </span>
                )}

                {isMine && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        removeAt(i);
                      }}
                      aria-label={`Remove ${card.name}`}
                      title="Remove from showcase"
                      className="absolute -right-2 -top-2 z-20 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/80 text-white opacity-0 backdrop-blur-md transition hover:bg-rose-600 focus:opacity-100 group-hover:opacity-100 shadow-md"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    {editing && (
                      <div className="absolute -bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => nudge(i, -1)}
                          disabled={i === 0}
                          aria-label="Move left"
                          title="Move left"
                          className="grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/80 text-white transition hover:bg-white/20 disabled:opacity-30"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => nudge(i, 1)}
                          disabled={i >= list.length - 1}
                          aria-label="Move right"
                          title="Move right"
                          className="grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/80 text-white transition hover:bg-white/20 disabled:opacity-30"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            );
          }

          if (id && isMine) {
            return (
              <div
                key={`dead-${i}`}
                className="relative flex flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center"
                style={{ width: cardSize, aspectRatio: "5 / 9" }}
              >
                <span className="font-mono text-[10px] text-rose-300 leading-tight">
                  Unknown Card
                  <br />
                  <span className="text-[8px] opacity-70">{id}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    removeAt(i);
                  }}
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-black/80 text-white hover:bg-rose-600 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }

          if (!isMine) return null;
          return (
            <button
              key={`empty-${i}`}
              onClick={() => {
                setDraft(committed);
                setEditing(true);
              }}
              aria-label="Add a card to your showcase"
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] text-white/30 transition-all hover:border-amber-400/40 hover:bg-amber-500/5 hover:text-amber-300"
              style={{ width: cardSize, aspectRatio: "5 / 9" }}
            >
              <Plus className="h-6 w-6" />
              <span className="mt-1.5 font-mono text-[9px] font-bold uppercase tracking-wider">Empty Slot</span>
            </button>
          );
        })}
      </div>

      {/* ── CARD PICKER MODAL ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center p-4"
              >
                <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={cancel} />

                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  transition={{ duration: 0.2 }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Choose your showcase cards"
                  className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0912] shadow-2xl"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
                    <div>
                      <h3 className="font-fell text-xl font-bold uppercase tracking-wider text-white">
                        Choose Featured Cards
                      </h3>
                      <p className="font-mono text-xs text-white/50">
                        {draft.length} of {SLOTS} cards selected
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancel}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 font-mono text-xs font-bold text-slate-300 hover:bg-white/[0.08]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={save}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-1.5 font-mono text-xs font-black uppercase tracking-wider text-black shadow-md transition hover:scale-105 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{saving ? "Saving…" : "Save Showcase"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="space-y-3 border-b border-white/10 px-6 py-3.5 bg-black/40 font-mono">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search by card name..."
                        className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-10 pr-4 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400/40"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRarity("all")}
                          className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase transition ${
                            rarity === "all"
                              ? "border-amber-400/40 bg-amber-500/20 text-amber-200"
                              : "border-white/10 bg-white/[0.02] text-white/50 hover:text-white"
                          }`}
                        >
                          ALL
                        </button>
                        {rarities.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRarity(r)}
                            className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase transition"
                            style={
                              rarity === r
                                ? {
                                    borderColor: RARITY_META[r].gem,
                                    background: `${RARITY_META[r].gem}22`,
                                    color: RARITY_META[r].gem,
                                  }
                                : {
                                    borderColor: "rgba(255,255,255,.10)",
                                    color: RARITY_META[r].gem,
                                    opacity: 0.6,
                                  }
                            }
                          >
                            {RARITY_META[r].label}
                          </button>
                        ))}
                      </div>

                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as typeof sort)}
                        className="rounded-full border border-white/10 bg-[#150f22] px-3 py-1 text-[10px] font-bold text-slate-300 outline-none"
                      >
                        <option value="rarity">Sort by Rarity</option>
                        <option value="level">Sort by Level</option>
                        <option value="copies">Sort by Copies</option>
                        <option value="name">Sort by Name</option>
                      </select>
                    </div>
                  </div>

                  {/* Card Selection Grid */}
                  <div className="min-h-0 flex-1 overflow-y-auto p-6 [scrollbar-width:thin]">
                    {mine.length === 0 ? (
                      <p className="py-16 text-center font-mono text-xs text-slate-500">
                        {loaded ? "No cards in your collection yet." : "Loading collection…"}
                      </p>
                    ) : shown.length === 0 ? (
                      <div className="py-16 text-center">
                        <p className="font-mono text-xs text-slate-500">No cards match that search.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setQ("");
                            setRarity("all");
                          }}
                          className="mt-2 font-mono text-xs font-bold text-amber-300 hover:underline"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
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
                              className={`group relative rounded-xl p-1 transition-all ${
                                on
                                  ? "ring-2 ring-amber-400 bg-amber-500/20 scale-105 shadow-lg shadow-amber-500/10"
                                  : "hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
                              }`}
                            >
                              <div className="rounded-lg overflow-hidden">
                                <CardFace
                                  card={c}
                                  owned
                                  foil={!!foils[c.id]}
                                  size={100}
                                  level={levels[c.id]}
                                  forge={forges[c.id]}
                                  wear={wears[c.id]}
                                  skillLevel={skillLvls[c.id]}
                                  skillCap={capFor(c)}
                                />
                              </div>

                              {count > 1 && (
                                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/80 px-1.5 py-0.5 font-mono text-[9px] font-black text-white shadow">
                                  ×{count}
                                </span>
                              )}

                              {on && (
                                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 font-mono text-[10px] font-black text-black shadow-md">
                                  {slot + 1}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
