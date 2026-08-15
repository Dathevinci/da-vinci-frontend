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

    /**
     * A PIN, NOT A POKE. The single one-frame reset this used to be kept
     * losing: the real content arrives hundreds of milliseconds after
     * navigation, and whatever re-applies the old offset — the router's own
     * restoration, the browser re-extending a clamped offset as the document
     * grows — fires AFTER a one-shot reset has already retired. That is the
     * "opens a chapter and starts from below, sometimes, almost everywhere"
     * report: the outcome depended on how fast the content happened to load.
     *
     * So for a short window after each push navigation the page is HELD at the
     * top: any frame where something has moved the scroll without the reader's
     * involvement gets reset. The pin releases on the FIRST real user gesture
     * (wheel, touch, key, pointer), so a reader who starts scrolling
     * immediately is never fought — their gesture ends the window mid-flight.
     *
     * ANCHOR NAVIGATIONS ARE EXEMPT: a #hash or a ?comment= permalink is a
     * navigation whose PURPOSE is to land mid-page (the comment feed scrolls
     * to the linked comment on mount). Those get one initial top-reset only if
     * scroll survived from the previous page, and no pin.
     */
    const wantsAnchor =
      window.location.hash.length > 1 || /[?&]comment=/.test(window.location.search);

    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    if (wantsAnchor) return;

    const PIN_MS = 1400;
    const deadline = performance.now() + PIN_MS;
    let raf = 0;
    let released = false;

    const release = () => {
      released = true;
      cancelAnimationFrame(raf);
      for (const ev of GESTURES) window.removeEventListener(ev, release);
    };
    const GESTURES = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const ev of GESTURES) window.addEventListener(ev, release, { passive: true });

    const hold = () => {
      if (released) return;
      if (performance.now() > deadline) {
        release();
        return;
      }
      if (window.scrollY > 2) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      }
      raf = requestAnimationFrame(hold);
    };
    raf = requestAnimationFrame(hold);

    return release;
  }, [pathname]);

  return null;
}
