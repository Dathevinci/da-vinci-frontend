"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ChevronLeft, Download, List, Loader2, Settings, X,
} from "lucide-react";
import { encodeLnori, lnoriFileUrl } from "@/lib/novel/lnoriProxy";
import {
  useNovelReaderPrefs, themeById, fontById, spacingById, widthById,
  READER_THEMES, READER_FONTS, READER_SPACING, READER_WIDTHS, SIZE_MIN, SIZE_MAX,
} from "@/lib/novel/readerPrefs";
import EpubJsReader from "@/components/reading/EpubJsReader";

/**
 * THE BOOK IS THE PAGE NOW.
 *
 * Inspected lnori.com's own reader for the exact book ours choked on: it has
 * no epub.js at all. The chapter is plain HTML in an article element, the
 * contents are ordinary anchor links, and every feature is trivial because the
 * book lives in the page's own DOM. Every problem we fought — iframes that
 * resist theming, spine lookups that miss, frames measured from their own
 * content — belongs to the architecture they simply do not use.
 *
 * So this reader does what they do. The server unpacks the EPUB (once, cached)
 * and hands over one spine section at a time as sanitised HTML; we render it
 * in OUR page with the same preference system as the novel text reader —
 * five themes, seven fonts, size, spacing, width — because it is just text in
 * a div now.
 *
 * If extraction fails on some odd book, the epub.js reader (EpubJsReader)
 * still exists and takes over automatically.
 */
interface EpubReaderProps {
  /** The real .epub address. Never rendered into a URL the browser can see. */
  file: string;
  title: string;
  novelId: string;
}

interface TocEntry {
  label: string;
  index: number;
  fragment: string;
}

interface SectionPayload {
  index: number;
  count: number;
  html: string;
  toc: TocEntry[];
}

