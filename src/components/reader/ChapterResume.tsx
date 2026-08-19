"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import {
  agoLabel,
  clearResume,
  pruneResumes,
  readResume,
  saveResume,
  type ResumePoint,
} from "@/lib/chapterResume";
import type { ReadingKind } from "@/lib/readingProgress";

/**
 * "Continue where you left off?" for a chapter you closed halfway.
 *
 * One hook and one bar, shared by the manhwa and novel readers — both scroll
 * the window, so neither needs its own copy of this.
 *
 * ── Two bugs this is written around ────────────────────────────────────────
 * ONE: every reader opens at the top. A naive save-on-scroll fires at the top
 * the instant the page mounts, and a position at the top must retire a saved
 * point — so it would DELETE the very thing it exists to offer. Saving is
 * therefore ARMED rather than automatic: nothing is written until this session
 * has genuinely read past the first screen, or the reader presses one of the
 * two buttons. Arriving and leaving changes nothing.
 *
 * TWO: the first version judged "worth resuming" as a PERCENTAGE, with a 4%
 * floor. That silently broke the feature on the content it matters most for.
 * A manhwa chapter is 40-80 full-width images — 50,000-100,000px — so reading
 * past the first page is about 2% of it. Every real position fell inside the
 * floor and was discarded, and nothing was ever offered. Distance is measured
 * in SCREENS now (see worthKeeping), which means the same felt distance on a
 * three-screen novel chapter and a fifty-screen manhwa one.
 *
 * ── Restoring into a page that is still growing ────────────────────────────
 * A manhwa chapter is images that load progressively, so the document is
 * SHORTER when Resume is pressed than it will be a second later, and a single
 * scrollTo lands short. The jump therefore re-applies itself while the page
 * settles, then stops — the same lesson ScrollReset learned about restoring
 * against content that has not finished arriving.
 */

/**
 * WORTH-RESUMING IS MEASURED IN SCREENS, NOT PERCENT.
 *
 * A novel chapter is a few screens; a manhwa chapter is fifty. A single
 * percentage cannot mean "past the first page" for both — at 60 images, one
 * page is ~2%, which the first version discarded as noise and so saved
 * nothing at all for exactly the readers this is for.
 *
 * ARM_SCREENS: how far past the top counts as real reading.
 * END_SCREENS:  how close to the bottom counts as finished, where the useful
 *               action is the next chapter rather than a jump to this one's
 *               last screen.
 */
const ARM_SCREENS = 1.1;
const END_SCREENS = 1.2;

const SAVE_EVERY_MS = 700;
/** How long the restore keeps correcting itself while images land. */
const SETTLE_MS = 2600;
const SETTLE_TICK_MS = 180;
/** The offer withdraws itself; staying put IS "start fresh". */
const OFFER_TIMEOUT_MS = 15000;

const scrollableHeight = () =>
  Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

const currentPct = () => window.scrollY / scrollableHeight();

/** Past the first screen, and not already at the end. */
const worthKeeping = () => {
  const vh = window.innerHeight || 1;
  const y = window.scrollY;
  const remaining = scrollableHeight() - y;
  return y > vh * ARM_SCREENS && remaining > vh * END_SCREENS;
};

