"use client";

import React, { useRef } from 'react';

type Props = {
  children: React.ReactNode;
  /** Max rotation in degrees on each axis. Keep small (8-12). */
  maxTilt?: number;
  /** Spotlight color (rgba). Pairs well with the accent. */
  spotlightColor?: string;
  /** Lift in px on hover enter. 0 disables. */
  liftY?: number;
  className?: string;
};

/**
 * 3D tilt card with a cursor-following spotlight. Used on HeroArtifact
 * and on emphasized pricing tiers. Keep tilt angles conservative —
 * anything above ~12° reads as gimmicky. Motion is disabled under
 * prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  maxTilt = 10,
  spotlightColor = 'rgba(29,78,216,0.18)',
  liftY = 0,
  className = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    const spot = spotRef.current;
    if (!el || !spot) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * maxTilt;
    const ry = (x - 0.5) * maxTilt;
    const lift = liftY ? `translateY(-${liftY}px) ` : '';
    el.style.transform = `${lift}rotateX(${rx}deg) rotateY(${ry}deg)`;
    spot.style.setProperty('--mx', `${x * 100}%`);
    spot.style.setProperty('--my', `${y * 100}%`);
    spot.style.opacity = '1';
  };
  const onLeave = () => {
    const el = ref.current;
    const spot = spotRef.current;
    if (el) el.style.transform = '';
    if (spot) spot.style.opacity = '0';
  };

  return (
    <div
      className={`[perspective:1200px] ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        ref={ref}
        className="relative transition-transform duration-300 ease-out [transform-style:preserve-3d] will-change-transform"
      >
        {children}
        <div
          ref={spotRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 mix-blend-multiply dark:mix-blend-screen motion-reduce:hidden"
          style={{
            background: `radial-gradient(circle 220px at var(--mx,50%) var(--my,50%), ${spotlightColor}, transparent 60%)`,
          }}
        />
      </div>
    </div>
  );
}
