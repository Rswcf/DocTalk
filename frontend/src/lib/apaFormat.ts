import type { DocumentBiblioCsl } from './api';

/**
 * Minimal APA in-text citation formatter — mirrors
 * `backend/app/services/biblio_service.py::format_apa_intext` exactly
 * (same family-name rules, same "n.d."/"n.a." fallbacks, same page
 * fragment behavior for a single page) so the clipboard text the user gets
 * from the Quote Finder panel and the chat quote-card artifact matches what
 * the backend would produce for the same biblio + page. No citeproc-py, no
 * Crossref/DOI lookup in M2 (plan §8.5) — this stays a pure, dependency-free
 * function.
 *
 * `pageEnd` is a frontend-only extension (M3 acceptance-gate §3(A)): the
 * backend now emits an honest page range for `extracted_text` matches
 * spanning one page boundary instead of discarding them, so the copy
 * builder needs to render "pp. X–Y" (en dash, APA's plural form for a
 * range) rather than silently truncating to the start page. The backend's
 * `format_apa_intext` has zero callers today (reference implementation
 * only, not wired to any user-visible output) and stays single-page —
 * intentionally out of scope here.
 */
export function formatApaInText(
  biblio: DocumentBiblioCsl | null | undefined,
  page: number | null | undefined,
  pageEnd?: number | null,
): string {
  const authors = biblio?.author || [];
  const families = authors
    .map((a) => (a?.family || '').trim())
    .filter((f) => f.length > 0);

  let who: string;
  if (families.length === 1) {
    who = families[0];
  } else if (families.length === 2) {
    who = `${families[0]} & ${families[1]}`;
  } else if (families.length >= 3) {
    who = `${families[0]} et al.`;
  } else {
    const title = (biblio?.title || '').trim();
    who = title || 'n.a.';
  }

  const year = biblio?.issued?.year;
  const yearStr = year ? String(year) : 'n.d.';
  let pageStr = '';
  if (page && pageEnd && pageEnd !== page) {
    pageStr = `, pp. ${page}–${pageEnd}`;
  } else if (page) {
    pageStr = `, p. ${page}`;
  }
  return `(${who}, ${yearStr}${pageStr})`;
}
