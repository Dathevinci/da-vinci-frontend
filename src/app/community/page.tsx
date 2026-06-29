"use client";

import { useEffect, useState, useRef } from "react";
import { User, useUser } from "@/hooks/useUser";
import { Users, UserPlus, UserMinus, Search } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import CommunityFeed from "@/components/community/CommunityFeed";
import { motion, AnimatePresence } from "framer-motion";

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

  const cardContent = (
    <>
      {user.bannerUrl ? (
        <div className="absolute top-0 left-0 right-0 h-20 z-0 opacity-60">
          <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] to-transparent"></div>
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-indigo-600/20 to-purple-600/10 z-0"></div>
      )}
      
      <div className="relative z-10 flex flex-col pt-4">
        <div className="flex items-center gap-4 px-6">
          {user.avatar ? (
            <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-[#18181b] shadow-lg" />
          ) : (
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-black border-2 border-[#18181b] shadow-lg">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 mt-2">
            <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition">{user.username}</h3>
            <p className="text-xs text-slate-400 font-medium">{(user.followers || []).length} Followers</p>
          </div>
        </div>
        
        <div className="px-6 pb-6 mt-4">
          <p className="text-sm text-slate-400 line-clamp-2 min-h-[40px]">
            {user.bio || "No bio set."}
          </p>

          {currentUser && (
            <button 
              onClick={(e) => handleFollowToggle(user, e)}
              className={`w-full mt-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2 ${isFollowing ? "bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400" : "bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white"}`}
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
      <div className="bg-[#141414] border border-white/5 rounded-2xl relative overflow-hidden h-full cursor-pointer">
        <Link href={`/user/${user.username}`} className="block h-full">
          {cardContent}
        </Link>
      </div>

      {/* Pop-out Card */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1.15, zIndex: 50 }}
            exit={{ opacity: 0, scale: 0.95, zIndex: 50 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 bg-[#18181b] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/20 z-50 flex flex-col cursor-pointer"
            style={{ transformOrigin: 'center center' }}
          >
            <Link href={`/user/${user.username}`} className="block h-full">
              {cardContent}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CommunityPage() {
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
          setUsers(data.data);
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
    u.username.toLowerCase().includes(search.toLowerCase()) && 
    u.id !== currentUser?.id
  );

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-5xl mx-auto space-y-16">
        
        {/* Top Section: Community Feed (Views) */}
        <div>
          <CommunityFeed />
        </div>

        {/* Bottom Section: User Directory */}
        <div className="pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <h1 className="text-3xl font-black mb-2 flex items-center gap-3 text-indigo-400">
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
                className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 transition"
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
        </div>

      </div>
    </div>
  );
}
