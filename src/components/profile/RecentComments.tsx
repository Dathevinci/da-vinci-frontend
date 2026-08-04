"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { Panel, Heading, notch, ACCENT } from "@/components/cards/gacha";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * RECENT COMMENTS — what this person has actually been saying.
 *
 * A profile that only shows counters says how much someone posts but nothing
 * about who they are. This is the cheapest way to fix that: the comments API
 * already filters by userId, so it is one read.
 *
 * Renders nothing when there are no comments, so a quiet profile does not grow
 * an empty box.
 */

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  upvotes?: number;
  downvotes?: number;
  animeId?: number | null;
  mangaId?: string | null;
  novelId?: string | null;
  animeTitle?: string | null;
  mangaTitle?: string | null;
  novelTitle?: string | null;
  chapterId?: string | null;
  chapterTitle?: string | null;
  episodeNo?: number | null;
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** The chapter number out of whatever the reader stored — see the twin of
 *  this in GlobalComments for why the tail, not the whole id. */
function chapterLabel(title?: string | null, id?: string | null) {
  const t = (title || "").trim();
  if (t && !/^chapter$/i.test(t)) return t.length > 24 ? `${t.slice(0, 23)}…` : t;
  const tail = (id || "").split("|").pop() || "";
  const n = tail.match(/(\d+(?:\.\d+)?)/);
  return n ? `Ch. ${n[1]}` : "Chapter";
}

/** Where the comment was left, and where clicking should go — the exact
 *  chapter or episode when we have it, the series page when we don't. */
function target(c: Comment): { label: string; href: string | null } {
  if (c.animeId) {
    const ep = typeof c.episodeNo === "number" && c.episodeNo > 0 ? c.episodeNo : null;
    const title = c.animeTitle || "Anime";
    return ep
      ? { label: `${title} · Ep. ${ep}`, href: `/watch/${c.animeId}?ep=${ep}` }
      : { label: title, href: `/anime/${c.animeId}?tab=discussions` };
  }
  // slug ids must be encoded — see GlobalComments for the same fix
  if (c.mangaId) {
    const base = `/manhwa/${encodeURIComponent(c.mangaId)}`;
    const title = c.mangaTitle || "Manhwa";
    return c.chapterId
      ? { label: `${title} · ${chapterLabel(c.chapterTitle, c.chapterId)}`, href: `${base}/chapter/${encodeURIComponent(c.chapterId)}` }
      : { label: title, href: base };
  }
  if (c.novelId) {
    const base = `/novel/${encodeURIComponent(c.novelId)}`;
    const title = c.novelTitle || "Novel";
    return c.chapterId
      ? { label: `${title} · ${chapterLabel(c.chapterTitle, c.chapterId)}`, href: `${base}/chapter/${encodeURIComponent(c.chapterId)}` }
      : { label: title, href: base };
  }
  return { label: "Discussion", href: null };
}

export default function RecentComments({ userId }: { userId: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/comments?userId=${userId}&limit=8&sort=new`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.data) ? d.data : d?.data?.comments;
        if (Array.isArray(list)) setItems(list.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || items.length === 0) return null;

  return (
    <Panel size={20} className="mb-6">
      <div className="relative p-5">
        <Heading
          title="Recent comments"
          sub={`${items.length} shown`}
          right={<MessageSquare className="h-4 w-4" style={{ color: ACCENT }} />}
        />

        {/* A horizontal rail keeps this from dominating the page the way a
            stacked list would, and matches how the rest of the site shows
            "things you've touched". */}
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {items.map((c) => {
            const t = target(c);
            const body = (
              <div className="flex h-full w-[248px] shrink-0 flex-col px-3.5 py-3"
                style={{ clipPath: notch(12), background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                <p className="truncate text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: ACCENT }}>
                  {t.label}
                </p>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-300">
                  {c.content}
                </p>
                <div className="mt-2.5 flex items-center gap-3 border-t border-white/8 pt-2 text-[10px] font-bold text-slate-600">
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{c.upvotes ?? 0}</span>
                  <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3 w-3" />{c.downvotes ?? 0}</span>
                  <span className="ml-auto">{when(c.createdAt)}</span>
                </div>
              </div>
            );
            return t.href ? (
              <Link key={c.id} href={t.href} className="transition hover:-translate-y-0.5">{body}</Link>
            ) : (
              <div key={c.id}>{body}</div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
