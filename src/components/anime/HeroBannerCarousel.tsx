"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Anime } from "@tutkli/jikan-ts";
import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { motion, AnimatePresence } from "framer-motion";
import { usePreferences } from "@/hooks/usePreferences";

interface Props {
  animes: Anime[];
}

/**
 * THE FEATURED DECK — a hand of poster cards fanned across the screen, the
 * current show upright in the middle, everything else tilted behind it.
 *
 * The old hero was one full-bleed image with text on the left. This one is
 * built around MOTION THROUGH THE LIST: the mouse wheel deals the next card,
 * a drag flicks through them, clicking a tilted card pulls it to the centre.
 * The deck never remounts — each card owns one poster and slides to its new
 * seat, so stepping through shows reads as one continuous shuffle instead of
 * a slideshow of separate images.
 *
 * Everything animates transform + opacity only. The per-card dimming is a
 * black overlay fading in, NOT a brightness() filter, so no card ever leaves
 * the GPU compositor.
 */

/** One accent per deck seat — the show's colour identity, cycled by index. */
const ACCENTS = ["#38bdf8", "#fbbf24", "#c084fc", "#34d399", "#f43f5e", "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9", "#facc15"];

export default function HeroBannerCarousel({ animes }: Props) {
  const [current, setCurrent] = useState(0);
  const { openAnime } = useAnimeModal();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();
  const reduce = prefsLoaded && preferences.reducedMotion;

  const deck = useMemo(() => (animes || []).slice(0, 10), [animes]);
  const len = deck.length;

  const containerRef = useRef<HTMLDivElement>(null);
  // One gesture, one card: deltas ACCUMULATE toward a step and a >160ms gap
  // starts a new gesture. A flat cooldown couldn't do this — a trackpad's
  // inertia tail keeps emitting for over a second and stepped 2-3 seats
  // per physical flick.
  const gesture = useRef({ acc: 0, at: 0, stepped: false });
  const dragging = useRef(false);
  // True from the first dragged pixel until just AFTER the browser's click
  // dispatch — the native click from a flick otherwise lands on a card
  // button and opens the modal / re-centres against the throw.
  const justDragged = useRef(false);

  // Seat spacing tracks the breakpoint LIVE — reading window.innerWidth at
  // render time would freeze the fan's spread at whatever width mounted it.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const step = (dir: number) => setCurrent((c) => (c + dir + len) % len);

  /**
   * Native wheel listener, because it must NOT be passive: the whole point is
   * that the wheel drives the deck while the pointer is over the hero, and a
   * passive listener (which React's root-attached onWheel effectively is)
   * cannot preventDefault the page scroll underneath.
   *
   * Two gates keep the capture honest:
   *  · VISIBILITY — the deck only owns the wheel while the hero is actually
   *    on screen. Without this, wheeling back UP the page dead-locked the
   *    moment the hero's bottom edge slid under the cursor: the circular
   *    deck has no last card, so the page could never reach the top again.
   *  · WHOLE gesture — once we capture, we capture every event of the
   *    sequence including the sub-threshold ramp-up. Chrome latches a wheel
   *    sequence's cancelability off its FIRST event, so letting small
   *    deltas through both leaked page scroll under the hero and could
   *    latch the whole gesture uncancellable.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || len <= 1) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const r = el.getBoundingClientRect();
      // Mostly scrolled past → the page owns the wheel again.
      if (r.top < -r.height * 0.25) return;
      // Scrolling up while the hero isn't fully back in view → let the page
      // restore it first; the deck takes over once the top edge is flush.
      if (d < 0 && r.top < -2) return;
      e.preventDefault();
      const g = gesture.current;
      const now = performance.now();
      if (now - g.at > 160) { g.acc = 0; g.stepped = false; }
      g.at = now;
      if (g.stepped) return; // this gesture already dealt its card
      g.acc += d;
      if (Math.abs(g.acc) >= 100) {
        g.stepped = true;
        // direction captured NOW — the updater runs later, after acc resets
        const dir = g.acc > 0 ? 1 : -1;
        g.acc = 0;
        setCurrent((c) => (c + dir + len) % len);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [len]);

  // The deck deals itself every few seconds until the user touches it —
  // any manual change lands on `current` and restarts this timer anyway.
  // A skipped tick (hidden tab, held drag) RE-ARMS instead of dying:
  // a one-shot timer that swallowed its skip never fired again, so one
  // tab-away permanently stopped the auto-advance.
  useEffect(() => {
    if (len <= 1 || reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(() => {
        if (!dragging.current && !document.hidden) step(1);
        else arm();
      }, 8000);
    };
    arm();
    return () => clearTimeout(t);
  }, [current, len, reduce]);

  if (!len) return null;

  const hero = deck[current];
  const accent = ACCENTS[current % ACCENTS.length];
  const title = (hero.title_english || hero.title || "") as string;
  const words = title.split(" ");
  const lastWord = words.length > 1 ? words.pop() : null;
  // Long light-novel titles scale DOWN instead of wrapping into a wall —
  // a 100-character title at text-6xl stacked four huge lines and shoved
  // the buttons off the stage.
  const titleCls = title.length > 70
    ? "text-xl sm:text-2xl md:text-3xl"
    : title.length > 40
      ? "text-3xl sm:text-4xl md:text-5xl"
      : "text-4xl sm:text-5xl md:text-6xl";
  // The ghost is a WATERMARK, not a second title — ghosting the whole of a
  // long title painted serif clean across the hero. Only the tail haunts.
  const tail = title.split(" ").slice(-2).join(" ");
  const ghostText = tail.length > 24 ? title.split(" ").slice(-1)[0] : tail;
  const bgImg = (hero.trailer?.images?.maximum_image_url ||
    hero.images?.jpg?.large_image_url ||
    hero.images?.jpg?.image_url ||
    "") as string;
  const genres = (hero.genres || []).slice(0, 3).map((g: any) => g.name);
  const nn = String(current + 1).padStart(2, "0");

  /** Signed circular distance from a given centre, in [-len/2, len/2). */
  const seatFrom = (centre: number, i: number) => {
    let d = (i - centre) % len;
    if (d > len / 2) d -= len;
    if (d < -len / 2) d += len;
    return d;
  };
  const seatOf = (i: number) => seatFrom(current, i);

  // The previous centre, for wrap detection. Every step moves every card
  // exactly one seat — EXCEPT the one that wraps around the back, whose
  // seat jumps the full width. Animating that jump slid the card the long
  // way across the visible fan; a wrapped card teleports instead (it's at
  // the dim outer flank both sides of the jump, so the swap reads clean).
  const prevCentre = useRef(current);
  useEffect(() => { prevCentre.current = current; }, [current]);

  return (
    <div
      ref={containerRef}
      className="relative mb-10 w-full select-none overflow-hidden bg-[#09090b]"
      style={{ height: "min(78vh, 860px)", minHeight: 560 }}
    >
      {/* ── the show's art, washing the whole stage ── */}
      <AnimatePresence initial={false}>
        {/* short exit + short zoom keep at most ~2 of these viewport-sized
            layers alive during fast wheel-stepping — a 6s tween held every
            outgoing background promoted long after its crossfade ended */}
        <motion.img
          key={`bg-${current}`}
          src={bgImg}
          alt=""
          initial={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
          animate={{ opacity: 0.5, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.5, ease: "easeInOut" }, scale: { duration: 2.2, ease: "easeOut" } }}
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#09090b] via-[#09090b]/45 to-[#09090b]/70" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(5,5,8,0.72),transparent_75%)]" />

      {/* ── ghost of the title, drifting behind the deck ── */}
      <AnimatePresence initial={false}>
        <motion.span
          key={`ghost-${current}`}
          aria-hidden
          initial={{ opacity: 0, x: reduce ? 0 : 60 }}
          // the 0.16 lives in ANIMATE, not style — an animated opacity
          // overrides the style one, so a style-side 0.16 rendered the
          // "ghost" at full saturation
          animate={{ opacity: 0.16, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute right-[-2%] top-[32%] z-[2] hidden whitespace-nowrap font-fell text-7xl italic md:block lg:text-8xl"
          style={{ color: accent }}
        >
          {ghostText}
        </motion.span>
      </AnimatePresence>

      {/* ── giant seat number, bottom right ── */}
      <AnimatePresence initial={false}>
        <motion.span
          key={`nn-${current}`}
          aria-hidden
          initial={{ opacity: 0, y: reduce ? 0 : 26 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -18 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute bottom-[-1.5rem] right-3 z-[2] font-fell text-[7.5rem] leading-none text-white/[0.08] md:text-[10rem]"
        >
          {nn}
        </motion.span>
      </AnimatePresence>

      {/* ── the counters ── */}
      <div className="absolute left-5 top-5 z-20 flex items-center gap-3 md:left-8 md:top-7">
        <span aria-hidden className="h-px w-8" style={{ background: accent }} />
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: accent }}>
          Featured / {nn}
        </span>
      </div>
      <div className="absolute right-5 top-5 z-20 font-mono text-[10px] font-black uppercase tracking-[0.32em] text-slate-500 md:right-8 md:top-7">
        {len} Total
      </div>

      {/* ── stage ── */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 pt-6 md:gap-6">

        {/* THE DECK. A single drag surface; each card slides to the seat its
            circular distance from `current` assigns it. Cards more than three
            seats out fade away but keep their poster decoded, so any jump —
            wheel, drag or a click across the fan — arrives already painted. */}
        <motion.div
          className="relative flex h-[240px] w-full max-w-5xl items-center justify-center md:h-[340px]"
          style={{ touchAction: "pan-y" }}
          drag={len > 1 && !reduce ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.14}
          dragMomentum={false}
          onDragStart={() => { dragging.current = true; justDragged.current = true; }}
          onDragEnd={(_, info) => {
            dragging.current = false;
            const throwX = info.offset.x + info.velocity.x * 0.18;
            if (throwX < -70) step(1);
            else if (throwX > 70) step(-1);
            // cleared a beat AFTER the browser's click dispatch, whichever
            // side of onDragEnd that click lands on
            setTimeout(() => { justDragged.current = false; }, 120);
          }}
        >
          {deck.map((a, i) => {
            const seat = seatOf(i);
            const abs = Math.abs(seat);
            // A card whose seat moved more than one step wrapped around the
            // back of the wheel — snap it, never slide it across the fan.
            const wrapped = Math.abs(seat - seatFrom(prevCentre.current, i)) > 1;
            const poster = (a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "") as string;
            const centre = seat === 0;
            return (
              <motion.div
                key={a.mal_id ?? i}
                className="absolute"
                animate={{
                  x: seat * (compact ? 52 : 92),
                  y: abs * 7,
                  rotate: seat * 8.5,
                  scale: centre ? 1 : Math.max(0.82, 0.94 - abs * 0.04),
                  opacity: abs > 3 ? 0 : 1,
                }}
                transition={reduce || wrapped
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
                style={{ zIndex: 50 - abs, willChange: "transform, opacity", pointerEvents: abs > 3 ? "none" : "auto" }}
              >
                <button
                  onClick={() => {
                    // A flick's native click still lands on whichever card
                    // the pointer went down on — that's the drag, not a tap.
                    if (dragging.current || justDragged.current) return;
                    if (!centre) setCurrent(i); else openAnime(a);
                  }}
                  aria-label={centre ? `Open ${title}` : `Feature ${(a.title_english || a.title) as string}`}
                  className="relative block h-[210px] w-[140px] overflow-hidden rounded-xl md:h-[300px] md:w-[200px]"
                  style={{
                    boxShadow: centre
                      ? `0 0 0 1px ${accent}66, 0 24px 60px rgba(0,0,0,.75), 0 0 44px ${accent}33`
                      : "0 0 0 1px rgba(255,255,255,.10), 0 18px 44px rgba(0,0,0,.6)",
                  }}
                >
                  <img
                    src={poster}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                  {/* dimming veil — cheaper than a brightness filter, and it
                      animates on the compositor like everything else */}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-black transition-opacity duration-500"
                    style={{ opacity: centre ? 0 : Math.min(0.62, 0.24 + abs * 0.14) }}
                  />
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── the words. A REAL crossfade: old and new copy share one grid
            cell, so the incoming text fades over the outgoing one. mode="wait"
            serialised exit-then-enter, and under sustained wheeling (a step
            every ~620ms vs a 0.8s swap) the copy never finished appearing —
            the deck slid in real time while the title stayed blank. ── */}
        <div className="grid w-full justify-items-center">
          <AnimatePresence initial={false}>
            <motion.div
              key={`copy-${current}`}
              initial={{ opacity: 0, y: reduce ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -10, transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center px-4"
              style={{ gridArea: "1 / 1" }}
            >
            {/* meta strip */}
            <div className="mb-4 flex items-stretch divide-x divide-white/10 overflow-hidden rounded-sm border border-white/10 bg-black/30 font-mono text-[9px] font-black uppercase tracking-[0.18em]">
              <span className="px-2.5 py-1" style={{ color: accent, boxShadow: `inset 0 0 0 1px ${accent}44` }}>
                • {hero.type || "TV"}
              </span>
              {hero.score ? (
                <span className="px-2.5 py-1 text-slate-300">Score — {Math.round((hero.score as number) * 10)}%</span>
              ) : null}
              {hero.episodes ? <span className="px-2.5 py-1 text-slate-300">{hero.episodes} EP</span> : null}
              {hero.year ? <span className="px-2.5 py-1 text-slate-300">{hero.year}</span> : null}
            </div>

            <h1 className={`max-w-4xl text-center font-fell leading-[1.04] text-white drop-shadow-2xl ${titleCls}`}>
              {words.join(" ")}
              {lastWord && (
                <>
                  {" "}
                  <em className="italic" style={{ color: accent }}>{lastWord}</em>
                </>
              )}
            </h1>

            {genres.length > 0 && (
              <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">
                {genres.join("  —  ")}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => openAnime(hero, { autoPlay: true })}
                className="flex items-center gap-2 rounded-sm border px-5 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.24em] transition hover:bg-white/5"
                style={{ borderColor: `${accent}88`, color: accent }}
              >
                <Play className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                Watch Now
                <ArrowUpRight className="h-3 w-3" />
              </button>
              <Link
                href="/explore"
                className="flex items-center gap-2 rounded-sm border border-white/15 px-5 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/5"
              >
                Browse Catalogue
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
