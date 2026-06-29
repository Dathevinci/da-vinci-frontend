"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser, User } from "@/hooks/useUser";
import { Compass, UserPlus, UserMinus, Eye, Heart, Clock, Check, ListFilter, Code2 } from "lucide-react";
import FollowListModal from "@/components/profile/FollowListModal";
import HollowPurple from "@/components/ui/HollowPurple";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";

const MatrixRain = () => {
  useEffect(() => {
    const canvas = document.getElementById('matrix-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴッン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const alphabet = katakana + latin + nums;
    
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    
    const rainDrops: number[] = [];
    for (let x = 0; x < columns; x++) {
      rainDrops[x] = 1;
    }
    
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0F0';
      ctx.font = fontSize + 'px monospace';
      
      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
        
        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };
    
    const interval = setInterval(draw, 33);
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas id="matrix-canvas" className="fixed inset-0 z-50 pointer-events-none opacity-40 mix-blend-screen" />;
};

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: currentUserLoaded, followUser, unfollowUser } = useUser();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [modalData, setModalData] = useState<{ title: string; users: any[] } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
    }
  };

  const filteredWatchlist = filter === "All" ? watchlist : watchlist.filter(w => w.status === filter);
  
  const rankTheme = getRankTheme(profileUser.arisePoints, profileUser.username);
  const RankIcon = rankTheme.badgeIcon ? (Icons as any)[rankTheme.badgeIcon] : null;

  return (
    <div className="relative min-h-screen pt-24 pb-12 text-white overflow-hidden">
      
      {profileUser.username.toLowerCase() === 'dejavuh' && (
        <>
          <MatrixRain />
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes intenseGlitch {
              0% { transform: translate(0) }
              10% { transform: translate(-15px, 15px); filter: hue-rotate(90deg) contrast(200%); }
              20% { transform: translate(15px, -15px); filter: invert(20%); }
              30% { transform: translate(-15px, -15px); filter: hue-rotate(-90deg) contrast(150%); }
              40% { transform: translate(15px, 15px); filter: invert(0%); }
              50% { transform: translate(0) }
              60% { transform: skewX(20deg); filter: blur(2px) contrast(300%); }
              70% { transform: skewX(-20deg); filter: blur(0px) }
              80% { transform: translate(0) }
              100% { transform: translate(0) }
            }
            .dejavu-glitch-overlay {
              position: fixed;
              inset: 0;
              z-index: 100;
              pointer-events: none;
              background: repeating-linear-gradient(
                0deg,
                rgba(0,0,0,0.5),
                rgba(0,0,0,0.5) 4px,
                transparent 4px,
                transparent 8px
              );
              animation: intenseGlitch 0.2s infinite;
              mix-blend-mode: color-dodge;
              opacity: 0.6;
            }
          `}} />
          <div className="dejavu-glitch-overlay"></div>
        </>
      )}

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
              {profileUser.username.toLowerCase() === 'dejavuh' && <HollowPurple />}
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
                      {profileUser.username.toLowerCase() === 'dejavuh' ? 'cant comprehed' : rankTheme.title}
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
                <span className={`ml-2 drop-shadow-md font-black ${rankTheme.textColorClass}`}>
                  ✧ {profileUser.username.toLowerCase() === 'dejavuh' ? '∞' : (profileUser.arisePoints || 0)} Arise Points
                </span>
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
    </div>
  );
}
