"use client";

import { useEffect, useState } from 'react';
import type { DocumentBiblioCsl, QuoteCard } from '../../lib/api';
import { getDocumentBiblio } from '../../lib/api';
import QuoteResultCard from './QuoteResultCard';

interface QuoteCardListProps {
  documentId: string;
  cards: QuoteCard[];
  onJump: (card: QuoteCard, index: number) => void;
  /** Localized "n verified, m discarded" style summary line, rendered above the cards. */
  summaryLine?: string;
}

/**
 * Shared verified-quote card list — rendered identically by the Quote
 * Finder panel (F1) and the chat `quote_search` artifact (F3), so Jump
 * and Copy behave the same in both places. Fetches the document's biblio
 * once (GET /documents/{id}/biblio, user row if present else the seeded
 * system default) so every card's Copy action can append an APA in-text
 * citation without a per-card round trip.
 */
export default function QuoteCardList({ documentId, cards, onJump, summaryLine }: QuoteCardListProps) {
  const [biblio, setBiblio] = useState<DocumentBiblioCsl | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBiblio(null);
    getDocumentBiblio(documentId)
      .then((res) => {
        if (!cancelled) setBiblio(res.cslJson);
      })
      .catch(() => {
        // Copy still works without a citation suffix (formatApaInText
        // handles a null biblio gracefully) — never block quote display.
        if (!cancelled) setBiblio({});
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <div>
      {summaryLine ? (
        <p className="mb-2 px-1 text-xs text-[var(--reader-muted)]">{summaryLine}</p>
      ) : null}
      <div className="space-y-3">
        {cards.map((card, index) => (
          <QuoteResultCard
            key={`${card.chunkId || 'card'}-${index}`}
            card={card}
            index={index}
            biblio={biblio}
            onJump={onJump}
          />
        ))}
      </div>
    </div>
  );
}
