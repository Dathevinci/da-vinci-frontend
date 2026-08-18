import { isStampGrade, type StampGrade, type StampMediaType, type StampPodium } from "@/lib/stamps";

/**
 * SITE-WIDE ENDORSEMENTS — last week's top three curators' seals, worn by the
 * titles they recommend, EVERYWHERE those titles appear.
 *
 * THE WHOLE DESIGN RESTS ON ONE NUMBER. A stamp carries at most three active
 * recommendations and exactly three curators wear a podium seal, so the entire
 * site-wide endorsement set is AT MOST NINE TITLES. That is what makes this
 * affordable: it is one tiny payload, fetched ONCE, held in a Map, and read by
 * media id in O(1). It is emphatically NOT a per-card request and NOT a join
 * into any browse query — a grid of forty covers must cost exactly the same
 * number of requests whether nine of them are endorsed or none are.
 *
 * WHY THIS ISN'T swrCache. swrJson() serves a cached copy and then ALWAYS
 * re-fetches, and it has no notion of freshness or of a call already in
 * flight. Both are wrong here: forty cards mounting at once must produce one
 * request between them (hence `inFlight`), and a set that changes once a week
 * does not need a network round-trip on every mount within five minutes (hence
 * the TTL). What it borrows from swrCache is the storage decision —
 * sessionStorage, so a tab keeps its copy while you use the site and a new
 * session starts honest.
 *
 * A FAILURE IS SILENT ON PURPOSE. loadEndorsements never rejects: it resolves
 * to whatever it has, which on a cold failure is an empty map. A seal that
 * doesn't render is invisible to the reader — there is nothing here for anyone
 * to retry, and an error state on a cosmetic would be louder than the feature.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const CACHE_KEY = "dv-stamp-endorsements";
const CACHE_SHAPE = 1;

/**
 * How long one fetched set stays fresh. The set only moves when the weekly
 * podium turns over or a top-three curator retires a rec, so minutes are
 * generous; five is short enough that a curator who re-stamps sees their seal
 * travel the site within one coffee.
 */
const TTL_MS = 5 * 60_000;

/**
 * Defensive ceiling on rows accepted from the payload.
 *
 * NOT nine, deliberately, even though nine is today's contract: if the server
 * ever widens the podium, a client that silently truncated to nine would drop
 * real seals with no symptom anyone could trace. Sixty is far above any honest
 * widening and far below "a backend regression started streaming the whole rec
 * table into every page".
 */
const MAX_ROWS = 60;

/** One endorsed title, and the curator whose seal it wears. */
export type StampEndorsement = {
  mediaType: StampMediaType;
  mediaId: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatar: string | null;
  ownerGrade: StampGrade;
  ownerRank: StampPodium;
};

export type EndorsementMap = ReadonlyMap<string, StampEndorsement>;

/** Shared frozen empty map, so "nothing endorsed" allocates nothing and every
 *  consumer compares equal against it. */
export const NO_ENDORSEMENTS: EndorsementMap = new Map();

/** The lookup key. One string, one Map.get — no scan, ever. */
export function endorsementKey(mediaType: StampMediaType, mediaId: string): string {
  return `${mediaType}:${mediaId}`;
}

/* ────────────────────────── normalisation ────────────────────────── */

const MEDIA_TYPES: StampMediaType[] = ["anime", "manhwa", "novel"];

/**
 * A row is kept only if every field the seal actually draws is present and
 * legal. A missing grade is NOT defaulted to "C": the seal is a claim about
 * someone's standing, and inventing one is worse than drawing nothing. A
 * missing username is fatal for the same reason — it is both the legend struck
 * into the seal and the profile the tap opens.
 */
function normalizeRow(raw: any): StampEndorsement | null {
  const mediaType = String(raw?.mediaType || "");
  const mediaId = String(raw?.mediaId ?? "").trim();
  const ownerUsername = typeof raw?.ownerUsername === "string" ? raw.ownerUsername.trim() : "";
  if (!(MEDIA_TYPES as string[]).includes(mediaType) || !mediaId || !ownerUsername) return null;
  if (!isStampGrade(raw?.ownerGrade)) return null;

  const rank = Number(raw?.ownerRank);
  return {
    mediaType: mediaType as StampMediaType,
    mediaId,
    ownerId: String(raw?.ownerId ?? ""),
    ownerUsername,
    ownerAvatar: typeof raw?.ownerAvatar === "string" ? raw.ownerAvatar : null,
    ownerGrade: raw.ownerGrade,
    ownerRank: rank === 1 || rank === 2 || rank === 3 ? (rank as 1 | 2 | 3) : null,
  };
}

