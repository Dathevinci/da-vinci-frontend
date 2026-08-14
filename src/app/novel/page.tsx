"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, Compass, Tv, ArrowRight, Construction, Flame } from "lucide-react";

export default function NovelPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#070709] text-white flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.15),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1),transparent_70%)] blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-2xl text-center flex flex-col items-center"
      >
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-mono font-bold tracking-widest uppercase mb-8 shadow-[0_0_20px_rgba(236,72,153,0.15)]">
          <Construction className="w-3.5 h-3.5 animate-pulse" />
          <span>Under Reconstruction</span>
        </div>

        {/* Hero Icon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(236,72,153,0.25)]">
            <BookOpen className="w-10 h-10 text-pink-400" />
          </div>
          <Sparkles className="w-5 h-5 text-amber-300 absolute -top-2 -right-2 animate-bounce" />
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-4"
          style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
        >
          Novel Sanctuary <em className="italic text-pink-400">In Progress</em>
        </h1>

        <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-lg mb-10">
          We are rebuilding the novel engine and source architecture from scratch for official translations, zero AI clutter, and a state-of-the-art reading experience.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-10 text-left">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 mb-2 font-mono text-xs font-bold">
              01
            </div>
            <h2 className="text-sm font-bold text-slate-200 mb-1">Authentic Sources</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Curated official light novels and acclaimed human translations.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2 font-mono text-xs font-bold">
              02
            </div>
            <h2 className="text-sm font-bold text-slate-200 mb-1">Official HD Covers</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Direct high-resolution publisher volume art with zero AI thumbnails.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-2 font-mono text-xs font-bold">
              03
            </div>
            <h2 className="text-sm font-bold text-slate-200 mb-1">Next-Gen Reader</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Customizable typography, page turn transitions, and progress syncing.
            </p>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/explore"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-mono text-sm font-bold shadow-[0_0_25px_rgba(236,72,153,0.35)] transition-all hover:scale-105 active:scale-95"
          >
            <Tv className="w-4 h-4" />
            <span>Explore Anime</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/manhwa"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 font-mono text-sm font-bold backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Browse Manhwa & Comics</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
