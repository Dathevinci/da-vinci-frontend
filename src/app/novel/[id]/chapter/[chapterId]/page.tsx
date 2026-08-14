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

  const [loadedSections, setLoadedSections] = useState<{ id: string; title: string; content: string[] }[]>([]);
  const [loadingNext, setLoadingNext] = useState(false);
  const [autoLoad, setAutoLoad] = useState(true);
  const bottomObserverRef = useRef<HTMLDivElement>(null);

  // Fetch the chapter + save reading progress.
  useEffect(() => {
    setLoading(true);
    setChapter(null);
    setLoadedSections([]);
    fetch(`/api/novels/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
      .then((r) => r.json())
      .then((data) => {
        const ch = data && data.error ? null : data;
        setChapter(ch);
        if (ch && ch.content?.length) {
          setLoadedSections([{ id: chapterId, title: ch.title, content: ch.content }]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [id, chapterId]);

  // Fetch the novel once for the chapter list + reliable prev/next.
  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setNovel(data && data.error ? null : data))
      .catch(() => {});
  }, [id]);

  const chapters = novel?.chapters || [];
  const idx = chapters.findIndex((c) => c.id === chapterId);
  const prevId = (idx > 0 ? chapters[idx - 1]?.id : null) || chapter?.prev || null;
  
  // Calculate next chapter based on the last loaded section
  const lastSectionId = loadedSections.length > 0 ? loadedSections[loadedSections.length - 1].id : chapterId;
  const lastIdx = chapters.findIndex((c) => c.id === lastSectionId);
  const currentNextId = (lastIdx >= 0 && lastIdx < chapters.length - 1 ? chapters[lastIdx + 1]?.id : null) || 
    (lastSectionId ? String(parseInt(lastSectionId) + 1) : null) || chapter?.next || null;
  const initialNextId = (idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1]?.id : null) || chapter?.next || null;

  // Auto-load next chapter on scroll into view
  useEffect(() => {
    if (!autoLoad || loading || loadingNext || !currentNextId || loadedSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingNext && currentNextId) {
          setLoadingNext(true);
          fetch(`/api/novels/${encodeURIComponent(id)}/chapter/${encodeURIComponent(currentNextId)}`)
            .then((r) => r.json())
            .then((nextData) => {
              if (nextData && nextData.content?.length && !nextData.error) {
                setLoadedSections((prev) => {
                  // Prevent duplicate sections
                  if (prev.some(s => s.id === currentNextId)) return prev;
                  return [
                    ...prev,
                    { id: currentNextId, title: nextData.title, content: nextData.content }
                  ];
                });
                if (novel?.title) {
                  recordReading("novel", { id, title: novel.title, cover: novel.cover, chapterId: currentNextId, chapterTitle: nextData.title });
                  writeLocalProgress("novel", id, currentNextId, Date.now());
                }
              }
              setLoadingNext(false);
            })
            .catch(() => setLoadingNext(false));
        }
      },
      { rootMargin: "200px" }
    );

    const el = bottomObserverRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [autoLoad, loading, loadingNext, currentNextId, id, novel, loadedSections.length]);

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

  const retryChapter = () => {
    setLoading(true);
    setChapter(null);
    setLoadedSections([]);
    fetch(`/api/novels/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chapterId)}`)
      .then((r) => r.json())
      .then((data) => {
        const ch = data && data.error ? null : data;
        setChapter(ch);
        if (ch && ch.content?.length) {
          setLoadedSections([{ id: chapterId, title: ch.title, content: ch.content }]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const go = (cid: string | null) => {
    if (cid) router.push(`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(cid)}`);
  };

  return (
    <div className="min-h-screen selection:bg-pink-500/30" style={{ backgroundColor: t.bg, color: t.text }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ backgroundColor: t.panel + "e6", borderColor: t.border }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => router.push(browseAnchorHref("/novel"))}
              className="flex items-center justify-center h-9 w-9 shrink-0 rounded-lg hover:bg-pink-500/10 hover:text-pink-400 transition"
              style={{ color: t.muted }}
              title="Back to browsing"
            >
              <Home className="w-4 h-4" />
            </button>

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
      ) : !chapter || !chapter.content?.length || (chapter as any).error ? (
        <div className="py-32 px-4 text-center" style={{ color: t.muted }}>
          <p className="text-lg font-bold mb-2 text-white">Unable to load Chapter {chapterId}</p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: t.muted }}>
            The chapter is syncing with the translation mirrors. Please tap retry to reload.
          </p>
          <button
            onClick={retryChapter}
            className="px-6 py-2.5 bg-pink-500 hover:bg-pink-400 text-black font-bold rounded-xl transition text-sm shadow-lg shadow-pink-500/20"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <article className={`${widthCls} mx-auto px-5 sm:px-8 py-10`} style={{ fontFamily: fontCss }}>
          {/* Render all loaded sections (initial chapter + auto-loaded continuous chapters) */}
          {loadedSections.map((sec, secIdx) => (
            <div key={sec.id} className={secIdx > 0 ? "mt-20 pt-12 border-t border-dashed" : ""} style={{ borderColor: t.border }}>
              {secIdx > 0 && (
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10" style={{ borderColor: t.border }}>
                    Next Chapter Auto-Loaded
                  </span>
                </div>
              )}
              <h1 className="text-2xl font-black mb-8 text-center" style={{ color: t.text }}>{sec.title}</h1>
              <div className="space-y-5" style={{ fontSize: prefs.size, lineHeight, textAlign: prefs.justify ? "justify" : "left" }}>
                {sec.content.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ))}

          {/* Auto-loading trigger sentinel */}
          <div ref={bottomObserverRef} className="py-6 flex flex-col items-center justify-center">
            {loadingNext && (
              <div className="flex items-center gap-3 text-sm font-bold text-pink-400 py-4 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
                Auto-loading next chapter...
              </div>
            )}
          </div>

          {/* Bottom nav and Auto-load Toggle */}
          <div className="mt-8 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2 text-xs" style={{ color: t.muted }}>
              <span>Continuous Reading:</span>
              <button
                onClick={() => setAutoLoad(!autoLoad)}
                className={`px-3 py-1 rounded-full font-bold transition ${
                  autoLoad ? "bg-pink-500/20 text-pink-400 border border-pink-500/40" : "bg-white/5 text-slate-400 border border-white/10"
                }`}
              >
                Auto-Load Next: {autoLoad ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
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
                onClick={() => go(currentNextId || initialNextId)}
                disabled={!currentNextId && !initialNextId}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-500 text-black disabled:opacity-30 hover:bg-pink-400 transition font-bold text-sm"
              >
                Next Chapter <ChevronRight className="w-5 h-5" />
              </button>
            </div>
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
