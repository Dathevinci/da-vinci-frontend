"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, MoreHorizontal, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatar: string | null;
    arisePoints: number;
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
    hasLiked: boolean;
    _count: {
      likes: number;
      comments: number;
    };
    author: {
      id: string;
      username: string;
      avatar: string | null;
      arisePoints: number;
    };
  };
  onLikeToggle: (id: string, newLikedState: boolean) => void;
  onDelete?: (id: string) => void;
}

export default function UpdatePost({ post, onLikeToggle, onDelete }: UpdatePostProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(post.hasLiked);
  const [likesCount, setLikesCount] = useState(post._count.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const authorRank = getRankTheme(post.author.arisePoints, post.author.username);
  const RankIcon = authorRank.badgeIcon ? (Icons as any)[authorRank.badgeIcon] : null;

  const isDev = user?.username?.toLowerCase() === "dejavuh";

  const handleDeletePost = async () => {
    if (!confirm("Are you sure you want to delete this update?")) return;
    
    try {
      const res = await fetch(`${API_URL}/api/announcements/${post.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id })
      });
      if (res.ok) {
        toast("Update deleted", "success");
        onDelete?.(post.id);
      } else {
        toast("Failed to delete", "error");
      }
    } catch (err) {
      toast("Error deleting post", "error");
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast("Please log in to like updates.", "error");
      return;
    }

    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikesCount((prev) => (newLiked ? prev + 1 : prev - 1));
    onLikeToggle(post.id, newLiked);

    try {
      await fetch(`${API_URL}/api/announcements/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      console.error(err);
      // Revert on error
      setIsLiked(!newLiked);
      setLikesCount((prev) => (!newLiked ? prev + 1 : prev - 1));
      toast("Failed to interact.", "error");
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_URL}/api/announcements/${post.id}/comments`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data || []);
      }
    } catch (err) {
      toast("Failed to load comments", "error");
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) {
      fetchComments();
    }
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
        post._count.comments += 1;
      }
    } catch (err) {
      toast("Failed to post comment", "error");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="bg-[#18181b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link href={`/user/${post.author.username}`} className="flex items-center gap-3 group">
          {post.author.avatar ? (
            <img src={post.author.avatar} alt="Avatar" className={`w-10 h-10 rounded-full object-cover border-2 ${authorRank.borderClass}`} />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black border-2 ${authorRank.borderClass} ${authorRank.bgCardClass}`}>
              {(post.author.username || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-bold group-hover:underline ${authorRank.textColorClass}`}>{post.author.username}</span>
              {authorRank.title && (
                <div className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold flex items-center gap-0.5 ${authorRank.badgeClass}`}>
                  {RankIcon && <RankIcon className="w-2.5 h-2.5" />} {authorRank.title}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">{timeAgo(post.createdAt)}</span>
          </div>
        </Link>
        {isDev && (
          <button onClick={handleDeletePost} className="text-slate-500 hover:text-red-500 transition px-2 py-1 bg-red-500/10 rounded-lg text-xs font-bold">
            Delete
          </button>
        )}
      </div>

      {/* Media/Banner */}
      {post.image ? (
        <div className="w-full bg-black relative" onDoubleClick={handleLike}>
          <img src={post.image} alt="Update Media" className="w-full h-auto max-h-[500px] object-cover" />
          <AnimatePresence>
            {isLiked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: "-50%", x: "-50%" }}
                animate={{ opacity: 1, scale: 1.5, y: "-50%", x: "-50%" }}
                exit={{ opacity: 0, scale: 1, y: "-50%", x: "-50%" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              >
                <Heart className="w-32 h-32 text-red-500 fill-red-500 drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border-y border-white/5 flex items-center justify-center relative overflow-hidden" onDoubleClick={handleLike}>
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
          <Sparkles className="w-16 h-16 text-indigo-400/30 absolute -top-4 -right-4" />
          <h2 className="text-2xl md:text-3xl font-black text-white px-8 text-center drop-shadow-xl z-10">{post.title}</h2>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleLike} className="group flex items-center gap-1.5 transition">
            <motion.div whileTap={{ scale: 0.8 }}>
              <Heart className={`w-7 h-7 transition ${isLiked ? 'text-red-500 fill-red-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
            </motion.div>
          </button>
          <button onClick={toggleComments} className="group flex items-center gap-1.5 transition">
            <motion.div whileTap={{ scale: 0.8 }}>
              <MessageCircle className="w-7 h-7 text-slate-300 group-hover:text-slate-400" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Likes count */}
      <div className="px-4 pb-2">
        <span className="font-bold text-sm text-white">{likesCount} likes</span>
      </div>

      {/* Caption */}
      <div className="px-4 pb-4">
        <span className="font-bold text-white mr-2">{post.author.username}</span>
        <span className="text-slate-200 text-sm whitespace-pre-wrap">{post.content}</span>
        
        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-2">
          {post.tag.split(',').map((t, i) => (
            <span key={i} className="text-indigo-400 text-xs font-medium hover:underline cursor-pointer">#{t.trim()}</span>
          ))}
        </div>
      </div>

      {/* View Comments Link */}
      {post._count.comments > 0 && !showComments && (
        <button onClick={toggleComments} className="px-4 pb-4 text-sm text-slate-500 font-medium hover:text-slate-400 transition">
          View all {post._count.comments} comments
        </button>
      )}

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10 bg-black/20"
          >
            <div className="p-4 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
              {loadingComments ? (
                <div className="text-center text-sm text-slate-500 py-4">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-4">No comments yet. Be the first!</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Link href={`/user/${c.user.username}`}>
                      {c.user.avatar ? (
                        <img src={c.user.avatar} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                          {(c.user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/user/${c.user.username}`}>
                          <span className="font-bold text-sm text-white hover:underline">{c.user.username}</span>
                        </Link>
                        <span className="text-xs text-slate-500">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-300 break-words">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Add Comment Input */}
            <div className="p-4 border-t border-white/5 flex gap-3 items-center">
              {user?.avatar ? (
                <img src={user.avatar} className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                  {user ? (user.username || 'U').charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <form onSubmit={submitComment} className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0"
                />
                <button 
                  type="submit" 
                  disabled={!newComment.trim() || submitting}
                  className="text-indigo-400 font-bold text-sm disabled:opacity-50 hover:text-indigo-300 transition"
                >
                  Post
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
