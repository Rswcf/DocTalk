"use client";

import React from 'react';

interface DocTalkLogoProps {
  size?: number;
  className?: string;
  /** Monochrome variant uses currentColor throughout (good for favicons,
   *  footer bugs, single-color contexts). Default: branded (accent dots). */
  monochrome?: boolean;
}

/**
 * DocTalk brand glyph — "Document + Talk" in one mark.
 *
 * Concept (per 30-agent brand research):
 *   Paper page with a folded top-right corner (the document) holds three
 *   chat dots (the conversation). One shape expresses both words in the
 *   product name, and stays legible at 16px favicon size.
 *
 * Contrast with the previous two-overlapping-bubbles mark, which leaned
 * all-in on the "talk" half and lost the "doc" half entirely.
 *
 * Uses `currentColor` for the page outline so it inherits text color
 * everywhere (header wordmark, footer, loading states, inverted in dark).
 * The accent color on the dots is the single brand touch.
 */
export default function DocTalkLogo({
  size = 24,
  className = '',
  monochrome = false,
}: DocTalkLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Page body — filled with currentColor so it inherits the wordmark's
          color in any context. Top-right corner is "cut" via the path. */}
      <path
        d="M7 4
           L24 4
           L31 11
           L31 30
           Q31 32 29 32
           L7 32
           Q5 32 5 30
           L5 6
           Q5 4 7 4
           Z"
        fill="currentColor"
      />
      {/* Folded corner highlight — small triangle in background color to
          read as a turned-down corner. */}
      <path
        d="M24 4 L31 11 L24 11 Z"
        className="fill-white dark:fill-zinc-950"
        opacity="0.85"
      />
      {/* Chat dots — the "talk" part. Accent-colored (or inherited when
          monochrome) so the conversation signal pops inside the page. */}
      <circle cx="12" cy="22" r="2" className={monochrome ? 'fill-white dark:fill-zinc-950' : 'fill-accent'} />
      <circle cx="18" cy="22" r="2" className={monochrome ? 'fill-white dark:fill-zinc-950' : 'fill-accent'} />
      <circle cx="24" cy="22" r="2" className={monochrome ? 'fill-white dark:fill-zinc-950' : 'fill-accent'} />
    </svg>
  );
}
