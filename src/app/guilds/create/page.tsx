"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown, ArrowLeft, Check, X, CircleDot, Globe, Lock, Gem, Users, Swords,
  TrendingUp, Shield,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import PageTransition from "@/components/layout/PageTransition";
import { cacheGuildId, findMyGuild, GUILD_CREATE } from "@/lib/guild";

/**
 * CREATE A GUILD.
 *
 * The requirements card is a COURTESY, not a gate. Every rule it lists — the
 * three-day account age, one guild per person, the 2000 AP charge — is enforced
 * server-side, and this page always lets the request run so the server's own
 * message is what the founder reads. A client that refuses to submit can only
 * be wrong in one direction: it blocks someone the server would have allowed
 * (a stale cached user, a guild left in another tab, an unread `createdAt`).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const DAY_MS = 86_400_000;

type ReqState = "ok" | "no" | "unknown";

function Requirement({
  state, label, detail,
}: {
  state: ReqState;
  label: string;
  detail?: string;
}) {
  const marks = {
    ok: { Icon: Check, ring: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300", text: "text-slate-200" },
    no: { Icon: X, ring: "border-rose-400/40 bg-rose-500/15 text-rose-300", text: "text-slate-300" },
    unknown: { Icon: CircleDot, ring: "border-white/10 bg-white/[0.04] text-slate-500", text: "text-slate-400" },
  };
  const m = marks[state];
  const Icon = m.Icon;

  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${m.ring}`}>
        <Icon className="h-3 w-3" />
      </span>
      <span className="min-w-0">
        <span className={`block text-xs leading-relaxed ${m.text}`}>{label}</span>
        {detail && <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-600">{detail}</span>}
      </span>
    </li>
  );
}

function Benefit({
  icon: Icon, title, body,
}: {
  icon: typeof Users;
  title: string;
  body: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-white">{title}</p>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return GUILD_CREATE.MIN_LEVEL_MIN;
  return Math.min(GUILD_CREATE.MIN_LEVEL_MAX, Math.max(GUILD_CREATE.MIN_LEVEL_MIN, Math.floor(n)));
}

/** Used only when the server answers without a message of its own. */
function fallbackMessage(statusCode: number): string {
  if (statusCode === 401) return "Sign in to found a guild.";
  if (statusCode === 402) return `You need ${GUILD_CREATE.COST_AP.toLocaleString()} Arise Points to found a guild.`;
  if (statusCode === 403) return `Your account must be at least ${GUILD_CREATE.MIN_ACCOUNT_AGE_DAYS} days old to found a guild.`;
  if (statusCode === 409) return "That name or tag is taken — or you are already in a guild.";
  return "Couldn't found the guild.";
}

