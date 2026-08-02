"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pin, Plus, X, ImagePlus, Hash, ChevronUp, ChevronDown, MessageSquare, Loader2,
  Crown, Shield, Star, Sparkles, Zap, CornerDownRight, Send,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import { isAdmin, isLeadDev } from "@/lib/admin";
import UserLink from "@/components/profile/UserLink";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { effectNameClass } from "@/lib/effectTheme";
import { ACCENT, ACCENT_LIT, notch } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * COMMUNITY FORUM.
 *
 * Standalone posts — the ones not attached to an anime, manhwa or novel — with
 * a headline, a topic and a vote rail. It reads `?forum=true` so the feed is
 * the forum and not every chapter comment on the site.
 *
 * Reels are deliberately absent. Polls are too: they need their own model
 * (options, one vote per user, a close time) rather than being faked in the
 * post body, so they are a separate piece of work rather than a button that
 * lies.
 */

export const TAGS = ["General", "Discussion", "Art", "Theory", "News", "Question", "Spoiler", "Meme"] as const;

/** Each topic gets its own colour so the feed is scannable by shape and hue. */
const TAG_TINT: Record<string, string> = {
  General: "#94a3b8",
  Discussion: "#60a5fa",
  Art: "#f472b6",
  Theory: "#a78bfa",
  News: "#fbbf24",
  Question: "#34d399",
  Spoiler: "#f87171",
  Meme: "#fb923c",
};

type Author = {
  id: string; username: string; avatar?: string | null;
  activeRole?: string | null; activeTag?: string | null;
  activeEffect?: string | null; activeFrame?: string | null;
};

type Post = {
  id: string;
  parentId?: string | null;
  title?: string | null;
  tag?: string | null;
  content: string;
  mediaUrl?: string | null;
  isPinned?: boolean;
  blessed?: boolean;
  createdAt: string;
  score?: number;
  userVote?: number;
  user?: Author;
};

/**
 * The author line, with the cosmetics people actually paid for.
 *
 * The forum looked bland partly because it threw all of that away: everyone
 * rendered as a plain grey name regardless of frame, effect, role or tag. Those
 * are the whole point of the shop, and a feed is where they get seen.
 */
function AuthorLine({ user, blessed }: { user?: Author; blessed?: boolean }) {
  if (!user) return <span className="text-sm font-black text-slate-400">someone</span>;
  const lead = isLeadDev({ username: user.username } as any);
  const admin = !lead && isAdmin(user.username);
  return (
    <>
      {/* EffectLayer draws at NEGATIVE insets (-inset-1 to -inset-2), so it
          deliberately bleeds outside the avatar. On a 36px avatar that spilled
          roughly 8px past the edge and landed on the username. The wrapper is
          sized with that bleed budgeted in — mr-1 gives the effect its own
          room instead of borrowing the name's. */}
      {/* The avatar MUST sit above the effect. Several effects render at z-20
          (the particle ones especially), so an image with no stacking context
          of its own gets painted straight over — which is why faces vanished
          behind a coloured disc. `relative z-10` is what every other avatar on
          the site already does; this one was missing it.

          size="lg" asks for the REAL effect rather than the cheap single-glow
          stand-in. They carry their own rAF pause on an IntersectionObserver,
          so avatars scrolled out of view stop animating and a long feed does
          not run thirty loops at once. */}
      <div className="relative mr-1.5 h-11 w-11 shrink-0">
        {user.avatar ? (
          <img src={user.avatar} alt=""
            className="relative z-10 h-11 w-11 rounded-full object-cover ring-1 ring-black/60" />
        ) : (
          <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-purple-700 text-sm font-black ring-1 ring-black/60">
            {(user.username || "?")[0]?.toUpperCase()}
          </span>
        )}
        <AvatarDecoration frame={user.activeFrame} effect={user.activeEffect} size="lg" />
      </div>
      <UserLink username={user.username}
        className={`text-[15px] font-black hover:underline ${effectNameClass(user.activeEffect) || "text-white"}`}>
        {user.username}
      </UserLink>
      {lead ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-[0_0_14px_rgba(168,85,247,.55)]">
          <Crown className="h-2.5 w-2.5" /> Lead Dev
        </span>
      ) : admin ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
          <Shield className="h-2.5 w-2.5" /> Staff
        </span>
      ) : user.activeRole === "role_watcher" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-300">
          <Shield className="h-2.5 w-2.5" /> Watcher
        </span>
      ) : user.activeRole === "role_elite" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-300">
          <Star className="h-2.5 w-2.5" /> Elite
        </span>
      ) : null}
      {user.activeTag === "tag_og" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300">
          <Zap className="h-2.5 w-2.5" /> OG
        </span>
      )}
      {user.activeTag === "tag_weeb" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-pink-300">
          <Sparkles className="h-2.5 w-2.5" /> Weeb Lord
        </span>
      )}
      {blessed && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
          <Sparkles className="h-2.5 w-2.5" /> Blessed
        </span>
      )}
    </>
  );
}

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

