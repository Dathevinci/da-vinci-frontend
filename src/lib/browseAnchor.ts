"use client";

/**
 * CLIENT COMPONENTS ONLY. The "use client" directive above makes this module a
 * client boundary: a server component importing these functions would receive
 * client references rather than callables — and on this repo that ships (the
 * build ignores type errors) and throws at runtime.
 *
 * WHERE YOU WERE BROWSING BEFORE YOU STARTED READING.
 *
 * A reader is a dead end: MobileBottomNav returns null on every /chapter/
 * route, and the reader's own back arrow only reaches the series page. Getting
 * back to a browse grid meant unwinding the stack one tap at a time — worst
 * precisely when you have just decided a series is not worth another second.
 *
 * So the last browse surface is remembered, and the readers offer one tap back
 * to it. Not a hardcoded home: if you came from the explore grid with a genre
 * filter on, that filter is where you should land.
 *
 * sessionStorage rather than localStorage on purpose — this is "the trail of
 * this visit", and a week-old anchor from a closed tab is not somewhere anyone
 * expects a home button to go.
 */

const KEY = "davinci_browse_anchor";

/**
 * The surfaces worth returning to. Everything here is a place you BROWSE from;
 * readers, chapter pages and detail pages are deliberately absent — returning
 * to the series you just fled would defeat the entire point.
 *
 * /user/ is included because opening a series from someone's tracker shelf is a
 * browse, and their profile is the page you meant to be on.
 */
const BROWSE_SURFACES: RegExp[] = [
  /^\/$/,
  /^\/hub$/,
  /^\/explore$/,
  /^\/manhwa$/,
  /^\/manhwa\/explore$/,
  /^\/novel$/,
  /^\/novel\/explore$/,
  // Anchored: /community/post/<id> is a DETAIL page, and an unanchored prefix
  // would also swallow any future /community* sibling route.
  /^\/community$/,
  /^\/leaderboard$/,
  /^\/airing$/,
  /^\/upcoming$/,
  /^\/calendar$/,
  // "login" is excluded by name: for signed-out users the Profile tab links to
  // /user/login, which the dynamic [username] route serves as a full-screen
  // "User not found" — a Home button must never escape a reader into that.
  /^\/user\/(?!login$)[^/]+$/,
];

export function isBrowseSurface(pathname: string): boolean {
  return BROWSE_SURFACES.some((re) => re.test(pathname));
}

export function rememberBrowse(pathWithQuery: string): void {
  try {
    sessionStorage.setItem(KEY, pathWithQuery);
  } catch {
    /* private mode — the fallback still gets you out */
  }
}

/**
 * The remembered surface, or `fallback` when there isn't one — which is the
 * normal case for a deep link straight into a chapter, where there genuinely
 * is no "back" to offer.
 */
export function browseAnchorHref(fallback: string): string {
  try {
    const stored = sessionStorage.getItem(KEY);
    // Re-validated at READ time, not just at write time. The stored value
    // outlives allowlist changes (it sits in sessionStorage across deploys
    // within a tab's life), and trusting it blindly would also hand the Home
    // button to anything else that ever writes this key. The pathname must
    // pass the same test that admitted it.
    if (stored && stored.startsWith("/") && isBrowseSurface(stored.split("?")[0])) {
      return stored;
    }
  } catch {
    /* private mode */
  }
  return fallback;
}
