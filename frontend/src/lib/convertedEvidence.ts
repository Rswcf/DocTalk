import { canonicalize } from './pdfEvidence';

/**
 * DOCX/PPTX slide view shows LibreOffice's PDF, whose page N is not the
 * extractor's page N (a DOCX "page" is a heading section or a 3,000-character
 * split; LibreOffice may also skip hidden PPTX slides). A text-layer match on the cited
 * page is trusted only when the text occurs exactly once in the whole
 * converted document and that occurrence is inside the cited page range.
 * Whitespace is ignored when counting, so a word that the text layer splits
 * differently can only hide an occurrence, never add one.
 */

const squeeze = (value: string) => canonicalize(value).text.replace(/\s+/g, '');

/** The converted PDF's page texts (index 0 = page 1), prepared once. */
export function convertedPageIndex(pages: readonly string[]): string[] {
  return pages.map(squeeze);
}

export function uniqueInPageRange(index: readonly string[], start: number, end: number, text: string | null | undefined): boolean {
  const needle = text ? squeeze(text) : '';
  if (!needle) return false;
  let total = 0;
  let inRange = false;
  index.forEach((haystack, page) => {
    for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
      total++;
      if (page + 1 >= start && page + 1 <= end) inRange = true;
    }
  });
  return total === 1 && inRange;
}
