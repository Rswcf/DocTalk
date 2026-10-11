import { SKIP, visit } from 'unist-util-visit';
import { decodeString } from 'micromark-util-decode-string';
import type { Element, ElementContent, Parents, Root, Text } from 'hast';
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
 * failing that, the range text, decoded the way micromark decoded the node
 * (backslash escapes and character references; code text is not decoded), is
 * searched in the value and must occur there once; failing that, the range
 * renders no mark in that node. A node is never marked wider than its range:
 * a mark is a claim that its text is the cited passage. Syntax characters are
 * never marked. Code-block text has no position of its own: it maps through
 * its `code` element after the opening fence line. When the anchor range
 * itself renders no mark, the first mark of the tree carries the anchor.
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

/** Character references and backslash escapes, as micromark decodes them. */
const REFERENCE = /&(?:#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{0,31});|\\[!-/:-@[-`{-~]/g;

/** True when `at` falls strictly inside a reference or escape of `slice`:
 *  a range cut there has no rendered counterpart. */
function cutsReference(slice: string, at: number): boolean {
  for (const match of slice.matchAll(REFERENCE)) {
    if (match.index >= at) return false;
    if (at < match.index + match[0].length) return true;
  }
  return false;
}

interface Span { start: number; end: number; code: boolean }

const FENCE_LINE = /^[ \t]*(?:`{3,}|~{3,})[^\n]*\n?/;

/** Source span of a text node. Fenced and indented code text carries no
 *  position; its `code` element spans the whole block, fences included. */
function textSpan(node: Text, parent: Parents, source: string): Span | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start != null && end != null) return end > start ? { start, end, code: false } : null;
  if (parent.type !== 'element' || parent.tagName !== 'code' || parent.children.length !== 1) return null;
  const blockStart = parent.position?.start.offset;
  const blockEnd = parent.position?.end.offset;
  if (blockStart == null || blockEnd == null || blockEnd <= blockStart) return null;
  const fence = FENCE_LINE.exec(source.slice(blockStart, blockEnd));
  const contentStart = blockStart + (fence ? fence[0].length : 0);
  return contentStart < blockEnd ? { start: contentStart, end: blockEnd, code: true } : null;
}

function piecesFor(value: string, span: Span, ranges: readonly MarkRange[], source: string): Piece[] {
  const { start: nodeStart, end: nodeEnd } = span;
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
      // A long reference (&CounterClockwiseContourIntegral; renders as one
      // character) defeats the alignment; search the rendered form instead.
      if (!span.code && (cutsReference(slice, start) || cutsReference(slice, end))) continue;
      const source = slice.slice(start, end);
      const found = searchCanonical(value, span.code ? source : decodeString(source));
      if (!found) continue;
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
    const marks: Element[] = [];
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const span = textSpan(node, parent, options.source);
      if (!span) return;
      const hits = ranges.filter(range => range.start < span.end && range.end > span.start);
      if (!hits.length) return;
      const pieces = piecesFor(node.value, span, hits, options.source);
      if (!pieces.length) return;
      const children: ElementContent[] = [];
      let cursor = 0;
      for (const piece of pieces) {
        if (piece.from > cursor) children.push({ type: 'text', value: node.value.slice(cursor, piece.from) });
        const anchor = piece.anchor && !anchored;
        if (anchor) anchored = true;
        const mark: Element = {
          type: 'element',
          tagName: 'mark',
          properties: anchor ? { dataDtEvidence: piece.kind, dataDtEvidenceAnchor: 'true' } : { dataDtEvidence: piece.kind },
          children: [{ type: 'text', value: node.value.slice(piece.from, piece.to) }],
        };
        marks.push(mark);
        children.push(mark);
        cursor = piece.to;
      }
      if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) });
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
    if (!anchored && marks.length && ranges.some(range => range.anchor)) {
      marks[0].properties.dataDtEvidenceAnchor = 'true';
    }
  };
}
