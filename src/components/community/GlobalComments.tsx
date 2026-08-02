"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Globe, Tv, BookMarked, BookOpen, ArrowRight, Loader2, MessagesSquare, Info } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import UserLink from "@/components/profile/UserLink";
import { ACCENT, ACCENT_LIT, notch } from "@/components/cards/gacha";

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
  user?: { id: string; username: string; avatar?: string | null };
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

/** Where a comment lives, and the link back to it. */
function origin(c: Row) {
  if (c.animeId) return { label: c.animeTitle || "Anime", href: `/anime/${c.animeId}`, Icon: Tv, tint: "#c084fc", kind: "Anime" };
  if (c.mangaId) return { label: c.mangaTitle || "Manhwa", href: `/manhwa/${c.mangaId}`, Icon: BookMarked, tint: "#f87171", kind: "Manhwa" };
  if (c.novelId) return { label: c.novelTitle || "Novel", href: `/novel/${c.novelId}`, Icon: BookOpen, tint: "#f472b6", kind: "Novel" };
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
      url.searchParams.set("sort", sort);
      url.searchParams.set("limit", "40");
      if (source !== "all") url.searchParams.set("source", source);
      if (user?.id) url.searchParams.set("userId", user.id);
      const r = await fetch(url.toString());
      const d = await r.json();
      const list = Array.isArray(d?.data) ? d.data : d?.data?.comments;
      setRows(Array.isArray(list) ? list.filter((c: any) => !c.parentId) : []);
    } catch {
      /* offline */
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
            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{ clipPath: notch(6), background: `${ACCENT}22`, boxShadow: `inset 0 0 0 1px ${ACCENT}66`, color: ACCENT_LIT }}>
              Read only
            </span>
          </div>
        </div>

        {/* ── WHY THIS IS READ ONLY ── said once, plainly, at the top ── */}
        <div className="mb-6 flex flex-wrap items-start gap-3 px-4 py-3.5"
          style={{ clipPath: notch(14), background: `${ACCENT}12`, boxShadow: `inset 0 0 0 1px ${ACCENT}44` }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT_LIT }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-slate-300">
              Discussion has moved to the <b className="text-white">Forum</b>. This page is a live window onto every
              comment left on an anime, manhwa or novel across the site — you can read and follow them here, but replies
              belong on the thing they&rsquo;re about, so each card links you straight there.
            </p>
          </div>
          <Link href="/community"
            className="inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-115"
            style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)", background: `linear-gradient(100deg, #7c3aed, ${ACCENT})` }}>
            Go to forum <ArrowRight className="h-3 w-3" />
          </Link>
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
            {([["newest", "Recent"], ["top", "Top"]] as const).map(([k, label]) => (
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
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
                    </Link>
                  )}

                  <div className="flex items-start gap-3">
                    {c.user?.avatar ? (
                      <img src={c.user.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-700 text-xs font-black">
                        {(c.user?.username || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.user?.username ? (
                          <UserLink username={c.user.username} className="text-sm font-black text-white hover:underline">
                            {c.user.username}
                          </UserLink>
                        ) : (
                          <span className="text-sm font-black text-slate-400">someone</span>
                        )}
                        <span className="text-[10px] font-bold text-slate-600">{ago(c.createdAt)}</span>
                        {typeof c.score === "number" && c.score !== 0 && (
                          <span className="text-[10px] font-black tabular-nums"
                            style={{ color: c.score > 0 ? ACCENT_LIT : "#f87171" }}>
                            {c.score > 0 ? "+" : ""}{c.score}
                          </span>
                        )}
                      </div>
                      {c.content && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                          {c.content}
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
                          Reply where it lives <ArrowRight className="h-3 w-3" />
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
