"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen, Star, ShieldAlert, Lock, Play, Info, MessagesSquare, Search,
} from "lucide-react";
import { IMangaInfo } from "@/lib/asura/models";
import ManhwaTrackerButton from "@/components/manhwa/ManhwaTrackerButton";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useManhwaStatus } from "@/hooks/useManhwaStatus";
import LoadingScreen from "@/components/ui/LoadingScreen";
import CommunityFeed from "@/components/community/CommunityFeed";
import HeroBackdrop from "@/components/ui/HeroBackdrop";
import { manhwaSourceLabel } from "@/lib/manhwa/ids";

/**
 * MANHWA DETAIL — the reference layout: the series' own blurred cover as
 * the stage, the poster front and centre, mono title, chips, one white
 * Read Now, then a tabbed Details block (Overview / Chapters /
 * Discussions / More Like This).
 *
 * Everything the old page wired stays wired: continue-reading from the
 * saved progress key, first/latest jumps, locked chapters (with their
 * early-access tooltip), pipe-bearing chapter ids encoded in every href,
 * the HTML synopsis, tracking, comments.
 */

type Tab = "overview" | "chapters" | "discussions" | "morelike";

export default function ManhwaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = decodeURIComponent(resolvedParams.id);

  const [manhwa, setManhwa] = useState<IMangaInfo | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [chapterFilter, setChapterFilter] = useState("");

  /**
   * Where this reader left off — the ACCOUNT's answer, not just this browser's.
   *
   * Seeds from the local cache (instant, and the whole answer when signed out
   * or offline), then updates in place if reconciling against the server turns
   * up a newer chapter read on another device. useManhwaStatus does that
   * reconcile off the bookmark list it already fetches, so this costs no extra
   * request — which matters on mobile, where this sits on the reading path.
   */
  const lastRead = useReadingProgress("manhwa", id);
  // Subscribes this page to the bookmark fetch that performs the reconcile.
  useManhwaStatus();

  useEffect(() => {
    fetch(`/api/manhwa/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data: any) => {
        if (data.error) {
          console.error(data.error);
          setManhwa(null);
        } else {
          setManhwa(data);
          if (data.title) {
            fetch(`/api/manhwa/banner?title=${encodeURIComponent(data.title)}`)
              .then((bRes) => bRes.json())
              .then((bData: any) => {
                if (bData?.banner) setBannerUrl(bData.banner);
              })
              .catch(() => {});
          }
        }
        setLoading(false);
      })
      .catch((err) => { console.error(err); setLoading(false); });
  }, [id]);

  const chapters = manhwa?.chapters || [];
  const filteredChapters = useMemo(() => {
    const q = chapterFilter.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) => c.title.toLowerCase().includes(q));
  }, [chapters, chapterFilter]);

  if (loading) return <LoadingScreen message="Loading series" />;

  if (!manhwa) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070709] pb-16 pt-24 text-white">
        <ShieldAlert className="mb-4 h-16 w-16 text-red-500 opacity-50" />
        <h2 className="mb-2 font-mono text-2xl font-black">Series Not Found</h2>
        <p className="mb-8 font-mono text-sm text-slate-500">Could not load details, or the series was removed.</p>
        <Link href="/manhwa" className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-mono text-sm font-bold transition hover:bg-white/10">
          Return to Browse
        </Link>
      </div>
    );
  }

  const cover = manhwa.image ? `/api/manhwa-image?url=${encodeURIComponent(manhwa.image)}` : null;
  const cont = lastRead ? chapters.find((c) => c.id === lastRead && !c.isLocked) : null;
  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  const latestUnlocked = chapters.find((c) => !c.isLocked) || null;
  const readTarget = cont || firstChapter;
  const statusLower = (manhwa.status || "").toLowerCase();

  const TABS: { key: Tab; label: string; Icon: any }[] = [
    { key: "overview", label: "Overview", Icon: Info },
    { key: "chapters", label: "Chapters", Icon: BookOpen },
    { key: "discussions", label: "Discussions", Icon: MessagesSquare },
    ...(manhwa.recommendations && manhwa.recommendations.length > 0
      ? [{ key: "morelike" as Tab, label: "More Like This", Icon: Star }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-slate-200">
      {/* ═══ HERO ═══ overflow-hidden lives on the BACKDROP wrapper, not
          the hero itself — on the hero it clipped the Add to Library
          dropdown, which opens past the hero's bottom edge. */}
      <div className="relative">
        <HeroBackdrop src={bannerUrl || cover} wide={!!bannerUrl} />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-10 pt-20 text-center sm:pt-24">
          {/* ambient bloom behind the poster — the reference's themed halo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-6 h-[460px] bg-[radial-gradient(ellipse_45%_60%_at_50%_40%,rgba(56,189,248,0.13),transparent_70%)]"
          />
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-44 shrink-0 overflow-hidden rounded-xl sm:w-56"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.14), 0 30px 80px rgba(0,0,0,.8)" }}
          >
            {cover ? (
              <img src={cover} alt={manhwa.title} referrerPolicy="no-referrer" className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[2/3] w-full place-items-center bg-[#101018]">
                <BookOpen className="h-12 w-12 text-slate-700" />
              </div>
            )}
          </motion.div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] font-black uppercase tracking-wide">
            {manhwa.rating ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-amber-300">
                <Star className="h-3 w-3 fill-current" /> {Number(manhwa.rating).toFixed(1)}
              </span>
            ) : null}
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">Manhwa</span>
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">{chapters.length} Chapters</span>
            {manhwa.status && (
              <span className={`rounded-lg border px-2.5 py-1 ${
                statusLower === "ongoing" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.05] text-slate-300"
              }`}>
                {manhwa.status}
              </span>
            )}
          </div>

          {/* THE TITLE — a comic masthead. Each mode wears its own face:
              manhwa in Anton block caps, novels in literary Garamond, anime
              in the atelier's Fell serif. */}
          <h1
            className="mt-5 max-w-3xl text-4xl uppercase leading-none tracking-[0.02em] text-white sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-anton), Impact, 'Arial Black', sans-serif" }}
          >
            {manhwa.title}
          </h1>

          {(manhwa.genres?.length || 0) > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {manhwa.genres!.slice(0, 6).map((g) => (
                <span key={g} className="rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-1 font-mono text-xs font-bold text-sky-100/90">
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="relative z-20 mt-8 flex flex-wrap items-center justify-center gap-3">
            {readTarget ? (
              <Link
                href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(readTarget.id)}`}
                className="flex items-center gap-2.5 rounded-xl bg-white px-7 py-3 font-mono text-sm font-black text-black transition hover:bg-white/85"
              >
                <Play className="h-4 w-4 fill-current" strokeWidth={0} />
                {cont ? "Continue Reading" : "Read Now"}
              </Link>
            ) : null}
            <ManhwaTrackerButton manhwa={manhwa} />
          </div>
        </div>
      </div>

      {/* ═══ DETAILS ═══ */}
      <div className="mx-auto max-w-5xl px-4 pb-28 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b0b11]">
          <div className="px-5 pt-6 sm:px-7">
            <h2 className="font-mono text-2xl font-black text-white">Details</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">Explore more about {manhwa.title}</p>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10 px-3 sm:px-5">
            {TABS.map(({ key, label, Icon }) => (
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
                    ["Format", "Manhwa"],
                    ["Chapters", String(chapters.length)],
                    ["Status", manhwa.status || "—"],
                    ["Score", manhwa.rating ? `${Number(manhwa.rating).toFixed(1)} / 10` : "—"],
                    ["Author", manhwa.authors?.join(", ") || "—"],
                    ["Artist", manhwa.artist || "—"],
                    ["Updated", manhwa.updatedOn
                      ? new Date(manhwa.updatedOn).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                      : "—"],
                    // The site this series actually came from. Hardcoding
                    // "AsuraScans" was already a guess and is wrong for three
                    // sources out of four now.
                    ["Source", manhwaSourceLabel(manhwa.id ?? id)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="min-w-0">
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{k}</p>
                      <p className="mt-1 truncate font-mono text-sm font-bold text-white" title={v as string}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* synopsis arrives as HTML from the scraper */}
                <div
                  className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-300"
                  dangerouslySetInnerHTML={{ __html: manhwa.description || "No synopsis available for this series." }}
                />
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
                      placeholder="Search chapters..."
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
                    />
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs font-bold text-slate-400">
                    {filteredChapters.length} chapters
                  </span>
                  {firstChapter && (
                    <Link
                      href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(firstChapter.id)}`}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10"
                    >
                      First
                    </Link>
                  )}
                  {latestUnlocked && (
                    <Link
                      href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(latestUnlocked.id)}`}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10"
                    >
                      Latest
                    </Link>
                  )}
                </div>

                <div className="max-h-[600px] overflow-y-auto overscroll-contain rounded-xl border border-white/10">
                  {filteredChapters.length > 0 ? (
                    <div className="flex flex-col">
                      {filteredChapters.map((chap) => {
                        const isLocked = chap.isLocked;
                        const number = chapters.length - chapters.indexOf(chap);
                        const inner = (
                          <>
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`w-9 shrink-0 text-right font-mono text-xs font-black ${isLocked ? "text-slate-700" : "text-slate-600 group-hover:text-white"}`}>
                                {number}
                              </span>
                              <span className={`flex min-w-0 items-center gap-2 truncate font-mono text-sm font-bold ${isLocked ? "text-slate-600" : "text-slate-200 group-hover:text-white"}`}>
                                {isLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                                <span className="truncate">{chap.title}</span>
                              </span>
                            </div>
                            {chap.releaseDate && (
                              <span className="ml-4 shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                {chap.releaseDate}
                              </span>
                            )}
                          </>
                        );
                        const cls = "group flex items-center justify-between px-4 py-3 transition-colors odd:bg-white/[0.02]";
                        /**
                         * OFFICIALLY LICENSED — send them to the publisher.
                         *
                         * A source that does not host a licensed chapter can
                         * still say where it lives; that link used to be
                         * thrown away, so the series opened with an empty list
                         * and looked broken while the destination sat unused
                         * in the payload.
                         *
                         * Checked BEFORE the locked branch: a licensed chapter
                         * is not paywalled-then-free, it is simply somewhere
                         * else, and no fallback is going to find it.
                         */
                        const official = (chap as any).externalUrl as string | undefined;
                        if (official) {
                          return (
                            <a
                              key={chap.id}
                              href={official}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${cls} hover:bg-white/[0.06]`}
                              title="Officially licensed — read it at the publisher"
                            >
                              {inner}
                              <span className="ml-3 shrink-0 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">
                                Official ↗
                              </span>
                            </a>
                          );
                        }
                        /**
                         * A LOCKED CHAPTER IS NOW WORTH OPENING.
                         *
                         * It used to render as a dead div, which was right when
                         * a lock meant there was nothing to read. Now the reader
                         * tries MangaPill for the same chapter while Asura has
                         * it paywalled, so refusing the click would hide a
                         * chapter that is very often available.
                         *
                         * It stays visibly locked — the badge and the tooltip
                         * are unchanged — because it IS locked on Asura, and the
                         * reader still shows the lock screen when no fallback
                         * turns up. Optimism here, honesty there.
                         */
                        return isLocked ? (
                          <Link
                            key={chap.id}
                            href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chap.id)}`}
                            className={`${cls} hover:bg-white/[0.06]`}
                            title={chap.earlyAccessUntil
                              ? `Locked on Asura until ${new Date(chap.earlyAccessUntil).toLocaleString()} — we'll try another source`
                              : "Locked on Asura — we'll try another source"}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <Link
                            key={chap.id}
                            href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chap.id)}`}
                            className={`${cls} hover:bg-white/[0.06]`}
                          >
                            {inner}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center font-mono text-sm text-slate-500">
                      {chapters.length > 0 ? (
                        "No chapters match your search."
                      ) : (manhwa as any).chaptersFailed ? (
                        /* THE SOURCE FAILED — say so, and offer the one thing
                           that works. This used to print "No chapters available
                           yet", which is a statement about the SERIES when the
                           truth was a statement about ONE REQUEST. Every reload
                           re-fetches (nothing here is cached), so a retry
                           genuinely fixes it — but only if the reader is told
                           retrying is worth doing. */
                        <>
                          <span className="block text-amber-400">Couldn&rsquo;t load the chapter list.</span>
                          <span className="mt-2 block text-xs text-slate-600">
                            The source didn&rsquo;t answer. This is usually temporary.
                          </span>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200 transition hover:bg-white/10"
                          >
                            Try again
                          </button>
                        </>
                      ) : (
                        "No chapters available yet. Check back later!"
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "discussions" && (
              <CommunityFeed mangaId={manhwa.id} mangaTitle={manhwa.title} />
            )}

            {tab === "morelike" && manhwa.recommendations && (
              <div>
                <h3 className="mb-5 font-mono text-lg font-black text-white">Recommended Manhwa</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {manhwa.recommendations.slice(0, 10).map((rec) => (
                    <Link key={rec.id} href={`/manhwa/${encodeURIComponent(rec.id)}`} className="group text-left">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[#101018]">
                        {rec.image && (
                          <img
                            src={`/api/manhwa-image?url=${encodeURIComponent(rec.image)}`}
                            alt={rec.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                          <p className="line-clamp-1 font-mono text-sm font-black text-white">{rec.title}</p>
                          <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Manhwa{rec.rating ? ` • ★ ${Number(rec.rating).toFixed(1)}` : ""}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
