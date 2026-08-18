"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Stamp, TrendingUp, Trophy, Diamond, Sparkles, Info, LogIn } from "lucide-react";
import { StampSeal } from "@/components/stamp/StampSeal";
import RecCard from "@/components/stamp/RecCard";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { isLeadDev, displayArisePoints } from "@/lib/admin";
import {
  BOOST_FLOOR,
  EMPTY_STAMP,
  StampProfile,
  StampRequestError,
  StampTotals,
  fetchStamp,
  boostStamp,
  hasStampSession,
  pointsToNextGrade,
} from "@/lib/stamps";

/**
 * THE STAMP, ON A PROFILE.
 *
 * Shows the seal at full size, the grade, and — the part that matters — the
 * score split HONESTLY: what the recommendations earned, and what other people
 * paid to boost, side by side and never merged into one flattering number.
 *
 * Three rules this section is built around, all of them the owner's:
 *   · Boosts move the grade, but they are capped at the earned score. A stamp
 *     that has earned nothing — OR one already pinned at its ceiling — cannot
 *     be bought upward, so the Boost control refuses in both cases rather than
 *     taking points for provably zero movement, and says which case it is.
 *   · Nobody boosts their own stamp. Hidden on your own profile, refused by
 *     the server regardless.
 *   · The three active recs are the stamp. Retiring one frees the slot but
 *     never erases the verdict it earned.
 *
 * THE NUMBERS MOVE WHILE YOU WATCH. Both writes on this surface answer with the
 * owner's recomputed stamp — the vote endpoint and the boost endpoint alike —
 * so the plaque is updated from the response instead of being left showing
 * pre-vote figures until a reload. A vote visibly moving a grade IS the
 * feature; discarding the number that proves it was the bug.
 *
 * Self-contained in this codebase's established manner (see GuildCard): it
 * fetches its own data and renders NOTHING when a profile has no stamp
 * activity at all, so quiet profiles do not grow an empty box.
 */

const BOOST_CHIPS = [50, 100, 250, 500];

type Props = {
  userId: string;
  username: string;
  isSelf: boolean;
  className?: string;
};

