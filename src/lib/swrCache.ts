/**
 * SERVE-CACHED-THEN-REFRESH for per-user JSON GETs — collections, dungeon
 * status. Same contract as catalogCache.loadCatalog: `onData` may fire twice
 * (once from sessionStorage, once from the network), so callers must be happy
 * to apply the same data twice.
 *
 * The point is the FIRST paint: these endpoints live on a Render free tier
 * that sleeps, and every page used to sit blank while it woke. With this, only
 * the first visit of a session waits; every visit after paints instantly and
 * corrects itself when the network catches up.
 *
 * sessionStorage on purpose (same reasoning as the catalog cache): a tab keeps
 * its copy while you're using the site, a new session starts honest.
 */
const SHAPE = 1;

/**
 * SYNCHRONOUS cache read, for pre-paint hydration. A useEffect fires after
 * the browser has already painted, so serving the cache there still flashes
 * the loading screen for a frame and lets the route transition play a full
 * exit-and-enter — which reads as "it reloaded everything" no matter how
 * fresh the data is. A useLayoutEffect calling this runs BEFORE paint, so the
 * feed is on screen in the first frame the reader ever sees.
 */
export function readSwrCache(key: string): any | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c?.shape === SHAPE && c.data ? c.data : null;
  } catch {
    return null;
  }
}

/**
 * The same serve-cached-then-refresh, for endpoints that return a BARE JSON
 * object rather than the { success, data } wrapper — the manhwa and novel
 * home feeds. Exists for the close-X path: those details are PAGES, so
 * closing one remounts the home, and without a cache the reader watched the
 * whole feed reload on every X press — the anime modal never has this
 * problem because its list never unmounts. With this, the return paints
 * instantly from the session copy and corrects itself in the background.
 */
export async function swrRawJson(
  key: string,
  url: string,
  onData: (data: any, fromCache: boolean) => void,
  onError?: () => void
): Promise<void> {
  let served = false;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw);
      if (c?.shape === SHAPE && c.data) {
        served = true;
        onData(c.data, true);
      }
    }
  } catch { /* a bad blob is just a miss */ }

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (!j || typeof j !== "object" || j.error) throw new Error("bad payload");
    try {
      sessionStorage.setItem(key, JSON.stringify({ shape: SHAPE, at: Date.now(), data: j }));
    } catch { /* quota or private mode — every load just pays full price */ }
    onData(j, false);
  } catch {
    if (!served) onError?.();
  }
}

export async function swrJson(
  key: string,
  url: string,
  onData: (data: any, fromCache: boolean) => void,
  onError?: () => void
): Promise<void> {
  let served = false;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw);
      if (c?.shape === SHAPE && c.data) {
        served = true;
        onData(c.data, true);
      }
    }
  } catch { /* a bad blob is just a miss */ }

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (!j?.success) throw new Error("bad payload");
    try {
      sessionStorage.setItem(key, JSON.stringify({ shape: SHAPE, at: Date.now(), data: j.data }));
    } catch { /* quota or private mode — every load just pays full price */ }
    onData(j.data, false);
  } catch {
    // With a cached copy already on screen, a failed refresh is invisible.
    if (!served) onError?.();
  }
}
