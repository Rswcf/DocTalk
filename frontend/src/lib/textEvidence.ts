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
 * Both are split at a page start. A unique match confirms the split, and a
 * glued title is dropped only when it matches the page's known title.
 *
 * The rule is the PDF rule: never highlight the wrong passage. Every located
 * piece is unique in the whole document and on a page the chunk may sit on;
 * ambiguous or short pieces are dropped, never bridged; with too little
 * located, the result is `page`.
 */

export type TextEvidenceKind = 'exact' | 'region' | 'page';
/** `section_title` as GET /text-content serves it (null when the page's
 * title block was glued into the chunk text instead of read as a heading). */
export interface TextEvidencePage { page_number: number; text: string; section_title?: string | null }
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
// Share of the chunk's canonical text that must be located in its page range.
// On generated DOCX/PPTX/XLSX/MD/URL fixture corpora (not production
// citations) every chunk located >= 0.65; the same chunks cited on pages that
// do not hold them located <= 0.07.
const MIN_CHUNK_COVERAGE = 0.3;
// Longest glued title dropped without verification (canonical characters).
const GLUED_TITLE_MAX = 120;

interface PageIndex {
  number: number; raw: string; title: string | null | undefined;
  canon: string; offsets: Array<{ start: number; end: number }>;
  /** Canonical texts this page's glued title may have (see pageTitles). */
  titles: string[];
}
/** Canonical offsets within one page. */
interface Hit { page: number; start: number; end: number }
/** `all`: every page of the document, for uniqueness (`pages` holds them by
 * number). `scope`: the pages the chunk may sit on (the whole document
 * when its range is unknown), for page-start/page-end structure and chunk
 * coverage. */
interface Search { all: PageIndex[]; scope: PageIndex[]; inScope: Set<number>; pages: Map<number, PageIndex> }

// Canonical page text, kept per page object: the reader passes the same page
// objects on every citation click, and every click searches all pages.
const pageIndexCache = new WeakMap<TextEvidencePage, PageIndex>();
function indexPage(page: TextEvidencePage): PageIndex {
  const cached = pageIndexCache.get(page);
  if (cached && cached.raw === page.text && cached.number === page.page_number && cached.title === page.section_title) return cached;
  const canon = canonicalize(page.text);
  const index = {
    number: page.page_number, raw: page.text, title: page.section_title,
    canon: canon.text, offsets: canon.offsets, titles: pageTitles(page),
  };
  pageIndexCache.set(page, index);
  return index;
}

/**
 * The texts a page's title block can have, from trusted sources only. The
 * parse worker emits each extractor page as an 18pt title block plus a body
 * block; when the title is not read as a heading it is glued, as its own
 * sentence, in front of the page's first sentence in the chunk text.
 * - `section_title`, when the API serves one for the page.
 * - The page's first line without Markdown heading marks: a PPTX slide title
 *   stays in the slide text, and a URL page starts with its `# heading` block.
 * DOCX headings, Markdown headings and XLSX sheet names are not in the page
 * text, and /text-content serves no title for them when they were glued, so
 * their glued titles cannot be verified here. Such a title is dropped only
 * where page text brackets it: right after the located literal end of the
 * page before and right before the located start of its page, at most
 * GLUED_TITLE_MAX characters, and never the whole text of a page (see
 * matchPageEnd, splitAtPageStart). Other
 * unverified text in front of a page start may be real content that changes
 * what the page sentence means ("The court rejected" + the page's claim at
 * the chunk start), so it is never dropped.
 */
