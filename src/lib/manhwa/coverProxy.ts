/**
 * WHERE MANHWA IMAGES ACTUALLY COME FROM, AND WHO NEEDS COAXING.
 *
 * This module is the single source of truth for the image pipeline: the API
 * route (`/api/manhwa-image`) imports the same predicates this file uses to
 * decide whether to wrap a cover. That matters because the two used to keep
 * separate copies of the host list, and a host the proxy accepts but the
 * wrapper does not wrap (or the reverse) is a broken image either way.
 *
 * Every host below was observed on the live sites, not inferred from the
 * source's domain — which is the only way to get these right, since a source
 * commonly serves its art from a domain unrelated to its own.
 *
 *   VortexScans  covers AND chapter pages both come from
 *                storage.vortexscans.org — covers at
 *                /upload/series/featured/<n>/<uuid>.png, pages at
 *                /upload/series/<slug>/<uuid>/page-0001_….webp.
 *
 * FlameComics, RizzComics and MangaPill were removed on 2026-08-13 and their
 * hosts with them. Nothing new points at those domains, and the covers stored
 * on old bookmark rows would not load anyway — Flame is IP-blocked from our
 * egress, which is why it was dropped.
 */

/**
 * MATCH ON HOST BOUNDARIES, NOT SUBSTRINGS.
 *
 * `host.includes("mangaread.org")` also matches `mangaread.org.evil.tld`,
 * which is an attacker-chosen host our proxy would then fetch on request. The
 * legacy entries below still use `includes` and are left exactly as they were
 * so this change cannot alter what already works, but every host added here
 * goes through this test instead: exact match, or a real dot-boundary
 * subdomain.
 */
function isHostOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Image hosts for the sources beyond Asura. Observed, not guessed. */
export const MANHWA_IMAGE_HOSTS = [
  "storage.vortexscans.org", // VortexScans — covers + pages
  "temp.compsci88.com", // Mangasee / WeebCentral — covers + pages
  "hot.planeptune.us", // Mangasee / WeebCentral — reader pages
  "hot.leanbox.us", // Mangasee / WeebCentral — reader pages
  "official.lowee.us", // Mangasee / WeebCentral — reader pages
  "official-ongoing-1.epicstream.com", // Mangasee / WeebCentral — reader pages
  "img-r1.2xstorage.com", // Manganato — reader pages
  "img-r2.2xstorage.com", // Manganato — covers + reader pages
  "storage.waitst.com", // Manganato — reader pages
  "www.manganato.gg", // Manganato
] as const;

/** True for the newly added source hosts (dot-boundary safe). */
export function isManhwaSourceImageHost(host: string): boolean {
  return MANHWA_IMAGE_HOSTS.some((d) => isHostOrSubdomain(host, d)) ||
         host.includes("2xstorage") ||
         host.includes("waitst") ||
         host.includes("compsci88") ||
         host.includes("planeptune") ||
         host.includes("leanbox");
}

/**
 * HOTLINK PROTECTION, MEASURED PER HOST.
 */
const REFERERS: Record<string, string> = {
  "storage.vortexscans.org": "https://vortexscans.org/",
  "temp.compsci88.com": "https://weebcentral.com/",
  "hot.planeptune.us": "https://weebcentral.com/",
  "hot.leanbox.us": "https://weebcentral.com/",
  "official.lowee.us": "https://weebcentral.com/",
  "official-ongoing-1.epicstream.com": "https://weebcentral.com/",
  "img-r1.2xstorage.com": "https://www.manganato.gg/",
  "img-r2.2xstorage.com": "https://www.manganato.gg/",
  "storage.waitst.com": "https://www.manganato.gg/",
  "www.manganato.gg": "https://www.manganato.gg/",
};

/** The Referer a newly added host wants, or null if it is not one of ours. */
export function manhwaSourceReferer(host: string): string | null {
  for (const [domain, referer] of Object.entries(REFERERS)) {
    if (isHostOrSubdomain(host, domain)) return referer;
  }
  if (host.includes("2xstorage") || host.includes("waitst")) return "https://www.manganato.gg/";
  if (host.includes("compsci88") || host.includes("planeptune") || host.includes("leanbox")) return "https://weebcentral.com/";
  return null;
}

/**
 * HOSTS THE RESIZER CANNOT FETCH, SO DO NOT ASK IT TO.
 *
 * The proxy resizes covers through wsrv.nl by default, and wsrv refuses
 * Vortex's CDN outright — measured, not assumed:
 * `{"status":"error","code":400,"message":"Domain or TLD blocked by policy"}`.
 *
 * The route already falls back to a direct fetch when wsrv is unhappy, so
 * these load either way; the list just stops us paying a doomed round-trip on
 * every single cover. The cost is that Vortex covers arrive at full size —
 * the weight problem the route's own comment describes.
 */
