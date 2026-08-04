"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, TrendingUp, Users, Trophy } from "lucide-react";

/**
 * DISCOVER — the reference layout's centred block: a title, a row of tabs, and
 * a ranked rail of covers underneath. Switching tab swaps the rail in place.
 *
 * Source-agnostic on purpose: manhwa and novels hand it already-normalised
 * items, because their payloads share almost nothing (manhwa rows carry a
 * rating, novel rows carry a latest-chapter string and no rating at all).
 * Each tab renders whatever meta its own items actually have, so nothing here
 * invents a score or a chapter count for a source that doesn't publish one.
 */

export type DiscoverItem = {
  id: string;
  title: string;
  image: string | null;
  /** Free-text line under the title — a rating, a chapter, whatever is real. */
  meta?: string | null;
  href: string;
};

export type DiscoverTab = {
  key: string;
  label: string;
  icon: "trending" | "popular" | "top";
  items: DiscoverItem[];
};

const ICONS = {
  trending: TrendingUp,
  popular: Users,
  top: Trophy,
} as const;

export default function DiscoverRail({
  title,
  subtitle,
  tabs,
  accent = "#dc2626",
}: {
  title: string;
  subtitle?: string;
  tabs: DiscoverTab[];
  accent?: string;
}) {
  const live = tabs.filter((t) => t.items.length > 0);
  const [active, setActive] = useState(0);
  if (live.length === 0) return null;

  // A tab list that shrank between renders must not strand the index.
  const current = live[Math.min(active, live.length - 1)];

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 md:px-8">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-6">
        {/* centred header, as in the reference */}
        <div className="flex flex-col items-center px-4 text-center">
          <span
            className="mb-3 grid h-11 w-11 place-items-center rounded-xl border"
            style={{ borderColor: `${accent}33`, background: `${accent}14`, color: accent }}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1.5 font-mono text-xs text-slate-500">{subtitle}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {live.map((t, i) => {
              const Icon = ICONS[t.icon];
              const on = t === current;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-black transition ${
                    on ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  style={
                    on
                      ? { background: `${accent}22`, boxShadow: `inset 0 0 0 1px ${accent}66` }
                      : { background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ranked rail */}
        <div className="mt-6 flex gap-3 overflow-x-auto px-4 pb-2 md:px-8">
          {current.items.slice(0, 20).map((it, i) => (
            <Link
              key={`${current.key}-${it.id}`}
              href={it.href}
              className="group w-[132px] shrink-0 md:w-[150px]"
            >
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {it.image ? (
                  <img
                    src={it.image}
                    alt=""
                    loading="lazy"
                    className="hq-image aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="block aspect-[2/3] w-full" />
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-snug text-white">{it.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                <span style={{ color: accent }}>#{i + 1}</span>
                {it.meta ? <span className="truncate">{it.meta}</span> : null}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
