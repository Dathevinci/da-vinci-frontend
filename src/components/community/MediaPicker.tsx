"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Loader2, Search, X, Clapperboard } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

/**
 * MEDIA PICKER — the two ways a post or comment gets a picture:
 *
 *  · UPLOAD — a real file off the user's device, sent straight to
 *    Cloudinary with the same unsigned preset the avatar/update flows
 *    already use. Only the returned URL travels to our backend, so the
 *    existing mediaUrl pipe needs no changes.
 *  · GIF — a searchable KLIPY panel. Per KLIPY's integration terms the
 *    requests go directly from the browser (no proxy), results render in
 *    their returned order in a dedicated grid, media loads from their
 *    URLs untouched, and the panel carries KLIPY branding.
 *
 * Both end the same way: onChange(url).
 */

type KlipyFileVariant = { url?: string; width?: number; height?: number };
type KlipyFormats = { gif?: KlipyFileVariant; webp?: KlipyFileVariant; jpg?: KlipyFileVariant };
type KlipyGif = {
  id: number | string;
  title?: string;
  blur_preview?: string;
  file?: { hd?: KlipyFormats; md?: KlipyFormats; sm?: KlipyFormats; xs?: KlipyFormats };
};

const KLIPY_KEY = process.env.NEXT_PUBLIC_KLIPY_APP_KEY;

function pickUrl(g: KlipyGif): string | null {
  const f = g.file;
  return f?.md?.gif?.url || f?.hd?.gif?.url || f?.sm?.gif?.url || f?.md?.webp?.url || null;
}
function thumbUrl(g: KlipyGif): string | null {
  const f = g.file;
  return f?.sm?.webp?.url || f?.xs?.webp?.url || f?.sm?.gif?.url || f?.xs?.gif?.url || g.blur_preview || null;
}

