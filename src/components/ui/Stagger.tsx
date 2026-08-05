"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { listVariants, itemVariants, STAGGER } from "@/lib/motion";

/**
 * A LIST THAT ARRIVES IN ORDER.
 *
 * Eight cards entering together read as a page load. The same eight at 50ms
 * intervals read as choreography — and that difference costs nothing but the
 * decision to reach for this instead of a plain <div>.
 *
 * Two components rather than one on purpose: the parent owns the RHYTHM and
 * the child owns the MOVE, so a grid and a sidebar can share timing while
 * travelling different distances.
 *
 *   <Stagger className="grid grid-cols-4 gap-4">
 *     {items.map((it) => (
 *       <StaggerItem key={it.id}><Card {...it} /></StaggerItem>
 *     ))}
 *   </Stagger>
 *
 * Performance Mode needs no handling here: AppMotionConfig reduces every
 * framer animation in the tree to a fade, so this degrades to eight things
 * fading in rather than eight things sliding.
 */
export default function Stagger({
  children,
  className,
  stagger = STAGGER,
  delay = 0,
  /** Animate when scrolled into view rather than on mount. For anything below
   *  the fold — a list that already animated before you reached it has spent
   *  its one moment on nobody. */
  whenVisible = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  whenVisible?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={listVariants(stagger, delay)}
      initial="hidden"
      {...(whenVisible
        ? { whileInView: "show", viewport: { once: true, amount: 0.15 } }
        : { animate: "show" })}
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

/** One entry in a Stagger. `y` is how far it travels — bigger for hero rows,
 *  smaller for dense lists where a long slide reads as sluggish. */
export function StaggerItem({
  children,
  className,
  y = 14,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div className={className} variants={itemVariants(y)}>
      {children}
    </motion.div>
  );
}
