"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Music } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfileSong({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = new Audio(src);
    el.loop = true;
    el.volume = 0.5;
    el.preload = "auto";
    audioRef.current = el;
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    return () => {
      el.pause();
      el.src = "";
      audioRef.current = null;
    };
  }, [src]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.volume = 0.5;
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={playing ? "Mute soundtrack" : "Play soundtrack"}
      title={playing ? "Soundtrack Playing (Tap to Mute)" : "Play Soundtrack"}
      className="group relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-black/85 text-violet-300 shadow-[0_8px_25px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-violet-400 hover:text-white"
    >
      {playing && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-violet-500/30"
        />
      )}
      
      {playing ? (
        <div className="flex items-end gap-0.5 h-3.5">
          <span className="w-1 bg-violet-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3" />
          <span className="w-1 bg-fuchsia-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.2s] h-4" />
          <span className="w-1 bg-violet-300 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.4s] h-2" />
        </div>
      ) : (
        <VolumeX className="h-4 w-4 opacity-75 group-hover:opacity-100" />
      )}
    </button>
  );
}
