"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, List, Loader2, Settings, X } from "lucide-react";
import { encodeLnori, lnoriFileUrl } from "@/lib/novel/lnoriProxy";
import {
  useNovelReaderPrefs, themeById, fontById, spacingById, widthById,
  READER_THEMES, READER_FONTS, READER_SPACING, READER_WIDTHS, SIZE_MIN, SIZE_MAX,
} from "@/lib/novel/readerPrefs";
import EpubJsReader from "@/components/reading/EpubJsReader";

/**
 * THE BOOK IS THE PAGE, AND IT SCROLLS.
 *
 * lnori.com's own reader — inspected live for the exact book ours choked on —
 * uses no epub.js at all: the text is plain HTML in an article, and its
 * contents are ordinary #anchor links into one long document. Every problem
 * epub.js gave us (iframes that resist theming, spine lookups that silently
 * miss, frames measured from their own content) belongs to an architecture it
 * simply does not use.
 *
 * So the server unpacks the EPUB and hands over sanitised HTML, and this
 * renders it as ONE continuous column. Sections are appended as you approach
 * the bottom rather than all at once: a volume is thirty-odd sections, and
 * loading them up front would trade the paging problem for a slow first paint.
 * Reading simply carries on into the next chapter.
 *
 * If extraction ever fails on an odd book, EpubJsReader takes over.
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

/** Start fetching the next section this far from the bottom, in px. */
const PREFETCH_MARGIN = 1500;

