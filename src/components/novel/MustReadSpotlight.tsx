"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crown, BookOpen, Sparkles } from "lucide-react";
import { novelCover } from "@/lib/novelImage";
import { FEATURED_NOVELS } from "@/lib/novel/featured";
import {
  PurpleAuraStyles,
  AuraPlumes,
  AuraRing,
  AuraOverlays,
  AuraEmbers,
  coverGlow,
  titleStyle,
} from "@/components/novel/PurpleAura";

/**
 * MUST READ — the editorial spotlight on the novel home, now a rotating stage.
 *
 * Every novel in lib/novel/featured gets a slide dressed in its own palette
 * and lettering; the stage advances on its own every eight seconds. Three
 * rules keep the auto-scroll from being an annoyance instead of a feature:
 *
 *  · HOVER PAUSES IT. Advancing the slide under a reader's cursor mid-read is
 *    how carousels teach people to ignore them — and worse, it can swap the
 *    link out from under an in-flight click.
 *  · A MANUAL CHOICE STICKS. Tapping a dot resets the timer rather than being
 *    overridden three seconds later by the rotation.
 *  · REDUCED MOTION DISABLES IT ENTIRELY — the reader said so; the dots still
 *    navigate by hand.
 *
 * Slides cross-fade in place rather than sliding a track, so the section's
 * height never jumps and nothing below it reflows on each advance.
 */
const INTERVAL_MS = 8000;

export default function MustReadSpotlight() {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (FEATURED_NOVELS.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timerRef.current = setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % FEATURED_NOVELS.length);
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const choose = (i: number) => {
    setIndex(i);
    // A deliberate pick restarts the clock; it must not be overridden moments
    // later by a rotation that was already mid-count.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!pausedRef.current) setIndex((x) => (x + 1) % FEATURED_NOVELS.length);
      }, INTERVAL_MS);
    }
  };

  return (
    <section
      className="relative px-4 md:px-8 pt-8"
      aria-label="Must read"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <PurpleAuraStyles />

      <div className="relative mx-auto max-w-[1500px]">
        {/* Slides stack in one grid cell and cross-fade; the tallest sets the
            height, so rotation never reflows the page below. */}
        {/* COMPACT BANNER, not a hero: the cover sits beside the pitch on
            EVERY screen size, so the section is one card tall on a phone
            instead of a full-viewport column. Slides cross-fade with a slight
            drift-and-settle in one grid cell, so height never jumps. */}
        <div className="grid">
          {FEATURED_NOVELS.map((novel, i) => {
            const active = i === index;
            const p = novel.palette;
            const href = `/novel/${encodeURIComponent(novel.id)}`;
            const cover = novelCover(novel.cover) || novel.cover;
            return (
              <div
                key={novel.id}
                className={`col-start-1 row-start-1 transition-all duration-700 ease-out ${
                  active ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-[0.99] opacity-0"
                }`}
                aria-hidden={!active}
              >
                <Link
                  href={href}
                  aria-label={`Read ${novel.title}`}
                  className="group relative block overflow-hidden rounded-2xl border bg-[#0b0713]"
                  style={{ borderColor: `rgba(${p.rgb},0.28)` }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(60% 140% at 12% 50%, rgba(${p.rgb},0.2), transparent 58%), radial-gradient(45% 100% at 90% 20%, rgba(${p.rgb},0.14), transparent 65%)`,
                    }}
                  />

                  <div className="relative flex items-center gap-4 p-4 sm:gap-6 sm:p-5">
                    {/* ── the art, aura intact but scaled down ──────────── */}
                    <div className="relative shrink-0">
                      <AuraPlumes p={p} />
                      <AuraRing p={p} />
                      <div
                        className="relative w-[92px] overflow-hidden rounded-xl border sm:w-[120px] md:w-[136px]"
                        style={{ borderColor: `rgba(${p.rgb},0.4)`, boxShadow: coverGlow(p) }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover}
                          alt={`${novel.title} cover`}
                          className="block aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          loading="lazy"
                        />
                        <AuraOverlays p={p} />
                      </div>
                      <AuraEmbers p={p} />
                    </div>

                    {/* ── the pitch, tightened ──────────────────────────── */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em]"
                          style={{
                            borderColor: `rgba(${p.rgb},0.5)`,
                            background: `rgba(${p.rgb},0.14)`,
                            color: p.bright,
                            boxShadow: `0 0 14px rgba(${p.rgb},0.35)`,
                          }}
                        >
                          <Crown className="h-3 w-3" /> Must Read
                        </span>
                        <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:inline">
                          {novel.source}
                        </span>
                        <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 sm:inline">
                          {novel.status}
                        </span>
                      </div>

                      <h2 className="truncate text-2xl leading-tight sm:text-3xl md:text-4xl" style={titleStyle(p, novel.font)}>
                        {novel.title}
                      </h2>
                      <p className="mt-0.5 text-xs font-bold text-slate-400">
                        by <span style={{ color: p.bright }}>{novel.author}</span>
                      </p>

                      <p className="mt-1.5 hidden max-w-2xl text-xs leading-relaxed text-slate-300/85 sm:line-clamp-2">
                        {novel.hook}
                      </p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition group-hover:brightness-125"
                          style={{
                            borderColor: `rgba(${p.rgb},0.6)`,
                            background: `rgba(${p.rgb},0.22)`,
                            color: p.bright,
                            boxShadow: `0 0 18px rgba(${p.rgb},0.4)`,
                          }}
                        >
                          <BookOpen className="h-3.5 w-3.5 transition-transform group-hover:-rotate-6" />
                          Read Now
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="hidden flex-wrap gap-1.5 md:flex">
                          {novel.genres.slice(0, 3).map((g) => (
                            <span
                              key={g}
                              className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                              style={{ borderColor: `rgba(${p.rgb},0.28)`, background: `rgba(${p.rgb},0.1)`, color: p.bright }}
                            >
                              {g}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Dots — manual navigation that also survives reduced-motion. */}
        {FEATURED_NOVELS.length > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-2">
            {FEATURED_NOVELS.map((novel, i) => (
              <button
                key={novel.id}
                type="button"
                onClick={() => choose(i)}
                aria-label={`Show ${novel.title}`}
                aria-current={i === index}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 22 : 8,
                  background:
                    i === index ? `rgba(${novel.palette.rgb},0.9)` : "rgba(255,255,255,0.18)",
                  boxShadow: i === index ? `0 0 10px rgba(${novel.palette.rgb},0.7)` : "none",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
