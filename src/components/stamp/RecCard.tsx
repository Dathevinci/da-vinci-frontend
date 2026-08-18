"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown, Trash2, ArrowUpRight, BookOpen, LogIn } from "lucide-react";
import { StampSeal } from "@/components/stamp/StampSeal";
import { useToast } from "@/components/ui/Toast";
import {
  StampRec,
  StampTotals,
  StampVote,
  recHref,
  recCoverSrc,
  mediaLabel,
  stampAgo,
  openRec,
  voteRec,
  retireRec,
} from "@/lib/stamps";

/**
 * ONE RECOMMENDATION, WITH THE VOTE GATE WIRED INTO THE CLICK.
 *
 * The rule this component exists to keep: a thumb is only offered to someone
 * who ACTUALLY OPENED the recommendation. Clicking through fires
 * POST /recs/:id/open and only then do the thumbs come alive. The server
 * refuses an ungated vote regardless (403 NOT_OPENED) — this side just refuses
 * to promise a button that would bounce.
 *
 * THE SEAL COMES WITH THE REC. `ownerGrade` and `ownerRank` ride on every rec
 * the API returns, so the seal is drawn from the same payload as the card.
 * There is no grade lookup here and there must never be one again: the previous
 * version fetched the owner's whole stamp per curator, capped at eight, which
 * left the ninth curator's cover bare and made the same person appear sealed or
 * unsealed depending on cache order.
 *
 * A 403 IS NOT ONE THING. NOT_OPENED means the gate genuinely isn't satisfied
 * (re-lock and say so). SELF_VOTE means you're looking at your own rec — the
 * gate is fine and must not be touched, which is why the thumbs aren't even
 * offered in that case. AUTH_REQUIRED means the session has no token at all,
 * which no amount of clicking will fix.
 *
 * Two shapes, one behaviour:
 *   "grid" — a portrait cover wearing the owner's seal. This is the GRID PATH:
 *            no canvas, no blur, no filters, no framer-motion, and the seal is
 *            never animated here. The site-wide sweep that removed exactly
 *            that cost is not being undone for a cosmetic.
 *   "feed" — a wide row: cover, owner, blurb, thumbs.
 */

type Props = {
  rec: StampRec;
  variant?: "grid" | "feed";
  /** The signed-in viewer. Without one there is nothing to gate or vote. */
  viewerId?: string | null;
  /**
   * The viewer looks signed in but holds no session token, so every write would
   * come back 401. Offered as a prop rather than read here: it comes out of one
   * localStorage check in the parent, not one per card in a sixty-card feed.
   */
  needsSignIn?: boolean;
  /** Show the retire control (the owner looking at their own stamp). */
  canRetire?: boolean;
  onRetired?: (recId: string) => void;
  /**
   * The owner's stamp AFTER this vote landed, straight from the vote response.
   * The plaque above a rec is the thing a vote is supposed to move, and it
   * cannot move without this.
   */
  onVoted?: (owner: StampTotals) => void;
  /** Show who recommended it. On someone's own profile that is redundant. */
  showOwner?: boolean;
};

