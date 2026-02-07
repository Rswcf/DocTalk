"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Page } from 'react-pdf';
import { useLocale } from '../../i18n';
import type { NormalizedBBox } from '../../types';

interface PageWithHighlightsProps {
  pageNumber: number;
  scale: number;
  highlights: NormalizedBBox[]; // 已过滤为本页的 bbox
}

// Validate bbox values are within expected bounds (allow h=0 for overlay estimation)
function isValidBbox(bbox: NormalizedBBox): boolean {
  return (
    typeof bbox.x === 'number' && isFinite(bbox.x) && bbox.x >= 0 && bbox.x <= 1 &&
    typeof bbox.y === 'number' && isFinite(bbox.y) && bbox.y >= 0 && bbox.y <= 1 &&
    typeof bbox.w === 'number' && isFinite(bbox.w) && bbox.w > 0 && bbox.w <= 1 &&
    typeof bbox.h === 'number' && isFinite(bbox.h) && bbox.h >= 0 && bbox.h <= 1
  );
}

// 矩形相交测试（带容差）— increased tolerance for PyMuPDF/PDF.js coord differences
function bboxOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  tol = 0.02
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
  const { t } = useLocale();
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
      if (!isFinite(width) || !isFinite(height) || width <= 0) return str;
      if (!pageDims.w || !pageDims.h || pageDims.w <= 0 || pageDims.h <= 0) return str;

      // Validate transform values
      const tx = transform[4];
      const ty = transform[5];
      if (typeof tx !== 'number' || typeof ty !== 'number' || !isFinite(tx) || !isFinite(ty)) {
        return str;
      }

      // Handle height=0 edge case: estimate as ~1 line height
      const effectiveHeight = height > 0 ? height : pageDims.h * 0.015;

      // 将 TextItem 坐标（PDF 用户空间，原点左下）转为归一化 [0,1]（原点左上）
      const textRect = {
        x: Math.max(0, Math.min(1, tx / pageDims.w)),
        y: Math.max(0, Math.min(1, 1.0 - ((ty + effectiveHeight) / pageDims.h))),
        w: Math.max(0, Math.min(1, width / pageDims.w)),
        h: Math.max(0, Math.min(1, effectiveHeight / pageDims.h)),
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

  // Compute rendered dimensions for overlay positioning
  const renderedW = pageDims ? pageDims.w * scale : 0;
  const renderedH = pageDims ? pageDims.h * scale : 0;

  return (
    <div className="relative">
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderAnnotationLayer={false}
        customTextRenderer={customTextRenderer}
        onLoadSuccess={onLoadSuccess}
        loading={
          <div className="p-2 text-sm text-zinc-500">
            {t('doc.renderingPage', { page: pageNumber })}
          </div>
        }
      />
      {/* Overlay layer: always-visible highlight rectangles for cited areas */}
      {validHighlights.length > 0 && pageDims && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: renderedW,
            height: renderedH,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {validHighlights.map((bbox, i) => {
            // Estimate height if 0 (~1 line)
            const h = bbox.h > 0 ? bbox.h : 0.015;
            return (
              <div
                key={i}
                className="citation-overlay"
                data-highlight-anchor={i === 0 ? 'true' : undefined}
                style={{
                  position: 'absolute',
                  left: bbox.x * renderedW,
                  top: bbox.y * renderedH,
                  width: bbox.w * renderedW,
                  height: h * renderedH,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

