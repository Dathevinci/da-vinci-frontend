"use client";

import { useAnimeStatus, AnimeUserStatus } from "@/hooks/useAnimeStatus";
import { useUser } from "@/hooks/useUser";
import AnimeCard from "@/components/anime/AnimeCard";
import { Compass, Eye, Heart, Clock, Check, ListFilter, Settings, Camera, UploadCloud, AlertCircle, Image as ImageIcon, Code2 } from "lucide-react";
import FollowListModal from "@/components/profile/FollowListModal";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import ImageCropperModal from "@/components/profile/ImageCropperModal";
import ArisePointHistoryModal from "@/components/profile/ArisePointHistoryModal";
import getCroppedImg from "@/lib/cropImage";
import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getRankTheme } from "@/lib/ranks";
import * as Icons from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function ProfileTrackerPage() {
  const { getTrackedList, isLoaded: trackerLoaded } = useAnimeStatus();
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

  const handleImageUpload = async (file: File | Blob, isBanner: boolean = false) => {
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
        if (isBanner) await updateProfile({ bannerUrl: data.secure_url });
        else await updateProfile({ avatar: data.secure_url });
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

  return (
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
                    onClick={() => setShowPointHistory(true)}
                    className={`ml-2 drop-shadow-md font-black hover:scale-105 transition cursor-pointer hover:brightness-125 ${rankTheme.textColorClass}`}
                  >
                    ✧ {user.arisePoints || 0} Arise Points
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
                        key={item.anime.id} 
                        className="relative group"
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
  );
}
