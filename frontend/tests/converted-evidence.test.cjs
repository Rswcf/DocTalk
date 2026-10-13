// Converted DOCX/PPTX slide view: LibreOffice draws list bullets as glyphs that
// the extractor's citation text never has (production, 2026-10-12, a 3-slide
// python-pptx deck). The span sequence of slide 1 below is the one the reader
// rendered; the text after "because" was cut off in the report, so its
// continuation and slides 2-3 are illustrative.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require('./_load-ts.cjs');

const SRC = path.resolve(__dirname, '../src');
const pdfEvidence = require(path.join(SRC, 'lib/pdfEvidence.ts'));
const { maskListMarkers, convertedPageIndex, uniqueInPageRange } = require(path.join(SRC, 'lib/convertedEvidence.ts'));
const { findEvidenceRange } = pdfEvidence;

const PAGE = { width: 1000, height: 562.5 }; // 16:9 slide, px
// [text, left, top, width, height] in px, in text-layer order.
const SLIDE_1 = [
  ['Drip lines', 80, 40, 260, 40],
  ['•', 80, 140, 14, 24],
  ['The drip lines in block C were flushed on', 110, 140, 620, 24],
  ['9 September 2026 by the field lead,', 110, 172, 520, 24],
  ['Tomas Brandt.', 110, 204, 190, 24],
  ['•', 80, 250, 14, 24],
  ['He used clean well water only, because', 110, 250, 560, 24],
  ['the reservoir had not yet been tested.', 110, 282, 540, 24],
];
const SLIDE_2 = [
  ['Pump checks', 80, 40, 300, 40],
  ['•', 80, 140, 14, 24],
  ['The pump in block D was serviced on 2 October 2026.', 110, 140, 700, 24],
];
const SLIDE_3 = [
  ['Next steps', 80, 40, 280, 40],
  ['–', 80, 140, 14, 24],
  ['Re-test the reservoir in November.', 110, 140, 480, 24],
];
// The citation focus: the chunker glued the slide title onto the first bullet.
const FIRST_BULLET = 'Drip lines The drip lines in block C were flushed on 9 September 2026 by the field lead, Tomas Brandt.';
const LATER_BULLET = 'He used clean well water only, because the reservoir had not yet been tested.';

const box = ([, left, top, width, height]) => ({ x: left / PAGE.width, y: top / PAGE.height, w: width / PAGE.width, h: height / PAGE.height });
const runsOf = (spans, mask) => spans.map(span => ({ text: mask ? maskListMarkers(span[0]) : span[0], box: box(span) }));
// PdfViewer builds each page's search/uniqueness text the same way.
const pageText = (spans) => spans.map(span => span[0]).join(' ').toLowerCase();
const DECK = [SLIDE_1, SLIDE_2, SLIDE_3];

test('the bug: an unmasked bullet glyph breaks both converted-PDF gates for a first bullet', () => {
  assert.equal(findEvidenceRange(runsOf(SLIDE_1, false), FIRST_BULLET, []), null);
  const squeezedWithBullet = pageText(SLIDE_1).replace(/\s+/g, '');
  assert.ok(squeezedWithBullet.startsWith('driplines•thedriplines'), 'the glyph sits between title and sentence');
  // A later bullet never contained a glyph, so it always matched.
  assert.ok(findEvidenceRange(runsOf(SLIDE_1, false), LATER_BULLET, []));
});

test('the uniqueness gate keeps the glued first bullet once list markers are ignored', () => {
  const index = convertedPageIndex(DECK.map(pageText));
  assert.equal(uniqueInPageRange(index, 1, 1, FIRST_BULLET), true);
  assert.equal(uniqueInPageRange(index, 2, 2, FIRST_BULLET), false, 'still only on the cited page');
  assert.equal(uniqueInPageRange(index, 1, 1, LATER_BULLET), true);
  // An en dash bullet (PowerPoint level 2) is a marker too; the hyphen in "Re-test" is text.
  assert.equal(uniqueInPageRange(index, 3, 3, 'Next steps Re-test the reservoir in November.'), true);
  assert.equal(uniqueInPageRange(index, 3, 3, 'Next steps Retest the reservoir in November.'), false);
});

