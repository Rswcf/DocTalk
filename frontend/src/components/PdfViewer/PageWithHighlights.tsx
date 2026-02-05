"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Page } from 'react-pdf';
import type { NormalizedBBox } from '../../types';

interface PageWithHighlightsProps {
  pageNumber: number;
  scale: number;
  highlights: NormalizedBBox[]; // 已过滤为本页的 bbox
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

// HTML 特殊字符转义
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function PageWithHighlights({ pageNumber, scale, highlights }: PageWithHighlightsProps) {
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(null);

  const onLoadSuccess = useCallback((page: any) => {
    setPageDims({ w: page.originalWidth, h: page.originalHeight });
  }, []);

  // customTextRenderer: 仅当有 highlights 且有 pageDims 时启用
  const customTextRenderer = useMemo(() => {
    if (highlights.length === 0 || !pageDims) return undefined;

    return (textItem: any) => {
      const { str, transform, width, height } = textItem;
      if (!str || !transform || !pageDims.w || !pageDims.h) return str;

      // 将 TextItem 坐标（PDF 用户空间，原点左下）转为归一化 [0,1]（原点左上）
      const textRect = {
        x: transform[4] / pageDims.w,
        y: 1.0 - ((transform[5] + height) / pageDims.h),
        w: width / pageDims.w,
        h: height / pageDims.h,
      };

      // 检查是否与任一 highlight bbox 相交
      const isHighlighted = highlights.some((hl) => bboxOverlap(textRect, hl));

      if (isHighlighted) {
        return `<mark class="pdf-highlight">${escapeHtml(str)}</mark>`;
      }
      return str;
    };
  }, [highlights, pageDims]);

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

