"use client";

import React, { useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react';
import { Page } from 'react-pdf';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { useLocale } from '../../i18n';
import type { NormalizedBBox } from '../../types';
import { evidenceOverlap, findEvidenceRange, groupEvidenceRegions, groupEvidenceMargins, mergeEvidenceLines, type EvidenceKind, validEvidenceBox } from '../../lib/pdfEvidence';

interface PageWithHighlightsProps {
  pageNumber: number;
  scale: number;
  highlights: NormalizedBBox[];
  searchQuery?: string;
  highlightSnippet?: string | null;
  highlightFocus?: string | null;
  citationIndex?: number;
  navigationId?: number;
  hidden?: boolean;
  onEvidenceReady?: () => void;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

function textPoint(element: HTMLElement, offset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (offset <= length) return { node, offset };
    offset -= length; node = walker.nextNode();
  }
  return null;
}

const PageWithHighlights = React.memo(function PageWithHighlights({ pageNumber, scale, highlights, searchQuery, highlightSnippet, highlightFocus, citationIndex, navigationId, hidden, onEvidenceReady }: PageWithHighlightsProps) {
  const { t } = useLocale();
  const root = useRef<HTMLDivElement>(null);
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(null);
  const [textEpoch, setTextEpoch] = useState(0);
  const textRenderRef = useRef<{ scale: number; searchQuery?: string } | null>(null);
  const [textFailed, setTextFailed] = useState(false);
  const [pageFailed, setPageFailed] = useState(false);
  const [evidence, setEvidence] = useState<{ kind: EvidenceKind; rects: NormalizedBBox[]; ready: boolean }>({ kind: 'page', rects: [], ready: false });
  const measuredRef = useRef<{ kind: EvidenceKind; rects: NormalizedBBox[]; ready: boolean; candidate: string | null | undefined; navigationId?: number; textEpoch: number } | null>(null);
  const onLoadSuccess = useCallback((page: PDFPageProxy) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageFailed(false);
    setPageDims({ w: viewport.width, h: viewport.height });
  }, []);
  const onTextReady = useCallback(() => {
    textRenderRef.current = { scale, searchQuery };
    setTextFailed(false); setTextEpoch(value => value + 1);
  }, [scale, searchQuery]);
  const onTextFailed = useCallback((error: Error) => {
    if (error?.name === 'AbortException') return; // Expected on zoom/search cancellation.
    setTextFailed(true);
  }, []);
  const onPageFailed = useCallback(() => setPageFailed(true), []);
  const onPageRendered = useCallback(() => setPageFailed(false), []);
  const regions = useMemo(() => groupEvidenceRegions(highlights), [highlights]);
  // Only the explicitly cited page receives text candidates, including the
  // converted-PDF path. Other virtualized pages cannot match stray short words.
  const candidate = highlightFocus || (highlights.some(box => box.x === 0 && box.y === 0 && box.w === 1 && box.h === 1) ? highlightSnippet : null);

  useLayoutEffect(() => {
    const element = root.current;
    if (pageFailed) {
      measuredRef.current = null;
      setEvidence({ kind: 'page', rects: [], ready: true });
      onEvidenceReady?.();
      return;
    }
    if (!element || !pageDims) return;
    let frame = 0;
    const measure = () => {
      const page = element.querySelector<HTMLElement>('.react-pdf__Page');
      if (!page) return;
      const bounds = page.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return; // Hidden mobile pane: wait for ResizeObserver.
      const ready = (textEpoch > 0 && textRenderRef.current?.scale === scale
        && textRenderRef.current?.searchQuery === searchQuery) || textFailed;
      const previous = measuredRef.current;
      // Keep normalized geometry through both empty and partially rebuilt text
      // layers. A new citation never inherits the previous citation's geometry.
      if (!ready && previous?.ready && previous.candidate === candidate
        && previous.navigationId === navigationId) return;
      let kind: EvidenceKind = regions.length ? 'region' : 'page';
      let rects = groupEvidenceMargins(regions);
      if (candidate && ready && !textFailed) {
        const spans = Array.from(element.querySelectorAll<HTMLElement>('.textLayer span[role="presentation"]'))
          .filter(span => span.textContent && !span.querySelector('span[role="presentation"]'));
        const toBox = (rect: DOMRect): NormalizedBBox => ({ x: (rect.left - bounds.left) / bounds.width, y: (rect.top - bounds.top) / bounds.height, w: rect.width / bounds.width, h: rect.height / bounds.height, page: pageNumber });
        const runs = spans.map(span => ({ text: span.textContent || '', box: toBox(span.getBoundingClientRect()) }));
        const match = findEvidenceRange(runs, candidate, regions);
        if (match) {
          const measured: NormalizedBBox[] = [];
          let complete = true;
          for (let i = match.start.run; i <= match.end.run; i++) {
            const start = textPoint(spans[i], i === match.start.run ? match.start.offset : 0);
            const end = textPoint(spans[i], i === match.end.run ? match.end.offset : runs[i].text.length);
            if (!start || !end) { complete = false; break; }
            const range = document.createRange();
            range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
            for (const rect of Array.from(range.getClientRects())) {
              if (rect.width > 0 && rect.height > 0) measured.push(toBox(rect));
            }
          }
          if (complete && measured.length && measured.every(validEvidenceBox) && (!regions.length || measured.every(rect => regions.some(region => evidenceOverlap(rect, region))))) {
            const lines = mergeEvidenceLines(measured);
            if (lines.length) { kind = 'exact'; rects = lines; }
          }
        }
      }
      const changed = !previous || previous.kind !== kind || previous.ready !== ready
        || previous.rects.length !== rects.length || rects.some((rect, index) =>
          (['x', 'y', 'w', 'h'] as const).some(key => Math.abs(rect[key] - previous.rects[index][key]) > 0.00001));
      measuredRef.current = { kind, rects, ready, candidate, navigationId, textEpoch };
      if (changed) setEvidence({ kind, rects, ready });
      if (changed || previous?.navigationId !== navigationId) onEvidenceReady?.();
    };
    measure();
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); });
    observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [pageDims, regions, candidate, textEpoch, textFailed, pageFailed, scale, searchQuery, navigationId, pageNumber, onEvidenceReady]);

  const badgeLeft = (regions.length ? Math.min(...regions.map(region => region.x)) : evidence.rects[0]?.x || 0) * (pageDims?.w || 0) * scale;

  // Search remains independent of citations; no document text is inserted as
  // unescaped HTML. Evidence is painted once in the overlay, never in both layers.
  const customTextRenderer = useMemo(() => {
    const query = searchQuery?.trim();
    if (!query) return undefined;
    const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return ({ str }: { str: string }) => str.split(pattern).map((part, index) => index % 2
      ? `<mark class="pdf-search-match">${escapeHtml(part)}</mark>` : escapeHtml(part)).join('');
  }, [searchQuery]);

  return (
    <div ref={root} className="relative" data-evidence-ready={evidence.ready ? 'true' : 'false'} data-evidence-kind={evidence.kind}>
      <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer={false}
        customTextRenderer={customTextRenderer} onLoadSuccess={onLoadSuccess}
        onLoadError={onPageFailed} onRenderError={onPageFailed} onRenderSuccess={onPageRendered}
        onRenderTextLayerSuccess={onTextReady} onRenderTextLayerError={onTextFailed} onGetTextError={onTextFailed}
        loading={<div className="p-2 text-sm text-zinc-500">{t('doc.renderingPage', { page: pageNumber })}</div>} />
      {pageDims && !hidden && evidence.rects.length > 0 && (
        <div className="pdf-evidence-layer" aria-hidden="true" style={{ width: pageDims.w * scale, height: pageDims.h * scale }}>
          {evidence.rects.map((box, index) => <div key={`${evidence.kind}-${index}`}
            className={evidence.kind === 'exact' ? 'pdf-evidence-line' : 'pdf-evidence-region'}
            data-evidence-anchor={index === 0 ? 'true' : undefined}
            style={{ left: evidence.kind === 'exact' ? `${box.x * 100}%` : `max(2px, calc(${box.x * 100}% - 8px))`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />)}
          {citationIndex && regions.length > 0 && badgeLeft >= 36 && <span className="pdf-evidence-number" style={{ left: badgeLeft - 34, top: `${evidence.rects[0].y * 100}%` }}>{citationIndex}</span>}
        </div>
      )}
    </div>
  );
});

export default PageWithHighlights;
