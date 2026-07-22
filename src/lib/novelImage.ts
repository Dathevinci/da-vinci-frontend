// Build the same-origin proxied cover URL for a novel. The proxy upscales +
// sharpens low-res source thumbnails (see /api/novel-image). The `v` tag busts
// the browser cache whenever the proxy's image treatment changes — bump it and
// every stale cached cover is re-fetched at the new quality. (The proxy ignores
// `v`; it only reads `url`.)
const COVER_V = "hd4";

export function novelCover(url?: string | null): string | null {
  if (!url) return null;
  // Anilist and external CDNs don't need hotlink proxying or upscaling
  if (url.includes("anilist.co") || url.includes("kitsu.io") || url.includes("myanimelist.net")) {
    return url;
  }
  return `/api/novel-image?url=${encodeURIComponent(url)}&v=${COVER_V}`;
}
