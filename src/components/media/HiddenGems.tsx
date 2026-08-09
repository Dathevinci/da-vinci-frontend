"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Heart, Search, X, Check } from "lucide-react";
import { authHeaders } from "@/lib/authToken";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { LoadingDot } from "@/components/ui/LoadingScreen";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * HIDDEN GEMS — the community's weekly pick for something underrated.
 *
 * Last week's leader is the hero; this week's running tally is the list beside
 * it. Everyone gets one vote per week per mode, and changing your mind moves
 * your vote rather than adding another, so a count is a number of people, not
 * a number of clicks. The server enforces that; this is only the surface.
 *
 * Voting needs a way to name a series, so the sheet searches the same endpoint
 * the mode's own search uses — which means you can only nominate something
 * that actually exists in the catalogue.
 */

type Gem = { mediaId: string; title: string; cover: string | null; votes: number };

export default function HiddenGems({
  source,
  accent = "#dc2626",
}: {
  source: "anime" | "manhwa" | "novel";
  accent?: string;
}) {
  const { user } = useUser();
  const { toast } = useToast();

  const [standings, setStandings] = useState<Gem[]>([]);
  const [lastWinner, setLastWinner] = useState<Gem | null>(null);
  const [myPick, setMyPick] = useState<{ mediaId: string; title: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/gems?mediaType=${source}`, { headers: authHeaders() });
      const d = await r.json();
      if (d?.success) {
        setStandings(d.data?.standings || []);
        setLastWinner(d.data?.lastWinner || null);
        setMyPick(d.data?.myPick || null);
      }
    } catch {
      /* offline — panel stays hidden */
    } finally {
      setLoaded(true);
    }
  }, [source]);

  useEffect(() => { load(); }, [load]);

  // Search the mode's own catalogue, debounced — the novel sources fan out
  // across three sites, so firing per keystroke would be brutal.
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

  const vote = async (item: any) => {
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
      load();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Nothing voted yet and nothing to show: stay off the page entirely rather
  // than advertising an empty leaderboard.
  if (loaded && standings.length === 0 && !lastWinner && !user) return null;

  const rest = standings.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 md:px-8">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5" style={{ color: "#fbbf24" }} />
            <h2 className="text-xl font-black tracking-tight text-white md:text-2xl">Hidden Gems</h2>
            <span className="font-mono text-xs text-slate-500">· Community picks</span>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-mono text-xs font-black text-slate-300 transition hover:text-white"
            >
              {myPick ? "Change your vote" : "Vote now"} →
            </button>
          )}
        </div>

        {myPick && (
          <p className="mb-4 font-mono text-[11px] text-slate-500">
            Your pick this week: <span style={{ color: accent }}>{myPick.title}</span>
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* last week's winner */}
          {lastWinner ? (
            <Link
              href={`/${source}/${encodeURIComponent(lastWinner.mediaId)}`}
              className="group relative flex min-h-[220px] items-end overflow-hidden rounded-xl border border-white/10"
            >
              {lastWinner.cover && (
                <img
                  src={lastWinner.cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:scale-105 group-hover:opacity-60"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
              <span className="relative z-10 p-5">
                <span className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-black"
                    style={{ background: "rgba(251,191,36,.18)", color: "#fbbf24", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)" }}>
                    <Trophy className="h-3 w-3" /> #1 WINNER
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] font-black text-rose-300">
                    <Heart className="h-3 w-3 fill-rose-300" /> {lastWinner.votes} vote{lastWinner.votes === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Last week&rsquo;s top pick
                </span>
                <span className="mt-1 block text-2xl font-black leading-tight text-white">{lastWinner.title}</span>
              </span>
            </Link>
          ) : (
            <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-white/10 px-6 text-center">
              <p className="font-mono text-xs text-slate-500">
                No winner yet — this week&rsquo;s votes decide the first one.
              </p>
            </div>
          )}

          {/* this week's running order */}
          <div className="space-y-2">
            {rest.length === 0 ? (
              <div className="grid h-full min-h-[120px] place-items-center rounded-xl border border-white/[0.06] px-4 text-center">
                <p className="font-mono text-xs text-slate-500">
                  {user ? "Nothing nominated yet. Be first." : "Sign in to nominate something."}
                </p>
              </div>
            ) : (
              rest.map((g, i) => (
                <Link
                  key={g.mediaId}
                  href={`/${source}/${encodeURIComponent(g.mediaId)}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0e0e11] p-2.5 transition hover:border-white/[0.14]"
                >
                  <span className="w-7 shrink-0 text-center font-mono text-xs font-black text-slate-500">#{i + 1}</span>
                  {g.cover ? (
                    <img src={g.cover} alt="" loading="lazy" className="hq-image h-14 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="h-14 w-10 shrink-0 rounded-md bg-white/5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{g.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-rose-400">
                      <Heart className="h-3 w-3 fill-rose-400" /> {g.votes} vote{g.votes === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* nominate sheet */}
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.78)" }} onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nominate a hidden gem"
            className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0c0912] sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-black text-white">Nominate a hidden gem</p>
                <p className="font-mono text-[11px] text-slate-500">One pick per week — you can change it</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/10 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={source === "novel" ? "Search novels…" : source === "anime" ? "Search anime…" : "Search comics…"}
                  aria-label="Search to nominate"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 font-mono text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25"
                />
                {searching && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"><LoadingDot /></span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="py-10 text-center font-mono text-xs text-slate-600">Type to find something.</p>
              ) : results.length === 0 && !searching ? (
                <p className="py-10 text-center font-mono text-xs text-slate-600">Nothing found.</p>
              ) : (
                results.map((it) => {
                  const cover = source === "novel" ? it.cover : it.image;
                  // Manhwa art goes through the proxy: MangaDex referer-blocks
                  // hotlinks outright (it serves a "read this at MangaDex"
                  // placeholder instead of the cover), and Asura art has been
                  // hotlink-protected on and off. AniList (novel/anime art) is
                  // served direct.
                  const needsProxy = source === "manhwa";
                  const picked = myPick?.mediaId === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      disabled={saving}
                      onClick={() => vote(it)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.05] disabled:opacity-50"
                    >
                      {cover ? (
                        <img
                          src={needsProxy ? `/api/manhwa-image?url=${encodeURIComponent(cover)}` : cover}
                          alt=""
                          loading="lazy"
                          className="hq-image h-14 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="h-14 w-10 shrink-0 rounded-md bg-white/5" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{it.title}</span>
                      {picked && <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
