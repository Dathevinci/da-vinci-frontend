import { authHeaders, getAuthToken } from "@/lib/authToken";
import { manhwaCoverSrc } from "@/lib/manhwa/coverProxy";
import { novelCover } from "@/lib/novelImage";

/**
 * THE STAMP SYSTEM — the client for every /api/stamps endpoint.
 *
 * A stamp is one per user, globally, with three ACTIVE recommendation slots.
 * Its grade moves on two things and nothing else:
 *
 *   organic — the summed verdict of explicit thumbs on their recs, damped so a
 *             rec needs about five votes before it counts fully, and counted
 *             over RETIRED recs too (a bad call cannot be laundered by
 *             deleting it).
 *   boosted — Arise Points other people spent on the stamp, with diminishing
 *             returns per booster and a hard ceiling at the organic score, so
 *             nobody buys a grade from zero.
 *
 * EVERY ONE OF THOSE NUMBERS IS THE SERVER'S. Nothing in this module computes
 * a score, a grade or a rank — it only reads, normalizes and displays what the
 * backend sends. The one table mirrored here (GRADE_BANDS) is used for the
 * explainer copy and for a "points to the next grade" hint that is derived
 * from the server's OWN grade string, never from a locally recomputed one.
 * That is the whole reason the hint cannot drift: if the server ever grades
 * differently to this table, the hint simply does not render.
 *
 * TWO THINGS THIS MODULE DELIBERATELY NO LONGER DOES:
 *
 *  · IT DOES NOT LOOK UP GRADES. There was a `loadGradesFor` fan-out here that
 *    called GET /api/stamps/:userId once per distinct rec owner — the single
 *    most expensive endpoint in the system — to recover one letter for the seal
 *    on a cover, capped at 8 owners so the 9th curator's cover silently went
 *    bare and the same person appeared sealed or unsealed depending on cache
 *    order. Every Rec now carries `ownerGrade` and `ownerRank`, computed inside
 *    aggregations the feed already runs, so the seal comes free with the data
 *    and is all-or-nothing per list. Do not reintroduce a per-owner lookup.
 *
 *  · IT DOES NOT INFER AN ERROR FROM A STATUS. Every failure body carries a
 *    `code`, because one status is several different situations: 409 is
 *    "slots full" (retire something) AND "already stamped" (retiring would not
 *    help), 403 is "open it first" AND "that's your own rec". Branch on the
 *    code; the status alone tells a reader the wrong thing.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ────────────────────────────── types ────────────────────────────── */

export type StampGrade = "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";
export type StampMediaType = "anime" | "manhwa" | "novel";
export type StampVote = 1 | -1 | 0;
/** Last week's podium, worn through this week. Null for everyone else. */
export type StampPodium = 1 | 2 | 3 | null;

/** One recommendation, exactly as the API contract defines it. */
export type StampRec = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatar: string | null;
  /** The owner's all-time grade, carried ON the rec — this is what the seal on
   *  the cover reads. Null only if the payload predates the field, in which
   *  case no seal is drawn rather than a guessed one. */
  ownerGrade: StampGrade | null;
  /** The seal treatment the owner wears right now (last week's podium). */
  ownerRank: StampPodium;
  mediaType: StampMediaType;
  mediaId: string;
  title: string;
  cover: string | null;
  blurb: string;
  up: number;
  down: number;
  /** THIS viewer's vote. 0 means "hasn't voted", not "voted neutral". */
  myVote: StampVote;
  /** Has THIS viewer opened the rec? The vote gate — false means the thumbs
   *  stay disabled, because a vote from someone who never clicked through is
   *  exactly the brigade this system is built to refuse. */
  opened: boolean;
  createdAt: string;
  /** Set once retired. The rec leaves the active three but its verdict stays
   *  in the organic score forever. */
  retiredAt: string | null;
};

/** The earned/bought halves of one score. Never merged into one number. */
export type StampSplit = { organic: number; boosted: number };

/** A stamp's totals, as the server recomputes them after a vote or a boost. */
export type StampTotals = {
  userId: string;
  grade: StampGrade;
  score: number;
  organic: number;
  boosted: number;
};

export type StampProfile = {
  grade: StampGrade;
  score: number;
  organic: number;
  boosted: number;
  /** Position on THIS week's board, or null when they haven't scored in it.
   *  Guaranteed to be the same number /rankings prints for the same week. */
  weeklyRank: number | null;
  /** LAST week's top three — the unique seals worn during this week. */
  topThreeRank: StampPodium;
  recs: StampRec[];
};

