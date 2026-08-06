"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignCenter, AlignJustify, AlignLeft, ArrowLeft, ArrowRight, Bookmark, ChevronLeft,
  Download, Info, Loader2, Maximize, MessageSquare, Menu, SlidersHorizontal, Undo2, X,
} from "lucide-react";
import {
  useEpubPrefs, epubPalette, epubFontById,
  EPUB_THEMES, EPUB_FONTS, EPUB_SIZE_MIN, EPUB_SIZE_MAX,
  type EpubAlign, type EpubPrefs,
} from "@/lib/novel/epubPrefs";
import { lnoriFileUrl } from "@/lib/novel/lnoriProxy";

/**
 * WHY THIS DRIVES epub.js DIRECTLY INSTEAD OF USING react-reader.
 *
 * The wrapper draws its own title bar and its own page arrows, so the reader
 * showed the volume name twice and had two sets of arrows — and it owns the
 * flow/manager pairing, which is what made scrolling mode intermittently refuse
 * to scroll. Its layout arrives as inline styles, so none of that can be undone
 * from the outside without handing it a complete replacement style object.
 *
 * epub.js is already a direct dependency. Rendering the book ourselves is about
 * sixty lines and buys back the container, the chrome and the styling.
 */

const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Comic+Neue:wght@400;700&family=Lexend:wght@400;700&family=Ubuntu:wght@400;700&display=swap";

const DYSLEXIC_FACE = `@font-face{font-family:'OpenDyslexic';src:url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff');font-weight:400;font-display:swap}`;

/**
 * The stylesheet injected into each rendered section.
 *
 * Every rule is important because publisher stylesheets ship their own
 * `body { background:#fff; color:#000 }` and load after ours — that fight is
 * what made dark mode flicker white as new sections came into view.
 *
 * Font size lands on body and on body text only. Putting it on every element
 * would flatten headings to the same size as prose.
 */
function themeCss(prefs: EpubPrefs): string {
  const pal = epubPalette(prefs);
  const face = epubFontById(prefs.font).css;
  const fontRule = face ? `font-family:${face} !important;` : "";
  return `
    /**
     * APPEARANCE ONLY. LAYOUT BELONGS TO epub.js.
     *
     * This stylesheet used to force height, max-height, overflow, position,
     * max-width, margin and box-sizing onto html/body. Those are exactly the
     * properties epub.js reads off the body to decide how tall to make its
     * iframe and how to size a column — so the reader was overriding the
     * measurements the layout engine depends on, and then the layout came out
     * wrong. The plain react-reader version had no injected CSS at all and
     * behaved, which is the tell.
     *
     * So: colour, type and image fitting. Nothing that moves a box.
     */
    html, body {
      background:${pal.bg} !important; color:${pal.text} !important;
      ${fontRule} font-size:${prefs.size}px !important;
      line-height:1.75 !important; text-align:${prefs.align} !important;
      -webkit-text-size-adjust:100% !important;
    }
    p, li, td, blockquote, div, span, section {
      color:${pal.text} !important; ${fontRule}
      text-align:${prefs.align} !important;
    }
    p, li, td, blockquote { font-size:${prefs.size}px !important; line-height:1.75 !important; }
    h1, h2, h3, h4, h5, h6 { color:${pal.text} !important; ${fontRule} }
    a { color:#f472b6 !important; }
    /* FULL-PAGE ART MUST FIT THE VIEWPORT, NOT OVERFLOW IT.
       Covers and colour inserts are sized for print, so at the reader's width
       they run taller than the screen — and on exactly those sections the
       publisher also forbids scrolling, so the overflow was unreachable. Fit
       them instead of trying to scroll them: capped to the viewport height and
       letterboxed, which is what a working reader does with a cover. */
    img, image, svg {
      max-width:100% !important;
      max-height:88vh !important;
      width:auto !important;
      height:auto !important;
      object-fit:contain !important;
      display:block !important;
      margin:1em auto !important;
    }
  `;
}

