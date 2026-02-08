"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import PageWithHighlights from './PageWithHighlights';
import PdfToolbar from './PdfToolbar';
import type { NormalizedBBox } from '../../types';
import { useDocTalkStore } from '../../store';
import { useLocale } from '../../i18n';

// Configure pdf.js worker with explicit https protocol
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// CMap files are required for rendering CJK (Chinese/Japanese/Korean) fonts in PDFs.
// Served from public/ because cdnjs returns 403 for pdfjs-dist 3.11.174 cmaps.
const PDF_OPTIONS = {
  cMapUrl: '/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/standard_fonts/',
};

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
}

export default function PdfViewer({ pdfUrl, currentPage, highlights, scale, scrollNonce }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [visiblePage, setVisiblePage] = useState(1);
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

  // Scroll to page when currentPage changes (e.g. citation click or toolbar nav)
  // If highlights exist, center the viewport on the first highlight bbox
  useEffect(() => {
    if (!numPages || !containerRef.current) return;
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
          behavior: 'smooth',
        });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Reset flag after scroll completes
    setTimeout(() => { isScrollingToPage.current = false; }, 800);
  }, [currentPage, scrollNonce, numPages]);

  // IntersectionObserver to track visible page
  useEffect(() => {
    if (!numPages || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToPage.current) return;
        let maxRatio = 0;
        let maxPage = 1;
        entries.forEach((entry) => {
          const pageNum = Number(entry.target.getAttribute('data-page-number'));
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            maxPage = pageNum;
          }
        });
        if (maxRatio > 0) {
          setVisiblePage(maxPage);
        }
      },
      { root: containerRef.current, threshold: [0, 0.1, 0.3, 0.5, 0.7] }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]); // re-observe after pages render

  // Text search: extract text from pages and find matches
  useEffect(() => {
    if (!searchQuery.trim() || !validPdfUrl || !numPages) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const query = searchQuery.toLowerCase();
    let cancelled = false;

    (async () => {
      try {
        const pdf = await pdfjs.getDocument({ url: validPdfUrl, ...PDF_OPTIONS }).promise;
        const matches: Array<{ page: number; index: number }> = [];

        for (let p = 1; p <= numPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ')
            .toLowerCase();

          let startIdx = 0;
          let matchIdx = 0;
          while ((startIdx = pageText.indexOf(query, startIdx)) !== -1) {
            matches.push({ page: p, index: matchIdx++ });
            startIdx += query.length;
          }
        }

        if (!cancelled) {
          setSearchMatches(matches);
          setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
        }
      } catch (err) {
        console.error('Search text extraction failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [searchQuery, validPdfUrl, numPages, setSearchMatches, setCurrentMatchIndex]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setStoreTotalPages(n);
    pageRefs.current = new Array(n).fill(null);
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
          loading={<div className="p-4">{t('doc.pdfLoading')}</div>}
          error={<div className="p-4 text-red-600">{t('doc.pdfLoadError')}</div>}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {pages.map((pageNumber) => {
              const pageHighlights = highlights.filter(h => h.page === pageNumber);
              return (
                <div
                  key={pageNumber}
                  ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
                  className="relative"
                  data-page-number={pageNumber}
                >
                  <PageWithHighlights pageNumber={pageNumber} scale={scale} highlights={pageHighlights} searchQuery={searchQuery} />
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
