"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Tv,
  BookMarked,
  BookOpen,
  ArrowRight,
  Loader2,
  MessagesSquare,
  Heart,
  ThumbsDown,
  Clock,
  Flame,
  Search,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import UserLink from "@/components/profile/UserLink";
import UserBadges from "@/components/profile/UserBadges";
import GuildTag from "@/components/guild/GuildTag";
import MentionText from "@/components/ui/MentionText";
import { chapterNumberFromId } from "@/lib/manhwa/ids";
import { cloudinaryFit } from "@/lib/cloudinary";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { nameColorClass } from "@/lib/cosmetics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Source = "all" | "anime" | "manhwa" | "novel";

type Row = {
  id: string;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
  score?: number;
  animeId?: number | null;
  animeTitle?: string | null;
  mangaId?: string | null;
  mangaTitle?: string | null;
  novelId?: string | null;
  novelTitle?: string | null;
  upvotes?: number;
  downvotes?: number;
  chapterId?: string | null;
  chapterTitle?: string | null;
  episodeNo?: number | null;
  user?: {
    id: string;
    username: string;
    avatar?: string | null;
    role?: string | null;
    xp?: number | null;
    activeRole?: string | null;
    activeTag?: string | null;
    activeColor?: string | null;
    activeFont?: string | null;
    activeFrame?: string | null;
    activeEffect?: string | null;
    equippedTitles?: string[] | null;
    cardTitle?: string | null;
  };
};

const SOURCES: {
  key: Source;
  label: string;
  Icon: any;
  tint: string;
  bg: string;
  border: string;
}[] = [
  {
    key: "all",
    label: "All Media",
    Icon: Globe,
    tint: "text-violet-300",
    bg: "bg-violet-500/15",
    border: "border-violet-400/40",
  },
  {
    key: "anime",
    label: "Anime Streams",
    Icon: Tv,
    tint: "text-purple-300",
    bg: "bg-purple-500/15",
    border: "border-purple-400/40",
  },
  {
    key: "manhwa",
    label: "Manhwa & Comics",
    Icon: BookMarked,
    tint: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-400/40",
  },
  {
    key: "novel",
    label: "Web Novels",
    Icon: BookOpen,
    tint: "text-pink-300",
    bg: "bg-pink-500/15",
    border: "border-pink-400/40",
  },
];

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

function chapterLabel(title?: string | null, id?: string | null) {
  const t = (title || "").trim();
  if (t && !/^chapter$/i.test(t)) return t.length > 30 ? `${t.slice(0, 29)}…` : t;
  const n = chapterNumberFromId(id);
  return n ? `Ch. ${n}` : "Chapter";
}

function origin(c: Row) {
  if (c.animeId) {
    const ep = typeof c.episodeNo === "number" && c.episodeNo > 0 ? c.episodeNo : null;
    return {
      kind: "Anime",
      label: c.animeTitle || "Anime Series",
      Icon: Tv,
      badgeColor: "border-purple-400/40 bg-purple-500/10 text-purple-300",
      ctaText: ep ? `Watch Ep. ${ep}` : "Watch Series",
      where: ep ? `Episode ${ep}` : null,
      href: ep ? `/watch/${c.animeId}?ep=${ep}` : `/anime/${c.animeId}?tab=discussions`,
    };
  }
  if (c.mangaId) {
    const base = `/manhwa/${encodeURIComponent(c.mangaId)}`;
    const label = chapterLabel(c.chapterTitle, c.chapterId);
    return {
      kind: "Manhwa",
      label: c.mangaTitle || "Manhwa Series",
      Icon: BookMarked,
      badgeColor: "border-rose-400/40 bg-rose-500/10 text-rose-300",
      ctaText: c.chapterId ? `Read ${label}` : "Read Manhwa",
      where: c.chapterId ? label : null,
      href: c.chapterId ? `${base}/chapter/${encodeURIComponent(c.chapterId)}` : base,
    };
  }
  if (c.novelId) {
    const base = `/novel/${encodeURIComponent(c.novelId)}`;
    const label = chapterLabel(c.chapterTitle, c.chapterId);
    return {
      kind: "Novel",
      label: c.novelTitle || "Light Novel",
      Icon: BookOpen,
      badgeColor: "border-pink-400/40 bg-pink-500/10 text-pink-300",
      ctaText: c.chapterId ? `Read ${label}` : "Read Novel",
      where: c.chapterId ? label : null,
      href: c.chapterId ? `${base}/chapter/${encodeURIComponent(c.chapterId)}` : base,
    };
  }
  return null;
}

