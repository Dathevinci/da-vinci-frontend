"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { EASE_OUT } from "@/lib/motion";

/**
 * A NUMBER THAT ROLLS RATHER THAN SNAPS.
 *
 * A balance that jumps from 1,200 to 1,450 tells you the new number. A balance
 * that travels there tells you something HAPPENED, and lets you feel the size
 * of it — which is the whole reason a reward is worth showing at all.
 *
 * Driven by requestAnimationFrame rather than a CSS transition or a framer
 * spring, because the thing being animated is the VALUE, not a style. A
 * transition on a text node cannot interpolate "1,200" into "1,450".
 *
 * Deliberately does NOT animate the first paint. Arriving on a page and
 * watching your balance count up from zero every time is a slot machine, not
 * feedback — the roll should mean a change happened while you were looking.
 *
 * Respects Performance Mode explicitly, unlike the framer-based primitives:
 * AppMotionConfig only governs <motion.*> components, and this is a raw rAF
 * loop it cannot see.
 */
export default function CountUp({
  value,
  duration = 600,
  className,
  format = (n: number) => Math.round(n).toLocaleString(),
}: {
  value: number;
  /** Milliseconds. ~600 is the sweet spot: long enough to read as travel,
   *  short enough that nobody waits for it. */
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const { preferences } = usePreferences();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    // First paint, or the player asked for less motion: land on the number.
    if (!mounted.current || preferences.reducedMotion) {
      mounted.current = true;
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const delta = value - start;
    if (delta === 0) return;

    // rAF gives us the timestamp; no Date.now() needed and no drift.
    let t0: number | null = null;
    // The system's entry curve, evaluated by hand — a cubic-bezier as a
    // function rather than as a CSS string, so the number travels on the same
    // curve everything else on screen moves on.
    const bez = (t: number) => {
      const [, y1, , y2] = [EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]];
      // Cheap, monotonic approximation of the control points — exact enough
      // for a counter and far cheaper than solving the curve per frame.
      const u = 1 - t;
      return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
    };

    const tick = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / duration);
      setShown(start + delta * bez(p));
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      // Whatever happened, the stored origin is the value we were heading to —
      // otherwise an interrupted roll makes the NEXT one start from a
      // half-way number that was never real.
      from.current = value;
    };
  }, [value, duration, preferences.reducedMotion]);

  return <span className={className}>{format(shown)}</span>;
}
