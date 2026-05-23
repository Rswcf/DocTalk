"use client";

import React from 'react';
import { useLocale } from '../../i18n';

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
  const { t } = useLocale();
  // Sanitize and truncate the snippet
  const sanitized = sanitizeText(textSnippet);
  const snippet = sanitized.length > 60 ? sanitized.slice(0, 60) + '…' : sanitized;

  // Validate page number
  const validPage = typeof page === 'number' && isFinite(page) && page > 0 ? page : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="dt-citation-card inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
      aria-label={`Citation ${refIndex}, page ${validPage}`}
    >
      <span className="dt-source-index inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold leading-none">{refIndex}</span>
      <span className="max-w-[220px] truncate text-[var(--reader-muted)]">{snippet}</span>
      <span
        className="shrink-0 text-[10px] text-[var(--reader-muted)]"
        style={{ fontFamily: 'var(--dt-mono)' }}
      >{t('citation.page', { page: validPage })}</span>
    </button>
  );
}
