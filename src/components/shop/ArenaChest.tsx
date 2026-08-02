"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { usePreferences } from "@/hooks/usePreferences";
import { isAdmin } from "@/lib/admin";
import { authHeaders } from "@/lib/authToken";
import type { CardDef } from "@/components/cards/CardFace";
import PackReveal from "@/components/cards/PackReveal";
import { notch, ACCENT, SegBar } from "@/components/cards/gacha";
import { GRADE_STYLE, type ArenaGrade } from "@/data/arenaEffects";
import {
  CHEST_LIST, DUPE_REFUND, arenaAsCard, chestPool, itemOdds, type ArenaChestDef,
} from "@/data/arenaChest";

// Module scope, deliberately. shop/page.tsx declared this inside one function
// and read it from another, which threw ReferenceError on every "Buy the set".
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ARENA CACHE — one chest, one roll, one arena effect.
 *
 * THE ORDERING RULE, which is the whole correctness story:
 *
 *   The chest may RATTLE before the server answers. Nothing may REVEAL
 *   before it does.
 *
 * The arm and rattle beats are ACCENT purple and encode nothing — they are a
 * loading state wearing a costume. Not one pixel carrying outcome information
 * renders until the POST has resolved, `success` is true, and the response
 * actually contains an effect id. The reveal is mounted FROM the resolved
 * result and is never mounted in a pending state, so it is structurally
 * incapable of showing a card the server didn't grant.
 *
 * The first grade-coloured pixel in the sequence is PackReveal's warp, and by
 * then the grant is durable in Postgres. That purple-to-grade colour switch is
 * the tell — and it is shipped code doing it.
 *
 * rollId is minted once per button press and reused across retries, so a
 * replay returns the original result instead of buying a second chest.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Beat = "idle" | "arm" | "rattle" | "burst";

type Result = {
  card: CardDef;
  grade: ArenaGrade;
  duplicate: boolean;
  refund: number;
  owned: number;
  poolSize: number;
  missing: string[];
};

