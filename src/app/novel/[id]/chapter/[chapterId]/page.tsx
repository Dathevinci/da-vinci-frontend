"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, List, ArrowLeft, Home, X, Server } from "lucide-react";
import type { NovelInfo, ChapterContent } from "@/lib/novel/ReadNovelFull";
import { useUser } from "@/hooks/useUser";
import { earnPoints } from "@/lib/earn";
import { recordReading } from "@/lib/readingHistory";
import { writeLocalProgress, pushProgress } from "@/lib/readingProgress";
import { useNovelReaderPrefs, themeById, fontById, spacingById, widthById } from "@/lib/novel/readerPrefs";
import { browseAnchorHref } from "@/lib/browseAnchor";
import ReaderSettings from "@/components/novel/ReaderSettings";
import CommunityFeed from "@/components/community/CommunityFeed";
import EpubReader from "@/components/reading/EpubReader";

export default function NovelReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const chapterId = decodeURIComponent(String(params.chapterId));

  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChapters, setShowChapters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { user } = useUser();

  // Reader customization (theme, font, size, spacing, width, alignment).
  const { prefs, update, reset } = useNovelReaderPrefs();
  const t = themeById(prefs.theme);
  const fontCss = fontById(prefs.font).css;
  const lineHeight = spacingById(prefs.spacing).value;
  const widthCls = widthById(prefs.width).cls;

  // Fetch the chapter + save reading progress.
  useEffect(() => {
    setLoading(true);
    setChapter(null);
    fetch(`/api/novels/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
      .then((r) => r.json())
      .then((data) => {
        setChapter(data && data.error ? null : data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // NO progress write here. It used to sit in this effect body, OUTSIDE the
    // fetch resolution, so it ran the instant the URL changed — a chapter that
    // 404s, fails to scrape, or is tapped offline still stamped progress. That
    // was survivable while the value was a device-local string; now that the
    // stamp drives cross-device reconciliation, a bogus one is newer than the
    // truth and OVERWRITES genuine reading on every other device. It moved
    // into the effect below, which runs only once a chapter has really loaded.
    //
    // Now largely redundant with the global ScrollReset — chapterId is part of
    // the pathname, so moving to the next chapter IS a pathname change and the
    // global reset sees it. Kept because it fires immediately rather than a
    // frame later, and a reader is the one place where even one frame at the
    // bottom of the previous chapter is noticeable.
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [id, chapterId]);

  // Fetch the novel once for the chapter list + reliable prev/next.
  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setNovel(data && data.error ? null : data))
      .catch(() => {});
  }, [id]);

  /**
   * ONE timestamp per (novel, chapter), held across re-renders.
   *
   * The effect below legitimately re-runs for a single chapter — `novel` lands
   * on its own slower request, and `user` gets a new identity the moment the
   * reading reward rewrites the cached balance. Taking Date.now() inline would
   * hand the local write and the server push different clocks for the same
   * read, which is precisely the disagreement reconciliation cannot resolve.
   */
  const readStampRef = useRef<{ key: string; at: number } | null>(null);

  // Save progress + record the "Continue Reading" entry — ONLY for a chapter
  // that actually loaded.
  useEffect(() => {
    // THE GATE. `chapter` is null for a 404 or a failed scrape, and empty
    // content is the same failure the "Failed to load this chapter" branch
    // renders. Neither is a read, so neither may touch progress. (The manhwa
    // reader gates on its pages the same way.)
    if (!chapter || !chapter.content?.length) return;

    const key = `${id}::${chapterId}`;
    if (readStampRef.current?.key !== key) readStampRef.current = { key, at: Date.now() };
    const at = readStampRef.current.at;

    // Local first: instant, offline-safe, and identical when signed out.
    writeLocalProgress("novel", id, chapterId, at);

    // The shelf entry and the account push both want the novel's title/cover,
    // which arrive on a separate request. If it has not landed yet there is
    // nothing to lose by waiting: the local write above already holds this
    // read, and the reconcile on the next bookmark load pushes it up because
    // local is newer than the server.
    if (!novel?.title) return;
    recordReading("novel", { id, title: novel.title, cover: novel.cover, chapterId, chapterTitle: chapter.title });
    // Fire-and-forget sync of the SAME moment (`at`) to the account, so the
    // chapter follows the reader to other devices. NOT awaited — a page turn
    // must never wait on the network.
    pushProgress("novel", id, chapterId, !!user, { title: novel.title, coverImage: novel.cover, at });
  }, [novel, chapter, id, chapterId, user]);

  // Reward reading: after a short dwell on a loaded chapter, grant Arise Points.
  // Deduped server-side per chapter, so re-reads never re-award.
  useEffect(() => {
    if (!user || !chapter || !chapter.content?.length) return;
    const timer = setTimeout(() => {
      earnPoints(user.id, "read", `novel:${id}:${chapterId}`);
    }, 3500);
    return () => clearTimeout(timer);
  }, [user, chapter, id, chapterId]);

  const chapters = novel?.chapters || [];
  const idx = chapters.findIndex((c) => c.id === chapterId);
  const prevId = (idx > 0 ? chapters[idx - 1]?.id : null) || chapter?.prev || null;
  const nextId = (idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1]?.id : null) || chapter?.next || null;

  // Window the drawer list around the current chapter to keep the DOM light.
  const drawerChapters = idx >= 0 ? chapters.slice(Math.max(0, idx - 150), idx + 150) : chapters.slice(0, 300);

  const go = (cid: string | null) => {
    if (cid) router.push(`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(cid)}`);
  };

  /**
   * EPUB volumes are detected from the SERIES id, not from the chapter id.
   *
   * It used to sniff for ".epub" on the chapter id, because the id WAS the
   * file address — which is precisely what made download managers grab every
   * link on the page. Volumes are "vol-3" now and the address lives on the
   * chapter record, so the check moved to the one part of the route that still
   * says which source this is.
   *
   * A chapter id that still looks like a URL is an old bookmark, and is used
   * as-is so those keep opening.
   */
  const legacyFile = chapterId.includes("files.lnori.com") ? chapterId : null;
  const vol = chapters.find((c) => c.id === chapterId) as any;
  const file: string | null = legacyFile || vol?.file || null;

  if (file) {
    return (
      <EpubReader
        file={file}
        title={vol?.title || chapter?.title || novel?.title || "EPUB Volume"}
        novelId={id}
      />
    );
  }

  return (
    <div className="min-h-screen selection:bg-pink-500/30" style={{ backgroundColor: t.bg, color: t.text }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ backgroundColor: t.panel + "e6", borderColor: t.border }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 min-w-0">
            {/* The way out — a reader has no persistent nav, so leaving a novel
                you have decided against meant unwinding the stack a tap at a
                time. Returns to the grid you were browsing, filters and all. */}
            <button
              onClick={() => router.push(browseAnchorHref("/novel"))}
              className="flex items-center justify-center h-9 w-9 shrink-0 rounded-lg hover:bg-pink-500/10 hover:text-pink-400 transition"
              style={{ color: t.muted }}
              title="Back to browsing"
            >
              <Home className="w-4 h-4" />
            </button>

            {/* `replace` for the same reason as the manhwa reader: this arrow was
                pushing the novel page on top of the chapter, so the back button
                landed you right back in the chapter you had just left. */}
            <Link href={`/novel/${encodeURIComponent(id)}`} replace className="flex items-center gap-2 hover:text-pink-400 transition text-sm font-bold min-w-0" style={{ color: t.muted }}>
              <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline line-clamp-1">{novel?.title || "Back"}</span>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {novel?.alternativeServers && novel.alternativeServers.length > 1 && (
              <div className="relative group mr-2">
                <div 
                  className="flex items-center gap-1.5 px-2 h-9 rounded-lg hover:bg-pink-500/10 hover:text-pink-400 transition cursor-pointer"
                  style={{ color: t.muted }}
                  title="Switch Server"
                >
                  <Server className="w-4 h-4" />
                </div>
                {/* Dropdown */}
                <div 
                  className="absolute right-0 top-full mt-1 w-48 border rounded-lg shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
                  style={{ backgroundColor: t.panel, borderColor: t.border }}
                >
                  {novel.alternativeServers.map(s => (
                    <Link
                      key={s.id}
                      href={`/novel/${encodeURIComponent(s.id)}`}
                      className={`block px-4 py-3 text-sm transition-colors ${
                        s.id === id 
                          ? "bg-pink-500/10 text-pink-400 font-bold" 
                          : "hover:bg-white/5"
                      }`}
                      style={s.id === id ? {} : { color: t.muted }}
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg hover:bg-pink-500/10 hover:text-pink-400 transition font-black"
              style={{ color: t.muted }}
              title="Reading settings"
            >
              <span className="font-serif text-[15px] leading-none">Aa</span>
            </button>
            <button onClick={() => setShowChapters(true)} className="p-2 rounded-lg hover:bg-pink-500/10 hover:text-pink-400 transition" style={{ color: t.muted }} title="Chapters">
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-40 flex justify-center">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
        </div>
      ) : !chapter || !chapter.content?.length ? (
        <div className="py-40 text-center" style={{ color: t.muted }}>
          Failed to load this chapter.{" "}
          <button onClick={() => go(chapterId)} className="text-pink-400 underline">
            Retry
          </button>
        </div>
      ) : (
        <article className={`${widthCls} mx-auto px-5 sm:px-8 py-10`} style={{ fontFamily: fontCss }}>
          <h1 className="text-2xl font-black mb-8 text-center" style={{ color: t.text }}>{chapter.title}</h1>
          <div className="space-y-5" style={{ fontSize: prefs.size, lineHeight, textAlign: prefs.justify ? "justify" : "left" }}>
            {chapter.content.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Bottom nav */}
          <div className="mt-14 flex items-center justify-between gap-3">
            <button
              onClick={() => go(prevId)}
              disabled={!prevId}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border disabled:opacity-30 hover:border-pink-500/40 transition font-bold text-sm"
              style={{ backgroundColor: t.panel, borderColor: t.border, color: t.text }}
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            <button onClick={() => setShowChapters(true)} className="p-3 rounded-xl border hover:border-pink-500/40 transition" style={{ backgroundColor: t.panel, borderColor: t.border, color: t.text }} title="Chapters">
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => go(nextId)}
              disabled={!nextId}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-500 text-black disabled:opacity-30 hover:bg-pink-400 transition font-bold text-sm"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Per-chapter discussion. The manhwa reader has always had this;
              the novel reader was the one surface with no comments at all.

              It gets its OWN dark surface and resets the inherited reading
              serif: the feed is hardcoded dark (white headings, white-on-
              translucent inputs), and this reader can be set to Sepia or
              Paper — on those, the section's chrome rendered white on cream
              and you couldn't see what you were typing. */}
          <div
            className="mt-14 rounded-2xl bg-[#070709] px-3 py-4 sm:px-5"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui)", color: "#e2e8f0" }}
          >
            <CommunityFeed
              novelId={id}
              // never persist the URL slug as a display title — the global
              // feed would render "nf:overlord-ln" as the novel's name
              novelTitle={novel?.title || undefined}
              chapterId={chapterId}
              chapterTitle={chapter.title}
            />
          </div>
        </article>
      )}

      {/* Reading settings sheet */}
      {showSettings && <ReaderSettings prefs={prefs} update={update} reset={reset} onClose={() => setShowSettings(false)} />}

      {/* Chapter drawer */}
      {showChapters && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowChapters(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[380px] border-l flex flex-col" style={{ backgroundColor: t.panel, borderColor: t.border, color: t.text }}>
            <div className="p-5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: t.border }}>
              <div>
                <h3 className="font-black">Chapters</h3>
                <p className="text-xs mt-0.5" style={{ color: t.muted }}>{chapters.length} total</p>
              </div>
              <button onClick={() => setShowChapters(false)} className="p-2 rounded-full hover:bg-pink-500/10 hover:text-pink-400" style={{ color: t.muted }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {drawerChapters.map((c) => {
                const active = c.id === chapterId;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setShowChapters(false);
                      go(c.id);
                    }}
                    className={`w-full text-left px-5 py-3 border-b text-sm transition ${active ? "bg-pink-500/15 text-pink-300 font-bold" : "hover:bg-pink-500/5"}`}
                    style={{ borderColor: t.border, color: active ? undefined : t.muted }}
                  >
                    {c.title}
                  </button>
                );
              })}
              <Link
                href={`/novel/${encodeURIComponent(id)}`}
                onClick={() => setShowChapters(false)}
                className="block text-center text-pink-400 text-xs font-bold py-4 hover:underline"
              >
                View all chapters →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
