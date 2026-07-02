"use client";

import { useAnimeStatus, AnimeUserStatus } from "@/hooks/useAnimeStatus";
import { useUser } from "@/hooks/useUser";
import AnimeCard from "@/components/anime/AnimeCard";
import { Compass, Eye, Heart, Clock, Check, ListFilter, Settings, Camera, UploadCloud, AlertCircle, Image as ImageIcon, Code2, RefreshCw, Database, Trash2 } from "lucide-react";
import FollowListModal from "@/components/profile/FollowListModal";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import ImageCropperModal from "@/components/profile/ImageCropperModal";
import ArisePointHistoryModal from "@/components/profile/ArisePointHistoryModal";
import getCroppedImg from "@/lib/cropImage";
import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fetchUserMAL } from "@/lib/jikan";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";

export default function ProfileTrackerPage() {
  const { getTrackedList, isLoaded: trackerLoaded, batchSetStatus, wipeWatchlist } = useAnimeStatus();
  const { user, isLoaded: userLoaded, updateProfile } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"Watchlist" | "Settings">("Watchlist");
  const [filter, setFilter] = useState<AnimeUserStatus | "All">("All");
  const [modalData, setModalData] = useState<{ title: string; users: any[] } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cropModalData, setCropModalData] = useState<{ src: string, isBanner: boolean } | null>(null);
  const [showPointHistory, setShowPointHistory] = useState(false);

  // Settings State
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // AniList Sync State
  const [anilistUsername, setAnilistUsername] = useState("");
  const [syncingAnilist, setSyncingAnilist] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    watching: true,
    interested: true,
    waiting: true,
    finished: true,
    dropped: true,
  });

  if (!trackerLoaded || !userLoaded) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading Profile...</div>;

  const allTracked = getTrackedList();
  const filteredList = filter === "All" ? allTracked : getTrackedList(filter as AnimeUserStatus);
  const rankTheme = user ? getRankTheme(user.arisePoints, user.username) : getRankTheme(0, "");
  const RankIcon = rankTheme.badgeIcon ? (Icons as any)[rankTheme.badgeIcon] : null;

  const filterTabs = [
    { id: "All", icon: ListFilter },
    { id: "Watching", icon: Eye },
    { id: "Interested", icon: Heart },
    { id: "Waiting", icon: Clock },
    { id: "Finished", icon: Check },
  ];

  const handleImageUpload = async (file: File | Blob, isBanner: boolean = false, isGif: boolean = false) => {
    const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast("Missing Cloudinary environment variables!", "error");
      return;
    }

    if (isBanner) setUploadingBanner(true);
    else setUploadingImage(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        let finalUrl = data.secure_url;
        if (isGif) {
          finalUrl = finalUrl.replace(/\.[^/.]+$/, ".gif");
        }
        if (isBanner) await updateProfile({ bannerUrl: finalUrl });
        else await updateProfile({ avatar: finalUrl });
      }
    } catch (err) {
      console.error("Upload failed", err);
      toast("Failed to upload image.", "error");
    } finally {
      if (isBanner) setUploadingBanner(false);
      else setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isBanner: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ''; // Reset input so same file can be selected again
    const isGif = file.type === 'image/gif';
    
    if (isBanner) {
      if (isGif) {
        if (user?.username?.toLowerCase() !== "dejavuh" && user?.username?.toLowerCase() !== "davinci" && (user?.arisePoints || 0) < 500) {
          toast("Animated GIF banners require 500 Arise Points, Lead Dev, or Admin status!", "error");
          return;
        }
      }
      // Always bypass cropping for banners (users want to upload raw backgrounds)
      handleImageUpload(file, true, isGif);
      return;
    }

    if (isGif && !isBanner) {
      toast("GIF avatars are not supported.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropModalData({ src: reader.result as string, isBanner });
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedAreaPixels: any) => {
    if (!cropModalData) return;
    const { src, isBanner } = cropModalData;
    setCropModalData(null); // Close modal
    
    try {
      const croppedFile = await getCroppedImg(src, croppedAreaPixels, isBanner ? 'banner.jpeg' : 'avatar.jpeg');
      if (!croppedFile) throw new Error("Failed to crop image");
      await handleImageUpload(croppedFile, isBanner);
    } catch (e) {
      console.error(e);
      toast("Failed to crop and upload image.", "error");
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await updateProfile({ bio });
    setIsSaving(false);
    toast("Profile saved successfully!", "success");
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast("Please fill in all password fields.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match.", "error");
      return;
    }
    if (newPassword.length < 6) {
      toast("New password must be at least 6 characters.", "error");
      return;
    }
    setIsChangingPassword(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user?.id, 
          currentPassword, 
          newPassword 
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("Password changed successfully!", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast(data.message || "Failed to change password", "error");
      }
    } catch (err) {
      toast("An error occurred while changing password.", "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleMALSync = async () => {
    if (!anilistUsername) return toast("Please enter a MyAnimeList username.", "error");
    setSyncingAnilist(true);
    try {
      const entries = await fetchUserMAL(anilistUsername);
      if (!entries || entries.length === 0) throw new Error("Could not fetch data for this user or list is empty.");
      
      const entriesToSync: any[] = [];
      
      entries.forEach((entry: any) => {
        let targetStatus: AnimeUserStatus | null = null;
        
        if (entry.watching_status === 1) {
           if (syncOptions.watching) targetStatus = "Watching";
        } else if (entry.watching_status === 2) {
           if (syncOptions.finished) targetStatus = "Finished";
        } else if (entry.watching_status === 3) {
           if (syncOptions.waiting) targetStatus = "Waiting";
        } else if (entry.watching_status === 4) {
           if (syncOptions.dropped) targetStatus = "Dropped";
        } else if (entry.watching_status === 6) {
           if (syncOptions.interested) targetStatus = "Interested";
        }
        
        if (targetStatus && entry.anime) {
          entriesToSync.push({ anime: entry.anime, status: targetStatus });
        }
      });
      
      if (entriesToSync.length === 0) {
         toast("No entries found to sync with selected options.", "error");
         setSyncingAnilist(false);
         return;
      }
      
      await batchSetStatus(entriesToSync);
      toast(`Successfully imported ${entriesToSync.length} anime from MAL!`, "success");
      setActiveTab("Watchlist");
    } catch (e: any) {
      toast(e.message || "Failed to sync MAL", "error");
    } finally {
      setSyncingAnilist(false);
    }
  };

  const handleWipe = async () => {
    if (!confirm("Are you sure you want to completely wipe your Da Vinci watchlist? This action cannot be undone.")) return;
    setIsSaving(true);
    await wipeWatchlist();
    setIsSaving(false);
    toast("Watchlist completely wiped.", "success");
  };

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
          <div className={`flex flex-col md:flex-row items-end gap-6 rounded-3xl mb-10 shadow-2xl p-8 pt-32 border ${rankTheme.bgCardClass}`}>
            <div className="relative z-10 flex flex-col md:flex-row items-end gap-6 w-full">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => {
                  if (activeTab === "Settings") fileInputRef.current?.click();
                  else if (user.avatar) setPreviewImage(user.avatar);
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
                {activeTab === "Settings" && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>

              <div className="text-center md:text-left z-10 mb-2 flex-1">
                <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                  <h1 className={`text-4xl font-black drop-shadow-lg ${rankTheme.textGradient}`}>
                    {user.username}
                  </h1>
                  {rankTheme.title && (
                    <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${rankTheme.badgeClass}`}>
                      {RankIcon && <RankIcon className="w-4 h-4" />}
                      <span className="text-xs font-black tracking-wider uppercase">{rankTheme.title}</span>
                    </div>
                  )}
                </div>
                <p className="text-indigo-200 font-medium drop-shadow-md max-w-xl">{user.bio || "No bio set. Update your settings to add one!"}</p>
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
                    onClick={() => {
                      if (user.username === 'dejavuh') {
                        toast("Something that can't be measured because the user is the honorable one.", "info");
                      } else {
                        setShowPointHistory(true);
                      }
                    }}
                    title={user.username === 'dejavuh' ? "Something that can't be measured because the user is the honorable one" : undefined}
                    className={`ml-2 drop-shadow-md font-black hover:scale-105 transition cursor-pointer hover:brightness-125 ${rankTheme.textColorClass}`}
                  >
                    ✧ {user.username === 'dejavuh' ? '∞' : ((user.arisePoints || 0) >= 50000 ? '50,000 (MAX)' : (user.arisePoints || 0))} Arise Points
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10 pb-4 relative">
          <button 
            onClick={() => setActiveTab("Watchlist")}
            className={`text-lg font-bold transition px-4 py-2 rounded-lg relative ${activeTab === "Watchlist" ? "text-white" : "text-slate-400 hover:text-white"}`}
          >
            My Watchlist
            {activeTab === "Watchlist" && (
              <motion.div layoutId="activeTabUnderline" className={`absolute left-0 right-0 bottom-[-17px] h-1 ${rankTheme.tabUnderlineClass}`} />
            )}
          </button>
          {user && (
            <button 
              onClick={() => setActiveTab("Settings")}
              className={`text-lg font-bold transition px-4 py-2 rounded-lg flex items-center gap-2 relative ${activeTab === "Settings" ? "text-white" : "text-slate-400 hover:text-white"}`}
            >
              <Settings className="w-5 h-5" /> Settings
              {activeTab === "Settings" && (
                <motion.div layoutId="activeTabUnderline" className={`absolute left-0 right-0 bottom-[-17px] h-1 ${rankTheme.tabUnderlineClass}`} />
              )}
            </button>
          )}
        </div>

        {/* Tab Contents - Animated transition */}
        <AnimatePresence mode="wait">
          {activeTab === "Watchlist" ? (
            <motion.div 
              key="watchlist"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center mb-8">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-1 rounded-lg flex overflow-x-auto max-w-full hide-scrollbar relative">
                  {filterTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFilter(tab.id as any)}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap z-10 ${filter === tab.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {filter === tab.id && (
                        <motion.div 
                          layoutId="activeFilterBg" 
                          className="absolute inset-0 bg-indigo-600 rounded-md z-[-1] shadow-md"
                        />
                      )}
                      <tab.icon className="w-4 h-4" /> {tab.id}
                    </button>
                  ))}
                </div>
              </div>

              {allTracked.length === 0 ? (
                <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <Compass className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-300 mb-2">Your Tracker is Empty</h2>
                  <p className="text-slate-500 mb-6">Explore the dashboard and start tracking your favorite anime!</p>
                  <Link href="/">
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full font-bold transition shadow-lg">
                      Discover Anime
                    </button>
                  </Link>
                </div>
              ) : (
                <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  <AnimatePresence>
                    {filteredList.map(item => (
                      <motion.div 
                        layout 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        key={item.anime.mal_id || Math.random()} 
                        className="relative group z-0 hover:z-50"
                      >
                        <AnimeCard anime={item.anime} />
                        <div className="absolute -top-3 -right-3 z-50 bg-[#141414] border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-indigo-300 shadow-xl">
                          {item.status}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
              
              {allTracked.length > 0 && filteredList.length === 0 && (
                <div className="text-center py-20 text-slate-500 font-medium">
                  No anime found in the "{filter}" category.
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {user && (
                <>
                  <div className="max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Settings className="w-6 h-6 text-indigo-400" /> Profile Settings</h2>
                  
                  {!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 p-4 rounded-xl mb-8 flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 flex-shrink-0" />
                      <p className="text-sm">
                        <strong>Missing Cloudinary Config:</strong> To upload avatars, you must add <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> to your .env.local file and Vercel!
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Avatar Upload */}
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Profile Picture</label>
                        <div className="flex items-center gap-4">
                          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, false)} />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 w-full justify-center"
                          >
                            <UploadCloud className="w-5 h-5" />
                            {uploadingImage ? "Uploading..." : "Change Avatar"}
                          </button>
                        </div>
                      </div>

                      {/* Banner Upload */}
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Background Banner</label>
                        <div className="flex items-center gap-4">
                          <input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={(e) => handleFileSelect(e, true)} />
                          <button 
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={uploadingBanner}
                            className="flex items-center gap-2 bg-pink-600/20 hover:bg-pink-600/40 border border-pink-500/30 text-pink-300 px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 w-full justify-center"
                          >
                            <ImageIcon className="w-5 h-5" />
                            {uploadingBanner ? "Uploading..." : "Change Banner"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Username (Locked)</label>
                      <input type="text" disabled value={user.username} className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-slate-500 cursor-not-allowed" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Bio</label>
                      <textarea 
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell the world about your favorite anime..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[120px]"
                      />
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-bold transition disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Security Component */}
                <div className="max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#2b2d42] flex items-center justify-center border border-indigo-500/30 shadow-lg">
                      <Settings className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">Security</h2>
                      <p className="text-slate-400 text-sm">Update your password to keep your account secure.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">Current Password</label>
                      <input 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">New Password</label>
                      <input 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">Confirm New Password</label>
                      <input 
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-bold transition disabled:opacity-50"
                      >
                        {isChangingPassword ? "Updating..." : "Change Password"}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* AniList Sync Component */}
                <div className="max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#2b2d42] flex items-center justify-center border border-[#3db4f2]/30 shadow-lg">
                      <RefreshCw className="w-6 h-6 text-[#3db4f2]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">MyAnimeList Sync</h2>
                      <p className="text-slate-400 text-sm">Import your existing anime list directly into Da Vinci.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Database className="h-5 w-5 text-slate-500" />
                        </div>
                        <input
                          type="text"
                          value={anilistUsername}
                          onChange={(e) => setAnilistUsername(e.target.value)}
                          placeholder="Enter your MyAnimeList Username"
                          className="w-full bg-black/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#3db4f2]/50 focus:ring-1 focus:ring-[#3db4f2]/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="bg-black/20 border border-white/5 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { id: 'watching', label: 'Watching', color: 'text-indigo-400' },
                        { id: 'interested', label: 'Interested', color: 'text-pink-400' },
                        { id: 'waiting', label: 'Waiting', color: 'text-yellow-400' },
                        { id: 'finished', label: 'Finished', color: 'text-emerald-400' },
                        { id: 'dropped', label: 'Dropped', color: 'text-red-400' },
                      ].map((opt) => (
                        <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={syncOptions[opt.id as keyof typeof syncOptions]}
                              onChange={(e) => setSyncOptions(prev => ({ ...prev, [opt.id]: e.target.checked }))}
                              className="peer sr-only"
                            />
                            <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center peer-checked:bg-[#3db4f2] peer-checked:border-[#3db4f2] transition-all">
                              <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                            </div>
                          </div>
                          <span className={`text-sm font-bold ${opt.color} group-hover:brightness-125 transition`}>{opt.label}</span>
                        </label>
                      ))}
                    </div>

                    <button 
                      onClick={handleMALSync}
                      disabled={syncingAnilist || !anilistUsername}
                      className="w-full bg-gradient-to-r from-[#2b2d42] to-[#1a1b26] hover:from-[#3db4f2]/20 hover:to-[#2b2d42] border border-[#3db4f2]/30 text-white px-8 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:hover:from-[#2b2d42] shadow-lg flex items-center justify-center gap-2 group"
                    >
                      <RefreshCw className={`w-5 h-5 ${syncingAnilist ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                      {syncingAnilist ? "Importing from MAL..." : "Connect & Import"}
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="mt-12 pt-8 border-t border-white/5">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-red-500/5 border border-red-500/10">
                      <div>
                        <h3 className="font-bold text-red-400 mb-1">Danger Zone</h3>
                        <p className="text-xs text-slate-400">Permanently wipe your Da Vinci watchlist. Your MAL will not be affected.</p>
                      </div>
                      <button 
                        onClick={handleWipe}
                        className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 px-6 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Wipe List
                      </button>
                    </div>
                  </div>
                </div>
                </>
              )}
            </motion.div>
          )}
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

      {cropModalData && (
        <ImageCropperModal
          imageSrc={cropModalData.src}
          isBanner={cropModalData.isBanner}
          onClose={() => setCropModalData(null)}
          onCropComplete={handleCropComplete}
        />
      )}

      {(isSaving || uploadingImage || uploadingBanner) && (
        <LoadingOverlay message={uploadingImage ? "Uploading Avatar..." : uploadingBanner ? "Uploading Banner..." : "Saving Profile..."} />
      )}

      {showPointHistory && user && (
        <ArisePointHistoryModal
          userId={user.id}
          onClose={() => setShowPointHistory(false)}
        />
      )}
    </div>
    </PageTransition>
  );
}