export default function EpubReader({ file, title, novelId }: EpubReaderProps) {
  const { prefs, update } = useNovelReaderPrefs();
  const t = themeById(prefs.theme);
  const fontCss = fontById(prefs.font).css;
  const lineHeight = spacingById(prefs.spacing).value;
  const widthCls = widthById(prefs.width).cls;

  const [sec, setSec] = useState<number | null>(null);
  const [data, setData] = useState<SectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pendingFragRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const b = encodeLnori(file);
  const secKey = "epub-sec:" + file;

  // Restore the saved section before the first fetch, so reopening a volume
  // lands where you left it instead of flashing the cover first.
  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(secKey)) || 0;
    } catch {
      /* private mode */
    }
    setSec(saved);
  }, [secKey]);

  useEffect(() => {
    if (sec === null) return;
    let alive = true;
    setLoading(true);
    fetch("/api/proxy/lnori/section?b=" + encodeURIComponent(b) + "&sec=" + sec)
      .then((r) => {
        if (!r.ok) throw new Error("extract failed");
        return r.json();
      })
      .then((payload: SectionPayload) => {
        if (!alive) return;
        setData(payload);
        setLoading(false);
        try {
          localStorage.setItem(secKey, String(payload.index));
        } catch {
          /* private mode */
        }
      })
      .catch(() => {
        // The extractor could not parse this book — hand over to epub.js
        // rather than showing an error for a book the old reader can open.
        if (alive) setFallback(true);
      });
    return () => {
      alive = false;
    };
  }, [b, sec, secKey]);

  // New section: back to the top, unless a #fragment inside it was requested.
  useEffect(() => {
    if (!data) return;
    const frag = pendingFragRef.current;
    pendingFragRef.current = null;
    requestAnimationFrame(() => {
      if (frag) {
        const el = contentRef.current?.querySelector("#" + CSS.escape(frag));
        if (el) {
          el.scrollIntoView({ block: "start" });
          return;
        }
      }
      contentRef.current?.closest("main")?.scrollTo({ top: 0 });
    });
  }, [data]);

  const go = useCallback(
    (index: number, fragment?: string) => {
      pendingFragRef.current = fragment || null;
      setTocOpen(false);
      setSec(Math.max(0, index));
    },
    []
  );

  // Footnotes and cross-references inside the book: the extractor turned their
  // hrefs into data attributes precisely so we can route them here instead of
  // letting the browser navigate to a zip path.
  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[data-epub-sec]");
    if (!a) return;
    e.preventDefault();
    const idx = Number(a.getAttribute("data-epub-sec"));
    if (!isNaN(idx)) go(idx, a.getAttribute("data-epub-frag") || undefined);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!data) return;
      if (e.key === "ArrowRight" && data.index < data.count - 1) go(data.index + 1);
      if (e.key === "ArrowLeft" && data.index > 0) go(data.index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, go]);

  if (fallback) {
    return <EpubJsReader file={file} title={title} novelId={novelId} />;
  }

  const currentToc = data
    ? [...data.toc].reverse().find((e) => e.index <= data.index)
    : undefined;

  const chipBtn =
    "grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10 disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: t.bg, color: t.text }}>
      {/* top bar */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4"
        style={{ backgroundColor: t.panel, borderColor: t.border }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => setTocOpen((v) => !v)} className={chipBtn} style={{ color: t.text }} title="Contents">
            <List className="h-5 w-5" />
          </button>
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className={chipBtn}
            style={{ color: t.text }}
            title="Back to series"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="line-clamp-1 font-mono text-sm font-bold sm:text-base">{title}</h1>
            {currentToc && (
              <p className="line-clamp-1 font-mono text-[11px]" style={{ color: t.muted }}>
                {currentToc.label}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {data && (
            <span className="hidden font-mono text-xs tabular-nums sm:inline" style={{ color: t.muted }}>
              {data.index + 1} / {data.count}
            </span>
          )}
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={chipBtn}
            style={{ color: settingsOpen ? t.text : t.muted }}
            title="Reading settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <a
            href={lnoriFileUrl(file, true)}
            className="ml-1 flex items-center gap-2 rounded-lg bg-pink-500 px-3 py-2 font-mono text-xs font-bold text-white transition hover:bg-pink-600"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">EPUB</span>
          </a>
        </div>
      </div>

      {/* settings */}
      {settingsOpen && (
        <div
          className="shrink-0 space-y-3 border-b px-4 py-3"
          style={{ backgroundColor: t.panel, borderColor: t.border }}
        >
          <div className="flex flex-wrap gap-2">
            {READER_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => update({ theme: theme.id })}
                className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold transition ${
                  prefs.theme === theme.id ? "ring-2 ring-pink-500" : ""
                }`}
                style={{ backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }}
              >
                {theme.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {READER_FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => update({ font: f.id })}
                className="rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold transition hover:bg-white/10"
                style={{
                  color: prefs.font === f.id ? t.text : t.muted,
                  borderColor: prefs.font === f.id ? t.text : t.border,
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 font-mono text-xs" style={{ color: t.muted }}>
              Size
              <input
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                value={prefs.size}
                onChange={(e) => update({ size: Number(e.target.value) })}
                className="h-1 w-28 cursor-pointer accent-pink-500"
              />
              <span className="tabular-nums" style={{ color: t.text }}>{prefs.size}px</span>
            </label>
            <div className="flex gap-1">
              {READER_SPACING.map((s) => (
                <button
                  key={s.id}
                  onClick={() => update({ spacing: s.id })}
                  className="rounded-lg border px-2.5 py-1 font-mono text-[11px] transition hover:bg-white/10"
                  style={{
                    color: prefs.spacing === s.id ? t.text : t.muted,
                    borderColor: prefs.spacing === s.id ? t.text : t.border,
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {READER_WIDTHS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => update({ width: w.id })}
                  className="rounded-lg border px-2.5 py-1 font-mono text-[11px] transition hover:bg-white/10"
                  style={{
                    color: prefs.width === w.id ? t.text : t.muted,
                    borderColor: prefs.width === w.id ? t.text : t.border,
                  }}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* body */}
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {tocOpen && data && (
          <div
            className="absolute inset-y-0 left-0 z-20 w-[300px] overflow-y-auto border-r p-3"
            style={{ backgroundColor: t.panel, borderColor: t.border }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: t.muted }}>
                Contents
              </span>
              <button onClick={() => setTocOpen(false)} className={chipBtn} style={{ color: t.text }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {data.toc.length === 0 ? (
              <p className="px-2 py-6 text-center font-mono text-xs" style={{ color: t.muted }}>
                No contents listed.
              </p>
            ) : (
              data.toc.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => go(entry.index, entry.fragment || undefined)}
                  className="block w-full rounded-lg px-2 py-2 text-left font-mono text-xs transition hover:bg-white/10"
                  style={{
                    color: entry.index === data.index ? "#f472b6" : t.text,
                  }}
                >
                  {entry.label}
                </button>
              ))
            )}
          </div>
        )}

        {loading || !data ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: t.muted }} />
          </div>
        ) : (
          <div
            ref={contentRef}
            onClick={onContentClick}
            className={`epub-html mx-auto w-full ${widthCls} px-5 pb-28 pt-8 sm:px-8`}
            style={{
              fontFamily: fontCss,
              fontSize: prefs.size,
              lineHeight,
              textAlign: prefs.justify ? "justify" : undefined,
            }}
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        )}

        {/* prev / next */}
        {data && !loading && (
          <div
            className="pointer-events-none sticky bottom-0 flex items-center justify-between px-4 pb-4"
          >
            <button
              onClick={() => go(data.index - 1)}
              disabled={data.index <= 0}
              className="pointer-events-auto flex items-center gap-1.5 rounded-xl border px-4 py-2.5 font-mono text-xs font-bold shadow-lg backdrop-blur transition hover:border-pink-500/40 disabled:opacity-30"
              style={{ backgroundColor: t.panel, borderColor: t.border, color: t.text }}
            >
              <ArrowLeft className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={() => go(data.index + 1)}
              disabled={data.index >= data.count - 1}
              className="pointer-events-auto flex items-center gap-1.5 rounded-xl border px-4 py-2.5 font-mono text-xs font-bold shadow-lg backdrop-blur transition hover:border-pink-500/40 disabled:opacity-30"
              style={{ backgroundColor: t.panel, borderColor: t.border, color: t.text }}
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>

      {/* The book's own markup arrives unstyled, so give its images and tables
          sane behaviour inside our column. Scoped by the .epub-html class. */}
      <style>{`
        .epub-html img { max-width: 100%; height: auto; display: block; margin: 1.25em auto; }
        .epub-html svg { max-width: 100%; height: auto; }
        .epub-html p { margin: 0.9em 0; }
        .epub-html h1, .epub-html h2, .epub-html h3 { margin: 1.4em 0 0.7em; font-weight: 700; }
        .epub-html a[data-epub-sec] { color: #f472b6; cursor: pointer; text-decoration: underline; }
        .epub-html table { max-width: 100%; overflow-x: auto; display: block; }
        .epub-html hr { margin: 2em auto; opacity: 0.3; }
      `}</style>
    </div>
  );
}
