"use client";

import { citationPageRange } from '../../lib/citationText';
import React from 'react';
import { useLocale } from '../../i18n';
import { shortSnippet } from '../../lib/sourceList';

interface CitationCardProps {
  refIndex: number;
  textSnippet: string;
  page: number;
  pageEnd?: number;
  onClick?: () => void;
  active?: boolean;
}

export default function CitationCard({ refIndex, textSnippet, page, pageEnd, onClick, active = false }: CitationCardProps) {
  const { t, tOr } = useLocale();
  // Control characters stripped, cut to 60 code points. A cross-page citation
  // has no previewable excerpt (citationPreview returns ''): name it instead of
  // rendering an empty card that only says "Page 4–5".
  const snippet = shortSnippet(textSnippet) || tOr('citation.passageFallback', 'Cited passage');

  // Validate page number
  const validPage = citationPageRange({ page, pageEnd });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'location' : undefined}
      className="dt-citation-card inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
      aria-label={t('citation.cardLabel', { index: refIndex, page: validPage })}
    >
      <span className="dt-source-index inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-xs font-bold leading-none tabular-nums">{refIndex}</span>
      <span dir="auto" className="max-w-[220px] truncate text-[var(--reader-muted)]">{snippet}</span>
      <span className="shrink-0 text-xs tabular-nums text-[var(--reader-muted)]">{t('citation.page', { page: validPage })}</span>
    </button>
  );
}