export default function EpubReader({ file, title, novelId }: EpubReaderProps) {
  const { prefs, update } = useNovelReaderPrefs();
  const t = themeById(prefs.theme);
  const fontCss = fontById(prefs.font).css;
  const lineHeight = spacingById(prefs.spacing).value;
  const widthCls = widthById(prefs.width).cls;

  const [sections, setSections] = useState<SectionPayload[]>([]);
  const [count, setCount] = useState(0);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [current, setCurrent] = useState(0);
  const [booting, setBooting] = useState(true);
  const [appending, setAppending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef<HTMLElement>(null);
  const pendingFragRef = useRef<string | null>(null);
  /**
   * Guards the appender while a fetch is in flight. Scroll events arrive far
   * faster than the network answers, so without this one flick near the bottom
   * would request the same section a dozen times.
   */
  const busyRef = useRef(false);

  const b = encodeLnori(file);
  const secKey = "epub-sec:" + file;

  const fetchSection = useCallback(
    async (index: number): Promise<SectionPayload | null> => {
      const res = await fetch(
        "/api/proxy/lnori/section?b=" + encodeURIComponent(b) + "&sec=" + index
      ).catch(() => null);
      if (!res || !res.ok) return null;
      return res.json().catch(() => null);
    },
    [b]
  );

  /** Open at `index`, discarding what came before it. */
  const jumpTo = useCallback(
    async (index: number, fragment?: string) => {
      setTocOpen(false);
      setBooting(true);
      pendingFragRef.current = fragment || null;
      const payload = await fetchSection(index);
      if (!payload) {
        // The extractor could not parse this book — hand over to epub.js
        // rather than show an error for a book the old reader can open.
        setFallback(true);
        return;
      }
      setCount(payload.count);
      setToc(payload.toc);
      setSections([payload]);
      setCurrent(payload.index);
      setBooting(false);
    },
    [fetchSection]
  );

  // First load resumes where the volume was left, so reopening does not always
  // start at the cover.
  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(secKey)) || 0;
    } catch {
      /* private mode */
    }
    jumpTo(saved);
    // Once per file, deliberately: re-running would yank the reader back to
    // the saved section mid-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const appendNext = useCallback(async () => {
    if (busyRef.current) return;
    const last = sections[sections.length - 1];
    if (!last || last.index + 1 >= count) return;

    busyRef.current = true;
    setAppending(true);
    const payload = await fetchSection(last.index + 1);
    if (payload) {
      setSections((prev) =>
        prev.some((s) => s.index === payload.index) ? prev : [...prev, payload]
      );
    }
    setAppending(false);
    busyRef.current = false;
  }, [sections, count, fetchSection]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - PREFETCH_MARGIN) appendNext();
  };

  /**
   * Which section is being read, for the header label and the resume point.
   *
   * An observer rather than scroll arithmetic, because sections are appended
   * while you read: offsets shift under you, and anything derived from a
   * stored offset goes stale the moment the next section lands.
   */
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number((entry.target as HTMLElement).dataset.sec);
          if (isNaN(idx)) return;
          setCurrent(idx);
          try {
            localStorage.setItem(secKey, String(idx));
          } catch {
            /* private mode */
          }
        });
      },
      // A section counts once its top reaches the upper fifth of the viewport.
      { root, rootMargin: "0px 0px -80% 0px", threshold: 0 }
    );
    root.querySelectorAll("[data-sec]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections, secKey]);

  // Land on the requested anchor (or the top) once a jump has rendered.
  useEffect(() => {
    if (booting || !sections.length) return;
    const frag = pendingFragRef.current;
    pendingFragRef.current = null;
    requestAnimationFrame(() => {
      if (frag) {
        const el = scrollRef.current?.querySelector("#" + CSS.escape(frag));
        if (el) {
          el.scrollIntoView({ block: "start" });
          return;
        }
      }
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, [booting, sections.length]);

  /**
   * Footnotes and cross-references. The extractor turned their hrefs into data
   * attributes precisely so they can be routed here rather than navigating the
   * whole app to a zip path.
   */
  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[data-epub-sec]");
    if (!a) return;
    e.preventDefault();
    const idx = Number(a.getAttribute("data-epub-sec"));
    if (isNaN(idx)) return;
    const frag = a.getAttribute("data-epub-frag") || undefined;

    // Already on screen? Scroll to it and keep everything loaded, rather than
    // throwing the reading position away to fetch what is already here.
    if (sections.some((s) => s.index === idx)) {
      const sel = frag ? "#" + CSS.escape(frag) : '[data-sec="' + idx + '"]';
      const el = scrollRef.current?.querySelector(sel);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
    }
    jumpTo(idx, frag);
  };

  if (fallback) {
    return <EpubJsReader file={file} title={title} novelId={novelId} />;
  }

  const currentLabel = [...toc].reverse().find((e) => e.index <= current)?.label;
  const atEnd = sections.length > 0 && sections[sections.length - 1].index >= count - 1;
  const chipBtn = "grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: t.bg, color: t.text }}>
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
            {currentLabel && (
              <p className="line-clamp-1 font-mono text-[11px]" style={{ color: t.muted }}>
                {currentLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {count > 0 && (
            <span className="hidden font-mono text-xs tabular-nums sm:inline" style={{ color: t.muted }}>
              {current + 1} / {count}
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

      <main ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
        {tocOpen && (
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
            {toc.length === 0 ? (
              <p className="px-2 py-6 text-center font-mono text-xs" style={{ color: t.muted }}>
                No contents listed.
              </p>
            ) : (
              toc.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(entry.index, entry.fragment || undefined)}
                  className="block w-full rounded-lg px-2 py-2 text-left font-mono text-xs transition hover:bg-white/10"
                  style={{ color: entry.index === current ? "#f472b6" : t.text }}
                >
                  {entry.label}
                </button>
              ))
            )}
          </div>
        )}

        {booting ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: t.muted }} />
          </div>
        ) : (
          <div
            onClick={onContentClick}
            className={`mx-auto w-full ${widthCls} px-5 pb-24 pt-8 sm:px-8`}
            style={{
              fontFamily: fontCss,
              fontSize: prefs.size,
              lineHeight,
              textAlign: prefs.justify ? "justify" : undefined,
            }}
          >
            {sections.map((s) => (
              <section
                key={s.index}
                data-sec={s.index}
                className="epub-html"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
            ))}

            {appending && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: t.muted }} />
              </div>
            )}

            {!appending && atEnd && (
              <p className="py-10 text-center font-mono text-xs" style={{ color: t.muted }}>
                End of volume
              </p>
            )}
          </div>
        )}
      </main>

      {/* The book's markup arrives unstyled, so give its images and tables sane
          behaviour inside our column. Scoped to .epub-html so it cannot leak
          into the reader's own chrome. */}
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
