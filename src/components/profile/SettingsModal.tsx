"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Moon,
  Sun,
  Lock,
  Unlock,
  Save,
  PlayCircle,
  Eye,
  EyeOff,
  Zap,
  Wifi,
  Key,
  User as UserIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Copy,
  Camera,
  UploadCloud,
  AlertCircle,
  RefreshCw,
  Database,
  Trash2,
  ShieldCheck,
  SlidersHorizontal,
  Music,
  Check,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";
import { validateProfileAudio } from "@/lib/profileAudio";
import { useRouter } from "next/navigation";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { authHeaders } from "@/lib/authToken";
import { decorName, ALL_FRAME_IDS, ALL_EFFECT_IDS } from "@/lib/decorations";
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
  const router = useRouter();

  const user = initialUser || authUser;

  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'preferences' | 'integrations'>('profile');

  // Profile State
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [cropModalData, setCropModalData] = useState<{ src: string; isBanner: boolean; isGif?: boolean } | null>(null);
  const [bannerPos, setBannerPos] = useState<number>(user?.bannerPosition ?? 50);
  const [bannerStyle, setBannerStyle] = useState<string>(user?.bannerStyle || "full");

  // Profile Audio
  const [profileSong, setProfileSong] = useState<string>(user?.profileSong || "");
  const [savingSong, setSavingSong] = useState(false);
  const songCheck = validateProfileAudio(profileSong);

  // Decoration & Title Pickers
  const staffUser = isAdmin(user) || isLeadDev(user);
  const ownedFrames: string[] = staffUser ? ALL_FRAME_IDS : (user?.purchasedFrames || []);
  const ownedEffects: string[] = staffUser ? ALL_EFFECT_IDS : (user?.purchasedEffects || []);
  const activeDecorLabel =
    [user?.activeFrame ? decorName(user.activeFrame) : null, user?.activeEffect ? decorName(user.activeEffect) : null]
      .filter(Boolean)
      .join("  ·  ") || "None";
  const [showDecorPicker, setShowDecorPicker] = useState(false);
  const [equipping, setEquipping] = useState(false);

  const wornTitles: string[] = (user as any)?.equippedTitles || [];
  const currentTitle = wornTitles.length > 0 ? wornTitles[0] : ((user as any)?.cardTitle || "None");
  const MAX_WORN_TITLES = 3;
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [titlesOwned, setTitlesOwned] = useState<{ set: string; title: string }[]>([]);
  const [titlesSel, setTitlesSel] = useState<string[]>([]);
  const [titlesLoaded, setTitlesLoaded] = useState(false);
  const [savingTitles, setSavingTitles] = useState(false);

  // Account Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Username Change
  const [newUsername, setNewUsername] = useState("");
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const USERNAME_COST = 500;
  const usernameIsFree = isLeadDev(user) || isAdmin(user) || (user?.usernameChanges || 0) === 0;

  // Integrations State
  const [anilistUsername, setAnilistUsername] = useState("");

  // Danger Zone Confirmation
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useLockBodyScroll();

  const equipDecor = async (patch: { activeFrame?: string | null; activeEffect?: string | null }) => {
    setEquipping(true);
    try {
      const result: any = await updateProfile(patch as any);
      if (result && result.success === false) {
        toast(result.message || "Couldn't equip that.", "error");
        return;
      }
      onUpdate?.(patch);
      toast("Equipped.", "success");
    } finally {
      setEquipping(false);
    }
  };

  const toggleTitlePicker = () => {
    setShowTitlePicker(v => !v);
    if (!titlesLoaded && user?.id) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      fetch(`${API_URL}/api/cards/titles/${user.id}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success) {
            let ownedList = d.data.owned || [];
            let equippedList = d.data.equipped || [];
            const isRiv = (user?.username || "").toLowerCase() === "riv333";
            if (isRiv) {
              if (!ownedList.some((o: any) => o.title.toLowerCase() === "bug detective")) {
                ownedList = [{ set: "Special", title: "Bug Detective" }, ...ownedList];
              }
            }
            const isLead = isLeadDev(user);
            if (isLead) {
              if (!ownedList.some((o: any) => o.title.toLowerCase().includes("lucifer"))) {
                ownedList = [{ set: "Staff Exclusive", title: "Lucifer,the fallen angel" }, ...ownedList];
              }
            }
            setTitlesOwned(ownedList);
            setTitlesSel(equippedList);
          }
          setTitlesLoaded(true);
        })
        .catch(() => {
          const isRiv = (user?.username || "").toLowerCase() === "riv333";
          const isLead = isLeadDev(user);
          if (isRiv) {
            setTitlesOwned([{ set: "Special", title: "Bug Detective" }]);
          } else if (isLead) {
            setTitlesOwned([{ set: "Staff Exclusive", title: "Lucifer,the fallen angel" }]);
          }
          setTitlesLoaded(true);
        });
    }
  };

  const toggleTitle = (t: string) =>
    setTitlesSel(p => (p.includes(t) ? p.filter(x => x !== t) : p.length < MAX_WORN_TITLES ? [...p, t] : p));

  const removeTitle = async () => {
    setSavingTitles(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const r = await fetch(`${API_URL}/api/cards/titles`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user?.id, titles: [] }),
      });
      const d = await r.json();
      if (d?.success) {
        setTitlesSel([]);
        onUpdate?.({ equippedTitles: [], cardTitle: null });
        toast("Title removed.", "success");
        setShowTitlePicker(false);
      } else {
        toast(d?.message || "Couldn't remove title.", "error");
      }
    } catch {
      toast("Couldn't remove title.", "error");
    } finally {
      setSavingTitles(false);
    }
  };

  const saveTitles = async () => {
    setSavingTitles(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const r = await fetch(`${API_URL}/api/cards/titles`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user?.id, titles: titlesSel }),
      });
      const d = await r.json();
      if (d?.success) {
        onUpdate?.({ equippedTitles: d.data.equipped || [], cardTitle: (d.data.equipped || [])[0] || null });
        toast(titlesSel.length > 0 ? "Titles updated." : "Title removed.", "success");
        setShowTitlePicker(false);
      } else {
        toast(d?.message || "Couldn't save titles.", "error");
      }
    } catch {
      toast("Couldn't save titles.", "error");
    } finally {
      setSavingTitles(false);
    }
  };

  const saveBannerStyle = (style: string) => {
    setBannerStyle(style);
    updateProfile({ bannerStyle: style } as any);
    if (onUpdate) onUpdate({ bannerStyle: style });
  };

  const handleSaveSong = async () => {
    const check = validateProfileAudio(profileSong);
    if (!check.ok) return toast(check.message, "error");
    setSavingSong(true);
    try {
      const result: any = await updateProfile({ profileSong: check.value } as any);
      if (result && result.success === false) {
        toast(result.message || "Couldn't save your audio.", "error");
        return;
      }
      onUpdate?.({ profileSong: check.value });
      toast("Profile audio saved — it plays on your profile now.", "success");
    } finally {
      setSavingSong(false);
    }
  };

  const handleRemoveSong = async () => {
    setSavingSong(true);
    try {
      const result: any = await updateProfile({ profileSong: "" } as any);
      if (result && result.success === false) {
        toast(result.message || "Couldn't remove your audio.", "error");
        return;
      }
      setProfileSong("");
      onUpdate?.({ profileSong: null });
      toast("Profile audio removed.", "success");
    } finally {
      setSavingSong(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const payload: any = { isPrivate, bio };
      if (updateProfile) {
        const result: any = await updateProfile(payload);
        if (result && result.success === false) {
          toast(result.message || "Error saving profile", "error");
          return;
        }
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

  const handleWipe = async () => {
    setIsSaving(true);
    setShowWipeConfirm(false);
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
      return toast("Missing Cloudinary configuration in .env.local", "error");
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

    if (isBanner) {
      handleImageUpload(file, true, isGif);
      return;
    }

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

  const tabs = [
    { key: "profile", label: "Profile", Icon: UserIcon },
    { key: "account", label: "Account", Icon: ShieldCheck },
    { key: "preferences", label: "Preferences", Icon: SlidersHorizontal },
    { key: "integrations", label: "Integrations", Icon: Database },
  ] as const;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xl"
        >
          {/* Ambient top light */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[450px] bg-[radial-gradient(ellipse_60%_80%_at_50%_-20%,rgba(139,92,246,0.28),transparent_75%)]"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 15 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[#070709] border border-white/10 sm:h-[90vh] sm:rounded-3xl sm:shadow-2xl md:flex-row"
          >
            {/* ══ MOBILE HEADER ══ */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0c0c14] px-4 py-3.5 md:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <span className="font-fell text-lg font-bold uppercase tracking-wider text-white">Settings</span>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ══ DESKTOP SIDEBAR / MOBILE NAV RAIL ══ */}
            <aside className="shrink-0 border-b border-white/10 bg-[#0a0a10]/80 p-2.5 sm:p-3 md:w-60 md:border-b-0 md:border-r md:p-5 flex flex-col justify-between">
              <div>
                <div className="hidden md:flex items-center justify-between mb-6 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/30 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                      <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-fell text-xl font-bold uppercase tracking-wider text-white">Settings</h2>
                      <p className="text-[10px] font-mono text-slate-500">Preferences & Profile</p>
                    </div>
                  </div>
                </div>

                <nav className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 md:flex-col md:overflow-visible md:pb-0">
                  {tabs.map(({ key, label, Icon }) => {
                    const active = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`group relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-mono text-xs font-bold transition-all md:w-full ${
                          active
                            ? "bg-violet-600/20 text-violet-200 border border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                            : "border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${active ? "text-violet-400" : "text-slate-500"}`} />
                        <span className="truncate">{label}</span>
                        {active && (
                          <span className="hidden md:block absolute right-3 h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,1)]" />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* User Quick Info in Sidebar Footer (Desktop) */}
              <div className="hidden md:block pt-4 border-t border-white/10 mt-auto">
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5 border border-white/5">
                  <div className="relative h-9 w-9 shrink-0">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover ring-1 ring-white/20" />
                    ) : (
                      <div className="grid h-full w-full place-items-center rounded-full bg-violet-700 text-xs font-bold text-white">
                        {(user?.username || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                    <AvatarDecoration frame={user?.activeFrame} effect={user?.activeEffect} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{user?.username || "User"}</p>
                    <p className="text-[10px] font-mono text-violet-400">{(user?.arisePoints || 0).toLocaleString()} AP</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Close Button Desktop */}
            <button
              onClick={onClose}
              title="Close Settings (Esc)"
              className="hidden md:flex absolute right-5 top-5 z-30 h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 transition hover:bg-white/15 hover:text-white hover:scale-105"
            >
              <X className="h-4 w-4" />
            </button>

            {/* ══ SCROLLABLE CONTENT BODY ══ */}
            <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-thin scrollbar-thumb-white/10 pb-32 sm:pb-12">
              
              {/* ──────────────── TAB: PROFILE ──────────────── */}
              {activeTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Hero Identity Banner & Avatar Card */}
                  <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] shadow-xl relative">
                    <input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={(e) => handleFileSelect(e, true)} />
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, false)} />

                    {/* Banner Strip */}
                    <div className="relative h-32 sm:h-40 w-full overflow-hidden bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-[#0c0c14]">
                      {user?.bannerUrl ? (
                        <img
                          src={user.bannerUrl}
                          alt="Profile Banner"
                          style={{ objectPosition: `center ${bannerPos}%` }}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-800/30 via-[#0c0c14] to-black" />
                      )}

                      <button
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={uploadingBanner}
                        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs font-mono font-bold text-white border border-white/20 shadow-lg hover:bg-black/80 hover:border-violet-400/50 transition disabled:opacity-50"
                      >
                        {uploadingBanner ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 text-violet-300" />}
                        <span>{uploadingBanner ? "Uploading…" : user?.bannerUrl ? "Change Banner" : "Add Banner"}</span>
                      </button>
                    </div>

                    {/* Avatar & User Details */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 p-4 sm:p-6 -mt-12 sm:-mt-14 relative z-10">
                      <div className="flex items-end gap-3.5 sm:gap-4">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          title="Change Avatar"
                          className="group relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-full border-4 border-[#0c0c14] bg-[#141418] shadow-2xl overflow-hidden disabled:opacity-60"
                        >
                          {user?.avatar ? (
                            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-purple-800 text-2xl sm:text-3xl font-black text-white">
                              {(user?.username || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100 backdrop-blur-xs">
                            {uploadingImage ? <RefreshCw className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                          </div>
                          <AvatarDecoration frame={user?.activeFrame} effect={user?.activeEffect} size="md" />
                        </button>

                        <div className="min-w-0 pb-1">
                          <h3 className="truncate font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
                            {user?.username || "Your Name"}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400">Click avatar or banner above to change imagery.</p>
                        </div>
                      </div>

                      {/* Primary Save Button */}
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 font-mono text-xs font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition hover:brightness-110 hover:scale-[1.02] disabled:opacity-50"
                      >
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span>{isSaving ? "Saving…" : "Save Changes"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner Controls & Styling */}
                  {user?.bannerUrl && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#0c0c14] p-4 sm:p-5">
                      {/* Banner Mode */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Banner Display Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => saveBannerStyle("full")}
                            className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold border transition ${
                              bannerStyle !== "cover"
                                ? "border-violet-400/50 bg-violet-500/20 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                                : "bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            Full Screen
                          </button>
                          <button
                            onClick={() => saveBannerStyle("cover")}
                            className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold border transition ${
                              bannerStyle === "cover"
                                ? "border-violet-400/50 bg-violet-500/20 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                                : "bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            Cover Header
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Full screen fills background; cover header keeps it on top.</p>
                      </div>

                      {/* Reposition Banner Slider */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Banner Vertical Offset</label>
                          <span className="text-[10px] font-mono text-violet-300">{bannerPos}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={bannerPos}
                          onChange={e => setBannerPos(Number(e.target.value))}
                          onMouseUp={() => { updateProfile({ bannerPosition: bannerPos } as any); onUpdate?.({ bannerPosition: bannerPos }); }}
                          onTouchEnd={() => { updateProfile({ bannerPosition: bannerPos } as any); onUpdate?.({ bannerPosition: bannerPos }); }}
                          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                        <p className="text-[10px] text-slate-500 font-mono">Drag slider to center key art in the profile header.</p>
                      </div>
                    </div>
                  )}

                  {/* 2-Column Customization Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                    
                    {/* Left Column: Identity & Badges */}
                    <div className="space-y-4 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] p-4 sm:p-6">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                        <Sparkles className="h-4 w-4 text-violet-400" />
                        <h4 className="font-fell text-base font-bold uppercase tracking-wider text-white">Identity &amp; Titles</h4>
                      </div>

                      {/* Username input */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Username</label>
                        <div className="flex gap-2">
                          <input
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            placeholder={user?.username || "username"}
                            maxLength={20}
                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                          />
                          <button
                            onClick={handleChangeUsername}
                            disabled={isChangingUsername || !newUsername.trim()}
                            className="shrink-0 rounded-xl border border-violet-400/40 bg-violet-500/20 px-4 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-40"
                          >
                            {isChangingUsername ? "…" : "Change"}
                          </button>
                        </div>
                        <p className="text-[10px] font-mono text-slate-500">
                          {usernameIsFree ? "Your first change is free." : `Changing again costs ${USERNAME_COST} AP.`}
                        </p>
                      </div>

                      {/* Avatar Decoration Equipper */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Avatar Decoration</label>
                          <button
                            onClick={() => setShowDecorPicker(v => !v)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            {showDecorPicker ? "Close Picker" : "Select Frame / FX"}
                          </button>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3">
                          <div className="relative h-10 w-10 shrink-0">
                            {user?.avatar ? (
                              <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover ring-1 ring-white/10" />
                            ) : (
                              <div className="grid h-full w-full place-items-center rounded-full bg-violet-700 text-xs font-bold text-white">
                                {(user?.username || "U")[0]?.toUpperCase()}
                              </div>
                            )}
                            <AvatarDecoration frame={user?.activeFrame} effect={user?.activeEffect} size="sm" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-white">{activeDecorLabel}</p>
                            <p className="text-[10px] font-mono text-slate-500">{showDecorPicker ? "Pick item below" : "Equipped cosmetic"}</p>
                          </div>
                        </div>

                        {showDecorPicker && (
                          <div className="space-y-4 rounded-xl border border-white/10 bg-black/60 p-3.5">
                            {/* Frames */}
                            <div>
                              <p className="mb-2 text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">Avatar Frames</p>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                <button
                                  onClick={() => equipDecor({ activeFrame: null })}
                                  disabled={equipping}
                                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition disabled:opacity-50 ${!user?.activeFrame ? "border-violet-400/60 bg-violet-500/15 text-violet-200" : "border-white/10 bg-[#0c0c14] text-slate-400 hover:bg-white/5"}`}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-white/20 text-slate-500">
                                    <X className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="w-full truncate text-center text-[9px] font-mono">None</span>
                                </button>
                                {ownedFrames.map(id => (
                                  <button
                                    key={id}
                                    onClick={() => equipDecor({ activeFrame: id })}
                                    disabled={equipping}
                                    title={decorName(id)}
                                    className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition disabled:opacity-50 ${user?.activeFrame === id ? "border-violet-400/60 bg-violet-500/15 text-violet-200" : "border-white/10 bg-[#0c0c14] text-slate-400 hover:bg-white/5"}`}
                                  >
                                    <div className="relative h-9 w-9">
                                      {user?.avatar ? (
                                        <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                                      ) : (
                                        <div className="grid h-full w-full place-items-center rounded-full bg-violet-700 text-xs font-bold text-white">
                                          {(user?.username || "U")[0]?.toUpperCase()}
                                        </div>
                                      )}
                                      <AvatarDecoration frame={id} size="sm" />
                                    </div>
                                    <span className="w-full truncate text-center text-[9px] font-mono">{decorName(id)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Effects */}
                            <div>
                              <p className="mb-2 text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">Profile Auras &amp; FX</p>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                <button
                                  onClick={() => equipDecor({ activeEffect: null })}
                                  disabled={equipping}
                                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition disabled:opacity-50 ${!user?.activeEffect ? "border-violet-400/60 bg-violet-500/15 text-violet-200" : "border-white/10 bg-[#0c0c14] text-slate-400 hover:bg-white/5"}`}
                                >
                                  <div className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-white/20 text-slate-500">
                                    <X className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="w-full truncate text-center text-[9px] font-mono">None</span>
                                </button>
                                {ownedEffects.map(id => (
                                  <button
                                    key={id}
                                    onClick={() => equipDecor({ activeEffect: id })}
                                    disabled={equipping}
                                    title={decorName(id)}
                                    className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition disabled:opacity-50 ${user?.activeEffect === id ? "border-violet-400/60 bg-violet-500/15 text-violet-200" : "border-white/10 bg-[#0c0c14] text-slate-400 hover:bg-white/5"}`}
                                  >
                                    <div className="relative h-9 w-9">
                                      {user?.avatar ? (
                                        <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                                      ) : (
                                        <div className="grid h-full w-full place-items-center rounded-full bg-violet-700 text-xs font-bold text-white">
                                          {(user?.username || "U")[0]?.toUpperCase()}
                                        </div>
                                      )}
                                      <AvatarDecoration effect={id} size="sm" />
                                    </div>
                                    <span className="w-full truncate text-center text-[9px] font-mono">{decorName(id)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => { onClose(); router.push("/shop"); }}
                              className="w-full rounded-xl border border-violet-400/20 bg-violet-600/10 py-2 font-mono text-[11px] font-bold text-violet-300 transition hover:bg-violet-600/20"
                            >
                              Explore Shop for more FX →
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Title Selector */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Card Titles</label>
                          <div className="flex items-center gap-2">
                            {currentTitle !== "None" && (
                              <button
                                onClick={removeTitle}
                                disabled={savingTitles}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-mono font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                              >
                                Remove
                              </button>
                            )}
                            <button
                              onClick={toggleTitlePicker}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono font-bold text-slate-200 transition hover:bg-white/10"
                            >
                              {showTitlePicker ? "Close" : "Change Titles"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                          <p className="text-[10px] font-mono text-slate-500">Current Equipped Title:</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {currentTitle.toLowerCase() === "bug detective" ? (
                              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 border border-pink-400/40 bg-pink-950/30 text-pink-100 shadow-[0_0_12px_rgba(244,63,94,0.25)]">
                                <img src="/icons/bug-detective.png" alt="Bug Detective" className="h-5 w-5 object-contain shrink-0" />
                                <img src="/titles/bug-detective-wordmark.png" alt="Bug Detective" className="h-4 object-contain" />
                              </span>
                            ) : currentTitle.toLowerCase().includes("lucifer") || currentTitle.toLowerCase().includes("fallen angel") ? (
                              <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 border border-purple-400/60 bg-purple-950/40 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.35)]">
                                <img src="/icons/lucifer-gojo.png" alt="Lucifer" className="h-5 w-5 object-contain shrink-0" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] font-black font-mono text-xs tracking-wider uppercase">
                                  Lucifer,the fallen angel
                                </span>
                              </span>
                            ) : (
                              <span className="font-mono text-xs font-bold text-amber-200">{currentTitle}</span>
                            )}
                          </div>
                          {wornTitles.length > 1 && (
                            <p className="mt-1 text-[10px] font-mono text-slate-500">+{wornTitles.length - 1} more worn in badges</p>
                          )}
                        </div>

                        {showTitlePicker && (
                          <div className="space-y-3 rounded-xl border border-white/10 bg-black/60 p-3.5">
                            {!titlesLoaded ? (
                              <p className="text-[11px] font-mono text-slate-500">Loading your titles…</p>
                            ) : titlesOwned.length === 0 ? (
                              <p className="text-[11px] font-mono text-slate-500">Complete card sets to earn titles.</p>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
                                    Pick up to {MAX_WORN_TITLES}
                                  </p>
                                  {titlesSel.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setTitlesSel([])}
                                      className="text-[10px] font-mono font-bold text-red-400 hover:text-red-300"
                                    >
                                      Clear All
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {titlesOwned.map(({ set, title }) => {
                                    const at = titlesSel.indexOf(title);
                                    const on = at >= 0;
                                    const isBugDetective = title.toLowerCase() === "bug detective";
                                    const isLucifer = title.toLowerCase().includes("lucifer") || title.toLowerCase().includes("fallen angel");
                                    return (
                                      <button
                                        key={title}
                                        onClick={() => toggleTitle(title)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-mono font-bold uppercase transition ${
                                          on
                                            ? isBugDetective
                                              ? "border-pink-400/50 bg-pink-950/40 text-pink-200 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                                              : isLucifer
                                              ? "border-purple-400/60 bg-purple-950/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                                              : at === 0
                                              ? "border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                                              : "border-violet-400/50 bg-violet-500/20 text-violet-200"
                                            : "border-white/10 bg-[#0c0c14] text-slate-400 hover:bg-white/5"
                                        }`}
                                      >
                                        {on && <span className="font-mono text-[9px] text-white/80">{at + 1}</span>}
                                        {isBugDetective ? (
                                          <span className="inline-flex items-center gap-1.5">
                                            <img src="/icons/bug-detective.png" alt="Bug" className="h-4 w-4 object-contain" />
                                            <span>Bug Detective</span>
                                          </span>
                                        ) : isLucifer ? (
                                          <span className="inline-flex items-center gap-1.5">
                                            <img src="/icons/lucifer-gojo.png" alt="Lucifer" className="h-4 w-4 object-contain" />
                                            <span>Lucifer,the fallen angel</span>
                                          </span>
                                        ) : (
                                          title
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={saveTitles}
                                    disabled={savingTitles}
                                    className="flex-1 rounded-xl border border-violet-400/30 bg-violet-500/20 py-2 font-mono text-xs font-bold text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-40"
                                  >
                                    {savingTitles ? "Saving…" : "Save Titles"}
                                  </button>
                                  <button
                                    onClick={() => setShowTitlePicker(false)}
                                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Staff Role Options */}
                      {isLeadDev(user) && (
                        <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/20 p-3">
                          <div className="flex items-center gap-2.5">
                            <img src="/icons/lucifer-gojo.png" alt="Lucifer" className="h-6 w-6 object-contain" />
                            <div>
                              <p className="text-xs font-bold text-white">Lead Dev Title</p>
                              <p className="text-[10px] font-mono text-purple-300/80">Display Lucifer on badge &amp; comments</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const nextState = !(user as any)?.hideLeadRole;
                              await updateProfile({ hideLeadRole: nextState } as any);
                              onUpdate?.({ hideLeadRole: nextState });
                              toast(nextState ? "Lead Dev title hidden." : "Lead Dev title enabled.", "success");
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                              !(user as any)?.hideLeadRole ? "bg-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "bg-white/10"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                !(user as any)?.hideLeadRole ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* Privacy Switch */}
                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3">
                        <div className="flex items-center gap-2.5">
                          {isPrivate ? <Lock className="h-4 w-4 text-amber-400" /> : <Unlock className="h-4 w-4 text-emerald-400" />}
                          <div>
                            <p className="text-xs font-bold text-white">Private Profile</p>
                            <p className="text-[10px] font-mono text-slate-500">Hide watchlist and profile details from public</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsPrivate(!isPrivate)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            isPrivate ? "bg-violet-600 shadow-[0_0_10px_rgba(139,92,246,0.5)]" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              isPrivate ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Bio & Profile Audio */}
                    <div className="space-y-4">
                      
                      {/* Bio Card */}
                      <div className="flex flex-col space-y-2 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] p-4 sm:p-6">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <h4 className="font-fell text-base font-bold uppercase tracking-wider text-white">About &amp; Bio</h4>
                          <span className="text-[10px] font-mono text-slate-500">{bio.length} characters</span>
                        </div>
                        <textarea
                          value={bio}
                          onChange={e => setBio(e.target.value)}
                          placeholder="Write a custom bio, favorite quotes, or paste direct image links (.gif, .png, .jpg)..."
                          rows={6}
                          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3.5 font-sans text-xs sm:text-sm leading-relaxed text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                        />
                        <p className="text-[10px] font-mono text-slate-500">
                          Direct image links on a new line will automatically embed as artwork on your profile.
                        </p>
                      </div>

                      {/* Profile Audio Player Card */}
                      <div className="space-y-3 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] p-4 sm:p-6">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-violet-400" />
                            <h4 className="font-fell text-base font-bold uppercase tracking-wider text-white">Profile Soundtrack</h4>
                          </div>
                          <span className="text-[10px] font-mono text-violet-400">catbox.moe</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400">
                          Paste a direct audio link from <strong className="text-white">files.catbox.moe</strong> (mp3, ogg, wav, m4a, flac).
                        </p>
                        <input
                          value={profileSong}
                          onChange={e => setProfileSong(e.target.value)}
                          placeholder="https://files.catbox.moe/abc123.mp3"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                        />
                        {profileSong.trim() !== "" && (
                          songCheck.ok ? (
                            <audio controls preload="none" src={songCheck.value} className="w-full mt-2 h-8" />
                          ) : (
                            <p className="text-[10px] font-mono text-red-400">{songCheck.message}</p>
                          )
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSaveSong}
                            disabled={savingSong}
                            className="flex-1 rounded-xl border border-violet-400/40 bg-violet-500/20 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-40"
                          >
                            {savingSong ? "Saving…" : "Save Audio"}
                          </button>
                          {user?.profileSong && (
                            <button
                              onClick={handleRemoveSong}
                              disabled={savingSong}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-xs font-bold text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────── TAB: ACCOUNT ──────────────── */}
              {activeTab === 'account' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Change Password Card */}
                  <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] p-5 sm:p-7 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
                      <Key className="h-5 w-5 text-violet-400" />
                      <div>
                        <h4 className="font-fell text-lg font-bold uppercase tracking-wider text-white">Change Password</h4>
                        <p className="text-[11px] font-mono text-slate-500">Update your account login security</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Current Password</label>
                        <div className="relative mt-1">
                          <input
                            type={showCurrentPass ? "text" : "password"}
                            placeholder="Enter current password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                          >
                            {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">New Password</label>
                          <div className="relative mt-1">
                            <input
                              type={showNewPass ? "text" : "password"}
                              placeholder="At least 6 characters"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPass(!showNewPass)}
                              className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                            >
                              {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Confirm Password</label>
                          <input
                            type={showNewPass ? "text" : "password"}
                            placeholder="Re-enter new password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-600 to-purple-600 py-3 font-mono text-xs font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
                    >
                      {isChangingPassword ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                      <span>{isChangingPassword ? "Updating Password…" : "Update Password"}</span>
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="rounded-2xl sm:rounded-3xl border border-red-500/30 bg-red-950/15 p-5 sm:p-7 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2.5 border-b border-red-500/20 pb-3">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <div>
                        <h4 className="font-fell text-lg font-bold uppercase tracking-wider text-red-400">Danger Zone</h4>
                        <p className="text-[11px] font-mono text-red-300/70">Irreversible actions on your library</p>
                      </div>
                    </div>
                    <p className="text-xs font-mono leading-relaxed text-red-200/80">
                      Wiping your watchlist will permanently delete all tracked anime entries, scores, and watching history. This action cannot be reversed.
                    </p>
                    <button
                      onClick={() => setShowWipeConfirm(true)}
                      disabled={isSaving}
                      className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-600/20 px-5 py-2.5 font-mono text-xs font-bold text-red-300 transition hover:bg-red-600/30 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Wipe Watchlist Data</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ──────────────── TAB: PREFERENCES ──────────────── */}
              {activeTab === 'preferences' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] divide-y divide-white/5 overflow-hidden shadow-xl">
                    
                    {/* Theme Mode */}
                    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
                          {theme === 'dark' ? <Zap className="h-5 w-5" /> : <Moon className="h-5 w-5 text-slate-400" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">App Atmosphere</h4>
                          <p className="text-[11px] font-mono text-slate-500">Toggle Neon Violet / Obsidian Black mode</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className="rounded-xl border border-violet-400/30 bg-violet-500/15 px-3.5 py-2 font-mono text-xs font-bold text-violet-200 transition hover:bg-violet-500/25"
                      >
                        {theme === 'dark' ? 'Neon Purple' : 'Pure Black'}
                      </button>
                    </div>

                    {/* Cinematic Autoplay */}
                    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400">
                          <PlayCircle className={`h-5 w-5 ${preferences.autoplayTrailers ? 'text-violet-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Cinematic Autoplay</h4>
                          <p className="text-[11px] font-mono text-slate-500">Auto-play background video trailers on anime pages</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updatePreference('autoplayTrailers', !preferences.autoplayTrailers)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          preferences.autoplayTrailers ? "bg-violet-600 shadow-[0_0_12px_rgba(139,92,246,0.5)]" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.autoplayTrailers ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Safe Browsing */}
                    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400">
                          <EyeOff className={`h-5 w-5 ${preferences.blurSensitiveContent ? 'text-red-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Safe Browsing</h4>
                          <p className="text-[11px] font-mono text-slate-500">Blur mature covers and 18+ content</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updatePreference('blurSensitiveContent', !preferences.blurSensitiveContent)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          preferences.blurSensitiveContent ? "bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.5)]" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.blurSensitiveContent ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Performance Mode */}
                    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400">
                          <Zap className={`h-5 w-5 ${preferences.reducedMotion ? 'text-amber-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Performance Mode</h4>
                          <p className="text-[11px] font-mono text-slate-500">Disables 3D canvas particles &amp; heavy animations</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updatePreference('reducedMotion', !preferences.reducedMotion)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          preferences.reducedMotion ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.reducedMotion ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Data Saver */}
                    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400">
                          <Wifi className={`h-5 w-5 ${preferences.dataSaver ? 'text-emerald-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Data Saver</h4>
                          <p className="text-[11px] font-mono text-slate-500">Skip loading high-res banners and trailers</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updatePreference('dataSaver', !preferences.dataSaver)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          preferences.dataSaver ? "bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.dataSaver ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* ──────────────── TAB: INTEGRATIONS ──────────────── */}
              {activeTab === 'integrations' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0c14] p-5 sm:p-7 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
                      <Database className="h-6 w-6 text-blue-400" />
                      <div>
                        <h4 className="font-fell text-lg font-bold uppercase tracking-wider text-white">External Sync</h4>
                        <p className="text-[11px] font-mono text-slate-500">MyAnimeList &amp; AniList import integrations</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>Public API Status</span>
                      </div>
                      <p className="mt-1 text-xs text-amber-200/80 leading-relaxed font-mono">
                        MyAnimeList retired its public XML feed. Official OAuth 2.0 automatic account sync is scheduled for the next major release.
                      </p>
                    </div>
                  </div>
                </div>
              )}


            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Wipe Watchlist Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-[#0c0c14] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-6 w-6" />
              <h4 className="font-fell text-lg font-bold uppercase tracking-wider">Confirm Library Wipe</h4>
            </div>
            <p className="text-xs font-mono leading-relaxed text-slate-300">
              Are you sure you want to completely wipe your Da Vinci watchlist? All your tracked anime, scores, and progress will be permanently erased.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleWipe}
                className="flex-1 rounded-xl border border-red-500/50 bg-red-600/30 py-2.5 font-mono text-xs font-bold text-red-200 transition hover:bg-red-600/50"
              >
                Yes, Wipe Everything
              </button>
              <button
                onClick={() => setShowWipeConfirm(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
