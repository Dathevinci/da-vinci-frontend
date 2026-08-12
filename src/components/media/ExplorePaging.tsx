"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Infinity as InfinityIcon, LayoutGrid } from "lucide-react";
import {
  PagingMode,
  buildPagerItems,
  resolvePagerBounds,
} from "@/lib/pagingMode";

/**
 * THE PAGING CONTROLS BOTH EXPLORE SURFACES SHARE.
 *
 * Anime explore and the comics/novels explore are separate implementations of
 * the same design, and the paging logic was the part most likely to be written
 * a third time. It lives here instead: one toggle, one pager, imported by both.
 *
 * The pager's honesty rule is the whole reason it is not five lines of numbers:
 * these sources do not all report a total. AniList publishes lastPage,
 * AsuraScans publishes meta.total, and some novel sources publish nothing at
 * all except "there is another page". So the pager has TWO shapes, and picks by
 * what the response actually said — never by guessing.
 */

// ── the mode switch ────────────────────────────────────────────────────────

/**
 * A labelled segmented pair, not an icon.
 *
 * The anime page used to carry a bare ∞ button whose meaning lived entirely in
 * its `title` tooltip — invisible on every touch device there is. Both options
 * are now spelled out and the selected one is filled, so the control says what
 * it does and what it is currently doing without being hovered.
 */
export function PagingModeToggle({
  mode,
  onChange,
  className = "",
}: {
  mode: PagingMode;
  onChange: (mode: PagingMode) => void;
  className?: string;
}) {
  const seg = "flex h-11 items-center gap-1.5 rounded-[14px] px-3 font-mono text-xs font-black transition";
  const on = "bg-white text-black";
  const off = "text-slate-400 hover:text-white";

  return (
    <div
      role="group"
      aria-label="How results load"
      className={`flex shrink-0 items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.04] p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange("infinite")}
        aria-pressed={mode === "infinite"}
        className={`${seg} ${mode === "infinite" ? on : off}`}
      >
        <InfinityIcon className="h-4 w-4" />
        {/* "Infinite scroll" in full where there is room; never an icon alone. */}
        <span className="sm:hidden">Scroll</span>
        <span className="hidden sm:inline">Infinite scroll</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("pages")}
        aria-pressed={mode === "pages"}
        className={`${seg} ${mode === "pages" ? on : off}`}
      >
        <LayoutGrid className="h-4 w-4" /> Pages
      </button>
    </div>
  );
}

// ── the numbered pager ─────────────────────────────────────────────────────

/**
 * How many pages flank the current one. A phone gets one on each side, which
 * with the first and last page and two ellipses is at most seven 44px controls
 * — one row at 360px. Ten numbers wrapping into three rows is the thing this
 * exists to avoid, so the width is chosen rather than discovered.
 */
function useWindowRadius(): number {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(mq.matches);
    sync();
    // Named handler, added and removed as the same reference. Older Safari has
    // only addListener/removeListener, and a leak here would pin a closure per
    // mounted pager for the life of the tab.
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return wide ? 2 : 1;
}

export function ExplorePager({
  page,
  hasNext,
  totalPages,
  deepest,
  loading,
  failed = false,
  approximate = false,
  onGo,
  className = "",
}: {
  page: number;
  hasNext: boolean;
  /** Null/undefined means the source did not report one. It is not zero. */
  totalPages: number | null;
  /**
   * The total is an UPPER BOUND, not a count.
   *
   * Manhwa browse merges two sources and then filters (licensed stubs,
   * duplicate titles), so the reachable-page figure overstates what is
   * actually shown and the tail is sparse. Printing that as a plain count
   * asserts pages that can come back empty, so the caption hedges instead.
   */
  approximate?: boolean;
  /** Deepest page loaded for this query — pages we have proof of. */
  deepest: number;
  loading: boolean;
  /**
   * The last request for this page FAILED.
   *
   * It matters here because a dead request and a finished list look identical
   * from `hasNext`: both leave it false. Without this the pager would print
   * "last page" over a scraper that simply timed out — the same conflation the
   * grid above it already had to be taught not to make.
   */
  failed?: boolean;
  onGo: (page: number) => void;
  className?: string;
}) {
  const radius = useWindowRadius();
  const { knownMax, endKnown } = resolvePagerBounds({ page, hasNext, totalPages, deepest });
  const items = buildPagerItems({ current: page, knownMax, radius, endKnown, hasNext });

  /**
   * With a real total the total governs Next — every page up to it exists, so
   * offering them is truthful even on a page whose own response happened to
   * report no successor. Without one, `hasNext` is the only thing we know, and
   * when it goes false Next stops being offered at all.
   */
  const canNext = endKnown ? page < knownMax : hasNext;
  const canPrev = page > 1;

  const step = "flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-mono text-xs font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04]";

  return (
    <nav aria-label="Pagination" className={`mt-10 ${className}`}>
      {/*
        ONE ROW FROM sm UP, TWO ON A PHONE — by layout, not by accident. The
        number strip claims a full basis on small screens and sits first, so
        Prev/Next land on their own centred row underneath instead of the three
        of them fighting over 328px. Nothing here can overflow sideways: the
        strip wraps as a last resort rather than pushing the page wide.
      */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => canPrev && onGo(page - 1)}
          disabled={!canPrev || loading}
          className={`order-2 sm:order-none ${step}`}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>

        <div className="order-1 flex basis-full flex-wrap items-center justify-center gap-1.5 sm:order-none sm:basis-auto">
          {items.map((item, i) => {
            if (item.kind === "gap") {
              return (
                <span
                  key={`gap-${item.after}`}
                  aria-hidden
                  className="grid h-11 w-5 place-items-center font-mono text-xs text-slate-600"
                >
                  &hellip;
                </span>
              );
            }
            if (item.kind === "more") {
              return (
                <span
                  key="more"
                  aria-hidden
                  title="More pages — the end is not known yet"
                  className="grid h-11 w-5 place-items-center font-mono text-xs text-slate-600"
                >
                  &hellip;
                </span>
              );
            }
            const current = item.page === page;
            return (
              <button
                key={`p-${item.page}-${i}`}
                type="button"
                onClick={() => !current && onGo(item.page)}
                disabled={loading && !current}
                aria-label={`Page ${item.page}`}
                aria-current={current ? "page" : undefined}
                className={`grid h-11 min-w-[44px] place-items-center rounded-xl border px-2 font-mono text-xs font-black transition ${
                  current
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/30 hover:text-white disabled:opacity-40"
                }`}
              >
                {item.page}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => canNext && onGo(page + 1)}
          disabled={!canNext || loading}
          className={`order-3 sm:order-none ${step}`}
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/*
        THE CAPTION IS WHERE THE UNCERTAINTY IS SAID OUT LOUD.

        A reader who sees "1 2 3 Next" under a line admitting the end is not
        known understands exactly what they are looking at. A reader who sees a
        confident "50" that nobody ever measured does not — and would trust it.
      */}
      <p aria-live="polite" className="mt-2.5 px-2 text-center font-mono text-[11px] leading-relaxed text-slate-500">
        {endKnown
          ? approximate
            ? `Page ${page} of about ${knownMax} — this mode merges two sources and filters the results, so the last pages can come back thin or empty.`
            : `Page ${page} of ${knownMax}`
          : failed
            ? `Page ${page}`
            : hasNext
              ? `Page ${page} — this source doesn’t report a page count, so the last page isn’t known yet.`
              : `Page ${page} — last page.`}
      </p>
    </nav>
  );
}
