import { SKIP, visit } from 'unist-util-visit';
import type { ElementContent, Root } from 'hast';
import { canonicalize } from './pdfEvidence';

/**
 * Rehype plugin: wraps source ranges of the rendered Markdown in
 * `<mark data-dt-evidence="region|exact">`. Ranges are offsets into the exact
 * string given to react-markdown; hast text nodes keep their source position
 * (mdast-util-to-hast copies it), so a range maps onto the text it covers no
 * matter how the Markdown renders (table cells, list items, emphasis).
 *
 * A node whose value is not its source slice (escapes, entities, stripped
 * indentation, inline-code backticks) is aligned character by character;
 * failing that, the range text is searched in the value; failing that, the
 * whole node is marked as a region. Syntax characters are never marked, and
 * fenced code (no position) is left alone.
 */

export type MarkKind = 'exact' | 'region';
export interface MarkRange { start: number; end: number; kind: MarkKind; anchor?: boolean }
export interface MarkRangesOptions { ranges: readonly MarkRange[]; source: string }

interface Piece { from: number; to: number; kind: MarkKind; anchor: boolean }

const MAX_SKIP = 12;

/** value index → source-slice index, as a greedy in-order alignment. */
function align(value: string, slice: string): number[] | null {
  const map: number[] = [];
  let j = 0;
  for (let i = 0; i < value.length; i++) {
    let skipped = 0;
    while (j < slice.length && slice[j] !== value[i]) {
      if (++skipped > MAX_SKIP) return null;
      j++;
    }
    if (j >= slice.length) return null;
    map.push(j++);
  }
  return map;
}

function searchCanonical(value: string, needle: string): [number, number] | null {
  const query = canonicalize(needle).text;
  if (!query) return null;
  const haystack = canonicalize(value);
  const index = haystack.text.indexOf(query);
  if (index < 0 || haystack.text.indexOf(query, index + 1) >= 0) return null;
  return [haystack.offsets[index].start, haystack.offsets[index + query.length - 1].end];
}

function piecesFor(value: string, nodeStart: number, nodeEnd: number, ranges: readonly MarkRange[], source: string): Piece[] {
  const slice = source.slice(nodeStart, nodeEnd);
  const map = slice === value ? null : align(value, slice);
  const pieces: Piece[] = [];
  for (const range of ranges) {
    const start = Math.max(range.start, nodeStart) - nodeStart;
    const end = Math.min(range.end, nodeEnd) - nodeStart;
    if (end <= start) continue;
    let from: number;
    let to: number;
    if (slice === value) {
      from = start; to = end;
    } else if (map) {
      from = map.findIndex(index => index >= start);
      to = map.findLastIndex(index => index < end) + 1;
      if (from < 0 || to <= from) continue;
    } else {
      const found = searchCanonical(value, slice.slice(start, end));
      if (!found) return [{ from: 0, to: value.length, kind: 'region', anchor: ranges.some(r => r.anchor) }];
      [from, to] = found;
    }
    const last = pieces.at(-1);
    if (last && from < last.to) from = last.to;
    if (to > from) pieces.push({ from, to, kind: range.kind, anchor: Boolean(range.anchor) });
  }
  return pieces;
}

export function rehypeMarkRanges(options: MarkRangesOptions) {
  const ranges = [...options.ranges].sort((a, b) => a.start - b.start);
  return (tree: Root) => {
    if (!ranges.length) return;
    let anchored = false;
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start == null || end == null || end <= start) return;
      const hits = ranges.filter(range => range.start < end && range.end > start);
      if (!hits.length) return;
      const pieces = piecesFor(node.value, start, end, hits, options.source);
      if (!pieces.length) return;
      const children: ElementContent[] = [];
      let cursor = 0;
      for (const piece of pieces) {
        if (piece.from > cursor) children.push({ type: 'text', value: node.value.slice(cursor, piece.from) });
        const anchor = piece.anchor && !anchored;
        if (anchor) anchored = true;
        children.push({
          type: 'element',
          tagName: 'mark',
          properties: anchor ? { dataDtEvidence: piece.kind, dataDtEvidenceAnchor: 'true' } : { dataDtEvidence: piece.kind },
          children: [{ type: 'text', value: node.value.slice(piece.from, piece.to) }],
        });
        cursor = piece.to;
      }
      if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) });
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
  };
}