export default function MediaPicker({
  value,
  onChange,
  userId,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Stable id for KLIPY's customer_id — keeps their recents/ranking sane. */
  userId?: string | number;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  // The whole control row — the GIF panel's outside-click test must treat
  // the toggle button as INSIDE, or mousedown closes the panel and the
  // click that follows immediately reopens it: a toggle that can't close.
  const rootRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast("Image uploads aren't configured yet.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("That image is over 10MB — pick a smaller one.", "error");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) onChange(data.secure_url);
      else toast("Upload failed — try again.", "error");
    } catch {
      toast("Upload failed — try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-[11px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (gifOpen) { setGifOpen(false); return; }
            setAnchorRect(rootRef.current?.getBoundingClientRect() || null);
            setGifOpen(true);
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-black transition ${
            gifOpen
              ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
              : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Clapperboard className="h-3.5 w-3.5" /> GIF
        </button>
        {value && (
          <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] py-1 pl-1 pr-2">
            <img src={value} alt="" className="h-7 w-10 rounded object-cover" />
            <button type="button" onClick={() => onChange("")} aria-label="Remove attachment"
              className="text-slate-500 transition hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
      </div>

      {gifOpen && (
        <GifPanel
          userId={userId}
          anchorRect={anchorRect}
          anchorRef={rootRef}
          onPick={(url) => { onChange(url); setGifOpen(false); }}
          onClose={() => setGifOpen(false)}
        />
      )}
    </div>
  );
}

function GifPanel({
  userId,
  anchorRect,
  anchorRef,
  onPick,
  onClose,
}: {
  userId?: string | number;
  anchorRect: DOMRect | null;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Every fetch belongs to a generation; a response from a superseded
  // generation is discarded. Without this, a slow Load More landing after
  // a fresh search appended the OLD query's page onto the new grid.
  const genRef = useRef(0);

  // Outside tap closes — outside the PANEL and outside the TOGGLE ROW
  // (the panel is portaled, so it isn't a DOM child of the row anymore).
  // Any scroll closes too: the panel is viewport-fixed and its anchor
  // lives inside scrollable composers, so it would drift off its button.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(t) &&
          anchorRef.current && !anchorRef.current.contains(t)) onClose();
    };
    const onScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, { capture: true } as any);
    };
  }, [onClose, anchorRef]);

  // Trending on open; search debounced. Fresh query resets to page 1.
  useEffect(() => {
    if (!KLIPY_KEY) return;
    const gen = ++genRef.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const data = await fetchKlipy(q, 1, userId);
        if (genRef.current !== gen) return;
        setGifs(data.items);
        setHasNext(data.hasNext);
        setPage(1);
      } finally {
        if (genRef.current === gen) setBusy(false);
      }
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, userId]);

  const loadMore = async () => {
    if (!KLIPY_KEY || busy) return;
    const gen = genRef.current;
    setBusy(true);
    try {
      const next = page + 1;
      const data = await fetchKlipy(q, next, userId);
      if (genRef.current !== gen) return; // the query moved on
      setGifs((g) => [...g, ...data.items]);
      setHasNext(data.hasNext);
      setPage(next);
    } finally {
      if (genRef.current === gen) setBusy(false);
    }
  };

  // Viewport-fixed placement: composers scroll and clip, so the panel
  // escapes to a portal and anchors to where the button row was.
  const W = 340;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = anchorRect ? Math.min(Math.max(8, anchorRect.left), Math.max(8, vw - W - 8)) : 8;
  const spaceBelow = anchorRect ? vh - anchorRect.bottom : vh;
  const openUp = anchorRect ? spaceBelow < 420 && anchorRect.top > spaceBelow : false;
  // Above EVERYTHING — the anime detail overlay is z-9999, and a z-200
  // panel opened from its Discussions tab rendered invisibly behind it
  // (while working fine on manhwa/novel pages and the forum).
  const Z = 10000;
  const pos: React.CSSProperties = anchorRect
    ? openUp
      ? { position: "fixed", left, bottom: vh - anchorRect.top + 8, zIndex: Z }
      : { position: "fixed", left, top: anchorRect.bottom + 8, zIndex: Z }
    : { position: "fixed", left: 8, bottom: 8, zIndex: Z };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      style={{ ...pos, width: W }}
      className="overflow-hidden rounded-xl border border-white/10 bg-[#101018] shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-white/10 p-2.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 pl-8 pr-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-white/25 focus:outline-none"
          />
        </div>
        <button type="button" onClick={onClose} aria-label="Close GIF search"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!KLIPY_KEY ? (
        <p className="p-4 font-mono text-xs leading-relaxed text-slate-500">
          GIF search needs a KLIPY app key. Create one free at klipy.com and set
          <span className="text-slate-300"> NEXT_PUBLIC_KLIPY_APP_KEY</span> in the environment.
        </p>
      ) : (
        <>
          <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain p-2">
            {gifs.map((g) => {
              const thumb = thumbUrl(g);
              const full = pickUrl(g);
              if (!thumb || !full) return null;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onPick(full)}
                  title={g.title || "GIF"}
                  className="aspect-square overflow-hidden rounded-lg border border-white/5 bg-black/40 transition hover:border-white/30"
                >
                  <img src={thumb} alt={g.title || ""} loading="lazy" className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
          {busy && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            </div>
          )}
          {!busy && gifs.length === 0 && (
            <p className="p-4 text-center font-mono text-xs text-slate-500">No GIFs found.</p>
          )}
          {!busy && hasNext && (
            <button type="button" onClick={loadMore}
              className="w-full border-t border-white/10 py-2 font-mono text-[11px] font-bold text-slate-400 transition hover:bg-white/5 hover:text-white">
              Load more
            </button>
          )}
          <p className="border-t border-white/10 py-1.5 text-center font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
            Powered by KLIPY
          </p>
        </>
      )}
    </div>,
    document.body
  );
}

async function fetchKlipy(q: string, page: number, userId?: string | number) {
  const base = `https://api.klipy.com/api/v1/${KLIPY_KEY}`;
  const params = new URLSearchParams({
    page: String(page),
    per_page: "24",
    content_filter: "medium",
    format_filter: "gif,webp",
  });
  if (userId !== undefined) params.set("customer_id", String(userId));
  if (q.trim()) params.set("q", q.trim());
  const path = q.trim() ? "gifs/search" : "gifs/trending";
  try {
    const res = await fetch(`${base}/${path}?${params}`);
    const json = await res.json();
    const items: KlipyGif[] = json?.data?.data || [];
    return { items, hasNext: !!json?.data?.has_next };
  } catch {
    return { items: [], hasNext: false };
  }
}
