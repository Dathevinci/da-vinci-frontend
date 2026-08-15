"use client";

import Link from "next/link";
import { Crown, BookOpen, Sparkles } from "lucide-react";
import { novelCover } from "@/lib/novelImage";
import { FEATURED_NOVEL_ID } from "@/lib/novel/featured";

/**
 * MUST READ — a single-title editorial spotlight on the novel home feed.
 *
 * One novel, hand-pinned by the owner, on its own shelf above the listing
 * shelves. The pin is DATA, not plumbing: swap the object below to feature a
 * different title. The id must be a real source id (`rr:<fictionId>` /
 * `rnf:<slug>`) so the card opens the actual novel — this one was resolved
 * against the live API before shipping (82 chapters at pin time).
 *
 * THE EFFECTS ARE PURE CSS on transform/opacity only — no canvas, no framer,
 * no per-frame JS — so the aura costs a compositor layer, not a render loop.
 * Everything animated sits BEHIND or OVER the cover as its own element;
 * nothing repaints the art itself. `prefers-reduced-motion` stills all of it.
 *
 * Class names are prefixed `sps-` because the <style> tag is global: styled-jsx
 * is deliberately avoided here — its template literal silently terminates on a
 * backtick in a comment, a trap this repo has already paid for twice.
 */
const MUST_READ = {
  // From lib/novel/featured — the same constant that puts the purple aura on
  // this novel's detail page, so the two surfaces cannot disagree.
  id: FEATURED_NOVEL_ID,
  title: "The Seventh Prince of Hell",
  author: "Dejavuh",
  source: "RoyalRoad",
  status: "Ongoing",
  cover: "https://www.royalroadcdn.com/public/covers-large/142993-the-seventh-prince-of-hell.jpg",
  genres: ["Anti-Hero", "Action", "Fantasy", "Supernatural"],
  hook:
    "[System Alert: You have refused to kneel.] [The Heavenly Court rejects you.] [The Abyssal Court welcomes you.] In the era of After Dark, the world is ruled by the Awakened — and one prince refuses to bow.",
};

