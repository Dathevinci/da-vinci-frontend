"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check } from "lucide-react";
import { authHeaders } from "@/lib/authToken";
import { Panel, Heading, GachaButton, notch, ACCENT_LIT } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
// Three, so a stack reads as an achievement line, not a wall of flair.
const MAX_WORN = 3;

/**
 * TITLE RACK — the set-completion titles a profile WEARS, stacked up to
 * three in the wearer's own order.
 *
 * Self-contained on the ShowcaseCards pattern: it fetches its own data,
 * renders nothing at all when there is nothing to show, and the profile
 * page's edit stays a single line. The server re-derives ownership from
 * claimedSets on every save, so this picker is a convenience, not the check.
 */
export default function TitleRack({ userId, isMine, onChange }: {
  userId: string;
  isMine: boolean;
  /**
   * Fires whenever the worn set changes — on load and after a save.
   *
   * The rack owns this data (it fetches /api/cards/titles itself), but the
   * profile HERO now renders the same titles from its own `profileUser`
   * object. Without this the two disagree the moment you change anything:
   * the rack updates, the strip beside your name keeps showing the old
   * titles, and only a reload settles it.
   */
  onChange?: (worn: string[]) => void;
}) {
  const [owned, setOwned] = useState<{ set: string; title: string }[]>([]);
  const [worn, setWorn] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/cards/titles/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        setOwned(d.data.owned || []);
        setWorn(d.data.equipped || []);
        onChange?.(d.data.equipped || []);
      })
      .catch(() => { /* offline — the section simply isn't there */ });
  }, [userId]);

  // A visitor sees the stack or nothing; the owner also sees the rack when
  // there is anything to hang on it.
  if (!isMine && worn.length === 0) return null;
  if (isMine && owned.length === 0) return null;

  const toggle = (t: string) =>
    setSel((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < MAX_WORN ? [...p, t] : p));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/cards/titles`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId, titles: sel }),
      });
      const d = await r.json();
      if (d?.success) {
        setWorn(d.data.equipped || []);
        onChange?.(d.data.equipped || []);
        setEditing(false);
      }
    } catch { /* leave the picker open so the choice isn't lost */ } finally { setSaving(false); }
  };

  // Rank the stack visually: the FIRST title the wearer picked reads gold,
  // the rest violet — an order worth choosing.
  const chipStyle = (i: number) => i === 0
    ? { color: "#fcd34d", background: "rgba(251,191,36,.10)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45)" }
    : { color: "#d8ccff", background: "rgba(162,116,255,.10)", boxShadow: "inset 0 0 0 1px rgba(162,116,255,.4)" };

  return (
    <Panel size={20} className="mb-6">
      <div className="relative p-5">
        <Heading
          title="Titles"
          sub={isMine ? `${worn.length} of ${MAX_WORN} worn` : "Titles on display"}
          right={
            isMine ? (
              editing ? (
                <div className="flex gap-2">
                  <GachaButton tone="ghost" onClick={() => setEditing(false)}>Cancel</GachaButton>
                  <GachaButton onClick={save} disabled={saving}>
                    <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                  </GachaButton>
                </div>
              ) : (
                <GachaButton tone="ghost" onClick={() => { setSel(worn); setEditing(true); }}>
                  <Crown className="h-3.5 w-3.5" /> Manage
                </GachaButton>
              )
            ) : undefined
          }
        />

        {worn.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {worn.map((t, i) => (
              <motion.span key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
                style={{ clipPath: notch(8), ...chipStyle(i) }}>
                {i === 0 && <Crown className="h-3 w-3" />}
                {t}
              </motion.span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Nothing worn yet — complete a set, wear its title.
          </p>
        )}

        {/* picker — tap order IS wear order */}
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                Your titles — tap up to {MAX_WORN}, in the order you want them worn
              </p>
              <div className="flex flex-wrap gap-2">
                {owned.map(({ set, title }) => {
                  const at = sel.indexOf(title);
                  const on = at >= 0;
                  return (
                    <button key={title} onClick={() => toggle(title)}
                      title={set ? `From completing ${set}` : "Earned"}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition hover:brightness-115"
                      style={{
                        clipPath: notch(8),
                        color: on ? (at === 0 ? "#fcd34d" : ACCENT_LIT) : "#64748b",
                        background: on ? "rgba(162,116,255,.14)" : "rgba(255,255,255,.03)",
                        boxShadow: `inset 0 0 0 1px ${on ? "rgba(162,116,255,.55)" : "rgba(255,255,255,.09)"}`,
                      }}>
                      {on && <span className="font-mono text-[10px] opacity-80">{at + 1}</span>}
                      {title}
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
