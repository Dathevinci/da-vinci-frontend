"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users, Shield, Crown, X, Sparkles, Pencil, Trash2,
  Gem, Layers, Clock, Check, RefreshCw, Camera, Plus,
  Lock, Zap, Trophy, Activity, Globe, UserPlus, Calendar, Send, Smile,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast, ToastType } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
// CUSTOM EMOJI — the catalog, its module cache and the rules the server
// enforces, all mirrored in one place. Nothing here re-derives a shortcode
// rule or a slot count by hand; this page draws what the lib says.
import {
  useGuildEmojis, invalidateGuildEmojis, isValidEmojiName, normalizeEmojiName,
  emojiSlots, GuildEmoji, EMOJI_NAME_MIN, EMOJI_NAME_MAX,
  EMOJI_SLOTS_BASE, EMOJI_SLOTS_MAX, EMOJI_LEVELS_PER_SLOT,
} from "@/lib/guildEmoji";
import { cacheGuildId, cachedGuildId, loanTimeLeft, GUILD_CREATE } from "@/lib/guild";
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
 * when it doesn't), the four STAT TILES and the LEVEL bar under it, the
 * MEMBERS strip with the leader's controls, the CHAT (a Discord-style
 * members-only room on /api/guilds/:id/messages — grouped messages, day
 * dividers, an 8-second poll that goes quiet while the tab is hidden), CARD
 * SHARING (7-day loans between guildmates, capped 3 a side), and a right rail
 * carrying the raid boss, the XP ladder, the top contributor, the guild's
 * statistics, the custom-roles unlock, the leader's management panel and the
 * guild's vitals.
 *
 * THE DIVISION OF LABOUR, and it is absolute:
 *  · The LEVEL LADDER is the server's. levelCost/totalXpFor/guildLevel live in
 *    guild.controller.ts; this page draws `level`, `xpIntoLevel`,
 *    `xpForNextLevel`, `progressPct` and `isMax` and never derives a level
 *    from XP. At the top of the ladder the bar reads MAX, never a negative
 *    remainder.
 *  · The TREASURY is a closed loop. Shards flow in (the guild's cut of member
 *    XP, plus member donations) and out only through the guild purchases —
 *    nothing on this page, or behind it, pays treasury shards to a person.
 *  · "ACTIVE" is a 10-minute last-write recency proxy, not presence. The copy
 *    says "Active", never "Online", because that is all the data supports.
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
  // How much guild XP this member has fed the ladder (half of everything they
  // earn anywhere on the site), and our ONE presence signal: the server says
  // their user row was written in the last 10 minutes. That is a RECENCY
  // proxy, not a socket — the UI says "Active", never "Online".
  xpContributed?: number;
  activeRecently?: boolean;
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

/** The guild's headline numbers, computed server-side on every detail read. */
type TopContributor = {
  userId: string;
  username: string;
  avatar: string | null;
  xpContributed: number;
};

type GuildStats = {
  memberCount: number;
  activeCount: number;
  /** round(activeMembers / memberCount * 100) — a 10-minute recency rate. */
  onlineRate: number;
  avgXp: number;
  topContributor: TopContributor | null;
};

/** A pending invite — the officers' outbox row and the viewer's inbox row. */
type GuildInvite = {
  id: string;
  guildId: string;
  userId: string;
  username?: string;
  avatar?: string | null;
  guildName?: string;
  guildTag?: string;
  invitedByName?: string | null;
  createdAt?: string;
};

type GuildDetail = {
  id: string; name: string; tag: string; description: string;
  avatar: string | null; banner: string | null;
  leaderId: string; coLeaderId: string | null;
  // TREASURY — a CLOSED LOOP. Shards flow IN (the guild's cut of what members
  // earn, plus donations) and only ever back OUT through the guild purchases
  // below. There is no path, anywhere, that moves treasury shards into a
  // personal balance: donating is one-way and disbanding burns the rest.
  shards: number; xp: number;
  level: number; createdAt: string; memberCap: number; memberCount: number;
  members: Member[];
  myMembership: { role: string; joinedAt: string } | null;
  activeLoanCount: number;
  roles?: GuildRole[];
  // ── THE SERVER'S LEVEL BLOCK ──
  // levelCost/totalXpFor/guildLevel live in guild.controller.ts and NOWHERE
  // else. This page draws these numbers and never derives a level from xp.
  // Every field is optional so a backend mid-deploy degrades instead of
  // throwing.
  xpIntoLevel?: number;
  xpForNextLevel?: number;
  progressPct?: number;
  maxLevel?: number;
  isMax?: boolean;
  purchasedSlots?: number;
  isPublic?: boolean;
  minLevel?: number;
  rolesUnlocked?: boolean;
  xpBoostUntil?: string | null;
  xpBoostActive?: boolean;
  stats?: GuildStats;
};

/** What the themed confirm asks — replaces every window.confirm on this page. */
type ConfirmSpec = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * TREASURY PRICES — a MIRROR of the server's one exported price object, kept
 * here for labels only. The server owns the debit (a compare-and-set against
 * the treasury, so it can never go negative) and re-prices every purchase; if
 * these ever drift, the server wins and its message lands in the toast.
 */
const GUILD_PRICES = {
  ROLES_UNLOCK: 15000,
  XP_BOOST: 5000,
  MEMBER_SLOTS: 4000,
};
const SLOTS_PER_PURCHASE = 5;
const MAX_MEMBER_CAP = 100;
const MAX_ROLES = 10;
const BOOST_DAYS = 7;

/**
 * THE EMOJI SIZE CAP — a CLIENT courtesy, not a rule. The crest and the banner
 * are drawn once each; an emoji is drawn on EVERY chat line that uses it, on
 * phones, forever. A 10MB GIF there is a phone-killer, so the picker refuses
 * one before it ever reaches Cloudinary.
 */
const EMOJI_MAX_MB = 2;
const EMOJI_MAX_BYTES = EMOJI_MAX_MB * 1024 * 1024;
const EMOJI_TOO_BIG =
  `Over ${EMOJI_MAX_MB}MB. An emoji loads on every chat line that uses it, so it has to stay small.`;
/** What the picker offers. GIF and animated WebP are the point of this cap. */
const EMOJI_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
/** How stale a member's last write may be and still read as "Active". */
const ACTIVE_WINDOW_MINUTES = 10;

/**
 * THE ONE UPLOADER — the SettingsModal flow, shared.
 *
 * An unsigned upload straight to Cloudinary; only the returned `secure_url`
 * ever travels to our backend, which allow-lists exactly that host
 * (res.cloudinary.com) for guild art AND for guild emoji. The crest, the
 * banner and every emoji come through here, so there is ONE place where the
 * preset, the failure copy and the size wall live.
 *
 * Returns the url, or null — and it has already toasted the reason by then.
 */
async function uploadToCloudinary(
  file: File,
  opts: { maxBytes: number; tooLarge: string; toast: (message: string, type?: ToastType) => void },
): Promise<string | null> {
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    opts.toast("Image uploads aren't configured yet.", "error");
    return null;
  }
  if (file.size > opts.maxBytes) {
    opts.toast(opts.tooLarge, "error");
    return null;
  }
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data?.secure_url) return String(data.secure_url);
    opts.toast("Upload failed — try again.", "error");
    return null;
  } catch {
    opts.toast("Upload failed — try again.", "error");
    return null;
  }
}

