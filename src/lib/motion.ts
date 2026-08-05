/**
 * THE MOTION SYSTEM.
 *
 * One place for every curve, duration and interval in the app, so motion is a
 * system rather than a per-component opinion. The numbers are not arbitrary —
 * they are the production standard the owner specified, and the point of
 * writing them down is that a screen built next month lands in the same
 * language as one built today.
 *
 * THE RULES, in order of how much they matter:
 *
 *  1. STAGGER EVERYTHING. A list of eight entering together reads as a page
 *     load; the same eight at 50ms intervals reads as choreography. This one
 *     rule does more work than any individual effect.
 *  2. NOTHING APPEARS INSTANTLY. Everything enters and exits.
 *  3. EXITS ARE FASTER THAN ENTRIES (~60%). Leaving should feel decisive;
 *     arriving should feel considered.
 *  4. ENTRIES OVERSHOOT SLIGHTLY, then settle. Never linear, never the
 *     browser default ease-in-out — both read as "unstyled".
 *  5. MOTION NEVER BLOCKS INPUT. Every animated surface stays tappable
 *     throughout; nothing here gates a click on an animation finishing.
 *
 * PERFORMANCE MODE IS ALREADY HANDLED. AppMotionConfig wraps the tree in
 * <MotionConfig reducedMotion>, so every framer animation built on these
 * tokens is automatically reduced to an opacity fade when the player asks for
 * that. Do not re-check the preference in a component — it is done once, above.
 */

/**
 * Entry curve: fast start, long soft settle. The signature of the whole
 * system — if you use one thing from this file, use this.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Exit curve: leaves promptly rather than lingering. */
export const EASE_IN = [0.64, 0, 0.78, 0] as const;

/** For things that move under their own power rather than being placed. */
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

/**
 * Duration budget, in seconds (framer's unit).
 *
 * Nothing exceeds 800ms except a deliberate cinematic — a pull reveal earns
 * that, a dropdown does not. When unsure, pick the shorter one: motion that
 * is slightly too fast reads as responsive, slightly too slow reads as broken.
 */
export const DUR = {
  /** Hover, press, toggle, tick. */
  micro: 0.16,
  /** A panel, sheet, dropdown or modal. */
  panel: 0.35,
  /** A whole screen or tab change. */
  screen: 0.6,
  /** Deliberate cinematics only. */
  cinematic: 0.8,
} as const;

/** Exits run at 60% of their entry. */
export const exitDur = (d: number) => Number((d * 0.6).toFixed(3));

/** Seconds between siblings in a staggered list. */
export const STAGGER = 0.05;

/**
 * The overshoot on an entry, as a scale. 3% — inside the 2-4% the spec calls
 * for. Beyond that it stops reading as weight and starts reading as a bounce,
 * which is a different (cheaper) genre.
 */
export const OVERSHOOT = 1.03;

/** A list container: children enter one after another rather than as a block. */
export const listVariants = (stagger: number = STAGGER, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  exit: { transition: { staggerChildren: stagger * 0.4, staggerDirection: -1 } },
});

/** A list ITEM. Rises, overshoots a hair, settles. */
export const itemVariants = (y = 14) => ({
  hidden: { opacity: 0, y },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.panel, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: y * -0.4,
    transition: { duration: exitDur(DUR.panel), ease: EASE_IN },
  },
});

/**
 * A panel, sheet or modal body. Scales up through its overshoot rather than
 * arriving at final size — that hair of travel is most of what separates
 * "appeared" from "opened".
 */
export const panelVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  show: {
    opacity: 1,
    scale: [0.96, OVERSHOOT, 1],
    y: 0,
    transition: { duration: DUR.panel, ease: EASE_OUT, times: [0, 0.7, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: exitDur(DUR.panel), ease: EASE_IN },
  },
};

/**
 * DEPTH. What sits BEHIND an open modal: blurred, desaturated and pushed back
 * ~3%. Without this a modal is a rectangle on top of a page; with it the page
 * is genuinely behind the modal and the eye knows where to go.
 *
 * Returned as a style object rather than a class so it can be applied to
 * whatever wrapper a given screen already has.
 */
export const behindModal = (open: boolean) => ({
  filter: open ? "blur(6px) saturate(0.6) brightness(0.7)" : "none",
  transform: open ? "scale(0.97)" : "scale(1)",
  transition: `filter ${DUR.panel}s cubic-bezier(${EASE_OUT.join(",")}), transform ${DUR.panel}s cubic-bezier(${EASE_OUT.join(",")})`,
  // The page behind a modal must not eat taps meant for the modal.
  pointerEvents: open ? ("none" as const) : ("auto" as const),
});

/** The signature curve as a CSS string, for plain CSS transitions. */
export const CSS_EASE_OUT = `cubic-bezier(${EASE_OUT.join(", ")})`;
export const CSS_EASE_IN = `cubic-bezier(${EASE_IN.join(", ")})`;

/**
 * Hover and press, as framer props. Spread onto any interactive element:
 *
 *   <motion.button {...tactile()}>
 *
 * Lift on hover, depress on press. The press is deliberately deeper than the
 * lift is high — weight comes from the down stroke, not the up one.
 */
export const tactile = (lift = -2) => ({
  whileHover: { y: lift, transition: { duration: DUR.micro, ease: EASE_OUT } },
  whileTap: { scale: 0.97, y: 0, transition: { duration: 0.08, ease: EASE_IN } },
});
