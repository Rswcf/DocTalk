"use client";

import { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { DocumentBiblioCsl, QuoteCard } from '../../lib/api';
import { getDocumentBiblio } from '../../lib/api';
import { PaywallModal } from '../PaywallModal';
import { trackEvent } from '../../lib/analytics';
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
  /** Needed only for the save-limit PaywallModal's upgrade-target derivation
   * (M3-F1). Anonymous users never see this list at all (cards are
   * authed-only on both the panel and the chat artifact), so this is
   * always a real plan in practice. */
  userPlan?: string;
}

/**
 * Shared verified-quote card list — rendered identically by the Quote
 * Finder panel (F1) and the chat `quote_search` artifact (F3), so Jump
 * and Copy behave the same in both places. Fetches the document's biblio
 * once (GET /documents/{id}/biblio, user row if present else the seeded
 * system default) so every card's Copy action can append an APA in-text
 * citation without a per-card round trip.
 */
export default function QuoteCardList({ documentId, cards, onJump, summaryLine, allowEditBiblio = false, userPlan }: QuoteCardListProps) {
  const { tOr } = useLocale();
  const [biblio, setBiblio] = useState<DocumentBiblioCsl | null>(null);
  const [editingBiblio, setEditingBiblio] = useState(false);
  const [saveLimitOpen, setSaveLimitOpen] = useState(false);

  const handleSaveLimitReached = useCallback(() => {
    setSaveLimitOpen(true);
    trackEvent('paywall_opened', {
      source: 'quote_save',
      reason: 'SAVED_QUOTES_LIMIT_REACHED',
      plan: userPlan || 'free',
      period: 'monthly',
    });
  }, [userPlan]);

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
            // Includes page + a slice of the quote text, not just
            // chunkId-index (Codex M3 r1 finding #4): a later search can
            // return DIFFERENT text from the same chunk at the same list
            // position, and keying by chunkId-index alone let React reuse
            // the QuoteResultCard instance — carrying over its local
            // saved=true state onto a quote that was never actually saved,
            // which then blocked saving the real one. Changing the text
            // now changes the key, forcing a remount (fresh saved/saving
            // state) instead of reusing a stale instance.
            key={`${card.chunkId || 'card'}-${index}-${card.page}-${card.displayText.slice(0, 40)}`}
            card={card}
            index={index}
            documentId={documentId}
            biblio={biblio}
            onJump={onJump}
            onSaveLimitReached={handleSaveLimitReached}
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
      <PaywallModal
        isOpen={saveLimitOpen}
        onClose={() => setSaveLimitOpen(false)}
        reason="SAVED_QUOTES_LIMIT_REACHED"
        currentPlan={userPlan}
      />
    </div>
  );
}
