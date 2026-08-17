"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pin, Plus, X, ImagePlus, Hash, Heart, ThumbsDown, MessageSquare, Loader2,
  CornerDownRight, Send, MoreHorizontal, Pencil, Trash2,
  BarChart3, Sparkles, Clock, Flame, Search, BookOpen, Users, ShieldCheck,
  Share2, Check, HelpCircle, MessagesSquare, Calendar
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { authHeaders } from "@/lib/authToken";
import { useToast } from "@/components/ui/Toast";
import { isAdmin, isLeadDev } from "@/lib/admin";
import UserLink from "@/components/profile/UserLink";
import { UserBadgesCompact } from "@/components/profile/UserBadges";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import GuildTag from "@/components/guild/GuildTag";
import MediaPicker from "@/components/community/MediaPicker";
import MentionsTextarea from "@/components/ui/MentionsTextarea";
import MentionsInput from "@/components/ui/MentionsInput";
import MentionText from "@/components/ui/MentionText";
import { PollBuilder, PollCard, EMPTY_POLL, pollIsValid, type PollDraft, type PollData } from "@/components/community/Poll";
import { cloudinaryFit } from "@/lib/cloudinary";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const TAGS = ["General", "Discussion", "Art", "Theory", "News", "Question", "Spoiler", "Meme"] as const;

/** Topic color definitions */
const TAG_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  General: { bg: "bg-slate-500/10", border: "border-slate-500/25", text: "text-slate-300", dot: "bg-slate-400" },
  Discussion: { bg: "bg-sky-500/10", border: "border-sky-500/25", text: "text-sky-300", dot: "bg-sky-400" },
  Art: { bg: "bg-pink-500/10", border: "border-pink-500/25", text: "text-pink-300", dot: "bg-pink-400" },
  Theory: { bg: "bg-purple-500/10", border: "border-purple-500/25", text: "text-purple-300", dot: "bg-purple-400" },
  News: { bg: "bg-amber-500/10", border: "border-amber-500/25", text: "text-amber-300", dot: "bg-amber-400" },
  Question: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-300", dot: "bg-emerald-400" },
  Spoiler: { bg: "bg-rose-500/10", border: "border-rose-500/25", text: "text-rose-300", dot: "bg-rose-400" },
  Meme: { bg: "bg-orange-500/10", border: "border-orange-500/25", text: "text-orange-300", dot: "bg-orange-400" },
};

type Author = {
  id: string; username: string; avatar?: string | null;
  activeRole?: string | null; activeTag?: string | null;
  activeEffect?: string | null; activeFrame?: string | null;
  role?: string | null;
  xp?: number | null;
  equippedTitles?: string[] | null;
  cardTitle?: string | null;
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
  upvotes?: number;
  downvotes?: number;
  userVote?: number;
  user?: Author;
  poll?: PollData;
};

function ago(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TagChip({ tag, size = "sm" }: { tag: string; size?: "xs" | "sm" }) {
  const style = TAG_STYLE[tag] || TAG_STYLE.General;
  const sizeClasses = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-wider ${style.bg} ${style.border} ${style.text} ${sizeClasses}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {tag}
    </span>
  );
}

function AuthorLine({ user, blessed }: { user?: Author; blessed?: boolean }) {
  if (!user) return <span className="font-mono text-sm font-bold text-slate-400">Anonymous</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative h-9 w-9 shrink-0">
        {user.avatar ? (
          <img
            src={cloudinaryFit(user.avatar, 100)}
            alt=""
            className="relative z-10 h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-violet-700 font-mono text-xs font-black text-white ring-1 ring-white/10">
            {(user.username || "?")[0]?.toUpperCase()}
          </span>
        )}
        <AvatarDecoration frame={user.activeFrame} effect={user.activeEffect} size="md" />
      </div>

      <div className="flex min-w-0 items-center gap-1.5 font-mono">
        <UserLink
          username={user.username}
          className="truncate text-sm font-bold text-white hover:text-violet-300 transition-colors"
        />
        <GuildTag userId={user.id} size="sm" />
        <UserBadgesCompact user={user as any} />
      </div>
    </div>
  );
}

