import type { Citation } from '../types';

/**
 * Re-number citations by first-appearance order to produce continuous [1..N] refs.
 */
export function renumberCitations(citations: Citation[]): Citation[] {
  if (!citations || citations.length === 0) return [];

  const unique = citations.filter(
    (citation, index, all) => all.findIndex((item) => item.refIndex === citation.refIndex) === index,
  );

  // Legacy [n] markers are part of the text; changing only their metadata
  // would leave those markers pointing at a different reference.
  if (citations.some((citation) => !Number.isInteger(citation.offset))) return citations;
  const sorted = [...unique].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
  const refMap = new Map<number, number>();
  sorted.forEach((citation, index) => refMap.set(citation.refIndex, index + 1));

  return citations.map((citation) => ({
    ...citation,
    refIndex: refMap.get(citation.refIndex) ?? citation.refIndex,
  }));
}
