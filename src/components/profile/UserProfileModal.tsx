"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, UserMinus, ArrowUpRight, Shield, Star, Zap, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { resolveActiveEffect } from "@/components/profile/CrimsonRealm";
import { effectNameClass, effectCardBorderClass } from "@/lib/effectTheme";
import { getRankTheme } from "@/lib/ranks";
import { getHeartRank, heartRankTooltip } from "@/lib/heartRanks";
import { calculateLevel } from "@/lib/levels";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { parseBio } from "@/lib/bioUtils";
import BioRenderer from "@/components/profile/BioRenderer";
import LevelBadge from "@/components/profile/LevelBadge";

/**
 * Discord-style profile POPOUT. Clicking a user's avatar/name anywhere opens
 * this as an overlay (instead of a full-page navigation): a compact profile
 * card with the user's equipped Profile Effect playing across the whole thing,
 * their name/badges/bio/stats, a Follow button, and a "View full profile" link
 * to the real page. Fetches the user by username on open.
 */
export default function UserProfileModal({ username, onClose }: { username: string; onClose: () => void }) {
  useLockBodyScroll();
  const { user: currentUser, followUser, unfollowUser } = useUser();
  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    (async () => {
      try {
        const url = currentUser
          ? `${API_URL}/api/users/username/${username}?currentUserId=${currentUser.id}`
          : `${API_URL}/api/users/username/${username}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!alive) return;
        if (data.success) setProfileUser(data.data);
        else setNotFound(true);
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [username, currentUser?.id]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isSelf = !!currentUser && !!profileUser && currentUser.id === profileUser.id;
  const isFollowing = !!currentUser?.following?.some((f: any) => f.followingId === profileUser?.id);

  const handleFollow = () => {
    if (!currentUser || !profileUser) return;
    if (isFollowing) {
      setProfileUser((p: any) => p ? { ...p, followers: (p.followers || []).filter((f: any) => f.followerId !== currentUser.id) } : p);
      unfollowUser(profileUser.id);
    } else {
      setProfileUser((p: any) => p ? { ...p, followers: [...(p.followers || []), { followerId: currentUser.id }] } : p);
      followUser(profileUser.id);
    }
  };

  const body = (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-[360px]"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-[60] grid h-8 w-8 place-items-center rounded-full bg-[#141414] border border-white/15 text-slate-300 hover:text-white hover:border-white/40 transition shadow-lg"
        >
          <X className="h-4 w-4" />
        </button>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#111019] h-80 grid place-items-center">
            <div className="h-8 w-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notFound || !profileUser ? (
          <div className="rounded-3xl border border-white/10 bg-[#111019] p-10 text-center text-slate-400">
            User not found.
          </div>
        ) : (
          <PopoutCard
            profileUser={profileUser}
            isSelf={isSelf}
            isFollowing={isFollowing}
            canFollow={!!currentUser && !isSelf}
            onFollow={handleFollow}
            onClose={onClose}
          />
        )}
      </motion.div>
    </motion.div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{body}</AnimatePresence>, document.body);
}

function PopoutCard({
  profileUser, isSelf, isFollowing, canFollow, onFollow, onClose,
}: {
  profileUser: any; isSelf: boolean; isFollowing: boolean; canFollow: boolean; onFollow: () => void; onClose: () => void;
}) {
  const effectiveEffect = resolveActiveEffect(profileUser, profileUser.activeEffect);
  const rankTheme = getRankTheme(profileUser.xp || 0, profileUser.username);
  const isProfileAdmin = isAdmin(profileUser);
  const isProfileLeadDev = isLeadDev(profileUser);
  const level = (isProfileLeadDev || isProfileAdmin) ? 10 : calculateLevel(profileUser.xp || 0);
  const heart = getHeartRank(level);
  const nameClass = effectNameClass(effectiveEffect) || rankTheme.textGradient;
  const { cleanBio } = parseBio(profileUser.bio || "", profileUser.arisePoints || 0, profileUser.username);

  return (
    <div className={`relative rounded-3xl overflow-hidden border shadow-2xl bg-[#0e0d16] ${effectCardBorderClass(effectiveEffect)}`}>
      {/* the equipped effect, filling the whole card */}
      <ProfileEffect effect={effectiveEffect} />

      {/* banner */}
      <div className="relative z-[1] h-24 w-full overflow-hidden">
        {profileUser.bannerUrl ? (
          <img
            src={profileUser.bannerUrl}
            alt=""
            style={{ objectPosition: `center ${profileUser.bannerPosition ?? 50}%` }}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-purple-600/70 via-purple-600/50 to-fuchsia-600/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
      </div>

      <div className="relative z-10 px-5 pb-5">
        {/* avatar overlapping the banner */}
        <div className="relative -mt-12 mb-2 w-fit">
          {profileUser.avatar ? (
            <img src={profileUser.avatar} alt={profileUser.username} className="relative z-10 h-24 w-24 rounded-full object-cover border-4 border-[#0e0d16] bg-[#141414]" />
          ) : (
            <div className="relative z-10 grid h-24 w-24 place-items-center rounded-full border-4 border-[#0e0d16] bg-purple-600 text-4xl font-black text-white">
              {profileUser.username.charAt(0).toUpperCase()}
            </div>
          )}
          <AvatarDecoration frame={profileUser.activeFrame} effect={effectiveEffect} size="lg" />
          <div className="absolute -bottom-1 -right-1 z-20">
            <LevelBadge xp={isProfileLeadDev ? Infinity : (isProfileAdmin ? 511000 : (profileUser.xp || 0))} size="md" className="border-[#0e0d16]" />
          </div>
        </div>

        {/* name */}
        <h2 className={`text-2xl font-black leading-tight break-words drop-shadow ${nameClass}`}>
          {profileUser.username}
        </h2>

        {/* badges */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {rankTheme.title && (
            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${rankTheme.badgeClass}`}>
              {rankTheme.title}
            </span>
          )}
          <span className={`shrink-0 px-2.5 py-1 rounded-full flex items-center gap-1 cursor-help text-[10px] font-black tracking-wider uppercase ${heart.badgeClass}`} title={heartRankTooltip(heart)}>
            <span className="text-xs leading-none">{heart.emoji}</span>
            {heart.name} · {heart.numeral}
          </span>
          {profileUser.activeRole === "role_watcher" && (
            <span className="shrink-0 px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-black tracking-wider uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30"><Shield className="w-3 h-3" /> The Watcher</span>
          )}
          {profileUser.activeRole === "role_elite" && (
            <span className="shrink-0 px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-black tracking-wider uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"><Star className="w-3 h-3" /> Elite</span>
          )}
          {profileUser.activeTag === "tag_og" && (
            <span className="shrink-0 px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-black tracking-wider uppercase bg-red-500/20 text-red-400"><Zap className="w-3 h-3" /> OG</span>
          )}
          {profileUser.activeTag === "tag_weeb" && (
            <span className="shrink-0 px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-black tracking-wider uppercase bg-pink-500/20 text-pink-400"><Sparkles className="w-3 h-3" /> Weeb Lord</span>
          )}
        </div>

        {/* bio */}
        {cleanBio && (
          <>
            <div className="mt-4 mb-1.5 text-[10px] font-black tracking-[0.18em] uppercase text-slate-500">About me</div>
            <BioRenderer bio={cleanBio} className="text-purple-200 font-medium text-sm line-clamp-4" />
          </>
        )}

        {/* stats */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-300">
          <span>{(profileUser.followers || []).length} Followers</span>
          <span>{(profileUser.following || []).length} Following</span>
          <span className={`font-black ${rankTheme.textColorClass}`}>✧ {displayArisePoints(profileUser)}</span>
        </div>

        {/* actions */}
        <div className="mt-4 flex gap-2">
          {canFollow && (
            <button
              onClick={onFollow}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition shadow-lg ${isFollowing ? "bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400" : "bg-purple-600 text-white hover:bg-purple-500"}`}
            >
              {isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
            </button>
          )}
          <Link
            href={`/user/${profileUser.username}`}
            onClick={onClose}
            className={`${canFollow ? "" : "flex-1"} flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition bg-white/8 text-white hover:bg-white/15 border border-white/10`}
          >
            {isSelf ? "My profile" : "Full profile"} <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