test('the text-layer match of the glued first bullet covers title and sentence, from the first glyph to the last', () => {
  const match = findEvidenceRange(runsOf(SLIDE_1, true), maskListMarkers(FIRST_BULLET), []);
  assert.deepEqual(match, { start: { run: 0, offset: 0 }, end: { run: 4, offset: 'Tomas Brandt.'.length } });
  const later = findEvidenceRange(runsOf(SLIDE_1, true), maskListMarkers(LATER_BULLET), []);
  assert.deepEqual(later, { start: { run: 6, offset: 0 }, end: { run: 7, offset: SLIDE_1[7][0].length } });
});

test('a bullet inside the same text item as its sentence is masked without moving offsets', () => {
  const glued = [['Drip lines', 80, 40, 260, 40], ['• The drip lines in block C were flushed on', 80, 140, 650, 24],
    ...SLIDE_1.slice(3)];
  const masked = runsOf(glued, true);
  assert.equal(masked[1].text.length, glued[1][0].length);
  const match = findEvidenceRange(masked, maskListMarkers(FIRST_BULLET), []);
  assert.deepEqual(match.start, { run: 0, offset: 0 });
  const sentence = findEvidenceRange(masked, maskListMarkers('The drip lines in block C were flushed on 9 September 2026'), []);
  assert.deepEqual(sentence.start, { run: 1, offset: 2 }, 'the mark starts after the glyph');
});

test('only a marker with whitespace or an item edge on both sides is masked', () => {
  assert.equal(maskListMarkers('•'), ' ');
  assert.equal(maskListMarkers('• ◦ ▪ ● ■ ➢ ✓ –'), '               ');
  assert.equal(maskListMarkers('•\tText'), ' \tText');
  for (const kept of ['pp. 12–14', 'well–known', 'A•B', 'x•', '•x', '2019–2020 budget', '-', 'o Item', '1. Item', '» quote']) {
    assert.equal(maskListMarkers(kept), kept, kept);
  }
  // A spaced en dash in prose is masked on both sides of the comparison, so it still matches itself.
  const prose = [['Revenue rose – sharply – in 2025.', 80, 40, 600, 24]];
  assert.ok(findEvidenceRange(runsOf(prose, true), maskListMarkers('Revenue rose – sharply – in 2025.'), []));
  // Digits joined by a dash never match digits joined by a space, either way round.
  assert.equal(findEvidenceRange(runsOf([['pp. 12–14', 80, 40, 200, 24]], true), maskListMarkers('pp. 12 14'), []), null);
  assert.equal(findEvidenceRange(runsOf([['pp. 12 14', 80, 40, 200, 24]], true), maskListMarkers('pp. 12–14'), []), null);
});

test('masking can only add occurrences to the uniqueness count, so a repeat is still refused', () => {
  const repeated = [...SLIDE_2.slice(0, 1), ['The drip lines in block C were flushed on 9 September 2026 by the field lead, Tomas Brandt.', 110, 140, 900, 24]];
  const index = convertedPageIndex([SLIDE_1, repeated, SLIDE_3].map(pageText));
  const sentence = 'The drip lines in block C were flushed on 9 September 2026 by the field lead, Tomas Brandt.';
  assert.equal(uniqueInPageRange(index, 1, 1, sentence), false, 'once behind a bullet, once without: two occurrences');
  // The glued title makes the slide-1 occurrence distinct again.
  assert.equal(uniqueInPageRange(index, 1, 1, FIRST_BULLET), true);
  // Two identical bullets on one slide: the per-page matcher refuses too.
  const twice = [...SLIDE_1.slice(0, 5), ['•', 80, 250, 14, 24], ['Tomas Brandt.', 110, 250, 190, 24]];
  assert.equal(findEvidenceRange(runsOf(twice, true), maskListMarkers('Tomas Brandt.'), []), null);
});

// ---- The measurement effect itself, with the DOM mocked --------------------
const pageFile = path.join(SRC, 'components/PdfViewer/PageWithHighlights.tsx');
const pageSource = fs.readFileSync(pageFile, 'utf8');
const js = ts.transpileModule(pageSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const sourceFile = ts.createSourceFile(pageFile, js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let effectBody;
(function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'useLayoutEffect') effectBody = node.arguments[0].body.getText(sourceFile);
  ts.forEachChild(node, visit);
})(sourceFile);
assert.ok(effectBody);

