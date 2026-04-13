"use client";

import React from 'react';

type Props = {
  items: React.ReactNode[];
  /** Full traverse duration in seconds. Higher = slower. */
  speed?: number;
  /** Pixel gap between items. */
  gap?: number;
  /** Pause animation on hover. */
  pauseOnHover?: boolean;
  /** Optional separator node between items (e.g. a middle dot). */
  separator?: React.ReactNode;
  className?: string;
  itemClassName?: string;
};

/**
 * Infinite horizontal marquee. Content is rendered twice and translated
 * -50%, creating a seamless loop. Fades at both edges via mask-image.
 * Disabled under prefers-reduced-motion — content still renders, just
 * static.
 */
export default function TextMarquee({
  items,
  speed = 32,
  gap = 32,
  pauseOnHover = true,
  separator,
  className = '',
  itemClassName = '',
}: Props) {
  const withSep = (arr: React.ReactNode[], keyPrefix: string) =>
    arr.flatMap((n, i) =>
      i === 0 || !separator
        ? [
            <span key={`${keyPrefix}-i${i}`} className={itemClassName}>
              {n}
            </span>,
          ]
        : [
            <span key={`${keyPrefix}-s${i}`} aria-hidden className="text-zinc-300 dark:text-zinc-600 select-none">
              {separator}
            </span>,
            <span key={`${keyPrefix}-i${i}`} className={itemClassName}>
              {n}
            </span>,
          ]
    );

  return (
    <div
      className={`relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] ${className}`}
    >
      <div
        className={`flex whitespace-nowrap will-change-transform motion-reduce:[animation:none!important] ${
          pauseOnHover ? 'hover:[animation-play-state:paused]' : ''
        }`}
        style={{
          gap: `${gap}px`,
          animation: `spellMarquee ${speed}s linear infinite`,
        }}
      >
        <div className="flex flex-none items-center" style={{ gap: `${gap}px` }}>
          {withSep(items, 'a')}
        </div>
        <div className="flex flex-none items-center" aria-hidden style={{ gap: `${gap}px` }}>
          {withSep(items, 'b')}
        </div>
      </div>
      <style>{`@keyframes spellMarquee { to { transform: translateX(calc(-50% - ${gap / 2}px)); } }`}</style>
    </div>
  );
}
