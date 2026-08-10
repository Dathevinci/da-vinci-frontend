"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users, Shield, Crown, X, Sparkles, Pencil, Trash2, Send, Lock,
  MessageSquare, Gem, Layers, Clock, Check, RefreshCw, Camera,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import { cacheGuildId, cachedGuildId, loanTimeLeft } from "@/lib/guild";
import { loadCatalog } from "@/lib/catalogCache";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META, CardRarity } from "@/components/cards/CardFace";
import UserLink from "@/components/profile/UserLink";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { effectNameClass } from "@/lib/effectTheme";
import { nameColorClass } from "@/lib/cosmetics";
import MediaPicker from "@/components/community/MediaPicker";
import EmojiPicker from "@/components/community/EmojiPicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE GUILD HOME — one guild's whole world on a page, in the Lunar kit:
 * a full-bleed-feel hero (the guild's banner when it has one, our gradient
 * when it doesn't), the CHAT (a Discord-style members-only room on
 * /api/guilds/:id/messages — grouped messages, day dividers, an 8-second
 * poll that goes quiet while the tab is hidden), the MEMBERS strip with the
 * leader's controls, and CARD SHARING (7-day loans between guildmates,
 * capped 3 a side, all enforced server-side).
 *
 * Every rule lives in guild.controller.ts — this page relays the server's
 * answers and never invents its own.
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
  avatar: string | null; banner: string | null;
  leaderId: string; coLeaderId: string | null;
  shards: number; xp: number;
  level: number; createdAt: string; memberCap: number; memberCount: number;
  members: Member[];
  myMembership: { role: string; joinedAt: string } | null;
  activeLoanCount: number;
};

type ChatAuthor = {
  id: string; username: string; avatar: string | null; role: string | null;
  activeEffect: string | null; activeColor: string | null; activeFont: string | null;
};

type ChatMessage = {
  id: string;
  userId: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  author: ChatAuthor | null;
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

/** "Today" / "Yesterday" / "Mar 4" — the chat's Discord-style day divider. */
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
};

