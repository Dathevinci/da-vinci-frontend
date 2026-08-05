"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * OPEN A PAGE AT THE TOP OF IT.
 *
 * Navigating to a series, a chapter or a profile could land you halfway down
 * the page — sometimes at the very bottom — and how far down depended on how
 * far you had scrolled on the page you came FROM. That is the tell for what is
 * actually happening.
 *
 * Nearly every page here paints a short loading state first and only then
 * swaps in the real content. The router resets scroll while the new page is
 * still that short placeholder, so there is nothing to scroll — the reset is a
 * no-op. The content then arrives, the document grows back to full height, and
 * the browser restores the offset it was holding, leaving you deep inside a
 * page you just opened. A tall previous page means a deep landing; a short one
 * means you never notice. Hence "sometimes".
 *
 * The fix has to run AFTER that growth, which is why this is a rAF rather than
 * a bare call: one frame later the new content has laid out and the scroll
 * actually has somewhere to go.
 *
 * BACK AND FORWARD ARE LEFT ALONE. Returning to a list you were browsing should
 * put you back where you were — that is the one case where a restored offset is
 * correct, and blanket-scrolling to top would trade this bug for a worse one.
 * A popstate listener marks the next pathname change as a history move so it is
 * skipped exactly once.
 *
 * `novel/[id]/chapter` had a hand-rolled window.scrollTo(0,0) for this same
 * reason. Someone hit it once and patched that page alone; this replaces the
 * need for that copy anywhere else.
 */
export default function ScrollReset() {
  const pathname = usePathname();
  const popped = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => { popped.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    // The very first paint is a fresh load, not a navigation — the browser is
    // already handling deep links and refreshes correctly.
    if (first.current) {
      first.current = false;
      return;
    }
    if (popped.current) {
      popped.current = false;
      return;
    }
    const id = requestAnimationFrame(() => {
      // `instant` rather than smooth: a page you just opened should already be
      // at the top, not visibly travelling there.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
