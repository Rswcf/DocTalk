"use client";

import { useEffect, useState } from 'react';
import type { DocumentBiblioCsl, SavedQuote } from '../../lib/api';
import { getDocumentBiblio } from '../../lib/api';
import SavedQuoteCard from './SavedQuoteCard';

interface SavedQuoteListProps {
  documentId: string;
  quotes: SavedQuote[];
  onJump: (quote: SavedQuote, index: number) => void;
  onDeleted: (quoteId: string) => void;
  /** Localized "n of 30 saved" cap indicator (M3-F3), rendered above the
   * list. Undefined on paid plans, which don't get the indicator. */
  capLine?: string;
}

/**
 * Per-document Evidence Board list (M3-F2) — the "Saved" tab/section
 * inside the Quote Finder panel. Fetches this document's biblio once,
 * same pattern as QuoteCardList, so every card's Copy action can append
 * an APA in-text citation without a per-card round trip.
 */
export default function SavedQuoteList({ documentId, quotes, onJump, onDeleted, capLine }: SavedQuoteListProps) {
  const [biblio, setBiblio] = useState<DocumentBiblioCsl | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBiblio(null);
    getDocumentBiblio(documentId)
      .then((res) => {
        if (!cancelled) setBiblio(res.cslJson);
      })
      .catch(() => {
        if (!cancelled) setBiblio({});
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <div>
      {capLine ? (
        <p className="mb-2 px-1 text-xs text-[var(--reader-muted)]">{capLine}</p>
      ) : null}
      <div className="space-y-3">
        {quotes.map((quote, index) => (
          <SavedQuoteCard
            key={quote.id}
            quote={quote}
            index={index}
            biblio={biblio}
            onJump={onJump}
            onDeleted={onDeleted}
          />
        ))}
      </div>
    </div>
  );
}
