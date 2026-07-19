"use client";

import { useState, useEffect } from 'react';
import { useAnimeModal } from '@/components/providers/AnimeModalProvider';
import { Anime } from '@tutkli/jikan-ts';
import { useUser } from '@/hooks/useUser';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Heart, Trash2, Send, CornerDownRight, Zap, Flame, Crown, Code2, Sparkles, Feather, Leaf, User as UserIcon, Image as ImageIcon, Edit, Shield, Star, ShieldAlert, Eye, Compass, ArrowUpRight, Pin, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { isAdmin, isLeadDev } from "@/lib/admin";
import { nameColorClass } from "@/lib/cosmetics";
import { AvatarDecoration, hasFrameRing } from "@/components/profile/AvatarDecoration";
import UserLink from "@/components/profile/UserLink";
import ConfirmModal from '@/components/ui/ConfirmModal';
import HeartExplosion from '@/components/ui/HeartExplosion';
import CommentsDrawer from '@/components/ui/CommentsDrawer';
import { getRankTheme } from '@/lib/ranks';
const RankIcons: Record<string, any> = {
  Code2,
  ShieldAlert,
  Sparkles,
  Crown,
  Feather,
  Zap,
  Leaf,
  Eye,
  User: UserIcon,
  Flame,
  Compass,
  ArrowUpRight
};
import { useToast } from '@/components/ui/Toast';
import MentionsTextarea from '@/components/ui/MentionsTextarea';

