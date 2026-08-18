"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Stamp, X, Check, Trash2, BookOpen, LogIn } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import {
  StampMediaType,
  StampProfile,
  StampRec,
  BLURB_MAX,
  createRec,
  fetchStamp,
  hasStampSession,
  recCoverSrc,
  retireRec,
  mediaLabel,
} from "@/lib/stamps";

/**
 * "STAMP THIS" — the recommendation action, on a series' own page.
 *
 * A stamp has exactly three ACTIVE slots, and that limit is the feature: three
 * things you are willing to put your name on. So the full case is not an error
 * toast — the sheet shows the three you already carry and lets you retire one
 * on the spot, then stamps the new title into the freed slot.
 *
 * Retiring is not deleting. The retired rec's thumbs stay in the earned score
 * for good, which the sheet says out loud before anyone reaches for it: a bad
 * call you can quietly remove is a bad call that never cost anything.
 *
 * The refusal is the server's, not a count kept here. This sheet reads the
 * stamp when it opens so it can show the slots, but it never decides on its own
 * that there is room — it asks, and handles being told no.
 *
 * AND THERE ARE FOUR DIFFERENT NOs, all of them 409. Only SLOTS_FULL is fixed
 * by retiring something; branching on the bare status told a member with a free
 * slot who re-stamped a title that their slots were full and pushed them into
 * deleting a good recommendation to make room they already had. Each code now
 * gets the answer that is actually true for it.
 */

type Props = {
  mediaType: StampMediaType;
  mediaId: string;
  title: string;
  cover: string | null;
  className?: string;
};

