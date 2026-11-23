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

/** True when chips should name their file. The chat payload carries
 *  `document_filename` only for collection retrieval (chat_service: a
 *  single-document chunk has none), so a collection answer names its file
 *  even when it cites one document, and a single-document reader, where every
 *  chip would repeat the same name, shows the excerpt (review 2026-11-23 F7). */
export function showsDocumentNames(items: { documentFilename?: string | null }[]): boolean {
  return items.some((item) => Boolean(item.documentFilename));
}

/** Strips control characters and cuts to `max` code points with an ellipsis. */
export function shortSnippet(text: string | null | undefined, max: number = SOURCE_SNIPPET_MAX): string {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  const points = Array.from(clean);
  return points.length > max ? points.slice(0, max).join('') + '…' : clean;
}
