// Every extractor caps a section title at 200 characters.
const LEGACY_TITLE_MAX = 200;
// The whole snippet is never matched on fewer than 30 characters; a fallback
// candidate shorter than that could only land on an unrelated line.
const MIN_FALLBACK_LENGTH = 30;

/**
 * Find where a citation snippet starts in a page's text.
 * Returns [startIndex, matchLength] or null if no match found.
 *
 * The backend truncates snippets, so progressively shorter prefixes are tried.
 * Snippets are the chunk's own text, but citations stored before 2026-10-11
 * (chat history, saved extraction/template/diff results) begin with
 * "{section_title}: ", which the page text does not contain. When the snippet
 * itself does not match, the text after each ": " within the first 200
 * characters is tried, then the text after an older " — " separator. Those
 * fallbacks need at least 30 characters, like the whole snippet.
 */
export function findSnippetInPage(pageText: string, snippet: string): [number, number] | null {
  if (!snippet || !pageText) return null;

  const pageLower = pageText.toLowerCase();

  const candidates = [snippet];
  for (let idx = snippet.indexOf(': '); idx !== -1 && idx <= LEGACY_TITLE_MAX; idx = snippet.indexOf(': ', idx + 2)) {
    candidates.push(snippet.slice(idx + 2));
  }
  const dashIdx = snippet.indexOf(' — ');
  if (dashIdx !== -1 && dashIdx < snippet.length - 4) {
    candidates.push(snippet.slice(dashIdx + 3));
  }

  for (const [index, candidate] of candidates.entries()) {
    const searchText = candidate.toLowerCase().trim();
    if (searchText.length < (index === 0 ? 10 : MIN_FALLBACK_LENGTH)) continue;

    // Try full text first, then progressively shorter prefixes
    for (let len = searchText.length; len >= Math.min(30, searchText.length); len -= 5) {
      const prefix = searchText.slice(0, len);
      const idx = pageLower.indexOf(prefix);
      if (idx !== -1) {
        return [idx, len];
      }
    }
  }

  return null;
}
