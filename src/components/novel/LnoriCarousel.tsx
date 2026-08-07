"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ChevronRight, ChevronLeft, BookOpen } from "lucide-react";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import LnoriCard from "@/components/novel/LnoriCard";
import RosePetals from "@/components/novel/RosePetals";

interface LnoriCarouselProps {
  title: string;
  items: NovelResult[];
  exploreHref?: string;
}

export default function LnoriCarousel({ title, items, exploreHref }: LnoriCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(inViewRef, { once: true, margin: "-50px" });

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!items.length) return null;

  return (
    <section ref={inViewRef} className="relative w-full py-10 overflow-hidden">
      {/* Unique glowing backdrop */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-pink-500/5 to-purple-500/10 blur-3xl pointer-events-none opacity-50" />
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#070709] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#070709] to-transparent z-10 pointer-events-none" />

      <div className="relative z-20 flex items-end justify-between px-4 sm:px-6 md:px-8 max-w-[2000px] mx-auto">
        {/* `relative` anchors the petals to the wordmark, and they sit at a
            lower z than the text so they drift behind it rather than over it. */}
        <div className="relative flex items-center gap-3">
          <RosePetals />
          <div className="relative z-10 p-2 rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl sm:text-2xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-pink-300 uppercase tracking-widest">
              {title}
            </h2>
            <p className="text-xs font-mono text-amber-200/60 mt-1 uppercase tracking-widest">Complete Volumes</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {exploreHref && (
            <Link
              href={exploreHref}
              className="flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-wider text-amber-300/80 hover:text-amber-300 transition-colors mr-2"
            >
              See All <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          <button
            onClick={() => scroll("left")}
            className="p-2 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition backdrop-blur-md"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-2 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition backdrop-blur-md"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative z-20 mt-6 max-w-[2000px] mx-auto">
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto px-4 sm:px-6 md:px-8 pb-8 pt-4 hide-scrollbar snap-x snap-mandatory"
        >
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 snap-start group relative"
            >
              {/* The shelf shares the grid's card so both get the hover
                  dossier and, more importantly, the same three-stage cover
                  fallback. Duplicating that here is how the two drifted into
                  showing different art for the same book. */}
              <div className="w-[140px] sm:w-[160px] md:w-[180px]">
                <LnoriCard novel={item} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
