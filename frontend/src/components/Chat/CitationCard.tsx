"use client";

import React from 'react';

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
  // Sanitize and truncate the snippet
  const sanitized = sanitizeText(textSnippet);
  const snippet = sanitized.length > 80 ? sanitized.slice(0, 80) + '…' : sanitized;

  // Validate page number
  const validPage = typeof page === 'number' && isFinite(page) && page > 0 ? page : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border border-zinc-100 dark:border-zinc-700 rounded-xl p-3 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] duration-150 flex items-start gap-2.5"
    >
      <span className="text-zinc-600 dark:text-zinc-400 font-semibold">[{refIndex}]</span>
      <div className="flex-1">
        <p className="text-sm text-zinc-800 dark:text-zinc-200">{snippet}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Page {validPage}</p>
      </div>
    </button>
  );
}