export function useChapterResume(opts: {
  kind: ReadingKind;
  seriesId: string | null | undefined;
  chapterId: string | null | undefined;
  /** False while the chapter is still loading — nothing is measurable yet. */
  ready: boolean;
}) {
  const { kind, seriesId, chapterId, ready } = opts;
  const [offer, setOffer] = useState<ResumePoint | null>(null);

  /** Saving stays off until this reader has actually read past the floor. */
  const armedRef = useRef(false);
  const lastSaveRef = useRef(0);
  const idsRef = useRef({ seriesId, chapterId });
  idsRef.current = { seriesId, chapterId };

  const flush = useCallback(() => {
    const { seriesId: s, chapterId: c } = idsRef.current;
    if (!armedRef.current || !s || !c) return;
    if (worthKeeping()) saveResume(kind, s, c, currentPct());
    else clearResume(kind, s, c);
  }, [kind]);

  /* Offer the stored point once, when the chapter is actually measurable. */
  useEffect(() => {
    if (!ready || !seriesId || !chapterId) return;
    pruneResumes();
    setOffer(readResume(kind, seriesId, chapterId));
    armedRef.current = false;
  }, [ready, kind, seriesId, chapterId]);

  /* Save while reading — throttled, and flushed hard when the tab goes away. */
  useEffect(() => {
    if (!ready || !seriesId || !chapterId) return;

    const onScroll = () => {
      if (!armedRef.current) {
        // Arm only once real reading has happened — measured in SCREENS, so a
        // 60-image chapter arms at the same felt distance as a short one.
        // Until armed, the stored point is untouched: opening a chapter and
        // sitting at the top can never erase what it is about to offer.
        if (!worthKeeping()) return;
        armedRef.current = true;
      }
      const now = Date.now();
      if (now - lastSaveRef.current < SAVE_EVERY_MS) return;
      lastSaveRef.current = now;
      if (worthKeeping()) saveResume(kind, seriesId, chapterId, currentPct());
      else clearResume(kind, seriesId, chapterId);
    };

    /* pagehide fires where unload does not (bfcache, iOS Safari), and
       visibilitychange covers switching apps on a phone — which is exactly the
       "closed it midway" case this feature exists for. */
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush(); // leaving the chapter counts as closing it
    };
  }, [ready, kind, seriesId, chapterId, flush]);

  /** Jump to the stored point, correcting as the page finishes growing. */
  const resume = useCallback(() => {
    const point = offer;
    setOffer(null);
    if (!point) return;
    armedRef.current = true;

    const go = () => window.scrollTo({ top: point.pct * scrollableHeight(), behavior: "auto" });
    go();

    const started = Date.now();
    const timer = window.setInterval(() => {
      const want = point.pct * scrollableHeight();
      // Only correct a drift worth correcting, and never fight the reader:
      // once they have scrolled away from the landing spot, stop.
      if (Math.abs(window.scrollY - want) > 40 && Date.now() - started < SETTLE_MS) go();
      if (Date.now() - started >= SETTLE_MS) window.clearInterval(timer);
    }, SETTLE_TICK_MS);
  }, [offer]);

  /** Start fresh: forget the point so it is not offered again next time. */
  const startFresh = useCallback(() => {
    setOffer(null);
    armedRef.current = true;
    if (seriesId && chapterId) clearResume(kind, seriesId, chapterId);
  }, [kind, seriesId, chapterId]);

  return { offer, resume, startFresh };
}

export function ResumeBar({
  offer,
  onResume,
  onStartFresh,
}: {
  offer: ResumePoint | null;
  onResume: () => void;
  onStartFresh: () => void;
}) {
  const [gone, setGone] = useState(false);

  /* Withdraw the offer on its own. The reader is already at the top, so an
     ignored prompt has effectively chosen "start fresh" — but the stored point
     is NOT deleted here, because ignoring a bar is not the same as saying no. */
  useEffect(() => {
    if (!offer) return;
    setGone(false);
    const t = window.setTimeout(() => setGone(true), OFFER_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [offer]);

  if (!offer || gone) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4 sm:bottom-8"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-violet-400/30 bg-[#0b0912]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,.65)] backdrop-blur-md">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
          <BookOpen className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">
            Continue from {Math.round(offer.pct * 100)}%?
          </span>
          <span className="block text-[11px] text-slate-400">
            You stopped here {agoLabel(offer.at)}
          </span>
        </span>

        <button
          type="button"
          onClick={onResume}
          className="shrink-0 rounded-xl bg-violet-500 px-3.5 py-2 text-xs font-black text-white transition hover:bg-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onStartFresh}
          aria-label="Start from the beginning"
          title="Start from the beginning"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
