"use client";

import { useState, type ReactNode } from "react";
import { isAdmin } from "@/lib/admin";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Tag as TagIcon } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { getRankTheme } from "@/lib/ranks";
import { Code2 as IconCode2, ShieldAlert, Sparkles as IconSparkles, Crown as IconCrown, Flame as IconFlame, Zap as IconZap, Compass as IconCompass, Leaf as IconLeaf, ArrowUpRight, Feather as IconFeather, Eye as IconEye } from "lucide-react";
const ICON_MAP: Record<string, any> = { Code2: IconCode2, ShieldAlert, Sparkles: IconSparkles, Crown: IconCrown, Flame: IconFlame, Zap: IconZap, Compass: IconCompass, Leaf: IconLeaf, ArrowUpRight, Feather: IconFeather, Eye: IconEye };
import { AvatarDecoration, hasFrameRing } from "@/components/profile/AvatarDecoration";
import UserLink from "@/components/profile/UserLink";
import MentionsInput from "@/components/ui/MentionsInput";
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

const isDivider = (l: string) => /^[ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬=_]{3,}$/.test(l.trim());

// Turn the raw Dev-Blog text (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ HEADER ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ section blocks + paragraphs) into a
// formatted changelog. Section headers like "NEW ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â X" get a coloured chip.
function ChangelogBody({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ HEADER ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ block
    if (isDivider(line) && i + 2 < lines.length && isDivider(lines[i + 2])) {
      const header = lines[i + 1].trim();
      const m = header.match(/^(NEW|FIX|FIXED|IMPROVED|CHANGED|REMOVED)\s*[ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ-]\s*(.*)$/i);
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

    // Skip blank lines and the duplicated "Da Vinci ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Dev Blog X.Y" heading line.
    if (line.trim() === "" || /^da\s*vinci\s*[ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ-]\s*dev\s*blog/i.test(line.trim())) {
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const isDev = isAdmin(user);
  const canModifyPost = isDev || user?.id === post.author.id;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState(post.title);
  const [editPostContent, setEditPostContent] = useState(post.content);

  // Version badge (e.g. "1.5.1") + a cleaner display title (drop the "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ :" prefix).
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

          {/* Commenting on dev blog posts was removed ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â discussion happens in
              the community feed and on Discord instead. The backend endpoints
              still exist and existing comments are untouched in the database, so
              this is reversible by restoring the button and drawer. */}
        </div>
      </div>


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

    </article>
  );
}
