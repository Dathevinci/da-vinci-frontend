"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, MoreHorizontal, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";
import HeartExplosion from "@/components/ui/HeartExplosion";
import CommentsDrawer from "@/components/ui/CommentsDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
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
  const [showHeartExplosion, setShowHeartExplosion] = useState(false);
  const [clickCoords, setClickCoords] = useState<{x: number, y: number} | null>(null);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const authorRank = getRankTheme(post.author.arisePoints, post.author.username);
  const RankIcon = authorRank.badgeIcon ? (Icons as any)[authorRank.badgeIcon] : null;

  const isDev = user?.username?.toLowerCase() === "dejavuh";
  const isAdmin = user?.username?.toLowerCase() === "davinci";
  const canModifyPost = isDev || isAdmin || user?.id === post.author.id;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState(post.title);
  const [editPostContent, setEditPostContent] = useState(post.content);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  const renderContentWithMentions = (text: string) => {
    if (!text) return null;
    const regex = /(@[a-zA-Z0-9_]+)/g;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <Link key={i} href={`/user/${username}`} className="text-indigo-400 font-bold hover:text-indigo-300 hover:underline drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]">
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleDeletePost = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
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

  const handleLike = async (e?: React.MouseEvent) => {
    if (!user) {
      toast("Please log in to like updates.", "error");
      return;
    }

    const newLiked = !isLiked;
    if (newLiked) {
      if (e) setClickCoords({ x: e.clientX, y: e.clientY });
      setShowHeartExplosion(true);
      setTimeout(() => setShowHeartExplosion(false), 1000);
    }

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

  const handleDoubleTap = () => {
    setShowBigHeart(true);
    setTimeout(() => setShowBigHeart(false), 1000);
    if (!isLiked) {
      handleLike();
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
      } else {
        toast(data.error || "Failed to post comment", "error");
      }
    } catch (err) {
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
        toast("Post updated successfully", "success");
        setIsEditingPost(false);
        // Optimistic UI update could go here, or depend on parent refetch
        // We'll update the local state to reflect it since we don't have a direct setter for the post prop
        post.title = editPostTitle;
        post.content = editPostContent;
      } else {
        toast(data.error || "Failed to edit post", "error");
      }
    } catch (err) {
      toast("Error editing post", "error");
    }
  };

  const handleDeleteCommentClick = (commentId: string) => {
    setCommentToDelete(commentId);
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
        setComments(comments.filter(c => c.id !== commentToDelete));
        toast("Comment deleted", "success");
      } else {
        toast("Failed to delete comment", "error");
      }
    } catch (err) {
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
        setComments(comments.map(c => c.id === commentId ? { ...c, content: editCommentContent } : c));
        setEditingCommentId(null);
        toast("Comment updated", "success");
      } else {
        toast(data.error || "Failed to edit comment", "error");
      }
    } catch (err) {
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
        {canModifyPost && (
          <div className="flex gap-2">
            <button onClick={() => setIsEditingPost(!isEditingPost)} className="text-slate-500 hover:text-indigo-400 transition px-2 py-1 bg-indigo-500/10 rounded-lg text-xs font-bold">
              {isEditingPost ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={handleDeletePost} className="text-slate-500 hover:text-red-500 transition px-2 py-1 bg-red-500/10 rounded-lg text-xs font-bold">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Media/Banner */}
      {post.image ? (
        <div className="w-full bg-black relative" onDoubleClick={handleDoubleTap}>
          <img src={post.image} alt="Update Media" className="w-full h-auto max-h-[500px] object-cover" />
          <AnimatePresence>
            {showBigHeart && (
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
        <div className="w-full h-40 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border-y border-white/5 flex items-center justify-center relative overflow-hidden" onDoubleClick={handleDoubleTap}>
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
          <Sparkles className="w-16 h-16 text-indigo-400/30 absolute -top-4 -right-4" />
          <h2 className="text-2xl md:text-3xl font-black text-white px-8 text-center drop-shadow-xl z-10">{post.title}</h2>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleLike} className="group flex items-center gap-1.5 transition relative">
            <motion.div whileTap={{ scale: 0.8 }}>
              <Heart className={`w-7 h-7 transition ${isLiked ? 'text-red-500 fill-red-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
            </motion.div>
            <HeartExplosion show={showHeartExplosion} coordinates={clickCoords} />
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
        {isEditingPost ? (
          <div className="space-y-2 mb-2">
            <input 
              type="text" 
              value={editPostTitle} 
              onChange={e => setEditPostTitle(e.target.value)} 
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500" 
            />
            <textarea 
              value={editPostContent} 
              onChange={e => setEditPostContent(e.target.value)} 
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px]" 
            />
            <div className="flex justify-end">
              <button onClick={handleSavePostEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded transition">Save</button>
            </div>
          </div>
        ) : (
          <div>
            <span className="font-bold text-white mr-2">{post.author.username}</span>
            <span className="text-slate-200 text-sm whitespace-pre-wrap">
              {isExpanded || post.content.length <= 300 
                ? renderContentWithMentions(post.content) 
                : renderContentWithMentions(`${post.content.substring(0, 300)}...`)}
            </span>
            {post.content.length > 300 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-bold ml-1 transition"
              >
                {isExpanded ? "See less" : "See more"}
              </button>
            )}
          </div>
        )}
        
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
      <CommentsDrawer isOpen={showComments} onClose={() => setShowComments(false)} title="Comments">
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-4">
            {loadingComments ? (
              <div className="text-center text-sm text-slate-500 py-4">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-4">No comments yet. Be the first!</div>
            ) : (
              comments.map(c => {
                const cAuthorRank = getRankTheme(c.user.arisePoints, c.user.username);
                const CRankIcon = cAuthorRank.badgeIcon ? (Icons as any)[cAuthorRank.badgeIcon] : null;
                const canModify = isDev || isAdmin || user?.id === c.user.id;
                
                return (
                  <div key={c.id} className="flex gap-3">
                    <Link href={`/user/${c.user.username}`}>
                      {c.user.avatar ? (
                        <img src={c.user.avatar} alt="Avatar" className={`w-8 h-8 rounded-full object-cover border ${cAuthorRank.borderClass}`} />
                      ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${cAuthorRank.borderClass} ${cAuthorRank.bgCardClass}`}>
                          {(c.user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/user/${c.user.username}`} className="flex items-center gap-1 group">
                          <span className={`font-bold text-sm hover:underline ${cAuthorRank.textColorClass}`}>{c.user.username}</span>
                          {cAuthorRank.title && (
                            <div className={`px-1 py-0.5 rounded text-[8px] uppercase font-bold flex items-center gap-0.5 ${cAuthorRank.badgeClass}`}>
                              {CRankIcon && <CRankIcon className="w-2 h-2" />} {cAuthorRank.title}
                            </div>
                          )}
                        </Link>
                        <span className="text-xs text-slate-500">{timeAgo(c.createdAt)}</span>
                        
                        {canModify && (
                          <div className="ml-auto flex gap-2">
                            {user?.id === c.user.id && (
                              <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} className="text-xs text-slate-500 hover:text-indigo-400">Edit</button>
                            )}
                            <button onClick={() => handleDeleteCommentClick(c.id)} className="text-xs text-slate-500 hover:text-red-500">Delete</button>
                          </div>
                        )}
                      </div>
                      
                      {editingCommentId === c.id ? (
                        <div className="mt-1 flex gap-2">
                          <input 
                            type="text" 
                            value={editCommentContent} 
                            onChange={e => setEditCommentContent(e.target.value)} 
                            className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500" 
                          />
                          <button onClick={() => handleSaveCommentEdit(c.id)} className="text-indigo-400 font-bold text-xs">Save</button>
                          <button onClick={() => setEditingCommentId(null)} className="text-slate-400 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300 break-words whitespace-pre-wrap">{renderContentWithMentions(c.content)}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Add Comment Input */}
          <div className="pt-4 mt-4 border-t border-white/5 flex gap-3 items-center">
            {user?.avatar ? (
              <img src={user.avatar} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                {user ? (user.username || 'U').charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <form onSubmit={submitComment} className="flex-1 flex gap-2">
              <MentionsInput
                placeholder="Add a comment..."
                value={newComment}
                onChange={(val) => setNewComment(val)}
                onSubmit={submitComment as any}
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
              <button 
                type="submit" 
                disabled={!newComment.trim() || submitting}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-full transition flex items-center justify-center w-9 h-9 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </CommentsDrawer>

      {/* Custom Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f13] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              {/* Glassmorphic glow */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              
              <h3 className="text-xl font-bold text-white mb-2">Delete Update</h3>
              <p className="text-slate-400 text-sm mb-6">
                Are you absolutely sure you want to delete this update? This action cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-300 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
