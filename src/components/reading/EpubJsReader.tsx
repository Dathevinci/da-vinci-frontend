"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactReader, ReactReaderStyle, IReactReaderStyle } from "react-reader";
import { ArrowLeft, BookOpen, Download, Minus, Palette, Plus, Scroll } from "lucide-react";
import Link from "next/link";
import { lnoriFileUrl } from "@/lib/novel/lnoriProxy";

/**
 * THE FALLBACK READER — epub.js via react-reader.
 *
 * The primary reader now renders server-extracted HTML (see EpubReader.tsx);
 * this one exists for any book the extractor cannot parse. It carries the two
 * book-specific fixes for the epub.js path:
 *
 *  - display() is wrapped so nav hrefs are resolved against the spine before
 *    epub.js sees them. spine.get() is a plain map lookup with no path
 *    resolution, so a nav document in a subdirectory ("../Text/cover.xhtml")
 *    misses every time and the TOC click dies silently. Measured live against
 *    a real Kobo book.
 *
 *  - Every page theme forces height:auto on html/body and svg. Yen Press/Kobo
 *    cover sections ship print CSS (100% height chains, svg-wrapped art), and
 *    epub.js sizes its frame FROM the content starting at zero — a 100% chain
 *    has zero as a fixed point.
 */
interface EpubJsReaderProps {
  /** The real .epub address. Never rendered into a URL the browser can see. */
  file: string;
  title: string;
  novelId: string;
}

