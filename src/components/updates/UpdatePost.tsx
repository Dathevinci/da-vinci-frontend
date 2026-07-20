"use client";

import { useState, type ReactNode } from "react";
import { isAdmin } from "@/lib/admin";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Sparkles, Tag as TagIcon } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { getRankTheme } from "@/lib/ranks";
import { Code2 as IconCode2, ShieldAlert, Sparkles as IconSparkles, Crown as IconCrown, Flame as IconFlame, Zap as IconZap, Compass as IconCompass, Leaf as IconLeaf, ArrowUpRight, Feather as IconFeather, Eye as IconEye } from "lucide-react";
const ICON_MAP: Record<string, any> = { Code2: IconCode2, ShieldAlert, Sparkles: IconSparkles, Crown: IconCrown, Flame: IconFlame, Zap: IconZap, Compass: IconCompass, Leaf: IconLeaf, ArrowUpRight, Feather: IconFeather, Eye: IconEye };
import CommentsDrawer from "@/components/ui/CommentsDrawer";
import { AvatarDecoration, hasFrameRing } from "@/components/profile/AvatarDecoration";
import UserLink from "@/components/profile/UserLink";
import MentionsInput from "@/components/ui/MentionsInput";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatar: string | null;
    arisePoints: number;
    activeFrame?: string | null;
    activeEffect?: string | null;
  };
}

interface UpdatePostProps {
  post: {
    id: string;
    title: string;
    content: string;
    tag: string;
    image: string | null;
    createdAt: string;
    _count: {
      comments: number;
    };
    author: {
      id: string;
      username: string;
      avatar: string | null;
      arisePoints: number;
      activeFrame?: string | null;
      activeEffect?: string | null;
    };
  };
  onDelete?: (id: string) => void;
}