export type StampRankingEntry = {
  userId: string;
  username: string;
  avatar: string | null;
  /** ALL-TIME grade, on purpose: a badge that reset every Monday would not be
   *  a reputation. It is NOT the grade of `weekScore`. */
  grade: StampGrade;
  rank: number;
  /** Score earned WITHIN the ranked week — not the all-time score. */
  weekScore: number;
  /** The split OF weekScore: organic + boosted === weekScore, always. Null when
   *  the server didn't send it, in which case the row draws no split at all —
   *  an all-time pair printed under a weekly total is the exact lie this
   *  replaced. */
  weekSplit: StampSplit | null;
  /** The all-time figures, under names that say so. */
  lifetime: (StampSplit & { score: number }) | null;
  /** The seal this member is wearing right now — same semantics as
   *  Rec.ownerRank, so no client-side week arithmetic decides it. */
  topThreeRank: StampPodium;
};

export type StampRankings = { week: string; entries: StampRankingEntry[] };

/**
 * MACHINE-READABLE FAILURES. The server labels every error body with one of
 * these; the client branches on the label, never on the bare status.
 *
 * "NETWORK" is ours (the request never reached the server). "UNKNOWN" is an
 * answer that carried no code we recognise — a backend older than this client.
 * Neither is ever guessed from a status: guessing is what made a duplicate
 * title tell the reader their slots were full.
 */
export type StampErrorCode =
  // every write
  | "AUTH_REQUIRED"
  | "IDENTITY_MISMATCH"
  // createRec
  | "UNKNOWN_MODE"
  | "BAD_MEDIA"
  | "USER_NOT_FOUND"
  | "ALREADY_STAMPED"
  | "PREVIOUSLY_STAMPED"
  | "SLOTS_FULL"
  | "SLOT_TAKEN"
  // retireRec / openRec / voteRec
  | "REC_NOT_FOUND"
  | "NOT_OWNER"
  | "REC_RETIRED"
  | "BAD_VALUE"
  | "SELF_VOTE"
  | "NOT_OPENED"
  // boostStamp
  | "BAD_AMOUNT"
  | "SELF_BOOST"
  | "INSUFFICIENT_POINTS"
  // reads
  | "BAD_WEEK"
  | "MISSING_VIEWER"
  // client-side
  | "NETWORK"
  | "UNKNOWN";

const KNOWN_CODES = new Set<string>([
  "AUTH_REQUIRED",
  "IDENTITY_MISMATCH",
  "UNKNOWN_MODE",
  "BAD_MEDIA",
  "USER_NOT_FOUND",
  "ALREADY_STAMPED",
  "PREVIOUSLY_STAMPED",
  "SLOTS_FULL",
  "SLOT_TAKEN",
  "REC_NOT_FOUND",
  "NOT_OWNER",
  "REC_RETIRED",
  "BAD_VALUE",
  "SELF_VOTE",
  "NOT_OPENED",
  "BAD_AMOUNT",
  "SELF_BOOST",
  "INSUFFICIENT_POINTS",
  "BAD_WEEK",
  "MISSING_VIEWER",
]);

/** Reads throw; writes answer with this so each `code` can be handled. */
export type StampResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: StampErrorCode; message: string };

/**
 * What the reads throw — carrying the STATUS and the CODE, which the callers
 * genuinely need: "this account has no stamp yet" (404) and "the server is
 * down" (0 or 5xx) look identical from a bare Error, and the right thing to
 * draw for each is opposite. A missing stamp deserves an invitation to make
 * one; an outage deserves silence, not a fabricated grade.
 */
export class StampRequestError extends Error {
  status: number;
  code: StampErrorCode;
  constructor(message: string, status: number, code: StampErrorCode = "UNKNOWN") {
    super(message);
    this.name = "StampRequestError";
    this.status = status;
    this.code = code;
  }
}

/** A stamp nobody has used yet. Every number is genuinely zero — this is not
 *  a placeholder standing in for unknown values, it is what an unstamped
 *  account actually has. */
export const EMPTY_STAMP: StampProfile = {
  grade: "C",
  score: 0,
  organic: 0,
  boosted: 0,
  weeklyRank: null,
  topThreeRank: null,
  recs: [],
};

/* ─────────────────────────── the session ─────────────────────────── */

