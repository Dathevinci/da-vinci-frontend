"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, ThumbsDown, MessageSquare, Share2, Pin } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";
import UserLink from "@/components/profile/UserLink";
import UserBadges from "@/components/profile/UserBadges";
import GuildTag from "@/components/guild/GuildTag";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import CommunityFeed from "@/components/community/CommunityFeed";
import MentionText from "@/components/ui/MentionText";
import { PollCard, type PollData } from "@/components/community/Poll";

/**
 * ONE POST, ON ITS OWN PAGE.
 *
 * The forum feed is for skimming; this is for reading and replying. It is a
 * real route, so a post can be linked, shared and opened in a new tab —
 * none of which a expanding-in-place thread can do.
 *
 * The comments below are the SAME CommunityFeed the anime, manhwa and novel
 * pages use, pointed at this post: identical cards, composer, emoji/GIF,
 * ratings, like/dislike and report.
 */

type Author = {
  id: string; username: string; avatar?: string | null;
  activeEffect?: string | null; activeFrame?: string | null;
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
  upvotes?: number;
  downvotes?: number;
  userVote?: number;
  user?: Author;
  poll?: PollData;
  // What this thread is ABOUT, when it isn't a forum post. Carried through
  // so replies written here stay attached to the same anime/manhwa/novel
  // instead of becoming context-less forum posts.
  animeId?: number | null;
  animeTitle?: string | null;
  mangaId?: string | null;
  mangaTitle?: string | null;
  chapterId?: string | null;
  chapterTitle?: string | null;
  novelId?: string | null;
  novelTitle?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const { user } = useUser();
  const { toast } = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [replyCount, setReplyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    const url = new URL(`${API_URL}/api/comments/${id}`);
    if (user?.id) url.searchParams.set("userId", user.id);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d?.success && d.data?.post) {
          setPost(d.data.post);
          setReplyCount((d.data.replies || []).length);
        } else setFailed(true);
      })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, user?.id]);

  const vote = async (value: number) => {
    if (!user) return toast("Sign in to vote.", "error");
    if (!post) return;
    const next = post.userVote === value ? 0 : value;
    const prev = post;
    setPost({
      ...post,
      userVote: next,
      score: (post.score || 0) + (next - (post.userVote || 0)),
      upvotes: Math.max(0, (post.upvotes ?? 0) - (post.userVote === 1 ? 1 : 0) + (next === 1 ? 1 : 0)),
      downvotes: Math.max(0, (post.downvotes ?? 0) - (post.userVote === -1 ? 1 : 0) + (next === -1 ? 1 : 0)),
    });
    try {
      const res = await fetch(`${API_URL}/api/comments/${post.id}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, value: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPost(prev);
      toast("Couldn't record that vote.", "error");
    }
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ url, title: post?.title || "Da Vinci" });
      else { await navigator.clipboard.writeText(url); toast("Link copied.", "success"); }
    } catch { /* the user dismissed the sheet */ }
  };

  if (loading) return <LoadingScreen message="Loading post" />;

  if (failed || !post) {
    return (
      <div className="min-h-screen bg-[#070709] pt-32 text-center">
        <p className="font-mono text-base font-black text-white">This post isn&apos;t here</p>
        <p className="mt-2 font-mono text-xs text-slate-500">It may have been deleted, or the link is wrong.</p>
        <Link href="/community" className="mt-6 inline-block rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3 font-mono text-sm font-bold text-slate-200 transition hover:bg-white/10">
          Back to Community
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] px-3 sm:px-6 md:px-12 pb-36 pt-20 sm:pt-24 text-white">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Discussions
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* ── THE POST ── */}
          <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-5 sm:p-7 shadow-xl backdrop-blur-xl"
          >
            <div className="flex items-start gap-3.5">
              <span className="relative h-12 w-12 shrink-0">
                {post.user?.avatar ? (
                  <img src={cloudinaryFit(post.user.avatar, 100)} alt="" className="relative z-10 h-12 w-12 rounded-full object-cover ring-2 ring-white/10 shadow-md" />
                ) : (
                  <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full bg-violet-700 font-mono text-sm font-black text-white ring-2 ring-white/10">
                    {(post.user?.username || "?")[0]?.toUpperCase()}
                  </span>
                )}
                <AvatarDecoration frame={post.user?.activeFrame} effect={post.user?.activeEffect} size="md" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {post.user ? (
                    <UserLink username={post.user.username} className="min-w-0 truncate font-mono text-sm font-black text-white hover:text-violet-300 transition-colors">
                      {post.user.username}
                    </UserLink>
                  ) : (
                    <span className="font-mono text-sm font-black text-white">someone</span>
                  )}
                  {post.user ? <GuildTag userId={post.user.id} size="sm" /> : null}
                  {post.user ? <UserBadges user={post.user as any} size="sm" showHeart={false} maxTitles={1} /> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono">
                  {post.isPinned && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-300">
                      <Pin className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                  {post.tag && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-300">
                      {post.tag}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">{ago(post.createdAt)}</span>
                </div>
              </div>
            </div>

            {post.title && (
              <h1 className="mt-5 font-fell text-2xl sm:text-3xl font-bold uppercase tracking-[0.04em] text-white">
                {post.title}
              </h1>
            )}
            {post.content && (
              <p className="mt-3.5 whitespace-pre-wrap break-words font-sans text-sm sm:text-base leading-relaxed text-slate-200">
                <MentionText text={post.content} />
              </p>
            )}
            {post.mediaUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg">
                <img src={post.mediaUrl} alt="" className="max-h-[520px] w-full object-contain" />
              </div>
            )}
            {post.poll && (
              <div className="mt-4">
                <PollCard poll={post.poll} onUpdate={(p) => setPost((cur) => (cur ? { ...cur, poll: { ...cur.poll!, ...p } } : cur))} />
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4 font-mono">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                  <button
                    onClick={() => vote(1)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      post.userVote === 1 ? "bg-rose-500/30 text-rose-300" : "text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${post.userVote === 1 ? "fill-current" : ""}`} />
                  </button>
                  <span className="px-1.5 text-xs font-bold tabular-nums text-slate-200">
                    {post.upvotes ?? Math.max(0, post.score || 0)}
                  </span>
                  <button
                    onClick={() => vote(-1)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      post.userVote === -1 ? "bg-slate-500/30 text-slate-200" : "text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <ThumbsDown className={`h-4 w-4 ${post.userVote === -1 ? "fill-current" : ""}`} />
                  </button>
                </div>

                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-slate-300">
                  <MessageSquare className="h-3.5 w-3.5 text-violet-300" />
                  <span className="tabular-nums">{replyCount} replies</span>
                </span>
              </div>

              <button
                onClick={share}
                aria-label="Share this post"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </motion.article>

          {/* ── SIDEBAR ── */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4 font-mono">
            <div className="rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-5 shadow-xl backdrop-blur-xl">
              {post.tag && (
                <div className="mb-4 pb-4 border-b border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Topic</p>
                  <p className="mt-1 text-base font-black text-violet-300">{post.tag}</p>
                </div>
              )}

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Engagement
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ["Likes", post.upvotes ?? Math.max(0, post.score || 0)],
                  ["Dislikes", post.downvotes ?? 0],
                  ["Replies", replyCount],
                ].map(([label, n]) => (
                  <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center">
                    <p className="text-lg font-black text-white">{n as number}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <Link
                href="/community"
                className="mt-4 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Community
              </Link>
            </div>
          </aside>
        </div>

        {/* ── THE THREAD ── the same comment section as everywhere else.
            The media context rides along so a reply written here stays
            attached to the same anime/manhwa/novel as the comment it
            answers, rather than being filed as a bare forum post. */}
        <div className="mt-8">
          <CommunityFeed
            postId={post.id}
            animeId={post.animeId ?? undefined}
            animeTitle={post.animeTitle ?? undefined}
            mangaId={post.mangaId ?? undefined}
            mangaTitle={post.mangaTitle ?? undefined}
            chapterId={post.chapterId ?? undefined}
            chapterTitle={post.chapterTitle ?? undefined}
            novelId={post.novelId ?? undefined}
            novelTitle={post.novelTitle ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
