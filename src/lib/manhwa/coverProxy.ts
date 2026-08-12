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
 * source's domain — which is the only way to get these right, because two of
 * the three new sources serve their art from a domain that has nothing to do
 * with their own:
 *
 *   FlameComics  flamecomics.com 301s to flamecomics.xyz; covers AND chapter
 *                pages both come from cdn.flamecomics.xyz
 *                (/uploads/images/series/<id>/thumbnail.jpg?<ts>).
 *   RizzComics   covers are served by the site itself, rizzfables.com
 *                (/assets/images/<slug>.webp), but chapter pages come from
 *                cdn.55779955.xyz (/file/roraor/wp-content/uploads/...) —
 *                an unrelated bucket domain. Both are needed.
 *   MangaPill    nothing is served from mangapill.com. Covers and pages alike
 *                come from cdn.readdetectiveconan.com
 *                (/file/mangapill/i/<id>.jpeg, /file/mangap/<id>/<ch>/<n>.jpeg).
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

/** Image hosts for the three sources the owner added. Observed, not guessed. */
export const MANHWA_IMAGE_HOSTS = [
  "cdn.flamecomics.xyz", // FlameComics — covers + pages
  "rizzfables.com", // RizzComics — covers
  "cdn.55779955.xyz", // RizzComics — chapter pages
  "cdn.readdetectiveconan.com", // MangaPill — covers + pages
] as const;

/** True for the newly added source hosts (dot-boundary safe). */
export function isManhwaSourceImageHost(host: string): boolean {
  return MANHWA_IMAGE_HOSTS.some((d) => isHostOrSubdomain(host, d));
}

/**
 * HOTLINK PROTECTION, MEASURED PER HOST.
 *
 * cdn.readdetectiveconan.com (MangaPill) 403s a request with no Referer AND
 * one with a foreign Referer; only `https://mangapill.com/` gets the bytes.
 * The Flame and Rizz hosts served 200 in all three cases, so their Referer is
 * belt-and-braces — set anyway, because these CDNs turn hotlink protection on
 * without warning and the correct value costs nothing.
 */
const REFERERS: Record<string, string> = {
  "cdn.flamecomics.xyz": "https://flamecomics.xyz/",
  "rizzfables.com": "https://rizzfables.com/",
  "cdn.55779955.xyz": "https://rizzfables.com/",
  "cdn.readdetectiveconan.com": "https://mangapill.com/",
};

/** The Referer a newly added host wants, or null if it is not one of ours. */
export function manhwaSourceReferer(host: string): string | null {
  for (const [domain, referer] of Object.entries(REFERERS)) {
    if (isHostOrSubdomain(host, domain)) return referer;
  }
  return null;
}

/**
 * HOSTS THE RESIZER CANNOT FETCH, SO DO NOT ASK IT TO.
 *
 * The proxy resizes covers through wsrv.nl by default. wsrv refuses two of
 * these outright — `{"code":400,"message":"Domain or TLD blocked by policy"}`
 * for both `.xyz` CDNs — and gets a 403 from MangaPill's CDN because it
 * cannot send a mangapill.com Referer on our behalf.
 *
 * The route already falls back to a direct fetch when wsrv is unhappy, so
 * these loaded even before this list existed; the list just stops us paying a
 * doomed round-trip on every single cover. The cost is that covers from these
 * three arrive at full size — the weight problem the route's own comment
 * describes. rizzfables.com resizes fine (verified 200) and is deliberately
 * absent so it keeps getting thumbnails.
 */
const WSRV_CANNOT_FETCH = [
  "cdn.flamecomics.xyz",
  "cdn.55779955.xyz",
  "cdn.readdetectiveconan.com",
];

/** False when wsrv.nl is known to refuse this host — fetch it directly. */
export function canResizeViaWsrv(host: string): boolean {
  return !WSRV_CANNOT_FETCH.some((d) => isHostOrSubdomain(host, d));
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