function PostMenu({
  isOwn,
  isPinned,
  canPin,
  onEdit,
  onDelete,
  onPin,
}: {
  isOwn: boolean;
  isPinned?: boolean;
  canPin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Post actions"
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-xl border border-white/10 bg-[#12121a] p-1 shadow-2xl backdrop-blur-xl font-mono">
            {canPin && (
              <button
                onClick={() => { setOpen(false); onPin(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Pin className="h-3.5 w-3.5 text-amber-400" />
                {isPinned ? "Unpin Post" : "Pin to Top"}
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => { setOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5 text-sky-400" /> Edit
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-rose-400 transition hover:bg-rose-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CommunityForum({ embedded = false }: { embedded?: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState<string>("All");
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [topics, setTopics] = useState<{ tag: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);

  const [composing, setComposing] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Post[]>>({});

  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTag, setDraftTag] = useState("General");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/comments`);
      url.searchParams.set("forum", "true");
      if (tag !== "All") url.searchParams.set("tag", tag);
      url.searchParams.set("sort", sort);
      if (user?.id) url.searchParams.set("userId", user.id);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPosts(data.data.filter((p: Post) => !p.parentId));
      }
    } catch {
      toast("Couldn't load forum posts.", "error");
    } finally {
      setLoading(false);
    }
  }, [tag, sort, user?.id, toast]);

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

  const [pinned, setPinned] = useState<Post[]>([]);
  const [pinRefresh, setPinRefresh] = useState(0);
  useEffect(() => {
    const url = new URL(`${API_URL}/api/comments`);
    url.searchParams.set("forum", "true");
    url.searchParams.set("pinned", "true");
    if (user?.id) url.searchParams.set("userId", user.id);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data)) {
          setPinned(d.data.filter((p: Post) => !p.parentId));
        }
      })
      .catch(() => {});
  }, [user?.id, posts.length, pinRefresh]);

  const idKey = posts.map((p) => p.id).join(",");
  const order = useMemo(() => {
    const pinFirst = (a: Post, b: Post) =>
      !!a.isPinned !== !!b.isPinned ? (a.isPinned ? -1 : 1) : 0;

    if (sort !== "top") return [...posts].sort(pinFirst).map((p) => p.id);
    return [...posts]
      .sort((a, b) => {
        const pin = pinFirst(a, b);
        if (pin !== 0) return pin;
        const d = (b.score || 0) - (a.score || 0);
        if (d !== 0) return d;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      })
      .map((p) => p.id);
  }, [idKey, sort, posts]);

  const ranked = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    return order.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }, [order, posts]);

  const canManage = (p: Post) =>
    !!user && (p.user?.id === user.id || isAdmin(user.username) || isLeadDev(user));

  const canPin = !!user && (isAdmin(user.username) || isLeadDev(user));

  const startEdit = (p: Post) => {
    setEditing(p.id);
    setDraftTitle(p.title || "");
    setDraftBody(p.content || "");
    setDraftTag(p.tag || "General");
  };

  const saveEdit = async (p: Post) => {
    if (!user || !draftBody.trim()) return;
    setSavingEdit(true);
    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          content: draftBody.trim(),
          title: draftTitle.trim(),
          tag: draftTag,
          mediaUrl: p.mediaUrl || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't save that.", "error");
      setEditing(null);
      toast("Post updated.", "success");
      await load();
    } catch {
      toast("Couldn't save that.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const removePost = async (p: Post) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setPosts((list) => list.filter((x) => x.id !== p.id));
    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || "Couldn't delete.");
      toast("Post removed.", "success");
      setPinRefresh((n) => n + 1);
    } catch (err: any) {
      toast(err?.message || "Couldn't delete that.", "error");
      load();
    }
  };

  const togglePin = async (p: Post) => {
    if (!user) return;
    const wasPinned = !!p.isPinned;
    setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, isPinned: !wasPinned } : x)));
    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}/pin`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || "Couldn't change pin status.");
      toast(wasPinned ? "Unpinned." : "Pinned to the top.", "success");
      load();
      setPinRefresh((n) => n + 1);
    } catch (err: any) {
      setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, isPinned: wasPinned } : x)));
      toast(err?.message || "Couldn't change pin status.", "error");
    }
  };

  const vote = async (p: Post, dir: 1 | -1) => {
    if (!user) return toast("Sign in to vote on discussions.", "error");
    const current = p.userVote || 0;
    const next = current === dir ? 0 : dir;
    const delta = next - current;

    setPosts((list) =>
      list.map((x) => {
        if (x.id !== p.id) return x;
        const upDelta = (next === 1 ? 1 : 0) - (current === 1 ? 1 : 0);
        const downDelta = (next === -1 ? 1 : 0) - (current === -1 ? 1 : 0);
        return {
          ...x,
          score: (x.score || 0) + delta,
          upvotes: Math.max(0, (x.upvotes || 0) + upDelta),
          downvotes: Math.max(0, (x.downvotes || 0) + downDelta),
          userVote: next,
        };
      })
    );

    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, value: next }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "Vote failed to save.", "error");
        load();
      }
    } catch {
      toast("Vote failed to save.", "error");
      load();
    }
  };

  const loadReplies = async (postId: string) => {
    try {
      const r = await fetch(`${API_URL}/api/comments?parentId=${postId}`);
      const d = await r.json();
      if (d.success && Array.isArray(d.data)) {
        setReplies((prev) => ({ ...prev, [postId]: d.data }));
      }
    } catch {}
  };

  return (
    <div className={`relative text-white pb-32 ${embedded ? "" : "min-h-screen px-4 pt-24"}`}>
      <div className={embedded ? "" : "mx-auto max-w-6xl"}>
        
        {/* ══ HEADER (Activity History typography: font-fell display headline) ══ */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="flex items-center gap-3 font-fell text-3xl font-bold uppercase tracking-[0.08em] text-white sm:text-4xl">
              <MessagesSquare className="h-7 w-7 shrink-0 text-violet-400" />
              Community Forum
            </h1>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/40 sm:text-xs">
              {total} active discussions across {topics.length || TAGS.length} categories
            </p>
          </div>

          <button
            onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
            className="flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/20 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-violet-200 shadow-lg shadow-violet-500/20 transition hover:bg-violet-500/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> New Discussion
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
          
          {/* ══ MAIN FEED COLUMN ══ */}
          <div className="min-w-0 space-y-6 font-mono">
            
            {/* ── PINNED HIGHLIGHTS ── */}
            {pinned.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Pin className="h-3.5 w-3.5 text-amber-400" />
                  Pinned Announcements
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pinned.map((p) => (
                    <Link
                      key={p.id}
                      href={`/community/post/${p.id}`}
                      className="group relative overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0b0b11] p-5 transition hover:border-amber-400/60 hover:bg-amber-500/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {p.tag && <TagChip tag={p.tag} size="xs" />}
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </span>
                      </div>
                      <h3 className="mt-3 truncate font-fell text-lg font-bold uppercase tracking-[0.04em] text-white group-hover:text-amber-200 transition-colors">
                        {p.title || "Untitled Announcement"}
                      </h3>
                      <p className="mt-1 text-xs text-white/40">
                        by <span className="font-bold text-white/80">{p.user?.username || "Admin"}</span> • {ago(p.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── QUICK COMPOSER BAR ── */}
            <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0">
                  {user?.avatar ? (
                    <img src={cloudinaryFit(user.avatar, 100)} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-700 text-sm font-black text-white">
                      {(user?.username || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  {user && <AvatarDecoration frame={user.activeFrame} effect={user.activeEffect} size="md" />}
                </div>

                <button
                  onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left text-xs font-bold text-white/40 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80"
                >
                  Start a discussion, share a theory, or create a poll…
                </button>

                <button
                  onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 transition hover:bg-white/10 hover:text-white"
                  title="Attach Media"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── UNIFIED FILTER & SORT TOOLBAR (Activity History Segmented Pills) ── */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0b0b11] p-3 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                {/* Horizontal topic categories */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {["All", ...TAGS].map((t) => {
                    const on = tag === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setTag(t)}
                        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-wide transition ${
                          on
                            ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                            : "border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                        }`}
                      >
                        {t !== "All" && (
                          <span className={`h-1.5 w-1.5 rounded-full ${TAG_STYLE[t]?.dot || "bg-slate-400"}`} />
                        )}
                        <span>{t === "All" ? "All Posts" : t}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sort segmented toggle */}
                <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                  <button
                    onClick={() => setSort("newest")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                      sort === "newest"
                        ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    <Clock className="h-3 w-3" /> Recent
                  </button>
                  <button
                    onClick={() => setSort("top")}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                      sort === "top"
                        ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    <Flame className="h-3 w-3" /> Top
                  </button>
                </div>
              </div>
            </div>

            {/* ── FEED POSTS LIST ── */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="mt-3 text-xs font-bold text-white/50">Loading discussions…</p>
              </div>
            ) : ranked.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0b0b11] py-20 text-center">
                <MessageSquare className="h-10 w-10 text-white/20" />
                <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">
                  {tag === "All" ? "No discussions yet" : `No posts in ${tag} yet`}
                </p>
                <p className="mt-1 text-xs text-white/40">Be the first to start a conversation!</p>
                <button
                  onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
                  className="mt-5 rounded-full border border-violet-400/40 bg-violet-500/20 px-5 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/30"
                >
                  Create Post
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {ranked.map((p) => {
                  const up = p.upvotes || 0;
                  const down = p.downvotes || 0;
                  const totalVotes = up + down;
                  const positivePercent = totalVotes > 0 ? Math.round((up / totalVotes) * 100) : 0;

                  return (
                    <motion.article
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col sm:flex-row gap-4 rounded-2xl border border-white/10 bg-[#0b0b11] p-5 shadow-xl transition hover:border-white/20"
                    >
                      {/* Left Vote Column */}
                      <div className="flex sm:flex-col items-center justify-between sm:justify-start gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1.5 sm:w-12 sm:shrink-0">
                        <button
                          onClick={() => vote(p, 1)}
                          aria-label="Upvote"
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                            p.userVote === 1
                              ? "bg-violet-500/25 text-violet-300"
                              : "text-white/40 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Heart className="h-4 w-4" fill={p.userVote === 1 ? "currentColor" : "none"} />
                        </button>

                        <span className={`text-xs font-bold tabular-nums ${
                          (p.score || 0) > 0 ? "text-violet-300" : (p.score || 0) < 0 ? "text-rose-400" : "text-white/50"
                        }`}>
                          {p.score ?? 0}
                        </span>

                        <button
                          onClick={() => vote(p, -1)}
                          aria-label="Dislike"
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                            p.userVote === -1
                              ? "bg-rose-500/25 text-rose-300"
                              : "text-white/40 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <ThumbsDown className="h-4 w-4" fill={p.userVote === -1 ? "currentColor" : "none"} />
                        </button>
                      </div>

                      {/* Main Post Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <AuthorLine user={p.user} blessed={p.blessed} />

                          <div className="flex items-center gap-2">
                            {p.isPinned && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                <Pin className="h-2.5 w-2.5" /> Pinned
                              </span>
                            )}
                            {p.tag && <TagChip tag={p.tag} size="xs" />}
                            <span className="text-[11px] text-white/40">{ago(p.createdAt)}</span>
                            {canManage(p) && (
                              <PostMenu
                                isOwn={p.user?.id === user?.id}
                                isPinned={p.isPinned}
                                canPin={canPin}
                                onEdit={() => startEdit(p)}
                                onDelete={() => removePost(p)}
                                onPin={() => togglePin(p)}
                              />
                            )}
                          </div>
                        </div>

                        {/* In-place Editing Form */}
                        {editing === p.id ? (
                          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/50 p-4">
                            <input
                              value={draftTitle}
                              onChange={(e) => setDraftTitle(e.target.value.slice(0, 80))}
                              placeholder="Title (optional)"
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none focus:border-violet-500"
                            />
                            <MentionsTextarea
                              value={draftBody}
                              onChange={(e) => setDraftBody(e.target.value.slice(0, 2000))}
                              rows={4}
                              className="w-full resize-y rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-violet-500 font-sans"
                            />
                            <div className="flex flex-wrap gap-1.5">
                              {TAGS.map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setDraftTag(t)}
                                  className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase transition ${
                                    draftTag === t
                                      ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                                      : "border-white/10 bg-white/5 text-white/50 hover:text-white"
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                onClick={() => setEditing(null)}
                                className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/10"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(p)}
                                disabled={!draftBody.trim() || savingEdit}
                                className="rounded-lg bg-violet-600 px-5 py-1.5 text-xs font-bold uppercase text-white transition hover:bg-violet-500 disabled:opacity-40"
                              >
                                {savingEdit ? "Saving…" : "Save Changes"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {p.title && (
                              <Link
                                href={`/community/post/${p.id}`}
                                className="mt-3 block font-fell text-xl sm:text-2xl font-bold uppercase tracking-[0.04em] text-white hover:text-violet-300 transition-colors"
                              >
                                {p.title}
                              </Link>
                            )}
                            {p.content && (
                              <p className="mt-2 whitespace-pre-wrap break-words font-sans text-sm sm:text-[15px] leading-relaxed text-slate-200">
                                <MentionText text={p.content} />
                              </p>
                            )}
                          </>
                        )}

                        {/* Media Attachment */}
                        {p.mediaUrl && (
                          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                            <img
                              src={p.mediaUrl}
                              alt=""
                              loading="lazy"
                              className="max-h-[440px] w-full object-contain"
                            />
                          </div>
                        )}

                        {/* Poll Widget */}
                        {p.poll && (
                          <div className="mt-3">
                            <PollCard
                              poll={p.poll}
                              onUpdate={(next) =>
                                setPosts((list) =>
                                  list.map((x) => (x.id === p.id ? { ...x, poll: { ...x.poll!, ...next } } : x))
                                )
                              }
                            />
                          </div>
                        )}

                        {/* Footer Interactions */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => {
                                const next = openThread === p.id ? null : p.id;
                                setOpenThread(next);
                                if (next && !replies[p.id]) loadReplies(p.id);
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-violet-300 transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>
                                {(replies[p.id]?.length || 0) === 0
                                  ? "Reply"
                                  : `${replies[p.id].length} replies`}
                              </span>
                            </button>

                            <Link
                              href={`/community/post/${p.id}`}
                              className="text-xs font-bold text-white/35 hover:text-white/70 transition-colors"
                            >
                              Open Thread
                            </Link>
                          </div>

                          {totalVotes > 0 && (
                            <span className="text-[11px] text-white/35">
                              {totalVotes} vote{totalVotes === 1 ? "" : "s"} • {positivePercent}% positive
                            </span>
                          )}
                        </div>

                        {/* Inline Thread Replies */}
                        <AnimatePresence>
                          {openThread === p.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-4 space-y-3 border-l-2 border-violet-500/30 pl-4"
                            >
                              {(replies[p.id] || []).map((r) => (
                                <div key={r.id} className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-black/30 p-3">
                                  <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-violet-400" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <AuthorLine user={r.user} blessed={r.blessed} />
                                      <span className="text-[10px] text-white/40">{ago(r.createdAt)}</span>
                                      {canManage(r) && (
                                        <PostMenu
                                          isOwn={r.user?.id === user?.id}
                                          canPin={false}
                                          onEdit={() => startEdit(r)}
                                          onDelete={() => removePost(r)}
                                          onPin={() => {}}
                                        />
                                      )}
                                    </div>
                                    <p className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-300">
                                      <MentionText text={r.content} />
                                    </p>
                                  </div>
                                </div>
                              ))}
                              <ReplyBox postId={p.id} onDone={() => loadReplies(p.id)} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </div>

          {/* ══ RIGHT SIDEBAR ══ */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start font-mono">
            
            {/* Topic Channels Box */}
            <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Hash className="h-4 w-4 text-violet-400" /> Topics & Channels
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">
                  {TAGS.length + 1}
                </span>
              </div>

              <div className="space-y-1">
                {[{ tag: "All", count: total }, ...topics].map((t) => {
                  const on = tag === t.tag || (t.tag === "All" && tag === "All");
                  const dotColor = t.tag === "All" ? "bg-violet-400" : TAG_STYLE[t.tag]?.dot || "bg-slate-400";
                  return (
                    <button
                      key={t.tag}
                      onClick={() => setTag(t.tag)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                        on
                          ? "border border-violet-400/40 bg-violet-500/15 text-violet-200 shadow-sm"
                          : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                        <span>{t.tag === "All" ? "All Discussions" : t.tag}</span>
                      </div>
                      <span className="text-[11px] text-white/40 tabular-nums">
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Community Rules & Guidelines */}
            <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-5 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
                <ShieldCheck className="h-4 w-4 text-violet-400" /> Community Guidelines
              </div>
              <ul className="mt-3 space-y-2 text-xs text-white/40">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 font-bold">•</span>
                  <span>Be respectful to other readers and creators.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 font-bold">•</span>
                  <span>Tag spoilers appropriately to avoid ruining plotlines.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 font-bold">•</span>
                  <span>No spamming, advertising, or toxic behavior.</span>
                </li>
              </ul>
            </div>

            {/* Quick Links */}
            <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-5 shadow-xl text-xs">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-white/40 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" /> Da Vinci Hub
              </div>
              <div className="space-y-2">
                <Link
                  href="/leaderboard"
                  className="flex items-center justify-between rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span>Leaderboards</span>
                  <span className="text-white/30">→</span>
                </Link>
                <Link
                  href="/guilds"
                  className="flex items-center justify-between rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span>Guilds & Teams</span>
                  <span className="text-white/30">→</span>
                </Link>
                <Link
                  href="/marketplace"
                  className="flex items-center justify-between rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span>Marketplace</span>
                  <span className="text-white/30">→</span>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ══ COMPOSER MODAL ══ */}
      <AnimatePresence>
        {composing && (
          <Composer
            onClose={() => setComposing(false)}
            onPosted={() => {
              setComposing(false);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Inline Reply Box */
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
    <div className="flex items-center gap-2 pt-2 font-mono">
      <MentionsInput
        value={text}
        onChange={(v) => setText(v.slice(0, 800))}
        onSubmit={send}
        placeholder="Write a reply…"
        className="w-full min-w-0 rounded-xl border border-white/10 bg-black/60 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-500"
      />
      <button
        onClick={send}
        disabled={!text.trim() || busy}
        aria-label="Send reply"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-30"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Full Post Composer Modal */
function Composer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [tag, setTag] = useState<string>("General");
  const [busy, setBusy] = useState(false);
  const [poll, setPoll] = useState<PollDraft | null>(null);

  const canPost = (content.trim().length > 0 || mediaUrl.trim().length > 0 || pollIsValid(poll)) && !busy;

  const submit = async () => {
    if (!user) return toast("Sign in to post.", "error");
    if (!canPost) return;
    if (poll && !pollIsValid(poll)) {
      return toast("A poll needs a question and at least two options.", "error");
    }
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
          poll: pollIsValid(poll)
            ? {
                question: poll!.question.trim(),
                options: poll!.options.map((o) => o.trim()).filter(Boolean),
                closesInHours: poll!.closesInHours,
              }
            : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't post.", "error");
      toast("Discussion created.", "success");
      onPosted();
    } catch {
      toast("Couldn't post.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11] p-6 shadow-2xl font-mono">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <h3 className="font-fell text-xl font-bold uppercase tracking-[0.06em] text-white">Create New Discussion</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Topic Picker */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
              Select Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                    tag === t
                      ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                      : "border-white/10 bg-white/5 text-white/50 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="Discussion Title"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base font-bold text-white placeholder:text-white/30 outline-none focus:border-violet-500"
            />
          </div>

          {/* Content Body */}
          <div>
            <MentionsTextarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 3000))}
              placeholder="What are your thoughts? Use @ to mention users…"
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500 font-sans"
            />
          </div>

          {/* Media Attach */}
          <MediaPicker url={mediaUrl} onChange={setMediaUrl} />

          {/* Poll Builder */}
          <PollBuilder value={poll} onChange={setPoll} />
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs text-white/40">
            {content.length}/3000 chars
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-bold text-white/70 hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canPost}
              className="flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-600 px-6 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
