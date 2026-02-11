"use client";

import React from 'react';

interface DocTalkLogoProps {
  size?: number;
  className?: string;
}

/**
 * DocTalk brand mark — "Talk Flow" concept.
 * Two overlapping chat bubbles: a lighter back bubble (document/source)
 * and a solid front bubble (AI conversation/citation).
 */
export default function DocTalkLogo({ size = 24, className = '' }: DocTalkLogoProps) {
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
      {/* Back bubble — Document (lighter, slightly angular) */}
      <path
        d="M5 2H21Q24 2 24 5V16Q24 19 21 19H10L5 25V19Q2 19 2 16V5Q2 2 5 2Z"
        className="fill-indigo-200 dark:fill-indigo-400/25"
      />
      {/* Front bubble — Conversation (solid, rounded) */}
      <path
        d="M15 13H31Q34 13 34 16V26Q34 29 31 29H22L27 35L19 29H15Q12 29 12 26V16Q12 13 15 13Z"
        className="fill-indigo-600 dark:fill-indigo-400"
      />
    </svg>
  );
}
