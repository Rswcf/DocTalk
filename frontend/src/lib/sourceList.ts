// Display helpers for the per-answer source list (SourcesStrip, above the
// answer; the CitationCard row below it was removed on 2026-11-22 as a
// duplicate). Display only: which sources exist, their
// identity (citationSourceKey) and their jump targets are decided elsewhere.

/** Sources shown before "Show all". An answer can cite 15+ passages; a full
 *  list pushed the answer itself off screen (production reader, 2026-11-22). */
export const SOURCE_PREVIEW_LIMIT = 5;

/** Longest snippet a source chip shows before truncating. */
export const SOURCE_SNIPPET_MAX = 60;

/** Items to render: the first `limit`, plus any later item `keep` selects (the
 *  active citation must stay visible after an inline [n] click), or all of
 *  them once expanded. */
export function visibleSources<T>(
  items: T[],
  expanded: boolean,
  keep: (item: T) => boolean = () => false,
  limit: number = SOURCE_PREVIEW_LIMIT,
): T[] {
  if (expanded || items.length <= limit) return items;
  return items.filter((item, index) => index < limit || keep(item));
}

/** True when the sources come from more than one document. A chip's file name
 *  only tells sources apart in that case; in a single-document reader every
 *  chip showed the same name. */
export function spansMultipleDocuments(
  items: { documentId?: string | null; documentFilename?: string | null }[],
): boolean {
  const docs = new Set<string>();
  for (const item of items) {
    const id = item.documentId || item.documentFilename;
    if (id) docs.add(id);
    if (docs.size > 1) return true;
  }
  return false;
}

/** Strips control characters and cuts to `max` code points with an ellipsis. */
export function shortSnippet(text: string | null | undefined, max: number = SOURCE_SNIPPET_MAX): string {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  const points = Array.from(clean);
  return points.length > max ? points.slice(0, max).join('') + '…' : clean;
}