function pageTitles(page: TextEvidencePage): string[] {
  const titles = new Set<string>();
  const first = page.text.split('\n').find(line => line.trim());
  for (const title of [page.section_title, first?.replace(/^\s*#{1,6}\s+/, '')]) {
    if (!title?.trim()) continue;
    // The chunker splits the title block into sentences and rejoins them
    // (no space beside CJK: "1. 系统总览" becomes "1.系统总览"). A title with a
    // kept sentence break ("2. Results") is two pieces here; only its last
    // sentences sit in front of the page start.
    const canon = canonicalize(joinUnits(splitSentences(title))).text;
    titles.add(canon);
    for (let i = 0; i < canon.length - 1; i++) {
      if (!DELIMS.includes(canon[i]) || ('.?!'.includes(canon[i]) && !/\s/.test(canon[i + 1]))) continue;
      const rest = canon.slice(i + 1).trim();
      if (rest) titles.add(rest);
    }
  }
  return [...titles];
}

// parse_service._is_cjk_context and _join_text_units: how chunk sentences are rejoined.
const CJK_CONTEXT = /[\u4e00-\u9fff\u3040-\u30ff\u3000-\u303f\uff00-\uffef]/;
function joinUnits(units: string[]): string {
  let text = '';
  for (const unit of units) {
    const part = unit.trim();
    if (!part) continue;
    const previous = text.at(-1);
    const space = previous !== undefined && !' \n([{'.includes(previous) && !' \n,.;:!?)]}。！？；，、'.includes(part[0])
      && !CJK_CONTEXT.test(previous) && !CJK_CONTEXT.test(part[0]);
    text += (space ? ' ' : '') + part;
  }
  return text;
}

/** True when `text` (canonical) can stand in front of the start of `opens`
 * in a chunk without being located itself: the glued title of `opens`
 * (verified, see pageTitles), the literal end of the page before it (too
 * short or too common to be located on its own), or that end followed by the
 * title. The end is a proper end: a page's whole text is that page, and
 * dropping it would carry the region over a page that was never located.
 * Nothing else is dropped. */
function explainsGap(text: string, opens: PageIndex, search: Search): boolean {
  if (!text) return true;
  const previous = search.pages.get(opens.number - 1);
  const endsPrevious = (end: string) => !end || Boolean(previous && end.length < previous.canon.length
    && previous.canon.endsWith(end) && boundaryOk(previous.canon, previous.canon.length - end.length, end));
  if (endsPrevious(text)) return true;
  return opens.titles.some(title => {
    const cut = text.length - title.length;
    return text === title || (cut > 0 && text.endsWith(title) && cutsAt(text, cut) && endsPrevious(text.slice(0, cut).trimEnd()));
  });
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

/** `text` ends with the end of `page`, possibly followed by the glued title
 * of `next` (the page after it). A verified title (see pageTitles) is always
 * dropped. With `bracketed` (what follows `text` in the chunk is located and
 * opens `next` at its first character), any glued title is dropped: a short
 * run of text between the literal end of `page` and the start of `next` is, by how
 * the chunker joins page blocks, the title block of `next`, never page text
 * (DOCX/MD headings and XLSX sheet names are in no page text at all).
 * Returns the page hit and where the match starts in `text`; the match must
 * be unique. */
function matchPageEnd(text: string, page: PageIndex, next: PageIndex, search: Search, bracketed: boolean): { hit: Hit; start: number } | null {
  const canon = page.canon.trimEnd();
  const cuts = [text.length];
  for (const title of next.titles) {
    const cut = text.length - title.length;
    if (cut > 0 && text.endsWith(title) && cutsAt(text, cut)) cuts.push(cut);
  }
  if (bracketed) {
    const last = canon.at(-1);
    for (let cut = text.length - 1; cut > 0 && text.length - cut <= GLUED_TITLE_MAX; cut--) {
      if (text[cut] === ' ' || !cutsAt(text, cut) || cuts.includes(cut)) continue;
      if (text.slice(0, cut).trimEnd().at(-1) === last && !wholePage(text.slice(cut), search)) cuts.push(cut);
    }
  }
  for (const j of cuts) {
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
 * unmatched beginning of `text`. `glued`: an unverified glued title may be
 * dropped where it is bracketed (see matchPageEnd); the text after `text`
 * opens page `number + 1`. */
function peelPageEnds(text: string, search: Search, last: number, number: number, glued: boolean) {
  const pages = search.scope;
  const hits: Hit[] = [];
  let rest = text;
  for (let q = last; q >= 0 && pages[q].number === number - (last - q) && rest; q--) {
    const opensNext = !hits.length || hits[0].start === 0;
    const match = matchPageEnd(rest, pages[q], pages[q + 1], search, glued && opensNext);
    if (!match) break;
    hits.unshift(match.hit);
    rest = rest.slice(0, match.start).trimEnd();
  }
  return { hits, rest };
}

/** How a piece is located. `glued`: an unverified glued title may be dropped
 * where page text brackets it (chunk pieces only, never a focus: an exact
 * claim needs verified structure). `afterEnd`: the number of the page whose
 * literal end the previous piece of the chunk was located through, if any. */
interface PieceOptions { byLine: boolean; glued: boolean; afterEnd: number | null }
const FOCUS_PIECE: PieceOptions = { byLine: false, glued: false, afterEnd: null };

/** As short as a title block (canonical text has no line breaks to test). */
function gluedTitle(text: string): boolean {
  return text.length <= GLUED_TITLE_MAX;
}

/** Text that is the whole of a page is that page, never an unverified title
 * dropped between two others. */
function wholePage(text: string, search: Search): boolean {
  return search.all.some(page => page.canon === text);
}

/** A piece that is not in the page text as a whole: the tail of it may open a
 * page (title glued on, or the previous page's undelimited end glued on). The
 * tail must start that page and be unique. The head is matched against the
 * ends of the pages before (a glued title may sit between them; see
 * matchPageEnd); what is left must be explained (see explainsGap), or, for a
 * chunk piece, be title-short and right after the previous piece's located
 * end of the page before (`afterEnd`), else the split is refused. Unverified
 * text with no located page end in front of it (the chunk's first piece, "The
 * court rejected" + a page's claim) is never dropped. A tail shorter than
 * minRemainder needs a page end peeled in front of it. Every match is
 * unique in the whole document, so a match on a page before the tail's page
 * is the chunk's own text. */
function splitAtPageStart(piece: string, search: Search, options: PieceOptions = FOCUS_PIECE): Hit[] | null {
  const pages = search.scope;
  const last = piece.length - minPiece(piece);
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (!page.canon) continue;
    for (let k = 1; k <= last; k++) {
      if (piece[k] !== page.canon[0] || !cutsAt(piece, k)) continue;
      const tail = piece.slice(k);
      if (!page.canon.startsWith(tail) || !boundaryOk(page.canon, 0, tail)) continue;
      if (findAll(search.all, tail).length !== 1) return null;
      const before = piece.slice(0, k).trimEnd();
      const head = p > 0 ? peelPageEnds(before, search, p - 1, page.number - 1, options.glued) : { hits: [], rest: before };
      if (tail.length < minRemainder(piece) && !head.hits.length) continue;
      // The leftover precedes the earliest located text, which must then open
      // its page; see explainsGap for what the leftover may be.
      const first = head.hits[0];
      const opens = first ? (first.start === 0 ? search.pages.get(first.page) : undefined) : page;
      const afterPrevious = options.glued && opens !== undefined && options.afterEnd === opens.number - 1
        && gluedTitle(head.rest) && !wholePage(head.rest, search);
      if (head.rest && !(opens && (explainsGap(head.rest, opens, search) || afterPrevious))) return null;
      return [...head.hits, { page: page.number, start: 0, end: tail.length }];
    }
  }
  return null;
}

/** Hits of a located piece, and the page whose literal end the piece was
 *  located through (its last hit covers its last character and ends that
 *  page), for the next piece's glued title. */
interface Located { hits: Hit[]; endsAt: number | null }

function endsPage(hit: Hit | undefined, search: Search): number | null {
  if (!hit) return null;
  return hit.end === search.pages.get(hit.page)!.canon.trimEnd().length ? hit.page : null;
}

/** Unique hits for one sentence: whole, else split at a page start, else (for
 * multi-line sentences such as table rows) line by line. */
function locatePiece(raw: string, search: Search, options: PieceOptions = FOCUS_PIECE): Located {
  const canon = canonicalize(raw);
  const piece = canon.text;
  if (piece.length < minPiece(piece)) return { hits: [], endsAt: null };
  const hits = findAll(search.all, piece);
  // Unique in the document, and on a page the chunk may sit on.
  if (hits.length === 1) {
    return search.inScope.has(hits[0].page) ? { hits, endsAt: endsPage(hits[0], search) } : { hits: [], endsAt: null };
  }
  if (hits.length > 1) return { hits: [], endsAt: null };
  const split = splitAtPageStart(piece, search, options);
  if (split) return { hits: split, endsAt: endsPage(split.at(-1), search) };
  return options.byLine ? locateLines(raw, search, options) : { hits: [], endsAt: null };
}

function locateLines(raw: string, search: Search, options: PieceOptions): Located {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return { hits: [], endsAt: null };
  const hits: Hit[] = [];
  let afterEnd = options.afterEnd;
  for (const line of lines) {
    const located = locatePiece(line, search, { ...options, byLine: false, afterEnd });
    hits.push(...located.hits);
    afterEnd = located.endsAt;
  }
  // The last line's own end: null when it was not located.
  return { hits, endsAt: afterEnd };
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

/** The unspaced-script exemption in boundaryOk lets a match begin or end
 * beside a letter, because chunk sentences are rejoined without spaces there.
 * Inside a located chunk region that is harmless: the region confines it. A
 * focus located on its own has nothing to confine it, and a fragment can sit
 * inside a longer, unrelated unspaced run ("合同有效期限" in "本合同有效期限
 * 届满后…", "AI合同有效期限" in "本AI合同…"). So where the focus begins or
 * ends with a letter or digit, the page must have a non-letter there
 * (punctuation, a space, a line or page edge), whatever the script on either
 * side: the boundary rule of the PDF text-layer matcher
 * (pdfEvidence.findEvidenceRange). */
function standsAlone(hits: Hit[], pages: Map<number, PageIndex>): boolean {
  const first = hits[0];
  const last = hits[hits.length - 1];
  const opening = pages.get(first.page)!.canon;
  const closing = pages.get(last.page)!.canon;
  return !(WORD.test(charAt(opening, first.start)) && WORD.test(charBefore(opening, first.start)))
    && !(WORD.test(charBefore(closing, last.end)) && WORD.test(charAt(closing, last.end)));
}

function inside(hit: Hit, spans: Hit[]): boolean {
  return spans.some(span => span.page === hit.page && span.start <= hit.start && hit.end <= span.end);
}

/** Whether a focus hit outside the region is the chunk's own occurrence of
 * `quote`. A unique match on the page is not enough: the chunk may hold the
 * words only as a glued heading that a phrase elsewhere on the page repeats
 * (Codex r4 #1). So the hit must touch no region span, the quote must occur
 * once in the chunk, and the page and the chunk must both put it right next to
 * the same located piece: on the page with only whitespace between, in the
 * chunk with nothing between. */
function besideRegion(hit: Hit, quote: string, chunk: string, pieces: Hit[], region: Hit[], pages: Map<number, PageIndex>): boolean {
  if (region.some(span => span.page === hit.page && hit.start < span.end && span.start < hit.end)) return false;
  const text = canonicalize(chunk).text;
  const at: number[] = [];
  for (let from = 0; ;) {
    const index = text.indexOf(quote, from);
    if (index < 0) break;
    from = index + 1;
    if (boundaryOk(text, index, quote)) at.push(index);
  }
  if (at.length !== 1) return false;
  const after = text.slice(at[0] + quote.length).replace(/^ /, '');
  const before = text.slice(0, at[0]).replace(/ $/, '');
  const canon = pages.get(hit.page)!.canon;
  return pieces.some(piece => {
    if (piece.page !== hit.page) return false;
    const own = canon.slice(piece.start, piece.end);
    if (piece.start >= hit.end && !canon.slice(hit.end, piece.start).trim()) return after.startsWith(own);
    if (piece.end <= hit.start && !canon.slice(piece.end, hit.start).trim()) return before.endsWith(own);
    return false;
  });
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
 *                   unique inside the located chunk, or right beside it (see
 *                   besideRegion), or, with no chunk, unique in the document
 *                   and on the cited pages
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
  const cited = all.filter(page => page.number >= scopeStart && page.number <= scopeEnd);
  if (!cited.length) return NO_EVIDENCE;
  // Without the chunk's own page range (Quote Finder cards and ?highlight=
  // links carry no context_text, and /api/chunks serves no page_end) the chunk
  // may run onto the pages around the cited one, so the whole document is its
  // scope and the coverage check counts all of it. Uniqueness is
  // document-wide either way, so a unique match on a cited page is still the
  // chunk's own text; marks stay on the cited pages. The focus keeps the
  // cited scope.
  const pageMap = new Map(all.map(page => [page.number, page]));
  const searchOf = (scope: PageIndex[]): Search => ({ all, scope, inScope: new Set(scope.map(page => page.number)), pages: pageMap });
  const focusSearch = searchOf(cited);
  const search = chunkRange ? focusSearch : searchOf(all);
  const byNumber = new Map(search.scope.map(page => [page.number, page]));
  const marked = (hit: Hit) => hit.page >= markStart && hit.page <= markEnd;

  let region: Hit[] = [];
  // The region's located pieces before merging, in chunk order.
  let regionPieces: Hit[] = [];
  if (chunkText) {
    const pieces: Hit[] = [];
    let afterEnd: number | null = null;
    for (const sentence of splitSentences(chunkText)) {
      const located = locatePiece(sentence, search, { byLine: true, glued: true, afterEnd });
      pieces.push(...located.hits);
      afterEnd = located.endsAt;
    }
    const found = inOrder(pieces);
    // A cited chunk sits in its own page range almost whole. A few unique
    // lines that cover little of it are coincidences (repeated boilerplate, a
    // range that does not hold the chunk), so nothing is marked, focus included.
    const covered = found.reduce((sum, hit) => sum + hit.end - hit.start, 0);
    if (covered < MIN_CHUNK_COVERAGE * canonicalize(chunkText).text.length) return NO_EVIDENCE;
    const located = found.filter(marked);
    const chars = located.reduce((sum, hit) => sum + hit.end - hit.start, 0);
    if (located.length >= REGION_MIN_PIECES || chars >= REGION_MIN_CHARS) {
      regionPieces = located;
      region = mergeAdjacent(located, byNumber);
    }
  }

  let emphasis: Hit[] = [];
  const quote = focus ? canonicalize(focus).text : '';
  // The rule for a focus without a region: unique in the document, on the
  // cited pages, a whole word at each lettered edge.
  const alone = (): Hit[] => {
    const { hits } = locatePiece(focus!, focusSearch);
    return hits.length && hits.every(marked) && standsAlone(hits, search.pages) ? hits : [];
  };
  if (quote.length >= minPiece(quote)) {
    if (region.length) {
      const direct = findAll(focusSearch.scope, quote, Infinity).filter(hit => inside(hit, region));
      if (direct.length === 1) emphasis = direct;
      else if (!direct.length) {
        const split = splitAtPageStart(quote, focusSearch);
        if (split && split.every(hit => inside(hit, region))) emphasis = split;
        // A focus the region does not hold, because its sentence was not
        // located (a Quote Finder quote glued to the chunk's first heading),
        // follows the rule without a region, in one piece, and must be the
        // chunk's own occurrence (see besideRegion).
        else {
          const hits = alone();
          if (hits.length === 1 && besideRegion(hits[0], quote, chunkText!, regionPieces, region, search.pages)) emphasis = hits;
        }
      }
    } else emphasis = alone();
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
    for (const hit of emphasis) if (!inside(hit, region)) ranges.push(toRaw(byNumber.get(hit.page)!, hit.start, hit.end, true));
    ranges.sort((a, b) => a.page - b.page || a.start - b.start);
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
