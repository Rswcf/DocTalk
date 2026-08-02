"use client";

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { DocumentBiblioCsl, QuoteCard } from '../../lib/api';
import { getDocumentBiblio } from '../../lib/api';
import BiblioForm from './BiblioForm';
import QuoteResultCard from './QuoteResultCard';
import { resultKindHeadline } from './utils';

interface QuoteCardListProps {
  documentId: string;
  cards: QuoteCard[];
  onJump: (card: QuoteCard, index: number) => void;
  /** Localized "n verified, m discarded" style summary line, rendered above the cards. */
  summaryLine?: string;
  /** Shows the "Edit citation info" affordance (F2) that opens BiblioForm.
   * Off by default so the chat quote-card artifact (F3) stays "jump + copy
   * identical" to the panel without also picking up the edit surface. */
  allowEditBiblio?: boolean;
}

/**
 * Shared verified-quote card list — rendered identically by the Quote
 * Finder panel (F1) and the chat `quote_search` artifact (F3), so Jump
 * and Copy behave the same in both places. Fetches the document's biblio
 * once (GET /documents/{id}/biblio, user row if present else the seeded
 * system default) so every card's Copy action can append an APA in-text
 * citation without a per-card round trip.
 */
export default function QuoteCardList({ documentId, cards, onJump, summaryLine, allowEditBiblio = false }: QuoteCardListProps) {
  const { tOr } = useLocale();
  const [biblio, setBiblio] = useState<DocumentBiblioCsl | null>(null);
  const [editingBiblio, setEditingBiblio] = useState(false);

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

  // Headline claim (Codex M2 r1 BLOCKER #1 fix): the strong "word-for-word"
  // claim only renders when EVERY card is page_text-kind — a single
  // extracted_text-kind card in the set downgrades the WHOLE headline to
  // the caveat, even though each card still carries its own honest
  // per-card label via QuoteResultCard/trustLabel.
  const headline = cards.length > 0 ? resultKindHeadline(cards, tOr) : '';
  const headlineIsCaveat = cards.length > 0 && !cards.every((c) => c.sourceKind === 'page_text');

  return (
    <div>
      {headline ? (
        <p
          className={`mb-2 px-1 text-xs leading-5 ${
            headlineIsCaveat ? 'text-amber-800 dark:text-amber-200' : 'text-[var(--reader-muted)]'
          }`}
          role={headlineIsCaveat ? 'status' : undefined}
        >
          {headline}
        </p>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        {summaryLine ? (
          <p className="text-xs text-[var(--reader-muted)]">{summaryLine}</p>
        ) : <span />}
        {allowEditBiblio ? (
          <button
            type="button"
            onClick={() => setEditingBiblio(true)}
            className="inline-flex min-h-6 items-center gap-1 rounded px-1.5 text-xs font-medium text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-panel-muted)] hover:text-[var(--reader-ink)] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Pencil size={12} aria-hidden="true" />
            {tOr('quoteFinder.editCitationInfo', 'Edit citation info')}
          </button>
        ) : null}
      </div>
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
      {allowEditBiblio && editingBiblio ? (
        <BiblioForm
          documentId={documentId}
          initialBiblio={biblio}
          onClose={() => setEditingBiblio(false)}
          onSaved={(next) => {
            setBiblio(next);
            setEditingBiblio(false);
          }}
        />
      ) : null}
    </div>
  );
}
