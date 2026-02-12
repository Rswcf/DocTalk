"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import PageWithHighlights from './PageWithHighlights';
import PdfToolbar from './PdfToolbar';
import type { NormalizedBBox } from '../../types';
import { useDocTalkStore } from '../../store';
import { useLocale } from '../../i18n';

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
}

const scrollBehavior = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' as const : 'smooth' as const;

export default function PdfViewer({ pdfUrl, currentPage, highlights, scale, scrollNonce, highlightSnippet }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [textCacheVersion, setTextCacheVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const extractedTextRef = useRef<{ pages: string[]; pdfUrl: string } | null>(null);
  const extractionRunIdRef = useRef(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [pageAspectRatios, setPageAspectRatios] = useState<number[]>([]);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 1, end: 6 });
  const BUFFER = 3;
  const isScrollingToPage = useRef(false);
  const { setScale, grabMode, setGrabMode, searchQuery, searchMatches, currentMatchIndex, setSearchQuery, setSearchMatches, setCurrentMatchIndex } = useDocTalkStore();
  const setStoreTotalPages = (n: number) => useDocTalkStore.setState({ totalPages: n });
  const { t } = useLocale();

  // Validate PDF URL
  const validPdfUrl = useMemo(() => {
    if (!isValidPdfUrl(pdfUrl)) {
      setUrlError('Invalid PDF URL');
      return null;
    }
    setUrlError(null);
    return pdfUrl;
  }, [pdfUrl]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    extractedTextRef.current = null;
    extractionRunIdRef.current += 1;
    setTextCacheVersion((v) => v + 1);
    setPageAspectRatios([]);
    setVisibleRange({ start: 1, end: 6 });
  }, [validPdfUrl]);

  // Scroll to page when currentPage changes (e.g. citation click or toolbar nav)
  // If highlights exist, center the viewport on the first highlight bbox
  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    // Ensure target page is in render range before scrolling
    setVisibleRange(prev => ({
      start: Math.min(prev.start, Math.max(1, currentPage - BUFFER)),
      end: Math.max(prev.end, Math.min(numPages, currentPage + BUFFER)),
    }));

    const target = pageRefs.current[currentPage - 1];
    if (!target) return;

    isScrollingToPage.current = true;
    setVisiblePage(currentPage);

    // Try to find the first highlight anchor and center on it
    // Use requestAnimationFrame to wait for overlay elements to render
    requestAnimationFrame(() => {
      const anchor = target.querySelector('[data-highlight-anchor="true"]') as HTMLElement | null;
      if (anchor && containerRef.current) {
        const container = containerRef.current;
        const anchorRect = anchor.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Calculate where the anchor center is relative to the scroll container
        const anchorCenterInContainer =
          anchor.offsetTop +
          target.offsetTop -
          container.offsetTop +
          anchorRect.height / 2;
        const scrollTarget = anchorCenterInContainer - containerRect.height / 2;
        container.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: scrollBehavior(),
        });
      } else {
        target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      }
    });

    // Reset flag after scroll completes
    setTimeout(() => { isScrollingToPage.current = false; }, 800);
  }, [currentPage, scrollNonce, numPages, BUFFER]);

  // IntersectionObserver to track visible page and virtualized range
  useEffect(() => {
    if (!numPages || !containerRef.current) return;

    const visiblePages = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = Number(entry.target.getAttribute('data-page-number'));
          if (entry.isIntersecting) {
            visiblePages.add(pageNum);
          } else {
            visiblePages.delete(pageNum);
          }
        });

        if (visiblePages.size > 0) {
          const sorted = [...visiblePages].sort((a, b) => a - b);
          // Update visible page for toolbar (only when not programmatically scrolling)
          if (!isScrollingToPage.current) {
            const center = sorted[Math.floor(sorted.length / 2)];
            setVisiblePage(center);
          }
          // Update visible range for virtualization
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
  }, [numPages, BUFFER]); // re-observe after pages render

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
    const n = pdf.numPages;
    setNumPages(n);
    setStoreTotalPages(n);
    pageRefs.current = new Array(n).fill(null);

    // Extract page aspect ratios for placeholder height estimation
    (async () => {
      const ratios: number[] = [];
      for (let p = 1; p <= n; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        ratios.push(viewport.height / viewport.width);
      }
      setPageAspectRatios(ratios);
    })();

    if (!validPdfUrl) return;
    const runId = ++extractionRunIdRef.current;

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

  // removed onPageRender: no longer needed with text-level highlights

  const handlePageChange = useCallback((page: number) => {
    useDocTalkStore.setState((state) => ({
      currentPage: Math.max(1, page),
      scrollNonce: state.scrollNonce + 1,
    }));
  }, []);

  const handleScaleChange = useCallback((newScale: number) => {
    setScale(newScale);
  }, [setScale]);

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

  return (
    <div className="w-full h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
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
        />
      )}
      <div
        className={`flex-1 overflow-auto ${grabMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={grabMode ? { userSelect: 'none' } : undefined}
        ref={containerRef}
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
          file={validPdfUrl}
          options={PDF_OPTIONS}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="p-4" aria-live="polite">{t('doc.pdfLoading')}</div>}
          error={<div className="p-4 text-red-600" aria-live="polite">{t('doc.pdfLoadError')}</div>}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {pages.map((pageNumber) => {
              const isInRange = pageNumber >= visibleRange.start && pageNumber <= visibleRange.end;

              if (!isInRange && pageAspectRatios.length > 0) {
                // Placeholder with estimated height based on actual page aspect ratio
                const aspectRatio = pageAspectRatios[pageNumber - 1] || 1.414;
                return (
                  <div
                    key={pageNumber}
                    ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
                    data-page-number={pageNumber}
                    className="bg-zinc-100 dark:bg-zinc-800 rounded"
                    style={{ height: `calc(${aspectRatio} * min(100%, 800px) * ${scale})`, width: '100%', maxWidth: 800 * scale }}
                  />
                );
              }

              const pageHighlights = highlights.filter(h => h.page === pageNumber);
              return (
                <div
                  key={pageNumber}
                  ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
                  className="relative"
                  data-page-number={pageNumber}
                >
                  <PageWithHighlights pageNumber={pageNumber} scale={scale} highlights={pageHighlights} searchQuery={searchQuery} highlightSnippet={highlightSnippet} />
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
