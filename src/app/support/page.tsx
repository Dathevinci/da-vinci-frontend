"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Coffee, Heart, Sparkles, Diamond, ShieldCheck, Server, Database, Code2,
  Crown, Check, ExternalLink, Info, ArrowRight,
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

  // Progress ring geometry
  const R = 82;
  const CIRC = 2 * Math.PI * R;

  const PERKS = [
    { icon: Crown, title: "Supporter Badge", body: "A gold badge on your profile, forever. Worn with pride.", color: "text-amber-300", ring: "border-amber-400/30 bg-amber-500/10" },
    { icon: Sparkles, title: "Exclusive Effects", body: "Cinematic profile effects reserved for those who give back.", color: "text-fuchsia-300", ring: "border-fuchsia-400/30 bg-fuchsia-500/10" },
    { icon: Diamond, title: "Arise Points", body: "Points land in your wallet to spend on any frame or effect.", color: "text-purple-300", ring: "border-purple-400/30 bg-purple-500/10" },
    { icon: ShieldCheck, title: "Ad-Free, Always", body: "No ads, no pop-ups, no tracking — your support keeps it that way.", color: "text-emerald-300", ring: "border-emerald-400/30 bg-emerald-500/10" },
  ];

  const COSTS = [
    { icon: Server, title: "Servers", body: "High-speed hosting so pages load instantly." },
    { icon: Database, title: "Database", body: "Your library, profile and progress, safely stored." },
    { icon: Code2, title: "Development", body: "New modes, effects and features — anime, manhwa & novels." },
  ];

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-hidden bg-[#070708] pt-24 pb-20 text-white selection:bg-amber-500/20">
        {/* Ambient glows — supporter gold + Ko-fi rose + brand violet */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[150px]" />
        <div className="pointer-events-none absolute top-24 right-0 h-[520px] w-[520px] translate-x-1/4 rounded-full bg-rose-500/10 blur-[150px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[560px] w-[560px] -translate-x-1/4 rounded-full bg-purple-600/10 blur-[150px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,#070708_100%)]" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-8">

          {/* ── HERO ── */}
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: easeOut }}>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.25em] text-amber-200 font-cinzel">
                <Heart className="h-3.5 w-3.5 fill-current" /> Patron of the Atelier
              </span>
              <h1 className="font-fell text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Keep the vault
                <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-rose-400 bg-clip-text text-transparent">open for everyone.</span>
              </h1>
              <p className="mt-5 max-w-md font-garamond text-lg italic leading-relaxed text-slate-300/90 md:text-xl">
                No ads. No pop-ups. Just anime, manhwa &amp; novels — kept fast and free for the whole community by patrons like you.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={KOFI_PAGE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff5e5b] to-[#ff4542] px-7 py-4 text-lg font-black text-white shadow-[0_10px_30px_rgba(255,94,91,0.3)] transition hover:scale-[1.03]"
                >
                  <Coffee className="h-6 w-6" /> Support on Ko-fi
                  <ExternalLink className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
                </a>
                <button
                  onClick={() => setShowBuyPoints(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 px-6 py-4 font-black text-purple-100 transition hover:bg-purple-500/20 hover:scale-[1.02]"
                >
                  <Diamond className="h-5 w-5 text-fuchsia-400" /> Buy Arise Points
                </button>
              </div>
            </motion.div>

            {/* Progress ring — live monthly funding */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.15, ease: easeOut }}
              className="relative mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl"
            >
              <p className="mb-6 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 font-cinzel">This month&apos;s servers</p>
              <div className="relative h-56 w-56">
                <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                  <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                  <motion.circle
                    cx="100" cy="100" r={R} fill="none" stroke="url(#grad)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={CIRC}
                    initial={{ strokeDashoffset: CIRC }}
                    animate={{ strokeDashoffset: CIRC * (1 - progress / 100) }}
                    transition={{ duration: 1.4, ease: easeOut, delay: 0.3 }}
                  />
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="60%" stopColor="#fb7185" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-black">{sym}{monthlyTotal}</div>
                  <div className="text-sm font-bold text-slate-500">of {sym}{MONTHLY_GOAL} goal</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-wider text-amber-300">{progress.toFixed(0)}% funded</div>
                </div>
              </div>
              <p className="mt-6 text-center text-sm text-slate-400">
                {progress >= 100
                  ? "This month is fully funded — thank you! 💛"
                  : `${sym}${Math.max(0, MONTHLY_GOAL - monthlyTotal).toFixed(0)} to go to keep the lights on this month.`}
              </p>
            </motion.div>
          </div>

          {/* ── HOW IT WORKS (username note) ── */}
          <motion.div {...rise(0)} className="mt-20 rounded-3xl border border-amber-400/20 bg-gradient-to-r from-amber-500/[0.07] via-white/[0.02] to-transparent p-6 md:p-8">
            <div className="flex items-center gap-3">
              <Info className="h-6 w-6 shrink-0 text-amber-300" />
              <h2 className="text-xl font-black">Perks apply automatically — here&apos;s the one rule</h2>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { n: "1", t: "Pay on Ko-fi", b: "Membership, a tip, or an Arise Points bundle — whatever suits you." },
                { n: "2", t: "Add your username", b: <>In the Ko-fi <span className="font-bold text-amber-200">message/note</span>, write your Da Vinci username{user?.username ? <> — <span className="font-black text-amber-200">{user.username}</span></> : ""}.</> },
                { n: "3", t: "It's instant", b: "Your Supporter badge + Arise Points land within a minute. No waiting on us." },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-sm font-black text-black">{s.n}</div>
                  <div className="font-black text-white">{s.t}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.b}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── BUY ARISE POINTS (bundles) ── */}
          <motion.div {...rise(0)} className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-3 text-2xl font-black md:text-3xl">
                  <Diamond className="h-7 w-7 text-fuchsia-400" /> Buy Arise Points
                </h2>
                <p className="mt-1 text-slate-400">Top up and spend on any frame or effect in the shop. Bigger bundles, bigger bonus.</p>
              </div>
              <Link href="/shop" className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-purple-200 transition hover:text-white sm:inline-flex">
                Visit shop <ArrowRight className="h-4 w-4" />
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
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-purple-500/50 hover:bg-white/[0.06]"
                >
                  {b.badge && (
                    <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                      {b.badge}
                    </span>
                  )}
                  <Diamond className="mb-3 h-6 w-6 text-fuchsia-400" />
                  <div className="text-2xl font-black text-white">{b.ap.toLocaleString()}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Arise Points</div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-black text-purple-300">{sym}{b.price}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 transition group-hover:text-purple-300">
                      Ko-fi <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">
              Remember to put your username in the Ko-fi note so the points reach your account.
            </p>
          </motion.div>

          {/* ── PERKS ── */}
          <motion.div {...rise(0)} className="mt-20">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black md:text-3xl">What supporters get</h2>
              <p className="mt-2 text-slate-400">Every contribution — big or small — earns your place in the atelier.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PERKS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <motion.div
                    key={p.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55, delay: i * 0.08, ease: easeOut }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:bg-white/[0.05]"
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${p.ring}`}>
                      <Icon className={`h-6 w-6 ${p.color}`} />
                    </div>
                    <h3 className="text-lg font-black text-white">{p.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{p.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* ── RECENT SUPPORTERS + TOP SUPPORTER ── */}
          <motion.div {...rise(0)} className="mt-20 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Hall of thanks */}
            <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h2 className="mb-6 flex items-center gap-3 text-xl font-black">
                <Heart className="h-6 w-6 fill-rose-500 text-rose-500" /> Hall of Patrons
              </h2>
              {recent.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {recent.map((r, i) => {
                    const chip = (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-bold text-slate-100 transition hover:border-amber-400/40 hover:bg-amber-500/10">
                        <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                        {r.name}
                        {r.tierName && <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">{r.tierName}</span>}
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
                <p className="text-slate-500">Be the first name in the Hall of Patrons. 💛</p>
              )}
            </div>

            {/* Featured supporter */}
            <div className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-b from-rose-900/25 to-black/50 p-6 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/20 blur-2xl" />
              <div className="relative z-10 text-center">
                <Heart className="mx-auto mb-3 h-9 w-9 animate-pulse fill-rose-500 text-rose-500" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 font-cinzel">Most recent patron</p>
                <p className="mt-1 mb-2 text-2xl font-black text-white">{topSupporter?.name || "Māna-Yood-Sushāī"}</p>
                <p className="text-sm text-rose-200/90">
                  {topSupporter ? "Thank you for keeping Da Vinci alive." : "Unlocked the exclusive Crimson Realm profile effect."}
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── WHERE YOUR MONEY GOES ── */}
          <motion.div {...rise(0)} className="mt-20 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-10">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black md:text-3xl">Where your support goes</h2>
              <p className="mt-2 text-slate-400">100% into keeping Da Vinci running — nothing else.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {COSTS.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-400/25 bg-purple-500/10">
                      <Icon className="h-5 w-5 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="font-black text-white">{c.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{c.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── FINAL CTA ── */}
          <motion.div {...rise(0)} className="mt-16 flex flex-col items-center gap-5 text-center">
            <Sparkles className="h-8 w-8 text-amber-300" />
            <h2 className="max-w-xl font-fell text-3xl font-bold md:text-4xl">Join the patrons keeping the atelier alive.</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={KOFI_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff5e5b] to-[#ff4542] px-8 py-4 text-lg font-black text-white shadow-[0_10px_30px_rgba(255,94,91,0.3)] transition hover:scale-[1.03]"
              >
                <Coffee className="h-6 w-6" /> Support on Ko-fi
              </a>
              <button
                onClick={() => setShowBuyPoints(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 font-black text-white transition hover:bg-white/10"
              >
                <Diamond className="h-5 w-5 text-fuchsia-400" /> Buy Arise Points
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Payments handled securely by Ko-fi · cancel a membership anytime.</p>
          </motion.div>

        </div>
      </div>

      {showBuyPoints && <BuyPointsModal username={user?.username || ""} onClose={() => setShowBuyPoints(false)} />}
    </PageTransition>
  );
}
