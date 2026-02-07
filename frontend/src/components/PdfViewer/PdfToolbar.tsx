"use client";

import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Hand } from 'lucide-react';
import { useLocale } from '../../i18n';

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  grabMode: boolean;
  onGrabModeToggle: () => void;
}

export default function PdfToolbar({ currentPage, totalPages, scale, onPageChange, onScaleChange, grabMode, onGrabModeToggle }: PdfToolbarProps) {
  const { t } = useLocale();
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
    <div className="sticky top-0 z-10 flex items-center justify-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-zinc-800/90 backdrop-blur border-b dark:border-zinc-700 text-sm">
      {/* Zoom controls */}
      <button onClick={zoomOut} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1" title={t('toolbar.zoomOut')}>
        <ZoomOut size={16} />
      </button>
      <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
      <button onClick={zoomIn} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1" title={t('toolbar.zoomIn')}>
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

      <button
        onClick={onGrabModeToggle}
        className={`p-1 rounded focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${grabMode ? 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
        title={t('toolbar.grabMode')}
      >
        <Hand size={16} />
      </button>

      <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />

      {/* Page navigation */}
      <button onClick={prevPage} disabled={currentPage <= 1} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1" title={t('toolbar.prevPage')}>
        <ChevronLeft size={16} />
      </button>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={handlePageSubmit}
          onBlur={() => setPageInput(String(currentPage))}
          className="w-10 text-center border rounded px-1 py-0.5 text-xs dark:bg-zinc-700 dark:border-zinc-600"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">/ {totalPages}</span>
      </div>
      <button onClick={nextPage} disabled={currentPage >= totalPages} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1" title={t('toolbar.nextPage')}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
