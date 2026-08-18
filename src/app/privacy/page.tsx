"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock,
  ArrowLeft,
  Shield,
  ShieldCheck,
  Eye,
  Database,
  UserCheck,
  Scale,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";

const PRIVACY_PILLARS = [
  {
    icon: Database,
    title: "1. Information We Collect",
    desc: "We collect minimal necessary account information (username, encrypted password hash, optional avatar URL) and gameplay progression data (watch/read history, bookmarks, virtual cards, unlocked cosmetics, and guild memberships) to preserve your cloud sync across devices.",
  },
  {
    icon: Eye,
    title: "2. How We Use Data",
    desc: "Your data is used strictly to power core platform features: resuming playback from your last timestamp, syncing bookmarked chapters, calculating quest rewards, and rendering your community profile. We never track you across external third-party sites.",
  },
  {
    icon: ShieldCheck,
    title: "3. Absolute Data Privacy",
    desc: "We do not sell, rent, monetize, or trade your personal information or viewing habits to data brokers, advertisers, or third parties under any circumstances.",
  },
  {
    icon: Lock,
    title: "4. Infrastructure Security",
    desc: "All network traffic is strictly transmitted over industry-standard TLS/SSL encrypted connections. Authentication sessions are secured with cryptographically verified JSON Web Tokens.",
  },
  {
    icon: UserCheck,
    title: "5. User Data Rights",
    desc: "You retain full ownership over your account data. You can export your bookmarks and reading history or permanently delete your account directly through your Profile Settings at any time.",
  },
];

export default function PrivacyPage() {
  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#07070a] text-slate-300 pb-36 pt-8 sm:pt-12 overflow-hidden selection:bg-purple-500/30 selection:text-purple-200">
        {/* Subtle Ambient Background Gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-purple-900/15 via-violet-950/10 to-transparent blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -right-60 w-[500px] h-[500px] bg-purple-950/10 blur-[130px] rounded-full" />
        <div className="pointer-events-none absolute bottom-20 -left-60 w-[500px] h-[500px] bg-violet-950/10 blur-[130px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Top Navigation Row */}
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md transition-all hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Home</span>
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Zero Data Selling</span>
            </div>
          </div>

          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-violet-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.15)] mb-4">
              <Lock className="h-4 w-4 text-purple-400" />
              <span>Privacy & Data Protection</span>
            </div>

            <h1 className="font-fell text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-[0.06em] text-white drop-shadow-md">
              Privacy Policy
            </h1>

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
              We believe your media consumption and reading habits should remain private. Learn how Da Vinci safeguards your personal data.
            </p>
          </motion.div>

          {/* ── SECTIONS LIST ── */}
          <div className="space-y-6 mb-12">
            {PRIVACY_PILLARS.map((sec, idx) => {
              const Icon = sec.icon;
              return (
                <motion.section
                  key={sec.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0a10]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl transition hover:border-white/20"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
                      {sec.title}
                    </h2>
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-slate-300 pl-11">
                    {sec.desc}
                  </p>
                </motion.section>
              );
            })}
          </div>

          {/* ── FOOTER & RELATED LEGAL LINKS ── */}
          <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Da Vinci. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/terms"
                className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <Scale className="h-3 w-3" />
                <span>Terms of Service</span>
              </Link>

              <Link
                href="/dmca"
                className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <ShieldAlert className="h-3 w-3" />
                <span>DMCA Policy</span>
              </Link>

              <Link
                href="/faq"
                className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <HelpCircle className="h-3 w-3" />
                <span>FAQ</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