/**
 * IS THERE A VERIFIED SESSION? (i.e. a stored JWT)
 *
 * Every stamp WRITE — stamp, retire, open, vote, boost — is token-only. There
 * is no body-id fallback any more: without an Authorization header the server
 * answers 401 AUTH_REQUIRED and nothing is written. A grandfathered pre-JWT
 * session still holds a cached user, so the app LOOKS signed in while every
 * control it offers would bounce.
 *
 * Surfaces ask this so they can say "sign in again" plainly, instead of
 * handing out buttons that cannot work. Reads are unaffected — they still
 * personalise from the ?viewer=/?userId= fallback below.
 *
 * It touches localStorage, so call it from an effect and never during render:
 * on the server there is no localStorage, and a value that differs between the
 * server render and the first client render is a hydration mismatch.
 */
export function hasStampSession(): boolean {
  return !!getAuthToken();
}

/* ─────────────────────────── grade display ─────────────────────────── */

const GRADES: StampGrade[] = ["D", "C", "B", "A", "S", "SS", "SSS"];

/**
 * The published bands, for EXPLAINER COPY AND HINTS ONLY.
 *
 * `min` is inclusive, `max` is the last score still inside the band (null on
 * SSS, which is open-ended). D is the below-zero band. Read the module header
 * before using this for anything else: the grade a stamp WEARS always comes
 * from the server's payload.
 */
export const GRADE_BANDS: ReadonlyArray<{ grade: StampGrade; min: number; max: number | null }> = [
  { grade: "D", min: -Infinity, max: -1 },
  { grade: "C", min: 0, max: 9 },
  { grade: "B", min: 10, max: 29 },
  { grade: "A", min: 30, max: 74 },
  { grade: "S", min: 75, max: 149 },
  { grade: "SS", min: 150, max: 299 },
  { grade: "SSS", min: 300, max: null },
];

/**
 * "N more to reach B" — or null when there is nothing honest to say.
 *
 * Anchored on the grade the SERVER sent, not on a recomputed one: we look up
 * the band that server grade names and read its ceiling. If the score doesn't
 * sit inside that band (the server graded on a rule this table doesn't know,
 * or the account is already SSS) the hint is withheld rather than guessed.
 */
export function pointsToNextGrade(
  grade: StampGrade,
  score: number,
): { next: StampGrade; needed: number } | null {
  const i = GRADE_BANDS.findIndex((b) => b.grade === grade);
  if (i < 0 || i >= GRADE_BANDS.length - 1) return null;
  const band = GRADE_BANDS[i];
  if (band.max === null) return null;
  if (score < band.min || score > band.max) return null; // server disagrees — say nothing
  const next = GRADE_BANDS[i + 1];
  return { next: next.grade, needed: Math.max(1, next.min - score) };
}

/** True for any of the seven grades; guards a raw string from the API. */
export function isStampGrade(v: unknown): v is StampGrade {
  return typeof v === "string" && (GRADES as string[]).includes(v);
}

/* ─────────────────────────── week helpers ─────────────────────────── */

/**
 * ISO-8601 week key, e.g. "2026-W31" — the EXACT math the backend's weekKey()
 * uses for GemVote (and now for stamp weeks), so the board names the same week
 * the votes and boosts land in. Shift to the week's own Thursday before
 * counting; a naive day-of-year/7 is off by one for most of January.
 */
export function isoWeekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7; // Sunday is 0 in JS but day 7 in ISO
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * The key for the week `weeksAgo` before this one.
 *
 * Done by moving a DATE and re-deriving, never by decrementing the "W31" in a
 * string: week 1 of a year follows week 52 or 53 depending on the year, and
 * string maths gets that wrong every January.
 */
export function weekKeyAgo(weeksAgo: number, from: Date = new Date()): string {
  const d = new Date(from.getTime() - weeksAgo * 7 * 86400000);
  return isoWeekKey(d);
}

/** Whole days until the next ISO Monday (1–7; on Monday the reset is 7 out). */
export function daysUntilMonday(d: Date = new Date()): number {
  const dayNum = d.getUTCDay() || 7;
  return 8 - dayNum;
}

/* ─────────────────────────── normalizers ─────────────────────────── */

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const MEDIA_TYPES: StampMediaType[] = ["anime", "manhwa", "novel"];

function normalizeMediaType(v: unknown): StampMediaType {
  return (MEDIA_TYPES as string[]).includes(String(v)) ? (v as StampMediaType) : "manhwa";
}

