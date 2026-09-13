"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import PageWithHighlights from './PageWithHighlights';
import PdfToolbar from './PdfToolbar';
import type { Citation, NormalizedBBox } from '../../types';
import { useDocTalkStore } from '../../store';
import { useLocale } from '../../i18n';
import { usePdfRecovery } from '../../lib/usePdfRecovery';
import { errorCopy } from '../../lib/errorCopy';
import { citationPageRange } from '../../lib/citationText';
import type { EvidenceKind } from '../../lib/pdfEvidence';
import { Eye, EyeOff, ScanLine } from 'lucide-react';

// Load pdf.js worker from same origin to avoid CSP cross-origin issues.
// The worker file is copied from node_modules/pdfjs-dist/build/ to public/.
// Must re-copy when upgrading pdfjs-dist (same as cmaps/ and standard_fonts/).
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

// CMap files are required for rendering CJK (Chinese/Japanese/Korean) fonts in PDFs.
// Must use absolute URLs because the pdf.js Web Worker runs on the CDN origin,
// so relative paths like "/cmaps/" resolve to the CDN domain instead of the app domain.
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const PDF_OPTIONS = {
  cMapUrl: `${origin}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${origin}/standard_fonts/`,
};

interface PdfTextItemLike {
  str: string;
}

function isPdfTextItemLike(item: unknown): item is PdfTextItemLike {
  return typeof item === 'object'
    && item !== null
    && 'str' in item
    && typeof (item as { str?: unknown }).str === 'string';
}

/**
 * Validate that the PDF URL is safe to load.
 * Only allows http(s) protocols to prevent javascript:, data:, or file:// attacks.
 */
function isValidPdfUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.warn('Invalid PDF URL protocol:', parsed.protocol);
      return false;
    }
    return true;
  } catch {
    console.warn('Invalid PDF URL format:', url);
    return false;
  }
}

export interface PdfViewerProps {
  pdfUrl: string;
  currentPage: number;
  highlights: NormalizedBBox[];
  scale: number;
  scrollNonce: number;
  highlightSnippet?: string | null;
  highlightFocus?: string | null;
  citation?: Citation;
  onReturnToAnswer?: () => void;
  onLayoutTranslate?: () => void;
  layoutTranslateBusy?: boolean;
  layoutTranslateDisabled?: boolean;
  onRefreshUrl?: () => Promise<string | undefined>;
}

const scrollBehavior = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' as const : 'smooth' as const;

