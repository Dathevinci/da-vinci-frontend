"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen, Play, ChevronRight, Search, Server, Info, List, MessagesSquare,
} from "lucide-react";
import type { NovelInfo } from "@/lib/novel/ReadNovelFull";
import NovelTrackerButton from "@/components/novel/NovelTrackerButton";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useNovelStatus } from "@/hooks/useNovelStatus";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { novelCover } from "@/lib/novelImage";
import CommunityFeed from "@/components/community/CommunityFeed";
import HeroBackdrop from "@/components/ui/HeroBackdrop";
import CloseViewButton from "@/components/ui/CloseViewButton";
import { featuredFor } from "@/lib/novel/featured";
import StampThis from "@/components/stamp/StampThis";
import StampersRow from "@/components/stamp/StampersRow";
import CoverSeal from "@/components/stamp/CoverSeal";
import { PurpleAuraStyles, AuraPlumes, AuraRing, AuraOverlays, AuraEmbers, coverGlow, titleStyle } from "@/components/novel/PurpleAura";

/**
 * NOVEL DETAIL — the reference layout: blurred cover stage, poster front
 * and centre, mono title, chips, one white Read Now, then a tabbed
 * Details block (Overview / Chapters / Discussions).
 *
 * Everything the old page wired stays wired: the saved-progress Continue,
 * the alternative-server switcher, the chapter search + 100-per-page
 * range selector (novels here run to thousands of chapters), lastRead
 * highlighting, tracking, comments.
 */

type Tab = "overview" | "chapters" | "discussions";

