"use client";

import { MotionConfig } from "framer-motion";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Bridges the app-level "Performance Mode" (preferences.reducedMotion) into
 * framer-motion for the WHOLE tree.
 *
 * The `.reduced-motion` body class only ever killed CSS keyframes/transitions —
 * framer-motion drives its animations in JS, so it ignored that class entirely
 * and kept sliding/scaling at full cost. `reducedMotion="always"` makes every
 * <motion.*> below skip transform & layout animations — but ONLY those:
 * framer still runs keyframe tweens on non-positional values (box-shadow,
 * opacity, color) at full rate, inline-style write + repaint per frame.
 * Components that loop such values forever (e.g. AvatarDecoration's glow
 * pulses) must read the preference themselves and render a static frame;
 * this config alone does not stop them.
 * Reacts live: usePreferences listens for the preference-updated event.
 */
export default function AppMotionConfig({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences();
  return (
    <MotionConfig reducedMotion={preferences.reducedMotion ? "always" : "never"}>
      {children}
    </MotionConfig>
  );
}