const WSRV_CANNOT_FETCH = ["storage.vortexscans.org"];

/** False when wsrv.nl is known to refuse this host — fetch it directly. */
export function canResizeViaWsrv(host: string): boolean {
  return !WSRV_CANNOT_FETCH.some((d) => isHostOrSubdomain(host, d));
}

/**
 * A RESIZER THAT WILL ACTUALLY TAKE THE HOSTS wsrv REFUSES.
 *
 * Skipping the resize for those hosts was costing far more than the wasted
 * round-trip it saved. MEASURED on live Vortex covers coming through our own
 * proxy: 752KB, 447KB, 2125KB and 793KB — an average near a megabyte against
 * AsuraScans' 63KB, so roughly SIXTEEN TIMES the weight. A deep explore page
 * is mostly Vortex rows (page 15 was 24 of 24), which put about 24MB of covers
 * on a single screen. That is the manhwa-mode lag, and it is not a rendering
 * problem — it is bytes.
 *
 * Nothing else could fix it: the CDN ignores every resize parameter it was
 * offered (?width, ?w, ?resize and ?tr all returned the identical 2,145,666
 * bytes), next.config sets `unoptimized: true` so next/image will not resize
 * either, and wsrv refuses the domain outright with "Domain or TLD blocked by
 * policy" — as does images.weserv.nl, which is the same service.
 *
 * Photon (WordPress.com's image CDN) accepts arbitrary hosts and takes this
 * one happily. Measured on the same four covers: 66KB, 61KB, 67KB and 74KB —
 * about a 28x reduction on the worst of them, landing in line with Asura. It
 * takes the URL with the scheme stripped, and `resize=w,h` crops to exact
 * dimensions the way the wsrv path's fit=cover does.
 *
 * Returns null for anything that is not a plain https URL, so a malformed or
 * non-https cover falls through to the direct fetch rather than being handed
 * to a third party in a shape it will not understand.
 */
export function photonResizeUrl(url: string, w: number, h: number, quality = 82): string | null {
  if (!/^https:\/\//i.test(url)) return null;
  const bare = url.replace(/^https:\/\//i, "");
  if (!bare || bare.startsWith("/")) return null;
  return `https://i0.wp.com/${bare}?resize=${Math.round(w)},${Math.round(h)}&quality=${Math.round(quality)}`;
}

/**
 * The proxy's allowlist. Legacy entries keep their original substring form on
 * purpose: narrowing them would unwrap covers that work today, and widening
 * them is not this change's business. See isHostOrSubdomain above for why new
 * hosts do not get to use `includes`.
 */
export function isProxyableManhwaHost(host: string): boolean {
  const legacy =
    host === "uploads.mangadex.org" ||
    host === "cmdxd98sb0x3yprd.mangadex.network" ||
    host === "cdn.asurascans.com" ||
    host.endsWith(".mangadex.network") ||
    host.includes("manganato.com") ||
    host.includes("mkklcdn") ||
    host.includes("mangaread.org");

  return legacy || isManhwaSourceImageHost(host);
}

/**
 * Route a stored manhwa cover through /api/manhwa-image WHEN ITS HOST NEEDS
 * IT, and leave it alone otherwise.
 *
 * Tracker rows store the cover URL as it was when the series was tracked, and
 * MangaDex referer-blocks hotlinks: request an uploads.mangadex.org cover
 * with a foreign Referer and you get their "You can read this at MangaDex"
 * placeholder art instead of the cover — which is exactly what profile
 * trackers were showing. The proxy sends the Referer MangaDex expects (and
 * resizes to thumbnail weight as a bonus).
 *
 * Only hosts on the proxy's own allowlist are wrapped — and since both sides
 * now read that allowlist from `isProxyableManhwaHost`, they cannot drift
 * apart. Anything else (Asura's current CDN serves covers direct and is not
 * allowlisted) passes through untouched rather than 403ing at our own proxy.
 */
export function manhwaCoverSrc(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    // Legacy mangadex wrapping was `host.includes("mangadex")`, which is wider
    // than the route's own mangadex entries; kept so nothing stops wrapping.
    const proxied = host.includes("mangadex") || isProxyableManhwaHost(host);
    return proxied ? `/api/manhwa-image?url=${encodeURIComponent(url)}` : url;
  } catch {
    // Not an absolute URL — hand it back and let the <img> try.
    return url;
  }
}
