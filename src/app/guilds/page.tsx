"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, Shield, Sparkles, X, ArrowUpRight, Diamond, Check,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import { cacheGuildId, findMyGuild, type GuildSummary } from "@/lib/guild";
import PageTransition from "@/components/layout/PageTransition";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * GUILDS — the browse hall. Every guild as a card; guildless users get Join
 * buttons and a "Found a guild" CTA (2000 AP, stated up front); a member sees
 * their own guild pinned first. The server owns every rule that matters —
 * the AP charge, the 30-member cap, one-guild-per-user — this page only
 * relays its answers.
 */

const CREATE_COST = 2000;
const MEMBER_CAP = 30;

export default function GuildsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [myGuildId, setMyGuildId] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  // create sheet
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/guilds`);
      const d = await r.json();
      if (d?.success && Array.isArray(d.data)) setGuilds(d.data);
    } catch {
      /* offline — the empty state carries the page */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    findMyGuild(user?.id).then((g) => { if (alive) setMyGuildId(g?.id || null); });
    return () => { alive = false; };
  }, [user?.id]);

  // Mine pinned first, the rest in the server's order (xp desc).
  const rows = useMemo(() => {
    if (!myGuildId) return guilds;
    const mine = guilds.filter((g) => g.id === myGuildId);
    return [...mine, ...guilds.filter((g) => g.id !== myGuildId)];
  }, [guilds, myGuildId]);

  const join = async (g: GuildSummary) => {
    if (!user) return toast("Sign in to join a guild.", "error");
    if (joining) return;
    setJoining(g.id);
    try {
      const r = await fetch(`${API_URL}/api/guilds/${encodeURIComponent(g.id)}/join`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "Couldn't join that guild.", "error");
        return;
      }
      cacheGuildId(g.id);
      toast(`Welcome to ${g.name}.`, "success");
      router.push(`/guild/${encodeURIComponent(g.id)}`);
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setJoining(null);
    }
  };

  const create = async () => {
    if (!user) return toast("Sign in to found a guild.", "error");
    if (creating) return;
    const n = name.trim();
    const t = tag.trim().toUpperCase();
    if (n.length < 3 || n.length > 24) return toast("Guild names are 3-24 characters.", "error");
    if (!/^[A-Z]{2,5}$/.test(t)) return toast("Tags are 2-5 letters, like DVNC.", "error");
    setCreating(true);
    try {
      const r = await fetch(`${API_URL}/api/guilds`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: n, tag: t, description: desc.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "Couldn't found the guild.", "error");
        return;
      }
      cacheGuildId(d.data.id);
      toast(`${n} is founded. Lead it well.`, "success");
      setOpen(false);
      router.push(`/guild/${encodeURIComponent(d.data.id)}`);
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#070709] px-4 pb-32 pt-14 font-mono text-white">
        {/* the Lunar top glow — emerald here, the guilds' own colour */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(16,185,129,0.16),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl">
          {/* ── HEADER ── */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
                  <Users className="h-5 w-5 text-emerald-300" />
                </span>
                <h1 className="font-fell text-4xl text-white sm:text-5xl">Guilds</h1>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Found one, raid together — a shared board, card lending, and a name over the door.
              </p>
            </div>
            {user && !myGuildId && (
              <button type="button" onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                <Sparkles className="h-3.5 w-3.5" /> Found a guild
              </button>
            )}
            {!user && <p className="text-xs text-slate-500">Sign in to join or found one.</p>}
          </div>

          {/* ── THE GUILDS ── */}
          {!loaded ? (
            <p className="py-24 text-center text-sm text-slate-500">Reading the registry…</p>
          ) : rows.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-20 text-center">
              <Shield className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-4 text-sm text-slate-400">No guilds yet — the first banner is unclaimed.</p>
              {user && (
                <button type="button" onClick={() => setOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25">
                  <Sparkles className="h-3.5 w-3.5" /> Found the first guild
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {rows.map((g) => {
                const mine = g.id === myGuildId;
                const full = g.memberCount >= MEMBER_CAP;
                return (
                  <div key={g.id}
                    className={`group relative rounded-3xl border p-5 transition ${
                      mine ? "border-emerald-400/40 bg-emerald-500/[0.06]" : "border-white/10 bg-[#0b0b11] hover:border-white/20"
                    }`}>
                    <div className="flex items-start gap-4">
                      {g.avatar ? (
                        <img src={g.avatar} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/15" />
                      ) : (
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-900/60 text-xl font-black text-emerald-200 ring-1 ring-white/10">
                          {g.name?.[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/guild/${encodeURIComponent(g.id)}`}
                            className="truncate font-fell text-xl text-white transition hover:text-emerald-200">
                            {g.name}
                          </Link>
                          <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black tracking-widest text-emerald-300">
                            [{g.tag}]
                          </span>
                          {mine && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
                              <Check className="h-2.5 w-2.5" /> Your guild
                            </span>
                          )}
                        </div>
                        {g.description ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{g.description}</p>
                        ) : (
                          <p className="mt-1 text-xs italic text-slate-600">No words over the door yet.</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Lv {g.level}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                            full ? "border-red-400/30 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-slate-400"
                          }`}>
                            <Users className="h-3 w-3" /> {g.memberCount}/{MEMBER_CAP}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Link href={`/guild/${encodeURIComponent(g.id)}`}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:text-white">
                        Visit <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      {user && !myGuildId && !full && (
                        <button type="button" disabled={joining === g.id} onClick={() => join(g)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50">
                          {joining === g.id ? "Joining…" : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOUND A GUILD — the create sheet ── */}
        {open && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <div role="dialog" aria-modal="true" aria-label="Found a guild"
              className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0b0b11] sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-fell text-lg text-white">Found a guild</p>
                  <p className="text-[11px] text-slate-500">
                    Costs <span className="font-black text-emerald-300">{CREATE_COST.toLocaleString()} Arise Points</span> — you become its leader
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label className="text-xs font-black text-white">Name</label>
                    <span className="text-[10px] tabular-nums text-slate-600">{name.length}/24</span>
                  </div>
                  <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))}
                    placeholder="Deep Sea Vibes"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                  <p className="mt-1 text-[10px] text-slate-600">3-24 characters. Names are permanent in v1.</p>
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label className="text-xs font-black text-white">Tag</label>
                    <span className="text-[10px] tabular-nums text-slate-600">{tag.length}/5</span>
                  </div>
                  <input value={tag}
                    onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
                    placeholder="DSV"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm font-black tracking-[0.3em] text-emerald-200 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                  <p className="mt-1 text-[10px] text-slate-600">2-5 letters, shown as [{tag || "TAG"}] beside the name.</p>
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label className="text-xs font-black text-white">Description <span className="font-bold text-slate-600">(optional)</span></label>
                    <span className="text-[10px] tabular-nums text-slate-600">{desc.length}/500</span>
                  </div>
                  <textarea value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 500))}
                    rows={3} placeholder="What is this guild about?"
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40" />
                </div>

                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3.5 py-3">
                  <Diamond className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Founding charges <b className="text-emerald-300">{CREATE_COST.toLocaleString()} AP</b> the moment the guild
                    exists — if the name or tag is taken, nothing is charged. One guild per person; leave yours before founding another.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200">
                  Cancel
                </button>
                <button type="button" disabled={creating || name.trim().length < 3 || tag.length < 2} onClick={create}
                  className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                  {creating ? "Founding…" : `Found · ${CREATE_COST.toLocaleString()} AP`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
