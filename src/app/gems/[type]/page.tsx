"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Gem, Trophy, Heart, Search, X, Check, CalendarDays,
  ArrowUpRight, Sparkles, Tv, BookOpen, Feather,
} from "lucide-react";
import { authHeaders } from "@/lib/authToken";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { LoadingDot } from "@/components/ui/LoadingScreen";
import PageTransition from "@/components/layout/PageTransition";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * HIDDEN GEMS — the dedicated page. One per mode, at /gems/anime|manhwa|novel.
 *
 * Same contract as the inline HiddenGems section (both coexist): one vote per
 * user per ISO week per mode, changing your mind MOVES the vote, the tally IS
 * the ranking, and Monday's rollover crowns last week's #1. The server owns
 * all of that; this page is only a bigger window onto it.
 *
 * Deliberately honest copy: the backend has NO nomination-vs-voting phases —
 * voting is open all week — so the week banner says exactly that instead of
 * inventing a schedule the server doesn't keep.
 */

type Gems = { mediaId: string; title: string; cover: string | null; votes: number };
type Mode = "anime" | "manhwa" | "novel";

const MODES: Mode[] = ["anime", "manhwa", "novel"];

const MODE_META: Record<Mode, { plural: string; pick: string; searchLabel: string; Icon: any }> = {
  anime:  { plural: "anime",  pick: "Anime gems",  searchLabel: "Search anime…",  Icon: Tv },
  manhwa: { plural: "manhwa", pick: "Manhwa gems", searchLabel: "Search comics…", Icon: BookOpen },
  novel:  { plural: "novels", pick: "Novel gems",  searchLabel: "Search novels…", Icon: Feather },
};

/**
 * ISO-8601 week key, e.g. "2026-W31" — the EXACT math the backend's weekKey()
 * uses (gem.controller.ts), so the banner names the same week the votes land
 * in. Shift to the week's own Thursday before counting; a naive day-of-year/7
 * is off by one for most of January.
 */
function isoWeekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7; // Sunday is 0 in JS but day 7 in ISO
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Whole days until the next ISO Monday (1–7; on Monday the reset is 7 days out). */
function daysUntilMonday(d: Date = new Date()): number {
  const dayNum = d.getUTCDay() || 7;
  return 8 - dayNum;
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-xl border px-5 py-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] transition ${
    active
      ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
      : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
  }`;

export default function GemsPage() {
  const params = useParams<{ type: string }>();
  const rawType = String(params?.type || "");
  const valid = (MODES as string[]).includes(rawType);
  const source = (valid ? rawType : "anime") as Mode;

  const { user } = useUser();
  const { toast } = useToast();

  const [standings, setStandings] = useState<Gems[]>([]);
  const [lastWinner, setLastWinner] = useState<Gems | null>(null);
  const [myPick, setMyPick] = useState<{ mediaId: string; title: string } | null>(null);
  const [serverWeek, setServerWeek] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"week" | "winners">("week");

  // submit sheet
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!valid) { setLoaded(true); return; }
    try {
      const r = await fetch(`${API_URL}/api/gems?mediaType=${source}`, { headers: authHeaders() });
      const d = await r.json();
      if (d?.success) {
        setStandings(d.data?.standings || []);
        setLastWinner(d.data?.lastWinner || null);
        setMyPick(d.data?.myPick || null);
        setServerWeek(d.data?.week || null);
      }
    } catch {
      /* offline — empty states carry the page */
    } finally {
      setLoaded(true);
    }
  }, [source, valid]);

  useEffect(() => { load(); }, [load]);

  // Same debounced catalogue search as the inline section — you can only
  // nominate something that actually exists in the mode's own catalogue.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const path = source === "novel" ? "/api/novels" : source === "anime" ? "/api/anime" : "/api/manhwa";
        const r = await fetch(`${path}?q=${encodeURIComponent(term)}&page=1`);
        const d = await r.json();
        setResults((d?.results || []).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, open, source]);

  // The one POST — casts or MOVES this week's pick (server-enforced upsert).
  const vote = async (item: { id: string; title: string; image?: string | null; cover?: string | null }) => {
    if (!user) { toast("Sign in to vote.", "error"); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/gems`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          mediaType: source,
          mediaId: item.id,
          title: item.title,
          cover: item.image || item.cover || null,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "Couldn't save your vote.", "error");
        return;
      }
      toast(`Voted for ${item.title}.`, "success");
      setOpen(false);
      setQ("");
      setSelected(null);
      load();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── unknown mode: a small "pick a mode" state, not a 404 ── */
  if (!valid) {
    return (
      <PageTransition>
        <div className="relative min-h-screen bg-[#070709] px-4 pb-24 pt-14 font-mono text-white">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]" />
          <div className="relative mx-auto max-w-md pt-16 text-center">
            <Gem className="mx-auto h-10 w-10 text-violet-300" />
            <h1 className="mt-4 font-fell text-4xl text-white">Hidden Gems</h1>
            <p className="mt-3 text-sm text-slate-400">Pick a mode to see its weekly gems.</p>
            <div className="mt-8 space-y-2">
              {MODES.map((m) => {
                const { Icon, pick } = MODE_META[m];
                return (
                  <Link key={m} href={`/gems/${m}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0b11] px-4 py-3.5 text-left transition hover:border-violet-400/40 hover:bg-violet-500/10">
                    <Icon className="h-4 w-4 text-violet-300" />
                    <span className="flex-1 text-sm font-black text-white">{pick}</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:text-violet-200" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  const meta = MODE_META[source];
  const week = serverWeek || isoWeekKey();
  const daysLeft = daysUntilMonday();

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-24 pt-14 font-mono text-white">
        {/* the Lunar top glow — same radial as the hub and leaderboard */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl">

          {/* ── HEADER ── */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/10">
                  <Gem className="h-5 w-5 text-violet-300" />
                </span>
                <h1 className="font-fell text-4xl text-white sm:text-5xl">Hidden Gems</h1>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Discover underrated {meta.plural} picked by the community
              </p>
            </div>
            {user ? (
              <button type="button" onClick={() => { setSelected(null); setOpen(true); }}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/25">
                <Sparkles className="h-3.5 w-3.5" /> {myPick ? "Change your pick" : "Submit a pick"}
              </button>
            ) : (
              <p className="text-xs text-slate-500">Sign in to nominate and vote.</p>
            )}
          </div>

          {/* ── WEEK BANNER ── no fake phases: voting is open ALL week */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0b0b11] px-5 py-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-violet-300" />
              <div>
                <p className="text-sm font-black text-white">Week {week}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Voting open all week — one pick each. Change it any time.
                </p>
              </div>
            </div>
            <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
              Resets Monday · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </span>
          </div>

          {myPick && (
            <p className="mt-3 text-[11px] text-slate-500">
              Your pick this week: <span className="font-black text-violet-300">{myPick.title}</span>
            </p>
          )}

          {/* ── TABS ── */}
          <div className="mt-8 flex flex-wrap gap-2">
            <button type="button" onClick={() => setTab("week")} className={chip(tab === "week")}>
              This Week
            </button>
            <button type="button" onClick={() => setTab("winners")} className={chip(tab === "winners")}>
              Last Week&rsquo;s Winner
            </button>
          </div>

          {/* ── THIS WEEK: the live tally ── */}
          {tab === "week" && (
            <div className="mt-5">
              {!loaded ? (
                <p className="py-20 text-center text-sm text-slate-500">Reading the tally…</p>
              ) : standings.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-16 text-center">
                  <Gem className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-4 text-sm text-slate-400">
                    No picks yet — be the first to nominate a hidden gem this week!
                  </p>
                  {user && (
                    <button type="button" onClick={() => { setSelected(null); setOpen(true); }}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/25">
                      <Sparkles className="h-3.5 w-3.5" /> Submit a pick
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {standings.map((g, i) => {
                    const mine = myPick?.mediaId === g.mediaId;
                    return (
                      <div key={g.mediaId}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
                          mine ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-[#0b0b11] hover:border-white/20"
                        }`}>
                        <span className="w-9 shrink-0 text-center text-sm font-black tabular-nums text-slate-600">#{i + 1}</span>
                        {g.cover ? (
                          <img src={g.cover} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="h-16 w-11 shrink-0 rounded-md bg-white/5" />
                        )}
                        {/* tapping the body casts / moves your one vote */}
                        <button type="button" disabled={saving}
                          onClick={() => vote({ id: g.mediaId, title: g.title, cover: g.cover })}
                          className="min-w-0 flex-1 text-left disabled:opacity-50">
                          <span className="block truncate text-sm font-black text-white">{g.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px]">
                            <span className="flex items-center gap-1 text-rose-400">
                              <Heart className="h-3 w-3 fill-rose-400" /> {g.votes} vote{g.votes === 1 ? "" : "s"}
                            </span>
                            {mine ? (
                              <span className="flex items-center gap-1 font-black text-violet-300">
                                <Check className="h-3 w-3" /> Your pick
                              </span>
                            ) : (
                              <span className="text-slate-600">{user ? "· tap to vote" : ""}</span>
                            )}
                          </span>
                        </button>
                        <Link href={`/${source}/${encodeURIComponent(g.mediaId)}`} aria-label={`Open ${g.title}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white">
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── LAST WEEK: the crowned winner ── */}
          {tab === "winners" && (
            <div className="mt-5">
              {!loaded ? (
                <p className="py-20 text-center text-sm text-slate-500">Reading the tally…</p>
              ) : lastWinner ? (
                <Link href={`/${source}/${encodeURIComponent(lastWinner.mediaId)}`}
                  className="group relative flex min-h-[260px] items-end overflow-hidden rounded-3xl border border-white/10">
                  {lastWinner.cover && (
                    <img src={lastWinner.cover} alt="" loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:scale-105 group-hover:opacity-60" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                  <span className="relative z-10 p-6">
                    <span className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[10px] font-black text-amber-300">
                        <Trophy className="h-3 w-3" /> #1 WINNER
                      </span>
                      <span className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[10px] font-black text-rose-300">
                        <Heart className="h-3 w-3 fill-rose-300" /> {lastWinner.votes} vote{lastWinner.votes === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Last week&rsquo;s top pick
                    </span>
                    <span className="mt-1 block font-fell text-3xl leading-tight text-white">{lastWinner.title}</span>
                  </span>
                </Link>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
                  <Trophy className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-4 text-sm text-slate-400">
                    No winner yet — this week&rsquo;s votes decide the first one.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── HOW IT WORKS ── what the server actually does, no invented phases */}
          <div className="mt-12">
            <h2 className="font-fell text-2xl text-white">How Hidden Gems Works</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Nominate & vote", d: "All week long, everyone gets one pick. Changing your mind moves your vote — it never adds a second." },
                { n: "2", t: "The tally is live", d: "Counts are people, not clicks. The standings above update as the community votes." },
                { n: "3", t: "Monday crowns a winner", d: "When the ISO week rolls over, last week's top pick becomes the crowned gem." },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-sm font-black text-violet-300">
                    {s.n}
                  </span>
                  <p className="mt-4 text-sm font-black text-white">{s.t}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SUBMIT SHEET ── same catalogue search as the inline section */}
        {open && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => { setOpen(false); setSelected(null); }} />
            <div role="dialog" aria-modal="true" aria-label="Nominate a hidden gem"
              className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-fell text-lg text-white">Nominate a hidden gem</p>
                  <p className="text-[11px] text-slate-500">One pick per week — you can change it any time</p>
                </div>
                <button type="button" onClick={() => { setOpen(false); setSelected(null); }} aria-label="Close"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-white/10 px-4 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }}
                    placeholder={meta.searchLabel} aria-label="Search to nominate"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-400/40" />
                  {searching && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"><LoadingDot /></span>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {q.trim().length < 2 ? (
                  <p className="py-10 text-center text-xs text-slate-600">Type to find something.</p>
                ) : results.length === 0 && !searching ? (
                  <p className="py-10 text-center text-xs text-slate-600">Nothing found.</p>
                ) : (
                  results.map((it) => {
                    const cover = source === "novel" ? it.cover : it.image;
                    // Manhwa art goes through the proxy — MangaDex/Asura
                    // referer-block hotlinks; AniList art is served direct.
                    const needsProxy = source === "manhwa";
                    const isSel = selected?.id === it.id;
                    const isMine = myPick?.mediaId === it.id;
                    return (
                      <button key={it.id} type="button" disabled={saving}
                        onClick={() => setSelected(isSel ? null : it)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition disabled:opacity-50 ${
                          isSel ? "border-violet-400/40 bg-violet-500/10" : "border-transparent hover:bg-white/[0.05]"
                        }`}>
                        {cover ? (
                          <img src={needsProxy ? `/api/manhwa-image?url=${encodeURIComponent(cover)}` : cover}
                            alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="h-14 w-10 shrink-0 rounded-md bg-white/5" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{it.title}</span>
                        {isMine && !isSel && <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500">Current</span>}
                        {isSel && <Check className="h-4 w-4 shrink-0 text-violet-300" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                <button type="button" onClick={() => { setOpen(false); setSelected(null); }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
                  Cancel
                </button>
                <button type="button" disabled={!selected || saving} onClick={() => selected && vote(selected)}
                  className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                  {saving ? "Saving…" : myPick ? "Move my vote" : "Confirm pick"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
