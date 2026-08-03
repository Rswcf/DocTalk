import type { QuoteCard, SavedQuote } from '../../lib/api';
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

/**
 * Same `Citation` shape as `citationFromQuoteCard`, built from a SAVED
 * quote instead (M3-F2, Evidence Board). `SavedQuoteResponse` never
 * exposes `source_chunk_id` — by design, it's nullable server-side (a
 * reparse SET NULLs it rather than cascading the delete, precisely so the
 * saved row survives) — so there's no real chunk id to carry here.
 * `navigateToCitation` never reads `chunkId` for anything functional (only
 * page/bboxes/textSnippet/focusSnippet), so the saved quote's own id is a
 * harmless, unique stand-in rather than an empty string.
 */
export function citationFromSavedQuote(quote: SavedQuote, index: number): Citation {
  return {
    refIndex: index + 1,
    chunkId: quote.id,
    page: quote.page,
    pageEnd: quote.pageEnd,
    bboxes: quote.bboxes || [],
    textSnippet: quote.quoteText,
    focusSnippet: quote.quoteText,
    offset: 0,
    documentId: quote.documentId,
  };
}

export function tierLabel(tier: string, tOr: TOrFn): string {
  if (tier === 'exact') return tOr('quoteFinder.tier.exact', 'Exact match');
  if (tier === 'normalized') return tOr('quoteFinder.tier.normalized', 'Normalized match');
  if (tier === 'aligned') return tOr('quoteFinder.tier.aligned', 'Close match');
  return tier;
}

/** Honest trust label (plan §8.1, hardened per Codex M2 r1 BLOCKER #1):
 * page-text-verified quotes say "verified against page text" — no caveat
 * needed. Extracted-text (chunk-fallback) quotes carry an EXPLICIT caveat
 * instead of a plain "verified against extracted text" label: the parser's
 * hard-hyphen handling can silently drop a line-break hyphen, so a
 * chunk-fallback "exact" match is not guaranteed byte-identical to the
 * source the way a page-text match is. The caveat text IS the label —
 * never render the unqualified claim for this kind. */
export function trustLabel(sourceKind: string, tOr: TOrFn): string {
  return sourceKind === 'page_text'
    ? tOr('quoteFinder.trust.pageText', 'Verified against page text')
    : tOr('quoteFinder.trust.extractedCaveat', 'Verified against extracted text — line-break hyphenation may be normalized.');
}

/**
 * Headline claim shown once a result set exists (Codex M2 r1 BLOCKER #1
 * fix). The panel/artifact used to claim "word-for-word quotes from this
 * document" unconditionally, which is only true for page_text-kind
 * results — extracted_text-kind results can have a mutated hard-hyphen
 * (see `trustLabel` above). Per-card labels still govern each card; this
 * headline is the WEAKEST kind present across the whole set, so a mixed
 * result never overstates confidence for the set as a whole.
 */
export function resultKindHeadline(cards: QuoteCard[], tOr: TOrFn): string {
  const allPageText = cards.length > 0 && cards.every((c) => c.sourceKind === 'page_text');
  return allPageText
    ? tOr('quoteFinder.trust.pageTextHeadline', "Word-for-word quotes, verified against this document's page text.")
    : tOr('quoteFinder.trust.extractedCaveat', 'Verified against extracted text — line-break hyphenation may be normalized.');
}

export function approxHighlightLabel(tOr: TOrFn): string {
  return tOr('quoteFinder.approxHighlight', 'Highlight location is approximate');
}

/** Structurally typed to `{page, pageEnd}` (not the full `QuoteCard`) so it
 * works for both a live search result and a saved quote without either
 * type needing to know about the other. */
export function pageRangeLabel(card: { page: number; pageEnd: number }, tOr: TOrFn): string {
  if (card.pageEnd && card.pageEnd !== card.page) {
    return tOr('quoteFinder.pageRange', 'p. {start}–{end}', { start: card.page, end: card.pageEnd });
  }
  return tOr('quoteFinder.page', 'p. {page}', { page: card.page });
}

/**
 * Full-identity React key for a live search-result card — chunkId + page +
 * pageEnd + the FULL quote text (Codex M3 r3 finding #4, superseding r2's
 * fix): a 32-bit FNV-1a hash of the text was tried first, but 32 bits is
 * NOT collision-resistant in practice — Codex demonstrated "costarring"
 * and "liquid" hashing to the identical value. React keys accept long
 * strings without issue and result-card lists are small (dozens of items
 * at most, never thousands), so there's no real cost to using the whole
 * string directly instead of a lossy digest of it. `index` is still
 * included so that two genuinely identical quotes (same
 * chunk/page/pageEnd/text — e.g. an exact repeated boilerplate clause
 * returned twice in one result set) still get distinct keys, which React
 * requires even when they're substantively "the same" quote appearing
 * twice.
 */
export function quoteResultCardKey(card: QuoteCard, index: number): string {
  return `${card.chunkId || 'card'}-${index}-${card.page}-${card.pageEnd}-${card.displayText}`;
}
