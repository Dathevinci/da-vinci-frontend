/**
 * CATALOG CACHE.
 *
 * The card catalog is the slowest thing on any card page and the least likely
 * to have changed: it is a large static payload — 69 cards, every stat table,
 * every skill and domain rank with its wording already resolved — fetched from
 * a Render free-tier instance that sleeps. A cold start there is measured in
 * seconds, and until it answers the duel board is a grid of blanks.
 *
 * So it is served from sessionStorage first and refreshed in the background.
 * The page paints immediately from the cached copy while the network catches
 * up, which is the difference between "slow" and "instant" on every visit
 * after the first.
 *
 * sessionStorage, NOT localStorage: a tab keeps its copy for as long as you're
 * using the site, and a new session always starts from the server. A catalog
 * that could persist for weeks would eventually disagree with the server about
 * a card's stats, and stale COMBAT numbers are worse than a slow page.
 */
const KEY = "davinci_card_catalog_v1";

/** Bumped whenever the shape changes, so an old cached blob is ignored. */
const SHAPE = 3;

type Cached = { shape: number; at: number; data: any };

/** The cached catalog, or null. Never throws — a bad blob is just a miss. */
export function readCatalogCache(): any | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const c: Cached = JSON.parse(raw);
    if (c?.shape !== SHAPE || !c?.data?.cards?.length) return null;
    return c.data;
  } catch {
    return null;
  }
}

export function writeCatalogCache(data: any) {
  try {
    if (!data?.cards?.length) return;
    sessionStorage.setItem(KEY, JSON.stringify({ shape: SHAPE, at: Date.now(), data }));
  } catch {
    // Quota or private mode. A cache that can't be written is not an error,
    // it just means every load pays full price.
  }
}

/**
 * Hand back the cached catalog immediately (if any), then fetch and hand back
 * the fresh one. `onData` may therefore be called twice — once from cache and
 * once from the network — so callers must be happy to render the same data
 * twice rather than assuming a single resolution.
 */
export async function loadCatalog(
  apiUrl: string,
  onData: (data: any) => void,
  onError?: () => void
): Promise<void> {
  const cached = readCatalogCache();
  if (cached) onData(cached);

  try {
    const r = await fetch(`${apiUrl}/api/cards/catalog`);
    const j = await r.json();
    if (!j?.success || !Array.isArray(j?.data?.cards)) throw new Error("bad catalog");
    writeCatalogCache(j.data);
    onData(j.data);
  } catch {
    // Only surface the failure if there was nothing to show. With a cached
    // copy on screen a failed refresh is invisible and should stay that way.
    if (!cached) onError?.();
  }
}