export default function RecCard({
  rec,
  variant = "grid",
  viewerId = null,
  needsSignIn = false,
  canRetire = false,
  onRetired,
  onVoted,
  showOwner = false,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [up, setUp] = useState(rec.up);
  const [down, setDown] = useState(rec.down);
  const [myVote, setMyVote] = useState<StampVote>(rec.myVote);
  const [opened, setOpened] = useState(rec.opened);
  const [opening, setOpening] = useState(false);
  const [voting, setVoting] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [gone, setGone] = useState(false);
  /** Set when the server actually answered AUTH_REQUIRED — the parent's guess
   *  was wrong (or the token expired mid-session) and we now know for sure. */
  const [authLost, setAuthLost] = useState(false);

  const href = recHref(rec);
  const cover = recCoverSrc(rec.mediaType, rec.cover);

  /** Your own recommendation. The server refuses SELF_VOTE anyway; offering the
   *  buttons only to bounce them is what produced the false "open it first". */
  const isOwn = !!viewerId && rec.ownerId === viewerId;
  const signedOut = needsSignIn || authLost;

  /** Fire the gate row and remember it if it lands. Never optimistic: flipping
   *  `opened` on a request we haven't heard back from hands out thumbs the
   *  server has no record for. */
  const recordOpen = () => {
    if (!viewerId) return null;
    return openRec(rec.id, viewerId).then((r) => {
      if (r.ok) setOpened(true);
      else if (r.code === "AUTH_REQUIRED") setAuthLost(true);
      return r;
    });
  };

  /**
   * CLICK-THROUGH IS THE GATE — but the reader's own click gesture wins.
   *
   * The modifier check happens BEFORE preventDefault and returns immediately:
   * ctrl/cmd/shift/alt-click and middle-click must still open a new tab or
   * window. Hijacking them navigated the current tab and threw away the feed
   * someone was scanning — on a surface whose whole purpose is opening several
   * recommendations. The gate row is still recorded on the way past, unawaited,
   * because that navigation is genuinely an open.
   *
   * A rec this viewer has ALREADY opened skips the POST entirely and lets the
   * link navigate natively. The upsert was idempotent, so nothing was corrupted
   * — but every re-visit paid a round-trip and a full-cover "Opening…" stall
   * for a row the server already holds.
   */
  const openThenGo = async (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      if (viewerId && !opened && !opening && !signedOut) recordOpen();
      return; // no preventDefault — the browser does what was asked
    }
    // Nothing to record: let <Link> navigate on its own.
    if (!viewerId || opened || signedOut) return;
    if (opening) return;

    e.preventDefault();
    setOpening(true);
    // Raced against a short timer so a slow backend can never hold the reader
    // hostage on their own click — the fetch is not aborted, so the row still
    // lands even after we have navigated.
    const call = recordOpen();
    await Promise.race([call, new Promise((res) => setTimeout(res, 1200))]);
    setOpening(false);
    router.push(href);
  };

  const castVote = async (value: 1 | -1) => {
    if (!viewerId) {
      toast("Sign in to vote on recommendations.", "error");
      return;
    }
    if (signedOut) {
      toast("Your session expired — sign in again to vote.", "error");
      return;
    }
    if (isOwn) return; // not offered; belt and braces
    if (!opened) {
      toast("Open the recommendation first — then you can vote on it.", "info");
      return;
    }
    if (myVote === value || voting) return;

    const prev = { up, down, myVote };
    // Optimistic: moving a thumb takes one off the other side.
    setUp(up + (value === 1 ? 1 : 0) - (prev.myVote === 1 ? 1 : 0));
    setDown(down + (value === -1 ? 1 : 0) - (prev.myVote === -1 ? 1 : 0));
    setMyVote(value);
    setVoting(true);

    const res = await voteRec(rec.id, viewerId, value);
    setVoting(false);

    if (!res.ok) {
      setUp(prev.up);
      setDown(prev.down);
      setMyVote(prev.myVote);
      // BRANCH ON THE CODE, NOT THE STATUS. Two different 403s live here and
      // only one of them is the gate; re-locking on the other told the reader
      // to open something they had just opened, and turned a satisfied gate
      // into a locked one on their own profile.
      switch (res.code) {
        case "NOT_OPENED":
          setOpened(false);
          toast(res.message, "info");
          break;
        case "AUTH_REQUIRED":
          setAuthLost(true);
          toast("Your session expired — sign in again to vote.", "error");
          break;
        case "SELF_VOTE":
        case "REC_RETIRED":
        default:
          toast(res.message, "error");
      }
      return;
    }
    if (res.data) {
      setUp(res.data.up);
      setDown(res.data.down);
      setMyVote(res.data.myVote);
      // The grade this vote just moved. Handed up so the plaque changes on
      // screen — otherwise the numbers a vote exists to change sit stale until
      // a page reload.
      if (res.data.owner) onVoted?.(res.data.owner);
    }
  };

  const retire = async () => {
    if (!viewerId || retiring) return;
    setRetiring(true);
    const res = await retireRec(rec.id, viewerId);
    setRetiring(false);
    if (!res.ok) {
      if (res.code === "AUTH_REQUIRED") setAuthLost(true);
      toast(res.message, "error");
      return;
    }
    setGone(true);
    onRetired?.(rec.id);
    toast("Retired — the slot is free, and the votes it earned still count.", "info");
  };

  if (gone) return null;

  const score = up - down;

  /** The counts with no controls — for your own rec, and for a session that
   *  cannot write. Same numbers, no button that would bounce. */
  const Tallies = (
    <div className="flex items-center gap-1.5" aria-label={`${up} up, ${down} down`}>
      <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] font-black tabular-nums text-slate-500">
        <ThumbsUp className="h-3 w-3" /> {up}
      </span>
      <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] font-black tabular-nums text-slate-500">
        <ThumbsDown className="h-3 w-3" /> {down}
      </span>
    </div>
  );

  /* ── the thumbs, shared by both shapes ── */
  const Thumbs =
    isOwn || signedOut ? (
      Tallies
    ) : (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => castVote(1)}
          disabled={voting}
          aria-pressed={myVote === 1}
          title={opened ? "Good call" : "Open it first to vote"}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-black tabular-nums transition disabled:opacity-50 ${
            myVote === 1
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
              : opened
                ? "border-white/10 bg-white/[0.04] text-slate-400 hover:border-emerald-400/40 hover:text-emerald-300"
                : "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-slate-600"
          }`}
        >
          <ThumbsUp className="h-3 w-3" /> {up}
        </button>
        <button
          type="button"
          onClick={() => castVote(-1)}
          disabled={voting}
          aria-pressed={myVote === -1}
          title={opened ? "Bad call" : "Open it first to vote"}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-black tabular-nums transition disabled:opacity-50 ${
            myVote === -1
              ? "border-rose-400/50 bg-rose-500/15 text-rose-300"
              : opened
                ? "border-white/10 bg-white/[0.04] text-slate-400 hover:border-rose-400/40 hover:text-rose-300"
                : "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-slate-600"
          }`}
        >
          <ThumbsDown className="h-3 w-3" /> {down}
        </button>
      </div>
    );

  /**
   * WHY THE THUMBS AREN'T THERE — said once, in the reader's own words.
   * Only one of these can be true at a time, and the order is the order of
   * finality: no token beats your-own-rec beats the gate.
   */
  const VoteNote = signedOut ? (
    <Link
      href="/login"
      className="inline-flex items-center gap-1 text-[10px] font-black leading-snug text-amber-300/90 underline-offset-2 hover:underline"
    >
      <LogIn className="h-3 w-3" /> Sign in again to vote
    </Link>
  ) : isOwn ? (
    <span className="text-[10px] leading-snug text-slate-600">
      Your recommendation — other people&rsquo;s thumbs decide it.
    </span>
  ) : !opened ? (
    <span className="text-[10px] leading-snug text-slate-600">Open it to unlock voting.</span>
  ) : null;

  /**
   * The cover, with the seal pressed onto it.
   *
   * DIVs, not SPANs, even though this lives inside a <Link>. An anchor may
   * legally wrap flow content, but a <span> may not contain one — and
   * StampSeal is somebody else's component whose root element is not ours to
   * assume. Wrapping it in phrasing-only markup is how you get a hydration
   * mismatch that only shows up in production.
   */
  const Cover = (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-[#101018]">
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <BookOpen className="h-8 w-8 text-slate-700" />
        </div>
      )}
      {/* the stamp sits on the art, bottom-right, exactly as described:
          a cover with a seal pressed onto it. Grade AND podium rank both come
          off the rec, so a curator who won last week wears their seal here too
          — the feed is where most of their covers are read. */}
      {rec.ownerGrade && (
        <div className="pointer-events-none absolute bottom-1.5 right-1.5">
          <StampSeal
            username={rec.ownerUsername}
            grade={rec.ownerGrade}
            size="sm"
            rank={rec.ownerRank}
          />
        </div>
      )}
      {opening && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200">
          Opening…
        </div>
      )}
    </div>
  );

  /* ───────────────────────────── GRID ───────────────────────────── */
  if (variant === "grid") {
    return (
      <div className="group flex flex-col gap-2">
        <Link
          href={href}
          onClick={openThenGo}
          aria-label={`Open ${rec.title}`}
          className="relative block aspect-[2/3] w-full transition hover:opacity-95"
        >
          {Cover}
        </Link>

        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white" title={rec.title}>
            {rec.title}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            {mediaLabel(rec.mediaType)}
            {rec.retiredAt ? " · retired" : ""}
          </p>
          {rec.blurb && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{rec.blurb}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {Thumbs}
          {canRetire && (
            <button
              type="button"
              onClick={retire}
              disabled={retiring}
              title="Retire this recommendation (its votes still count)"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> {retiring ? "…" : "Retire"}
            </button>
          )}
        </div>

        {VoteNote}
      </div>
    );
  }

  /* ───────────────────────────── FEED ───────────────────────────── */
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#0b0b11] p-3 transition hover:border-white/20 sm:gap-4 sm:p-4">
      <Link
        href={href}
        onClick={openThenGo}
        aria-label={`Open ${rec.title}`}
        className="relative block aspect-[2/3] w-24 shrink-0 sm:w-28"
      >
        {Cover}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        {showOwner && (
          <Link
            href={`/user/${encodeURIComponent(rec.ownerUsername)}`}
            className="mb-1.5 flex min-w-0 items-center gap-2 text-slate-400 transition hover:text-white"
          >
            {rec.ownerAvatar ? (
              <img
                src={rec.ownerAvatar}
                alt=""
                loading="lazy"
                className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/15"
              />
            ) : (
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-700 text-[9px] font-black text-white">
                {(rec.ownerUsername || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 truncate text-[11px] font-black">{rec.ownerUsername}</span>
            {rec.ownerGrade && (
              <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] text-amber-300">
                {rec.ownerGrade}
              </span>
            )}
            <span className="shrink-0 text-[10px] text-slate-600">· {stampAgo(rec.createdAt)}</span>
          </Link>
        )}

        <Link
          href={href}
          onClick={openThenGo}
          className="min-w-0 text-sm font-black leading-snug text-white transition hover:text-violet-200"
        >
          <span className="line-clamp-2 break-words">{rec.title}</span>
        </Link>

        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          {mediaLabel(rec.mediaType)}
          {!showOwner ? ` · ${stampAgo(rec.createdAt)}` : ""}
          {rec.retiredAt ? " · retired" : ""}
        </p>

        {rec.blurb && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{rec.blurb}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {Thumbs}
          <span
            className={`text-[10px] font-black tabular-nums ${
              score > 0 ? "text-emerald-400/80" : score < 0 ? "text-rose-400/80" : "text-slate-600"
            }`}
          >
            {score > 0 ? `+${score}` : score}
          </span>
          {VoteNote}
          <Link
            href={href}
            onClick={openThenGo}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:border-violet-400/40 hover:text-violet-200"
          >
            Read <ArrowUpRight className="h-3 w-3" />
          </Link>
          {canRetire && (
            <button
              type="button"
              onClick={retire}
              disabled={retiring}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> {retiring ? "…" : "Retire"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
