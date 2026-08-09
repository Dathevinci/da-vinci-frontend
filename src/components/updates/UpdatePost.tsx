"use client";

import { useState, type ReactNode } from "react";
import { isAdmin } from "@/lib/admin";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Tag as TagIcon } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { getRankTheme } from "@/lib/ranks";
import { Code2 as IconCode2, ShieldAlert, Sparkles as IconSparkles, Crown as IconCrown, Flame as IconFlame, Zap as IconZap, Compass as IconCompass, Leaf as IconLeaf, ArrowUpRight, Feather as IconFeather, Eye as IconEye } from "lucide-react";
const ICON_MAP: Record<string, any> = { Code2: IconCode2, ShieldAlert, Sparkles: IconSparkles, Crown: IconCrown, Flame: IconFlame, Zap: IconZap, Compass: IconCompass, Leaf: IconLeaf, ArrowUpRight, Feather: IconFeather, Eye: IconEye };
import { AvatarDecoration, hasFrameRing } from "@/components/profile/AvatarDecoration";
import UserLink from "@/components/profile/UserLink";
import { authHeaders } from "@/lib/authToken";

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

// Colour the section chip by what kind of change it is, so a long changelog can
// be skimmed by category instead of read top to bottom.
const KIND_CHIP: Record<string, string> = {
  NEW: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  FIXED: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  FIX: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  IMPROVED: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  CHANGED: "border-violet-400/30 bg-violet-500/15 text-violet-300",
  REMOVED: "border-rose-400/30 bg-rose-500/15 text-rose-300",
};

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
      const kind = m ? m[1].toUpperCase() : "";
      blocks.push(
        <div key={key++} className="flex items-center gap-2.5 pt-7 first:pt-0">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-white sm:text-lg">
            {m ? (
              <>
                <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${KIND_CHIP[kind] || "border-white/15 bg-white/[0.06] text-slate-300"}`}>
                  {m[1]}
                </span>
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

    // Consecutive "• " lines become one real list instead of a run of loose
    // paragraphs — the single biggest readability win on a long changelog.
    if (/^[•·*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[•·*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[•·*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="space-y-2 pl-1">
          {items.map((it, n) => (
            <li key={n} className="flex gap-2.5 font-mono text-[13px] leading-relaxed text-slate-400">
              <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-violet-400/80" />
              <span>{renderMentions(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    blocks.push(
      <p key={key++} className="font-mono text-[13px] leading-relaxed text-slate-400">
        {renderMentions(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2.5">{blocks}</div>;
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

  // Collapse anything longer than a screenful. Measured on the raw text so the
  // threshold doesn't depend on how the parser happens to lay it out.
  const isLong = post.content.length > 900;
  const [expanded, setExpanded] = useState(false);

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
        headers: authHeaders(),
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
        headers: authHeaders(),
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
        headers: authHeaders(),
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
        headers: authHeaders(),
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
        headers: authHeaders(),
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
    <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11] transition-colors duration-300 hover:border-white/20">
      {/* A wash from the top edge instead of the old rainbow rule — the same
          light the page hero uses, so a card reads as part of the surface
          rather than a striped box sitting on it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(139,92,246,0.12),transparent_70%)]"
      />

      {post.image && (
        <img src={post.image} alt="" className="relative max-h-[420px] w-full object-cover" />
      )}

      <div className="relative p-6 md:p-8">
        {/* meta row */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {version && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 font-mono text-xs font-black text-violet-200">
              <Sparkles className="h-3 w-3" /> v{version}
            </span>
          )}
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-bold text-slate-300">
              <TagIcon className="h-3 w-3 text-violet-300" /> {t}
            </span>
          ))}
          <span className="font-mono text-[11px] text-slate-500">{dateLabel}</span>

          {canModifyPost && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => setIsEditingPost(!isEditingPost)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-bold text-slate-400 transition hover:border-violet-400/40 hover:text-violet-200">
                {isEditingPost ? "Cancel" : "Edit"}
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-bold text-slate-400 transition hover:border-red-400/40 hover:text-red-300">
                Delete
              </button>
            </div>
          )}
        </div>

        {isEditingPost ? (
          <div className="space-y-2.5">
            <input
              value={editPostTitle}
              onChange={(e) => setEditPostTitle(e.target.value)}
              /* 16px on mobile so iOS Safari doesn't zoom the page on focus
                 and leave it zoomed — the same rule the explore inputs follow. */
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-base text-white focus:border-violet-400/50 focus:outline-none sm:text-sm"
            />
            <textarea
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              className="min-h-[220px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-base leading-relaxed text-white focus:border-violet-400/50 focus:outline-none sm:text-sm"
            />
            <div className="flex justify-end">
              <button onClick={handleSavePostEdit} className="rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25">
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* font-fell, matching the hub and the page hero — the display
                serif is what makes this feel like the redesigned site rather
                than a bold sans heading on a dark box. */}
            <h2 className="mb-5 font-fell text-3xl leading-tight text-white md:text-4xl">{displayTitle}</h2>
            {/* Long posts collapse behind a fade. Every changelog rendered in
                full meant the page opened as one continuous wall of text and you
                couldn't see what releases even existed without scrolling past
                all of them. Short posts are never clipped. */}
            <div className={`relative ${isLong && !expanded ? "max-h-[22rem] overflow-hidden" : ""}`}>
              <ChangelogBody content={post.content} />
              {/* Fades to the card's own colour — #141418 was the old gradient
                  card and left a visible seam against #0b0b11. */}
              {isLong && !expanded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0b11] to-transparent" />
              )}
            </div>
            {isLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-[11px] font-bold text-slate-300 transition hover:border-violet-400/40 hover:text-white"
              >
                {expanded ? "Show less" : "Read full changelog"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </>
        )}

        {/* footer: author + discuss */}
        <div className="mt-8 flex items-center justify-between border-t border-white/[0.07] pt-5">
          <UserLink username={post.author.username} className="group flex items-center gap-2.5">
            <div className="relative shrink-0">
              {post.author.avatar ? (
                <img src={post.author.avatar} alt="" className={`relative z-10 h-8 w-8 rounded-full object-cover border-2 ${hasFrameRing(post.author.activeFrame, post.author.activeEffect) ? "border-[#0b0b11]" : authorRank?.borderClass}`} />
              ) : (
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black ${authorRank?.borderClass} ${authorRank?.bgCardClass}`}>
                  {(post.author.username || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <AvatarDecoration frame={post.author.activeFrame} effect={post.author.activeEffect} />
            </div>
            <div className="leading-tight">
              <div className={`text-sm font-bold group-hover:underline ${authorRank?.textColorClass}`}>{post.author.username}</div>
              <div className="font-mono text-[11px] text-slate-500">{timeAgo(post.createdAt)} ago</div>
            </div>
          </UserLink>

          {/* Commenting on dev blog posts was removed — discussion lives in the
              community feed and on Discord. Backend endpoints and existing rows
              are untouched, so restoring the button and drawer brings it back. */}
        </div>
      </div>


      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b11] p-6 shadow-2xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <h3 className="mb-2 font-fell text-2xl text-white">Delete update</h3>
              <p className="mb-6 font-mono text-[13px] leading-relaxed text-slate-400">Are you sure? This can&rsquo;t be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="rounded-xl border border-white/10 px-4 py-2 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/5">Cancel</button>
                <button onClick={confirmDelete} className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2 font-mono text-xs font-bold text-red-300 transition hover:bg-red-500 hover:text-white">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </article>
  );
}
