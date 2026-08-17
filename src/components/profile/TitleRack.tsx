"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Sparkles, X, Edit2 } from "lucide-react";
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
export default function TitleRack({ userId, isMine, onChange, version }: {
  userId: string;
  isMine: boolean;
  /** Bump to make the rack refetch — settings can now equip titles too. */
  version?: number;
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
        let ownedList = d.data.owned || [];
        let equippedList = d.data.equipped || [];
        if (d.data?.username?.toLowerCase() === "riv333" || (typeof window !== "undefined" && window.location.pathname.toLowerCase().includes("riv333"))) {
          if (!ownedList.some((o: any) => o.title.toLowerCase() === "bug detective")) {
            ownedList = [{ set: "Special", title: "Bug Detective" }, ...ownedList];
          }
          if (!equippedList.some((t: string) => t.toLowerCase() === "bug detective")) {
            equippedList = ["Bug Detective", ...equippedList].slice(0, MAX_WORN);
          }
        }
        if (d.data?.username?.toLowerCase() === "dejavuh" || (typeof window !== "undefined" && window.location.pathname.toLowerCase().includes("dejavuh"))) {
          if (!ownedList.some((o: any) => o.title.toLowerCase().includes("lucifer"))) {
            ownedList = [{ set: "Staff Exclusive", title: "Lucifer,the fallen angel" }, ...ownedList];
          }
        }
        setOwned(ownedList);
        setWorn(equippedList);
        onChange?.(equippedList);
      })
      .catch(() => { /* offline — the section simply isn't there */ });
  }, [userId, version]);

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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] p-5 shadow-2xl mb-6">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">Title Rack</h3>
            <span className="text-[10px] font-bold text-slate-500">· {worn.length}/{MAX_WORN} worn</span>
          </div>

          {isMine && (
            <button
              onClick={() => {
                if (!editing) setSel(worn);
                setEditing(!editing);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10"
            >
              {editing ? <X className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
              {editing ? "Cancel" : "Change"}
            </button>
          )}
        </div>

        {/* worn stack */}
        {worn.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {worn.map((t, i) => {
              const isBugDetective = t.toLowerCase() === "bug detective";
              if (isBugDetective) {
                return (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="inline-flex items-center gap-2.5 px-4 py-2 min-h-[38px] text-[11px] font-black uppercase tracking-[0.18em] border border-pink-400/40 bg-pink-950/20 backdrop-blur-md text-pink-100 shadow-[0_0_18px_rgba(244,63,94,0.25)] rounded-lg transition-transform hover:scale-105"
                    style={{ clipPath: notch(8) }}
                    title="Bug Detective"
                  >
                    <img src="/icons/bug-detective.png" alt="Bug Detective" className="h-7 w-7 object-contain -my-1 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
                    <img src="/titles/bug-detective-wordmark.png" alt="Bug Detective" className="h-5.5 object-contain drop-shadow-[0_0_10px_rgba(255,105,180,0.6)] drop-shadow-[0_0_20px_rgba(244,63,94,0.4)]" />
                  </motion.span>
                );
              }
              const isLucifer = t.toLowerCase().includes("lucifer") || t.toLowerCase().includes("fallen angel");
              if (isLucifer) {
                return (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="inline-flex items-center gap-2.5 px-4 py-2 min-h-[38px] text-xs font-black uppercase tracking-[0.18em] border border-purple-400/60 bg-gradient-to-r from-[#200536]/60 via-[#380b5c]/50 to-[#1b042e]/60 backdrop-blur-md text-purple-100 shadow-[0_0_24px_rgba(168,85,247,0.5),0_0_40px_rgba(192,132,252,0.25)] rounded-lg transition-transform hover:scale-105"
                    style={{ clipPath: notch(8) }}
                    title="Lucifer,the fallen angel"
                  >
                    <img src="/icons/lucifer-gojo.png" alt="Lucifer, the fallen angel" className="h-7 w-7 object-contain -my-1 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] drop-shadow-[0_0_12px_rgba(192,132,252,0.85)] font-black tracking-wider uppercase">
                      Lucifer,the fallen angel
                    </span>
                  </motion.span>
                );
              }
              return (
                <motion.span key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ clipPath: notch(8), ...chipStyle(i) }}>
                  {i === 0 && <Crown className="h-3 w-3" />}
                  {t}
                </motion.span>
              );
            })}
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
                  const isBugDetective = title.toLowerCase() === "bug detective";
                  const isLucifer = title.toLowerCase().includes("lucifer") || title.toLowerCase().includes("fallen angel");
                  return (
                    <button key={title} onClick={() => toggle(title)}
                      title={set ? `From completing ${set}` : "Earned"}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition hover:brightness-115"
                      style={{
                        clipPath: notch(8),
                        color: on ? (at === 0 ? "#fcd34d" : ACCENT_LIT) : "#64748b",
                        background: on ? (isBugDetective ? "rgba(219,39,119,.15)" : isLucifer ? "rgba(168,85,247,.2)" : "rgba(162,116,255,.14)") : "rgba(255,255,255,.03)",
                        boxShadow: `inset 0 0 0 1px ${on ? (isBugDetective ? "rgba(244,63,94,.5)" : isLucifer ? "rgba(192,132,252,.7)" : "rgba(162,116,255,.55)") : "rgba(255,255,255,.09)"}`,
                      }}>
                      {on && <span className="font-mono text-[10px] opacity-80">{at + 1}</span>}
                      {isBugDetective ? (
                        <span className="inline-flex items-center gap-1.5">
                          <img src="/icons/bug-detective.png" alt="Bug Detective" className="h-5 w-5 object-contain shrink-0" />
                          <img src="/titles/bug-detective-wordmark.png" alt="Bug Detective" className="h-4 object-contain drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]" />
                        </span>
                      ) : isLucifer ? (
                        <span className="inline-flex items-center gap-1.5">
                          <img src="/icons/lucifer-gojo.png" alt="Lucifer, the fallen angel" className="h-5 w-5 object-contain shrink-0" />
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] drop-shadow-[0_0_10px_rgba(192,132,252,0.8)] font-black tracking-wider uppercase">
                            Lucifer,the fallen angel
                          </span>
                        </span>
                      ) : (
                        title
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Stack"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
