import { canonicalize } from './pdfEvidence';
import { citationChunkText } from './citationText';
import type { Citation } from '../types';

/**
 * Locates a cited chunk inside the raw page text of a non-PDF document
 * (Markdown, DOCX, PPTX, XLSX, URL), for inline highlighting in TextViewer.
 *
 * Why this works: `Page.content` is the extractor's raw Markdown, and chunk
 * text is the same Markdown split into sentences and rejoined
 * (parse_service.chunk_document), so sentences survive with whitespace drift
 * only. Two shapes do not survive and are handled explicitly:
 * - The page's synthetic title block is glued onto the first body sentence
 *   when it is not classified as a heading, and the title is not in the page
 *   text (DOCX/MD/XLSX/URL) or is repeated (PPTX).
 * - A page that ends without a sentence delimiter (a table) is glued onto the
 *   first sentence of the next page.
 * Both are split at a page start, and only a unique match confirms the split.
 *
 * The rule is the PDF rule: never highlight the wrong passage. Every located
 * piece is unique in the whole document and on a page the chunk may sit on;
 * ambiguous or short pieces are dropped, never bridged; with too little
 * located, the result is `page`.
 */

export type TextEvidenceKind = 'exact' | 'region' | 'page';
export interface TextEvidencePage { page_number: number; text: string }
/** Offsets index the page's raw text (`TextEvidencePage.text`). */
export interface TextEvidenceRange { page: number; start: number; end: number; emphasis: boolean }
export interface TextEvidence {
  kind: TextEvidenceKind;
  ranges: TextEvidenceRange[];
  anchor: { page: number; start: number } | null;
}
export type TextEvidenceCitation = Pick<Citation, 'page' | 'pageEnd' | 'focusSnippet' | 'contextText'>;

const NO_EVIDENCE: TextEvidence = { kind: 'page', ranges: [], anchor: null };
const DELIMS = '。！？；.!?';
const WORD = /[\p{L}\p{N}]/u;
// Scripts written without spaces: a match may begin or end beside a letter.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
// Scripts where a few characters already carry a sentence.
const DENSE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const REGION_MIN_PIECES = 2;
const REGION_MIN_CHARS = 40;
// The extractors cut section titles at 200 characters, so a longer head left
// over by a page-start split is content, not a title.
const TITLE_MAX = 200;
// Share of the chunk's canonical text that must be located in its page range.
// On generated DOCX/PPTX/XLSX/MD/URL fixture corpora (not production
// citations) every chunk located >= 0.65; the same chunks cited on pages that
// do not hold them located <= 0.07.
const MIN_CHUNK_COVERAGE = 0.3;

interface PageIndex { number: number; raw: string; canon: string; offsets: Array<{ start: number; end: number }> }
/** Canonical offsets within one page. */
interface Hit { page: number; start: number; end: number }
/** `all`: every page of the document, for uniqueness. `scope`: the pages the
 * chunk may sit on, for page-start/page-end structure and chunk coverage. */
interface Search { all: PageIndex[]; scope: PageIndex[]; inScope: Set<number> }

// Canonical page text, kept per page object: the reader passes the same page
// objects on every citation click, and every click searches all pages.
const pageIndexCache = new WeakMap<TextEvidencePage, PageIndex>();
function indexPage(page: TextEvidencePage): PageIndex {
  const cached = pageIndexCache.get(page);
  if (cached && cached.raw === page.text && cached.number === page.page_number) return cached;
  const canon = canonicalize(page.text);
  const index = { number: page.page_number, raw: page.text, canon: canon.text, offsets: canon.offsets };
  pageIndexCache.set(page, index);
  return index;
}

/** Port of parse_service._split_into_sentences: ASCII .?! end a sentence only
 * before whitespace or the end; CJK 。！？； always do. Pieces are trimmed. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let buffer = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    buffer += char;
    if (!DELIMS.includes(char)) continue;
    if ('.?!'.includes(char) && i + 1 < text.length && !/\s/.test(text[i + 1])) continue;
    sentences.push(buffer);
    buffer = '';
  }
  if (buffer) sentences.push(buffer);
  return sentences.map(sentence => sentence.trim()).filter(Boolean);
}

function charBefore(text: string, index: number): string {
  if (index <= 0) return '';
  const code = text.charCodeAt(index - 1);
  return code >= 0xdc00 && code <= 0xdfff && index >= 2 ? text.slice(index - 2, index) : text[index - 1];
}

function charAt(text: string, index: number): string {
  const point = text.codePointAt(index);
  return point === undefined ? '' : String.fromCodePoint(point);
}

/** Two letters/digits that would make one word, unless either is unspaced. */
function joined(a: string, b: string): boolean {
  return WORD.test(a) && WORD.test(b) && !UNSPACED.test(a) && !UNSPACED.test(b);
}

