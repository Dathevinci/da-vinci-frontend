"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser, User } from "@/hooks/useUser";
import { Compass, UserPlus, UserMinus, Eye, Heart, Clock, Check, ListFilter } from "lucide-react";
import Link from "next/link";

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: currentUserLoaded, followUser, unfollowUser } = useUser();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  const filterTabs = [
    { id: "All", icon: ListFilter },
    { id: "Watching", icon: Eye },
    { id: "Interested", icon: Heart },
    { id: "Waiting", icon: Clock },
    { id: "Finished", icon: Check },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      try {
        const res = await fetch(`${API_URL}/api/users/username/${username}`);
        const data = await res.json();
        if (data.success) {
          setProfileUser(data.data);
          setWatchlist(data.data.watchlist || []);
        }
      } catch (err) {
        console.error("Failed to fetch user", err);
      } finally {
        setLoading(false);
      }
    };
    if (username) fetchUser();
  }, [username]);

  if (loading || !currentUserLoaded) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading...</div>;
  if (!profileUser) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">User not found</div>;

  const isFollowing = currentUser?.following?.some((f: any) => f.followingId === profileUser.id);
  const isSelf = currentUser?.id === profileUser.id;

  const handleFollowToggle = async () => {
    if (!currentUser) {
      alert("You must be logged in to follow users.");
      return;
    }
    if (isFollowing) {
      await unfollowUser(profileUser.id);
      setProfileUser(prev => prev ? { ...prev, followers: prev.followers?.slice(0, -1) } : prev);
    } else {
      await followUser(profileUser.id);
      setProfileUser(prev => prev ? { ...prev, followers: [...(prev.followers || []), { followerId: currentUser.id }] } : prev);
    }
  };

  const filteredWatchlist = filter === "All" ? watchlist : watchlist.filter(w => w.status === filter.toUpperCase());

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-end gap-6 bg-[#141414] border border-white/10 rounded-3xl mb-10 shadow-2xl relative overflow-hidden pb-8 px-8" style={{ minHeight: '300px' }}>
          {/* Banner */}
          {profileUser.bannerUrl ? (
            <div className="absolute inset-0 z-0">
              <img src={profileUser.bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent"></div>
            </div>
          ) : (
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 z-0"></div>
          )}
          
          <div className="relative z-10 flex flex-col md:flex-row items-end gap-6 w-full pt-32">
            <div className="relative">
              {profileUser.avatar ? (
                <img src={profileUser.avatar} alt="Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-[#141414] shadow-xl bg-[#141414]" />
              ) : (
                <div className="w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center text-4xl font-black border-4 border-[#141414] shadow-xl">
                  {profileUser.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="text-center md:text-left z-10 mb-2 flex-1">
              <h1 className="text-4xl font-black text-white mb-2 drop-shadow-lg">{profileUser.username}</h1>
              <p className="text-indigo-200 font-medium drop-shadow-md max-w-xl">{profileUser.bio || "This user prefers to keep an air of mystery."}</p>
              <div className="flex items-center gap-4 mt-3 text-sm font-bold text-slate-300">
                <span>{(profileUser.followers || []).length} Followers</span>
                <span>{(profileUser.following || []).length} Following</span>
              </div>
            </div>
            
            {!isSelf && currentUser && (
              <div className="z-10 mb-2">
                <button 
                  onClick={handleFollowToggle}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition shadow-xl ${isFollowing ? "bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                >
                  {isFollowing ? <><UserMinus className="w-5 h-5" /> Unfollow</> : <><UserPlus className="w-5 h-5" /> Follow</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Watchlist Section */}
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Compass className="w-6 h-6 text-indigo-400" />
          {profileUser.username}'s Watchlist
        </h2>

        <div className="bg-white/5 border border-white/10 p-1 rounded-lg flex overflow-x-auto max-w-full hide-scrollbar w-fit mb-8">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${filter === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.id}
            </button>
          ))}
        </div>

        {watchlist.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-medium bg-white/5 rounded-2xl border border-white/10">
            This user hasn't tracked any anime yet!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredWatchlist.map(item => (
              <div key={item.id} className="relative group">
                <Link href={`/anime/${item.anilistId}`}>
                  <div className="aspect-[2/3] rounded-xl overflow-hidden cursor-pointer relative bg-slate-800">
                    <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                      <p className="font-bold text-white text-sm line-clamp-2">{item.title}</p>
                    </div>
                  </div>
                </Link>
                <div className="absolute -top-3 -right-3 z-50 bg-[#141414] border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-indigo-300 shadow-xl capitalize">
                  {item.status.toLowerCase()}
                </div>
              </div>
            ))}
          </div>
        )}
        
      </div>
    </div>
  );
}
