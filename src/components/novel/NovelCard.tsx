"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";

export default function NovelCard({ novel }: { novel: NovelResult }) {
  const cover = novel.cover ? `/api/novel-image?url=${encodeURIComponent(novel.cover)}` : null;

  return (
    <Link href={`/novel/${encodeURIComponent(novel.id)}`} className="group flex flex-col">
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-lg bg-[#151518] border border-white/5 group-hover:border-amber-500/50 shadow-md transition-colors">
        {cover ? (
          <img
            src={cover}
            alt={novel.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 hq-image"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <BookOpen className="w-10 h-10" />
          </div>
        )}
      </div>
      <h3 className="mt-2 text-[13px] font-bold text-[#e2e8f0] leading-tight line-clamp-2 group-hover:text-amber-400 transition-colors">
        {novel.title}
      </h3>
      {novel.latestChapter && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{novel.latestChapter}</p>}
    </Link>
  );
}
