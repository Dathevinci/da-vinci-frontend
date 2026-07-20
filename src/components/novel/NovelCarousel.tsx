"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import NovelCard from "@/components/novel/NovelCard";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";

interface NovelCarouselProps {
  title: string;
  items: NovelResult[];
  icon?: React.ReactNode;
  seeAllLink?: string;
}

// Horizontal, snap-scrolling shelf of novel covers — the novel twin of
// ManhwaCarousel / AnimeCarousel, so all three modes share the Netflix feel.
export default function NovelCarousel({ title, items, icon, seeAllLink = "/novel?view=all" }: NovelCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      rowRef.current.scrollTo({ left: direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth, behavior: "smooth" });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8 md:mb-10 relative group pl-4 md:pl-12 hover:z-50 z-10 transition-all duration-300">
      <h2 className="text-xl md:text-2xl font-bold text-[#e5e5e5] mb-2 md:mb-4 px-2 flex items-center gap-2.5">
        {icon}
        {title}
      </h2>

      <div className="relative">
        <button
          onClick={() => handleScroll("left")}
          aria-label="Scroll left"
          className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-12 md:h-12 bg-black/60 border border-white/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:scale-110 hover:border-pink-500/60 transition-all backdrop-blur-md shadow-2xl"
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white hover:text-pink-500" />
        </button>

        <div
          ref={rowRef}
          style={{ overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
          className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar scroll-smooth px-3 pt-8 pb-12 -mt-4 -mb-4 snap-x"
        >
          {items.map((m) => (
            <div key={m.id} className="snap-start shrink-0 w-[132px] sm:w-[150px] md:w-[178px]">
              <NovelCard novel={m} />
            </div>
          ))}

          <Link href={seeAllLink} className="snap-start shrink-0">
            <div className="relative w-[132px] sm:w-[150px] md:w-[178px] aspect-[2/3] rounded-lg flex items-center justify-center bg-[#141414]/40 border border-white/5 hover:bg-[#141414]/80 transition-colors cursor-pointer group/card hover:scale-105 duration-300 hover:shadow-[0_0_30px_rgba(236,72,153,0.2)] hover:border-pink-500/40">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full border-2 border-white/10 flex items-center justify-center group-hover/card:border-pink-500 transition-colors bg-black/40 shadow-lg">
                  <ChevronRight className="w-8 h-8 text-white group-hover/card:translate-x-1 group-hover/card:text-pink-500 transition-all" />
                </div>
                <span className="text-slate-400 font-bold tracking-widest uppercase text-xs group-hover/card:text-white transition-colors">See All</span>
              </div>
            </div>
          </Link>
        </div>

        <button
          onClick={() => handleScroll("right")}
          aria-label="Scroll right"
          className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-12 md:h-12 bg-black/60 border border-white/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:scale-110 hover:border-pink-500/60 transition-all backdrop-blur-md shadow-2xl"
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white hover:text-pink-500" />
        </button>
      </div>
    </div>
  );
}
