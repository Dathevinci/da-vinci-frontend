"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Globe, Tv, BookMarked, BookOpen, ArrowRight, Loader2, MessagesSquare, Heart, ThumbsDown } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import UserLink from "@/components/profile/UserLink";
import UserBadges from "@/components/profile/UserBadges";
import GuildTag from "@/components/guild/GuildTag";
import MentionText from "@/components/ui/MentionText";
import { ACCENT, notch } from "@/components/cards/gacha";
import { chapterNumberFromId } from "@/lib/manhwa/ids";
// Comment avatars are 36px; serve them at that scale instead of the original
// upload (animated uploads pass through untouched — see cloudinary.ts).
import { cloudinaryFit } from "@/lib/cloudinary";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * GLOBAL COMMENTS — everything being said across the site, in one place.
 *
 * READ ONLY, deliberately. Discussion now belongs in the Forum; this is a
 * window onto comments that are already attached to an anime, manhwa or novel.
 * Letting people post here would create a second, rootless discussion space
 * competing with the forum — which is exactly the split this change exists to
 * undo. Every card links back to the thing it was said about, so replying
 * happens where the comment actually lives.
 */

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
  // Already on the wire — getComments includes the whole row — the feed just
  // never read them, so every chapter comment linked to the series instead.
  // Both already arrive on the wire; the feed simply never declared them, so
  // all it could show was a net score.
  upvotes?: number;
  downvotes?: number;
  chapterId?: string | null;
  chapterTitle?: string | null;
  // Anime episodes were never captured; null on every comment made before
  // the watch page started sending it.
  episodeNo?: number | null;
  /**
   * The backend has always sent the full cosmetic set here — this type simply
   * declared three fields and threw the rest away, which is why this was the
   * one comment surface with no badges at all. Widening the type is the whole
   * fix; no backend change was needed for anything but the titles.
   */
  user?: {
    id: string; username: string; avatar?: string | null;
    role?: string | null; xp?: number | null;
    activeRole?: string | null; activeTag?: string | null;
    equippedTitles?: string[] | null; cardTitle?: string | null;
  };
};

