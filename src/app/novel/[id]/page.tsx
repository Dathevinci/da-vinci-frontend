"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, Play, List, ChevronRight, User as UserIcon, Search } from "lucide-react";
import type { NovelInfo } from "@/lib/novel/ReadNovelFull";
import NovelTrackerButton from "@/components/novel/NovelTrackerButton";
import { novelCover } from "@/lib/novelImage";
import CommunityFeed from "@/components/community/CommunityFeed";

const MAX_LIST = 300; // cap rendered chapter links; the search box finds the rest

export default function NovelDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id));

  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterFilter, setChapterFilter] = useState("");
  const [lastRead, setLastRead] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/novels/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        setNovel(data && data.error ? null : data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    try {
      setLastRead(localStorage.getItem(`novel-progress:${id}`));
    } catch {
      /* ignore */
    }
  }, [id]);

  const cover = novelCover(novel?.cover);
  const chapters = novel?.chapters || [];
  const filtered = chapterFilter
    ? chapters.filter((c) => c.title.toLowerCase().includes(chapterFilter.toLowerCase()) || String(c.number).includes(chapterFilter))
    : chapters;
  const shown = filtered.slice(0, MAX_LIST);
  const firstCh = chapters[0];

  if (loading)
    return (
      <div className="min-h-screen bg-[#0b0b0c] pt-24 flex justify-center">
        <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
      </div>
    );
  if (!novel || !novel.title)
    return (
      <div className="min-h-screen bg-[#0b0b0c] pt-32 text-center text-slate-400">
        Novel not found. <Link href="/novel" className="text-pink-400 underline">Back to library</Link>
      </div>
    );

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-16 pb-16 text-white selection:bg-pink-500/30">
      {/* Hero */}
      <div className="relative">
        {cover && (
          <div className="absolute inset-0 h-72 overflow-hidden">
            <img src={cover} alt="" aria-hidden className="w-full h-full object-cover blur-2xl opacity-20 scale-110" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0b0b0c]" />
          </div>
        )}
        <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 pt-8 flex flex-col md:flex-row gap-8">
          <div className="w-[170px] md:w-[190px] shrink-0 mx-auto md:mx-0">
            <div className="w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#151518]">
              {cover ? (
                <img src={cover} alt={novel.title} className="w-full h-full object-cover hq-image" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <BookOpen className="w-12 h-12" />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-black leading-tight mb-3">{novel.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
              <span className="flex items-center gap-1 text-slate-300">
                <UserIcon className="w-4 h-4 text-pink-400" /> {novel.author}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs uppercase font-bold border ${
                  novel.status?.toLowerCase().includes("complet")
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-pink-500/10 text-pink-400 border-pink-500/20"
                }`}
              >
                {novel.status}
              </span>
              <span className="text-slate-500 text-xs">{chapters.length} chapters</span>
            </div>
            {novel.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {novel.genres.map((g) => (
                  <span key={g} className="text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded">
                    {g}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mb-6">
              {firstCh && (
                <Link
                  href={`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(firstCh.id)}`}
                  className="flex items-center gap-2 bg-pink-500 hover:bg-pink-400 text-black font-bold px-6 py-2.5 rounded-lg transition"
                >
                  <Play className="w-4 h-4 fill-current" /> Start Reading
                </Link>
              )}
              {lastRead && (
                <Link
                  href={`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(lastRead)}`}
                  className="flex items-center gap-2 bg-[#1e1e24] hover:bg-[#2a2a32] border border-white/10 font-bold px-6 py-2.5 rounded-lg transition"
                >
                  Continue
                </Link>
              )}
              <div className="w-full sm:w-48">
                <NovelTrackerButton novel={{ id, title: novel.title, cover: novel.cover }} />
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{novel.synopsis || "No synopsis available."}</p>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-xl font-black flex items-center gap-2">
            <List className="w-5 h-5 text-pink-400" /> Chapters
          </h2>
          <div className="relative w-full sm:w-64">
            <input
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value)}
              placeholder="Find a chapter…"
              className="w-full bg-[#151518] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-pink-500/50"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {shown.map((ch) => (
            <Link
              key={ch.id}
              href={`/novel/${encodeURIComponent(id)}/chapter/${encodeURIComponent(ch.id)}`}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors group ${
                lastRead === ch.id ? "bg-pink-500/10 border-pink-500/40" : "bg-[#151518] border-white/5 hover:border-pink-500/40 hover:bg-pink-500/5"
              }`}
            >
              <span className="text-sm text-slate-300 group-hover:text-pink-400 line-clamp-1">{ch.title}</span>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-pink-400 shrink-0" />
            </Link>
          ))}
        </div>
        {filtered.length === 0 && <p className="text-slate-500 text-sm py-6 text-center">No chapters match your search.</p>}
        {filtered.length > MAX_LIST && (
          <p className="text-slate-600 text-xs text-center mt-4">
            Showing first {MAX_LIST} of {filtered.length}. Use the search box to jump to a specific chapter.
          </p>
        )}
      </div>

      {/* Novel-level discussion (not per-chapter). Posts show on the community
          feed tagged with this novel. */}
      <div className="max-w-[1000px] mx-auto px-4 md:px-8 mt-12 border-t border-white/5 pt-4">
        <CommunityFeed novelId={id} novelTitle={novel.title} />
      </div>
    </div>
  );
}