// Render @mentions inside a line of text as profile links.
function renderMentions(text: string): ReactNode {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <Link key={i} href={`/user/${part.slice(1)}`} className="font-bold text-purple-400 hover:text-purple-300 hover:underline">
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const isDivider = (l: string) => /^[━─=_]{3,}$/.test(l.trim());

// Turn the raw Dev-Blog text (── HEADER ── section blocks + paragraphs) into a
// formatted changelog. Section headers like "NEW — X" get a coloured chip.
function ChangelogBody({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── HEADER ── block
    if (isDivider(line) && i + 2 < lines.length && isDivider(lines[i + 2])) {
      const header = lines[i + 1].trim();
      const m = header.match(/^(NEW|FIX|FIXED|IMPROVED|CHANGED|REMOVED)\s*[—–-]\s*(.*)$/i);
      blocks.push(
        <div key={key++} className="flex items-center gap-2.5 pt-5 first:pt-0">
          <span className="h-6 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-fuchsia-400 to-purple-600" />
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            {m ? (
              <>
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-fuchsia-300">{m[1]}</span>
                {m[2]}
              </>
            ) : (
              header
            )}
          </h3>
        </div>
      );
      i += 3;
      continue;
    }

    // Skip blank lines and the duplicated "Da Vinci — Dev Blog X.Y" heading line.
    if (line.trim() === "" || /^da\s*vinci\s*[—–-]\s*dev\s*blog/i.test(line.trim())) {
      i++;
      continue;
    }

    blocks.push(
      <p key={key++} className="text-[15px] leading-relaxed text-slate-300">
        {renderMentions(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-3">{blocks}</div>;
}

export default function UpdatePost({ post, onDelete }: UpdatePostProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const isDev = isAdmin(user);
  const canModifyPost = isDev || user?.id === post.author.id;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState(post.title);
  const [editPostContent, setEditPostContent] = useState(post.content);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  // Version badge (e.g. "1.5.1") + a cleaner display title (drop the "… :" prefix).
  const version = post.title.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] || null;
  const displayTitle = post.title.includes(":") ? post.title.split(":").slice(1).join(":").trim() : post.title;
  const tags = post.tag ? post.tag.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const dateLabel = (() => {
    try {
      return new Date(post.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  })();

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    try {
      const res = await fetch(`${API_URL}/api/announcements/${post.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (res.ok) {
        toast("Update deleted", "success");
        onDelete?.(post.id);
      } else {
        toast("Failed to delete", "error");
      }
    } catch {
      toast("Error deleting post", "error");
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_URL}/api/announcements/${post.id}/comments`);
      const data = await res.json();
      if (data.success) setComments(data.data || []);
    } catch {
      toast("Failed to load comments", "error");
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) fetchComments();
    setShowComments(!showComments);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast("You must be logged in to comment.", "error");
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/announcements/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, content: newComment.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setComments([...comments, data.data]);
        setNewComment("");
      } else {
        toast(data.error || "Failed to post comment", "error");
      }
    } catch {
      toast("Error posting comment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePostEdit = async () => {
    if (!editPostTitle.trim() || !editPostContent.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/announcements/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, title: editPostTitle, content: editPostContent }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Post updated", "success");
        setIsEditingPost(false);
        post.title = editPostTitle;
        post.content = editPostContent;
      } else {
        toast(data.error || "Failed to edit post", "error");
      }
    } catch {
      toast("Error editing post", "error");
    }
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    try {
      const res = await fetch(`${API_URL}/api/announcements/comments/${commentToDelete}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (res.ok) {
        setComments(comments.filter((c) => c.id !== commentToDelete));
        toast("Comment deleted", "success");
      } else {
        toast("Failed to delete comment", "error");
      }
    } catch {
      toast("Error deleting comment", "error");
    } finally {
      setCommentToDelete(null);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!editCommentContent.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/announcements/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, content: editCommentContent }),
      });
      const data = await res.json();
      if (data.success) {
        setComments(comments.map((c) => (c.id === commentId ? { ...c, content: editCommentContent } : c)));
        setEditingCommentId(null);
        toast("Comment updated", "success");
      } else {
        toast(data.error || "Failed to edit comment", "error");
      }
    } catch {
      toast("Error editing comment", "error");
    }
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const authorRank = post.author ? getRankTheme((post.author as any).xp || 0, post.author.username) : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#141418] to-[#0d0d11] shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
      {/* accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />

      {post.image && (
        <img src={post.image} alt="" className="max-h-[420px] w-full object-cover" />
      )}

      <div className="p-6 md:p-8">
        {/* meta row */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {version && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-1 text-sm font-black text-white shadow-[0_0_16px_rgba(168,85,247,0.4)]">
              <Sparkles className="h-3.5 w-3.5" /> v{version}
            </span>
          )}
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
              <TagIcon className="h-3 w-3 text-fuchsia-400" /> {t}
            </span>
          ))}
          <span className="text-xs font-medium text-slate-500">{dateLabel}</span>

          {canModifyPost && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => setIsEditingPost(!isEditingPost)} className="rounded-lg bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-slate-400 transition hover:text-purple-300">
                {isEditingPost ? "Cancel" : "Edit"}
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-slate-400 transition hover:text-red-400">
                Delete
              </button>
            </div>
          )}
        </div>

        {isEditingPost ? (
          <div className="space-y-2">
            <input
              value={editPostTitle}
              onChange={(e) => setEditPostTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
            <textarea
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              className="min-h-[180px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
            <div className="flex justify-end">
              <button onClick={handleSavePostEdit} className="rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-1.5 text-xs font-bold text-white transition hover:scale-[1.02]">
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-5 text-2xl font-black leading-tight tracking-tight md:text-3xl">{displayTitle}</h2>
            <ChangelogBody content={post.content} />
          </>
        )}

        {/* footer: author + discuss */}
        <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4">
          <UserLink username={post.author.username} className="group flex items-center gap-2.5">
            <div className="relative shrink-0">
              {post.author.avatar ? (
                <img src={post.author.avatar} alt="" className={`relative z-10 h-8 w-8 rounded-full object-cover border-2 ${hasFrameRing(post.author.activeFrame, post.author.activeEffect) ? "border-[#141418]" : authorRank?.borderClass}`} />
              ) : (
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black ${authorRank?.borderClass} ${authorRank?.bgCardClass}`}>
                  {(post.author.username || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <AvatarDecoration frame={post.author.activeFrame} effect={post.author.activeEffect} />
            </div>
            <div className="leading-tight">
              <div className={`text-sm font-bold group-hover:underline ${authorRank?.textColorClass}`}>{post.author.username}</div>
              <div className="text-[11px] text-slate-500">{timeAgo(post.createdAt)} ago</div>
            </div>
          </UserLink>

          <button
            onClick={toggleComments}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-purple-500/40 hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {post._count.comments > 0 ? `Discuss · ${post._count.comments}` : "Discuss"}
          </button>
        </div>
      </div>

      {/* Comments */}
      <CommentsDrawer isOpen={showComments} onClose={() => setShowComments(false)} title="Discussion">
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4">
            {loadingComments ? (
              <div className="py-4 text-center text-sm text-slate-500">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">No comments yet. Be the first!</div>
            ) : (
              comments.map((c) => {
                const cRank = c.user ? getRankTheme((c.user as any).xp || 0, c.user.username) : getRankTheme(0, "Unknown");
                const canModify = isDev || user?.id === c.user.id;
                return (
                  <div key={c.id} className="flex gap-3">
                    <UserLink username={c.user.username} className="relative inline-flex shrink-0">
                      {c.user.avatar ? (
                        <img src={c.user.avatar} alt="" className={`relative z-10 h-8 w-8 rounded-full object-cover border ${hasFrameRing(c.user.activeFrame, c.user.activeEffect) ? "border-[#18181b]" : cRank.borderClass}`} />
                      ) : (
                        <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${cRank.borderClass} ${cRank.bgCardClass}`}>
                          {(c.user.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <AvatarDecoration frame={c.user.activeFrame} effect={c.user.activeEffect} />
                    </UserLink>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <UserLink username={c.user.username} className="group">
                          <span className={`text-sm font-bold group-hover:underline ${cRank.textColorClass}`}>{c.user.username}</span>
                        </UserLink>
                        <span className="text-xs text-slate-500">{timeAgo(c.createdAt)}</span>
                        {canModify && (
                          <div className="ml-auto flex gap-2">
                            {user?.id === c.user.id && (
                              <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} className="text-xs text-slate-500 hover:text-purple-400">Edit</button>
                            )}
                            <button onClick={() => setCommentToDelete(c.id)} className="text-xs text-slate-500 hover:text-red-500">Delete</button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <div className="mt-1 flex gap-2">
                          <input
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                            className="flex-1 rounded border border-white/10 bg-black/50 px-2 py-1 text-sm text-white focus:border-purple-500 focus:outline-none"
                          />
                          <button onClick={() => handleSaveCommentEdit(c.id)} className="text-xs font-bold text-purple-400">Save</button>
                          <button onClick={() => setEditingCommentId(null)} className="text-xs text-slate-400">Cancel</button>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{renderMentions(c.content)}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-4">
            {user?.avatar ? (
              <img src={user.avatar} className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold">
                {user ? (user.username || "U").charAt(0).toUpperCase() : "?"}
              </div>
            )}
            <form onSubmit={submitComment} className="flex flex-1 gap-2">
              <MentionsInput
                placeholder="Add a comment…"
                value={newComment}
                onChange={(val) => setNewComment(val)}
                onSubmit={submitComment as any}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition focus:border-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white transition hover:scale-105 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </CommentsDrawer>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f13] p-6 shadow-2xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <h3 className="mb-2 text-xl font-bold">Delete update</h3>
              <p className="mb-6 text-sm text-slate-400">Are you sure? This can't be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5">Cancel</button>
                <button onClick={confirmDelete} className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition hover:bg-red-500 hover:text-white">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comment delete confirm */}
      <AnimatePresence>
        {commentToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f13] p-6 shadow-2xl">
              <h3 className="mb-2 text-xl font-bold">Delete comment</h3>
              <p className="mb-6 text-sm text-slate-400">This can't be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setCommentToDelete(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5">Cancel</button>
                <button onClick={confirmDeleteComment} className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition hover:bg-red-500 hover:text-white">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
