"use client";

import React from 'react';
import type { NormalizedBBox } from '../../types';

interface HighlightOverlayProps {
  highlights: NormalizedBBox[];
  pageWidth: number;
  pageHeight: number;
}

export default function HighlightOverlay({ highlights, pageWidth, pageHeight }: HighlightOverlayProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {highlights?.map((b, idx) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: b.x * pageWidth,
          top: b.y * pageHeight,
          width: b.w * pageWidth,
          height: b.h * pageHeight,
        };
        return (
          <div
            key={idx}
            className="bg-yellow-300/40 ring-2 ring-yellow-400 animate-pulse"
            style={style}
          />
        );
      })}
    </div>
  );
}