interface Comment {
  id: string;
  parentId: string | null;
  animeId?: number;
  animeTitle?: string;
  mediaUrl?: string;
  content: string;
  isPinned?: boolean;
  blessed?: boolean;
  createdAt: string;
  score: number;
  userVote: number;
  user: {
    id: string;
    username: string;
    avatar: string;
    arisePoints: number;
    activeEffect?: string;
    activeFont?: string;
    activeColor?: string;
    activeRole?: string;
    activeTag?: string;
    activeFrame?: string;
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

const buildCommentTree = (comments: Comment[], currentSortBy: 'newest' | 'top' | 'oldest') => {
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

  const sortNodes = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => {
      // Pinned posts always at top of feed for root comments
      if (!a.parentId && !b.parentId) {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
      }

      if (currentSortBy === 'top') {
        if (b.score !== a.score) return b.score - a.score;
      } else if (currentSortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      // Default / Newest fallback
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    nodes.forEach(node => sortNodes(node.children));
  };

  sortNodes(roots);
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
  replyMediaUrl,
  setReplyMediaUrl,
  handlePost,
  isReplying,
  handleVote,
  handleTip,
  handleDelete,
  handleEdit,
  handleBless,
  handlePin,
  showAnimeContext
}: {
  node: CommentNode;
  depth?: number;
  user: any;
  replyingToId: string | null;
  setReplyingToId: (id: string | null) => void;
  replyContent: string;
  setReplyContent: (val: string) => void;
  replyMediaUrl: string;
  setReplyMediaUrl: (val: string) => void;
  handlePost: (parentId: string | null, content: string, mediaUrl?: string) => void;
  isReplying: boolean;
  handleVote: (id: string, val: number) => void;
  handleTip: (id: string) => void;
  handleDelete: (id: string) => void;
  handleEdit: (id: string, content: string, mediaUrl?: string) => Promise<void>;
  handleBless: (commentId: string, username: string) => void;
  handlePin: (id: string) => Promise<void>;
  showAnimeContext?: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.content);
  const [editMediaUrl, setEditMediaUrl] = useState(node.mediaUrl || "");
  const [showHeartExplosion, setShowHeartExplosion] = useState(false);
  const [clickCoords, setClickCoords] = useState<{x: number, y: number} | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 1);
  const { openAnime } = useAnimeModal();

  const maxDepth = 4;
  const currentDepth = Math.min(depth, maxDepth);
  const isDeep = depth >= maxDepth;

  const isDejavuh = isLeadDev(node.user?.username);
  // A bought frame / Voltaic ring takes priority over the Lead-Dev accent ring.
  const nodeHasRing = hasFrameRing((node.user as any)?.activeFrame, node.user?.activeEffect);
  const isViewerDev = isAdmin(user);
  const isViewerAdmin = user?.username?.toLowerCase() === 'davinci' || user?.username?.toLowerCase() === 'xhackerdevil';
  const isAuthor = user?.id === node.user?.id;
  const canManage = isAuthor || isViewerDev || isViewerAdmin;
  
  const rankTheme = getRankTheme((node.user as any)?.xp || 0, node.user?.username || 'Unknown');
  const RankIcon = rankTheme.badgeIcon ? RankIcons[rankTheme.badgeIcon] : null;

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
      
      {/* Supreme Glow for Dejavuh */}
      {isDejavuh && (
        <div className="absolute -inset-[2px] bg-gradient-to-r from-fuchsia-500 via-purple-600 to-purple-500 rounded-xl blur-[6px] opacity-80 animate-pulse pointer-events-none" />
      )}
      {/* Golden aura for a comment that received a Divine Blessing */}
      {node.blessed && !isDejavuh && (
        <div className="absolute -inset-[2px] bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 rounded-xl blur-[6px] opacity-50 pointer-events-none" />
      )}

      <div className={`rounded-2xl flex flex-col overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative z-10 p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ${
        isDejavuh 
          ? 'bg-[#121214]/90 backdrop-blur-md border border-purple-500/50 ring-1 ring-purple-500/20' 
          : node.isPinned 
            ? 'bg-gradient-to-br from-amber-500/10 to-[#0a0a0c]/90 backdrop-blur-md border border-amber-500/30 ring-1 ring-amber-500/20' 
            : 'bg-[#121214]/80 backdrop-blur-md border border-white/5 hover:border-white/10 ring-1 ring-white/5'
      }`}>
        
        {/* Pinned Badge */}
        {node.isPinned && (
          <div className="flex items-center gap-1 text-xs font-bold text-amber-400 mb-2">
            <Pin className="w-3 h-3 fill-amber-400" /> Pinned by Admin
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <UserLink username={node.user?.username || 'unknown'} className="flex items-center gap-3 group">
            <div className="relative">
              {node.user?.activeEffect === 'effect_sparkles' && (
                <div className="absolute -inset-3 z-0 pointer-events-none overflow-hidden">
                  <div className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full animate-ping left-1 top-0"></div>
                  <div className="absolute w-1 h-1 bg-yellow-200 rounded-full animate-pulse right-0 top-1"></div>
                  <div className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping left-0 bottom-1"></div>
                  <div className="absolute w-1 h-1 bg-white rounded-full animate-pulse right-1 bottom-0"></div>
                </div>
              )}
              <img src={node.user?.avatar || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80'} className={`relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ${isDejavuh && !nodeHasRing ? 'ring-2 ring-fuchsia-500 ring-offset-1 ring-offset-[#0f0f11] shadow-[0_0_15px_rgba(217,70,239,0.5)]' : ''}`} />
              <AvatarDecoration frame={(node.user as any)?.activeFrame} effect={node.user?.activeEffect} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm sm:text-base transition 
                  ${node.user?.activeFont === 'font_cyber' ? 'font-mono tracking-widest' : ''} 
                  ${node.user?.activeFont === 'font_pixel' ? 'font-serif tracking-tight' : ''} 
                  ${nameColorClass(node.user?.activeColor) || (isDejavuh ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'text-purple-300 group-hover:text-purple-400')}`}>
                  {node.user?.username || 'Unknown User'}
                </span>
                
                {isDejavuh ? (
                  <div className="hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)]">
                    <Crown className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Lead Developer</span>
                  </div>
                ) : isAdmin(node.user?.username) && rankTheme.title ? (
                  <div className={`hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 ${rankTheme.badgeClass}`}>
                    {RankIcon && <RankIcon className="w-3 h-3" />}
                    <span className="text-[10px] font-black tracking-wider uppercase">{rankTheme.title}</span>
                  </div>
                ) : node.user?.activeRole === 'role_watcher' ? (
                  <div className="hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <Shield className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">The Watcher</span>
                  </div>
                ) : node.user?.activeRole === 'role_elite' ? (
                  <div className="hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    <Star className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Elite</span>
                  </div>
                ) : rankTheme.title ? (
                  <div className={`hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 ${rankTheme.badgeClass}`}>
                    {RankIcon && <RankIcon className="w-3 h-3" />}
                    <span className="text-[10px] font-black tracking-wider uppercase">{rankTheme.title}</span>
                  </div>
                ) : null}

                {node.user?.activeTag === 'tag_og' && (
                  <div className="hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 bg-red-500/20 text-red-400">
                    <Zap className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">OG</span>
                  </div>
                )}
                {node.user?.activeTag === 'tag_weeb' && (
                  <div className="hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 bg-pink-500/20 text-pink-400">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Weeb Lord</span>
                  </div>
                )}
                {node.blessed && (
                  <div className="flex px-2 py-0.5 rounded-full items-center gap-1 bg-gradient-to-r from-amber-400/25 to-yellow-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.35)]" title="Blessed with Arise Points by an admin">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Divine Blessing</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500">{timeAgo(node.createdAt)}</span>
            </div>
          </UserLink>
          
          <div className="flex items-center gap-2 shrink-0">
            {(isViewerDev || isViewerAdmin) && !isDejavuh && !node.blessed && (
              <button
                onClick={() => handleBless(node.id, node.user?.username || 'Unknown')}
                className="text-amber-400 hover:text-amber-300 p-1 sm:p-1.5 rounded hover:bg-amber-400/10 transition flex items-center gap-1 text-xs font-bold"
                title="Grant a Divine Blessing (+500 Arise Points)"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
            
            {canManage && (
              <>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-slate-500 hover:text-purple-400 p-1 sm:p-1.5 rounded hover:bg-purple-500/10 transition"
                  title="Edit Post"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {(isViewerDev || isViewerAdmin) && (
                  <button 
                    onClick={() => handlePin(node.id)}
                    className={`p-1 sm:p-1.5 rounded transition flex items-center gap-1 text-xs font-bold ${node.isPinned ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10" : "text-slate-500 hover:text-amber-400 hover:bg-amber-400/10"}`}
                    title={node.isPinned ? "Unpin Post" : "Pin Post"}
                  >
                    <Pin className={`w-4 h-4 ${node.isPinned ? 'fill-amber-400' : ''}`} />
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(node.id)}
                  className={`p-1 sm:p-1.5 rounded transition flex items-center gap-1 text-xs font-bold ${(!isAuthor && (isViewerDev || isViewerAdmin)) ? "text-red-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-500 hover:text-red-500 hover:bg-red-500/10"}`}
                  title={!isAuthor ? "Nuke Post" : "Delete Post"}
                >
                  {(!isAuthor && (isViewerDev || isViewerAdmin)) ? <Flame className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Anime Context */}
        {showAnimeContext && node.animeTitle && node.animeId && (
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openAnime({
                mal_id: node.animeId as number,
                title: node.animeTitle as string,
                // Pass minimal required fields, the modal will fetch the rest
                images: { jpg: { image_url: '', large_image_url: '', small_image_url: '' }, webp: { image_url: '', large_image_url: '', small_image_url: '' } },
                url: '',
              } as Anime);
            }} 
            className="mb-3 inline-block self-start cursor-pointer text-left"
          >
            <span className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-md text-slate-400 flex items-center gap-1 transition">
              on <span className="font-bold text-purple-300 hover:text-purple-400 truncate max-w-[250px]">{node.animeTitle}</span>
            </span>
          </button>
        )}

        {/* Content */}
        {isEditing ? (
          <div className="mb-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-black/40 text-white placeholder-slate-500 text-sm sm:text-base resize-none outline-none min-h-[80px] p-3 rounded-lg border border-white/10 focus-within:border-purple-500/50"
            />
            <div className="mt-2 mb-2 flex items-center gap-2 px-3 py-2 bg-black/40 rounded-xl border border-white/5 focus-within:border-purple-500/50 transition">
              <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <input 
                type="url"
                placeholder="Attach Image/GIF URL (optional)"
                value={editMediaUrl}
                onChange={(e) => setEditMediaUrl(e.target.value)}
                className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-md text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
              <button 
                onClick={async () => {
                  await handleEdit(node.id, editContent, editMediaUrl);
                  setIsEditing(false);
                }}
                disabled={!editContent.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo- text-white hover:bg-purple-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
              {isExpanded || node.content.length <= 300 
                ? node.content 
                : `${node.content.substring(0, 300)}...`}
            </p>
            {node.content.length > 300 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-purple-400 hover:text-purple-300 text-sm font-bold mt-1 transition"
              >
                {isExpanded ? "See less" : "See more"}
              </button>
            )}
          </div>
        )}

        {/* Media / GIF rendering */}
        {node.mediaUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/50 self-start max-w-full">
            <img 
              src={node.mediaUrl} 
              alt="Community attached media" 
              className="max-h-[350px] w-auto object-contain hover:scale-[1.02] transition-transform duration-300"
              onError={(e) => {
                // If it fails to load (e.g. invalid URL), hide it gracefully
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Action Bar (Instagram Style) */}
        <div className="flex items-center gap-4 mt-auto pt-2 border-t border-white/5">
          <button 
            onClick={(e) => {
              const newVote = node.userVote === 1 ? 0 : 1;
              if (newVote === 1) {
                setClickCoords({ x: e.clientX, y: e.clientY });
                setShowHeartExplosion(true);
                setTimeout(() => setShowHeartExplosion(false), 1000);
              }
              handleVote(node.id, newVote);
            }}
            className="group flex items-center gap-1.5 transition relative"
          >
            <motion.div whileTap={{ scale: 0.8 }}>
              <Heart className={`w-5 h-5 transition ${node.userVote === 1 ? 'text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-slate-400 group-hover:text-slate-300'}`} />
            </motion.div>
            <span className="text-xs sm:text-sm font-bold text-slate-400">{node.score}</span>
            <HeartExplosion show={showHeartExplosion} coordinates={clickCoords} />
          </button>
          
          <button 
            onClick={() => {
              if (depth === 0) {
                setShowDrawer(true);
              } else {
                setReplyingToId(replyingToId === node.id ? null : node.id);
              }
            }}
            className="group flex items-center gap-1.5 transition"
          >
            <motion.div whileTap={{ scale: 0.8 }}>
              <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
            </motion.div>
            <span className="text-xs sm:text-sm font-bold text-slate-400">{node.children?.length || 0}</span>
          </button>

          {!isAuthor && (
            <button
              onClick={() => handleTip(node.id)}
              className="group ml-auto flex items-center gap-1.5 transition"
              title="Tip 10 Arise Points to this comment"
            >
              <motion.div whileTap={{ scale: 0.85 }}>
                <Sparkles className="w-5 h-5 text-slate-400 transition group-hover:text-amber-400" />
              </motion.div>
              <span className="text-xs font-bold text-slate-400 transition group-hover:text-amber-400 sm:text-sm">Tip</span>
            </button>
          )}
        </div>

          {/* Reply Input Box */}
          <AnimatePresence>
            {replyingToId === node.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="bg-gradient-to-br from-[#18181b]/95 to-[#0f0f11]/95 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                  <MentionsTextarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Replying to @${node.user?.username || 'Unknown'}...`}
                    className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-base resize-none outline-none min-h-[60px]"
                  />
                  <div className="mt-3 mb-3 flex items-center gap-3 px-4 py-2 bg-black/50 rounded-xl border border-white/5 focus-within:border-purple-500/50 focus-within:bg-purple-500/5 transition-all ring-1 ring-black/20">
                    <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <input 
                      type="url"
                      placeholder="Attach Image/GIF URL (optional)"
                      value={replyMediaUrl}
                      onChange={(e) => setReplyMediaUrl(e.target.value)}
                      className="bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 w-full outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => {
                        setReplyingToId(null);
                        setReplyMediaUrl('');
                      }}
                      className="text-slate-400 hover:text-white px-4 py-1.5 rounded-full hover:bg-white/5 text-xs sm:text-sm font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handlePost(node.id, replyContent, replyMediaUrl)}
                      disabled={isReplying || !replyContent.trim()}
                      className="bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-500 hover:to-purple-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:shadow-none text-white px-5 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all hover:scale-[1.02]"
                    >
                      {isReplying ? 'Replying...' : 'Reply'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* Render Children (Replies) */}
      {depth === 0 ? (
        <CommentsDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} title={`Views on ${node.user?.username || 'User'}'s post`}>
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              {node.children.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-4">No replies yet. Be the first!</div>
              ) : (
                node.children.map(child => (
                  <CommentThread 
                    key={child.id} 
                    node={child} 
                    depth={currentDepth + 1}
                    user={user}
                    replyingToId={replyingToId}
                    setReplyingToId={setReplyingToId}
                    replyContent={replyContent}
                    setReplyContent={setReplyContent}
                    replyMediaUrl={replyMediaUrl}
                    setReplyMediaUrl={setReplyMediaUrl}
                    handlePost={handlePost}
                    isReplying={isReplying}
                    handleVote={handleVote} handleTip={handleTip}
                    handleDelete={handleDelete}
                    handleEdit={handleEdit}
                    handleBless={handleBless}
                    handlePin={handlePin}
                    showAnimeContext={showAnimeContext}
                  />
                ))
              )}
            </div>
            
            {/* Always show a reply box at the bottom of the drawer for the root post */}
            <div className="pt-4 mt-4 border-t border-white/5 bg-black/30 sticky bottom-0">
              {user ? (
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-lg">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Reply to @${node.user?.username || 'Unknown'}...`}
                    className="w-full bg-transparent text-white placeholder-slate-500 text-sm resize-none outline-none min-h-[50px]"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <input 
                      type="url"
                      placeholder="Attach Image/GIF URL"
                      value={replyMediaUrl}
                      onChange={(e) => setReplyMediaUrl(e.target.value)}
                      className="bg-transparent text-xs text-white placeholder-slate-500 w-full outline-none"
                    />
                  </div>
                  <div className="flex justify-end pt-2 border-t border-white/5 mt-2">
                    <button
                      onClick={() => {
                        handlePost(node.id, replyContent, replyMediaUrl);
                        if (!isReplying) {
                          setReplyContent("");
                          setReplyMediaUrl("");
                        }
                      }}
                      disabled={isReplying || !replyContent.trim()}
                      className="bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-500 hover:to-purple-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] disabled:opacity-50 text-white px-5 py-1.5 rounded-full text-xs font-bold transition-all"
                    >
                      {isReplying ? 'Replying...' : 'Reply'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500">Log in to reply.</div>
              )}
            </div>
          </div>
        </CommentsDrawer>
      ) : (
        node.children.length > 0 && (
          <div className={isDeep ? "ml-0 mt-4" : "ml-2 sm:ml-6 md:ml-12 mt-4"}>
            {!showReplies ? (
              <button 
                onClick={() => setShowReplies(true)}
                className="flex items-center gap-1 text-xs sm:text-sm font-bold text-purple-400 hover:text-purple-300 transition mb-2"
              >
                <ChevronDown className="w-4 h-4" /> View {node.children.length} {node.children.length === 1 ? 'reply' : 'replies'}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setShowReplies(false)}
                  className="flex items-center gap-1 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-400 transition mb-4"
                >
                  <ChevronUp className="w-4 h-4" /> Hide replies
                </button>
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
                    replyMediaUrl={replyMediaUrl}
                    setReplyMediaUrl={setReplyMediaUrl}
                    handlePost={handlePost}
                    isReplying={isReplying}
                    handleVote={handleVote} handleTip={handleTip}
                    handleDelete={handleDelete}
                    handleEdit={handleEdit}
                    handleBless={handleBless}
                    handlePin={handlePin}
                    showAnimeContext={showAnimeContext}
                  />
                ))}
              </>
            )}
          </div>
        )
      )}
    </motion.div>
  );
};

