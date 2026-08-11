"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users, Shield, Crown, X, Sparkles, Pencil, Trash2,
  Gem, Layers, Clock, Check, RefreshCw, Camera, Plus,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import { cacheGuildId, cachedGuildId, loanTimeLeft } from "@/lib/guild";
import { loadCatalog } from "@/lib/catalogCache";
import PageTransition from "@/components/layout/PageTransition";
import CardFace, { CardDef, RARITY_META, CardRarity } from "@/components/cards/CardFace";
import UserLink from "@/components/profile/UserLink";
// The chat and its role chip moved to a shared component so the dock can mount
// the same room from any page. This hall renders it exactly as it always did.
import GuildChatRoom, { RoleChip } from "@/components/guild/GuildChatRoom";

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
  // `?` rides out deploy skew — a backend without roles yet must not crash us.
  customRoleId?: string | null;
};

type GuildRolePermissions = {
  editGuild: boolean;
  kickMembers: boolean;
  moderateChat: boolean;
};

type GuildRole = {
  id: string;
  name: string;
  color: string;
  permissions: GuildRolePermissions;
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
  roles?: GuildRole[];
};

/** What the themed confirm asks — replaces every window.confirm on this page. */
type ConfirmSpec = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

// The server enforces this exact palette on role create/update — the picker
// simply offers the same twelve.
const ROLE_PALETTE = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#2dd4bf",
  "#38bdf8", "#818cf8", "#a78bfa", "#e879f9", "#fb7185", "#94a3b8",
];

const PERM_ROWS: { key: keyof GuildRolePermissions; label: string; hint: string }[] = [
  { key: "editGuild", label: "Edit guild profile", hint: "Change the description, crest and banner." },
  { key: "kickMembers", label: "Kick members", hint: "Remove regular members — never the leader or co-leader." },
  { key: "moderateChat", label: "Moderate chat", hint: "Delete anyone's messages in the guild chat." },
];