const SOURCES: { key: Source; label: string; Icon: any; tint: string }[] = [
  { key: "all", label: "Everything", Icon: Globe, tint: ACCENT },
  { key: "anime", label: "Anime", Icon: Tv, tint: "#c084fc" },
  { key: "manhwa", label: "Manhwa", Icon: BookMarked, tint: "#f87171" },
  { key: "novel", label: "Novels", Icon: BookOpen, tint: "#f472b6" },
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

/** "Ch. 190" out of whatever the reader actually stored. `chapterTitle` is
 *  client-supplied and is sometimes the bare placeholder "Chapter", and
 *  `chapterId` is a provider string — `<slug>|190` for manhwa, something like
 *  `chapter-190-the-end` for novels — so the number is read off the TAIL.
 *  Reading the whole id would pick digits out of the series slug instead. */
function chapterLabel(title?: string | null, id?: string | null) {
  const t = (title || "").trim();
  if (t && !/^chapter$/i.test(t)) return t.length > 30 ? `${t.slice(0, 29)}…` : t;
  // Every source id is full of digits that are NOT chapter numbers — a
  // MangaPill series key, a Rizz site prefix, a Flame hex token. Taking the
  // digits nearest the end of any of them yields a confident, wrong number, so
  // this only reads one where it provably is one. See chapterNumberFromId.
  const n = chapterNumberFromId(id);
  return n ? `Ch. ${n}` : "Chapter";
}

/** Where a comment lives, and the link back to the EXACT spot it was left.
 *
 *  Manhwa and novel ids are slugs and MUST be encoded — a novel id carries a
 *  colon prefix and a manhwa chapter id contains a literal pipe, either of
 *  which routes somewhere else entirely raw. Anime ids are numeric and are
 *  never encoded anywhere in the app.
 *
 *  With no chapter or episode we fall back to the series page: a vaguer link,
 *  never a dead one. */
function origin(c: Row) {
  if (c.animeId) {
    const ep = typeof c.episodeNo === "number" && c.episodeNo > 0 ? c.episodeNo : null;
    return {
      kind: "Anime", label: c.animeTitle || "Anime", Icon: Tv, tint: "#c084fc",
      where: ep ? `Ep. ${ep}` : null,
      href: ep ? `/watch/${c.animeId}?ep=${ep}` : `/anime/${c.animeId}?tab=discussions`,
    };
  }
  if (c.mangaId) {
    const base = `/manhwa/${encodeURIComponent(c.mangaId)}`;
    return {
      kind: "Manhwa", label: c.mangaTitle || "Manhwa", Icon: BookMarked, tint: "#f87171",
      where: c.chapterId ? chapterLabel(c.chapterTitle, c.chapterId) : null,
      href: c.chapterId ? `${base}/chapter/${encodeURIComponent(c.chapterId)}` : base,
    };
  }
  if (c.novelId) {
    const base = `/novel/${encodeURIComponent(c.novelId)}`;
    return {
      kind: "Novel", label: c.novelTitle || "Novel", Icon: BookOpen, tint: "#f472b6",
      where: c.chapterId ? chapterLabel(c.chapterTitle, c.chapterId) : null,
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/comments`);
      url.searchParams.set("global", "true");
      url.searchParams.set("chaptersOnly", "true");
      url.searchParams.set("sort", sort);
      url.searchParams.set("limit", "40");
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
      // offline / cold backend — empty list is fine
    } finally {
      setLoading(false);
    }
  }, [source, sort, user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={`relative text-white ${embedded ? "" : "min-h-screen px-4 pb-24 pt-24"}`}
      style={embedded ? undefined : {
        background:
          "radial-gradient(80% 45% at 15% -5%, rgba(120,86,196,.18), transparent 60%)," +
          "linear-gradient(#0a0713, #06040e 60%, #050309)",
      }}>
      <div className={embedded ? "" : "mx-auto max-w-4xl"}>
        {/* ── header ── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Global Comments</h2>
          </div>
        </div>

        {/* ── filters ── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {SOURCES.map(({ key, label, Icon, tint }) => {
              const on = source === key;
              return (
                <button key={key} onClick={() => setSource(key)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition"
                  style={{
                    clipPath: notch(7),
                    background: on ? `${tint}30` : "rgba(255,255,255,.03)",
                    boxShadow: `inset 0 0 0 1px ${on ? tint : "rgba(255,255,255,.08)"}`,
                    color: on ? "#fff" : "#64748b",
                  }}>
                  <Icon className="h-3 w-3" /> {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {([["newest", "Recent"], ["top", "Most Loved"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                  sort === k ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                style={{
                  clipPath: "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)",
                  background: sort === k ? `${ACCENT}33` : "rgba(255,255,255,.04)",
                  boxShadow: `inset 0 0 0 1px ${sort === k ? `${ACCENT}99` : "rgba(255,255,255,.08)"}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── feed ── */}
        {loading ? (
          <div className="grid place-items-center py-20 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center"
            style={{ clipPath: notch(16), background: "rgba(255,255,255,.02)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
            <MessagesSquare className="mx-auto h-8 w-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">Nothing said here yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((c) => {
              const o = origin(c);
              return (
                <motion.article key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4"
                  style={{ clipPath: notch(16), background: "rgba(255,255,255,.028)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.075)" }}>
                  {/* what it was said about — the whole reason this view exists */}
                  {o && (
                    <Link href={o.href}
                      className="mb-3 inline-flex max-w-full items-center gap-2 px-2.5 py-1 transition hover:brightness-125"
                      style={{ clipPath: notch(6), background: `${o.tint}18`, boxShadow: `inset 0 0 0 1px ${o.tint}55` }}>
                      <o.Icon className="h-3 w-3 shrink-0" style={{ color: o.tint }} />
                      <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: o.tint }}>
                        {o.kind}
                      </span>
                      <span className="truncate text-[11px] font-bold text-slate-300">{o.label}</span>
                      {/* shrink-0: the title truncates, so a long one gives way
                          to the chapter rather than swallowing it. */}
                      {o.where && (
                        <>
                          <span className="shrink-0 text-[11px] font-bold text-slate-600">·</span>
                          <span className="shrink-0 text-[11px] font-black" style={{ color: o.tint }}>{o.where}</span>
                        </>
                      )}
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
                    </Link>
                  )}

                  <div className="flex items-start gap-3">
                    {c.user?.avatar ? (
                      <img src={cloudinaryFit(c.user.avatar, 80)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-700 text-xs font-black">
                        {(c.user?.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.user?.username ? (
                          // min-w-0 + truncate on the NAME: the guild chip is
                          // shrink-0, so a long username is what has to give
                          // way on a phone rather than the row overflowing.
                          <span className="flex min-w-0 items-center gap-1.5">
                            <UserLink username={c.user.username} className="min-w-0 truncate text-sm font-black text-white hover:underline">
                              {c.user.username}
                            </UserLink>
                            <GuildTag userId={c.user.id} size="sm" />
                          </span>
                        ) : (
                          <span className="text-sm font-black text-slate-400">someone</span>
                        )}
                        {/* Role and worn title. The Heart rank is suppressed
                            here on purpose: this list is dense, every row
                            already carries a source chip and two vote tallies,
                            and a rank on every line would crowd out the thing
                            the row exists for — the comment. */}
                        <UserBadges user={c.user} size="sm" showHeart={false} maxTitles={1} />
                        <span className="text-[10px] font-bold text-slate-600">{ago(c.createdAt)}</span>
                        {/* The loves and the dislikes, not a net number. This
                            list is ordered by loves-minus-dislikes, so showing
                            only the difference hid what the ranking is made of
                            — and a comment sitting at zero showed nothing at
                            all, whether it had no votes or fifty of each. */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-black tabular-nums text-rose-400">
                          <Heart className="h-3 w-3" /> {c.upvotes ?? Math.max(0, c.score ?? 0)}
                        </span>
                        {(c.downvotes ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black tabular-nums text-slate-500">
                            <ThumbsDown className="h-3 w-3" /> {c.downvotes}
                          </span>
                        )}
                      </div>
                      {c.content && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                          <MentionText text={c.content} />
                        </p>
                      )}
                      {c.mediaUrl && (
                        <img src={c.mediaUrl} alt="" loading="lazy"
                          className="mt-3 max-h-80 w-auto max-w-full object-contain"
                          style={{ clipPath: notch(12) }} />
                      )}
                      {o && (
                        <Link href={o.href}
                          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:text-white">
                          {o.where ? `Go to ${o.where}` : "Reply where it lives"} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
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
