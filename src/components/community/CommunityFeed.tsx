"use client";

import { useState, useEffect, useRef } from 'react';
import { useAnimeModal } from '@/components/providers/AnimeModalProvider';
import { Anime } from '@tutkli/jikan-ts';
import { useUser } from '@/hooks/useUser';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Heart, Trash2, Send, CornerDownRight, Zap, Flame, Crown, Code2, Sparkles, Feather, Leaf, User as UserIcon, Image as ImageIcon, Edit, Shield, Star, ShieldAlert, Eye, Compass, ArrowUpRight, Pin, Search, Filter, ChevronDown, ChevronUp, X, Clock, TrendingUp, ThumbsDown, Flag } from 'lucide-react';
import { isAdmin, isLeadDev } from "@/lib/admin";
import { nameColorClass } from "@/lib/cosmetics";
// Avatars here render at 32-40px; cloudinaryFit serves them at that scale
// instead of the multi-megapixel original (animated uploads pass through
// untouched — see cloudinary.ts).
import { cloudinaryFit } from "@/lib/cloudinary";
import { AvatarDecoration, hasFrameRing } from "@/components/profile/AvatarDecoration";
import UserLink from "@/components/profile/UserLink";
import { TitleChips } from "@/components/profile/UserBadges";
import GuildTag from "@/components/guild/GuildTag";
import ConfirmModal from '@/components/ui/ConfirmModal';
import HeartExplosion from '@/components/ui/HeartExplosion';
import MediaPicker from '@/components/community/MediaPicker';
import EmojiPicker from '@/components/community/EmojiPicker';
import { PollCard } from '@/components/community/Poll';
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
import { authHeaders } from "@/lib/authToken";
import MentionsTextarea from '@/components/ui/MentionsTextarea';
import MentionText from '@/components/ui/MentionText';
import Link from 'next/link';

