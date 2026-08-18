"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  ArrowLeft,
  Mail,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Scale,
  Lock,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { useToast } from "@/components/ui/Toast";

const DMCA_EMAIL = "Luc1lfeer@yandex.com";

const CHECKLIST = [
  {
    title: "Authorized Representative",
    desc: "A physical or electronic signature of a person authorized to act on behalf of the owner of the copyrighted work.",
  },
  {
    title: "Identification of Work",
    desc: "Clear identification and description of the copyrighted work claimed to have been infringed.",
  },
  {
    title: "Exact Infringing URLs",
    desc: "The specific URL(s) on Da Vinci containing the links or embeds to the alleged material (broad domain references are insufficient).",
  },
  {
    title: "Valid Contact Information",
    desc: "Your legal name, mailing address, telephone number, and official email address for correspondence.",
  },
  {
    title: "Good-Faith Statement",
    desc: "A statement confirming you have a good-faith belief that use of the material is not authorized by the copyright owner, agent, or the law.",
  },
  {
    title: "Penalty of Perjury Clause",
    desc: "A statement under penalty of perjury that the information provided is accurate and you are the copyright owner or authorized representative.",
  },
];

export default function DMCAPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(DMCA_EMAIL);
    setCopied(true);
    toast("Email address copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#07070a] text-slate-300 pb-36 pt-8 sm:pt-12 overflow-hidden selection:bg-rose-500/30 selection:text-rose-200">
        {/* Subtle Ambient Background Gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-rose-900/15 via-purple-950/10 to-transparent blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -right-60 w-[500px] h-[500px] bg-rose-950/10 blur-[130px] rounded-full" />
        <div className="pointer-events-none absolute bottom-20 -left-60 w-[500px] h-[500px] bg-purple-950/10 blur-[130px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Top Navigation Row */}
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md transition-all hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Home</span>
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>DMCA Compliant</span>
            </div>
          </div>

          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-purple-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.15)] mb-4">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span>Legal & Intellectual Property</span>
            </div>

            <h1 className="font-fell text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-[0.06em] text-white drop-shadow-md">
              DMCA & Copyright Policy
            </h1>

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
              Da Vinci respects the intellectual property rights of creators and copyright holders worldwide and strictly complies with the Digital Millennium Copyright Act (17 U.S.C. § 512).
            </p>
          </motion.div>

          {/* ── SECTION 1: CONTENT HOSTING DISCLAIMER ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mb-8 overflow-hidden rounded-3xl border border-rose-500/20 bg-[#0c0a10]/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative"
          >
            <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none rounded-bl-full" />

            <div className="flex items-center gap-3 mb-6">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.2)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
                  Content Hosting Disclaimer
                </h2>
                <p className="text-xs font-mono uppercase tracking-wider text-rose-300/70">
                  Aggregation & Indexing Policy
                </p>
              </div>
            </div>

            {/* Prominent Disclaimer Banner */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/25 p-5 mb-6 text-sm sm:text-base font-bold leading-relaxed text-rose-100/95 tracking-wide">
              DA VINCI DOES NOT HOST, STORE, OR UPLOAD ANY MULTIMEDIA OR VIDEO FILES ON OUR SERVERS. ALL ANIME STREAMS, MANHWA/MANGA PAGES, AND NOVEL CONTENT ARE RETRIEVED AND EMBEDDED FROM THIRD-PARTY, OPEN-ACCESS INDEXES AND PUBLIC SERVERS.
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-slate-300">
              <p>
                Our platform functions strictly as an interactive media catalog and search engine aggregator. We do not own, control, or possess the multimedia data transmitted through third-party embed links.
              </p>
              <p>
                Because no copyrighted media files are physically stored on Da Vinci infrastructure, we cannot directly delete the source files from the internet. However, upon receiving a valid and complete DMCA notice, we will immediately disable, unlink, and remove the indexed streams or pages from our platform.
              </p>
            </div>

            {/* Quick 3-Pillar Badges */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-white/10">
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                <div className="h-2 w-2 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">No Local Hosting</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">Zero copyrighted video or image files stored on our hardware.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                <div className="h-2 w-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Index Aggregator</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">Parses publicly available APIs and mirror indexes.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                <div className="h-2 w-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Prompt Removal</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">Expeditious removal of verified infringing links.</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── SECTION 2: NOTICE REQUIREMENTS ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-8 rounded-3xl border border-white/10 bg-[#0c0a10]/80 p-6 sm:p-8 backdrop-blur-xl shadow-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-violet-300">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
                  Filing a DMCA Takedown Notice
                </h2>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Required Information Checklist
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-300 mb-6">
              To expedite the review of your claim, your notice must be written in English and contain all statutory elements required under 17 U.S.C. § 512(c)(3):
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CHECKLIST.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/15"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/20 text-xs font-black text-violet-300">
                      {idx + 1}
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400 pl-8">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── SECTION 3: SUBMISSION CARD ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mb-12 rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-950/30 via-[#0d0a14] to-purple-950/30 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-300 mb-3">
                  <Mail className="h-3 w-3" /> Designated Copyright Agent
                </div>
                <h2 className="font-fell text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white">
                  Submit a Takedown Notice
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Please direct your complete DMCA takedown requests directly to our designated copyright agent. Please allow up to 48-72 hours for verification and index removal.
                </p>

                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Standard Response Time: Under 48 hours</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-gradient-to-r from-rose-600 to-purple-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 transition-all hover:scale-105 hover:brightness-110 active:scale-95"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? "Copied!" : "Copy Email"}</span>
                </button>

                <a
                  href={`mailto:${DMCA_EMAIL}?subject=DMCA%20Takedown%20Notice%20-%20Da%20Vinci`}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Send Email</span>
                </a>
              </div>
            </div>

            {/* Email Display Pill */}
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/50 p-4">
              <div className="flex items-center gap-3 truncate">
                <Mail className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="font-mono text-sm sm:text-base font-bold text-white truncate">
                  {DMCA_EMAIL}
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                Official Agent Email
              </span>
            </div>
          </motion.section>

          {/* ── SECTION 4: RELATED LEGAL & SUPPORT LINKS ── */}
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
                href="/privacy"
                className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <Lock className="h-3 w-3" />
                <span>Privacy Policy</span>
              </Link>

              <Link
                href="/faq"
                className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <HelpCircle className="h-3 w-3" />
                <span>FAQ & Knowledge Base</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
