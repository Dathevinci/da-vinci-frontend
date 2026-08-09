/**
 * Serve Cloudinary uploads at the size they are actually displayed.
 *
 * Uploads are stored VERBATIM — banners deliberately skip the cropper
 * (SettingsModal explains why), so a 4000x2250 phone photo is served at
 * 4000x2250 into a viewport-width strip, and a cropped avatar arrives at a
 * couple of megapixels for a 160px circle. The browser pays that as a
 * main-thread decode and tens of MB of RGBA before it can even paint.
 *
 * This only rewrites the DELIVERY url. Nothing is re-uploaded, no stored data
 * changes, and a non-Cloudinary url (or an unrecognised shape) is returned
 * untouched — worst case you keep today's behaviour.
 *
 * Two rules keep it appearance-neutral, and both matter:
 *
 * 1. The transform is inserted as the LAST link of the chain, immediately
 *    before the /v<version>/ segment. Cloudinary applies chained transforms in
 *    order, and animated-GIF avatars carry a `c_crop` from the cropper — put a
 *    resize BEFORE that crop and it crops the wrong region, silently ruining
 *    an avatar someone paid 500 Arise Points for.
 * 2. `c_limit` only ever shrinks. A plain `w_` would UPSCALE a small image,
 *    which costs bytes and softens it.
 *
 * GIFs skip `f_auto`: format-shifting an animated GIF is exactly the kind of
 * thing that turns a paid animated avatar into a still frame. Not worth the
 * few KB.
 */

const VERSION_SEGMENT = /^v\d+$/;

export function cloudinaryFit(url: string | null | undefined, width: number): string {
  if (!url) return "";
  // Only Cloudinary delivery urls have an /upload/ pivot to chain onto.
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;

  const pivot = url.indexOf("/upload/");
  const head = url.slice(0, pivot + "/upload/".length);
  const tail = url.slice(pivot + "/upload/".length);

  const segments = tail.split("/");
  const versionAt = segments.findIndex((s) => VERSION_SEGMENT.test(s));
  // No version segment means this isn't the shape secure_url returns; leave it
  // alone rather than guess where the transform chain ends.
  if (versionAt === -1) return url;

  // POSSIBLY-ANIMATED SOURCES ARE LEFT ALONE ENTIRELY.
  //
  // A GIF banner is stored with no transform at all, so Cloudinary currently
  // streams the original bytes and never processes the file. Adding a resize
  // would make it the FIRST transform applied to a multi-frame image — and
  // Cloudinary caps animated transforms by total pixels across every frame,
  // answering 400 above the limit. The failure mode isn't a heavy banner, it's
  // a MISSING one, on a feature people paid Arise Points for.
  //
  // webp and apng are here for the same reason even though most are static:
  // an extension can't tell us whether they animate, and the trade is
  // lopsided — skipping them costs a few KB on some images, transforming an
  // animated one costs somebody their banner. Phone photos (jpg/png), which
  // are the multi-megapixel case this whole helper exists for, are unaffected.
  if (/\.(gif|apng|webp)($|[?#])/i.test(url)) return url;

  segments.splice(versionAt, 0, `f_auto,q_auto,c_limit,w_${width}`);
  return head + segments.join("/");
}
