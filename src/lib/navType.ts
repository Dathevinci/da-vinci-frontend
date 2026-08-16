/**
 * WAS THIS NAVIGATION A RETURN OR AN ARRIVAL?
 *
 * The router cannot say: by the time a component mounts, a history traversal
 * (back/forward) and a fresh push look identical. But the two deserve opposite
 * treatment everywhere restoration is involved — a RETURN should put the
 * reader back exactly where they were, an ARRIVAL should start clean and
 * fresh. Restoring on arrivals is how the explore grid once froze for a whole
 * session (every visit resurrected the snapshot and skipped the fetch that
 * would have shown new releases) and how a pages-mode reader landed on page 5
 * from a nav link that asked for page 1.
 *
 * The classification is WHICH KIND HAPPENED LAST, not a freshness window. A
 * first version stamped popstate times and asked "was there a pop in the last
 * N seconds?" — review confirmed both leaks that implies: a push within N
 * seconds of a real pop inherits return-treatment it must not have, and a
 * traversal whose commit outlives N is misread as an arrival and gets fought.
 * Comparing the pop stamp against a PUSH stamp has neither problem, and the
 * push side is observable by wrapping history.pushState — every router push
 * lands there.
 *
 * replaceState is deliberately NOT stamped: replace inherits the class of the
 * navigation it decorates. The explore URL mirror replace()s on settle, and
 * classing that as an arrival would reclassify a return while its own
 * consumers are still reacting to it.
 */

let popAt = 0;
let pushAt = 0;

if (typeof window !== "undefined") {
  // A cross-document traversal (Back into the app after an external page, or
  // after bfcache declined to keep us) never fires popstate — the document
  // loads fresh with both stamps at zero and would misread as an arrival.
  // The browser still tells us what kind of load it was.
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type === "back_forward") popAt = performance.now();
  } catch {
    /* classification just falls back to "arrival" */
  }
  window.addEventListener("popstate", () => {
    popAt = performance.now();
  });
  const origPushState = window.history.pushState.bind(window.history);
  window.history.pushState = function (...args: Parameters<History["pushState"]>) {
    pushAt = performance.now();
    return origPushState(...args);
  };
}

/**
 * True when the most recent navigation was a history traversal (back/forward,
 * including a bfcache return), false for pushes and for a fresh load that has
 * not navigated yet.
 */
export function lastNavWasPop(): boolean {
  return popAt > 0 && popAt > pushAt;
}