/** "14:07" — the group-header timestamp. */
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
  const isCoLeader = !!user && !!guild && guild.coLeaderId === user.id;
  // Day-to-day powers (edit profile, kick, chat moderation) are shared with
  // the co-leader; transfer and co-leader appointment stay leader-only.
  const isOfficer = isLeader || isCoLeader;

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

  // Leader-only: appoint (userId) or dismiss (null) the co-leader. The server
  // re-checks both the caller and the target — this button is convenience.
  const setCoLeader = async (m: Member, appoint: boolean) => {
    if (!guild || busy) return;
    const warn = appoint
      ? `Make ${m.username} co-leader of ${guild.name}? They can edit the guild, kick members, and moderate the board.${
          guild.coLeaderId ? " This replaces the current co-leader." : ""
        }`
      : `Remove ${m.username} as co-leader?`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/co-leader`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ userId: appoint ? m.userId : null }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't change the co-leader.", "error");
      toast(appoint ? `${m.username} is now co-leader.` : `${m.username} is no longer co-leader.`, "success");
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
        {guild?.banner ? (
          /* FULL-SCREEN banner: fixed, so the art holds the entire viewport
             while the hall scrolls over it. The veil + fade to the page black
             keep every card legible on any art; the emerald glow is skipped —
             it would tint the image green. */
          <div aria-hidden className="pointer-events-none fixed inset-0">
            <img src={guild.banner} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#070709]/40 to-[#070709]" />
          </div>
        ) : (
          /* the Lunar top glow — emerald, the guilds' colour */
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(16,185,129,0.16),transparent_70%)]" />
        )}

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
              {/* ── THE HERO — the Deep Sea Vibes reference, in our kit ──
                  With a banner, the ART is the hero: the page-level fixed
                  layer carries it, so the card chrome disappears and the
                  crest/name float straight on the image. Without one, the
                  boxed gradient card stands as before. */}
              <div className={guild.banner
                ? "relative"
                : "relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11]"}>
                {!guild.banner && (
                  <>
                    <div aria-hidden className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(85% 90% at 82% 0%, rgba(16,185,129,.16), transparent 60%)," +
                          "radial-gradient(70% 85% at 8% 100%, rgba(139,92,246,.14), transparent 65%)," +
                          "linear-gradient(180deg, #0a1210, #0b0b11)",
                      }} />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-transparent to-transparent" />
                  </>
                )}

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
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                          {/* ?? 0 rides out deploy skew — a backend still
                              sending `coins` must not crash the hero */}
                          <Gem className="h-3 w-3" /> {(guild.shards ?? 0).toLocaleString()} shards
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
                    {isMember && isOfficer && (
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
                    const lead = m.userId === guild.leaderId;
                    const coLead = m.userId === guild.coLeaderId;
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
                            {coLead && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">
                                <Shield className="h-2.5 w-2.5" /> Co-leader
                              </span>
                            )}
                            {me && !lead && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">You</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600">joined {ago(m.joinedAt)}</p>
                        </div>
                        {isOfficer && !me && (
                          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            {/* Transfer + co-leader appointment stay leader-only. */}
                            {isLeader && (
                              <button type="button" disabled={busy} onClick={() => transfer(m)}
                                title="Transfer leadership"
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40">
                                <Crown className="h-3 w-3" /> Transfer
                              </button>
                            )}
                            {isLeader && (coLead ? (
                              <button type="button" disabled={busy} onClick={() => setCoLeader(m, false)}
                                title="Remove co-leader"
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-40">
                                <Shield className="h-3 w-3" /> Remove co-leader
                              </button>
                            ) : (
                              <button type="button" disabled={busy} onClick={() => setCoLeader(m, true)}
                                title="Appoint co-leader"
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-40">
                                <Shield className="h-3 w-3" /> Appoint co-leader
                              </button>
                            ))}
                            {/* A co-leader can kick members, never the leader
                                (and never themselves — that row is `me`). */}
                            {(isLeader || !lead) && (
                              <button type="button" disabled={busy} onClick={() => kick(m)}
                                title="Kick from the guild"
                                className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                                <X className="h-3 w-3" /> Kick
                              </button>
                            )}
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

              {/* ── THE GUILD CHAT ── */}
              <GuildChat key={guild.id} guildId={guild.id} isMember={isMember} canModerate={isOfficer} />
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

/* ═══════════════════ THE GUILD CHAT — Discord-style, members only ═══════════════════ */

function GuildChat({ guildId, isMember, canModerate }: { guildId: string; isMember: boolean; canModerate: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stick-to-bottom: true while the reader sits within ~80px of the newest
  // message. New arrivals only pull the scroll down when this is true, so
  // reading history is never interrupted.
  const stickRef = useRef(true);
  const firstScrollRef = useRef(true);
  // The newest id the SERVER has confirmed — polls ask for strictly newer
  // rows. Optimistic sends deliberately do NOT advance it, so a message that
  // landed between the last poll and our own send is never skipped; our own
  // copy simply comes back once more and is deduped.
  const lastIdRef = useRef<string | null>(null);

  const fetchNew = useCallback(async (initial: boolean) => {
    try {
      const base = `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages`;
      const after = initial ? null : lastIdRef.current;
      const url = after ? `${base}?after=${encodeURIComponent(after)}&limit=60` : `${base}?limit=60`;
      const r = await fetch(url, { headers: authHeaders() });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return;
      // The array rides at data's root — there is no { messages } wrapper.
      const rows: ChatMessage[] = Array.isArray(d.data) ? d.data : [];
      if (rows.length > 0) lastIdRef.current = rows[rows.length - 1].id;
      if (rows.length === 0 && !initial) return;
      setMessages((cur) => {
        // after-poll: append what's genuinely new; full window: refresh over
        // whatever optimistic rows the window missed. Sorted either way.
        const merged = after
          ? [...cur, ...rows.filter((m) => !cur.some((x) => x.id === m.id))]
          : [...rows, ...cur.filter((m) => !rows.some((x) => x.id === m.id))];
        merged.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) || a.id.localeCompare(b.id));
        return merged;
      });
    } catch {
      /* offline — the next tick tries again */
    } finally {
      if (initial) setLoading(false);
    }
  }, [guildId]);

  // Initial fetch + the 8-second poll — which ONLY runs while the tab is
  // visible (the backend's rate budget assumes hidden tabs go quiet).
  useEffect(() => {
    if (!isMember) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (timer === null) timer = setInterval(() => fetchNew(false), 8000); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { fetchNew(false); start(); }
      else stop();
    };
    fetchNew(true);
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [isMember, fetchNew]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Bottom on first load; afterwards only when the reader was already there.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const insertEmoji = (emoji: string) => {
    const el = taRef.current;
    const at = el?.selectionStart ?? draft.length;
    const to = el?.selectionEnd ?? at;
    const next = (draft.slice(0, at) + emoji + draft.slice(to)).slice(0, 500);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = Math.min(at + emoji.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const send = async () => {
    if (!user) return toast("Sign in to chat.", "error");
    const content = draft.trim();
    const media = mediaUrl.trim();
    if ((!content && !media) || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: content || undefined, mediaUrl: media || undefined }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        if (r.status === 429) toast("Easy — one message every couple of seconds.", "error");
        else toast(d?.message || "Couldn't send that.", "error");
        return;
      }
      const msg: ChatMessage = d.data;
      stickRef.current = true; // your own message always brings you to it
      setMessages((cur) => (cur.some((m) => m.id === msg.id) ? cur : [...cur, msg]));
      setDraft("");
      setMediaUrl("");
      const el = taRef.current;
      if (el) el.style.height = "auto";
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (m: ChatMessage) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const r = await fetch(
        `${API_URL}/api/guilds/${encodeURIComponent(guildId)}/messages/${encodeURIComponent(m.id)}`,
        { method: "DELETE", headers: authHeaders() },
      );
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't delete that.", "error");
      // If the poll cursor pointed at the deleted row, drop it — the next
      // poll refetches the last window and the dedupe merge absorbs it.
      if (lastIdRef.current === m.id) lastIdRef.current = null;
      setMessages((cur) => cur.filter((x) => x.id !== m.id));
    } catch {
      toast("Couldn't delete that.", "error");
    }
  };

  // Own messages always; the leader and co-leader moderate the whole room.
  const canDelete = (m: ChatMessage) => !!user && (m.userId === user.id || canModerate);

  // Discord grouping: same author within 5 minutes stacks under one header;
  // a day boundary always breaks the run and plants a divider.
  const chatRows = useMemo(() => {
    type Group = { kind: "group"; key: string; author: ChatAuthor | null; userId: string; firstAt: string; items: ChatMessage[] };
    type Row = { kind: "day"; key: string; label: string } | Group;
    const out: Row[] = [];
    let group: Group | null = null;
    let prev: ChatMessage | null = null;
    for (const m of messages) {
      const label = dayLabel(m.createdAt);
      if (!prev || dayLabel(prev.createdAt) !== label) {
        out.push({ kind: "day", key: `day-${m.id}`, label });
        group = null;
      }
      const sameAuthor = !!prev && prev.userId === m.userId;
      const close = !!prev && +new Date(m.createdAt) - +new Date(prev.createdAt) < 5 * 60 * 1000;
      if (group && sameAuthor && close) {
        group.items.push(m);
      } else {
        group = { kind: "group", key: `grp-${m.id}`, author: m.author, userId: m.userId, firstAt: m.createdAt, items: [m] };
        out.push(group);
      }
      prev = m;
    }
    return out;
  }, [messages]);

  // The living-username treatment the board used: effect gradient first,
  // then the shop color, then plain white — plus the font cosmetics.
  const chatNameClass = (a: ChatAuthor | null) => {
    const font =
      a?.activeFont === "font_cyber" ? "tracking-widest " :
      a?.activeFont === "font_pixel" ? "font-serif tracking-tight " : "";
    return font + (effectNameClass(a?.activeEffect) || nameColorClass(a?.activeColor) || "text-white");
  };

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-300" />
        <p className="text-sm font-black text-white">Guild chat</p>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
          Members only
        </span>
      </div>

      {!isMember ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <Lock className="mx-auto h-6 w-6 text-slate-600" />
          <p className="mt-3 text-xs text-slate-500">Join the guild to enter the chat.</p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="mt-4 h-[28rem] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
          >
            {loading ? (
              <p className="py-10 text-center text-xs text-slate-600">Opening the chat…</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-600">Nothing said yet. First word is free.</p>
            ) : (
              chatRows.map((row) =>
                row.kind === "day" ? (
                  <div key={row.key} className="my-4 flex items-center gap-3 first:mt-1">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-600">{row.label}</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                ) : (
                  <div key={row.key} className="mt-3 flex items-start gap-3 first:mt-0">
                    <div className="relative mt-0.5 h-9 w-9 shrink-0">
                      {row.author?.avatar ? (
                        <img src={row.author.avatar} alt="" className="relative z-10 h-9 w-9 rounded-full object-cover ring-1 ring-black/60" />
                      ) : (
                        <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-emerald-800 text-xs font-black ring-1 ring-black/60">
                          {(row.author?.username || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                      <AvatarDecoration effect={row.author?.activeEffect} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {row.author?.username ? (
                          <UserLink username={row.author.username}
                            className={`text-sm font-black hover:underline ${chatNameClass(row.author)}`}>
                            {row.author.username}
                          </UserLink>
                        ) : (
                          <span className="text-sm font-black text-slate-400">someone</span>
                        )}
                        <span className="text-[10px] font-bold tabular-nums text-slate-600">{hhmm(row.firstAt)}</span>
                      </div>
                      <div className="space-y-0.5">
                        {row.items.map((m) => (
                          <div key={m.id} className="group/msg relative -mx-1.5 rounded-md px-1.5 py-px transition hover:bg-white/[0.03]">
                            {m.content && (
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{m.content}</p>
                            )}
                            {m.mediaUrl && (
                              <img src={m.mediaUrl} alt="" loading="lazy"
                                className="my-1 max-h-64 w-auto max-w-full rounded-xl object-contain" />
                            )}
                            {canDelete(m) && (
                              <button type="button" onClick={() => removeMessage(m)} aria-label="Delete message"
                                className="absolute -top-1.5 right-0 hidden h-6 w-6 place-items-center rounded-md border border-white/10 bg-[#101018] text-slate-500 shadow transition hover:text-red-300 group-hover/msg:grid">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>

          <div className="mt-3">
            {mediaUrl && (
              <div className="mb-2 inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
                <img src={mediaUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
                <button type="button" onClick={() => setMediaUrl("")} aria-label="Remove attachment"
                  className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                onInput={autoGrow}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Message the guild…"
                className="max-h-[120px] min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
              />
              <button type="button" onClick={send} aria-label="Send message"
                disabled={sending || (!draft.trim() && !mediaUrl.trim())}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EmojiPicker onPick={insertEmoji} />
              <MediaPicker value={mediaUrl} onChange={setMediaUrl} userId={user?.id} />
              <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-600">{draft.length}/500</span>
            </div>
            <p className="mt-1.5 text-[9px] text-slate-600">Enter sends · Shift+Enter for a new line</p>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════ LEADER'S EDIT SHEET — description + crest + banner ═══════════════ */

function EditGuildSheet({ guild, onClose, onSaved }: {
  guild: GuildDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [desc, setDesc] = useState(guild.description || "");
  const [avatar, setAvatar] = useState<string | null>(guild.avatar);
  const [banner, setBanner] = useState<string | null>(guild.banner);
  const [uploading, setUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // The SettingsModal flow: unsigned upload straight to Cloudinary, only the
  // returned secure_url travels to our backend — which allow-lists exactly
  // that host (res.cloudinary.com) for guild art. One uploader serves both
  // the crest and the banner; only the target setter differs.
  const uploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    apply: (url: string) => void,
    setBusy: (busy: boolean) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!CLOUD_NAME || !UPLOAD_PRESET) return toast("Image uploads aren't configured yet.", "error");
    if (file.size > 10 * 1024 * 1024) return toast("That image is over 10MB — pick a smaller one.", "error");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) apply(data.secure_url);
      else toast("Upload failed — try again.", "error");
    } catch {
      toast("Upload failed — try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guild.id)}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ description: desc.trim(), avatar: avatar, banner: banner || "" }),
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
            <p className="text-[11px] text-slate-500">Name and tag are permanent — description, crest and banner are yours</p>
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
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => uploadImage(e, setAvatar, setUploading)} className="hidden" />
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-white">Banner</label>
            <p className="mt-1 text-[10px] text-slate-600">Drapes behind the guild hall hero — wide images sit best.</p>
            {banner ? (
              <img src={banner} alt="" className="mt-2 h-24 w-full rounded-xl object-cover ring-1 ring-emerald-400/30" />
            ) : (
              <div className="mt-2 grid h-24 w-full place-items-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                No banner yet
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={bannerUploading} onClick={() => bannerFileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-50">
                {bannerUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {bannerUploading ? "Uploading…" : banner ? "Change banner" : "Upload a banner"}
              </button>
              {banner && (
                <button type="button" onClick={() => setBanner(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/20">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
              <input ref={bannerFileRef} type="file" accept="image/*" onChange={(e) => uploadImage(e, setBanner, setBannerUploading)} className="hidden" />
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
          <button type="button" disabled={saving || uploading || bannerUploading} onClick={save}
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
