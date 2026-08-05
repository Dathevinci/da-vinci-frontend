"use client";

import { useRef, useState, ReactNode, PointerEvent as RPointerEvent } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { CSS_EASE_OUT, DUR } from "@/lib/motion";

/**
 * A CARD THAT LEANS TOWARD YOU.
 *
 * Wraps anything in a 3D tilt that follows the pointer, with a specular
 * highlight that sweeps across the surface as it turns. This is the single
 * most recognisable "expensive gacha" affordance and it costs one wrapper.
 *
 * WHY RAW CSS TRANSFORMS AND NOT FRAMER: this updates on every pointermove.
 * Routing that through React state per frame would re-render the subtree on
 * each event; writing the transform straight onto the node's style keeps the
 * whole interaction off the render path. The only React state here is the
 * boolean for whether the highlight is visible.
 *
 * `shine` is opt-in and meant for ★3+ — a foil sweep on every common is how a
 * foil stops meaning anything.
 *
 * Respects Performance Mode explicitly: this is not a <motion.*> component, so
 * AppMotionConfig cannot reduce it. With the preference on it renders a plain
 * wrapper and attaches no handlers at all.
 */
export default function Tilt({
  children,
  className,
  /** Maximum lean in degrees. Past ~12 it stops reading as depth and starts
   *  reading as a novelty. */
  max = 9,
  /** The moving specular highlight. Reserve it for cards worth showing off. */
  shine = false,
  /** Lift toward the viewer on hover, in px of Z. */
  lift = 14,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  shine?: boolean;
  lift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const { preferences } = usePreferences();

  if (preferences.reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // -0.5..0.5 from the centre, so the maths is symmetric and the card is
    // flat exactly where the pointer sits in the middle.
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    // Y follows X and X follows Y inverted — a card tips AWAY on the side you
    // push and TOWARD you on the side you pull, which is how a real object
    // behaves under a finger.
    el.style.transform =
      `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) ` +
      `rotateY(${(px * max).toFixed(2)}deg) translateZ(${lift}px)`;
    if (glare.current) {
      glare.current.style.background =
        `radial-gradient(circle at ${((px + 0.5) * 100).toFixed(1)}% ${((py + 0.5) * 100).toFixed(1)}%, ` +
        `rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)`;
    }
  };

  const leave = () => {
    const el = ref.current;
    setActive(false);
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  };

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={move}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={leave}
      style={{
        // The settle back to flat is animated; the follow is not, because a
        // transition on a per-frame transform makes the card lag the cursor.
        transition: active ? "none" : `transform ${DUR.panel}s ${CSS_EASE_OUT}`,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {children}
      {shine && (
        <span
          ref={glare}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            opacity: active ? 1 : 0,
            transition: `opacity ${DUR.micro}s ${CSS_EASE_OUT}`,
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}
