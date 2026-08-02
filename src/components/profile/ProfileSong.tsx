"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * THE PROFILE SONG — one page on the platform has a soundtrack.
 *
 * Renders as a speaker button beside the avatar. The song loops at HALF
 * volume by design — it is atmosphere, not an ambush — and the button is
 * the whole contract: tap to play, tap to silence.
 *
 * Autoplay is ATTEMPTED on arrival and almost always refused (browsers
 * require a gesture before audible playback), and that refusal is this
 * button's reason to exist: when the attempt bounces, the speaker simply
 * waits in its muted state. Playback always stops on unmount — the song
 * belongs to the profile, not to the app.
 */
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
    return () => { el.pause(); el.src = ""; audioRef.current = null; };
  }, [src]);

  const toggle = (e: React.MouseEvent) => {
    // The avatar behind this opens an image preview on click.
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
      aria-label={playing ? "Mute the profile song" : "Play the profile song"}
      title={playing ? "Playing — tap to mute" : "This profile has a song — tap to play"}
      className="relative grid h-10 w-10 place-items-center rounded-full border-2 border-[#0b0b12] bg-black/85 text-purple-200 shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition hover:text-white"
    >
      {playing && (
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-purple-500/30" />
      )}
      {playing
        ? <Volume2 className="relative h-4 w-4" />
        : <VolumeX className="relative h-4 w-4 opacity-80" />}
    </button>
  );
}
