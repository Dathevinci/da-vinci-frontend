"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Columns2, Download, Loader2, Minus, Plus, ScrollText, Type } from "lucide-react";
import {
  useNovelReaderPrefs,
  themeById,
  spacingById,
  READER_THEMES,
  READER_FONTS,
  SIZE_MIN,
  SIZE_MAX,
} from "@/lib/novel/readerPrefs";
import { lnoriFileUrl } from "@/lib/novel/lnoriProxy";

/**
 * epub.js reaches for `window` as it initialises, so this never renders on the
 * server.
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

type Flow = "scrolled-doc" | "paginated";
const FLOW_KEY = "epub-flow";

interface EpubReaderProps {
  /** The real .epub address. Never rendered into a URL the browser can see. */
  file: string;
  title: string;
  novelId: string;
}

export default function EpubReader({ file, title, novelId }: EpubReaderProps) {
  const { prefs, update } = useNovelReaderPrefs();
  const t = themeById(prefs.theme);
  const lineHeight = spacingById(prefs.spacing).value;

  const url = lnoriFileUrl(file);
  const downloadHref = lnoriFileUrl(file, true);

  const [location, setLocation] = useState<string | number>(0);
  const [panel, setPanel] = useState(false);
  const [flow, setFlow] = useState<Flow>("scrolled-doc");
  const renditionRef = useRef<any>(null);

  const locKey = `epub-loc:${file}`;

  /**
   * Scrolling is the default, and on a phone it is the difference between a
   * readable book and a fight. Paginated mode pins the text to a fixed-height
   * column, so any book whose CSS disagrees with the viewport gets clipped
   * mid-sentence with no way to reach the rest.
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FLOW_KEY) as Flow | null;
      if (saved === "paginated" || saved === "scrolled-doc") setFlow(saved);
    } catch {
      /* private mode */
    }
  }, []);

  /**
   * Restored in an effect rather than in useState: seeding state from
   * localStorage during render makes the server and client disagree about the
   * first paint.
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

  /**
   * A registered theme rather than per-property overrides, and every rule
   * marked important.
   *
   * Publisher stylesheets ship their own `body { background: #fff; color: #000 }`
   * and they load AFTER ours, which is why the first attempt at theming left
   * white pages sitting on a dark reader. `!important` is the only thing that
   * outranks a stylesheet you do not control.
   */
  const applyTheme = useCallback(
    (r: any) => {
      if (!r) return;
      const font = EPUB_FONTS[prefs.font] || EPUB_FONTS.serif;
      try {
        r.themes.register("davinci", {
          "html, body": {
            background: `${t.bg} !important`,
            color: `${t.text} !important`,
            "font-family": `${font} !important`,
            "line-height": `${lineHeight} !important`,
            padding: "0 5% !important",
            "-webkit-text-size-adjust": "100% !important",
          },
          "p, div, span, li, td, blockquote": {
            color: `${t.text} !important`,
            "font-family": `${font} !important`,
            "line-height": `${lineHeight} !important`,
          },
          "h1, h2, h3, h4, h5, h6": { color: `${t.text} !important` },
          a: { color: "#f472b6 !important" },
          // Cover plates and interior art are often sized for print and
          // overflow the column otherwise.
          img: {
            "max-width": "100% !important",
            height: "auto !important",
            margin: "1em auto !important",
            display: "block !important",
          },
        });
        r.themes.select("davinci");
        r.themes.fontSize(`${prefs.size}px`);
      } catch {
        /* a book that refuses styling still reads */
      }
    },
    [t.bg, t.text, prefs.font, prefs.size, lineHeight]
  );

  useEffect(() => {
    applyTheme(renditionRef.current);
  }, [applyTheme]);

  const turn = useCallback((dir: "next" | "prev") => {
    try {
      if (dir === "next") renditionRef.current?.next();
      else renditionRef.current?.prev();
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

  const toggleFlow = () => {
    const next: Flow = flow === "paginated" ? "scrolled-doc" : "paginated";
    setFlow(next);
    try {
      localStorage.setItem(FLOW_KEY, next);
    } catch {
      /* private mode */
    }
  };

  const iconBtn = "rounded-lg p-2 transition hover:bg-white/10 disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: t.bg }}>
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-2 sm:px-4 sm:py-3"
        style={{ backgroundColor: t.panel, borderColor: t.border }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* `replace`: a back control that pushes leaves the browser's own
              back button returning you into the book you just closed. */}
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className="rounded-full p-2 transition hover:bg-white/10"
            style={{ color: t.text }}
            title="Back to series"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="line-clamp-1 font-mono text-xs font-bold sm:text-sm" style={{ color: t.text }}>
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={toggleFlow} className={iconBtn} style={{ color: t.muted }} title={flow === "paginated" ? "Switch to scrolling" : "Switch to pages"}>
            {flow === "paginated" ? <ScrollText className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
          </button>
          <button onClick={() => setSize(-1)} disabled={prefs.size <= SIZE_MIN} className={iconBtn} style={{ color: t.muted }} title="Smaller text">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-6 text-center font-mono text-xs tabular-nums" style={{ color: t.muted }}>
            {prefs.size}
          </span>
          <button onClick={() => setSize(1)} disabled={prefs.size >= SIZE_MAX} className={iconBtn} style={{ color: t.muted }} title="Larger text">
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={() => setPanel((p) => !p)} className={iconBtn} style={{ color: panel ? t.text : t.muted }} title="Theme and font">
            <Type className="h-4 w-4" />
          </button>
          <a
            href={downloadHref}
            className="ml-1 flex items-center gap-2 rounded-lg bg-pink-500 px-3 py-2 font-mono text-xs font-bold text-white transition hover:bg-pink-600"
            title="Save this volume"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">EPUB</span>
          </a>
        </div>
      </div>

      {panel && (
        <div className="border-b px-4 py-3" style={{ backgroundColor: t.panel, borderColor: t.border }}>
          <div className="mb-3 flex flex-wrap gap-2">
            {READER_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => update({ theme: theme.id })}
                className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold transition ${prefs.theme === theme.id ? "ring-2 ring-pink-500" : ""}`}
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
          // Remounted when the flow changes: epub.js builds its manager once,
          // so switching pages/scrolling on a live rendition does nothing.
          key={flow}
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
          epubOptions={{
            flow,
            manager: flow === "scrolled-doc" ? "continuous" : "default",
            // Single column always. The two-page spread halves an already
            // narrow phone and looks broken on anything portrait.
            spread: "none",
          }}
        />
      </div>
    </div>
  );
}
