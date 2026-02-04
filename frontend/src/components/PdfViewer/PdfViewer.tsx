"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import HighlightOverlay from './HighlightOverlay';
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
  const setStoreTotalPages = (n: number) => useDocTalkStore.setState({ totalPages: n });

  useEffect(() => {
    if (!numPages) return;
    const target = pageRefs.current[currentPage - 1];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage, numPages]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setStoreTotalPages(n);
  };

  const onPageRender = (pageNumber: number) => {
    // Measure canvas size as page size
    const holder = pageRefs.current[pageNumber - 1];
    if (!holder) return;
    const canvas = holder.querySelector('canvas');
    const w = canvas?.clientWidth || holder.clientWidth;
    const h = canvas?.clientHeight || holder.clientHeight;
    setPageSizes((prev) => ({ ...prev, [pageNumber]: { w, h } }));
  };

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  return (
    <div className="w-full h-full overflow-auto bg-gray-50" ref={containerRef}>
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
  );
}
