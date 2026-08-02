"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, X, Check } from "lucide-react";
import { authHeaders } from "@/lib/authToken";
import CardFace, { CardDef } from "@/components/cards/CardFace";
import { Panel, Heading, GachaButton, notch, ACCENT, ACCENT_LIT } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
// Four, by the owner's eye: five full-size cards crowded the row.
const SLOTS = 4;

/**
 * SHOWCASE — up to four cards pinned to a profile, shown at the same
 * full-art size and shape the rest of the app uses. 5:7 at 186px was the
 * one place cards still rendered in the old proportions — foil sweeps and
 * legendary auras were there but shrunk into a stamp.
 *
 * Self-contained on purpose: it fetches its own catalog and collection and
 * renders nothing at all when there is nothing to show. That keeps the profile
 * page edit down to a single line, and means a failure here degrades to an
 * absent section rather than a broken profile.
 *
 * The server verifies ownership on save, so this picker is a convenience, not
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
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string[]>(initial.slice(0, SLOTS));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // On a phone, 216px cards stack one per row and the showcase becomes a
  // scroll marathon. Under 640px they drop to 150 — two per row — and the
  // listener keeps it honest through rotation.
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const cardSize = small ? 150 : 216;

  useEffect(() => { setPicked(initial.slice(0, SLOTS)); }, [initial.join(",")]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetch(`${API_URL}/api/cards/catalog`).then((r) => r.json()).catch(() => null),
      fetch(`${API_URL}/api/cards/collection/${userId}`).then((r) => r.json()).catch(() => null),
    ]).then(([cat, col]) => {
      if (cat?.success && Array.isArray(cat.data?.cards)) setCatalog(cat.data.cards);
      if (col?.success) {
        const m: Record<string, number> = {};
        const f: Record<string, boolean> = {};
        for (const c of col.data?.cards || []) { m[c.cardId] = c.count; if (c.foil) f[c.cardId] = true; }
        setOwned(m);
        setFoils(f);
      }
    });
  }, [userId]);

  const byId = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c])), [catalog]);
  const mine = useMemo(() => catalog.filter((c) => (owned[c.id] || 0) > 0), [catalog, owned]);

  // Nothing pinned and not your profile? The section simply isn't there.
  if (!isMine && picked.length === 0) return null;
  if (isMine && mine.length === 0) return null;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < SLOTS ? [...p, id] : p));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/cards/showcase`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId, cardIds: picked }),
      });
      setEditing(false);
    } catch { /* leave the picker open so the choice isn't lost */ } finally { setSaving(false); }
  };

  return (
    <Panel size={20} className="mb-6">
      <div className="relative p-5">
        <Heading
          title="Showcase"
          sub={isMine ? `${picked.length} of ${SLOTS} pinned` : "Cards on display"}
          right={
            isMine ? (
              editing ? (
                <div className="flex gap-2">
                  <GachaButton tone="ghost" onClick={() => { setPicked(initial.slice(0, SLOTS)); setEditing(false); }}>
                    Cancel
                  </GachaButton>
                  <GachaButton onClick={save} disabled={saving}>
                    <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                  </GachaButton>
                </div>
              ) : (
                <GachaButton tone="ghost" onClick={() => setEditing(true)}>
                  <Star className="h-3.5 w-3.5" /> Choose
                </GachaButton>
              )
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
          {Array.from({ length: SLOTS }, (_, i) => {
            const id = picked[i];
            const card = id ? byId[id] : null;
            if (card) {
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}>
                  {/* 216 crosses the full-art threshold (>=200) on desktop, so
                      the painting, the foil sweep and a legendary's aura render
                      at the size they were made for; phones take the 150px
                      two-per-row layout instead of a one-card scroll column. */}
                  <CardFace card={card} owned foil={!!foils[card.id]} size={cardSize} ratio="5 / 9" />
                </motion.div>
              );
            }
            // Empty slots are only worth showing on your own profile.
            if (!isMine) return null;
            return (
              <button key={i} onClick={() => setEditing(true)}
                className="grid place-items-center text-slate-700 transition hover:text-slate-500"
                style={{ width: cardSize, aspectRatio: "5 / 9", clipPath: notch(14), background: "rgba(255,255,255,.02)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                <Plus className="h-7 w-7" />
              </button>
            );
          })}
        </div>

        {/* picker */}
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                Your collection — pick up to {SLOTS}
              </p>
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-7">
                {mine.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggle(c.id)}
                      className="relative flex justify-center p-1 transition hover:-translate-y-0.5"
                      style={{
                        clipPath: notch(9),
                        background: on ? "rgba(162,116,255,.22)" : "transparent",
                        boxShadow: on ? "inset 0 0 0 1px rgba(162,116,255,.6)" : "none",
                      }}>
                      <CardFace card={c} owned foil={!!foils[c.id]} size={84} />
                      {on && (
                        <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full"
                          style={{ background: ACCENT_LIT, color: "#160b2b" }}>
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
