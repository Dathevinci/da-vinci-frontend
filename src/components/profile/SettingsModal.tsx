"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Moon, Sun, Lock, Unlock, Save, PlayCircle, EyeOff, Zap, Wifi, Key, User as UserIcon, Link as LinkIcon, Image as ImageIcon, Copy, Camera, UploadCloud, AlertCircle, RefreshCw, Database, Trash2 } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { usePreferences } from "@/hooks/usePreferences";
import { useUser } from "@/hooks/useUser";
import { isAdmin, isLeadDev } from "@/lib/admin";
import ImageCropperModal from "@/components/profile/ImageCropperModal";
import getCroppedImg from "@/lib/cropImage";
import { fetchUserMAL } from "@/lib/jikan";
import { useAnimeStatus, AnimeUserStatus } from "@/hooks/useAnimeStatus";

interface SettingsModalProps {
  user: any;
  onClose: () => void;
  onUpdate?: (data: any) => void;
}

export default function SettingsModal({ user: initialUser, onClose, onUpdate }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { preferences, updatePreference } = usePreferences();
  const { user: authUser, updateProfile, changeUsername } = useUser();
  const { batchSetStatus, wipeWatchlist } = useAnimeStatus();
  
  const user = initialUser || authUser;

  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'preferences' | 'integrations' | 'invites'>('profile');
  
  // Profile State
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [cropModalData, setCropModalData] = useState<{ src: string, isBanner: boolean, isGif?: boolean } | null>(null);
  const [bannerPos, setBannerPos] = useState<number>(user?.bannerPosition ?? 50);
  const [bannerStyle, setBannerStyle] = useState<string>(user?.bannerStyle || "full");

  const saveBannerStyle = (style: string) => {
    setBannerStyle(style);
    updateProfile({ bannerStyle: style } as any);
    if (onUpdate) onUpdate({ bannerStyle: style });
  };

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Username change: first is free, then it costs Arise Points (staff = free).
  const [newUsername, setNewUsername] = useState("");
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const USERNAME_COST = 500;
  const usernameIsFree = isLeadDev(user) || isAdmin(user) || (user?.usernameChanges || 0) === 0;

  // Integrations State
  const [anilistUsername, setAnilistUsername] = useState("");
  const [syncingAnilist, setSyncingAnilist] = useState(false);

  // Invites State
  const [invites, setInvites] = useState<any[]>([]);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [buyingInvite, setBuyingInvite] = useState(false);
  const INVITE_COST = 1000;

  useLockBodyScroll();

  useEffect(() => {
    if (activeTab === 'invites') {
      fetchInvites();
    }
  }, [activeTab]);

  const fetchInvites = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = localStorage.getItem("davinci_token");
      const res = await fetch(`${API_URL}/api/invites`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("davinci_token") || user?.id}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvites(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch invites");
    }
  };

  const generateInvite = async () => {
    setIsGeneratingInvite(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = localStorage.getItem("davinci_token");
      const res = await fetch(`${API_URL}/api/invites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("davinci_token") || user?.id}` }
      });
      const data = await res.json();
      if (data.success) {
        toast("Invite key generated successfully!", "success");
        fetchInvites();
      } else {
        toast(data.message || "Failed to generate invite", "error");
      }
    } catch (err) {
      toast("Error generating invite", "error");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const buyInvite = async () => {
    setBuyingInvite(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/invites/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.id}` },
      });
      const data = await res.json();
      if (data.success) {
        toast(data.cost > 0 ? `Invite bought for ${data.cost.toLocaleString()} Arise Points!` : "Invite generated!", "success");
        fetchInvites();
        if (typeof data.arisePoints === "number") {
          const stored = localStorage.getItem("davinci_user");
          if (stored) {
            try {
              const u = JSON.parse(stored);
              u.arisePoints = data.arisePoints;
              localStorage.setItem("davinci_user", JSON.stringify(u));
              window.dispatchEvent(new Event("davinci_user_updated"));
            } catch {}
          }
        }
      } else {
        toast(data.message || "Couldn't buy invite.", "error");
      }
    } catch (err) {
      toast("Error buying invite.", "error");
    } finally {
      setBuyingInvite(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const payload: any = { isPrivate, bio };
      // Fallback for standalone API save if updateProfile isn't available
      if (updateProfile) {
        await updateProfile(payload);
      } else {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        await fetch(`${API_URL}/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      
      if (onUpdate) onUpdate(payload);
      toast("Profile saved successfully!", "success");
    } catch (err) {
      toast("Error saving profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeUsername = async () => {
    const desired = newUsername.trim();
    if (!desired) return toast("Enter a new username.", "error");
    if (desired.toLowerCase() === (user?.username || "").toLowerCase()) return toast("That's already your username.", "error");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(desired)) return toast("3–20 characters: letters, numbers, or underscores only.", "error");

    setIsChangingUsername(true);
    try {
      const result: any = await changeUsername(desired);
      if (result.success) {
        toast(
          result.wasFree
            ? `Username changed to ${desired}. That was your free change.`
            : `Username changed to ${desired}. ${result.cost} Arise Points spent.`,
          "success"
        );
        setNewUsername("");
        if (onUpdate) onUpdate({ username: desired });
      } else {
        toast(result.message || "Couldn't change username.", "error");
      }
    } finally {
      setIsChangingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast("Please fill in all password fields.", "error");
    }
    if (newPassword !== confirmPassword) {
      return toast("New passwords do not match.", "error");
    }
    if (newPassword.length < 6) {
      return toast("New password must be at least 6 characters.", "error");
    }
    setIsChangingPassword(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, currentPassword, newPassword })
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
      
      const entriesToSync = entries
        .filter((entry: any) => entry.anime)
        .map((entry: any) => ({ anime: entry.anime, status: "Watching" as AnimeUserStatus }));

      if (entriesToSync.length === 0) {
         toast("No entries found to import.", "error");
         setSyncingAnilist(false);
         return;
      }

      await batchSetStatus(entriesToSync);
      toast(`Successfully imported ${entriesToSync.length} anime!`, "success");
    } catch (e: any) {
      toast(e.message || "Failed to sync MAL", "error");
    } finally {
      setSyncingAnilist(false);
    }
  };

  const handleWipe = async () => {
    if (!confirm("Are you sure you want to completely wipe your Da Vinci watchlist? This action cannot be undone.")) return;
    setIsSaving(true);
    try {
      await wipeWatchlist();
      toast("Watchlist completely wiped.", "success");
    } catch (e) {
      toast("Failed to wipe watchlist.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file: File | Blob, isBanner: boolean = false, isGif: boolean = false, cropParams?: any) => {
    const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return toast("Missing Cloudinary environment variables!", "error");
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
        if (isGif && cropParams) {
          const { x, y, width, height } = cropParams;
          const cropStr = `c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}`;
          finalUrl = finalUrl.replace('/upload/', `/upload/${cropStr}/`);
        } else if (isGif) {
          finalUrl = finalUrl.replace(/\.[^/.]+$/, ".gif");
        }
        
        if (updateProfile) {
          if (isBanner) await updateProfile({ bannerUrl: finalUrl });
          else await updateProfile({ avatar: finalUrl });
        }
        if (onUpdate) {
          onUpdate(isBanner ? { bannerUrl: finalUrl } : { avatar: finalUrl });
        }
        toast("Upload successful!", "success");
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

    e.target.value = '';
    const isGif = file.type === 'image/gif';
    
    if (isGif) {
      const isUserAdmin = isAdmin(user);
      if (!isUserAdmin && (user?.arisePoints || 0) < 500) {
        return toast(`Animated GIF ${isBanner ? 'banners' : 'avatars'} require 500 Arise Points, Lead Dev, or Admin status!`, "error");
      }
    }

    // Banners are shown as a full-width cover strip, so cropping here would only
    // get re-cropped by the cover and never match the preview. Upload as-is.
    if (isBanner) {
      handleImageUpload(file, true, isGif);
      return;
    }

    // Avatars still use the circular cropper.
    const reader = new FileReader();
    reader.onload = () => {
      setCropModalData({ src: reader.result as string, isBanner, isGif });
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedAreaPixels: any) => {
    if (!cropModalData) return;
    const { src, isBanner, isGif } = cropModalData;
    setCropModalData(null);
    
    try {
      if (isGif) {
        const response = await fetch(src);
        const blob = await response.blob();
        await handleImageUpload(blob, isBanner, true, croppedAreaPixels);
      } else {
        const croppedFile = await getCroppedImg(src, croppedAreaPixels, isBanner ? 'banner.jpeg' : 'avatar.jpeg');
        if (!croppedFile) throw new Error("Failed to crop image");
        await handleImageUpload(croppedFile, isBanner);
      }
    } catch (e) {
      console.error(e);
      toast("Failed to crop and upload image.", "error");
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#09090b] border border-white/10 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[85vh] flex flex-col"
          >
            <button 
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-500 hover:text-white transition bg-white/5 hover:bg-white/10 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-black mb-6 text-white tracking-tight flex-shrink-0">Settings</h2>

            <div className="flex gap-2 mb-6 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none shrink-0">
              <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'profile' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Profile</button>
              <button onClick={() => setActiveTab('account')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'account' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Account</button>
              <button onClick={() => setActiveTab('preferences')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'preferences' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Preferences</button>
              <button onClick={() => setActiveTab('integrations')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'integrations' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Integrations</button>
              <button onClick={() => setActiveTab('invites')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'invites' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Invite Keys</button>
            </div>

            {/* Scrollable Content Area */}
            <div className="overflow-y-auto pr-2 -mr-2 space-y-6 scrollbar-thin scrollbar-thumb-white/10 flex-1 min-h-[50vh]">
              
              {activeTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 p-4 rounded-xl mb-4 flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 flex-shrink-0" />
                      <p className="text-sm">
                        <strong>Missing Cloudinary Config:</strong> To upload avatars, you must add <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> to your .env.local file!
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Profile Picture</label>
                      <div className="flex items-center gap-4">
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, false)} />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-purple-400 bg-white/5 hover:bg-white/10 text-white font-bold h-32 rounded-2xl transition disabled:opacity-50"
                        >
                          {uploadingImage ? <RefreshCw className="w-6 h-6 animate-spin text-purple-400" /> : <Camera className="w-6 h-6 text-slate-400" />}
                          <span className="text-sm text-slate-300">{uploadingImage ? "Uploading..." : "Upload Avatar"}</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Background Banner</label>
                      <div className="flex items-center gap-4">
                        <input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={(e) => handleFileSelect(e, true)} />
                        <button 
                          onClick={() => bannerInputRef.current?.click()}
                          disabled={uploadingBanner}
                          className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-purple-400 bg-white/5 hover:bg-white/10 text-white font-bold h-32 rounded-2xl transition disabled:opacity-50"
                        >
                          {uploadingBanner ? <RefreshCw className="w-6 h-6 animate-spin text-purple-400" /> : <ImageIcon className="w-6 h-6 text-slate-400" />}
                          <span className="text-sm text-slate-300">{uploadingBanner ? "Uploading..." : "Upload Banner"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {user?.bannerUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Banner Style</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveBannerStyle("full")}
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm border transition ${bannerStyle !== "cover" ? "bg-purple-600 border-purple-500 text-white" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          Full screen
                        </button>
                        <button
                          onClick={() => saveBannerStyle("cover")}
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm border transition ${bannerStyle === "cover" ? "bg-purple-600 border-purple-500 text-white" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          Cover header
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">Full screen fills the whole background; cover shows it as a header strip.</p>
                    </div>
                  )}

                  {user?.bannerUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reposition Banner</label>
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 bg-[#141414]">
                        <img
                          src={user.bannerUrl}
                          alt="Banner preview"
                          style={{ objectPosition: `center ${bannerPos}%` }}
                          className="w-full h-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={bannerPos}
                        onChange={e => setBannerPos(Number(e.target.value))}
                        onMouseUp={() => { updateProfile({ bannerPosition: bannerPos } as any); onUpdate?.({ bannerPosition: bannerPos }); }}
                        onTouchEnd={() => { updateProfile({ bannerPosition: bannerPos } as any); onUpdate?.({ bannerPosition: bannerPos }); }}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                      <p className="text-xs text-slate-500">Drag to choose which part of the banner shows in the cover.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bio</label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself..." className="w-full bg-[#030305] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none" />
                  </div>
                  
                  <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          {isPrivate ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-green-400" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Private Profile</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Hide watchlist and bio from non-followers.</p>
                        </div>
                      </div>
                      <button onClick={() => setIsPrivate(!isPrivate)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-purple-600' : 'bg-white/10'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                  >
                    <Save className="w-5 h-5" />
                    {isSaving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {/* Change Username — first change free, then costs Arise Points */}
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-white"><UserIcon className="w-5 h-5 text-purple-400" /> Change Username</h3>
                    <p className="text-sm text-slate-400">
                      {usernameIsFree
                        ? "Your first username change is free."
                        : <>Changing again costs <span className="font-bold text-purple-300">{USERNAME_COST} Arise Points</span> — you have <span className="font-semibold text-white">{(user?.arisePoints || 0).toLocaleString()}</span>.</>}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder={user?.username || "New username"}
                        maxLength={20}
                        className="flex-1 bg-[#030305] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={handleChangeUsername}
                        disabled={isChangingUsername || !newUsername.trim()}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {isChangingUsername ? "Saving…" : usernameIsFree ? "Change · Free" : `Change · ${USERNAME_COST} AP`}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">3–20 characters — letters, numbers, or underscores.</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-white"><Key className="w-5 h-5 text-purple-400" /> Change Password</h3>
                    <input type="password" placeholder="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-[#030305] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                    <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-[#030305] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                    <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-[#030305] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                    <button onClick={handleChangePassword} disabled={isChangingPassword} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold transition w-full disabled:opacity-50 flex items-center justify-center gap-2">
                      {isChangingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
                    <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Danger Zone</h3>
                    <p className="text-red-300/70 text-sm mb-4">Wiping your watchlist will permanently delete all your tracked anime, scores, and progress. This cannot be undone.</p>
                    <button onClick={handleWipe} disabled={isSaving} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Wipe Watchlist
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          {theme === 'dark' ? <Zap className="w-4 h-4 text-purple-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">App Theme</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">Switch between Neon Purple and Pure Black mode.</p>
                        </div>
                      </div>
                      <button onClick={toggleTheme} className="px-3 py-1.5 rounded-lg font-bold text-xs bg-white/10 hover:bg-white/20 transition text-white">
                        {theme === 'dark' ? 'Neon Purple' : 'Pure Black'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <PlayCircle className={`w-4 h-4 ${preferences.autoplayTrailers ? 'text-purple-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Cinematic Autoplay</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Auto-play trailers on hover.</p>
                        </div>
                      </div>
                      <button onClick={() => updatePreference('autoplayTrailers', !preferences.autoplayTrailers)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.autoplayTrailers ? 'bg-purple-600' : 'bg-white/10'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.autoplayTrailers ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <EyeOff className={`w-4 h-4 ${preferences.blurSensitiveContent ? 'text-red-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Safe Browsing</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Blur NSFW or sensitive content.</p>
                        </div>
                      </div>
                      <button onClick={() => updatePreference('blurSensitiveContent', !preferences.blurSensitiveContent)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.blurSensitiveContent ? 'bg-red-500' : 'bg-white/10'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.blurSensitiveContent ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <Zap className={`w-4 h-4 ${preferences.reducedMotion ? 'text-yellow-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Reduced Motion</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Disable heavy 3D shuffles for performance.</p>
                        </div>
                      </div>
                      <button onClick={() => updatePreference('reducedMotion', !preferences.reducedMotion)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.reducedMotion ? 'bg-yellow-500' : 'bg-white/10'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.reducedMotion ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <Wifi className={`w-4 h-4 ${preferences.dataSaver ? 'text-green-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Data Saver</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Load lower resolution images.</p>
                        </div>
                      </div>
                      <button onClick={() => updatePreference('dataSaver', !preferences.dataSaver)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.dataSaver ? 'bg-green-500' : 'bg-white/10'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.dataSaver ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-[#2b2d42] border border-blue-500/30 p-6 rounded-2xl">
                    <h3 className="font-bold flex items-center gap-2 text-white mb-2"><Database className="w-5 h-5 text-blue-400" /> MyAnimeList Sync</h3>
                    <p className="text-slate-300 text-sm mb-4">Import your anime list directly from MyAnimeList. This will merge with your existing Tracker.</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="MAL Username" 
                        value={anilistUsername}
                        onChange={e => setAnilistUsername(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" 
                      />
                      <button 
                        onClick={handleMALSync}
                        disabled={syncingAnilist}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap"
                      >
                        {syncingAnilist ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {syncingAnilist ? "Syncing..." : "Sync List"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'invites' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div>
                      <h3 className="font-bold text-purple-300">Invite Keys</h3>
                      <p className="text-xs text-purple-300/70 mt-1">
                        {isAdmin(user) ? "Staff overrides enabled — generate unlimited invite keys." : "Generate your free invite key, or buy more with Arise Points."}
                      </p>
                    </div>
                    <button
                      onClick={generateInvite}
                      disabled={isGeneratingInvite || (!isAdmin(user) && invites.length >= 1)}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap"
                    >
                      <Key className="w-4 h-4" />
                      {isGeneratingInvite ? "Generating..." : "Generate Key"}
                    </button>
                  </div>

                  {!isAdmin(user) && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                      <div>
                        <h3 className="font-bold text-white">Buy an Extra Invite</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Costs <span className="text-purple-300 font-bold">{INVITE_COST.toLocaleString()} AP</span> — you have <span className="text-white font-semibold">{(user?.arisePoints || 0).toLocaleString()}</span>.
                        </p>
                      </div>
                      <button
                        onClick={buyInvite}
                        disabled={buyingInvite || (user?.arisePoints || 0) < INVITE_COST}
                        className="bg-white/10 hover:bg-white/20 border border-purple-500/40 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap"
                      >
                        <Key className="w-4 h-4" />
                        {buyingInvite ? "Buying…" : `Buy — ${INVITE_COST.toLocaleString()} AP`}
                      </button>
                    </div>
                  )}

                  {invites.length > 0 ? (
                    <div className="space-y-3 mt-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-2">Your Keys</h4>
                      {invites.map(invite => (
                        <div key={invite.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="font-mono font-bold text-emerald-400 tracking-wider text-lg">{invite.code}</p>
                            <p className="text-xs text-slate-500 mt-1">{invite.isUsed ? `Used by ${invite.usedBy || 'Unknown'}` : 'Unused'}</p>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(invite.code);
                              toast("Copied to clipboard!", "success");
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
                            title="Copy Code"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No invite keys generated yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Image Cropper Modal */}
      {cropModalData && (
        <ImageCropperModal
          imageSrc={cropModalData.src}
          isBanner={cropModalData.isBanner}
          isGif={cropModalData.isGif}
          onCropComplete={handleCropComplete}
          onClose={() => setCropModalData(null)}
        />
      )}
    </>
  );
}
