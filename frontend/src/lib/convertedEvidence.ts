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
 * Replaces each list marker that stands alone with spaces of the same length,
 * so text offsets are unchanged. A marker stands alone when whitespace or the
 * edge of the text is on both sides of it; the edge of a pdf.js text item is
 * an edge, because items are joined with a space or a line break. A marker
 * inside a word or number ("12–14", "well–known") is kept. Used only for
 * converted DOCX/PPTX pages and their candidates, on both sides of every
 * comparison: a native PDF's own text layer is what its extractor read, so
 * its bullets are in its citation text too.
 */
export function maskListMarkers(text: string): string {
  let output = '';
  for (let i = 0; i < text.length;) {
    if (!LIST_MARKERS.has(text[i])) { output += text[i]; i++; continue; }
    let end = i;
    while (end < text.length && LIST_MARKERS.has(text[end])) end++;
    const alone = (i === 0 || /\s/.test(text[i - 1])) && (end === text.length || /\s/.test(text[end]));
    output += alone ? ' '.repeat(end - i) : text.slice(i, end);
    i = end;
  }
  return output;
}

const squeeze = (value: string) => canonicalize(maskListMarkers(value)).text.replace(/\s+/g, '');

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
