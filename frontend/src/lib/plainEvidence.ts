import type { MarkKind, MarkRange } from './rehypeMarkRanges';

/**
 * Plain-text pages (TXT) show their stored text as written: `#`, `*`, `&amp;`
 * and HTML are characters, never syntax. Evidence ranges are offsets into that
 * same text, so they map one to one; this splits a page into the runs the
 * viewer renders: evidence marks (one per range, flat) and, inside or between
 * them, search matches. Concatenating every part gives back the page text.
 */
export interface PlainPart { text: string; search: 'match' | 'active' | null }
export interface PlainSegment { mark: { kind: MarkKind; anchor: boolean } | null; parts: PlainPart[] }

export interface PlainSearch { starts: readonly number[]; length: number; active: number | null }

const NO_SEARCH: PlainSearch = { starts: [], length: 0, active: null };

export function plainEvidenceSegments(text: string, marks: readonly MarkRange[], search: PlainSearch = NO_SEARCH): PlainSegment[] {
  // Clamped, sorted and never overlapping (a later overlapping range is dropped).
  const ranges: MarkRange[] = [];
  for (const range of [...marks].sort((a, b) => a.start - b.start)) {
    const start = Math.max(0, range.start);
    const end = Math.min(text.length, range.end);
    if (end <= start || (ranges.length && start < ranges[ranges.length - 1].end)) continue;
    ranges.push({ ...range, start, end });
  }
  const matches = search.length > 0
    ? [...search.starts].sort((a, b) => a - b).map(start => ({ start, end: Math.min(text.length, start + search.length), active: start === search.active }))
    : [];
  const partsOf = (from: number, to: number): PlainPart[] => {
    const parts: PlainPart[] = [];
    let cursor = from;
    for (const match of matches) {
      if (match.end <= cursor || match.start >= to) continue;
      const start = Math.max(cursor, match.start);
      const end = Math.min(to, match.end);
      if (start > cursor) parts.push({ text: text.slice(cursor, start), search: null });
      parts.push({ text: text.slice(start, end), search: match.active ? 'active' : 'match' });
      cursor = end;
    }
    if (cursor < to) parts.push({ text: text.slice(cursor, to), search: null });
    return parts;
  };
  const segments: PlainSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) segments.push({ mark: null, parts: partsOf(cursor, range.start) });
    segments.push({ mark: { kind: range.kind, anchor: Boolean(range.anchor) }, parts: partsOf(range.start, range.end) });
    cursor = range.end;
  }
  if (cursor < text.length || !segments.length) segments.push({ mark: null, parts: partsOf(cursor, text.length) });
  return segments;
}
