"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * THE FEATURED DECK, generalised — the same fanned-cards hero the anime
 * home ships (HeroBannerCarousel), stripped of anime-specific data so the
 * manhwa and novel homes can deal their own covers.
 *
 * Physics are identical to the anime deck and carry all its hard-won
 * fixes: gesture-accumulated wheel with a visibility gate, drag with a
 * click guard, wrap-snap for the circular fan, CSS-stable float, copy
 * crossfading in one grid cell, auto-advance that survives hidden tabs.
 */

export type DeckItem = {
  key: string;
  title: string;
  image: string | null;
  /** short mono chips under the deck — first one gets the accent */
  chips: string[];
  onOpen?: () => void;
};

const ACCENTS = ["#38bdf8", "#fbbf24", "#c084fc", "#34d399", "#f43f5e", "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9", "#facc15"];

export default function DeckHero({
  items,
  primaryLabel,
  onPrimary,
  browseHref,
  browseLabel,
}: {
  items: DeckItem[];
  primaryLabel: string;
  onPrimary: (item: DeckItem) => void;
  browseHref: string;
  browseLabel: string;
}) {
  const [current, setCurrent] = useState(0);
  const { preferences, isLoaded: prefsLoaded } = usePreferences();
  const reduce = prefsLoaded && preferences.reducedMotion;

  const deck = items.slice(0, 10);
  const len = deck.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({ acc: 0, at: 0, stepped: false });
  const dragging = useRef(false);
  const justDragged = useRef(false);

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const step = (dir: number) => setCurrent((c) => (c + dir + len) % len);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || len <= 1) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const r = el.getBoundingClientRect();
      if (r.top < -r.height * 0.25) return;
      if (d < 0 && r.top < -2) return;
      e.preventDefault();
      const g = gesture.current;
      const now = performance.now();
      if (now - g.at > 160) { g.acc = 0; g.stepped = false; }
      g.at = now;
      if (g.stepped) return;
      g.acc += d;
      if (Math.abs(g.acc) >= 100) {
        g.stepped = true;
        const dir = g.acc > 0 ? 1 : -1;
        g.acc = 0;
        setCurrent((c) => (c + dir + len) % len);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [len]);

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
  const title = hero.title || "";
  const words = title.split(" ");
  const lastWord = words.length > 1 ? words.pop() : null;
  const titleCls = title.length > 70
    ? "text-xl sm:text-2xl md:text-3xl"
    : title.length > 40
      ? "text-3xl sm:text-4xl md:text-5xl"
      : "text-4xl sm:text-5xl md:text-6xl";
  const tail = title.split(" ").slice(-2).join(" ");
  const ghostText = tail.length > 24 ? title.split(" ").slice(-1)[0] : tail;
  const nn = String(current + 1).padStart(2, "0");

  const seatFrom = (centre: number, i: number) => {
    let d = (i - centre) % len;
    if (d > len / 2) d -= len;
    if (d < -len / 2) d += len;
    return d;
  };

  return (
    <div
      ref={containerRef}
      className="relative mb-10 w-full select-none overflow-hidden bg-[#09090b]"
      style={{ height: "min(78vh, 860px)", minHeight: 560 }}
    >
      <AnimatePresence initial={false}>
        {hero.image && (
          <motion.img
            key={`bg-${current}`}
            src={hero.image}
            alt=""
            initial={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
            animate={{ opacity: 0.5, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.5, ease: "easeInOut" }, scale: { duration: 2.2, ease: "easeOut" } }}
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#09090b] via-[#09090b]/45 to-[#09090b]/70" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(5,5,8,0.72),transparent_75%)]" />

      <AnimatePresence initial={false}>
        <motion.span
          key={`ghost-${current}`}
          aria-hidden
          initial={{ opacity: 0, x: reduce ? 0 : 60 }}
          animate={{ opacity: 0.16, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute right-[-2%] top-[32%] z-[2] hidden whitespace-nowrap font-fell text-7xl italic md:block lg:text-8xl"
          style={{ color: accent }}
        >
          {ghostText}
        </motion.span>
      </AnimatePresence>

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

      <div className="absolute left-5 top-5 z-20 flex items-center gap-3 md:left-8 md:top-7">
        <span aria-hidden className="h-px w-8" style={{ background: accent }} />
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: accent }}>
          Featured / {nn}
        </span>
      </div>
      <div className="absolute right-5 top-5 z-20 font-mono text-[10px] font-black uppercase tracking-[0.32em] text-slate-500 md:right-8 md:top-7">
        {len} Total
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 pt-6 md:gap-6">
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
            setTimeout(() => { justDragged.current = false; }, 120);
          }}
        >
          {deck.map((item, i) => {
            const seat = seatFrom(current, i);
            const abs = Math.abs(seat);
            const centre = seat === 0;
            return (
              <DeckCard
                key={item.key}
                item={item}
                seat={seat}
                abs={abs}
                centre={centre}
                compact={compact}
                reduce={reduce}
                accent={accent}
                len={len}
                current={current}
                seatFrom={seatFrom}
                onTap={() => {
                  if (dragging.current || justDragged.current) return;
                  if (!centre) setCurrent(i);
                  else item.onOpen?.();
                }}
              />
            );
          })}
        </motion.div>

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
              {hero.chips.length > 0 && (
                <div className="mb-4 flex items-stretch divide-x divide-white/10 overflow-hidden rounded-sm border border-white/10 bg-black/30 font-mono text-[9px] font-black uppercase tracking-[0.18em]">
                  {hero.chips.map((c, ci) => (
                    <span key={ci} className="px-2.5 py-1"
                      style={ci === 0 ? { color: accent, boxShadow: `inset 0 0 0 1px ${accent}44` } : { color: "#cbd5e1" }}>
                      {ci === 0 ? `• ${c}` : c}
                    </span>
                  ))}
                </div>
              )}

              <h1 className={`max-w-4xl text-center font-fell leading-[1.04] text-white drop-shadow-2xl ${titleCls}`}>
                {words.join(" ")}
                {lastWord && (
                  <>
                    {" "}
                    <em className="italic" style={{ color: accent }}>{lastWord}</em>
                  </>
                )}
              </h1>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => onPrimary(hero)}
                  className="flex items-center gap-2 rounded-sm border px-5 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.24em] transition hover:bg-white/5"
                  style={{ borderColor: `${accent}88`, color: accent }}
                >
                  <Play className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                  {primaryLabel}
                  <ArrowUpRight className="h-3 w-3" />
                </button>
                <Link
                  href={browseHref}
                  className="flex items-center gap-2 rounded-sm border border-white/15 px-5 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/5"
                >
                  {browseLabel}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        .dh-float {
          animation: dhFloat 4.2s ease-in-out infinite;
        }
        @keyframes dhFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dh-float { animation: none; }
        }
      `}</style>
    </div>
  );
}

function DeckCard({
  item, seat, abs, centre, compact, reduce, accent, len, current, seatFrom, onTap,
}: {
  item: DeckItem;
  seat: number;
  abs: number;
  centre: boolean;
  compact: boolean;
  reduce: boolean;
  accent: string;
  len: number;
  current: number;
  seatFrom: (centre: number, i: number) => number;
  onTap: () => void;
}) {
  // Wrap detection: a jump wider than half the deck means it went 
  // around the back of the wheel — snap it instantly without animating.
  const prevSeat = useRef(seat);
  const wrapped = Math.abs(seat - prevSeat.current) > len / 2;
  useEffect(() => { prevSeat.current = seat; }, [seat]);

  return (
    <motion.div
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
        : { type: "tween", duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ zIndex: 50 - abs, willChange: "transform, opacity", pointerEvents: abs > 3 ? "none" : "auto" }}
    >
      <div className={reduce ? "" : "dh-float"} style={{ animationDelay: `${(Math.abs(seat) * 3 + (seat > 0 ? 1 : 0)) * 0.45}s` }}>
        <button
          onClick={onTap}
          aria-label={centre ? `Open ${item.title}` : `Feature ${item.title}`}
          className="relative block h-[210px] w-[140px] overflow-hidden rounded-xl md:h-[300px] md:w-[200px]"
          style={{
            boxShadow: centre
              ? `0 0 0 1px ${accent}66, 0 24px 60px rgba(0,0,0,.75), 0 0 44px ${accent}33`
              : "0 0 0 1px rgba(255,255,255,.10), 0 18px 44px rgba(0,0,0,.6)",
          }}
        >
          {item.image ? (
            <img src={item.image} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center bg-[#101018] px-2 text-center font-mono text-[10px] font-bold text-slate-500">
              {item.title}
            </span>
          )}
          <span
            aria-hidden
            className="absolute inset-0 bg-black transition-opacity duration-500"
            style={{ opacity: centre ? 0 : Math.min(0.62, 0.24 + abs * 0.14) }}
          />
        </button>
      </div>
    </motion.div>
  );
}
