"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlignCenter, AlignJustify, AlignLeft, ArrowLeft, ArrowRight, Bookmark, ChevronLeft,
  Download, Info, Loader2, Maximize, MessageSquare, Menu, SlidersHorizontal, Undo2, X,
} from "lucide-react";
import {
  useEpubPrefs, epubPalette, epubFontById,
  EPUB_THEMES, EPUB_FONTS, EPUB_SIZE_MIN, EPUB_SIZE_MAX,
  type EpubAlign,
} from "@/lib/novel/epubPrefs";
import { lnoriFileUrl } from "@/lib/novel/lnoriProxy";

/** epub.js reaches for `window` as it initialises, so this never renders on the server. */
const ReactReader = dynamic(() => import("react-reader").then((m) => m.ReactReader), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

/**
 * The book lives in an iframe with its own document, so the app's fonts —
 * loaded by next/font and referenced as CSS variables — are invisible in
 * there. Each rendered section gets these injected directly.
 */
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Comic+Neue:wght@400;700&family=Lexend:wght@400;700&family=Ubuntu:wght@400;700&display=swap";

const DYSLEXIC_FACE = `@font-face{font-family:'OpenDyslexic';src:url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff');font-weight:400;font-display:swap}`;

/**
 * Bionic reading: weight the opening of each word so the eye can skip ahead.
 *
 * Done on the rendered document rather than the source, because we do not own
 * these books and will not be rewriting their markup on disk. It mutates the
 * DOM, so turning it off remounts the reader rather than trying to unpick it.
 */
function applyBionic(doc: Document) {
  if (!doc?.body || doc.body.getAttribute("data-dv-bionic") === "1") return;
  doc.body.setAttribute("data-dv-bionic", "1");

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  nodes.forEach((node) => {
    const text = node.nodeValue;
    if (!text || !text.trim()) return;
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, b, strong, code, pre")) return;

    const html = text.replace(/[\p{L}'’]+/gu, (word) => {
      const cut = Math.max(1, Math.round(word.length * 0.4));
      return `<b>${word.slice(0, cut)}</b>${word.slice(cut)}`;
    });
    if (html === text) return;

    const span = doc.createElement("span");
    span.innerHTML = html;
    parent.replaceChild(span, node);
  });
}

interface EpubReaderProps {
  /** The real .epub address. Never rendered into a URL the browser can see. */
  file: string;
  title: string;
  novelId: string;
}

export default function EpubReader({ file, title, novelId }: EpubReaderProps) {
  const { prefs, update } = useEpubPrefs();
  const pal = epubPalette(prefs);

  const url = useMemo(() => lnoriFileUrl(file), [file]);
  const downloadHref = useMemo(() => lnoriFileUrl(file, true), [file]);

  const [location, setLocation] = useState<string | number>(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toc, setToc] = useState<any[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const renditionRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);

  const locKey = `epub-loc:${file}`;
  const markKey = `epub-marks:${file}`;

  // Seeding state from localStorage during render makes server and client
  // disagree about the first paint, so both are restored in effects.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(locKey);
      if (saved) setLocation(saved);
      const savedMarks = localStorage.getItem(markKey);
      if (savedMarks) setMarks(JSON.parse(savedMarks));
    } catch {
      /* private mode */
    }
  }, [locKey, markKey]);

  const onLocationChanged = (cfi: string) => {
    setLocation((prev) => {
      if (typeof prev === "string" && prev && prev !== cfi) {
        historyRef.current.push(prev);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }
      return cfi;
    });
    try {
      localStorage.setItem(locKey, cfi);
    } catch {
      /* private mode */
    }
  };

  /**
   * A registered theme with every rule marked important.
   *
   * Publisher stylesheets ship their own `body { background:#fff; color:#000 }`
   * and load AFTER ours, so anything less specific loses and you get white
   * pages inside a dark reader.
   */
  const applyTheme = useCallback(
    (r: any) => {
      if (!r) return;
      const font = epubFontById(prefs.font).css;
      const fontRule = font ? { "font-family": `${font} !important` } : {};
      try {
        r.themes.register("davinci", {
          "html, body": {
            background: `${pal.bg} !important`,
            color: `${pal.text} !important`,
            "line-height": "1.75 !important",
            "text-align": `${prefs.align} !important`,
            padding: "0 5% !important",
            "-webkit-text-size-adjust": "100% !important",
            ...fontRule,
          },
          "p, div, span, li, td, blockquote": {
            color: `${pal.text} !important`,
            "text-align": `${prefs.align} !important`,
            ...fontRule,
          },
          "h1, h2, h3, h4, h5, h6": { color: `${pal.text} !important`, ...fontRule },
          a: { color: "#f472b6 !important" },
          // Cover plates and interior art are sized for print and overflow the
          // column otherwise.
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
    [pal.bg, pal.text, prefs.font, prefs.size, prefs.align]
  );

  useEffect(() => {
    applyTheme(renditionRef.current);
  }, [applyTheme]);

  const turn = useCallback((dir: "next" | "prev") => {
    try {
      if (dir === "next") renditionRef.current?.next();
      else renditionRef.current?.prev();
    } catch {
      /* not ready */
    }
  }, []);

  // Keystrokes inside the book's iframe never reach the parent window, so the
  // rendition gets its own listener too (registered in getRendition).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn("next");
      if (e.key === "ArrowLeft") turn("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const goBackOne = () => {
    const prev = historyRef.current.pop();
    if (prev) setLocation(prev);
  };

  const toggleBookmark = () => {
    const cfi = typeof location === "string" ? location : "";
    if (!cfi) return;
    setMarks((m) => {
      const next = m.includes(cfi) ? m.filter((x) => x !== cfi) : [...m, cfi];
      try {
        localStorage.setItem(markKey, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  const goFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch {
      /* unsupported */
    }
  };

  const isMarked = typeof location === "string" && marks.includes(location);
  const chrome = prefs.dark ? "#111114" : "#f4f4f5";
  const chromeText = prefs.dark ? "#e6e6e6" : "#18181b";
  const chromeMuted = prefs.dark ? "#8a8a8a" : "#6b6b6b";
  const hair = prefs.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)";
  const btn = "grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: pal.bg }}>
      {/* ── top bar ── */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-2 sm:px-3"
        style={{ backgroundColor: chrome, borderColor: hair, color: chromeText }}
      >
        <div className="flex items-center gap-1">
          <button onClick={() => setTocOpen((v) => !v)} className={btn} title="Contents">
            <Menu className="h-5 w-5" />
          </button>
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className={btn}
            title="Back to series"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="ml-1 line-clamp-1 max-w-[40vw] font-mono text-xs sm:text-sm" style={{ color: chromeMuted }}>
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={goBackOne} className={btn} title="Back to previous position">
            <Undo2 className="h-5 w-5" />
          </button>
          <a href={downloadHref} className={btn} title="Save this volume">
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={`${btn} ${settingsOpen ? "ring-1 ring-sky-400" : ""}`}
            title="Reading settings"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* `relative` so the settings drawer below anchors to this row rather
          than to the whole fixed reader, where it would cover both toolbars. */}
      <div className="relative flex min-h-0 flex-1">
        {/* ── the book ── */}
        <div className="relative min-w-0 flex-1" style={{ backgroundColor: pal.bg }}>
          <ReactReader
            // Remounted when flow or bionic changes: epub.js builds its manager
            // once, and bionic rewrites the rendered DOM in place.
            key={`${prefs.flow}|${prefs.bionic}`}
            url={url}
            location={location}
            locationChanged={onLocationChanged}
            title={title}
            showToc={false}
            getRendition={(r: any) => {
              renditionRef.current = r;
              applyTheme(r);
              try {
                r.book?.loaded?.navigation?.then((nav: any) => setToc(nav?.toc || []));
              } catch {
                /* no navigation document */
              }
              try {
                r.hooks?.content?.register((contents: any) => {
                  const doc: Document = contents.document;
                  if (doc?.head && !doc.getElementById("dv-fonts")) {
                    const link = doc.createElement("link");
                    link.id = "dv-fonts";
                    link.rel = "stylesheet";
                    link.href = FONT_CSS;
                    doc.head.appendChild(link);
                    const face = doc.createElement("style");
                    face.textContent = DYSLEXIC_FACE;
                    doc.head.appendChild(face);
                  }
                  if (prefs.bionic) applyBionic(doc);
                });
              } catch {
                /* older builds have no content hook */
              }
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
              flow: prefs.flow,
              manager: prefs.flow === "scrolled-doc" ? "continuous" : "default",
              // Single column always — a two-page spread halves an already
              // narrow phone and looks broken on anything portrait.
              spread: "none",
            }}
          />

          {tocOpen && (
            <div
              className="absolute inset-y-0 left-0 z-20 w-[280px] overflow-y-auto border-r p-3"
              style={{ backgroundColor: chrome, borderColor: hair }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: chromeMuted }}>
                  Contents
                </span>
                <button onClick={() => setTocOpen(false)} className={btn} style={{ color: chromeText }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {toc.length === 0 ? (
                <p className="px-2 py-6 text-center font-mono text-xs" style={{ color: chromeMuted }}>
                  No contents listed.
                </p>
              ) : (
                toc.map((item: any, i: number) => (
                  <button
                    key={`${item.href}-${i}`}
                    onClick={() => {
                      try {
                        renditionRef.current?.display(item.href);
                      } catch {
                        /* bad href */
                      }
                      setTocOpen(false);
                    }}
                    className="block w-full rounded-lg px-2 py-2 text-left font-mono text-xs transition hover:bg-white/10"
                    style={{ color: chromeText }}
                  >
                    {item.label?.trim() || "Untitled"}
                  </button>
                ))
              )}
            </div>
          )}

          {infoOpen && (
            <div
              className="absolute bottom-4 left-4 z-20 max-w-[80vw] rounded-xl border p-4 shadow-xl"
              style={{ backgroundColor: chrome, borderColor: hair, color: chromeText }}
            >
              <p className="font-mono text-sm font-bold">{title}</p>
              <p className="mt-1 font-mono text-xs" style={{ color: chromeMuted }}>
                EPUB · {marks.length} bookmark{marks.length === 1 ? "" : "s"}
              </p>
              <button onClick={() => setInfoOpen(false)} className="mt-3 font-mono text-xs text-pink-400 hover:underline">
                Close
              </button>
            </div>
          )}
        </div>

        {/* ── settings ── */}
        {settingsOpen && (
          <div
            className="absolute inset-y-0 right-0 z-30 w-full overflow-y-auto border-l p-4 sm:w-[360px]"
            style={{ backgroundColor: chrome, borderColor: hair }}
          >
            <div
              className="mb-4 grid h-24 place-items-center rounded-xl border"
              style={{
                backgroundColor: pal.bg,
                borderColor: hair,
                color: pal.text,
                fontFamily: epubFontById(prefs.font).css || undefined,
                fontSize: `${prefs.size}px`,
              }}
            >
              {prefs.bionic ? (
                <span><b>Lor</b>em <b>ips</b>um</span>
              ) : (
                <span>Lorem ipsum</span>
              )}
            </div>

            <button
              onClick={() => update({ bionic: !prefs.bionic })}
              className={`mb-4 w-full rounded-xl border-2 py-3 font-mono text-sm font-bold transition ${
                prefs.bionic ? "border-sky-400 bg-sky-500/15 text-sky-300" : "border-sky-500/60 text-sky-400 hover:bg-sky-500/10"
              }`}
            >
              Bionic Reading
            </button>

            <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-xl border" style={{ borderColor: hair }}>
              {([
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["justify", AlignJustify],
              ] as [EpubAlign, any][]).map(([id, Icon]) => (
                <button
                  key={id}
                  onClick={() => update({ align: id })}
                  className="grid place-items-center py-2.5 transition hover:bg-white/10"
                  style={{
                    backgroundColor: prefs.align === id ? "rgba(56,189,248,0.15)" : "transparent",
                    color: prefs.align === id ? "#38bdf8" : chromeMuted,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center gap-3">
              <span className="text-xs font-bold" style={{ color: chromeMuted }}>A</span>
              <input
                type="range"
                min={EPUB_SIZE_MIN}
                max={EPUB_SIZE_MAX}
                value={prefs.size}
                onChange={(e) => update({ size: Number(e.target.value) })}
                className="h-1 flex-1 cursor-pointer accent-sky-400"
              />
              <span className="text-lg font-bold" style={{ color: chromeMuted }}>A</span>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2">
              {EPUB_FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => update({ font: f.id })}
                  className="rounded-xl py-2.5 font-mono text-xs font-bold transition"
                  style={{
                    backgroundColor: prefs.font === f.id ? "#38bdf8" : prefs.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                    color: prefs.font === f.id ? "#06121c" : chromeText,
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-xs" style={{ color: chromeMuted }}>Light</span>
              <button
                onClick={() => update({ dark: !prefs.dark })}
                className={`relative h-6 w-11 rounded-full transition ${prefs.dark ? "bg-sky-400" : "bg-slate-400"}`}
                title={prefs.dark ? "Switch to light" : "Switch to dark"}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs.dark ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
              <span className="font-mono text-xs" style={{ color: chromeMuted }}>Dark</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {EPUB_THEMES.map((theme) => (
                <button key={theme.id} onClick={() => update({ theme: theme.id })} className="text-center">
                  <span
                    className="block h-16 w-full rounded-xl border-2 transition"
                    style={{
                      backgroundColor: theme.swatch,
                      borderColor: prefs.theme === theme.id ? "#38bdf8" : hair,
                    }}
                  />
                  <span
                    className="mt-1.5 block font-mono text-[11px] font-bold"
                    style={{ color: prefs.theme === theme.id ? "#38bdf8" : chromeMuted }}
                  >
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => update({ flow: prefs.flow === "paginated" ? "scrolled-doc" : "paginated" })}
              className="mt-5 w-full rounded-xl border py-2.5 font-mono text-xs font-bold transition hover:bg-white/10"
              style={{ borderColor: hair, color: chromeText }}
            >
              {prefs.flow === "paginated" ? "Switch to scrolling" : "Switch to pages"}
            </button>
          </div>
        )}
      </div>

      {/* ── bottom bar ── */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2"
        style={{ backgroundColor: chrome, borderColor: hair, color: chromeMuted }}
      >
        <div className="flex items-center gap-1">
          <button onClick={() => setInfoOpen((v) => !v)} className={btn} title="About this volume">
            <Info className="h-5 w-5" />
          </button>
          <Link href={`/novel/${encodeURIComponent(novelId)}`} className={btn} title="Discussion">
            <MessageSquare className="h-5 w-5" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => turn("prev")} className={btn} title="Previous">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => turn("next")} className={btn} title="Next">
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleBookmark}
            className={btn}
            style={{ color: isMarked ? "#38bdf8" : chromeMuted }}
            title={isMarked ? "Remove bookmark" : "Bookmark this page"}
          >
            <Bookmark className={`h-5 w-5 ${isMarked ? "fill-current" : ""}`} />
          </button>
          <button onClick={goFullscreen} className={btn} title="Fullscreen">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
