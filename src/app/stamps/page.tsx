"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Stamp, Trophy, CalendarDays, ChevronLeft, ChevronRight, Users, Sparkles, LogIn, Globe,
} from "lucide-react";
import { StampSeal } from "@/components/stamp/StampSeal";
import RecCard from "@/components/stamp/RecCard";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import {
  StampFeedType,
  StampRankingEntry,
  StampRec,
  StampRequestError,
  GRADE_BANDS,
  daysUntilMonday,
  fetchRecentStamps,
  fetchStampFeed,
  fetchStampRankings,
  hasStampSession,
  isoWeekKey,
  weekKeyAgo,
} from "@/lib/stamps";

/**
 * THE STAMP BOARD — weekly rankings, everyone's recommendations, and the feed
 * of the people you follow.
 *
 * THREE TABS, AND THE MIDDLE ONE IS THE PLAIN ONE. "Top 100" ranks curators and
 * "Following" needs you to already follow somebody, which left no way at all to
 * ask "who has stamped what?" — the only answers were opening profiles one at a
 * time. "All stamps" is that answer: every live recommendation on the site,
 * newest first, filterable by mode, with the curator's name and seal on each
 * card. It is deliberately the least clever name on the row.
 *
 * The board ranks by score EARNED WITHIN the ISO week: votes cast and boosts
 * sent between Monday and Monday, not the all-time total. That is what keeps
 * it alive — a newcomer with one very good recommendation can top a week the
 * same way a long-standing SSS can, and last week's winner has to do it again.
 *
 * EVERY NUMBER ON A ROW NAMES ITS OWN TIMEFRAME. The weekly total gets the
 * week's split (`weekSplit`, which always adds up to it) and the all-time
 * figures are labelled all-time. The row used to print a lifetime earned/boost
 * pair directly under a weekly total, so a member could read "0 earned · 0
 * boosted" beside "5 this week" — two true numbers that no reader could
 * reconcile. If the server sends no split, none is drawn.
 *
 * THE SEALS ARE NOT THE RANK NUMBERS. Last week's top three wear a unique seal
 * DURING this week, and each row now carries `topThreeRank` — the seal that
 * member is wearing RIGHT NOW — so the treatment is the same on every surface
 * and no week arithmetic here decides it. Browsing back to an old week shows
 * the people who hold the podium today, not a podium being promised.
 */

type Tab = "board" | "all" | "feed";

/** ?tab= values that may open a tab directly. Anything else lands on the
 *  board, so a mistyped or stale link degrades to the page's own default. */
const TAB_PARAM: Record<string, Tab> = { board: "board", all: "all", feed: "feed" };

/** The mode filter on the browse tab, in the order it reads across. */
const MODE_FILTERS: { key: StampFeedType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "anime", label: "Anime" },
  { key: "manhwa", label: "Manhwa" },
  { key: "novel", label: "Novels" },
];

const chip = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-xl border px-5 py-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] transition ${
    active
      ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
      : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
  }`;

/** The mode filter's own, smaller chip — a rank below the tab chips on purpose,
 *  so at 375px the two rows of controls stay tellable apart. */
const modeChip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] transition ${
    active
      ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
      : "border-white/10 bg-white/[0.03] text-slate-500 hover:bg-white/[0.07] hover:text-slate-300"
  }`;

/**
 * "YOUR SESSION CAN'T VOTE" — said once above a list, never once per card.
 *
 * Hoisted out of the feed so the browse tab can say the identical thing: the
 * two lists are the same cards with the same thumbs, and a warning that
 * appeared on one of them and not the other would read as a bug in whichever
 * tab was missing it.
 */
function SessionWarning() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3">
      <p className="text-[11px] leading-relaxed text-amber-100/90">
        Your session can&rsquo;t cast votes any more. Sign in again and the thumbs come
        back — nothing you have already voted on is lost.
      </p>
      <Link
        href="/login"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-500/25"
      >
        <LogIn className="h-3.5 w-3.5" /> Sign in again
      </Link>
    </div>
  );
}

