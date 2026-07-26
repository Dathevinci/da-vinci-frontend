import { FRAMES, LITE_GLOW, ASCENSION_RING } from "./AvatarDecoration";

/**
 * A visual freeze-frame of <AvatarDecoration> for Performance Mode.
 *
 * Performance Mode removes MOTION, not the cosmetic — a user who paid 17,500 AP
 * for an effect should still see its colour on their avatar with the battery
 * saver on. So this renders the exact same two layers AvatarDecoration renders,
 * with the animation stripped out.
 *
 * Both the ring and the glow are read from AvatarDecoration's own palettes
 * rather than re-declared here, so there is nothing that can drift.
 *
 * Also used before preferences finish loading — see `animate` in Navbar.tsx.
 * Rendering static-then-animated is imperceptible; the reverse would flash a
 * frame of animation at exactly the users who switched it off.
 */
export function StaticDecoration({
  frame,
  effect,
}: {
  frame?: string | null;
  effect?: string | null;
}) {
  // Precedence must MIRROR AvatarDecoration.tsx:81 exactly — ascension first,
  // then the frame. Inverting it flips gold<->purple for a user wearing both the
  // moment Performance Mode is toggled.
  const ring = effect === "effect_ascension" ? ASCENSION_RING : frame ? FRAMES[frame] : null;
  // Index [1] is the bright mid-keyframe of the pulse; [0] is the fallback for
  // any entry that ever ships with fewer than two stops.
  const glow = effect ? LITE_GLOW[effect]?.[1] ?? LITE_GLOW[effect]?.[0] : undefined;

  return (
    <>
      {ring && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-full z-0"
          style={{ background: ring.ring, filter: `drop-shadow(0 0 6px ${ring.glow})` }}
        />
      )}
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-full z-0"
          style={{ boxShadow: glow }}
        />
      )}
    </>
  );
}