/**
 * Rows to Map. FIRST WRITER WINS on a duplicated (type, id): the server orders
 * the podium, so rank 1's seal is the one a contested title should wear, and a
 * later row must not silently demote it.
 */
function toMap(rows: StampEndorsement[]): EndorsementMap {
  const map = new Map<string, StampEndorsement>();
  for (const row of rows) {
    const key = endorsementKey(row.mediaType, row.mediaId);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

/* ──────────────────────── the one-per-session load ──────────────────────── */

let snapshot: EndorsementMap | null = null;
let snapshotAt = 0;
/** The PROMISE, not the result — this is what collapses a burst of callers
 *  onto one request instead of one request each. */
let inFlight: Promise<EndorsementMap> | null = null;

function readCache(): { rows: StampEndorsement[]; at: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c?.shape !== CACHE_SHAPE || !Array.isArray(c.rows)) return null;
    const at = Number(c.at);
    if (!Number.isFinite(at) || Date.now() - at >= TTL_MS) return null;
    const rows = c.rows.map(normalizeRow).filter(Boolean) as StampEndorsement[];
    return { rows, at };
  } catch {
    // A bad blob, a locked store, or no storage at all — all just a miss.
    return null;
  }
}

function writeCache(rows: StampEndorsement[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ shape: CACHE_SHAPE, at: Date.now(), rows }));
  } catch {
    // Quota or private mode: every load in this tab just pays the request.
  }
}

async function fetchEndorsements(): Promise<EndorsementMap> {
  // No auth header and no viewer parameter: the set is identical for every
  // reader, which is exactly why one cached copy can serve a whole session.
  const r = await fetch(`${API_URL}/api/stamps/endorsements`);
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.success) throw new Error("bad payload");

  /**
   * THE ROWS LIVE AT data.endorsements — reading `data` itself as the array
   * is how this feature shipped completely invisible once already: the
   * server answers { data: { podiumWeek, endorsements: [...] } }, the client
   * asked Array.isArray(data), got false, and every cover on the site
   * silently drew no seal. The bare-array branch stays as tolerance in case
   * the endpoint is ever flattened, but an unrecognised shape must THROW
   * rather than resolve empty — "no endorsements" and "I could not read the
   * answer" are different facts, and caching the second as the first
   * suppressed the network for the rest of the session.
   */
  const raw = Array.isArray(d.data?.endorsements)
    ? d.data.endorsements
    : Array.isArray(d.data)
      ? d.data
      : null;
  if (!raw) throw new Error("unrecognised endorsements shape");

  const rows = raw
    .slice(0, MAX_ROWS)
    .map(normalizeRow)
    .filter(Boolean) as StampEndorsement[];

  writeCache(rows);
  return toMap(rows);
}

/**
 * The set, from memory, then the session cache, then the network — and at most
 * ONE request no matter how many callers arrive at once.
 *
 * Browser-only: it touches sessionStorage, so call it from an effect. Never
 * rejects (see the module header).
 */
export function loadEndorsements(): Promise<EndorsementMap> {
  if (snapshot && Date.now() - snapshotAt < TTL_MS) return Promise.resolve(snapshot);
  if (inFlight) return inFlight;

  const cached = readCache();
  if (cached) {
    snapshot = toMap(cached.rows);
    // The CACHE's timestamp, not now — re-stamping it here would let a copy
    // written once be renewed forever by reads and never refresh.
    snapshotAt = cached.at;
    return Promise.resolve(snapshot);
  }

  inFlight = fetchEndorsements()
    .then((map) => {
      snapshot = map;
      snapshotAt = Date.now();
      return map;
    })
    .catch(() => snapshot ?? NO_ENDORSEMENTS)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
