import { authHeaders } from "@/lib/authToken";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * "WHICH GUILD AM I IN?" — answered without a dedicated endpoint.
 *
 * The backend keeps membership in GuildMember (unique userId) but only ever
 * reveals YOURS through GET /api/guilds/:id's `myMembership` — there is no
 * /api/guilds/mine. Rather than fetch every guild's detail to find yourself,
 * this helper answers in tiers, cheapest first:
 *
 *   1. A cached guild id from the last time this device created, joined or
 *      visited its guild — verified against the server, never trusted blind,
 *      so a kick or a disband clears it instead of ghosting a dead chip.
 *   2. The public list: leaders are visible there outright (leaderId).
 *   3. Active loans name their guildId, so anyone lending or borrowing is
 *      found even on a fresh device.
 *
 * The one honest gap: a plain member with no loans on a brand-new device shows
 * as guildless until they open their guild's page once (which caches it).
 * That beats N detail fetches on every raid load.
 */

const CACHE_KEY = "davinci_guild_id";

export type GuildSummary = {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatar: string | null;
  banner: string | null;
  leaderId: string;
  coLeaderId: string | null;
  shards: number;
  xp: number;
  level: number;
  memberCount: number;
  // Sent by the detail route once the joining rules shipped. Optional because
  // an older backend simply omits them and nothing here may crash on that.
  memberCap?: number | null;
  isPublic?: boolean;
  minLevel?: number;
  createdAt?: string | null;
};

/**
 * A row of the browse hall, exactly as `GET /api/guilds` returns it.
 *
 * Everything numeric here is COMPUTED BY THE SERVER and merely rendered by the
 * client: `level` comes from the guild's XP curve and `memberCap` from
 * `min(100, 10 + floor((level-1)*0.8) + purchasedSlots)`. Neither formula is
 * mirrored on this side on purpose — two copies of a levelling curve drift,
 * and the one the player sees must be the one the server enforces.
 */
export type GuildRow = {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatar: string | null;
  banner: string | null;
  level: number;
  xp: number;
  /**
   * The guild TREASURY, in shards (never "coins").
   *
   * A closed loop: the treasury fills from guild XP and from members donating
   * personal shards in, and it empties ONLY into guild purchases. No path
   * moves a treasury shard back into anyone's personal balance, so nothing in
   * this file — or any UI reading it — should ever present it as claimable.
   */
  shards: number;
  memberCount: number;
  /**
   * Seats, server-computed. `null` when the backend omitted it; the UI then
   * shows the member count alone instead of inventing a cap.
   */
  memberCap: number | null;
  isPublic: boolean;
  /** 1..10 — user levels cap at 10 on this site. */
  minLevel: number;
  createdAt: string | null;
  /**
   * NOT part of the browse contract — the list route may omit it entirely.
   * Only the guild detail carries it reliably, so nothing may depend on its
   * presence here. See the note in `findMyGuild`.
   */
  leaderId?: string | null;
};

/** The `meta` block beside the rows. */
export type GuildListMeta = {
  /** Rows matching the current search — what the pager divides. */
  total: number;
  page: number;
  perPage: number;
  /** Guilds on the whole site, search or no search. */
  totalGuilds: number;
  /** Members summed across the rows on this page. */
  membersShown: number;
  highestLevel: number;
};

export type GuildSort = "level" | "members" | "xp" | "new";

export const GUILD_SORTS: ReadonlyArray<{ value: GuildSort; label: string }> = [
  { value: "level", label: "Level" },
  { value: "members", label: "Members" },
  { value: "xp", label: "XP" },
  { value: "new", label: "Newest" },
];

export const GUILD_PER_PAGE = 12;

/**
 * Founding limits, mirrored for the FORM ONLY.
 *
 * The server is the gate for every one of these — the account-age rule, the AP
 * charge, one-guild-per-person, the name and tag uniqueness. These copies exist
 * so a typo can be caught before a round trip, never to decide who may found a
 * guild. When the two disagree, the server wins and its message is shown.
 */
export const GUILD_CREATE = {
  COST_AP: 2000,
  MIN_ACCOUNT_AGE_DAYS: 3,
  NAME_MIN: 3,
  NAME_MAX: 24,
  TAG_MIN: 2,
  TAG_MAX: 5,
  DESC_MAX: 500,
  MIN_LEVEL_MIN: 1,
  MIN_LEVEL_MAX: 10,
} as const;

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

function normalizeRow(raw: any): GuildRow {
  const cap = num(raw?.memberCap, -1);
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? ""),
    tag: String(raw?.tag ?? ""),
    description: String(raw?.description ?? ""),
    avatar: raw?.avatar ?? null,
    banner: raw?.banner ?? null,
    level: num(raw?.level, 1),
    xp: num(raw?.xp),
    shards: num(raw?.shards),
    memberCount: num(raw?.memberCount),
    memberCap: cap > 0 ? cap : null,
    // Absent means public: `isPublic` defaults true server-side, and a guild
    // wrongly drawn as invite-only would turn people away from an open door.
    isPublic: raw?.isPublic !== false,
    minLevel: Math.min(
      GUILD_CREATE.MIN_LEVEL_MAX,
      Math.max(GUILD_CREATE.MIN_LEVEL_MIN, num(raw?.minLevel, 1)),
    ),
    createdAt: raw?.createdAt ? String(raw.createdAt) : null,
    leaderId: raw?.leaderId ?? null,
  };
}

