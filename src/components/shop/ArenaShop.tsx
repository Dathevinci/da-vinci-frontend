"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Diamond, Swords, Info } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { isAdmin } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import { ARENA_LIST, GRADE_STYLE, type ArenaEffectDef } from "@/data/arenaEffects";
import { ArenaPreview } from "@/components/cards/ArenaBackdrop";
import ArenaChest from "@/components/shop/ArenaChest";
import CardFace from "@/components/cards/CardFace";
import { arenaAsCard } from "@/data/arenaChest";

/**
 * ARENA EFFECTS — the shop's second counter.
 *
 * These don't touch your profile; they redress the duel board. The two rules
 * worth knowing before you spend anything are stated on the page itself, not
 * buried here: BOTH duellists have to switch effects on for any of it to show,
 * and when both bring one, the rarer of the two is what everybody plays under.
 *
 * Nothing in this catalogue changes damage, HP or turn order. That's the
 * deliberate line — an arena effect you could buy your way to a win with
 * would just be a paywall wearing a costume.
 */
export default function ArenaShop() {
  const { user, updateProfile } = useUser();
  const { toast } = useToast();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The arena a chest just handed over. Its tile is scrolled to and pulsed on
  // reveal close, so you land on the thing actually running, next to Equip.
  const [justWon, setJustWon] = useState<string | null>(null);

  useEffect(() => {
    if (!justWon) return;
    document.getElementById(`arena-${justWon}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setJustWon(null), 1600);
    return () => clearTimeout(t);
  }, [justWon]);

  if (!user) return null;

  const ownedIds = user.purchasedArenaEffects || [];
  const equipped = user.activeArenaEffect || null;
  const godMode = isAdmin(user);

  // Mirrors the shop page: the server has already moved the points, this just
  // syncs the cached copy so the balance and the Owned pill update instantly.
  const applyPurchase = (itemId: string, newAP: number | null) => {
    try {
      const stored = localStorage.getItem("davinci_user");
      if (!stored) return;
      const u = JSON.parse(stored);
      if (typeof newAP === "number") u.arisePoints = newAP;
      u.purchasedArenaEffects = Array.from(new Set([...(u.purchasedArenaEffects || []), itemId]));
      localStorage.setItem("davinci_user", JSON.stringify(u));
      window.dispatchEvent(new Event("davinci_user_updated"));
    } catch {}
  };

  const buy = async (fx: ArenaEffectDef) => {
    if (!godMode && (user.arisePoints || 0) < fx.price) {
      return toast("Not enough Arise Points!", "error");
    }
    setBuyingId(fx.id);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/users/purchase`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, itemId: fx.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return toast(data.message || "Purchase failed", "error");
      applyPurchase(fx.id, typeof data.arisePoints === "number" ? data.arisePoints : null);
      toast(`${fx.name} is yours — equip it to bring it to the arena.`, "success");
    } catch {
      toast("Purchase failed", "error");
    } finally {
      setBuyingId(null);
    }
  };

  const equip = async (fx: ArenaEffectDef, on: boolean) => {
    // "arena_none" is the unequip sentinel the backend stores as NULL.
    const r = await updateProfile({ activeArenaEffect: on ? fx.id : "arena_none" } as any);
    if (r?.success) toast(on ? `${fx.name} equipped` : `${fx.name} unequipped`, "success");
    else toast("Failed to change your arena", "error");
  };

  return (
    <div>
      {/* ── How this works. Two rules, stated before anyone spends. ── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-purple-300">
            <Swords className="h-3.5 w-3.5" /> Both sides must agree
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            An arena effect changes the board for <em>both</em> duellists, so it can&apos;t be forced on anyone.
            When you send or accept a challenge you each choose whether to duel with effects on — if either
            of you says no, the arena stays plain.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">
            <Diamond className="h-3.5 w-3.5" /> The rarer one wins
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            If you both bring an arena, the higher grade is what you play under — and higher grades
            apply harder. An A-grade tints the board. An SSS takes it over completely.
            Effects never change damage, HP or turn order.
          </p>
        </div>
      </div>

      {/* The gamble sits above the fixed prices — cheaper than any arena above
          A grade, but it decides which one you get. */}
      <ArenaChest onWon={setJustWon} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {ARENA_LIST.map((fx, i) => {
          const owned = ownedIds.includes(fx.id) || godMode;
          const active = equipped === fx.id;
          const g = GRADE_STYLE[fx.grade];
          const open = expanded === fx.id;

          return (
            <motion.div
              key={fx.id}
              id={`arena-${fx.id}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.2) }}
              className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-[#0a0a11] transition-colors ${
                justWon === fx.id
                  ? "border-fuchsia-300 shadow-[0_0_50px_rgba(217,70,239,0.55)]"
                  : active
                  ? "border-purple-400/70 shadow-[0_0_34px_rgba(168,85,247,0.3)]"
                  : g.ring
              }`}
            >
              {/* The real card, standing on the board it creates. The card
                  carries the name, the grade plate and the stars; the live
                  backdrop behind it is the effect actually running. Noir
                  visibly drains the card itself, which no mock shape could
                  show — that IS the product demo. */}
              <ArenaPreview
                effectId={fx.id}
                className="border-b border-white/10 py-5"
              >
                <motion.div
                  whileHover={{ y: -6, rotate: -1 }}
                  transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  style={{ willChange: "transform" }}
                >
                  <CardFace card={arenaAsCard(fx)} owned size={150} showStats={false} />
                </motion.div>
              </ArenaPreview>

              <div className="flex flex-1 flex-col p-4">
                <p className="mb-3 text-center text-xs italic text-slate-500">{fx.tagline}</p>

                {/* Grade → how much of the board it takes, shown as a bar so the
                    "rarer applies more" rule is visible rather than claimed. */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    <span>Board coverage</span>
                    <span className="tabular-nums">{Math.round(fx.intensity * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                      style={{ width: `${fx.intensity * 100}%` }}
                    />
                  </div>
                </div>

                <p className={`text-sm leading-relaxed text-slate-400 ${open ? "" : "line-clamp-2"}`}>{fx.blurb}</p>
                <button
                  onClick={() => setExpanded(open ? null : fx.id)}
                  className="mt-1 self-start text-[11px] font-bold text-purple-400 transition hover:text-purple-300"
                >
                  {open ? "Less" : "Read more"}
                </button>

                <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-sm font-black text-white">
                    <Diamond className="h-3.5 w-3.5 text-fuchsia-400" />
                    {owned ? <span className="text-emerald-400">Owned</span> : fx.price.toLocaleString()}
                  </div>

                  {owned ? (
                    <button
                      onClick={() => equip(fx, !active)}
                      className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-black transition ${
                        active
                          ? "border border-purple-400/50 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25"
                          : "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:brightness-110"
                      }`}
                    >
                      {active ? (<><Check className="h-3.5 w-3.5" /> Equipped</>) : "Equip"}
                    </button>
                  ) : (
                    <button
                      onClick={() => buy(fx)}
                      disabled={buyingId === fx.id}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 text-xs font-black text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      {buyingId === fx.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <>Buy</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        You can own as many arenas as you like but only bring one to a duel — the equipped one. Swap it any
        time; a duel already underway keeps whatever it started with.
      </p>
    </div>
  );
}
