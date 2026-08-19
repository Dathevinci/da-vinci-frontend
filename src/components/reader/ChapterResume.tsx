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
 * One hook and one bar, shared by the manhwa and novel readers. It does not
 * assume WHAT scrolls — see metricsOf below; that assumption was bug three.
 *
 * ── Three bugs this is written around ──────────────────────────────────────
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

/**
 * WHICHEVER THING IS ACTUALLY SCROLLING.
 *
 * The first version assumed the window. That holds for the default vertical
 * reader, but these readers also have a one-page mode and a horizontal mode,
 * and a chapter can be laid out inside its own scrolling box — in which case
 * window.scrollY never moves, no listener ever fires, and nothing is saved.
 * Rather than guess which layout a reader is in, metrics are read off whatever
 * element the browser says produced the scroll.
 */
type Metrics = { y: number; vh: number; scrollable: number };

/** Position and size of a scroll event target, whatever kind it is. */
function metricsOf(target: EventTarget | null): Metrics {
  const doc = typeof document === "undefined" ? null : document;
  if (!doc || !target || target === doc || target === window || target === doc.documentElement) {
    return {
      y: window.scrollY,
      vh: window.innerHeight || 1,
      scrollable: Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
    };
  }
  const el = target as HTMLElement;
  if (typeof el.scrollTop !== "number") {
    return { y: window.scrollY, vh: window.innerHeight || 1, scrollable: 1 };
  }
  return {
    y: el.scrollTop,
    vh: el.clientHeight || 1,
    scrollable: Math.max(1, el.scrollHeight - el.clientHeight),
  };
}

const pctOf = (m: Metrics) => m.y / m.scrollable;

/** Past the first screen, and not already at the end. */
const worthKeepingIn = (m: Metrics) =>
  m.y > m.vh * ARM_SCREENS && m.scrollable - m.y > m.vh * END_SCREENS;

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
  /** The element the browser last reported scrolling — window until then. */
  const scrollerRef = useRef<EventTarget | null>(null);
  /**
   * The last position that was worth keeping, remembered as it happened.
   *
   * WHY THIS EXISTS: flush used to MEASURE at flush time. That is fine for
   * pagehide, where the document is still standing, but on unmount — leaving
   * the chapter through the app rather than closing the tab — the scroll
   * container is already being torn down. Measuring it returns zero, zero is
   * not worth keeping, and the else branch then DELETED the point. Which is
   * exactly the reported symptom: it only survived if you closed the whole tab.
   */
  const lastGoodRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    const { seriesId: s, chapterId: c } = idsRef.current;
    if (!armedRef.current || !s || !c) return;
    const pct = lastGoodRef.current;
    // Only ever WRITE here. Teardown is not evidence that a reader finished a
    // chapter, so it must never be a reason to throw their place away.
    if (pct !== null) saveResume(kind, s, c, pct);
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

    /**
     * MEASURE AT MOST ONCE A FRAME.
     *
     * metricsOf reads scrollHeight/clientHeight, which forces the browser to
     * lay out. Doing that inside the scroll event itself meant a forced layout
     * per event, on the longest documents in the app — a reader scrolling a
     * 60-image chapter paid for it continuously. The event now only records
     * its target and asks for a frame; all reading happens inside that frame.
     */
    let pendingTarget: EventTarget | null = null;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const target = pendingTarget;
      pendingTarget = null;
      const m = metricsOf(target);
      // A box that cannot scroll is not the reader — ignore it, so a stray
      // inner container never becomes the remembered scroller.
      if (m.scrollable <= 1) return;
      scrollerRef.current = target;

      if (!armedRef.current) {
        // Arm only once real reading has happened — measured in SCREENS, so a
        // 60-image chapter arms at the same felt distance as a short one.
        // Until armed, the stored point is untouched: opening a chapter and
        // sitting at the top can never erase what it is about to offer.
        if (!worthKeepingIn(m)) return;
        armedRef.current = true;
      }

      // Remembered every frame, written rarely. flush() needs a value it can
      // trust after the DOM is gone; localStorage does not need one per frame.
      if (worthKeepingIn(m)) lastGoodRef.current = pctOf(m);

      const now = Date.now();
      if (now - lastSaveRef.current < SAVE_EVERY_MS) return;
      lastSaveRef.current = now;
      if (worthKeepingIn(m)) saveResume(kind, seriesId, chapterId, pctOf(m));
      else clearResume(kind, seriesId, chapterId);
    };

    const onScroll = (ev: Event) => {
      pendingTarget = ev.target;
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    /* pagehide fires where unload does not (bfcache, iOS Safari), and
       visibilitychange covers switching apps on a phone — which is exactly the
       "closed it midway" case this feature exists for. */
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };

    /* CAPTURE, on document. Scroll events do NOT bubble, so a listener bound to
       window hears the page scrolling and nothing else — which is how this
       feature came to save nothing for a chapter that scrolls inside its own
       container. Capture hears both, with one listener and no DOM walking. */
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (frame) window.cancelAnimationFrame(frame);
      flush(); // leaving the chapter counts as closing it
    };
  }, [ready, kind, seriesId, chapterId, flush]);

  /** Jump to the stored point, correcting as the page finishes growing. */
  const resume = useCallback(() => {
    const point = offer;
    setOffer(null);
    if (!point) return;
    armedRef.current = true;

    /* Restore into the same thing that was scrolling. Nothing has scrolled yet
       on a fresh open, so this falls back to the window — right for the default
       vertical reader, and corrected on the first real scroll for any other. */
    const target = scrollerRef.current;
    const isWindow =
      !target || target === document || target === window || target === document.documentElement;
    const el = isWindow ? null : (target as HTMLElement);

    /** Where the last correction put them, so a move BY the reader is
     *  distinguishable from the page growing underneath them. */
    let placedAt = 0;

    const go = () => {
      const m = metricsOf(target);
      const top = point.pct * m.scrollable;
      if (el) el.scrollTop = top;
      else window.scrollTo({ top, behavior: "auto" });
      placedAt = top;
    };
    go();

    /**
     * THE SETTLE LOOP, WHICH USED TO FIGHT THE READER.
     *
     * It re-applied whenever the position drifted more than 40px from target —
     * but scrolling away IS drift, so the moment anyone moved, it dragged them
     * back, every 180ms, for two and a half seconds. That is the reported lag
     * after pressing Continue, and it is the opposite of what its own comment
     * promised.
     *
     * Correcting is now only for the page GROWING: it re-applies when the
     * reader is still where we put them and the target has moved because more
     * images landed. Any touch, wheel or key ends it immediately — they have
     * taken over, and nothing should pull against that.
     */
    const started = Date.now();
    let timer = 0;
    const stop = () => {
      if (timer) { window.clearInterval(timer); timer = 0; }
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });

    timer = window.setInterval(() => {
      if (Date.now() - started >= SETTLE_MS) { stop(); return; }
      const m = metricsOf(target);
      // Moved by the READER — hands off for good.
      if (Math.abs(m.y - placedAt) > 60) { stop(); return; }
      // Still where we left them, but the target has shifted because the
      // document grew. That is ours to correct.
      const want = point.pct * m.scrollable;
      if (Math.abs(want - m.y) > 40) go();
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
