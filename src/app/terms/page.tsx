"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Scale,
  ArrowLeft,
  Shield,
  FileCheck,
  CheckCircle2,
  Lock,
  ShieldAlert,
  HelpCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";

const SECTIONS = [
  {
    id: "1",
    title: "1. Acceptance of Terms",
    content:
      "By accessing and using Da Vinci, you agree to be bound by these Terms of Service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.",
  },
  {
    id: "2",
    title: "2. Description of Service",
    content:
      "Da Vinci acts solely as an interactive media catalog, metadata index, and community discovery hub. We do not host, store, or upload media files to our servers. All video streams, comics, and light novel pages are embedded from third-party services and open-access networks.",
  },
  {
    id: "3",
    title: "3. User Conduct & Community Standards",
    content:
      "You agree to use our services exclusively for lawful purposes. You are strictly prohibited from attempting to disrupt or compromise system security, deploying automated scrapers/bots without permission, engaging in abusive or defamatory behavior, or attempting unauthorized access to accounts.",
  },
  {
    id: "4",
    title: "4. Virtual Economy & Arise Points",
    content:
      "Arise Points (AP), XP, collectible cards, titles, frames, and other virtual goods on Da Vinci are virtual entertainment items with no real-world monetary value. They cannot be redeemed for fiat currency and remain bound to the platform ecosystem.",
  },
  {
    id: "5",
    title: "5. Disclaimer of Warranties",
    content:
      "The materials on Da Vinci are provided on an 'as is' and 'as available' basis. We make no warranties, expressed or implied, and hereby disclaim all warranties including without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement.",
  },
  {
    id: "6",
    title: "6. Modifications & Policy Updates",
    content:
      "Da Vinci reserves the right to revise and update these Terms of Service at any time without prior notice. By continuing to use the service following any revisions, you agree to be bound by the updated version.",
  },
];

export default function TermsPage() {
  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#07070a] text-slate-300 pb-36 pt-8 sm:pt-12 overflow-hidden selection:bg-blue-500/30 selection:text-blue-200">
        {/* Subtle Ambient Background Gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-blue-900/15 via-indigo-950/10 to-transparent blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -right-60 w-[500px] h-[500px] bg-blue-950/10 blur-[130px] rounded-full" />
        <div className="pointer-events-none absolute bottom-20 -left-60 w-[500px] h-[500px] bg-indigo-950/10 blur-[130px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Top Navigation Row */}
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md transition-all hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Home</span>
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-300">
              <FileCheck className="h-3.5 w-3.5" />
              <span>User Agreement</span>
            </div>
          </div>

          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-indigo-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.15)] mb-4">
              <Scale className="h-4 w-4 text-blue-400" />
              <span>Platform Terms & Guidelines</span>
            </div>

            <h1 className="font-fell text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-[0.06em] text-white drop-shadow-md">
              Terms of Service
            </h1>

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
              Please review the following rules and regulations governing your access to and use of the Da Vinci platform.
            </p>
          </motion.div>

          {/* ── SECTIONS LIST ── */}
          <div className="space-y-6 mb-12">
            {SECTIONS.map((sec, idx) => (
              <motion.section
                key={sec.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0a10]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl transition hover:border-white/20"
              >
                <h2 className="font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white mb-3">
                  {sec.title}
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                  {sec.content}
                </p>
              </motion.section>
            ))}
          </div>

          {/* ── FOOTER & RELATED LEGAL LINKS ── */}
          <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Da Vinci. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/privacy"
                className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <Lock className="h-3 w-3" />
                <span>Privacy Policy</span>
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
