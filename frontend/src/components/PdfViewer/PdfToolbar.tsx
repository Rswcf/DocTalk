"use client";

import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
}

export default function PdfToolbar({ currentPage, totalPages, scale, onPageChange, onScaleChange }: PdfToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseInt(pageInput, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        onPageChange(num);
      } else {
        setPageInput(String(currentPage));
      }
    }
  };

  const zoomOut = () => onScaleChange(Math.max(0.5, +(scale - 0.25).toFixed(2)));
  const zoomIn = () => onScaleChange(Math.min(3.0, +(scale + 0.25).toFixed(2)));
  const prevPage = () => { if (currentPage > 1) onPageChange(currentPage - 1); };
  const nextPage = () => { if (currentPage < totalPages) onPageChange(currentPage + 1); };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b dark:border-gray-700 text-sm">
      {/* Zoom controls */}
      <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Zoom out">
        <ZoomOut size={16} />
      </button>
      <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
      <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Zoom in">
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Page navigation */}
      <button onClick={prevPage} disabled={currentPage <= 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" title="Previous page">
        <ChevronLeft size={16} />
      </button>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={handlePageSubmit}
          onBlur={() => setPageInput(String(currentPage))}
          className="w-10 text-center border rounded px-1 py-0.5 text-xs dark:bg-gray-700 dark:border-gray-600"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">/ {totalPages}</span>
      </div>
      <button onClick={nextPage} disabled={currentPage >= totalPages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" title="Next page">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
