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
  leaderId: string;
  coLeaderId: string | null;
  coins: number;
  xp: number;
  level: number;
  memberCount: number;
};

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
      avatar: g.avatar ?? null, leaderId: g.leaderId,
      coLeaderId: g.coLeaderId ?? null, coins: g.coins ?? 0,
      xp: g.xp ?? 0, level: g.level ?? 1, memberCount: g.memberCount ?? 0,
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

  // 2 — leaders are public in the list
  try {
    const r = await fetch(`${API_URL}/api/guilds`);
    const d = await r.json();
    const rows: GuildSummary[] = Array.isArray(d?.data) ? d.data : [];
    const led = rows.find((g) => g.leaderId === userId);
    if (led) {
      cacheGuildId(led.id);
      return led;
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
