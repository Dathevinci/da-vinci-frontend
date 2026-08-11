"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, ExternalLink, X } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/** The whole mount stagger is squeezed into this budget no matter how many
 *  squares there are — 365 nodes must not mean 365 × per-node delay. */
const STAGGER_TOTAL_MS = 600;

/** useLayoutEffect warns when React renders this on the server. The grid only
 *  exists after a client fetch, but the hook call itself is in the SSR'd body. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The four ranges the owner asked for. Anything at or under STRIP_MAX days is
 * too few squares to be a heatmap and renders as a day strip instead.
 */
const PERIODS: { label: string; short: string; days: number }[] = [
  { label: "Today", short: "Today", days: 1 },
  { label: "3 days", short: "3d", days: 3 },
  { label: "This week", short: "Week", days: 7 },
  { label: "This year", short: "Year", days: 365 },
];

const STRIP_MAX = 7;

/** Empty slate → bright violet. Index is the intensity step (0..4). */
const LEVEL_BG = ["#14141b", "#2e2350", "#4c3596", "#7c4ddb", "#a78bfa"];

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/* Grid geometry. The weekday label column is a fixed box so the cell-size
 * formula and the absolutely-placed month captions agree on where column 0
 * starts — GUTTER is the single number both of them use. */
const GUTTER_W = 22;
const GUTTER_MR = 6;
const GUTTER = GUTTER_W + GUTTER_MR;
const CELL_MIN = 11;
const CELL_MAX = 26;
/** Head room above row 0 for the month captions and the hover tooltip. The
 *  tooltip is ~24px tall and hangs above its square, so at 28 a Sunday's
 *  tooltip clipped against the scroller's now-explicit overflow-y: hidden. */
const GRID_PAD_TOP = 34;
/** Must clear the .ah-hit ::after bleed (-5px) or the bled box becomes
 *  scrollable overflow — see the note on .ah-scroller. */
const GRID_PAD_BOTTOM = 8;

type DayRow = { date: string; episodes: number; chapters: number; total: number };

type Totals = {
  items: number;
  episodes: number;
  chapters: number;
  dailyAverage: number;
  currentStreak: number;
  bestStreak: number;
};

type ActivityResp = {
  days: DayRow[];
  totals: Totals;
  range: { from: string; to: string };
};

type DayItem = {
  type: "anime" | "manhwa" | "novel";
  title: string;
  cover: string | null;
  label: string;
  href: string | null;
};

type DayDetail = { date: string; episodes: number; chapters: number; items: DayItem[] };

type Cell = {
  key: string;
  date: string | null;
  count: number;
  episodes: number;
  chapters: number;
  inRange: boolean;
  delay: number;
};

