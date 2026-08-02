"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, Clock, Star, TrendingUp, Compass, Settings, Check, X, Shield, Users, Zap, User as UserIcon, Code2, Sparkles, Crown, Feather, Flame, Leaf, UserPlus, UserMinus, Eye, Heart, ListFilter } from 'lucide-react';
import BioRenderer from '@/components/profile/BioRenderer';
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
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import ProfileShowcase from "@/components/profile/ProfileShowcase";
import { calculateLevel, calculateProgressPercent, xpForNextLevel } from "@/lib/levels";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { nameColorClass } from "@/lib/cosmetics";
import { resolveActiveEffect } from "@/components/profile/CrimsonRealm";
import { motion, AnimatePresence } from "framer-motion";
import { getRankTheme } from "@/lib/ranks";
import { getHeartRank, heartRankTooltip } from "@/lib/heartRanks";
import { effectNameClass } from "@/lib/effectTheme";
import { usePreferences } from "@/hooks/usePreferences";
import { Code2 as IconCode2, ShieldAlert, Sparkles as IconSparkles, Crown as IconCrown, Flame as IconFlame, Zap as IconZap, Compass as IconCompass, Leaf as IconLeaf, ArrowUpRight, Feather as IconFeather, Eye as IconEye } from "lucide-react";
const ICON_MAP: Record<string, any> = { Code2: IconCode2, ShieldAlert, Sparkles: IconSparkles, Crown: IconCrown, Flame: IconFlame, Zap: IconZap, Compass: IconCompass, Leaf: IconLeaf, ArrowUpRight, Feather: IconFeather, Eye: IconEye };
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import QuickViewModal from "@/components/ui/QuickViewModal";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TrailerModal from "@/components/ui/TrailerModal";
import { getYouTubeId, getAnimeDetailsAniList } from "@/lib/jikan";
import { ChevronDown, Maximize2 } from "lucide-react";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import TrackerButton from "@/components/anime/TrackerButton";
import { useAnimeStatus } from "@/hooks/useAnimeStatus";
import { useManhwaStatus } from "@/hooks/useManhwaStatus";
import ManhwaTrackerButton from "@/components/manhwa/ManhwaTrackerButton";
import { useNovelStatus } from "@/hooks/useNovelStatus";
import NovelTrackerButton from "@/components/novel/NovelTrackerButton";
import { novelCover } from "@/lib/novelImage";
import { useManhwaModal } from "@/components/providers/ManhwaModalProvider";
import { useNovelModal } from "@/components/providers/NovelModalProvider";
import ShowcaseCards from "@/components/profile/ShowcaseCards";
import RecentComments from "@/components/profile/RecentComments";

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: currentUserLoaded, followUser, unfollowUser } = useUser();
  const { preferences } = usePreferences();
  const { toast } = useToast();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
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

  // Which tracker sections are expanded ("See all").
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Live tracker for the current user, so status edits on your own profile
  // re-file cards into the right section immediately.
  const { tracked: liveTracked } = useAnimeStatus();
  const { tracked: liveTrackedManhwa } = useManhwaStatus();
  const { tracked: liveTrackedNovel } = useNovelStatus();

  // Manhwa/novel cards pop a quick-view modal (like the anime tab) instead of
  // navigating away to the detail page.
  const { openManhwa } = useManhwaModal();
  const { openNovel } = useNovelModal();

  const [activeAnime, setActiveAnime] = useState<any | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loadingAnimeId, setLoadingAnimeId] = useState<number | null>(null);

  // Toggle between Anime, Manhwa and Novel tabs
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
      // These IDs are AniList IDs, so query AniList directly (Jikan/MAL uses
      // different IDs and rate-limits our production traffic).
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
    // Only fetch once currentUserLoaded is true, so we don't fetch without currentUserId
    if (!currentUserLoaded) return;
    
    const fetchUser = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      try {
        const url = currentUser ? `${API_URL}/api/users/username/${username}?currentUserId=${currentUser.id}` : `${API_URL}/api/users/username/${username}`;
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

  // Group the tracker by status (Watching / Watched / Waiting / Interested).
  // This MUST run before the early returns below — otherwise the hook count
  // changes between the loading and loaded renders, which crashes with
  // "Rendered more hooks than during the previous render."
  const activeItems = watchlist;
  const groupedItems = useMemo(() => {
    const SECTION_FOR: Record<string, string> = {
      WATCHING: "Watching", WATCHED: "Watched", FINISHED: "Watched",
      WAITING: "Waiting", INTERESTED: "Interested", DROPPED: "Dropped",
    };

    const groups: Record<string, typeof activeItems> = {};
    activeItems.forEach(item => {
      const raw = (selfView && liveTracked[item.anilistId]?.status) || item.status || "";
      const section = SECTION_FOR[String(raw).toUpperCase()] || "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });

    const order = ["Watching", "Watched", "Waiting", "Interested", "Dropped", "Other"];
    const rank = (s: string) => { const i = order.indexOf(s); return i === -1 ? 99 : i; };
    return Object.entries(groups).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [activeItems, liveTracked, selfView]);

  const activeManhwaItems = manhwaWatchlist;
  const groupedManhwaItems = useMemo(() => {
    const SECTION_FOR_MANHWA: Record<string, string> = {
      READING: "Reading", COMPLETED: "Completed", FINISHED: "Completed",
      WAITING: "Waiting", INTERESTED: "Interested", DROPPED: "Dropped", PLAN_TO_READ: "Plan to Read"
    };
    const groups: Record<string, typeof activeManhwaItems> = {};
    activeManhwaItems.forEach(item => {
      const raw = (selfView && liveTrackedManhwa[item.mangaId]?.status) || item.status || "READING";
      const section = SECTION_FOR_MANHWA[String(raw).toUpperCase()] || "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });

    const order = ["Reading", "Completed", "Waiting", "Interested", "Plan to Read", "Dropped", "Other"];
    const rank = (s: string) => { const i = order.indexOf(s); return i === -1 ? 99 : i; };
    return Object.entries(groups).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [activeManhwaItems, liveTrackedManhwa, selfView]);

  const activeNovelItems = novelWatchlist;
  const groupedNovelItems = useMemo(() => {
    const SECTION_FOR_NOVEL: Record<string, string> = {
      READING: "Reading", FINISHED: "Finished", COMPLETED: "Finished",
      WAITING: "Waiting", INTERESTED: "Interested", DROPPED: "Dropped",
    };
    const groups: Record<string, typeof activeNovelItems> = {};
    activeNovelItems.forEach(item => {
      const raw = (selfView && liveTrackedNovel[item.novelId]?.status) || item.status || "READING";
      const section = SECTION_FOR_NOVEL[String(raw).toUpperCase()] || "Other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });

    const order = ["Reading", "Finished", "Waiting", "Interested", "Dropped", "Other"];
    const rank = (s: string) => { const i = order.indexOf(s); return i === -1 ? 99 : i; };
    return Object.entries(groups).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [activeNovelItems, liveTrackedNovel, selfView]);

  // Hours actually spent watching — the summed runtime of everything FINISHED.
  // Runtime metadata is backfilled server-side, so this covers old entries too;
  // anything we still don't know the length of simply doesn't count.
  // Like the memo above, this MUST sit before the early returns (hook order).
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
  if (!profileUser) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">User not found</div>;

  const isFollowing = currentUser?.following?.some((f: any) => f.followingId === profileUser.id);
  const isSelf = currentUser?.id === profileUser.id;

  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast("You must be logged in to follow users.", "error");
      return;
    }
    if (isFollowing) {
      // Optimistic: drop the follower count now; the button flips via useUser.
      // The network call runs in the background (no await = no UI stall).
      setProfileUser(prev => prev ? { ...prev, followers: prev.followers?.filter((f: any) => f.followerId !== currentUser.id) } : prev);
      unfollowUser(profileUser.id);
    } else {
      // Optimistic follower count + instant button; sync in the background.
      setProfileUser(prev => prev ? { ...prev, followers: [...(prev.followers || []), { followerId: currentUser.id }] } : prev);

      // TRIGGER UNLIMITED VOID FOR LEAD DEV
      if (isLeadDev(profileUser)) {
        setShowDomainExpansion(true);
      }

      followUser(profileUser.id);
    }
  };

  const rankTheme = getRankTheme(profileUser.xp || 0, profileUser.username);
  const RankIcon = rankTheme.badgeIcon ? ICON_MAP[rankTheme.badgeIcon] : null;
  const { cleanBio, backgroundUrl } = profileUser ? parseBio(profileUser.bio || "", profileUser.arisePoints || 0, profileUser.username) : { cleanBio: "", backgroundUrl: null };

  // Level is driven by XP (separate from the Arise Points currency).
  // Lead Dev and Admins are pinned to the max level (10).
  const currentXp = profileUser.xp || 0;
  const isProfileAdmin = isAdmin(profileUser);
  const isProfileLeadDev = isLeadDev(profileUser);
  const currentLevel = (isProfileLeadDev || isProfileAdmin) ? 10 : calculateLevel(currentXp);
  const nextXp = xpForNextLevel(currentLevel);
  const progressPercent = (isProfileLeadDev || isProfileAdmin) ? 100 : calculateProgressPercent(currentXp);

  // Banner style: "cover" = a header strip on the card (Twitter-style);
  // anything else = the full-screen background image. Chosen by the profile owner.
  const coverMode = (profileUser as any).bannerStyle === "cover" && !!profileUser.bannerUrl;
  // Donor-exclusive: "Māna-Yood-Sushāī" wears the Crimson Realm BY DEFAULT, but
  // may equip any shop effect she owns instead (or silence the realm) — she just
  // never loses it. Nobody else can ever wear it. See resolveActiveEffect.
  const effectiveEffect = resolveActiveEffect(profileUser, profileUser.activeEffect);
  const isCrimson = effectiveEffect === "effect_crimson";
  const crimsonName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fecaca,#ef4444,#8b0000,#ef4444,#fecaca)] drop-shadow-[0_0_10px_rgba(255,0,0,0.6)]";
  // The rare Déjà vu Card turns the whole profile amethyst-purple.
  // The extreme-rare Voltaic Ascension turns the whole profile amethyst-purple.
  const isDejaVu = effectiveEffect === "effect_ascension";
  // The extreme-rare Monarch's Tempest drenches it in storm blue instead.
  const isTempest = effectiveEffect === "effect_tempest";
  const tempestName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#bae6fd,#38bdf8,#818cf8,#38bdf8,#bae6fd)] drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]";
  // The extreme-rare Fog of History crowns it in mist-grey and cosmic gold.
  const isFool = effectiveEffect === "effect_fool";
  const foolName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#fde68a,#f59e0b,#fde68a,#e2e8f0)] drop-shadow-[0_0_10px_rgba(245,158,11,0.55)]";
  // The extreme-rare Evernight's Blessing bathes it in crimson-moon twilight.
  const isEvernight = effectiveEffect === "effect_evernight";
  const evernightName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#fda4af,#e11d48,#fda4af,#e2e8f0)] drop-shadow-[0_0_10px_rgba(225,29,72,0.55)]";
  // The extreme-rare Wheel of Adaptation clads it in divine gold and bronze.
  const isMahoraga = effectiveEffect === "effect_mahoraga";
  const mahoragaName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fff7d6,#FFD700,#B8860B,#FFD700,#fff7d6)] drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]";
  // The SSS-grade summoning ritual bleaches it in bone-white and abyssal black.
  const isRitual = effectiveEffect === "effect_ritual";
  const ritualName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffffff,#cbd5e1,#64748b,#e8e4d8,#ffffff)] drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]";
  // The unique Heart of the Forest wreathes it in emerald and sunlight.
  const isCanopy = effectiveEffect === "effect_canopy";
  const canopyName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#d9f99d,#34d399,#166534,#a3e635,#d9f99d)] drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]";
  // The extreme-rare Ghost Samurai sheathes it in pale steel and crimson.
  const isSamurai = effectiveEffect === "effect_samurai";
  const samuraiName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#f87171,#dc2626,#f87171,#e2e8f0)] drop-shadow-[0_0_10px_rgba(220,38,38,0.6)]";
  // The SSS-grade Silent Himalayas wraps it in moonlit ice and twilight blue.
  const isHimalaya = effectiveEffect === "effect_himalaya";
  const himalayaName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f1f5f9,#bae6fd,#38bdf8,#bae6fd,#f1f5f9)] drop-shadow-[0_0_10px_rgba(191,219,254,0.6)]";
  // The extreme-rare Sacred Lotus Pond blooms it in lotus-pink, jade and gold.
  const isLotus = effectiveEffect === "effect_lotus";
  const lotusName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fbcfe8,#34d399,#fde68a,#34d399,#fbcfe8)] drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]";
  // The extreme-rare Mango Loco blasts it in mango orange, hot pink and lime.
  const isMango = effectiveEffect === "effect_mango";
  const mangoName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ff8c00,#ffd700,#ff1493,#32cd32,#ff8c00)] drop-shadow-[0_0_10px_rgba(255,140,0,0.6)]";
  // The extreme-rare Ancient Jungle wreathes it in emerald, moss and gold light.
  const isJungle = effectiveEffect === "effect_jungle";
  const jungleName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#3fae5a,#7a9b3a,#ffe196,#3fae5a,#1f6b38)] drop-shadow-[0_0_10px_rgba(63,174,90,0.6)]";
  // The SSS-grade Unblinking inks it in parchment, ash and bleeding crimson.
  const isUnblinking = effectiveEffect === "effect_unblinking";
  const unblinkingName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f2ead8,#9ca3af,#8b0000,#9ca3af,#f2ead8)] drop-shadow-[0_0_10px_rgba(139,0,0,0.6)]";
  // The SSS-grade Infinite Void drowns it in starlight cyan and deep-space indigo.
  const isVoid = effectiveEffect === "effect_void";
  const voidName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e0f2fe,#67e8f9,#6366f1,#67e8f9,#e0f2fe)] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]";
  // The LIMITED SSS Dejavu: Temporal Echo — phantom white, ash grey, crimson, quantum cyan.
  // (Not to be confused with the legacy isDejaVu var, which belongs to effect_ascension.)
  const isDejavuEcho = effectiveEffect === "effect_dejavu";
  const dejavuEchoName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f9fafb,#9ca3af,#8b0000,#00ffff,#f9fafb)] drop-shadow-[0_0_10px_rgba(139,0,0,0.55)]";
  // The SSS-grade Hollow Purple fuses cobalt and crimson into imaginary mass.
  const isHollow = effectiveEffect === "effect_hollow";
  const hollowName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#93c5fd,#a855f7,#c724f0,#f87171,#93c5fd)] drop-shadow-[0_0_10px_rgba(167,36,240,0.65)]";
  // The SSS-grade Outer God drowns it in abyssal teal and mutated magenta.
  const isOuterGod = effectiveEffect === "effect_outergod";
  const outerGodName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#99f6e4,#14b8a6,#d81fb4,#14b8a6,#99f6e4)] drop-shadow-[0_0_10px_rgba(13,148,136,0.6)]";
  // The unique Gate & Key burns it in ultraviolet, white and corrupted gold.
  const isGateway = effectiveEffect === "effect_gateway";
  const gatewayName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2beff,#8a2be2,#ffffff,#ffd700,#e2beff)] drop-shadow-[0_0_10px_rgba(138,43,226,0.65)]";
  // The extreme-rare Web-Slinger nets it in titanium white, cyan and crimson.
  const isWebSlinger = effectiveEffect === "effect_webslinger";
  const webSlingerName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f8fafc,#22d3ee,#ef4444,#22d3ee,#f8fafc)] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]";
  // When a bought frame (or the Voltaic ring) is equipped, drop the rank/role
  // border + glow so it doesn't override the frame the user chose.
  const ringOverridesRank = hasFrameRing((profileUser as any).activeFrame, effectiveEffect);
  const avatarBorderClass = ringOverridesRank ? "border-[#141414]" : `${rankTheme.borderClass} ${rankTheme.glowClass}`;
  const dejaVuName = "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ddd6fe,#a855f7,#e879f9,#a855f7,#ddd6fe)] drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]";

  return (
    <PageTransition>
      {/* overflow-CLIP, not hidden: `hidden` makes this a scroll container,
          which silently kills the profile card's `lg:sticky` below. `clip`
          contains the glow blobs without that side effect (same fix the shop
          toolbar needed). */}
      <div className="relative min-h-screen pt-24 pb-12 text-white overflow-clip">

      {/* Full-screen banner background (only in "full" mode) */}
      <div className="fixed inset-0 z-0 bg-[#09090b] overflow-hidden">
        {profileUser?.bannerUrl && !coverMode ? (
          <>
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              src={profileUser.bannerUrl}
              alt="Background Banner"
              style={{ objectPosition: `center ${(profileUser as any).bannerPosition ?? 50}%` }}
              className="w-full h-full object-cover"
            />
            {/* Gentle darken toward the bottom so lower content stays readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/5 via-[#09090b]/25 to-[#09090b]/85"></div>
          </>
        ) : (
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4"></div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-7xl mx-auto px-4 md:px-8"
      >
        {/* Channel layout: a full-bleed hero the effect actually fits in, then
            sticky tabs, then the collection at full width. The old two-column
            card gave effects a 420px portrait slot — nine of them are
            landscapes (mountain ridgelines, overhead cloud banks, a sky/river
            split at 70% height) and read as a smudge in that shape. */}
        <div>

        {/* ═══ HERO — the effect's stage ═══ */}
        <div className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 z-[1]">
            {profileUser.bannerUrl ? (
              <img
                src={profileUser.bannerUrl}
                alt=""
                style={{ objectPosition: `center ${(profileUser as any).bannerPosition ?? 50}%` }}
                className="h-full w-full object-cover opacity-70"
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(120%_130%_at_50%_0%,rgba(147,51,234,0.35),transparent_60%),linear-gradient(120deg,#1a0b2e,#3b0764_45%,#4a044e)]" />
            )}
            {/* fade the stage into the collection so the band reads as
                continuous without the canvas having to paint down there */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#09090b]/70 to-[#09090b]" />
          </div>

          {/* the effect, with the full width of the page to perform in */}
          <ProfileEffect effect={showcaseOpen ? null : effectiveEffect} />

          <div className="relative z-20 mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 py-10 text-center md:py-12">
            <div
              className="relative w-fit cursor-pointer"
              onClick={() => profileUser.avatar && setPreviewImage(profileUser.avatar)}
            >
              {profileUser.avatar ? (
                <motion.img
                  layoutId="profile-avatar"
                  src={profileUser.avatar}
                  alt="Avatar"
                  className={`relative z-10 h-32 w-32 rounded-full border-4 bg-[#141414] object-cover shadow-[0_12px_50px_rgba(0,0,0,0.75)] transition-all duration-300 md:h-40 md:w-40 ${avatarBorderClass}`}
                />
              ) : (
                <motion.div
                  layoutId="profile-avatar"
                  className={`relative z-10 grid h-32 w-32 place-items-center rounded-full border-4 bg-purple-600 text-4xl font-black transition-all duration-300 md:h-40 md:w-40 ${avatarBorderClass}`}
                >
                  {profileUser.username.charAt(0).toUpperCase()}
                </motion.div>
              )}
              <AvatarDecoration frame={(profileUser as any).activeFrame} effect={effectiveEffect} size="lg" />
              {profileUser.arisePoints !== undefined && (
                <div className="absolute -bottom-1 -right-1 z-20">
                  <LevelBadge xp={isProfileLeadDev ? Infinity : (isProfileAdmin ? 511000 : (profileUser.xp || 0))} size="lg" className="border-[#0b0b12] shadow-[0_4px_20px_rgba(0,0,0,0.8)]" />
                </div>
              )}
              {/* The lead dev's profile has a soundtrack. Keyed off the ROLE
                  via isLeadDev, never the username — names change hands. */}
              {isProfileLeadDev && (
                <div className="absolute -bottom-1 -left-1 z-20">
                  <ProfileSong src="/audio/heartbreaker.mp3" />
                </div>
              )}
            </div>

            <h1 className={`max-w-[92vw] break-words pb-1 text-4xl font-black leading-tight tracking-tight drop-shadow-lg md:text-5xl
              ${profileUser.activeFont === 'font_cyber' ? 'font-mono tracking-widest' : ''}
              ${profileUser.activeFont === 'font_pixel' ? 'font-serif tracking-tight' : ''}
              ${isCrimson ? crimsonName : isDejaVu ? dejaVuName : isTempest ? tempestName : isFool ? foolName : isEvernight ? evernightName : isMahoraga ? mahoragaName : isRitual ? ritualName : isCanopy ? canopyName : isSamurai ? samuraiName : isHimalaya ? himalayaName : isLotus ? lotusName : isMango ? mangoName : isJungle ? jungleName : isUnblinking ? unblinkingName : isVoid ? voidName : isDejavuEcho ? dejavuEchoName : isHollow ? hollowName : isOuterGod ? outerGodName : isGateway ? gatewayName : isWebSlinger ? webSlingerName : (nameColorClass(profileUser.activeColor) || rankTheme.textGradient)}`}>
              {profileUser.username}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {rankTheme.title && rankTheme.title !== getHeartRank(currentLevel).name && (
                <div className={`shrink-0 px-3 py-1 rounded-full flex items-center gap-1 ${rankTheme.badgeClass}`}>
                  {RankIcon && <RankIcon className="w-4 h-4" />}
                  <span className="text-xs font-black tracking-wider uppercase">{rankTheme.title}</span>
                </div>
              )}
              {(() => {
                const heart = getHeartRank(currentLevel);
                return (
                  <div className={`shrink-0 px-3 py-1 rounded-full flex items-center gap-1.5 cursor-help ${heart.badgeClass}`} title={heartRankTooltip(heart)}>
                    <span className="text-sm leading-none">{heart.emoji}</span>
                    <span className="text-xs font-black tracking-wider uppercase">{heart.name} · {heart.numeral}</span>
                    <span className="text-[10px] font-bold opacity-70">{heart.hanzi}</span>
                  </div>
                );
              })()}
              {((profileUser as any).purchasedTags?.includes('tag_supporter') || (profileUser as any).purchasedEffects?.includes('effect_crimson')) && (
                <div className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1.5 border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] cursor-help" title="Supported Da Vinci — thank you 💛">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-black tracking-wider uppercase">Supporter</span>
                </div>
              )}
              {profileUser.activeRole === 'role_watcher' && (
                <div className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1 bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-black tracking-wider uppercase">The Watcher</span>
                </div>
              )}
              {profileUser.activeRole === 'role_elite' && (
                <div className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  <Star className="w-4 h-4" />
                  <span className="text-xs font-black tracking-wider uppercase">Elite</span>
                </div>
              )}
              {profileUser.activeTag === 'tag_og' && (
                <div className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1 bg-red-500/20 text-red-400">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-black tracking-wider uppercase">OG</span>
                </div>
              )}
              {profileUser.activeTag === 'tag_weeb' && (
                <div className="shrink-0 px-3 py-1 rounded-full flex items-center gap-1 bg-pink-500/20 text-pink-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-black tracking-wider uppercase">Weeb Lord</span>
                </div>
              )}
            </div>

            {/* one line of facts, channel-style — four stat boxes read as a
                dashboard, which is not what this is */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-sm text-slate-300 [font-variant-numeric:tabular-nums]">
              <span><b className="font-black text-white">{hoursWatched.toLocaleString()}</b> {hoursWatched === 1 ? "hr" : "hrs"} watched</span>
              <span className="text-white/25">·</span>
              <span><b className="font-black text-white">{displayArisePoints(profileUser)}</b> Arise</span>
              <span className="text-white/25">·</span>
              <button
                onClick={() => setModalData({ title: 'Followers', users: (profileUser.followers || []).map((f: any) => f.follower) })}
                className="transition hover:text-white"
              >
                <b className="font-black text-white">{(profileUser.followers || []).length.toLocaleString()}</b> followers
              </button>
              <span className="text-white/25">·</span>
              <button
                onClick={() => setModalData({ title: 'Following', users: (profileUser.following || []).map((f: any) => f.following) })}
                className="transition hover:text-white"
              >
                <b className="font-black text-white">{(profileUser.following || []).length.toLocaleString()}</b> following
              </button>
            </div>

            <div className="w-full max-w-sm">
              <div className="relative h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>{(isProfileLeadDev || isProfileAdmin) ? "MAX LEVEL" : `${currentXp.toLocaleString()} XP`}</span>
                <span>{currentLevel >= 10 ? "LVL 10 (MAX)" : `${nextXp.toLocaleString()} XP (Next)`}</span>
              </div>
            </div>

            <BioRenderer bio={cleanBio || "No bio set."} className="max-w-2xl text-sm font-medium text-purple-200 drop-shadow-md" />

            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              {isSelf ? (
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center justify-center gap-2 rounded-full bg-purple-600 px-6 py-2.5 font-bold text-white shadow-xl transition hover:bg-purple-500"
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
              ) : currentUser ? (
                <button
                  onClick={handleFollowToggle}
                  className={`flex items-center justify-center gap-2 rounded-full px-6 py-2.5 font-bold shadow-xl transition ${isFollowing ? "bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400" : "bg-purple-600 text-white hover:bg-purple-500"}`}
                >
                  {isFollowing ? (
                    <><UserMinus className="h-4 w-4" /> Unfollow</>
                  ) : profileUser?.following?.some((f: any) => f.followingId === currentUser.id) ? (
                    <><UserPlus className="h-4 w-4" /> Follow Back</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> Follow</>
                  )}
                </button>
              ) : null}

              {effectiveEffect && !preferences.reducedMotion && (
                <button
                  onClick={() => setShowcaseOpen(true)}
                  title="View this profile effect full screen"
                  className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 font-bold text-slate-200 backdrop-blur transition hover:border-fuchsia-500/40 hover:bg-white/[0.1] hover:text-white"
                >
                  <Maximize2 className="h-4 w-4" /> Showcase
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ SHOWCASE + RECENT COMMENTS ═══
            Both components are self-contained: they fetch their own data and
            render nothing when there is nothing worth showing, so a quiet
            profile does not grow empty boxes and a failed fetch degrades to an
            absent section rather than a broken page. */}
        <div className="px-1 pt-6">
          <ShowcaseCards
            userId={profileUser.id}
            isMine={isSelf}
            initial={(profileUser as any).showcaseCards || []}
          />
          <RecentComments userId={profileUser.id} />
        </div>

        {/* ═══ TABS — sticky under the navbar ═══ */}
        {/* Sticks under the MOBILE bar, flush to the top on desktop — the
            desktop nav is docked to the bottom now, so a 64px offset there was
            reserving space for a bar that isn't above it any more. */}
        <div className="sticky top-[64px] z-40 border-b border-white/10 bg-[#09090b]/95 backdrop-blur-xl lg:top-0">
          <div className="mx-auto flex max-w-[1500px] items-center justify-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              { key: "anime", label: "Anime", count: watchlist.length },
              { key: "manhwa", label: "Manhwa", count: manhwaWatchlist.length },
              { key: "novel", label: "Novels", count: novelWatchlist.length },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 border-b-2 px-5 py-3.5 text-sm font-bold transition ${
                  activeTab === t.key
                    ? "border-fuchsia-500 text-white"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 text-[11px] font-black ${activeTab === t.key ? "text-fuchsia-300" : "text-slate-600"}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ COLLECTION — full width ═══ */}
        <div className="mx-auto w-full max-w-[1500px] px-4 pt-8 md:px-8">

        {activeTab === "anime" && (
          <>
            {activeItems.length === 0 ? (
              <div className="text-center py-20 text-slate-500 font-medium bg-white/5 rounded-2xl border border-white/10">
                This user hasn't tracked any anime yet!
              </div>
            ) : (
          <div className="space-y-10">
            {groupedItems.map(([section, items]) => {
              const isExpanded = !!expandedSections[section];
              const displayedItems = isExpanded ? items : items.slice(0, 6);
              const hasMore = items.length > 6;

              return (
                <div key={section} className="space-y-4">
                  {/* Section title (tracker status) with count */}
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-white tracking-wide">{section}</h3>
                    <span className="text-xs font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>

                  {/* Uniform poster grid (all cards are 2:3, so a real grid
                      animates far more smoothly than CSS multi-column). */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    <AnimatePresence>
                      {displayedItems.map((item, i) => {
                        // On expand, only the newly-revealed cards cascade in;
                        // the first 6 keep their keys and never re-animate.
                        const revealIndex = isExpanded ? Math.max(0, i - 6) : i;
                        return (
                        <motion.div
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.35, delay: Math.min(revealIndex * 0.035, 0.35), ease: [0.16, 1, 0.3, 1] }}
                          key={item.id}
                          className="relative group rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full"
                          onClick={(e) => handleOpenQuickView(e, item.anilistId)}
                        >
                          <div className="w-full aspect-[2/3] relative">
                            <img 
                              src={(item.coverImage || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80")} 
                              alt={item.title || "Anime"} 
                              loading="lazy" 
                              className="w-full h-full object-cover"
                            />
                            
                            {/* Status: editable picker on your own profile, read-only badge otherwise */}
                            <div className="absolute top-2 left-2 z-20" onClick={(e) => e.stopPropagation()}>
                              {isSelf ? (
                                <TrackerButton
                                  anime={{
                                    mal_id: item.anilistId,
                                    title: item.title,
                                    images: { jpg: { large_image_url: item.coverImage, image_url: item.coverImage, small_image_url: item.coverImage } },
                                    genres: item.genre ? [{ name: item.genre }] : [],
                                  } as any}
                                  variant="compact"
                                />
                              ) : (
                                <AnimeStatusBadge status={item.status || "Unknown"} />
                              )}
                            </div>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                              <h3 className="text-white font-bold text-sm md:text-base drop-shadow-md line-clamp-2">
                                {item.title || "Unknown Anime"}
                              </h3>
                            </div>
                            
                            {/* Quick View Button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenQuickView(e, item.anilistId); }}
                              className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center rounded-full hover:bg-white hover:text-black transition-colors z-20 opacity-0 group-hover:opacity-100"
                            >
                              {loadingAnimeId === item.anilistId ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* See More Button */}
                  {hasMore && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))}
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
          </>
        )}

        {activeTab === "manhwa" && (
          <>
            {activeManhwaItems.length === 0 ? (
              <div className="text-center py-20 text-slate-500 font-medium bg-white/5 rounded-2xl border border-white/10">
                This user hasn't tracked any manhwa yet!
              </div>
            ) : (
              <div className="space-y-10">
                {groupedManhwaItems.map(([section, items]) => {
                  const isExpanded = !!expandedSections[`manhwa-${section}`];
                  const displayedItems = isExpanded ? items : items.slice(0, 6);
                  const hasMore = items.length > 6;

                  return (
                    <div key={section} className="space-y-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-white tracking-wide">{section}</h3>
                        <span className="text-xs font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{items.length}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        <AnimatePresence>
                          {displayedItems.map((item, i) => {
                            const revealIndex = isExpanded ? Math.max(0, i - 6) : i;
                            return (
                            <motion.div
                              initial={{ opacity: 0, y: 12, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                              transition={{ duration: 0.35, delay: Math.min(revealIndex * 0.035, 0.35), ease: [0.16, 1, 0.3, 1] }}
                              key={item.id}
                              className="relative group rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full"
                              onClick={() => openManhwa({ id: item.mangaId, title: item.title, image: item.coverImage } as any)}
                            >
                                <div className="w-full aspect-[2/3] relative">
                                  {item.coverImage ? (
                                    <img
                                      src={item.coverImage}
                                      alt={item.title}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#151518]">
                                      <span className="text-slate-600 font-bold">No Image</span>
                                    </div>
                                  )}

                                  {/* Status Tracker */}
                                  <div className="absolute top-2 left-2 z-20" onClick={(e) => e.stopPropagation()}>
                                    {isSelf ? (
                                      <ManhwaTrackerButton
                                        manhwa={{ id: item.mangaId, title: item.title, image: item.coverImage }}
                                        variant="compact"
                                      />
                                    ) : (
                                      <span className="px-2 py-1 text-xs font-bold rounded shadow-md border border-white/10 bg-white/10 text-white">
                                        {String(item.status || "Reading").charAt(0).toUpperCase() + String(item.status || "Reading").slice(1).toLowerCase()}
                                      </span>
                                    )}
                                  </div>

                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                                    <h3 className="text-white font-bold text-sm md:text-base drop-shadow-md line-clamp-2">
                                      {item.title}
                                    </h3>
                                  </div>
                                </div>
                            </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>

                      {hasMore && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setExpandedSections(prev => ({ ...prev, [`manhwa-${section}`]: !prev[`manhwa-${section}`] }))}
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
          </>
        )}

        {activeTab === "novel" && (
          <>
            {activeNovelItems.length === 0 ? (
              <div className="text-center py-20 text-slate-500 font-medium bg-white/5 rounded-2xl border border-white/10">
                This user hasn't tracked any novels yet!
              </div>
            ) : (
              <div className="space-y-10">
                {groupedNovelItems.map(([section, items]) => {
                  const isExpanded = !!expandedSections[`novel-${section}`];
                  const displayedItems = isExpanded ? items : items.slice(0, 6);
                  const hasMore = items.length > 6;

                  return (
                    <div key={section} className="space-y-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-white tracking-wide">{section}</h3>
                        <span className="text-xs font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{items.length}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        <AnimatePresence>
                          {displayedItems.map((item, i) => {
                            const revealIndex = isExpanded ? Math.max(0, i - 6) : i;
                            const cover = novelCover(item.coverImage);
                            return (
                            <motion.div
                              initial={{ opacity: 0, y: 12, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                              transition={{ duration: 0.35, delay: Math.min(revealIndex * 0.035, 0.35), ease: [0.16, 1, 0.3, 1] }}
                              key={item.id}
                              className="relative group rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer block text-left bg-white/5 w-full"
                              onClick={() => openNovel({ id: item.novelId, title: item.title, cover: item.coverImage } as any)}
                            >
                                <div className="w-full aspect-[2/3] relative">
                                  {cover ? (
                                    <img
                                      src={cover}
                                      alt={item.title}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#151518]">
                                      <span className="text-slate-600 font-bold">No Image</span>
                                    </div>
                                  )}

                                  {/* Status Tracker */}
                                  <div className="absolute top-2 left-2 z-20" onClick={(e) => e.stopPropagation()}>
                                    {isSelf ? (
                                      <NovelTrackerButton
                                        novel={{ id: item.novelId, title: item.title, coverImage: item.coverImage }}
                                        variant="compact"
                                      />
                                    ) : (
                                      <span className="px-2 py-1 text-xs font-bold rounded shadow-md border border-white/10 bg-white/10 text-white">
                                        {String(item.status || "Reading").charAt(0).toUpperCase() + String(item.status || "Reading").slice(1).toLowerCase()}
                                      </span>
                                    )}
                                  </div>

                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                                    <h3 className="text-white font-bold text-sm md:text-base drop-shadow-md line-clamp-2">
                                      {item.title}
                                    </h3>
                                  </div>
                                </div>
                            </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>

                      {hasMore && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setExpandedSections(prev => ({ ...prev, [`novel-${section}`]: !prev[`novel-${section}`] }))}
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
          </>
        )}
        </div>{/* ═══ end RIGHT column ═══ */}
        </div>{/* ═══ end two-column ═══ */}
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

      {/* The equipped effect, full screen. Mounted unconditionally so its
          enter/exit animation can play; it renders nothing until `open`. */}
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
          onUpdate={(data: any) => setProfileUser({ ...profileUser, ...data })}
        />
      )}

      {showDomainExpansion && (
        <UnlimitedVoid onComplete={() => setShowDomainExpansion(false)} />
      )}
    </div>
    </PageTransition>
  );
}
