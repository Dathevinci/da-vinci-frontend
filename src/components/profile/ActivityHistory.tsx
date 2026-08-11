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

const PERIODS: { label: string; days: number }[] = [
  { label: "Last year", days: 365 },
  { label: "6 months", days: 180 },
  { label: "3 months", days: 90 },
  { label: "Last month", days: 30 },
];

/** Empty slate → bright violet. Index is the intensity step (0..4). */
const LEVEL_BG = ["#14141b", "#2e2350", "#4c3596", "#7c4ddb", "#a78bfa"];

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

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

const TYPE_LABEL: Record<string, string> = {
  anime: "Anime",
  manhwa: "Manhwa",
  novel: "Novel",
};

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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center sm:px-4">
      <div
        className="font-fell text-2xl font-bold leading-none sm:text-3xl"
        style={{ color }}
      >
        <Roll to={value} decimals={decimals} delay={delay} reduce={reduce} />
        {suffix ? <span className="text-base sm:text-lg">{suffix}</span> : null}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-white/40 sm:text-[11px]">
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
 * The day sheet — one node, so framer is affordable here. Bottom sheet below
 * sm, centred dialog above it. Mounted conditionally by the parent so
 * useLockBodyScroll (which locks unconditionally on mount) is correct.
 */
function DayModal({
  userId,
  date,
  reduce,
  onClose,
}: {
  userId: string;
  date: string;
  reduce: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
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
          setDetail({
            date: json.data.date || date,
            episodes: Number(json.data.episodes) || 0,
            chapters: Number(json.data.chapters) || 0,
            items: Array.isArray(json.data.items) ? json.data.items : [],
          });
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
  }, [userId, date]);

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
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
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
 * read ledger. Reads two public endpoints; renders counts only (the ledger's
 * Arise Point amounts never come down the wire and are never shown).
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
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; text: string } | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const osReduce = useReducedMotion();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();

  /* Motion is opt-IN: it only runs once preferences are known AND neither the
   * OS setting nor Performance Mode objects. If prefs have not loaded yet we
   * bias to "no animation", which is the safe direction to be wrong in. */
  const reduce = !prefsLoaded || !!osReduce || !!preferences.reducedMotion;

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
          setData({
            days: Array.isArray(d.days) ? d.days : [],
            totals: {
              items: Number(d?.totals?.items) || 0,
              episodes: Number(d?.totals?.episodes) || 0,
              chapters: Number(d?.totals?.chapters) || 0,
              dailyAverage: Number(d?.totals?.dailyAverage) || 0,
              currentStreak: Number(d?.totals?.currentStreak) || 0,
              bestStreak: Number(d?.totals?.bestStreak) || 0,
            },
            range: { from, to },
          });
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

    const map = new Map<string, DayRow>();
    for (const row of data.days) {
      if (row && typeof row.date === "string") map.set(row.date, row);
    }

    const cols: Cell[][] = [];
    for (let i = 0; i < total; i++) {
      const d = addDays(start, i);
      const key = ymd(d);
      const t = d.getTime();
      const inRange = t >= from.getTime() && t <= to.getTime();
      const row = inRange ? map.get(key) : undefined;
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
  }, [data]);

  /* Today lives at the right edge, and that is the part anyone actually cares
   * about — so the scroller starts there instead of a year ago. */
  useIsoLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || columns.length === 0) return;
    el.scrollLeft = el.scrollWidth;
  }, [columns]);

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

  /**
   * Vanish rather than sit there empty — the rule every other self-contained
   * profile section follows (GuildCard, TitleRack, ShowcaseCards,
   * RecentComments all return null). Without this a brand-new account grows a
   * permanent card of four zeroes over a 371-square blank grid, and a failed
   * fetch renders that same card while asserting "No activity yet", which is a
   * claim about the user that the request never actually established.
   */
  if (!loading && (failed || !hasAny)) return null;

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-[#0b0b11] p-4 font-mono sm:rounded-3xl sm:p-6 ${className || ""}`}
    >
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 font-fell text-xl font-bold uppercase tracking-[0.08em] text-white sm:text-2xl">
            <Calendar className="h-5 w-5 shrink-0 text-violet-400" />
            Activity History
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/40 sm:text-xs">
            Episodes watched and chapters read per day — tap a square for the day
          </p>
        </div>
        <label className="shrink-0">
          <span className="sr-only">Period</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 outline-none transition hover:border-violet-400/30 focus:border-violet-400/50 sm:w-auto"
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days} className="bg-[#0b0b11]">
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
        {loading || !totals ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[74px] rounded-xl border border-white/10 bg-white/[0.03]"
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

      {/* heatmap — the ONLY horizontally scrolling thing on the page */}
      <div
        ref={scrollerRef}
        className="ah-scroller mt-4 overflow-x-auto overscroll-x-contain sm:mt-5"
      >
        <div
          className={`relative inline-flex gap-[3px] pb-1 pt-9 sm:gap-[3px] ${
            reduce ? "ah-static" : ""
          }`}
        >
          <div className="mr-1 flex flex-col gap-[3px] sm:gap-[3px]">
            {WEEKDAY_LABELS.map((w, i) => (
              <div
                key={i}
                className="flex h-[13px] items-center pr-1 text-[8px] leading-none text-white/30 sm:h-[11px] sm:text-[9px]"
              >
                {w}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="ah-pulse flex gap-[3px] sm:gap-[3px]">
              {Array.from({ length: 53 }).map((_, c) => (
                <div key={c} className="flex flex-col gap-[3px] sm:gap-[3px]">
                  {Array.from({ length: 7 }).map((__, r) => (
                    <div
                      key={r}
                      className="h-[13px] w-[13px] rounded-[2px] bg-white/[0.05] sm:h-[11px] sm:w-[11px]"
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
              className={`ah-grid-in flex gap-[3px] sm:gap-[3px] ${reduce ? "" : "transition-opacity duration-200"}`}
              style={{ opacity: refetching ? 0.35 : 1 }}
            >
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px] sm:gap-[3px]">
                  {col.map((cell) => {
                    if (!cell.inRange) {
                      return (
                        <div
                          key={cell.key}
                          className="h-[13px] w-[13px] sm:h-[11px] sm:w-[11px]"
                        />
                      );
                    }
                    const lvl = levelOf(cell.count);
                    const style = {
                      backgroundColor: LEVEL_BG[lvl],
                      animationDelay: reduce ? undefined : `${cell.delay}ms`,
                    };
                    if (cell.count === 0) {
                      return (
                        <div
                          key={cell.key}
                          className="ah-sq h-[13px] w-[13px] rounded-[2px] sm:h-[11px] sm:w-[11px]"
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
                        className="ah-sq ah-hit h-[13px] w-[13px] cursor-pointer rounded-[2px] sm:h-[11px] sm:w-[11px]"
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

      {/* legend + empty note, outside the scroller */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10px] text-white/30 sm:text-[11px]">
          {!loading && !hasAny ? "No activity yet" : "UTC days"}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-white/35 sm:text-[11px]">
          <span>Less</span>
          {LEVEL_BG.map((bg, i) => (
            <span
              key={i}
              className="h-[13px] w-[13px] rounded-[2px] sm:h-[11px] sm:w-[11px]"
              style={{ backgroundColor: bg }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

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
            onClose={() => setOpenDate(null)}
          />
        ) : null}
      </AnimatePresence>

      <style jsx global>{`
        .ah-scroller {
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
        /* The square is ~13px, but a FINGER is not. This bleeds the hit area
           out past the paint without touching the grid's layout, so tapping a
           day works on a phone — and tapping IS the only way to open the day
           sheet, since hover doesn't exist there. */
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
        .ah-pulse {
          animation: ahPulse 1.6s ease-in-out infinite;
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
           Mode (which stamps .ah-static) both hard-stop every animation. */
        .ah-static .ah-sq,
        .ah-static .ah-grid-in,
        .ah-static .ah-pulse {
          animation: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ah-sq,
          .ah-grid-in,
          .ah-pulse {
            animation: none !important;
          }
          .ah-hit {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