/**
 * Bionic reading: weight the opening of each word so the eye can skip ahead.
 * Done on the rendered document because we do not own these books. It mutates
 * the DOM, so turning it off rebuilds the rendition rather than unpicking it.
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

/**
 * Turn a table-of-contents href into something rendition.display() accepts.
 *
 * MEASURED against a real Yen Press EPUB rather than assumed. Its navigation
 * document lives in a subdirectory, so every toc href carries a `../` prefix:
 *
 *     toc href     ../Text/cover.xhtml     spine.get() -> null
 *     spine href     Text/cover.xhtml      spine.get() -> found
 *
 * display() resolves its argument through spine.get(), so every chapter click
 * was handing it a path the spine has never heard of. epub.js does not throw
 * for this and the returned promise does not reject, so the click did nothing
 * whatsoever — no navigation, no error, nothing to notice.
 *
 * The candidates are ordered cheapest-first and cover the layouts that differ
 * between publishers: as-is, without the fragment, without the `../` climb,
 * without a leading slash, and finally on filename alone.
 */
function resolveNavHref(book: any, href: string): string | null {
  const spine = book?.spine;
  if (!spine?.get || !href) return null;

  const noFragment = String(href).split("#")[0];
  const candidates = [
    href,
    noFragment,
    noFragment.replace(/^(\.\.\/)+/, ""),
    noFragment.replace(/^\/+/, ""),
    noFragment.split("/").pop() || "",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const item = spine.get(candidate);
      if (item) return item.href || candidate;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

function styleInto(doc: Document | null | undefined, css: string) {
  if (!doc?.head) return;
  let el = doc.getElementById("dv-theme") as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = "dv-theme";
    doc.head.appendChild(el);
  }
  el.textContent = css;
}

function fontsInto(doc: Document | null | undefined) {
  if (!doc?.head || doc.getElementById("dv-fonts")) return;
  const link = doc.createElement("link");
  link.id = "dv-fonts";
  link.rel = "stylesheet";
  link.href = FONT_CSS;
  doc.head.appendChild(link);
  const face = doc.createElement("style");
  face.textContent = DYSLEXIC_FACE;
  doc.head.appendChild(face);
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
  const css = useMemo(() => themeCss(prefs), [prefs]);

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const cssRef = useRef(css);
  const bionicRef = useRef(prefs.bionic);
  const startRef = useRef<string | null>(null);
  const historyRef = useRef<string[]>([]);
  /** Held while a bottom-of-section advance is in flight, so one flick of the
   *  wheel cannot skip several sections at once. */
  const advancingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cfi, setCfi] = useState<string>("");
  const [toc, setToc] = useState<any[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  cssRef.current = css;
  bionicRef.current = prefs.bionic;

  const locKey = `epub-loc:${file}`;
  const markKey = `epub-marks:${file}`;

  // Read before the rendition is built, so the book opens where it was left.
  if (typeof window !== "undefined" && startRef.current === null) {
    try {
      startRef.current = localStorage.getItem(locKey) || "";
    } catch {
      startRef.current = "";
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(markKey);
      if (saved) setMarks(JSON.parse(saved));
    } catch {
      /* private mode */
    }
  }, [markKey]);

  /**
   * DOWNLOAD THE BOOK ONCE, SEPARATELY FROM RENDERING IT.
   *
   * epub.js reads the whole archive before it can draw a page, so opening a
   * volume is dominated by that transfer. Building the book inside the
   * rendition effect meant every switch between scrolling and pages, and every
   * Bionic toggle, threw the parsed archive away and fetched it again.
   *
   * `openAs` matters more than it looks: epub.js otherwise guesses the format
   * from the URL's extension, and base64-ing the address to keep download
   * managers away left nothing to guess from — so it probed for an unpacked
   * book, requesting container.xml and friends against a URL that serves an
   * archive, before eventually settling. Saying so outright skips all of it.
   */
  const [book, setBook] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    let created: any = null;
    setBook(null);
    setReady(false);
    setFailed(false);

    (async () => {
      try {
        const ePub = (await import("epubjs")).default as any;
        if (cancelled) return;
        created = ePub(url, { openAs: "epub" });
        setBook(created);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      try {
        created?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [url]);

  /**
   * Build the rendition. Rebuilt when the flow or bionic changes: epub.js
   * decides its manager once, and bionic rewrites the DOM in place. Theme,
   * font, size and alignment all apply live further down.
   */
  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    let rendition: any = null;
    let detachScroll: (() => void) | null = null;
    setReady(false);

    (async () => {
      try {
        if (cancelled || !viewerRef.current) return;
        const paginated = prefs.flow === "paginated";
        rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          /**
           * The default manager for both flows.
           *
           * The continuous manager stitches sections into one endless column
           * and takes over scrolling to do it. That is the exotic path, it is
           * the piece that changed when scrolling broke, and it is the hardest
           * to reason about without being able to run the thing. `scrolled-doc`
           * on the default manager gives epub.js's own container a fixed height
           * and `overflow:auto`, which is the plainest possible arrangement:
           * one section, scrolled normally, next section on next().
           */
          flow: paginated ? "paginated" : "scrolled-doc",
          manager: "default",
          // Single column always — a two-page spread halves an already narrow
          // phone and looks broken on anything portrait.
          spread: "none",
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        rendition.hooks.content.register((contents: any) => {
          const doc: Document = contents.document;
          fontsInto(doc);
          styleInto(doc, cssRef.current);
          if (bionicRef.current) applyBionic(doc);
        });

        rendition.on("relocated", (loc: any) => {
          const next = loc?.start?.cfi;
          if (!next) return;
          setCfi((prev) => {
            if (prev && prev !== next) {
              historyRef.current.push(prev);
              if (historyRef.current.length > 50) historyRef.current.shift();
            }
            return next;
          });
          try {
            localStorage.setItem(locKey, next);
          } catch {
            /* private mode */
          }
        });

        rendition.on("keyup", (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") rendition.next();
          if (e.key === "ArrowLeft") rendition.prev();
        });

        await rendition.display(startRef.current || undefined);
        if (cancelled) return;
        setReady(true);

        /**
         * Reaching the bottom carries you into the next section.
         *
         * `scrolled-doc` shows one section at a time, so without this a chapter
         * ends in a wall and you have to find a button. The guards matter: skip
         * when the section is shorter than the viewport (nothing to scroll, and
         * firing there would race through the book), and hold a flag until the
         * new section settles so one flick cannot advance twice.
         */
        const scroller: HTMLElement | null =
          rendition.manager?.container || (viewerRef.current?.firstElementChild as HTMLElement | null);

        if (scroller && !paginated) {
          const onScroll = () => {
            if (advancingRef.current) return;
            const { scrollTop, clientHeight, scrollHeight } = scroller;
            if (scrollHeight <= clientHeight + 40) return;
            if (scrollTop + clientHeight < scrollHeight - 48) return;
            advancingRef.current = true;
            Promise.resolve(rendition.next())
              .then(() => {
                scroller.scrollTop = 0;
              })
              .catch(() => {})
              .finally(() => {
                window.setTimeout(() => {
                  advancingRef.current = false;
                }, 400);
              });
          };
          scroller.addEventListener("scroll", onScroll, { passive: true });
          detachScroll = () => scroller.removeEventListener("scroll", onScroll);
        }

        book.loaded.navigation
          .then((nav: any) => {
            if (!cancelled) setToc(nav?.toc || []);
          })
          .catch(() => {});
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      try {
        detachScroll?.();
      } catch {
        /* listener already gone with the node */
      }
      try {
        rendition?.destroy();
      } catch {
        /* already gone */
      }
      renditionRef.current = null;
      // The BOOK is not destroyed here. It belongs to the effect above and
      // outlives every flow and bionic change — destroying it here is exactly
      // what made toggling a setting re-download the whole archive.
    };
  }, [book, prefs.flow, prefs.bionic, locKey]);

  /**
   * Live restyle. Sections already on screen keep their own documents, so the
   * stylesheet is rewritten in each of them rather than waiting for a re-render
   * — that lag was most of what read as "glitchy" when switching theme.
   */
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    try {
      const contents = r.getContents?.();
      const list = Array.isArray(contents) ? contents : contents ? [contents] : [];
      list.forEach((c: any) => styleInto(c?.document, css));
    } catch {
      /* nothing rendered yet */
    }
  }, [css, ready]);

  const turn = useCallback((dir: "next" | "prev") => {
    try {
      if (dir === "next") renditionRef.current?.next();
      else renditionRef.current?.prev();
    } catch {
      /* not ready */
    }
  }, []);

  // Keystrokes inside the book's iframe never reach the parent window, so the
  // rendition gets its own listener too (registered above).
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
    if (prev) {
      try {
        renditionRef.current?.display(prev);
      } catch {
        /* stale cfi */
      }
    }
  };

  const toggleBookmark = () => {
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

  const isMarked = !!cfi && marks.includes(cfi);
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
        <div className="flex min-w-0 items-center gap-1">
          <button onClick={() => setTocOpen((v) => !v)} className={btn} title="Contents">
            <Menu className="h-5 w-5" />
          </button>
          <Link href={`/novel/${encodeURIComponent(novelId)}`} replace className={btn} title="Back to series">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="ml-1 line-clamp-1 font-mono text-xs sm:text-sm" style={{ color: chromeMuted }}>
            {title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
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

      <div className="relative flex min-h-0 flex-1">
        {/* ── the book ── */}
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ backgroundColor: pal.bg }}>
          <div ref={viewerRef} className="h-full w-full" />

          {!ready && !failed && (
            <div className="absolute inset-0 grid place-items-center" style={{ backgroundColor: pal.bg, color: pal.muted }}>
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center" style={{ backgroundColor: pal.bg }}>
              <div style={{ color: pal.muted }}>
                <p className="font-mono text-sm">This volume could not be opened.</p>
                <Link
                  href={`/novel/${encodeURIComponent(novelId)}`}
                  replace
                  className="mt-3 inline-block font-mono text-sm text-pink-400 hover:underline"
                >
                  Back to the series
                </Link>
              </div>
            </div>
          )}

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
                      const r = renditionRef.current;
                      if (r) {
                        const target = resolveNavHref(book, item.href) ?? item.href;
                        // display() returns a promise; an unhandled rejection
                        // here is a chapter that silently refuses to open.
                        Promise.resolve(r.display(target)).catch(() => {
                          Promise.resolve(r.display(item.href)).catch(() => {});
                        });
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
                EPUB · {marks.length} bookmark{marks.length === 1 ? "" : "s"} · {prefs.flow === "paginated" ? "Pages" : "Scrolling"}
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
              className="mb-4 grid h-24 place-items-center rounded-xl border px-3 text-center"
              style={{
                backgroundColor: pal.bg,
                borderColor: hair,
                color: pal.text,
                fontFamily: epubFontById(prefs.font).css || undefined,
                fontSize: `${prefs.size}px`,
              }}
            >
              {prefs.bionic ? <span><b>Lor</b>em <b>ips</b>um</span> : <span>Lorem ipsum</span>}
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
              {([["left", AlignLeft], ["center", AlignCenter], ["justify", AlignJustify]] as [EpubAlign, any][]).map(
                ([id, Icon]) => (
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
                )
              )}
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
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs.dark ? "left-[22px]" : "left-0.5"}`} />
              </button>
              <span className="font-mono text-xs" style={{ color: chromeMuted }}>Dark</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {EPUB_THEMES.map((theme) => (
                <button key={theme.id} onClick={() => update({ theme: theme.id })} className="text-center">
                  <span
                    className="block h-16 w-full rounded-xl border-2 transition"
                    style={{ backgroundColor: theme.swatch, borderColor: prefs.theme === theme.id ? "#38bdf8" : hair }}
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