export default function ArenaChest({ onWon }: { onWon?: (effectId: string) => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();

  const [beat, setBeat] = useState<Beat>("idle");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // The OS query is read in an effect, never during render — this component
  // mounts on the shop page, which server-renders.
  const [osReduce, setOsReduce] = useState(false);
  useEffect(() => {
    setOsReduce(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);
  const calm = preferences.reducedMotion || osReduce;

  if (!user) return null;

  const ownedIds = user.purchasedArenaEffects || [];
  const pity = user.arenaChestPity || 0;
  const godMode = isAdmin(user);

  return (
    <div className="mb-8 grid gap-5 lg:grid-cols-2">
      {CHEST_LIST.map((chest) => (
        <ChestTile
          key={chest.id}
          chest={chest}
          ownedIds={ownedIds}
          pity={pity}
          godMode={godMode}
          balance={user.arisePoints || 0}
          busy={openingId !== null}
          beat={openingId === chest.id ? beat : "idle"}
          calm={calm}
          onOpen={async () => {
            if (openingId) return;
            const pool = chestPool(chest);
            if (pool.every((fx) => ownedIds.includes(fx.id))) return;
            if (!godMode && (user.arisePoints || 0) < chest.price) {
              return toast("Not enough Arise Points!", "error");
            }

            // One id per press, reused if we retry. This is what makes a
            // replay return the original roll instead of buying again.
            const rollId =
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

            setOpeningId(chest.id);

            // Calm path skips the beats entirely; the button label is the
            // whole loading state.
            if (!calm && prefsLoaded) {
              setBeat("arm");
              setTimeout(() => setBeat("rattle"), 120);
            }

            // The rattle has a 600ms floor so a fast response doesn't flash,
            // but it never *gates* the answer — a slow server only stretches
            // this beat.
            const floor = calm ? Promise.resolve() : new Promise((r) => setTimeout(r, 720));

            try {
              const [res] = await Promise.all([
                fetch(`${API_URL}/api/cards/arena-chest`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ userId: user.id, chestId: chest.id, rollId }),
                }),
                floor,
              ]);
              const json = await res.json().catch(() => null);
              const d = json?.data ?? {};
              const eff = d.effect;

              // NO OVERLAY, EVER, unless the server actually granted something.
              if (!res.ok || !json?.success || typeof eff?.id !== "string" || !eff.id) {
                setBeat("idle");
                setOpeningId(null);
                toast(json?.message || "We couldn't confirm that chest — checking your collection.", "error");
                await reconcile(user.id);
                return;
              }

              // Authoritative array from the server, not a local guess.
              const nowOwned: string[] = Array.isArray(d.purchasedArenaEffects)
                ? d.purchasedArenaEffects
                : ownedIds;
              syncUser(d.arisePoints, nowOwned, d.pity);

              const won: Result = {
                card: arenaAsCard(eff),
                grade: eff.grade,
                duplicate: !!d.duplicate,
                refund: d.refund ?? 0,
                owned: pool.filter((fx) => nowOwned.includes(fx.id)).length,
                poolSize: pool.length,
                missing: pool.filter((fx) => !nowOwned.includes(fx.id)).map((fx) => fx.name),
              };

              if (calm) {
                setBeat("idle");
                setResult(won);
              } else {
                // The lid goes, THEN the reveal takes the screen. Mounting the
                // full-screen overlay at the same moment would cover the burst
                // with a black backdrop before anyone saw it.
                setBeat("burst");
                // 420 here is hand-synced with the 0.42s lid-burst transition
                // on the tile. A timer, not onAnimationComplete — that fires on
                // an element's OWN animation, never its children's keyframes.
                setTimeout(() => { setBeat("idle"); setResult(won); }, 420);
              }
            } catch {
              setBeat("idle");
              setOpeningId(null);
              toast("That chest didn't open — checking your collection.", "error");
              await reconcile(user.id);
            }
          }}
        />
      ))}

      <AnimatePresence>
        {result && (
          <PackReveal
            key="arena-reveal"
            cards={[result.card]}
            title={result.duplicate ? "Already yours" : "Arena unsealed"}
            showStats={false}
            calm={calm}
            footer={<RevealFooter r={result} />}
            onClose={() => {
              const wonId = result.card.id;
              setResult(null);
              setOpeningId(null);
              setBeat("idle");
              // An abort or tab-close mid-flight can leave the cache behind the
              // DB, and there is no alreadyOwned rescue here to stop a second
              // charge — so re-read the truth on the way out.
              reconcile(user.id);
              onWon?.(wonId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── the tile ────────────────────────────────────────────────────────────── */

function ChestTile({
  chest, ownedIds, pity, godMode, balance, busy, beat, calm, onOpen,
}: {
  chest: ArenaChestDef; ownedIds: string[]; pity: number; godMode: boolean;
  balance: number; busy: boolean; beat: Beat; calm: boolean; onOpen: () => void;
}) {
  const pool = useMemo(() => chestPool(chest), [chest]);
  const odds = useMemo(() => itemOdds(chest), [chest]);
  // Counted from the real inventory, NOT from an "owned || godMode" flag —
  // otherwise staff read "complete" on a chest the server will still sell them.
  const ownedCount = pool.filter((fx) => ownedIds.includes(fx.id)).length;
  const stillNew = pool.length - ownedCount;
  const complete = stillNew === 0;
  const afford = godMode || balance >= chest.price;
  const pityLeft = chest.pityAfter > 0 ? Math.max(0, chest.pityAfter - pity) : 0;

  const opening = beat !== "idle";

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-purple-500/25 bg-gradient-to-b from-[#141021] to-[#0a0a11] p-5"
      style={{ boxShadow: "0 0 40px rgba(168,85,247,0.10)" }}
    >
      {/* the chest itself */}
      <motion.div
        className="relative mx-auto mb-4 w-fit"
        animate={
          calm || beat === "idle"
            ? { scale: 1, rotate: 0, x: 0, opacity: 1 }
            : beat === "arm"
            ? { scale: 0.96 }
            : beat === "rattle"
            ? { rotate: [0, -1.5, 1.5, -1, 1, 0], x: [0, -3, 3, -2, 2, 0] }
            : { scale: [1, 1.06, 0.9], opacity: [1, 1, 0] }
        }
        transition={
          beat === "rattle"
            ? { duration: 0.45, repeat: Infinity, ease: "linear" }
            : { duration: beat === "burst" ? 0.42 : 0.12 }
        }
        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
      >
        <ChestArt lit={beat === "rattle" || beat === "burst"} />
        {beat === "burst" && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: `radial-gradient(closest-side, #fff, ${ACCENT}, transparent 70%)` }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 2.4], opacity: [0, 1, 0] }}
            transition={{ duration: 0.42 }}
          />
        )}
      </motion.div>

      <h3 className="text-center text-xl font-black text-white">{chest.name}</h3>
      <p className="mt-1 text-center text-sm text-slate-400">{chest.blurb}</p>

      {/* published odds — a six-item pool is reverse-engineered in a weekend,
          and being caught hiding rates is worse than the rates being bad */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          <Sparkles className="h-3 w-3" /> Drop rates
        </div>
        <div className="grid gap-1">
          {odds.map(({ fx, pct }) => {
            const g = GRADE_STYLE[fx.grade];
            const have = ownedIds.includes(fx.id);
            return (
              <div key={fx.id} className="flex items-center gap-2 text-xs">
                <span className={`w-9 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-black ${g.chip}`}>
                  {fx.grade}
                </span>
                <span className={`flex-1 truncate font-bold ${have ? "text-slate-600 line-through" : "text-slate-200"}`}>
                  {fx.name}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-slate-400">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 border-t border-white/5 pt-2 text-[11px] leading-relaxed text-slate-500">
          A duplicate refunds {DUPE_REFUND.A}–{DUPE_REFUND.SSS.toLocaleString()} AP by grade.
        </p>
      </div>

      {/* collection + pity */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          <span>{complete ? "Collection complete" : `${stillNew} of ${pool.length} still new to you`}</span>
          <span className="tabular-nums">{ownedCount}/{pool.length}</span>
        </div>
        <SegBar value={ownedCount} max={pool.length} />
        {!complete && chest.pityAfter > 0 && (
          <p className="mt-2 text-[11px] font-bold text-purple-300/80">
            {pityLeft === 0
              ? "Your next Cache is a guaranteed new arena."
              : `Guaranteed new arena in ${pityLeft} ${pityLeft === 1 ? "chest" : "chests"}.`}
          </p>
        )}
        {/* Said plainly rather than buried, because it's true and hiding it
            would be the sharp practice this whole tile is trying to avoid. */}
        {!complete && stillNew <= 3 && (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-300/70">
            You&apos;re past the point where the Cache pays. Buying the arena you want outright is now better value.
          </p>
        )}
      </div>

      <button
        onClick={onOpen}
        disabled={complete || busy || !afford}
        className="mt-4 w-full py-3.5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-110 disabled:opacity-35"
        style={{
          clipPath: notch(11),
          background: complete
            ? "rgba(255,255,255,.07)"
            : "linear-gradient(100deg, #7c3aed, #c026d3)",
        }}
      >
        {complete
          ? "Collection complete"
          : opening
          ? "Unsealing…"
          : !afford
          ? `Need ${(chest.price - balance).toLocaleString()} more AP`
          : `Open — ${chest.price.toLocaleString()} AP`}
      </button>
      {complete && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
          Every arena is already yours. The Cache has nothing left to give you.
        </p>
      )}
    </div>
  );
}

/** A small procedural chest. Two paths and a seam — no image to 404. */
function ChestArt({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 120 96" width={132} height={106} aria-hidden>
      <defs>
        <linearGradient id="ac-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b2168" />
          <stop offset="100%" stopColor="#1a1030" />
        </linearGradient>
        <linearGradient id="ac-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d3fb8" />
          <stop offset="100%" stopColor="#3b2168" />
        </linearGradient>
      </defs>
      {/* lid */}
      <path d="M14 44 Q60 8 106 44 L106 52 L14 52 Z" fill="url(#ac-lid)" stroke={ACCENT} strokeWidth="1.6" />
      {/* body */}
      <rect x="14" y="52" width="92" height="36" rx="5" fill="url(#ac-body)" stroke={ACCENT} strokeWidth="1.6" />
      {/* bands */}
      <rect x="34" y="44" width="7" height="44" fill="#2a1a4d" stroke={ACCENT} strokeWidth="0.8" opacity="0.8" />
      <rect x="79" y="44" width="7" height="44" fill="#2a1a4d" stroke={ACCENT} strokeWidth="0.8" opacity="0.8" />
      {/* the seam, which is what breathes while it strains */}
      <rect
        className="ac-seam"
        x="15" y="50" width="90" height="4" rx="2"
        fill={ACCENT}
        style={{ opacity: lit ? 0.9 : 0.2, transition: "opacity 450ms ease-in-out" }}
      />
      {/* lock */}
      <rect x="54" y="52" width="12" height="14" rx="3" fill="#0d0818" stroke={ACCENT} strokeWidth="1.2" />
      <circle cx="60" cy="59" r="2.4" fill={ACCENT} opacity={lit ? 1 : 0.5} />
    </svg>
  );
}

/* ── the verdict under the reveal ────────────────────────────────────────── */

function RevealFooter({ r }: { r: Result }) {
  return (
    <div className="w-full max-w-sm text-center">
      {r.duplicate ? (
        <>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
            Already in your collection
          </p>
          {r.refund > 0 && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-black text-amber-300">
              <Diamond className="h-3.5 w-3.5" />+{r.refund.toLocaleString()} Arise Points refunded
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-300">
          New — added to your arenas
        </p>
      )}

      <div className="mx-auto mt-4 w-full max-w-[220px]">
        <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          <span>Arenas</span>
          <span className="tabular-nums">{r.owned}/{r.poolSize}</span>
        </div>
        <SegBar value={r.owned} max={r.poolSize} />
      </div>

      {/* A duplicate that tells you only Void Rift is left is a progress
          report rather than a consolation prize — and the honest argument
          for the next chest. */}
      {r.missing.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {r.missing.map((n) => (
            <span key={n} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── cache sync ──────────────────────────────────────────────────────────── */

function syncUser(arisePoints: unknown, purchasedArenaEffects: string[], pity: unknown) {
  try {
    const stored = localStorage.getItem("davinci_user");
    if (!stored) return;
    const u = JSON.parse(stored);
    if (typeof arisePoints === "number") u.arisePoints = arisePoints;
    if (typeof pity === "number") u.arenaChestPity = pity;
    u.purchasedArenaEffects = purchasedArenaEffects;
    localStorage.setItem("davinci_user", JSON.stringify(u));
    window.dispatchEvent(new Event("davinci_user_updated"));
  } catch {}
}

/** Re-read the server's truth after anything ambiguous. */
async function reconcile(userId: string) {
  try {
    const res = await fetch(`${API_URL}/api/users/${userId}`, { headers: authHeaders() });
    const json = await res.json();
    if (!json?.success || !json.data) return;
    const stored = localStorage.getItem("davinci_user");
    if (!stored) return;
    const u = JSON.parse(stored);
    localStorage.setItem("davinci_user", JSON.stringify({ ...u, ...json.data }));
    window.dispatchEvent(new Event("davinci_user_updated"));
  } catch {}
}
