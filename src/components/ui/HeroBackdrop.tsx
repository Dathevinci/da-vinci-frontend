/**
 * THE HERO BACKDROP — the artwork behind a detail screen's poster.
 *
 * Anime carry a real wide banner (AniList bannerImage, else the trailer's
 * HD still), so it is shown SHARP and anchored to the top, melting into
 * the page through a bottom fade. It used to be buried under blur-2xl at
 * 35% opacity, which threw away the one piece of wide art we have.
 *
 * Manhwa and novels have no wide art — only a portrait cover — so a
 * stretched copy has to stay blurred or it smears. It gets the same
 * fade and a lighter blur so the two read as one design.
 *
 * The overflow-hidden lives HERE rather than on the hero itself: on the
 * hero it clipped the tracker dropdowns that open past its bottom edge.
 */
export default function HeroBackdrop({
  src,
  wide,
}: {
  src: string | null | undefined;
  /** true when `src` is genuine wide art rather than a portrait cover */
  wide: boolean;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {src && (
        <img
          src={src}
          alt=""
          className={
            wide
              ? "absolute inset-x-0 top-0 h-[70%] w-full object-cover object-top opacity-[0.55]"
              : "absolute inset-0 h-full w-full scale-110 object-cover object-top opacity-40 blur-xl"
          }
        />
      )}
      {/* the art fades down into the page floor */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070709]/25 via-[#070709]/80 to-[#070709]" />
      {/* and inward from the edges, so it never ends on a hard seam */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_0%,transparent_35%,rgba(7,7,9,0.75))]" />
    </div>
  );
}
