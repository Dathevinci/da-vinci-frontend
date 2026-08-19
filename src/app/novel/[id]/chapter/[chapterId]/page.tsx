"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChapterResume, ResumeBar } from "@/components/reader/ChapterResume";
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

  /**
   * CONTINUOUS AUTO-LOAD WAS REMOVED — it served OTHER NOVELS' CHAPTERS.
   *
   * When a novel's chapter list ran out, the next id was guessed as
   * `String(parseInt(currentId) + 1)`. Chapter ids are not per-novel
   * sequences: RoyalRoad's are global across the whole site, so id+1 is
   * whichever unrelated fiction happens to own that number, and the reader
   * silently appended a stranger's chapter to the one being read. The owner
   * hit exactly that on a novel with no further chapters.
   *
   * The guess is what was broken, but the feature is gone with it at the
   * owner's request. Navigation is now explicit, and every id it uses comes
   * from the novel's OWN chapter list or the source's own prev/next links —
   * never arithmetic on an id.
   */

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

    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [id, chapterId]);

  /* Where this reader stopped last time, if anywhere. */
  const { offer: resumeOffer, resume, startFresh } = useChapterResume({
    kind: "novel",
    seriesId: id,
    chapterId,
    ready: !loading,
  });

  // Fetch the novel once for the chapter list + reliable prev/next.
  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setNovel(data && data.error ? null : data))
      .catch(() => {});
  }, [id]);

  const chapters = novel?.chapters || [];
  const idx = chapters.findIndex((c) => c.id === chapterId);

  /**
   * BOTH NEIGHBOURS COME FROM THIS NOVEL, OR FROM NOWHERE.
   *
   * The novel's own chapter list is the first authority; the source's prev/next
   * links are the fallback for a chapter the list does not contain. When
   * neither has an answer the button is simply disabled — the last chapter of a
   * novel has no next, and saying so is the correct behaviour. Nothing here
   * derives an id by arithmetic; see the note above for what that cost.
   */
  const prevId = (idx > 0 ? chapters[idx - 1]?.id : null) || chapter?.prev || null;
  const initialNextId = (idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1]?.id : null) || chapter?.next || null;

  /**
   * ONE timestamp per (novel, chapter), held across re-renders.
   */
  const readStampRef = useRef<{ key: string; at: number } | null>(null);

  // Save progress + record the "Continue Reading" entry — ONLY for a chapter that actually loaded.
  useEffect(() => {
    if (!chapter || !chapter.content?.length || (chapter as any).error) return;

    const key = `${id}::${chapterId}`;
    if (readStampRef.current?.key !== key) readStampRef.current = { key, at: Date.now() };
    const at = readStampRef.current.at;

    writeLocalProgress("novel", id, chapterId, at);

    if (!novel?.title) return;
    recordReading("novel", { id, title: novel.title, cover: novel.cover, chapterId, chapterTitle: chapter.title });
    pushProgress("novel", id, chapterId, !!user, { title: novel.title, coverImage: novel.cover, at });
  }, [novel, chapter, id, chapterId, user]);

  // Reward reading: after a short dwell on a loaded chapter, grant Arise Points.
  useEffect(() => {
    if (!user || !chapter || !chapter.content?.length || (chapter as any).error) return;
    const timer = setTimeout(() => {
      earnPoints(user.id, "read", `novel:${id}:${chapterId}`);
    }, 3500);
    return () => clearTimeout(timer);
  }, [user, chapter, id, chapterId]);

  // Window the drawer list around the current chapter to keep the DOM light.
  const drawerChapters = idx >= 0 ? chapters.slice(Math.max(0, idx - 150), idx + 150) : chapters.slice(0, 300);

  /**
   * The drawer OPENS ON where you are. It windows ±150 chapters around the
   * current one, so the current row could still sit 150 rows deep — same
   * report as the manhwa selector: "it should show which chapter we're on".
   */
  const activeDrawerRowRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!showChapters) return;
    const t2 = setTimeout(() => {
      activeDrawerRowRef.current?.scrollIntoView({ block: "center" });
    }, 60);
    return () => clearTimeout(t2);
  }, [showChapters, chapterId]);

  const retryChapter = () => {
    setLoading(true);
    setChapter(null);
    fetch(`/api/novels/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
      .then((r) => r.json())
      .then((data) => {
        const ch = data && data.error ? null : data;
        setChapter(ch);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const go = (cid: string | null) => {
    if (cid) router.push(`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(cid)}`);
  };

  return (
    <div
      className="relative min-h-screen selection:bg-fuchsia-500/30 transition-colors"
      style={{
        backgroundColor: prefs.customBg ? "transparent" : t.bg,
        color: t.text,
      }}
    >
      {/* Custom wallpaper background layer */}
      {prefs.customBg && (
        <>
          <div
            className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
            style={{
              backgroundImage: `url(${prefs.customBg})`,
              opacity: prefs.customBgOpacity ?? 0.7,
              filter: (prefs.customBgBlur ?? 2) > 0 ? `blur(${prefs.customBgBlur}px)` : undefined,
              transform: (prefs.customBgBlur ?? 2) > 0 ? "scale(1.05)" : undefined,
            }}
          />
          {/* Subtle Ambient Vignette Scrim */}
          <div
            className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"
          />
        </>
      )}

      {/* Top bar */}
      <div
        className="sticky top-0 z-30 border-b relative transition-colors backdrop-blur-md"
        style={{
          backgroundColor: prefs.customBg ? "rgba(11, 11, 15, 0.85)" : t.panel,
          borderColor: prefs.customBg ? "rgba(255, 255, 255, 0.1)" : t.border,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => router.push(browseAnchorHref("/novel"))}
              className="flex items-center justify-center h-9 w-9 shrink-0 rounded-lg hover:bg-fuchsia-500/10 hover:text-fuchsia-400 transition"
              style={{ color: prefs.customBg ? "#e2e8f0" : t.muted }}
              title="Back to browsing"
            >
              <Home className="w-4 h-4" />
            </button>

            <Link
              href={`/novel/${encodeURIComponent(id)}`}
              replace
              className="flex items-center gap-2 hover:text-fuchsia-400 transition text-sm font-bold min-w-0"
              style={{ color: prefs.customBg ? "#e2e8f0" : t.muted }}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline line-clamp-1">{novel?.title || "Back"}</span>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {novel?.alternativeServers && novel.alternativeServers.length > 1 && (
              <div className="relative group mr-2">
                <div 
                  className="flex items-center gap-1.5 px-2 h-9 rounded-lg hover:bg-fuchsia-500/10 hover:text-fuchsia-400 transition cursor-pointer"
                  style={{ color: prefs.customBg ? "#e2e8f0" : t.muted }}
                  title="Switch Server"
                >
                  <Server className="w-4 h-4" />
                </div>
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
                          ? "bg-fuchsia-500/10 text-fuchsia-400 font-bold" 
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
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg hover:bg-fuchsia-500/10 hover:text-fuchsia-400 transition font-black"
              style={{ color: prefs.customBg ? "#f8fafc" : t.muted }}
              title="Reading settings"
            >
              <span className="font-serif text-[15px] leading-none">Aa</span>
            </button>
            <button
              onClick={() => setShowChapters(true)}
              className="p-2 rounded-lg hover:bg-fuchsia-500/10 hover:text-fuchsia-400 transition"
              style={{ color: prefs.customBg ? "#f8fafc" : t.muted }}
              title="Chapters"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-40 flex justify-center">
          <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
        </div>
      ) : !chapter || !chapter.content?.length || (chapter as any).error ? (
        <div className="py-32 px-4 text-center" style={{ color: t.muted }}>
          <p className="text-lg font-bold mb-2 text-white">Unable to load Chapter {chapterId}</p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: t.muted }}>
            The chapter is syncing with the translation mirrors. Please tap retry to reload.
          </p>
          <button
            onClick={retryChapter}
            className="px-6 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold rounded-xl transition text-sm shadow-lg shadow-fuchsia-500/20"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <article className={`${widthCls} mx-auto px-4 sm:px-6 py-8 sm:py-12`} style={{ fontFamily: fontCss }}>
          {/* Reading Card Container */}
          <div
            className={
              prefs.customBg && prefs.customBgCardStyle !== "seamless"
                ? "rounded-3xl border border-white/10 p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all"
                : "transition-all"
            }
            style={{
              backgroundColor:
                prefs.customBg && prefs.customBgCardStyle !== "seamless"
                  ? `rgba(11, 11, 15, ${prefs.customBgCardOpacity ?? 0.85})`
                  : undefined,
              color: prefs.customBg ? "#f8fafc" : t.text,
            }}
          >
            <h1
              className="text-2xl sm:text-3xl font-black mb-8 text-center tracking-tight"
              style={{ color: prefs.customBg ? "#ffffff" : t.text }}
            >
              {chapter.title}
            </h1>
            <div
              className="space-y-6 leading-relaxed"
              style={{
                fontSize: prefs.size,
                lineHeight,
                textAlign: prefs.justify ? "justify" : "left",
                textShadow:
                  prefs.customBg && prefs.customBgCardStyle === "seamless"
                    ? "0 2px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)"
                    : undefined,
              }}
            >
              {(chapter.content || []).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {/* Bottom nav */}
            <div className="mt-10 flex flex-col gap-4 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => go(prevId)}
                  disabled={!prevId}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border disabled:opacity-30 hover:border-fuchsia-500/40 transition font-bold text-sm"
                  style={{
                    backgroundColor: prefs.customBg ? "rgba(255,255,255,0.05)" : t.panel,
                    borderColor: prefs.customBg ? "rgba(255,255,255,0.1)" : t.border,
                    color: prefs.customBg ? "#ffffff" : t.text,
                  }}
                >
                  <ChevronLeft className="w-5 h-5" /> Previous
                </button>
                <button
                  onClick={() => setShowChapters(true)}
                  className="p-3 rounded-xl border hover:border-fuchsia-500/40 transition"
                  style={{
                    backgroundColor: prefs.customBg ? "rgba(255,255,255,0.05)" : t.panel,
                    borderColor: prefs.customBg ? "rgba(255,255,255,0.1)" : t.border,
                    color: prefs.customBg ? "#ffffff" : t.text,
                  }}
                  title="Chapters"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => go(initialNextId)}
                  disabled={!initialNextId}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-fuchsia-500 text-black disabled:opacity-30 hover:bg-fuchsia-400 transition font-bold text-sm shadow-lg shadow-fuchsia-500/20"
                >
                  Next Chapter <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Per-chapter discussion */}
          <div
            className="mt-12 rounded-3xl border border-white/10 bg-[#070709]/95 px-4 py-5 sm:px-6 shadow-xl backdrop-blur-md"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui)", color: "#e2e8f0" }}
          >
            <CommunityFeed
              novelId={id}
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
              <button onClick={() => setShowChapters(false)} className="p-2 rounded-full hover:bg-fuchsia-500/10 hover:text-fuchsia-400" style={{ color: t.muted }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {drawerChapters.map((c) => {
                const active = c.id === chapterId;
                return (
                  <button
                    key={c.id}
                    ref={active ? activeDrawerRowRef : undefined}
                    onClick={() => {
                      setShowChapters(false);
                      go(c.id);
                    }}
                    className={`w-full text-left px-5 py-3 border-b text-sm transition ${active ? "bg-fuchsia-500/15 text-fuchsia-300 font-bold" : "hover:bg-fuchsia-500/5"}`}
                    style={{ borderColor: t.border, color: active ? undefined : t.muted }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      {active && (
                        <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-300">
                          Reading
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <Link
                href={`/novel/${encodeURIComponent(id)}`}
                onClick={() => setShowChapters(false)}
                className="block text-center text-fuchsia-400 text-xs font-bold py-4 hover:underline"
              >
                View all chapters →
              </Link>
            </div>
          </div>
        </>
      )}
      <ResumeBar offer={resumeOffer} onResume={resume} onStartFresh={startFresh} />
    </div>
  );
}
