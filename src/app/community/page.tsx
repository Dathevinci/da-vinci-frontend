"use client";

import { useEffect, useState, useMemo } from "react";
import { User, useUser } from "@/hooks/useUser";
import { Users, UserPlus, UserMinus, Search, Globe, MessagesSquare, Sparkles, Flame, Check } from "lucide-react";
import UserLink from "@/components/profile/UserLink";
import GuildTag from "@/components/guild/GuildTag";
import { useToast } from "@/components/ui/Toast";
import CommunityForum from "@/components/community/CommunityForum";
import GlobalComments from "@/components/community/GlobalComments";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import BioRenderer from "@/components/profile/BioRenderer";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { parseBio } from "@/lib/bioUtils";
import { cloudinaryFit } from "@/lib/cloudinary";

function UserCard({
  user,
  currentUser,
  handleFollowToggle,
}: {
  user: User;
  currentUser: any;
  handleFollowToggle: (u: User, e: React.MouseEvent) => void;
}) {
  const isFollowing = currentUser?.following?.some((f: any) => f.followingId === user.id);
  const { cleanBio } = parseBio(user.bio || "", user.arisePoints || 0, user.username);
  const followersCount = (user.followers || []).length;

  return (
    <div className="group relative flex flex-col rounded-3xl border border-white/10 bg-[#0b0b11]/90 overflow-hidden shadow-xl transition-all duration-300 hover:border-violet-400/40 hover:bg-[#0e0e16] hover:shadow-2xl hover:shadow-violet-500/10 font-mono backdrop-blur-xl">
      {/* Banner */}
      <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-gradient-to-r from-violet-900/40 via-purple-900/20 to-black/60">
        {user.bannerUrl ? (
          <img
            src={user.bannerUrl}
            alt=""
            className="h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-600/20 via-transparent to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-transparent to-transparent" />
      </div>

      {/* Profile Info Header */}
      <div className="relative -mt-10 flex items-end justify-between px-5">
        <div className="relative h-18 w-18 shrink-0">
          <UserLink username={user.username} className="relative z-10 block h-18 w-18">
            {user.avatar ? (
              <img
                src={cloudinaryFit(user.avatar, 160)}
                alt=""
                className="relative z-10 h-16 w-16 sm:h-18 sm:w-18 rounded-full object-cover ring-4 ring-[#0b0b11] shadow-xl"
              />
            ) : (
              <span className="relative z-10 grid h-16 w-16 sm:h-18 sm:w-18 place-items-center rounded-full bg-violet-700 font-mono text-xl sm:text-2xl font-black text-white ring-4 ring-[#0b0b11] shadow-xl">
                {(user.username || "U")[0]?.toUpperCase()}
              </span>
            )}
          </UserLink>
          <AvatarDecoration frame={(user as any).activeFrame} effect={user.activeEffect} size="lg" />
        </div>

        <div className="pb-1 text-right">
          <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300 shadow-sm">
            {followersCount.toLocaleString()} {followersCount === 1 ? "Follower" : "Followers"}
          </span>
        </div>
      </div>

      {/* Username & Guild */}
      <div className="px-5 pt-3">
        <div className="flex items-center gap-2 min-w-0">
          <UserLink
            username={user.username}
            className="truncate font-fell text-lg sm:text-xl font-bold uppercase tracking-wider text-white group-hover:text-violet-300 transition-colors"
          >
            {user.username || "Anonymous"}
          </UserLink>
          <GuildTag userId={user.id} size="sm" />
        </div>
      </div>

      {/* Bio */}
      <div className="px-5 py-3 min-h-[60px] flex-1">
        <BioRenderer bio={cleanBio || "No bio set."} className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed italic" />
      </div>

      {/* Follow Action Button */}
      <div className="px-5 pb-5 pt-2 mt-auto">
        {currentUser && currentUser.id !== user.id ? (
          <button
            onClick={(e) => handleFollowToggle(user, e)}
            className={`flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 touch-manipulation min-h-[40px] ${
              isFollowing
                ? "border-white/10 bg-white/[0.04] text-slate-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                : "border-violet-400/40 bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-600/25 hover:scale-[1.02] active:scale-[0.98]"
            }`}
          >
            {isFollowing ? (
              <>
                <UserMinus className="w-4 h-4" /> Following
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Follow
              </>
            )}
          </button>
        ) : (
          <UserLink
            username={user.username}
            className="flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/[0.08] hover:text-white min-h-[40px]"
          >
            View Profile
          </UserLink>
        )}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"forum" | "feed" | "directory">("forum");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<"all" | "popular" | "following">("all");
  const { user: currentUser, followUser, unfollowUser } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      try {
        const res = await fetch(`${API_URL}/api/users`);
        const data = await res.json();
        if (data.success) {
          setUsers(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleFollowToggle = async (targetUser: User, e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) return toast("Please log in to follow users!", "error");

    const isFollowing = currentUser.following?.some((f: any) => f.followingId === targetUser.id);
    if (isFollowing) {
      await unfollowUser(targetUser.id);
      setUsers(users.map((u) => (u.id === targetUser.id ? { ...u, followers: u.followers?.slice(0, -1) } : u)));
    } else {
      await followUser(targetUser.id);
      setUsers(
        users.map((u) =>
          u.id === targetUser.id ? { ...u, followers: [...(u.followers || []), { followerId: currentUser.id }] } : u
        )
      );
    }
  };

  const filteredUsers = useMemo(() => {
    let list = users.filter((u) => u.id !== currentUser?.id);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => (u.username || "").toLowerCase().includes(q));
    }

    if (directoryFilter === "popular") {
      list = [...list].sort((a, b) => (b.followers?.length || 0) - (a.followers?.length || 0));
    } else if (directoryFilter === "following" && currentUser) {
      const followingIds = new Set((currentUser.following || []).map((f: any) => f.followingId));
      list = list.filter((u) => followingIds.has(u.id));
    }

    return list;
  }, [users, search, directoryFilter, currentUser]);

  return (
    <PageTransition>
      <div className="bg-[#070709] min-h-screen pt-20 sm:pt-24 pb-40 px-3 sm:px-6 md:px-12 text-white">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          
          {/* ── RESPONSIVE TAB NAVIGATION DOCK ── */}
          <div className="flex justify-center mb-6 sm:mb-8 font-mono">
            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-center gap-1 sm:gap-2 rounded-2xl sm:rounded-full border border-white/10 bg-[#0b0b11]/90 p-1.5 shadow-2xl backdrop-blur-xl overflow-x-auto [scrollbar-width:none]">
              {[
                { key: "forum" as const, label: "Forum", hint: "Discussions & Polls", Icon: MessagesSquare },
                { key: "feed" as const, label: "Global Comments", hint: "All Chapter Feeds", Icon: Globe },
                { key: "directory" as const, label: "Directory", hint: "Find Creators", Icon: Users },
              ].map(({ key, label, hint, Icon }) => {
                const on = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`group relative flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl sm:rounded-full border px-3 sm:px-6 py-2 sm:py-2.5 text-xs font-bold tracking-wide transition-all touch-manipulation min-h-[38px] ${
                      on
                        ? "border-violet-400/40 bg-violet-500/20 text-violet-200 shadow-md shadow-violet-500/10"
                        : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 transition ${on ? "text-violet-300" : "text-slate-500 group-hover:text-white"}`} />
                    <span className="text-left font-mono">
                      <span className="block text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">{label}</span>
                      <span className={`hidden text-[9px] font-bold uppercase tracking-wider md:block ${on ? "text-violet-300/70" : "text-white/30"}`}>
                        {hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {activeTab === "forum" ? (
                <motion.div
                  key="forum"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <CommunityForum embedded />
                </motion.div>
              ) : activeTab === "feed" ? (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlobalComments embedded />
                </motion.div>
              ) : (
                <motion.div
                  key="directory"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* ── USER DIRECTORY HEADER ── */}
                  <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5 sm:pb-6 font-mono">
                    <div>
                      <h1 className="flex items-center gap-3 font-fell text-2xl sm:text-4xl font-bold uppercase tracking-[0.08em] text-white">
                        <Users className="h-6 w-6 sm:h-8 sm:w-8 shrink-0 text-violet-400" />
                        User Directory
                      </h1>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        Discover other readers, view public profiles, and follow creators.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search members by username..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-full border border-white/10 bg-white/[0.04] pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none placeholder:text-slate-500 focus:border-violet-500 transition shadow-inner"
                      />
                    </div>
                  </div>

                  {/* ── FILTER PILLS ── */}
                  <div className="mb-6 flex flex-wrap items-center gap-2 font-mono">
                    {[
                      { key: "all" as const, label: `All Members (${users.length})` },
                      { key: "popular" as const, label: "Most Followed" },
                      ...(currentUser ? [{ key: "following" as const, label: `Following (${currentUser.following?.length || 0})` }] : []),
                    ].map((f) => {
                      const on = directoryFilter === f.key;
                      return (
                        <button
                          key={f.key}
                          onClick={() => setDirectoryFilter(f.key)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide transition-all touch-manipulation ${
                            on
                              ? "border-violet-400/40 bg-violet-500/20 text-violet-200 shadow-sm"
                              : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── USERS GRID ── */}
                  {loading ? (
                    <div className="py-24 text-center font-mono text-xs text-slate-500">Loading community directory...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-20 text-center rounded-3xl border border-white/10 bg-[#0b0b11] font-mono">
                      <Users className="mx-auto h-8 w-8 text-white/20" />
                      <p className="mt-3 text-sm font-bold text-slate-400">No users found matching your search</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {filteredUsers.map((u) => (
                        <UserCard
                          key={u.id}
                          user={u}
                          currentUser={currentUser}
                          handleFollowToggle={handleFollowToggle}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
