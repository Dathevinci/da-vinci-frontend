"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ArrowUp, ArrowDown, Trash2, Send, CornerDownRight } from 'lucide-react';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { getRankTheme } from '@/lib/ranks';
import * as Icons from 'lucide-react';

interface Comment {
  id: string;
  parentId: string | null;
  animeTitle?: string;
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

interface CommentNode extends Comment {
  children: CommentNode[];
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

const buildCommentTree = (comments: Comment[]): CommentNode[] => {
  const commentMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach(c => {
    commentMap.set(c.id, { ...c, children: [] });
  });

  comments.forEach(c => {
    if (c.parentId && commentMap.has(c.parentId)) {
      commentMap.get(c.parentId)!.children.push(commentMap.get(c.id)!);
    } else {
      roots.push(commentMap.get(c.id)!);
    }
  });

  // Sort roots by score first, then newest
  roots.sort((a, b) => {
    const aIsDev = a.user.username.toLowerCase() === 'dejavuh';
    const bIsDev = b.user.username.toLowerCase() === 'dejavuh';
    if (aIsDev && !bIsDev) return -1;
    if (bIsDev && !aIsDev) return 1;
    
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  const sortChildren = (nodes: CommentNode[]) => {
    nodes.forEach(node => {
      node.children.sort((a, b) => {
        const aIsDev = a.user.username.toLowerCase() === 'dejavuh';
        const bIsDev = b.user.username.toLowerCase() === 'dejavuh';
        if (aIsDev && !bIsDev) return -1;
        if (bIsDev && !aIsDev) return 1;

        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      sortChildren(node.children);
    });
  };
  sortChildren(roots);

  return roots;
};

const CommentThread = ({
  node,
  depth = 0,
  user,
  replyingToId,
  setReplyingToId,
  replyContent,
  setReplyContent,
  handlePost,
  isReplying,
  handleVote,
  handleDelete,
  showAnimeContext
}: {
  node: CommentNode;
  depth?: number;
  user: any;
  replyingToId: string | null;
  setReplyingToId: (id: string | null) => void;
  replyContent: string;
  setReplyContent: (val: string) => void;
  handlePost: (parentId: string | null, content: string) => void;
  isReplying: boolean;
  handleVote: (id: string, val: number) => void;
  handleDelete: (id: string) => void;
  showAnimeContext?: boolean;
}) => {
  const maxDepth = 4;
  const currentDepth = Math.min(depth, maxDepth);
  const isDeep = depth >= maxDepth;

  const isDejavuh = node.user.username.toLowerCase() === 'dejavuh';
  const rankTheme = getRankTheme(node.user.arisePoints, node.user.username);
  const RankIcon = rankTheme.badgeIcon ? (Icons as any)[rankTheme.badgeIcon] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`relative ${depth > 0 ? 'mt-4' : 'mb-6'}`}
    >
      {depth > 0 && !isDeep && (
        <div className="absolute top-0 -left-4 sm:-left-6 md:-left-8 bottom-0 w-px bg-white/10" />
      )}
      
      <div className={`bg-[#0f0f11] rounded-xl flex overflow-hidden shadow-lg relative z-10 border ${isDejavuh ? rankTheme.borderClass + ' ' + rankTheme.glowClass : 'border-white/5'}`}>
        {/* Vote Bar */}
        <div className="bg-black/40 p-2 sm:p-4 flex flex-col items-center gap-1 border-r border-white/5 min-w-[40px] sm:min-w-[60px]">
          <button 
            onClick={() => handleVote(node.id, 1)}
            className={`p-1 rounded transition ${node.userVote === 1 ? 'text-orange-500 bg-orange-500/10' : 'text-slate-500 hover:text-orange-500 hover:bg-white/5'}`}
          >
            <ArrowUp className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
          <span className={`font-black text-xs sm:text-base ${node.userVote === 1 ? 'text-orange-500' : node.userVote === -1 ? 'text-indigo-500' : 'text-white'}`}>
            {node.score}
          </span>
          <button 
            onClick={() => handleVote(node.id, -1)}
            className={`p-1 rounded transition ${node.userVote === -1 ? 'text-indigo-500 bg-indigo-500/10' : 'text-slate-500 hover:text-indigo-500 hover:bg-white/5'}`}
          >
            <ArrowDown className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <Link href={`/user/${node.user.username}`} className="flex items-center gap-2 group">
              <img src={node.user.avatar || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80'} className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover ${isDejavuh ? 'ring-2 ring-purple-500 ring-offset-1 ring-offset-[#0f0f11]' : ''}`} />
              <span className={`font-bold text-sm sm:text-base transition truncate max-w-[100px] sm:max-w-[200px] ${isDejavuh ? rankTheme.textColorClass : 'text-indigo-300 group-hover:text-indigo-400'}`}>{node.user.username}</span>
              {rankTheme.title && (
                <div className={`hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 ${rankTheme.badgeClass}`}>
                  {RankIcon && <RankIcon className="w-3 h-3" />}
                  <span className="text-[10px] font-black tracking-wider uppercase">{rankTheme.title}</span>
                </div>
              )}
              <span className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">• {timeAgo(node.createdAt)}</span>
            </Link>
            
            <div className="flex items-center gap-1 shrink-0">
              {showAnimeContext && node.animeTitle && (
                <span className="text-[10px] sm:text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-md text-slate-400 flex items-center gap-1 max-w-[150px] sm:max-w-[200px] truncate">
                  on <span className="font-bold text-slate-300 truncate">{node.animeTitle}</span>
                </span>
              )}
              {user && (
                <button 
                  onClick={() => setReplyingToId(replyingToId === node.id ? null : node.id)}
                  className="text-slate-500 hover:text-indigo-400 p-1 sm:p-1.5 rounded hover:bg-indigo-500/10 transition flex items-center gap-1 text-xs font-bold"
                >
                  <CornerDownRight className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reply</span>
                </button>
              )}
              {user?.id === node.user.id && (
                <button 
                  onClick={() => handleDelete(node.id)}
                  className="text-slate-500 hover:text-red-500 p-1 sm:p-1.5 rounded hover:bg-red-500/10 transition"
                  title="Delete Post"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>
          
          <p className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{node.content}</p>

          {/* Reply Input Box */}
          <AnimatePresence>
            {replyingToId === node.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Replying to @${node.user.username}...`}
                    className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-base resize-none outline-none min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => setReplyingToId(null)}
                      className="text-slate-400 hover:text-white px-3 py-1.5 rounded text-xs sm:text-sm font-bold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handlePost(node.id, replyContent)}
                      disabled={isReplying || !replyContent.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition"
                    >
                      {isReplying ? 'Replying...' : 'Reply'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Render Children (Replies) */}
      {node.children.length > 0 && (
        <div className={isDeep ? "ml-0 mt-4" : "ml-4 sm:ml-8 md:ml-12 mt-4"}>
          {node.children.map(child => (
            <CommentThread 
              key={child.id} 
              node={child} 
              depth={currentDepth + 1}
              user={user}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              handlePost={handlePost}
              isReplying={isReplying}
              handleVote={handleVote}
              handleDelete={handleDelete}
              showAnimeContext={showAnimeContext}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default function CommunityFeed({ animeId, animeTitle }: { animeId?: number, animeTitle?: string }) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [animeId, user?.id]);

  const handlePost = async (parentId: string | null = null, content: string) => {
    if (!user) return setError("You must be logged in to post.");
    if (!content.trim()) return;

    if (parentId) setIsReplying(true);
    else setIsPosting(true);

    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          animeId,
          animeTitle,
          content,
          parentId
        })
      });
      
      if (!res.ok) throw new Error(`Backend Error ${res.status}`);
      
      const data = await res.json();
      if (data.success) {
        setComments([data.data, ...comments]);
        if (parentId) {
          setReplyingToId(null);
          setReplyContent("");
        } else {
          setNewComment("");
        }
      } else {
        throw new Error(data.message || "Failed to post.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to post. Ensure backend is updated.");
    } finally {
      setIsPosting(false);
      setIsReplying(false);
    }
  };

  const handleVote = async (commentId: string, value: number) => {
    if (!user) return setError("You must be logged in to vote.");

    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;

    const comment = comments[commentIndex];
    let newValue = value;
    if (comment.userVote === value) newValue = 0;

    const voteDiff = newValue - comment.userVote;
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

  const handleDelete = (commentId: string) => {
    if (!user) return;
    setCommentToDelete(commentId);
  };

  const executeDelete = async () => {
    if (!user || !commentToDelete) return;

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentToDelete}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      if (!res.ok) throw new Error("Failed to delete");
      const data = await res.json();
      if (data.success) {
        setComments(comments.filter(c => c.id !== commentToDelete));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to delete post.");
    } finally {
      setCommentToDelete(null);
    }
  };

  const commentTree = buildCommentTree(comments);

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-8 relative z-20">
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 right-4 bg-red-600/90 backdrop-blur-md border border-red-400 text-white px-4 py-2 rounded-lg font-bold shadow-2xl z-50 flex items-center gap-2"
          >
            <span>⚠️</span> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-6 sm:mb-8 pl-2 sm:pl-0">
        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">Community Views</h2>
      </div>

      {user ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden mx-2 sm:mx-0">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your views or review..."
            className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-base resize-none outline-none min-h-[80px] sm:min-h-[100px]"
          />
          <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
            <button
              onClick={() => handlePost(null, newComment)}
              disabled={isPosting || !newComment.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 sm:px-6 py-2 rounded-full text-sm sm:text-base font-bold transition shadow-lg"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Post View</span>
              <span className="inline sm:hidden">Post</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 sm:p-6 mb-8 text-center mx-2 sm:mx-0">
          <p className="text-indigo-200 text-sm sm:text-base font-medium">Log in to share your views with the community!</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2 px-2 sm:px-0">
          <AnimatePresence>
            {commentTree.map(node => (
              <CommentThread 
                key={node.id} 
                node={node} 
                user={user}
                replyingToId={replyingToId}
                setReplyingToId={setReplyingToId}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                handlePost={handlePost}
                isReplying={isReplying}
                handleVote={handleVote}
                handleDelete={handleDelete}
                showAnimeContext={!animeId}
              />
            ))}
            
            {commentTree.length === 0 && (
              <div className="text-center py-10 sm:py-20 text-slate-500 text-sm sm:text-base font-medium">
                No views have been posted yet. Be the first to start the discussion!
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!commentToDelete}
        title="Delete View"
        message="Are you sure you want to permanently delete this comment? This action cannot be undone and your Arise Points will be adjusted."
        confirmText="Delete"
        cancelText="Keep it"
        onConfirm={executeDelete}
        onCancel={() => setCommentToDelete(null)}
      />
    </div>
  );
}
