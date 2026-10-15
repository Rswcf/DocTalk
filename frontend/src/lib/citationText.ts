import type { Citation } from '../types';

function codeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let fence: string | undefined;
  let offset = 0;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const content = line.replace(/^(?: {0,3}>[ \t]?)+/, '').replace(/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/, '');
    const run = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    if (fence) {
      ranges.push([offset, offset + line.length]);
      if (run && run[1][0] === fence[0] && run[1].length >= fence.length && !content.slice(run[0].length).trim()) fence = undefined;
    } else if (run) {
      fence = run[1];
      ranges.push([offset, offset + line.length]);
    } else if (/^( {4}|\t)/.test(content)) {
      ranges.push([offset, offset + line.length]);
    }
    offset += line.length;
  }
  let cursor = 0;
  for (const run of text.matchAll(/`+/g)) {
    if (run.index < cursor || ranges.some(([start, end]) => start <= run.index && run.index < end)) continue;
    const after = run.index + run[0].length;
    const close = new RegExp('(?<!`)' + run[0] + '(?!`)').exec(text.slice(after));
    if (close) {
      cursor = after + close.index + close[0].length;
      ranges.push([run.index, cursor]);
    }
  }
  return ranges;
}

// Offsets originate in Python and count Unicode codepoints, not UTF-16 units.
// This helper is shared by the reader, copy action and Markdown download.
export function insertCitationMarkers(
  text: string,
  citations: Citation[],
  marker: (citation: Citation) => string = (citation) => `[${citation.refIndex}]`,
): string {
  const points = Array.from(text);
  const edits: { start: number; end: number; citation: Citation }[] = [];
  const legacy = new Map<number, Citation>();
  const ambiguous = new Set<number>();
  for (const citation of citations) {
    if (!citation || !Number.isInteger(citation.refIndex) || citation.refIndex <= 0) continue;
    if (typeof citation.offset === 'number' && Number.isInteger(citation.offset) && citation.offset >= 0 && citation.offset <= points.length) {
      edits.push({ start: citation.offset, end: citation.offset, citation });
    } else if (!Object.hasOwn(citation, 'offset')) {
      const previous = legacy.get(citation.refIndex);
      if (previous && JSON.stringify(previous) !== JSON.stringify(citation)) ambiguous.add(citation.refIndex);
      legacy.set(citation.refIndex, citation);
    }
  }
  // Only offset-less legacy records may consume textual [n] markers. Preserve
  // code spans/blocks, links, escaped brackets and unrelated bracketed numbers.
  const tokens = /!?\[[^\]\n]*\]\([^\n)]*\)|(?<![\\!])\[(\d+)\](?!\()/g;
  const ranges = legacy.size ? codeRanges(text) : [];
  const linkLabels = new Set(Array.from(text.matchAll(/^ {0,3}\[([^\]\n]+)\]:/gm), (match) => match[1].trim().toLowerCase()));
  for (const match of text.matchAll(/!?\[([^\]\n]*)\]\s*\[([^\]\n]*)\]/g)) {
    if (linkLabels.has((match[2] || match[1]).trim().toLowerCase())) ranges.push([match.index, match.index + match[0].length]);
  }
  for (const match of legacy.size ? text.matchAll(tokens) : []) {
    if (ranges.some(([start, end]) => start <= match.index && match.index < end)) continue;
    const ref = Number(match[1]);
    const citation = legacy.get(ref);
    if (!match[1] || !citation || ambiguous.has(ref) || linkLabels.has(String(ref))) continue;
    const start = Array.from(text.slice(0, match.index)).length;
    edits.push({ start, end: start + match[0].length, citation });
  }
  edits.sort((a, b) => a.start - b.start);
  const pieces: string[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor) continue;
    const label = marker(edit.citation);
    const key = `${edit.start}:${citationSourceKey(edit.citation)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pieces.push(points.slice(cursor, edit.start).join(''), label);
    cursor = edit.end;
  }
  pieces.push(points.slice(cursor).join(''));
  return pieces.join('');
}

export function citationSourceKey(citation: Citation): string {
  // A text hit is its chunk: the snippet is that chunk's text, and its shape
  // changed in 0.36.2 (no "{section_title}: " prefix), so a continued answer
  // can cite one chunk in both shapes at one offset. Table and summary hits
  // share an anchor chunk with other sources and keep the snippet in the key;
  // a table id marks a table hit even where an older record has no modality.
  const textHit = Boolean(citation.chunkId) && !citation.tableId && (citation.retrievalModality ?? 'text') === 'text';
  return JSON.stringify([
    citation.refIndex, citation.documentId, citation.documentFilename, citation.chunkId,
    citation.page, citation.pageEnd, textHit ? null : citation.textSnippet,
  ]);
}

export function uniqueCitationIndexes(citations: Citation[]): Citation[] {
  const sources = new Map<string, number>();
  const owners = new Map<number, string>();
  let next = citations.reduce((max, c) => Number.isInteger(c.refIndex) ? Math.max(max, c.refIndex) : max, 0);
  for (const citation of citations) {
    if (!Object.hasOwn(citation, 'offset')) {
      const key = citationSourceKey(citation);
      sources.set(key, citation.refIndex);
      owners.set(citation.refIndex, key);
    }
  }
  return citations.map((citation) => {
    // Legacy textual references cannot disambiguate two sources with one ID.
    // Leave these to the placement helper's conservative legacy handling.
    if (!Number.isInteger(citation.offset)) return citation;
    const key = citationSourceKey(citation);
    let index = sources.get(key);
    if (index === undefined) {
      index = owners.has(citation.refIndex) && owners.get(citation.refIndex) !== key ? ++next : citation.refIndex;
      owners.set(index, key);
      sources.set(key, index);
    }
    return index === citation.refIndex ? citation : { ...citation, refIndex: index };
  });
}

// chat_service._citation_payload sends `context_text = "[page N] " + chunk.text`
// (or "[page N–M] "), cut at 900 Python code points. `text_snippet` is
// chunk.text cut at 100, too short to locate a chunk; citations stored before
// 0.36.2 begin with "{section_title}: ".
const CONTEXT_PAGE_PREFIX = /^\[page (\d+)(?:–(\d+))?\] /;
const CONTEXT_TEXT_LIMIT = 900;

export interface CitationChunkText {
  text: string;
  /** The backend cut the context at its limit: the tail may be a fragment. */
  truncated: boolean;
  /** The chunk's own page range (before any narrowing to one cited page). */
  pageStart?: number;
  pageEnd?: number;
}

/** The cited chunk's text as sent with a chat citation, or null when the
 * citation has no context text (Quote Finder cards, saved quotes and
 * `?highlight=` links carry a quote or the full chunk in `textSnippet`). */
export function citationChunkText(citation: Pick<Citation, 'contextText'>): CitationChunkText | null {
  const context = citation.contextText;
  if (typeof context !== 'string' || !context.trim()) return null;
  const prefix = CONTEXT_PAGE_PREFIX.exec(context);
  const truncated = Array.from(context).length >= CONTEXT_TEXT_LIMIT;
  const text = prefix ? context.slice(prefix[0].length) : context;
  if (!prefix) return { text, truncated };
  const pageStart = Number(prefix[1]);
  return { text, truncated, pageStart, pageEnd: prefix[2] ? Number(prefix[2]) : pageStart };
}

/** Text up to the last complete sentence or line, so a cut tail never reaches
 * an exact matcher that requires whole-word boundaries. */
export function dropTrailingFragment(text: string): string {
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (char === '\n' || '。！？；'.includes(char) || ('.!?'.includes(char) && /\s/.test(text[i + 1] ?? ''))) {
      return text.slice(0, i + 1).trimEnd();
    }
  }
  return '';
}

/** Whole-sentence passage for the converted-PDF text-layer matcher: the chunk
 * text without the page prefix or a cut tail; else the snippet as given. */
export function citationPassage(citation: Pick<Citation, 'contextText' | 'textSnippet'>): string | null {
  const chunk = citationChunkText(citation);
  if (chunk) return (chunk.truncated ? dropTrailingFragment(chunk.text) : chunk.text) || null;
  return citation.textSnippet || null;
}

/** Physical page range; never imply a precise page when attribution is broad. */
export function citationPageRange(citation: Pick<Citation, 'page' | 'pageEnd'>): string {
  const start = Number.isInteger(citation.page) && citation.page > 0 ? citation.page : 1;
  const end = citation.pageEnd;
  return end != null && Number.isInteger(end) && end > start ? `${start}–${end}` : String(start);
}
