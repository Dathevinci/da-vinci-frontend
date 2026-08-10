"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users, Shield, Crown, X, Sparkles, Pencil, Trash2, Send, Heart,
  MessageSquare, Diamond, Layers, Clock, Check, RefreshCw, Camera,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import { cacheGuildId, cachedGuildId, loanTimeLeft } from "@/lib/guild";
import { loadCatalog } from "@/lib/catalogCache";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META, CardRarity } from "@/components/cards/CardFace";
import UserLink from "@/components/profile/UserLink";
import { UserBadgesCompact } from "@/components/profile/UserBadges";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { effectNameClass } from "@/lib/effectTheme";
import MediaPicker from "@/components/community/MediaPicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD HOME — one guild's whole world on a page, in the Lunar kit:
 * a full-bleed-feel hero (avatar, name in font-fell, the chips), the BOARD
 * (the existing comment machinery scoped by guildId — guild posts never
 * leak into the forum and vice versa), the MEMBERS strip with the leader's
 * controls, and CARD SHARING (7-day loans between guildmates, capped 3 a
 * side, all enforced server-side).
 *
 * Every rule lives in guild.controller.ts / comment.controller.ts — this
 * page relays the server's answers and never invents its own.
 */

type Member = {
  userId: string;
  username: string;
  avatar: string | null;
  role: string;
  joinedAt: string;
};

type GuildDetail = {
  id: string; name: string; tag: string; description: string;
  avatar: string | null; leaderId: string; coins: number; xp: number;
  level: number; createdAt: string; memberCap: number; memberCount: number;
  members: Member[];
  myMembership: { role: string; joinedAt: string } | null;
  activeLoanCount: number;
};

type BoardAuthor = {
  id: string; username: string; avatar?: string | null;
  activeRole?: string | null; activeTag?: string | null;
  activeEffect?: string | null; activeFrame?: string | null;
  role?: string | null; xp?: number | null;
  equippedTitles?: string[] | null; cardTitle?: string | null;
};

type BoardPost = {
  id: string;
  parentId?: string | null;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
  score?: number;
  upvotes?: number;
  downvotes?: number;
  userVote?: number;
  blessed?: boolean;
  user?: BoardAuthor;
};

type Loan = {
  id: string; guildId: string; cardId: string; cardName: string;
  ownerId: string; borrowerId: string;
  counterpartyId: string; counterpartyName: string; counterpartyAvatar: string | null;
  expiresAt: string; active: boolean;
};

type Catalog = {
  cards: CardDef[];
  cardStats?: Record<string, { hp: number; atk: number }>;
  cardStatsById?: Record<string, { hp: number; atk: number }>;
};

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

