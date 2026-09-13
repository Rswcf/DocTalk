import type { NormalizedBBox } from '../types';

export type EvidenceKind = 'exact' | 'region' | 'page';
export interface EvidenceRun { text: string; box: NormalizedBBox; }
export interface TextPoint { run: number; offset: number; }
export interface EvidenceRange { start: TextPoint; end: TextPoint; }

export function validEvidenceBox(box: NormalizedBBox): boolean {
  return [box.x, box.y, box.w, box.h].every(Number.isFinite)
    && box.x >= 0 && box.y >= 0 && box.w > 0 && box.h >= 0
    && box.x + box.w <= 1.01 && box.y + box.h <= 1.01
    && !(box.x === 0 && box.y === 0 && box.w === 1 && box.h === 1);
}

export function evidenceOverlap(a: NormalizedBBox, b: NormalizedBBox): boolean {
  const tolerance = 0.006;
  return a.x < b.x + b.w + tolerance && a.x + a.w > b.x - tolerance
    && a.y < b.y + Math.max(b.h, 0.01) + tolerance && a.y + a.h > b.y - tolerance;
}

// Preserve punctuation and word boundaries. Only normalize typographical
// equivalents, whitespace, ligatures and explicit line-end hyphenation.
function canonicalize(text: string) {
  let normalized = '';
  const offsets: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const end = i + char.length;
    if (char === '\u00ad') { i = end; continue; }
    const wrap = /^[-\u2010]\s*\n\s*(?=[a-z])/.exec(text.slice(i));
    if (wrap && /[a-z]$/i.test(text.slice(0, i))) { i += wrap[0].length; continue; }
    const value = char.normalize('NFKC').toLowerCase()
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
    if (/\s/u.test(value)) {
      if (normalized && !normalized.endsWith(' ')) {
        normalized += ' '; offsets.push({ start: i, end });
      }
    } else {
      for (let j = 0; j < value.length; j++) {
        normalized += value[j]; offsets.push({ start: i, end });
      }
    }
    i = end;
  }
  if (normalized.endsWith(' ')) { normalized = normalized.slice(0, -1); offsets.pop(); }
  return { text: normalized, offsets };
}

/** A full, unique quote inside the cited region. Short fragments never win
 * merely because they occur somewhere inside the requested sentence. */
export function findEvidenceRange(runs: EvidenceRun[], quote: string, regions: NormalizedBBox[]): EvidenceRange | null {
  const needle = canonicalize(quote).text;
  if (!needle || needle.length > 12000) return null;
  let raw = '';
  const positions: Array<TextPoint | null> = [];
  runs.forEach((run, index) => {
    const previous = runs[index - 1];
    if (previous && raw && run.text) {
      const sameLine = Math.abs(previous.box.y - run.box.y) < Math.min(previous.box.h, run.box.h) * 0.45;
      const gap = Math.max(run.box.x - previous.box.x - previous.box.w,
        previous.box.x - run.box.x - run.box.w);
      const separator = sameLine ? (gap > Math.min(previous.box.h, run.box.h) * 0.18 ? ' ' : '') : '\n';
      if (separator) { raw += separator; positions.push(null); }
    }
    for (let offset = 0; offset < run.text.length; offset++) {
      raw += run.text[offset]; positions.push({ run: index, offset });
    }
  });
  const haystack = canonicalize(raw);
  const candidates: EvidenceRange[] = [];
  for (let from = 0; from < haystack.text.length;) {
    const index = haystack.text.indexOf(needle, from);
    if (index < 0) break;
    from = index + 1;
    const before = haystack.text[index - 1] || '';
    const after = haystack.text[index + needle.length] || '';
    if ((/[\p{L}\p{N}]/u.test(needle[0]) && /[\p{L}\p{N}]/u.test(before))
      || (/[\p{L}\p{N}]/u.test(needle.at(-1)!) && /[\p{L}\p{N}]/u.test(after))) continue;
    const start = positions[haystack.offsets[index].start];
    const last = positions[haystack.offsets[index + needle.length - 1].end - 1];
    if (!start || !last) continue;
    const covered = runs.slice(start.run, last.run + 1).filter(run => run.text.trim());
    if (regions.length && covered.some(run => !regions.some(region => evidenceOverlap(run.box, region)))) continue;
    candidates.push({ start, end: { run: last.run, offset: last.offset + 1 } });
    if (candidates.length > 1) return null; // Repeated text must not appear precise.
  }
  return candidates[0] || null;
}

export function mergeEvidenceLines(rects: NormalizedBBox[]): NormalizedBBox[] {
  const output: NormalizedBBox[] = [];
  for (const rect of [...rects].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (!validEvidenceBox(rect) || rect.h <= 0) continue;
    const same = output.find(line => Math.abs(line.y - rect.y) <= Math.min(line.h, rect.h) * 0.25
      && Math.abs(line.h - rect.h) <= Math.max(line.h, rect.h) * 0.35
      && rect.x <= line.x + line.w + Math.min(line.h, rect.h) * 0.4
      && rect.x + rect.w >= line.x - Math.min(line.h, rect.h) * 0.4);
    if (same) {
      const right = Math.max(same.x + same.w, rect.x + rect.w);
      same.x = Math.min(same.x, rect.x); same.w = right - same.x;
      same.h = Math.max(same.y + same.h, rect.y + rect.h) - Math.min(same.y, rect.y);
      same.y = Math.min(same.y, rect.y);
    } else output.push({ ...rect });
  }
  return output;
}

export function groupEvidenceRegions(boxes: NormalizedBBox[]): NormalizedBBox[] {
  const groups: NormalizedBBox[] = [];
  for (const box of boxes.filter(validEvidenceBox).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const current = { ...box, h: Math.max(box.h, 0.01) };
    const group = groups.find(g => current.y <= g.y + g.h + 0.025
      && Math.min(g.x + g.w, current.x + current.w) - Math.max(g.x, current.x) > Math.min(g.w, current.w) * 0.25);
    if (!group) { groups.push(current); continue; }
    const right = Math.max(group.x + group.w, current.x + current.w);
    group.x = Math.min(group.x, current.x); group.w = right - group.x;
    group.h = Math.max(group.y + group.h, current.y + current.h) - group.y;
  }
  return groups;
}

/** Coarse visual ranges belong in the outer margin, including table columns.
 * Keep these display-only unions separate from the regions used for matching. */
export function groupEvidenceMargins(regions: NormalizedBBox[]): NormalizedBBox[] {
  const margins: NormalizedBBox[] = [];
  for (const region of [...regions].sort((a, b) => a.y - b.y)) {
    const previous = margins.at(-1);
    if (!previous || region.y > previous.y + previous.h + 0.025) {
      margins.push({ ...region });
      continue;
    }
    const right = Math.max(previous.x + previous.w, region.x + region.w);
    previous.x = Math.min(previous.x, region.x);
    previous.w = right - previous.x;
    previous.h = Math.max(previous.y + previous.h, region.y + region.h) - previous.y;
  }
  return margins;
}
