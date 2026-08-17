"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Play, Star } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";
import { getYouTubeId } from "@/lib/jikan";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * THE HOVER PREVIEW — the reference behaviour: rest the pointer on a card
 * and a floating dossier fades in and FOLLOWS the mouse around that card;
 * keep hovering and the header quietly starts the trailer.
 *
 * The panel is pointer-events-none on purpose: the mouse always stays on
 * the card underneath, so clicks land on the card, mouseleave still fires
 * cleanly, and the panel can never trap the cursor.
 *
 * Wrap any anime card in it:  <HoverPreview anime={a}>{card}</HoverPreview>
 */

const W = 360;
const H = 430;
const SHOW_DELAY = 450;
const TRAILER_DELAY = 2600;

export default function HoverPreview({ anime, children }: { anime: Anime; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const [trailerOn, setTrailerOn] = useState(false);
  const { preferences } = usePreferences();
  const reduce = preferences.reducedMotion;
  // The user's Autoplay Trailers and Data Saver toggles apply HERE too — a
  // setting that silently skips a surface isn't a setting. (This used to cite
  // AnimeBackgroundTrailer as the sibling gate; that component is deleted.)
  const trailerAllowed = !reduce && preferences.autoplayTrailers && !preferences.dataSaver;

  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (trailerTimer.current) clearTimeout(trailerTimer.current);
    showTimer.current = null;
    trailerTimer.current = null;
  };

  const hide = () => {
    clearTimers();
    setShow(false);
    setTrailerOn(false);
  };

  // Scroll anywhere dismisses — a mouse-following panel over a moving page
  // ends up hovering the wrong card.
  useEffect(() => {
    if (!show) return;
    const dismiss = () => hide();
    window.addEventListener("scroll", dismiss, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", dismiss, { capture: true } as any);
  }, [show]);

  useEffect(() => () => { clearTimers(); cancelAnimationFrame(raf.current); }, []);

  const place = () => {
    const el = panelRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, x - W / 2), vw - W - 8);
    // above the cursor when there's room, below it otherwise
    const top = y - H - 18 > 8 ? y - H - 18 : Math.min(y + 22, vh - H - 8);
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(8, top)}px`;
  };

  const onMove = (e: React.MouseEvent) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    if (show) {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(place);
    }
  };

  const onEnter = (e: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    posRef.current = { x: e.clientX, y: e.clientY };
    clearTimers();
    showTimer.current = setTimeout(() => {
      setShow(true);
      if (trailerAllowed && getYouTubeId(anime.trailer)) {
        trailerTimer.current = setTimeout(() => setTrailerOn(true), TRAILER_DELAY);
      }
    }, SHOW_DELAY);
  };

  const title = (anime.title_english || anime.title || "") as string;
  const poster = (anime.images?.jpg?.image_url || anime.images?.jpg?.large_image_url || "") as string;
  const banner = (anime.trailer?.images?.maximum_image_url || anime.images?.jpg?.large_image_url || poster) as string;
  const youtubeId = getYouTubeId(anime.trailer);
  const statusRaw = String((anime as any)._anilistStatus || anime.status || "").toLowerCase();
  const statusLabel = statusRaw.includes("releasing") || statusRaw.includes("airing")
    ? "Releasing"
    : statusRaw.includes("finished") ? "Finished"
      : statusRaw.includes("not_yet") || statusRaw.includes("upcoming") || statusRaw.includes("not yet") ? "Upcoming"
        : null;

  return (
    // onClickCapture: a click opens the detail overlay over a STATIONARY
    // pointer — mouseleave never fires, and without this the pending
    // trailer timer mounted a looping iframe invisibly behind the overlay.
    <div onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={hide} onClickCapture={hide} className="contents">
      {children}
      {show && typeof document !== "undefined" && createPortal(
        <div
          ref={(el) => { (panelRef as any).current = el; if (el) place(); }}
          style={{ position: "fixed", width: W, zIndex: 120 }}
          className="hp-in pointer-events-none overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] shadow-[0_30px_80px_rgba(0,0,0,.85)]"
        >
          {/* header: art, replaced by the trailer after a long hover */}
          <div className="relative h-40 w-full overflow-hidden bg-black">
            {trailerOn && youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&modestbranding=1&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&fs=0`}
                allow="autoplay; encrypted-media"
                tabIndex={-1}
                className="pointer-events-none absolute left-1/2 top-1/2 h-[220%] w-[177%] -translate-x-1/2 -translate-y-1/2 border-0"
                title=""
              />
            ) : (
              banner && <img src={banner} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] to-transparent" />
          </div>

          <div className="relative px-4 pb-4">
            {/* poster + badges + title */}
            <div className="-mt-12 flex items-end gap-3">
              {poster && (
                <img src={poster} alt="" className="h-24 w-16 shrink-0 rounded-lg border border-white/20 object-cover shadow-xl" />
              )}
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {statusLabel && (
                    <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-200 backdrop-blur">
                      {statusLabel}
                    </span>
                  )}
                  {anime.score ? (
                    <span className="flex items-center gap-1 rounded-md bg-amber-400/90 px-2 py-0.5 font-mono text-[10px] font-black text-black">
                      <Star className="h-2.5 w-2.5 fill-current" /> {(anime.score * 10).toFixed(0)}%
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 font-mono text-base font-black leading-snug text-white">{title}</p>
              </div>
            </div>

            {(anime.genres?.length || 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {anime.genres!.slice(0, 3).map((g) => (
                  <span key={g.name} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {anime.synopsis && (
              <p className="mt-3 line-clamp-2 font-mono text-xs leading-relaxed text-slate-400">
                {anime.synopsis}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-3.5">
              {[
                ["Format", anime.type || "TV"],
                ["Year", anime.year ? String(anime.year) : "—"],
                ["Episodes", anime.episodes ? `${anime.episodes} eps` : "Ongoing"],
                ["Studio", anime.studios?.[0]?.name || "Unknown"],
              ].map(([k, v]) => (
                <div key={k as string} className="min-w-0">
                  <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{k}</p>
                  <p className="mt-0.5 truncate font-mono text-xs font-bold text-white">{v}</p>
                </div>
              ))}
            </div>

            {youtubeId && !trailerOn && trailerAllowed && (
              <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-600">
                <Play className="h-3 w-3" /> Hover longer to see trailer
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
      <style jsx global>{`
        .hp-in {
          animation: hpIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes hpIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hp-in { animation: none; }
        }
      `}</style>
    </div>
  );
}

/**
 * THE SAME FOLLOWER, media-generic — manhwa and novels get the hover
 * dossier too, built from whatever fields their scrapers actually carry
 * (no synopsis or trailer on list items, so: art, chips, stats).
 */
export function MediaHoverPreview({
  title,
  image,
  chips,
  stats,
  children,
}: {
  title: string;
  image: string | null;
  /** small pills under the title — first gets the accent look */
  chips: string[];
  /** label/value pairs for the stats grid */
  stats: [string, string][];
  children: ReactNode;
}) {
  const MH = 330;
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);

  const hide = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = null;
    setShow(false);
  };

  useEffect(() => {
    if (!show) return;
    const dismiss = () => hide();
    window.addEventListener("scroll", dismiss, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", dismiss, { capture: true } as any);
  }, [show]);

  useEffect(() => () => { if (showTimer.current) clearTimeout(showTimer.current); cancelAnimationFrame(raf.current); }, []);

  const place = () => {
    const el = panelRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, x - W / 2), vw - W - 8);
    const top = y - MH - 18 > 8 ? y - MH - 18 : Math.min(y + 22, vh - MH - 8);
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(8, top)}px`;
  };

  const onMove = (e: React.MouseEvent) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    if (show) {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(place);
    }
  };

  const onEnter = (e: React.MouseEvent) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    posRef.current = { x: e.clientX, y: e.clientY };
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => setShow(true), SHOW_DELAY);
  };

  return (
    <div onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={hide} onClickCapture={hide} className="contents">
      {children}
      {show && typeof document !== "undefined" && createPortal(
        <div
          ref={(el) => { (panelRef as any).current = el; if (el) place(); }}
          style={{ position: "fixed", width: W, zIndex: 120 }}
          className="hp-in pointer-events-none overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] shadow-[0_30px_80px_rgba(0,0,0,.85)]"
        >
          <div className="relative h-36 w-full overflow-hidden bg-black">
            {image && <img src={image} alt="" className="h-full w-full object-cover object-top" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] to-transparent" />
          </div>

          <div className="relative px-4 pb-4">
            <div className="-mt-10 flex items-end gap-3">
              {image && (
                <img src={image} alt="" className="h-24 w-16 shrink-0 rounded-lg border border-white/20 object-cover shadow-xl" />
              )}
              <p className="line-clamp-2 flex-1 pb-0.5 font-mono text-base font-black leading-snug text-white">{title}</p>
            </div>

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((c, i) => (
                  <span key={c} className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${
                    i === 0 ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[0.05] text-slate-300"
                  }`}>
                    {c}
                  </span>
                ))}
              </div>
            )}

            {stats.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-3.5">
                {stats.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{k}</p>
                    <p className="mt-0.5 truncate font-mono text-xs font-bold text-white">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      {/* the entry keyframes ride along here too — on manhwa/novel pages
          no anime HoverPreview is mounted to provide them */}
      <style jsx global>{`
        .hp-in {
          animation: hpIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes hpIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hp-in { animation: none; }
        }
      `}</style>
    </div>
  );
}
