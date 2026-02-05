"use client";

import React from 'react';
import type { NormalizedBBox } from '../../types';

interface HighlightOverlayProps {
  highlights: NormalizedBBox[];
  pageWidth: number;
  pageHeight: number;
}

export default function HighlightOverlay({ highlights, pageWidth, pageHeight }: HighlightOverlayProps) {
  if (!highlights || highlights.length === 0) return null;

  // Compute union bounding box without spread to avoid large-arg issues
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const b of highlights) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    const rx = b.x + b.w;
    const ry = b.y + b.h;
    if (rx > maxX) maxX = rx;
    if (ry > maxY) maxY = ry;
  }

  const left = minX * pageWidth;
  const top = minY * pageHeight;
  const width = (maxX - minX) * pageWidth;
  const height = (maxY - minY) * pageHeight;

  // Clamp bar position to avoid rendering outside container
  const barLeft = Math.max(0, left - 6);

  return (
    <div className="absolute inset-0 pointer-events-none"
         style={{ width: pageWidth, height: pageHeight }}>
      {/* 左侧色条指示器 */}
      <div
        className="absolute bg-sky-500 dark:bg-sky-400 rounded-sm animate-fadeIn"
        style={{ left: barLeft, top, width: 4, height }}
      />
      {/* 极淡背景 */}
      <div
        className="absolute bg-sky-500/[0.08] dark:bg-sky-300/[0.12] rounded-sm animate-fadeIn"
        style={{ left, top, width, height }}
      />
    </div>
  );
}
