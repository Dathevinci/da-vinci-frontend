"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Moon, Sun, Lock, Unlock, Save, PlayCircle, EyeOff, Zap, Wifi, Key, User as UserIcon, Link as LinkIcon, Image as ImageIcon, Copy, Camera, UploadCloud, AlertCircle, RefreshCw, Database, Trash2, ShieldCheck, SlidersHorizontal, Music } from "lucide-react";
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

  // Profile audio — one track that plays on the profile. Saved on its own
  // (like the banner style) so it's independent of the Save Profile button.
  const [profileSong, setProfileSong] = useState<string>(user?.profileSong || "");
  const [savingSong, setSavingSong] = useState(false);
  const songCheck = validateProfileAudio(profileSong);

  // ── Decoration & Title pickers — equip IN settings, like the reference.
  // The server stays the authority: non-staff equips of unowned items are
  // silently dropped there, and titles are re-derived from claimedSets.
  const router = useRouter();
  const staffUser = isAdmin(user) || isLeadDev(user);
  const ownedFrames: string[] = staffUser ? ALL_FRAME_IDS : (user?.purchasedFrames || []);
  const ownedEffects: string[] = staffUser ? ALL_EFFECT_IDS : (user?.purchasedEffects || []);
  const activeDecorLabel =
    [user?.activeFrame ? decorName(user.activeFrame) : null, user?.activeEffect ? decorName(user.activeEffect) : null]
      .filter(Boolean).join("  ·  ") || "None";
  const [showDecorPicker, setShowDecorPicker] = useState(false);
  const [equipping, setEquipping] = useState(false);

  const wornTitles: string[] = (user as any)?.equippedTitles || [];
  const currentTitle = wornTitles[0] || (user as any)?.cardTitle || "None";
  const MAX_WORN_TITLES = 3;
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [titlesOwned, setTitlesOwned] = useState<{ set: string; title: string }[]>([]);
  const [titlesSel, setTitlesSel] = useState<string[]>([]);
  const [titlesLoaded, setTitlesLoaded] = useState(false);
  const [savingTitles, setSavingTitles] = useState(false);

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
              if (equippedList.length === 0 || !equippedList.some((t: string) => t.toLowerCase() === "bug detective")) {
                equippedList = ["Bug Detective", ...equippedList].slice(0, MAX_WORN_TITLES);
              }
            }
            setTitlesOwned(ownedList);
            setTitlesSel(equippedList);
          }
          setTitlesLoaded(true);
        })
        .catch(() => {
          const isRiv = (user?.username || "").toLowerCase() === "riv333";
          if (isRiv) {
            setTitlesOwned([{ set: "Special", title: "Bug Detective" }]);
            setTitlesSel(["Bug Detective"]);
          }
          setTitlesLoaded(true);
        });
    }
  };

  const toggleTitle = (t: string) =>
    setTitlesSel(p => (p.includes(t) ? p.filter(x => x !== t) : p.length < MAX_WORN_TITLES ? [...p, t] : p));

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
        onUpdate?.({ equippedTitles: d.data.equipped || [] });
        toast("Titles updated.", "success");
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
      // Prefer the signed token (verified server-side); fall back to the raw id
      // for pre-JWT sessions. The invite routes accept either.
      const token = localStorage.getItem("davinci_token");
      const res = await fetch(`${API_URL}/api/invites`, {
        headers: { Authorization: `Bearer ${token || user?.id}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvites(data.data);
      } else {
        toast(data.message || "Couldn't load your invite keys.", "error");
      }
    } catch (err) {
      console.error("Failed to fetch invites", err);
      toast("Couldn't load your invite keys.", "error");
    }
  };

  const generateInvite = async () => {
    setIsGeneratingInvite(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = localStorage.getItem("davinci_token");
      const res = await fetch(`${API_URL}/api/invites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || user?.id}` }
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
      const token = localStorage.getItem("davinci_token");
      const res = await fetch(`${API_URL}/api/invites/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || user?.id}` },
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
          // The modal renders from the initialUser prop, so patch the parent too
          // or the "you have N AP" line keeps showing the pre-purchase balance.
          onUpdate?.({ arisePoints: data.arisePoints });
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
        const result: any = await updateProfile(payload);
        // it resolves with { success: false } rather than throwing
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

  const handleMALSync = async () => {
    if (!anilistUsername) return toast("Please enter a MyAnimeList username.", "error");
    try {
      const entries = await fetchUserMAL(anilistUsername);
      if (!entries || entries.length === 0) throw new Error("Could not fetch data for this user or list is empty.");
      
      const entriesToSync = entries
        .filter((entry: any) => entry.anime)
        .map((entry: any) => ({ anime: entry.anime, status: "Watching" as AnimeUserStatus }));

      if (entriesToSync.length === 0) {
         toast("No entries found to import.", "error");
         return;
      }

      await batchSetStatus(entriesToSync);
      toast(`Successfully imported ${entriesToSync.length} anime!`, "success");
    } catch (e: any) {
      toast(e.message || "Failed to sync MAL", "error");
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
          className="fixed inset-0 z-[100] bg-[#070709]"
        >
          {/* The Lunar top glow — same radial as the hub and updates pages. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]"
          />
          {/* Full-screen, page-like — the reference's edit view, not a dialog. */}
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 12 }}
            onClick={e => e.stopPropagation()}
            className="relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden md:flex-row"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-20 rounded-full bg-white/5 p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ── Sidebar nav — five cramped pills on one scrolling row made it
                   easy to miss whole sections; icons + labels down the side are
                   scannable. Collapses to a horizontal rail on mobile. ── */}
            <aside className="shrink-0 border-b border-white/10 bg-white/[0.02] p-4 md:w-56 md:border-b-0 md:border-r md:p-5">
              <h2 className="mb-4 pr-10 font-fell text-2xl text-white md:mb-5">Settings</h2>
              <nav className="flex gap-1.5 overflow-x-auto scrollbar-none md:flex-col md:overflow-visible">
                {([
                  { key: "profile", label: "Profile", Icon: UserIcon },
                  { key: "account", label: "Account", Icon: ShieldCheck },
                  { key: "preferences", label: "Preferences", Icon: SlidersHorizontal },
                  { key: "integrations", label: "Integrations", Icon: Database },
                  { key: "invites", label: "Invite Keys", Icon: Key },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border px-3.5 py-2.5 font-mono text-xs font-bold transition-colors md:w-full ${
                      activeTab === key
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                        : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Scrollable Content Area */}
            <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 sm:p-6">
              
              {activeTab === 'profile' && (
                <div className="space-y-5 font-mono animate-in fade-in slide-in-from-bottom-2">
                  {!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 p-4 rounded-xl mb-4 flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 flex-shrink-0" />
                      <p className="text-sm">
                        <strong>Missing Cloudinary Config:</strong> To upload avatars, you must add <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> to your .env.local file!
                      </p>
                    </div>
                  )}

                  {/* Live previews — the old dashed boxes never showed what you
                      currently HAVE, so you couldn't tell if an upload landed. */}
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11]">
                    <input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={(e) => handleFileSelect(e, true)} />
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, false)} />

                    <button
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploadingBanner}
                      title="Change banner"
                      className="group relative block h-28 w-full overflow-hidden disabled:opacity-60"
                    >
                      {user?.bannerUrl ? (
                        <img
                          src={user.bannerUrl}
                          alt=""
                          style={{ objectPosition: `center ${bannerPos}%` }}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-violet-600/40 to-fuchsia-600/25" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100">
                        {uploadingBanner ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                        {uploadingBanner ? "Uploading…" : user?.bannerUrl ? "Change banner" : "Add a banner"}
                      </div>
                    </button>

                    <div className="flex items-end gap-4 px-4 pb-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        title="Change avatar"
                        className="group relative -mt-9 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-[#0b0b11] bg-[#141418] disabled:opacity-60"
                      >
                        {user?.avatar ? (
                          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600 text-2xl font-black text-white">
                            {(user?.username || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition group-hover:opacity-100">
                          {uploadingImage ? <RefreshCw className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                        </div>
                      </button>
                      <div className="min-w-0 pb-1">
                        <p className="truncate text-sm font-bold text-white">{user?.username || "your name"}</p>
                        <p className="text-xs text-slate-500">Click the avatar or banner to change it.</p>
                      </div>
                    </div>
                  </div>

                  {user?.bannerUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Banner Style</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveBannerStyle("full")}
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm border transition ${bannerStyle !== "cover" ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          Full screen
                        </button>
                        <button
                          onClick={() => saveBannerStyle("cover")}
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm border transition ${bannerStyle === "cover" ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
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
                        onKeyUp={() => { updateProfile({ bannerPosition: bannerPos } as any); onUpdate?.({ bannerPosition: bannerPos }); }}
                        onBlur={() => { updateProfile({ bannerPosition: bannerPos } as any); onUpdate?.({ bannerPosition: bannerPos }); }}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                      <p className="text-xs text-slate-500">Drag to choose which part of the banner shows in the cover.</p>
                    </div>
                  )}

                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Edit Profile — identity, plus who can see the profile */}
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
                      <h3 className="text-base font-bold text-white">Edit Profile</h3>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Username</label>
                        <div className="flex gap-2">
                          <input
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            placeholder={user?.username || "username"}
                            maxLength={20}
                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                          />
                          <button
                            onClick={handleChangeUsername}
                            disabled={isChangingUsername || !newUsername.trim()}
                            className="shrink-0 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40"
                          >
                            {isChangingUsername ? "…" : "Save"}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {usernameIsFree ? "Your first change is free." : `Changing again costs ${USERNAME_COST} AP.`}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Decoration</label>
                          <button
                            onClick={() => setShowDecorPicker(v => !v)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            {showDecorPicker ? "Close" : "Change Decoration"}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="relative h-11 w-11 shrink-0">
                            {user?.avatar ? (
                              <img src={user.avatar} alt="" className="relative z-10 h-full w-full rounded-full object-cover" />
                            ) : (
                              <div className="relative z-10 grid h-full w-full place-items-center rounded-full bg-violet-600 text-sm font-black text-white">
                                {(user?.username || "U").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <AvatarDecoration frame={user?.activeFrame} effect={user?.activeEffect} size="sm" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-white">Current: {activeDecorLabel}</p>
                            <p className="text-[11px] text-slate-500">{showDecorPicker ? "Tap one below to wear it." : "Click the button to change."}</p>
                          </div>
                        </div>

                        {showDecorPicker && (
                          <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Frames</p>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                <button
                                  onClick={() => equipDecor({ activeFrame: null })}
                                  disabled={equipping}
                                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition disabled:opacity-50 ${!user?.activeFrame ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-[#0b0b11] hover:bg-white/[0.07]"}`}
                                >
                                  <div className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-white/20 text-slate-500">
                                    <X className="h-4 w-4" />
                                  </div>
                                  <span className="w-full truncate text-center text-[10px] text-slate-300">None</span>
                                </button>
                                {ownedFrames.map(id => (
                                  <button
                                    key={id}
                                    onClick={() => equipDecor({ activeFrame: id })}
                                    disabled={equipping}
                                    title={decorName(id)}
                                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition disabled:opacity-50 ${user?.activeFrame === id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-[#0b0b11] hover:bg-white/[0.07]"}`}
                                  >
                                    <div className="relative h-11 w-11">
                                      {user?.avatar ? (
                                        <img src={user.avatar} alt="" className="relative z-10 h-full w-full rounded-full object-cover" />
                                      ) : (
                                        <div className="relative z-10 grid h-full w-full place-items-center rounded-full bg-violet-600 text-sm font-black text-white">
                                          {(user?.username || "U").charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <AvatarDecoration frame={id} size="sm" />
                                    </div>
                                    <span className="w-full truncate text-center text-[10px] text-slate-300">{decorName(id)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Profile Effects</p>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                <button
                                  onClick={() => equipDecor({ activeEffect: null })}
                                  disabled={equipping}
                                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition disabled:opacity-50 ${!user?.activeEffect ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-[#0b0b11] hover:bg-white/[0.07]"}`}
                                >
                                  <div className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-white/20 text-slate-500">
                                    <X className="h-4 w-4" />
                                  </div>
                                  <span className="w-full truncate text-center text-[10px] text-slate-300">None</span>
                                </button>
                                {ownedEffects.map(id => (
                                  <button
                                    key={id}
                                    onClick={() => equipDecor({ activeEffect: id })}
                                    disabled={equipping}
                                    title={decorName(id)}
                                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition disabled:opacity-50 ${user?.activeEffect === id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-[#0b0b11] hover:bg-white/[0.07]"}`}
                                  >
                                    <div className="relative h-11 w-11">
                                      {user?.avatar ? (
                                        <img src={user.avatar} alt="" className="relative z-10 h-full w-full rounded-full object-cover" />
                                      ) : (
                                        <div className="relative z-10 grid h-full w-full place-items-center rounded-full bg-violet-600 text-sm font-black text-white">
                                          {(user?.username || "U").charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <AvatarDecoration effect={id} size="sm" />
                                    </div>
                                    <span className="w-full truncate text-center text-[10px] text-slate-300">{decorName(id)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => { onClose(); router.push("/shop"); }}
                              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"
                            >
                              Get more in the Shop →
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Title</label>
                          <button
                            onClick={toggleTitlePicker}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            {showTitlePicker ? "Close" : "Change Title"}
                          </button>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <p className="text-[11px] text-slate-500">Current Title:</p>
                          <div className="truncate text-sm font-bold text-white mt-1">
                            {currentTitle.toLowerCase() === "bug detective" ? (
                              <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 border border-pink-400/60 bg-gradient-to-r from-[#210617] via-[#330925] to-[#1a0413] text-pink-100 shadow-[0_0_18px_rgba(244,63,94,0.35)]">
                                <img src="/icons/bug-detective.png" alt="Bug Detective Icon" className="h-6 w-6 object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                                <img src="/titles/bug-detective-wordmark.png" alt="Bug Detective" className="h-4.5 object-contain drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]" />
                              </span>
                            ) : (
                              currentTitle
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {wornTitles.length > 1 ? `+ ${wornTitles.length - 1} more worn` : "Earned by completing card sets."}
                          </p>
                        </div>

                        {showTitlePicker && (
                          <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                            {!titlesLoaded ? (
                              <p className="text-[11px] text-slate-500">Loading your titles…</p>
                            ) : titlesOwned.length === 0 ? (
                              <p className="text-[11px] text-slate-500">Nothing earned yet — complete a card set to earn its title.</p>
                            ) : (
                              <>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                  Tap up to {MAX_WORN_TITLES} — tap order is wear order
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {titlesOwned.map(({ set, title }) => {
                                    const at = titlesSel.indexOf(title);
                                    const on = at >= 0;
                                    const isBugDetective = title.toLowerCase() === "bug detective";
                                    return (
                                      <button
                                        key={title}
                                        onClick={() => toggleTitle(title)}
                                        title={set ? `From completing ${set}` : "Earned"}
                                        className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                                          on
                                            ? isBugDetective
                                              ? "border-pink-400/70 bg-pink-950/50 text-pink-200 shadow-[0_0_16px_rgba(244,63,94,0.4)]"
                                              : at === 0
                                              ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                                              : "border-violet-400/50 bg-violet-500/10 text-violet-200"
                                            : "border-white/10 bg-[#0b0b11] text-slate-400 hover:bg-white/[0.07]"
                                        }`}
                                      >
                                        {on && <span className="font-mono text-[10px] opacity-80">{at + 1}</span>}
                                        {isBugDetective ? (
                                          <span className="inline-flex items-center gap-2">
                                            <img src="/icons/bug-detective.png" alt="Bug Detective" className="h-5 w-5 object-contain shrink-0" />
                                            <img src="/titles/bug-detective-wordmark.png" alt="Bug Detective" className="h-4 object-contain drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]" />
                                          </span>
                                        ) : (
                                          title
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={saveTitles}
                                    disabled={savingTitles}
                                    className="flex-1 rounded-lg border border-violet-400/30 bg-violet-500/15 py-2 font-mono text-[11px] font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40"
                                  >
                                    {savingTitles ? "Saving…" : "Save Titles"}
                                  </button>
                                  <button
                                    onClick={() => setShowTitlePicker(false)}
                                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {isPrivate ? <Lock className="h-4 w-4 shrink-0 text-red-400" /> : <Unlock className="h-4 w-4 shrink-0 text-green-400" />}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white">Private Profile</p>
                            <p className="text-[11px] text-slate-500">Hide bio, banner &amp; watchlist from non-mutuals.</p>
                          </div>
                        </div>
                        <button onClick={() => setIsPrivate(!isPrivate)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? "bg-violet-500" : "bg-white/10"}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPrivate ? "translate-x-5" : "translate-x-1"}`} />
                        </button>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40"
                        >
                          <Save className="h-4 w-4" />
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={onClose}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    {/* Bio — a column of its own, mirroring the reference */}
                    <div className="flex flex-col space-y-2 rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
                      <h3 className="text-base font-bold text-white">Bio</h3>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        placeholder="Tell us about yourself…"
                        className="min-h-[160px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                      />
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Paste a direct image link (gif, png, jpg, webp) on its own line to embed it. Saved with the Save button on the left.
                      </p>
                    </div>
                  </div>

                  {/* ── Profile Audio — one track that plays on your profile.
                         Audio only; the server re-checks the host and format. ── */}
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b11] p-5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-violet-300">
                        <Music className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Profile Audio</h3>
                        <p className="text-[11px] text-slate-500">One track that plays on your profile.</p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Upload your track to <span className="text-slate-300">catbox.moe</span> and paste the direct
                      {" "}<span className="text-slate-300">files.catbox.moe</span> link. Formats: mp3, wav, ogg, m4a, flac, opus.
                    </p>
                    <input
                      value={profileSong}
                      onChange={e => setProfileSong(e.target.value)}
                      placeholder="https://files.catbox.moe/abc.mp3"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                    />
                    {profileSong.trim() !== "" && (
                      songCheck.ok ? (
                        <audio controls preload="none" src={songCheck.value} className="w-full" />
                      ) : (
                        <p className="text-[11px] text-red-400">{songCheck.message}</p>
                      )
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSong}
                        disabled={savingSong}
                        className="flex-1 rounded-xl border border-violet-400/30 bg-violet-500/15 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40"
                      >
                        {savingSong ? "Saving…" : "Save Audio"}
                      </button>
                      <button
                        onClick={handleRemoveSong}
                        disabled={savingSong || !user?.profileSong}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {/* Change Username — first change free, then costs Arise Points */}
                  <div className="bg-[#0b0b11] border border-white/10 p-6 rounded-2xl space-y-3">
                    <h3 className="font-bold flex items-center gap-2 text-white"><UserIcon className="w-5 h-5 text-violet-400" /> Change Username</h3>
                    <p className="text-sm text-slate-400">
                      {usernameIsFree
                        ? "Your first username change is free."
                        : <>Changing again costs <span className="font-bold text-violet-300">{USERNAME_COST} Arise Points</span> — you have <span className="font-semibold text-white">{(user?.arisePoints || 0).toLocaleString()}</span>.</>}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder={user?.username || "New username"}
                        maxLength={20}
                        className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-400/50"
                      />
                      <button
                        onClick={handleChangeUsername}
                        disabled={isChangingUsername || !newUsername.trim()}
                        className="rounded-xl border border-violet-400/30 bg-violet-500/15 px-6 py-3 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40 whitespace-nowrap"
                      >
                        {isChangingUsername ? "Saving…" : usernameIsFree ? "Change · Free" : `Change · ${USERNAME_COST} AP`}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">3–20 characters — letters, numbers, or underscores.</p>
                  </div>

                  <div className="bg-[#0b0b11] border border-white/10 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-white"><Key className="w-5 h-5 text-violet-400" /> Change Password</h3>
                    <input type="password" placeholder="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-400/50" />
                    <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-400/50" />
                    <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-400/50" />
                    <button onClick={handleChangePassword} disabled={isChangingPassword} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-6 py-2.5 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40">
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
                  <div className="bg-[#0b0b11] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    <div className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          {theme === 'dark' ? <Zap className="w-4 h-4 text-violet-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
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
                          <PlayCircle className={`w-4 h-4 ${preferences.autoplayTrailers ? 'text-violet-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Cinematic Autoplay</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Auto-play the background trailer on anime pages.</p>
                        </div>
                      </div>
                      <button onClick={() => updatePreference('autoplayTrailers', !preferences.autoplayTrailers)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${preferences.autoplayTrailers ? 'bg-violet-500' : 'bg-white/10'}`}>
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
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Blur mature anime covers.</p>
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
                          <h3 className="font-bold text-white text-sm">Performance Mode</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Turns off profile 3D effects & heavy motion.</p>
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
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">Skip autoplaying trailers to save bandwidth.</p>
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
                  {/* MAL killed the public list feed in May 2022, so this can no
                      longer work for anyone. Say so plainly instead of leaving a
                      button that always fails and reads as the user's fault. */}
                  <div className="rounded-2xl border border-white/10 bg-[#0b0b11] p-6">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="flex items-center gap-2 font-bold text-white">
                        <Database className="h-5 w-5 text-blue-400" /> MyAnimeList Import
                      </h3>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                        Unavailable
                      </span>
                    </div>
                    <p className="mb-4 text-sm leading-relaxed text-slate-400">
                      MyAnimeList shut off the public list feed this used to read, so importing isn&apos;t possible
                      right now. Bringing it back needs an official MAL sign-in flow — it&apos;s on the list.
                    </p>
                    <div className="flex gap-2 opacity-50">
                      <input
                        type="text"
                        disabled
                        placeholder="MAL Username"
                        value={anilistUsername}
                        onChange={e => setAnilistUsername(e.target.value)}
                        className="flex-1 cursor-not-allowed rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white"
                      />
                      <button
                        disabled
                        title="MyAnimeList no longer exposes user lists publicly"
                        className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-xl bg-white/10 px-4 py-2.5 font-bold text-slate-400"
                      >
                        <UploadCloud className="h-4 w-4" /> Sync List
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'invites' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div>
                      <h3 className="font-bold text-violet-300">Invite Keys</h3>
                      <p className="text-xs text-violet-300/70 mt-1">
                        {isAdmin(user) ? "Staff overrides enabled — generate unlimited invite keys." : "Generate your free invite key, or buy more with Arise Points."}
                      </p>
                    </div>
                    <button
                      onClick={generateInvite}
                      disabled={isGeneratingInvite || (!isAdmin(user) && invites.length >= 1)}
                      className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 disabled:opacity-40"
                    >
                      <Key className="w-4 h-4" />
                      {isGeneratingInvite ? "Generating..." : "Generate Key"}
                    </button>
                  </div>

                  {!isAdmin(user) && (
                    <div className="bg-[#0b0b11] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                      <div>
                        <h3 className="font-bold text-white">Buy an Extra Invite</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Costs <span className="text-violet-300 font-bold">{INVITE_COST.toLocaleString()} AP</span> — you have <span className="text-white font-semibold">{(user?.arisePoints || 0).toLocaleString()}</span>.
                        </p>
                      </div>
                      <button
                        onClick={buyInvite}
                        disabled={buyingInvite || (user?.arisePoints || 0) < INVITE_COST}
                        className="bg-white/10 hover:bg-white/20 border border-violet-500/40 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap"
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
                        <div key={invite.id} className="bg-[#0b0b11] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="font-mono font-bold text-emerald-400 tracking-wider text-lg">{invite.code}</p>
                            <p className="text-xs text-slate-500 mt-1">{invite.isUsed ? `Used by ${invite.usedByUser?.username || 'Unknown'}` : 'Unused'}</p>
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