/**
 * THE THREE TREATMENTS. Gold, silver, bronze — the same order the seal's own
 * metals run in, so the podium on this page and the seal on a cover read as one
 * system rather than two colour schemes that happen to agree.
 */
const PODIUM_META: Record<number, { tint: string; text: string; label: string }> = {
  1: { tint: "border-amber-400/40 bg-amber-500/[0.08]", text: "text-amber-300", label: "1st" },
  2: { tint: "border-slate-300/30 bg-slate-400/[0.07]", text: "text-slate-300", label: "2nd" },
  3: { tint: "border-orange-400/30 bg-orange-500/[0.07]", text: "text-orange-300", label: "3rd" },
};

/** How long the board runs. The server pages it; this is what the page PROMISES
 *  a reader, and the two have to say the same number. */
const BOARD_SIZE = 100;

/**
 * The ranked week's earned/bought halves, then the all-time total — each
 * carrying its own timeframe, because the grade chip beside them is all-time
 * and a weekly number printed bare next to it is the exact confusion this
 * board was rebuilt to end. Shared by the podium cards and the list rows so
 * the two cannot drift into telling the same reader different things.
 */
function ScoreSplit({ e, live }: { e: StampRankingEntry; live: boolean }) {
  if (!e.weekSplit && !e.lifetime) return null;
  return (
    <p className="text-[10px] tabular-nums text-slate-500">
      {e.weekSplit && (
        <>
          <b className="font-black text-emerald-400/90">{e.weekSplit.organic.toLocaleString()}</b> earned ·{" "}
          <b className="font-black text-amber-400/90">{e.weekSplit.boosted.toLocaleString()}</b> boosted{" "}
          <span className="text-slate-600">{live ? "this week" : "that week"}</span>
        </>
      )}
      {e.lifetime && (
        <span className="text-slate-600">
          {e.weekSplit ? " · " : ""}
          {e.lifetime.score.toLocaleString()} all-time
        </span>
      )}
    </p>
  );
}

