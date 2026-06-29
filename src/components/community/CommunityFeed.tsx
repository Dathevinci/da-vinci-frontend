"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ArrowUp, ArrowDown, Trash2, Send } from 'lucide-react';
import Link from 'next/link';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  score: number;
  userVote: number;
  user: {
    id: string;
    username: string;
    avatar: string;
    arisePoints: number;
  };
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export default function CommunityFeed({ animeId }: { animeId?: number }) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchComments = async () => {
    try {
      const url = new URL(`${API_URL}/api/comments`);
      if (animeId) url.searchParams.set('animeId', animeId.toString());
      if (user) url.searchParams.set('userId', user.id);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch (err) {
      console.error(err);
      // Don't show error toast for fetch, just leave it empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [animeId, user?.id]);

  const handlePost = async () => {
    if (!user) return setError("You must be logged in to post.");
    if (!newComment.trim()) return;

    setIsPosting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          animeId,
          content: newComment
        })
      });
      
      if (!res.ok) throw new Error(`Backend Error ${res.status}`);
      
      const data = await res.json();
      if (data.success) {
        setNewComment("");
        setComments([data.data, ...comments]);
      } else {
        throw new Error(data.message || "Failed to post view.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to post. Is your backend database synced?");
    } finally {
      setIsPosting(false);
    }
  };

  const handleVote = async (commentId: string, value: number) => {
    if (!user) return setError("You must be logged in to vote.");

    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;

    const comment = comments[commentIndex];
    let newValue = value;
    
    if (comment.userVote === value) {
      newValue = 0;
    }

    const oldVote = comment.userVote;
    const voteDiff = newValue - oldVote;
    
    const newComments = [...comments];
    newComments[commentIndex] = {
      ...comment,
      userVote: newValue,
      score: comment.score + voteDiff
    };
    setComments(newComments);

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, value: newValue })
      });
      if (!res.ok) throw new Error("Vote failed");
    } catch (err) {
      console.error(err);
      setError("Failed to cast vote.");
      fetchComments(); // revert optimistic update
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      if (!res.ok) throw new Error("Failed to delete");
      const data = await res.json();
      if (data.success) {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to delete post.");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 relative z-20">
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 right-4 bg-red-600/90 backdrop-blur-md border border-red-400 text-white px-4 py-2 rounded-lg font-bold shadow-2xl z-50 flex items-center gap-2"
          >
            <span>⚠️</span> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-8">
        <MessageSquare className="w-8 h-8 text-indigo-500" />
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Community Views</h2>
      </div>

      {user ? (
        <div className="bg-[#141414] border border-white/10 rounded-xl p-4 mb-8 shadow-xl relative overflow-hidden">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your views or review..."
            className="w-full bg-transparent text-white placeholder-slate-500 resize-none outline-none min-h-[100px]"
          />
          <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
            <button
              onClick={handlePost}
              disabled={isPosting || !newComment.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2 rounded-full font-bold transition shadow-lg"
            >
              <Send className="w-4 h-4" />
              {isPosting ? 'Posting...' : 'Post View'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-6 mb-8 text-center">
          <p className="text-indigo-200 font-medium">Log in to share your views with the community!</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {comments.map(comment => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="bg-[#0f0f11] border border-white/5 rounded-xl flex overflow-hidden shadow-lg"
              >
                {/* Vote Bar */}
                <div className="bg-black/40 p-2 sm:p-4 flex flex-col items-center gap-1 border-r border-white/5 min-w-[50px] sm:min-w-[60px]">
                  <button 
                    onClick={() => handleVote(comment.id, 1)}
                    className={`p-1.5 rounded transition ${comment.userVote === 1 ? 'text-orange-500 bg-orange-500/10' : 'text-slate-500 hover:text-orange-500 hover:bg-white/5'}`}
                  >
                    <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <span className={`font-black text-sm sm:text-base ${comment.userVote === 1 ? 'text-orange-500' : comment.userVote === -1 ? 'text-indigo-500' : 'text-white'}`}>
                    {comment.score}
                  </span>
                  <button 
                    onClick={() => handleVote(comment.id, -1)}
                    className={`p-1.5 rounded transition ${comment.userVote === -1 ? 'text-indigo-500 bg-indigo-500/10' : 'text-slate-500 hover:text-indigo-500 hover:bg-white/5'}`}
                  >
                    <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <Link href={`/user/${comment.user.username}`} className="flex items-center gap-2 group">
                      <img src={comment.user.avatar || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80'} className="w-6 h-6 rounded-full object-cover" />
                      <span className="font-bold text-indigo-300 group-hover:text-indigo-400 transition">{comment.user.username}</span>
                      <span className="text-xs text-slate-500">• {timeAgo(comment.createdAt)} ago</span>
                    </Link>
                    
                    {user?.id === comment.user.id && (
                      <button 
                        onClick={() => handleDelete(comment.id)}
                        className="text-slate-500 hover:text-red-500 p-1.5 rounded hover:bg-red-500/10 transition"
                        title="Delete Post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                </div>
              </motion.div>
            ))}
            
            {comments.length === 0 && (
              <div className="text-center py-20 text-slate-500 font-medium">
                No views have been posted yet. Be the first to start the discussion!
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
