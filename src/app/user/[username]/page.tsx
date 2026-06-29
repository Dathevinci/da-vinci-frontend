"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser, User } from "@/hooks/useUser";
import { Compass, UserPlus, UserMinus, Eye, Heart, Clock, Check, ListFilter, Code2 } from "lucide-react";
import FollowListModal from "@/components/profile/FollowListModal";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import ArisePointHistoryModal from "@/components/profile/ArisePointHistoryModal";
import UnlimitedVoid from "@/components/ui/UnlimitedVoid";
import SettingsModal from "@/components/profile/SettingsModal";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: currentUserLoaded, followUser, unfollowUser } = useUser();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [modalData, setModalData] = useState<{ title: string; users: any[] } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPointHistory, setShowPointHistory] = useState(false);
  const [showDomainExpansion, setShowDomainExpansion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      setProfileUser(prev => prev ? { ...prev, followers: prev.followers?.filter((f: any) => f.followerId !== currentUser.id) } : prev);
    } else {
      await followUser(profileUser.id);
      setProfileUser(prev => prev ? { ...prev, followers: [...(prev.followers || []), { followerId: currentUser.id }] } : prev);
      
      // TRIGGER UNLIMITED VOID FOR DEJAVUH
      if (profileUser.username.toLowerCase() === 'dejavuh') {
        setShowDomainExpansion(true);
      }
    }
  };

  const filteredWatchlist = filter === "All" ? watchlist : watchlist.filter(w => w.status === filter);
  
  const rankTheme = getRankTheme(profileUser.arisePoints, profileUser.username);
  const RankIcon = rankTheme.badgeIcon ? (Icons as any)[rankTheme.badgeIcon] : null;

  return (
    <div className="relative min-h-screen pt-24 pb-12 text-white overflow-hidden">

      {/* FIXED BACKGROUND BANNER */}
      <div className="fixed inset-0 z-0 bg-[#09090b]">
        {profileUser?.bannerUrl ? (
          <>
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src={profileUser.bannerUrl} 
              alt="Background Banner" 
              className="w-full h-full object-cover" 
            />
            {/* Fade to black only at the bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/50 to-transparent"></div>
          </>
        ) : (
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 z-0"></div>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-7xl mx-auto px-4 md:px-12"
      >
        
        {/* Profile Header */}
        <div className={`flex flex-col md:flex-row items-end gap-6 rounded-3xl mb-10 shadow-2xl p-8 pt-32 border ${rankTheme.bgCardClass}`}>
          
          <div className="relative z-10 flex flex-col md:flex-row items-end gap-6 w-full">
            <div 
              className="relative cursor-pointer"
              onClick={() => profileUser.avatar && setPreviewImage(profileUser.avatar)}
            >
              {profileUser.avatar ? (
                <motion.img 
                  layoutId="profile-avatar"
                  src={profileUser.avatar} 
                  alt="Avatar" 
                  className={`w-32 h-32 rounded-full object-cover border-4 bg-[#141414] transition-all duration-300 relative z-10 ${rankTheme.borderClass} ${rankTheme.glowClass}`} 
                />
              ) : (
                <motion.div 
                  layoutId="profile-avatar" 
                  className={`w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center text-4xl font-black border-4 transition-all duration-300 relative z-10 ${rankTheme.borderClass} ${rankTheme.glowClass}`}
                >
                  {profileUser.username.charAt(0).toUpperCase()}
                </motion.div>
              )}
            </div>

            <div className="text-center md:text-left z-10 mb-2 flex-1">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <h1 className={`text-4xl font-black drop-shadow-lg ${rankTheme.textGradient}`}>
                  {profileUser.username}
                </h1>
                {rankTheme.title && (
                  <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${rankTheme.badgeClass}`}>
                    {RankIcon && <RankIcon className="w-4 h-4" />}
                    <span className="text-xs font-black tracking-wider uppercase">
                      {rankTheme.title}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-indigo-200 font-medium drop-shadow-md max-w-xl">{profileUser.bio || "No bio set."}</p>
              <div className="flex items-center gap-4 mt-3 text-sm font-bold text-slate-300">
                <button 
                  onClick={() => setModalData({ title: 'Followers', users: (profileUser.followers || []).map((f: any) => f.follower) })}
                  className="hover:text-white hover:underline transition"
                >
                  <span>{(profileUser.followers || []).length} Followers</span>
                </button>
                <button 
                  onClick={() => setModalData({ title: 'Following', users: (profileUser.following || []).map((f: any) => f.following) })}
                  className="hover:text-white hover:underline transition"
                >
                  <span>{(profileUser.following || []).length} Following</span>
                </button>
                <button 
                  onClick={() => setShowPointHistory(true)}
                  className={`ml-2 drop-shadow-md font-black hover:scale-105 transition cursor-pointer hover:brightness-125 ${rankTheme.textColorClass}`}
                >
                  ✧ {profileUser.arisePoints || 0} Arise Points
                </button>
              </div>
            </div>
            
            {!isSelf && currentUser && (
              <div className="z-10 mb-2 flex gap-2">
                {isFollowing && profileUser?.following?.some((f: any) => f.followingId === currentUser.id) && (
                  <Link href={`/messages?user=${profileUser.username}`}>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-full font-bold transition shadow-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10">
                      <Icons.MessageSquare className="w-5 h-5" /> Message
                    </button>
                  </Link>
                )}
                <button 
                  onClick={handleFollowToggle}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition shadow-xl ${isFollowing ? "bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                >
                  {isFollowing ? (
                    <><UserMinus className="w-5 h-5" /> Unfollow</>
                  ) : profileUser?.following?.some((f: any) => f.followingId === currentUser.id) ? (
                    <><UserPlus className="w-5 h-5" /> Follow Back</>
                  ) : (
                    <><UserPlus className="w-5 h-5" /> Follow</>
                  )}
                </button>
              </div>
            )}
            {isSelf && (
              <div className="z-10 mb-2 flex gap-2">
                <Link href={`/messages`}>
                  <button className="flex items-center gap-2 px-6 py-3 rounded-full font-bold transition shadow-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10">
                    <Icons.MessageSquare className="w-5 h-5" /> Messages
                  </button>
                </Link>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-full font-bold transition shadow-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Icons.Settings className="w-5 h-5" /> Settings
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
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            <AnimatePresence>
              {filteredWatchlist.map(item => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  key={item.id} 
                  className="relative group"
                >
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
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        
      </motion.div>

      {modalData && (
        <FollowListModal
          title={modalData.title}
          users={modalData.users}
          onClose={() => setModalData(null)}
        />
      )}

      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          altText={`${profileUser.username}'s Avatar`}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {showPointHistory && (
        <ArisePointHistoryModal
          userId={profileUser.id}
          onClose={() => setShowPointHistory(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={profileUser}
          onClose={() => setShowSettings(false)}
          onUpdate={(data: any) => setProfileUser({ ...profileUser, ...data })}
        />
      )}

      {showDomainExpansion && (
        <UnlimitedVoid onComplete={() => setShowDomainExpansion(false)} />
      )}
    </div>
  );
}