export default function GlobalComments({ embedded = false }: { embedded?: boolean }) {
  const { user } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<Source>("all");
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/comments`);
      url.searchParams.set("global", "true");
      url.searchParams.set("chaptersOnly", "true");
      url.searchParams.set("sort", sort);
      url.searchParams.set("limit", "50");
      if (source !== "all") url.searchParams.set("source", source);
      if (user?.id) url.searchParams.set("userId", user.id);
      const r = await fetch(url.toString());
      const d = await r.json();
      const list = Array.isArray(d?.data) ? d.data : d?.data?.comments;
      setRows(
        Array.isArray(list)
          ? list.filter((c: any) => {
              if (c.parentId) return false;
              if (source === "novel") return Boolean(c.novelId && c.chapterId);
              if (source === "manhwa") return Boolean(c.mangaId && c.chapterId);
              if (source === "anime") return Boolean(c.animeId && c.episodeNo);
              return Boolean(c.chapterId || c.episodeNo);
            })
          : []
      );
    } catch {
      // Backend cold / offline fallback
    } finally {
      setLoading(false);
    }
  }, [source, sort, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side search filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((c) => {
      const matchText = (c.content || "").toLowerCase().includes(q);
      const matchUser = (c.user?.username || "").toLowerCase().includes(q);
      const matchAnime = (c.animeTitle || "").toLowerCase().includes(q);
      const matchManga = (c.mangaTitle || "").toLowerCase().includes(q);
      const matchNovel = (c.novelTitle || "").toLowerCase().includes(q);
      const matchChapter = (c.chapterTitle || "").toLowerCase().includes(q);
      return matchText || matchUser || matchAnime || matchManga || matchNovel || matchChapter;
    });
  }, [rows, searchQuery]);

  return (
    <div className={`relative text-white font-mono ${embedded ? "" : "min-h-screen px-4 pb-36 pt-24"}`}>
      <div className={embedded ? "" : "mx-auto max-w-5xl"}>
        
        {/* ── HEADER ── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-2">
              <Sparkles className="h-3 w-3" />
              <span>Live Chapter & Episode Activity</span>
            </div>
            <h1 className="flex items-center gap-3 font-fell text-3xl sm:text-4xl font-bold uppercase tracking-[0.08em] text-white">
              <Globe className="h-7 w-7 shrink-0 text-violet-400" />
              <span>Global Comments</span>
            </h1>
            <p className="mt-1 text-xs text-white/50 font-mono">
              Live discussion stream across all anime episodes, manhwa chapters, and light novels.
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-bold text-white/70">
              <b className="text-white">{filteredRows.length}</b> Live Comments
            </span>
          </div>
        </div>

        {/* ── CONTROLS TOOLBAR: CATEGORIES, SEARCH & SORT ── */}
        <div className="mb-6 space-y-3">
          {/* Top Row: Category Pills & Sort Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {SOURCES.map(({ key, label, Icon, tint, bg, border }) => {
                const on = source === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSource(key)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide transition ${
                      on
                        ? `${border} ${bg} ${tint} shadow-lg shadow-violet-500/10`
                        : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Segmented Sort Controls */}
            <div className="inline-flex items-center gap-1 self-start md:self-auto rounded-full border border-white/10 bg-white/[0.03] p-1">
              <button
                onClick={() => setSort("newest")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition ${
                  sort === "newest"
                    ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                    : "text-white/40 hover:text-white"
                }`}
              >
                <Clock className="h-3 w-3" /> Recent
              </button>
              <button
                onClick={() => setSort("top")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition ${
                  sort === "top"
                    ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                    : "text-white/40 hover:text-white"
                }`}
              >
                <Flame className="h-3 w-3" /> Most Loved
              </button>
            </div>
          </div>

          {/* Bottom Row: Realtime Search Filter Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments by keyword, user, anime, or chapter..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-10 text-xs font-bold text-white placeholder:text-white/30 outline-none transition focus:border-violet-500/50 focus:bg-white/[0.05]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── COMMENTS FEED ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/40">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            <p className="mt-3 text-xs font-bold text-white/50">Fetching live comments…</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#0b0b11] py-20 text-center">
            <MessagesSquare className="h-10 w-10 text-white/20" />
            <p className="mt-4 font-fell text-xl font-bold uppercase text-white/80">
              {searchQuery ? "No matching comments found" : "No comments recorded yet"}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {searchQuery ? "Try clearing your search query." : "Watch anime or read chapters to join the live discussion!"}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-full border border-violet-400/40 bg-violet-500/20 px-4 py-1.5 text-xs font-bold text-violet-200 transition hover:bg-violet-500/30"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map((c) => {
              const o = origin(c);
              return (
                <motion.article
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0b0b11]/90 p-5 sm:p-6 shadow-xl transition-all duration-200 hover:border-violet-500/30 hover:bg-[#0e0e16]"
                >
                  {/* Top Origin Ribbon: Which Series & Episode/Chapter */}
                  {o && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                      <Link
                        href={o.href}
                        className="group/origin inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 transition-all hover:border-violet-400/40 hover:bg-violet-500/10"
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${o.badgeColor}`}
                        >
                          <o.Icon className="h-2.5 w-2.5" />
                          <span>{o.kind}</span>
                        </span>

                        <span className="truncate text-xs font-bold text-slate-200 group-hover/origin:text-white transition-colors">
                          {o.label}
                        </span>

                        {o.where && (
                          <>
                            <span className="text-white/20 text-xs">·</span>
                            <span className="shrink-0 text-xs font-black text-violet-300">
                              {o.where}
                            </span>
                          </>
                        )}

                        <ArrowRight className="h-3 w-3 shrink-0 text-white/40 transition-transform group-hover/origin:translate-x-0.5 group-hover/origin:text-white" />
                      </Link>

                      <span className="text-[11px] font-bold text-white/40">
                        {ago(c.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Main Comment Card Body */}
                  <div className="flex items-start gap-3.5">
                    {/* User Avatar with Frame/Decoration */}
                    <div className="relative h-10 w-10 shrink-0">
                      <UserLink username={c.user?.username || "unknown"}>
                        {c.user?.avatar ? (
                          <img
                            src={cloudinaryFit(c.user.avatar, 90)}
                            alt=""
                            className="relative z-10 h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-violet-700 text-xs font-black text-white ring-1 ring-white/10">
                            {(c.user?.username || "?")[0]?.toUpperCase()}
                          </span>
                        )}
                      </UserLink>
                      <AvatarDecoration
                        frame={c.user?.activeFrame}
                        effect={c.user?.activeEffect}
                        size="md"
                      />
                    </div>

                    {/* Author Meta & Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.user?.username ? (
                          <UserLink
                            username={c.user.username}
                            className={`min-w-0 truncate text-sm font-black text-white hover:text-violet-300 transition-colors ${
                              nameColorClass(c.user.activeColor) || ""
                            }`}
                          >
                            {c.user.username}
                          </UserLink>
                        ) : (
                          <span className="text-sm font-black text-slate-400">Someone</span>
                        )}

                        {/* Guild Tag */}
                        {c.user?.id && <GuildTag userId={c.user.id} size="sm" />}

                        {/* Full User Badges (Lucifer title, Staff, Worn Titles) */}
                        <UserBadges user={c.user as any} size="sm" showHeart={false} maxTitles={1} />
                      </div>

                      {/* Comment Message Text */}
                      {c.content && (
                        <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200 font-sans">
                          <MentionText text={c.content} />
                        </p>
                      )}

                      {/* Attached Media / GIF Image */}
                      {c.mediaUrl && (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40 max-w-fit">
                          <img
                            src={c.mediaUrl}
                            alt=""
                            loading="lazy"
                            className="max-h-72 w-auto max-w-full object-contain"
                          />
                        </div>
                      )}

                      {/* Bottom Action Ribbon: Reaction score & Direct Chapter/Episode CTA */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                        {/* Vote / Reactions Pill */}
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-black text-rose-300">
                            <Heart className="h-3 w-3 fill-current text-rose-400" />
                            <span>{c.upvotes ?? Math.max(0, c.score ?? 0)}</span>
                          </span>

                          {(c.downvotes ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                              <ThumbsDown className="h-2.5 w-2.5" />
                              <span>{c.downvotes}</span>
                            </span>
                          )}
                        </div>

                        {/* Direct Navigation CTA */}
                        {o && (
                          <Link
                            href={o.href}
                            className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-200 transition-all hover:bg-violet-500/25 hover:border-violet-400/60 hover:text-white"
                          >
                            <span>{o.ctaText}</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
