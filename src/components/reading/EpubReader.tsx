"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignCenter, AlignLeft, AlignRight, BookX, ChevronLeft, Download, Home, List, Loader2, Moon, Settings, Sun, X,
} from "lucide-react";
import { encodeLnori, lnoriFileUrl } from "@/lib/novel/lnoriProxy";
import { browseAnchorHref } from "@/lib/browseAnchor";
import {
  useEpubPrefs, epubPalette, epubFontById,
  EPUB_THEMES, EPUB_FONTS, EPUB_SIZE_MIN, EPUB_SIZE_MAX,
  type EpubAlign,
} from "@/lib/novel/epubPrefs";
import EpubJsReader from "@/components/reading/EpubJsReader";

/**
 * The reference roster's faces, loaded from Google Fonts. React hoists these
 * link tags into <head>. OpenDyslexic is not on Google Fonts; its face is
 * declared in the style block below.
 */
const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Comic+Neue:wght@400;700&family=Lexend:wght@400;700&family=Ubuntu:wght@400;700&display=swap";

/**
 * Bionic reading: weight the opening of each word so the eye can skip ahead.
 *
 * Applied to the RENDERED sections, not the source HTML — we do not own these
 * books, and a DOM walk is idempotent per section via the data attribute.
 * Turning it OFF remounts the column instead of trying to unpick the bolding
 * (see the key on the column div).
 */
function applyBionic(root: HTMLElement) {
  if (root.getAttribute("data-dv-bionic") === "1") return;
  root.setAttribute("data-dv-bionic", "1");

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  nodes.forEach((node) => {
    const text = node.nodeValue;
    if (!text || !text.trim()) return;
    const parent = node.parentElement;
    if (!parent || parent.closest("b, strong, code, pre, a")) return;

    const html = text.replace(/[\p{L}'’]+/gu, (word) => {
      const cut = Math.max(1, Math.round(word.length * 0.4));
      return "<b>" + word.slice(0, cut) + "</b>" + word.slice(cut);
    });
    if (html === text) return;

    const span = document.createElement("span");
    span.innerHTML = html;
    parent.replaceChild(span, node);
  });
}

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
 * renders it as ONE continuous column. The entry section paints first, then
 * the REST OF THE BOOK streams in eagerly in the background — the archive is
 * already cached server-side, so the whole volume arrives in seconds and
 * reading never waits at the bottom for a fetch.
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


