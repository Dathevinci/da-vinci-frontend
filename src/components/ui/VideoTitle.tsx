"use client";

import { useState, type CSSProperties } from "react";

/**
 * VIDEO-IN-LETTERS TITLE — the landing wordmark's trick, reusable.
 *
 * Renders the text in Anton (the Lunar block face). If the site's title clip
 * exists (public/title-font.webm|mp4), the letters become a clipPath over the
 * playing video; otherwise they fill with the amethyst gradient. A hidden
 * metadata probe decides which — no file means two silent 404s and the
 * gradient title simply stays.
 *
 * Geometry is auto-sized from the text length so "DA VINCI" and
 * "LEADERBOARD" both fill their line without per-page tuning. The clipPath
 * id embeds a slug of the text, so titles with DIFFERENT texts never
 * collide on one page (two instances of the SAME text would — suffix with
 * useId() if that ever becomes a real layout).
 *
 * Known caveat (accepted for the Chrome + TWA audience): Safari's
 * foreignObject clipping is historically buggy — same as the landing.
 */

const TITLE_VIDEO_WEBM = "/title-font.webm";
const TITLE_VIDEO_MP4 = "/title-font.mp4";
const TITLE_FONT = "var(--font-anton), Impact, 'Arial Black', sans-serif";

const AMETHYST_FILL: CSSProperties = {
  backgroundImage:
    "linear-gradient(100deg, #6d28d9 0%, #a78bfa 18%, #f5f3ff 32%, #c4b5fd 46%, #8b5cf6 62%, #a78bfa 82%, #6d28d9 100%)",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function VideoTitle({
  text,
  className = "",
}: {
  /** The heading text — rendered uppercase in the block face. */
  text: string;
  /** Sizing/spacing for the WRAPPER (e.g. "w-full max-w-3xl mx-auto"). */
  className?: string;
}) {
  const [videoOk, setVideoOk] = useState(false);

  const upper = text.toUpperCase();
  // Anton caps advance ≈ 0.56em; fill ~94% of the 1000-unit line, capped so
  // short words don't balloon. Baseline sits at ~88% of the font size.
  const fontSize = Math.min(170, Math.floor(940 / (Math.max(4, upper.length) * 0.56)));
  const viewH = Math.ceil(fontSize * 1.06);
  const baseline = Math.round(fontSize * 0.88);
  const clipId = `vt-clip-${upper.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className={className}>
      {/* Probe — unmounts once the video is known good. */}
      {!videoOk && (
        <video
          className="hidden"
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setVideoOk(true)}
        >
          <source src={TITLE_VIDEO_WEBM} type="video/webm" />
          <source src={TITLE_VIDEO_MP4} type="video/mp4" />
        </video>
      )}

      {videoOk ? (
        <svg viewBox={`0 0 1000 ${viewH}`} className="h-auto w-full" role="img" aria-label={text}>
          <defs>
            <clipPath id={clipId}>
              <text
                x="500"
                y={baseline}
                textAnchor="middle"
                fontSize={fontSize}
                letterSpacing="0.04em"
                style={{ fontFamily: TITLE_FONT }}
              >
                {upper}
              </text>
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <foreignObject x="0" y="0" width="1000" height={viewH}>
              <video
                autoPlay
                muted
                loop
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              >
                <source src={TITLE_VIDEO_WEBM} type="video/webm" />
                <source src={TITLE_VIDEO_MP4} type="video/mp4" />
              </video>
            </foreignObject>
          </g>
        </svg>
      ) : (
        <h1
          className="text-center uppercase leading-none tracking-[0.04em]"
          style={{
            ...AMETHYST_FILL,
            fontFamily: TITLE_FONT,
            // Approximate the SVG's optical size so the gradient→video swap
            // doesn't visibly jump. Viewport-clamped; exactness isn't critical
            // because in production the video exists and swaps in on mount.
            fontSize: `clamp(2.25rem, ${((fontSize / 1000) * 100 * 0.75).toFixed(1)}vw, ${fontSize}px)`,
          }}
        >
          {upper}
        </h1>
      )}
    </div>
  );
}
