"use client";

import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Hand, Search, X } from 'lucide-react';
import { useLocale } from '../../i18n';

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  grabMode: boolean;
  onGrabModeToggle: () => void;
  searchQuery: string;
  searchMatchCount: number;
  currentMatchIndex: number;
  onSearchQueryChange: (query: string) => void;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  onSearchClose: () => void;
}

export default function PdfToolbar({ currentPage, totalPages, scale, onPageChange, onScaleChange, grabMode, onGrabModeToggle, searchQuery, searchMatchCount, currentMatchIndex, onSearchQueryChange, onSearchNext, onSearchPrev, onSearchClose }: PdfToolbarProps) {
  const { t } = useLocale();
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [searchOpen, setSearchOpen] = useState(false);

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

  const btnClass = 'p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1';
  const separatorClass = 'w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1';

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-center gap-2 shrink-0 px-3 py-1.5 bg-white/90 dark:bg-zinc-800/90 backdrop-blur border-b dark:border-zinc-700 text-sm">
        {/* Zoom controls */}
        <button onClick={zoomOut} className={btnClass} title={t('toolbar.zoomOut')} aria-label="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} className={btnClass} title={t('toolbar.zoomIn')} aria-label="Zoom in">
          <ZoomIn size={16} />
        </button>

        <div className={separatorClass} />

        <button
          onClick={onGrabModeToggle}
          className={`p-1 rounded focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${grabMode ? 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
          title={t('toolbar.grabMode')}
          aria-label="Toggle grab mode"
        >
          <Hand size={16} />
        </button>

        <div className={separatorClass} />

        {/* Search toggle */}
        <button
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) onSearchClose(); }}
          className={`p-1 rounded focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${searchOpen ? 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
          title={t('toolbar.search')}
          aria-label="Toggle search"
          aria-pressed={searchOpen}
        >
          <Search aria-hidden="true" size={16} />
        </button>

        <div className={separatorClass} />

        {/* Page navigation */}
        <button onClick={prevPage} disabled={currentPage <= 1} className={`${btnClass} disabled:opacity-30 disabled:cursor-not-allowed`} title={t('toolbar.prevPage')} aria-label="Previous page">
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
            aria-label="Page number"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">/ {totalPages}</span>
        </div>
        <button onClick={nextPage} disabled={currentPage >= totalPages} className={`${btnClass} disabled:opacity-30 disabled:cursor-not-allowed`} title={t('toolbar.nextPage')} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 text-sm px-3 py-1.5 bg-white/90 dark:bg-zinc-800/90 backdrop-blur border-b dark:border-zinc-700">
          <Search aria-hidden="true" size={14} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t('toolbar.searchPlaceholder')}
            className="flex-1 min-w-0 border-none bg-transparent text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-100 placeholder:text-zinc-400"
            aria-label="Search in PDF"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? onSearchPrev() : onSearchNext();
              }
              if (e.key === 'Escape') {
                setSearchOpen(false);
                onSearchClose();
              }
            }}
          />
          {searchQuery && (
            <span className="tabular-nums whitespace-nowrap text-xs text-zinc-400">
              {searchMatchCount > 0 ? t('toolbar.matchCount', { current: currentMatchIndex + 1, total: searchMatchCount }) : t('toolbar.noMatches')}
            </span>
          )}
          <button onClick={onSearchPrev} disabled={searchMatchCount === 0} className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400" title={t('toolbar.prevPage')} aria-label="Previous match">
            <ChevronLeft size={14} />
          </button>
          <button onClick={onSearchNext} disabled={searchMatchCount === 0} className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400" title={t('toolbar.nextPage')} aria-label="Next match">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => { setSearchOpen(false); onSearchClose(); }} className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label="Close search">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
