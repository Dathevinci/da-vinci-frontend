"use client";

import { useState, useRef, useEffect } from "react";

const TITLE_VIDEO_MP4 = "/title-font.mp4";
const DEFAULT_TITLE_FONT = "var(--font-fell), var(--font-cinzel), 'Cinzel', Georgia, serif";

export default function VideoTitle({
  text,
  className = "",
  font = DEFAULT_TITLE_FONT,
}: {
  text: string;
  className?: string;
  font?: string;
}) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const upper = text.toUpperCase();
  // Compute comfortable font size based on text length
  const fontSize = Math.min(150, Math.floor(950 / (Math.max(4, upper.length) * 0.65)));
  const viewH = Math.ceil(fontSize * 1.25);
  const baseline = Math.round(fontSize * 0.95);
  const clipId = `vt-clip-${upper.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className={`relative mx-auto select-none ${className}`}>
      {/* 
        High-performance SVG with clipped video element.
        Preloads immediately with autoPlay, muted, loop, playsInline.
      */}
      <svg
        viewBox={`0 0 1000 ${viewH}`}
        className="h-auto w-full transition-all duration-500"
        role="img"
        aria-label={text}
        style={{
          filter: "drop-shadow(0 4px 20px rgba(168,85,247,0.35)) drop-shadow(0 2px 10px rgba(251,191,36,0.25))",
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <text
              x="500"
              y={baseline}
              textAnchor="middle"
              fontSize={fontSize}
              fontWeight="900"
              letterSpacing="0.08em"
              style={{ fontFamily: font }}
            >
              {upper}
            </text>
          </clipPath>

          {/* Underlay gradient that shines through if video is loading or unsupported */}
          <linearGradient id={`${clipId}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="25%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="75%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Fallback & Initial Render Gradient (Instant, 0ms latency) */}
        <text
          x="500"
          y={baseline}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="900"
          letterSpacing="0.08em"
          fill={`url(#${clipId}-grad)`}
          style={{ fontFamily: font, opacity: videoLoaded ? 0.3 : 1 }}
          className="transition-opacity duration-700"
        >
          {upper}
        </text>

        {/* Clipped Video Layer */}
        <g clipPath={`url(#${clipId})`}>
          <foreignObject x="0" y="0" width="1000" height={viewH}>
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onPlaying={() => setVideoLoaded(true)}
              onLoadedData={() => setVideoLoaded(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: videoLoaded ? 1 : 0,
                transition: "opacity 0.5s ease-in-out",
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
