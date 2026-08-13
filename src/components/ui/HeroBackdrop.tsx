/**
 * THE HERO BACKDROP — the artwork behind a detail screen's poster.
 *
 * Anime, Manhwa, and Novels get rich cinematic backdrops:
 * 1. Wide banners are shown crisp, high-opacity, anchored to top with smooth bottom fade.
 * 2. Portrait covers render dual-layered: high-radius ambient color blur + stylized cinematic vignette.
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
        <>
          {/* Layer 1: Ambient color bloom / glow across the entire hero background */}
          <img
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full scale-125 object-cover object-center opacity-60 blur-3xl"
          />

          {/* Layer 2: Main backdrop image */}
          {wide ? (
            <img
              src={src}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-x-0 top-0 h-[80%] w-full object-cover object-top opacity-70 sm:opacity-80 brightness-95 contrast-105"
            />
          ) : (
            <img
              src={src}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full scale-110 object-cover object-center opacity-45 blur-lg brightness-90 contrast-110"
            />
          )}
        </>
      )}

      {/* Atmospheric overlays: floor fade and cinematic vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070709]/20 via-[#070709]/75 to-[#070709]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_15%,transparent_25%,rgba(7,7,9,0.85))]" />
    </div>
  );
}
