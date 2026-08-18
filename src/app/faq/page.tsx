"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Search,
  ChevronDown,
  ArrowLeft,
  Tv,
  BookOpen,
  Layers,
  Shield,
  Sparkles,
  Mail,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { useToast } from "@/components/ui/Toast";

type FAQItem = {
  id: string;
  category: "streaming" | "reading" | "cards" | "account";
  categoryLabel: string;
  question: string;
  answer: string;
};

const FAQS: FAQItem[] = [
  // ── STREAMING & GENERAL ──
  {
    id: "free-to-use",
    category: "streaming",
    categoryLabel: "General & Streaming",
    question: "Is Da Vinci completely free to use?",
    answer:
      "Yes! Da Vinci is 100% free with no subscription fees, paywalls, or hidden costs. You can stream anime, read manhwa and novels, collect cards, and participate in duels and guilds completely free of charge.",
  },
  {
    id: "no-ads",
    category: "streaming",
    categoryLabel: "General & Streaming",
    question: "Why are there no intrusive ads or popups on the website?",
    answer:
      "We are committed to providing a clean, ad-free experience. We despise intrusive pop-ups, redirects, and video ads just as much as you do. The platform is kept fast, safe, and ad-less through the generosity of our community supporters.",
  },
  {
    id: "hosting-policy",
    category: "streaming",
    categoryLabel: "General & Streaming",
    question: "Do you host the anime videos or comics directly?",
    answer:
      "No. Da Vinci functions strictly as an indexer and media aggregator. All video streams and comic pages are hosted by independent, third-party public mirrors. We do not host or store copyrighted media files on our servers.",
  },
  {
    id: "broken-stream",
    category: "streaming",
    categoryLabel: "General & Streaming",
    question: "What should I do if an episode fails to load or stream?",
    answer:
      "If a video is buffering or fails to load, try switching servers using the server toggle in the player, or refresh the page. If the mirror remains unresponsive, you can report it on our Community Forum.",
  },

  // ── MANHWA & NOVELS ──
  {
    id: "reading-sources",
    category: "reading",
    categoryLabel: "Comics & Novels",
    question: "How do multiple manhwa and novel sources work?",
    answer:
      "We aggregate multiple reliable scanlation mirrors (including AsuraScans, WeebCentral, VortexScans, Manganato, Mangasee, and web novel sources). You can switch between source mirrors on any series page to find the fastest translation.",
  },
  {
    id: "novel-customization",
    category: "reading",
    categoryLabel: "Comics & Novels",
    question: "Can I customize the novel chapter reader?",
    answer:
      "Yes! Tap the 'Aa' button inside any chapter to open Reading Settings. You can customize font size, typeface (Garamond, Lora, Merriweather, Sans, Mono), line spacing, themes (Charcoal, Midnight, Sepia, Paper), and upload your own custom photo wallpaper with adjustable opacity and blur.",
  },
  {
    id: "progress-sync",
    category: "reading",
    categoryLabel: "Comics & Novels",
    question: "Does my reading and watching progress sync across devices?",
    answer:
      "Yes. When logged into your Da Vinci account, your chapter reading history, episode bookmarks, and progress sync automatically to your cloud profile, with an offline local backup.",
  },

  // ── CARDS & ARISE POINTS ──
  {
    id: "arise-points",
    category: "cards",
    categoryLabel: "Cards & Arise Points",
    question: "How do I earn Arise Points?",
    answer:
      "You earn Arise Points naturally by watching anime episodes, reading manhwa and novel chapters, completing Daily Quests, and winning Card Duels. Points can be used in the Shop for exclusive animated frames, glowing particle auras, and cosmetics.",
  },
  {
    id: "card-duels",
    category: "cards",
    categoryLabel: "Cards & Arise Points",
    question: "What are Arise Cards and Duels?",
    answer:
      "Arise Cards are collectible character cards with distinct rarities, serial numbers, and combat stats. You can showcase them on your profile, stake them in Duels against other players, and trade cards in the Marketplace.",
  },
  {
    id: "cosmetics-and-effects",
    category: "cards",
    categoryLabel: "Cards & Arise Points",
    question: "How do cosmetic frames and profile effects work?",
    answer:
      "Equipping an animated Frame wraps your avatar in a rotating conic gradient ring, while Profile Effects render interactive visual flourishes (such as Infinite Void, Hollow Purple, or Himalayan Snow) across your profile page.",
  },

  // ── ACCOUNT & GUILDS ──
  {
    id: "guilds-and-raids",
    category: "account",
    categoryLabel: "Guilds & Community",
    question: "What are Guilds and World Raids?",
    answer:
      "Guilds let you team up with friends to build a shared hall, lend cards, chat in dedicated real-time channels, and battle weekly World Boss Raids to earn rare guild loot and climb the Leaderboard.",
  },
  {
    id: "profile-customization",
    category: "account",
    categoryLabel: "Guilds & Community",
    question: "How do I customize my profile card?",
    answer:
      "Head to your profile to edit your username, write a formatted bio, upload a custom profile avatar and banner, and showcase your top Arise card.",
  },
];

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>("free-to-use");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "streaming" | "reading" | "cards" | "account">("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("Luc1lfeer@yandex.com");
    setCopied(true);
    toast("Support email copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredFaqs = useMemo(() => {
    let list = FAQS;

    if (selectedCategory !== "all") {
      list = list.filter((f) => f.category === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.categoryLabel.toLowerCase().includes(q)
      );
    }

    return list;
  }, [selectedCategory, search]);

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#09090b] px-4 pb-36 pt-24 font-mono text-white">
        {/* Ambient Top Violet Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[550px] bg-[radial-gradient(ellipse_60%_80%_at_50%_-10%,rgba(139,92,246,0.18),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-4xl space-y-8">
          
          {/* ── BACK BUTTON ── */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-bold text-white/60 transition hover:border-violet-400/40 hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
          </div>

          {/* ── HEADER ── */}
          <div className="border-b border-white/10 pb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.42em] text-violet-400/80">
              Da Vinci · Knowledge Base
            </p>
            <h1 className="mt-2 flex items-center gap-3 font-fell text-4xl sm:text-5xl font-bold uppercase tracking-[0.08em] text-white">
              <HelpCircle className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-violet-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]" />
              Frequently Asked Questions
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-white/50">
              Find instant answers about anime streaming, reading novels & comics, earning Arise Points, cards, and community rules.
            </p>

            {/* ── LIVE SEARCH INPUT ── */}
            <div className="relative mt-6 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
              <input
                type="text"
                placeholder="Search any question or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/[0.03] pl-11 pr-4 py-3 text-xs font-bold text-white outline-none placeholder:text-white/30 focus:border-violet-500 transition shadow-inner"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/40 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── CATEGORY FILTER PILLS ── */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "all" as const, label: `All Questions (${FAQS.length})`, Icon: Sparkles },
              { key: "streaming" as const, label: "Streaming", Icon: Tv },
              { key: "reading" as const, label: "Comics & Novels", Icon: BookOpen },
              { key: "cards" as const, label: "Cards & Points", Icon: Layers },
              { key: "account" as const, label: "Guilds & Account", Icon: Shield },
            ].map(({ key, label, Icon }) => {
              const on = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition ${
                    on
                      ? "border-violet-400/40 bg-violet-500/15 text-violet-200 shadow-sm"
                      : "border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${on ? "text-violet-300" : "text-white/40"}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* ── FAQS ACCORDION ── */}
          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="py-20 text-center rounded-2xl border border-white/10 bg-[#0b0b11]">
                <HelpCircle className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-3 text-sm font-bold text-white/50">No questions found matching &ldquo;{search}&rdquo;</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("all");
                  }}
                  className="mt-3 text-xs font-bold text-violet-400 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openId === faq.id;
                return (
                  <motion.div
                    key={faq.id}
                    layout
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isOpen
                        ? "border-violet-400/50 bg-[#0e0e18] shadow-xl shadow-violet-950/20"
                        : "border-white/10 bg-[#0b0b11] hover:border-violet-400/30 hover:bg-[#0d0d15]"
                    }`}
                  >
                    <button
                      onClick={() => setOpenId(isOpen ? null : faq.id)}
                      className="w-full flex items-center justify-between p-5 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 pr-4">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                            isOpen
                              ? "border-violet-400/40 bg-violet-500/20 text-violet-300"
                              : "border-white/10 bg-white/[0.02] text-white/40"
                          }`}
                        >
                          ?
                        </span>
                        <span className={`text-sm sm:text-base font-bold ${isOpen ? "text-white" : "text-white/80"}`}>
                          {faq.question}
                        </span>
                      </div>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] transition-transform duration-300 ${
                          isOpen ? "rotate-180 border-violet-400/40 text-violet-300" : "text-white/40"
                        }`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="border-t border-white/5 px-5 pb-5 pt-3">
                            <span className="inline-block rounded-md border border-white/5 bg-white/[0.02] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300/80 mb-2">
                              {faq.categoryLabel}
                            </span>
                            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* ── STILL HAVE QUESTIONS BANNER ── */}
          <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-950/30 via-[#0b0b11] to-purple-950/30 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-400">
                  <MessageSquare className="h-3.5 w-3.5" /> Support & Assistance
                </span>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold uppercase tracking-wide text-white">
                  Still have questions?
                </h2>
                <p className="mt-1 text-xs text-white/50 max-w-md leading-relaxed">
                  Join our community forum or reach out directly to the dev team via email.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/community"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-400/40 bg-violet-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MessageSquare className="h-4 w-4" /> Community Forum
                </Link>

                <button
                  onClick={handleCopyEmail}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-bold tracking-wider text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-white/40" />}
                  <span>{copied ? "Copied Email!" : "Luc1lfeer@yandex.com"}</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