interface Comment {
  id: string;
  parentId: string | null;
  animeId?: number;
  animeTitle?: string;
  mangaId?: string;
  mangaTitle?: string;
  // chapterId was missing here while chapterTitle was present, so the context
  // chip could render "· Chapter 8" but had no id to link to — it silently fell
  // back to the series page. The backend has always sent it.
  chapterId?: string;
  chapterTitle?: string;
  novelId?: string;
  novelTitle?: string;
  mediaUrl?: string;
  content: string;
  isPinned?: boolean;
  blessed?: boolean;
  createdAt: string;
  score: number;
  /** Separate tallies — the bar shows likes AND dislikes, and a single net
   *  score renders as a negative beside the heart once dislikes lead. */
  upvotes?: number;
  downvotes?: number;
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
      if (currentSortBy === 'top') {
        // Pinned leads only here — in "top" a pinned post reading first is
        // intentional. Forcing it first in New/Old made an explicit
        // chronological choice open with a weeks-old comment, which is what made
        // the sort look broken.
        if (!a.parentId && !b.parentId && a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (currentSortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      // newest
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
  onReport,
  showContext,
  linkToPost
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
  onReport: (id: string) => void;
  showContext?: boolean;
  /**
   * Only the forum LIST opens a comment in its own page. Inside a post, and
   * anywhere on anime/manhwa/novel, a top-level comment replies in place —
   * otherwise every reply spawned another permalink, and replying to that one
   * spawned another, forever.
   */
  linkToPost?: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.content);
  const [editMediaUrl, setEditMediaUrl] = useState(node.mediaUrl || "");
  const [showHeartExplosion, setShowHeartExplosion] = useState(false);
  const [clickCoords, setClickCoords] = useState<{x: number, y: number} | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 1);
  const { openAnime } = useAnimeModal();

  const maxDepth = 4;
  const currentDepth = Math.min(depth, maxDepth);
  const isDeep = depth >= maxDepth;

  const isDejavuh = isLeadDev(node.user?.username);
  // A bought frame / Voltaic ring takes priority over the Lead-Dev accent ring.
  const nodeHasRing = hasFrameRing((node.user as any)?.activeFrame, node.user?.activeEffect);
  // isAdmin() already unions ADMIN + LEAD_DEV (and honours the persistent role),
  // so a second hardcoded username list here only created drift.
  const isViewerDev = isAdmin(user);
  const isAuthor = user?.id === node.user?.id;
  const canManage = isAuthor || isViewerDev;
  
  const rankTheme = getRankTheme((node.user as any)?.xp || 0, node.user?.username || 'Unknown');
  const RankIcon = rankTheme.badgeIcon ? RankIcons[rankTheme.badgeIcon] : null;

  return (
    <motion.div
      // The anchor notification deep links land on (?comment=<id> →
      // scrollIntoView). Prefixed because a bare uuid is not a valid CSS id
      // selector start, and scroll-mt clears the sticky chrome above the feed.
      id={`c-${node.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`relative scroll-mt-24 ${depth > 0 ? 'mt-4' : 'mb-6'}`}
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

      {/* Solid surfaces — a backdrop-blur on every card down a long feed is a
          real scroll-jank source, and the blur was invisible over the flat
          page background anyway. */}
      <div className={`relative z-10 flex flex-col overflow-hidden rounded-2xl p-4 transition-colors duration-200 sm:p-5 ${
        isDejavuh
          ? 'border border-purple-500/50 bg-[#141018]'
          : node.isPinned
            ? 'border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-[#121214]'
            : 'border border-white/[0.07] bg-[#121214] hover:border-white/[0.14]'
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
              <img src={cloudinaryFit(node.user?.avatar || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80', 80)} loading="lazy" decoding="async" className={`relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ${isDejavuh && !nodeHasRing ? 'ring-2 ring-fuchsia-500 ring-offset-1 ring-offset-[#0f0f11] shadow-[0_0_15px_rgba(217,70,239,0.5)]' : ''}`} />
              <AvatarDecoration frame={(node.user as any)?.activeFrame} effect={node.user?.activeEffect} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* min-w-0 + truncate: the guild chip that follows is shrink-0,
                    so on a phone the NAME is what has to give way — otherwise
                    the header row pushes the card sideways. */}
                <span className={`min-w-0 truncate font-bold text-sm sm:text-base transition
                  ${node.user?.activeFont === 'font_cyber' ? 'font-mono tracking-widest' : ''}
                  ${node.user?.activeFont === 'font_pixel' ? 'font-serif tracking-tight' : ''}
                  ${nameColorClass(node.user?.activeColor) || (isDejavuh ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'text-purple-300 group-hover:text-purple-400')}`}>
                  {node.user?.username || 'Unknown User'}
                </span>

                {/* Guild identity leads the chip group; roles, ranks and worn
                    titles are decoration and follow it. */}
                <GuildTag userId={node.user?.id} size="sm" />

                {isDejavuh ? (
                  <div className="hidden sm:flex px-2 py-0.5 rounded-full items-center gap-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)]">
                    <Crown className="w-3 h-3" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Lead Developer</span>
                  </div>
                ) : isAdmin(node.user) && rankTheme.title ? (
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
                {/* The one thing a user actually CHOOSES to wear. Everything
                    above is a role or an XP rank; this is the title they earned
                    and picked. Capped at one here — an author line has a
                    fraction of the room a profile panel does. */}
                <TitleChips user={node.user} size="sm" max={1} />
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500">{timeAgo(node.createdAt)}</span>
            </div>
          </UserLink>
          
          <div className="flex items-center gap-2 shrink-0">
            {isViewerDev && !isDejavuh && !node.blessed && (
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
                {isViewerDev && (
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
                  className={`p-1 sm:p-1.5 rounded transition flex items-center gap-1 text-xs font-bold ${(!isAuthor && isViewerDev) ? "text-red-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-500 hover:text-red-500 hover:bg-red-500/10"}`}
                  title={!isAuthor ? "Nuke Post" : "Delete Post"}
                >
                  {(!isAuthor && isViewerDev) ? <Flame className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Source context (global feed only): which anime / manhwa / novel this
            comment was posted on, linking back to it. */}
        {showContext && node.animeTitle && node.animeId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openAnime({
                mal_id: node.animeId as number,
                title: node.animeTitle as string,
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
        ) : showContext && node.novelTitle && node.novelId ? (
          // Novel discussion is novel-level today, but the chapter route exists
          // and the schema shares one chapterId column, so honour it if it's set
          // rather than silently dropping the reader back to the series page.
          <Link
            href={
              node.chapterId
                ? `/novel/${encodeURIComponent(node.novelId)}/chapter/${encodeURIComponent(node.chapterId)}`
                : `/novel/${encodeURIComponent(node.novelId)}`
            }
            onClick={(e) => e.stopPropagation()}
            className="mb-3 inline-block self-start"
          >
            <span className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-md text-slate-400 flex items-center gap-1 transition">
              on <span className="font-bold text-pink-300 hover:text-pink-400 truncate max-w-[250px]">{node.novelTitle}</span>
              {node.chapterTitle ? <span className="text-slate-500 truncate max-w-[120px]">· {node.chapterTitle}</span> : null}
            </span>
          </Link>
        ) : showContext && node.mangaTitle && node.mangaId ? (
          // Link to the CHAPTER the comment was actually left on. The chip has
          // always shown "· Chapter N"; the href ignored it and sent you to the
          // series page, which is the whole complaint.
          <Link
            href={
              node.chapterId
                ? `/manhwa/${encodeURIComponent(node.mangaId)}/chapter/${encodeURIComponent(node.chapterId)}`
                : `/manhwa/${encodeURIComponent(node.mangaId)}`
            }
            onClick={(e) => e.stopPropagation()}
            className="mb-3 inline-block self-start"
          >
            <span className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-md text-slate-400 flex items-center gap-1 transition">
              on <span className="font-bold text-red-300 hover:text-red-400 truncate max-w-[220px]">{node.mangaTitle}</span>
              {node.chapterTitle ? <span className="text-slate-500 truncate max-w-[120px]">· {node.chapterTitle}</span> : null}
            </span>
          </Link>
        ) : null}

        {/* Content */}
        {isEditing ? (
          <div className="mb-4">
            <MentionsTextarea
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
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
              <MentionText
                text={
                  isExpanded || node.content.length <= 300
                    ? node.content
                    : `${node.content.substring(0, 300)}...`
                }
              />
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

        {/* Media / GIF rendering. Lazy + async: without them a 30-post feed
            fired every attachment's full fetch+decode the moment it mounted,
            all on the main thread. The wrapper's min-h is a pre-decode
            skeleton — the height is unknown until the image arrives, and a
            late decode used to shove the whole feed down. */}
        {node.mediaUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/50 self-start max-w-full min-h-[120px]">
            <img
              src={node.mediaUrl}
              alt="Community attached media"
              loading="lazy"
              decoding="async"
              className="max-h-[350px] w-auto object-contain hover:scale-[1.02] transition-transform duration-300"
              onLoad={(e) => {
                // Real dimensions exist now, so the reservation must go — kept,
                // it would letterbox images shorter than the skeleton.
                const wrap = (e.target as HTMLImageElement).parentElement;
                if (wrap) wrap.style.minHeight = '0';
              }}
              onError={(e) => {
                // If it fails to load (e.g. invalid URL), hide it gracefully —
                // and drop the skeleton too, or it lingers as an empty box.
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                if (img.parentElement) img.parentElement.style.minHeight = '0';
              }}
            />
          </div>
        )}

        {/* Action bar — larger hit areas + colour that only appears on hover,
            so the row reads calm until you reach for it. */}
        <div className="mt-auto flex items-center gap-1 border-t border-white/5 pt-2">
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
            title={node.userVote === 1 ? "Remove like" : "Like this post"}
            className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-red-500/10 ${
              node.userVote === 1 ? "text-red-500" : "text-slate-400 hover:text-red-400"
            }`}
          >
            <motion.span whileTap={{ scale: 0.82 }} className="flex">
              <Heart className={`h-[18px] w-[18px] transition-colors ${node.userVote === 1 ? "fill-red-500" : ""}`} />
            </motion.span>
            <span className="text-sm font-bold tabular-nums">{node.upvotes ?? Math.max(0, node.score)}</span>
            <HeartExplosion show={showHeartExplosion} coordinates={clickCoords} />
          </button>

          {/* DOWNVOTE — the schema and the API always supported -1; the old
              bar simply never offered it, so disagreement had nowhere to go. */}
          <button
            onClick={() => handleVote(node.id, node.userVote === -1 ? 0 : -1)}
            title={node.userVote === -1 ? "Remove dislike" : "Dislike this post"}
            className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-500/10 ${
              node.userVote === -1 ? "text-slate-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <motion.span whileTap={{ scale: 0.82 }} className="flex">
              <ThumbsDown className={`h-[17px] w-[17px] transition-colors ${node.userVote === -1 ? "fill-slate-300" : ""}`} />
            </motion.span>
            <span className="text-sm font-bold tabular-nums">{node.downvotes ?? 0}</span>
          </button>

          {/* Top-level comments OPEN THEIR OWN PAGE — a thread you can link,
              share and open in a tab. Nested replies keep the inline box,
              since you're already inside the thread they belong to. */}
          {depth === 0 && linkToPost ? (
            <Link
              href={`/community/post/${node.id}`}
              title="Open this thread"
              className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-purple-500/10 hover:text-purple-300"
            >
              <MessageSquare className="h-[18px] w-[18px]" />
              <span className="text-sm font-bold tabular-nums">{node.children?.length || 0}</span>
            </Link>
          ) : (
            <button
              onClick={() => setReplyingToId(replyingToId === node.id ? null : node.id)}
              title="Reply"
              className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-purple-500/10 hover:text-purple-300"
            >
              <motion.span whileTap={{ scale: 0.82 }} className="flex">
                <MessageSquare className="h-[18px] w-[18px]" />
              </motion.span>
              <span className="text-sm font-bold tabular-nums">{node.children?.length || 0}</span>
            </button>
          )}

          {!isAuthor && (
            <button
              onClick={() => onReport(node.id)}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
              title="Report this comment to staff"
            >
              <motion.span whileTap={{ scale: 0.85 }} className="flex">
                <Flag className="h-[17px] w-[17px]" />
              </motion.span>
              <span className="hidden text-sm font-bold sm:inline">Report</span>
            </button>
          )}

          {!isAuthor && (
            <button
              onClick={() => handleTip(node.id)}
              className="group ml-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-amber-400/10 hover:text-amber-400"
              title="Tip 10 Arise Points to this post"
            >
              <motion.span whileTap={{ scale: 0.85 }} className="flex">
                <Sparkles className="h-[18px] w-[18px]" />
              </motion.span>
              <span className="text-sm font-bold">Tip</span>
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
                      disabled={isReplying || (!replyContent.trim() && !replyMediaUrl.trim())}
                      className="bg-purple-600 hover:bg-purple-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:shadow-none text-white px-5 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all hover:scale-[1.02]"
                    >
                      {isReplying ? 'Replying...' : 'Reply'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* Render Children (Replies).
          Depth 0 used to open a side drawer here; those threads now have
          their own page (/community/post/<id>), so the drawer had no way
          left to open and was removed rather than left as dead weight. */}
      {node.children.length > 0 && (
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
                    onReport={onReport}
                    showContext={showContext}
                    linkToPost={linkToPost}
                  />
                ))}
              </>
            )}
          </div>
      )}
    </motion.div>
  );
};

export default function CommunityFeed({
  animeId, animeTitle, episodeNo,
  mangaId, mangaTitle,
  chapterId, chapterTitle,
  novelId, novelTitle,
  postId
}: {
  animeId?: number, animeTitle?: string,
  /** The episode a NEW comment is being left on, stamped so Global Comments
   *  can link back to it. Not a filter — the thread stays series-wide. */
  episodeNo?: number,
  mangaId?: string, mangaTitle?: string,
  chapterId?: string, chapterTitle?: string,
  novelId?: string, novelTitle?: string,
  /** A forum post's own thread. Replies to it are comments whose parent IS
   *  this post, so the feed fetches the permalink endpoint and every new
   *  top-level comment is filed under it. Same cards, same composer, same
   *  ratings — one comment implementation for the whole app. */
  postId?: string
}) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Episode scope, watch page only. "episode" shows this episode's thread —
   * the default, since that is what a watch page is about — and "all" is the
   * old series-wide view, kept one tap away because every comment made before
   * episode stamping existed has no episodeNo and would otherwise be
   * unreachable from here.
   */
  const hasEpisodeScope = typeof episodeNo === "number" && episodeNo > 0;
  const [epScope, setEpScope] = useState<'episode' | 'all'>('episode');

  // Filters and Pagination State
  const [sortBy, setSortBy] = useState<'newest' | 'top' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Composer: collapsed to a single prompt row until focused, so the feed isn't
  // pushed below the fold by an empty box; the media field is opt-in.
  const [composerOpen, setComposerOpen] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyMediaUrl, setReplyMediaUrl] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  /**
   * WHAT IS BEING RATED. One opaque key covers every surface this feed
   * mounts on — a series, one of its chapters, a novel — and the backend
   * keeps one row per member per key, so scoring again replaces your old
   * score instead of stacking another vote onto the average.
   */
  const targetKey = postId
    ? `post:${postId}`
    : chapterId && mangaId
      ? `manhwa:${mangaId}:${chapterId}`
      : chapterId && novelId
        ? `novel:${novelId}:${chapterId}`
        : mangaId ? `manhwa:${mangaId}`
          : novelId ? `novel:${novelId}`
            : animeId ? `anime:${animeId}`
              : null;
  const subject = postId ? "post" : chapterId ? "chapter" : mangaId ? "manhwa" : novelId ? "novel" : "anime";

  /**
   * ?comment=<id> — the landing half of notification deep links.
   *
   * The backend now writes links like /manhwa/<id>?comment=<uuid>; this is
   * what makes that click END on the comment instead of at the top of a feed.
   * Reads window.location.search directly, NOT useSearchParams — that hook
   * without a Suspense boundary fails `next build` on this repo.
   *
   * Retries briefly because the target may be a reply that renders a beat
   * after its parents, and gives up quietly if it never appears (deleted
   * comment, or a page whose feed doesn't include it). One-shot per mount so
   * refetches and sort changes don't yank the scroll back.
   */
  const anchoredRef = useRef(false);
  useEffect(() => {
    if (anchoredRef.current || loading || comments.length === 0) return;
    let target = "";
    try {
      target = new URLSearchParams(window.location.search).get("comment") || "";
    } catch {
      /* ssr / weird url */
    }
    if (!target) return;
    anchoredRef.current = true;

    let tries = 0;
    const HIGHLIGHT = ["ring-2", "ring-purple-500/80", "rounded-2xl", "bg-purple-500/10"];
    const attempt = () => {
      const el = document.getElementById("c-" + target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(...HIGHLIGHT);
        window.setTimeout(() => el.classList.remove(...HIGHLIGHT), 4000);
      } else if (++tries < 12) {
        window.setTimeout(attempt, 300);
      }
    };
    attempt();
  }, [loading, comments.length]);

  const [rating, setRating] = useState<{ average: number | null; count: number; mine: number | null }>({
    average: null, count: 0, mine: null,
  });
  const [ratingBusy, setRatingBusy] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);

  useEffect(() => {
    if (!targetKey) return;
    let live = true;
    const url = new URL(`${API_URL}/api/ratings`);
    url.searchParams.set("targetKey", targetKey);
    if (user?.id) url.searchParams.set("userId", user.id);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => { if (live && d?.success && d.data) setRating(d.data); })
      .catch(() => { /* a missing score just hides the chip */ });
    return () => { live = false; };
  }, [targetKey, user?.id, API_URL]);

  const submitRating = async (value: number) => {
    if (!user) return toast("Sign in to rate.", "error");
    if (!targetKey || ratingBusy) return;
    setRatingBusy(true);
    const previous = rating;
    setRating((r) => ({ ...r, mine: value })); // optimistic star fill
    try {
      const res = await fetch(`${API_URL}/api/ratings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, targetKey, value }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Rating failed");
      setRating(data.data);
      toast(`Rated ${value}/10.`, "success");
    } catch {
      setRating(previous);
      toast("Couldn't save your rating.", "error");
    } finally {
      setRatingBusy(false);
    }
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /** `searchOverride` exists because state updates are async: clearing the
   *  box called setSearchQuery("") then fetched immediately, and the fetch
   *  still read the OLD query from its closure — so the X appeared to do
   *  nothing and the feed stayed filtered. */
  const fetchComments = async (pageNum = 1, append = false, searchOverride?: string) => {
    try {
      if (pageNum === 1) setLoading(true);

      // A forum post's thread comes from the permalink endpoint, which
      // returns the post plus four generations of replies in one shot —
      // there is no pagination to do and nothing to append.
      if (postId) {
        const purl = new URL(`${API_URL}/api/comments/${postId}`);
        if (user) purl.searchParams.set("userId", user.id);
        const pres = await fetch(purl.toString());
        if (!pres.ok) throw new Error("Failed to fetch the thread");
        const pdata = await pres.json();
        if (pdata.success) {
          setComments(pdata.data?.replies || []);
          setHasMore(false);
        }
        return;
      }

      const effectiveSearch = searchOverride !== undefined ? searchOverride : searchQuery;
      const url = new URL(`${API_URL}/api/comments`);
      if (animeId) url.searchParams.set('animeId', animeId.toString());
      if (animeId && hasEpisodeScope && epScope === 'episode') url.searchParams.set('episodeNo', String(episodeNo));
      if (mangaId) url.searchParams.set('mangaId', mangaId);
      if (chapterId) url.searchParams.set('chapterId', chapterId);
      if (novelId) url.searchParams.set('novelId', novelId);
      if (user) url.searchParams.set('userId', user.id);
      url.searchParams.set('sort', sortBy);
      if (effectiveSearch.trim()) url.searchParams.set('search', effectiveSearch.trim());
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
    // episodeNo and epScope are dependencies for a reason: the watch page
    // switches episodes client-side without remounting this feed, so the
    // thread must follow the episode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, mangaId, chapterId, novelId, postId, user?.id, sortBy, mediaOnly, episodeNo, epScope]);

  const handlePin = async (commentId: string) => {
    if (!user) return;
    
    // Optimistic Update
    setComments(comments.map(c => c.id === commentId ? { ...c, isPinned: !c.isPinned } : c));
    
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/pin`, {
        method: "PUT",
        headers: authHeaders(),
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
    // A GIF on its own is a valid post. This used to require text and then
    // SILENTLY return, so attaching an image and hitting Post did nothing at
    // all — no error, no post, just a dead button.
    if (!content.trim() && !mediaUrl?.trim()) return;

    if (parentId) setIsReplying(true);
    else setIsPosting(true);

    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: user.id,
          animeId,
          animeTitle,
          episodeNo,
          mangaId,
          mangaTitle,
          chapterId,
          chapterTitle,
          novelId,
          novelTitle,
          content,
          // On a forum post's page a "top-level" comment is really a reply
          // to that post — otherwise it would be filed as a new forum post
          // of its own and never appear in the thread it was written in.
          parentId: parentId || postId || null,
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
    // Move the two tallies as well as the net score. The vote endpoint
    // returns nothing, so this arithmetic IS the displayed truth until the
    // next refetch — leaving up/down stale showed a like count that never
    // changed while the heart lit up.
    const prevUp = comment.upvotes ?? 0;
    const prevDown = comment.downvotes ?? 0;
    const wasUp = comment.userVote === 1 ? 1 : 0;
    const wasDown = comment.userVote === -1 ? 1 : 0;
    const isUp = newValue === 1 ? 1 : 0;
    const isDown = newValue === -1 ? 1 : 0;

    const newComments = [...comments];
    newComments[commentIndex] = {
      ...comment,
      userVote: newValue,
      score: comment.score + voteDiff,
      upvotes: Math.max(0, prevUp - wasUp + isUp),
      downvotes: Math.max(0, prevDown - wasDown + isDown),
    };
    setComments(newComments);

    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/vote`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, value: newValue })
      });
      if (!res.ok) throw new Error("Vote failed");
    } catch (err) {
      console.error(err);
      setError("Failed to cast vote.");
      fetchComments(); // revert optimistic update
    }
  };

  /** Flag a comment for staff. One report per member per comment — the
   *  backend upserts, so tapping twice can't inflate the count. */
  const onReport = async (commentId: string) => {
    if (!user) return toast("Sign in to report.", "error");
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, reason: null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Report failed");
      toast(data.message || "Reported. Staff will take a look.", "success");
    } catch (err: any) {
      toast(err?.message || "Couldn't send that report.", "error");
    }
  };

  const handleTip = async (commentId: string) => {
    if (!user) return setError("You must be logged in to tip.");
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}/tip`, {
        method: "POST",
        headers: authHeaders(),
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
        headers: authHeaders(),
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
        headers: authHeaders(),
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
        headers: authHeaders(),
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
  // Count THREADS, not rows — the flat payload carries replies too, so
  // comments.length always over-reported the number in the header.
  const rootCount = commentTree.length;

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
            <span>⚠ï¸</span> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── header: the count, the sort, the community's score ── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-2 sm:px-0">
        <h2 className="flex items-center gap-2.5 font-mono text-2xl font-black tracking-tight text-white">
          <MessageSquare className="h-6 w-6 text-slate-400" />
          Comments
          <span className="text-slate-500">({rootCount})</span>
        </h2>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 px-2 sm:px-0">
        <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {([
            { key: "newest", label: "Newest", Icon: Clock },
            { key: "top", label: "Top", Icon: TrendingUp },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-mono text-xs font-bold transition-colors ${
                sortBy === opt.key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <opt.Icon className="h-3.5 w-3.5" /> {opt.label}
            </button>
          ))}
        </div>

        {hasEpisodeScope && (
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {([
              { key: "episode", label: `Ep ${episodeNo}` },
              { key: "all", label: "All eps" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setEpScope(opt.key)}
                className={`rounded-lg px-3.5 py-2 font-mono text-xs font-bold transition-colors ${
                  epScope === opt.key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {rating.average != null && (
          <span
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-black text-amber-300"
            title={`${rating.count} member${rating.count === 1 ? "" : "s"} rated this`}
          >
            <Star className="h-4 w-4 fill-current" />
            {rating.average}<span className="text-slate-500">/10</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setMediaOnly(!mediaOnly)}
            title="Only show posts with images"
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-xs font-bold transition-colors ${
              mediaOnly
                ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Media</span>
          </button>
        </div>
      </div>

      {/* Search. HIDDEN on a single thread — the permalink endpoint returns
          that post's replies whole, with no server-side search or media
          filter to apply, so the box would look functional and do nothing. */}
      {!postId && (
        <div className="mx-2 mb-5 flex flex-col gap-3 sm:mx-0 sm:flex-row sm:items-center">
          <div className="group flex flex-1 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 transition-colors focus-within:border-purple-500/50 focus-within:bg-purple-500/[0.06]">
            <Search className="mr-2.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-focus-within:text-purple-400" />
            <input
              type="text"
              placeholder="Search the feed…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchComments(1, false))}
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setPage(1); fetchComments(1, false, ""); }}
                aria-label="Clear search"
                className="ml-2 shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {user ? (
        <div className="mx-2 mb-6 rounded-2xl border border-white/10 bg-[#121214] transition-colors focus-within:border-purple-500/40 sm:mx-0">
          <div className="flex gap-3 p-4">
            <div className="relative h-10 w-10 shrink-0">
              <img
                src={cloudinaryFit(user.avatar || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80", 80)}
                alt=""
                loading="lazy"
                decoding="async"
                className="relative z-10 h-10 w-10 rounded-full object-cover"
              />
              <AvatarDecoration frame={(user as any)?.activeFrame} effect={(user as any)?.activeEffect} />
            </div>

            <div className="min-w-0 flex-1">
              {/* Collapsed until focused — an always-open empty box pushed the
                  actual feed below the fold. */}
              {!composerOpen && !newComment ? (
                <button
                  onClick={() => setComposerOpen(true)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left text-sm text-slate-500 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-400"
                >
                  Share your views, @mention someone…
                </button>
              ) : (
                <>
                  <MentionsTextarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e: any) => {
                      // ⌘/Ctrl+Enter posts, Escape collapses an empty composer
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && (newComment.trim() || newMediaUrl.trim()) && !isPosting) {
                        handlePost(null, newComment, newMediaUrl);
                      } else if (e.key === "Escape" && !newComment.trim()) {
                        setComposerOpen(false);
                        setShowMediaInput(false);
                      }
                    }}
                    autoFocus
                    placeholder="Share your views, @mention someone…"
                    className="min-h-[76px] w-full resize-none bg-transparent text-sm text-white placeholder-slate-500 outline-none sm:text-base"
                  />

                  {showMediaInput && (
                    <>
                      <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 transition-colors focus-within:border-purple-500/50">
                        <ImageIcon className="h-4 w-4 shrink-0 text-slate-500" />
                        <input
                          type="url"
                          autoFocus
                          placeholder="Paste an image or GIF link…"
                          value={newMediaUrl}
                          onChange={(e) => setNewMediaUrl(e.target.value)}
                          className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                        />
                        <button
                          onClick={() => { setNewMediaUrl(""); setShowMediaInput(false); }}
                          aria-label="Remove attachment"
                          className="shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* live preview so a bad link is obvious before posting */}
                  {newMediaUrl.trim() && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <img
                        src={newMediaUrl}
                        alt="Attachment preview"
                        className="max-h-52 w-auto object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                </>
              )}
            </div>
          </div>

          {/* ── rating + actions, FULL card width ──
              These used to live inside the column beside the avatar, which on
              a phone is ~280px: the ten stars wrapped, the buttons stacked
              three rows deep, and the avatar floated over the ragged pile —
              the whole card read as broken. Out here they get the card's
              entire width on every screen. */}
          {(composerOpen || !!newComment || !!newMediaUrl) && (
            <div className="px-4 pb-4">
              {targetKey && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">Rate this {subject}:</span>
                  <span className="flex items-center gap-0.5" onMouseLeave={() => setHoverStar(0)}>
                    {Array.from({ length: 10 }).map((_, i) => {
                      const n = i + 1;
                      const lit = n <= (hoverStar || rating.mine || 0);
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={ratingBusy}
                          onMouseEnter={() => setHoverStar(n)}
                          onClick={() => submitRating(n)}
                          aria-label={`Rate ${n} out of 10`}
                          className="p-0.5 transition disabled:opacity-50"
                        >
                          <Star
                            className={`h-4 w-4 transition-colors ${lit ? "fill-amber-400 text-amber-400" : "text-slate-600 hover:text-slate-400"}`}
                          />
                        </button>
                      );
                    })}
                  </span>
                  {rating.mine != null && (
                    <span className="font-mono text-xs font-bold text-amber-300">{rating.mine}/10</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <EmojiPicker onPick={(e) => setNewComment((c) => c + e)} />
                  <MediaPicker value={newMediaUrl} onChange={setNewMediaUrl} userId={user?.id} />
                  <button
                    onClick={() => setShowMediaInput((v) => !v)}
                    title="Paste an image or GIF link"
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                      showMediaInput || newMediaUrl
                        ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                        : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Link
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {newComment.length > 0 && (
                    <span className={`font-mono text-xs tabular-nums ${newComment.length > 1000 ? "text-red-400" : "text-slate-500"}`}>
                      {newComment.length}
                    </span>
                  )}
                  <button
                    onClick={() => handlePost(null, newComment, newMediaUrl)}
                    disabled={isPosting || (!newComment.trim() && !newMediaUrl.trim())}
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-mono text-sm font-black text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPosting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isPosting ? "Posting…" : "Post Comment"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mx-2 mb-6 rounded-2xl border border-purple-500/20 bg-purple-600/10 p-5 text-center sm:mx-0">
          <p className="text-sm font-medium text-purple-200">Log in to share your views with the community.</p>
        </div>
      )}

      {loading ? (
        // Skeletons that mirror the real card shape — a bare spinner made the
        // feed feel empty and shifted layout hard when the posts landed.
        <div className="space-y-4 px-2 sm:px-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-white/5 bg-[#121214] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-white/10" />
                  <div className="h-2.5 w-16 rounded bg-white/[0.07]" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded bg-white/[0.07]" />
                <div className="h-3 w-[85%] rounded bg-white/[0.07]" />
                <div className="h-3 w-[60%] rounded bg-white/[0.07]" />
              </div>
              <div className="mt-4 flex gap-4 border-t border-white/5 pt-3">
                <div className="h-4 w-12 rounded bg-white/[0.07]" />
                <div className="h-4 w-12 rounded bg-white/[0.07]" />
              </div>
            </div>
          ))}
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
                    onReport={onReport}
                showContext={!animeId && !mangaId && !novelId}
                // The forum LIST is the only place a comment opens its own
                // page. On a post's page its replies are themselves depth 0,
                // so linking there meant every reply opened another page, and
                // replying inside that opened another — with no way back to
                // simply answering someone.
                linkToPost={!postId && !animeId && !mangaId && !novelId}
              />
            ))}
            
            {commentTree.length === 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
                <div className="mb-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3.5">
                  <MessageSquare className="h-7 w-7 text-purple-400" />
                </div>
                <h3 className="mb-1.5 text-lg font-black text-white">
                  {postId
                    ? "No replies yet"
                    : searchQuery || mediaOnly
                      ? "Nothing matches that"
                      : hasEpisodeScope && epScope === "episode"
                        ? `No views on episode ${episodeNo} yet`
                        : "No views yet"}
                </h3>
                <p className="max-w-xs text-sm text-slate-500">
                  {postId
                    ? "Be the first to reply to this one."
                    : searchQuery || mediaOnly
                      ? "Try a different search, or clear the filters to see the whole feed."
                      : hasEpisodeScope && epScope === "episode"
                        ? "Start this episode's thread, or switch to All eps for the series talk."
                        : "Be the first to share what you're watching or reading."}
                </p>
                {/* the filter controls don't exist on a single thread, so
                    neither should an offer to clear them */}
                {!postId && (searchQuery || mediaOnly) && (
                  <button
                    onClick={() => { setSearchQuery(""); setMediaOnly(false); setPage(1); fetchComments(1, false); }}
                    className="mt-5 rounded-full bg-white/5 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {hasMore && commentTree.length > 0 && (
              <div className="mt-6 flex justify-center pb-8">
                <button
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchComments(nextPage, true);
                  }}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:border-purple-500/40 hover:bg-white/10"
                >
                  <ChevronDown className="h-4 w-4" /> Load more
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!commentToDelete}
        title="Delete comment"
        message="Are you sure you want to permanently delete this comment? This action cannot be undone and your Arise Points will be adjusted."
        confirmText="Delete"
        cancelText="Keep it"
        onConfirm={executeDelete}
        onCancel={() => setCommentToDelete(null)}
      />
    </div>
  );
}