/** Avatar + name + all-time grade chip. The same identity block on both shapes. */
function Curator({ e, size = "sm" }: { e: StampRankingEntry; size?: "sm" | "lg" }) {
  const px = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <>
      {e.avatar ? (
        <img
          src={e.avatar}
          alt=""
          loading="lazy"
          className={`${px} shrink-0 rounded-full object-cover ring-1 ring-white/15`}
        />
      ) : (
        <span className={`grid ${px} shrink-0 place-items-center rounded-full bg-violet-700 text-[9px] font-black`}>
          {(e.username || "?").charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 truncate text-sm font-black text-white">{e.username}</span>
      <span
        title="All-time grade — it doesn't reset on Monday"
        className="shrink-0 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-amber-300"
      >
        {e.grade}
      </span>
    </>
  );
}

/**
 * ONE OF THE TOP THREE — the prize, drawn as the prize.
 *
 * These three get the tall card, the medal word and the seal at full size,
 * because on a board a hundred rows long the top of it has to be legible as a
 * podium from across the room; a hundred identical rows with a slightly
 * different border is not a leaderboard anybody scrolls twice.
 */
function PodiumCard({ e, mine, live }: { e: StampRankingEntry; mine: boolean; live: boolean }) {
  const meta = PODIUM_META[e.rank] ?? PODIUM_META[3];
  return (
    <Link
      href={`/user/${encodeURIComponent(e.username)}`}
      className={`flex flex-col items-center gap-2.5 rounded-3xl border px-4 py-6 text-center transition hover:border-white/25 ${
        mine ? "border-violet-400/40 bg-violet-500/10" : meta.tint
      }`}
    >
      <span className={`text-[10px] font-black uppercase tracking-[0.22em] ${meta.text}`}>{meta.label}</span>
      {/* A DIV, not a span: an anchor may wrap flow content, but phrasing
          markup may not, and StampSeal's root element is not ours to assume. */}
      <div>
        <StampSeal username={e.username} grade={e.grade} size="md" rank={e.topThreeRank} />
      </div>
      <div className="flex w-full min-w-0 items-center justify-center gap-2">
        <Curator e={e} size="lg" />
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums text-white">{e.weekScore.toLocaleString()}</p>
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
          {live ? "this week" : "that week"}
        </p>
      </div>
      <ScoreSplit e={e} live={live} />
    </Link>
  );
}

/**
 * ONE ROW OF THE REMAINING NINETY-SEVEN.
 *
 * THE SEAL SLOT IS FIXED-WIDTH AND OFTEN EMPTY, ON PURPOSE. A struck seal is a
 * multi-path SVG; a hundred of them is a hundred, and it would spend the whole
 * page's budget restating the grade chip that is already on the row. So a seal
 * is drawn only for the people who are actually WEARING one — `topThreeRank`,
 * last week's podium, which is a member's standing today no matter where this
 * week has them ranked. The empty slot keeps every row's text on the same
 * vertical line down a list this long.
 */
function BoardRow({ e, mine, live }: { e: StampRankingEntry; mine: boolean; live: boolean }) {
  return (
    <Link
      href={`/user/${encodeURIComponent(e.username)}`}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition hover:border-white/25 sm:gap-4 sm:px-4 ${
        mine ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-[#0b0b11]"
      }`}
    >
      <span className="w-9 shrink-0 text-center text-base font-black tabular-nums text-slate-600 sm:w-11 sm:text-lg">
        {e.rank}
      </span>

      {/* Dropped entirely on a phone: a 56px column that is empty on ninety-odd
          rows out of a hundred costs the username the width it actually needs
          at 375px. The podium above keeps its seals at every size, and the
          podium is where the seal is the point. */}
      <div className="hidden h-14 w-14 shrink-0 place-items-center sm:grid">
        {e.topThreeRank && (
          <StampSeal username={e.username} grade={e.grade} size="sm" rank={e.topThreeRank} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Curator e={e} />
        </div>
        <div className="mt-1">
          <ScoreSplit e={e} live={live} />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-lg font-black tabular-nums text-white sm:text-xl">
          {e.weekScore.toLocaleString()}
        </p>
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
          {live ? "this week" : "that week"}
        </p>
      </div>
    </Link>
  );
}

export default function StampsPage() {
  const { user } = useUser();
  /** The primitive, so the effects below key on the identity and not on a
   *  cached-user object that can be rebuilt without having changed. */
  const viewerId = user?.id || null;

  const [tab, setTab] = useState<Tab>("board");

  /** 0 = the live week, 1 = last week (the one whose podium is worn now). */
  const [weekAgo, setWeekAgo] = useState(0);
  const [entries, setEntries] = useState<StampRankingEntry[]>([]);
  const [serverWeek, setServerWeek] = useState<string | null>(null);
  const [boardLoaded, setBoardLoaded] = useState(false);

  const [feed, setFeed] = useState<StampRec[]>([]);
  const [feedLoaded, setFeedLoaded] = useState(false);

  /* ── "All stamps": everything anyone has stamped, cursor-paged ── */
  const [browseType, setBrowseType] = useState<StampFeedType>("all");
  const [browse, setBrowse] = useState<StampRec[]>([]);
  const [browseCursor, setBrowseCursor] = useState<string | null>(null);
  const [browseLoaded, setBrowseLoaded] = useState(false);
  const [browsingMore, setBrowsingMore] = useState(false);
  const [browseFailed, setBrowseFailed] = useState(false);
  /**
   * WHICH FIRST-PAGE REQUEST IS STILL THE LIVE ONE. Switching Manhwa → Novels
   * quickly leaves two flights racing, and without this the slower (older) one
   * wins the state and the list ends up showing the mode the reader just left.
   * The same token also protects "load more": a page that comes back after the
   * filter changed is dropped instead of being appended to a different list.
   */
  const browseRun = useRef(0);

  /**
   * Signed in by the cached user, but with no session token — so every thumb
   * on this page would come back 401. Read in an effect, once for the whole
   * list rather than once per card, and never during render (localStorage does
   * not exist on the server, and a value that differs between the two paints
   * is a hydration mismatch).
   */
  const [needsSignIn, setNeedsSignIn] = useState(false);
  useEffect(() => {
    setNeedsSignIn(!!viewerId && !hasStampSession());
  }, [viewerId]);

  /* ── the board ── */
  const loadBoard = useCallback(async () => {
    setBoardLoaded(false);
    try {
      const wanted = weekAgo === 0 ? null : weekKeyAgo(weekAgo);
      const d = await fetchStampRankings(wanted);
      setEntries(d.entries);
      setServerWeek(d.week);
    } catch {
      setEntries([]);
      setServerWeek(null);
    } finally {
      setBoardLoaded(true);
    }
  }, [weekAgo]);

  useEffect(() => {
    // Gated like the other two tabs. The board is the heaviest read in the
    // system, and the detail pages now link straight to ?tab=all — arriving
    // there was fetching the whole Top 100 and discarding it unrendered.
    if (tab === "board") loadBoard();
  }, [tab, loadBoard]);

  /* ── the follower feed ── */
  const loadFeed = useCallback(async () => {
    if (!viewerId) {
      setFeedLoaded(true);
      return;
    }
    setFeedLoaded(false);
    try {
      // ONE REQUEST. Each rec carries its owner's grade and podium seal, so
      // there is no second pass over the owners — the version that fanned out
      // to GET /api/stamps/:userId per curator cost ~32 site-wide aggregations
      // per render and still left the 9th curator's cover bare.
      const recs = await fetchStampFeed(viewerId);
      setFeed(recs);
    } catch {
      setFeed([]);
    } finally {
      setFeedLoaded(true);
    }
  }, [viewerId]);

  useEffect(() => {
    if (tab === "feed") loadFeed();
  }, [tab, loadFeed]);

  /* ── everyone's stamps ── */
  const loadBrowse = useCallback(async () => {
    const run = ++browseRun.current;
    setBrowseLoaded(false);
    setBrowseFailed(false);
    setBrowse([]);
    setBrowseCursor(null);
    try {
      // ONE REQUEST FOR THE PAGE, like the feed: every rec already carries its
      // owner's username, grade and podium seal, so nothing here fans out per
      // curator to draw a name or a seal.
      const page = await fetchRecentStamps({ type: browseType, viewer: viewerId });
      if (run !== browseRun.current) return;
      setBrowse(page.recs);
      setBrowseCursor(page.nextCursor);
    } catch {
      if (run !== browseRun.current) return;
      setBrowse([]);
      setBrowseCursor(null);
      // "Nothing has been stamped in this mode" and "the read failed" want
      // opposite words — an outage told as an empty shelf sends the reader off
      // to stamp something to fix a server.
      setBrowseFailed(true);
    } finally {
      if (run === browseRun.current) setBrowseLoaded(true);
    }
  }, [browseType, viewerId]);

  useEffect(() => {
    if (tab === "all") loadBrowse();
  }, [tab, loadBrowse]);

  /**
   * THE NEXT PAGE, APPENDED. A button rather than a scroll observer: this list
   * is the one people leave to open a title and then come back to, and an
   * observer that keeps appending while the browser is restoring a scroll
   * position fights it every time.
   */
  const loadMoreBrowse = useCallback(async () => {
    if (!browseCursor || browsingMore) return;
    const run = browseRun.current;
    setBrowsingMore(true);
    try {
      const page = await fetchRecentStamps({
        type: browseType,
        cursor: browseCursor,
        viewer: viewerId,
      });
      if (run !== browseRun.current) return; // the filter moved under us
      setBrowse((prev) => {
        // De-duped by rec id. The cursor is stable under INSERTS, but a rec
        // retired between two pages shifts the window back by one and can hand
        // the same rec twice — and React answers duplicate keys by dropping a
        // card, so the reader loses a recommendation rather than seeing two.
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.recs.filter((r) => !seen.has(r.id))];
      });
      setBrowseCursor(page.nextCursor);
    } catch (e) {
      // BAD_CURSOR is the one failure here that is not a retry: the server has
      // never heard of this cursor, so pressing again can only fail again. It
      // means the list on screen is from a database this one no longer is, and
      // the only honest recovery is to read page one afresh.
      if (e instanceof StampRequestError && e.code === "BAD_CURSOR") {
        loadBrowse();
        return;
      }
      // Everything else keeps what is on screen AND keeps the button: a failed
      // page is a retry, not a reason to throw away thirty cards mid-read.
    } finally {
      setBrowsingMore(false);
    }
  }, [browseCursor, browsingMore, browseType, viewerId, loadBrowse]);

  /**
   * ?tab=all OPENS THE BROWSE TAB — the link the detail pages point at.
   *
   * Read from window.location in an effect, NOT with useSearchParams: a
   * page-level useSearchParams without a Suspense boundary fails the
   * production build, and a build that fails leaves the last good deploy
   * serving, so the bug looks like "the code didn't ship". The initial state is
   * the same on both paints, so this cannot mismatch on hydration either.
   */
  useEffect(() => {
    const wanted = TAB_PARAM[new URLSearchParams(window.location.search).get("tab") || ""];
    if (wanted) setTab(wanted);
  }, []);

  const week = serverWeek || (weekAgo === 0 ? isoWeekKey() : weekKeyAgo(weekAgo));
  const daysLeft = daysUntilMonday();
  const live = weekAgo === 0;
  /** Only last week's completed podium is being worn right now — used for the
   *  week strip's caption. The SEALS come from each row's own topThreeRank. */
  const podiumIsWorn = weekAgo === 1;

  /** The reader's own standing in the week on screen, or null when they didn't
   *  score in it. The SERVER's rank field, never the array index — a page that
   *  numbered rows itself is exactly how a profile and a board came to print
   *  two different ranks for the same person. */
  const myRank = (viewerId && entries.find((e) => e.userId === viewerId)?.rank) || null;

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-28 pt-14 font-mono text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(245,158,11,0.18),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-4xl">
          {/* ── HEADER ── */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-amber-400/25 bg-amber-500/10">
                  <Stamp className="h-5 w-5 text-amber-300" />
                </span>
                <h1 className="font-fell text-4xl text-white sm:text-5xl">Stamps</h1>
              </div>
              <p className="mt-3 max-w-lg text-sm text-slate-400">
                Three recommendations, one seal, and a grade that answers to whether the
                calls landed.
              </p>
            </div>
            {user && (
              <Link
                href={`/user/${encodeURIComponent(user.username)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:bg-amber-500/25"
              >
                <Sparkles className="h-3.5 w-3.5" /> Your stamp
              </Link>
            )}
          </div>

          {/* ── TABS ── */}
          <div className="mt-8 flex flex-wrap gap-2">
            <button type="button" onClick={() => setTab("board")} className={chip(tab === "board")}>
              <Trophy className="h-3.5 w-3.5" /> Top {BOARD_SIZE}
            </button>
            {/* THE PLAIN ONE. Not "Discover", not "Explore" — the tab has to be
                recognisable as "show me what everyone stamped" from the word
                alone, by someone who came here asking exactly that. */}
            <button type="button" onClick={() => setTab("all")} className={chip(tab === "all")}>
              <Globe className="h-3.5 w-3.5" /> All stamps
            </button>
            <button type="button" onClick={() => setTab("feed")} className={chip(tab === "feed")}>
              <Users className="h-3.5 w-3.5" /> Following
            </button>
          </div>

          {/* ═══════════════════ BOARD ═══════════════════ */}
          {tab === "board" && (
            <>
              {/* week strip */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0b11] px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <CalendarDays className="h-5 w-5 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">Week {week}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {live
                        ? `Scored on this week's votes and boosts · resets Monday, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                        : podiumIsWorn
                          ? "Last week — this top three wear their seals right now"
                          : "A finished week"}
                    </p>
                    {/* WHERE THE READER IS, SAID UP HERE. On a board a hundred
                        rows long, their own violet row is somewhere off-screen;
                        the number is the one thing they came to find. */}
                    {myRank !== null && (
                      <p className="mt-1 text-[11px] font-black text-violet-300">
                        You&rsquo;re #{myRank} {live ? "this week" : "that week"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWeekAgo((w) => w + 1)}
                    aria-label="Previous week"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={live}
                    onClick={() => setWeekAgo((w) => Math.max(0, w - 1))}
                    aria-label="Next week"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5">
                {!boardLoaded ? (
                  /* Placeholders rather than one centred line: the board can be
                     a hundred rows, and collapsing to a single sentence made
                     every week change flash the page's whole height away and
                     back. Static blocks — no pulse; the sweep that took the
                     infinite loops off this app is not being undone for a
                     loading state. */
                  <div>
                    <p className="text-center text-sm text-slate-500">Reading the board…</p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-56 rounded-3xl border border-white/[0.06] bg-[#0b0b11]" />
                      ))}
                    </div>
                    <div className="mt-6 space-y-2" aria-hidden>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-[74px] rounded-2xl border border-white/[0.06] bg-[#0b0b11]" />
                      ))}
                    </div>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
                    <Trophy className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-4 text-sm text-slate-400">
                      {live
                        ? "Nothing scored yet this week — the first thumbs decide it."
                        : "No stamps scored in that week."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* THE PODIUM, LIFTED OUT OF THE LIST. Three cards across,
                        stacked on a phone — the top of a hundred-row board has
                        to be visibly the top, and these three are the only
                        people whose seal will ride the covers they recommend
                        all week. */}
                    <div className="grid gap-2 sm:grid-cols-3">
                      {entries.slice(0, 3).map((e) => (
                        <PodiumCard key={e.userId} e={e} mine={viewerId === e.userId} live={live} />
                      ))}
                    </div>

                    {entries.length > 3 && (
                      <>
                        {/* A named break, so a reader scrolling past the third
                            card knows the long part has started and where in it
                            they are — a hundred unlabelled rows all look like
                            the same row. */}
                        <div className="mt-7 flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
                          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                            The rest of the board
                          </h2>
                          <p className="shrink-0 text-[10px] tabular-nums text-slate-600">
                            4–{entries.length}
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {entries.slice(3).map((e) => (
                            <BoardRow key={e.userId} e={e} mine={viewerId === e.userId} live={live} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* The floor of the board, stated. Someone at 98 wants to
                        know they are on it, and someone at 101 needs to know
                        why they are not. */}
                    <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-600">
                      {entries.length >= BOARD_SIZE
                        ? `The board holds the top ${BOARD_SIZE} stamps of the week.`
                        : `${entries.length} stamp${entries.length === 1 ? "" : "s"} scored ${
                            live ? "so far this week" : "that week"
                          } — the board holds the top ${BOARD_SIZE}.`}
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          {/* ═════════════════ ALL STAMPS ═════════════════ */}
          {/* Every live recommendation on the site, newest first. No follow, no
              account and no profile-hopping required — this is the surface that
              answers "who stamped this manhwa?" from the other direction. */}
          {tab === "all" && (
            <div className="mt-5">
              {/* the mode filter — one row, wraps at 375px instead of scrolling
                  sideways, so nothing important sits off the edge of a phone */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  Mode
                </span>
                {MODE_FILTERS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setBrowseType(m.key)}
                    aria-pressed={browseType === m.key}
                    className={modeChip(browseType === m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Everything the whole site is recommending right now, newest first — the
                curator&rsquo;s name and seal are on every card, and a tap on either opens
                their stamp.
              </p>

              <div className="mt-4">
                {!browseLoaded ? (
                  /* Static blocks the height of a feed card, not a centred
                     line: the list is already tall by the time a filter is
                     tapped, and collapsing to one sentence made every tap
                     throw the page's whole height away and put it back. */
                  <div>
                    <p className="text-center text-sm text-slate-500">Reading the stamps…</p>
                    <div className="mt-4 space-y-3" aria-hidden>
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-40 rounded-2xl border border-white/[0.06] bg-[#0b0b11]" />
                      ))}
                    </div>
                  </div>
                ) : browseFailed ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
                    <Globe className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-4 text-sm text-slate-400">
                      Couldn&rsquo;t read the recommendations just now.
                    </p>
                    <button
                      type="button"
                      onClick={loadBrowse}
                      className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-500/25"
                    >
                      Try again
                    </button>
                  </div>
                ) : browse.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
                    <Stamp className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-4 text-sm text-slate-400">
                      {browseType === "all"
                        ? "Nobody has stamped anything yet — the first three are yours to take."
                        : "Nothing stamped in this mode yet."}
                    </p>
                  </div>
                ) : (
                  <>
                    {needsSignIn && <SessionWarning />}
                    <div className="space-y-3">
                      {browse.map((rec) => (
                        <RecCard
                          key={rec.id}
                          rec={rec}
                          variant="feed"
                          viewerId={viewerId}
                          needsSignIn={needsSignIn}
                          showOwner
                        />
                      ))}
                    </div>

                    <div className="mt-6 text-center">
                      {browseCursor ? (
                        <button
                          type="button"
                          onClick={loadMoreBrowse}
                          disabled={browsingMore}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                        >
                          {browsingMore ? "Loading…" : "Load more"}
                        </button>
                      ) : (
                        <p className="text-[10px] text-slate-600">
                          That&rsquo;s all {browse.length} of them.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════ FEED ═══════════════════ */}
          {tab === "feed" && (
            <div className="mt-5">
              {!user ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-4 text-sm text-slate-400">
                    Sign in to see what the people you follow are recommending.
                  </p>
                </div>
              ) : !feedLoaded ? (
                <p className="py-20 text-center text-sm text-slate-500">Reading the feed…</p>
              ) : feed.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-4 text-sm text-slate-400">
                    Nothing here yet — follow a few curators, or stamp something yourself.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Link
                      href="/community"
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.08]"
                    >
                      Find people
                    </Link>
                    {/* The way OUT of an empty follower feed: you cannot follow
                        curators you have never seen, and this is where you see
                        them. It is the same reason the tab exists. */}
                    <button
                      type="button"
                      onClick={() => setTab("all")}
                      className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200 transition hover:bg-violet-500/25"
                    >
                      Browse all stamps
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("board")}
                      className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-500/25"
                    >
                      See the board
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Said once, above the list, rather than sixty times inside
                      it — but each card still refuses to offer a thumb it
                      cannot deliver. */}
                  {needsSignIn && <SessionWarning />}
                  <div className="space-y-3">
                    {feed.map((rec) => (
                      <RecCard
                        key={rec.id}
                        rec={rec}
                        variant="feed"
                        viewerId={viewerId}
                        needsSignIn={needsSignIn}
                        showOwner
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ HOW IT WORKS ═══ what the server actually does ═══ */}
          <div className="mt-12">
            <h2 className="font-fell text-2xl text-white">How stamps work</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                {
                  n: "1",
                  t: "Three at a time",
                  d: "Your stamp carries three live recommendations. Retiring one frees the slot but never erases what it earned.",
                },
                {
                  n: "2",
                  t: "Only readers vote",
                  d: "A thumb counts only from someone who opened the recommendation, and a rec needs about five votes before it counts fully.",
                },
                {
                  n: "3",
                  t: "Boosts have a ceiling",
                  d: "Arise Points move a grade, with diminishing returns per booster and a hard cap at the earned score. Nobody buys a grade from zero.",
                },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-400/25 bg-amber-500/10 text-sm font-black text-amber-300">
                    {s.n}
                  </span>
                  <p className="mt-4 text-sm font-black text-white">{s.t}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.d}</p>
                </div>
              ))}
            </div>

            {/* the published bands, for reading — the grade a stamp WEARS
                always comes from the server */}
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0b11] p-4">
              <div className="flex min-w-max items-center gap-2">
                {GRADE_BANDS.map((b) => (
                  <div
                    key={b.grade}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center"
                  >
                    <p className="text-sm font-black text-amber-200">{b.grade}</p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">
                      {b.max === null
                        ? `${b.min}+`
                        : b.min === -Infinity
                          ? "below 0"
                          : `${b.min}–${b.max}`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
                The weekly board ranks by what a stamp earned inside that ISO week, so a new
                curator can win it. Last week&rsquo;s top three wear unique seals for the whole
                of this one &mdash; and those seals ride the covers of everything they
                recommend, everywhere on the site, where a tap opens the curator&rsquo;s stamp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