export default function CreateGuildPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  // Held as text so the field can be cleared while typing; `minLevel` is the
  // clamped number everything else reads.
  const [minLevelRaw, setMinLevelRaw] = useState(String(GUILD_CREATE.MIN_LEVEL_MIN));
  const [submitting, setSubmitting] = useState(false);
  const [inGuild, setInGuild] = useState<boolean | null>(null);

  const minLevel = clampLevel(parseInt(minLevelRaw, 10));

  useEffect(() => {
    if (!user?.id) {
      setInGuild(null);
      return;
    }
    let alive = true;
    findMyGuild(user.id).then((g) => {
      if (alive) setInGuild(Boolean(g));
    });
    return () => { alive = false; };
  }, [user?.id]);

  // `createdAt` is not on the User type but the API sends it; read it without
  // widening the whole user object to `any`. Absent means "unknown", never
  // "too new" — the server decides.
  const createdAt = (user as { createdAt?: string } | null)?.createdAt;
  const accountAgeDays = createdAt
    ? Math.floor((Date.now() - Date.parse(createdAt)) / DAY_MS)
    : null;

  const ageState: ReqState = !user || accountAgeDays === null || !Number.isFinite(accountAgeDays)
    ? "unknown"
    : accountAgeDays >= GUILD_CREATE.MIN_ACCOUNT_AGE_DAYS ? "ok" : "no";

  const guildState: ReqState = !user || inGuild === null ? "unknown" : inGuild ? "no" : "ok";

  const points = user?.arisePoints ?? 0;
  const apState: ReqState = !user ? "unknown" : points >= GUILD_CREATE.COST_AP ? "ok" : "no";

  const trimmedName = name.trim();
  const nameOk = trimmedName.length >= GUILD_CREATE.NAME_MIN && trimmedName.length <= GUILD_CREATE.NAME_MAX;
  const tagOk = new RegExp(`^[A-Z]{${GUILD_CREATE.TAG_MIN},${GUILD_CREATE.TAG_MAX}}$`).test(tag);

  const submit = async () => {
    if (submitting) return;
    if (!nameOk || !tagOk) {
      toast("Check the name and tag before founding.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: trimmedName,
          tag,
          description: desc.trim(),
          isPublic,
          minLevel,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success || !d?.data?.id) {
        toast(d?.message || fallbackMessage(r.status), "error");
        return;
      }
      cacheGuildId(d.data.id);
      toast(`${trimmedName} is founded. Lead it well.`, "success");
      router.push(`/guild/${encodeURIComponent(d.data.id)}`);
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-x-hidden bg-[#070709] px-4 pb-32 pt-14 font-mono text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(16,185,129,0.16),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-2xl">
          <Link
            href="/guilds"
            className="inline-flex min-h-[44px] items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All guilds
          </Link>

          {/* ── HERO ── */}
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
              <Crown className="h-5 w-5 text-emerald-300" />
            </span>
            <h1 className="min-w-0 font-fell text-3xl text-white sm:text-4xl">Create a Guild</h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Raise a banner, gather a roster, and grow it together — every member&apos;s XP feeds the guild.
          </p>

          {/* ── REQUIREMENTS ── */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b0b11] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Requirements</p>
            <ul className="mt-4 space-y-3">
              <Requirement
                state={ageState}
                label={`Account at least ${GUILD_CREATE.MIN_ACCOUNT_AGE_DAYS} days old`}
                detail={
                  ageState === "unknown"
                    ? "Checked by the server when you found the guild."
                    : `Your account is ${accountAgeDays} ${accountAgeDays === 1 ? "day" : "days"} old.`
                }
              />
              <Requirement
                state={guildState}
                label="Not already in a guild"
                detail={
                  guildState === "no"
                    ? "Leave your current guild before founding another."
                    : "One guild per person."
                }
              />
              <Requirement
                state={apState}
                label={`Costs ${GUILD_CREATE.COST_AP.toLocaleString()} Arise Points`}
                detail={
                  user
                    ? `You have ${points.toLocaleString()} AP. Nothing is charged if the name or tag is taken.`
                    : "Nothing is charged if the name or tag is taken."
                }
              />
              <Requirement
                state="ok"
                label="You become the guild leader"
                detail="Roles, invites, kicks and the treasury are yours to spend."
              />
            </ul>
          </div>

          {/* ── FORM ── */}
          <div className="mt-4 space-y-5 rounded-3xl border border-white/10 bg-[#0b0b11] p-5">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="guild-name" className="text-xs font-black text-white">Guild Name</label>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                  {name.length}/{GUILD_CREATE.NAME_MAX}
                </span>
              </div>
              <input
                id="guild-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, GUILD_CREATE.NAME_MAX))}
                placeholder="Deep Sea Vibes"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/40"
              />
              <p className="mt-1.5 text-[10px] text-slate-600">
                {GUILD_CREATE.NAME_MIN}-{GUILD_CREATE.NAME_MAX} characters.
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="guild-tag" className="text-xs font-black text-white">Tag</label>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                  {tag.length}/{GUILD_CREATE.TAG_MAX}
                </span>
              </div>
              <input
                id="guild-tag"
                value={tag}
                onChange={(e) =>
                  setTag(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, GUILD_CREATE.TAG_MAX))
                }
                placeholder="DSV"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm font-black tracking-[0.3em] text-emerald-200 outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-600 focus:border-emerald-400/40"
              />
              <p className="mt-1.5 text-[10px] text-slate-600">
                {GUILD_CREATE.TAG_MIN}-{GUILD_CREATE.TAG_MAX} uppercase letters, shown as [{tag || "TAG"}] beside the name.
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="guild-desc" className="text-xs font-black text-white">
                  Description <span className="font-bold text-slate-600">(optional)</span>
                </label>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                  {desc.length}/{GUILD_CREATE.DESC_MAX}
                </span>
              </div>
              <textarea
                id="guild-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value.slice(0, GUILD_CREATE.DESC_MAX))}
                rows={3}
                placeholder="What is this guild about?"
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/40"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-black text-white">Guild Privacy</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  aria-pressed={isPublic}
                  className={`min-h-[44px] rounded-xl border p-3 text-left transition ${
                    isPublic
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe className={`h-3.5 w-3.5 shrink-0 ${isPublic ? "text-emerald-300" : "text-slate-500"}`} />
                    <span className={`text-[11px] font-black uppercase tracking-[0.14em] ${isPublic ? "text-emerald-200" : "text-slate-300"}`}>
                      Public
                    </span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
                    Anyone can join freely.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  aria-pressed={!isPublic}
                  className={`min-h-[44px] rounded-xl border p-3 text-left transition ${
                    !isPublic
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Lock className={`h-3.5 w-3.5 shrink-0 ${!isPublic ? "text-emerald-300" : "text-slate-500"}`} />
                    <span className={`text-[11px] font-black uppercase tracking-[0.14em] ${!isPublic ? "text-emerald-200" : "text-slate-300"}`}>
                      Private
                    </span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
                    Invite only.
                  </span>
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="guild-minlevel" className="text-xs font-black text-white">
                  Minimum Level Requirement
                </label>
                <span className="shrink-0 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black tracking-widest text-emerald-300">
                  Level {minLevel}+
                </span>
              </div>
              <input
                id="guild-minlevel"
                type="number"
                inputMode="numeric"
                min={GUILD_CREATE.MIN_LEVEL_MIN}
                max={GUILD_CREATE.MIN_LEVEL_MAX}
                value={minLevelRaw}
                onChange={(e) => setMinLevelRaw(e.target.value)}
                onBlur={() => setMinLevelRaw(String(minLevel))}
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm tabular-nums text-white outline-none transition focus:border-emerald-400/40"
              />
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
                Only members at this level or higher can join. Levels run {GUILD_CREATE.MIN_LEVEL_MIN}-{GUILD_CREATE.MIN_LEVEL_MAX}.
              </p>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !nameOk || !tagOk}
              className="min-h-[52px] w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Founding…" : `Create Guild · ${GUILD_CREATE.COST_AP.toLocaleString()} AP`}
            </button>
            {isLoaded && !user && (
              <p className="text-center text-[10px] text-slate-600">Sign in first — the server will ask.</p>
            )}
          </div>

          {/* ── BENEFITS ── */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-[#0b0b11] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Guild Benefits</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <Benefit
                icon={TrendingUp}
                title="Shared XP Growth"
                body="The guild earns half of every member's XP, wherever on the site you earn it."
              />
              <Benefit
                icon={Gem}
                title="Guild Treasury"
                body="5 shards per 25 guild XP, spent on guild unlocks."
              />
              <Benefit
                icon={Users}
                title="Member Management"
                body="Roles, co-leaders, invites and kicks."
              />
              <Benefit
                icon={Swords}
                title="Guild Raids"
                body="Your guild fights its own weekly boss."
              />
            </div>
            <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-slate-600">
              <Shield className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Treasury shards belong to the guild. They pay for guild unlocks and never move back into a
                personal balance.
              </span>
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