/** The member's custom role, resolved — null for officers-only lookups too. */
const customRoleOf = (guild: GuildDetail, userId: string): GuildRole | null => {
  const m = guild.members.find((x) => x.userId === userId);
  if (!m?.customRoleId) return null;
  return (guild.roles || []).find((r) => r.id === m.customRoleId) || null;
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

/* The public raid snapshot — GET /api/raid/guild/:guildId, no auth. */
type RaidTopDamage = { username: string; avatar: string | null; damage: number };
type RaidPanel = {
  week: string; // ISO week key, e.g. "2026-W33"
  guild: { id: string; name: string; tag: string };
  boss: { slug: string; name: string; series: string; art: string | null; gimmickText: string | null };
  hpMax: number;
  hpLeft: number;
  killedAt: string | null;
  attackers: number;
  topDamage: RaidTopDamage[];
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
  // Role sheet: open for create ({ role: null }) or edit ({ role }).
  const [roleSheet, setRoleSheet] = useState<{ role: GuildRole | null } | null>(null);
  // The themed stand-in for window.confirm — one at a time is plenty.
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);
  const [loans, setLoans] = useState<{ lent: Loan[]; borrowed: Loan[] }>({ lent: [], borrowed: [] });

  const askConfirm = useCallback((spec: ConfirmSpec) => setConfirmSpec(spec), []);

  const isMember = !!guild?.myMembership;
  const isLeader = !!user && !!guild && guild.leaderId === user.id;
  const isCoLeader = !!user && !!guild && guild.coLeaderId === user.id;
  // Day-to-day powers (edit profile, kick, chat moderation) are shared with
  // the co-leader; transfer and co-leader appointment stay leader-only.
  const isOfficer = isLeader || isCoLeader;

  // Custom roles grant slices of those powers. The server re-checks every
  // call — these only decide which controls are worth SHOWING.
  const guildRoles = guild?.roles || [];
  const myCustomRole = user && guild ? customRoleOf(guild, user.id) : null;
  const myPerms = {
    editGuild: isOfficer || !!myCustomRole?.permissions?.editGuild,
    kickMembers: isOfficer || !!myCustomRole?.permissions?.kickMembers,
    moderateChat: isOfficer || !!myCustomRole?.permissions?.moderateChat,
  };

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
  // The confirm dialog joins the chain — same lock, same restore.
  useEffect(() => {
    if (!editOpen && !lendOpen && !roleSheet && !confirmSpec) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [editOpen, lendOpen, roleSheet, confirmSpec]);

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

  const leave = () => {
    if (!user || !guild || busy) return;
    const lastOne = isLeader && guild.memberCount <= 1;
    askConfirm({
      title: `Leave ${guild.name}?`,
      body: lastOne
        ? "You're the last member — the guild disbands and its name is freed."
        : "Your active card loans end with you.",
      confirmLabel: "Leave",
      danger: true,
      onConfirm: async () => {
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
      },
    });
  };

  const kick = (m: Member) => {
    if (!guild || busy) return;
    askConfirm({
      title: `Kick ${m.username}?`,
      body: `They leave ${guild.name} on the spot, and their card loans end with them.`,
      confirmLabel: "Kick",
      danger: true,
      onConfirm: async () => {
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
      },
    });
  };

  const transfer = (m: Member) => {
    if (!guild || busy) return;
    askConfirm({
      title: "Transfer leadership?",
      body: `Hand leadership of ${guild.name} to ${m.username}? You become a regular member.`,
      confirmLabel: "Transfer",
      danger: true,
      onConfirm: async () => {
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
      },
    });
  };

  // Leader-only: appoint (userId) or dismiss (null) the co-leader. The server
  // re-checks both the caller and the target — this button is convenience.
  const setCoLeader = (m: Member, appoint: boolean) => {
    if (!guild || busy) return;
    const run = async () => {
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
    askConfirm(appoint ? {
      title: `Make ${m.username} co-leader?`,
      body: `They can edit the guild, kick members, and moderate the board.${
        guild.coLeaderId ? " This replaces the current co-leader." : ""
      }`,
      confirmLabel: "Appoint",
      onConfirm: run,
    } : {
      title: `Remove ${m.username} as co-leader?`,
      body: "They stay in the guild as a regular member.",
      confirmLabel: "Remove",
      danger: true,
      onConfirm: run,
    });
  };

  /* ── CUSTOM ROLES — create, edit, delete, assign. Every endpoint answers
     with the updated guild detail, so we set it straight in. ── */

  const saveRole = async (payload: { name: string; color: string; permissions: GuildRolePermissions }) => {
    if (busy || !roleSheet) return;
    const editing = roleSheet.role;
    setBusy(true);
    try {
      const url = editing
        ? `${API_URL}/api/guilds/${encodeURIComponent(id)}/roles/${encodeURIComponent(editing.id)}`
        : `${API_URL}/api/guilds/${encodeURIComponent(id)}/roles`;
      const r = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't save the role.", "error");
      if (d.data) setGuild(d.data); else load();
      toast(editing ? "Role updated." : `${payload.name} created.`, "success");
      setRoleSheet(null);
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeRole = (role: GuildRole) => {
    if (!guild || busy) return;
    const holders = guild.members.filter((m) => m.customRoleId === role.id).length;
    askConfirm({
      title: `Delete ${role.name}?`,
      body: holders > 0
        ? `${holders} ${holders === 1 ? "member holds" : "members hold"} this role — deleting it strips the role from them. This can't be undone.`
        : "The role disappears for good. This can't be undone.",
      confirmLabel: "Delete role",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const r = await fetch(
            `${API_URL}/api/guilds/${encodeURIComponent(id)}/roles/${encodeURIComponent(role.id)}`,
            { method: "DELETE", headers: authHeaders() },
          );
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.success) return toast(d?.message || "Couldn't delete the role.", "error");
          if (d.data) setGuild(d.data); else load();
          toast(`${role.name} deleted.`, "success");
        } catch {
          toast("Couldn't reach the server.", "error");
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const assignRole = async (m: Member, roleId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(
        `${API_URL}/api/guilds/${encodeURIComponent(id)}/members/${encodeURIComponent(m.userId)}/role`,
        { method: "POST", headers: authHeaders(), body: JSON.stringify({ roleId }) },
      );
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't change their role.", "error");
      if (d.data) setGuild(d.data); else load();
      const roleName = roleId ? guildRoles.find((x) => x.id === roleId)?.name : null;
      toast(roleName ? `${m.username} is now ${roleName}.` : `${m.username} has no role now.`, "success");
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

        {/* lg widens for the rail: 4xl split into two columns left the hero
            squeezed and a hollow middle — the "messy" report. */}
        <div className="relative mx-auto max-w-4xl lg:max-w-6xl">
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
              {/* The top row only: the hero keeps the wide lane, and on lg a
                  320px rail (this week's raid boss + guild XP) rides beside
                  it — stacking below the hero on smaller screens. Everything
                  under this row stays the single stacked column. */}
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
              {/* Left column: hero + members, so the rail's boss/XP cards run
                  beside the member list instead of over a hollow gap. */}
              <div className="min-w-0">
              {/* ── THE HERO — the Deep Sea Vibes reference, in our kit ──
                  With a banner, the ART is the hero: the page-level fixed
                  layer carries it, so the card chrome disappears and the
                  crest/name float straight on the image. Without one, the
                  boxed gradient card stands as before. */}
              <div className={guild.banner
                // A soft scrim card even in banner mode: content floating
                // bare on the full-screen art read as scattered. bg tint
                // only — backdrop-filter is banned on large elements.
                ? "relative overflow-hidden rounded-3xl border border-white/10 bg-black/35"
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
                    {isMember && myPerms.editGuild && (
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
                    // Who may kick THIS row: leader → anyone, co-leader →
                    // anyone but the leader, a kickMembers role → plain
                    // members only — and not a fellow kick-power holder (the
                    // server 403s peer purges; don't offer a dead button).
                    // Never yourself — that row is `me`.
                    const targetKicks = !!guildRoles.find((r) => r.id === m.customRoleId)?.permissions?.kickMembers;
                    const canKickThis = !me && (
                      isLeader ? true :
                      isCoLeader ? !lead :
                      myPerms.kickMembers ? !lead && !coLead && !targetKicks :
                      false
                    );
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
                            <RoleChip guild={guild} userId={m.userId} />
                            {me && !lead && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">You</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600">joined {ago(m.joinedAt)}</p>
                        </div>
                        {!me && (isOfficer || canKickThis) && (
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
                            {/* Officers hand out custom roles — but the
                                leader can't hold one (server 400s), so no
                                dead select on that row. */}
                            {isOfficer && !lead && guildRoles.length > 0 && (
                              <select
                                value={m.customRoleId || ""}
                                disabled={busy}
                                onChange={(e) => assignRole(m, e.target.value || null)}
                                title="Assign a role"
                                aria-label={`Role for ${m.username}`}
                                className="rounded-lg border border-white/15 bg-[#101018] px-2 py-1.5 text-[10px] font-bold text-slate-300 outline-none transition focus:border-emerald-400/40 disabled:opacity-40">
                                <option value="">No role</option>
                                {guildRoles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            )}
                            {canKickThis && (
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
              </div>

              <GuildSideRail guild={guild} isMember={isMember} />
              </div>

              {/* ── ROLES & PERMISSIONS — Discord-style, officer-managed ── */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-300" />
                    <p className="text-sm font-black text-white">Roles</p>
                    <span className="text-[10px] font-bold tabular-nums text-slate-600">{guildRoles.length}</span>
                  </div>
                  {isOfficer && (
                    <button type="button" onClick={() => setRoleSheet({ role: null })}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                      <Plus className="h-3.5 w-3.5" /> New role
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Custom titles with real teeth — a role can carry guild-editing, kicking, or chat-moderation
                  rights, and it colours its holder&rsquo;s name in the chat.
                </p>

                {guildRoles.length === 0 ? (
                  <p className="mt-5 py-6 text-center text-xs text-slate-600">
                    {isOfficer ? "No roles yet — create the first one." : "No roles yet."}
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {guildRoles.map((role) => {
                      const holders = guild.members.filter((m) => m.customRoleId === role.id).length;
                      const grants = PERM_ROWS.filter((p) => role.permissions?.[p.key]).map((p) => p.label);
                      return (
                        <div key={role.id}
                          className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                            style={{
                              borderColor: `${role.color}66`,
                              backgroundColor: `${role.color}24`,
                              color: role.color,
                            }}>
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: role.color }} />
                            {role.name}
                          </span>
                          <span className="text-[10px] font-bold tabular-nums text-slate-500">
                            {holders} {holders === 1 ? "member" : "members"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">
                            {grants.length > 0 ? grants.join(" · ") : "No permissions — title only"}
                          </span>
                          {isOfficer && (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" disabled={busy} onClick={() => setRoleSheet({ role })}
                                title="Edit role"
                                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40">
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                              <button type="button" disabled={busy} onClick={() => removeRole(role)}
                                title="Delete role"
                                className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {isOfficer && guildRoles.length > 0 && (
                  <p className="mt-3 text-[10px] text-slate-600">
                    Hand a role to a member with the selector on their row above.
                  </p>
                )}
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

              {/* ── THE GUILD CHAT — shared with the dock's slide-over panel;
                     no className/heightClass here means the hall's own card
                     chrome and its fixed 28rem scroller, unchanged. ── */}
              <GuildChatRoom key={guild.id} guildId={guild.id} guild={guild} isMember={isMember}
                canModerate={myPerms.moderateChat} askConfirm={askConfirm} />
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

        {roleSheet && guild && (
          <RoleSheet
            initial={roleSheet.role}
            saving={busy}
            onClose={() => setRoleSheet(null)}
            onSave={saveRole}
          />
        )}

        {confirmSpec && (
          <GuildConfirm spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
        )}
      </div>
    </PageTransition>
  );
}

/* ═══════════ THE RIGHT RAIL — this week's boss + the guild's XP ladder ═══════════
   Two cards beside the hero on lg, stacked under it below. The chrome is
   slightly translucent so it sits on the full-screen banner without
   backdrop-filter (banned on large elements). The boss card is fed by the
   public raid snapshot and simply doesn't render when that fetch fails; the
   XP card reads the already-loaded guild detail — no extra request. */

function GuildSideRail({ guild, isMember }: { guild: GuildDetail; isMember: boolean }) {
  const [raid, setRaid] = useState<RaidPanel | null>(null);
  const [artHidden, setArtHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/raid/guild/${encodeURIComponent(guild.id)}`);
        if (!r.ok) return;
        const d = await r.json().catch(() => null);
        if (alive && d?.success && d.data) setRaid(d.data);
      } catch {
        /* offline or 404 — the boss card just doesn't render */
      }
    })();
    return () => { alive = false; };
  }, [guild.id]);

  // Clamp before dividing — a skewed backend must never draw a 300% bar.
  const hpMax = Math.max(1, raid?.hpMax ?? 1);
  const hpLeft = Math.max(0, Math.min(raid?.hpLeft ?? 0, hpMax));
  const slain = !!raid?.killedAt;
  const pct = slain ? 0 : (hpLeft / hpMax) * 100;
  const lowHp = slain || pct < 25;

  const xp = Math.max(0, guild.xp ?? 0);
  const level = guild.level ?? Math.floor(xp / 1000) + 1;
  const intoLevel = xp % 1000;

  return (
    <div className="mt-6 space-y-6 lg:mt-0">
      {raid && (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11]/85">
          {raid.boss?.art && !artHidden && (
            <div className="relative">
              <img
                src={raid.boss.art}
                alt=""
                onError={() => setArtHidden(true)}
                className="h-24 w-full object-cover opacity-60"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0b0b11]" />
            </div>
          )}
          <div className="p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">This week&rsquo;s boss</p>
            </div>
            <p className="mt-2 font-fell text-2xl leading-tight text-white">{raid.boss?.name}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{raid.boss?.series} · {raid.week}</p>
            {raid.boss?.gimmickText && (
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{raid.boss.gimmickText}</p>
            )}

            <div className="mt-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${lowHp ? "bg-red-500" : "bg-emerald-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {slain ? (
                <span className="mt-2 inline-flex items-center rounded-md border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.24em] text-red-300">
                  Slain this week
                </span>
              ) : (
                <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-400">
                  {hpLeft.toLocaleString()} / {hpMax.toLocaleString()}
                </p>
              )}
            </div>

            <p className="mt-3 text-[10px] text-slate-500">
              {raid.attackers ?? 0} {(raid.attackers ?? 0) === 1 ? "raider" : "raiders"} this week
            </p>
            {(raid.topDamage || []).length > 0 && (
              <div className="mt-2 space-y-1.5">
                {(raid.topDamage || []).map((t, i) => (
                  <div key={`${t.username}-${i}`} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-center font-mono text-[10px] font-black tabular-nums text-slate-500">{i + 1}</span>
                    {t.avatar ? (
                      <img src={t.avatar} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
                    ) : (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-800 text-[8px] font-black">
                        {(t.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white">{t.username}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">{(t.damage ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {isMember && (
              <Link href="/raid"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                Fight this boss
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/85 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Guild XP</p>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-fell text-3xl leading-none text-white">Level {level}</p>
          <p className="font-mono text-[11px] tabular-nums text-slate-400">{xp.toLocaleString()} XP</p>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(intoLevel / 1000) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[10px] tabular-nums text-slate-500">
          {1000 - intoLevel} XP to Lv {level + 1}
        </p>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          Raids feed the guild — +25 XP per attack, +500 per kill.
        </p>
      </div>
    </div>
  );
}

/* ═══════════ THE THEMED CONFIRM — window.confirm, dressed for the hall ═══════════ */

function GuildConfirm({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  // Escape cancels — same contract as clicking the backdrop or Cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" aria-label={spec.title}
        className="relative w-full max-w-sm rounded-2xl border border-emerald-400/20 bg-[#0b0b11] p-6">
        <p className="font-fell text-2xl leading-tight text-white">{spec.title}</p>
        <p className="mt-3 font-mono text-sm leading-relaxed text-slate-400">{spec.body}</p>
        <div className="mt-6 flex items-center justify-end gap-2">
          {/* Focus lands on CANCEL: a stray Enter must never fire the
              destructive branch. */}
          <button type="button" autoFocus onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.1] hover:text-white">
            Cancel
          </button>
          <button type="button"
            onClick={() => { onClose(); spec.onConfirm(); }}
            className={`rounded-xl border px-5 py-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] transition ${
              spec.danger
                ? "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
            }`}>
            {spec.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ THE ROLE SHEET — name it, colour it, arm it ═══════════ */

function RoleSheet({ initial, saving, onClose, onSave }: {
  initial: GuildRole | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; color: string; permissions: GuildRolePermissions }) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || ROLE_PALETTE[0]);
  const [perms, setPerms] = useState<GuildRolePermissions>({
    editGuild: !!initial?.permissions?.editGuild,
    kickMembers: !!initial?.permissions?.kickMembers,
    moderateChat: !!initial?.permissions?.moderateChat,
  });
  const trimmed = name.trim();
  const nameOk = trimmed.length >= 2 && trimmed.length <= 20;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={initial ? "Edit role" : "New role"}
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-fell text-lg text-white">{initial ? `Edit ${initial.name}` : "New role"}</p>
            <p className="text-[11px] text-slate-500">A colour, a name, and whichever powers it should carry</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-xs font-black text-white">Name</label>
              <span className="text-[10px] tabular-nums text-slate-600">{trimmed.length}/20</span>
            </div>
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="Strategist, Recruiter, Archivist…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
            />
            <p className="mt-1 text-[10px] text-slate-600">2–20 characters.</p>
          </div>

          <div>
            <label className="text-xs font-black text-white">Colour</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLE_PALETTE.map((hex) => (
                <button key={hex} type="button" onClick={() => setColor(hex)}
                  aria-label={`Colour ${hex}`} aria-pressed={color === hex}
                  className={`grid h-8 w-8 place-items-center rounded-full transition ${
                    color === hex ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0b0b11]" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: hex }}>
                  {color === hex && <Check className="h-3.5 w-3.5 text-black/70" />}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
                style={{ borderColor: `${color}66`, backgroundColor: `${color}24`, color }}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {trimmed || "Role name"}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-white">Permissions</label>
            <p className="mt-1 text-[10px] text-slate-600">
              All optional — a role can be a coloured title and nothing more. The server re-checks every action.
            </p>
            <div className="mt-2 space-y-1.5">
              {PERM_ROWS.map((row) => {
                const on = perms[row.key];
                return (
                  <button key={row.key} type="button" aria-pressed={on}
                    onClick={() => setPerms((p) => ({ ...p, [row.key]: !p[row.key] }))}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      on ? "border-emerald-400/40 bg-emerald-500/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}>
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      on ? "border-emerald-400 bg-emerald-500/30 text-emerald-200" : "border-white/20 text-transparent"
                    }`}>
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-white">{row.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">{row.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Cancel
          </button>
          <button type="button" disabled={!nameOk || saving}
            onClick={() => onSave({ name: trimmed, color, permissions: perms })}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "Saving…" : initial ? "Save changes" : "Create role"}
          </button>
        </div>
      </div>
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
