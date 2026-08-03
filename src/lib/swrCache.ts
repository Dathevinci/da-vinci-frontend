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