export default function EpubReader({ file, title, novelId }: EpubReaderProps) {
  const router = useRouter();
  const { prefs, update } = useEpubPrefs();
  const pal = epubPalette(prefs);
  /**
   * Compatibility shape for the JSX below, which was written against the
   * novel reader's theme records. Page colours come from the chosen theme's
   * light/dark palette; chrome stays neutral so six themes need six palettes,
   * not six full chrome designs.
   */
  const t = {
    bg: pal.bg,
    text: pal.text,
    muted: pal.muted,
    panel: prefs.dark ? "#111114" : "#f1f1f3",
    border: prefs.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
  };
  const fontCss = epubFontById(prefs.font).css;

  const [sections, setSections] = useState<SectionPayload[]>([]);
  const [count, setCount] = useState(0);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [current, setCurrent] = useState(0);
  const [booting, setBooting] = useState(true);
  const [appending, setAppending] = useState(false);
  const [fallback, setFallback] = useState(false);
  /** The source (Lnori) is unreachable — a distinct state from "this one book
   *  wouldn't parse", which falls back to epub.js. Handing an unreachable
   *  source to the fallback just fails again against the same dead host. */
  const [sourceDown, setSourceDown] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef<HTMLElement>(null);
  const pendingFragRef = useRef<string | null>(null);
  /**
   * True only between a deliberate jump (open, contents click, footnote) and
   * its scroll landing. The landing effect re-runs whenever sections change —
   * without this flag it also fired on every background APPEND, scrolling the
   * reader back to the top mid-read, again and again as the book streamed in.
   */
  const jumpedRef = useRef(false);
  /** Invalidates the background loader when a jump restarts the column. */
  const loadTokenRef = useRef(0);

  const b = encodeLnori(file);
  const secKey = "epub-sec:" + file;

  const fetchSection = useCallback(
    async (index: number): Promise<SectionPayload | "source-down" | null> => {
      /**
       * v=2 is a cache-bust, and it matters more than it looks. Sections are
       * served immutable with a day of browser cache — so a phone that opened
       * a book BEFORE the sanitiser stripped inline styles keeps replaying the
       * poisoned payload from its own cache, and no redeploy can reach it.
       * A new cache key drains it instantly. Bump when extraction output
       * changes shape again.
       */
      const res = await fetch(
        "/api/proxy/lnori/section?b=" + encodeURIComponent(b) + "&sec=" + index + "&v=2"
      ).catch(() => null);
      // 503 is the source refusing us wholesale (Cloudflare challenge / down).
      // Flag it so the caller shows "unavailable" rather than a doomed fallback.
      if (res?.status === 503) return "source-down" as const;
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
      jumpedRef.current = true;
      loadTokenRef.current++;
      pendingFragRef.current = fragment || null;
      const payload = await fetchSection(index);
      if (payload === "source-down") {
        // The whole source is unreachable — the fallback fetches the same dead
        // host, so show the message instead of failing twice.
        setSourceDown(true);
        return;
      }
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

  /**
   * THE WHOLE BOOK LOADS EAGERLY, in order, starting the moment the entry
   * section is on screen.
   *
   * This replaced two generations of "load more when the reader nears the
   * bottom" (scroll events, then an observed sentinel). Both meant WAITING at
   * the bottom mid-read, and combined with the anchor bug they produced the
   * worst behaviour this reader shipped: reach the bottom, wait for the
   * fetch, get scrolled back to the top. Streaming everything up front costs
   * a few seconds of background requests against an already-cached archive
   * and removes the entire class.
   *
   * Sequential on purpose: sections append strictly in order, so the column
   * never has a gap, and each response lands below the reading position —
   * appending below never moves what you are looking at.
   *
   * The token invalidates the loop when a contents jump restarts the column
   * at a different section; without it the old loop would keep appending
   * from its own cursor and stitch a gap into the new column.
   */
  useEffect(() => {
    if (booting || fallback || count === 0 || sections.length === 0) return;
    const token = ++loadTokenRef.current;
    let cancelled = false;

    (async () => {
      let next = sections[sections.length - 1].index + 1;
      let failures = 0;
      if (next < count) setAppending(true);
      while (!cancelled && token === loadTokenRef.current && next < count) {
        const payload = await fetchSection(next);
        if (cancelled || token !== loadTokenRef.current) return;
        // The source dropped mid-stream. The reader already has the sections
        // loaded so far; stop quietly rather than push the sentinel as a
        // section or hammer a dead host.
        if (payload === "source-down") break;
        if (payload) {
          failures = 0;
          setSections((prev) =>
            prev.some((s) => s.index === payload.index) ? prev : [...prev, payload]
          );
          next++;
        } else if (++failures >= 3) {
          // Three consecutive misses: stop quietly rather than hammer a source
          // that is down. A contents jump re-enters and tries again.
          break;
        } else {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!cancelled && token === loadTokenRef.current) setAppending(false);
    })();

    return () => {
      cancelled = true;
    };
    // `sections` is deliberately not a dependency: the loop keeps its own
    // cursor, and re-running on every append would spawn a loop per section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, fallback, count, fetchSection]);

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

  /**
   * Land on the requested anchor (or the top) once a JUMP has rendered — and
   * only a jump.
   *
   * This effect re-runs whenever sections change, and it used to act every
   * time: each background append scrolled the reader back to the top, over
   * and over while the book streamed in. The flag is set by jumpTo alone and
   * consumed here, so appends change nothing about the scroll position.
   */
  useEffect(() => {
    if (booting || !sections.length || !jumpedRef.current) return;
    jumpedRef.current = false;
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
   * ?scrolldebug=1 — a phone-readable diagnosis overlay.
   *
   * I cannot reach the reader from here (invite gate), so when scrolling
   * misbehaves on a device the fastest path is the device telling us why.
   * Reads window.location.search directly and NOT useSearchParams: that hook
   * without a Suspense boundary fails `next build` on this repo, and a debug
   * aid that breaks the build is a bad joke.
   */
  const [debug, setDebug] = useState(false);
  const [dbgInfo, setDbgInfo] = useState("");
  const dbgCounts = useRef({ touch: 0, scroll: 0 });

  useEffect(() => {
    try {
      setDebug(window.location.search.includes("scrolldebug"));
    } catch {
      /* ssr */
    }
  }, []);

  useEffect(() => {
    if (!debug) return;
    const el = scrollRef.current;
    if (!el) return;
    const onT = () => { dbgCounts.current.touch++; };
    const onS = () => { dbgCounts.current.scroll++; };
    el.addEventListener("touchmove", onT, { passive: true });
    el.addEventListener("scroll", onS, { passive: true });
    const timer = window.setInterval(() => {
      const bad: string[] = [];
      el.querySelectorAll(".epub-html *").forEach((n) => {
        if (bad.length >= 5) return;
        const cs = getComputedStyle(n as Element);
        if (cs.touchAction === "none" || cs.position === "fixed") {
          bad.push((n as Element).tagName.toLowerCase());
        }
      });
      setDbgInfo(
        [
          "ta=" + getComputedStyle(el).touchAction,
          "scrollable=" + (el.scrollHeight > el.clientHeight) + "(" + el.scrollHeight + "/" + el.clientHeight + ")",
          "sec=" + sections.length + "/" + count,
          "bad=" + (bad.join(",") || "none"),
          "touch=" + dbgCounts.current.touch,
          "top=" + Math.round(el.scrollTop),
        ].join(" ")
      );
    }, 600);
    return () => {
      el.removeEventListener("touchmove", onT);
      el.removeEventListener("scroll", onS);
      window.clearInterval(timer);
    };
  }, [debug, sections, count]);

  /**
   * Bionic pass. Runs over newly rendered sections whenever the toggle is on;
   * idempotent per section via the data attribute applyBionic stamps, so
   * streamed-in sections get the treatment as they arrive without re-walking
   * the ones already done.
   */
  useEffect(() => {
    if (!prefs.bionic) return;
    scrollRef.current
      ?.querySelectorAll<HTMLElement>(".epub-html")
      .forEach((sec) => applyBionic(sec));
  }, [prefs.bionic, sections]);

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

  if (sourceDown) {
    // The whole EPUB source is offline (Lnori went behind a Cloudflare
    // challenge). Say so plainly and get the reader out, rather than spin or
    // hand off to a fallback that hits the same dead host.
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ backgroundColor: t.bg, color: t.text }}>
        <BookX className="h-12 w-12" style={{ color: t.muted }} />
        <div>
          <p className="font-fell text-2xl">This book is temporarily unavailable</p>
          <p className="mx-auto mt-2 max-w-sm font-mono text-sm" style={{ color: t.muted }}>
            The library it comes from is offline right now. Your place is saved — try again later.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className="rounded-xl border px-4 py-2 font-mono text-sm font-bold transition hover:bg-white/10"
            style={{ borderColor: t.border, color: t.text }}
          >
            Back to series
          </Link>
          <button
            onClick={() => router.push(browseAnchorHref("/novel"))}
            className="rounded-xl bg-pink-500 px-4 py-2 font-mono text-sm font-bold text-white transition hover:bg-pink-600"
          >
            Browse novels
          </button>
        </div>
      </div>
    );
  }

  if (fallback) {
    // Loud on purpose: a "scrolling is broken" report means nothing until we
    // know WHICH reader the person was in.
    if (typeof window !== "undefined") console.info("[epub] extractor fallback engaged for", novelId);
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
          {/* The way out. A reader has no persistent nav, so abandoning a book
              meant unwinding the stack a tap at a time — returns to the grid
              you were browsing, filters and all. */}
          <button
            onClick={() => router.push(browseAnchorHref("/novel"))}
            className={chipBtn}
            style={{ color: t.text }}
            title="Back to browsing"
          >
            <Home className="h-5 w-5" />
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
            <span className="font-mono text-[11px] tabular-nums sm:text-xs" style={{ color: t.muted }}>
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
        // Capped and internally scrollable: on a phone the wrapped chips run
        // long, and uncapped they shoved the reading column almost entirely
        // off screen — which read as "the reader is broken", not "a panel is
        // open".
        <div
          className="max-h-[55vh] shrink-0 space-y-4 overflow-y-auto overscroll-contain border-b px-4 py-4"
          style={{ backgroundColor: t.panel, borderColor: t.border }}
        >
          {/* Live preview — the reference shows one, and it earns its space:
              theme, face, size and bionic all read at a glance before they hit
              a whole page. */}
          <div
            className="grid h-20 place-items-center rounded-xl border px-3 text-center"
            style={{
              backgroundColor: pal.bg,
              borderColor: t.border,
              color: pal.text,
              fontFamily: fontCss,
              fontSize: prefs.size,
            }}
          >
            {prefs.bionic ? (
              <span><b>Lor</b>em <b>ips</b>um <b>dol</b>or</span>
            ) : (
              <span>Lorem ipsum dolor</span>
            )}
          </div>

          <button
            onClick={() => update({ bionic: !prefs.bionic })}
            className={`w-full rounded-xl border-2 py-2.5 font-mono text-sm font-bold transition ${
              prefs.bionic
                ? "border-sky-400 bg-sky-500/15 text-sky-300"
                : "border-sky-500/60 text-sky-400 hover:bg-sky-500/10"
            }`}
          >
            Bionic Reading
          </button>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border" style={{ borderColor: t.border }}>
              {([
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["right", AlignRight],
              ] as [EpubAlign, typeof AlignLeft][]).map(([id, Icon]) => (
                <button
                  key={id}
                  onClick={() => update({ align: id })}
                  className="grid place-items-center px-4 py-2 transition hover:bg-white/10"
                  style={{
                    backgroundColor: prefs.align === id ? "rgba(56,189,248,0.15)" : "transparent",
                    color: prefs.align === id ? "#38bdf8" : t.muted,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            {/* Full-row on a phone: a 7rem slider is unusable under a thumb. */}
            <label className="flex w-full items-center gap-2 font-mono text-xs sm:w-auto sm:flex-1" style={{ color: t.muted }}>
              A
              <input
                type="range"
                min={EPUB_SIZE_MIN}
                max={EPUB_SIZE_MAX}
                value={prefs.size}
                onChange={(e) => update({ size: Number(e.target.value) })}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-sky-400"
              />
              <span className="text-base font-bold">A</span>
              <span className="tabular-nums" style={{ color: t.text }}>{prefs.size}px</span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {EPUB_FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => update({ font: f.id })}
                className="rounded-xl py-2.5 font-mono text-xs font-bold transition"
                style={{
                  backgroundColor:
                    prefs.font === f.id
                      ? "#38bdf8"
                      : prefs.dark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.05)",
                  color: prefs.font === f.id ? "#06121c" : t.text,
                  fontFamily: f.css,
                }}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Sun className="h-4 w-4" style={{ color: prefs.dark ? t.muted : "#f59e0b" }} />
            <button
              onClick={() => update({ dark: !prefs.dark })}
              className={`relative h-6 w-11 rounded-full transition ${prefs.dark ? "bg-sky-400" : "bg-slate-400"}`}
              title={prefs.dark ? "Switch to light" : "Switch to dark"}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs.dark ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
            <Moon className="h-4 w-4" style={{ color: prefs.dark ? "#38bdf8" : t.muted }} />
            <span className="font-mono text-xs" style={{ color: t.muted }}>
              {prefs.dark ? "Dark" : "Light"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {EPUB_THEMES.map((theme) => (
              <button key={theme.id} onClick={() => update({ theme: theme.id })} className="text-center">
                <span
                  className="block h-14 w-full rounded-xl border-2 transition"
                  style={{
                    backgroundColor: prefs.dark ? theme.dark.bg : theme.light.bg,
                    borderColor: prefs.theme === theme.id ? "#38bdf8" : t.border,
                  }}
                />
                <span
                  className="mt-1.5 block font-mono text-[11px] font-bold"
                  style={{ color: prefs.theme === theme.id ? "#38bdf8" : t.muted }}
                >
                  {theme.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* overscroll-contain: reaching the end of the book must not hand the
          gesture to the page underneath — on mobile that rubber-bands the
          whole app behind the reader. */}
      <main
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        // touch-action declares the gesture contract outright: vertical pans
        // belong to this container, full stop. Without it, whatever an
        // injected element does with the gesture decides whether the page
        // moves — and the injected markup is a publisher's, not ours.
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
      >
        {tocOpen && (
          <>
            {/* Tap-outside-to-close. On a phone the drawer covers most of the
                screen, and without a backdrop the only way out was the small X
                — the reading area behind it looked broken rather than merely
                covered. */}
            <div
              className="absolute inset-0 z-10 bg-black/50"
              onClick={() => setTocOpen(false)}
              aria-hidden
            />
            <div
              className="absolute inset-y-0 left-0 z-20 w-[85vw] max-w-[320px] overflow-y-auto overscroll-contain border-r p-3"
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
          </>
        )}

        {booting ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: t.muted }} />
          </div>
        ) : (
          <div
            onClick={onContentClick}
            // Keyed on bionic so turning it OFF remounts the column with the
            // clean server HTML — un-bolding a walked DOM in place is far more
            // fragile than simply re-rendering it.
            key={prefs.bionic ? "bionic" : "plain"}
            className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-8 sm:pt-8"
            style={{
              fontFamily: fontCss,
              fontSize: prefs.size,
              lineHeight: 1.75,
              textAlign: prefs.align === "left" ? undefined : prefs.align,
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

      {debug && (
        <div className="pointer-events-none fixed bottom-2 left-2 right-2 z-[300] rounded bg-black/85 p-2 font-mono text-[10px] leading-relaxed text-lime-300">
          {dbgInfo || "collecting…"}
        </div>
      )}

      {/* React hoists this into <head>; the reference's faces load once. */}
      <link rel="stylesheet" href={FONT_STYLESHEET} />

      {/* The book's markup arrives unstyled, so give its images and tables sane
          behaviour inside our column. Scoped to .epub-html so it cannot leak
          into the reader's own chrome. OpenDyslexic is declared here because
          Google Fonts does not carry it. */}
      <style>{`
        @font-face { font-family: 'OpenDyslexic'; src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff'); font-weight: 400; font-display: swap; }
        .epub-html, .epub-html * { touch-action: pan-y !important; position: static !important; }
        .epub-html table, .epub-html table * { touch-action: pan-x pan-y !important; }
        .epub-html img { max-width: 100%; height: auto; display: block; margin: 1.25em auto; touch-action: pan-y; -webkit-user-drag: none; user-select: none; }
        .epub-html svg { max-width: 100%; height: auto; touch-action: pan-y; }
        .epub-html p { margin: 0.9em 0; }
        .epub-html h1, .epub-html h2, .epub-html h3 { margin: 1.4em 0 0.7em; font-weight: 700; }
        .epub-html a[data-epub-sec] { color: #f472b6; cursor: pointer; text-decoration: underline; }
        .epub-html table { max-width: 100%; overflow-x: auto; display: block; }
        .epub-html hr { margin: 2em auto; opacity: 0.3; }
      `}</style>
    </div>
  );
}
