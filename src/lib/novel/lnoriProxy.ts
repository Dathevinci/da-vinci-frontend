/**
 * LNORI FILE ADDRESSES ARE ENCODED OUT OF THE URL BAR.
 *
 * Download managers (AntDM, IDM, JDownloader and friends) hook URLs by file
 * extension, and they do not care whether the URL is a file or a page. While
 * the chapter id WAS the `.epub` address, every link in the app — including
 * ones Next only prefetched — was a route path ending in `.epub`, so opening a
 * series threw a "save this file?" dialog for each one. Nothing was actually
 * downloading; the shape of the URL was enough to set the manager off.
 *
 * So the address travels base64'd. `.epub` appears nowhere in any URL the
 * browser sees, and there is nothing left for an extension to recognise.
 *
 * encodeURIComponent first because btoa only accepts Latin-1 and these
 * filenames carry brackets, spaces and the occasional non-ASCII title; the
 * route reverses both steps.
 */

export function encodeLnori(url: string): string {
  const ascii = encodeURIComponent(url);
  const b64 = typeof window === "undefined"
    ? Buffer.from(ascii, "utf8").toString("base64")
    : btoa(ascii);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The book itself, for epub.js. `download` turns it into a deliberate save. */
export function lnoriFileUrl(fileUrl: string, download = false): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/proxy/lnori?b=${encodeLnori(fileUrl)}${download ? "&dl=1" : ""}`;
}

/** The volume's cover, extracted from the archive server-side. */
export function lnoriCoverUrl(fileUrl: string): string {
  return `/api/proxy/lnori/cover?b=${encodeLnori(fileUrl)}`;
}

/**
 * Server side of the above. Takes either param and returns a verified
 * files.lnori.com address, or null — `url` is still honoured so links shared or
 * bookmarked before the encoding change keep working.
 *
 * The host check is the security boundary: without it this is an open proxy
 * anyone could point at any URL on the internet.
 */
export function decodeLnoriTarget(b: string | null, url: string | null): string | null {
  if (b) {
    try {
      const b64 = b.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = decodeURIComponent(Buffer.from(b64, "base64").toString("utf8"));
      return decoded.startsWith("https://files.lnori.com/") ? decoded : null;
    } catch {
      return null;
    }
  }
  return url && url.startsWith("https://files.lnori.com/") ? url : null;
}
