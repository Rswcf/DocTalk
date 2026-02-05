"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import HighlightOverlay from './HighlightOverlay';
import PdfToolbar from './PdfToolbar';
import type { NormalizedBBox } from '../../types';
import { useDocTalkStore } from '../../store';

// Configure pdf.js worker (CDN)
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface PdfViewerProps {
  pdfUrl: string;
  currentPage: number;
  highlights: NormalizedBBox[];
  scale: number;
}

export default function PdfViewer({ pdfUrl, currentPage, highlights, scale }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pageSizes, setPageSizes] = useState<Record<number, { w: number; h: number }>>({});
  const [visiblePage, setVisiblePage] = useState(1);
  const isScrollingToPage = useRef(false);
  const { setPage, setScale } = useDocTalkStore();
  const setStoreTotalPages = (n: number) => useDocTalkStore.setState({ totalPages: n });

  // Scroll to page when currentPage changes (e.g. citation click or toolbar nav)
  useEffect(() => {
    if (!numPages) return;
    const target = pageRefs.current[currentPage - 1];
    if (target) {
      isScrollingToPage.current = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Reset flag after scroll completes
      setTimeout(() => { isScrollingToPage.current = false; }, 800);
    }
  }, [currentPage, numPages]);

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
          setPage(maxPage);
        }
      },
      { root: containerRef.current, threshold: [0, 0.1, 0.3, 0.5, 0.7] }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, pageSizes, setPage]); // re-observe after pages render

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setStoreTotalPages(n);
    pageRefs.current = new Array(n).fill(null);
  };

  const onPageRender = (pageNumber: number) => {
    const holder = pageRefs.current[pageNumber - 1];
    if (!holder) return;
    const canvas = holder.querySelector('canvas');
    const w = canvas?.clientWidth || holder.clientWidth;
    const h = canvas?.clientHeight || holder.clientHeight;
    setPageSizes((prev) => ({ ...prev, [pageNumber]: { w, h } }));
  };

  const handlePageChange = useCallback((page: number) => {
    setPage(page);
  }, [setPage]);

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
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="p-4">Loading PDF…</div>}
          error={<div className="p-4 text-red-600">无法加载 PDF，请刷新页面或稍后重试。</div>}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {pages.map((pageNumber) => (
              <div
                key={pageNumber}
                ref={(el) => { pageRefs.current[pageNumber - 1] = el; }}
                className="relative"
                data-page-number={pageNumber}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderAnnotationLayer={false}
                  loading={<div className="p-2 text-sm text-gray-500">Rendering page {pageNumber}…</div>}
                  onRenderSuccess={() => onPageRender(pageNumber)}
                />
                {pageSizes[pageNumber] && (
                  <HighlightOverlay
                    highlights={currentPage === pageNumber ? highlights : []}
                    pageWidth={pageSizes[pageNumber].w}
                    pageHeight={pageSizes[pageNumber].h}
                  />
                )}
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