export default function PdfViewer({ pdfUrl, currentPage, highlights, scale, scrollNonce, highlightSnippet, highlightFocus, citation, onReturnToAnswer, onLayoutTranslate, layoutTranslateBusy, layoutTranslateDisabled, onRefreshUrl }: PdfViewerProps) {
  const { refreshing, revision, retry, error: recoveryError } = usePdfRecovery(pdfUrl, onRefreshUrl);
  const [hiddenEvidence, setHiddenEvidence] = useState(false);
  const [evidenceVersion, setEvidenceVersion] = useState(0);
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceKind | 'loading' | 'unavailable'>('loading');
  const onEvidenceReady = useCallback(() => setEvidenceVersion(value => value + 1), []);
  useEffect(() => { setHiddenEvidence(false); setEvidenceStatus('loading'); }, [citation]);
  const [numPages, setNumPages] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [textCacheVersion, setTextCacheVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const extractedTextRef = useRef<{ pages: string[]; pdfUrl: string } | null>(null);
  const extractionRunIdRef = useRef(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [pageDimensions, setPageDimensions] = useState<Array<{ width: number; aspectRatio: number }>>([]);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 1, end: 6 });
  const BUFFER = 3;
  const isScrollingToPage = useRef(false);
  const activePdfUrlRef = useRef(pdfUrl);
  activePdfUrlRef.current = pdfUrl;
  const zoomAnchorRef = useRef<{ page: number; ratio: number } | null>(null);
  const navigationRef = useRef<{ key: string; pending: boolean; staged?: boolean } | null>(null);
  const { setScale, grabMode, setGrabMode, searchQuery, searchMatches, currentMatchIndex, setSearchQuery, setSearchMatches, setCurrentMatchIndex } = useDocTalkStore();
  const setStoreTotalPages = (n: number) => useDocTalkStore.setState({ totalPages: n });
  const { t, tOr } = useLocale();

  // Validate PDF URL
  const { validPdfUrl, urlError } = useMemo(() => {
    if (!isValidPdfUrl(pdfUrl)) {
      return { validPdfUrl: null, urlError: t('doc.invalidPdfUrl') };
    }
    return { validPdfUrl: pdfUrl, urlError: null };
  }, [pdfUrl, t]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    navigationRef.current = null;
    extractedTextRef.current = null;
    extractionRunIdRef.current += 1;
    setTextCacheVersion((v) => v + 1);
    setPageDimensions([]);
    setVisibleRange({ start: 1, end: 6 });
  }, [validPdfUrl, revision]);

  useEffect(() => {
    if (!citation) return;
    if (numPages > 0 && (citation.page < 1 || citation.page > numPages)) {
      setEvidenceStatus('unavailable');
      return;
    }
    const page = pageRefs.current[citation.page - 1];
    const evidence = page?.querySelector<HTMLElement>('[data-evidence-ready="true"]');
    if (evidence) setEvidenceStatus(evidence.dataset.evidenceKind as EvidenceKind);
  }, [citation, evidenceVersion, numPages]);

  // Stage a distant virtualized page, then place its measured evidence once.
  // User input cancels pending work; a completed jump never fights later scrolling.
  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    if (currentPage < 1 || currentPage > numPages) {
      navigationRef.current = { key: `${currentPage}:${scrollNonce}`, pending: false };
      return;
    }
    const key = `${currentPage}:${scrollNonce}`;
    if (navigationRef.current?.key !== key) {
      navigationRef.current = { key, pending: true };
    } else if (!navigationRef.current.pending) return;
    setVisibleRange({ start: Math.max(1, currentPage - BUFFER), end: Math.min(numPages, currentPage + BUFFER) });
    isScrollingToPage.current = true;
    setVisiblePage(currentPage);
    let cancelled = false;
    let frame = 0;
    const scrollToTarget = () => {
      const navigation = navigationRef.current;
      if (cancelled || navigation?.key !== key || !navigation.pending) return;
      const target = pageRefs.current[currentPage - 1];
      const container = containerRef.current;
      if (!target || !container || container.clientHeight === 0) return;
      const pageRect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const isCitationPage = citation && currentPage >= citation.page && currentPage <= (citation.pageEnd || citation.page);
      const ready = !isCitationPage || target.querySelector('[data-evidence-ready="true"]');
      if (!ready && navigation.staged) return;
      const anchor = ready ? target.querySelector<HTMLElement>('[data-evidence-anchor="true"]')?.getBoundingClientRect() : undefined;
      const first = highlights.filter(box => (box.page ?? currentPage) === currentPage && Number.isFinite(box.y) && box.y >= 0 && box.h > 0 && box.h < 0.95)
        .reduce<typeof highlights[number] | undefined>((top, box) => !top || box.y < top.y ? box : top, undefined);
      const anchorY = anchor ? anchor.top - pageRect.top : first ? first.y * pageRect.height : 0;
      const hasAnchor = Boolean(anchor || first);
      const top = Math.max(0, container.scrollTop + pageRect.top - containerRect.top + anchorY - (hasAnchor ? container.clientHeight * 0.32 : 0));
      let left = container.scrollLeft;
      if (anchor && (anchor.left < containerRect.left + 16 || anchor.right > containerRect.right - 16)) {
        left = Math.max(0, container.scrollLeft + anchor.left - containerRect.left - 24);
      }
      const distance = Math.abs(top - container.scrollTop);
      container.scrollTo({ top, left, behavior: ready && distance < container.clientHeight ? scrollBehavior() : 'auto' });
      navigation.staged = true;
      if (ready && pageDimensions[currentPage - 1]) navigation.pending = false;
    };
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(scrollToTarget); });
    const timer = setTimeout(() => { isScrollingToPage.current = false; }, 1200);
    return () => { cancelled = true; cancelAnimationFrame(frame); clearTimeout(timer); isScrollingToPage.current = false; };
  }, [currentPage, scrollNonce, numPages, BUFFER, pageDimensions, scale, highlights, citation, evidenceVersion]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = containerRef.current;
    const page = anchor && pageRefs.current[anchor.page - 1];
    if (!anchor || !container || !page) return;
    const rect = page.getBoundingClientRect();
    container.scrollTo({
      top: Math.max(0, container.scrollTop + rect.top - container.getBoundingClientRect().top
        + anchor.ratio * rect.height - container.clientHeight / 2),
      behavior: 'instant' as ScrollBehavior,
    });
    zoomAnchorRef.current = null;
  }, [scale]);

  // Observer A: track the most-visible page for toolbar display (no rootMargin)
  useEffect(() => {
    if (!numPages || !containerRef.current) return;

    const observer = new IntersectionObserver(
      () => {
        if (isScrollingToPage.current || !containerRef.current) return;
        // Entries contain only pages whose thresholds changed, not every
        // visible page. Compare current geometry to avoid stale toolbar pages.
        const viewport = containerRef.current.getBoundingClientRect();
        let maxHeight = 0;
        let bestPage = 0;
        pageRefs.current.forEach((page, index) => {
          if (!page) return;
          const rect = page.getBoundingClientRect();
          const height = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
          if (height > maxHeight) { maxHeight = height; bestPage = index + 1; }
        });
        if (bestPage) {
          setVisiblePage(bestPage);
          const store = useDocTalkStore.getState();
          // Persist manual scrolling for mobile tab/layout remounts without
          // turning this observation into another explicit navigation.
          if (store.currentPage !== bestPage && !navigationRef.current?.pending) {
            navigationRef.current = { key: `${bestPage}:${store.scrollNonce}`, pending: false };
            useDocTalkStore.setState({ currentPage: bestPage });
          }
        }
      },
      { root: containerRef.current, threshold: [0, 0.1, 0.25, 0.5, 0.75] }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, scale]);

  // Observer B: track which pages are near the viewport for virtualization (generous rootMargin)
  useEffect(() => {
    if (!numPages || !containerRef.current) return;

    const nearbyPages = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = Number(entry.target.getAttribute('data-page-number'));
          if (entry.isIntersecting) {
            nearbyPages.add(pageNum);
          } else {
            nearbyPages.delete(pageNum);
          }
        });

        if (nearbyPages.size > 0) {
          const sorted = [...nearbyPages].sort((a, b) => a - b);
          setVisibleRange({
            start: Math.max(1, sorted[0] - BUFFER),
            end: Math.min(numPages, sorted[sorted.length - 1] + BUFFER),
          });
        }
      },
      { root: containerRef.current, rootMargin: '200% 0px', threshold: [0] }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, BUFFER]);

  // Text search: use cached page text extracted once on document load.
  useEffect(() => {
    if (!debouncedSearch.trim() || !validPdfUrl || !numPages) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const cached = extractedTextRef.current;
    if (!cached || cached.pdfUrl !== validPdfUrl || cached.pages.length !== numPages) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const query = debouncedSearch.toLowerCase();
    const matches: Array<{ page: number; index: number }> = [];

    cached.pages.forEach((pageText, pageIdx) => {
      let startIdx = 0;
      let matchIdx = 0;
      while ((startIdx = pageText.indexOf(query, startIdx)) !== -1) {
        matches.push({ page: pageIdx + 1, index: matchIdx++ });
        startIdx += query.length;
      }
    });

    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [debouncedSearch, validPdfUrl, numPages, textCacheVersion, setSearchMatches, setCurrentMatchIndex]);

  const onDocumentLoadSuccess = (pdf: PDFDocumentProxy) => {
    if (!validPdfUrl || validPdfUrl !== activePdfUrlRef.current) return;
    const runId = ++extractionRunIdRef.current;
    const n = pdf.numPages;
    setNumPages(n);
    setStoreTotalPages(n);
    pageRefs.current = new Array(n).fill(null);

    // Dimension and text work share the PDF generation; stale translations
    // must not replace the current document's placeholder geometry.
    (async () => {
      try {
        const dims: Array<{ width: number; aspectRatio: number }> = [];
        for (let p = 1; p <= n; p++) {
          const page = await pdf.getPage(p);
          if (runId !== extractionRunIdRef.current || validPdfUrl !== activePdfUrlRef.current) return;
          const viewport = page.getViewport({ scale: 1 });
          dims.push({ width: viewport.width, aspectRatio: viewport.height / viewport.width });
        }
        setPageDimensions(dims);
      } catch (err) {
        if (runId === extractionRunIdRef.current && validPdfUrl === activePdfUrlRef.current) {
          console.error('PDF page dimensions failed:', err);
        }
      }
    })();

    (async () => {
      try {
        const pages: string[] = [];
        for (let p = 1; p <= n; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => (isPdfTextItemLike(item) ? item.str : ''))
            .join(' ')
            .toLowerCase();
          pages.push(pageText);
        }

        if (runId !== extractionRunIdRef.current) return;
        extractedTextRef.current = { pages, pdfUrl: validPdfUrl };
        setTextCacheVersion((v) => v + 1);
      } catch (err) {
        if (runId !== extractionRunIdRef.current) return;
        extractedTextRef.current = null;
        setTextCacheVersion((v) => v + 1);
        console.error('Search text extraction failed:', err);
      }
    })();
  };

  const handlePageChange = useCallback((page: number) => {
    useDocTalkStore.setState((state) => ({
      currentPage: Math.max(1, page),
      scrollNonce: state.scrollNonce + 1,
    }));
  }, []);

  const handleScaleChange = useCallback((newScale: number) => {
    const container = containerRef.current;
    if (container && newScale !== scale) {
      const center = container.getBoundingClientRect().top + container.clientHeight / 2;
      let index = -1;
      let distance = Infinity;
      pageRefs.current.forEach((page, pageIndex) => {
        const rect = page?.getBoundingClientRect();
        if (!rect) return;
        const gap = Math.max(rect.top - center, center - rect.bottom, 0);
        if (gap < distance) { index = pageIndex; distance = gap; }
      });
      const rect = pageRefs.current[index]?.getBoundingClientRect();
      if (rect && rect.height > 0) {
        zoomAnchorRef.current = { page: index + 1, ratio: (center - rect.top) / rect.height };
        setVisiblePage(index + 1);
      }
    }
    setScale(newScale);
  }, [setScale, scale]);

  const handleFitWidth = useCallback(() => {
    const container = containerRef.current;
    const width = pageDimensions[visiblePage - 1]?.width;
    if (!container || !width || container.clientWidth <= 24) return;
    handleScaleChange(Math.min(3, Math.max(0.25, (container.clientWidth - 24) / width)));
    container.scrollLeft = 0;
  }, [pageDimensions, visiblePage, handleScaleChange]);

  const handleSearchNext = useCallback(() => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    const match = searchMatches[nextIdx];
    handlePageChange(match.page);
  }, [searchMatches, currentMatchIndex, setCurrentMatchIndex, handlePageChange]);

  const handleSearchPrev = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    const match = searchMatches[prevIdx];
    handlePageChange(match.page);
  }, [searchMatches, currentMatchIndex, setCurrentMatchIndex, handlePageChange]);

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
    setSearchMatches([]);
    setCurrentMatchIndex(-1);
  }, [setSearchQuery, setSearchMatches, setCurrentMatchIndex]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!grabMode || !containerRef.current) return;
    dragState.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
    setIsDragging(true);
  }, [grabMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDragging || !containerRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    containerRef.current.scrollLeft = dragState.current.scrollLeft - dx;
    containerRef.current.scrollTop = dragState.current.scrollTop - dy;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.isDragging = false;
    setIsDragging(false);
  }, []);

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  const EMPTY_HIGHLIGHTS: NormalizedBBox[] = useMemo(() => [], []);
  // Pre-compute highlights per page so each PageWithHighlights gets a stable reference.
  // Without this, highlights.filter() inside the render loop creates a new array on every
  // render, causing PageWithHighlights to re-render and CSS animations to replay.
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, NormalizedBBox[]>();
    for (const h of highlights) {
      const pg = h.page ?? 0;
      const arr = map.get(pg) || [];
      arr.push(h);
      map.set(pg, arr);
    }
    return map;
  }, [highlights]);

  return (
    <div className="dt-document-stage w-full h-full flex flex-col">
      {numPages > 0 && (
        <PdfToolbar
          currentPage={visiblePage}
          totalPages={numPages}
          scale={scale}
          onPageChange={handlePageChange}
          onScaleChange={handleScaleChange}
          grabMode={grabMode}
          onGrabModeToggle={() => setGrabMode(!grabMode)}
          searchQuery={searchQuery}
          searchMatchCount={searchMatches.length}
          currentMatchIndex={currentMatchIndex}
          onSearchQueryChange={setSearchQuery}
          onSearchNext={handleSearchNext}
          onSearchPrev={handleSearchPrev}
          onSearchClose={handleSearchClose}
          onLayoutTranslate={onLayoutTranslate}
          layoutTranslateBusy={layoutTranslateBusy}
          layoutTranslateDisabled={layoutTranslateDisabled}
        />
      )}
      {citation && <div className="dt-evidence-bar flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-xs">
        <span role="status" className="dt-evidence-status min-w-0" tabIndex={-1}>
          {t('evidence.reference', { index: citation.refIndex, page: citationPageRange(citation) })}
          {' · '}{t(hiddenEvidence ? 'evidence.hidden' : `evidence.${evidenceStatus}`)}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <button type="button" aria-pressed={hiddenEvidence} onClick={() => setHiddenEvidence(value => !value)}
            aria-label={t(hiddenEvidence ? 'evidence.show' : 'evidence.hide')} title={t(hiddenEvidence ? 'evidence.show' : 'evidence.hide')}
            className="flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded px-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10">
            {hiddenEvidence ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
            <span className="hidden sm:inline">{t(hiddenEvidence ? 'evidence.show' : 'evidence.hide')}</span>
          </button>
          <button type="button" onClick={handleFitWidth} disabled={!pageDimensions[visiblePage - 1]}
            className="flex min-h-9 items-center gap-1.5 rounded px-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10 disabled:opacity-50">
            <ScanLine size={14} aria-hidden="true" />{t('evidence.fitWidth')}
          </button>
          {onReturnToAnswer && <button type="button" onClick={onReturnToAnswer}
            className="min-h-9 rounded border border-[var(--reader-evidence-border)] px-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10">
            {t('evidence.return')}
          </button>}
        </span>
      </div>}
      <div
        className={`flex-1 overflow-auto ${grabMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={grabMode ? { userSelect: 'none' } : undefined}
        ref={containerRef}
        onWheelCapture={() => { if (navigationRef.current) navigationRef.current.pending = false; }}
        onPointerDownCapture={() => { if (navigationRef.current) navigationRef.current.pending = false; }}
        onKeyDownCapture={() => { if (navigationRef.current) navigationRef.current.pending = false; }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {urlError ? (
          <div className="p-4 text-red-600">{urlError}</div>
        ) : !validPdfUrl ? (
          <div className="p-4">{t('doc.pdfLoading')}</div>
        ) : (
        <Document
          key={`${validPdfUrl}:${revision}`}
          file={validPdfUrl}
          options={PDF_OPTIONS}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => { void retry(true); }}
          loading={<div className="p-4" aria-live="polite">{t('doc.pdfLoading')}</div>}
          error={<div className="p-4" role="status">
            <p className="text-red-600">{refreshing ? t('doc.pdfLoading') : recoveryError ? errorCopy(recoveryError, t, tOr).body : t('doc.pdfLoadError')}</p>
            <button type="button" disabled={refreshing} onClick={() => { void retry(); }}
              className="mt-3 min-h-10 rounded-lg border border-zinc-300 px-4 text-sm dark:border-zinc-600 disabled:opacity-50">
              {t('common.retry')}
            </button>
          </div>}
        >
          <div className="flex flex-col items-start gap-5 py-6">
            {pages.map((pageNumber) => {
              const isInRange = pageNumber >= visibleRange.start && pageNumber <= visibleRange.end;

              if (!isInRange && pageDimensions.length > 0) {
                // Placeholder with height/width matching actual PDF page dimensions
                const dim = pageDimensions[pageNumber - 1];
                const pageWidth = dim ? dim.width * scale : 612 * scale;
                const pageHeight = dim ? dim.width * dim.aspectRatio * scale : 792 * scale;
                return (
                  <div
                    key={pageNumber}
                    ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
                    data-page-number={pageNumber}
                    className="mx-auto shrink-0 rounded bg-white/55 dark:bg-zinc-800/70"
                    style={{ height: pageHeight, width: pageWidth }}
                  />
                );
              }

              const pageHighlights = highlightsByPage.get(pageNumber) || EMPTY_HIGHLIGHTS;
              return (
                <div
                  key={pageNumber}
                  ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
                  className="relative mx-auto shrink-0"
                  style={pageDimensions[pageNumber - 1] ? {
                    height: pageDimensions[pageNumber - 1].width * pageDimensions[pageNumber - 1].aspectRatio * scale,
                    width: pageDimensions[pageNumber - 1].width * scale,
                  } : undefined}
                  data-page-number={pageNumber}
                >
                  <PageWithHighlights pageNumber={pageNumber} scale={scale} highlights={pageHighlights} searchQuery={searchQuery}
                    highlightSnippet={citation && pageNumber >= citation.page && pageNumber <= (citation.pageEnd || citation.page) ? highlightSnippet : null}
                    highlightFocus={citation && pageNumber >= citation.page && pageNumber <= (citation.pageEnd || citation.page) ? highlightFocus : null}
                    citationIndex={pageHighlights.length || (citation?.page === pageNumber) ? citation?.refIndex : undefined}
                    navigationId={scrollNonce} hidden={hiddenEvidence} onEvidenceReady={onEvidenceReady} />
                </div>
              );
            })}
          </div>
        </Document>
        )}
      </div>
    </div>
  );
}
