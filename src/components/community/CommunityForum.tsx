"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pin, Plus, X, ImagePlus, Hash, Heart, ThumbsDown, MessageSquare, Loader2,
  CornerDownRight, Send, MoreHorizontal, Pencil, Trash2,
  BarChart3,
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
import { PollBuilder, PollCard, EMPTY_POLL, pollIsValid, type PollDraft, type PollData } from "@/components/community/Poll";
import { effectNameClass } from "@/lib/effectTheme";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * THE FORUM HAS ITS OWN PALETTE AND ITS OWN CORNERS.
 *
 * It used to import ACCENT from the card game's gacha kit and cut every
 * surface with notch() — angled polygon corners in violet. That is the right
 * language for a summon screen and the wrong one for a place people read and
 * argue in: the notches make every card look like a ticket stub, and the
 * violet fights the per-topic tag colours that are supposed to be the only
 * hues on the page.
 *
 * Indigo and plain rounded corners instead. Defined HERE rather than added to
 * the shared kit, because the card game should keep its own look — this is a
 * deliberate divergence, not a global restyle.
 */
const F_ACCENT = "#6366f1";
const F_ACCENT_LIT = "#c7d2fe";

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
  /** The account's real role column — authoritative over the username list. */
  role?: string | null;
  /** Drives the Heart Cultivation rank chip. */
  xp?: number | null;
  /** Worn titles, wearer-ordered, plus the legacy single-title fallback. */
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
  /** Loves and dislikes, tallied separately from the net score. The server has
   *  always sent both (shapeComment computes them); the forum simply never
   *  declared them, so the rail could show a net number and nothing else. */
  upvotes?: number;
  downvotes?: number;
  userVote?: number;
  user?: Author;
  poll?: PollData;
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
      {/* Guild first, decorations after: the tag says who someone stands with,
          which reads before the things they've equipped. min-w-0 + truncate on
          the name because the chip is shrink-0 — the name is what yields when
          the row runs out of width. */}
      <span className="flex min-w-0 items-center gap-1.5">
        <UserLink username={user.username}
          className={`min-w-0 truncate text-[15px] font-black hover:underline ${effectNameClass(user.activeEffect) || "text-white"}`}>
          {user.username}
        </UserLink>
        <GuildTag userId={user.id} size="sm" />
      </span>
      {/* Role, rank and worn titles as icon squares. The full wording lives in
          each badge's tooltip — spelled out, "KEEPER OF THE FOUNDATION" beside
          every post pushed the timestamp onto its own line and made the badge
          strip louder than the post. */}
      <UserBadgesCompact user={user} blessed={blessed} />
    </>
  );
}

/**
 * The per-post menu. Staff see the same two actions on anyone's post, with a
 * line saying so — moderating quietly, in a UI identical to editing your own,
 * is how someone deletes a member's post thinking it was theirs.
 */
