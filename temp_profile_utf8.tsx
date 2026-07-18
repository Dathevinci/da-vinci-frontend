"use client";

import { useAnimeStatus } from "@/hooks/useAnimeStatus";
import { useAnimeLikes } from "@/hooks/useAnimeLikes";
import { useUser } from "@/hooks/useUser";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import AnimeCard from "@/components/anime/AnimeCard";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import { Compass, Settings, ChevronDown } from "lucide-react";
import FollowListModal from "@/components/profile/FollowListModal";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import ArisePointHistoryModal from "@/components/profile/ArisePointHistoryModal";
import BioRenderer from "@/components/profile/BioRenderer";
import LevelBadge from "@/components/profile/LevelBadge";
import SettingsModal from "@/components/profile/SettingsModal";
import { parseBio } from "@/lib/bioUtils";
import { calculateProgressPercent, xpForNextLevel, calculateLevel } from "@/lib/levels";
import { isAdmin, isLeadDev } from "@/lib/admin";
import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";

export default function ProfileTrackerPage() {
  const { getTrackedList, isLoaded: trackerLoaded } = useAnimeStatus();
  const { getLikedList } = useAnimeLikes();
  const { user, isLoaded: userLoaded } = useUser();
  const { toast } = useToast();

  const { openAnime } = useAnimeModal();
  const [modalData, setModalData] = useState<{ title: string; users: any[] } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPointHistory, setShowPointHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Genre Grouping Expand State
  const [expandedGenres, setExpandedGenres] = useState<Record<string, boolean>>({});

  const allTracked = getTrackedList();
  const activeItems = allTracked;

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof activeItems> = {};
    const unassigned: typeof activeItems = [];

    activeItems.forEach(item => {
      let assigned = false;
      const anime = item?.anime;
      
      if (anime && anime.genres && Array.isArray(anime.genres) && anime.genres.length > 0) {
        // Group by primary genre safely
        const firstGenre = anime.genres[0];
        const primaryGenre = typeof firstGenre === 'string' ? firstGenre : (firstGenre?.name || "Other");
        
        if (!groups[primaryGenre]) groups[primaryGenre] = [];
        groups[primaryGenre].push(item);
        assigned = true;
      }
      
      if (!assigned) {
        unassigned.push(item);
      }
    });

    if (unassigned.length > 0) {
      groups["Other"] = unassigned;
    }

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeItems]);

  if (!trackerLoaded || !userLoaded) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading Profile...</div>;

  const rankTheme = user ? getRankTheme(user.arisePoints, user.username) : getRankTheme(0, "");
  const RankIcon = rankTheme.badgeIcon ? (Icons as any)[rankTheme.badgeIcon] : null;

  const { cleanBio, backgroundUrl } = user ? parseBio(user.bio || "", user.arisePoints || 0, user.username) : { cleanBio: "", backgroundUrl: null };

  const currentXp = user?.arisePoints || 0;
  const isUserAdmin = isAdmin(user?.username);
  const isUserLeadDev = isLeadDev(user?.username);
  const currentLevel = isUserLeadDev ? 70 : (isUserAdmin ? 50 : calculateLevel(currentXp));
  const nextXp = xpForNextLevel(currentLevel);
  const progressPercent = calculateProgressPercent(currentXp);

  return (
    <PageTransition>
      <div className="relative min-h-screen pt-24 pb-12 text-white overflow-hidden">
      
      {/* FIXED BACKGROUND BANNER */}
      <div className="fixed inset-0 z-0 bg-[#09090b]">
        {user?.bannerUrl ? (
          <>
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src={user.bannerUrl} 
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
        {user && (
          <div className={`relative flex flex-col md:flex-row items-end gap-6 rounded-3xl mb-10 shadow-2xl p-8 pt-32 border overflow-hidden ${rankTheme.bgCardClass}`}>
            {backgroundUrl && (
              <>
                <div 
                  className="absolute inset-0 z-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${backgroundUrl})` }}
                />
                <div className="absolute inset-0 z-0 bg-black/75 rounded-3xl pointer-events-none" />
              </>
            )}
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6 w-full text-center md:text-left">
              <div 
                className="relative group cursor-pointer shrink-0" 
                onClick={() => {
                  if (user.avatar) setPreviewImage(user.avatar);
                }}
              >
                {user.avatar ? (
                  <motion.img 
                    layoutId="profile-avatar"
                    src={user.avatar} 
                    alt="Avatar" 
                    className={`w-32 h-32 rounded-full object-cover border-4 bg-[#141414] transition-all duration-300 ${rankTheme.borderClass} ${rankTheme.glowClass}`} 
                  />
                ) : (
                  <motion.div 
                    layoutId="profile-avatar" 
                    className={`w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center text-4xl font-black border-4 transition-all duration-300 ${rankTheme.borderClass} ${rankTheme.glowClass}`}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </motion.div>
                )}
                {user.arisePoints !== undefined && (
                  <div className="absolute -bottom-2 -right-2 z-20">
                    <LevelBadge xp={isUserLeadDev ? 952200 : (isUserAdmin ? 480200 : user.arisePoints)} size="lg" className="shadow-[0_4px_20px_rgba(0,0,0,0.8)] border-[#141414]" />
                  </div>
                )}
              </div>

              <div className="z-10 mb-2 flex-1 w-full flex flex-col items-center md:items-start">
                <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start mb-2 w-full">
                  <h1 className={`text-4xl font-black drop-shadow-lg pr-6 pb-2 leading-relaxed break-words ${rankTheme.textGradient}`}>
                    {user.username}
                  </h1>
                  {rankTheme.title && (
                    <div className={`shrink-0 px-3 py-1 rounded-full flex items-center gap-1 ${rankTheme.badgeClass}`}>
                      {RankIcon && <RankIcon className="w-4 h-4" />}
                      <span className="text-xs font-black tracking-wider uppercase">{rankTheme.title}</span>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition shadow-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white"
                  >
                    <Settings className="w-5 h-5" /> Settings
                  </button>
                </div>

                {/* Level Progress Bar */}
                <div className="w-full max-w-md bg-black/40 rounded-full h-2.5 mt-2 mb-1 border border-white/10 relative overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                  <div className="absolute inset-0 bg-white/5 opacity-30 mix-blend-overlay"></div>
                </div>
                <div className="flex justify-between w-full max-w-md text-[10px] font-bold text-slate-400 mb-3 px-1 tracking-wider uppercase">
                  <span>{currentXp} XP</span>
                  <span>{nextXp} XP (Next LVL)</span>
                </div>
                <BioRenderer bio={cleanBio || "No bio set. Update your settings to add one!"} className="text-indigo-200 font-medium drop-shadow-md max-w-xl" />
                <div className="flex items-center gap-4 mt-3 text-sm font-bold text-slate-300">
                  <button 
                    onClick={() => setModalData({ title: 'Followers', users: (user.followers || []).map((f: any) => f.follower) })}
                    className="hover:text-white hover:underline transition"
                  >
                    <span>{(user.followers || []).length} Followers</span>
                  </button>
                  <button 
                    onClick={() => setModalData({ title: 'Following', users: (user.following || []).map((f: any) => f.following) })}
                    className="hover:text-white hover:underline transition"
                  >
                    <span>{(user.following || []).length} Following</span>
                  </button>
                  <button 
                    onClick={async () => {
                      if (isUserAdmin) {
                        if (!isUserLeadDev) {
                          toast("Admin powers unlocked.", "info");
                          return;
                        }
                        try {
                          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
                          await fetch(`${API_URL}/api/users/${user.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ arisePoints: Infinity })
                          });
                          toast("Lead Developer overrides enabled. Max Level.", "info");
                          setTimeout(() => window.location.reload(), 1000);
                        } catch(e) {}
                      } else {
                        setShowPointHistory(true);
                      }
                    }}
                    title={isUserAdmin ? "Admin level override" : undefined}
                    className={`ml-2 drop-shadow-md font-black hover:scale-105 transition cursor-pointer hover:brightness-125 ${rankTheme.textColorClass}`}
                  >
                    Ô£º {isUserLeadDev ? 'Ôê×' : (isUserAdmin ? '480,200' : (user.arisePoints || 0).toLocaleString())} Arise Points
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
            <motion.div 
              key="watchlist"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <Compass className="w-6 h-6 text-indigo-400" /> My Tracker
                  <span className="text-xs font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{activeItems.length}</span>
                </h3>
              </div>

              {activeItems.length === 0 ? (
                <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <Compass className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-300 mb-2">
                    Your Tracker is Empty
                  </h2>
                  <p className="text-slate-500 mb-6">
                    Explore the dashboard and add your favorite anime to your Tracker!
                  </p>
                  <Link href="/">
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full font-bold transition shadow-lg">
                      Discover Anime
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-10">
                  {groupedItems.map(([genre, items]) => {
                  const isExpanded = !!expandedGenres[genre];
                  const displayedItems = isExpanded ? items : items.slice(0, 6);
                  const hasMore = items.length > 6;

                  return (
                    <div key={genre} className="space-y-4">
                      {/* Title with Count */}
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-white tracking-wide">{genre}</h3>
                        <span className="text-xs font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{items.length}</span>
                      </div>

                      {/* Pinterest Grid Container */}
                      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4 space-y-4">
                        <AnimatePresence mode="popLayout">
                          {displayedItems.map((item, i) => (
                            <motion.div
                              initial={{ opacity: 0, y: 12, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.94 }}
                              transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.28), ease: [0.16, 1, 0.3, 1] }}
                              key={item?.anime?.mal_id ?? `${genre}-${i}`}
                              style={{ willChange: "transform, opacity" }}
                              className="relative group rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full break-inside-avoid"
                              onClick={() => item?.anime && openAnime(item.anime)}
                            >
                              <div className="w-full aspect-[2/3] relative">
                                <img 
                                  src={(item?.anime?.images?.jpg?.large_image_url || item?.anime?.images?.jpg?.image_url || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80") as string} 
                                  alt={item?.anime?.title_english || item?.anime?.title || "Anime"} 
                                  loading="lazy" 
                                  className="w-full h-full object-cover"
                                />
                                
                                {/* Status Badge Top Left */}
                                <div className="absolute top-2 left-2 z-10">
                                  <AnimeStatusBadge status={item?.anime?.status || "Unknown"} />
                                </div>

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                  <h3 className="text-white font-bold text-sm md:text-base drop-shadow-md line-clamp-2">
                                    {item?.anime?.title_english || item?.anime?.title || "Unknown Anime"}
                                  </h3>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      {/* See More Button */}
                      {hasMore && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setExpandedGenres(prev => ({ ...prev, [genre]: !prev[genre] }))}
                            className="flex items-center space-x-2 px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium text-slate-300 hover:text-white"
                          >
                            <span>{isExpanded ? "Show Less" : `See All ${items.length}`}</span>
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </motion.div>
        </AnimatePresence>

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
          altText="Profile Picture Preview"
          onClose={() => setPreviewImage(null)}
        />
      )}

      {showPointHistory && user && (
        <ArisePointHistoryModal
          userId={user.id}
          onClose={() => setShowPointHistory(false)}
        />
      )}

      {showSettings && <SettingsModal user={user} onClose={() => setShowSettings(false)} />}
      
    </div>
    </PageTransition>
  );
}
