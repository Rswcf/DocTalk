"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Page } from 'react-pdf';
import type { NormalizedBBox } from '../../types';

interface PageWithHighlightsProps {
  pageNumber: number;
  scale: number;
  highlights: NormalizedBBox[]; // 已过滤为本页的 bbox
}

// Validate bbox values are within expected bounds
function isValidBbox(bbox: NormalizedBBox): boolean {
  return (
    typeof bbox.x === 'number' && isFinite(bbox.x) && bbox.x >= 0 && bbox.x <= 1 &&
    typeof bbox.y === 'number' && isFinite(bbox.y) && bbox.y >= 0 && bbox.y <= 1 &&
    typeof bbox.w === 'number' && isFinite(bbox.w) && bbox.w > 0 && bbox.w <= 1 &&
    typeof bbox.h === 'number' && isFinite(bbox.h) && bbox.h > 0 && bbox.h <= 1
  );
}

// 矩形相交测试（带容差）
function bboxOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  tol = 0.005
): boolean {
  return (
    a.x < b.x + b.w + tol &&
    a.x + a.w > b.x - tol &&
    a.y < b.y + b.h + tol &&
    a.y + a.h > b.y - tol
  );
}

// HTML 特殊字符转义 - comprehensive escaping for security
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export default function PageWithHighlights({ pageNumber, scale, highlights }: PageWithHighlightsProps) {
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(null);

  const onLoadSuccess = useCallback((page: any) => {
    setPageDims({ w: page.originalWidth, h: page.originalHeight });
  }, []);

  // Filter highlights to only valid ones
  const validHighlights = useMemo(
    () => highlights.filter(isValidBbox),
    [highlights]
  );

  // customTextRenderer: 仅当有 highlights 且有 pageDims 时启用
  const customTextRenderer = useMemo(() => {
    if (validHighlights.length === 0 || !pageDims) return undefined;

    return (textItem: any) => {
      const { str, transform, width, height } = textItem;

      // Validate all required fields exist and are valid
      if (!str || typeof str !== 'string') return '';
      if (!Array.isArray(transform) || transform.length < 6) return str;
      if (typeof width !== 'number' || typeof height !== 'number') return str;
      if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return str;
      if (!pageDims.w || !pageDims.h || pageDims.w <= 0 || pageDims.h <= 0) return str;

      // Validate transform values
      const tx = transform[4];
      const ty = transform[5];
      if (typeof tx !== 'number' || typeof ty !== 'number' || !isFinite(tx) || !isFinite(ty)) {
        return str;
      }

      // 将 TextItem 坐标（PDF 用户空间，原点左下）转为归一化 [0,1]（原点左上）
      const textRect = {
        x: Math.max(0, Math.min(1, tx / pageDims.w)),
        y: Math.max(0, Math.min(1, 1.0 - ((ty + height) / pageDims.h))),
        w: Math.max(0, Math.min(1, width / pageDims.w)),
        h: Math.max(0, Math.min(1, height / pageDims.h)),
      };

      // 检查是否与任一 highlight bbox 相交
      const isHighlighted = validHighlights.some((hl) => bboxOverlap(textRect, hl));

      if (isHighlighted) {
        // Use hardcoded class name - never from user input
        return `<mark class="pdf-highlight">${escapeHtml(str)}</mark>`;
      }
      return str;
    };
  }, [validHighlights, pageDims]);

  return (
    <Page
      pageNumber={pageNumber}
      scale={scale}
      renderAnnotationLayer={false}
      customTextRenderer={customTextRenderer}
      onLoadSuccess={onLoadSuccess}
      loading={
        <div className="p-2 text-sm text-gray-500">
          Rendering page {pageNumber}…
        </div>
      }
    />
  );
}

