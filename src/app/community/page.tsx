"use client";

import { useEffect, useState, useRef } from "react";
import { User, useUser } from "@/hooks/useUser";
import { Users, UserPlus, UserMinus, Search, Globe, MessagesSquare } from "lucide-react";
import UserLink from "@/components/profile/UserLink";
import GuildTag from "@/components/guild/GuildTag";
import { useToast } from "@/components/ui/Toast";
import CommunityForum from "@/components/community/CommunityForum";
import GlobalComments from "@/components/community/GlobalComments";
import { notch } from "@/components/cards/gacha";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import BioRenderer from '@/components/profile/BioRenderer';
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { parseBio } from "@/lib/bioUtils";

function UserCard({ user, currentUser, handleFollowToggle }: { user: User, currentUser: any, handleFollowToggle: (u: User, e: React.MouseEvent) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      timeoutRef.current = setTimeout(() => setIsHovered(true), 400);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };

  const isFollowing = currentUser?.following?.some((f: any) => f.followingId === user.id);
  const { cleanBio, backgroundUrl } = parseBio(user.bio || "", user.arisePoints || 0, user.username);

  const cardContent = (
    <>
      {backgroundUrl && (
        <>
          <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundUrl})` }} />
          <div className="absolute inset-0 z-0 bg-black/75 pointer-events-none" />
        </>
      )}

      {user.bannerUrl ? (
        <div className="absolute top-0 left-0 right-0 h-20 z-0 opacity-60">
          <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] to-transparent"></div>
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-purple-600/20 to-purple-600/10 z-0"></div>
      )}
      
      <div className="relative z-10 flex flex-col pt-4 h-full">
        <UserLink username={user.username} className="flex items-center gap-4 px-6 w-full text-left">
          <div className="relative shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="relative z-10 w-16 h-16 rounded-full object-cover border-2 border-[#18181b] shadow-lg" />
            ) : (
              <div className="relative z-10 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-xl font-black border-2 border-[#18181b] shadow-lg">
                {(user.username || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <AvatarDecoration frame={(user as any).activeFrame} effect={user.activeEffect} />
          </div>
          <div className="flex-1 min-w-0 mt-2">
            {/* min-w-0 + truncate: the guild chip holds its width (shrink-0),
                so a long username is what gives way inside the tile. */}
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 truncate font-bold text-lg text-white group-hover:text-purple-400 transition">{user.username || 'Unknown User'}</h3>
              <GuildTag userId={user.id} size="sm" asLink={false} />
            </div>
            <p className="text-xs text-slate-400 font-medium">{(user.followers || []).length} Followers</p>
          </div>
        </UserLink>
        
        <div className="px-6 pb-6 mt-4 min-h-[60px] flex-1 flex flex-col">
          <BioRenderer bio={cleanBio || "No bio set."} className="text-sm text-slate-300 line-clamp-2" />

          {currentUser && (
            <button 
              onClick={(e) => handleFollowToggle(user, e)}
              className={`mt-auto flex w-full items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] transition ${isFollowing ? "text-slate-300 hover:text-red-300" : "text-white"}`}
              style={{
                clipPath: notch(10),
                background: isFollowing ? "rgba(255,255,255,.05)" : "linear-gradient(100deg, #7c3aed, #a274ff)",
                boxShadow: isFollowing ? "inset 0 0 0 1px rgba(255,255,255,.12)" : "none",
              }}
            >
              {isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div 
      className="relative group h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Card — notched to match the rest of the site, and the purple
          wash is dialled back so the avatar and name carry the tile rather
          than competing with a flat block of colour behind them. */}
      <div className="relative h-full overflow-hidden backdrop-blur-md"
        style={{
          clipPath: notch(18),
          background: "linear-gradient(165deg, rgba(162,116,255,.09), rgba(255,255,255,.03) 55%, rgba(0,0,0,.25))",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)",
        }}>
        {cardContent}
      </div>

      {/* Pop-out Card */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1.15, zIndex: 50 }}
            exit={{ opacity: 0, scale: 0.95, zIndex: 50 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute inset-0 bg-white/10 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/20 z-50 flex flex-col"
            style={{ transformOrigin: 'center center' }}
          >
            {cardContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'forum' | 'feed' | 'directory'>('forum');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user: currentUser, followUser, unfollowUser } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      try {
        const res = await fetch(`${API_URL}/api/users`);
        const data = await res.json();
        if (data.success) {
          setUsers(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleFollowToggle = async (targetUser: User, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to profile when clicking follow
    if (!currentUser) return toast("Please log in to follow users!", "error");
    
    const isFollowing = currentUser.following?.some((f: any) => f.followingId === targetUser.id);
    if (isFollowing) {
      await unfollowUser(targetUser.id);
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, followers: u.followers?.slice(0, -1) } : u));
    } else {
      await followUser(targetUser.id);
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, followers: [...(u.followers || []), { followerId: currentUser.id }] } : u));
    }
  };

  const filteredUsers = users.filter(u => 
    (u.username || '').toLowerCase().includes(search.toLowerCase()) && 
    u.id !== currentUser?.id
  );

  return (
    <PageTransition>
      <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ── TAB SWITCHER ──────────────────────────────────────────────
            Three destinations, not three states of one thing: posting, reading
            what's said elsewhere, and finding people. Each carries an icon so
            they're told apart by shape before the label is read, and the active
            one is filled rather than merely tinted.

            The indicator moves by re-tinting each button, not by animating a
            sliding element — a slider has to be measured and repositioned on
            every resize, and this control sits above a feed that is already
            doing real work. */}
        {/* ── TAB SWITCHER ────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <div className="inline-flex gap-1.5 rounded-2xl border border-white/10 bg-[#0e0e14]/90 p-1.5 shadow-2xl backdrop-blur-xl">
            {([
              { key: 'forum' as const, label: 'Forum', hint: 'Discussions & Polls', Icon: MessagesSquare },
              { key: 'feed' as const, label: 'Global Comments', hint: 'All Chapter Feeds', Icon: Globe },
              { key: 'directory' as const, label: 'User Directory', hint: 'Find Creators & Readers', Icon: Users },
            ]).map(({ key, label, hint, Icon }) => {
              const on = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`group relative flex items-center gap-3 rounded-xl px-4 py-2.5 transition sm:px-6 ${
                    on
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition ${on ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span className="text-left font-mono">
                    <span className="block text-xs sm:text-sm font-black uppercase tracking-wider">
                      {label}
                    </span>
                    <span className={`hidden text-[9px] font-bold uppercase tracking-wider sm:block ${on ? 'text-purple-200' : 'text-slate-500'}`}>
                      {hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {activeTab === 'forum' ? (
              <motion.div
                key="forum"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <CommunityForum embedded />
              </motion.div>
            ) : activeTab === 'feed' ? (
              <motion.div 
                key="feed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <GlobalComments embedded />
              </motion.div>
            ) : (
              <motion.div 
                key="directory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="pt-4"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.42em] text-purple-400/80">Da Vinci · People</p>
              <h1 className="mt-1 flex items-center gap-3 font-fell text-4xl font-bold uppercase tracking-[0.1em] md:text-5xl">
                <Users className="h-8 w-8 shrink-0 text-purple-400" />
                <span style={{
                  background: "linear-gradient(100deg, #fff 10%, #e2d0ff 55%, #a274ff 92%)",
                  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                  filter: "drop-shadow(0 2px 18px rgba(162,116,255,.35))",
                }}>User Directory</span>
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                Find other readers and watchers, and look through what they&rsquo;re following.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ clipPath: notch(12), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.11)" }}
                className="w-full bg-black/50 pl-10 pr-4 py-3 text-sm outline-none placeholder:text-slate-600 transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-400">Loading community...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(user => (
                <UserCard 
                  key={user.id} 
                  user={user} 
                  currentUser={currentUser} 
                  handleFollowToggle={handleFollowToggle} 
                />
              ))}
              
              {filteredUsers.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-white/10">
                  No users found.
                </div>
              )}
            </div>
          )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
      </div>
    </PageTransition>
  );
}
