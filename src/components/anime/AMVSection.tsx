"use client";

import { PlayCircle } from "lucide-react";

export default function AMVSection() {
  const amvs = [
    { id: "Jv1Zq32eD-Q", title: "Jujutsu Kaisen - Hollow Purple" },
    { id: "MGRm4IzK1SQ", title: "Attack on Titan - Warriors" },
    { id: "pmanD_s7G3U", title: "Demon Slayer - Thunder" },
  ];

  return (
    <div className="container mx-auto px-4 md:px-12 mt-12 mb-20 relative z-30">
      <div className="flex items-center gap-3 mb-6">
        <PlayCircle className="w-8 h-8 text-secondary animate-pulse" />
        <h2 className="text-2xl md:text-3xl font-black text-white">Epic AMVs & Edits</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {amvs.map((amv) => (
          <div key={amv.id} className="relative group rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/5 bg-[#141414] aspect-video transition-transform hover:scale-[1.02] duration-300">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${amv.id}?controls=1&rel=0`}
              title={amv.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ))}
      </div>
    </div>
  );
}
