"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Coffee, Heart, Sparkles, Diamond, ShieldCheck, Server, Database, Code2,
  Crown, ExternalLink, ArrowRight,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import BuyPointsModal from "@/components/shop/BuyPointsModal";
import { KOFI_BUNDLES, KOFI_PAGE, currencySymbol } from "@/lib/kofiBundles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const MONTHLY_GOAL = 100;

interface KofiStats {
  monthlyTotal: number;
  currency: string;
  recent: { name: string; linked: boolean; amount: number; currency: string; tierName: string | null; type: string; createdAt: string }[];
}

const easeOut = [0.16, 1, 0.3, 1] as const;
const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, delay, ease: easeOut },
});

export default function SupportPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<KofiStats | null>(null);
  const [showBuyPoints, setShowBuyPoints] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/kofi/stats`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d); })
      .catch(() => {});
  }, []);

  const currency = stats?.currency || "GBP";
  const sym = currencySymbol(currency);
  const monthlyTotal = stats?.monthlyTotal ?? 0;
  const progress = Math.min((monthlyTotal / MONTHLY_GOAL) * 100, 100);
  const recent = stats?.recent || [];
  const topSupporter = recent[0];

  const PERKS = [
    { icon: Crown, title: "Supporter Badge", body: "A gold badge on your profile, forever. Worn with pride.", color: "text-amber-300" },
    { icon: Sparkles, title: "Exclusive Effects", body: "Cinematic profile effects reserved for those who give back.", color: "text-violet-300" },
    { icon: Diamond, title: "Arise Points", body: "Points land in your wallet to spend on any frame or effect.", color: "text-violet-300" },
    { icon: ShieldCheck, title: "Ad-Free, Always", body: "No ads, no pop-ups, no tracking — your support keeps it that way.", color: "text-emerald-300" },
  ];

  const COSTS = [
    { icon: Server, title: "Servers", body: "High-speed hosting so pages load instantly." },
    { icon: Database, title: "Database", body: "Your library, profile and progress, safely stored." },
    { icon: Code2, title: "Development", body: "New modes, effects and features — anime, manhwa & novels." },
  ];

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-24 pt-20 font-mono text-white">
        {/* The Lunar top glow — same radial as the hub and updates pages. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-4xl">

          {/* ── HERO ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOut }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              <Heart className="h-3 w-3 fill-rose-400 text-rose-400" /> No ads · community funded
            </span>
            <h1 className="mt-6 font-fell text-5xl leading-[1.05] tracking-tight md:text-6xl">
              Support <em className="italic text-amber-300">Da Vinci</em>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-slate-400">
              Anime, manhwa &amp; novels — fast, free and ad-less for the whole
              community. Patrons keep the servers on.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {/* Ko-fi's own coral stays on the Ko-fi CTA only — brand, not chrome. */}
              <a
                href={KOFI_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-[#ff5e5b] px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:brightness-110"
              >
                <Coffee className="h-4 w-4" /> Support on Ko-fi
                <ExternalLink className="h-3.5 w-3.5 opacity-70 transition group-hover:translate-x-0.5" />
              </a>
              <button
                onClick={() => setShowBuyPoints(true)}
                className="inline-flex items-center gap-2.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/25 hover:text-white"
              >
                <Diamond className="h-4 w-4" /> Buy Arise Points
              </button>
            </div>
          </motion.div>

          {/* ── THIS MONTH ── live total + the supporters it came from */}
          <motion.div {...rise(0)} className="mt-16 rounded-3xl border border-white/10 bg-[#0b0b11] p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">This month&apos;s servers</p>
                <p className="mt-2 text-4xl font-black tabular-nums">
                  {sym}{monthlyTotal}
                  <span className="ml-2 text-sm font-bold text-slate-500">of {sym}{MONTHLY_GOAL} goal</span>
                </p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">{progress.toFixed(0)}% funded</p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400"
                initial={{ width: 0 }}
                whileInView={{ width: `${progress}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: easeOut, delay: 0.2 }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {progress >= 100
                ? "This month is fully funded — thank you."
                : `${sym}${Math.max(0, MONTHLY_GOAL - monthlyTotal).toFixed(0)} to go to keep the lights on this month.`}
            </p>

            {/* Recent supporters — proof that donations land, by name. */}
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  <Heart className="h-3 w-3 fill-rose-400 text-rose-400" /> Recent supporters
                </p>
                {topSupporter && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    Latest · <span className="text-amber-300">{topSupporter.name}</span>
                  </p>
                )}
              </div>
              {recent.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recent.map((r, i) => {
                    const chip = (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-slate-200 transition hover:border-amber-400/40 hover:text-white">
                        <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                        {r.name}
                        {r.tierName && <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">{r.tierName}</span>}
                      </span>
                    );
                    return r.linked ? (
                      <Link key={i} href={`/user/${encodeURIComponent(r.name)}`}>{chip}</Link>
                    ) : (
                      <span key={i}>{chip}</span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Be the first name here this month.</p>
              )}
            </div>
          </motion.div>

          {/* ── THE ONE RULE ── how the webhook finds your account */}
          <motion.div {...rise(0)} className="mt-8 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-5 md:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">The one rule</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Write your Da Vinci <span className="font-black text-amber-200">username</span> in the Ko-fi message
              {user?.username ? <> — <span className="font-black text-amber-200">{user.username}</span></> : ""}.
              That note is how the payment finds your account: your Supporter badge and Arise Points
              land within a minute, automatically. No waiting on us.
            </p>
          </motion.div>

          {/* ── BUY ARISE POINTS ── */}
          <motion.div {...rise(0)} className="mt-20">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-fell text-3xl tracking-tight">
                  Buy <em className="italic text-violet-300">Arise Points</em>
                </h2>
                <p className="mt-1.5 text-xs text-slate-500">Spend them on any frame or effect in the shop. Bigger bundles, bigger bonus.</p>
              </div>
              <Link
                href="/shop"
                className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-white sm:inline-flex"
              >
                Visit shop <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {KOFI_BUNDLES.map((b, i) => (
                <motion.a
                  key={b.price}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: easeOut }}
                  className="group relative rounded-2xl border border-white/10 bg-[#0b0b11] p-5 transition hover:-translate-y-1 hover:border-violet-400/40"
                >
                  {b.badge && (
                    <span className="absolute right-3 top-3 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-200">
                      {b.badge}
                    </span>
                  )}
                  <Diamond className="mb-4 h-5 w-5 text-violet-300" />
                  <div className="text-2xl font-black tabular-nums text-white">{b.ap.toLocaleString()}</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Arise Points</div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-black tabular-nums text-violet-300">{sym}{b.price}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 transition group-hover:text-violet-300">
                      Ko-fi <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-600">
              Username in the Ko-fi note — that&apos;s how the points reach your account.
            </p>
          </motion.div>

          {/* ── WHAT SUPPORTERS GET ── */}
          <motion.div {...rise(0)} className="mt-20">
            <h2 className="mb-6 text-center font-fell text-3xl tracking-tight">
              What supporters <em className="italic text-amber-300">get</em>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PERKS.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                      <Icon className={`h-5 w-5 ${p.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">{p.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── WHERE IT GOES ── */}
          <motion.div {...rise(0)} className="mt-8 rounded-2xl border border-white/10 bg-[#0b0b11] p-5 md:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Where it goes · 100% into keeping Da Vinci running</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {COSTS.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.title} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    <div>
                      <h3 className="text-sm font-black text-white">{c.title}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{c.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── FINAL CTA ── */}
          <motion.div {...rise(0)} className="mt-20 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-amber-300" />
            <h2 className="mx-auto mt-4 max-w-md font-fell text-3xl tracking-tight md:text-4xl">
              Every cup keeps the lights <em className="italic text-amber-300">on</em>.
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a
                href={KOFI_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#ff5e5b] px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:brightness-110"
              >
                <Coffee className="h-4 w-4" /> Support on Ko-fi
              </a>
              <button
                onClick={() => setShowBuyPoints(true)}
                className="inline-flex items-center gap-2.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/25 hover:text-white"
              >
                <Diamond className="h-4 w-4" /> Buy Arise Points
              </button>
            </div>
            <p className="mt-5 text-[11px] text-slate-600">Payments handled securely by Ko-fi · cancel a membership anytime.</p>
          </motion.div>

        </div>
      </div>

      {showBuyPoints && <BuyPointsModal username={user?.username || ""} onClose={() => setShowBuyPoints(false)} />}
    </PageTransition>
  );
}