/* ── UTC date helpers ──────────────────────────────────────────────────────
 * The server buckets in UTC and says so. Every date here is parsed and read
 * through UTC accessors so a square never slides a day for a user in UTC+13.
 */

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** "Aug 4, 2026" — forced to UTC so it matches the square it labels. */
function prettyDate(s: string): string {
  const d = parseYmd(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Aug 4" — the strip card is already stamped with the year by context. */
function shortDate(s: string): string {
  const d = parseYmd(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Mon" */
function weekdayName(s: string): string {
  const d = parseYmd(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

const TYPE_LABEL: Record<string, string> = {
  anime: "Anime",
  manhwa: "Manhwa",
  novel: "Novel",
};

/**
 * THE CELL-SIZING FORMULA — the fix for the dead third of the card.
 *
 *   cell = clamp(CELL_MIN, floor((width - GUTTER - totalGaps) / weeks), CELL_MAX)
 *
 * The gap is proportional rather than fixed: a first pass assumes 3px, and if
 * that lands the cell under 14px the pass is redone at 2px, which buys back a
 * pixel or two of cell on narrow cards. Everything is derived — nothing about
 * the square is hardcoded any more, so the grid is exactly as wide as whatever
 * box it was handed.
 */
function measureCell(width: number, weeks: number): { cell: number; gap: number } {
  if (!width || weeks <= 0) return { cell: 13, gap: 3 };
  const fit = (gap: number) =>
    Math.floor((width - GUTTER - gap * Math.max(0, weeks - 1)) / weeks);
  let gap = 3;
  let cell = fit(gap);
  if (cell < 14) {
    gap = 2;
    cell = fit(gap);
  }
  cell = Math.max(CELL_MIN, Math.min(CELL_MAX, cell));
  return { cell, gap };
}

/** Corner softens as the square grows — a 2px radius on a 23px tile reads sharp. */
function cellRadius(cell: number): number {
  if (cell >= 18) return 4;
  if (cell >= 14) return 3;
  return 2;
}

/**
 * Intensity steps picked off the data, not off hardcoded counts: quartiles of
 * the days that actually have activity. A reader who does two chapters a day
 * still gets a full five-tone ramp instead of one flat colour.
 */
function makeLevelFn(days: DayRow[]): (count: number) => number {
  const nz = days
    .map((d) => d.total)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (nz.length === 0) return () => 0;
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.floor(p * (nz.length - 1)))];
  const t1 = q(0.25);
  const t2 = Math.max(t1, q(0.5));
  const t3 = Math.max(t2, q(0.75));
  return (count: number) => {
    if (count <= 0) return 0;
    if (count <= t1) return 1;
    if (count <= t2) return 2;
    if (count <= t3) return 3;
    return 4;
  };
}

/**
 * A number that counts up from zero — the same rAF roll the raid report uses
 * (src/app/raid/page.tsx), with two changes: `reduce` is passed in rather than
 * read from framer alone, because Performance Mode also has a say, and it can
 * land on one decimal for the daily average.
 */
function Roll({
  to,
  delay = 0,
  decimals = 0,
  reduce,
  className,
}: {
  to: number;
  delay?: number;
  decimals?: number;
  reduce: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) {
      setShown(to);
      return;
    }
    let start: number | null = null;
    const dur = 700;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(to * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    const t = setTimeout(() => {
      raf.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(t);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [to, delay, reduce]);
  const text =
    decimals > 0
      ? shown.toFixed(decimals)
      : Math.round(shown).toLocaleString();
  return <span className={className}>{text}</span>;
}

/** Compact tile. The strip that holds these is width-capped by the parent, so
 *  a two-digit number is never marooned in 430px of nothing. */
function StatTile({
  value,
  label,
  color,
  decimals,
  suffix,
  reduce,
  delay,
}: {
  value: number;
  label: string;
  color: string;
  decimals?: number;
  suffix?: string;
  reduce: boolean;
  delay: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
      <div
        className="font-fell text-2xl font-bold leading-none sm:text-[26px]"
        style={{ color }}
      >
        <Roll to={value} decimals={decimals} delay={delay} reduce={reduce} />
        {suffix ? <span className="text-base">{suffix}</span> : null}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>
    </div>
  );
}

/** Cover thumb that degrades to a lettered block — a missing image never
 *  removes the row, it just loses its picture. */
function Thumb({ cover, title }: { cover: string | null; title: string }) {
  const [broken, setBroken] = useState(false);
  const show = cover && !broken;
  if (!show) {
    return (
      <div className="grid h-14 w-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-bold text-white/30">
        {(title || "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={cover as string}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-14 w-10 shrink-0 rounded-md border border-white/10 object-cover"
    />
  );
}

/**
 * One day of the short-range strip. Below sm these stack, so the card is
 * written column-first and simply gets wider when the row goes horizontal.
 */
function DayCard({
  date,
  total,
  detail,
  loading,
  maxItems,
  isToday,
  reduce,
  delay,
  onMore,
}: {
  date: string;
  total: number;
  detail: DayDetail | null;
  loading: boolean;
  maxItems: number;
  isToday: boolean;
  reduce: boolean;
  delay: number;
  onMore: () => void;
}) {
  const items = detail?.items || [];
  const extra = Math.max(0, items.length - maxItems);
  const shownItems = items.slice(0, maxItems);

  return (
    <div
      className={`ah-card-in flex min-w-0 flex-1 flex-col rounded-xl border p-3 ${
        total > 0
          ? "border-violet-400/20 bg-violet-500/[0.05]"
          : "border-white/10 bg-white/[0.02]"
      }`}
      style={{ animationDelay: reduce ? undefined : `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            {weekdayName(date)}
          </div>
          <div className="mt-0.5 truncate text-xs font-bold text-white/70">
            {shortDate(date)}
          </div>
        </div>
        <div
          className="font-fell text-3xl font-bold leading-none"
          style={{ color: total > 0 ? "#a78bfa" : "rgba(255,255,255,0.18)" }}
        >
          {total}
        </div>
      </div>

      {isToday ? (
        <span className="mt-2 self-start rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-violet-200/85">
          Today
        </span>
      ) : null}

      <div className="mt-2.5 min-w-0 border-t border-white/5 pt-2.5">
        {loading ? (
          <div className="ah-pulse space-y-1.5">
            <div className="h-2.5 w-4/5 rounded bg-white/[0.06]" />
            <div className="h-2.5 w-3/5 rounded bg-white/[0.05]" />
          </div>
        ) : shownItems.length === 0 ? (
          <p className="text-[11px] italic text-white/25">nothing yet</p>
        ) : (
          <ul className="-mx-1 space-y-0.5">
            {shownItems.map((it, i) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1 truncate text-[11px] leading-snug text-white/75">
                    {it.title}
                  </span>
                  <span className="shrink-0 text-[10px] leading-snug text-white/35">
                    {it.label}
                  </span>
                </>
              );
              return (
                <li key={`${it.type}-${it.label}-${i}`} className="min-w-0">
                  {it.href ? (
                    <a
                      href={it.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${TYPE_LABEL[it.type] || "Item"} · ${it.title}`}
                      className="ah-tap flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-white/[0.06]"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md px-1 py-1">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {extra > 0 ? (
          <button
            type="button"
            onClick={onMore}
            className="ah-tap mt-1 w-full rounded-md px-1 py-1 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-violet-300/70 transition hover:text-violet-200"
          >
            +{extra} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The day sheet — one node, so framer is affordable here. Bottom sheet below
 * sm, centred dialog above it. Mounted conditionally by the parent so
 * useLockBodyScroll (which locks unconditionally on mount) is correct.
 */
function DayModal({
  userId,
  date,
  reduce,
  seed,
  onLoaded,
  onClose,
}: {
  userId: string;
  date: string;
  reduce: boolean;
  seed: DayDetail | null;
  onLoaded: (detail: DayDetail) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DayDetail | null>(seed);
  const [loading, setLoading] = useState(!seed);
  const [failed, setFailed] = useState(false);

  useLockBodyScroll();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (seed) {
      setDetail(seed);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/users/${encodeURIComponent(userId)}/activity/${encodeURIComponent(date)}`,
          { signal: ctrl.signal }
        );
        const json = await res.json();
        if (json?.success && json.data) {
          const next: DayDetail = {
            date: json.data.date || date,
            episodes: Number(json.data.episodes) || 0,
            chapters: Number(json.data.chapters) || 0,
            items: Array.isArray(json.data.items) ? json.data.items : [],
          };
          setDetail(next);
          onLoaded(next);
        } else {
          setFailed(true);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
    // onLoaded is a stable useCallback on the parent; listing it would not
    // change when this runs, and the fetch must key off the date alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date, seed]);

  const eps = detail?.episodes ?? 0;
  const chs = detail?.chapters ?? 0;
  const subtitle = `${eps} ${eps === 1 ? "episode" : "episodes"} watched · ${chs} ${
    chs === 1 ? "chapter" : "chapters"
  } read on this day`;

  const enter = reduce
    ? { opacity: 1, y: 0 }
    : { opacity: 0, y: 28 };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/85 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Activity on ${prettyDate(date)}`}
        initial={enter}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, y: 28 }}
        transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="font-fell text-xl font-bold text-white sm:text-2xl">
              {prettyDate(date)}
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45 sm:text-xs">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-14 w-10 shrink-0 rounded-md bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                    <div className="h-2.5 w-1/3 rounded bg-white/[0.04]" />
                  </div>
                </div>
              ))}
            </div>
          ) : failed || !detail || detail.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">
              Nothing to show for this day.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.items.map((it, i) => {
                const meta = `${TYPE_LABEL[it.type] || "Item"} · ${it.label}`;
                const inner = (
                  <>
                    <Thumb cover={it.cover} title={it.title} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white/90">
                        {it.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-white/45">{meta}</span>
                    </span>
                    {it.href ? (
                      <ExternalLink className="h-4 w-4 shrink-0 text-violet-300/70" />
                    ) : null}
                  </>
                );
                return (
                  <li key={`${it.type}-${it.label}-${i}`}>
                    {it.href ? (
                      <a
                        href={it.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 transition hover:border-violet-400/30 hover:bg-white/[0.07]"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * ACTIVITY HISTORY — a GitHub-style contribution grid over the user's watch /
 * read ledger for the year, and a day strip for the short ranges where a grid
 * of three squares would be a joke. Reads two public endpoints; renders counts
 * only (the ledger's Arise Point amounts never come down the wire).
 */
export default function ActivityHistory({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const [days, setDays] = useState(365);
  const [data, setData] = useState<ActivityResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [everHad, setEverHad] = useState(false);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; text: string } | null>(null);

  /* Derived cell geometry — see measureCell. Seeded with the old hardcoded
   * 13px so the very first paint (before the observer fires) is sane. */
  const [box, setBox] = useState(0);
  const [dayDetails, setDayDetails] = useState<Record<string, DayDetail | null>>({});
  const [stripLoading, setStripLoading] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  /* Day details survive period switches: flipping Today → 3 days → Today does
   * not refetch anything already in this map. inflight dedupes the overlap so
   * a fast double-toggle fires one request per date, not two. */
  const dayCache = useRef<Map<string, DayDetail>>(new Map());
  const inflight = useRef<Map<string, Promise<DayDetail | null>>>(new Map());

  const osReduce = useReducedMotion();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();

  /* Motion is opt-IN: it only runs once preferences are known AND neither the
   * OS setting nor Performance Mode objects. If prefs have not loaded yet we
   * bias to "no animation", which is the safe direction to be wrong in. */
  const reduce = !prefsLoaded || !!osReduce || !!preferences.reducedMotion;

  const isStrip = days <= STRIP_MAX;

  /* A different account is a different ledger — never serve its cached days. */
  useEffect(() => {
    dayCache.current.clear();
    inflight.current.clear();
    setDayDetails({});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ctrl = new AbortController();
    const first = data === null;
    if (first) setLoading(true);
    else setRefetching(true);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/users/${encodeURIComponent(userId)}/activity?days=${days}`,
          { signal: ctrl.signal }
        );
        const json = await res.json();
        if (json?.success && json.data) {
          const d = json.data;
          const to = d?.range?.to || ymd(new Date());
          const from = d?.range?.from || ymd(addDays(parseYmd(to), -(days - 1)));
          const totals = {
            items: Number(d?.totals?.items) || 0,
            episodes: Number(d?.totals?.episodes) || 0,
            chapters: Number(d?.totals?.chapters) || 0,
            dailyAverage: Number(d?.totals?.dailyAverage) || 0,
            currentStreak: Number(d?.totals?.currentStreak) || 0,
            bestStreak: Number(d?.totals?.bestStreak) || 0,
          };
          setData({
            days: Array.isArray(d.days) ? d.days : [],
            totals,
            range: { from, to },
          });
          if (totals.items > 0) setEverHad(true);
        } else {
          setFailed(true);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setRefetching(false);
        }
      }
    })();
    return () => ctrl.abort();
    // `data` is read only to tell a first load from a period swap; adding it
    // to the deps would refetch on every successful fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, days]);

  const levelOf = useMemo(() => makeLevelFn(data?.days || []), [data]);

  const dayMap = useMemo(() => {
    const m = new Map<string, DayRow>();
    for (const row of data?.days || []) {
      if (row && typeof row.date === "string") m.set(row.date, row);
    }
    return m;
  }, [data]);

  /** How many days the loaded payload actually covers — used to tell a fresh
   *  render from one still showing the previous period's numbers. */
  const stale = useMemo(() => {
    if (!data) return true;
    const from = parseYmd(data.range.from);
    const to = parseYmd(data.range.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return true;
    const span = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return span !== days;
  }, [data, days]);

  /** Week columns, Sunday-first rows, oldest week on the left. Cells outside
   *  the range are kept as invisible spacers so the weekday rows stay true. */
  const columns = useMemo<Cell[][]>(() => {
    if (!data) return [];
    const from = parseYmd(data.range.from);
    const to = parseYmd(data.range.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
    const start = addDays(from, -from.getUTCDay());
    const end = addDays(to, 6 - to.getUTCDay());
    const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (total <= 0 || total > 500) return [];

    const cols: Cell[][] = [];
    for (let i = 0; i < total; i++) {
      const d = addDays(start, i);
      const key = ymd(d);
      const t = d.getTime();
      const inRange = t >= from.getTime() && t <= to.getTime();
      const row = inRange ? dayMap.get(key) : undefined;
      const col = Math.floor(i / 7);
      if (!cols[col]) cols[col] = [];
      cols[col].push({
        key,
        date: inRange ? key : null,
        count: row ? row.total : 0,
        episodes: row ? row.episodes : 0,
        chapters: row ? row.chapters : 0,
        inRange,
        // The stagger is a FRACTION of one fixed budget, so the last square is
        // always ~600ms behind the first whether there are 30 days or 365.
        delay: Math.round((i / total) * STAGGER_TOTAL_MS),
      });
    }
    return cols;
  }, [data, dayMap]);

  const weekCount = columns.length || Math.ceil(days / 7) + 1;
  const { cell: cellPx, gap: gapPx } = useMemo(
    () => measureCell(box, weekCount),
    [box, weekCount]
  );
  const radius = cellRadius(cellPx);

  /* The grid is measured off its own wrapper, which never scrolls, so the
   * width read back is the space available rather than the space consumed —
   * no feedback loop between a wider cell and a wider container.
   *
   * LAYOUT effect, not a passive one: `box` starts at 0, and measureCell(0)
   * falls back to the old 13px cell. In a passive effect the browser paints
   * that fallback first and the grid visibly snaps ~470px wider (and 63px
   * taller, shoving the sections below it down) one frame later — a jump on
   * the very card whose sizing was the complaint. Reading clientWidth here
   * forces the re-render before paint, so the first painted frame is right. */
  useIsoLayoutEffect(() => {
    if (isStrip) return;
    const el = measureRef.current;
    if (!el) return;
    const apply = (w: number) => {
      const next = Math.round(w);
      setBox((prev) => (Math.abs(prev - next) < 1 ? prev : next));
    };
    apply(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isStrip]);

  /** Month captions ride in the head room above row 0, so the band that used
   *  to be pure padding now says something. Skipped when two months would
   *  collide at small cell sizes. */
  const monthMarks = useMemo(() => {
    const out: { ci: number; label: string }[] = [];
    if (columns.length < 8) return out;
    let last = -1;
    for (let ci = 0; ci < columns.length - 1; ci++) {
      const col = columns[ci];
      const first = col.find((c) => c.inRange) || col[0];
      if (!first) continue;
      const d = parseYmd(first.key);
      const m = d.getUTCMonth();
      if (m === last) continue;
      last = m;
      const prev = out[out.length - 1];
      const minGap = cellPx >= 16 ? 2 : 3;
      if (prev && ci - prev.ci < minGap) continue;
      out.push({
        ci,
        label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      });
    }
    return out;
  }, [columns, cellPx]);

  /* Today lives at the right edge, and that is the part anyone actually cares
   * about — so the scroller starts there instead of a year ago. Re-runs on
   * cell size too, because a resize changes what "the right edge" means. */
  useIsoLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || isStrip || columns.length === 0) return;
    el.scrollLeft = el.scrollWidth;
  }, [columns, cellPx, gapPx, isStrip]);

  /** One fetch per date, ever. Resolves from the map when it is already there,
   *  and joins the in-flight promise when two callers race. */
  const loadDay = useCallback(
    (date: string): Promise<DayDetail | null> => {
      const cached = dayCache.current.get(date);
      if (cached) return Promise.resolve(cached);
      const running = inflight.current.get(date);
      if (running) return running;
      const p = (async () => {
        try {
          const res = await fetch(
            `${API_URL}/api/users/${encodeURIComponent(userId)}/activity/${encodeURIComponent(date)}`
          );
          const json = await res.json();
          if (json?.success && json.data) {
            const detail: DayDetail = {
              date: json.data.date || date,
              episodes: Number(json.data.episodes) || 0,
              chapters: Number(json.data.chapters) || 0,
              items: Array.isArray(json.data.items) ? json.data.items : [],
            };
            dayCache.current.set(date, detail);
            return detail;
          }
          return null;
        } catch (err) {
          return null;
        } finally {
          inflight.current.delete(date);
        }
      })();
      inflight.current.set(date, p);
      return p;
    },
    [userId]
  );

  const rememberDay = useCallback((detail: DayDetail) => {
    dayCache.current.set(detail.date, detail);
  }, []);

  /** Exactly `days` dates ending at the payload's last day, oldest first so
   *  the newest card sits on the right like the grid's newest column. Built
   *  from range.to alone, so a stale payload still yields the right dates. */
  const stripDates = useMemo(() => {
    if (!isStrip || !data) return [] as string[];
    const to = parseYmd(data.range.to);
    if (Number.isNaN(to.getTime())) return [] as string[];
    const out: string[] = [];
    for (let i = days - 1; i >= 0; i--) out.push(ymd(addDays(to, -i)));
    return out;
  }, [isStrip, data, days]);

  const stripKey = stripDates.join(",");

  useEffect(() => {
    if (!isStrip || stripDates.length === 0) return;
    let cancelled = false;
    const snapshot = () => {
      const out: Record<string, DayDetail | null> = {};
      for (const d of stripDates) out[d] = dayCache.current.get(d) || null;
      return out;
    };
    const missing = stripDates.filter((d) => !dayCache.current.has(d));
    setDayDetails(snapshot());
    if (missing.length === 0) {
      setStripLoading(false);
      return;
    }
    setStripLoading(true);
    Promise.all(stripDates.map((d) => loadDay(d))).then(() => {
      if (cancelled) return;
      setDayDetails(snapshot());
      setStripLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // stripKey is the value identity of stripDates; depending on the array
    // itself would rerun this on every render that rebuilt it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStrip, stripKey, loadDay]);

  const showTip = useCallback(
    (el: HTMLElement, cell: Cell) => {
      if (!cell.date) return;
      const n = cell.count;
      setTip({
        left: el.offsetLeft + el.offsetWidth / 2,
        top: el.offsetTop,
        text: `${prettyDate(cell.date)}: ${n} ${n === 1 ? "item" : "items"}`,
      });
    },
    []
  );

  const hideTip = useCallback(() => setTip(null), []);

  const totals = data?.totals;
  const hasAny = !!totals && totals.items > 0;

  const period = PERIODS.find((p) => p.days === days) || PERIODS[3];
  const subtitle = isStrip
    ? days === 1
      ? "Everything you watched and read today"
      : `Episodes watched and chapters read — the last ${days} days`
    : "Episodes watched and chapters read per day — tap a square for the day";

  /**
   * Vanish rather than sit there empty — the rule every other self-contained
   * profile section follows (GuildCard, TitleRack, ShowcaseCards,
   * RecentComments all return null). Without this a brand-new account grows a
   * permanent card of four zeroes over a 371-square blank grid, and a failed
   * fetch renders that same card while asserting "No activity yet", which is a
   * claim about the user that the request never actually established.
   *
   * `everHad` is what keeps the new filters usable: once real activity has
   * been seen, picking Today on a day with nothing must show an empty Today,
   * not yank the whole card (and with it the pills) out from under the tap.
   */
  if (!loading && !everHad && (failed || !hasAny)) return null;

  const gridPending = loading || (refetching && stale);
  const skeletonWeeks = Math.min(53, Math.max(1, Math.ceil(days / 7) + 1));
  const maxStripItems = days <= 3 ? 6 : 3;

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-[#0b0b11] p-3 font-mono sm:rounded-3xl sm:p-5 lg:p-6 ${
        reduce ? "ah-static" : ""
      } ${className || ""}`}
    >
      {/* header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 font-fell text-xl font-bold uppercase tracking-[0.08em] text-white sm:text-2xl">
            <Calendar className="h-5 w-5 shrink-0 text-violet-400" />
            Activity History
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/40 sm:text-xs">
            {subtitle}
          </p>
        </div>

        {/* Segmented pills. Native selects opened an OS-blue dropdown that had
            nothing to do with this theme; this is ours end to end. */}
        <div className="ah-pillbar -mx-1 max-w-full overflow-x-auto px-1 sm:mx-0 sm:shrink-0 sm:overflow-visible sm:px-0">
          <div
            role="group"
            aria-label="Activity period"
            className="inline-flex w-max items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
          >
            {PERIODS.map((p) => {
              const active = p.days === days;
              return (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDays(p.days)}
                  aria-pressed={active}
                  className={`ah-pill whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition sm:text-xs ${
                    active
                      ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                      : "border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                  }`}
                >
                  {/* Short labels below sm: the four full labels total ~342px
                      against ~304px usable at 360px, and the pill that got cut
                      was "This year" — the mount default. */}
                  <span className="sm:hidden">{p.short}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* stats — capped so a 66 is not marooned in the middle of 430px */}
      <div className="mt-3 grid max-w-[760px] grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-2.5">
        {loading || !totals ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[64px] rounded-xl border border-white/10 bg-white/[0.03]"
              />
            ))}
          </>
        ) : (
          <>
            <StatTile
              value={totals.items}
              label="Total items"
              color="#ffffff"
              reduce={reduce}
              delay={0}
            />
            <StatTile
              value={totals.dailyAverage}
              label="Daily average"
              color="#34d399"
              decimals={1}
              reduce={reduce}
              delay={80}
            />
            <StatTile
              value={totals.currentStreak}
              label="Current streak"
              color="#fbbf24"
              suffix="d"
              reduce={reduce}
              delay={160}
            />
            <StatTile
              value={totals.bestStreak}
              label="Best streak"
              color="#a78bfa"
              suffix="d"
              reduce={reduce}
              delay={240}
            />
          </>
        )}
      </div>

      {isStrip ? (
        /* DAY STRIP — one to seven days deserve their contents, not a row of
           squares. Horizontal on sm and up, stacked below it. */
        <div
          className={`mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:gap-2.5 ${
            /* Capped like the stat tiles. On Today a single flex-1 card would
               otherwise stretch across the whole 1388px with a date in one
               corner and a number in the other — the same lonely-number-in-a-
               wide-box shape this redesign exists to remove. */
            days <= 3 ? "sm:max-w-[760px]" : ""
          } ${reduce ? "" : "transition-opacity duration-200"}`}
          style={{ opacity: refetching && stale ? 0.35 : 1 }}
        >
          {stripDates.length === 0 ? (
            <>
              {Array.from({ length: Math.min(days, STRIP_MAX) }).map((_, i) => (
                <div
                  key={i}
                  className="ah-pulse h-[132px] flex-1 rounded-xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </>
          ) : (
            stripDates.map((date, i) => {
              const detail = dayDetails[date] || dayCache.current.get(date) || null;
              const row = dayMap.get(date);
              const total = detail
                ? detail.episodes + detail.chapters
                : row
                ? row.total
                : 0;
              return (
                <DayCard
                  key={date}
                  date={date}
                  total={total}
                  detail={detail}
                  loading={stripLoading && !detail}
                  maxItems={maxStripItems}
                  isToday={date === data?.range.to}
                  reduce={reduce}
                  delay={Math.round(
                    (i / Math.max(1, stripDates.length)) * STAGGER_TOTAL_MS
                  )}
                  onMore={() => setOpenDate(date)}
                />
              );
            })
          )}
        </div>
      ) : (
        /* YEAR GRID — the wrapper is what gets measured; the scroller inside it
           is the ONLY horizontally scrolling thing on the page. */
        <div ref={measureRef} className="mt-3 sm:mt-4">
          <div ref={scrollerRef} className="ah-scroller overscroll-x-contain">
            <div
              className="relative inline-flex"
              style={{
                gap: gapPx,
                paddingTop: GRID_PAD_TOP,
                paddingBottom: GRID_PAD_BOTTOM,
              }}
            >
              <div
                className="flex flex-col"
                style={{ gap: gapPx, width: GUTTER_W, marginRight: GUTTER_MR }}
              >
                {WEEKDAY_LABELS.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-end text-[9px] leading-none text-white/30"
                    style={{ height: cellPx }}
                  >
                    {w}
                  </div>
                ))}
              </div>

              {gridPending ? (
                <div className="ah-pulse flex" style={{ gap: gapPx }}>
                  {Array.from({ length: skeletonWeeks }).map((_, c) => (
                    <div key={c} className="flex flex-col" style={{ gap: gapPx }}>
                      {Array.from({ length: 7 }).map((__, r) => (
                        <div
                          key={r}
                          className="bg-white/[0.05]"
                          style={{
                            width: cellPx,
                            height: cellPx,
                            borderRadius: radius,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : columns.length === 0 ? (
                <div className="flex h-[80px] items-center px-2 text-xs text-white/35">
                  No activity yet
                </div>
              ) : (
                <div
                  key={days}
                  className={`ah-grid-in flex ${
                    reduce ? "" : "transition-opacity duration-200"
                  }`}
                  style={{ gap: gapPx, opacity: refetching ? 0.35 : 1 }}
                >
                  {columns.map((col, ci) => (
                    <div key={ci} className="flex flex-col" style={{ gap: gapPx }}>
                      {col.map((cell) => {
                        if (!cell.inRange) {
                          return (
                            <div
                              key={cell.key}
                              style={{ width: cellPx, height: cellPx }}
                            />
                          );
                        }
                        const lvl = levelOf(cell.count);
                        const style = {
                          width: cellPx,
                          height: cellPx,
                          borderRadius: radius,
                          backgroundColor: LEVEL_BG[lvl],
                          animationDelay: reduce ? undefined : `${cell.delay}ms`,
                        };
                        if (cell.count === 0) {
                          return (
                            <div
                              key={cell.key}
                              className="ah-sq"
                              style={style}
                              onMouseEnter={(e) => showTip(e.currentTarget, cell)}
                              onMouseLeave={hideTip}
                            />
                          );
                        }
                        const n = cell.count;
                        return (
                          <button
                            key={cell.key}
                            type="button"
                            aria-label={`${prettyDate(cell.date as string)}: ${n} ${
                              n === 1 ? "item" : "items"
                            }`}
                            className="ah-sq ah-hit cursor-pointer"
                            style={style}
                            onClick={() => setOpenDate(cell.date)}
                            onMouseEnter={(e) => showTip(e.currentTarget, cell)}
                            onMouseLeave={hideTip}
                            onFocus={(e) => showTip(e.currentTarget, cell)}
                            onBlur={hideTip}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {!gridPending && columns.length > 0
                ? monthMarks.map((m) => (
                    <span
                      key={`${m.ci}-${m.label}`}
                      aria-hidden
                      className="pointer-events-none absolute top-0 text-[9px] leading-none text-white/25"
                      style={{ left: GUTTER + m.ci * (cellPx + gapPx) }}
                    >
                      {m.label}
                    </span>
                  ))
                : null}

              {tip ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-[#15151d] px-2 py-1 text-[10px] text-white/85 shadow-lg"
                  style={{ left: tip.left, top: tip.top - 6 }}
                >
                  {tip.text}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* legend + UTC note — one line, legend right. Year view only: a Less→More
          ramp under a three-day strip explains nothing. */}
      {isStrip ? null : (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-[10px] text-white/30 sm:text-[11px]">
            {!loading && !hasAny ? "No activity yet" : "UTC days"}
          </p>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/35 sm:text-[11px]">
            <span>Less</span>
            {LEVEL_BG.map((bg, i) => (
              <span
                key={i}
                style={{
                  width: Math.min(cellPx, 14),
                  height: Math.min(cellPx, 14),
                  borderRadius: radius,
                  backgroundColor: bg,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      )}

      {isStrip && !loading ? (
        <p className="mt-2.5 text-[10px] text-white/30 sm:text-[11px]">
          {hasAny ? `${period.label} · UTC days` : "No activity in this range · UTC days"}
        </p>
      ) : null}

      {failed && !loading ? (
        <p className="mt-2 text-[10px] text-white/25">Activity could not be loaded.</p>
      ) : null}

      <AnimatePresence>
        {openDate ? (
          <DayModal
            key={openDate}
            userId={userId}
            date={openDate}
            reduce={reduce}
            seed={dayCache.current.get(openDate) || null}
            onLoaded={rememberDay}
            onClose={() => setOpenDate(null)}
          />
        ) : null}
      </AnimatePresence>

      <style jsx global>{`
        .ah-scroller {
          overflow-x: auto;
          /* overflow-y must be stated. With only overflow-x set, the y axis
             computes from visible to auto, and then the .ah-hit ::after hit
             bleed on the bottom row (inset -5px) counts as scrollable overflow
             — which is where the stray vertical scrollbar beside the grid came
             from. Seven weekday rows never scroll. */
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }
        .ah-scroller::-webkit-scrollbar {
          height: 6px;
        }
        .ah-scroller::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
        }
        .ah-pillbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .ah-pillbar::-webkit-scrollbar {
          display: none;
        }
        .ah-sq {
          animation: ahPop 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        /* Hover is a box-shadow, never a transform: .ah-sq's fill-mode keeps the
           keyframe transform applied forever, so a transform hover would be
           silently dead. */
        .ah-hit {
          transition: box-shadow 120ms ease, filter 120ms ease;
          position: relative;
        }
        /* The square can be as small as 11px, but a FINGER is not. This bleeds
           the hit area out past the paint without touching the grid's layout,
           so tapping a day works on a phone — and tapping IS the only way to
           open the day sheet, since hover doesn't exist there. The scroller's
           padding-bottom is sized to swallow the bleed. */
        .ah-hit::after {
          content: "";
          position: absolute;
          inset: -5px;
        }
        .ah-hit:hover,
        .ah-hit:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75);
          filter: brightness(1.15);
        }
        .ah-grid-in {
          /* NO fill-mode. A fill-mode of both pins the keyframe's final
             opacity in the Animations origin, which outranks author
             declarations — including the inline style — so the refetch dim
             silently never rendered. There is no delay here, so a backwards
             fill bought nothing anyway. */
          animation: ahFade 220ms ease-out;
        }
        .ah-card-in {
          animation: ahRise 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ah-pulse {
          animation: ahPulse 1.6s ease-in-out infinite;
        }
        /* Fingers need 44px; a mouse does not, so the desktop pills stay tight. */
        @media (pointer: coarse) {
          .ah-pill,
          .ah-tap {
            min-height: 44px;
          }
          .ah-pill {
            display: inline-flex;
            align-items: center;
          }
        }
        @keyframes ahPop {
          from {
            opacity: 0;
            transform: scale(0.55);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes ahRise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes ahFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes ahPulse {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 0.85;
          }
        }
        /* Two switches, one result: the OS setting and the app's Performance
           Mode (which stamps .ah-static on the section) both hard-stop every
           animation AND every transition inside this card. */
        .ah-static,
        .ah-static *,
        .ah-static *::before,
        .ah-static *::after {
          animation: none !important;
          transition: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ah-sq,
          .ah-grid-in,
          .ah-card-in,
          .ah-pulse {
            animation: none !important;
          }
          .ah-hit,
          .ah-pill,
          .ah-tap {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
