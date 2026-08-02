"use client";

import { useEffect, useState, useRef } from "react";
import { User, useUser } from "@/hooks/useUser";
import { Users, UserPlus, UserMinus, Search, Globe, MessagesSquare } from "lucide-react";
import UserLink from "@/components/profile/UserLink";
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
          <div className="flex-1 mt-2">
            <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition">{user.username || 'Unknown User'}</h3>
            <p className="text-xs text-slate-400 font-medium">{(user.followers || []).length} Followers</p>
          </div>
        </UserLink>
        
        <div className="px-6 pb-6 mt-4 min-h-[60px] flex-1 flex flex-col">
          <BioRenderer bio={cleanBio || "No bio set."} className="text-sm text-slate-300 line-clamp-2" />

          {currentUser && (
            <button 
              onClick={(e) => handleFollowToggle(user, e)}
              className={`w-full mt-auto pt-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2 ${isFollowing ? "bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400" : "bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white"}`}
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
      {/* Base Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl relative overflow-hidden h-full">
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
        <div className="flex justify-center">
          <div className="flex gap-1.5 p-1.5 backdrop-blur-xl"
            style={{
              clipPath: notch(16),
              background: "rgba(255,255,255,.04)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10), 0 10px 30px rgba(0,0,0,.5)",
            }}>
            {([
              { key: 'forum' as const, label: 'Forum', hint: 'Post & discuss', Icon: MessagesSquare },
              { key: 'feed' as const, label: 'Global Comments', hint: 'Read-only', Icon: Globe },
              { key: 'directory' as const, label: 'User Directory', hint: 'Find people', Icon: Users },
            ]).map(({ key, label, hint, Icon }) => {
              const on = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="group relative flex items-center gap-2.5 px-4 py-2.5 transition md:px-6"
                  style={{
                    clipPath: notch(12),
                    background: on ? 'linear-gradient(100deg, #7c3aed, #a274ff)' : 'transparent',
                    boxShadow: on ? '0 6px 22px rgba(124,58,237,.45)' : 'none',
                  }}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition ${on ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span className="text-left leading-none">
                    <span className={`block text-sm font-black transition md:text-[15px] ${on ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                      {label}
                    </span>
                    <span className={`mt-0.5 hidden text-[9px] font-bold uppercase tracking-[0.16em] sm:block ${on ? 'text-white/70' : 'text-slate-600'}`}>
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
              <h1 className="text-3xl font-black mb-2 flex items-center gap-3 text-purple-400">
                <Users className="w-8 h-8" /> User Directory
              </h1>
              <p className="text-slate-400">Discover other anime fans and explore their watchlists.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-3 focus:outline-none focus:border-purple-500 transition"
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
