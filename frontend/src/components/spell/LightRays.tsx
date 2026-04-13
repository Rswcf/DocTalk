import React from 'react';

type Props = {
  className?: string;
  /** Animation period in seconds. */
  speed?: number;
  /** Outer blur radius in pixels. */
  blur?: number;
  /** Soft noise overlay for grain. */
  grain?: boolean;
};

/**
 * Decorative slow-drifting conic-gradient background. Replaces the flat
 * static `glow-accent` halo for dark-mode hero or any surface where the
 * old accent-light radial glow fell flat. Pointer-events-none,
 * aria-hidden — purely atmospheric.
 */
export default function LightRays({
  className = '',
  speed = 14,
  blur = 60,
  grain = true,
}: Props) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute -inset-[40%] opacity-90 motion-reduce:animate-none"
        style={{
          background: `conic-gradient(from 45deg at 30% 40%,
            transparent 0deg,
            rgba(96,165,250,0.22) 60deg,
            transparent 120deg,
            rgba(29,78,216,0.18) 180deg,
            transparent 240deg,
            rgba(147,197,253,0.15) 300deg,
            transparent 360deg)`,
          filter: `blur(${blur}px)`,
          animation: `spellRayDrift ${speed}s ease-in-out infinite`,
        }}
      />
      {grain && (
        <div
          className="absolute inset-0 opacity-60 mix-blend-screen motion-reduce:opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
      )}
      <style>{`@keyframes spellRayDrift {
        0%  { transform: translate(-10%, -10%) rotate(0deg); }
        50% { transform: translate(8%, 5%) rotate(15deg); }
        100%{ transform: translate(-10%, -10%) rotate(0deg); }
      }`}</style>
    </div>
  );
}