/**
 * Fill in a `meta` block the backend didn't send, from the rows themselves.
 * Derived numbers describe THIS PAGE only, which is exactly what the stat strip
 * claims ("On This Page", "Members Shown") — no site-wide total is invented
 * beyond the rows actually in hand.
 */
function normalizeMeta(raw: any, rows: GuildRow[], page: number, perPage: number): GuildListMeta {
  const membersShown = rows.reduce((sum, g) => sum + g.memberCount, 0);
  const highest = rows.reduce((top, g) => Math.max(top, g.level), 0);
  return {
    total: num(raw?.total, rows.length),
    page: num(raw?.page, page),
    perPage: num(raw?.perPage, perPage),
    totalGuilds: num(raw?.totalGuilds, rows.length),
    membersShown: num(raw?.membersShown, membersShown),
    highestLevel: num(raw?.highestLevel, highest),
  };
}

export type GuildListResult = { rows: GuildRow[]; meta: GuildListMeta };

/** One page of the browse hall. Throws on a failed/garbled response. */
export async function fetchGuilds(opts: {
  search?: string;
  sort?: GuildSort;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
} = {}): Promise<GuildListResult> {
  const page = Math.max(1, Math.floor(opts.page || 1));
  const perPage = Math.max(1, Math.floor(opts.perPage || GUILD_PER_PAGE));

  const qs = new URLSearchParams();
  const search = (opts.search || "").trim();
  if (search) qs.set("search", search);
  if (opts.sort) qs.set("sort", opts.sort);
  qs.set("page", String(page));
  qs.set("perPage", String(perPage));

  const r = await fetch(`${API_URL}/api/guilds?${qs.toString()}`, { signal: opts.signal });
  const d = await r.json();
  if (!d?.success || !Array.isArray(d.data)) {
    throw new Error(d?.message || "Couldn't read the guild registry.");
  }
  const rows = d.data.map(normalizeRow);
  return { rows, meta: normalizeMeta(d.meta, rows, page, perPage) };
}

export function cachedGuildId(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

export function cacheGuildId(id: string | null) {
  try {
    if (id) localStorage.setItem(CACHE_KEY, id);
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable — every lookup just pays the network price */
  }
}

/** The guild detail IF the signed-in viewer is a member of it, else null. */
export async function guildIfMember(id: string): Promise<GuildSummary | null> {
  try {
    const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
    });
    const d = await r.json();
    if (!d?.success || !d.data?.myMembership) return null;
    const g = d.data;
    return {
      id: g.id, name: g.name, tag: g.tag, description: g.description,
      avatar: g.avatar ?? null, banner: g.banner ?? null, leaderId: g.leaderId,
      coLeaderId: g.coLeaderId ?? null, shards: g.shards ?? 0,
      xp: g.xp ?? 0, level: g.level ?? 1, memberCount: g.memberCount ?? 0,
      memberCap: g.memberCap ?? null, isPublic: g.isPublic !== false,
      minLevel: g.minLevel ?? 1, createdAt: g.createdAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function findMyGuild(userId?: string | null): Promise<GuildSummary | null> {
  if (!userId) return null;

  // 1 — the verified cache
  const cached = cachedGuildId();
  if (cached) {
    const g = await guildIfMember(cached);
    if (g) return g;
    cacheGuildId(null); // kicked, left elsewhere, or disbanded
  }

  // 2 — ASK THE SERVER. /of/:userId answers for ANY member (not just leaders)
  // in one request.
  //
  // This used to scan the browse list for a matching leaderId. That tier died
  // the moment the list became paginated and server-capped: it could only ever
  // see the first page, so the leader of a lower-ranked guild came back
  // guildless on any device without a cached id.
  try {
    const r = await fetch(`${API_URL}/api/guilds/of/${encodeURIComponent(userId)}`);
    const d = await r.json();
    const gid = d?.success && d.data?.id ? String(d.data.id) : null;
    if (gid) {
      const g = await guildIfMember(gid);
      if (g) {
        cacheGuildId(g.id);
        return g;
      }
    }
  } catch {
    /* offline — fall through */
  }

  // 3 — an active loan names the guild
  try {
    const r = await fetch(`${API_URL}/api/guilds/mine/loans`, { headers: authHeaders() });
    const d = await r.json();
    const all: any[] = [...(d?.data?.lent || []), ...(d?.data?.borrowed || [])];
    const gid = all.find((l) => l?.guildId)?.guildId;
    if (gid) {
      const g = await guildIfMember(String(gid));
      if (g) {
        cacheGuildId(g.id);
        return g;
      }
    }
  } catch {
    /* offline */
  }

  return null;
}

/** "6d 4h" / "3h" / "12m" until an ISO timestamp — or "expired". */
export function loanTimeLeft(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h`;
  return `${Math.max(1, Math.ceil(ms / 60000))}m`;
}
