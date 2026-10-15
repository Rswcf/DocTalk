/**
 * Find where a citation snippet starts in a page's text.
 * Returns [startIndex, matchLength] or null if no match found.
 *
 * The backend truncates snippets, so progressively shorter prefixes are tried,
 * down to 30 characters (or the whole snippet when it is shorter; a snippet
 * under 10 characters is never matched). The text after an old " — " title
 * separator is tried too.
 *
 * Snippets are the chunk's own text since 0.36.2. Citations stored before
 * begin with "{section_title}: ", which the page text does not contain; they
 * are not matched (the reader shows the page). Guessing where such a title ends
 * is unsafe: a title can itself contain ": ", and a tail cut at any ": " can
 * land on an earlier, unrelated line (Codex r1, 2026-10-15).
 */
export function findSnippetInPage(pageText: string, snippet: string): [number, number] | null {
  if (!snippet || !pageText) return null;

  const pageLower = pageText.toLowerCase();

  const candidates = [snippet];
  const dashIdx = snippet.indexOf(' — ');
  if (dashIdx !== -1 && dashIdx < snippet.length - 4) {
    candidates.push(snippet.slice(dashIdx + 3));
  }

  for (const candidate of candidates) {
    const searchText = candidate.toLowerCase().trim();
    if (searchText.length < 10) continue;

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
