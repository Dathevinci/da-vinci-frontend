"use client";

import { useEffect, useState } from "react";
import { User, useUser } from "@/hooks/useUser";
import { Users, UserPlus, UserMinus, Search } from "lucide-react";
import Link from "next/link";

export default function CommunityPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user: currentUser, followUser, unfollowUser } = useUser();

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
    if (!currentUser) return alert("Please log in to follow users!");
    
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
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 flex items-center gap-3 text-indigo-400">
              <Users className="w-10 h-10" /> Community
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
            {filteredUsers.map(user => {
              const isFollowing = currentUser?.following?.some((f: any) => f.followingId === user.id);
              
              return (
                <Link href={`/user/${user.username}`} key={user.id}>
                  <div className="bg-[#141414] border border-white/5 hover:border-indigo-500/30 p-6 rounded-2xl transition group relative overflow-hidden">
                    {user.bannerUrl ? (
                      <div className="absolute top-0 left-0 right-0 h-16 z-0 opacity-50">
                        <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent"></div>
                      </div>
                    ) : (
                      <div className="absolute top-0 left-0 right-0 h-16 bg-indigo-600/10 z-0"></div>
                    )}
                    
                    <div className="relative z-10 flex items-center gap-4 mt-4">
                      {user.avatar ? (
                        <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-[#141414]" />
                      ) : (
                        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-black border-2 border-[#141414]">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg group-hover:text-indigo-400 transition">{user.username}</h3>
                        <p className="text-sm text-slate-400">{(user.followers || []).length} Followers</p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-500 mt-4 line-clamp-2 min-h-[40px]">
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
                </Link>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <div className="col-span-full text-center py-10 text-slate-500 bg-white/5 rounded-xl border border-white/10">
                No users found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
