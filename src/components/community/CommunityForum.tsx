"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, Plus, X, ImagePlus, Hash, ChevronUp, ChevronDown, MessageSquare, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import UserLink from "@/components/profile/UserLink";
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

type Post = {
  id: string;
  title?: string | null;
  tag?: string | null;
  content: string;
  mediaUrl?: string | null;
  isPinned?: boolean;
  createdAt: string;
  score?: number;
  userVote?: number;
  user?: { id: string; username: string; avatar?: string | null };
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

function TagChip({ tag, size = "sm" }: { tag: string; size?: "sm" | "xs" }) {
  const tint = TAG_TINT[tag] || ACCENT;
  return (
    <span
      className={`inline-block font-black uppercase tracking-[0.16em] ${size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"}`}
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
      // Replies come back in the same payload; the forum shows roots only.
      setPosts(Array.isArray(list) ? list.filter((p: any) => !p.parentId) : []);
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
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Community</h1>
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
                    className="flex gap-3 p-4"
                    style={{ clipPath: notch(16), background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.075)" }}>
                    {/* vote rail */}
                    <div className="flex w-12 shrink-0 flex-col items-center gap-1">
                      <button onClick={() => vote(p, 1)} aria-label="Upvote"
                        className="grid h-9 w-9 place-items-center transition hover:brightness-150"
                        style={{
                          clipPath: notch(7),
                          background: p.userVote === 1 ? `${ACCENT}33` : "rgba(255,255,255,.04)",
                          boxShadow: `inset 0 0 0 1px ${p.userVote === 1 ? ACCENT : "rgba(255,255,255,.09)"}`,
                          color: p.userVote === 1 ? ACCENT_LIT : "#64748b",
                        }}>
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-black tabular-nums" style={{ color: (p.score || 0) > 0 ? ACCENT_LIT : "#64748b" }}>
                        {p.score ?? 0}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-700">Score</span>
                      <button onClick={() => vote(p, -1)} aria-label="Downvote"
                        className="mt-0.5 grid h-9 w-9 place-items-center transition hover:brightness-150"
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
                        {p.user?.avatar ? (
                          <img src={p.user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-purple-700 text-[11px] font-black">
                            {(p.user?.username || "?")[0]?.toUpperCase()}
                          </span>
                        )}
                        {p.user?.username ? (
                          <UserLink username={p.user.username} className="text-sm font-black text-white hover:underline">
                            {p.user.username}
                          </UserLink>
                        ) : (
                          <span className="text-sm font-black text-slate-400">someone</span>
                        )}
                        {p.isPinned && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                            style={{ clipPath: notch(4), background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)", color: "#fcd34d" }}>
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        {p.tag && <TagChip tag={p.tag} size="xs" />}
                        <span className="text-[10px] font-bold text-slate-600">{ago(p.createdAt)}</span>
                      </div>

                      {p.title && <h3 className="mt-2.5 text-xl font-black leading-tight">{p.title}</h3>}
                      {p.content && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                          {p.content}
                        </p>
                      )}
                      {p.mediaUrl && (
                        <img src={p.mediaUrl} alt="" loading="lazy"
                          className="mt-3 max-h-[420px] w-auto max-w-full object-contain"
                          style={{ clipPath: notch(12) }} />
                      )}
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
