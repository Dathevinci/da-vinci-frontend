"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { lastNavWasPop } from "@/lib/navType";
import { scrollClaimedRecently } from "@/lib/scrollMemory";

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
  const first = useRef(true);

  useEffect(() => {
    // The very first paint is a fresh load, not a navigation — the browser is
    // already handling deep links and refreshes correctly.
    if (first.current) {
      first.current = false;
      return;
    }
    // A return is left alone, an arrival is pinned — and the classification is
    // navType's "which kind happened last", which earlier revisions got wrong
    // twice here: a consumed-boolean leaked hash-only back-steps onto the next
    // push, and a freshness window both exempted pushes made soon after a pop
    // and fought traversals whose commit came late on a starved main thread.
    if (lastNavWasPop()) return;
    // A page that restored its own content AND its own scroll has claimed
    // this navigation (scrollMemory.claimScroll in its layout effect, which
    // runs before this one). Pinning it to the top would undo exactly the
    // restoration the reader asked for — the "takes me all the way to the
    // front" report. Classification-independent, like the restores.
    if (scrollClaimedRecently()) return;

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

    /**
     * THE PIN ENDS ON EVIDENCE, NOT ON A CLOCK. The first version held for a
     * flat 1.4s — and kept losing, because that number raced the network. The
     * offset that drags a fresh page downward is the browser re-EXTENDING a
     * clamped scroll (the old page's offset survives clamped to the short
     * placeholder, then stretches back out as the document grows), and it
     * fires when the content lands: 300ms on a warm cache, 4s on a phone
     * pulling a chapter's images. Any fixed deadline is wrong on one side —
     * so the release condition is the same event the attacker waits for: the
     * pin holds until the document height has been QUIET for a stretch and a
     * minimum courtesy window has passed, with a hard cap so a page whose
     * height never settles cannot pin forever. Height is watched through a
     * ResizeObserver rather than read per frame — polling scrollHeight from a
     * rAF forces a synchronous layout on every frame of content churn, which
     * is a tax on exactly the slow loads this exists to survive.
     *
     * EVERY input releases instantly, and the list is deliberately generous:
     * `mousedown` is there for the classic desktop scrollbar, whose drags
     * reach the page as NO wheel, pointer or touch event — without it a
     * reader grabbing the scrollbar was rubber-banded to the top until the
     * timers let go. An earlier revision ignored wheel events for the first
     * 350ms as trackpad-momentum ghosts from the page you left; review
     * killed it: real momentum trains outlive any plausible grace (1–2s), so
     * it failed the case it existed for, while a reader's genuine first
     * wheel-notch inside the window was swallowed AND actively reverted.
     * Losing the pin to a ghost costs one mid-page landing on a rare timing;
     * fighting a real reader costs trust on a common one.
     */
    const PIN_MIN_MS = 1400;
    const HEIGHT_QUIET_MS = 700;
    const PIN_MAX_MS = 6000;

    const started = performance.now();
    // A page already taller than the viewport when the pin starts has nothing
    // left to fear: the scrollTo above was a REAL reset (nothing was clamped,
    // so nothing can re-extend), and holding it to the cap would just burn
    // ~360 rAF frames of battery per navigation and fight any scroll that
    // reaches the page without an input event (a screen reader moving the
    // viewport, say). Those pages release on the old minimum instead.
    const tallAtStart = document.documentElement.scrollHeight > window.innerHeight + 2;
    let lastGrowth = started;
    let sawGrowth = false;
    let roBaselined = false;
    let raf = 0;
    let released = false;
    let ro: ResizeObserver | null = null;

    const release = () => {
      released = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      for (const ev of GESTURES) window.removeEventListener(ev, release);
    };
    const GESTURES = ["wheel", "touchstart", "keydown", "pointerdown", "mousedown"] as const;
    for (const ev of GESTURES) window.addEventListener(ev, release, { passive: true });

    /**
     * "Quiet since the beginning" is NOT evidence of settling — a page whose
     * body is min-h-screen reports no height change while its placeholder
     * fills below one viewport, then grows once when the real content lands,
     * which can be seconds out. Releasing on initial quiet degenerated to the
     * old flat deadline in exactly the slow-load case this exists to survive;
     * so quiet only counts AFTER at least one observed growth. A page whose
     * height truly never changes pins to the cap, which is invisible: the pin
     * is a no-op at rest, and every input releases it instantly. (The
     * observer's first delivery reports the size it started with — that is
     * the baseline, not growth. Sub-viewport growth stays invisible either
     * way, and harmlessly so: an offset can only re-extend once content
     * exceeds the viewport, and THAT growth does move the body's box.)
     */
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (!roBaselined) {
          roBaselined = true;
          return;
        }
        sawGrowth = true;
        lastGrowth = performance.now();
      });
      ro.observe(document.body);
    }

    const hold = () => {
      if (released) return;
      const now = performance.now();
      if (
        now - started > PIN_MAX_MS ||
        (tallAtStart && !sawGrowth && now - started > PIN_MIN_MS) ||
        (sawGrowth && now - started > PIN_MIN_MS && now - lastGrowth > HEIGHT_QUIET_MS)
      ) {
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
