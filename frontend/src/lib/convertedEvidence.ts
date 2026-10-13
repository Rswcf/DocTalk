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

/**
 * List markers that LibreOffice draws for DOCX/PPTX bullets: the defaults of
 * PowerPoint, Word, Impress and Writer, after LibreOffice recodes Symbol and
 * Wingdings bullets to Unicode. The extractor reads paragraph text, where a
 * bullet is formatting and not a character, so a converted page shows a glyph
 * the citation text never has (production, 2026-10-12: "Drip lines | • | The
 * drip lines in block C ..."). Letter and number bullets ("o", "1.") are text
 * and are never treated as markers.
 */
const LIST_MARKERS = new Set([
  '•', // • bullet: PowerPoint, Word (Symbol) and Writer level 1
  '◦', // ◦ white bullet: Writer level 2
  '▪', // ▪ small square: Writer level 3, Word (Wingdings)
  '‣', // ‣ triangular bullet
  '⁃', // ⁃ hyphen bullet
  '∙', // ∙ bullet operator
  '●', // ● black circle: Impress level 1
  '○', // ○ white circle
  '■', // ■ black square
  '□', // □ white square
  '◆', // ◆ black diamond
  '❖', // ❖ diamond minus white X: Office bullet library (Wingdings)
  '➢', // ➢ arrowhead: Office bullet library (Wingdings)
  '➤', // ➤ arrowhead
  '►', // ► pointer
  '✓', // ✓ check mark: Office bullet library (Wingdings)
  '✔', // ✔ heavy check mark
  '–', // – en dash: PowerPoint and Impress level 2
]);

/**
 * True for a pdf.js text item (one text-layer span) that holds nothing but
 * list markers. LibreOffice draws a bullet as its own text item: another
 * font, and an indent gap before its text. Only such an item is a bullet. A
 * marker inside an item ("Revenue rose – sharply", "12–14", "• Text") stays
 * text, because ignoring it there would let text without the character match
 * text with it (Codex r1 #1). The citation text is never changed. Used only
 * for converted DOCX/PPTX pages, in both the uniqueness index below and the
 * text-layer match in PageWithHighlights, so the two always agree. A native
 * PDF's citation text is read from its own text layer, bullets included.
 */
export function isListMarkerItem(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  for (const char of trimmed) if (!LIST_MARKERS.has(char)) return false;
  return true;
}

const squeeze = (value: string) => canonicalize(value).text.replace(/\s+/g, '');

/** The converted PDF's pages (index 0 = page 1), prepared once. A page is its
 * text items (bullet-only items are dropped, as the text-layer match ignores
 * them) or, for callers without items, its joined text. */
export function convertedPageIndex(pages: readonly (string | readonly string[])[]): string[] {
  return pages.map(page => squeeze(typeof page === 'string'
    ? page
    : page.filter(item => !isListMarkerItem(item)).join(' ')));
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