export default function GuildHomePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [guild, setGuild] = useState<GuildDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lendOpen, setLendOpen] = useState(false);
  const [loans, setLoans] = useState<{ lent: Loan[]; borrowed: Loan[] }>({ lent: [], borrowed: [] });

  const isMember = !!guild?.myMembership;
  const isLeader = !!user && !!guild && guild.leaderId === user.id;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}`, { headers: authHeaders() });
      const d = await r.json();
      if (d?.success && d.data) {
        setGuild(d.data);
        // Keep the device's "my guild" pointer honest, both directions.
        if (d.data.myMembership) cacheGuildId(d.data.id);
        else if (cachedGuildId() === d.data.id) cacheGuildId(null);
      } else if (r.status === 404) {
        setGuild(null);
        if (cachedGuildId() === id) cacheGuildId(null);
      }
    } catch {
      /* offline — the empty state carries the page */
    } finally {
      setLoaded(true);
    }
  }, [id]);

  const loadLoans = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await fetch(`${API_URL}/api/guilds/mine/loans`, { headers: authHeaders() });
      const d = await r.json();
      if (d?.success && d.data) {
        setLoans({ lent: d.data.lent || [], borrowed: d.data.borrowed || [] });
      }
    } catch {
      /* the panel simply shows nothing on loan */
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load, user?.id]);
  useEffect(() => { loadLoans(); }, [loadLoans]);

  // The sheets scroll; the page behind them must not (cards-page rule).
  useEffect(() => {
    if (!editOpen && !lendOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [editOpen, lendOpen]);

  const join = async () => {
    if (!user) return toast("Sign in to join a guild.", "error");
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/join`, {
        method: "POST", headers: authHeaders(),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't join.", "error");
      cacheGuildId(id);
      toast(`Welcome to ${guild?.name || "the guild"}.`, "success");
      load();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!user || !guild || busy) return;
    const lastOne = isLeader && guild.memberCount <= 1;
    const warn = lastOne
      ? `Leave ${guild.name}? You're the last member — the guild disbands and its name is freed.`
      : `Leave ${guild.name}? Your active card loans end with you.`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/leave`, { method: "POST", headers: authHeaders() });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't leave.", "error");
      cacheGuildId(null);
      toast(d.data?.disbanded ? "The guild is disbanded." : "You left the guild.", "success");
      if (d.data?.disbanded) router.push("/guilds");
      else { load(); loadLoans(); }
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  const kick = async (m: Member) => {
    if (!guild || busy) return;
    if (!window.confirm(`Kick ${m.username} from ${guild.name}? Their loans end with them.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/kick`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ userId: m.userId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't kick them.", "error");
      toast(`${m.username} was kicked.`, "success");
      load(); loadLoans();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  const transfer = async (m: Member) => {
    if (!guild || busy) return;
    if (!window.confirm(`Hand leadership of ${guild.name} to ${m.username}? You become a regular member.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/transfer`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ userId: m.userId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't transfer leadership.", "error");
      toast(`${m.username} now leads the guild.`, "success");
      load();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  const endLoan = async (loan: Loan, verb: string) => {
    try {
      const r = await fetch(`${API_URL}/api/guilds/loans/${encodeURIComponent(loan.id)}`, {
        method: "DELETE", headers: authHeaders(),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || `Couldn't ${verb} that card.`, "error");
      toast(`${loan.cardName} ${verb === "recall" ? "recalled" : "returned"}.`, "success");
      loadLoans();
    } catch {
      toast("Couldn't reach the server.", "error");
    }
  };

  // Loans shown here are scoped to THIS guild (one guild per user makes that
  // nearly a no-op, but an old expired row from a former guild shouldn't show).
  const myLent = loans.lent.filter((l) => l.guildId === id);
  const myBorrowed = loans.borrowed.filter((l) => l.guildId === id);

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-32 pt-14 font-mono text-white">
        {/* the Lunar top glow — emerald, the guilds' colour */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(16,185,129,0.16),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl">
          {!loaded ? (
            <p className="py-24 text-center text-sm text-slate-500">Opening the hall…</p>
          ) : !guild ? (
            <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-20 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400">This guild doesn&rsquo;t exist — disbanded, or the link is stale.</p>
              <Link href="/guilds"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                Browse guilds
              </Link>
            </div>
          ) : (
            <>
              {/* ── THE HERO — the Deep Sea Vibes reference, in our kit ── */}
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11]">
                <div aria-hidden className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(85% 90% at 82% 0%, rgba(16,185,129,.16), transparent 60%)," +
                      "radial-gradient(70% 85% at 8% 100%, rgba(139,92,246,.14), transparent 65%)," +
                      "linear-gradient(180deg, #0a1210, #0b0b11)",
                  }} />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-transparent to-transparent" />

                <div className="relative p-6 sm:p-10">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    {guild.avatar ? (
                      <img src={guild.avatar} alt=""
                        className="h-24 w-24 shrink-0 rounded-3xl object-cover ring-1 ring-emerald-400/30 sm:h-28 sm:w-28" />
                    ) : (
                      <span className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-emerald-900/60 font-fell text-4xl text-emerald-200 ring-1 ring-emerald-400/20 sm:h-28 sm:w-28">
                        {guild.name?.[0]?.toUpperCase()}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="font-fell text-4xl leading-tight text-white sm:text-5xl">{guild.name}</h1>
                        <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs font-black tracking-[0.2em] text-emerald-300">
                          [{guild.tag}]
                        </span>
                      </div>
                      {guild.description ? (
                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{guild.description}</p>
                      ) : (
                        <p className="mt-3 text-sm italic text-slate-600">No words over the door yet.</p>
                      )}

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                          <Sparkles className="h-3 w-3" /> Level {guild.level}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                          <Diamond className="h-3 w-3" /> {guild.coins.toLocaleString()} coins
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                          <Users className="h-3 w-3" /> {guild.memberCount}/{guild.memberCap} members
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* the door: join, leave, or (leader) edit */}
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    {!isMember && (
                      <button type="button" disabled={busy || guild.memberCount >= guild.memberCap} onClick={join}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                        <Users className="h-4 w-4" />
                        {guild.memberCount >= guild.memberCap ? "Guild is full" : busy ? "Joining…" : "Join this guild"}
                      </button>
                    )}
                    {isMember && isLeader && (
                      <button type="button" onClick={() => setEditOpen(true)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.1]">
                        <Pencil className="h-3.5 w-3.5" /> Edit guild
                      </button>
                    )}
                    {isMember && (
                      <button type="button" disabled={busy} onClick={leave}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                        Leave
                      </button>
                    )}
                  </div>
                  {isLeader && guild.memberCount > 1 && (
                    <p className="mt-2 text-[10px] text-slate-600">
                      A leader leaves last — transfer leadership below before leaving.
                    </p>
                  )}
                </div>
              </div>

              {/* ── MEMBERS ── */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-300" />
                  <p className="text-sm font-black text-white">Members</p>
                  <span className="text-[10px] font-bold tabular-nums text-slate-600">{guild.memberCount}/{guild.memberCap}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {guild.members.map((m) => {
                    const lead = m.role === "leader";
                    const me = user?.id === m.userId;
                    return (
                      <div key={m.userId}
                        className={`flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                          me ? "border-emerald-400/30 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.02]"
                        }`}>
                        {m.avatar ? (
                          <img src={m.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
                        ) : (
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-800 text-xs font-black">
                            {m.username?.[0]?.toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <UserLink username={m.username} className="truncate text-sm font-black text-white hover:underline">
                              {m.username}
                            </UserLink>
                            {lead && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
                                <Crown className="h-2.5 w-2.5" /> Leader
                              </span>
                            )}
                            {me && !lead && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">You</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600">joined {ago(m.joinedAt)}</p>
                        </div>
                        {isLeader && !me && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" disabled={busy} onClick={() => transfer(m)}
                              title="Transfer leadership"
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40">
                              <Crown className="h-3 w-3" /> Transfer
                            </button>
                            <button type="button" disabled={busy} onClick={() => kick(m)}
                              title="Kick from the guild"
                              className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                              <X className="h-3 w-3" /> Kick
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── CARD SHARING ── */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-300" />
                    <p className="text-sm font-black text-white">Card sharing</p>
                  </div>
                  {isMember && (
                    <button type="button"
                      onClick={() => {
                        if (guild.memberCount < 2) return toast("Lending needs a guildmate — recruit someone first.", "error");
                        setLendOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                      <Layers className="h-3.5 w-3.5" /> Lend a card
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Lend a card to a guildmate for 7 days — they raid with it at YOUR stats and prints, and an injury
                  rests your copy. Three loans out, three held, per person.
                </p>

                {!isMember ? (
                  <p className="mt-5 py-6 text-center text-xs text-slate-600">Members lend and borrow here.</p>
                ) : myLent.length === 0 && myBorrowed.length === 0 ? (
                  <p className="mt-5 py-6 text-center text-xs text-slate-600">Nothing on loan yet.</p>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Lent out · {myLent.length}</p>
                      <div className="mt-2 space-y-2">
                        {myLent.map((l) => (
                          <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-black text-white">{l.cardName}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                to <span className="font-black text-emerald-300">{l.counterpartyName}</span>
                              </p>
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-widest ${
                              l.active ? "text-slate-500" : "text-red-400"
                            }`}>
                              <Clock className="h-3 w-3" /> {loanTimeLeft(l.expiresAt)}
                            </span>
                            <button type="button" onClick={() => endLoan(l, "recall")}
                              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/[0.1] hover:text-white">
                              Recall
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Borrowed · {myBorrowed.length}</p>
                      <div className="mt-2 space-y-2">
                        {myBorrowed.map((l) => (
                          <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-black text-white">{l.cardName}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                from <span className="font-black text-emerald-300">{l.counterpartyName}</span>
                              </p>
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-widest ${
                              l.active ? "text-slate-500" : "text-red-400"
                            }`}>
                              <Clock className="h-3 w-3" /> {loanTimeLeft(l.expiresAt)}
                            </span>
                            <button type="button" onClick={() => endLoan(l, "return")}
                              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/[0.1] hover:text-white">
                              Return
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {isMember && myBorrowed.some((l) => l.active) && (
                  <p className="mt-3 text-[10px] text-slate-600">
                    Borrowed cards appear in the <Link href="/raid" className="font-black text-emerald-300 hover:underline">raid squad picker</Link> automatically.
                  </p>
                )}
              </div>

              {/* ── THE GUILD BOARD ── */}
              <GuildBoard guildId={guild.id} isMember={isMember} isLeader={isLeader} />
            </>
          )}
        </div>

        {editOpen && guild && (
          <EditGuildSheet
            guild={guild}
            onClose={() => setEditOpen(false)}
            onSaved={() => { setEditOpen(false); load(); }}
          />
        )}

        {lendOpen && guild && user && (
          <LendSheet
            guild={guild}
            userId={user.id}
            onClose={() => setLendOpen(false)}
            onLent={() => { setLendOpen(false); loadLoans(); }}
          />
        )}
      </div>
    </PageTransition>
  );
}

/* ═══════════════════ THE BOARD — comment machinery, guild-scoped ═══════════════════ */

function GuildBoard({ guildId, isMember, isLeader }: { guildId: string; isMember: boolean; isLeader: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [replies, setReplies] = useState<Record<string, BoardPost[]>>({});
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const anchoredRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const url = new URL(`${API_URL}/api/comments`);
      url.searchParams.set("guildId", guildId);
      url.searchParams.set("sort", "newest");
      url.searchParams.set("limit", "50");
      if (user?.id) url.searchParams.set("userId", user.id);
      const r = await fetch(url.toString());
      const d = await r.json();
      const list = Array.isArray(d?.data) ? d.data : d?.data?.comments;
      const all: BoardPost[] = Array.isArray(list) ? list : [];
      setPosts(all.filter((p) => !p.parentId));
      const map: Record<string, BoardPost[]> = {};
      for (const c of all) {
        if (!c.parentId) continue;
        (map[c.parentId] ||= []).push(c);
      }
      for (const k of Object.keys(map)) {
        map[k].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      }
      setReplies(map);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [guildId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Notification deep links land as /guilds/:id?comment=<id> — scroll to it
  // once the posts exist. window.location, not useSearchParams: this page
  // must never need a Suspense boundary just to read one optional param.
  useEffect(() => {
    if (anchoredRef.current || posts.length === 0) return;
    let target = "";
    try {
      target = new URLSearchParams(window.location.search).get("comment") || "";
    } catch {
      return;
    }
    if (!target) return;
    anchoredRef.current = true;
    const el = document.getElementById(`guild-comment-${target}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [posts]);

  const submit = async () => {
    if (!user) return toast("Sign in to post.", "error");
    if ((!text.trim() && !mediaUrl.trim()) || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: user.id,
          guildId,
          content: text.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't post.", "error");
      setText("");
      setMediaUrl("");
      load();
    } catch {
      toast("Couldn't post.", "error");
    } finally {
      setPosting(false);
    }
  };

  const reply = async (postId: string, body: string) => {
    if (!user) { toast("Sign in to reply.", "error"); return false; }
    try {
      const r = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, guildId, content: body, parentId: postId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) { toast(d?.message || "Couldn't reply.", "error"); return false; }
      load();
      return true;
    } catch {
      toast("Couldn't reply.", "error");
      return false;
    }
  };

  const love = async (p: BoardPost) => {
    if (!user) return toast("Sign in to react.", "error");
    const next = p.userVote === 1 ? 0 : 1;
    setPosts((list) => list.map((x) => {
      if (x.id !== p.id) return x;
      const was = x.userVote || 0;
      return {
        ...x,
        userVote: next,
        upvotes: Math.max(0, (x.upvotes || 0) + (next === 1 ? 1 : 0) - (was === 1 ? 1 : 0)),
      };
    }));
    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, value: next }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) { toast(d?.message || "That didn't save.", "error"); load(); }
    } catch {
      toast("That didn't save.", "error");
      load();
    }
  };

  const remove = async (p: BoardPost) => {
    if (!user) return;
    const count = replies[p.id]?.length || 0;
    const warn = count > 0
      ? `Delete this post and its ${count} ${count === 1 ? "reply" : "replies"}?`
      : "Delete this post?";
    if (!window.confirm(warn)) return;
    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't delete that.", "error");
      toast("Deleted.", "success");
      load();
    } catch {
      toast("Couldn't delete that.", "error");
    }
  };

  // Own posts always; the guild leader moderates their own board.
  const canManage = (p: BoardPost) => !!user && (p.user?.id === user.id || isLeader);

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-300" />
        <p className="text-sm font-black text-white">Guild board</p>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
          Members post
        </span>
      </div>

      {isMember ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1500))}
            rows={2}
            placeholder="Say something to the guild…"
            className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <MediaPicker value={mediaUrl} onChange={setMediaUrl} userId={user?.id} />
            <button type="button" disabled={(!text.trim() && !mediaUrl.trim()) || posting} onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-3 w-3" /> {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-slate-600">Join the guild to post on its board.</p>
      )}

      {loading ? (
        <p className="py-10 text-center text-xs text-slate-600">Reading the board…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-600">Nothing on the board yet. First word is free.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {posts.map((p) => (
            <article key={p.id} id={`guild-comment-${p.id}`}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start gap-3">
                <div className="relative h-9 w-9 shrink-0">
                  {p.user?.avatar ? (
                    <img src={p.user.avatar} alt="" className="relative z-10 h-9 w-9 rounded-full object-cover ring-1 ring-black/60" />
                  ) : (
                    <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-emerald-800 text-xs font-black ring-1 ring-black/60">
                      {(p.user?.username || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  <AvatarDecoration frame={p.user?.activeFrame} effect={p.user?.activeEffect} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.user?.username ? (
                      <UserLink username={p.user.username}
                        className={`text-sm font-black hover:underline ${effectNameClass(p.user?.activeEffect) || "text-white"}`}>
                        {p.user.username}
                      </UserLink>
                    ) : (
                      <span className="text-sm font-black text-slate-400">someone</span>
                    )}
                    <UserBadgesCompact user={p.user} blessed={p.blessed} />
                    <span className="text-[10px] font-bold text-slate-600">{ago(p.createdAt)}</span>
                    {canManage(p) && (
                      <button type="button" onClick={() => remove(p)} aria-label="Delete post"
                        className="ml-auto grid h-7 w-7 place-items-center rounded-full text-slate-600 transition hover:bg-red-500/10 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {p.content && (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{p.content}</p>
                  )}
                  {p.mediaUrl && (
                    <img src={p.mediaUrl} alt="" loading="lazy"
                      className="mt-3 max-h-80 w-auto max-w-full rounded-xl object-contain" />
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <button type="button" onClick={() => love(p)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-black transition ${
                        p.userVote === 1 ? "text-rose-400" : "text-slate-500 hover:text-rose-300"
                      }`}>
                      <Heart className="h-3.5 w-3.5" fill={p.userVote === 1 ? "currentColor" : "none"} />
                      {p.upvotes || 0}
                    </button>
                    {isMember && (
                      <button type="button" onClick={() => setOpenThread(openThread === p.id ? null : p.id)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:text-white">
                        <MessageSquare className="h-3 w-3" />
                        {(replies[p.id]?.length || 0) === 0 ? "Reply" : `${replies[p.id].length} ${replies[p.id].length === 1 ? "reply" : "replies"}`}
                      </button>
                    )}
                  </div>

                  {openThread === p.id && (
                    <div className="mt-3 space-y-2.5 border-l border-emerald-400/25 pl-3">
                      {(replies[p.id] || []).map((r) => (
                        <div key={r.id} id={`guild-comment-${r.id}`} className="flex items-start gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {r.user?.username ? (
                                <UserLink username={r.user.username} className="text-xs font-black text-white hover:underline">
                                  {r.user.username}
                                </UserLink>
                              ) : (
                                <span className="text-xs font-black text-slate-400">someone</span>
                              )}
                              <span className="text-[9px] font-bold text-slate-600">{ago(r.createdAt)}</span>
                              {canManage(r) && (
                                <button type="button" onClick={() => remove(r)} aria-label="Delete reply"
                                  className="ml-auto grid h-6 w-6 place-items-center rounded-full text-slate-600 transition hover:bg-red-500/10 hover:text-red-300">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">{r.content}</p>
                          </div>
                        </div>
                      ))}
                      <BoardReplyBox onSend={(body) => reply(p.id, body)} />
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardReplyBox({ onSend }: { onSend: (body: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSend(body);
    if (ok) setText("");
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 800))}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder="Write a reply…"
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
      />
      <button type="button" onClick={send} disabled={!text.trim() || busy} aria-label="Send reply"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-30">
        <Send className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ═══════════════════ LEADER'S EDIT SHEET — description + avatar ═══════════════════ */

function EditGuildSheet({ guild, onClose, onSaved }: {
  guild: GuildDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [desc, setDesc] = useState(guild.description || "");
  const [avatar, setAvatar] = useState<string | null>(guild.avatar);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // The SettingsModal flow: unsigned upload straight to Cloudinary, only the
  // returned secure_url travels to our backend — which allow-lists exactly
  // that host (res.cloudinary.com) for guild avatars.
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!CLOUD_NAME || !UPLOAD_PRESET) return toast("Image uploads aren't configured yet.", "error");
    if (file.size > 10 * 1024 * 1024) return toast("That image is over 10MB — pick a smaller one.", "error");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) setAvatar(data.secure_url);
      else toast("Upload failed — try again.", "error");
    } catch {
      toast("Upload failed — try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guild.id)}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ description: desc.trim(), avatar: avatar }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't save that.", "error");
      toast("Guild updated.", "success");
      onSaved();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Edit guild"
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-fell text-lg text-white">Edit {guild.name}</p>
            <p className="text-[11px] text-slate-500">Name and tag are permanent — description and crest are yours</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <label className="text-xs font-black text-white">Crest</label>
            <div className="mt-2 flex items-center gap-4">
              {avatar ? (
                <img src={avatar} alt="" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-emerald-400/30" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-emerald-900/60 font-fell text-3xl text-emerald-200 ring-1 ring-white/10">
                  {guild.name?.[0]?.toUpperCase()}
                </span>
              )}
              <div className="flex flex-col gap-2">
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-50">
                  {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : avatar ? "Change crest" : "Upload a crest"}
                </button>
                {avatar && (
                  <button type="button" onClick={() => setAvatar(null)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/20">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-xs font-black text-white">Description</label>
              <span className="text-[10px] tabular-nums text-slate-600">{desc.length}/500</span>
            </div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 500))}
              rows={4} placeholder="What is this guild about?"
              className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Cancel
          </button>
          <button type="button" disabled={saving || uploading} onClick={save}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ LEND A CARD — collection picker + guildmate ═══════════════════ */

function LendSheet({ guild, userId, onClose, onLent }: {
  guild: GuildDetail;
  userId: string;
  onClose: () => void;
  onLent: () => void;
}) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [foils, setFoils] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  const [lending, setLending] = useState(false);

  useEffect(() => { loadCatalog(API_URL, (data: Catalog) => setCatalog(data)); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/cards/collection/${userId}`);
        const d = await r.json();
        if (!alive || !d?.success) return;
        const map: Record<string, number> = {};
        const fo: Record<string, boolean> = {};
        const lv: Record<string, number> = {};
        for (const c of d.data?.cards || []) {
          map[c.cardId] = c.count;
          if (c.foil) fo[c.cardId] = true;
          lv[c.cardId] = c.level || 1;
        }
        setOwned(map); setFoils(fo); setLevels(lv);
      } catch {
        /* picker shows its own empty state */
      } finally {
        if (alive) setCollectionLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const roster = useMemo(() => {
    if (!catalog) return [];
    return catalog.cards
      .filter((c) => (owned[c.id] || 0) > 0)
      .sort((a, b) => {
        const ra = RARITY_META[a.rarity as CardRarity]?.order ?? 0;
        const rb = RARITY_META[b.rarity as CardRarity]?.order ?? 0;
        return rb - ra || a.name.localeCompare(b.name);
      });
  }, [catalog, owned]);

  const mates = guild.members.filter((m) => m.userId !== userId);
  const pickedCard = cardId && catalog ? catalog.cards.find((c) => c.id === cardId) || null : null;
  const pickedMate = borrowerId ? mates.find((m) => m.userId === borrowerId) || null : null;

  const lend = async () => {
    if (!cardId || !borrowerId || lending) return;
    setLending(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guild.id)}/loans`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ cardId, borrowerId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't lend that card.", "error");
      toast(`${d.data?.cardName || "Card"} lent to ${pickedMate?.username || "your guildmate"} for 7 days.`, "success");
      onLent();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setLending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Lend a card"
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-fell text-lg text-white">Lend a card</p>
            <p className="text-[11px] text-slate-500">7 days, your stats travel with it — 3 out, 3 held, per person</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="px-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">1 · The card</p>
          {roster.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-600">
              {collectionLoaded && catalog ? "No cards to lend — open a pack first." : "Reading your collection…"}
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4">
              {roster.map((c) => {
                const on = cardId === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setCardId(on ? null : c.id)}
                    className="relative transition hover:-translate-y-0.5">
                    {on && (
                      <span className="absolute -left-1.5 -top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0b0b11]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className={`block rounded-xl ${on ? "ring-2 ring-emerald-400" : ""}`}>
                      <CardFace card={c} owned count={owned[c.id]} foil={!!foils[c.id]} level={levels[c.id]}
                        stats={catalog?.cardStats} statsById={catalog?.cardStatsById} size={110} ratio="5 / 9" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-5 px-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">2 · The guildmate</p>
          <div className="mt-2 space-y-1.5">
            {mates.map((m) => {
              const on = borrowerId === m.userId;
              return (
                <button key={m.userId} type="button" onClick={() => setBorrowerId(on ? null : m.userId)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    on ? "border-emerald-400/40 bg-emerald-500/10" : "border-transparent hover:bg-white/[0.05]"
                  }`}>
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[10px] font-black">
                      {m.username?.[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{m.username}</span>
                  {m.role === "leader" && (
                    <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  )}
                  {on && <Check className="h-4 w-4 shrink-0 text-emerald-300" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0b0b11] px-4 py-3">
          <p className="min-w-0 truncate text-[11px] text-slate-500">
            {pickedCard && pickedMate
              ? `${pickedCard.name} → ${pickedMate.username}`
              : pickedCard
              ? `${pickedCard.name} → pick a guildmate`
              : "Pick a card and a guildmate"}
          </p>
          <button type="button" disabled={!cardId || !borrowerId || lending} onClick={lend}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            <Layers className="h-3.5 w-3.5" /> {lending ? "Lending…" : "Lend · 7 days"}
          </button>
        </div>
      </div>
    </div>
  );
}
