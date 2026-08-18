"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Star,
  TrendingUp,
  Compass,
  Settings,
  Check,
  X,
  Shield,
  Users,
  Zap,
  User as UserIcon,
  Code2,
  Sparkles,
  Crown,
  Feather,
  Flame,
  Leaf,
  UserPlus,
  UserMinus,
  Eye,
  Heart,
  ListFilter,
  ChevronDown,
  Maximize2,
  Tv,
  BookMarked,
  BookOpen,
  Award,
  Layers,
  Activity,
} from "lucide-react";
import BioRenderer from "@/components/profile/BioRenderer";
import { parseBio } from "@/lib/bioUtils";
import { useUser, User } from "@/hooks/useUser";
import FollowListModal from "@/components/profile/FollowListModal";
import ImagePreviewModal from "@/components/ui/ImagePreviewModal";
import ArisePointHistoryModal from "@/components/profile/ArisePointHistoryModal";
import UnlimitedVoid from "@/components/ui/UnlimitedVoid";
import SettingsModal from "@/components/profile/SettingsModal";
import LevelBadge from "@/components/profile/LevelBadge";
import { AvatarDecoration, hasFrameRing } from "@/components/profile/AvatarDecoration";
import ProfileSong from "@/components/profile/ProfileSong";
import { cloudinaryFit } from "@/lib/cloudinary";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import ProfileShowcase from "@/components/profile/ProfileShowcase";
import {
  calculateLevel,
  calculateProgressPercent,
  xpIntoLevel,
  xpToNextLevel,
  levelCost,
  MAX_LEVEL,
  MAX_LEVEL_XP,
} from "@/lib/levels";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { nameColorClass } from "@/lib/cosmetics";
import { resolveActiveEffect } from "@/components/profile/CrimsonRealm";
import { motion, AnimatePresence } from "framer-motion";
import { getRankTheme } from "@/lib/ranks";
import { getHeartRank, heartRankTooltip, isHeartRankName } from "@/lib/heartRanks";
import { manhwaCoverSrc } from "@/lib/manhwa/coverProxy";
import { effectNameClass } from "@/lib/effectTheme";
import { usePreferences } from "@/hooks/usePreferences";
import {
  Code2 as IconCode2,
  ShieldAlert,
  Sparkles as IconSparkles,
  Crown as IconCrown,
  Flame as IconFlame,
  Zap as IconZap,
  Compass as IconCompass,
  Leaf as IconLeaf,
  ArrowUpRight,
  Feather as IconFeather,
  Eye as IconEye,
} from "lucide-react";
const ICON_MAP: Record<string, any> = {
  Code2: IconCode2,
  ShieldAlert,
  Sparkles: IconSparkles,
  Crown: IconCrown,
  Flame: IconFlame,
  Zap: IconZap,
  Compass: IconCompass,
  Leaf: IconLeaf,
  ArrowUpRight,
  Feather: IconFeather,
  Eye: IconEye,
};
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import QuickViewModal from "@/components/ui/QuickViewModal";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TrailerModal from "@/components/ui/TrailerModal";
import { getYouTubeId, getAnimeDetailsAniList } from "@/lib/jikan";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import TrackerButton from "@/components/anime/TrackerButton";
import { useAnimeStatus } from "@/hooks/useAnimeStatus";
import { useManhwaStatus } from "@/hooks/useManhwaStatus";
import ManhwaTrackerButton from "@/components/manhwa/ManhwaTrackerButton";
import { useNovelStatus } from "@/hooks/useNovelStatus";
import NovelTrackerButton from "@/components/novel/NovelTrackerButton";
import ClearTrackingButton from "@/components/profile/ClearTrackingButton";
import DailyQuests from "@/components/quests/DailyQuests";
import { novelCover } from "@/lib/novelImage";
import ShowcaseCards from "@/components/profile/ShowcaseCards";
import TitleRack from "@/components/profile/TitleRack";
import { TitleChips } from "@/components/profile/UserBadges";
import RecentComments from "@/components/profile/RecentComments";
import ActivityHistory from "@/components/profile/ActivityHistory";
import GuildCard from "@/components/profile/GuildCard";
import GuildTag from "@/components/guild/GuildTag";
import ProfileStamp from "@/components/stamp/ProfileStamp";

