"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  text: string;
  className?: string;
}) {
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const upper = text.toUpperCase();
  // Anton advance width ≈ 0.56em. Compute clean scale with safe margins to avoid any clipping.
  const charAdvance = 0.56;
  const targetWidth = 900;
  const fontSize = Math.min(160, Math.floor(targetWidth / (Math.max(4, upper.length) * charAdvance)));
  const viewW = 1000;
  const viewH = Math.ceil(fontSize * 1.12);
  const baseline = Math.round(fontSize * 0.90);
  const clipId = `vt-clip-${upper.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className={`relative mx-auto select-none ${className}`}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-auto w-full"
        role="img"
        aria-label={text}
        style={{
          filter: "drop-shadow(0 2px 14px rgba(139,92,246,0.3))",
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <text
              x={viewW / 2}
              y={baseline}
              textAnchor="middle"
              fontSize={fontSize}
              letterSpacing="0.04em"
              style={{ fontFamily: TITLE_FONT, fontWeight: 900 }}
            >
              {upper}
            </text>
          </clipPath>

          <linearGradient id={`${clipId}-fallback`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6d28d9" />
            <stop offset="20%" stopColor="#a78bfa" />
            <stop offset="40%" stopColor="#f5f3ff" />
            <stop offset="60%" stopColor="#c4b5fd" />
            <stop offset="80%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>

        {/* Instant Fallback Text (Renders on frame 0 with 0ms delay) */}
        <text
          x={viewW / 2}
          y={baseline}
          textAnchor="middle"
          fontSize={fontSize}
          letterSpacing="0.04em"
          fill={`url(#${clipId}-fallback)`}
          style={{
            fontFamily: TITLE_FONT,
            fontWeight: 900,
            opacity: videoReady ? 0.2 : 1,
            transition: "opacity 0.4s ease-out",
          }}
        >
          {upper}
        </text>

        {/* Clipped Playing Video */}
        <g clipPath={`url(#${clipId})`}>
          <foreignObject x="0" y="0" width={viewW} height={viewH}>
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onPlaying={() => setVideoReady(true)}
              onLoadedData={() => setVideoReady(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: videoReady ? 1 : 0,
                transition: "opacity 0.3s ease-in",
              }}
            >
              <source src={TITLE_VIDEO_MP4} type="video/mp4" />
            </video>
          </foreignObject>
        </g>
      </svg>
    </div>
  );
}