function measure(spans, candidate, syntheticBoxes) {
  const elements = spans.map(([text, left, top, width, height]) => ({
    textContent: text, querySelector: () => null,
    getBoundingClientRect: () => ({ left, top, width, height }),
    rect(start, end) { return { left: left + width * start / text.length, top, width: width * (end - start) / text.length, height }; },
  }));
  const updates = [];
  const scope = {
    root: { current: {
      querySelector: () => ({ getBoundingClientRect: () => ({ ...PAGE, left: 0, top: 0 }) }),
      querySelectorAll: () => elements,
    } },
    pageFailed: false, pageDims: { w: PAGE.width, h: PAGE.height }, scale: 1, searchQuery: '', textEpoch: 1, textFailed: false,
    textRenderRef: { current: { scale: 1, searchQuery: '' } }, candidate, navigationId: 1, pageNumber: 1, regions: [],
    measuredRef: { current: null }, setEvidence: value => updates.push(value), onEvidenceReady: () => {},
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, ResizeObserver: class { observe() {} disconnect() {} },
    findEvidenceRange, mergeEvidenceLines: pdfEvidence.mergeEvidenceLines, groupEvidenceMargins: pdfEvidence.groupEvidenceMargins,
    validEvidenceBox: pdfEvidence.validEvidenceBox, evidenceOverlap: pdfEvidence.evidenceOverlap,
    syntheticBoxes, maskListMarkers,
    textPoint: (element, offset) => ({ node: element, offset }),
    document: { createRange: () => {
      const range = { setStart(node, offset) { range.node = node; range.start = offset; }, setEnd(_node, offset) { range.end = offset; },
        getClientRects: () => [range.node.rect(range.start, range.end)] };
      return range;
    } },
  };
  Function(...Object.keys(scope), effectBody.slice(1, -1))(...Object.values(scope))?.();
  return updates.at(-1);
}
const px = rect => ({ left: Math.round(rect.x * PAGE.width), top: Math.round(rect.y * PAGE.height), width: Math.round(rect.w * PAGE.width) });

test('slide view: the glued first bullet is marked exactly, title and sentence lines, never the bullet glyph', () => {
  const result = measure(SLIDE_1, FIRST_BULLET, true);
  assert.equal(result.kind, 'exact');
  assert.deepEqual(result.rects.map(px), [
    { left: 80, top: 40, width: 260 }, // "Drip lines", the title the focus begins with
    { left: 110, top: 140, width: 620 },
    { left: 110, top: 172, width: 520 },
    { left: 110, top: 204, width: 190 },
  ]);
  assert.ok(result.rects.every(rect => rect.x * PAGE.width >= 80 && !(rect.x * PAGE.width < 94 && rect.y * PAGE.height === 140)));
  const later = measure(SLIDE_1, LATER_BULLET, true);
  assert.equal(later.kind, 'exact');
  assert.deepEqual(later.rects.map(px), [{ left: 110, top: 250, width: 560 }, { left: 110, top: 282, width: 540 }]);
});

test('native PDF path (no synthetic boxes) is unchanged: no masking, so the glyph still blocks the match', () => {
  assert.deepEqual(measure(SLIDE_1, FIRST_BULLET, false), { kind: 'page', rects: [], ready: true });
  assert.equal(measure(SLIDE_1, LATER_BULLET, false).kind, 'exact');
});

test('the masking is wired only into the converted path', () => {
  const strip = code => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const page = strip(pageSource);
  assert.match(page, /text: syntheticBoxes \? maskListMarkers\(text\) : text/);
  assert.match(page, /findEvidenceRange\(runs, syntheticBoxes \? maskListMarkers\(candidate\) : candidate, regions\)/);
  assert.match(page, /if \(syntheticBoxes && !runs\[i\]\.text\.trim\(\) && runs\[i\]\.text !== spans\[i\]\.textContent\) continue;/);
  const native = fs.readFileSync(path.join(SRC, 'lib/pdfEvidence.ts'), 'utf8');
  assert.doesNotMatch(native, /maskListMarkers|convertedEvidence|•|\\u2022/, 'pdfEvidence.ts has no bullet handling');
  const converted = strip(fs.readFileSync(path.join(SRC, 'lib/convertedEvidence.ts'), 'utf8'));
  assert.match(converted, /const squeeze = \(value: string\) => canonicalize\(maskListMarkers\(value\)\)\.text\.replace\(\/\\s\+\/g, ''\);/);
});
