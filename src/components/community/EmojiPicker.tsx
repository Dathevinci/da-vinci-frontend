"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile, X } from "lucide-react";

/**
 * EMOJI PICKER — a small, dependency-free panel. Portaled and viewport-
 * anchored so it escapes the composer's scroll container, and stacked
 * above the anime detail overlay (z-9999) like the GIF panel.
 *
 * No emoji library: a curated set covers what people actually reach for
 * in an anime comment section, and it costs zero kilobytes.
 *
 * GUILD CUSTOM EMOJI are an OPTIONAL extra section, not a second picker.
 * `customEmojis` is undefined for every caller outside a guild room, and an
 * absent (or empty) list renders exactly the panel that shipped before this
 * existed. `onPick` still hands back a plain string — a custom emoji emits its
 * `:shortcode:`, which is what gets stored and what `EmojiText` renders — so no
 * caller has to learn a new signature.
 */

export type PickerCustomEmoji = {
  id: string;
  name: string;
  url: string;
  animated?: boolean;
};

const GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Reactions",
    emoji: ["😂", "🤣", "😭", "😍", "🥰", "😳", "😱", "🤯", "😤", "😎", "🥺", "😅", "😊", "🙃", "😴", "🤔", "😐", "💀", "👀", "🔥"],
  },
  {
    label: "Hype",
    emoji: ["🔥", "💯", "⚡", "✨", "🌟", "💥", "🚀", "🏆", "👑", "🥇", "🎉", "🎊", "📈", "⭐", "💫", "🗿", "🤝", "👏", "🙌", "💪"],
  },
  {
    label: "Feelings",
    emoji: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💗", "😢", "😥", "🥹", "😔", "🫠", "🫶", "🥲"],
  },
  {
    label: "Anime",
    emoji: ["⚔️", "🗡️", "🛡️", "🏹", "🔮", "🧿", "🌸", "🍥", "🍜", "🍙", "🎌", "⛩️", "🥷", "🧙", "🐉", "👹", "👺", "🦊", "🌊", "🌙"],
  },
];

export default function EmojiPicker({
  onPick,
  label = "Emoji",
  customEmojis,
}: {
  onPick: (emoji: string) => void;
  label?: string;
  /** This guild's custom emoji. Omitted everywhere but a guild room. */
  customEmojis?: PickerCustomEmoji[];
}) {
  // Normalised once so the render path never has to care about undefined,
  // and so "prop absent" and "prop empty" behave identically.
  const custom = Array.isArray(customEmojis) ? customEmojis : [];

  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(t) &&
          rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, { capture: true } as any);
    };
  }, [open]);

  const W = 320;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = rect ? Math.min(Math.max(8, rect.left), Math.max(8, vw - W - 8)) : 8;
  const spaceBelow = rect ? vh - rect.bottom : vh;
  const openUp = rect ? spaceBelow < 320 && rect.top > spaceBelow : false;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          if (open) { setOpen(false); return; }
          setRect(rootRef.current?.getBoundingClientRect() || null);
          setOpen(true);
        }}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold transition ${
          open
            ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
            : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Smile className="h-3.5 w-3.5" /> {label}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left,
            width: W,
            zIndex: 10000,
            ...(openUp && rect ? { bottom: vh - rect.top + 8 } : { top: (rect?.bottom ?? 0) + 8 }),
          }}
          className="overflow-hidden rounded-xl border border-white/10 bg-[#101018] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="font-mono text-[11px] font-black uppercase tracking-wider text-slate-400">Emoji</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"
              className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain p-2">
            {custom.length > 0 && (
              <div className="mb-3">
                <p className="px-1 pb-1 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/70">
                  Guild
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {custom.map((e, i) => (
                    <button
                      key={e.id || `${e.name}-${i}`}
                      type="button"
                      onClick={() => { onPick(`:${e.name}:`); setOpen(false); }}
                      title={`:${e.name}:`}
                      aria-label={`:${e.name}:`}
                      className="grid h-11 w-full place-items-center rounded-lg transition hover:bg-white/10"
                    >
                      <img
                        src={e.url}
                        alt={`:${e.name}:`}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="h-7 w-7 object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-2 last:mb-0">
                <p className="px-1 pb-1 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">{g.label}</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {g.emoji.map((e, i) => (
                    <button
                      key={`${g.label}-${i}`}
                      type="button"
                      onClick={() => { onPick(e); setOpen(false); }}
                      className="grid h-7 place-items-center rounded text-lg transition hover:bg-white/10"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