export default function StampThis({ mediaType, mediaId, title, cover, className = "" }: Props) {
  const { user } = useUser();
  const { toast } = useToast();
  /** The primitive, so the effects key on the identity rather than on a
   *  cached-user object that can be rebuilt without having changed. */
  const userId = user?.id || null;

  const [open, setOpen] = useState(false);
  const [stamp, setStamp] = useState<StampProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [blurb, setBlurb] = useState("");
  const [saving, setSaving] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  /** Set when the server answered SLOTS_FULL — the slots are full, from its
   *  mouth. NOT set by any other 409: the other three are not fixed by
   *  retiring, so switching to the retire view would be bad advice. */
  const [full, setFull] = useState(false);
  /**
   * Signed in by the cached user, with no session token. Stamping and retiring
   * are token-only, so this sheet says so instead of collecting a 401 after
   * someone has written a blurb. Resolved in an effect: localStorage cannot be
   * read during render without the two paints disagreeing.
   */
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    setNeedsSignIn(!!userId && !hasStampSession());
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Own stamp, own recs — the viewer fallback is what gets a tokenless
      // session its own myVote/opened back on them.
      const s = await fetchStamp(userId, userId);
      setStamp(s);
      setFull(s.recs.filter((r) => !r.retiredAt).length >= 3);
    } catch {
      // Couldn't read the stamp — don't block the action. Stamping will still
      // work, and a 409 will tell us the truth if the slots really are full.
      setStamp(null);
      setFull(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Signed out there is nothing to stamp with, and the whole site is
  // signed-in anyway — no dead button.
  if (!user) return null;

  const active: StampRec[] = (stamp?.recs || []).filter((r) => !r.retiredAt);
  const mine = active.find((r) => r.mediaId === mediaId && r.mediaType === mediaType) || null;
  const slotsLeft = Math.max(0, 3 - active.length);

  const submit = async () => {
    setSaving(true);
    const res = await createRec({
      userId: user.id,
      mediaType,
      mediaId,
      title,
      cover,
      blurb: blurb.trim(),
    });
    setSaving(false);

    if (!res.ok) {
      switch (res.code) {
        case "SLOTS_FULL":
          // THE ONLY 409 RETIRING FIXES. Switch the sheet to the retire view
          // instead of dropping a toast the reader can do nothing with.
          setFull(true);
          await load();
          toast("All three stamp slots are full — retire one to make room.", "info");
          return;
        case "ALREADY_STAMPED":
        case "PREVIOUSLY_STAMPED":
          // A duplicate. There is room (or there isn't, but that is not what
          // stopped this) — say exactly what the server said and re-read, so
          // the sheet flips to the "this is one of your three" view on its own.
          await load();
          toast(res.message, "info");
          return;
        case "SLOT_TAKEN":
          // A race with the member's own other tab. Retrying genuinely works.
          await load();
          toast("A slot was filled a moment ago — try that again.", "info");
          return;
        case "AUTH_REQUIRED":
          setNeedsSignIn(true);
          toast("Your session expired — sign in again to stamp.", "error");
          return;
        default:
          toast(res.message, "error");
          return;
      }
    }

    toast(`Stamped — ${title} now carries your seal.`, "success");
    setBlurb("");
    setOpen(false);
    load();
  };

  const retire = async (recId: string) => {
    setRetiringId(recId);
    const res = await retireRec(recId, user.id);
    setRetiringId(null);
    if (!res.ok) {
      if (res.code === "AUTH_REQUIRED") setNeedsSignIn(true);
      toast(res.message, "error");
      return;
    }
    setFull(false);
    await load();
    toast("Retired — the slot is free, and its votes still count.", "info");
  };

  const previewCover = recCoverSrc(mediaType, cover);
  const blockedByFull = full && !mine;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={mine ? "You've stamped this" : "Recommend this with your stamp"}
        className={`flex items-center gap-2.5 rounded-xl border px-5 py-3 font-mono text-sm font-black transition ${
          mine
            ? "border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
            : "border-white/15 bg-white/[0.06] text-slate-200 hover:border-amber-400/40 hover:text-amber-200"
        } ${className}`}
      >
        <Stamp className="h-4 w-4" />
        {mine ? "Stamped" : "Stamp this"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center font-mono sm:items-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Stamp this title"
            className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl"
          >
            {/* ── header ── */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-black text-white">
                  <Stamp className="h-4 w-4 text-amber-300" />
                  {mine ? "Your stamp is on this" : "Put your stamp on it"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {stamp ? `Grade ${stamp.grade} · ` : ""}
                  {active.length}/3 slots used
                  {slotsLeft > 0 && !mine ? ` · ${slotsLeft} free` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* ── what is being stamped ── */}
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
                {previewCover ? (
                  <img
                    src={previewCover}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-20 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <span className="grid h-20 w-14 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#101018]">
                    <BookOpen className="h-5 w-5 text-slate-700" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                    {mediaLabel(mediaType)}
                  </p>
                </div>
              </div>

              {loading ? (
                <p className="py-16 text-center text-xs text-slate-500">Reading your stamp…</p>
              ) : needsSignIn ? (
                /* ── NO SESSION TOKEN ── stamping is token-only now, so this is
                     said before a blurb gets written, not after a 401 ── */
                <div className="px-4 py-8 text-center">
                  <Stamp className="mx-auto h-7 w-7 text-slate-700" />
                  <p className="mt-3 text-sm font-black text-white">Sign in again to stamp.</p>
                  <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-slate-500">
                    Your session is from before stamps existed, so it can&rsquo;t put your name
                    on anything. Signing in again restores it — your grade, your recs and every
                    vote already cast on them are untouched.
                  </p>
                  <Link
                    href="/login"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-500/25"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Sign in again
                  </Link>
                </div>
              ) : mine ? (
                /* ── ALREADY STAMPED ── */
                <div className="px-4 py-6">
                  <p className="flex items-center gap-2 text-sm font-black text-amber-200">
                    <Check className="h-4 w-4" /> This is one of your three.
                  </p>
                  {mine.blurb && (
                    <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                      &ldquo;{mine.blurb}&rdquo;
                    </p>
                  )}
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    It has {mine.up} up and {mine.down} down so far. Retiring frees the slot
                    but keeps that verdict on your stamp — a call that went badly cannot be
                    undone by removing it.
                  </p>
                  <button
                    type="button"
                    onClick={() => retire(mine.id)}
                    disabled={retiringId === mine.id}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {retiringId === mine.id ? "Retiring…" : "Retire this recommendation"}
                  </button>
                </div>
              ) : blockedByFull ? (
                /* ── FULL: retire one, right here ── */
                <div className="px-4 py-4">
                  <p className="text-sm font-black text-white">All three slots are taken.</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    A stamp carries three recommendations at a time. Retire one to make room —
                    the votes it earned stay on your score either way.
                  </p>

                  <div className="mt-4 space-y-2">
                    {active.map((r) => {
                      const c = recCoverSrc(r.mediaType, r.cover);
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2"
                        >
                          {c ? (
                            <img
                              src={c}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="h-14 w-10 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <span className="h-14 w-10 shrink-0 rounded-md bg-white/5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-white">{r.title}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                              {mediaLabel(r.mediaType)} · {r.up} up · {r.down} down
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => retire(r.id)}
                            disabled={retiringId === r.id}
                            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                          >
                            {retiringId === r.id ? "…" : "Retire"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── ROOM: write the blurb ── */
                <div className="px-4 py-4">
                  <label
                    htmlFor="stamp-blurb"
                    className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
                  >
                    Why this one?
                  </label>
                  <textarea
                    id="stamp-blurb"
                    autoFocus
                    rows={3}
                    value={blurb}
                    maxLength={BLURB_MAX}
                    onChange={(e) => setBlurb(e.target.value)}
                    placeholder="One or two lines your followers will actually read."
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-amber-400/40"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                    <span>Optional, but a bare cover convinces nobody.</span>
                    <span className="tabular-nums">
                      {blurb.length}/{BLURB_MAX}
                    </span>
                  </div>

                  <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
                    Your followers see this in their stamp feed. Their thumbs move your grade —
                    up when the call lands, down when it doesn&rsquo;t — and only from people who
                    actually opened it.
                  </p>
                </div>
              )}
            </div>

            {/* ── footer ── */}
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
              <Link
                href="/stamps"
                className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:text-violet-300"
              >
                Weekly board →
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
                >
                  Close
                </button>
                {!mine && !needsSignIn && (
                  <button
                    type="button"
                    disabled={saving || loading || blockedByFull}
                    onClick={submit}
                    className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Stamping…" : blockedByFull ? "Slots full" : "Stamp it"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