function PostMenu({ isOwn, isPinned, canPin, onEdit, onDelete, onPin }: {
  isOwn: boolean;
  isPinned?: boolean;
  /** Staff only. The server gates this too — this just decides whether to draw it. */
  canPin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Deferred so the click that OPENED it doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", close); };
  }, [open]);

  return (
    <span className="relative ml-auto">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Post options"
        className={`grid h-7 w-7 place-items-center rounded-full transition ${
          open ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <span className="absolute right-0 top-full z-30 mt-1.5 block w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0f0f16] py-1 shadow-2xl">
          {!isOwn && (
            <span className="block px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/80">
              Moderating
            </span>
          )}
          {canPin && (
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onPin(); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition hover:bg-amber-400/10 ${
                isPinned ? "text-amber-300" : "text-slate-300 hover:text-amber-200"}`}>
              <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
              {isPinned ? "Unpin post" : "Pin post"}
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </span>
      )}
    </span>
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
  const tint = TAG_TINT[tag] || F_ACCENT;
  return (
    <span
      className={`inline-block font-black uppercase tracking-[0.16em] ${size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
      style={{ borderRadius: 5, background: `${tint}1f`, boxShadow: `inset 0 0 0 1px ${tint}66`, color: tint }}
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
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTag, setDraftTag] = useState<string>("General");
  const [savingEdit, setSavingEdit] = useState(false);
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

  /**
   * PINNED POSTS come from their own request, not from whatever landed in
   * page one. Filtering the loaded page meant a pin that fell outside the
   * first 30 rows — or that the active tag filtered out — silently vanished
   * from the shelf, and pinned posts also rendered TWICE, once on the shelf
   * and again in the feed below.
   */
  const [pinned, setPinned] = useState<Post[]>([]);
  // Bumped after a pin/unpin so the shelf refetches — the feed's own reload
  // doesn't necessarily change posts.length, so nothing else would.
  const [pinRefresh, setPinRefresh] = useState(0);
  useEffect(() => {
    const url = new URL(`${API_URL}/api/comments`);
    url.searchParams.set("forum", "true");
    url.searchParams.set("pinned", "true");
    if (user?.id) url.searchParams.set("userId", user.id);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => { if (d?.success && Array.isArray(d.data)) setPinned(d.data.filter((p: Post) => !p.parentId)); })
      .catch(() => {});
  }, [user?.id, posts.length, pinRefresh]);

  /**
   * Rank by NET score — upvotes minus downvotes — with pinned posts held on top
   * and recency breaking ties.
   *
   * Ordering is recomputed only when the SET of posts changes, never when a
   * score changes. That distinction is the whole point: votes here are
   * optimistic, so sorting on score directly would rip the post out from under
   * your cursor the instant you clicked it, and a second click would land on
   * whatever slid into its place. This way your vote shows immediately, the
   * number moves, and the list re-ranks on the next load.
   */
  const idKey = posts.map((p) => p.id).join(",");
  const order = useMemo(() => {
    /**
     * PINNED LEADS EVERY SORT. Not just Top — that is what pinning means
     * here, and it is also the only way to reach a pinned post's menu:
     * the shelf cards are links, so the Unpin action lives on the feed
     * card. Drop pinned posts out of the feed and a pin becomes permanent.
     *
     * Sort is stable in JS, so on Recent this preserves the server's
     * chronological order underneath the pinned block rather than
     * re-ranking it — an explicit "Recent" still reads as recent.
     */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, sort]);

  // Render in ranked order but read LIVE post objects, so an optimistic score
  // updates in place without moving anything.
  const ranked = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    return order.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }, [order, posts]);

  /**
   * Who may edit or delete a post. Mirrors the server, which decides from the
   * VERIFIED token — this only decides whether to draw the button, so a wrong
   * answer here is a cosmetic bug rather than a hole.
   */
  const canManage = (p: Post) =>
    !!user && (p.user?.id === user.id || isAdmin(user.username) || isLeadDev(user));

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

  /** Staff only, and the server checks the token independently. */
  const canPin = !!user && (isAdmin(user.username) || isLeadDev(user));

  /**
   * Pin or unpin. The forum could SHOW pinned posts but never had a control
   * to create one — the only pin toggle in the app lived on media comment
   * threads, so a forum post could only be pinned from outside the forum.
   */
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
      if (!r.ok || !d.success) throw new Error(d.message || "Couldn't change the pin.");
      toast(wasPinned ? "Unpinned." : "Pinned to the top.", "success");
      load();          // refresh the feed ordering
      setPinRefresh((n) => n + 1); // and the shelf
    } catch (err: any) {
      setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, isPinned: wasPinned } : x)));
      toast(err?.message || "Couldn't change the pin.", "error");
    }
  };

  const removePost = async (p: Post) => {
    if (!user) return;
    // A delete takes the replies with it and cannot be undone, so it asks.
    const count = replies[p.id]?.length || 0;
    const warn = count > 0
      ? `Delete this post and its ${count} ${count === 1 ? "reply" : "replies"}? This can't be undone.`
      : "Delete this post? This can't be undone.";
    if (!window.confirm(warn)) return;
    try {
      const r = await fetch(`${API_URL}/api/comments/${p.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok || !d.success) return toast(d.message || "Couldn't delete that.", "error");
      toast("Post deleted.", "success");
      await load();
    } catch {
      toast("Couldn't delete that.", "error");
    }
  };

  const vote = async (post: Post, value: number) => {
    if (!user) return toast("Sign in to vote.", "error");
    // Optimistic: a vote that waits for a round trip feels broken.
    const next = post.userVote === value ? 0 : value;
    setPosts((ps) =>
      ps.map((p) => {
        if (p.id !== post.id) return p;
        const was = p.userVote || 0;
        // The two tallies move independently of the net score, because the rail
        // now shows all three. Each is adjusted by whether THAT side was held
        // before and is held after — a switch from love to dislike has to
        // decrement one and increment the other, not just shift the net.
        const step = (side: number) => (next === side ? 1 : 0) - (was === side ? 1 : 0);
        return {
          ...p,
          userVote: next,
          score: (p.score || 0) - was + next,
          upvotes: Math.max(0, (p.upvotes || 0) + step(1)),
          downvotes: Math.max(0, (p.downvotes || 0) + step(-1)),
        };
      })
    );
    try {
      const r = await fetch(`${API_URL}/api/comments/${post.id}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, value: next }),
      });
      // The response was never read, so a REJECTED vote looked exactly like a
      // successful one: the optimistic state stayed on screen until something
      // reloaded, and then silently undid itself. A vote that un-votes itself
      // a minute later is the worst version of this to debug from the outside.
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        toast(d?.message || "That vote didn't save.", "error");
        load();
      }
    } catch {
      toast("That vote didn't save.", "error");
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
                background: `linear-gradient(100deg, #fff 10%, ${F_ACCENT_LIT} 55%, ${F_ACCENT} 90%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: `drop-shadow(0 2px 18px ${F_ACCENT}55)`,
              }}>
              Community
            </h1>
            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{ borderRadius: 6, background: `${F_ACCENT}22`, boxShadow: `inset 0 0 0 1px ${F_ACCENT}66`, color: F_ACCENT_LIT }}>
              Forum
            </span>
          </div>
          <button onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115"
            style={{ clipPath: "polygon(11px 0, 100% 0, calc(100% - 11px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${F_ACCENT})` }}>
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
                    <Link key={p.id} href={`/community/post/${p.id}`}
                      className="relative block overflow-hidden px-5 py-5 text-left transition hover:brightness-125"
                      style={{ borderRadius: 16, background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                      {/* the headline ghosted huge behind itself — cheap depth,
                          and it fills a card that would otherwise be mostly air */}
                      <span aria-hidden
                        className="pointer-events-none absolute right-2 top-3 select-none whitespace-nowrap text-4xl font-black uppercase tracking-tight text-white/[0.045]">
                        {p.title || "Post"}
                      </span>
                      <div className="relative flex items-center gap-2">
                        {p.tag && <TagChip tag={p.tag} size="xs" />}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
                          style={{ borderRadius: 4, background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)", color: "#fcd34d" }}>
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </span>
                      </div>
                      <h3 className="relative mt-3 truncate text-lg font-black">{p.title || "Untitled"}</h3>
                      <p className="relative mt-1 text-xs text-slate-500">
                        by <span className="font-bold text-slate-300">{p.user?.username || "someone"}</span>
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* composer bar */}
            <button onClick={() => (user ? setComposing(true) : toast("Sign in to post.", "error"))}
              className="mb-6 flex w-full items-center gap-3 px-4 py-4 text-left transition hover:brightness-125"
              style={{ borderRadius: 14, background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }}>
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
                    background: sort === k ? `${F_ACCENT}33` : "rgba(255,255,255,.04)",
                    boxShadow: `inset 0 0 0 1px ${sort === k ? `${F_ACCENT}99` : "rgba(255,255,255,.08)"}`,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* tag pills */}
            <div className="mb-6 flex flex-wrap gap-2">
              {["All", ...TAGS].map((t) => {
                const on = tag === t;
                const tint = t === "All" ? F_ACCENT : TAG_TINT[t];
                return (
                  <button key={t} onClick={() => setTag(t)}
                    className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition"
                    style={{
                      borderRadius: 7,
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
            ) : ranked.length === 0 ? (
              <div className="py-20 text-center"
                style={{ borderRadius: 16, background: "rgba(255,255,255,.02)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
                <MessageSquare className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">
                  {tag === "All" ? "Nothing posted yet. Start it." : `No posts tagged ${tag} yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ranked.map((p) => (
                  <motion.article key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 p-5"
                    style={{ borderRadius: 16, background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.075)" }}>
                    {/* vote rail */}
                    <div className="flex w-14 shrink-0 flex-col items-center gap-1">
                      <button onClick={() => vote(p, 1)} aria-label="Upvote"
                        className="grid h-10 w-10 place-items-center transition hover:brightness-150"
                        style={{
                          borderRadius: 7,
                          background: p.userVote === 1 ? `${F_ACCENT}33` : "rgba(255,255,255,.04)",
                          boxShadow: `inset 0 0 0 1px ${p.userVote === 1 ? F_ACCENT : "rgba(255,255,255,.09)"}`,
                          color: p.userVote === 1 ? F_ACCENT_LIT : "#64748b",
                        }}>
                        {/* A LOVE, not an upvote. The arrow said "is this
                            useful"; the heart says "I liked this", which is the
                            reaction this community actually gives. Filled once
                            you've given it, so the rail reads at a glance. */}
                        <Heart className="h-4 w-4" fill={p.userVote === 1 ? "currentColor" : "none"} />
                      </button>
                      {/* ONE number. Showing the love count here as well as the
                          net score printed "2" twice above the word SCORE, which
                          reads as a rendering bug. The separate tallies moved to
                          the footer, where they say something the score cannot. */}
                      <span className="text-base font-black tabular-nums" style={{ color: (p.score || 0) > 0 ? F_ACCENT_LIT : "#64748b" }}>
                        {p.score ?? 0}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-700">Score</span>
                      <button onClick={() => vote(p, -1)} aria-label="Dislike"
                        className="mt-0.5 grid h-10 w-10 place-items-center transition hover:brightness-150"
                        style={{
                          borderRadius: 7,
                          background: p.userVote === -1 ? "rgba(244,63,94,.22)" : "rgba(255,255,255,.04)",
                          boxShadow: `inset 0 0 0 1px ${p.userVote === -1 ? "#f43f5e" : "rgba(255,255,255,.09)"}`,
                          color: p.userVote === -1 ? "#fda4af" : "#64748b",
                        }}>
                        <ThumbsDown className="h-4 w-4" fill={p.userVote === -1 ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* body */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AuthorLine user={p.user} blessed={p.blessed} />
                        {p.isPinned && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                            style={{ borderRadius: 4, background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)", color: "#fcd34d" }}>
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        {p.tag && <TagChip tag={p.tag} size="xs" />}
                        <span className="text-[11px] font-bold text-slate-500">{ago(p.createdAt)}</span>
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

                      {/* ── EDITING ── in place, not in a modal. A post is
                          already a block of text on the page; lifting it into a
                          dialog to change a word loses the thread around it. */}
                      {editing === p.id ? (
                        <div className="mt-3 space-y-2">
                          <input
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value.slice(0, 30))}
                            placeholder="Title (optional)"
                            className="w-full bg-black/50 px-3.5 py-2 text-sm font-black text-white outline-none placeholder:text-slate-600"
                            style={{ borderRadius: 9, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}
                          />
                          <textarea
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value.slice(0, 1500))}
                            rows={4}
                            className="w-full resize-y bg-black/50 px-3.5 py-2.5 text-[15px] leading-relaxed text-white outline-none"
                            style={{ borderRadius: 10, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {TAGS.map((t) => (
                              <button key={t} onClick={() => setDraftTag(t)}
                                className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition"
                                style={{
                                  borderRadius: 5,
                                  background: draftTag === t ? `${TAG_TINT[t]}30` : "rgba(255,255,255,.04)",
                                  boxShadow: `inset 0 0 0 1px ${draftTag === t ? TAG_TINT[t] : "rgba(255,255,255,.1)"}`,
                                  color: draftTag === t ? "#fff" : "#64748b",
                                }}>
                                {t}
                              </button>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setEditing(null)}
                              className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:brightness-125"
                              style={{ borderRadius: 8, background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                              Cancel
                            </button>
                            <button onClick={() => saveEdit(p)} disabled={!draftBody.trim() || savingEdit}
                              className="px-5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115 disabled:opacity-35"
                              style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${F_ACCENT})` }}>
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* the headline opens the post's own page — the
                              whole card isn't a link because it already
                              contains votes, menus and a poll */}
                          {p.title && (
                            <Link href={`/community/post/${p.id}`}
                              className="mt-3 block text-2xl font-black leading-tight transition hover:text-violet-300">
                              {p.title}
                            </Link>
                          )}
                          {p.content && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-slate-200">
                              {p.content}
                            </p>
                          )}
                        </>
                      )}
                      {p.mediaUrl && (
                        <img src={p.mediaUrl} alt="" loading="lazy"
                          className="mt-3 max-h-[420px] w-auto max-w-full object-contain"
                          style={{ borderRadius: 12 }} />
                      )}

                      {p.poll && (
                        <PollCard
                          poll={p.poll}
                          onUpdate={(next) =>
                            setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, poll: { ...x.poll!, ...next } } : x)))
                          }
                        />
                      )}

                      {/* ── HOW IT LANDED ── the tallies, said in words.
                          The rail can only show a net score, which hides its own
                          ingredients: 0 looks identical whether nobody voted or
                          fifty people split evenly. Total engagement plus the
                          share that was positive tells both halves in one line,
                          and only appears once somebody has actually voted. */}
                      {(() => {
                        const up = p.upvotes || 0;
                        const down = p.downvotes || 0;
                        const total = up + down;
                        if (total === 0) return null;
                        return (
                          <div className="mt-3.5 font-mono text-[11px] text-slate-600">
                            {total} interaction{total === 1 ? "" : "s"}
                            <span className="mx-1.5 text-slate-700">•</span>
                            {Math.round((up / total) * 100)}% positive
                          </div>
                        );
                      })()}

                      {/* ── THREAD ── a forum post you can't answer is a notice board */}
                      <div className="mt-3.5 flex flex-wrap items-center gap-4">
                        <button
                          onClick={() => setOpenThread(openThread === p.id ? null : p.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition hover:text-white">
                          <MessageSquare className="h-3 w-3" />
                          {(replies[p.id]?.length || 0) === 0
                            ? "Reply"
                            : `${replies[p.id].length} ${replies[p.id].length === 1 ? "reply" : "replies"}`}
                        </button>
                        <Link href={`/community/post/${p.id}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:text-white">
                          Open post
                        </Link>
                      </div>

                      <AnimatePresence initial={false}>
                        {openThread === p.id && (
                          <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="mt-3 space-y-2.5 border-l pl-3"
                            style={{ borderColor: `${F_ACCENT}44` }}>
                            {(replies[p.id] || []).map((r) => (
                              <div key={r.id} className="flex items-start gap-2.5">
                                <CornerDownRight className="mt-1.5 h-3 w-3 shrink-0 text-slate-700" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <AuthorLine user={r.user} blessed={r.blessed} />
                                    <span className="text-[10px] font-bold text-slate-600">{ago(r.createdAt)}</span>
                                    {/* A reply is someone's post too — same
                                        rights, same controls. */}
                                    {canManage(r) && (
                                      <PostMenu
                                        isOwn={r.user?.id === user?.id}
                                        canPin={false} /* pinning a reply would put it on a shelf of posts */
                                        onEdit={() => startEdit(r)}
                                        onDelete={() => removePost(r)}
                                        onPin={() => {}}
                                      />
                                    )}
                                  </div>
                                  {/* Replies edit inline too, body only — they
                                      carry no title or topic of their own. */}
                                  {editing === r.id ? (
                                    <div className="mt-1.5 space-y-2">
                                      <textarea
                                        value={draftBody}
                                        onChange={(e) => setDraftBody(e.target.value.slice(0, 800))}
                                        rows={3}
                                        className="w-full resize-y bg-black/50 px-3 py-2 text-sm leading-relaxed text-white outline-none"
                                        style={{ borderRadius: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditing(null)}
                                          className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:brightness-125"
                                          style={{ borderRadius: 7, background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                                          Cancel
                                        </button>
                                        <button onClick={() => saveEdit(r)} disabled={!draftBody.trim() || savingEdit}
                                          className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:brightness-115 disabled:opacity-35"
                                          style={{ clipPath: "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${F_ACCENT})` }}>
                                          {savingEdit ? "Saving…" : "Save"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                                      {r.content}
                                    </p>
                                  )}
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
            <div className="p-4" style={{ borderRadius: 18, background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                  <Hash className="h-3.5 w-3.5" style={{ color: F_ACCENT }} /> Topics
                </span>
                <span className="text-[11px] font-black tabular-nums text-slate-600">{TAGS.length + 1}</span>
              </div>
              <div className="space-y-1">
                {[{ tag: "All", count: total }, ...topics].map((t) => {
                  const on = tag === t.tag || (t.tag === "All" && tag === "All");
                  const tint = t.tag === "All" ? F_ACCENT : TAG_TINT[t.tag];
                  return (
                    <button key={t.tag} onClick={() => setTag(t.tag)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition"
                      style={{
                        borderRadius: 9,
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
        style={{ borderRadius: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.11)" }}
      />
      <button onClick={send} disabled={!text.trim() || busy} aria-label="Send reply"
        className="grid h-9 w-9 shrink-0 place-items-center text-white transition hover:brightness-115 disabled:opacity-30"
        style={{ borderRadius: 7, background: `linear-gradient(100deg, #7c3aed, ${F_ACCENT})` }}>
        <Send className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Create New Post — text, an image, and optionally a poll. */
function Composer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [tag, setTag] = useState<string>("General");
  const [busy, setBusy] = useState(false);
  const [poll, setPoll] = useState<PollDraft | null>(null);

  // A poll alone is a post — the question is the content.
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
        style={{ borderRadius: 22, background: "linear-gradient(165deg, #16102b, #0c0818)", boxShadow: "inset 0 0 0 1px rgba(162,116,255,.35)" }}
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
            style={{ borderRadius: 10, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />

          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-sm font-black">Content</label>
            <span className="text-[11px] tabular-nums text-slate-600">{content.length}/1500</span>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 1500))}
            placeholder="What's on your mind?" rows={6}
            className="mb-3 w-full resize-y bg-black/50 px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-slate-600"
            style={{ borderRadius: 10, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />

          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="mb-3 w-full bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
            style={{ borderRadius: 10, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} />

          {/* or bring your own: PC upload (Cloudinary) / KLIPY GIF search —
              both just fill the same mediaUrl the input above edits */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <MediaPicker value={mediaUrl} onChange={setMediaUrl} userId={user?.id} />
            {!poll && (
              <button
                type="button"
                onClick={() => setPoll({ ...EMPTY_POLL })}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-indigo-200 transition hover:bg-indigo-500/20"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Add Poll
              </button>
            )}
          </div>

          {poll && (
            <div className="mb-5">
              <PollBuilder value={poll} onChange={setPoll} onRemove={() => setPoll(null)} />
            </div>
          )}

          <label className="mb-2 block text-sm font-black">Tag</label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => {
              const on = tag === t;
              const tint = TAG_TINT[t];
              return (
                <button key={t} onClick={() => setTag(t)}
                  className="px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition"
                  style={{
                    borderRadius: 6,
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
            style={{ borderRadius: 9, background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!canPost}
            className="px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115 disabled:opacity-35"
            style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${F_ACCENT})` }}>
            {busy ? "Posting…" : "Create Post"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
