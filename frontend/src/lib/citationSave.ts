import type { Citation } from '../types';
import type { SavedQuote } from './api';

/**
 * "Save quote" from the reader's evidence bar (plan
 * .collab/plans/2026-09-22-next-strategy.md §2.1): the one cohort that ever
 * retained verifies by clicking citations, and a click never produces the
 * phrasing that triggers Quote Finder, so the save sits where the click lands.
 *
 * The server re-verifies every save (`verify_saved_quote`); the caller renders
 * only the returned row, never the client's sentence. When there is nothing to
 * save or the server cannot verify it, the caller opens Quote Finder prefilled
 * with the cited claim, and never submits the search itself (searches are
 * billed).
 *
 * Self-contained on purpose: types only from ./api, errors read by shape, so
 * the unit tests load this file without the network client.
 */

/** QuoteSearchRequest.topic max_length (backend) and the panel input's maxLength. */
export const TOPIC_MAX = 300;
const MIN_CLAIM = 12;

export type SaveQuoteFn = (
  documentId: string,
  params: { chunkId: string; quoteText: string; pageHint?: number },
) => Promise<SavedQuote>;

export type CitationSaveOutcome =
  | { kind: 'signin' }
  | { kind: 'saved'; quote: SavedQuote }
  | { kind: 'fallback'; reason: 'no_snippet' | 'not_verifiable'; topic: string }
  | { kind: 'limit' }
  | { kind: 'error'; error: unknown };

export async function saveCitationAsQuote(
  citation: Citation,
  deps: { isLoggedIn: boolean; documentId: string; save: SaveQuoteFn; messageText?: string },
): Promise<CitationSaveOutcome> {
  if (!deps.isLoggedIn) return { kind: 'signin' };
  const quoteText = citation.focusSnippet?.trim();
  if (!quoteText || !citation.chunkId) {
    return { kind: 'fallback', reason: 'no_snippet', topic: fallbackTopic(deps.messageText, citation) };
  }
  try {
    const quote = await deps.save(citation.documentId || deps.documentId, {
      chunkId: citation.chunkId,
      quoteText,
      pageHint: citation.page,
    });
    return { kind: 'saved', quote };
  } catch (error) {
    const { status, code } = (error ?? {}) as { status?: unknown; code?: unknown };
    if (status === 422 && code === 'QUOTE_NOT_VERIFIABLE') {
      return { kind: 'fallback', reason: 'not_verifiable', topic: fallbackTopic(deps.messageText, citation) };
    }
    if (status === 403 && code === 'SAVED_QUOTES_LIMIT_REACHED') return { kind: 'limit' };
    return { kind: 'error', error };
  }
}

/** Quote Finder topic for the fallback: the cited claim, else the supporting
 * sentence, else the chunk text. */
export function fallbackTopic(messageText: string | undefined, citation: Citation): string {
  const claim = messageText ? citedClaim(messageText, citation) : null;
  return claim ?? (tidy(citation.focusSnippet ?? '') || tidy(citation.textSnippet ?? ''));
}

const LATIN_END = new Set(['.', '!', '?']);
const CJK_END = new Set(['。', '！', '？']);

function ends(points: string[], i: number): boolean {
  const c = points[i];
  if (c === '\n' || CJK_END.has(c)) return true;
  if (!LATIN_END.has(c)) return false;
  // "5.25" and "e.g.x" are not sentence ends; a full stop needs a space, a line
  // end or a citation marker after it.
  const next = points[i + 1];
  return next === undefined || /\s/.test(next) || next === '[';
}

/** The answer sentence a citation marker belongs to, cleaned for use as a
 * search topic; null when it cannot be located or is too short to help.
 * Offsets come from Python and count codepoints (see insertCitationMarkers);
 * legacy citations without one are found by their textual [n] marker. */
export function citedClaim(text: string, citation: Pick<Citation, 'offset' | 'refIndex'>): string | null {
  const points = Array.from(text);
  let pos: number | null = null;
  if (typeof citation.offset === 'number' && Number.isInteger(citation.offset)) {
    if (citation.offset >= 0 && citation.offset <= points.length) pos = citation.offset;
  } else {
    const marker = new RegExp(`(?<![\\\\!])\\[${citation.refIndex}\\](?!\\()`).exec(text);
    if (marker) pos = Array.from(text.slice(0, marker.index)).length;
  }
  if (pos === null) return null;

  let back = pos;
  while (back > 0 && /\s/.test(points[back - 1])) back -= 1;
  let end = points.length;
  if (back > 0 && ends(points, back - 1)) {
    end = back;
  } else {
    for (let i = pos; i < points.length; i += 1) {
      if (ends(points, i)) {
        end = points[i] === '\n' ? i : i + 1;
        break;
      }
    }
  }
  let from = end - 1;
  if (from >= 0 && (LATIN_END.has(points[from]) || CJK_END.has(points[from]))) from -= 1;
  let start = 0;
  for (let k = from; k >= 0; k -= 1) {
    if (ends(points, k)) {
      start = k + 1;
      break;
    }
  }

  const claim = tidy(
    points
      .slice(start, end)
      .join('')
      .replace(/\[\d+\]/g, '')
      .replace(/`+/g, '')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(^|[\s(])[*_](\S(?:[^\n]*?\S)?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/^\s*(?:(?:[-*+]|\d+[.)])\s+|#{1,6}\s+|>\s*)+/, ''),
  );
  return Array.from(claim).length >= MIN_CLAIM ? claim : null;
}

/** Collapse whitespace, drop spaces a removed marker left before punctuation,
 * and cut to TOPIC_MAX UTF-16 units at a word boundary when there is one. */
function tidy(value: string): string {
  const text = value.replace(/\s+/g, ' ').replace(/\s+([.,;:!?。！？、，；：])/g, '$1').trim();
  if (text.length <= TOPIC_MAX) return text;
  let cut = '';
  for (const point of text) {
    if (cut.length + point.length > TOPIC_MAX) break;
    cut += point;
  }
  const space = cut.lastIndexOf(' ');
  return (space > TOPIC_MAX * 0.6 ? cut.slice(0, space) : cut).trim();
}