/** Whole numbers with separators — every count on this page goes through it. */
const nf = (n: number | null | undefined) =>
  Math.max(0, Math.round(Number(n) || 0)).toLocaleString();

/** "4 Mar 2026" — created date, boost expiry. Bad input reads as a dash. */
const dateLabel = (iso?: string | null) => {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/**
 * The server's level block, clamped for DRAWING only.
 *
 * Nothing here recomputes a level: `level`, `xpIntoLevel`, `xpForNextLevel`
 * and `isMax` all arrive from GET /api/guilds/:id. The clamps exist so a
 * skewed payload can never paint a 300% bar or a negative "to next level" —
 * at max the bar is full and the copy reads MAX.
 */
function levelView(guild: GuildDetail) {
  const level = Math.max(1, Math.round(guild.level ?? 1));
  const maxLevel = Math.max(1, Math.round(guild.maxLevel ?? 100));
  const isMax = guild.isMax ?? (level >= maxLevel);
  const intoLevel = Math.max(0, Math.round(guild.xpIntoLevel ?? 0));
  const nextCost = Math.max(0, Math.round(guild.xpForNextLevel ?? 0));
  const toNext = isMax ? 0 : Math.max(0, nextCost - intoLevel);
  const raw = guild.progressPct ?? (nextCost > 0 ? (intoLevel / nextCost) * 100 : 0);
  const pct = isMax ? 100 : Math.max(0, Math.min(100, Number(raw) || 0));
  return { level, maxLevel, isMax, intoLevel, nextCost, toNext, pct, xp: Math.max(0, guild.xp ?? 0) };
}

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
  // The two new sheets: recruiting (send + revoke invites) and donating.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  // The emoji uploader — officers only, opened from the rail's Guild emoji card.
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Pending invites INTO this guild (officers' view) and MY invite to it, if
  // one exists — that second one turns Join into "Accept invite".
  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [invitesLoaded, setInvitesLoaded] = useState(false);
  const [myInvite, setMyInvite] = useState<GuildInvite | null>(null);

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

  // Custom roles are a treasury purchase now. `!== false` is deliberate: a
  // backend that predates the flag (or the boot backfill for guilds already
  // using roles) leaves it undefined, and those guilds stay unlocked.
  const rolesUnlocked = !!guild && guild.rolesUnlocked !== false;
  // Public by default — same default the schema carries.
  const isPublic = !guild || guild.isPublic !== false;
  const minLevel = Math.max(1, Math.round(guild?.minLevel ?? 1));

  // Leader first, then whoever has fed the guild the most XP. The API sends
  // xpContributed per row; ties fall back to the name so the order is stable.
  const sortedMembers = useMemo(() => {
    if (!guild) return [] as Member[];
    return [...guild.members].sort((a, b) => {
      if (a.userId === guild.leaderId) return -1;
      if (b.userId === guild.leaderId) return 1;
      return (b.xpContributed ?? 0) - (a.xpContributed ?? 0)
        || (a.username || "").localeCompare(b.username || "");
    });
  }, [guild]);

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

  // Officers' outbox: who is still sitting on an invite. Loaded lazily when
  // the sheet opens — nobody needs it on first paint.
  const loadInvites = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/invites`, { headers: authHeaders() });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) setInvites(Array.isArray(d.data) ? d.data : []);
    } catch {
      /* offline — the sheet shows its empty line */
    } finally {
      setInvitesLoaded(true);
    }
  }, [id]);

  // My inbox, filtered to THIS guild: without it a private guild would only
  // ever offer a Join button that 403s.
  const loadMyInvites = useCallback(async () => {
    if (!user?.id) { setMyInvite(null); return; }
    try {
      const r = await fetch(`${API_URL}/api/guilds/mine/invites`, { headers: authHeaders() });
      const d = await r.json().catch(() => null);
      const rows: GuildInvite[] = r.ok && d?.success && Array.isArray(d.data) ? d.data : [];
      setMyInvite(rows.find((v) => v.guildId === id) || null);
    } catch {
      setMyInvite(null);
    }
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load, user?.id]);
  useEffect(() => { loadLoans(); }, [loadLoans]);
  useEffect(() => { loadMyInvites(); }, [loadMyInvites]);
  useEffect(() => { if (inviteOpen) loadInvites(); }, [inviteOpen, loadInvites]);

  // The sheets scroll; the page behind them must not (cards-page rule).
  // The confirm dialog joins the chain — same lock, same restore.
  useEffect(() => {
    if (!editOpen && !lendOpen && !roleSheet && !confirmSpec && !inviteOpen && !donateOpen && !emojiOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [editOpen, lendOpen, roleSheet, confirmSpec, inviteOpen, donateOpen, emojiOpen]);

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

  /* ── INVITES — the private door. A pending invite is REQUIRED to join a
     private guild, and it is consumed the moment it is accepted. ── */

  const acceptInvite = async () => {
    if (!myInvite || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/invites/${encodeURIComponent(myInvite.id)}/accept`, {
        method: "POST", headers: authHeaders(),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) return toast(d?.message || "Couldn't accept that invite.", "error");
      cacheGuildId(id);
      toast(`Welcome to ${guild?.name || "the guild"}.`, "success");
      setMyInvite(null);
      load();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  };

  const declineInvite = () => {
    if (!myInvite || busy) return;
    const inv = myInvite;
    askConfirm({
      title: "Decline this invitation?",
      body: `${guild?.name || "The guild"} would have to invite you again.`,
      confirmLabel: "Decline",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const r = await fetch(`${API_URL}/api/guilds/invites/${encodeURIComponent(inv.id)}/decline`, {
            method: "POST", headers: authHeaders(),
          });
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.success) return toast(d?.message || "Couldn't decline that.", "error");
          setMyInvite(null);
          toast("Invitation declined.", "success");
        } catch {
          toast("Couldn't reach the server.", "error");
        } finally {
          setBusy(false);
        }
      },
    });
  };

  // The sheet takes a NAME because that's what people know; the endpoint takes
  // a userId, so we resolve it through the same public lookup every other
  // page uses. Returns true so the sheet can clear its input.
  const sendInvite = async (username: string): Promise<boolean> => {
    const name = username.trim().replace(/^@/, "");
    if (!name || busy) return false;
    setBusy(true);
    try {
      const ur = await fetch(`${API_URL}/api/users/username/${encodeURIComponent(name)}`);
      const ud = await ur.json().catch(() => null);
      const targetId = ud?.data?.id ? String(ud.data.id) : "";
      if (!targetId) {
        toast(`No one here is called ${name}.`, "error");
        return false;
      }
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/invites`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ userId: targetId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "Couldn't send that invite.", "error");
        return false;
      }
      toast(`Invite sent to ${ud?.data?.username || name}.`, "success");
      loadInvites();
      return true;
    } catch {
      toast("Couldn't reach the server.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = (inv: GuildInvite) => {
    if (busy) return;
    askConfirm({
      title: `Revoke the invite to ${inv.username || "this player"}?`,
      body: "They lose the way in until someone invites them again.",
      confirmLabel: "Revoke",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const r = await fetch(
            `${API_URL}/api/guilds/${encodeURIComponent(id)}/invites/${encodeURIComponent(inv.id)}`,
            { method: "DELETE", headers: authHeaders() },
          );
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.success) return toast(d?.message || "Couldn't revoke that invite.", "error");
          setInvites((prev) => prev.filter((x) => x.id !== inv.id));
          toast("Invite revoked.", "success");
        } catch {
          toast("Couldn't reach the server.", "error");
        } finally {
          setBusy(false);
        }
      },
    });
  };

  /* ── THE TREASURY — one way in from a member's own shards, and one way out:
     the guild purchases. Nothing here ever pays shards back to a person. ── */

  const donate = async (amount: number): Promise<boolean> => {
    const shards = Math.floor(Number(amount) || 0);
    if (shards <= 0 || busy) return false;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/donate`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ shards }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "Couldn't donate that.", "error");
        return false;
      }
      // ONE WAY. Those shards belong to the guild from here on — there is no
      // withdraw endpoint and there never will be.
      if (d.data?.members) setGuild(d.data); else load();
      toast(`${nf(shards)} shards donated — they're the guild's now.`, "success");
      return true;
    } catch {
      toast("Couldn't reach the server.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const purchase = (item: "roles" | "xpBoost" | "slots") => {
    if (!guild || busy) return;
    const price = item === "roles" ? GUILD_PRICES.ROLES_UNLOCK
      : item === "xpBoost" ? GUILD_PRICES.XP_BOOST
      : GUILD_PRICES.MEMBER_SLOTS;
    const title = item === "roles" ? "Unlock custom roles?"
      : item === "xpBoost" ? `Buy a ${BOOST_DAYS}-day XP boost?`
      : `Buy ${SLOTS_PER_PURCHASE} member slots?`;
    const what = item === "roles"
      ? "Custom roles stay unlocked forever — a one-time spend."
      : item === "xpBoost"
      ? (guild.xpBoostActive
        ? `The running boost is extended by ${BOOST_DAYS} more days.`
        : `For ${BOOST_DAYS} days the guild keeps 1.25x of what members feed it. Their own XP is untouched.`)
      : `The cap rises by ${SLOTS_PER_PURCHASE}, up to the hard ceiling of ${MAX_MEMBER_CAP} members.`;
    askConfirm({
      title,
      body: `${what} ${nf(price)} shards leave the treasury — treasury shards only ever buy guild upgrades, they can never be paid back out to anyone.`,
      confirmLabel: `Spend ${nf(price)}`,
      onConfirm: async () => {
        setBusy(true);
        try {
          const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/purchase`, {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify({ item }),
          });
          const d = await r.json().catch(() => null);
          // The server debits with a compare-and-set, so a short treasury (or
          // a guild already at the 100 cap) answers here instead of going
          // negative or eating the shards.
          if (!r.ok || !d?.success) return toast(d?.message || "The treasury couldn't cover that.", "error");
          if (d.data?.members) setGuild(d.data); else load();
          toast(
            item === "roles" ? "Custom roles unlocked."
              : item === "xpBoost" ? `XP boost running for ${BOOST_DAYS} days.`
              : `Member cap raised by ${SLOTS_PER_PURCHASE}.`,
            "success",
          );
        } catch {
          toast("Couldn't reach the server.", "error");
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const disband = () => {
    if (!guild || busy) return;
    askConfirm({
      title: `Delete ${guild.name}?`,
      body: `Every member is removed, the chat and its history go, active card loans end, and the treasury's ${nf(guild.shards)} shards are burned — nothing is refunded to anyone. The name and the [${guild.tag}] tag are freed. This can't be undone.`,
      confirmLabel: "Delete guild",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}`, {
            method: "DELETE", headers: authHeaders(),
          });
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.success) return toast(d?.message || "Couldn't delete the guild.", "error");
          cacheGuildId(null);
          toast("The guild is gone.", "success");
          router.push("/guilds");
        } catch {
          toast("Couldn't reach the server.", "error");
        } finally {
          setBusy(false);
        }
      },
    });
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

  /* ── CUSTOM EMOJI — the other guild-level unlock the officers curate.
     The catalog itself lives in the module cache in @/lib/guildEmoji, shared
     with the chat room and the composer's picker. NOTHING polls it, so every
     write here ends in invalidateGuildEmojis() — that call, and only that
     call, is what makes a new emoji appear without a reload. ── */

  const addEmoji = async (
    payload: { name: string; url: string; animated: boolean },
  ): Promise<string | null> => {
    if (!guild || busy) return "Try that again in a moment.";
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}/emojis`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        // What a real person actually hits: 409 for BOTH a full slot list and
        // a name already taken, 400 for a refused name or host. The
        // SERVER'S OWN WORDS go straight through — a generic "couldn't save"
        // would hide which of the three it was, and they need different fixes.
        const message = d?.message || "Couldn't add that emoji.";
        toast(message, "error");
        return message;
      }
      invalidateGuildEmojis(guild.id);
      toast(`:${payload.name}: is ready to type.`, "success");
      return null;
    } catch {
      const message = "Couldn't reach the server.";
      toast(message, "error");
      return message;
    } finally {
      setBusy(false);
    }
  };

  const deleteEmoji = (emoji: GuildEmoji) => {
    if (!guild || busy) return;
    askConfirm({
      title: `Delete :${emoji.name}:?`,
      body: `The slot comes back straight away, but every message that already uses it will read as the plain text :${emoji.name}: from now on. This can't be undone.`,
      confirmLabel: "Delete emoji",
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const r = await fetch(
            `${API_URL}/api/guilds/${encodeURIComponent(id)}/emojis/${encodeURIComponent(emoji.id)}`,
            { method: "DELETE", headers: authHeaders() },
          );
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.success) return toast(d?.message || "Couldn't delete that emoji.", "error");
          invalidateGuildEmojis(guild.id);
          toast(`:${emoji.name}: is gone.`, "success");
        } catch {
          toast("Couldn't reach the server.", "error");
        } finally {
          setBusy(false);
        }
      },
    });
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
                  320px rail (boss, XP, contributor, statistics, roles,
                  management, information) rides beside it. Below lg the rail
                  drops UNDER the left column, which puts a phone's order at
                  hero → stats → members → boss → XP → the rest. Everything
                  under this row stays the single stacked column. */}
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
              {/* Left column: EVERYTHING except the rail — hero, stat tiles,
                  level bar, members, roles, lending and the chat. The rail
                  outgrew the old left column (it carries boss, XP, top
                  contributor, statistics, roles-lock, management and info),
                  so sections that waited below the whole grid left a tall
                  hollow gap beside it. Running them inside the column closes
                  it and keeps the rail's cards level with real content. */}
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
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="font-fell text-4xl leading-tight text-white sm:text-5xl">{guild.name}</h1>
                        <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs font-black tracking-[0.2em] text-emerald-300">
                          [{guild.tag}]
                        </span>
                        {/* The door's own sign — public halls take anyone over
                            the minimum level; private ones need an invite. */}
                        {isPublic ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-300">
                            <Globe className="h-3 w-3" /> Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                            <Lock className="h-3 w-3" /> Invite only
                          </span>
                        )}
                      </div>
                      {guild.description ? (
                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{guild.description}</p>
                      ) : (
                        <p className="mt-3 text-sm italic text-slate-600">No words over the door yet.</p>
                      )}

                      {/* The counts moved down into the stat grid; these chips
                          carry only what the grid can't say. */}
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        {guild.xpBoostActive && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
                            <Zap className="h-3 w-3" /> XP boost · until {dateLabel(guild.xpBoostUntil)}
                          </span>
                        )}
                        {minLevel > 1 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                            <Sparkles className="h-3 w-3" /> Level {minLevel}+ to join
                          </span>
                        )}
                        {guild.stats && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                            <Activity className="h-3 w-3" /> {nf(guild.stats.activeCount)} recently active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* THE DOOR — wraps rather than overflowing at 360px, and
                      every control clears 44px of touch height. */}
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    {!isMember && myInvite && (
                      <>
                        <button type="button" disabled={busy} onClick={acceptInvite}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                          <Check className="h-4 w-4" /> {busy ? "Joining…" : "Accept invite"}
                        </button>
                        <button type="button" disabled={busy} onClick={declineInvite}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.1] disabled:opacity-40">
                          Decline
                        </button>
                      </>
                    )}
                    {!isMember && !myInvite && (
                      <button type="button"
                        disabled={busy || !isPublic || guild.memberCount >= guild.memberCap}
                        onClick={join}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                        <Users className="h-4 w-4" />
                        {!isPublic ? "Invite only"
                          : guild.memberCount >= guild.memberCap ? "Guild is full"
                          : busy ? "Joining…" : "Join this guild"}
                      </button>
                    )}
                    {isMember && isOfficer && (
                      <button type="button" onClick={() => setInviteOpen(true)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-sky-200 transition hover:bg-sky-500/20">
                        <UserPlus className="h-3.5 w-3.5" /> Invite
                      </button>
                    )}
                    {isMember && (
                      <button type="button" onClick={() => setDonateOpen(true)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-500/20">
                        <Gem className="h-3.5 w-3.5" /> Donate shards
                      </button>
                    )}
                    {isMember && myPerms.editGuild && (
                      <button type="button" onClick={() => setEditOpen(true)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.1]">
                        <Pencil className="h-3.5 w-3.5" /> Edit guild
                      </button>
                    )}
                    {isMember && (
                      <button type="button" disabled={busy} onClick={leave}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                        Leave
                      </button>
                    )}
                  </div>
                  {!isMember && !isPublic && !myInvite && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      This guild is invite-only — an officer has to send you an invitation.
                    </p>
                  )}
                  {!isMember && isPublic && minLevel > 1 && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      Level {minLevel} and up may join.
                    </p>
                  )}
                  {isLeader && guild.memberCount > 1 && (
                    <p className="mt-2 text-[10px] text-slate-600">
                      A leader leaves last — transfer leadership below before leaving.
                    </p>
                  )}
                </div>
              </div>

              {/* ── THE STAT GRID + LEVEL PROGRESS — 2x2 at 360px ── */}
              <StatGrid guild={guild} />
              <LevelProgress guild={guild} />

              {/* ── MEMBERS ── */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-emerald-300" />
                  <p className="text-sm font-black text-white">Members</p>
                  <span className="text-[10px] font-bold tabular-nums text-slate-600">{guild.memberCount}/{guild.memberCap}</span>
                  <span className="text-[10px] text-slate-600">· sorted by XP contributed</span>
                </div>
                <div className="mt-4 space-y-2">
                  {sortedMembers.map((m) => {
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
                          {/* Contribution, then our ONLY activity signal: the
                              server saw their user row written inside the last
                              10 minutes. It says "Active", never "Online" —
                              there is no presence system behind it. */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.activeRecently ? "bg-emerald-400" : "bg-slate-600"}`} />
                              <span className={m.activeRecently ? "font-black text-emerald-300" : "text-slate-500"}>
                                {m.activeRecently ? "Active" : "Offline"}
                              </span>
                            </span>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums text-slate-500">{nf(m.xpContributed ?? 0)} XP contributed</span>
                            <span aria-hidden>·</span>
                            <span>joined {ago(m.joinedAt)}</span>
                          </div>
                        </div>
                        {!me && (isOfficer || canKickThis) && (
                          // w-full on a phone: a leader's four controls at
                          // max-content would push the row wider than 360px,
                          // so they take their own line and wrap inside it.
                          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:shrink-0">
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

              {/* ── ROLES & PERMISSIONS — Discord-style, officer-managed.
                  The section only exists once the treasury has bought the
                  feature; while it's locked the rail carries the pitch. ── */}
              {rolesUnlocked && (
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
              )}

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

              {/* ── THE GUILD CHAT — shared with the dock's slide-over panel.
                     No className, so the hall keeps its own card chrome; the
                     HEIGHT, though, is the hall's business and not the room's.

                     The old fixed 28rem read as a letterbox on a desktop hall,
                     so the room is viewport-relative now, with both ends
                     nailed down: 62vh on a 900px screen is ~560px of chat and
                     the 48rem ceiling stops a tall monitor turning it into a
                     corridor, while the 30rem floor keeps a short laptop
                     honest.

                     Below sm it is deliberately SMALLER (52vh, floor 20rem,
                     ceiling 34rem): at 360x640 that is ~333px of room, which
                     leaves the composer, the emoji/GIF row and the counter all
                     on screen together instead of pushing them under the fold.

                     vh, not dvh, on purpose — dvh re-measures every time a
                     phone's URL bar slides, and resizing a SCROLLER mid-scroll
                     fights the room's own stick-to-bottom test.

                     The dock passes its own `min-h-0 flex-1` and is untouched
                     by any of this. ── */}
              <GuildChatRoom key={guild.id} guildId={guild.id} guild={guild} isMember={isMember}
                canModerate={myPerms.moderateChat} askConfirm={askConfirm}
                heightClass="h-[52vh] min-h-[20rem] max-h-[34rem] sm:h-[62vh] sm:min-h-[30rem] sm:max-h-[48rem]" />
              </div>

              <GuildSideRail
                guild={guild}
                isMember={isMember}
                isLeader={isLeader}
                isOfficer={isOfficer}
                busy={busy}
                onOpenInvites={() => setInviteOpen(true)}
                onNewRole={() => setRoleSheet({ role: null })}
                onPurchase={purchase}
                onDisband={disband}
                canManageEmoji={myPerms.editGuild}
                onAddEmoji={() => setEmojiOpen(true)}
                onDeleteEmoji={deleteEmoji}
              />
              </div>
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

        {inviteOpen && guild && (
          <InviteSheet
            guild={guild}
            invites={invites}
            loaded={invitesLoaded}
            busy={busy}
            onClose={() => setInviteOpen(false)}
            onInvite={sendInvite}
            onRevoke={revokeInvite}
          />
        )}

        {donateOpen && guild && (
          <DonateSheet
            guild={guild}
            busy={busy}
            onClose={() => setDonateOpen(false)}
            onDonate={donate}
          />
        )}

        {emojiOpen && guild && (
          <EmojiSheet
            guild={guild}
            busy={busy}
            onClose={() => setEmojiOpen(false)}
            onAdd={addEmoji}
          />
        )}

        {confirmSpec && (
          <GuildConfirm spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
        )}
      </div>
    </PageTransition>
  );
}

/* ═══════════ THE STAT GRID — four tiles under the hero ═══════════
   2x2 at 360px, one row from sm up. Every number is the API's; the tiles
   only format. Long values truncate rather than pushing the grid wide. */

const TILE_TONES: Record<string, { ring: string; text: string }> = {
  emerald: { ring: "border-emerald-400/25 bg-emerald-500/[0.06]", text: "text-emerald-300" },
  cyan: { ring: "border-cyan-400/25 bg-cyan-500/[0.06]", text: "text-cyan-300" },
  violet: { ring: "border-violet-400/25 bg-violet-500/[0.06]", text: "text-violet-300" },
  amber: { ring: "border-amber-400/25 bg-amber-500/[0.06]", text: "text-amber-300" },
  slate: { ring: "border-white/10 bg-white/[0.03]", text: "text-slate-300" },
};

function StatTile({ icon, label, value, sub, tone = "slate" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof TILE_TONES | string;
}) {
  const t = TILE_TONES[tone] || TILE_TONES.slate;
  return (
    <div className={`min-w-0 rounded-2xl border p-3.5 sm:p-4 ${t.ring}`}>
      <div className={`flex items-center gap-1.5 ${t.text}`}>
        <span className="shrink-0">{icon}</span>
        <p className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-1.5 truncate font-fell text-2xl leading-none text-white">{value}</p>
      {sub && <p className="mt-1 truncate text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function StatGrid({ guild }: { guild: GuildDetail }) {
  const lv = levelView(guild);
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Guild level"
        value={`Level ${lv.level}`}
        sub={lv.isMax ? "Maxed out" : `of ${lv.maxLevel}`}
        tone="emerald"
      />
      <StatTile
        icon={<Users className="h-3.5 w-3.5" />}
        label="Members"
        value={`${nf(guild.memberCount)} / ${nf(guild.memberCap)}`}
        sub={(guild.purchasedSlots ?? 0) > 0 ? `+${nf(guild.purchasedSlots)} bought` : "cap grows with level"}
        tone="slate"
      />
      <StatTile
        icon={<Zap className="h-3.5 w-3.5" />}
        label="Total XP"
        value={nf(lv.xp)}
        sub={guild.xpBoostActive ? "1.25x boost running" : "half of what members earn"}
        tone="violet"
      />
      <StatTile
        icon={<Gem className="h-3.5 w-3.5" />}
        label="Treasury"
        value={nf(guild.shards)}
        sub="shards · guild-only"
        tone="cyan"
      />
    </div>
  );
}

/* ═══════════ LEVEL PROGRESS — the API's block, drawn ═══════════
   At level 100 the bar is full and the copy reads MAX; there is no path
   here that can print a negative "to next level". */

function LevelProgress({ guild }: { guild: GuildDetail }) {
  const lv = levelView(guild);
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-[#0b0b11] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Level progress</p>
        <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black tabular-nums tracking-[0.14em] text-emerald-200">
          {lv.isMax ? "MAX" : `${Math.round(lv.pct)}%`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-mono text-sm font-black tabular-nums text-white">
          {lv.isMax ? `${nf(lv.xp)} XP` : `${nf(lv.intoLevel)} / ${nf(lv.nextCost)} XP`}
        </p>
        <p className="font-mono text-[11px] tabular-nums text-slate-500">
          {lv.isMax
            ? `Level ${lv.maxLevel} — the ladder ends here`
            : `${nf(lv.toNext)} XP to level ${lv.level + 1}`}
        </p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${lv.isMax ? "bg-amber-300" : "bg-emerald-400"}`}
          style={{ width: `${lv.pct}%` }}
        />
      </div>
    </div>
  );
}

/* ═══════════ THE RIGHT RAIL ═══════════
   Beside the hero on lg, stacked under the LEFT COLUMN below it — which
   puts the order on a phone at: hero, stats, members, then boss → XP →
   contributor → statistics → roles → management → information. The chrome is
   slightly translucent so it sits on the full-screen banner without
   backdrop-filter (banned on large elements). The boss card is fed by the
   public raid snapshot and simply doesn't render when that fetch fails;
   everything else reads the already-loaded guild detail — no extra request. */

function GuildSideRail({
  guild, isMember, isLeader, isOfficer, busy,
  onOpenInvites, onNewRole, onPurchase, onDisband,
  canManageEmoji, onAddEmoji, onDeleteEmoji,
}: {
  guild: GuildDetail;
  isMember: boolean;
  isLeader: boolean;
  isOfficer: boolean;
  busy: boolean;
  onOpenInvites: () => void;
  onNewRole: () => void;
  onPurchase: (item: "roles" | "xpBoost" | "slots") => void;
  onDisband: () => void;
  /** Officer, or a custom role carrying editGuild — the page computes it once. */
  canManageEmoji: boolean;
  onAddEmoji: () => void;
  onDeleteEmoji: (emoji: GuildEmoji) => void;
}) {
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

  // The level ladder, straight from the API (see levelView) — no client math.
  const lv = levelView(guild);
  const stats = guild.stats || null;
  const top = stats?.topContributor || null;
  const treasury = Math.max(0, guild.shards ?? 0);
  const rolesUnlocked = guild.rolesUnlocked !== false;
  const roleCount = (guild.roles || []).length;
  const atMemberCeiling = (guild.memberCap ?? 0) >= MAX_MEMBER_CAP;
  const canAffordRoles = treasury >= GUILD_PRICES.ROLES_UNLOCK;
  const canAffordBoost = treasury >= GUILD_PRICES.XP_BOOST;
  const canAffordSlots = treasury >= GUILD_PRICES.MEMBER_SLOTS;

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

      {/* ── GUILD XP — the same server block the hero's bar draws ── */}
      <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/85 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Guild XP</p>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-fell text-3xl leading-none text-white">Level {lv.level}</p>
          <p className="font-mono text-[11px] tabular-nums text-slate-400">{nf(lv.xp)} XP</p>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${lv.isMax ? "bg-amber-300" : "bg-emerald-400"}`}
            style={{ width: `${lv.pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] tabular-nums text-slate-500">
          {lv.isMax
            ? `MAX · level ${lv.maxLevel}`
            : `${nf(lv.toNext)} XP to Lv ${lv.level + 1} · ${nf(lv.intoLevel)}/${nf(lv.nextCost)}`}
        </p>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          Members feed the guild half of every XP they earn anywhere on the site, and the treasury takes
          1 shard per 5 of that XP. Raids pay on top — +25 XP per attack, +500 per kill.
        </p>
        {guild.xpBoostActive && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-violet-200">
            <Zap className="h-3 w-3" /> 1.25x until {dateLabel(guild.xpBoostUntil)}
          </p>
        )}
      </div>

      {/* ── TOP CONTRIBUTOR — hidden entirely when the API sends null ── */}
      {top && (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-500/[0.06] p-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/80">Top contributor</p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {top.avatar ? (
              <img src={top.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-amber-400/40" />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-900/60 text-sm font-black text-amber-100 ring-1 ring-amber-400/30">
                {(top.username || "?")[0]?.toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <UserLink username={top.username} className="block truncate text-sm font-black text-white hover:underline">
                {top.username}
              </UserLink>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-amber-200">
                {nf(top.xpContributed)} XP contributed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── GUILD STATISTICS ── */}
      {stats && (
        <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/85 p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Guild statistics</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3">
              <p className="font-fell text-2xl leading-none text-white">{nf(stats.onlineRate)}%</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Active rate</p>
              <p className="mt-1 truncate text-[10px] text-slate-500">
                {nf(stats.activeCount)} of {nf(stats.memberCount)}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="font-fell text-2xl leading-none text-white">{nf(stats.avgXp)}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Avg XP</p>
              <p className="mt-1 truncate text-[10px] text-slate-500">per member</p>
            </div>
          </div>
          {/* Say what the number IS. We have no presence system — this is a
              last-write recency window, and the copy must not imply more. */}
          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
            &ldquo;Active&rdquo; means seen doing something in the last {ACTIVE_WINDOW_MINUTES} minutes — we don&rsquo;t
            track live presence.
          </p>
        </div>
      )}

      {/* ── CUSTOM ROLES — locked pitch, or the unlocked summary ── */}
      <div className={`rounded-3xl border p-5 ${rolesUnlocked ? "border-white/10 bg-[#0b0b11]/85" : "border-amber-400/20 bg-[#0b0b11]/85"}`}>
        <div className="flex items-center gap-2">
          {rolesUnlocked ? (
            <Shield className="h-4 w-4 shrink-0 text-emerald-300" />
          ) : (
            <Lock className="h-4 w-4 shrink-0 text-amber-300" />
          )}
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Custom roles</p>
        </div>

        {rolesUnlocked ? (
          <>
            <p className="mt-3 font-fell text-2xl leading-none text-white">
              {nf(roleCount)} <span className="text-base text-slate-500">/ {MAX_ROLES}</span>
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              Unlocked for good. Create and hand them out in the Roles section further down the hall.
            </p>
            {isOfficer && roleCount < MAX_ROLES && (
              <button type="button" onClick={onNewRole}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                <Plus className="h-3.5 w-3.5" /> New role
              </button>
            )}
          </>
        ) : (
          <>
            <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
              <Lock className="h-6 w-6 text-slate-600" />
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Unlock custom roles to create up to {MAX_ROLES} roles with custom permissions.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-black tabular-nums text-amber-200">
                <Gem className="h-3 w-3" /> {nf(GUILD_PRICES.ROLES_UNLOCK)} shards
              </p>
              <p className="mt-2 text-[10px] text-slate-600">Paid from the guild treasury.</p>
            </div>
            {isLeader && (
              <>
                <button type="button" disabled={busy || !canAffordRoles}
                  onClick={() => onPurchase("roles")}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                  <Lock className="h-3.5 w-3.5" /> Unlock ({nf(GUILD_PRICES.ROLES_UNLOCK)})
                </button>
                {!canAffordRoles && (
                  <p className="mt-2 text-center text-[10px] text-red-300">Not enough shards in the treasury.</p>
                )}
              </>
            )}
            {!isLeader && (
              <p className="mt-3 text-center text-[10px] text-slate-600">Only the leader can spend the treasury.</p>
            )}
          </>
        )}
      </div>

      {/* ── GUILD EMOJI — the other guild-level unlock, so it sits beside the
          roles card. MEMBERS ONLY: the catalog read is members-only server
          side, and an outsider has nowhere to type a :shortcode: anyway. ── */}
      {isMember && (
        <GuildEmojiCard
          guild={guild}
          canManage={canManageEmoji}
          busy={busy}
          onAdd={onAddEmoji}
          onDelete={onDeleteEmoji}
        />
      )}

      {/* ── GUILD MANAGEMENT — leader only. Every debit here is one-way: the
          treasury pays out to the guild, never back to a person. ── */}
      {isLeader && (
        <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/85 p-5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Guild management</p>
          </div>

          <button type="button" onClick={onOpenInvites}
            className="mt-3 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left transition hover:bg-white/[0.08]">
            <span className="flex min-w-0 items-center gap-2">
              <UserPlus className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-slate-200">
                Pending invitations
              </span>
            </span>
            <span className="shrink-0 text-[10px] font-black tabular-nums text-slate-500">Open</span>
          </button>

          <button type="button" disabled={busy || !canAffordBoost}
            onClick={() => onPurchase("xpBoost")}
            className="mt-2 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-left transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40">
            <span className="flex min-w-0 items-center gap-2">
              <Zap className="h-3.5 w-3.5 shrink-0 text-violet-300" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-black uppercase tracking-[0.16em] text-violet-100">
                  {guild.xpBoostActive ? `Extend XP boost (+${BOOST_DAYS}d)` : `Buy XP boost (${BOOST_DAYS}d)`}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                  {guild.xpBoostActive ? `Active until ${dateLabel(guild.xpBoostUntil)}` : "1.25x of what members feed the guild"}
                </span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-[10px] font-black tabular-nums text-violet-200">
              {nf(GUILD_PRICES.XP_BOOST)}
            </span>
          </button>

          <button type="button" disabled={busy || !canAffordSlots || atMemberCeiling}
            onClick={() => onPurchase("slots")}
            className="mt-2 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-left transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40">
            <span className="flex min-w-0 items-center gap-2">
              <Users className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100">
                  Buy member slots (+{SLOTS_PER_PURCHASE})
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                  {atMemberCeiling ? `Already at the ${MAX_MEMBER_CAP} ceiling` : `Cap ${nf(guild.memberCap)} · ceiling ${MAX_MEMBER_CAP}`}
                </span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-[10px] font-black tabular-nums text-emerald-200">
              {nf(GUILD_PRICES.MEMBER_SLOTS)}
            </span>
          </button>

          {(!canAffordBoost || !canAffordSlots) && (
            <p className="mt-2 text-[10px] text-slate-600">
              Treasury: {nf(treasury)} shards. Members can donate to top it up — donations are one-way.
            </p>
          )}

          <button type="button" disabled={busy} onClick={onDisband}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" /> Delete guild
          </button>
          <p className="mt-1.5 text-center text-[10px] text-slate-600">
            Members, chat, loans and the treasury go with it.
          </p>
        </div>
      )}

      {/* ── GUILD INFORMATION ── */}
      <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/85 p-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Guild information</p>
        </div>
        <dl className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Created</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-slate-300">{dateLabel(guild.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Type</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-slate-300">
              {guild.isPublic === false ? "Private · invite only" : "Public"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Min level</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] tabular-nums text-slate-300">
              Level {Math.max(1, Math.round(guild.minLevel ?? 1))}
            </dd>
          </div>
        </dl>
        {isMember && (
          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
            Treasury shards are the guild&rsquo;s alone — they buy the upgrades above and can never be paid
            back out to a member.
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════ GUILD EMOJI — the rail card ═══════════
   The catalog comes from the module cache in @/lib/guildEmoji, so this card,
   the chat room and the composer's picker all read ONE fetch per guild per
   session — mounting this costs nothing extra.

   The meter is for DRAWING only. The server recomputes the slot ceiling on
   every upload and is the wall; these numbers exist so the card can say
   "3 / 11" and name the level reward without a round trip. */

function GuildEmojiCard({ guild, canManage, busy, onAdd, onDelete }: {
  guild: GuildDetail;
  canManage: boolean;
  busy: boolean;
  onAdd: () => void;
  onDelete: (emoji: GuildEmoji) => void;
}) {
  const catalog = useGuildEmojis(guild.id);

  // The mirrored curve fills the total in before the catalog lands (and if the
  // read fails outright), so a level-40 guild never flashes the level-1 five.
  const levelTotal = emojiSlots(guild.level ?? 1);
  const total = Math.max(1, levelTotal, Math.round(catalog.slots?.total ?? 0));
  // A row the catalog DROPPED — a name or a host it refuses to point a hundred
  // chat lines at — still costs the guild its slot server-side, so the meter
  // trusts whichever count is larger rather than quietly under-reporting.
  const used = Math.min(total, Math.max(catalog.emojis.length, Math.round(catalog.slots?.used ?? 0)));
  const pct = Math.max(0, Math.min(100, (used / total) * 100));
  const full = used >= total;
  // Where the curve tops out, derived — never a literal that can drift.
  const cappedAtLevel = (EMOJI_SLOTS_MAX - EMOJI_SLOTS_BASE) * EMOJI_LEVELS_PER_SLOT;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/85 p-5">
      <div className="flex items-center gap-2">
        <Smile className="h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Guild emoji</p>
      </div>

      <p className="mt-3 font-fell text-2xl leading-none text-white">
        {nf(used)} <span className="text-base text-slate-500">/ {nf(total)}</span>
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${full ? "bg-amber-300" : "bg-emerald-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Say the reward out loud — nobody levels a guild for a number they
          were never told about. */}
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
        Slots are a level reward: {EMOJI_SLOTS_BASE} at level 1, +1 every {EMOJI_LEVELS_PER_SLOT} levels,
        {" "}{EMOJI_SLOTS_MAX} by level {cappedAtLevel}.
      </p>

      {catalog.emojis.length === 0 ? (
        <p className="mt-4 py-5 text-center text-xs leading-relaxed text-slate-600">
          {canManage
            ? "No emoji yet — add the first one and the whole guild can type it."
            : "No emoji yet. An officer can add some."}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {catalog.emojis.map((e) => (
            <div key={e.id} className="relative w-16 min-w-0">
              <div className="grid h-12 w-16 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                <img
                  src={e.url}
                  alt={`:${e.name}:`}
                  title={`:${e.name}:`}
                  loading="lazy"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <p className="mt-1 truncate text-center font-mono text-[9px] text-slate-500" title={`:${e.name}:`}>
                :{e.name}:
              </p>
              {canManage && (
                <button type="button" disabled={busy} onClick={() => onDelete(e)}
                  aria-label={`Delete :${e.name}:`} title={`Delete :${e.name}:`}
                  className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full border border-red-400/40 bg-[#0b0b11] text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {catalog.emojis.length > 0 && (
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          Type <span className="font-mono font-black text-slate-400">:{catalog.emojis[0].name}:</span> in the guild
          chat — every member can use them, and they only work in here.
        </p>
      )}

      {canManage && (
        <>
          <button type="button" disabled={busy || full} onClick={onAdd}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> {full ? "Slots full" : "Add emoji"}
          </button>
          {full && (
            <p className="mt-2 text-center text-[10px] text-slate-600">
              Delete one to make room, or level the guild up for another slot.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════ THE EMOJI SHEET — a picture, a name, a slot ═══════════
   A bottom sheet on phones, a centred card from sm up, same as every other
   sheet in the hall. The image goes to Cloudinary through the SAME uploader
   the crest and the banner use; only the returned secure_url reaches our
   backend, which accepts that host and no other. */

function EmojiSheet({ guild, busy, onClose, onAdd }: {
  guild: GuildDetail;
  busy: boolean;
  onClose: () => void;
  onAdd: (payload: { name: string; url: string; animated: boolean }) => Promise<string | null>;
}) {
  const { toast } = useToast();
  const catalog = useGuildEmojis(guild.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  // The server's own words, kept on screen. The toast says the same thing and
  // then leaves; a form needs the reason to still be there while you fix it.
  const [error, setError] = useState<string | null>(null);

  // The lib normalises and validates — this sheet never restates either rule.
  const clean = normalizeEmojiName(name);
  const nameOk = isValidEmojiName(clean);
  const duplicate = !!clean && !!catalog.byName[clean];
  // Same reading as the rail card, and the same disclaimer: this warns, it
  // does not decide. The server re-counts on every POST and answers 402.
  const slotTotal = Math.max(1, emojiSlots(guild.level ?? 1), Math.round(catalog.slots?.total ?? 0));
  const slotsFull = Math.max(catalog.emojis.length, Math.round(catalog.slots?.used ?? 0)) >= slotTotal;
  const ready = !!url && nameOk && !duplicate && !uploading && !busy;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > EMOJI_MAX_BYTES) {
      setError(EMOJI_TOO_BIG);
      toast(EMOJI_TOO_BIG, "error");
      return;
    }
    // GIF and WebP carry the frames; the flag is a HINT the server stores so
    // the render path knows whether this one moves.
    const kind = (file.type || "").toLowerCase();
    const moves = kind === "image/gif" || kind === "image/webp" || /\.(gif|webp)$/i.test(file.name || "");
    setUploading(true);
    const secureUrl = await uploadToCloudinary(file, {
      maxBytes: EMOJI_MAX_BYTES,
      tooLarge: EMOJI_TOO_BIG,
      toast,
    });
    setUploading(false);
    if (!secureUrl) return;
    setUrl(secureUrl);
    setAnimated(moves);
  };

  const submit = async () => {
    if (!ready || !url) return;
    setError(null);
    const message = await onAdd({ name: clean, url, animated });
    if (message) return setError(message);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Add a guild emoji"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-fell text-lg text-white">Add an emoji</p>
            <p className="text-[11px] text-slate-500">
              A picture and a name — anyone in {guild.name} can then type it in the guild chat
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {slotsFull && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-3.5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">Slots look full</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-100/80">
                {nf(catalog.emojis.length)} of {nf(slotTotal)} used. Delete one, or level the guild up — the
                server has the final say either way.
              </p>
            </div>
          )}

          {/* THE PREVIEW — the image and the shortcode side by side, exactly
              as a chat line will read it. */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            {url ? (
              <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-white/15 text-slate-600">
                <Smile className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-black text-white">
                {clean ? `:${clean}:` : ":name:"}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                {!url ? "No image yet" : animated ? "Animated — it will move in chat" : "Still image"}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-white">The image</label>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
              PNG, JPG, GIF or WebP, up to {EMOJI_MAX_MB}MB. Animated GIFs and WebPs keep their frames. Square
              art around 128px reads best on a chat line.
            </p>
            <button type="button" disabled={uploading || busy} onClick={() => fileRef.current?.click()}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-200 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50">
              {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : url ? "Choose a different image" : "Choose an image"}
            </button>
            <input ref={fileRef} type="file" accept={EMOJI_ACCEPT} onChange={pick} className="hidden" />
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label htmlFor="guild-emoji-name" className="text-xs font-black text-white">The name</label>
              <span className="text-[10px] tabular-nums text-slate-600">{clean.length}/{EMOJI_NAME_MAX}</span>
            </div>
            <input
              id="guild-emoji-name"
              value={name}
              maxLength={EMOJI_NAME_MAX}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setName(normalizeEmojiName(e.target.value).slice(0, EMOJI_NAME_MAX))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="party_slime"
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
              Lowercase letters, numbers and underscores, {EMOJI_NAME_MIN}–{EMOJI_NAME_MAX} characters — no
              spaces, no colons. Typed in chat as <span className="font-mono text-slate-400">:name:</span>, and
              that is exactly what it reads as anywhere the picture can&rsquo;t load.
            </p>
            {clean && !nameOk && (
              <p className="mt-1.5 text-[10px] font-black text-red-300">
                That name won&rsquo;t do — check the rule above.
              </p>
            )}
            {duplicate && (
              <p className="mt-1.5 text-[10px] font-black text-red-300">
                :{clean}: is already taken in this guild.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-3.5">
              <p className="text-[11px] leading-relaxed text-red-200">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Cancel
          </button>
          <button type="button" disabled={!ready} onClick={submit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Add emoji"}
          </button>
        </div>
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

/* ═══════════ THE INVITE SHEET — recruit by name, revoke by row ═══════════
   A bottom sheet on phones, a centred card from sm up. The input takes a
   USERNAME because that's what people know; the page resolves it to an id
   before POSTing, and the server re-checks everything (cap, membership, a
   duplicate invite) on its side. */

function InviteSheet({ guild, invites, loaded, busy, onClose, onInvite, onRevoke }: {
  guild: GuildDetail;
  invites: GuildInvite[];
  loaded: boolean;
  busy: boolean;
  onClose: () => void;
  onInvite: (username: string) => Promise<boolean>;
  onRevoke: (invite: GuildInvite) => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim().replace(/^@/, "");
  const full = guild.memberCount >= guild.memberCap;

  const submit = async () => {
    if (!trimmed || busy) return;
    const ok = await onInvite(trimmed);
    if (ok) setName("");
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Invite a player"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-fell text-lg text-white">Invite a player</p>
            <p className="text-[11px] text-slate-500">
              {guild.isPublic === false
                ? "This guild is invite-only — an invitation is the only way in"
                : "An invitation lets them join even before they find the guild"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <label htmlFor="guild-invite-name" className="text-xs font-black text-white">Username</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id="guild-invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="Their exact username"
                autoComplete="off"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
              />
              <button type="button" disabled={!trimmed || busy || full} onClick={submit}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Invite"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-600">
              {full
                ? `The guild is full at ${nf(guild.memberCap)} — free a seat or buy more slots first.`
                : "Case-sensitive, exactly as they wrote it."}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
              Pending · {invites.length}
            </p>
            {!loaded ? (
              <p className="py-6 text-center text-xs text-slate-600">Reading the outbox…</p>
            ) : invites.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">Nobody is waiting on an answer.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                    {inv.avatar ? (
                      <img src={inv.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-800 text-xs font-black">
                        {(inv.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{inv.username || "Someone"}</p>
                      <p className="text-[10px] text-slate-600">
                        {inv.createdAt ? `invited ${ago(inv.createdAt)}` : "invitation pending"}
                      </p>
                    </div>
                    <button type="button" disabled={busy} onClick={() => onRevoke(inv)}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-40">
                      <X className="h-3 w-3" /> Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ THE DONATE SHEET — shards in, never out ═══════════
   The warning is not decoration: donated shards join the treasury, and the
   treasury only ever spends on guild upgrades. There is no withdraw. */

function DonateSheet({ guild, busy, onClose, onDonate }: {
  guild: GuildDetail;
  busy: boolean;
  onClose: () => void;
  onDonate: (amount: number) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const value = Math.floor(Number(amount) || 0);
  const valid = value > 0;

  const submit = async () => {
    if (!valid || busy) return;
    const ok = await onDonate(value);
    if (ok) { setAmount(""); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Donate shards"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-fell text-lg text-white">Donate shards</p>
            <p className="text-[11px] text-slate-500">Feed {guild.name}&rsquo;s treasury</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">One way only</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-100/80">
              Donated shards become the guild&rsquo;s. They can only ever be spent on guild upgrades — nothing
              pays them back to you, not leaving, not disbanding, not the leader.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label htmlFor="guild-donate-amount" className="text-xs font-black text-white">Amount</label>
              <span className="text-[10px] tabular-nums text-slate-600">Treasury {nf(guild.shards)}</span>
            </div>
            <input
              id="guild-donate-amount"
              value={amount}
              inputMode="numeric"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="250"
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-sm tabular-nums text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 500, 1000, 5000].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(String(v))}
                  className="min-h-[36px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-black tabular-nums text-slate-300 transition hover:bg-white/[0.1] hover:text-white">
                  {nf(v)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-600">
              The server checks your balance — if you&rsquo;re short, nothing moves.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Cancel
          </button>
          <button type="button" disabled={!valid || busy} onClick={submit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            <Gem className="h-3.5 w-3.5" /> {busy ? "Donating…" : valid ? `Donate ${nf(value)}` : "Donate"}
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
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
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

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Cancel
          </button>
          <button type="button" disabled={!nameOk || saving}
            onClick={() => onSave({ name: trimmed, color, permissions: perms })}
            className="min-h-[44px] rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
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
  // Both are set at founding and were unreachable afterwards — a guild that
  // opened private could never open its doors. The backend has accepted them
  // on PATCH all along.
  const [isPublic, setIsPublic] = useState(guild.isPublic !== false);
  const [minLevel, setMinLevel] = useState(String(guild.minLevel ?? 1));

  // The shared `uploadToCloudinary` above does the actual upload — the crest,
  // the banner and the guild emoji all go through it. This wrapper only wires
  // it to a file input and a setter; only the target differs.
  const uploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    apply: (url: string) => void,
    setBusy: (busy: boolean) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const url = await uploadToCloudinary(file, {
      maxBytes: 10 * 1024 * 1024,
      tooLarge: "That image is over 10MB — pick a smaller one.",
      toast,
    });
    setBusy(false);
    if (url) apply(url);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(guild.id)}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          description: desc.trim(),
          avatar: avatar,
          banner: banner || "",
          isPublic,
          // Clamped here too so a blanked field posts 1 rather than NaN; the
          // server clamps 1..MIN_LEVEL_MAX regardless. The ceiling is IMPORTED,
          // never restated — a literal 10 here silently rewrote a guild's bar
          // down to 10 every time a leader saved an unrelated field.
          minLevel: Math.max(
            GUILD_CREATE.MIN_LEVEL_MIN,
            Math.min(GUILD_CREATE.MIN_LEVEL_MAX, Math.floor(Number(minLevel) || 1)),
          ),
        }),
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
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
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

          {/* WHO MAY JOIN — chosen at founding, editable ever after. */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white">Who can join</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition ${
                  isPublic
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                }`}>
                Public
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">Anyone can join freely</span>
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition ${
                  !isPublic
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                }`}>
                Private
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">Invite only</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-white">Minimum level</label>
            <div className="flex items-center gap-2">
              <input type="number" min={GUILD_CREATE.MIN_LEVEL_MIN} max={GUILD_CREATE.MIN_LEVEL_MAX}
                inputMode="numeric" value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40" />
              <span className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[10px] font-black tracking-wider text-amber-200">
                Level {Math.max(
                  GUILD_CREATE.MIN_LEVEL_MIN,
                  Math.min(GUILD_CREATE.MIN_LEVEL_MAX, Math.floor(Number(minLevel) || 1)),
                )}+
              </span>
            </div>
            <p className="text-[10px] text-slate-600">Only members at this level or higher can join.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
            Cancel
          </button>
          <button type="button" disabled={saving || uploading || bannerUploading} onClick={save}
            className="min-h-[44px] rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
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
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
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

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0b0b11] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
