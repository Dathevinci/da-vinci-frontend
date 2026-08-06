"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Minus, Plus, Type } from "lucide-react";
import {
  useNovelReaderPrefs,
  themeById,
  READER_THEMES,
  READER_FONTS,
  SIZE_MIN,
  SIZE_MAX,
} from "@/lib/novel/readerPrefs";

/**
 * epub.js reaches for `window` as it initialises, so this never renders on the
 * server. It was being SSR'd before, which is the sort of thing that works
 * until a particular book makes it not work.
 */
const ReactReader = dynamic(() => import("react-reader").then((m) => m.ReactReader), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#100f0d] text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

/**
 * The book renders inside an iframe with its own document, so the app's CSS
 * variables (`var(--font-lora)`) resolve to nothing in there. These are the
 * same faces expressed as plain stacks the iframe can actually use.
 */
const EPUB_FONTS: Record<string, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  lora: "Georgia, 'Iowan Old Style', serif",
  merriweather: "Georgia, 'Book Antiqua', serif",
  literata: "Georgia, Cambria, serif",
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  lexend: "system-ui, 'Trebuchet MS', sans-serif",
  mono: "ui-monospace, 'Courier New', monospace",
};

interface EpubReaderProps {
  url: string;
  downloadUrl?: string;
  title: string;
  novelId: string;
}

export default function EpubReader({ url, downloadUrl, title, novelId }: EpubReaderProps) {
  const { prefs, update } = useNovelReaderPrefs();
  const t = themeById(prefs.theme);
  const [location, setLocation] = useState<string | number>(0);
  const [panel, setPanel] = useState(false);
  const renditionRef = useRef<any>(null);

  // Per-volume, so each book in a series remembers its own page.
  const locKey = `epub-loc:${url}`;

  /**
   * Restored in an effect rather than in useState, deliberately: seeding state
   * from localStorage during render makes the server and client disagree about
   * the first paint. The book opens at the start for one frame and then jumps
   * to where you were, which is the cheaper of the two problems.
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(locKey);
      if (saved) setLocation(saved);
    } catch {
      /* private mode */
    }
  }, [locKey]);

  const onLocationChanged = (cfi: string) => {
    setLocation(cfi);
    try {
      localStorage.setItem(locKey, cfi);
    } catch {
      /* private mode */
    }
  };

  // Push the reader's theme through to the book's own document.
  const applyTheme = useCallback(
    (r: any) => {
      if (!r) return;
      try {
        r.themes.override("color", t.text);
        r.themes.override("background", t.bg);
        r.themes.fontSize(`${prefs.size}px`);
        r.themes.font(EPUB_FONTS[prefs.font] || EPUB_FONTS.serif);
      } catch {
        /* a book that refuses styling still reads */
      }
    },
    [t.text, t.bg, prefs.size, prefs.font]
  );

  useEffect(() => {
    applyTheme(renditionRef.current);
  }, [applyTheme]);

  const turn = useCallback((dir: "next" | "prev") => {
    try {
      dir === "next" ? renditionRef.current?.next() : renditionRef.current?.prev();
    } catch {
      /* not ready yet */
    }
  }, []);

  /**
   * Arrow keys, from both documents. Keystrokes landing inside the book's
   * iframe never reach the parent window, so listening here alone would only
   * work while focus happened to be on the chrome — which is exactly when you
   * are not reading.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn("next");
      if (e.key === "ArrowLeft") turn("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const setSize = (delta: number) =>
    update({ size: Math.min(SIZE_MAX, Math.max(SIZE_MIN, prefs.size + delta)) });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: t.bg }}>
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ backgroundColor: t.panel, borderColor: t.border }}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* `replace`: this arrow is a back control, and pushing the novel
              page on top of the volume left the browser's own back button
              returning you straight into the book you had just closed. */}
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className="rounded-full p-2 transition hover:bg-white/10"
            style={{ color: t.text }}
            title="Back to series"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="line-clamp-1 font-mono text-sm font-bold sm:text-base" style={{ color: t.text }}>
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setSize(-1)}
            disabled={prefs.size <= SIZE_MIN}
            className="rounded-lg p-2 transition hover:bg-white/10 disabled:opacity-30"
            style={{ color: t.muted }}
            title="Smaller text"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-mono text-xs tabular-nums" style={{ color: t.muted }}>
            {prefs.size}
          </span>
          <button
            onClick={() => setSize(1)}
            disabled={prefs.size >= SIZE_MAX}
            className="rounded-lg p-2 transition hover:bg-white/10 disabled:opacity-30"
            style={{ color: t.muted }}
            title="Larger text"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={() => setPanel((p) => !p)}
            className="rounded-lg p-2 transition hover:bg-white/10"
            style={{ color: panel ? t.text : t.muted }}
            title="Theme and font"
          >
            <Type className="h-4 w-4" />
          </button>

          <a
            href={downloadUrl || url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 flex items-center gap-2 rounded-lg bg-pink-500 px-3 py-2 font-mono text-xs font-bold text-white transition hover:bg-pink-600"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">EPUB</span>
          </a>
        </div>
      </div>

      {panel && (
        <div
          className="border-b px-4 py-3"
          style={{ backgroundColor: t.panel, borderColor: t.border }}
        >
          <div className="mb-3 flex flex-wrap gap-2">
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
        </div>
      )}

      {/* The frame carries the theme colour too — the reader letterboxes the
          page inside it, and a white gutter around a dark page is worse than
          no theming at all. */}
      <div className="relative flex-1" style={{ backgroundColor: t.bg }}>
        <ReactReader
          url={url}
          location={location}
          locationChanged={onLocationChanged}
          title={title}
          showToc
          getRendition={(r: any) => {
            renditionRef.current = r;
            applyTheme(r);
            try {
              r.on("keyup", (e: KeyboardEvent) => {
                if (e.key === "ArrowRight") r.next();
                if (e.key === "ArrowLeft") r.prev();
              });
            } catch {
              /* older rendition builds */
            }
          }}
          epubInitOptions={{ openAs: "epub" }}
          epubOptions={{ flow: "paginated", manager: "continuous" }}
        />
      </div>
    </div>
  );
}
