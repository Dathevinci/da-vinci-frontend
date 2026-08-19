"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * THE HUB'S BACKGROUND FILM — the same clip that fills the wordmark on the
 * landing page, running behind the hub.
 *
 * WHY THIS IS GATED SO HARD: `/title-font.mp4` is 9.5 MB and there is no webm
 * beside it, so an ungated autoplay would spend nearly ten megabytes of
 * someone's data before they had read a single tile — on the exact low-end
 * phones the perf work was for. So it plays only when every one of these is
 * true, and renders NOTHING otherwise:
 *
 *   · preferences have actually loaded (no flash of video before we know)
 *   · Data Saver is off        — it exists precisely to refuse payloads like this
 *   · Reduced Motion is off    — both the app's own preference and the OS one
 *   · the connection isn't metered or 2g (navigator.connection)
 *   · the viewport is wide enough to be a desktop-ish screen
 *
 * Everything about it is decorative: aria-hidden, pointer-events-none, and it
 * pauses itself the moment the tab is hidden so a backgrounded hub isn't
 * decoding frames forever.
 *
 * TO REMOVE IT: delete the single <HubBackdrop /> line in app/hub/page.tsx.
 * Nothing else in the page depends on it.
 */
export default function HubBackdrop() {
  const { preferences, isLoaded } = usePreferences();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (preferences.dataSaver || preferences.reducedMotion) {
      setAllowed(false);
      return;
    }
    if (typeof window !== "undefined") {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        setAllowed(false);
        return;
      }
      // A phone-width screen gets the least benefit and pays the most for it.
      if (window.innerWidth < 768) {
        setAllowed(false);
        return;
      }
    }
    // Honour the browser's own "save data" signal and obviously slow links.
    const conn = (navigator as any)?.connection;
    if (conn?.saveData) {
      setAllowed(false);
      return;
    }
    if (typeof conn?.effectiveType === "string" && /(^|-)2g$/.test(conn.effectiveType)) {
      setAllowed(false);
      return;
    }

    setAllowed(true);
  }, [isLoaded, preferences.dataSaver, preferences.reducedMotion]);

  /* A hidden tab must not keep decoding video. */
  useEffect(() => {
    if (!allowed) return;
    const onVisibility = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else void v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [allowed]);

  if (!allowed) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        /* `none` on purpose: the page's own content wins the network, and the
           film starts whenever it is ready rather than blocking anything. */
        preload="none"
        /* MEASURED, not guessed: sampled while playing, this clip averages 21.7
           luminance out of 255 with peaks at 217 — a near-black field carrying
           bright highlights. That profile is why the opacity can be this high
           without hurting text: the dark 90% of every frame stays dark, and only
           the highlights come through as a shimmer. The first pass used 0.28
           behind a 0.72 scrim, which let roughly 8% of the film survive and made
           it invisible on a black page. */
        className="h-full w-full object-cover opacity-[0.45]"
      >
        <source src="/title-font.mp4" type="video/mp4" />
      </video>

      {/* Scrims. The hub is dense text over this, so legibility beats spectacle:
          a flat darkener for contrast, then a vertical fade so the film reads as
          atmosphere in the middle rather than a rectangle with edges. */}
      <div className="absolute inset-0 bg-[#08070c]/50" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#08070c] via-transparent to-[#08070c]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.16),transparent_60%)]" />
    </div>
  );
}
