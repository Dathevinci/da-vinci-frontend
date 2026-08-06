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
import LoadingScreen from "@/components/ui/LoadingScreen";
import { novelCover } from "@/lib/novelImage";
import CommunityFeed from "@/components/community/CommunityFeed";
import HeroBackdrop from "@/components/ui/HeroBackdrop";
import EpubVolumeCard from "@/components/novel/EpubVolumeCard";

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

  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterFilter, setChapterFilter] = useState("");
  const [chapterPage, setChapterPage] = useState(0);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [serverOpen, setServerOpen] = useState(false);
  const serverRef = useRef<HTMLDivElement>(null);

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
    try {
      setLastRead(localStorage.getItem(`novel-progress:${id}`));
    } catch { /* ignore */ }
  }, [id]);

  const cover = novelCover(novel?.cover);
  const chapters = novel?.chapters || [];
  const PAGE_SIZE = 100;
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
        Novel not found. <Link href="/novel" className="text-pink-400 underline">Back to library</Link>
      </div>
    );

  const isDone = novel.status?.toLowerCase().includes("complet");

  return (
    <div className="min-h-screen bg-[#070709] text-slate-200">
      {/* ═══ HERO ═══ overflow-hidden lives on the BACKDROP wrapper, not
          the hero itself — on the hero it clipped the tracker dropdown,
          which opens past the hero's bottom edge. */}
      <div className="relative">
        <HeroBackdrop src={cover} wide={false} />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-10 pt-20 text-center sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-44 shrink-0 overflow-hidden rounded-xl sm:w-56"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.14), 0 30px 80px rgba(0,0,0,.8)" }}
          >
            {cover ? (
              <img src={cover} alt={novel.title} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[2/3] w-full place-items-center bg-[#101018]">
                <BookOpen className="h-12 w-12 text-slate-700" />
              </div>
            )}
          </motion.div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] font-black uppercase tracking-wide">
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">Light Novel</span>
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">{chapters.length} Chapters</span>
            {novel.status && (
              <span className={`rounded-lg border px-2.5 py-1 ${
                isDone ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-pink-400/40 bg-pink-400/10 text-pink-300"
              }`}>
                {novel.status}
              </span>
            )}
          </div>

          <h1 className="mt-5 max-w-3xl font-mono text-3xl font-black uppercase tracking-wider text-white sm:text-4xl md:text-5xl">
            {novel.title}
          </h1>

          {novel.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {novel.genres.slice(0, 6).map((g) => (
                <span key={g} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-xs font-bold text-slate-200">
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
          </div>
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
                        <Server className="h-3.5 w-3.5 text-pink-400" />
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
                                s.id === id ? "bg-pink-500/10 font-bold text-pink-300" : "text-slate-300 hover:bg-white/5"
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

                <div className={id.startsWith("lnori:") ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" : "grid grid-cols-1 gap-2 sm:grid-cols-2"}>
                  {shown.map((ch) => (
                    id.startsWith("lnori:") ? (
                      <EpubVolumeCard
                        key={ch.id}
                        chapterId={ch.id}
                        file={(ch as any).file || ch.id}
                        title={ch.title}
                        novelId={id}
                        fallbackCover={novelCover(novel.cover)}
                      />
                    ) : (
                      <Link
                        key={ch.id}
                        href={`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(ch.id)}`}
                        className={`group flex items-center justify-between rounded-xl border p-3 transition-colors ${
                          lastRead === ch.id
                            ? "border-pink-500/40 bg-pink-500/10"
                            : "border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="line-clamp-1 font-mono text-sm text-slate-300 group-hover:text-white">{ch.title}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-white" />
                      </Link>
                    )
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
