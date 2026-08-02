import type { QuoteCard } from '../../lib/api';
import type { Citation } from '../../types';

type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;

/**
 * Builds the same `Citation` shape the rest of the app uses for
 * `navigateToCitation`/`onCitationClick` (store/index.ts's citation-jump
 * action) from a verified quote card, so Jump behaves identically whether
 * the card came from the Quote Finder panel (F1) or a chat quote-card
 * artifact (F3). `card.bboxes` are the CITED CHUNK's bboxes for the
 * quote's page (§8.2 v1 decision) — highlight location is approximate,
 * not the exact quote span; see `approxHighlightLabel` below.
 */
export function citationFromQuoteCard(card: QuoteCard, documentId: string, index: number): Citation {
  return {
    refIndex: card.refIndex ?? index + 1,
    chunkId: card.chunkId,
    page: card.page,
    pageEnd: card.pageEnd,
    bboxes: card.bboxes || [],
    textSnippet: card.displayText,
    focusSnippet: card.displayText,
    offset: 0,
    documentId,
  };
}

export function tierLabel(tier: string, tOr: TOrFn): string {
  if (tier === 'exact') return tOr('quoteFinder.tier.exact', 'Exact match');
  if (tier === 'normalized') return tOr('quoteFinder.tier.normalized', 'Normalized match');
  if (tier === 'aligned') return tOr('quoteFinder.tier.aligned', 'Close match');
  return tier;
}

/** Honest trust label (plan §8.1): only page-text-verified quotes can say
 * "verified against page text" — chunk-fallback documents (not yet
 * re-parsed under the M2 forward-only page-text persistence) say
 * "verified against extracted text" instead. Never overstate confidence. */
export function trustLabel(sourceKind: string, tOr: TOrFn): string {
  return sourceKind === 'page_text'
    ? tOr('quoteFinder.trust.pageText', 'Verified against page text')
    : tOr('quoteFinder.trust.extractedText', 'Verified against extracted text');
}

export function approxHighlightLabel(tOr: TOrFn): string {
  return tOr('quoteFinder.approxHighlight', 'Highlight location is approximate');
}

export function pageRangeLabel(card: QuoteCard, tOr: TOrFn): string {
  if (card.pageEnd && card.pageEnd !== card.page) {
    return tOr('quoteFinder.pageRange', 'p. {start}–{end}', { start: card.page, end: card.pageEnd });
  }
  return tOr('quoteFinder.page', 'p. {page}', { page: card.page });
}
