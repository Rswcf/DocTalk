// Converted DOCX/PPTX slide view: LibreOffice draws a list bullet as its own
// text item, a glyph the extractor's citation text never has (production,
// 2026-10-12, a 3-slide python-pptx deck). The span sequence of slide 1 below
// is the one the reader rendered; the text after "because" was cut off in the
// report, so its continuation and slides 2-3 are illustrative.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require('./_load-ts.cjs');

const SRC = path.resolve(__dirname, '../src');
const pdfEvidence = require(path.join(SRC, 'lib/pdfEvidence.ts'));
const { isListMarkerItem, convertedPageIndex, uniqueInPageRange } = require(path.join(SRC, 'lib/convertedEvidence.ts'));
const { findEvidenceRange } = pdfEvidence;

const PAGE = { width: 1000, height: 562.5 }; // 16:9 slide, px
// [text, left, top, width, height] in px, in text-layer order (one entry = one pdf.js item = one span).
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
  ['–', 80, 140, 14, 24], // PowerPoint's level-2 bullet
  ['Re-test the reservoir in November.', 110, 140, 480, 24],
];
// The citation focus: the chunker glued the slide title onto the first bullet.
const FIRST_BULLET = 'Drip lines The drip lines in block C were flushed on 9 September 2026 by the field lead, Tomas Brandt.';
const LATER_BULLET = 'He used clean well water only, because the reservoir had not yet been tested.';

const box = ([, left, top, width, height]) => ({ x: left / PAGE.width, y: top / PAGE.height, w: width / PAGE.width, h: height / PAGE.height });
// The converted path's runs, as PageWithHighlights builds them.
const runsOf = (spans, converted = true) => spans.map(span => ({
  text: converted && isListMarkerItem(span[0]) ? ' '.repeat(span[0].length) : span[0], box: box(span),
}));
// PdfViewer keeps each page's items; the old index took their joined text.
const itemsOf = spans => spans.map(span => span[0]);
const joined = spans => itemsOf(spans).join(' ').toLowerCase();
const DECK = [SLIDE_1, SLIDE_2, SLIDE_3];

test('the bug: a bullet glyph breaks both converted-PDF gates for a first bullet', () => {
  assert.equal(findEvidenceRange(runsOf(SLIDE_1, false), FIRST_BULLET, []), null);
  // Joined page text (what the index used before) keeps the glyph between title and sentence.
  assert.equal(uniqueInPageRange(convertedPageIndex(DECK.map(joined)), 1, 1, FIRST_BULLET), false);
  // A later bullet never contained a glyph, so it always matched.
  assert.ok(findEvidenceRange(runsOf(SLIDE_1, false), LATER_BULLET, []));
});

test('the uniqueness index drops bullet-only items and keeps the glued first bullet', () => {
  const index = convertedPageIndex(DECK.map(itemsOf));
  assert.equal(uniqueInPageRange(index, 1, 1, FIRST_BULLET), true);
  assert.equal(uniqueInPageRange(index, 2, 2, FIRST_BULLET), false, 'still only on the cited page');
  assert.equal(uniqueInPageRange(index, 1, 1, LATER_BULLET), true);
  // An en dash bullet item is a marker too; the hyphen in "Re-test" is text.
  assert.equal(uniqueInPageRange(index, 3, 3, 'Next steps Re-test the reservoir in November.'), true);
  assert.equal(uniqueInPageRange(index, 3, 3, 'Next steps Retest the reservoir in November.'), false);
});

test('the text-layer match of the glued first bullet runs from the title to the end of the sentence', () => {
  assert.deepEqual(findEvidenceRange(runsOf(SLIDE_1), FIRST_BULLET, []),
    { start: { run: 0, offset: 0 }, end: { run: 4, offset: 'Tomas Brandt.'.length } });
  assert.deepEqual(findEvidenceRange(runsOf(SLIDE_1), LATER_BULLET, []),
    { start: { run: 6, offset: 0 }, end: { run: 7, offset: SLIDE_1[7][0].length } });
});

test('Codex r1 #1: a marker inside an item is text, so text without it never matches', () => {
  const prose = [['Revenue rose – sharply in 2025.', 80, 40, 600, 24]];
  const index = convertedPageIndex([itemsOf(prose)]);
  assert.equal(uniqueInPageRange(index, 1, 1, 'Revenue rose sharply in 2025.'), false);
  assert.equal(findEvidenceRange(runsOf(prose), 'Revenue rose sharply in 2025.', []), null);
  // The passage with its dash still matches itself.
  assert.equal(uniqueInPageRange(index, 1, 1, 'Revenue rose – sharply in 2025.'), true);
  assert.ok(findEvidenceRange(runsOf(prose), 'Revenue rose – sharply in 2025.', []));
  const range = [['See pp. 12 – 14.', 80, 40, 200, 24]];
  assert.equal(uniqueInPageRange(convertedPageIndex([itemsOf(range)]), 1, 1, 'See pp. 12 14.'), false);
  assert.equal(findEvidenceRange(runsOf(range), 'See pp. 12 14.', []), null);
  // A bullet inside its sentence's own item is not treated as a bullet: no mark, never a wrong one.
  const glued = [SLIDE_1[0], ['• The drip lines in block C were flushed on', 80, 140, 650, 24], ...SLIDE_1.slice(3)];
  assert.equal(uniqueInPageRange(convertedPageIndex([itemsOf(glued)]), 1, 1, FIRST_BULLET), false);
  assert.equal(findEvidenceRange(runsOf(glued), FIRST_BULLET, []), null);
});

