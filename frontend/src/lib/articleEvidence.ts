import type { TextEvidence, TextEvidencePage, TextEvidenceRange } from './textEvidence';

/**
 * The URL article view (TextViewer's WebArticleView) renders each page's
 * leading `#` heading as its own `<h2>` and only the rest as Markdown, so
 * evidence marks can land on the body alone. Evidence for that view goes
 * through `articleEvidence` before its status is shown, so the status always
 * names what is rendered.
 */

export function leadingMarkdownHeading(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^#{1,6}\s+(.+)$/);
    return match ? match[1].trim() : null;
  }
  return null;
}

function stripLeadingMatchingHeading(text: string, title?: string | null): string {
  const lines = text.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) return text;

  const first = lines[firstContentIndex].trim();
  const match = first.match(/^#{1,6}\s+(.+)$/);
  if (!match) return text;

  const heading = match[1].trim();
  if (title && heading !== title.trim()) return text;

  return [
    ...lines.slice(0, firstContentIndex),
    ...lines.slice(firstContentIndex + 1),
  ].join('\n').trimStart();
}

export interface ArticlePage { title: string | null; body: string; bodyStart: number }

/** The section title shown above the body, and the body rendered as
 *  Markdown. The body is always a suffix of the page text, so `bodyStart`
 *  is exact (an `indexOf` would find a body that repeats its own heading
 *  inside the heading). */
export function articlePage(page: TextEvidencePage): ArticlePage {
  const title = page.section_title?.trim() || leadingMarkdownHeading(page.text);
  const body = stripLeadingMatchingHeading(page.text, title);
  return { title, body, bodyStart: page.text.length - body.length };
}

const NO_EVIDENCE: TextEvidence = { kind: 'page', ranges: [], anchor: null };

/** Evidence as the article view can render it. The stripped heading carries
 *  no mark. When an exact (focus) range touches it, the cited passage is not
 *  shown as located: the result is `page`, and the region around it is
 *  dropped too. A region range is clipped to the body; a region left with no
 *  range is `page`. */
export function articleEvidence(pages: TextEvidencePage[], evidence: TextEvidence): TextEvidence {
  if (!evidence.ranges.length) return evidence;
  const bodyStarts = new Map(pages.map((page) => [page.page_number, articlePage(page).bodyStart]));
  const ranges: TextEvidenceRange[] = [];
  for (const range of evidence.ranges) {
    const bodyStart = bodyStarts.get(range.page) ?? 0;
    if (range.start >= bodyStart) { ranges.push(range); continue; }
    if (range.emphasis) return NO_EVIDENCE;
    if (range.end > bodyStart) ranges.push({ ...range, start: bodyStart });
  }
  if (!ranges.length) return NO_EVIDENCE;
  if (ranges.length === evidence.ranges.length && ranges.every((range, i) => range === evidence.ranges[i])) return evidence;
  const anchor = ranges.find((range) => range.emphasis) || ranges[0];
  return {
    kind: ranges.some((range) => range.emphasis) ? 'exact' : 'region',
    ranges,
    anchor: { page: anchor.page, start: anchor.start },
  };
}

/** Marks of one page, as offsets into its article body. */
export function bodyRanges<T extends { start: number; end: number }>(article: ArticlePage, marks: readonly T[]): T[] {
  if (article.bodyStart === 0) return [...marks];
  return marks
    .filter((mark) => mark.start >= article.bodyStart)
    .map((mark) => ({ ...mark, start: mark.start - article.bodyStart, end: Math.min(mark.end - article.bodyStart, article.body.length) }));
}