function boundaryOk(haystack: string, index: number, needle: string): boolean {
  return !joined(charBefore(haystack, index), charAt(needle, 0))
    && !joined(charBefore(needle, needle.length), charAt(haystack, index + needle.length));
}

function minPiece(text: string): number { return DENSE.test(text) ? 6 : 12; }
function minRemainder(text: string): number { return DENSE.test(text) ? 8 : 20; }

function findAll(pages: PageIndex[], needle: string, limit = 2): Hit[] {
  const hits: Hit[] = [];
  if (!needle) return hits;
  for (const page of pages) {
    for (let from = 0; ;) {
      const index = page.canon.indexOf(needle, from);
      if (index < 0) break;
      from = index + 1;
      if (!boundaryOk(page.canon, index, needle)) continue;
      hits.push({ page: page.number, start: index, end: index + needle.length });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

function cutsAt(text: string, index: number): boolean {
  return text[index - 1] === ' ' || UNSPACED.test(charBefore(text, index)) || UNSPACED.test(charAt(text, index));
}

/** `text` ends with the end of `page`, possibly followed by the next page's
 * glued title (at most TITLE_MAX characters, dropped). Returns the page hit
 * and where the match starts in `text`; the match must be unique. */
function matchPageEnd(text: string, page: PageIndex, search: Search): { hit: Hit; start: number } | null {
  const canon = page.canon.trimEnd();
  for (let j = text.length; j > 0 && text.length - j <= TITLE_MAX + 1; j--) {
    if (j < text.length && !cutsAt(text, j)) continue;
    const body = text.slice(0, j).trimEnd();
    let length = 0;
    while (length < body.length && length < canon.length
      && body[body.length - 1 - length] === canon[canon.length - 1 - length]) length++;
    for (; length >= minPiece(body); length--) {
      const from = body.length - length;
      if (body[from] === ' ' || (from > 0 && !cutsAt(body, from))) continue;
      const match = body.slice(from);
      if (!boundaryOk(canon, canon.length - length, match)) continue;
      if (findAll(search.all, match).length !== 1) return null;
      return { hit: { page: page.number, start: canon.length - length, end: canon.length }, start: from };
    }
  }
  return null;
}

/** Peels consecutive page ends off the end of `text`, starting at page index
 * `last` (which must be page number `number`) and walking back. `rest` is the
 * unmatched beginning of `text`. */
function peelPageEnds(text: string, search: Search, last: number, number: number) {
  const pages = search.scope;
  const hits: Hit[] = [];
  let rest = text;
  for (let q = last; q >= 0 && pages[q].number === number - (last - q) && rest; q--) {
    const match = matchPageEnd(rest, pages[q], search);
    if (!match) break;
    hits.unshift(match.hit);
    rest = rest.slice(0, match.start).trimEnd();
  }
  return { hits, rest };
}

/** A piece that is not in the page text as a whole: the tail of it may open a
 * page (title glued on, or the previous page's undelimited end glued on). The
 * tail must start that page and be unique. The head is matched against the
 * ends of the pages before (a glued title may sit between them); what is left
 * is dropped as the title (`dropped` is its length in the piece). A page
 * before the tail's page is in scope only when the chunk runs through its end
 * (chunks are contiguous), so a unique match there is the chunk's own text. */
function splitAtPageStart(piece: string, search: Search): { hits: Hit[]; dropped: number } | null {
  const pages = search.scope;
  const rest = minRemainder(piece);
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (!page.canon) continue;
    for (let k = 1; k <= piece.length - rest; k++) {
      if (piece[k] !== page.canon[0] || !cutsAt(piece, k)) continue;
      const tail = piece.slice(k);
      if (!page.canon.startsWith(tail) || !boundaryOk(page.canon, 0, tail)) continue;
      if (findAll(search.all, tail).length !== 1) return null;
      const head = p > 0 ? peelPageEnds(piece.slice(0, k).trimEnd(), search, p - 1, page.number - 1) : null;
      return {
        hits: [...(head?.hits ?? []), { page: page.number, start: 0, end: tail.length }],
        dropped: head ? head.rest.length : k,
      };
    }
  }
  return null;
}

/** Unique hits for one sentence: whole, else split at a page start, else (for
 * multi-line sentences such as table rows) line by line. A split head too long
 * to be a title is located line by line as well. */
function locatePiece(raw: string, search: Search, byLine = true): Hit[] {
  const canon = canonicalize(raw);
  const piece = canon.text;
  if (piece.length < minPiece(piece)) return [];
  const hits = findAll(search.all, piece);
  // Unique in the document, and on a page the chunk may sit on.
  if (hits.length === 1) return search.inScope.has(hits[0].page) ? hits : [];
  if (hits.length > 1) return [];
  const split = splitAtPageStart(piece, search);
  if (split) {
    if (!byLine || split.dropped <= TITLE_MAX) return split.hits;
    // A PPTX title repeated at the end of the head is the tail's own first line.
    const head = locateLines(raw.slice(0, canon.offsets[split.dropped].start), search)
      .filter(hit => !split.hits.some(tail => tail.page === hit.page && hit.start < tail.end && tail.start < hit.end));
    return [...head, ...split.hits];
  }
  return byLine ? locateLines(raw, search) : [];
}

function locateLines(raw: string, search: Search): Hit[] {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  return lines.length > 1 ? lines.flatMap(line => locatePiece(line, search, false)) : [];
}

function before(a: Hit, b: Hit): boolean {
  return a.page < b.page || (a.page === b.page && a.end <= b.start);
}

/** Longest run of hits that keeps the chunk's order; anything out of order is
 * a coincidence elsewhere on the page and is dropped. */
function inOrder(hits: Hit[]): Hit[] {
  if (hits.length < 2) return hits;
  const length = hits.map(() => 1);
  const previous = hits.map(() => -1);
  let best = 0;
  for (let i = 0; i < hits.length; i++) {
    for (let j = 0; j < i; j++) {
      if (before(hits[j], hits[i]) && length[j] + 1 > length[i]) { length[i] = length[j] + 1; previous[i] = j; }
    }
    if (length[i] > length[best]) best = i;
  }
  const chain: Hit[] = [];
  for (let i = best; i >= 0; i = previous[i]) chain.unshift(hits[i]);
  return chain;
}

/** Join neighbours separated by whitespace only; content is never bridged. */
function mergeAdjacent(hits: Hit[], pages: Map<number, PageIndex>): Hit[] {
  const merged: Hit[] = [];
  for (const hit of hits) {
    const last = merged.at(-1);
    const gap = last && last.page === hit.page ? pages.get(hit.page)!.canon.slice(last.end, hit.start) : null;
    if (last && gap !== null && gap.trim() === '') last.end = hit.end;
    else merged.push({ ...hit });
  }
  return merged;
}

function inside(hit: Hit, spans: Hit[]): boolean {
  return spans.some(span => span.page === hit.page && span.start <= hit.start && hit.end <= span.end);
}

function toRaw(page: PageIndex, start: number, end: number, emphasis: boolean): TextEvidenceRange {
  return { page: page.number, start: page.offsets[start].start, end: page.offsets[end - 1].end, emphasis };
}

/**
 * @param pages      every page of the document, raw text as rendered
 * @param citation   page/pageEnd bound the marks; context_text's own page
 *                   range (if any) is where the chunk may sit
 * @param chunkText  the cited chunk's full text, or null when unknown
 * @param focus      verbatim supporting sentence; emphasised only when it is
 *                   unique inside the located chunk (or, with no chunk, unique
 *                   in the document and on the cited pages)
 *
 * Uniqueness is checked over the whole document, never over the cited pages
 * alone. The cited range is not proof of where the text is: citation_location
 * narrows a chunk to one page, and Quote Finder cards, saved quotes and
 * `?highlight=` links carry no context_text at all. A sentence that the
 * document holds twice is not marked, even when only one copy is on the cited
 * page; the rest of the chunk still is (pieces are never bridged), and a
 * one-sentence chunk falls back to `page`. Page-start/page-end structure and
 * chunk coverage stay within the pages the chunk may sit on (its own range
 * from the context_text prefix, plus the cited pages); marks stay within the
 * cited pages. convertedEvidence.ts applies the same document-wide rule.
 */
export function locateTextEvidence(
  pages: TextEvidencePage[],
  citation: TextEvidenceCitation,
  chunkText: string | null | undefined,
  focus: string | null | undefined = citation.focusSnippet,
): TextEvidence {
  const markStart = citation.page;
  const markEnd = Math.max(citation.pageEnd || citation.page, citation.page);
  const chunkRange = citationChunkText(citation);
  const scopeStart = Math.min(markStart, chunkRange?.pageStart ?? markStart);
  const scopeEnd = Math.max(markEnd, chunkRange?.pageEnd ?? markEnd);
  const all: PageIndex[] = pages
    .filter(page => page.text)
    .sort((a, b) => a.page_number - b.page_number)
    .map(indexPage);
  const scope = all.filter(page => page.number >= scopeStart && page.number <= scopeEnd);
  if (!scope.length) return NO_EVIDENCE;
  const search: Search = { all, scope, inScope: new Set(scope.map(page => page.number)) };
  const byNumber = new Map(scope.map(page => [page.number, page]));
  const marked = (hit: Hit) => hit.page >= markStart && hit.page <= markEnd;

  let region: Hit[] = [];
  if (chunkText) {
    const found = inOrder(splitSentences(chunkText).flatMap(sentence => locatePiece(sentence, search)));
    // A cited chunk sits in its own page range almost whole. A few unique
    // lines that cover little of it are coincidences (repeated boilerplate, a
    // range that does not hold the chunk), so nothing is marked, focus included.
    const covered = found.reduce((sum, hit) => sum + hit.end - hit.start, 0);
    if (covered < MIN_CHUNK_COVERAGE * canonicalize(chunkText).text.length) return NO_EVIDENCE;
    const located = found.filter(marked);
    const chars = located.reduce((sum, hit) => sum + hit.end - hit.start, 0);
    if (located.length >= REGION_MIN_PIECES || chars >= REGION_MIN_CHARS) region = mergeAdjacent(located, byNumber);
  }

  let emphasis: Hit[] = [];
  const quote = focus ? canonicalize(focus).text : '';
  if (quote.length >= minPiece(quote)) {
    if (region.length) {
      const direct = findAll(scope, quote, Infinity).filter(hit => inside(hit, region));
      if (direct.length === 1) emphasis = direct;
      else if (!direct.length) {
        const split = splitAtPageStart(quote, search)?.hits;
        if (split && split.every(hit => inside(hit, region))) emphasis = split;
      }
    } else {
      const hits = locatePiece(focus!, search, false);
      if (hits.length && hits.every(marked)) emphasis = hits;
    }
  }

  if (!region.length && !emphasis.length) return NO_EVIDENCE;
  const ranges: TextEvidenceRange[] = [];
  if (!region.length) {
    for (const hit of emphasis) ranges.push(toRaw(byNumber.get(hit.page)!, hit.start, hit.end, true));
  } else {
    for (const span of region) {
      const page = byNumber.get(span.page)!;
      let cursor = span.start;
      for (const hit of emphasis.filter(e => e.page === span.page && span.start <= e.start && e.end <= span.end)) {
        if (hit.start > cursor) ranges.push(toRaw(page, cursor, hit.start, false));
        ranges.push(toRaw(page, hit.start, hit.end, true));
        cursor = hit.end;
      }
      if (cursor < span.end) ranges.push(toRaw(page, cursor, span.end, false));
    }
  }
  // Raw pieces never start or end on whitespace (canonical spaces map to it).
  const trimmed = ranges.map(range => {
    const text = byNumber.get(range.page)!.raw;
    let { start, end } = range;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    return { ...range, start, end };
  }).filter(range => range.end > range.start);
  if (!trimmed.length) return NO_EVIDENCE;
  const anchor = trimmed.find(range => range.emphasis) || trimmed[0];
  return { kind: emphasis.length ? 'exact' : 'region', ranges: trimmed, anchor: { page: anchor.page, start: anchor.start } };
}