test('only an item made of nothing but list markers is a bullet', () => {
  for (const bullet of ['•', ' • ', '●', '▪', '◦', '■', '➢', '✓', '–', '••']) assert.equal(isListMarkerItem(bullet), true, bullet);
  for (const text of ['', '   ', '-', '*', 'o', '1.', '»', '—', '• Text', 'A • B', '12–14', 'x•', 'pp. 12 – 14']) {
    assert.equal(isListMarkerItem(text), false, JSON.stringify(text));
  }
});

test('a repeat is still refused, by the index and by the per-page match', () => {
  const sentence = 'The drip lines in block C were flushed on 9 September 2026 by the field lead, Tomas Brandt.';
  const repeated = [SLIDE_2[0], [sentence, 110, 140, 900, 24]];
  const index = convertedPageIndex([SLIDE_1, repeated, SLIDE_3].map(itemsOf));
  assert.equal(uniqueInPageRange(index, 1, 1, sentence), false, 'once behind a bullet, once without: two occurrences');
  assert.equal(uniqueInPageRange(index, 1, 1, FIRST_BULLET), true, 'the glued title makes the slide-1 occurrence distinct');
  const twice = [...SLIDE_1.slice(0, 5), ['•', 80, 250, 14, 24], ['Tomas Brandt.', 110, 250, 190, 24]];
  assert.equal(findEvidenceRange(runsOf(twice), 'Tomas Brandt.', []), null);
});

test('the index still accepts joined page text, unchanged, for callers without items', () => {
  const index = convertedPageIndex(['the trial enrol led 412 adults']);
  assert.equal(uniqueInPageRange(index, 1, 1, 'The trial enrolled 412 adults'), true);
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
    syntheticBoxes, isListMarkerItem,
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
  const later = measure(SLIDE_1, LATER_BULLET, true);
  assert.equal(later.kind, 'exact');
  assert.deepEqual(later.rects.map(px), [{ left: 110, top: 250, width: 560 }, { left: 110, top: 282, width: 540 }]);
  assert.deepEqual(measure([['Revenue rose – sharply in 2025.', 80, 40, 600, 24]], 'Revenue rose sharply in 2025.', true),
    { kind: 'page', rects: [], ready: true });
});

test('native PDF path (no synthetic boxes) is unchanged: the glyph still blocks the match', () => {
  assert.deepEqual(measure(SLIDE_1, FIRST_BULLET, false), { kind: 'page', rects: [], ready: true });
  assert.equal(measure(SLIDE_1, LATER_BULLET, false).kind, 'exact');
});

test('bullet handling is wired only into the converted path, and both gates use the same rule', () => {
  const strip = code => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const page = strip(pageSource);
  assert.match(page, /const bullets = spans\.map\(span => Boolean\(syntheticBoxes\) && isListMarkerItem\(span\.textContent \|\| ''\)\);/);
  assert.match(page, /text: bullets\[index\] \? ' '\.repeat\(text\.length\) : text/);
  assert.match(page, /findEvidenceRange\(runs, candidate, regions\)/, 'the citation text is never changed');
  assert.match(page, /if \(bullets\[i\]\) continue;/);
  const viewer = strip(fs.readFileSync(path.join(SRC, 'components/PdfViewer/PdfViewer.tsx'), 'utf8'));
  assert.match(viewer, /convertedPageIndex\(cached\.items\)/);
  assert.match(viewer, /pages\.push\(items\.join\(' '\)\.toLowerCase\(\)\);/, 'search text is built as before');
  const native = fs.readFileSync(path.join(SRC, 'lib/pdfEvidence.ts'), 'utf8');
  assert.doesNotMatch(native, /isListMarkerItem|convertedEvidence|•|\\u2022/, 'pdfEvidence.ts has no bullet handling');
  const converted = strip(fs.readFileSync(path.join(SRC, 'lib/convertedEvidence.ts'), 'utf8'));
  assert.match(converted, /page\.filter\(item => !isListMarkerItem\(item\)\)\.join\(' '\)/);
  assert.match(converted, /const squeeze = \(value: string\) => canonicalize\(value\)\.text\.replace\(\/\\s\+\/g, ''\);/);
});
