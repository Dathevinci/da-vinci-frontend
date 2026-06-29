"use client";

import { motion } from "framer-motion";
import AnimeCard from "@/components/anime/AnimeCard";

export default function AnimatedGrid({ animes }: { animes: any[] }) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
    >
      {animes.map((anime) => (
        <motion.div key={anime.id} variants={item} className="h-full">
          <AnimeCard anime={anime} />
        </motion.div>
      ))}
    </motion.div>
  );
}
