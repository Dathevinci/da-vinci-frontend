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
 * Only hosts on the proxy's own allowlist are wrapped. Wrapping everything
 * would 403 the rest at our own proxy — Asura's current CDN serves covers
 * direct and is not allowlisted, so its URLs must pass through untouched.
 */
export function manhwaCoverSrc(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const proxied =
      host.includes("mangadex") ||
      host === "cdn.asurascans.com" ||
      host.includes("manganato") ||
      host.includes("mkklcdn") ||
      host.includes("mangaread");
    return proxied ? `/api/manhwa-image?url=${encodeURIComponent(url)}` : url;
  } catch {
    // Not an absolute URL — hand it back and let the <img> try.
    return url;
  }
}