export default function MustReadSpotlight() {
  const href = `/novel/${encodeURIComponent(MUST_READ.id)}`;
  const cover = novelCover(MUST_READ.cover) || MUST_READ.cover;

  return (
    <section className="relative px-4 md:px-8 pt-8" aria-label="Must read">
      <style>{`
        @keyframes sps-aura {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.12); opacity: 0.9; }
        }
        @keyframes sps-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sps-ember {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          12% { opacity: 0.9; }
          100% { transform: translateY(-90px) scale(0.4); opacity: 0; }
        }
        @keyframes sps-flicker {
          0%, 86%, 92%, 100% { opacity: 0; }
          88%, 90% { opacity: 0.5; }
        }
        @keyframes sps-sheen {
          0%, 55%, 100% { transform: translateX(-130%) skewX(-18deg); }
          70%, 85% { transform: translateX(230%) skewX(-18deg); }
        }
        .sps-aura { animation: sps-aura 4.5s ease-in-out infinite; }
        .sps-aura2 { animation: sps-aura 6s ease-in-out infinite reverse; }
        .sps-ring { animation: sps-ring 9s linear infinite; }
        .sps-ember { animation: sps-ember 5s ease-out infinite; }
        .sps-flicker { animation: sps-flicker 7s linear infinite; }
        .sps-sheen { animation: sps-sheen 8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sps-aura, .sps-aura2, .sps-ring, .sps-ember, .sps-flicker, .sps-sheen { animation: none; }
        }
      `}</style>

      <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-3xl border border-purple-500/25 bg-[#0b0713]">
        {/* Deep backdrop wash so the section reads as its own place. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_20%_50%,rgba(147,51,234,0.22),transparent_60%),radial-gradient(40%_90%_at_85%_20%,rgba(88,28,135,0.25),transparent_65%)]" />

        <div className="relative flex flex-col items-center gap-8 p-6 sm:p-10 md:flex-row md:items-stretch md:gap-12">
          {/* ── the art, wearing the aura ─────────────────────────────── */}
          <Link href={href} className="group relative block shrink-0" aria-label={`Read ${MUST_READ.title}`}>
            {/* Haki aura: two breathing violet plumes behind the cover. */}
            <div className="sps-aura pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.55),rgba(126,34,206,0.25)_55%,transparent_75%)] blur-2xl" />
            <div className="sps-aura2 pointer-events-none absolute -inset-12 rounded-full bg-[radial-gradient(closest-side,rgba(216,180,254,0.28),transparent_70%)] blur-3xl" />

            {/* Rotating neon rim — a conic ring, masked to a border. */}
            <div className="pointer-events-none absolute -inset-[3px] overflow-hidden rounded-2xl">
              <div className="sps-ring absolute -inset-16 bg-[conic-gradient(from_0deg,transparent_0%,rgba(192,132,252,0.9)_12%,transparent_28%,transparent_55%,rgba(147,51,234,0.8)_68%,transparent_82%)]" />
            </div>

            <div className="relative w-[190px] overflow-hidden rounded-2xl border border-purple-300/40 shadow-[0_0_28px_rgba(147,51,234,0.55),0_0_80px_rgba(88,28,135,0.35)] sm:w-[220px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={`${MUST_READ.title} cover`}
                className="block aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
              {/* Occasional violet lightning wash over the art. */}
              <div className="sps-flicker pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(216,180,254,0.55)_48%,rgba(147,51,234,0.35)_52%,transparent_70%)] mix-blend-screen" />
              {/* Slow diagonal sheen. */}
              <div className="sps-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent mix-blend-screen" />
            </div>

            {/* Embers drifting up out of the aura. */}
            {[
              ["8%", "0s", "4px"],
              ["24%", "1.4s", "3px"],
              ["78%", "0.6s", "5px"],
              ["90%", "2.2s", "3px"],
              ["50%", "3.1s", "4px"],
            ].map(([left, delay, size], i) => (
              <span
                key={i}
                className="sps-ember pointer-events-none absolute bottom-2 rounded-full bg-purple-300"
                style={{ left, width: size, height: size, animationDelay: delay, boxShadow: "0 0 8px rgba(192,132,252,0.9)" }}
              />
            ))}
          </Link>

          {/* ── the pitch ─────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center md:items-start md:text-left">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-purple-400/50 bg-purple-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-purple-200 shadow-[0_0_18px_rgba(147,51,234,0.45)]">
                <Crown className="h-3.5 w-3.5" /> Must Read
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {MUST_READ.source}
              </span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                {MUST_READ.status}
              </span>
            </div>

            <h2
              className="mb-1 bg-gradient-to-b from-fuchsia-200 via-purple-300 to-purple-600 bg-clip-text text-4xl leading-tight text-transparent sm:text-5xl"
              style={{
                fontFamily: "var(--font-pirata), 'Pirata One', serif",
                filter:
                  "drop-shadow(0 0 14px rgba(168,85,247,0.55)) drop-shadow(0 0 42px rgba(126,34,206,0.35)) drop-shadow(0 2px 2px rgba(0,0,0,0.9))",
              }}
            >
              {MUST_READ.title}
            </h2>
            <p className="mb-4 text-sm font-bold text-slate-400">
              by <span className="text-purple-300">{MUST_READ.author}</span>
            </p>

            <p className="mb-5 max-w-2xl text-sm leading-relaxed text-slate-300/90">{MUST_READ.hook}</p>

            <div className="mb-6 flex flex-wrap justify-center gap-2 md:justify-start">
              {MUST_READ.genres.map((g) => (
                <span key={g} className="rounded-full border border-purple-400/25 bg-purple-500/10 px-3 py-1 text-[11px] font-bold text-purple-200/90">
                  {g}
                </span>
              ))}
            </div>

            <Link
              href={href}
              className="group inline-flex items-center gap-2 rounded-xl border border-purple-400/60 bg-purple-600/25 px-6 py-3 text-sm font-black uppercase tracking-wider text-purple-100 shadow-[0_0_24px_rgba(147,51,234,0.5)] transition hover:bg-purple-600/45 hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]"
            >
              <BookOpen className="h-4 w-4 transition-transform group-hover:-rotate-6" />
              Read Now
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
