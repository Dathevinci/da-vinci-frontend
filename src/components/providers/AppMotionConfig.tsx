"use client";

import { MotionConfig } from "framer-motion";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Bridges the app-level "Performance Mode" (preferences.reducedMotion) into
 * framer-motion for the WHOLE tree.
 *
 * The `.reduced-motion` body class only ever killed CSS keyframes/transitions —
 * framer-motion drives its animations in JS, so it ignored that class entirely
 * and kept sliding/scaling at full cost. With `reducedMotion="always"`, every
 * <motion.*> below skips transform & layout animations (opacity still fades),
 * so toggling Performance Mode genuinely calms the app instead of doing nothing.
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
