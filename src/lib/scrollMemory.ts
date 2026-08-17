/**
 * EXPLICIT SCROLL MEMORY — because implicit restoration kept losing.
 *
 * A restored grid means nothing if the reader lands at the top of it. The
 * browser's own back-navigation scroll restore needs BOTH a pre-paint-tall
 * page AND a navigation the machinery recognises as a traversal — and the
 * owner's reports proved traversal detection misses in the wild, at which
 * point ScrollReset's pin actively re-zeroes the offset ("it takes me all
 * the way to front"). So the pages that restore content also restore their
 * own scroll, from their own record, and CLAIM the navigation so the pin
 * stands down. No navigation classification anywhere in the chain.
 *
 * The claim is a timestamp, not a flag: ScrollReset's effect runs within
 * milliseconds of the claiming layout effect (layout → paint → passive), so
 * a short window is ample, and there is nothing to consume or reset.
 */

let claimedAt = 0;

/** A page took responsibility for this navigation's scroll position. */
export function claimScroll() {
  claimedAt = performance.now();
}

/** ScrollReset asks this before pinning a fresh navigation to the top. */
export function scrollClaimedRecently(ms = 1500): boolean {
  return claimedAt > 0 && performance.now() - claimedAt < ms;
}

/**
 * Keep a rolling record of the window scroll for a keyed surface. Throttled;
 * the record pairs the offset with the query string that identifies WHICH
 * grid it belongs to, so a different search never inherits it.
 */
export function attachScrollMemory(key: string, getQs: () => string): () => void {
  let lastWrite = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    pending = null;
    lastWrite = performance.now();
    try {
      sessionStorage.setItem(key, JSON.stringify({ qs: getQs(), y: window.scrollY, at: Date.now() }));
    } catch {
      /* quota or privacy mode — scroll just isn't remembered */
    }
  };
  const onScroll = () => {
    if (pending) return;
    const since = performance.now() - lastWrite;
    pending = setTimeout(write, since > 200 ? 0 : 200 - since);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    if (pending) clearTimeout(pending);
  };
}

/**
 * Put the reader back where the record says, if it belongs to this exact
 * query string. Call from a LAYOUT effect after restoring content, so the
 * page is already tall enough to hold the offset. Returns whether it acted.
 */
export function restoreRememberedScroll(key: string, qs: string): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return false;
    const c = JSON.parse(raw);
    if (!c || c.qs !== qs || !(Number(c.y) > 0)) return false;
    claimScroll();
    window.scrollTo(0, Number(c.y));
    return true;
  } catch {
    return false;
  }
}