function formatTrackerStatus(status?: string): string {
  if (!status) return "Reading";
  const s = String(status).toUpperCase().replace(/_/g, "-");
  if (s === "ON-HOLD" || s === "ONHOLD" || s === "PAUSED" || s === "HOLD") return "On-Hold";
  if (s === "READING") return "Reading";
  if (s === "WAITING") return "Waiting";
  if (s === "FINISHED" || s === "COMPLETED") return "Finished";
  if (s === "DROPPED") return "Dropped";
  if (s === "INTERESTED" || s === "PLAN-TO-READ") return "Interested";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: currentUserLoaded, followUser, unfollowUser } = useUser();
  const { preferences } = usePreferences();
  const { toast } = useToast();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [activeWornTitles, setActiveWornTitles] = useState<string[] | null>(null);
  const [titleVersion, setTitleVersion] = useState(0);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [manhwaWatchlist, setManhwaWatchlist] = useState<any[]>([]);
  const [novelWatchlist, setNovelWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState<{ title: string; users: any[] } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPointHistory, setShowPointHistory] = useState(false);
  const [showDomainExpansion, setShowDomainExpansion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const { tracked: liveTracked, wipeWatchlist } = useAnimeStatus();
  const { tracked: liveTrackedManhwa, clearAllTracking: clearManhwaTracking } = useManhwaStatus();
  const { tracked: liveTrackedNovel, clearAllTracking: clearNovelTracking } = useNovelStatus();

  const router = useRouter();

  const [activeAnime, setActiveAnime] = useState<any | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loadingAnimeId, setLoadingAnimeId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<"anime" | "manhwa" | "novel">("anime");

  const handleOpenQuickView = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) {
      toast("This title isn't linked to a database entry yet.", "error");
      return;
    }
    setLoadingAnimeId(id);
    try {
      const data = await getAnimeDetailsAniList(id);
      if (data) {
        setActiveAnime(data);
        setShowQuickView(true);
      } else {
        toast("Failed to load anime details.", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load anime details.", "error");
    } finally {
      setLoadingAnimeId(null);
    }
  };

  useEffect(() => {
    if (!currentUserLoaded) return;

    const fetchUser = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      try {
        const url = currentUser
          ? `${API_URL}/api/users/username/${username}?currentUserId=${currentUser.id}`
          : `${API_URL}/api/users/username/${username}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setProfileUser(data.data);
          setWatchlist(data.data.watchlist || []);
          setManhwaWatchlist(data.data.manhwaBookmarks || []);
          setNovelWatchlist(data.data.novelBookmarks || []);
        }
      } catch (err) {
        console.error("Failed to fetch user", err);
      } finally {
        setLoading(false);
      }
    };
    if (username) fetchUser();
  }, [username, currentUserLoaded, currentUser?.id]);

  const selfView = !!currentUser && currentUser.id === profileUser?.id;

  const activeItems = watchlist;
  const groupedItems = useMemo(() => {
    const SECTION_FOR: Record<string, string> = {
      WATCHING: "Watching",
      WATCHED: "Watched",
      FINISHED: "Watched",
      WAITING: "Waiting",
      INTERESTED: "Interested",
      DROPPED: "Dropped",
    };

    const groups: Record<string, typeof activeItems> = {};
    activeItems.forEach((item) => {
      const raw = (selfView && liveTracked[item.anilistId]?.status) || item.status || "";
      const section = SECTION_FOR[String(raw).toUpperCase()] || "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });

    const order = ["Watching", "Watched", "Waiting", "Interested", "Dropped", "Other"];
    const rank = (s: string) => {
      const i = order.indexOf(s);
      return i === -1 ? 99 : i;
    };
    return Object.entries(groups).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [activeItems, liveTracked, selfView]);

  const activeManhwaItems = manhwaWatchlist;
  const groupedManhwaItems = useMemo(() => {
    const SECTION_FOR_MANHWA: Record<string, string> = {
      READING: "Reading",
      COMPLETED: "Completed",
      FINISHED: "Completed",
      WAITING: "Waiting",
      "ON-HOLD": "On-Hold",
      ON_HOLD: "On-Hold",
      ONHOLD: "On-Hold",
      INTERESTED: "Interested",
      DROPPED: "Dropped",
      PLAN_TO_READ: "Plan to Read",
    };
    const groups: Record<string, typeof activeManhwaItems> = {};
    activeManhwaItems.forEach((item) => {
      const raw = (selfView && liveTrackedManhwa[item.mangaId]?.status) || item.status || "READING";
      const section =
        SECTION_FOR_MANHWA[String(raw).toUpperCase().replace(/_/g, "-")] ||
        SECTION_FOR_MANHWA[String(raw).toUpperCase()] ||
        "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });

    const order = ["Reading", "Completed", "Waiting", "On-Hold", "Interested", "Plan to Read", "Dropped", "Other"];
    const rank = (s: string) => {
      const i = order.indexOf(s);
      return i === -1 ? 99 : i;
    };
    return Object.entries(groups).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [activeManhwaItems, liveTrackedManhwa, selfView]);

  const activeNovelItems = novelWatchlist;
  const groupedNovelItems = useMemo(() => {
    const SECTION_FOR_NOVEL: Record<string, string> = {
      READING: "Reading",
      FINISHED: "Finished",
      COMPLETED: "Finished",
      WAITING: "Waiting",
      "ON-HOLD": "On-Hold",
      ON_HOLD: "On-Hold",
      ONHOLD: "On-Hold",
      INTERESTED: "Interested",
      DROPPED: "Dropped",
    };
    const groups: Record<string, typeof activeNovelItems> = {};
    activeNovelItems.forEach((item) => {
      const raw = (selfView && liveTrackedNovel[item.novelId]?.status) || item.status || "READING";
      const section =
        SECTION_FOR_NOVEL[String(raw).toUpperCase().replace(/_/g, "-")] ||
        SECTION_FOR_NOVEL[String(raw).toUpperCase()] ||
        "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });

    const order = ["Reading", "Finished", "Waiting", "On-Hold", "Interested", "Dropped", "Other"];
    const rank = (s: string) => {
      const i = order.indexOf(s);
      return i === -1 ? 99 : i;
    };
    return Object.entries(groups).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [activeNovelItems, liveTrackedNovel, selfView]);

  const hoursWatched = useMemo(() => {
    const minutes = activeItems.reduce((sum: number, it: any) => {
      const s = String(it.status || "").toUpperCase();
      if (s !== "FINISHED" && s !== "WATCHED") return sum;
      const eps = Number(it.episodes) || 0;
      if (!eps) return sum;
      return sum + eps * (Number(it.duration) || 24);
    }, 0);
    return Math.round(minutes / 60);
  }, [activeItems]);

  if (loading || !currentUserLoaded) return <LoadingScreen message="Loading profile" />;
  if (!profileUser)
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center font-mono text-white">
        User not found
      </div>
    );

  const isFollowing = currentUser?.following?.some((f: any) => f.followingId === profileUser.id);
  const isSelf = currentUser?.id === profileUser.id;

  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast("You must be logged in to follow users.", "error");
      return;
    }
    if (isFollowing) {
      setProfileUser((prev) =>
        prev ? { ...prev, followers: prev.followers?.filter((f: any) => f.followerId !== currentUser.id) } : prev
      );
      unfollowUser(profileUser.id);
    } else {
      setProfileUser((prev) =>
        prev ? { ...prev, followers: [...(prev.followers || []), { followerId: currentUser.id }] } : prev
      );

      if (isLeadDev(profileUser)) {
        setShowDomainExpansion(true);
      }

      followUser(profileUser.id);
    }
  };

  const rankTheme = getRankTheme(profileUser.xp || 0, profileUser.username);
  const RankIcon = rankTheme.badgeIcon ? ICON_MAP[rankTheme.badgeIcon] : null;
  const { cleanBio } = profileUser
    ? parseBio(profileUser.bio || "", profileUser.arisePoints || 0, profileUser.username)
    : { cleanBio: "", backgroundUrl: null };

  const currentXp = profileUser.xp || 0;
  const isProfileAdmin = isAdmin(profileUser);
  const isProfileLeadDev = isLeadDev(profileUser);
  const isStaffLevel = isProfileLeadDev || isProfileAdmin;
  const currentLevel = isStaffLevel ? MAX_LEVEL : calculateLevel(currentXp);
  const atMaxLevel = currentLevel >= MAX_LEVEL;
  const progressPercent = isStaffLevel ? 100 : calculateProgressPercent(currentXp);
  const intoLevel = isStaffLevel ? 0 : xpIntoLevel(currentXp);
  const toNextLevel = isStaffLevel ? 0 : xpToNextLevel(currentXp);

  const coverMode = (profileUser as any).bannerStyle === "cover" && !!profileUser.bannerUrl;
  const effectiveEffect = resolveActiveEffect(profileUser, profileUser.activeEffect);
  const isCrimson = effectiveEffect === "effect_crimson";
  const crimsonName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fecaca,#ef4444,#8b0000,#ef4444,#fecaca)] drop-shadow-[0_0_10px_rgba(255,0,0,0.6)]";
  const isDejaVu = effectiveEffect === "effect_ascension";
  const isTempest = effectiveEffect === "effect_tempest";
  const tempestName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#bae6fd,#38bdf8,#818cf8,#38bdf8,#bae6fd)] drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]";
  const isFool = effectiveEffect === "effect_fool";
  const foolName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#fde68a,#f59e0b,#fde68a,#e2e8f0)] drop-shadow-[0_0_10px_rgba(245,158,11,0.55)]";
  const isEvernight = effectiveEffect === "effect_evernight";
  const evernightName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#fda4af,#e11d48,#fda4af,#e2e8f0)] drop-shadow-[0_0_10px_rgba(225,29,72,0.55)]";
  const isMahoraga = effectiveEffect === "effect_mahoraga";
  const mahoragaName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fff7d6,#FFD700,#B8860B,#FFD700,#fff7d6)] drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]";
  const isRitual = effectiveEffect === "effect_ritual";
  const ritualName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffffff,#cbd5e1,#64748b,#e8e4d8,#ffffff)] drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]";
  const isCanopy = effectiveEffect === "effect_canopy";
  const canopyName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#d9f99d,#34d399,#166534,#a3e635,#d9f99d)] drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]";
  const isSamurai = effectiveEffect === "effect_samurai";
  const samuraiName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#f87171,#dc2626,#f87171,#e2e8f0)] drop-shadow-[0_0_10px_rgba(220,38,38,0.6)]";
  const isHimalaya = effectiveEffect === "effect_himalaya";
  const himalayaName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f1f5f9,#bae6fd,#38bdf8,#bae6fd,#f1f5f9)] drop-shadow-[0_0_10px_rgba(191,219,254,0.6)]";
  const isLotus = effectiveEffect === "effect_lotus";
  const lotusName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fbcfe8,#34d399,#fde68a,#34d399,#fbcfe8)] drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]";
  const isMango = effectiveEffect === "effect_mango";
  const mangoName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ff8c00,#ffd700,#ff1493,#32cd32,#ff8c00)] drop-shadow-[0_0_10px_rgba(255,140,0,0.6)]";
  const isJungle = effectiveEffect === "effect_jungle";
  const jungleName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#3fae5a,#7a9b3a,#ffe196,#3fae5a,#1f6b38)] drop-shadow-[0_0_10px_rgba(63,174,90,0.6)]";
  const isUnblinking = effectiveEffect === "effect_unblinking";
  const unblinkingName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f2ead8,#9ca3af,#8b0000,#9ca3af,#f2ead8)] drop-shadow-[0_0_10px_rgba(139,0,0,0.6)]";
  const isVoid = effectiveEffect === "effect_void";
  const voidName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e0f2fe,#67e8f9,#6366f1,#67e8f9,#e0f2fe)] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]";
  const isDejavuEcho = effectiveEffect === "effect_dejavu";
  const dejavuEchoName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f9fafb,#9ca3af,#8b0000,#00ffff,#f9fafb)] drop-shadow-[0_0_10px_rgba(139,0,0,0.55)]";
  const isHollow = effectiveEffect === "effect_hollow";
  const hollowName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#93c5fd,#a855f7,#c724f0,#f87171,#93c5fd)] drop-shadow-[0_0_10px_rgba(167,36,240,0.65)]";
  const isOuterGod = effectiveEffect === "effect_outergod";
  const outerGodName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#99f6e4,#14b8a6,#d81fb4,#14b8a6,#99f6e4)] drop-shadow-[0_0_10px_rgba(13,148,136,0.6)]";
  const isGateway = effectiveEffect === "effect_gateway";
  const gatewayName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2beff,#8a2be2,#ffffff,#ffd700,#e2beff)] drop-shadow-[0_0_10px_rgba(138,43,226,0.65)]";
  const isWebSlinger = effectiveEffect === "effect_webslinger";
  const webSlingerName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f8fafc,#22d3ee,#ef4444,#22d3ee,#f8fafc)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]";
  const isPortal = effectiveEffect === "effect_portal";
  const portalName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#d9f99d,#39ff14,#22d3ee,#e879f9,#d9f99d)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(57,255,20,0.55)]";
  const isBankai = effectiveEffect === "effect_bankai";
  const bankaiName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffffff,#ff9dcc,#ff1493,#cdd6e4,#ffffff)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(255,20,147,0.55)]";
  const isDandadan = effectiveEffect === "effect_dandadan";
  const dandadanName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#39ff14,#00ffff,#ffffff,#ff00ff,#ff0000,#39ff14)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(255,0,255,0.55)]";
  const isGrandline = effectiveEffect === "effect_grandline";
  const grandlineName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffd700,#ffb347,#ffffff,#2ba3c9,#ffd700)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(255,183,71,0.55)]";
  const ringOverridesRank = hasFrameRing((profileUser as any).activeFrame, effectiveEffect);
  const avatarBorderClass = ringOverridesRank
    ? "border-[#141414]"
    : `${rankTheme.borderClass} ${rankTheme.glowClass}`;
  const dejaVuName =
    "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ddd6fe,#a855f7,#e879f9,#a855f7,#ddd6fe)] drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]";

  const songSrc =
    (profileUser as any).profileSong ||
    (isProfileLeadDev ? "/audio/heartbreaker.mp3" : null);

  return (
    <PageTransition>
      <div className="relative min-h-screen pb-36 text-white overflow-clip bg-[#070709] selection:bg-purple-500/30">
        
        {/* Full-Screen Ambient Banner Backdrop */}
        <div className="fixed inset-0 z-0 bg-[#070709] overflow-hidden pointer-events-none">
          {profileUser?.bannerUrl && !coverMode ? (
            <>
              <motion.img
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.75 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                src={cloudinaryFit(profileUser.bannerUrl, 1920)}
                alt="Background Banner"
                decoding="async"
                style={{ objectPosition: `center ${(profileUser as any).bannerPosition ?? 50}%` }}
                className="w-full h-full object-cover filter brightness-[0.65]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#070709]/40 via-[#070709]/70 to-[#070709]" />
            </>
          ) : (
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4" />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full"
        >
          {/* ═══ COMPACT HIGH-IMPACT CENTERED HERO ═══ */}
          <div className="relative overflow-hidden border-b border-white/10">
            <div className="absolute inset-0 z-[1]">
              {profileUser.bannerUrl ? (
                <img
                  src={cloudinaryFit(profileUser.bannerUrl, 1920)}
                  alt=""
                  decoding="async"
                  style={{ objectPosition: `center ${(profileUser as any).bannerPosition ?? 50}%` }}
                  className="h-full w-full object-cover opacity-50"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(120%_130%_at_50%_0%,rgba(147,51,234,0.3),transparent_60%),linear-gradient(120deg,#140727,#2e054e_45%,#3b0764)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#070709]/85 to-[#070709]" />
            </div>

            {/* Profile Canvas Effect Overlay — Centered directly on Avatar */}
            <ProfileEffect effect={(showcaseOpen || showSettings || showPointHistory || modalData || previewImage) ? null : effectiveEffect} />

            {/* Grand Centered Hero Stage */}
            <div className="relative z-20 mx-auto flex max-w-4xl flex-col items-center px-4 pt-10 pb-10 text-center sm:pt-14 sm:pb-14">
              
              {/* Avatar + Frames + Level Badge + Audio Player */}
              <div className="relative mb-2 sm:mb-3 flex flex-col items-center">
                <div
                  className="relative w-fit cursor-pointer group"
                  onClick={() => profileUser.avatar && setPreviewImage(profileUser.avatar)}
                >
                  {profileUser.avatar ? (
                    <img
                      src={cloudinaryFit(profileUser.avatar, 400)}
                      alt="Avatar"
                      decoding="async"
                      className={`relative z-10 h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 rounded-full border-4 bg-[#141414] object-cover shadow-[0_15px_50px_rgba(0,0,0,0.85)] transition-all duration-300 group-hover:scale-105 ${avatarBorderClass}`}
                    />
                  ) : (
                    <div
                      className={`relative z-10 grid h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 place-items-center rounded-full border-4 bg-violet-700 text-4xl sm:text-5xl font-black transition-all duration-300 group-hover:scale-105 ${avatarBorderClass}`}
                    >
                      {profileUser.username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* High-Fidelity Avatar Decoration & Anchor Registration */}
                  <AvatarDecoration
                    frame={(profileUser as any).activeFrame}
                    effect={effectiveEffect}
                    size="lg"
                  />

                  {/* Level Badge Pill */}
                  {profileUser.arisePoints !== undefined && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                      <LevelBadge
                        xp={isProfileLeadDev ? Infinity : isProfileAdmin ? MAX_LEVEL_XP : profileUser.xp || 0}
                        size="sm"
                        className="border-[#070709] shadow-xl scale-100 sm:scale-105"
                      />
                    </div>
                  )}

                  {/* Soundtrack Player */}
                  {songSrc && (
                    <div className="absolute -bottom-1 -left-2 z-20 scale-100 sm:scale-105">
                      <ProfileSong src={songSrc} />
                    </div>
                  )}
                </div>
              </div>

              {/* Username & Guild Tag */}
              <div className="mt-3 sm:mt-4 flex max-w-[94vw] flex-wrap items-center justify-center gap-2 sm:gap-3">
                <h1
                  className={`min-w-0 break-words font-fell text-3xl sm:text-5xl md:text-6xl font-bold uppercase tracking-[0.06em] leading-tight drop-shadow-2xl ${
                    profileUser.activeFont === "font_cyber" ? "font-mono tracking-widest" : ""
                  } ${profileUser.activeFont === "font_pixel" ? "font-serif tracking-tight" : ""} ${
                    isCrimson
                      ? crimsonName
                      : isDejaVu
                        ? dejaVuName
                        : isTempest
                          ? tempestName
                          : isFool
                            ? foolName
                            : isEvernight
                              ? evernightName
                              : isMahoraga
                                ? mahoragaName
                                : isRitual
                                  ? ritualName
                                  : isCanopy
                                    ? canopyName
                                    : isSamurai
                                      ? samuraiName
                                      : isHimalaya
                                        ? himalayaName
                                        : isLotus
                                          ? lotusName
                                          : isMango
                                            ? mangoName
                                            : isJungle
                                              ? jungleName
                                              : isUnblinking
                                                ? unblinkingName
                                                : isVoid
                                                  ? voidName
                                                  : isDejavuEcho
                                                    ? dejavuEchoName
                                                    : isHollow
                                                      ? hollowName
                                                      : isOuterGod
                                                        ? outerGodName
                                                        : isGateway
                                                          ? gatewayName
                                                          : isWebSlinger
                                                            ? webSlingerName
                                                            : isPortal
                                                              ? portalName
                                                              : isBankai
                                                                ? bankaiName
                                                                : isDandadan
                                                                  ? dandadanName
                                                                  : isGrandline
                                                                    ? grandlineName
                                                                    : nameColorClass(profileUser.activeColor) ||
                                                                      rankTheme.textGradient
                  }`}
                >
                  {profileUser.username}
                </h1>
                <GuildTag userId={profileUser.id} size="md" />
              </div>

              {/* Titles & Custom Badges Ribbon */}
              <div className="mt-2.5 sm:mt-3 flex max-w-full flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                {rankTheme.title &&
                  !isHeartRankName(rankTheme.title) &&
                  (!isProfileLeadDev || !(profileUser as any).hideLeadRole) && (
                    <div
                      className={`shrink-0 ${
                        isProfileLeadDev ? "px-3.5 py-1 min-h-[30px]" : "px-3 py-1"
                      } rounded-full flex items-center gap-1.5 ${rankTheme.badgeClass} shadow-md`}
                    >
                      {isProfileLeadDev ? (
                        <img
                          src="/icons/lucifer-gojo.png"
                          alt="Lucifer"
                          className="h-5 w-5 object-contain -my-1 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                        />
                      ) : (
                        RankIcon && <RankIcon className="w-3.5 h-3.5" />
                      )}
                      <span
                        className={`${
                          isProfileLeadDev
                            ? "text-xs sm:text-[13px] text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] drop-shadow-[0_0_10px_rgba(192,132,252,0.9)]"
                            : "text-[11px] sm:text-xs"
                        } font-black tracking-wider uppercase font-mono`}
                      >
                        {rankTheme.title}
                      </span>
                    </div>
                  )}

                {(() => {
                  const heart = getHeartRank(currentLevel);
                  return (
                    <div
                      className={`shrink-0 px-3.5 py-1 rounded-full flex items-center gap-1.5 cursor-help ${heart.badgeClass} shadow-md`}
                      title={heartRankTooltip(heart)}
                    >
                      <span className="text-sm leading-none">{heart.emoji}</span>
                      <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase font-mono">
                        {heart.name} · {heart.numeral}
                      </span>
                      <span className="text-[10px] font-bold opacity-80">{heart.hanzi}</span>
                    </div>
                  );
                })()}

                {((profileUser as any).purchasedTags?.includes("tag_supporter") ||
                  (profileUser as any).purchasedEffects?.includes("effect_crimson")) && (
                  <div
                    className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1.5 border border-amber-400/40 bg-amber-500/15 text-amber-300 shadow-md"
                    title="Supported Da Vinci"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase font-mono">Supporter</span>
                  </div>
                )}

                {profileUser.activeRole === "role_watcher" && (
                  <div className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md">
                    <Shield className="w-3.5 h-3.5" />
                    <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase font-mono">Watcher</span>
                  </div>
                )}

                <TitleChips
                  user={activeWornTitles !== null ? { ...profileUser, equippedTitles: activeWornTitles } : profileUser}
                  size="sm"
                  max={3}
                />
              </div>

              {/* Stats Dock */}
              <div className="mt-3.5 sm:mt-4 flex max-w-full flex-wrap items-center justify-center gap-2 sm:gap-3 font-mono text-xs sm:text-sm">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md px-3.5 sm:px-4 py-1.5 text-slate-200 shadow-md">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="whitespace-nowrap">
                    <b className="text-white">{hoursWatched.toLocaleString()}</b> hrs
                  </span>
                </div>

                <button
                  onClick={() => setShowPointHistory(true)}
                  className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 backdrop-blur-md px-3.5 sm:px-4 py-1.5 text-amber-200 hover:bg-amber-500/25 transition shadow-md touch-manipulation"
                  title="Arise Points"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                  <span className="whitespace-nowrap">
                    <b className="text-white">{displayArisePoints(profileUser)}</b> Arise
                  </span>
                </button>

                <button
                  onClick={() =>
                    setModalData({
                      title: "Followers",
                      users: (profileUser.followers || []).map((f: any) => f.follower),
                    })
                  }
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md px-3.5 sm:px-4 py-1.5 text-slate-200 hover:bg-white/[0.08] hover:text-white transition shadow-md touch-manipulation"
                >
                  <Users className="h-3.5 w-3.5 text-violet-300 shrink-0" />
                  <span className="whitespace-nowrap">
                    <b className="text-white">{(profileUser.followers || []).length.toLocaleString()}</b> followers
                  </span>
                </button>

                <button
                  onClick={() =>
                    setModalData({
                      title: "Following",
                      users: (profileUser.following || []).map((f: any) => f.following),
                    })
                  }
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md px-3.5 sm:px-4 py-1.5 text-slate-200 hover:bg-white/[0.08] hover:text-white transition shadow-md touch-manipulation"
                >
                  <UserIcon className="h-3.5 w-3.5 text-violet-300 shrink-0" />
                  <span className="whitespace-nowrap">
                    <b className="text-white">{(profileUser.following || []).length.toLocaleString()}</b> following
                  </span>
                </button>
              </div>

              {/* Level Progress Strip */}
              <div className="mt-3.5 sm:mt-4 w-full max-w-md sm:max-w-xl rounded-2xl border border-white/10 bg-[#0b0b11]/85 px-4 sm:px-5 py-2.5 sm:py-3 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between gap-2 font-mono text-xs mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-violet-300 shrink-0">Lv {currentLevel}</span>
                    <span className="text-white/40 shrink-0">·</span>
                    <span className="text-slate-300 truncate max-w-[150px] sm:max-w-[220px] font-medium">
                      {getHeartRank(currentLevel).name}
                    </span>
                  </div>
                  <span className="font-bold text-amber-300 shrink-0">
                    {isStaffLevel ? "PINNED CAP" : `${currentXp.toLocaleString()} XP`}
                  </span>
                </div>

                <div className="relative h-2 sm:h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/60 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 shadow-[0_0_12px_rgba(217,70,239,0.6)] transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Bio Quote */}
              {cleanBio && (
                <div className="mt-3 sm:mt-4 max-w-2xl px-4">
                  <BioRenderer
                    bio={cleanBio}
                    className="text-xs sm:text-sm md:text-base font-medium text-slate-200/90 leading-relaxed italic"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-3 w-full max-w-xs sm:max-w-none">
                {isSelf ? (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-2.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-600/30 transition hover:scale-105 active:scale-95 touch-manipulation"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Edit Profile</span>
                  </button>
                ) : currentUser ? (
                  <button
                    onClick={handleFollowToggle}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-full px-6 py-2.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition hover:scale-105 active:scale-95 touch-manipulation ${
                      isFollowing
                        ? "border border-red-500/40 bg-red-500/20 text-red-200 shadow-md"
                        : "border border-violet-400/40 bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-600/30"
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4" /> Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" /> Follow
                      </>
                    )}
                  </button>
                ) : null}

                {effectiveEffect && !preferences.reducedMotion && (
                  <button
                    onClick={() => setShowcaseOpen(true)}
                    title="View effect full screen"
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 backdrop-blur-md transition hover:bg-white/[0.1] hover:text-white touch-manipulation shadow-md"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span>Showcase</span>
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* ═══ COMMUNITY & PROFILE BENTO PLATES ═══ */}
          <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-4 md:px-8 space-y-4 sm:space-y-5">
            <GuildCard userId={profileUser.id} />
            <ProfileStamp
              userId={profileUser.id}
              username={profileUser.username}
              isSelf={isSelf}
            />
            <TitleRack
              userId={profileUser.id}
              isMine={isSelf}
              onChange={setActiveWornTitles}
              version={titleVersion}
            />
            <ShowcaseCards
              userId={profileUser.id}
              isMine={isSelf}
              initial={(profileUser as any).showcaseCards || []}
            />
            <ActivityHistory userId={profileUser.id} />
            <RecentComments userId={profileUser.id} />
          </div>

          {/* Daily Quests (Personal on Self-View) */}
          {selfView && (
            <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-4 md:px-8">
              <DailyQuests />
            </div>
          )}

          {/* ═══ STICKY MEDIA LIBRARY TABS ═══ */}
          <div className="sticky top-0 z-40 border-b border-white/10 bg-[#070709]/95 backdrop-blur-md mt-6 sm:mt-8">
            <div className="mx-auto flex max-w-[1500px] items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto px-3 sm:px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-mono">
              {(
                [
                  { key: "anime", label: "Anime Streams", count: watchlist.length, Icon: Tv },
                  { key: "manhwa", label: "Manhwa & Comics", count: manhwaWatchlist.length, Icon: BookMarked },
                  { key: "novel", label: "Light Novels", count: novelWatchlist.length, Icon: BookOpen },
                ] as const
              ).map((t) => {
                const on = activeTab === t.key;
                const Icon = t.Icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`shrink-0 flex items-center gap-1.5 sm:gap-2 rounded-full border px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all touch-manipulation min-h-[36px] ${
                      on
                        ? "border-violet-400/50 bg-violet-500/20 text-violet-200 shadow-md shadow-violet-500/10"
                        : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${on ? "text-violet-300" : "text-slate-500"}`} />
                    <span>{t.label}</span>
                    <span
                      className={`ml-0.5 rounded-full px-1.5 sm:px-2 py-0.2 text-[9px] sm:text-[10px] font-black ${
                        on ? "bg-violet-400/30 text-white" : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ COLLECTION POSTER GRIDS ═══ */}
          <div className="mx-auto w-full max-w-[1500px] px-4 pt-6 md:px-8">
            
            {/* Clear All Shelf Controls */}
            {selfView && (
              <div className="mb-4 flex justify-end">
                {activeTab === "anime" && (
                  <ClearTrackingButton
                    kind="anime"
                    count={watchlist.length}
                    selfView={selfView}
                    onClear={async () => {
                      await wipeWatchlist();
                      setWatchlist([]);
                    }}
                  />
                )}
                {activeTab === "manhwa" && (
                  <ClearTrackingButton
                    kind="manhwa"
                    count={manhwaWatchlist.length}
                    selfView={selfView}
                    onClear={async () => {
                      const result = await clearManhwaTracking();
                      setManhwaWatchlist([]);
                      return result;
                    }}
                  />
                )}
                {activeTab === "novel" && (
                  <ClearTrackingButton
                    kind="novel"
                    count={novelWatchlist.length}
                    selfView={selfView}
                    onClear={async () => {
                      const result = await clearNovelTracking();
                      setNovelWatchlist([]);
                      return result;
                    }}
                  />
                )}
              </div>
            )}

            {/* TAB 1: ANIME */}
            {activeTab === "anime" && (
              <>
                {activeItems.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center shadow-xl">
                    <Tv className="mx-auto h-10 w-10 text-white/20" />
                    <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">No Anime Tracked Yet</p>
                    <p className="mt-1 text-xs text-white/40 font-mono">Watch episodes to build your anime library!</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {groupedItems.map(([section, items]) => {
                      const isExpanded = !!expandedSections[section];
                      const displayedItems = isExpanded ? items : items.slice(0, 8);
                      const hasMore = items.length > 8;

                      return (
                        <div key={section} className="space-y-3">
                          <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
                            <h3 className="font-fell text-xl font-bold uppercase tracking-wider text-white">
                              {section}
                            </h3>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-xs font-bold text-violet-300">
                              {items.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                            <AnimatePresence>
                              {displayedItems.map((item, i) => {
                                const revealIndex = isExpanded ? Math.max(0, i - 8) : i;
                                return (
                                  <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                                    transition={{
                                      duration: 0.35,
                                      delay: Math.min(revealIndex * 0.03, 0.3),
                                      ease: [0.16, 1, 0.3, 1],
                                    }}
                                    key={item.id}
                                    className="group relative rounded-2xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full hover:border-violet-400/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                                    onClick={(e) => handleOpenQuickView(e, item.anilistId)}
                                  >
                                    <div className="w-full aspect-[2/3] relative">
                                      <img
                                        src={
                                          item.coverImage ||
                                          "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80"
                                        }
                                        alt={item.title || "Anime"}
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      />

                                      <div
                                        className="absolute top-2 left-2 z-20 origin-top-left scale-[0.85] sm:scale-90"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isSelf ? (
                                          <TrackerButton
                                            anime={
                                              {
                                                mal_id: item.anilistId,
                                                title: item.title,
                                                images: {
                                                  jpg: {
                                                    large_image_url: item.coverImage,
                                                    image_url: item.coverImage,
                                                    small_image_url: item.coverImage,
                                                  },
                                                },
                                                genres: item.genre ? [{ name: item.genre }] : [],
                                              } as any
                                            }
                                            variant="compact"
                                          />
                                        ) : (
                                          <AnimeStatusBadge status={item.status || "Unknown"} />
                                        )}
                                      </div>

                                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                                        <h4 className="text-white font-bold text-xs leading-snug break-words drop-shadow-md line-clamp-2">
                                          {item.title || "Unknown Anime"}
                                        </h4>
                                      </div>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenQuickView(e, item.anilistId);
                                        }}
                                        className="absolute top-2 right-2 w-7 h-7 bg-black/70 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center rounded-full hover:bg-white hover:text-black transition-colors z-20 opacity-0 group-hover:opacity-100"
                                      >
                                        {loadingAnimeId === item.anilistId ? (
                                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>

                          {hasMore && (
                            <div className="flex justify-center pt-3">
                              <button
                                onClick={() =>
                                  setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
                                }
                                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all"
                              >
                                <span>{isExpanded ? "Show Less" : `See All ${items.length}`}</span>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </motion.div>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* TAB 2: MANHWA */}
            {activeTab === "manhwa" && (
              <>
                {activeManhwaItems.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center shadow-xl">
                    <BookMarked className="mx-auto h-10 w-10 text-white/20" />
                    <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">No Manhwa Tracked Yet</p>
                    <p className="mt-1 text-xs text-white/40 font-mono">Read chapters to add titles to your shelf!</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {groupedManhwaItems.map(([section, items]) => {
                      const isExpanded = !!expandedSections[`manhwa-${section}`];
                      const displayedItems = isExpanded ? items : items.slice(0, 8);
                      const hasMore = items.length > 8;

                      return (
                        <div key={section} className="space-y-3">
                          <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
                            <h3 className="font-fell text-xl font-bold uppercase tracking-wider text-white">
                              {section}
                            </h3>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-xs font-bold text-violet-300">
                              {items.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                            <AnimatePresence>
                              {displayedItems.map((item, i) => {
                                const revealIndex = isExpanded ? Math.max(0, i - 8) : i;
                                return (
                                  <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                                    transition={{
                                      duration: 0.35,
                                      delay: Math.min(revealIndex * 0.03, 0.3),
                                      ease: [0.16, 1, 0.3, 1],
                                    }}
                                    key={item.id}
                                    className="group relative rounded-2xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full hover:border-violet-400/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                                    onClick={() => router.push(`/manhwa/${encodeURIComponent(item.mangaId)}`)}
                                  >
                                    <div className="w-full aspect-[2/3] relative">
                                      {item.coverImage ? (
                                        <img
                                          src={manhwaCoverSrc(item.coverImage) || item.coverImage}
                                          alt={item.title}
                                          loading="lazy"
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#151518]">
                                          <span className="text-slate-600 font-bold font-mono text-xs">No Image</span>
                                        </div>
                                      )}

                                      <div
                                        className="absolute top-2 left-2 z-20 origin-top-left scale-[0.85] sm:scale-90"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isSelf ? (
                                          <ManhwaTrackerButton
                                            manhwa={{ id: item.mangaId, title: item.title, image: item.coverImage }}
                                            variant="compact"
                                          />
                                        ) : (
                                          <span className="px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider rounded-md shadow-md border border-white/10 bg-black/60 backdrop-blur-sm text-white">
                                            {formatTrackerStatus(item.status)}
                                          </span>
                                        )}
                                      </div>

                                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                                        <h4 className="text-white font-bold text-xs leading-snug break-words drop-shadow-md line-clamp-2">
                                          {item.title}
                                        </h4>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>

                          {hasMore && (
                            <div className="flex justify-center pt-3">
                              <button
                                onClick={() =>
                                  setExpandedSections((prev) => ({
                                    ...prev,
                                    [`manhwa-${section}`]: !prev[`manhwa-${section}`],
                                  }))
                                }
                                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all"
                              >
                                <span>{isExpanded ? "Show Less" : `See All ${items.length}`}</span>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </motion.div>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* TAB 3: NOVELS */}
            {activeTab === "novel" && (
              <>
                {activeNovelItems.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#0b0b11] p-16 text-center shadow-xl">
                    <BookOpen className="mx-auto h-10 w-10 text-white/20" />
                    <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">No Novels Tracked Yet</p>
                    <p className="mt-1 text-xs text-white/40 font-mono">Bookmark light novels to build your library!</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {groupedNovelItems.map(([section, items]) => {
                      const isExpanded = !!expandedSections[`novel-${section}`];
                      const displayedItems = isExpanded ? items : items.slice(0, 8);
                      const hasMore = items.length > 8;

                      return (
                        <div key={section} className="space-y-3">
                          <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
                            <h3 className="font-fell text-xl font-bold uppercase tracking-wider text-white">
                              {section}
                            </h3>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-xs font-bold text-violet-300">
                              {items.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                            <AnimatePresence>
                              {displayedItems.map((item, i) => {
                                const revealIndex = isExpanded ? Math.max(0, i - 8) : i;
                                const cover = novelCover(item.coverImage);
                                return (
                                  <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                                    transition={{
                                      duration: 0.35,
                                      delay: Math.min(revealIndex * 0.03, 0.3),
                                      ease: [0.16, 1, 0.3, 1],
                                    }}
                                    key={item.id}
                                    className="group relative rounded-2xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full hover:border-violet-400/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                                    onClick={() => router.push(`/novel/${encodeURIComponent(item.novelId)}`)}
                                  >
                                    <div className="w-full aspect-[2/3] relative">
                                      {cover ? (
                                        <img
                                          src={cover}
                                          alt={item.title}
                                          loading="lazy"
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#151518]">
                                          <span className="text-slate-600 font-bold font-mono text-xs">No Image</span>
                                        </div>
                                      )}

                                      <div
                                        className="absolute top-2 left-2 z-20 origin-top-left scale-[0.85] sm:scale-90"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isSelf ? (
                                          <NovelTrackerButton
                                            novel={{ id: item.novelId, title: item.title, coverImage: item.coverImage }}
                                            variant="compact"
                                          />
                                        ) : (
                                          <span className="px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider rounded-md shadow-md border border-white/10 bg-black/60 backdrop-blur-sm text-white">
                                            {formatTrackerStatus(item.status)}
                                          </span>
                                        )}
                                      </div>

                                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                                        <h4 className="text-white font-bold text-xs leading-snug break-words drop-shadow-md line-clamp-2">
                                          {item.title}
                                        </h4>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>

                          {hasMore && (
                            <div className="flex justify-center pt-3">
                              <button
                                onClick={() =>
                                  setExpandedSections((prev) => ({
                                    ...prev,
                                    [`novel-${section}`]: !prev[`novel-${section}`],
                                  }))
                                }
                                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all"
                              >
                                <span>{isExpanded ? "Show Less" : `See All ${items.length}`}</span>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </motion.div>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

          </div>
        </motion.div>

        {/* Trailer Modal */}
        <TrailerModal
          videoId={showTrailer && activeAnime ? getYouTubeId(activeAnime.trailer) : null}
          onClose={() => setShowTrailer(false)}
        />

        {/* Quick View Modal */}
        {showQuickView && activeAnime && (
          <QuickViewModal
            anime={activeAnime}
            onClose={() => setShowQuickView(false)}
            onPlayTrailer={() => setShowTrailer(true)}
          />
        )}

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

        <ProfileShowcase
          open={showcaseOpen}
          onClose={() => setShowcaseOpen(false)}
          username={profileUser.username}
          avatar={profileUser.avatar}
          effect={effectiveEffect}
          frame={(profileUser as any).activeFrame}
          nameClass={effectNameClass(effectiveEffect)}
          subtitle={getHeartRank(currentLevel).name}
        />

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
            onUpdate={(data: any) => {
              if (Array.isArray(data.equippedTitles)) {
                setActiveWornTitles(data.equippedTitles);
                setTitleVersion((v) => v + 1);
              }
              setProfileUser((prev) => (prev ? { ...prev, ...data } : prev));
            }}
          />
        )}

        {showDomainExpansion && (
          <UnlimitedVoid onComplete={() => setShowDomainExpansion(false)} />
        )}
      </div>
    </PageTransition>
  );
}
