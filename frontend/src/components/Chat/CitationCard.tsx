"use client";

import React from 'react';
import { useWin98Theme } from '../win98/useWin98Theme';

interface CitationCardProps {
  refIndex: number;
  textSnippet: string;
  page: number;
  onClick?: () => void;
}

/**
 * Sanitize text to prevent any potential XSS through text content.
 * React already escapes text nodes, but this adds an extra layer of safety
 * by removing control characters and normalizing the text.
 */
function sanitizeText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  // Remove control characters except common whitespace
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export default function CitationCard({ refIndex, textSnippet, page, onClick }: CitationCardProps) {
  const isWin98 = useWin98Theme();
  // Sanitize and truncate the snippet
  const sanitized = sanitizeText(textSnippet);
  const snippet = sanitized.length > 60 ? sanitized.slice(0, 60) + '…' : sanitized;

  // Validate page number
  const validPage = typeof page === 'number' && isFinite(page) && page > 0 ? page : 1;

  if (isWin98) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 text-[10px] bg-[var(--win98-light-gray)] border border-[var(--win98-dark-gray)] px-2 py-[2px] w-fit cursor-default"
      >
        <span className="text-[#000080] font-bold shrink-0">[{refIndex}]</span>
        <span className="truncate max-w-[200px]">{snippet}</span>
        <span className="text-[var(--win98-dark-gray)] shrink-0">p.{validPage}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-left border border-zinc-100 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-shadow text-xs"
    >
      <span className="text-zinc-500 dark:text-zinc-400 font-semibold shrink-0">[{refIndex}]</span>
      <span className="text-zinc-600 dark:text-zinc-300 truncate max-w-[200px]">{snippet}</span>
      <span className="text-zinc-400 dark:text-zinc-500 shrink-0">p.{validPage}</span>
    </button>
  );
}