function TagChip({ tag, size = "sm" }: { tag: string; size?: "sm" | "xs" }) {
  const tint = TAG_TINT[tag] || ACCENT;
  return (
    <span
      className={`inline-block font-black uppercase tracking-[0.16em] ${size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
      style={{ clipPath: notch(5), background: `${tint}1f`, boxShadow: `inset 0 0 0 1px ${tint}66`, color: tint }}
    >
      {tag}
    </span>
  );
}

export default function CommunityForum({ embedded = false }: { embedded?: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Record<string, Post[]>>({});
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [topics, setTopics] = useState<{ tag: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [tag, setTag] = useState<string>("All");
  const [sort, setSort] = useState<"top" | "newest">("top");
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/comments`);
      url.searchParams.set("forum", "true");
      url.searchParams.set("sort", sort);
      url.searchParams.set("limit", "30");
      if (tag !== "All") url.searchParams.set("tag", tag);
      if (user?.id) url.searchParams.set("userId", user.id);
      const r = await fetch(url.toString());
      const d = await r.json();
      const list = Array.isArray(d?.data) ? d.data : d?.data?.comments;
      // Replies arrive in the same payload as their roots. Keep BOTH and split
      // them here — the thread is the point of a forum, and dropping the
      // children was why posts looked like a wall nobody could answer.
      const all: Post[] = Array.isArray(list) ? list : [];
      setPosts(all.filter((p) => !p.parentId));
      const map: Record<string, Post[]> = {};
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
  }, [tag, sort, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API_URL}/api/comments/topics`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        setTopics(d.data?.topics || []);
        setTotal(d.data?.total || 0);
      })
      .catch(() => {});
  }, [posts.length]);

  const pinned = useMemo(() => posts.filter((p) => p.isPinned).slice(0, 2), [posts]);

  const vote = async (post: Post, value: number) => {
    if (!user) return toast("Sign in to vote.", "error");
    // Optimistic: a vote that waits for a round trip feels broken.
    const next = post.userVote === value ? 0 : value;
    setPosts((ps) =>
      ps.map((p) =>
        p.id === post.id
          ? { ...p, userVote: next, score: (p.score || 0) - (p.userVote || 0) + next }
          : p
      )
    );
    try {
      await fetch(`${API_URL}/api/comments/${post.id}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, value: next }),
      });
    } catch {
      load(); // put the truth back
    }
  };

  return (
    // `embedded` drops the page chrome so this can sit inside the existing
    // community page's container without stacking a second full-height
    // background and a second lot of top padding under the navbar.
    <div className={`relative text-white ${embedded ? "" : "min-h-screen px-4 pb-24 pt-24"}`}
      style={embedded ? undefined : {
        background:
          "radial-gradient(80% 45% at 15% -5%, rgba(120,86,196,.18), transparent 60%)," +
          "linear-gradient(#0a0713, #06040e 60%, #050309)",
      }}>
      <div className={embedded ? "" : "mx-auto max-w-6xl"}>
        {/* ── header ── */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* font-fell is the site's display face — the one the logo uses.
                A plain sans heading read as a form label rather than a place. */}
            <h1 className="font-fell text-4xl font-bold uppercase tracking-[0.14em] md:text-5xl"
              style={{
                background: `linear-gradient(100deg, #fff 10%, ${ACCENT_LIT} 55%, ${ACCENT} 90%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: `drop-shadow(0 2px 18px ${ACCENT}55)`,
              }}>
              Community
            </h1>
            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{ clipPath: notch(6), background: `${ACCENT}22`, boxShadow: `inset 0 0 0 1px ${ACCENT}66`, color: ACCENT_LIT }}>
              Forum
            </span>
          </div>
          <button onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115"
            style={{ clipPath: "polygon(11px 0, 100% 0, calc(100% - 11px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* ══ MAIN COLUMN ══ */}
          <div className="min-w-0">
            {/* pinned */}
            {pinned.length > 0 && (
              <>
                <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  <Pin className="h-3 w-3" /> Pinned posts
                </p>
                <div className="mb-7 grid gap-3 sm:grid-cols-2">
                  {pinned.map((p) => (
                    <div key={p.id} className="relative overflow-hidden px-5 py-5"
                      style={{ clipPath: notch(16), background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                      {/* the headline ghosted huge behind itself — cheap depth,
                          and it fills a card that would otherwise be mostly air */}
                      <span aria-hidden
                        className="pointer-events-none absolute right-2 top-3 select-none whitespace-nowrap text-4xl font-black uppercase tracking-tight text-white/[0.045]">
                        {p.title || "Post"}
                      </span>
                      <div className="relative flex items-center gap-2">
                        {p.tag && <TagChip tag={p.tag} size="xs" />}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
                          style={{ clipPath: notch(4), background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)", color: "#fcd34d" }}>
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </span>
                      </div>
                      <h3 className="relative mt-3 truncate text-lg font-black">{p.title || "Untitled"}</h3>
                      <p className="relative mt-1 text-xs text-slate-500">
                        by <span className="font-bold text-slate-300">{p.user?.username || "someone"}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* composer bar */}
            <button onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
              className="mb-6 flex w-full items-center gap-3 px-4 py-4 text-left transition hover:brightness-125"
              style={{ clipPath: notch(14), background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-purple-700 text-sm font-black">
                  {(user?.username || "?")[0]?.toUpperCase()}
                </span>
              )}
              <span className="flex-1 text-sm text-slate-500">Create a post…</span>
              <ImagePlus className="h-4 w-4 text-slate-600" />
            </button>

            {/* sort */}
            <div className="mb-4 flex items-center justify-end gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">Sort</span>
              {([["top", "Top"], ["newest", "Recent"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                    sort === k ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                  style={{
                    clipPath: "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)",
                    background: sort === k ? `${ACCENT}33` : "rgba(255,255,255,.04)",
                    boxShadow: `inset 0 0 0 1px ${sort === k ? `${ACCENT}99` : "rgba(255,255,255,.08)"}`,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* tag pills */}
            <div className="mb-6 flex flex-wrap gap-2">
              {["All", ...TAGS].map((t) => {
                const on = tag === t;
                const tint = t === "All" ? ACCENT : TAG_TINT[t];
                return (
                  <button key={t} onClick={() => setTag(t)}
                    className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition"
                    style={{
                      clipPath: notch(7),
                      background: on ? `${tint}30` : "rgba(255,255,255,.03)",
                      boxShadow: `inset 0 0 0 1px ${on ? tint : "rgba(255,255,255,.08)"}`,
                      color: on ? "#fff" : "#64748b",
                    }}>
                    {t}
                  </button>
                );
              })}
            </div>

            {/* feed */}
            {loading ? (
              <div className="grid place-items-center py-20 text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="py-20 text-center"
                style={{ clipPath: notch(16), background: "rgba(255,255,255,.02)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
                <MessageSquare className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">
                  {tag === "All" ? "Nothing posted yet. Start it." : `No posts tagged ${tag} yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <motion.article key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 p-5"
                    style={{ clipPath: notch(16), background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.075)" }}>
                    {/* vote rail */}
                    <div className="flex w-14 shrink-0 flex-col items-center gap-1">
                      <button onClick={() => vote(p, 1)} aria-label="Upvote"
                        className="grid h-10 w-10 place-items-center transition hover:brightness-150"
                        style={{
                          clipPath: notch(7),
                          background: p.userVote === 1 ? `${ACCENT}33` : "rgba(255,255,255,.04)",
                          boxShadow: `inset 0 0 0 1px ${p.userVote === 1 ? ACCENT : "rgba(255,255,255,.09)"}`,
                          color: p.userVote === 1 ? ACCENT_LIT : "#64748b",
                        }}>
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <span className="text-base font-black tabular-nums" style={{ color: (p.score || 0) > 0 ? ACCENT_LIT : "#64748b" }}>
                        {p.score ?? 0}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-700">Score</span>
                      <button onClick={() => vote(p, -1)} aria-label="Downvote"
                        className="mt-0.5 grid h-10 w-10 place-items-center transition hover:brightness-150"
                        style={{
                          clipPath: notch(7),
                          background: p.userVote === -1 ? "rgba(244,63,94,.22)" : "rgba(255,255,255,.04)",
                          boxShadow: `inset 0 0 0 1px ${p.userVote === -1 ? "#f43f5e" : "rgba(255,255,255,.09)"}`,
                          color: p.userVote === -1 ? "#fda4af" : "#64748b",
                        }}>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    {/* body */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AuthorLine user={p.user} blessed={p.blessed} />
                        {p.isPinned && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                            style={{ clipPath: notch(4), background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)", color: "#fcd34d" }}>
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        {p.tag && <TagChip tag={p.tag} size="xs" />}
                        <span className="text-[11px] font-bold text-slate-500">{ago(p.createdAt)}</span>
                      </div>

                      {p.title && <h3 className="mt-3 text-2xl font-black leading-tight">{p.title}</h3>}
                      {p.content && (
                        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-slate-200">
                          {p.content}
                        </p>
                      )}
                      {p.mediaUrl && (
                        <img src={p.mediaUrl} alt="" loading="lazy"
                          className="mt-3 max-h-[420px] w-auto max-w-full object-contain"
                          style={{ clipPath: notch(12) }} />
                      )}

                      {/* ── THREAD ── a forum post you can't answer is a notice board */}
                      <button
                        onClick={() => setOpenThread(openThread === p.id ? null : p.id)}
                        className="mt-3.5 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition hover:text-white">
                        <MessageSquare className="h-3 w-3" />
                        {(replies[p.id]?.length || 0) === 0
                          ? "Reply"
                          : `${replies[p.id].length} ${replies[p.id].length === 1 ? "reply" : "replies"}`}
                      </button>

                      <AnimatePresence initial={false}>
                        {openThread === p.id && (
                          <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="mt-3 space-y-2.5 border-l pl-3"
                            style={{ borderColor: `${ACCENT}44` }}>
                            {(replies[p.id] || []).map((r) => (
                              <div key={r.id} className="flex items-start gap-2.5">
                                <CornerDownRight className="mt-1.5 h-3 w-3 shrink-0 text-slate-700" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <AuthorLine user={r.user} blessed={r.blessed} />
                                    <span className="text-[10px] font-bold text-slate-600">{ago(r.createdAt)}</span>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                                    {r.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <ReplyBox postId={p.id} onDone={load} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </div>

          {/* ══ TOPICS SIDEBAR ══ */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="p-4" style={{ clipPath: notch(18), background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                  <Hash className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Topics
                </span>
                <span className="text-[11px] font-black tabular-nums text-slate-600">{TAGS.length + 1}</span>
              </div>
              <div className="space-y-1">
                {[{ tag: "All", count: total }, ...topics].map((t) => {
                  const on = tag === t.tag || (t.tag === "All" && tag === "All");
                  const tint = t.tag === "All" ? ACCENT : TAG_TINT[t.tag];
                  return (
                    <button key={t.tag} onClick={() => setTag(t.tag)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition"
                      style={{
                        clipPath: notch(9),
                        background: on ? `${tint}22` : "transparent",
                        boxShadow: on ? `inset 0 0 0 1px ${tint}88` : "none",
                      }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tint }} />
                      <span className={`flex-1 truncate text-sm font-bold ${on ? "text-white" : "text-slate-400"}`}>
                        {t.tag === "All" ? "All Posts" : t.tag}
                      </span>
                      <span className="shrink-0 text-xs font-black tabular-nums text-slate-600">{t.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {composing && (
          <Composer
            onClose={() => setComposing(false)}
            onPosted={() => { setComposing(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Inline reply. Kept small on purpose — a thread reply isn't a new post. */
function ReplyBox({ postId, onDone }: { postId: string; onDone: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!user) return toast("Sign in to reply.", "error");
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, content: text.trim(), parentId: postId }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't reply.", "error");
      setText("");
      onDone();
    } catch {
      toast("Couldn't reply.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 800))}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder="Write a reply…"
        className="min-w-0 flex-1 bg-black/45 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
        style={{ clipPath: notch(8), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.11)" }}
      />
      <button onClick={send} disabled={!text.trim() || busy} aria-label="Send reply"
        className="grid h-9 w-9 shrink-0 place-items-center text-white transition hover:brightness-115 disabled:opacity-30"
        style={{ clipPath: notch(7), background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
        <Send className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Create New Post. Post only — reels and polls are not this component's job. */
function Composer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [tag, setTag] = useState<string>("General");
  const [busy, setBusy] = useState(false);

  const canPost = (content.trim().length > 0 || mediaUrl.trim().length > 0) && !busy;

  const submit = async () => {
    if (!user) return toast("Sign in to post.", "error");
    if (!canPost) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: user.id,
          title: title.trim() || undefined,
          content: content.trim(),
          tag,
          mediaUrl: mediaUrl.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't post.", "error");
      toast("Posted.", "success");
      onPosted();
    } catch {
      toast("Couldn't post.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/85 p-4 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col p-6"
        style={{ clipPath: notch(22), background: "linear-gradient(165deg, #16102b, #0c0818)", boxShadow: "inset 0 0 0 1px rgba(162,116,255,.35)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex shrink-0 items-center justify-between">
          <h2 className="text-xl font-black">Create New Post</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-sm font-black">Title <span className="font-bold text-slate-600">(optional)</span></label>
            <span className="text-[11px] tabular-nums text-slate-600">{title.length}/30</span>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))}
            placeholder="Enter post title…"
            className="mb-4 w-full bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
            style={{ clipPath: notch(10), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />

          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-sm font-black">Content</label>
            <span className="text-[11px] tabular-nums text-slate-600">{content.length}/1500</span>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 1500))}
            placeholder="What's on your mind?" rows={6}
            className="mb-3 w-full resize-y bg-black/50 px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-slate-600"
            style={{ clipPath: notch(10), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />

          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="mb-5 w-full bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
            style={{ clipPath: notch(10), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />

          <label className="mb-2 block text-sm font-black">Tag</label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => {
              const on = tag === t;
              const tint = TAG_TINT[t];
              return (
                <button key={t} onClick={() => setTag(t)}
                  className="px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition"
                  style={{
                    clipPath: notch(6),
                    background: on ? `${tint}30` : "rgba(255,255,255,.04)",
                    boxShadow: `inset 0 0 0 1px ${on ? tint : "rgba(255,255,255,.1)"}`,
                    color: on ? "#fff" : "#64748b",
                  }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex shrink-0 justify-end gap-2">
          <button onClick={onClose}
            className="px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:brightness-125"
            style={{ clipPath: notch(9), background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!canPost}
            className="px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115 disabled:opacity-35"
            style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
            {busy ? "Posting…" : "Create Post"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