const darkReaderStyles: IReactReaderStyle = {
  ...ReactReaderStyle,
  readerArea: {
    ...ReactReaderStyle.readerArea,
    backgroundColor: "#070709",
  },
  tocArea: {
    ...ReactReaderStyle.tocArea,
    backgroundColor: "#070709",
  },
  tocAreaButton: {
    ...ReactReaderStyle.tocAreaButton,
    color: "#e2e8f0",
    borderBottom: "1px solid #ffffff1a",
  },
  tocButtonExpanded: {
    ...ReactReaderStyle.tocButtonExpanded,
    backgroundColor: "#1e293b",
  },
  toc: {
    ...ReactReaderStyle.toc,
    backgroundColor: "#070709",
    color: "#e2e8f0",
  },
  tocButton: {
    ...ReactReaderStyle.tocButton,
    color: "#e2e8f0",
    borderBottom: "1px solid #ffffff1a",
  },
  arrow: {
    ...ReactReaderStyle.arrow,
    color: "#e2e8f0",
    backgroundColor: "#070709",
  },
  arrowHover: {
    ...ReactReaderStyle.arrowHover,
    color: "#f8fafc",
  },
  tocBackground: {
    ...ReactReaderStyle.tocBackground,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  tocButtonBar: {
    ...ReactReaderStyle.tocButtonBar,
    background: "#e2e8f0",
  },
  tocButtonBarTop: {
    ...ReactReaderStyle.tocButtonBarTop,
    background: "#e2e8f0",
  },
  tocButtonBottom: {
    ...ReactReaderStyle.tocButtonBottom,
    background: "#e2e8f0",
  },
};

function pageTheme(bg: string, text: string, heading: string, link: string) {
  return {
    "html, body": {
      background: bg + " !important",
      color: text + " !important",
      height: "auto !important",
      "min-height": "0 !important",
      "font-family": "ui-sans-serif, system-ui, sans-serif !important",
    },
    p: {
      color: text + " !important",
      "line-height": "1.75 !important",
    },
    "h1, h2, h3, h4, h5, h6": {
      color: heading + " !important",
    },
    a: {
      color: link + " !important",
    },
    img: {
      "max-width": "100% !important",
      height: "auto !important",
      display: "block !important",
      margin: "1em auto !important",
    },
    svg: {
      "max-width": "100% !important",
      height: "auto !important",
    },
  };
}

const PAGE_THEMES: Record<string, ReturnType<typeof pageTheme>> = {
  dark: pageTheme("#070709", "#e2e8f0", "#f8fafc", "#f472b6"),
  light: pageTheme("#fafaf9", "#1c1917", "#0c0a09", "#db2777"),
  sepia: pageTheme("#f2e7cf", "#574a34", "#44381f", "#be185d"),
};
const THEME_ORDER = ["dark", "light", "sepia"];

const SIZE_MIN = 50;
const SIZE_MAX = 250;
const SIZE_STEP = 10;

const FONT_FAMILIES = [
  { name: "System", css: "ui-sans-serif, system-ui, sans-serif" },
  { name: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { name: "Publisher", css: "" },
];

function resolveSpineTarget(book: any, navHref: string): { href: string; index: number } | null {
  const items: any[] = book?.spine?.spineItems;
  if (!Array.isArray(items) || !navHref) return null;

  const raw = String(navHref);
  const hash = raw.indexOf("#");
  const fragment = hash >= 0 ? raw.slice(hash) : "";
  const path = hash >= 0 ? raw.slice(0, hash) : raw;

  if (!path && fragment.length > 1) {
    const id = fragment.slice(1);
    const byId = items.find((s) => s && s.idref === id);
    if (byId) return { href: String(byId.href || ""), index: byId.index };
  }

  const norm = (v: string) => {
    let out = String(v || "");
    try {
      out = decodeURIComponent(out);
    } catch {
      /* malformed escape — compare it raw */
    }
    return out.replace(/^\.\//, "").replace(/^(\.\.\/)+/, "").replace(/^\/+/, "").toLowerCase();
  };
  const base = (v: string) => norm(v).split("/").pop() || "";

  const wantFull = norm(path);
  const wantBase = base(path);
  if (!wantFull) return null;

  let hit = items.find((s) => {
    const h = norm(s?.href || "");
    return h === wantFull || h.endsWith("/" + wantFull) || wantFull.endsWith("/" + h);
  });

  if (!hit && wantBase) {
    const matches = items.filter((s) => base(s?.href || "") === wantBase);
    if (matches.length === 1) hit = matches[0];
  }

  if (!hit) return null;
  return { href: String(hit.href || "") + fragment, index: hit.index };
}

export default function EpubJsReader({ file, title, novelId }: EpubJsReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [fontSize, setFontSize] = useState(100);
  const [theme, setTheme] = useState("dark");
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].css);
  const [flowMode, setFlowMode] = useState<"scrolled-doc" | "paginated">("scrolled-doc");
  const renditionRef = useRef<any>(null);
  const themeRef = useRef(theme);
  const sizeRef = useRef(fontSize);
  const fontRef = useRef(fontFamily);
  themeRef.current = theme;
  sizeRef.current = fontSize;
  fontRef.current = fontFamily;
  /**
   * Every theme switch registers under a FRESH name.
   *
   * epub.js reuses the <style> node it already made for a theme name and only
   * appends rules into it — it never moves the node. All three themes use the
   * same selectors at the same importance, so document order decides the
   * winner, and whichever theme was injected last keeps winning forever.
   * Cycling dark → light → sepia → dark left the page sepia while the button
   * said dark. A new name each time guarantees the newest node is last.
   */
  const themeSeq = useRef(0);

  const url = lnoriFileUrl(file);
  const locKey = "epub-loc:" + file;

  useEffect(() => {
    try {
      const savedLoc = localStorage.getItem(locKey);
      if (savedLoc) setLocation(savedLoc);
      const savedSize = Number(localStorage.getItem("epub-fontsize"));
      if (savedSize >= SIZE_MIN && savedSize <= SIZE_MAX) setFontSize(savedSize);
      const savedTheme = localStorage.getItem("epub-theme");
      if (savedTheme && PAGE_THEMES[savedTheme]) setTheme(savedTheme);
      const savedFont = localStorage.getItem("epub-fontfamily");
      if (savedFont !== null && FONT_FAMILIES.some((f) => f.css === savedFont)) setFontFamily(savedFont);
      const savedFlow = localStorage.getItem("epub-flow");
      if (savedFlow === "paginated" || savedFlow === "scrolled-doc") setFlowMode(savedFlow);
    } catch {
      /* private mode */
    }
  }, [locKey]);

  const onLocationChanged = (epubcfi: string) => {
    setLocation(epubcfi);
    try {
      localStorage.setItem(locKey, epubcfi);
    } catch {
      /* private mode */
    }
  };

  /** Register under a fresh name so this theme's style node is appended last. */
  const applyTheme = useCallback((rendition: any, id: string) => {
    if (!rendition) return;
    const styles = PAGE_THEMES[id] || PAGE_THEMES.dark;
    const name = id + "-" + themeSeq.current++;
    rendition.themes.register(name, styles);
    rendition.themes.select(name);
  }, []);

  const onRendition = useCallback((rendition: any) => {
    renditionRef.current = rendition;

    applyTheme(rendition, themeRef.current);
    rendition.themes.fontSize(sizeRef.current + "%");
    if (fontRef.current) rendition.themes.font(fontRef.current);

    /**
     * Publisher print CSS often arrives as an INLINE style attribute on html
     * or body, and no stylesheet can outrank that — not even !important. The
     * only way past it is to clear the inline properties on the element
     * itself, which is why this exists alongside the registered themes.
     */
    rendition.hooks.content.register((contents: any) => {
      const doc: Document = contents.document;
      [doc?.documentElement, doc?.body].forEach((el: any) => {
        if (!el?.style) return;
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("max-height", "none", "important");
        el.style.setProperty("overflow-y", "visible", "important");
        el.style.setProperty("overflow-x", "hidden", "important");
      });
    });

    /**
     * THE TOC FIX — and note HOW it is reached, because it is indirect.
     *
     * A click in react-reader's contents panel does NOT call display()
     * directly. It calls setLocation(href) → locationChanged(href) → our
     * handler → the location prop changes → EpubView.componentDidUpdate calls
     * rendition.display(href). So the patched display is what finally runs,
     * but only because onLocationChanged feeds the raw href back through the
     * location prop. Simplify that handler and TOC navigation dies silently.
     */
    const book = rendition.book;
    const originalDisplay = rendition.display.bind(rendition);
    rendition.display = (target?: string | number) => {
      if (typeof target === "string" && !target.startsWith("epubcfi(")) {
        const resolved = resolveSpineTarget(book, target);
        if (resolved) {
          return originalDisplay(resolved.href).catch(() => originalDisplay(resolved.index));
        }
      }
      return originalDisplay(target);
    };

    rendition.on("keyup", (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") rendition.next();
      if (e.key === "ArrowLeft") rendition.prev();
    });
  }, []);

  useEffect(() => {
    try {
      applyTheme(renditionRef.current, theme);
      localStorage.setItem("epub-theme", theme);
    } catch {
      /* not ready yet */
    }
  }, [theme, applyTheme]);

  useEffect(() => {
    try {
      // "" means leave the publisher's own typography alone.
      if (fontFamily) renditionRef.current?.themes.font(fontFamily);
      localStorage.setItem("epub-fontfamily", fontFamily);
    } catch {
      /* not ready yet */
    }
  }, [fontFamily]);

  useEffect(() => {
    try {
      localStorage.setItem("epub-flow", flowMode);
    } catch {
      /* private mode */
    }
  }, [flowMode]);

  useEffect(() => {
    try {
      renditionRef.current?.themes.fontSize(fontSize + "%");
      localStorage.setItem("epub-fontsize", String(fontSize));
    } catch {
      /* not ready yet */
    }
  }, [fontSize]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") renditionRef.current?.next();
      if (e.key === "ArrowLeft") renditionRef.current?.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cycleTheme = () => {
    const i = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
  };

  const btn =
    "grid h-9 w-9 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#070709]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0b0b11] px-3 py-2.5 shadow-md sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className="rounded-full bg-white/5 p-2 text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="line-clamp-1 font-mono text-sm font-bold text-white sm:text-base">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setFontSize((s) => Math.max(SIZE_MIN, s - SIZE_STEP))}
            disabled={fontSize <= SIZE_MIN}
            className={btn}
            title="Smaller text"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center font-mono text-xs tabular-nums text-white/60">{fontSize}%</span>
          <button
            onClick={() => setFontSize((s) => Math.min(SIZE_MAX, s + SIZE_STEP))}
            disabled={fontSize >= SIZE_MAX}
            className={btn}
            title="Larger text"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button onClick={cycleTheme} className={btn} title={"Page theme: " + theme}>
            <Palette className="h-4 w-4" />
          </button>

          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="rounded-lg bg-transparent py-1.5 font-mono text-xs text-white/80 focus:outline-none [&>option]:bg-zinc-900"
            title="Typeface"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.name} value={f.css}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setFlowMode((m) => (m === "paginated" ? "scrolled-doc" : "paginated"))}
            className={btn}
            title={flowMode === "paginated" ? "Switch to continuous scroll" : "Switch to pages"}
          >
            {flowMode === "paginated" ? <Scroll className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
          </button>

          <a
            href={lnoriFileUrl(file, true)}
            className="ml-1 flex items-center gap-2 rounded-lg bg-pink-500 px-3 py-2 font-mono text-xs font-bold text-white transition hover:bg-pink-600 sm:px-4"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download EPUB</span>
          </a>
        </div>
      </div>

      <div className="relative flex-1 bg-[#070709]">
        <ReactReader
          // epub.js settles its manager once, so a flow change needs a fresh
          // rendition. The saved location carries across the remount.
          key={flowMode}
          url={url}
          location={location}
          locationChanged={onLocationChanged}
          title={title}
          getRendition={onRendition}
          epubInitOptions={{
            openAs: "epub",
          }}
          epubOptions={{
            flow: flowMode,
            manager: flowMode === "paginated" ? "default" : "continuous",
          }}
          readerStyles={darkReaderStyles}
        />
      </div>
    </div>
  );
}