function normalizeVote(v: unknown): StampVote {
  const n = num(v, 0);
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** 1/2/3 or null. Anything else — including 0, which the API never sends for a
 *  podium — is "wears no seal". */
function normalizePodium(v: unknown): StampPodium {
  const n = num(v, 0);
  return n === 1 || n === 2 || n === 3 ? (n as 1 | 2 | 3) : null;
}

function normalizeCode(v: unknown, status: number): StampErrorCode {
  const s = typeof v === "string" ? v : "";
  if (KNOWN_CODES.has(s)) return s as StampErrorCode;
  // An unlabelled failure stays unlabelled. Deriving a code from the status is
  // precisely the collapse the codes exist to end.
  return status === 0 ? "NETWORK" : "UNKNOWN";
}

function normalizeTotals(raw: any, fallbackUserId = ""): StampTotals | null {
  if (!raw || !isStampGrade(raw.grade)) return null;
  return {
    userId: String(raw.userId ?? fallbackUserId),
    grade: raw.grade,
    score: num(raw.score),
    organic: num(raw.organic),
    boosted: Math.max(0, num(raw.boosted)),
  };
}

export function normalizeRec(raw: any): StampRec {
  return {
    id: String(raw?.id ?? ""),
    ownerId: String(raw?.ownerId ?? ""),
    ownerUsername: str(raw?.ownerUsername),
    ownerAvatar: raw?.ownerAvatar ?? null,
    // No fallback grade. A seal is a claim about someone's standing; drawing a
    // default "C" on a payload that didn't carry one would be inventing it.
    ownerGrade: isStampGrade(raw?.ownerGrade) ? raw.ownerGrade : null,
    ownerRank: normalizePodium(raw?.ownerRank),
    mediaType: normalizeMediaType(raw?.mediaType),
    mediaId: String(raw?.mediaId ?? ""),
    title: str(raw?.title, "Untitled"),
    cover: raw?.cover ?? null,
    blurb: str(raw?.blurb),
    up: Math.max(0, num(raw?.up)),
    down: Math.max(0, num(raw?.down)),
    myVote: normalizeVote(raw?.myVote),
    // Absent means NOT opened. Defaulting the other way would hand the thumbs
    // to every viewer of an older payload — the one thing the gate exists to
    // stop. (The server refuses the vote anyway; this just keeps the UI from
    // promising something it can't deliver.)
    opened: raw?.opened === true,
    createdAt: str(raw?.createdAt),
    retiredAt: raw?.retiredAt ? String(raw.retiredAt) : null,
  };
}

function normalizeStamp(raw: any): StampProfile {
  return {
    grade: isStampGrade(raw?.grade) ? raw.grade : "C",
    score: num(raw?.score),
    organic: num(raw?.organic),
    boosted: Math.max(0, num(raw?.boosted)),
    weeklyRank: raw?.weeklyRank == null ? null : num(raw.weeklyRank) || null,
    topThreeRank: normalizePodium(raw?.topThreeRank),
    recs: Array.isArray(raw?.recs) ? raw.recs.map(normalizeRec) : [],
  };
}

function normalizeEntry(raw: any, i: number): StampRankingEntry {
  // Both halves or neither: half a split is not a split, and a missing half
  // silently rendered as 0 is how "0 earned · 0 boosted" ended up printed next
  // to "5 this week".
  const hasWeekSplit = raw?.weekOrganic != null && raw?.weekBoosted != null;
  const hasLifetime =
    raw?.lifetimeScore != null && raw?.lifetimeOrganic != null && raw?.lifetimeBoosted != null;

  return {
    userId: String(raw?.userId ?? ""),
    username: str(raw?.username),
    avatar: raw?.avatar ?? null,
    grade: isStampGrade(raw?.grade) ? raw.grade : "C",
    rank: num(raw?.rank, i + 1),
    weekScore: num(raw?.weekScore),
    weekSplit: hasWeekSplit
      ? { organic: num(raw.weekOrganic), boosted: Math.max(0, num(raw.weekBoosted)) }
      : null,
    lifetime: hasLifetime
      ? {
          score: num(raw.lifetimeScore),
          organic: num(raw.lifetimeOrganic),
          boosted: Math.max(0, num(raw.lifetimeBoosted)),
        }
      : null,
    topThreeRank: normalizePodium(raw?.topThreeRank),
  };
}

/* ────────────────────────────── plumbing ────────────────────────────── */

/** POST/DELETE helper. Never throws — the caller needs the code. */
async function write<T>(
  path: string,
  method: "POST" | "DELETE",
  body: Record<string, unknown>,
  pick: (d: any) => T,
): Promise<StampResult<T>> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.success) {
      return {
        ok: false,
        status: r.status,
        code: normalizeCode(d?.code, r.status),
        message: str(d?.message) || "That didn't go through.",
      };
    }
    return { ok: true, status: r.status, data: pick(d) };
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK",
      message: "Couldn't reach the server.",
    };
  }
}

