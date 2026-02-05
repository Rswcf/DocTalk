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
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visiblePage, setVisiblePage] = useState(1);
  const isScrollingToPage = useRef(false);
  const { setScale } = useDocTalkStore();
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
  useEffect(() => {
    if (!numPages) return;
    const target = pageRefs.current[currentPage - 1];
    if (target) {
      isScrollingToPage.current = true;
      setVisiblePage(currentPage);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Reset flag after scroll completes
      setTimeout(() => { isScrollingToPage.current = false; }, 800);
    }
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

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {numPages > 0 && (
        <PdfToolbar
          currentPage={visiblePage}
          totalPages={numPages}
          scale={scale}
          onPageChange={handlePageChange}
          onScaleChange={handleScaleChange}
        />
      )}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        {urlError ? (
          <div className="p-4 text-red-600">{urlError}</div>
        ) : !validPdfUrl ? (
          <div className="p-4">{t('doc.pdfLoading')}</div>
        ) : (
        <Document
          file={validPdfUrl}
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
                  <PageWithHighlights pageNumber={pageNumber} scale={scale} highlights={pageHighlights} />
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