export default function NovelDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  // A featured title wears its own aura here too — same registry the Must
  // Read spotlight rotates through, so the surfaces cannot disagree, and each
  // pinned novel keeps its own palette and lettering.
  const feat = featuredFor(id);
  const featured = feat !== null;

  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterFilter, setChapterFilter] = useState("");
  const [chapterPage, setChapterPage] = useState(0);
  // One-shot: the chapter list opens on the RANGE holding the last-read
  // chapter (novels here run to thousands), then manual paging is the
  // reader's own and never fought.
  const jumpedToLastRead = useRef(false);
  const [tab, setTab] = useState<Tab>("chapters");
  const [serverOpen, setServerOpen] = useState(false);
  const serverRef = useRef<HTMLDivElement>(null);

  /**
   * Where this reader left off — the ACCOUNT's answer, not just this browser's.
   *
   * Seeds from the local cache (instant, and the whole answer when signed out
   * or offline), then updates in place if reconciling against the server turns
   * up a newer chapter read on another device. useNovelStatus does that
   * reconcile off the bookmark list it already fetches, so this costs no extra
   * request — which matters on mobile, where this sits on the reading path.
   */
  const lastRead = useReadingProgress("novel", id);
  // Subscribes this page to the bookmark fetch that performs the reconcile.
  useNovelStatus();

  useEffect(() => setChapterPage(0), [chapterFilter]);

  // The click-toggled server menu closes on any outside tap — same pattern
  // as the tracker button beside it. Without this it sat open over the
  // range selector, eating clicks.
  useEffect(() => {
    if (!serverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (serverRef.current && !serverRef.current.contains(e.target as Node)) setServerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [serverOpen]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        setNovel(data && data.error ? null : data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const cover = novelCover(novel?.cover);
  const chapters = novel?.chapters || [];
  const PAGE_SIZE = 100;

  useEffect(() => {
    if (jumpedToLastRead.current || !lastRead) return;
    const idx = chapters.findIndex((c) => c.id === lastRead);
    if (idx < 0) return;
    jumpedToLastRead.current = true;
    setChapterPage(Math.floor(idx / PAGE_SIZE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRead, chapters]);
  const filtered = chapterFilter
    ? chapters.filter((c) => c.title.toLowerCase().includes(chapterFilter.toLowerCase()) || String(c.number).includes(chapterFilter))
    : chapters;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const shown = filtered.slice(chapterPage * PAGE_SIZE, (chapterPage + 1) * PAGE_SIZE);
  const firstCh = chapters[0];

  if (loading) return <LoadingScreen message="Loading novel" />;
  if (!novel || !novel.title)
    return (
      <div className="min-h-screen bg-[#070709] pt-32 text-center font-mono text-slate-400">
        Novel not found. <Link href="/novel" className="text-fuchsia-400 underline">Back to library</Link>
      </div>
    );

  const isDone = novel.status?.toLowerCase().includes("complet");

  return (
    <div className="min-h-screen bg-[#070709] text-slate-200">
      <CloseViewButton fallback="/novel" />
      {/* ═══ HERO ═══ overflow-hidden lives on the BACKDROP wrapper, not
          the hero itself — on the hero it clipped the tracker dropdown,
          which opens past the hero's bottom edge. */}
      <div className="relative">
        <HeroBackdrop src={(novel as any)?.bannerImage || cover} wide={!!(novel as any)?.bannerImage} />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-10 pt-20 text-center sm:pt-24">
          {/* ambient bloom behind the poster — the reference's themed halo;
              the featured title breathes violet instead of fuchsia */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-6 h-[460px]"
            style={{
              background: feat
                ? `radial-gradient(ellipse 45% 60% at 50% 40%, rgba(${feat.palette.rgb},0.26), transparent 70%)`
                : "radial-gradient(ellipse 45% 60% at 50% 40%, rgba(232,121,249,0.14), transparent 70%)",
            }}
          />
          {featured && <PurpleAuraStyles />}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-44 shrink-0 sm:w-56"
          >
            {feat && (
              <>
                <AuraPlumes p={feat.palette} />
                <AuraRing p={feat.palette} />
              </>
            )}
            <div
              className="relative overflow-hidden rounded-xl"
              style={{
                boxShadow: feat
                  ? coverGlow(feat.palette)
                  : "0 0 0 1px rgba(255,255,255,.14), 0 30px 80px rgba(0,0,0,.8)",
              }}
            >
              {cover ? (
                <img src={cover} alt={novel.title} className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[2/3] w-full place-items-center bg-[#101018]">
                  <BookOpen className="h-12 w-12 text-slate-700" />
                </div>
              )}
              {feat && <AuraOverlays p={feat.palette} />}
            </div>
            {/* A podium curator's seal, on the poster of the thing they
                recommended. Outside the clipped cover box so the featured
                novel's aura layers cannot crop it, and outside any link or
                button — it navigates to the curator itself. One instance on the
                page, so it takes the larger size, and still never animated. */}
            <CoverSeal mediaType="novel" mediaId={id} size="md" className="absolute bottom-2 right-2 z-10" />
            {feat && <AuraEmbers p={feat.palette} />}
          </motion.div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] font-black uppercase tracking-wide">
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">Light Novel</span>
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">{chapters.length} Chapters</span>
            {novel.status && (
              <span className={`rounded-lg border px-2.5 py-1 ${
                isDone ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300"
              }`}>
                {novel.status}
              </span>
            )}
          </div>

          {/* THE TITLE — a book spine, not a terminal. Each mode wears its own
              face now: novels in literary Garamond with the last word lit in
              fuchsia italic (the reference treatment), manhwa in an Anton
              masthead, anime in the atelier's Fell serif.

              THE FEATURED NOVEL wears its own lettering instead: the Pirata
              blackletter its cover art uses, in a violet gradient with a
              layered glow — matching the aura the rest of its page breathes.
              Every other novel keeps the Garamond treatment untouched. */}
          {feat ? (
            <h1
              className="mt-5 max-w-3xl text-5xl leading-tight sm:text-6xl md:text-7xl"
              style={titleStyle(feat.palette, feat.font)}
            >
              {novel.title}
            </h1>
          ) : (
            <h1
              className="mt-5 max-w-3xl text-4xl leading-tight text-white sm:text-5xl md:text-6xl"
              style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
            >
              {(() => {
                const words = novel.title.trim().split(/\s+/);
                const tail = words[words.length - 1];
                const head = words.slice(0, -1).join(" ");
                return head ? (
                  <>
                    {head} <em className="italic text-fuchsia-300">{tail}</em>
                  </>
                ) : (
                  <em className="italic text-fuchsia-300">{tail}</em>
                );
              })()}
            </h1>
          )}

          {novel.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {novel.genres.slice(0, 6).map((g) => (
                <span
                  key={g}
                  className="rounded-lg border px-3 py-1 font-mono text-xs font-bold"
                  style={
                    feat
                      ? {
                          borderColor: `rgba(${feat.palette.rgb},0.4)`,
                          background: `rgba(${feat.palette.rgb},0.1)`,
                          color: feat.palette.bright,
                          boxShadow: `0 0 12px rgba(${feat.palette.rgb},0.25)`,
                        }
                      : {
                          borderColor: "rgba(232,121,249,0.25)",
                          background: "rgba(232,121,249,0.06)",
                          color: "rgba(250,232,255,0.9)",
                        }
                  }
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="relative z-20 mt-8 flex flex-wrap items-center justify-center gap-3">
            {(lastRead || firstCh) && (
              <Link
                href={`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(lastRead || firstCh.id)}`}
                className="flex items-center gap-2.5 rounded-xl bg-white px-7 py-3 font-mono text-sm font-black text-black transition hover:bg-white/85"
              >
                <Play className="h-4 w-4 fill-current" strokeWidth={0} />
                {lastRead ? "Continue Reading" : "Read Now"}
              </Link>
            )}
            <div className="w-full sm:w-48">
              <NovelTrackerButton novel={{ id, title: novel.title, cover: novel.cover }} />
            </div>
            {/* Recommend it with your stamp. The RAW scraper cover is stored,
                exactly as the tracker beside it stores one — every stamp
                surface re-proxies novel art through /api/novel-image on the
                way out, because those hosts referer-gate hotlinks. */}
            <StampThis
              mediaType="novel"
              mediaId={id}
              title={novel.title}
              cover={novel.cover || null}
            />
          </div>

          {/* WHO ELSE PUT THEIR NAME ON IT — directly under the button that
              asks whether you will, keyed on the SAME id StampThis writes with
              (novel ids carry a source prefix like "nf:slug", so the client
              encodes it and the server decodes it back). Draws nothing at all
              when no one has stamped this. */}
          <StampersRow mediaType="novel" mediaId={id} className="relative z-20 mt-6" />
        </div>
      </div>

      {/* ═══ DETAILS ═══ */}
      <div className="mx-auto max-w-5xl px-4 pb-28 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b0b11]">
          <div className="px-5 pt-6 sm:px-7">
            <h2 className="font-mono text-2xl font-black text-white">Details</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">Explore more about {novel.title}</p>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10 px-3 sm:px-5">
            {([
              { key: "overview" as Tab, label: "Overview", Icon: Info },
              { key: "chapters" as Tab, label: "Chapters", Icon: List },
              { key: "discussions" as Tab, label: "Discussions", Icon: MessagesSquare },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 font-mono text-xs font-bold transition-colors ${
                  tab === key ? "border-white text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="px-5 py-7 sm:px-7">
            {tab === "overview" && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-white/10 pb-6 sm:grid-cols-4">
                  {[
                    ["Format", "Light Novel"],
                    ["Chapters", String(chapters.length)],
                    ["Status", novel.status || "—"],
                    ["Author", novel.author || "—"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="min-w-0">
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{k}</p>
                      <p className="mt-1 truncate font-mono text-sm font-bold text-white" title={v as string}>{v}</p>
                    </div>
                  ))}
                </div>
                <p className="whitespace-pre-line font-mono text-sm leading-relaxed text-slate-300">
                  {novel.synopsis || "No synopsis available."}
                </p>
              </div>
            )}

            {tab === "chapters" && (
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      value={chapterFilter}
                      onChange={(e) => setChapterFilter(e.target.value)}
                      placeholder="Find a chapter..."
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
                    />
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs font-bold text-slate-400">
                    {filtered.length} chapters
                  </span>

                  {/* server switcher — click-toggled now; the old hover-only
                      dropdown was unreachable on touch */}
                  {novel.alternativeServers && novel.alternativeServers.length > 1 && (
                    <div className="relative" ref={serverRef}>
                      <button
                        onClick={() => setServerOpen((o) => !o)}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10"
                      >
                        <Server className="h-3.5 w-3.5 text-fuchsia-400" />
                        {novel.alternativeServers.find((s) => s.id === id)?.name || "Server"}
                      </button>
                      {serverOpen && (
                        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#101018] shadow-2xl">
                          {novel.alternativeServers.map((s) => (
                            <Link
                              key={s.id}
                              href={`/novel/${encodeURIComponent(s.id)}`}
                              onClick={() => setServerOpen(false)}
                              className={`block px-4 py-3 font-mono text-xs transition-colors ${
                                s.id === id ? "bg-fuchsia-500/10 font-bold text-fuchsia-300" : "text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              {s.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="custom-scrollbar mb-4 flex max-h-[160px] flex-wrap gap-1.5 overflow-y-auto p-1">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const start = i * PAGE_SIZE + 1;
                      const end = Math.min((i + 1) * PAGE_SIZE, filtered.length);
                      return (
                        <button
                          key={i}
                          onClick={() => setChapterPage(i)}
                          className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${
                            chapterPage === i
                              ? "border-white bg-white text-black"
                              : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          {start} - {end}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {shown.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(ch.id)}`}
                      className={`group flex items-center justify-between rounded-xl border p-3 transition-colors ${
                        lastRead === ch.id
                          ? "border-fuchsia-500/40 bg-fuchsia-500/10"
                          : "border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className={`line-clamp-1 font-mono text-sm ${lastRead === ch.id ? "text-fuchsia-100" : "text-slate-300 group-hover:text-white"}`}>{ch.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {lastRead === ch.id && (
                          <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-300">
                            You&rsquo;re here
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white" />
                      </span>
                    </Link>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <p className="py-6 text-center font-mono text-sm text-slate-500">No chapters match your search.</p>
                )}
              </div>
            )}

            {tab === "discussions" && (
              <CommunityFeed novelId={id} novelTitle={novel.title} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
