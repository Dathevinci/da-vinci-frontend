"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, List, ArrowLeft, X, Server } from "lucide-react";
import type { NovelInfo, ChapterContent } from "@/lib/novel/ReadNovelFull";
import { useUser } from "@/hooks/useUser";
import { earnPoints } from "@/lib/earn";
import { useNovelReaderPrefs, themeById, fontById, spacingById, widthById } from "@/lib/novel/readerPrefs";
import ReaderSettings from "@/components/novel/ReaderSettings";

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
    try {
      localStorage.setItem(`novel-progress:${id}`, chapterId);
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [id, chapterId]);

  // Fetch the novel once for the chapter list + reliable prev/next.
  useEffect(() => {
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setNovel(data && data.error ? null : data))
      .catch(() => {});
  }, [id]);

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

  return (
    <div className="min-h-screen selection:bg-pink-500/30" style={{ backgroundColor: t.bg, color: t.text }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ backgroundColor: t.panel + "e6", borderColor: t.border }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href={`/novel/${encodeURIComponent(id)}`} className="flex items-center gap-2 hover:text-pink-400 transition text-sm font-bold min-w-0" style={{ color: t.muted }}>
            <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline line-clamp-1">{novel?.title || "Back"}</span>
          </Link>
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