export default function ProfileStamp({ userId, username, isSelf, className = "" }: Props) {
  const { user: viewer } = useUser();
  const { toast } = useToast();
  /** Pulled out as a primitive so the effects below key on the identity itself
   *  and not on a cached-user object that can be rebuilt without changing. */
  const viewerId = viewer?.id || null;

  const [stamp, setStamp] = useState<StampProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState<string>("100");
  const [confirming, setConfirming] = useState(false);
  const [spending, setSpending] = useState(false);
  /**
   * Signed in by the cached user, but holding no session token — so every write
   * (vote, boost, retire) comes back 401 AUTH_REQUIRED. Resolved in an effect
   * because it reads localStorage: computing it during render would make the
   * server paint and the first client paint disagree.
   */
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    setNeedsSignIn(!!viewerId && !hasStampSession());
  }, [viewerId]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      // The viewer rides along so a tokenless session still gets its own
      // myVote/opened back (the server prefers the token and only reads this
      // when there is none). Without it the gate re-locked on every reload and
      // a vote already cast showed as uncast.
      const s = await fetchStamp(userId, viewerId);
      setStamp(s);
    } catch (err) {
      /**
       * "NO STAMP YET" AND "SERVER DOWN" GET OPPOSITE TREATMENT.
       *
       * A 404 on your OWN profile means you simply haven't stamped anything —
       * every number really is zero, so the zero-state and its invitation are
       * the truth. Anything else (offline, 5xx) leaves `stamp` null and this
       * section renders nothing at all, because a fabricated "Grade C · 0"
       * during an outage would be a lie with a seal on it.
       */
      if (isSelf && err instanceof StampRequestError && err.status === 404) {
        setStamp(EMPTY_STAMP);
      }
    } finally {
      setLoaded(true);
    }
  }, [userId, isSelf, viewerId]);

  useEffect(() => {
    setStamp(null);
    setLoaded(false);
    load();
  }, [load]);

  /**
   * THE SERVER'S RECOMPUTED STAMP, APPLIED IN PLACE.
   *
   * Both the vote and the boost responses carry it, so neither needs a second
   * read of the profile — and, more importantly, neither leaves the plaque
   * showing numbers the reader just changed. The recs' own `ownerGrade` is
   * updated with it because every card in this section belongs to this one
   * owner, and the seal on a cover is that same grade: leaving them behind
   * would put two different grades on one screen. `ownerRank` is untouched —
   * that is last week's podium, which no vote can move.
   */
  const applyTotals = useCallback((t: StampTotals) => {
    setStamp((prev) =>
      prev
        ? {
            ...prev,
            grade: t.grade,
            score: t.score,
            organic: t.organic,
            boosted: t.boosted,
            recs: prev.recs.map((r) => (r.ownerId === t.userId ? { ...r, ownerGrade: t.grade } : r)),
          }
        : prev,
    );
  }, []);

  if (!loaded || !stamp) return null;

  const active = stamp.recs.filter((r) => !r.retiredAt);
  const untouched = active.length === 0 && stamp.score === 0 && stamp.organic === 0;
  // A stranger's blank stamp is not worth a box on their profile. Their own
  // is: it is where they learn the feature exists.
  if (untouched && !isSelf) return null;

  /* ── the split, drawn exactly as the numbers stand ── */
  const earned = stamp.organic;
  const boosted = stamp.boosted;
  /**
   * MIRRORS THE SERVER'S combine() EXACTLY, including BOOST_FLOOR. If these
   * two formulas drift, the button promises movement the server will refuse
   * to count — which is worse than no button at all, because the points are
   * already spent by the time anyone notices.
   */
  const ceiling = Math.max(BOOST_FLOOR, earned);
  const headroom = Math.max(0, ceiling - boosted);
  const atCeiling = headroom === 0;
  const total = Math.max(0, stamp.score);
  const earnedPct = total > 0 ? (Math.max(0, earned) / total) * 100 : 0;
  const boostPct = total > 0 ? (boosted / total) * 100 : 0;
  const next = pointsToNextGrade(stamp.grade, stamp.score);

  const canBoost = !isSelf && !!viewer && viewer.id !== userId;
  const amountNum = Math.floor(Number(amount));
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;
  const balance = viewer?.arisePoints || 0;
  const rich = isLeadDev(viewer) || balance >= amountNum;

  /**
   * WHEN A BOOST CANNOT DO ANYTHING, THE BUTTON SAYS SO AND STAYS DOWN.
   *
   * `boosted` is min(everything sent, max(BOOST_FLOOR, organic)). A stamp
   * pinned at that ceiling takes Arise Points for provably zero movement of
   * the grade — on the weekly board as much as the lifetime one, since the
   * week's boost is capped by the week's own organic under the same rule.
   *
   * The floor means "earned nothing yet" is no longer a blocked state: a brand
   * new stamp has 25 points of headroom, which is what makes boosting usable
   * on day one instead of waiting for the first votes to exist.
   */
  const boostBlocked = atCeiling;

  /**
   * NO CONTRIBUTION PREVIEW, ON PURPOSE.
   *
   * A booster's contribution is shaped by the square root of everything THEY
   * have ever sent this stamp — a total the API deliberately doesn't publish
   * per viewer. Any "+N to the grade" figure drawn here would therefore be a
   * guess dressed as arithmetic. The rule is stated in words instead, and the
   * real numbers come back with the spend itself.
   */
  const doBoost = async () => {
    if (!viewer || !validAmount || boostBlocked) return;
    setSpending(true);
    const res = await boostStamp(userId, viewer.id, amountNum);
    setSpending(false);

    if (!res.ok) {
      if (res.code === "AUTH_REQUIRED") {
        setNeedsSignIn(true);
        toast("Your session expired — sign in again to boost.", "error");
        return;
      }
      toast(res.message, "error");
      return;
    }

    // Keep the balance the rest of the app shows in step with the spend —
    // same cached-user sync every other Arise Points sink performs.
    const nextBalance = res.data?.arisePoints;
    if (typeof nextBalance === "number") {
      try {
        const stored = localStorage.getItem("davinci_user");
        if (stored) {
          const u = JSON.parse(stored);
          u.arisePoints = nextBalance;
          localStorage.setItem("davinci_user", JSON.stringify(u));
          window.dispatchEvent(new Event("davinci_user_updated"));
        }
      } catch {
        /* cache sync is optional */
      }
    }

    // The recipient's recomputed stamp came back with the spend — apply it
    // rather than re-reading the profile. A boost changes totals and nothing
    // else, so a refetch would buy only a flicker.
    if (res.data.owner) applyTotals(res.data.owner);
    toast(`Boosted ${username}'s stamp with ${amountNum.toLocaleString()} AP.`, "success");
  };

  return (
    <section className={`font-mono ${className}`}>
      {/* ═══ THE PLAQUE ═══ */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-[#0b0b11]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(245,158,11,0.12),rgba(11,11,17,0.92)_45%,rgba(245,158,11,0.06))]"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          {/* the seal itself — one instance on the page, so the sheen is
              allowed here (it still yields to Performance Mode inside the
              component). Never in the grid below. */}
          <div className="flex shrink-0 items-center justify-center sm:justify-start">
            <StampSeal
              username={username}
              grade={stamp.grade}
              size="lg"
              rank={stamp.topThreeRank}
              animated
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                <Stamp className="h-3 w-3" /> Grade {stamp.grade}
              </span>
              {stamp.weeklyRank !== null && (
                <Link
                  href="/stamps"
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/20"
                >
                  <TrendingUp className="h-3 w-3" /> #{stamp.weeklyRank} this week
                </Link>
              )}
              {stamp.topThreeRank !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                  <Trophy className="h-3 w-3" /> Last week&rsquo;s #{stamp.topThreeRank} seal
                </span>
              )}
            </div>

            {/* THE SPLIT. One total, and immediately underneath it exactly
                where that total came from. */}
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black tabular-nums text-white">
                {stamp.score.toLocaleString()}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                stamp score
              </span>
            </div>

            <div className="mt-2.5 flex h-2 w-full max-w-md overflow-hidden rounded-full border border-white/10 bg-black/40">
              {total > 0 ? (
                <>
                  <span
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{ width: `${earnedPct}%` }}
                    aria-hidden
                  />
                  <span
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                    style={{ width: `${boostPct}%` }}
                    aria-hidden
                  />
                </>
              ) : (
                <span className="h-full w-full bg-white/[0.04]" aria-hidden />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <b className="font-black tabular-nums">{earned.toLocaleString()}</b>
                <span className="text-slate-500">earned</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <b className="font-black tabular-nums">{boosted.toLocaleString()}</b>
                <span className="text-slate-500">boosted</span>
              </span>
              {next && (
                <span className="text-slate-500">
                  · <b className="font-black text-slate-300 tabular-nums">{next.needed}</b> to{" "}
                  {next.next}
                </span>
              )}
            </div>

            <p className="mt-2 max-w-lg text-[10px] leading-relaxed text-slate-500">
              Boosts are capped at the earned score, with the first{" "}
              {BOOST_FLOOR} open to every stamp
              {atCeiling ? (
                <> — this one is at its ceiling until the recs earn more.</>
              ) : (
                <>
                  {" "}
                  — <b className="text-slate-400">{headroom.toLocaleString()}</b> of boost still
                  fits.
                </>
              )}
            </p>
          </div>

          {/* ═══ BOOST ═══ never on your own stamp ═══ */}
          {canBoost && (
            <div className="w-full shrink-0 rounded-xl border border-white/10 bg-black/30 p-3.5 sm:w-56">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Boost
                </span>
                <span className="flex items-center gap-1 text-[10px] font-black text-amber-300">
                  <Diamond className="h-3 w-3" />
                  {isLeadDev(viewer) ? "∞" : displayArisePoints(viewer)} AP
                </span>
              </div>

              {/* A SESSION THAT CANNOT WRITE GETS TOLD, NOT A DEAD BUTTON.
                  Boosting is token-only now; a grandfathered session would
                  fill in an amount, confirm the spend and collect a 401. */}
              {needsSignIn ? (
                <>
                  <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">
                    Your session can&rsquo;t spend Arise Points — sign in again and the boost
                    will work.
                  </p>
                  <Link
                    href="/login"
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:bg-amber-500/25"
                  >
                    <LogIn className="h-3 w-3" /> Sign in again
                  </Link>
                </>
              ) : (
                <>
                  <div className="mt-2.5 grid grid-cols-4 gap-1">
                    {BOOST_CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={boostBlocked}
                        onClick={() => setAmount(String(c))}
                        className={`rounded-lg border py-1 text-[10px] font-black tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          amountNum === c
                            ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <input
                    inputMode="numeric"
                    value={amount}
                    disabled={boostBlocked}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    aria-label="Arise Points to send"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm font-black tabular-nums text-white outline-none focus:border-amber-400/40 disabled:cursor-not-allowed disabled:opacity-40"
                  />

                  <button
                    type="button"
                    disabled={!validAmount || !rich || spending || boostBlocked}
                    onClick={() => setConfirming(true)}
                    className="mt-2 w-full rounded-lg border border-amber-400/40 bg-amber-500/15 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {spending
                      ? "Sending…"
                      : atCeiling
                        ? "At its ceiling"
                        : "Boost this stamp"}
                  </button>

                  {/* The reason, in the order that matters: a spend that cannot
                      move anything outranks one you cannot afford. */}
                  <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
                    {atCeiling
                      ? `Boosts are capped at the earned score — plus a starting ${BOOST_FLOOR} every stamp gets — and this one is already there (${boosted.toLocaleString()} of ${ceiling.toLocaleString()}). More points would change nothing until the recs earn more.`
                      : !rich
                        ? "Not enough Arise Points."
                        : `${headroom.toLocaleString()} of boost still fits. Each booster's weight grows with the square root of everything they've sent, so one wallet can't own the board.`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ THE THREE SLOTS ═══ */}
      <div className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Recommended by {username}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-300">
              {active.length}/3
            </span>
          </h3>
          <Link
            href="/stamps"
            className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:text-violet-300"
          >
            Weekly board →
          </Link>
        </div>

        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
            <Stamp className="mx-auto h-7 w-7 text-slate-700" />
            <p className="mt-3 text-xs text-slate-500">
              {isSelf
                ? "No recommendations yet — open any manhwa or novel and press Stamp this."
                : `${username} hasn't stamped anything yet.`}
            </p>
            {isSelf && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/manhwa"
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.08]"
                >
                  Browse manhwa
                </Link>
                <Link
                  href="/novel"
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.08]"
                >
                  Browse novels
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {active.map((rec) => (
              <RecCard
                /**
                 * KEYED ON THE SERVER'S NUMBERS, not the id alone.
                 *
                 * RecCard seeds its vote state from props and then owns it, so
                 * that an optimistic thumb isn't fought by its parent. The cost
                 * is that a plain id key would leave a refetched card showing
                 * the counts it was born with. Folding the server's tallies into
                 * the key remounts a card exactly when those tallies actually
                 * moved — and never mid-click, since this only re-reads after a
                 * completed action.
                 */
                key={`${rec.id}:${rec.up}:${rec.down}:${rec.myVote}:${rec.opened}`}
                rec={rec}
                variant="grid"
                viewerId={viewerId}
                needsSignIn={needsSignIn}
                canRetire={isSelf}
                onRetired={() => load()}
                /* The vote's own answer, carrying this owner's recomputed
                   stamp — the plaque above moves with the thumb that moved it.
                   Note the key deliberately does NOT include the grade, so
                   applying it re-renders the card instead of remounting it and
                   throwing away the count the reader just changed. */
                onVoted={applyTotals}
              />
            ))}
          </div>
        )}

        {isSelf && active.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600">
            <Info className="mt-px h-3 w-3 shrink-0" />
            Retiring frees a slot but keeps the verdict — a recommendation that went
            badly still counts against the stamp.
          </p>
        )}
      </div>

      <ConfirmModal
        isOpen={confirming}
        danger={false}
        title={`Boost ${username}'s stamp?`}
        message={`Spend ${validAmount ? amountNum.toLocaleString() : "0"} Arise Points. You have ${
          isLeadDev(viewer) ? "∞" : balance.toLocaleString()
        }. Boosts can't be taken back, count with diminishing returns per booster, and can never push a stamp past what it earned.`}
        confirmText={`Spend ${validAmount ? amountNum.toLocaleString() : "0"} AP`}
        onConfirm={doBoost}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
