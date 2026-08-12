"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Clock, Star, ChevronUp, ChevronDown, CornerDownRight } from "lucide-react";
import { chapterNumberFromId } from "@/lib/manhwa/ids";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * RECENT COMMENTS — the reference's panel: who said what, on which series and
 * chapter, how long ago, and how they rated it.
 *
 * Every field is real. The rating pill is `authorRating`, joined server-side
 * from the commenter's own score for that title; a commenter who never rated
 * simply has no pill rather than a zero. The chapter chip is only rendered
 * when the comment actually carries a chapterId, and the link lands on that
 * exact chapter — same contract the Global Comments deep links use.
 */

type Row = {
  id: string;
  content: string;
  createdAt: string;
  mediaUrl?: string | null;
  parentId?: string | null;
  authorRating?: number | null;
  mangaId?: string | null;
  mangaTitle?: string | null;
  novelId?: string | null;
  novelTitle?: string | null;
  /** Anime comments. `episodeNo` deep-links to the exact episode. */
  animeId?: number | null;
  animeTitle?: string | null;
  episodeNo?: number | null;
  chapterId?: string | null;
  chapterTitle?: string | null;
  user?: { id: string; username: string; avatar?: string | null; activeColor?: string | null };
};

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)} seconds ago`;
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} minute${Math.floor(m) === 1 ? "" : "s"} ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} hour${Math.floor(h) === 1 ? "" : "s"} ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)} day${Math.floor(d) === 1 ? "" : "s"} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) === 1 ? "" : "s"} ago`;
};

/** Only reads a number where one provably is one — see chapterNumberFromId. */
function chapterLabel(title?: string | null, id?: string | null) {
  const t = (title || "").trim();
  if (t && !/^chapter$/i.test(t)) return t.length > 26 ? `${t.slice(0, 25)}…` : t;
  const n = chapterNumberFromId(id);
  return n ? `Ch. ${n}` : "Chapter";
}

export default function RecentMediaComments({
  source,
  title,
  accent = "#dc2626",
  chipLabel,
}: {
  source: "anime" | "manhwa" | "novel";
  title: string;
  accent?: string;
  chipLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = new URL(`${API_URL}/api/comments`);
        url.searchParams.set("global", "true");
        url.searchParams.set("sort", "newest");
        url.searchParams.set("limit", "30");
        url.searchParams.set("source", source);
        const r = await fetch(url.toString());
        const d = await r.json();
        const list = Array.isArray(d?.data) ? d.data : d?.data?.comments;
        if (alive) setRows(Array.isArray(list) ? list.filter((c: Row) => !c.parentId && c.content) : []);
      } catch {
        /* offline — the panel just doesn't render */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [source]);

  // Nothing to show and nothing loading: don't leave an empty box on the page.
  if (loaded && rows.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 md:px-8">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 md:p-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3.5 text-left"
          aria-expanded={open}
        >
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
            style={{ borderColor: `${accent}33`, background: `${accent}14`, color: accent }}
          >
            <MessageSquare className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-black tracking-tight text-white md:text-2xl">{title}</span>
            <span className="block font-mono text-xs text-slate-500">
              {loaded ? `${rows.length} comment${rows.length === 1 ? "" : "s"}` : "Loading…"}
            </span>
          </span>
          <span className="shrink-0 text-slate-500">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </span>
        </button>

        {open && (
          <ul className="mt-4 max-h-[520px] space-y-1 overflow-y-auto pr-1">
            {rows.map((c) => {
              /**
               * THREE MODES, and the branch has to be three-way.
               *
               * This was `isNovel ? novel : manhwa`, which meant every anime
               * comment resolved to /manhwa/<undefined> — the row rendered and
               * the link went nowhere. Anime is identified by `animeId`, and
               * it deep-links to an EPISODE rather than a chapter, so it needs
               * its own arm rather than being folded into the manhwa default.
               */
              const isAnime = c.animeId != null;
              const isNovel = !isAnime && !!c.novelId;
              const baseId = isAnime ? String(c.animeId) : isNovel ? c.novelId! : c.mangaId!;
              if (!baseId) return null;
              const root = isAnime ? "anime" : isNovel ? "novel" : "manhwa";
              const base = `/${root}/${encodeURIComponent(baseId)}`;
              // Anime deep-links by episode NUMBER on the watch route; the other
              // two carry an opaque chapter id.
              const href = isAnime
                ? (c.episodeNo ? `/watch/${encodeURIComponent(baseId)}?ep=${c.episodeNo}` : base)
                : c.chapterId
                ? `${base}/chapter/${encodeURIComponent(c.chapterId)}`
                : base;
              const seriesTitle =
                (isAnime ? c.animeTitle : isNovel ? c.novelTitle : c.mangaTitle) || baseId;

              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    className="flex gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.04]"
                  >
                    {c.user?.avatar ? (
                      <img src={c.user.avatar} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-700 text-xs font-black text-white">
                        {(c.user?.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="truncate text-sm font-black"
                          style={{ color: c.user?.activeColor || "#7dd3fc" }}
                        >
                          {c.user?.username || "someone"}
                        </span>
                        <CornerDownRight className="h-3 w-3 shrink-0 text-slate-600" />
                      </span>

                      <span className="mt-0.5 block truncate text-sm text-slate-300">{c.content}</span>

                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-black"
                          style={{ background: "rgba(34,197,94,.14)", color: "#4ade80" }}
                        >
                          {chipLabel}
                        </span>
                        <span className="truncate font-mono text-[11px] text-slate-500">{seriesTitle}</span>
                        {c.chapterId && (
                          <span className="font-mono text-[11px] text-slate-600">
                            · {chapterLabel(c.chapterTitle, c.chapterId)}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" /> {ago(c.createdAt)}
                      </span>
                      {typeof c.authorRating === "number" && c.authorRating > 0 && (
                        <span className="flex items-center gap-1 font-mono text-[11px] font-black text-amber-300">
                          <Star className="h-3 w-3 fill-amber-300" /> {c.authorRating}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