/* ────────────────────────────── reads ────────────────────────────── */

/**
 * One user's stamp — grade, the honest earned/boosted split, weekly standing
 * and the recs.
 *
 * `viewerId` is the READER, not the profile's owner, and it is only put on the
 * URL when there is no JWT to send. The server prefers the token and falls back
 * to ?viewer= for exactly this case; without it a tokenless reader gets
 * `opened: false, myVote: 0` on every rec, so their own cast vote shows as
 * uncast and the gate re-locks on every reload. (The feed's equivalent is
 * ?userId=, which it has always sent — the two reads used to disagree for the
 * same person.) It buys personalisation and nothing else: every write is
 * token-only, so a viewer id on a URL grants no power.
 */
export async function fetchStamp(
  userId: string,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<StampProfile> {
  const qs = !getAuthToken() && viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : "";
  const r = await fetch(`${API_URL}/api/stamps/${encodeURIComponent(userId)}${qs}`, {
    headers: authHeaders(),
    signal,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.success || !d.data) {
    throw new StampRequestError(
      str(d?.message) || "Couldn't read that stamp.",
      r.status,
      normalizeCode(d?.code, r.status),
    );
  }
  return normalizeStamp(d.data);
}

/** The weekly board. `week` omitted means the current ISO week. */
export async function fetchStampRankings(
  week?: string | null,
  signal?: AbortSignal,
): Promise<StampRankings> {
  const qs = week ? `?week=${encodeURIComponent(week)}` : "";
  const r = await fetch(`${API_URL}/api/stamps/rankings${qs}`, { headers: authHeaders(), signal });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.success || !d.data) {
    throw new StampRequestError(
      str(d?.message) || "Couldn't read the board.",
      r.status,
      normalizeCode(d?.code, r.status),
    );
  }
  const entries: StampRankingEntry[] = Array.isArray(d.data.entries)
    ? d.data.entries.map(normalizeEntry)
    : [];
  return { week: str(d.data.week) || week || isoWeekKey(), entries };
}

/** Recs from the people this viewer follows, newest first. */
export async function fetchStampFeed(viewerId: string, signal?: AbortSignal): Promise<StampRec[]> {
  const r = await fetch(`${API_URL}/api/stamps/feed?userId=${encodeURIComponent(viewerId)}`, {
    headers: authHeaders(),
    signal,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.success) {
    throw new StampRequestError(
      str(d?.message) || "Couldn't read the feed.",
      r.status,
      normalizeCode(d?.code, r.status),
    );
  }
  return Array.isArray(d.data) ? d.data.map(normalizeRec) : [];
}

/* ────────────────────────────── writes ────────────────────────────── */

export const BLURB_MAX = 180;

/**
 * Stamp something.
 *
 * THREE DIFFERENT 409s, and the caller must tell them apart:
 *   SLOTS_FULL         — offer the retire flow, that is the fix.
 *   ALREADY_STAMPED    — it is already one of your three; retiring is not the
 *                        fix and offering it sends someone to delete a good rec
 *                        to make room they already have.
 *   PREVIOUSLY_STAMPED — a title is stamped once, ever. Nothing to retire.
 *   SLOT_TAKEN         — a race with your own other tab; retrying works.
 *
 * The `userId` in the body is informational only — the server takes the actor
 * from the token and 403s (IDENTITY_MISMATCH) if the two disagree, which is
 * worth surfacing: it means the cached user and the session have drifted.
 */
export async function createRec(input: {
  userId: string;
  mediaType: StampMediaType;
  mediaId: string;
  title: string;
  cover: string | null;
  blurb: string;
}): Promise<StampResult<StampRec | null>> {
  return write(
    "/api/stamps/recs",
    "POST",
    {
      userId: input.userId,
      mediaType: input.mediaType,
      mediaId: input.mediaId,
      title: input.title,
      cover: input.cover,
      blurb: input.blurb.slice(0, BLURB_MAX),
    },
    (d) => (d?.data ? normalizeRec(d.data) : null),
  );
}

/**
 * RETIRE, never delete. The rec leaves the active three; its up/down verdict
 * stays in the organic score, which is the whole point — a bad recommendation
 * that could be deleted is a bad recommendation that costs nothing.
 */
export async function retireRec(recId: string, userId: string): Promise<StampResult<null>> {
  return write(`/api/stamps/recs/${encodeURIComponent(recId)}`, "DELETE", { userId }, () => null);
}

/**
 * THE VOTE GATE. Idempotent: records that this viewer actually clicked through
 * to the recommendation. Without a row here the server refuses their vote.
 */
export async function openRec(recId: string, userId: string): Promise<StampResult<null>> {
  return write(`/api/stamps/recs/${encodeURIComponent(recId)}/open`, "POST", { userId }, () => null);
}

/**
 * A plain thumb up or down, one per person per rec (re-sending moves it).
 *
 * The answer carries the OWNER'S RECOMPUTED STAMP as well as the rec's counts,
 * and the caller is expected to use it: a vote visibly moving someone's grade
 * is the entire feature, and discarding `owner` here meant the plaque directly
 * above the thumbs kept its pre-vote numbers until a full page reload.
 *
 * Failure codes worth branching on: NOT_OPENED (the gate — re-lock the thumbs),
 * SELF_VOTE (your own rec — say that, and do NOT touch the gate state),
 * REC_RETIRED (it was withdrawn while you were reading).
 */
export async function voteRec(
  recId: string,
  userId: string,
  value: 1 | -1,
): Promise<
  StampResult<{ up: number; down: number; myVote: StampVote; owner: StampTotals | null } | null>
> {
  return write(
    `/api/stamps/recs/${encodeURIComponent(recId)}/vote`,
    "POST",
    { userId, value },
    (d) =>
      d?.data && (d.data.up !== undefined || d.data.down !== undefined)
        ? {
            up: Math.max(0, num(d.data.up)),
            down: Math.max(0, num(d.data.down)),
            myVote: normalizeVote(d.data.myVote ?? value),
            owner: normalizeTotals(d.data.owner),
          }
        : null,
  );
}

/**
 * Spend Arise Points on someone else's stamp. The server does the atomic
 * conditional decrement, so an INSUFFICIENT_POINTS genuinely means "you don't
 * have it" — a concurrent spend cannot slip past. Boosting your own stamp is
 * refused server-side (SELF_BOOST) and hidden client-side.
 *
 * The answer carries the recipient's recomputed stamp, so the plaque updates
 * from the spend itself rather than from a second read of the profile.
 */
export async function boostStamp(
  userId: string,
  boosterId: string,
  amount: number,
): Promise<StampResult<{ owner: StampTotals | null; arisePoints: number | null }>> {
  return write(
    `/api/stamps/${encodeURIComponent(userId)}/boost`,
    "POST",
    { boosterId, amount: Math.floor(amount) },
    (d) => ({
      owner: normalizeTotals(d?.data, userId),
      arisePoints:
        d?.data?.arisePoints === undefined || d?.data?.arisePoints === null
          ? null
          : num(d.data.arisePoints),
    }),
  );
}

/* ─────────────────────────── media helpers ─────────────────────────── */

/** Where a rec points. Same route shapes the rest of the app links to. */
export function recHref(rec: Pick<StampRec, "mediaType" | "mediaId">): string {
  return `/${rec.mediaType}/${encodeURIComponent(rec.mediaId)}`;
}

/**
 * The <img src> for a stored rec cover.
 *
 * Stored covers are RAW source URLs, so each mode gets the pipeline it already
 * uses everywhere else: manhwa art through the referer-sending proxy, novel
 * art through /api/novel-image (its scraper hosts hotlink-gate on and off),
 * anime art straight from AniList, which serves it direct.
 */
export function recCoverSrc(mediaType: StampMediaType, cover: string | null): string | null {
  if (!cover) return null;
  if (mediaType === "manhwa") return manhwaCoverSrc(cover);
  if (mediaType === "novel") return novelCover(cover) || cover;
  return cover;
}

/** "Manhwa" / "Novel" / "Anime" — for chips. */
export function mediaLabel(t: StampMediaType): string {
  return t === "anime" ? "Anime" : t === "novel" ? "Novel" : "Manhwa";
}

/** "just now" / "3d ago" — the same clock the guild plaque keeps. */
export function stampAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = ms / 1000;
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