export default function CommunityFeed({ 
  animeId, animeTitle,
  mangaId, mangaTitle,
  chapterId, chapterTitle
}: { 
  animeId?: number, animeTitle?: string,
  mangaId?: string, mangaTitle?: string,
  chapterId?: string, chapterTitle?: string
}) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and Pagination State
  const [sortBy, setSortBy] = useState<'newest' | 'top' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyMediaUrl, setReplyMediaUrl] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchComments = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      const url = new URL(`${API_URL}/api/comments`);
      if (animeId) url.searchParams.set('animeId', animeId.toString());
      if (mangaId) url.searchParams.set('mangaId', mangaId);
      if (chapterId) url.searchParams.set('chapterId', chapterId);
      if (user) url.searchParams.set('userId', user.id);
      url.searchParams.set('sort', sortBy);
      if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());
      if (mediaOnly) url.searchParams.set('mediaOnly', 'true');
      url.searchParams.set('page', pageNum.toString());
      url.searchParams.set('limit', '20');
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      if (data.success) {
        if (append) {
          const newComments = data.data.filter((newC: Comment) => !comments.find(c => c.id === newC.id));
          setComments([...comments, ...newComments]);
        } else {
          setComments(data.data || []);
        }
        setHasMore(data.data.length >= 20); // If backend returns 20 root comments + replies, data.data might be > 20, but it's fine
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchComments(1, false);
  }, [animeId, user?.id, sortBy, mediaOnly]);

  const handlePin = async (commentId: string) => {
    if (!user) return;
    
    // Optimistic Update
    setComments(comments.map(c => c.id === commentId ? { ...c, isPinned: !c.isPinned } : c));
    
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to pin");
      }
      toast(data.message || "Pin toggled", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to toggle pin.", "error");
      // Revert optimistic update
      setComments(comments.map(c => c.id === commentId ? { ...c, isPinned: !c.isPinned } : c));
    }
  };

  const handlePost = async (parentId: string | null = null, content: string, mediaUrl?: string) => {
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
          mangaId,
          mangaTitle,
          chapterId,
          chapterTitle,
          content,
          parentId,
          mediaUrl
        })
      });
      
      if (!res.ok) throw new Error(`Backend Error ${res.status}`);
      
      const data = await res.json();
      if (data.success) {
        setComments([data.data, ...comments]);
        if (parentId) {
          setReplyingToId(null);
          setReplyContent("");
          setReplyMediaUrl("");
        } else {
          setNewComment("");
          setNewMediaUrl("");
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

  const handleTip = async (commentId: string) => {
    if (!user) return setError("You must be logged in to tip.");
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`Tipped ${data.tip} Arise Points ✨`, "success");
        // Reflect the new balance everywhere (navbar, profile) immediately.
        if (typeof data.arisePoints === "number") {
          const stored = localStorage.getItem("davinci_user");
          if (stored) {
            try {
              const u = JSON.parse(stored);
              u.arisePoints = data.arisePoints;
              localStorage.setItem("davinci_user", JSON.stringify(u));
              window.dispatchEvent(new Event("davinci_user_updated"));
            } catch {}
          }
        }
      } else {
        toast(data.message || "Couldn't tip this comment.", "error");
      }
    } catch (err) {
      toast("Failed to tip.", "error");
    }
  };

  const handleDelete = (commentId: string) => {
    if (!user) return;
    setCommentToDelete(commentId);
  };

  const handleEdit = async (id: string, content: string, mediaUrl?: string) => {
    if (!user) return setError("You must be logged in to edit.");
    
    // Optimistic Update
    const oldComments = [...comments];
    setComments(comments.map(c => c.id === id ? { ...c, content, mediaUrl } : c));

    try {
      const res = await fetch(`${API_URL}/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, content, mediaUrl })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to edit");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to edit post.");
      setComments(oldComments);
    }
  };

  const executeDelete = async () => {
    if (!user || !commentToDelete) return;

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentToDelete}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete");
      }
      
      const recursivelyRemove = (list: Comment[]): Comment[] => list.filter(c => c.id !== commentToDelete);
      setComments(recursivelyRemove(comments));
      
      if (isAdmin(user)) {
        toast("Target neutralized.", "success");
      } else {
        toast("Post deleted.", "success");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to delete post.");
    } finally {
      setCommentToDelete(null);
    }
  };

  const handleBless = async (commentId: string, username: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/bless`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`✦ Divine Blessing granted — +${data.blessing} Arise Points to ${username}!`, "success");
        // Mark the comment blessed so its badge appears immediately.
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, blessed: true } : c));
      } else {
        toast(data.message || "Couldn't grant the blessing.", "error");
      }
    } catch (err) {
      toast("Failed to grant the blessing.", "error");
    }
  };

  const commentTree = buildCommentTree(comments, sortBy);

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-8 relative z-20">
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 right-4 bg-red-/90 backdrop-blur-md border border-red-400 text-white px-4 py-2 rounded-lg font-bold shadow-2xl z-50 flex items-center gap-2"
          >
            <span>⚠️</span> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-6 sm:mb-8 pl-2 sm:pl-0">
        <div className="p-2 bg-purple-500/10 rounded-xl ring-1 ring-purple-500/20 shadow-[0_0_15px_rgba(79,70,229,0.2)]">
          <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
        </div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">Community Views</h2>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 bg-[#0a0a0c]/80 backdrop-blur-xl p-3 rounded-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl mx-2 sm:mx-0">
        <div className="flex-1 flex items-center bg-black/40 rounded-xl px-4 py-2.5 border border-white/5 focus-within:border-purple-500/50 focus-within:bg-purple-500/5 transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Search comments..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchComments(1, false))}
            className="bg-transparent text-sm text-white w-full outline-none"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-black/40 border border-white/5 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-purple-500/50 focus:bg-purple-500/5 cursor-pointer appearance-none transition-all hover:bg-black/60"
          >
            <option value="newest" className="bg-[#121214]">Newest</option>
            <option value="top" className="bg-[#121214]">Top Votes</option>
            <option value="oldest" className="bg-[#121214]">Oldest</option>
          </select>
          
          <button 
            onClick={() => setMediaOnly(!mediaOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
              mediaOnly 
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(79,70,229,0.15)]' 
                : 'bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-black/60 hover:border-white/10'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Media Only</span>
          </button>
        </div>
      </div>

      {user ? (
        <div className="bg-gradient-to-br from-[#18181b]/95 to-[#0f0f11]/95 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 rounded-3xl p-5 sm:p-6 mb-8 shadow-[0_15px_40px_rgba(0,0,0,0.5)] relative overflow-hidden mx-2 sm:mx-0">
          <MentionsTextarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your views or review..."
            className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-base resize-none outline-none min-h-[80px] sm:min-h-[100px]"
          />
          <div className="mt-3 mb-3 flex items-center gap-3 px-4 py-2.5 bg-black/50 rounded-2xl border border-white/5 focus-within:border-purple-500/50 focus-within:bg-purple-500/5 transition-all ring-1 ring-black/20">
            <ImageIcon className="w-5 h-5 text-slate-400 shrink-0" />
            <input 
              type="url"
              placeholder="Attach Image/GIF URL (optional)"
              value={newMediaUrl}
              onChange={(e) => setNewMediaUrl(e.target.value)}
              className="bg-transparent text-sm sm:text-base text-white placeholder-slate-500 w-full outline-none"
            />
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => handlePost(null, newComment, newMediaUrl)}
              disabled={isPosting || !newComment.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-500 hover:to-purple-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:shadow-none text-white px-6 sm:px-8 py-2.5 rounded-full text-sm sm:text-base font-bold transition-all duration-300 hover:scale-[1.02]"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Post View</span>
              <span className="inline sm:hidden">Post</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-4 sm:p-6 mb-8 text-center mx-2 sm:mx-0">
          <p className="text-purple-200 text-sm sm:text-base font-medium">Log in to share your views with the community!</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
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
                replyMediaUrl={replyMediaUrl}
                setReplyMediaUrl={setReplyMediaUrl}
                handlePost={handlePost}
                isReplying={isReplying}
                handleVote={handleVote} handleTip={handleTip}
                handleDelete={handleDelete}
                handleEdit={handleEdit}
                handleBless={handleBless}
                handlePin={handlePin}
                showAnimeContext={!animeId}
              />
            ))}
            
            {commentTree.length === 0 && (
              <div className="text-center py-10 sm:py-20 text-slate-500 text-sm sm:text-base font-medium">
                No views have been posted yet. Be the first to start the discussion!
              </div>
            )}

            {hasMore && commentTree.length > 0 && (
              <div className="flex justify-center mt-8 pb-8">
                <button 
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchComments(nextPage, true);
                  }}
                  className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4" /> Load More
                </button>
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
